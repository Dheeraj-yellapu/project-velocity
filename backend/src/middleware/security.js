import os from "os";
import { logAudit } from "../utils/logger.js";
import { securityConfig } from "../utils/securityConfig.js";

// -- Anomaly Detection State (In-Memory) --
const ipTracker = new Map();
const blockList = new Map();

const WINDOW_MS = 60_000; // 1 minute window
const ANOMALY_QPS_THRESHOLD = 50; // Alert if > 50 requests / min from same IP
const ANOMALY_LATENCY_THRESHOLD = 1500; // Alert if query takes > 1.5s
const BLOCK_DURATION_MS = 60_000; // Temporarily block IP for 60 seconds

// -- Garbage Collection for Memory Safety --
// Cleans up stale maps every 5 minutes to prevent OOM memory leaks from spoofed IPs during a DDoS
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamp] of blockList.entries()) {
    if (now > timestamp) blockList.delete(ip);
  }
  for (const [ip, stats] of ipTracker.entries()) {
    if (now - stats.lastSeen > WINDOW_MS * 2) ipTracker.delete(ip);
  }
  // Cap topIps dictionary if it exceeds 1000 unique addresses to save memory mapping
  const keys = Object.keys(stats.topIps);
  if (keys.length > 5000) {
    keys.forEach(k => { if (stats.topIps[k] <= 5) delete stats.topIps[k]; });
  }
}, 300_000);

// -- Request Metadata & Stats State --
export const stats = {
  totalRequests: 0,
  endpoints: {},
  slowQueries: [],
  topIps: {}
};

/**
 * 1. Tracks Request Metadata
 * 2. Runs QPS Anomaly Detection & Short-term blocking
 * 3. Appends Persistent Audit Logs
 */
export function auditAndAnomalyMiddleware(req, res, next) {
  const start = Date.now();
  const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const endpoint = req.originalUrl.split("?")[0]; // Ignore query strings for endpoint mapping

  // Update Global Metrics (Always tracked, regardless of security config)
  stats.totalRequests++;
  stats.topIps[ip] = (stats.topIps[ip] || 0) + 1;
  
  if (!stats.endpoints[endpoint]) {
    stats.endpoints[endpoint] = { hits: 0, totalLatency: 0 };
  }

  // If security is disabled, skip checking the blacklist and checking for anomalies.
  if (securityConfig.enabled) {
    // --- Check Blacklist ---
    if (blockList.has(ip)) {
      if (now < blockList.get(ip)) {
        return res.status(403).json({ error: "IP temporarily blocked due to anomaly detection." });
      } else {
        blockList.delete(ip); // Cool down expired
      }
    }

    // --- Track QPS per IP (Anomaly Check) ---
    if (!ipTracker.has(ip)) {
      ipTracker.set(ip, { count: 1, lastSeen: now });
    } else {
      const ipStats = ipTracker.get(ip);
      if (now - ipStats.lastSeen > WINDOW_MS) {
        ipStats.count = 1; // Reset window
      } else {
        ipStats.count++;
        
        // Detected QPS Anomaly -> Temporarily Block
        if (ipStats.count >= ANOMALY_QPS_THRESHOLD) {
          console.warn(`[SECURITY AUDIT] 🚨 Blocking IP ${ip} for 60s. (Hit ${ipStats.count} reqs/min)`);
          blockList.set(ip, now + BLOCK_DURATION_MS);
          
          logAudit({
            timestamp: new Date().toISOString(),
            ip,
            event: "IP_BLOCKED",
            reason: "Exceeded anomaly threshold",
            endpoint
          });
          
          return res.status(403).json({ error: "IP temporarily blocked due to high load anomalies." });
        }
      }
      ipStats.lastSeen = now;
    }
  }

  // --- Hook into response finish to measure latency and log ---
  res.on("finish", () => {
    const latency = Date.now() - start;
    
    // Update Endpoint Averages
    stats.endpoints[endpoint].hits++;
    stats.endpoints[endpoint].totalLatency += latency;

    // Fast return if we are intentionally ignoring normal audit logging due to high load test/toggle off
    if (!securityConfig.enabled) return;

    // Slow Query Tracking
    if (latency > ANOMALY_LATENCY_THRESHOLD) {
      console.warn(`[SECURITY AUDIT] ⚠️ Slow Query: ${latency}ms | IP: ${ip} | URL: ${req.originalUrl}`);
      stats.slowQueries.push({ ip, url: req.originalUrl, latency, time: new Date().toISOString() });
      if (stats.slowQueries.length > 50) stats.slowQueries.shift(); // Keep memory bound (Last 50)
    }

    // Persist Normal Audit Entry (Async, Non-Blocking)
    logAudit({
      timestamp: new Date().toISOString(),
      ip,
      query: req.query.q || "",
      latency,
      status: (res.statusCode >= 200 && res.statusCode < 400) ? "hit" : "miss", // general flag
      statusCode: res.statusCode,
      endpoint
    });
  });

  next();
}

/**
 * Validates against XSS, SQLi, and Deep Solr abuse injections
 */
export function sanitizeInputMiddleware(req, res, next) {
  if (!securityConfig.enabled) {
    return next(); // Fully bypass input sanitization when disabled globally
  }
  
  let q = req.query.q;
  
  if (q) {
    // 1. Length Limits (Max 100 characters for search bar)
    if (q.length > 100) {
      console.warn(`[SECURITY AUDIT] 🛑 Blocked large payload query from IP: ${req.ip}`);
      return res.status(400).json({ error: "Query exceeds the maximum length of 100 characters." });
    }

    // 2. Normalization (lowercase, trim)
    q = q.trim().toLowerCase();
    req.query.q = q; // Updates query context downwards
    
    // 3. Prevent typical injections (SQL / Script)
    const sqlXssPatterns = /<script>|<\/script>|union\s+select|drop\s+table|--|;/i;
    // Prevent common expensive Solr regex, fuzzy, and excessive generic wildcards
    const solrAbusePatterns = /\*:\*|\*{3,}|~/;

    if (sqlXssPatterns.test(q) || solrAbusePatterns.test(q)) {
      console.error(`[SECURITY AUDIT] 🛑 Blocked Injection/Abuse attempt: ${q}`);
      
      const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.socket.remoteAddress || "unknown";
      logAudit({
        timestamp: new Date().toISOString(),
        ip,
        event: "PAYLOAD_BLOCKED",
        query: q
      });

      return res.status(400).json({ error: "Invalid query payload detected." });
    }
  }
  next();
}
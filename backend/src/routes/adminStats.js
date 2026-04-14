import express from "express";
import { stats } from "../middleware/security.js";
import { securityConfig } from "../utils/securityConfig.js";

const router = express.Router();
const serverStartTime = Date.now();

router.get("/", (_req, res) => {
  const uptimeSeconds = Math.max((Date.now() - serverStartTime) / 1000, 1);
  const currentQPS = (stats.totalRequests / uptimeSeconds).toFixed(2);

  // Aggregate endpoints and averages
  const endpointsStats = {};
  for (const [path, data] of Object.entries(stats.endpoints)) {
    endpointsStats[path] = {
      hits: data.hits,
      averageLatencyMs: data.hits > 0 ? (data.totalLatency / data.hits).toFixed(2) : 0,
    };
  }

  // Get Top 10 IPs
  const topIpsArray = Object.entries(stats.topIps)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([ip, count]) => ({ ip, count }));

  res.json({
    securityEnabled: securityConfig.enabled,
    uptimeSeconds: uptimeSeconds.toFixed(0),
    totalRequests: stats.totalRequests,
    overallQPS: currentQPS,
    topIps: topIpsArray,
    endpoints: endpointsStats,
    slowQueries: [...stats.slowQueries].reverse().slice(0, 10), // Return last 10 entries descending
  });
});

// Endpoint to dynamically safely toggle security mechanisms
router.post("/toggle-security", (req, res) => {
  if (typeof req.body.enabled === "boolean") {
    securityConfig.enabled = req.body.enabled;
    console.log(`[ADMIN] Global security active state changed to: ${securityConfig.enabled}`);
    return res.json({ ok: true, securityEnabled: securityConfig.enabled });
  } else {
    return res.status(400).json({ ok: false, error: "Boolean 'enabled' parameter required." });
  }
});

export default router;
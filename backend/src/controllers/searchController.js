import { buildSearchQuery } from "../utils/queryBuilder.js";
import { searchSolr } from "../services/solrService.js";
import { cacheGet, cacheSet, logSearchMetric } from "../utils/redisClient.js";
import { SOLR_URL } from "../config/solr.js";

/** ═══════════════════════════════════════════════════════════════════
 *  ── L1: In-Memory Cache (0ms latency) ─────────────────────────────
 *  Fastest layer: serves repeated queries without ANY network call.
 *  TTL: 30 seconds. Max entries: 500 (auto-evicts oldest).
 *  ═══════════════════════════════════════════════════════════════════ */
const L1_TTL_MS = 30_000; // 30 seconds
const L1_MAX_ENTRIES = 500;
const memoryCache = new Map();

function l1Get(key) {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > L1_TTL_MS) {
    memoryCache.delete(key);
    return null;
  }
  return entry.data;
}

function l1Set(key, data) {
  // Evict oldest entries if at capacity
  if (memoryCache.size >= L1_MAX_ENTRIES) {
    const oldest = memoryCache.keys().next().value;
    memoryCache.delete(oldest);
  }
  memoryCache.set(key, { data, ts: Date.now() });
}

/** ═══════════════════════════════════════════════════════════════════
 *  ── Request Coalescing (Single-Flight) ────────────────────────────
 *  When 100 concurrent requests arrive for the same query before the
 *  cache is populated, only ONE request actually queries Solr.
 *  The other 99 await the same in-flight Promise and share the result.
 *  ═══════════════════════════════════════════════════════════════════ */
const inflightQueries = new Map();

function normalizeIp(rawIp) {
  if (!rawIp) return null;
  const ip = String(rawIp);
  if (ip.startsWith("::ffff:")) return ip.replace("::ffff:", "");
  return ip;
}

function getBackendIp(req) {
  return (
    normalizeIp(req.socket?.localAddress) ||
    normalizeIp(req.socket?.address?.().address) ||
    normalizeIp(req.headers["x-forwarded-for"]?.split(",")?.[0]) ||
    "unknown"
  );
}

function getSolrIp() {
  try {
    return new URL(SOLR_URL).hostname;
  } catch (_err) {
    return "unknown";
  }
}

async function singleFlightSolrQuery(cacheKey, queryParams) {
  if (inflightQueries.has(cacheKey)) {
    return inflightQueries.get(cacheKey);
  }

  const queryPromise = (async () => {
    try {
      const solrResponse = await searchSolr(queryParams);
      const qtime = solrResponse.responseHeader?.QTime ?? null;
      const numFound = solrResponse.response?.numFound ?? 0;
      const docs = solrResponse.response?.docs ?? [];

      const payload = {
        results: docs,
        total: numFound,
        qtime_ms: qtime,
      };

      // Populate L1 + L2 caches
      l1Set(cacheKey, payload);
      cacheSet(cacheKey, payload).catch(() => {});

      return { payload, qtime };
    } finally {
      inflightQueries.delete(cacheKey);
    }
  })();

  inflightQueries.set(cacheKey, queryPromise);
  return queryPromise;
}

/** ═══════════════════════════════════════════════════════════════════
 *  GET /api/search?q=XYZ
 *
 *  3-Tier Cache Architecture:
 *    L1 → In-Memory Map  (0ms,  local process)
 *    L2 → Redis           (1-5ms, shared across machines)
 *    L3 → Solr            (50-200ms, source of truth)
 *
 *  + Single-Flight coalescing prevents stampede at L3
 *  ═══════════════════════════════════════════════════════════════════ */
async function searchController(req, res, next) {
  const startTime = performance.now();  // Use high-precision timer (microsecond accuracy)
  const backendIp = getBackendIp(req);
  const solrIp = getSolrIp();

  try {
    const rawQuery = (req.query.q || "").trim();
    if (!rawQuery) {
      return res.status(400).json({
        error: "Missing query parameter `q`",
        results: [],
        total: 0,
      });
    }

    const { type, lang, from, to, sort, start, rows } = req.query;

    // ── Normalized cache key ─────────────────────────────────────────
    const normSort  = sort  || "relevance";
    const normStart = start || "0";
    const normRows  = rows  || "10";
    const cacheKeyParts = [rawQuery, type, lang, from, to, normSort, normStart, normRows]
      .filter(Boolean)
      .join("|");
    const cacheKey = `search:${cacheKeyParts}`;

    // ── L1: In-Memory Cache (0ms) ────────────────────────────────────
    const memCached = l1Get(cacheKey);
    if (memCached) {
      const totalLatency = Number((performance.now() - startTime).toFixed(3));

      logSearchMetric({
        timestamp: Date.now(),  // Use regular timestamp for logging
        query: rawQuery,
        latency: totalLatency,
        results: memCached.total,
        source: "cache",
        status: "ok",
        ip: backendIp,
      }).catch(() => {});

      return res.json({
        ...memCached,
        total_latency_ms: totalLatency,
        source: "cache",
      });
    }

    // ── L2: Redis Cache (1-5ms) ──────────────────────────────────────
    const redisCached = await cacheGet(cacheKey);
    if (redisCached) {
      const totalLatency = Number((performance.now() - startTime).toFixed(3));

      // Promote to L1 for next time
      l1Set(cacheKey, redisCached);

      logSearchMetric({
        timestamp: Date.now(),  // Use regular timestamp for logging
        query: rawQuery,
        latency: totalLatency,
        results: redisCached.total,
        source: "cache",
        status: "ok",
        ip: backendIp,
      }).catch(() => {});

      return res.json({
        ...redisCached,
        total_latency_ms: totalLatency,
        source: "cache",
      });
    }

    // ── L3: Solr (coalesced — only 1 flight per unique query) ────────
    const queryParams = buildSearchQuery(req.query);
    const { payload, qtime } = await singleFlightSolrQuery(cacheKey, queryParams);

    const totalLatency = Number((performance.now() - startTime).toFixed(3));
    console.log(
      `[Search] SOLR QUERY  q="${rawQuery}"  QTime=${qtime}ms  total=${totalLatency}ms  docs=${payload.total}`
    );

    logSearchMetric({
      timestamp: Date.now(),  // Use regular timestamp for logging
      query: rawQuery,
      latency: totalLatency,
      results: payload.total,
      source: "solr",
      status: "ok",
      ip: solrIp,
    }).catch(() => {});

    return res.json({
      ...payload,
      query: rawQuery,
      total_latency_ms: totalLatency,
      source: "solr",
    });
  } catch (error) {
    const rawQuery = (req.query.q || "").trim();
    if (rawQuery) {
      logSearchMetric({
        timestamp: Date.now(),
        query: rawQuery,
        latency: Number((performance.now() - startTime).toFixed(3)),
        results: 0,
        source: "error",
        status: "error",
        ip: solrIp,
      }).catch(() => {});
    }
    next(error);
  }
}

export { searchController };

import { buildSearchQuery } from "../utils/queryBuilder.js";
import { searchSolr } from "../services/solrService.js";
import { cacheGet, cacheSet, cacheDel } from "../utils/redisClient.js";

/** ── Predefined benchmark queries ─────────────────────────────────── */
const BENCHMARK_QUERIES = [
  "politics",
  "economy",
  "sports",
  "technology",
  "climate change",
  "elections",
  "healthcare",
  "education",
];

/**
 * GET /api/benchmark
 *
 * Runs each query twice:
 *   1. RAW  — bypasses Redis cache, measures direct Solr performance
 *   2. CACHED — seeds the cache, then reads from it
 *
 * Returns an array of detailed per-query metrics.
 */
async function benchmarkController(_req, res, next) {
  try {
    const results = [];

    for (const q of BENCHMARK_QUERIES) {
      const cacheKey = `search:${q}`;

      // ── 1. Raw Solr (bypass cache) ───────────────────────────────
      await cacheDel(cacheKey); // ensure cache miss

      const rawStart = Date.now();
      const queryParams = buildSearchQuery({ q, page: 1, pageSize: 10 });
      const solrResponse = await searchSolr(queryParams);
      const rawLatency = Date.now() - rawStart;

      const qtime = solrResponse.responseHeader?.QTime ?? null;
      const numFound = solrResponse.response?.numFound ?? 0;
      const docs = solrResponse.response?.docs ?? [];

      // ── 2. Seed cache ────────────────────────────────────────────
      const payload = {
        results: docs,
        total: numFound,
        qtime_ms: qtime,
        query: q,
      };
      await cacheSet(cacheKey, payload);

      // ── 3. Cached read ───────────────────────────────────────────
      const cachedStart = Date.now();
      const cached = await cacheGet(cacheKey);
      const cachedLatency = Date.now() - cachedStart;

      results.push({
        query: q,
        num_results: numFound,
        solr_qtime_ms: qtime,
        raw_solr_latency_ms: rawLatency,
        cached_latency_ms: cached ? cachedLatency : null,
        speedup: cached
          ? `${(rawLatency / Math.max(cachedLatency, 1)).toFixed(1)}x`
          : "N/A",
        cache_hit: !!cached,
      });
    }

    // ── Summary statistics ─────────────────────────────────────────
    const avgRaw =
      results.reduce((s, r) => s + r.raw_solr_latency_ms, 0) / results.length;
    const avgCached =
      results
        .filter((r) => r.cached_latency_ms !== null)
        .reduce((s, r) => s + r.cached_latency_ms, 0) /
      results.filter((r) => r.cached_latency_ms !== null).length;
    const avgQTime =
      results
        .filter((r) => r.solr_qtime_ms !== null)
        .reduce((s, r) => s + r.solr_qtime_ms, 0) /
      results.filter((r) => r.solr_qtime_ms !== null).length;

    return res.json({
      benchmark: results,
      summary: {
        total_queries: results.length,
        avg_raw_latency_ms: Math.round(avgRaw),
        avg_cached_latency_ms: Math.round(avgCached) || null,
        avg_solr_qtime_ms: Math.round(avgQTime) || null,
        avg_speedup: avgCached
          ? `${(avgRaw / Math.max(avgCached, 1)).toFixed(1)}x`
          : "N/A",
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export { benchmarkController };

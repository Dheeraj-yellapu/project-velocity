import { searchController } from "./searchController.js";

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

async function runSearchViaController(queryObject) {
  const req = {
    query: queryObject,
    socket: {
      localAddress: "127.0.0.1",
      address: () => ({ address: "127.0.0.1" }),
    },
    headers: {},
  };

  return new Promise((resolve, reject) => {
    const startedAt = performance.now();
    let statusCode = 200;

    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(payload) {
        const latencyMs = Number((performance.now() - startedAt).toFixed(3));
        resolve({ statusCode, payload, latencyMs });
      },
    };

    searchController(req, res, reject).catch(reject);
  });
}

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
      const benchmarkQuery = {
        q,
        sort: "relevance",
        start: "0",
        rows: "10",
      };

      // Run twice with the same req.query shape so cache key generation is identical.
      const rawRun = await runSearchViaController(benchmarkQuery);
      const cachedRun = await runSearchViaController(benchmarkQuery);

      if (rawRun.statusCode >= 400 || cachedRun.statusCode >= 400) {
        throw new Error(`Benchmark request failed for query: ${q}`);
      }

      const rawLatency = rawRun.latencyMs;
      const cachedLatency =
        cachedRun.payload?.source === "cache" ? cachedRun.latencyMs : null;
      const qtime = rawRun.payload?.qtime_ms ?? null;
      const numFound = rawRun.payload?.total ?? 0;

      results.push({
        query: q,
        num_results: numFound,
        solr_qtime_ms: qtime,
        raw_solr_latency_ms: rawLatency,
        cached_latency_ms: cachedLatency,
        speedup: cachedLatency
          ? `${(rawLatency / Math.max(cachedLatency, 1)).toFixed(1)}x`
          : "N/A",
        cache_hit: cachedRun.payload?.source === "cache",
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

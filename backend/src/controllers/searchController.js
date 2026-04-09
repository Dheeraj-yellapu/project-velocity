import { buildSearchQuery } from "../utils/queryBuilder.js";
import { searchSolr } from "../services/solrService.js";
import { cacheGet, cacheSet } from "../utils/redisClient.js";

/**
 * GET /api/search?q=XYZ
 *
 * Flow:
 *   1. Check Redis for `search:{query}` → return cached if hit
 *   2. Build edismax query with field boosting + recency bias
 *   3. Query Solr via Axios
 *   4. Cache the structured response in Redis (60s TTL)
 *   5. Return results + performance metrics to the client
 */
async function searchController(req, res, next) {
  const startTime = Date.now();

  try {
    const rawQuery = (req.query.q || "").trim();
    if (!rawQuery) {
      return res.status(400).json({
        error: "Missing query parameter `q`",
        results: [],
        total: 0,
      });
    }

    // ── 1. Cache check ──────────────────────────────────────────────
    const cacheKey = `search:${rawQuery}`;
    const cached = await cacheGet(cacheKey);

    if (cached) {
      const totalLatency = Date.now() - startTime;
      console.log(
        `[Search] CACHE HIT  q="${rawQuery}"  latency=${totalLatency}ms`
      );
      return res.json({
        ...cached,
        total_latency_ms: totalLatency,
        source: "cache",
      });
    }

    // ── 2. Build edismax query ──────────────────────────────────────
    const queryParams = buildSearchQuery(req.query);

    // ── 3. Query Solr ───────────────────────────────────────────────
    const solrResponse = await searchSolr(queryParams);

    const qtime = solrResponse.responseHeader?.QTime ?? null;
    const numFound = solrResponse.response?.numFound ?? 0;
    const docs = solrResponse.response?.docs ?? [];

    // ── 4. Structure & cache the response ───────────────────────────
    const payload = {
      results: docs,
      total: numFound,
      qtime_ms: qtime,
      query: rawQuery,
    };

    // Fire-and-forget cache write
    cacheSet(cacheKey, payload).catch(() => {});

    // ── 5. Return ───────────────────────────────────────────────────
    const totalLatency = Date.now() - startTime;
    console.log(
      `[Search] SOLR QUERY  q="${rawQuery}"  QTime=${qtime}ms  total=${totalLatency}ms  docs=${numFound}`
    );

    return res.json({
      ...payload,
      total_latency_ms: totalLatency,
      source: "solr",
    });
  } catch (error) {
    next(error);
  }
}

export { searchController };

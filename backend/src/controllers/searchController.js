import { buildSearchQuery } from "../utils/queryBuilder.js";
import { searchSolr } from "../services/solrService.js";
import { cacheGet, cacheSet, logSearchMetric } from "../utils/redisClient.js";

/**
 * ── Request Coalescing (Single-Flight) ──────────────────────────────
 * When 100 concurrent requests arrive for the same query before the
 * cache is populated, only ONE request actually queries Solr.
 * The other 99 await the same in-flight Promise and share the result.
 * This prevents cache stampede from overwhelming Solr.
 * ──────────────────────────────────────────────────────────────────── */
const inflightQueries = new Map();

/**
 * Execute a Solr query with single-flight deduplication.
 * If an identical query is already in progress, piggyback on it.
 */
async function singleFlightSolrQuery(cacheKey, queryParams) {
  // If this exact query is already in-flight, wait for it
  if (inflightQueries.has(cacheKey)) {
    return inflightQueries.get(cacheKey);
  }

  // Otherwise, start the query and register the promise
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

      // Populate cache so future requests skip Solr entirely
      cacheSet(cacheKey, payload).catch(() => {});

      return { payload, qtime };
    } finally {
      // Always clean up the in-flight entry
      inflightQueries.delete(cacheKey);
    }
  })();

  inflightQueries.set(cacheKey, queryPromise);
  return queryPromise;
}

/**
 * GET /api/search?q=XYZ
 *
 * Flow:
 *   1. Check Redis for `search:{query}` → return cached if hit
 *   2. Single-flight: coalesce duplicate in-flight Solr queries
 *   3. Build edismax query with field boosting + recency bias
 *   4. Query Solr via Axios (only 1 request per unique query)
 *   5. Cache the structured response in Redis (60s TTL)
 *   6. Return results + performance metrics to the client
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

    // ── Extract filter/sort/pagination params ────────────────────────
    const { type, lang, from, to, sort, start, rows } = req.query;

    // ── 1. Cache check ──────────────────────────────────────────────
    // Normalize defaults so the key is ALWAYS the same for the same
    // logical query, regardless of whether params are explicit or omitted.
    // e.g. "bomb" from loadtest, browser, or teammate all → "search:bomb|relevance|0|10"
    const normSort  = sort  || "relevance";
    const normStart = start || "0";
    const normRows  = rows  || "10";
    const cacheKeyParts = [rawQuery, type, lang, from, to, normSort, normStart, normRows]
      .filter(Boolean)
      .join("|");
    const cacheKey = `search:${cacheKeyParts}`;
    const cached = await cacheGet(cacheKey);

    if (cached) {
      const totalLatency = Date.now() - startTime;
      console.log(
        `[Search] CACHE HIT  q="${rawQuery}"  latency=${totalLatency}ms`
      );

      logSearchMetric({
        timestamp: startTime,
        query: rawQuery,
        latency: totalLatency,
        results: cached.total,
        source: "cache",
        status: "ok"
      }).catch(() => {});

      return res.json({
        ...cached,
        total_latency_ms: totalLatency,
        source: "cache",
      });
    }

    // ── 2. Build edismax query ──────────────────────────────────────
    const queryParams = buildSearchQuery(req.query);

    // ── 3. Query Solr (coalesced — only 1 flight per unique query) ──
    const { payload, qtime } = await singleFlightSolrQuery(cacheKey, queryParams);

    // ── 4. Return ───────────────────────────────────────────────────
    const totalLatency = Date.now() - startTime;
    const source = inflightQueries.has(cacheKey) ? "coalesced" : "solr";
    console.log(
      `[Search] SOLR QUERY  q="${rawQuery}"  QTime=${qtime}ms  total=${totalLatency}ms  docs=${payload.total}`
    );

    logSearchMetric({
      timestamp: startTime,
      query: rawQuery,
      latency: totalLatency,
      results: payload.total,
      source: "solr",
      status: "ok"
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
        timestamp: startTime,
        query: rawQuery,
        latency: Date.now() - startTime,
        results: 0,
        source: "error",
        status: "error"
      }).catch(() => {});
    }
    next(error);
  }
}

export { searchController };

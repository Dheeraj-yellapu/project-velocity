import { buildSearchQuery } from "../utils/queryBuilder.js";
import { searchSolr } from "../services/solrService.js";
import { cacheGet, cacheSet, logSearchMetric } from "../utils/redisClient.js";
import { SOLR_URL } from "../config/solr.js";
import os from "os";

/** ═══════════════════════════════════════════════════════════════════
 *  ── L1: In-Memory Cache (0ms latency) ─────────────────────────────
 *  Fastest layer: serves repeated queries without ANY network call.
 *  TTL: 2 minutes. Max entries: 2000 (auto-evicts oldest).
 *  ═══════════════════════════════════════════════════════════════════ */
const L1_TTL_MS = 120_000; // 2 minutes (was 30s, now 4x longer for better hit rate)
const L1_MAX_ENTRIES = 2000; // 4x larger cache (was 500, now 2000 for ~8MB per backend)
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

function extractSolrNodeIps(solrResponse) {
  const shardInfo = solrResponse?.["shards.info"] || {};
  const addresses = Object.values(shardInfo)
    .map((item) => item?.shardAddress)
    .filter(Boolean);

  const parsedHosts = addresses
    .map((address) => {
      try {
        const asUrl = address.startsWith("http") ? address : `http://${address}`;
        return new URL(asUrl).hostname;
      } catch (_err) {
        return null;
      }
    })
    .filter(Boolean);

  if (parsedHosts.length > 0) return [...new Set(parsedHosts)];
  return [getSolrIp()];
}

function nodeIpsToText(nodeIps) {
  if (!Array.isArray(nodeIps) || nodeIps.length === 0) return "unknown";
  return [...new Set(nodeIps)].join(", ");
}

const HARD_TOPICS = [
  "ENVIRONMENT",
  "BUSINESS",
  "POLITICS",
  "SPORTS",
  "ECONOMY",
  "TECHNOLOGY",
  "HEALTH",
  "WORLD",
];

function parseTypeFacets(solrResponse) {
  const facetValues = solrResponse?.facet_counts?.facet_fields?.type || [];
  const topics = [];

  for (let i = 0; i < facetValues.length; i += 2) {
    const value = facetValues[i];
    const count = facetValues[i + 1];
    if (typeof value === "string" && value.trim()) {
      topics.push({ value, count: Number(count) || 0 });
    }
  }

  return topics.sort((a, b) => a.value.localeCompare(b.value));
}

async function fetchMatchingTopics(searchQuery = "") {
  const normalizedQuery = String(searchQuery || "").trim().toLowerCase();
  const facetQuery = {
    q: "*:*",
    rows: 0,
    facet: "true",
    "facet.field": "type",
    "facet.limit": 25,
    "facet.mincount": 1,
    "facet.sort": "index",
  };

  if (normalizedQuery) {
    facetQuery["facet.contains"] = normalizedQuery;
    facetQuery["facet.contains.ignoreCase"] = "true";
  }

  const solrResponse = await searchSolr(facetQuery);
  const facetTopics = parseTypeFacets(solrResponse);

  const hardTopics = HARD_TOPICS
    .filter((topic) => !normalizedQuery || topic.toLowerCase().includes(normalizedQuery))
    .map((topic) => ({ value: topic, count: 0 }));

  const merged = new Map();
  [...facetTopics, ...hardTopics].forEach((topic) => {
    const key = String(topic.value || "").toLowerCase();
    if (!key) return;
    const existing = merged.get(key);
    if (!existing || Number(topic.count || 0) > Number(existing.count || 0)) {
      merged.set(key, { value: String(topic.value).trim(), count: Number(topic.count) || 0 });
    }
  });

  const topics = [...merged.values()].sort((a, b) => a.value.localeCompare(b.value, undefined, { sensitivity: "base" }));
  const matchedTopic = normalizedQuery
    ? topics.find((topic) => String(topic.value).toLowerCase() === normalizedQuery)?.value || null
    : null;

  return { topics, matchedTopic };
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
      const solrNodeIps = extractSolrNodeIps(solrResponse);

      const payload = {
        results: docs,
        total: numFound,
        qtime_ms: qtime,
        solrNodeIps,
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
      const cacheNodeIp = nodeIpsToText(memCached.solrNodeIps?.length ? memCached.solrNodeIps : [solrIp]);

      logSearchMetric({
        timestamp: Date.now(),  // Use regular timestamp for logging
        query: rawQuery,
        latency: totalLatency,
        results: memCached.total,
        source: "cache",
        status: "ok",
        servedBy: cacheNodeIp,
        ip: cacheNodeIp,
        backendId: os.hostname() || "backend",
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
      const cacheNodeIp = nodeIpsToText(redisCached.solrNodeIps?.length ? redisCached.solrNodeIps : [solrIp]);

      // Promote to L1 for next time
      l1Set(cacheKey, redisCached);

      logSearchMetric({
        timestamp: Date.now(),  // Use regular timestamp for logging
        query: rawQuery,
        latency: totalLatency,
        results: redisCached.total,
        source: "cache",
        status: "ok",
        servedBy: cacheNodeIp,
        ip: cacheNodeIp,
        backendId: os.hostname() || "backend",
      }).catch(() => {});

      return res.json({
        ...redisCached,
        total_latency_ms: totalLatency,
        source: "cache",
      });
    }

    // ── L3: Solr (coalesced — only 1 flight per unique query) ────────
    const queryParams = buildSearchQuery(req.query);
    queryParams["shards.info"] = "true";
    const { payload, qtime } = await singleFlightSolrQuery(cacheKey, queryParams);
    const solrNodeIp = nodeIpsToText(payload.solrNodeIps);

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
      servedBy: solrNodeIp,
      ip: solrNodeIp,
      backendId: os.hostname() || "backend",
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
        servedBy: solrIp,
        ip: solrIp,
        backendId: os.hostname() || "backend",
      }).catch(() => {});
    }
    next(error);
  }
}

async function topicFacetsController(req, res, next) {
  try {
    const searchQuery = req.query.q || "";
    const { topics, matchedTopic } = await fetchMatchingTopics(searchQuery);
    return res.json({ topics, matchedTopic });
  } catch (error) {
    next(error);
  }
}

export { searchController, topicFacetsController };

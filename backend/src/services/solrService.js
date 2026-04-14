import axios from "axios";
import http from "http";
import https from "https";
import { SOLR_URL, SOLR_COLLECTION } from "../config/solr.js";

// Connection pooling for better throughput under load
// With 400+ concurrent users, allow up to 500 persistent connections
// Keeps sockets alive to reuse TCP connections (huge latency savings)
const httpAgent = new http.Agent({ 
  keepAlive: true, 
  maxSockets: 500,
  maxFreeSockets: 100,
  freeSocketTimeout: 30000  // Free up idle sockets after 30s
});
const httpsAgent = new https.Agent({ 
  keepAlive: true, 
  maxSockets: 500,
  maxFreeSockets: 100,
  freeSocketTimeout: 30000  // Free up idle sockets after 30s
});

/** ── Build URLSearchParams from an object (supports arrays for fq) ─ */
function buildParams(params) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((v) => search.append(key, v));
    } else if (value !== undefined && value !== null) {
      search.append(key, String(value));
    }
  });
  search.append("wt", "json");
  return search.toString();
}

/**
 * Query Solr using Axios.
 * Returns the full Solr JSON response including responseHeader (QTime).
 */
async function searchSolr(queryParams) {
  const queryString = buildParams(queryParams);
  const url = `${SOLR_URL}/${SOLR_COLLECTION}/select?${queryString}`;

  try {
    const { data } = await axios.get(url, {
      timeout: 15000, // 15s timeout to handle remote network latency + queue wait
      headers: { Accept: "application/json" },
      httpAgent,
      httpsAgent,
    });
    return data;
  } catch (err) {
    if (err.response) {
      throw new Error(
        `Solr search failed (${err.response.status}): ${JSON.stringify(err.response.data)}`
      );
    }
    throw new Error(`Solr connection error: ${err.message}`);
  }
}

export { searchSolr };

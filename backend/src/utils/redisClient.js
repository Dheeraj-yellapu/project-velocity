import { createClient } from "redis";

/** ── Redis Client with Graceful Degradation ──────────────────────────
 *  If Redis is unavailable, the app falls back to direct Solr queries.
 *  No crash, no hanging — just a log warning.
 *
 *  Key design: connection attempt has a hard timeout (2s) and limited
 *  retries so the search endpoint is never blocked.
 * ──────────────────────────────────────────────────────────────────── */

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const CACHE_TTL = Number(process.env.CACHE_TTL) || 60; // seconds
const CONNECT_TIMEOUT_MS = 2000; // give up connecting after 2s
const MAX_RETRIES = 3;

let client = null;
let isConnected = false;
let connectAttempted = false;
let connectFailed = false;
let retryCount = 0;

/**
 * Race a promise against a timeout.
 */
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Redis connection timeout")), ms)
    ),
  ]);
}

async function getClient() {
  // If we already know Redis is down, skip entirely (fast path)
  if (connectFailed) return null;
  if (client && isConnected) return client;

  if (!client) {
    client = createClient({
      url: REDIS_URL,
      socket: {
        connectTimeout: CONNECT_TIMEOUT_MS,
        reconnectStrategy: (attempts) => {
          retryCount = attempts;
          if (attempts >= MAX_RETRIES) {
            console.warn(
              `[Redis] Giving up after ${MAX_RETRIES} retries. Operating without cache.`
            );
            connectFailed = true;
            isConnected = false;
            return false; // stop reconnecting
          }
          // Exponential backoff: 500ms, 1s, 2s
          return Math.min(attempts * 500, 2000);
        },
      },
    });

    client.on("error", (err) => {
      if (isConnected) {
        console.warn("[Redis] Connection lost:", err.message);
      }
      isConnected = false;
    });

    client.on("connect", () => {
      console.log("[Redis] Connected to", REDIS_URL);
      isConnected = true;
      connectFailed = false;
      retryCount = 0;
    });

    client.on("end", () => {
      isConnected = false;
    });
  }

  // Don't block if already attempted and failed
  if (connectAttempted && !isConnected) return null;

  try {
    if (!client.isOpen) {
      connectAttempted = true;
      await withTimeout(client.connect(), CONNECT_TIMEOUT_MS);
    }
    isConnected = true;
    return client;
  } catch (err) {
    console.warn("[Redis] Could not connect:", err.message);
    isConnected = false;
    connectFailed = true;
    // Destroy the failed client so it doesn't keep retrying
    try {
      client.destroy();
    } catch {
      // ignore
    }
    client = null;
    return null;
  }
}

/**
 * Get a cached value by key.
 * Returns null if Redis is down or key doesn't exist.
 */
async function cacheGet(key) {
  if (connectFailed) return null; // fast path
  try {
    const redis = await getClient();
    if (!redis) return null;
    const raw = await redis.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn("[Redis] GET error:", err.message);
    return null;
  }
}

/**
 * Set a cached value with TTL.
 * Silently fails if Redis is down.
 */
async function cacheSet(key, value, ttl = CACHE_TTL) {
  if (connectFailed) return; // fast path
  try {
    const redis = await getClient();
    if (!redis) return;
    await redis.set(key, JSON.stringify(value), { EX: ttl });
  } catch (err) {
    console.warn("[Redis] SET error:", err.message);
  }
}

/**
 * Delete a cached key (used for cache bypass in benchmarks).
 */
async function cacheDel(key) {
  if (connectFailed) return; // fast path
  try {
    const redis = await getClient();
    if (!redis) return;
    await redis.del(key);
  } catch (err) {
    console.warn("[Redis] DEL error:", err.message);
  }
}

/**
 * Check if Redis is currently connected.
 */
function isRedisConnected() {
  return isConnected;
}

export { cacheGet, cacheSet, cacheDel, isRedisConnected, CACHE_TTL };

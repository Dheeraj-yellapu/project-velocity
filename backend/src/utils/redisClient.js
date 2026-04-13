import { createClient } from "redis";
import { readFile, writeFile } from "node:fs/promises";

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
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "velocity2024";
const PASSWORD_CHANGED_AT_KEY = "admin:password:changedAt";
const ADMIN_SETTINGS_FILE = new URL("../../.admin-settings.json", import.meta.url);

let client = null;
let isConnected = false;
let connectAttempted = false;
let connectFailed = false;
let retryCount = 0;

// Local fallback memory list to keep Admin Dashboard alive when Redis is down
const localLogsFallback = [];
let localAdminPasswordFallback = DEFAULT_ADMIN_PASSWORD;
let localPasswordChangedAtFallback = Date.now();

async function readLocalAdminSettings() {
  try {
    const raw = await readFile(ADMIN_SETTINGS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    const password = typeof parsed.password === "string" && parsed.password.length > 0
      ? parsed.password
      : DEFAULT_ADMIN_PASSWORD;
    const changedAt = Number(parsed.changedAt);
    return {
      password,
      changedAt: Number.isFinite(changedAt) && changedAt > 0 ? changedAt : Date.now(),
    };
  } catch {
    return {
      password: localAdminPasswordFallback,
      changedAt: localPasswordChangedAtFallback,
    };
  }
}

async function writeLocalAdminSettings(password, changedAt) {
  localAdminPasswordFallback = password;
  localPasswordChangedAtFallback = changedAt;
  const body = JSON.stringify({ password, changedAt }, null, 2);
  await writeFile(ADMIN_SETTINGS_FILE, body, "utf8");
}

async function getFallbackAdminSettings() {
  const settings = await readLocalAdminSettings();
  localAdminPasswordFallback = settings.password;
  localPasswordChangedAtFallback = settings.changedAt;
  return settings;
}

async function setFallbackAdminSettings(password) {
  const changedAt = Date.now();
  await writeLocalAdminSettings(password, changedAt);
  return { password, changedAt };
}

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
 * Log a search metric to a rolling Redis list
 */
async function logSearchMetric(metric) {
  if (connectFailed) {
    // If Redis is dead, use in-memory fallback so Admin dashboard still works!
    localLogsFallback.unshift(metric);
    if (localLogsFallback.length > 500) localLogsFallback.pop();
    return;
  }
  try {
    const redis = await getClient();
    if (!redis) return;
    const key = "analytics:requests";
    await redis.lPush(key, JSON.stringify(metric));
    // Keep only the last 10000 queries
    await redis.lTrim(key, 0, 9999);
  } catch (err) {
    console.warn("[Redis] logMetric error:", err.message);
  }
}

/**
 * Get all search metrics from the list
 */
async function getSearchMetrics() {
  if (connectFailed) return localLogsFallback;
  try {
    const redis = await getClient();
    if (!redis) return localLogsFallback;
    const elements = await redis.lRange("analytics:requests", 0, -1);
    return elements.map((e) => JSON.parse(e));
  } catch (err) {
    console.warn("[Redis] getMetrics error:", err.message);
    return localLogsFallback;
  }
}

/**
 * Clear all stored search metrics from Redis and fallback memory.
 */
async function clearSearchMetrics() {
  localLogsFallback.length = 0;
  if (connectFailed) return;
  try {
    const redis = await getClient();
    if (!redis) return;
    await redis.del(["analytics:requests", "analytics:logs"]);
  } catch (err) {
    console.warn("[Redis] clearSearchMetrics error:", err.message);
  }
}

/**
 * Read admin password from storage. If not set in Redis, seed default value.
 */
async function getAdminPassword() {
  if (connectFailed) {
    const settings = await getFallbackAdminSettings();
    return settings.password;
  }
  try {
    const redis = await getClient();
    if (!redis) {
      const settings = await getFallbackAdminSettings();
      return settings.password;
    }

    const stored = await redis.get("admin:password");
    if (stored) return stored;

    await redis.set("admin:password", DEFAULT_ADMIN_PASSWORD);
    const changedAt = await redis.get(PASSWORD_CHANGED_AT_KEY);
    if (!changedAt) {
      localPasswordChangedAtFallback = Date.now();
      await redis.set(PASSWORD_CHANGED_AT_KEY, String(localPasswordChangedAtFallback));
    }
    return DEFAULT_ADMIN_PASSWORD;
  } catch (err) {
    console.warn("[Redis] getAdminPassword error:", err.message);
    const settings = await getFallbackAdminSettings();
    return settings.password;
  }
}

/**
 * Persist updated admin password.
 */
async function setAdminPassword(newPassword) {
  const changedAt = Date.now();
  localAdminPasswordFallback = newPassword;
  localPasswordChangedAtFallback = changedAt;
  if (connectFailed) {
    await setFallbackAdminSettings(newPassword);
    return;
  }
  try {
    const redis = await getClient();
    if (!redis) {
      await setFallbackAdminSettings(newPassword);
      return;
    }
    await redis.set("admin:password", newPassword);
    await redis.set(PASSWORD_CHANGED_AT_KEY, String(changedAt));
  } catch (err) {
    console.warn("[Redis] setAdminPassword error:", err.message);
    await setFallbackAdminSettings(newPassword);
  }
}

async function verifyAdminPassword(candidatePassword) {
  const currentPassword = await getAdminPassword();
  return candidatePassword === currentPassword;
}

async function getAdminPasswordMeta() {
  if (connectFailed) {
    const settings = await getFallbackAdminSettings();
    return { changedAt: settings.changedAt };
  }

  try {
    const redis = await getClient();
    if (!redis) {
      const settings = await getFallbackAdminSettings();
      return { changedAt: settings.changedAt };
    }

    const changedAtRaw = await redis.get(PASSWORD_CHANGED_AT_KEY);
    if (!changedAtRaw) {
      const seed = Date.now();
      localPasswordChangedAtFallback = seed;
      await redis.set(PASSWORD_CHANGED_AT_KEY, String(seed));
      return { changedAt: seed };
    }

    const parsed = Number(changedAtRaw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      const settings = await getFallbackAdminSettings();
      return { changedAt: settings.changedAt };
    }

    localPasswordChangedAtFallback = parsed;
    return { changedAt: parsed };
  } catch (err) {
    console.warn("[Redis] getAdminPasswordMeta error:", err.message);
    const settings = await getFallbackAdminSettings();
    return { changedAt: settings.changedAt };
  }
}

/**
 * Check if Redis is currently connected.
 */
function isRedisConnected() {
  return isConnected;
}

export {
  cacheGet,
  cacheSet,
  cacheDel,
  isRedisConnected,
  CACHE_TTL,
  logSearchMetric,
  getSearchMetrics,
  clearSearchMetrics,
  getAdminPassword,
  setAdminPassword,
  verifyAdminPassword,
  getAdminPasswordMeta,
};

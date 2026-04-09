export const redisConfig = {
  enabled: true,
  url: process.env.REDIS_URL || "redis://127.0.0.1:6379",
  ttl: Number(process.env.CACHE_TTL) || 60,
};

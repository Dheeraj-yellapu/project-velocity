import express from "express";
import cors from "cors";
import compression from "compression";
import searchRoutes from "./routes/search.js";
import benchmarkRoutes from "./routes/benchmark.js";
import suggestRoutes from "./routes/suggest.js";
import analyticsRoutes from "./routes/analytics.js";
import solrAdminRoutes from "./routes/solrAdmin.js";
import metricsRoutes from "./routes/metrics.js";
import adminSettingsRoutes from "./routes/adminSettings.js";
import adminStatsRoutes from "./routes/adminStats.js";
import { auditAndAnomalyMiddleware, sanitizeInputMiddleware } from "./middleware/security.js";
import { searchRateLimiter } from "./utils/rateLimiter.js";

const app = express();

// Trust reverse proxy (nginx) to make rate limiter & IP detection work with X-Forwarded-For
app.set("trust proxy", 1);

app.use(compression()); // Gzip all responses — ~80% size reduction
app.use(cors());
app.use(express.json());

// 🛡️ Security & Auditing Middlewares
app.use(auditAndAnomalyMiddleware); // Global tracking, audit logs, anomaly blocking
app.use("/api/search", searchRateLimiter); // 20 req / 10s strict limit
app.use("/api/search", sanitizeInputMiddleware); // Solr abuse, XSS, length checks

app.get("/health", (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.use("/api/search", searchRoutes);
app.use("/api/benchmark", benchmarkRoutes);
app.use("/api/suggest", suggestRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/admin/solr", solrAdminRoutes);
app.use("/api/metrics", metricsRoutes);
app.use("/api/admin/settings", adminSettingsRoutes);
app.use("/api/admin/stats", adminStatsRoutes);

app.use((err, _req, res, _next) => {
  console.error("[Error]", err.message);
  res.status(500).json({
    error: "Internal server error",
    detail: err.message,
  });
});

export default app;

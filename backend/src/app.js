import express from "express";
import cors from "cors";
import compression from "compression";
import searchRoutes from "./routes/search.js";
import benchmarkRoutes from "./routes/benchmark.js";
import suggestRoutes from "./routes/suggest.js";
import analyticsRoutes from "./routes/analytics.js";
import solrAdminRoutes from "./routes/solrAdmin.js";

const app = express();

app.use(compression()); // Gzip all responses — ~80% size reduction
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.use("/api/search", searchRoutes);
app.use("/api/benchmark", benchmarkRoutes);
app.use("/api/suggest", suggestRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/admin/solr", solrAdminRoutes);

app.use((err, _req, res, _next) => {
  console.error("[Error]", err.message);
  res.status(500).json({
    error: "Internal server error",
    detail: err.message,
  });
});

export default app;

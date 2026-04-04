import express from "express";
import cors from "cors";
import searchRoutes from "./routes/search.js";
import suggestRoutes from "./routes/suggest.js";
import analyticsRoutes from "./routes/analytics.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/search", searchRoutes);
app.use("/api/suggest", suggestRoutes);
app.use("/api/analytics", analyticsRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({
    error: "Internal server error",
    detail: err.message,
  });
});

export default app;

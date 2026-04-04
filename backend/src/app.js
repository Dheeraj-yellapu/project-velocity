const express = require("express");
const cors = require("cors");

const searchRoutes = require("./routes/search");
const suggestRoutes = require("./routes/suggest");
const analyticsRoutes = require("./routes/analytics");

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
  res.status(500).json({
    error: "Internal server error",
    detail: err.message,
  });
});

module.exports = app;

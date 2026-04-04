function analyticsController(req, res) {
  res.json({
    message: "Analytics endpoint ready",
    timestamp: new Date().toISOString(),
  });
}

export { analyticsController };

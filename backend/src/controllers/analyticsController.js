import { getSearchMetrics } from "../utils/redisClient.js";

async function analyticsController(req, res) {
  try {
    const logs = await getSearchMetrics(); // Array of { timestamp, query, latency, results, source, status }
    
    const now = Date.now();
    // Default range is 1h: 3600000 ms
    const rangeParam = req.query.range || "1h";
    let rangeMs = 3600000;
    if (rangeParam === "6h") rangeMs = 6 * 3600000;
    if (rangeParam === "24h") rangeMs = 24 * 3600000;

    const rangeStartTime = now - rangeMs;
    // Filter logs within range
    const filteredLogs = logs.filter(l => l.timestamp >= rangeStartTime);

    // Current QPS (last 60 seconds)
    const recent60s = logs.filter(l => l.timestamp >= now - 60000);
    const currentQps = recent60s.length / 60;

    // Overall stats in range
    let totalLatency = 0;
    let errorCount = 0;
    let cacheHits = 0;
    const queryCounts = {};

    filteredLogs.forEach(l => {
      totalLatency += l.latency;
      if (l.status === "error") errorCount++;
      if (l.source === "cache") cacheHits++;
      
      const q = l.query.toLowerCase();
      if (!queryCounts[q]) {
        queryCounts[q] = { count: 0, latSum: 0 };
      }
      queryCounts[q].count++;
      queryCounts[q].latSum += l.latency;
    });

    const throughput = filteredLogs.length;
    const avgLatency = throughput > 0 ? (totalLatency / throughput).toFixed(1) : 0;
    const errorRate = throughput > 0 ? ((errorCount / throughput) * 100).toFixed(2) : 0;
    const cacheHitRate = throughput > 0 ? ((cacheHits / throughput) * 100).toFixed(1) : 0;

    // Deep Query Analytics
    const latencyDistribution = { fast: 0, medium: 0, slow: 0 };
    filteredLogs.forEach(l => {
      if (l.latency < 50) latencyDistribution.fast++;
      else if (l.latency < 200) latencyDistribution.medium++;
      else latencyDistribution.slow++;
    });

    const slowQueries = [...filteredLogs]
      .sort((a, b) => b.latency - a.latency)
      .slice(0, 5)
      .map(q => ({ query: q.query, latency: q.latency, timestamp: q.timestamp, source: q.source }));

    // Top Queries
    const topQueries = Object.keys(queryCounts)
      .map(q => ({
        q,
        count: queryCounts[q].count,
        lat: Math.round(queryCounts[q].latSum / queryCounts[q].count)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // 15 Time Buckets for SparkLines
    const numBuckets = 15;
    const bucketSize = rangeMs / numBuckets;
    const qpsData = new Array(numBuckets).fill(0);
    const latDataAcc = new Array(numBuckets).fill(0);
    const latDataCounts = new Array(numBuckets).fill(0);

    filteredLogs.forEach(l => {
      const bIndex = Math.floor((l.timestamp - rangeStartTime) / bucketSize);
      if (bIndex >= 0 && bIndex < numBuckets) {
        qpsData[bIndex]++;
        latDataAcc[bIndex] += l.latency;
        latDataCounts[bIndex]++;
      }
    });

    const latData = latDataAcc.map((sum, i) => (latDataCounts[i] > 0 ? Math.round(sum / latDataCounts[i]) : 0));
    // Convert count per bucket to approx QPS
    const bucketQPSData = qpsData.map(c => Number((c / (bucketSize / 1000)).toFixed(2)));

    // Heatmap (4 rows: 12AM, 6AM, 12PM, 6PM) x (7 columns: Mon-Sun)
    // Intensity 0-100% relative to max bucket
    const heatmapRaw = Array(4).fill(0).map(() => Array(7).fill(0));
    logs.forEach(l => {
       const date = new Date(l.timestamp);
       let day = date.getDay() - 1; // 0 = Mon
       if (day < 0) day = 6; // Sunday
       const hour = date.getHours();
       let hi = 0; // 0-5
       if (hour >= 6 && hour < 12) hi = 1;
       else if (hour >= 12 && hour < 18) hi = 2;
       else if (hour >= 18) hi = 3;
       heatmapRaw[hi][day]++;
    });
    
    // Normalize heatmap
    const maxHeat = Math.max(...heatmapRaw.flat()) || 1;
    const heatmapData = heatmapRaw.map(row => row.map(v => Math.round((v / maxHeat) * 100)));

    res.json({
      stats: {
        qpsText: currentQps.toFixed(2),
        latencyText: `${avgLatency} ms`,
        throughputText: throughput.toLocaleString(),
        errorRateText: `${errorRate}%`,
        cacheHitRateText: `${cacheHitRate}%`
      },
      charts: {
        qpsData: bucketQPSData,
        latData: latData
      },
      queryAnalytics: {
        latencyDistribution,
        slowQueries
      },
      topQueries,
      heatmapData,
      logs: logs.slice(0, 50) // sending newest 50. Since it's LPUSH, 0 is newest.
    });
  } catch (error) {
    console.error("[Analytics] error:", error);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
}

export { analyticsController };

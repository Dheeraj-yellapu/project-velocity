import { getSearchMetrics } from "../utils/redisClient.js";

function normalizeTimestamp(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : NaN;
  }
  return NaN;
}

function buildHeatmapCell(count, maxCount) {
  if (count <= 0 || maxCount <= 0) {
    return { count: 0, percent: 0 };
  }

  return {
    count,
    percent: Math.max(1, Math.round((count / maxCount) * 100)),
  };
}

async function analyticsController(req, res) {
  try {
    const logs = (await getSearchMetrics())
      .map((log) => ({ ...log, timestamp: normalizeTimestamp(log.timestamp) }))
      .filter((log) => Number.isFinite(log.timestamp));
    // Array of { timestamp, query, latency, results, source, status }
    
    const now = Date.now();
    // Default range is 1h: 3600000 ms
    const rangeParam = req.query.range || "1h";
    let rangeMs = 3600000;
    if (rangeParam === "6h") rangeMs = 6 * 3600000;
    if (rangeParam === "24h") rangeMs = 24 * 3600000;

    const rangeStartTime = now - rangeMs;
    // Filter logs within range
    const filteredLogs = logs.filter(l => l.timestamp >= rangeStartTime);

    // Current QPS (true 1-second window, no averaging)
    const recent5s = logs.filter(l => l.timestamp >= now - 5000);
    const currentQps = recent5s.length;

    // Overall stats in range
    let totalLatency = 0;
    let errorCount = 0;
    let cacheHits = 0;
    const queryCounts = {};

    filteredLogs.forEach(l => {
      totalLatency += l.latency;
      const status = typeof l.status === "string" ? l.status.toLowerCase() : "ok";
      if (status === "error") errorCount++;
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
    const errorRate = throughput > 0 ? (errorCount / throughput) * 100 : 0;
    const cacheHitRate = throughput > 0 ? ((cacheHits / throughput) * 100).toFixed(1) : 0;

    // True peak QPS: max successful requests observed in any 1-second window in selected range.
    const perSecondCounts = new Map();
    filteredLogs.forEach((l) => {
      const normalizedStatus = typeof l.status === "string" ? l.status.toLowerCase() : "ok";
      if (normalizedStatus === "error") return;
      const secondKey = Math.floor(l.timestamp / 1000);
      perSecondCounts.set(secondKey, (perSecondCounts.get(secondKey) || 0) + 1);
    });
    const maxQpsPerSecond = perSecondCounts.size > 0
      ? Math.max(...perSecondCounts.values())
      : 0;

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
    
    // Normalize heatmap to percentages so low traffic stays visible without rounding to zero.
    const maxHeat = Math.max(...heatmapRaw.flat()) || 1;
    const heatmapData = heatmapRaw.map((row) =>
      row.map((count) => buildHeatmapCell(count, maxHeat))
    );

    // Last 5 weeks daily heatmap (Mon-Sun per week) to inspect previous weeks.
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const WEEKS = 5;
    const DAY_MS = 24 * 60 * 60 * 1000;
    const nowDate = new Date(now);
    const todayStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate());
    const dayOfWeek = (todayStart.getDay() + 6) % 7; // Mon=0 ... Sun=6
    const currentMonday = new Date(todayStart.getTime() - dayOfWeek * DAY_MS);
    const oldestMonday = new Date(currentMonday.getTime() - (WEEKS - 1) * 7 * DAY_MS);

    const weeklyRaw = Array.from({ length: WEEKS }, () => Array(7).fill(0));

    logs.forEach((l) => {
      const ts = new Date(l.timestamp);
      const dayStart = new Date(ts.getFullYear(), ts.getMonth(), ts.getDate());
      if (dayStart < oldestMonday || dayStart > todayStart) return;

      const diffDays = Math.floor((dayStart.getTime() - oldestMonday.getTime()) / DAY_MS);
      if (diffDays < 0 || diffDays >= WEEKS * 7) return;

      const weekIndex = Math.floor(diffDays / 7);
      const weekDay = diffDays % 7; // Mon..Sun
      weeklyRaw[weekIndex][weekDay] += 1;
    });

    const maxWeekly = Math.max(...weeklyRaw.flat()) || 1;
    const weeklyData = weeklyRaw.map((row) =>
      row.map((count) => buildHeatmapCell(count, maxWeekly))
    );

    const weekLabels = Array.from({ length: WEEKS }, (_, i) => {
      const weekStart = new Date(oldestMonday.getTime() + i * 7 * DAY_MS);
      return `${weekStart.getDate()} ${weekStart.toLocaleString("en-US", { month: "short" })}`;
    });

    res.json({
      stats: {
        qpsText: currentQps.toFixed(2),
        maxQpsPerSecond,
        latencyText: `${avgLatency} ms`,
        throughputText: throughput.toLocaleString(),
        errorRateText: `${errorRate.toFixed(2)}%`,
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
      weeklyHeatmap: {
        weekLabels,
        dayLabels: days,
        data: weeklyData,
      },
      logs: logs.slice(0, 50) // sending newest 50. Since it's LPUSH, 0 is newest.
    });
  } catch (error) {
    console.error("[Analytics] error:", error);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
}

export { analyticsController };

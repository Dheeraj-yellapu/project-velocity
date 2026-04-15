// test_cache_effectiveness.js

const URL = "http://10.145.211.56/api/search?q=stock&rows=10";
const REQUESTS = 10;
const timestamps = [];
function computeRPSMetrics(timestamps) {
  const buckets = {};

  timestamps.forEach(ts => {
    const sec = Math.floor(ts / 1000);
    buckets[sec] = (buckets[sec] || 0) + 1;
  });

  const rpsValues = Object.values(buckets);

  const maxRPS = Math.max(...rpsValues);
  const avgRPS = rpsValues.reduce((a, b) => a + b, 0) / rpsValues.length;

  return {
    maxRPS,
    avgRPS,
    buckets
  };
}

function percentile(arr, p) {
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.floor((p / 100) * sorted.length)] || 0;
}

async function run() {
  const latencies = [];

  console.log("\n=== CACHE EFFECTIVENESS TEST ===\n");

  for (let i = 0; i < REQUESTS; i++) {
    const start = Date.now();
    const res = await fetch(URL);
    await res.json();
    const latency = Date.now() - start;
    timestamps.push(Date.now());
    latencies.push(latency);

    console.log(
      `Request ${i + 1}: ${latency}ms ${
        i === 0 ? "(cold)" : latency < 50 ? "(cached)" : "(warm)"
      }`
    );
  }

  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
const rps = computeRPSMetrics(timestamps);

console.log("\n--- RPS Metrics ---");
console.log("Peak RPS:", rps.maxRPS);
  console.log("\n--- Metrics ---");
  console.log("Avg:", avg.toFixed(2));
  console.log("Min:", Math.min(...latencies));
  console.log("Max:", Math.max(...latencies));
  console.log("p50:", percentile(latencies, 50));
  console.log("p95:", percentile(latencies, 95));
  console.log("p99:", percentile(latencies, 99));
}

run();
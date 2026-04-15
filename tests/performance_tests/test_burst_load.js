// test_burst_load.js

const URL = "http://10.145.211.56/api/search?q=stock&rows=10";
const CONCURRENCY = 50;
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
  console.log("\n=== BURST LOAD TEST ===\n");

  const latencies = [];
  let success = 0;
  let failed = 0;

  const startTime = Date.now();

  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      try {
        const start = Date.now();
        const res = await fetch(URL);
        await res.json();
        const latency = Date.now() - start;
        timestamps.push(Date.now());
        latencies.push(latency);
        success++;
      } catch {
        failed++;
      }
    })
  );

  const totalTime = (Date.now() - startTime) / 1000;
  const rps = computeRPSMetrics(timestamps);

console.log("\n--- RPS Metrics ---");
console.log("Avg RPS:", rps.avgRPS.toFixed(2));
console.log("Peak RPS:", rps.maxRPS);
  console.log("\n--- Metrics ---");
  console.log("Requests:", CONCURRENCY);
  console.log("Success:", success);
  console.log("Failed:", failed);
  console.log("Throughput:", (success / totalTime).toFixed(2), "req/sec");

  console.log("\n--- Latency ---");
  console.log("Avg:", (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2));
  console.log("Min:", Math.min(...latencies));
  console.log("Max:", Math.max(...latencies));
  console.log("p50:", percentile(latencies, 50));
  console.log("p95:", percentile(latencies, 95));
  console.log("p99:", percentile(latencies, 99));
}

run();
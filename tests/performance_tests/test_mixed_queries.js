// test_mixed_queries.js

const BASE_URL = "http://10.145.211.56/api/search?q=";


const queries = [
  "sports",
  "politics",
  "economy",
  "technology",
  "ai",
  "healthcare",
  "education",
  "finance",
  "climate",
  "cricket",
  "elections",
  "space",
  "entertainment",
  "travel",
  "food",
  "music",
  "movies",
  "books",
  "art",
  "history",
  "fashion",
  "gaming",
  "automotive",
  "real estate",
  "business",
  "social media",
  "environment",
  "law",
  "philosophy",
  "psychology",
  "relationships",
  "parenting",
  "fitness",
  "wellness",
  "hobbies",
  "diy",
  "gardening",
  "pets",
  "personal finance",
  "investing",
  "cryptocurrency",
  "blockchain",
];

const TOTAL_REQUESTS = 10000;
const CONCURRENCY = 100;

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

let completed = 0;
let success = 0;
let failed = 0;

const latencies = [];
const perQueryStats = {};
const timestamps = [];

async function worker() {
  while (true) {
    const id = completed++;
    if (id >= TOTAL_REQUESTS) break;

    const q = queries[Math.floor(Math.random() * queries.length)];

    try {
      const start = Date.now();
      const res = await fetch(BASE_URL + encodeURIComponent(q));
      await res.json();
      const latency = Date.now() - start;
      timestamps.push(Date.now());
      latencies.push(latency);
      success++;

      if (!perQueryStats[q]) perQueryStats[q] = [];
      perQueryStats[q].push(latency);
    } catch {
      failed++;
    }
  }
}

async function run() {
  console.log("\n=== MIXED QUERY TEST ===\n");

  const startTime = Date.now();

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const totalTime = (Date.now() - startTime) / 1000;

  console.log("\n--- Overall Metrics ---");
  console.log("Throughput:", (success / totalTime).toFixed(2), "req/sec");
  console.log("Success:", success, "Failed:", failed);

  console.log("\n--- Latency ---");
  console.log(
    "Avg:",
    (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2),
  );
  console.log("p50:", percentile(latencies, 50));
  console.log("p95:", percentile(latencies, 95));
  console.log("p99:", percentile(latencies, 99));
const rps = computeRPSMetrics(timestamps);

console.log("\n--- RPS Metrics ---");
console.log("Avg RPS:", rps.avgRPS.toFixed(2));
console.log("Peak RPS:", rps.maxRPS);
  console.log("\n--- Per Query Stats ---");
  for (const q in perQueryStats) {
    const arr = perQueryStats[q];
    const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
    console.log(`${q}: avg ${avg.toFixed(2)}ms`);
  }
}

run();

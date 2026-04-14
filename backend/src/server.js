import "dotenv/config";
import cluster from "node:cluster";
import os from "node:os";
import http from "node:http";
import app from "./app.js";

const PORT = process.env.PORT || 4000;
const NUM_WORKERS = os.cpus().length;

// Use cluster mode only for production/loadtest (npm start)
// Skip clustering in dev mode (npm run dev uses --watch which conflicts)
const useCluster = process.env.NODE_ENV === "production" || process.argv.includes("--cluster");

if (useCluster && cluster.isPrimary) {
  console.log(`[Cluster] Primary process ${process.pid} starting ${NUM_WORKERS} workers...`);

  for (let i = 0; i < NUM_WORKERS; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker, code) => {
    console.warn(`[Cluster] Worker ${worker.process.pid} exited (code ${code}). Restarting...`);
    cluster.fork();
  });
} else {
  // Create HTTP server with optimized socket settings for high concurrency
  const server = http.createServer(app);
  
  // Increase max concurrent connections per worker
  server.maxConnections = 2000;
  server.maxRequestsPerSocket = 100; // Reuse sockets for up to 100 requests
  
  server.listen(PORT, () => {
    if (useCluster) {
      console.log(`[Worker ${process.pid}] Listening on port ${PORT} (maxConnections: 2000)`);
    } else {
      console.log(`Backend listening on port ${PORT} (single-process mode, maxConnections: 2000)`);
      console.log(`Health check: http://localhost:${PORT}/health`);
    }
  });
}

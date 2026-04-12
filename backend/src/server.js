import "dotenv/config";
import cluster from "node:cluster";
import os from "node:os";
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
  app.listen(PORT, () => {
    if (useCluster) {
      console.log(`[Worker ${process.pid}] Listening on port ${PORT}`);
    } else {
      console.log(`Backend listening on port ${PORT} (single-process mode)`);
      console.log(`Health check: http://localhost:${PORT}/health`);
    }
  });
}

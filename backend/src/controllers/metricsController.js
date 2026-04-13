import axios from "axios";
import { SOLR_URL, SOLR_COLLECTION } from "../config/solr.js";
import os from "os";

async function metricsController(req, res) {
  try {
    // 1. Fetch Solr System Info
    const solrSysRes = await axios.get(`${SOLR_URL}/admin/info/system?wt=json`, { timeout: 3000 });
    const sysData = solrSysRes.data;

    // 2. Parse Memory
    const jvm = sysData.jvm || {};
    const memTotal = jvm.memory?.raw?.max || 1;
    const memUsed = jvm.memory?.raw?.used || 0;
    const memFree = jvm.memory?.raw?.free || 0;
    const memPercent = ((memUsed / memTotal) * 100).toFixed(1);

    // 3. Parse CPU (System Load Average usually available on Unix)
    const system = sysData.system || {};
    const cpuLoad = system.systemLoadAverage || os.loadavg()[0] || 0;
    const cpuCores = system.availableProcessors || os.cpus().length || 1;
    // rough approximation of cpu percent from load
    const cpuPercent = Math.min(((cpuLoad / cpuCores) * 100).toFixed(1), 100);

    // 4. Fetch Solr Core metrics (for Disk/Docs)
    const solrCoreRes = await axios.get(`${SOLR_URL}/admin/cores?action=STATUS&core=${SOLR_COLLECTION}&wt=json`, { timeout: 3000 });
    const coreStatus = solrCoreRes.data.status?.[SOLR_COLLECTION] || {};
    
    // Approximate disk size based on index size string like "1.2 GB"
    const indexSizeStr = coreStatus.index?.size || "0 KB";
    let diskBytes = 0;
    if (indexSizeStr.includes("KB")) diskBytes = parseFloat(indexSizeStr) * 1024;
    else if (indexSizeStr.includes("MB")) diskBytes = parseFloat(indexSizeStr) * 1024 * 1024;
    else if (indexSizeStr.includes("GB")) diskBytes = parseFloat(indexSizeStr) * 1024 * 1024 * 1024;
    
    const maxDisk = 50 * 1024 * 1024 * 1024; // Dummy 50GB max
    const diskPercent = ((diskBytes / maxDisk) * 100).toFixed(1);

    const metrics = {
      cpu: {
        percent: cpuPercent,
        load: cpuLoad.toFixed(2),
        cores: cpuCores
      },
      memory: {
        percent: memPercent,
        usedStr: jvm.memory?.used || `${(memUsed/1024/1024).toFixed(1)} MB`,
        totalStr: jvm.memory?.max || `${(memTotal/1024/1024).toFixed(1)} MB`
      },
      disk: {
        percent: diskPercent,
        usedStr: indexSizeStr,
        totalStr: "50 GB"
      },
      solr: {
        version: sysData.lucene?.solrSpecVersion || "Unknown",
        upTimeText: jvm.jmx?.upTimeMS ? `${(jvm.jmx.upTimeMS / 1000 / 60 / 60).toFixed(1)} hours` : "Unknown",
        docs: coreStatus.index?.numDocs || 0
      }
    };

    res.json(metrics);
  } catch (error) {
    console.error("[Metrics] Failed to fetch system metrics:", error.message);
    res.status(503).json({ error: "Failed to fetch metrics", details: error.message });
  }
}

export { metricsController };

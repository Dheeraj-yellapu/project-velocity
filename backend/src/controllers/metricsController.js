import axios from "axios";
import { SOLR_URL, SOLR_COLLECTION } from "../config/solr.js";
import os from "os";

const DEFAULT_SOLR_SYSTEM_URLS = [
  "http://10.145.211.56:8983/solr",
  "http://10.145.219.223:8983/solr",
  "http://10.145.220.0:8983/solr",
  "http://10.145.245.107:8983/solr",
];

function toSolrBaseUrl(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw.endsWith("/solr") ? raw : `${raw}/solr`;
  }
  return `http://${raw}:8983/solr`;
}

function parseConfiguredSystemUrls() {
  const configured =
    process.env.SOLR_SYSTEM_URLS ||
    process.env.SOLR_SYSTEM_IPS ||
    process.env.SOLR_SYSTEMS ||
    "";

  const parsed = configured
    .split(",")
    .map((item) => toSolrBaseUrl(item))
    .filter(Boolean);

  const normalizedDefault = DEFAULT_SOLR_SYSTEM_URLS
    .map((url) => url?.replace(/\/+$/, ""))
    .filter(Boolean);

  const solrBase = toSolrBaseUrl(SOLR_URL)?.replace(/\/+$/, "");
  const shouldInjectSolrUrl =
    solrBase &&
    !solrBase.includes("localhost") &&
    !solrBase.includes("127.0.0.1") &&
    !normalizedDefault.includes(solrBase);

  const fallback = shouldInjectSolrUrl
    ? [solrBase, ...normalizedDefault].slice(0, 4)
    : normalizedDefault;

  return [...new Set(parsed.length > 0 ? parsed : fallback)].slice(0, 4);
}

function parseByteSize(value) {
  if (!value || typeof value !== "string") return 0;
  const trimmed = value.trim().toUpperCase();
  const num = parseFloat(trimmed);
  if (!Number.isFinite(num)) return 0;

  if (trimmed.endsWith("TB")) return num * 1024 * 1024 * 1024 * 1024;
  if (trimmed.endsWith("GB")) return num * 1024 * 1024 * 1024;
  if (trimmed.endsWith("MB")) return num * 1024 * 1024;
  if (trimmed.endsWith("KB")) return num * 1024;
  if (trimmed.endsWith("B")) return num;
  return num;
}

function sumReplicaCount(clusterCollections = {}) {
  return Object.values(clusterCollections).reduce((collectionAcc, collection) => {
    const shards = collection?.shards || {};
    const shardReplicas = Object.values(shards).reduce((shardAcc, shard) => {
      const replicas = shard?.replicas || {};
      return shardAcc + Object.keys(replicas).length;
    }, 0);
    return collectionAcc + shardReplicas;
  }, 0);
}

function formatHours(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "Unknown";
  return `${(ms / 1000 / 60 / 60).toFixed(1)} hours`;
}

async function fetchSystemMetrics(baseUrl, index) {
  const [sysRes, coreRes, clusterRes] = await Promise.all([
    axios.get(`${baseUrl}/admin/info/system?wt=json`, { timeout: 15000 }),
    axios.get(`${baseUrl}/admin/cores?action=STATUS&wt=json`, { timeout: 15000 }),
    axios.get(`${baseUrl}/admin/collections?action=CLUSTERSTATUS&wt=json`, { timeout: 15000 }),
  ]);

  const sysData = sysRes.data || {};
  const jvm = sysData.jvm || {};
  const system = sysData.system || {};
  const zkState = clusterRes.data?.cluster || {};
  const clusterCollections = zkState.collections || {};
  const coreStatusMap = coreRes.data?.status || {};

  const memTotal = Number(jvm.memory?.raw?.max || 1);
  const memUsed = Number(jvm.memory?.raw?.used || 0);
  const memPercent = Number(((memUsed / Math.max(memTotal, 1)) * 100).toFixed(1));

  const cpuLoad = Number(system.systemLoadAverage ?? os.loadavg()[0] ?? 0);
  const cpuCores = Number(system.availableProcessors || os.cpus().length || 1);
  const cpuPercent = Number(Math.min((cpuLoad / Math.max(cpuCores, 1)) * 100, 100).toFixed(1));

  const cores = Object.values(coreStatusMap);
  const totalDocs = cores.reduce((acc, core) => acc + Number(core?.index?.numDocs || 0), 0);
  const diskBytes = cores.reduce((acc, core) => acc + parseByteSize(core?.index?.size || "0 B"), 0);
  const maxDiskBytes = 50 * 1024 * 1024 * 1024;
  const diskPercent = Number(((diskBytes / maxDiskBytes) * 100).toFixed(1));

  const firstCore = coreStatusMap[SOLR_COLLECTION] || cores[0] || {};
  const uptimeMs = Number(jvm.jmx?.upTimeMS || 0);

  const ip = (() => {
    try {
      return new URL(baseUrl).hostname;
    } catch (_err) {
      return baseUrl;
    }
  })();

  return {
    systemNo: index + 1,
    label: `System ${index + 1}: ${ip}`,
    ip,
    url: baseUrl,
    node: sysData.node || system.name || ip || "Unknown",
    cpu: {
      percent: cpuPercent,
      load: cpuLoad.toFixed(2),
      cores: cpuCores,
    },
    memory: {
      percent: memPercent,
      usedStr: jvm.memory?.used || `${(memUsed / 1024 / 1024).toFixed(1)} MB`,
      totalStr: jvm.memory?.max || `${(memTotal / 1024 / 1024).toFixed(1)} MB`,
    },
    disk: {
      percent: diskPercent,
      usedStr: firstCore?.index?.size || "0 KB",
      totalStr: "50 GB",
    },
    solr: {
      version: sysData.lucene?.solrSpecVersion || "Unknown",
      docs: totalDocs,
      upTimeText: formatHours(uptimeMs),
      collections: Object.keys(clusterCollections).length,
      replicas: sumReplicaCount(clusterCollections),
      liveNodes: Array.isArray(zkState.live_nodes) ? zkState.live_nodes.length : 0,
    },
    status: "ok",
  };
}

async function metricsController(req, res) {
  try {
    const systemUrls = parseConfiguredSystemUrls();
    const results = await Promise.all(
      systemUrls.map(async (baseUrl, index) => {
        try {
          return await fetchSystemMetrics(baseUrl, index);
        } catch (error) {
          const ip = (() => {
            try {
              return new URL(baseUrl).hostname;
            } catch (_err) {
              return baseUrl;
            }
          })();
          return {
            systemNo: index + 1,
            label: `System ${index + 1}: ${ip}`,
            ip,
            url: baseUrl,
            status: "down",
            error: error.message,
          };
        }
      })
    );

    const healthySystems = results.filter((item) => item.status === "ok");

    if (healthySystems.length === 0) {
      return res.status(503).json({
        error: "Failed to fetch metrics",
        details: "All configured Solr systems are unreachable",
        systems: results,
      });
    }

    const latestVersion = healthySystems[0]?.solr?.version || "Unknown";
    const totalDocuments = healthySystems.reduce((max, item) => Math.max(max, Number(item.solr?.docs || 0)), 0);
    const maxUptimeHours = healthySystems.reduce((max, item) => {
      const asHours = Number.parseFloat(String(item.solr?.upTimeText || "0"));
      return Number.isFinite(asHours) ? Math.max(max, asHours) : max;
    }, 0);
    const maxCollections = healthySystems.reduce((max, item) => Math.max(max, Number(item.solr?.collections || 0)), 0);
    const totalReplicas = healthySystems.reduce((max, item) => Math.max(max, Number(item.solr?.replicas || 0)), 0);

    res.json({
      generatedAt: Date.now(),
      systems: results,
      cluster: {
        version: latestVersion,
        totalDocuments,
        uptimeText: maxUptimeHours > 0 ? `${maxUptimeHours.toFixed(1)} hours` : "Unknown",
        collections: maxCollections,
        replicas: totalReplicas,
        liveSystems: healthySystems.length,
      },
    });
  } catch (error) {
    console.error("[Metrics] Failed to fetch system metrics:", error.message);
    res.status(503).json({ error: "Failed to fetch metrics", details: error.message });
  }
}

export { metricsController };

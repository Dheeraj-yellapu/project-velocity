import { readFile } from "node:fs/promises";
import path from "node:path";
import { exec as execCallback } from "node:child_process";
import { promisify } from "node:util";
import {
  SOLR_COMMAND,
  SOLR_COLLECTION,
  SOLR_INPUT_FILE,
  SOLR_REPLICAS,
  SOLR_SCHEMA_FILE,
  SOLR_SHARDS,
  SOLR_STARTUP_DELAY_MS,
  SOLR_URL,
} from "../config/solr.js";

const exec = promisify(execCallback);

async function solrRequest(url, options = {}) {
  const response = await fetch(url, options);
  const bodyText = await response.text();
  let body;

  try {
    body = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    body = { raw: bodyText };
  }

  if (!response.ok) {
    throw new Error(`Solr request failed (${response.status}): ${bodyText}`);
  }

  return body;
}

async function ensureCollection() {
  const listUrl = `${SOLR_URL}/admin/collections?action=LIST&wt=json`;
  const listResponse = await solrRequest(listUrl);
  const existing = new Set(listResponse.collections || []);

  if (existing.has(SOLR_COLLECTION)) {
    return { created: false, message: `Collection ${SOLR_COLLECTION} already exists` };
  }

  const createParams = new URLSearchParams({
    action: "CREATE",
    name: SOLR_COLLECTION,
    numShards: String(SOLR_SHARDS),
    replicationFactor: String(SOLR_REPLICAS),
    wt: "json",
  });

  const createUrl = `${SOLR_URL}/admin/collections?${createParams.toString()}`;
  await solrRequest(createUrl);
  return { created: true, message: `Collection ${SOLR_COLLECTION} created` };
}

async function loadSchemaPayload(schemaFile = SOLR_SCHEMA_FILE) {
  const absolutePath = path.resolve(process.cwd(), schemaFile);
  const raw = await readFile(absolutePath, "utf-8");
  const payload = JSON.parse(raw);
  return { payload, absolutePath };
}

async function addSchemaFields(schemaFile = SOLR_SCHEMA_FILE) {
  const schemaUrl = `${SOLR_URL}/${SOLR_COLLECTION}/schema`;
  const { payload, absolutePath } = await loadSchemaPayload(schemaFile);

  try {
    await solrRequest(schemaUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return {
      updated: true,
      message: "Schema fields added",
      schemaFile: absolutePath,
    };
  } catch (error) {
    // Re-running setup should be safe when fields already exist.
    if (error.message.includes("already exists")) {
      return {
        updated: false,
        message: "Schema fields already exist",
        schemaFile: absolutePath,
      };
    }
    throw error;
  }
}

async function startLocalSolr() {
  if (process.platform !== "win32") {
    throw new Error("Local Solr startup flow is currently implemented for Windows only");
  }

  await exec("taskkill /F /IM java.exe >nul 2>&1", { shell: true }).catch(() => ({}));
  await exec(`${SOLR_COMMAND} start -c -m 2g -Dsolr.jetty.host=0.0.0.0`, { shell: true });

  await new Promise((resolve) => {
    setTimeout(resolve, SOLR_STARTUP_DELAY_MS);
  });

  return {
    started: true,
    message: "Local Solr started",
    startupDelayMs: SOLR_STARTUP_DELAY_MS,
  };
}

async function indexDocumentsFromFile(inputFile = SOLR_INPUT_FILE) {
  const absolutePath = path.resolve(process.cwd(), inputFile);
  const raw = await readFile(absolutePath, "utf-8");
  const docs = JSON.parse(raw);

  if (!Array.isArray(docs)) {
    throw new Error("Input JSON must be an array of documents");
  }

  const params = new URLSearchParams({
    commit: "true",
    "f.sum.dest": "summary",
    "f.pub.dest": "published_at",
  });
  const updateUrl = `${SOLR_URL}/${SOLR_COLLECTION}/update?${params.toString()}`;

  await solrRequest(updateUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(docs),
  });

  return { indexedCount: docs.length, inputFile: absolutePath };
}

async function setupSolr({ skipIndex = false, inputFile, schemaFile, startLocal = false } = {}) {
  const startup = startLocal
    ? await startLocalSolr()
    : { skipped: true, message: "Local startup skipped" };
  const collection = await ensureCollection();
  const schema = await addSchemaFields(schemaFile || SOLR_SCHEMA_FILE);
  const indexing = skipIndex
    ? { skipped: true, message: "Indexing skipped" }
    : await indexDocumentsFromFile(inputFile || SOLR_INPUT_FILE);

  return {
    startup,
    collection,
    schema,
    indexing,
    collectionName: SOLR_COLLECTION,
    solrUrl: SOLR_URL,
  };
}

export { setupSolr, ensureCollection, addSchemaFields, indexDocumentsFromFile };
const SOLR_URL = process.env.SOLR_URL || "http://localhost:8983/solr";
const SOLR_COLLECTION = process.env.SOLR_COLLECTION || "global_news";
const SOLR_SHARDS = Number(process.env.SOLR_SHARDS || 1);
const SOLR_REPLICAS = Number(process.env.SOLR_REPLICAS || 1);
const SOLR_INPUT_FILE =
	process.env.SOLR_INPUT_FILE ||
	"../../archive (1)/relevant_articles_selected_fields.json";
const SOLR_SCHEMA_FILE = process.env.SOLR_SCHEMA_FILE || "../solr/schema/schema.json";
const SOLR_STARTUP_DELAY_MS = Number(process.env.SOLR_STARTUP_DELAY_MS || 10000);
const SOLR_COMMAND = process.env.SOLR_COMMAND || "solr";

export {
	SOLR_URL,
	SOLR_COLLECTION,
	SOLR_SHARDS,
	SOLR_REPLICAS,
	SOLR_INPUT_FILE,
	SOLR_SCHEMA_FILE,
	SOLR_STARTUP_DELAY_MS,
	SOLR_COMMAND,
};

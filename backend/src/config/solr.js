const SOLR_URL = process.env.SOLR_URL || "http://localhost:8983/solr";
const SOLR_COLLECTION = process.env.SOLR_COLLECTION || "news";

module.exports = {
  SOLR_URL,
  SOLR_COLLECTION,
};

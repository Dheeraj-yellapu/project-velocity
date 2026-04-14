import { client } from '../api/client';

export const searchService = {
  async search({ query, type, lang, from, to, sort = "relevance", start = 0, rows = 10 }) {
    return client.get("/search", { q: query, type, lang, from, to, sort, start, rows });
  },
  async getTopicTypes(q = "") {
    return client.get("/search/types", { q });
  },
  async suggest(prefix) {
    return client.get("/suggest", { q: prefix });
  },
  async getAnalytics(range = "6h") {
    return client.get("/admin/analytics", { range });
  },
  async getLogs(page = 0) {
    return client.get("/admin/logs", { page });
  },
};
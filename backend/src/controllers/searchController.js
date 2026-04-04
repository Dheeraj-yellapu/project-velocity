import { buildSearchQuery } from "../utils/queryBuilder.js";
import { searchSolr } from "../services/solrService.js";

async function searchController(req, res, next) {
  try {
    const queryParams = buildSearchQuery(req.query);
    const data = await searchSolr(queryParams);
    res.json(data.response || { numFound: 0, docs: [] });
  } catch (error) {
    next(error);
  }
}

export { searchController };

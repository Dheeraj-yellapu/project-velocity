const { buildSearchQuery } = require("../utils/queryBuilder");
const { searchSolr } = require("../services/solrService");

async function searchController(req, res, next) {
  try {
    const queryParams = buildSearchQuery(req.query);
    const data = await searchSolr(queryParams);
    res.json(data.response || { numFound: 0, docs: [] });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  searchController,
};

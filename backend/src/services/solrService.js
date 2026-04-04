const { SOLR_URL, SOLR_COLLECTION } = require("../config/solr");

function buildParams(params) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((v) => search.append(key, v));
    } else if (value !== undefined && value !== null) {
      search.append(key, String(value));
    }
  });
  search.append("wt", "json");
  return search.toString();
}

async function searchSolr(queryParams) {
  const queryString = buildParams(queryParams);
  const url = `${SOLR_URL}/${SOLR_COLLECTION}/select?${queryString}`;
  const response = await fetch(url);

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Solr search failed (${response.status}): ${body}`);
  }

  return response.json();
}

module.exports = {
  searchSolr,
};

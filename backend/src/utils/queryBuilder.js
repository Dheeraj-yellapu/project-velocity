/** ── Solr Query Builder (edismax) ──────────────────────────────────
 *  Builds production-grade Solr query params with:
 *    • edismax parser for relevance tuning
 *    • Field-weighted scoring (qf)
 *    • Phrase boosting (pf)
 *    • Recency bias via reciprocal function (bf)
 *    • Pagination, field limiting, and filter queries
 * ──────────────────────────────────────────────────────────────── */

function escapeSolrSpecialChars(input = "") {
  return String(input).replace(/([+\-!(){}[\]^"~*?:\\/]|&&|\|\|)/g, "\\$1");
}

function buildSearchQuery({
  q,
  category,
  type,
  from,
  to,
  page = 1,
  pageSize = 10,
  mode = "full",
}) {
  const safeQ = q ? escapeSolrSpecialChars(q) : "*:*";
  const fq = [];

  // ── Filter queries ────────────────────────────────────────────────
  if (category) {
    fq.push(`type:${escapeSolrSpecialChars(category)}`);
  }
  if (type) {
    fq.push(`type:${escapeSolrSpecialChars(type)}`);
  }
  if (from || to) {
    const start = from || "*";
    const end = to || "*";
    fq.push(`published_at:[${start} TO ${end}]`);
  }

  // ── Pagination ────────────────────────────────────────────────────
  const rows = Math.max(1, Math.min(Number(pageSize) || 10, 100));
  const currentPage = Math.max(1, Number(page) || 1);
  const start = (currentPage - 1) * rows;

  // ── Base params (always present) ──────────────────────────────────
  const params = {
    q: safeQ,
    defType: "edismax",
    qf: "title^5 type^4 summary^2 body^1",
    fl: "title,summary,type,published_at,body,id,url",
    rows,
    start,
  };

  // ── Full mode adds phrase boosting + recency bias ─────────────────
  if (mode === "full") {
    params.pf = "title^10 summary^5";
    params.bf = "recip(ms(NOW,published_at),3.16e-11,1,1)";
  }

  // ── Add filter queries if any ─────────────────────────────────────
  if (fq.length > 0) {
    params.fq = fq;
  }

  return params;
}

export { buildSearchQuery, escapeSolrSpecialChars };

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
  lang,
  from,
  to,
  sort: sortParam,
  page = 1,
  pageSize = 10,
  start: startParam,
  rows: rowsParam,
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
  if (lang) {
    fq.push(`lang:${escapeSolrSpecialChars(lang)}`);
  }
  if (from || to) {
    const start = from || "*";
    const end = to || "*";
    fq.push(`published_at:[${start} TO ${end}]`);
  }

  // ── Pagination ────────────────────────────────────────────────────
  const rows = rowsParam
    ? Math.max(1, Math.min(Number(rowsParam), 100))
    : Math.max(1, Math.min(Number(pageSize) || 10, 100));
  const currentPage = Math.max(1, Number(page) || 1);
  const start = startParam != null ? Number(startParam) : (currentPage - 1) * rows;

  // ── Base params (always present) ──────────────────────────────────
  const params = {
    q: safeQ,
    defType: "edismax",
    qf: "title^5 type^4 summary^2 body^1",
    fl: "title,summary,type,published_at,body,id,url,lang",
    rows,
    start,
  };

  // ── Sorting ───────────────────────────────────────────────────────
  if (sortParam === "newest") {
    params.sort = "published_at desc";
  } else if (sortParam === "oldest") {
    params.sort = "published_at asc";
  } else if (sortParam === "date") {
    params.sort = "published_at desc";
  } else if (sortParam === "date_asc") {
    params.sort = "published_at asc";
  }
  // "relevance" (default) uses edismax score — no explicit sort needed

  // ── Full mode adds phrase boosting + recency bias ─────────────────
  if (mode === "full") {
    params.pf = "title^10 summary^5";
    // Only add recency bias when sorting by relevance
    if (!sortParam || sortParam === "relevance") {
      params.bf = "recip(ms(NOW,published_at),3.16e-11,1,1)";
    }
  }

  // ── Add filter queries if any ─────────────────────────────────────
  if (fq.length > 0) {
    params.fq = fq;
  }

  return params;
}

export { buildSearchQuery, escapeSolrSpecialChars };

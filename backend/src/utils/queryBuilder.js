function escapeSolrSpecialChars(input = "") {
  return String(input).replace(/([+\-!(){}\[\]^"~*?:\\/]|&&|\|\|)/g, "\\$1");
}

function buildSearchQuery({ q, category, from, to, page = 1, pageSize = 10 }) {
  const safeQ = q ? escapeSolrSpecialChars(q) : "*:*";
  const fq = [];

  if (category) {
    fq.push(`category:${escapeSolrSpecialChars(category)}`);
  }

  if (from || to) {
    const start = from || "*";
    const end = to || "*";
    fq.push(`published_at:[${start} TO ${end}]`);
  }

  const rows = Math.max(1, Number(pageSize) || 10);
  const currentPage = Math.max(1, Number(page) || 1);
  const start = (currentPage - 1) * rows;

  return {
    q: safeQ,
    fq,
    rows,
    start,
  };
}

export { buildSearchQuery };

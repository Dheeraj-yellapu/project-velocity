const { searchSolr } = require("../services/solrService");

async function suggestController(req, res, next) {
  try {
    const q = req.query.q || "";
    const data = await searchSolr({
      q: `${q}*`,
      rows: 5,
      fl: "title",
    });

    const docs = data?.response?.docs || [];
    const suggestions = docs.map((d) => d.title).filter(Boolean);
    res.json({ suggestions });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  suggestController,
};

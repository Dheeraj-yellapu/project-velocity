import { searchSolr } from "../services/solrService.js";
import { cacheGet, cacheSet } from "../utils/redisClient.js";

/**
 * Fast & intelligent suggestion controller
 * Returns suggestions from title prefix matches
 * 
 * Query optimization:
 *  - Only queries title field (fastest)
 *  - Wildcard search with prefix
 *  - Ranked by relevance (score)
 *  - Cached in Redis for 5 minutes
 */
async function suggestController(req, res, next) {
  try {
    const rawPrefix = (req.query.q || "").trim();
    
    // Empty prefix returns nothing
    if (!rawPrefix || rawPrefix.length < 2) {
      return res.json({ suggestions: [] });
    }

    const prefix = rawPrefix.toLowerCase();
    const cacheKey = `suggestions:${prefix}`;
    
    // Check cache first (TTL: 5 minutes)
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return res.json({ suggestions: cached });
    }

    // Query Solr for prefix matches - ONLY title field (fastest!)
    // Using title:prefix* wildcard query on indexed field
    const solrResponse = await searchSolr({
      q: `title:${prefix}*`,
      rows: 50,  // Fetch more, take top 10
      fl: "title",
      sort: "score desc",
      defType: "lucene",
      timeAllowed: 5000, // 5 second timeout
    });

    // Extract unique titles, preserving order
    const docs = solrResponse?.response?.docs || [];
    const titleSet = new Set();
    const suggestions = [];

    // Add unique titles maintaining order
    docs.forEach((doc) => {
      let title = doc.title;
      
      // Handle title as string or array
      if (Array.isArray(title)) {
        title = title[0];
      }
      
      // Convert to string and trim
      title = String(title || "").trim();
      
      if (title && !titleSet.has(title)) {
        titleSet.add(title);
        suggestions.push(title);
      }
    });

    // Limit to top 10 suggestions
    const topSuggestions = suggestions.slice(0, 10);

    // Cache for 5 minutes
    await cacheSet(cacheKey, topSuggestions, 300);

    res.json({ suggestions: topSuggestions });
  } catch (error) {
    console.error("[Suggest Error]", error.message);
    // Graceful fallback: return empty suggestions instead of error
    res.json({ suggestions: [] });
  }
}

export { suggestController };

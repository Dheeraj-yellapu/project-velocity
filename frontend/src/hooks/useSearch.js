import { useState, useCallback } from "react";
import { searchService } from "../services/searchService";

export function useSearch() {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({ type: "", lang: "", from: "", to: "", sort: "relevance", rows: 10 });
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [meta, setMeta] = useState({ total: 0, elapsed: 0, source: null, qtime_ms: null, total_latency_ms: null });
  const [suggestions, setSuggestions] = useState([]);

  const search = useCallback(async (q = query, f = filters) => {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    const t0 = performance.now();
    try {
      const data = await searchService.search({
        query: q,
        type: f.type || undefined,
        lang: f.lang || undefined,
        from: f.from || undefined,
        to: f.to || undefined,
        sort: f.sort || "relevance",
        rows: f.rows || 10,
      });
      setResults(data.results || []);
      setMeta({
        total: data.total || 0,
        elapsed: ((performance.now() - t0) / 1000).toFixed(2),
        source: data.source || null,
        qtime_ms: data.qtime_ms || null,
        total_latency_ms: data.total_latency_ms || null,
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [query, filters]);

  const fetchSuggestions = useCallback(async (prefix) => {
    if (prefix.length < 2) { setSuggestions([]); return; }
    try {
      const data = await searchService.suggest(prefix);
      setSuggestions(data.suggestions || []);
    } catch { setSuggestions([]); }
  }, []);

  return { query, setQuery, filters, setFilters, results, loading, error, meta, suggestions, setSuggestions, search, fetchSuggestions };
}
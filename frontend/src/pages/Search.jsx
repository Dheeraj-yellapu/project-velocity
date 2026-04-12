import { useState, useEffect, useCallback } from "react";
import { useSearch } from "../hooks/useSearch";
import SearchBar from "../components/SearchBar";
import Filters from "../components/Filters";
import ResultCard from "../components/ResultCard";

export default function Search() {
  const { query, setQuery, filters, setFilters, results, loading, error, meta, suggestions, search, fetchSuggestions } = useSearch();
  const [hasSearched, setHasSearched] = useState(false);
  const [viewMode, setViewMode] = useState("list");

  // Re-search when filters change (only if we already searched)
  useEffect(() => {
    if (hasSearched && query.trim()) {
      search(query, filters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const handleSearch = useCallback(() => {
    if (!query.trim()) return;
    setHasSearched(true);
    search(query, filters);
  }, [query, filters, search]);

  const handleSuggestion = (s) => {
    setQuery(s);
    setHasSearched(true);
    search(s, filters);
  };

  return (
    <div className="search-page">
      <div className="search-hero">
        <SearchBar
          query={query}
          onChange={(q) => { setQuery(q); fetchSuggestions(q); }}
          onSearch={handleSearch}
          suggestions={suggestions}
          onSuggestionClick={handleSuggestion}
          onClear={() => { setQuery(""); setHasSearched(false); }}
        />
      </div>

      {hasSearched && (
        <div className="search-body">
          <Filters filters={filters} onChange={setFilters} />

          <section className="results-area">
            {/* ── Metrics bar ─────────────────────────────────── */}
            <div className="results-meta-bar">
              <span className="results-count">
                {loading ? "Searching..." : `About ${(meta.total || 0).toLocaleString()} results (${meta.elapsed || 0}s)`}
              </span>
              <div className="results-controls">
                {meta.source && !loading && (
                  <span className={`source-indicator ${meta.source === "cache" ? "cache" : "solr"}`}>
                    <span className="source-dot" />
                    {meta.source === "cache" ? "Redis Cache" : "Solr"}
                    {meta.total_latency_ms != null && ` · ${meta.total_latency_ms}ms`}
                  </span>
                )}
                <button className={`view-btn ${viewMode === "list" ? "active" : ""}`} onClick={() => setViewMode("list")}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect y="2" width="16" height="2" rx="1"/><rect y="7" width="16" height="2" rx="1"/><rect y="12" width="16" height="2" rx="1"/></svg>
                </button>
                <button className={`view-btn ${viewMode === "grid" ? "active" : ""}`} onClick={() => setViewMode("grid")}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect width="7" height="7" rx="1"/><rect x="9" width="7" height="7" rx="1"/><rect y="9" width="7" height="7" rx="1"/><rect x="9" y="9" width="7" height="7" rx="1"/></svg>
                </button>
              </div>
            </div>

            {/* ── Loading ──────────────────────────────────────── */}
            {loading && (
              <div className="search-loading">
                <div className="search-spinner" />
                <span>Querying Solr index...</span>
              </div>
            )}

            {/* ── Error ────────────────────────────────────────── */}
            {error && !loading && (
              <div className="search-error-card">
                <span className="error-badge">⚠</span>
                <div>
                  <div className="error-heading">Search Error</div>
                  <p className="error-detail">{error}</p>
                </div>
              </div>
            )}

            {/* ── Results ──────────────────────────────────────── */}
            {!loading && !error && (
              <div className={`results-list ${viewMode === "grid" ? "grid" : ""}`}>
                {results.length > 0 ? (
                  results.map((r, i) => <ResultCard key={r.id || i} result={r} />)
                ) : (
                  <div className="no-results-msg">
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="#8B949E" strokeWidth="1.5" opacity="0.4">
                      <circle cx="22" cy="22" r="16"/><path d="M34 34l10 10" strokeLinecap="round"/>
                    </svg>
                    <p>No results found for &ldquo;{query}&rdquo;</p>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {!hasSearched && (
        <div className="search-empty">
          <div className="empty-icon">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="#3B82F6" strokeWidth="1.5" opacity="0.4">
              <circle cx="22" cy="22" r="16"/><path d="M34 34l10 10" strokeLinecap="round"/>
            </svg>
          </div>
          <p className="empty-text">Enter a search query to explore news articles</p>
          <div className="quick-search-chips">
            {["politics", "economy", "technology", "climate", "sports"].map(chip => (
              <button key={chip} className="quick-chip-btn" onClick={() => { setQuery(chip); setHasSearched(true); search(chip, filters); }}>
                {chip}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
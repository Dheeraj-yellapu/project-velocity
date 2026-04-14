import { useState, useRef, useEffect, useCallback } from "react";
import axios from "axios";
import SuggestionsDropdown from "./SuggestionsDropdown";
import "./SearchDashboard.css";

const API_BASE = "http://10.145.211.56:4000";

export default function SearchDashboard() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Suggestions state
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Performance metrics
  const [metrics, setMetrics] = useState({
    total_latency_ms: null,
    qtime_ms: null,
    source: null,
    total: 0,
  });

  // Benchmark state
  const [benchmarkData, setBenchmarkData] = useState(null);
  const [benchLoading, setBenchLoading] = useState(false);

  const inputRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const searchContainerRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // ── Handle clicks outside dropdown ────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Fetch suggestions with debouncing ────────────────────────────
  const fetchSuggestions = useCallback(async (prefix) => {
    if (prefix.length < 2) {
      setSuggestions([]);
      setSuggestionsLoading(false);
      return;
    }

    setSuggestionsLoading(true);
    try {
      const { data } = await axios.get(`${API_BASE}/api/suggest`, {
        params: { q: prefix },
        timeout: 5000,
      });
      setSuggestions(data.suggestions || []);
    } catch (err) {
      console.error("Suggestion error:", err.message);
      setSuggestions([]);
    } finally {
      setSuggestionsLoading(false);
    }
  }, []);

  // ── Debounced query input handler ────────────────────────────────
  const handleQueryChange = (newQuery) => {
    setQuery(newQuery);
    setShowSuggestions(true);

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer (300ms debounce)
    debounceTimerRef.current = setTimeout(() => {
      if (newQuery.trim()) {
        fetchSuggestions(newQuery.trim());
      } else {
        setSuggestions([]);
        setSuggestionsLoading(false);
      }
    }, 300);
  };

  // ── Handle suggestion click ──────────────────────────────────────
  const handleSuggestionClick = (suggestion) => {
    setQuery(suggestion);
    setShowSuggestions(false);
    setSuggestions([]);
    // Trigger search after setting query
    setTimeout(() => {
      handleSearch(suggestion);
    }, 0);
  };

  // ── Search handler ────────────────────────────────────────────────
  const handleSearch = useCallback(
    async (searchQuery) => {
      const q = (searchQuery || query).trim();
      if (!q) return;

      setLoading(true);
      setError(null);
      setHasSearched(true);
      setShowSuggestions(false);

      try {
        const { data } = await axios.get(`${API_BASE}/api/search`, {
          params: { q },
          timeout: 10000,
        });

        setResults(data.results || []);
        setMetrics({
          total_latency_ms: data.total_latency_ms,
          qtime_ms: data.qtime_ms,
          source: data.source,
          total: data.total || 0,
        });
      } catch (err) {
        const msg =
          err.response?.data?.error ||
          err.message ||
          "Search failed. Check backend connection.";
        setError(msg);
        setResults([]);
        setMetrics({ total_latency_ms: null, qtime_ms: null, source: null, total: 0 });
      } finally {
        setLoading(false);
      }
    },
    [query]
  );

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  // ── Benchmark handler ─────────────────────────────────────────────
  const runBenchmark = async () => {
    setBenchLoading(true);
    setBenchmarkData(null);
    try {
      const { data } = await axios.get(`${API_BASE}/api/benchmark`, {
        timeout: 60000,
      });
      setBenchmarkData(data);
    } catch (err) {
      setBenchmarkData({
        error: err.response?.data?.error || err.message,
      });
    } finally {
      setBenchLoading(false);
    }
  };

  // ── Date formatter ────────────────────────────────────────────────
  const formatDate = (isoStr) => {
    if (!isoStr) return "—";
    try {
      return new Date(isoStr).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="dashboard">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="dash-header">
        <div className="dash-header-inner">
          <div className="dash-brand">
            <svg
              width="28"
              height="28"
              viewBox="0 0 28 28"
              fill="none"
              className="brand-bolt"
            >
              <path
                d="M15.5 3L6 16h7l-1.5 9L22 12h-7l1.5-9z"
                fill="url(#bolt-grad)"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="0.5"
              />
              <defs>
                <linearGradient
                  id="bolt-grad"
                  x1="6"
                  y1="3"
                  x2="22"
                  y2="25"
                >
                  <stop stopColor="#60A5FA" />
                  <stop offset="1" stopColor="#A78BFA" />
                </linearGradient>
              </defs>
            </svg>
            <div>
              <h1 className="dash-title">VELOCITY</h1>
              <span className="dash-subtitle">
                High QPS Search Engine
              </span>
            </div>
          </div>
          <button
            className="bench-btn"
            onClick={runBenchmark}
            disabled={benchLoading}
          >
            {benchLoading ? (
              <span className="spin-icon">⟳</span>
            ) : (
              <span>⚡</span>
            )}
            {benchLoading ? "Running..." : "Run Benchmark"}
          </button>
        </div>
      </header>

      {/* ── Search Bar ──────────────────────────────────────────────── */}
      <div className="search-section">
        <div className="search-container" ref={searchContainerRef}>
          <div className="search-box">
            <svg
              className="search-lens"
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
            >
              <circle
                cx="9"
                cy="9"
                r="6"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M14 14l4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <input
              ref={inputRef}
              type="text"
              className="search-field"
              placeholder="Search news articles — try 'politics', 'economy', 'technology'..."
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => query.length >= 2 && setShowSuggestions(true)}
            />
            {query && (
              <button
                className="clear-query"
                onClick={() => {
                  setQuery("");
                  setResults([]);
                  setHasSearched(false);
                  setShowSuggestions(false);
                  setSuggestions([]);
                  setMetrics({
                    total_latency_ms: null,
                    qtime_ms: null,
                    source: null,
                    total: 0,
                  });
                  inputRef.current?.focus();
                }}
              >
                ✕
              </button>
            )}
            <button className="go-btn" onClick={() => handleSearch()}>
              Search
            </button>
          </div>

          {/* ── Suggestions Dropdown ────────────────────────────────── */}
          <SuggestionsDropdown
            suggestions={suggestions}
            query={query}
            isOpen={showSuggestions && (suggestions.length > 0 || suggestionsLoading)}
            isLoading={suggestionsLoading}
            onSuggestionClick={handleSuggestionClick}
            onClose={() => setShowSuggestions(false)}
          />
        </div>
      </div>

      {/* ── Performance Metrics Banner ──────────────────────────────── */}
      {hasSearched && metrics.source && !loading && (
        <div className="metrics-banner">
          <div className="metrics-inner">
            <div className="metric-card">
              <span className="metric-label">Total Latency</span>
              <span className="metric-value">
                {metrics.total_latency_ms ?? "—"}
                <span className="metric-unit">ms</span>
              </span>
            </div>

            <div className="metric-divider" />

            <div className="metric-card">
              <span className="metric-label">Solr QTime</span>
              <span className="metric-value">
                {metrics.qtime_ms ?? "—"}
                <span className="metric-unit">ms</span>
              </span>
            </div>

            <div className="metric-divider" />

            <div className="metric-card">
              <span className="metric-label">Data Source</span>
              <span
                className={`source-pill ${metrics.source === "cache" ? "pill-green" : "pill-blue"
                  }`}
              >
                <span className="pill-dot" />
                {metrics.source === "cache"
                  ? "Redis Cache"
                  : "Solr Database"}
              </span>
            </div>

            <div className="metric-divider" />

            <div className="metric-card">
              <span className="metric-label">Results Found</span>
              <span className="metric-value">
                {metrics.total?.toLocaleString() ?? "0"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Loading State ───────────────────────────────────────────── */}
      {loading && (
        <div className="loading-wrap">
          <div className="pulse-loader">
            <div className="pulse-ring" />
            <div className="pulse-ring delay" />
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              className="pulse-icon"
            >
              <circle
                cx="11"
                cy="11"
                r="7"
                stroke="#60A5FA"
                strokeWidth="1.5"
              />
              <path
                d="M16 16l5 5"
                stroke="#60A5FA"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <p className="loading-text">Searching…</p>
        </div>
      )}

      {/* ── Error State ─────────────────────────────────────────────── */}
      {error && (
        <div className="error-wrap">
          <div className="error-card">
            <span className="error-icon">⚠</span>
            <div>
              <p className="error-title">Search Error</p>
              <p className="error-msg">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Results ─────────────────────────────────────────────────── */}
      {!loading && !error && hasSearched && (
        <div className="results-section">
          {results.length === 0 ? (
            <div className="no-results">
              <svg
                width="48"
                height="48"
                viewBox="0 0 48 48"
                fill="none"
                opacity="0.3"
              >
                <circle
                  cx="22"
                  cy="22"
                  r="14"
                  stroke="#8B949E"
                  strokeWidth="2"
                />
                <path
                  d="M32 32l12 12"
                  stroke="#8B949E"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M16 22h12"
                  stroke="#8B949E"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              <p>No results found for &ldquo;{query}&rdquo;</p>
            </div>
          ) : (
            <div className="results-grid">
              {results.map((article, idx) => (
                <article className="article-card" key={article.id || idx}>
                  <div className="article-top">
                    {article.type && (
                      <span className="article-type">{article.type}</span>
                    )}
                    <span className="article-date">
                      {formatDate(article.published_at)}
                    </span>
                  </div>
                  <h3 className="article-title">
                    {article.url ? (
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {article.title || "Untitled"}
                      </a>
                    ) : (
                      article.title || "Untitled"
                    )}
                  </h3>
                  {article.summary && (
                    <p className="article-summary">{article.summary}</p>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Empty state (before any search) ─────────────────────────── */}
      {!hasSearched && !loading && (
        <div className="empty-state">
          <div className="empty-visual">
            <div className="orbit-ring" />
            <div className="orbit-ring ring-2" />
            <svg
              width="56"
              height="56"
              viewBox="0 0 56 56"
              fill="none"
              className="empty-icon"
            >
              <circle
                cx="24"
                cy="24"
                r="16"
                stroke="url(#empty-grad)"
                strokeWidth="2"
              />
              <path
                d="M36 36l14 14"
                stroke="url(#empty-grad)"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="empty-grad" x1="8" y1="8" x2="50" y2="50">
                  <stop stopColor="#60A5FA" />
                  <stop offset="1" stopColor="#A78BFA" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h2 className="empty-heading">Search the News Index</h2>
          <p className="empty-sub">
            Powered by Apache Solr with Redis caching for high QPS
          </p>
          <div className="quick-chips">
            {["politics", "economy", "sports", "technology", "climate"].map(
              (chip) => (
                <button
                  key={chip}
                  className="quick-chip"
                  onClick={() => {
                    setQuery(chip);
                    handleSearch(chip);
                  }}
                >
                  {chip}
                </button>
              )
            )}
          </div>
        </div>
      )}

      {/* ── Benchmark Results Modal ─────────────────────────────────── */}
      {benchmarkData && (
        <div
          className="bench-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setBenchmarkData(null);
          }}
        >
          <div className="bench-modal">
            <div className="bench-modal-header">
              <h2>⚡ Benchmark Results</h2>
              <button
                className="bench-close"
                onClick={() => setBenchmarkData(null)}
              >
                ✕
              </button>
            </div>

            {benchmarkData.error ? (
              <div className="bench-error">
                <p>{benchmarkData.error}</p>
              </div>
            ) : (
              <>
                {/* Summary cards */}
                {benchmarkData.summary && (
                  <div className="bench-summary">
                    <div className="bench-stat">
                      <span className="bench-stat-label">Queries</span>
                      <span className="bench-stat-value">
                        {benchmarkData.summary.total_queries}
                      </span>
                    </div>
                    <div className="bench-stat">
                      <span className="bench-stat-label">Avg Raw Latency</span>
                      <span className="bench-stat-value amber">
                        {benchmarkData.summary.avg_raw_latency_ms}ms
                      </span>
                    </div>
                    <div className="bench-stat">
                      <span className="bench-stat-label">
                        Avg Cached Latency
                      </span>
                      <span className="bench-stat-value green">
                        {benchmarkData.summary.avg_cached_latency_ms ?? "—"}ms
                      </span>
                    </div>
                    <div className="bench-stat">
                      <span className="bench-stat-label">Avg Speedup</span>
                      <span className="bench-stat-value blue">
                        {benchmarkData.summary.avg_speedup}
                      </span>
                    </div>
                  </div>
                )}

                {/* Per-query table */}
                <div className="bench-table-wrap">
                  <table className="bench-table">
                    <thead>
                      <tr>
                        <th>Query</th>
                        <th>Results</th>
                        <th>Solr QTime</th>
                        <th>Raw Latency</th>
                        <th>Cached Latency</th>
                        <th>Speedup</th>
                      </tr>
                    </thead>
                    <tbody>
                      {benchmarkData.benchmark?.map((row, i) => (
                        <tr key={i}>
                          <td className="bench-query">{row.query}</td>
                          <td>{row.num_results?.toLocaleString()}</td>
                          <td>
                            {row.solr_qtime_ms != null
                              ? `${row.solr_qtime_ms}ms`
                              : "—"}
                          </td>
                          <td className="amber">{row.raw_solr_latency_ms}ms</td>
                          <td className="green">
                            {row.cached_latency_ms != null
                              ? `${row.cached_latency_ms}ms`
                              : "—"}
                          </td>
                          <td className="blue">{row.speedup}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

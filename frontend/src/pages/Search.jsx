import { useState } from "react";
import { useSearch } from "../hooks/useSearch";
import SearchBar from "../components/SearchBar";
import Filters from "../components/Filters";
import ResultCard from "../components/ResultCard";

const MOCK_RESULTS = [
  { url: "https://theguardian.com/housing-2016", title: "Five steps to fixing the UK housing crisis in 2016", type: "Politics", pub: "2016-01-01T00:00:00Z", lang: "en", sum: "Headlines about the utter madness of our housing market dominated 2015. It's time to make some new year's resolutions...", body: "Perhaps in years to come 2015 will be remembered as the year the housing crisis went mainstream. My fellow housing and economics journalists have been wailing like Cassandra for years now..." },
  { url: "https://bbc.com/news/uk-housing-market-slowdown", title: "UK housing market sees unexpected slowdown", type: "Economy", pub: "2024-03-15T00:00:00Z", lang: "en", sum: "The UK housing market has shown signs of cooling as interest rates remain high. House prices in several regions have plateaued...", body: "House prices in several regions have plateaued, with buyers becoming more cautious. Experts suggest this could be a turning point..." },
  { url: "https://ft.com/content/uk-housing-approach", title: "Why the UK needs a new approach to housing", type: "Housing", pub: "2024-02-10T00:00:00Z", lang: "en", sum: "Britain's housing crisis demands bold solutions. After decades of underbuilding, local councils, housing associations, and the private sector must work together...", body: "Local councils, housing associations, and the private sector must work together to deliver affordable homes..." },
  { url: "https://independent.co.uk/housing-policy", title: "Housing policy reform: what the experts say", type: "Society", pub: "2024-01-20T00:00:00Z", lang: "en", sum: "A panel of economists and urban planners share their views on what it will take to fix Britain's chronic housing shortage...", body: "The shortage of affordable housing continues to be one of the most pressing social issues in Britain today..." },
];

const MOCK_SUGGESTIONS = ["housing crisis uk", "housing policy reforms", "affordable housing uk", "london rent prices"];

export default function Search({ onNavigate }) {
  const { query, setQuery, filters, setFilters, results, loading, error, meta, suggestions, setSuggestions, search, fetchSuggestions } = useSearch();
  const [hasSearched, setHasSearched] = useState(false);
  const [sort, setSort] = useState("relevance");
  const [viewMode, setViewMode] = useState("list");

  // Use mock data for demo
  const displayResults = hasSearched ? MOCK_RESULTS : [];
  const displayMeta = hasSearched ? { total: 12540, elapsed: "0.38" } : { total: 0, elapsed: 0 };
  const displaySuggestions = query.length >= 2 ? MOCK_SUGGESTIONS : [];

  const handleSearch = () => {
    setHasSearched(true);
  };

  const handleSuggestion = (s) => {
    setQuery(s);
    setHasSearched(true);
  };

  return (
    <div className="search-page">
      <div className="search-hero">
        <SearchBar
          query={query}
          onChange={(q) => { setQuery(q); }}
          onSearch={handleSearch}
          suggestions={displaySuggestions}
          onSuggestionClick={handleSuggestion}
          onClear={() => { setQuery(""); setHasSearched(false); }}
        />
      </div>

      {hasSearched && (
        <div className="search-body">
          <Filters filters={filters} onChange={setFilters} />

          <section className="results-area">
            <div className="results-meta-bar">
              <span className="results-count">About {displayMeta.total.toLocaleString()} results ({displayMeta.elapsed}s)</span>
              <div className="results-controls">
                <label className="sort-label">Sort by:</label>
                <select className="sort-select" value={sort} onChange={e => setSort(e.target.value)}>
                  <option value="relevance">Relevance</option>
                  <option value="date">Date</option>
                  <option value="popularity">Popularity</option>
                </select>
                <button className={`view-btn ${viewMode === "list" ? "active" : ""}`} onClick={() => setViewMode("list")}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect y="2" width="16" height="2" rx="1"/><rect y="7" width="16" height="2" rx="1"/><rect y="12" width="16" height="2" rx="1"/></svg>
                </button>
                <button className={`view-btn ${viewMode === "grid" ? "active" : ""}`} onClick={() => setViewMode("grid")}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect width="7" height="7" rx="1"/><rect x="9" width="7" height="7" rx="1"/><rect y="9" width="7" height="7" rx="1"/><rect x="9" y="9" width="7" height="7" rx="1"/></svg>
                </button>
              </div>
            </div>

            <div className={`results-list ${viewMode === "grid" ? "grid" : ""}`}>
              {displayResults.map((r, i) => <ResultCard key={i} result={r} />)}
            </div>
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
        </div>
      )}
    </div>
  );
}
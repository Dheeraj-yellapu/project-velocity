import { useState, useEffect, useRef } from "react";

export default function SearchBar({ query, onChange, onSearch, suggestions, onSuggestionClick, onClear }) {
  const [showSug, setShowSug] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (!ref.current?.contains(e.target)) setShowSug(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleKey = (e) => {
    if (e.key === "Enter") { setShowSug(false); onSearch(); }
  };

  return (
    <div className="searchbar-wrap" ref={ref}>
      <div className="searchbar">
        <svg className="search-icon" width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M12.5 12.5L16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <input
          type="text"
          className="search-input"
          placeholder="Search news articles..."
          value={query}
          onChange={e => { onChange(e.target.value); setShowSug(true); }}
          onFocus={() => setShowSug(true)}
          onKeyDown={handleKey}
        />
        {query && (
          <button className="clear-btn" onClick={() => { onClear(); setShowSug(false); }}>
            <svg width="14" height="14" viewBox="0 0 14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M2 2l10 10M12 2L2 12"/>
            </svg>
          </button>
        )}
        <button className="search-btn" onClick={() => { setShowSug(false); onSearch(); }}>Search</button>
      </div>

      {showSug && suggestions.length > 0 && (
        <div className="suggestions">
          <span className="sug-label">Suggestions:</span>
          {suggestions.map((s, i) => (
            <button key={i} className="sug-chip" onClick={() => { onSuggestionClick(s); setShowSug(false); }}>
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
import { useState } from "react";

const TYPES = ["Politics", "Economy", "Housing", "Society", "World", "Tech", "Health"];
const LANGS = [{ code: "en", label: "English" }, { code: "fr", label: "French" }, { code: "de", label: "German" }];
const DATE_PRESETS = ["Any time", "Last 24 hours", "Last 7 days", "Last 30 days", "Custom range"];

export default function Filters({ filters, onChange }) {
  const [datePreset, setDatePreset] = useState("Any time");
  const [showMore, setShowMore] = useState(false);

  const toggleType = (t) => {
    onChange({ ...filters, type: filters.type === t ? "" : t });
  };

  return (
    <aside className="filters-panel">
      <div className="filters-header">
        <span>Filters</span>
        <button className="clear-all" onClick={() => { onChange({ type: "", lang: "", from: "", to: "", sort: "relevance" }); setDatePreset("Any time"); }}>
          Clear All
        </button>
      </div>

      <div className="filter-section">
        <div className="filter-label">Publication Date</div>
        {DATE_PRESETS.map(p => (
          <label key={p} className="radio-row">
            <input type="radio" name="date" checked={datePreset === p} onChange={() => setDatePreset(p)} />
            <span>{p}</span>
            {p === "Custom range" && <svg width="14" height="14" viewBox="0 0 14 14" stroke="currentColor" strokeWidth="1.2" fill="none"><rect x="1" y="2" width="12" height="11" rx="1.5"/><path d="M5 1v2M9 1v2M1 5h12"/></svg>}
          </label>
        ))}
      </div>

      <div className="filter-section">
        <div className="filter-label">Topic</div>
        {(showMore ? TYPES : TYPES.slice(0, 5)).map((t, i) => (
          <label key={t} className="check-row">
            <input type="checkbox" checked={filters.type === t} onChange={() => toggleType(t)} />
            <span className="check-label">{t}</span>
            <span className="check-count">{[46,32,28,18,12,8,5][i]}</span>
          </label>
        ))}
        <button className="show-more" onClick={() => setShowMore(v => !v)}>
          {showMore ? "Show less ∧" : "Show more ∨"}
        </button>
      </div>

      <div className="filter-section">
        <div className="filter-label">Language</div>
        {LANGS.map(l => (
          <label key={l.code} className="check-row">
            <input type="checkbox" checked={filters.lang === l.code} onChange={() => onChange({ ...filters, lang: filters.lang === l.code ? "" : l.code })} />
            <span>{l.label}</span>
          </label>
        ))}
      </div>

      <div className="filter-section">
        <div className="filter-label">Source</div>
        <div className="source-search-wrap">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2"><circle cx="5" cy="5" r="3.5"/><path d="M8.5 8.5L11 11" strokeLinecap="round"/></svg>
          <input className="source-search" type="text" placeholder="Search sources..." />
        </div>
        {["The Guardian", "BBC News", "Financial Times", "The Independent"].map((s, i) => (
          <label key={s} className="check-row">
            <input type="checkbox" />
            <span>{s}</span>
            <span className="check-count">{[23,18,12,9][i]}</span>
          </label>
        ))}
      </div>
    </aside>
  );
}
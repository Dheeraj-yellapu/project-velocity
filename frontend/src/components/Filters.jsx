import { useState } from "react";

const TYPES = ["politics", "economy", "housing", "society", "world", "tech", "health"];
const LANGS = [{ code: "en", label: "English" }, { code: "fr", label: "French" }, { code: "de", label: "German" }, { code: "es", label: "Spanish" }];

function getDatePresetRange(preset) {
  if (preset === "Any time") return { from: "", to: "" };
  const now = new Date();
  let from;
  if (preset === "Last 24 hours") {
    from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  } else if (preset === "Last 7 days") {
    from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (preset === "Last 30 days") {
    from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  } else if (preset === "Last year") {
    from = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  }
  if (!from) return { from: "", to: "" };
  return { from: from.toISOString(), to: now.toISOString() };
}

export default function Filters({ filters, onChange }) {
  const [datePreset, setDatePreset] = useState("Any time");
  const [showMore, setShowMore] = useState(false);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const DATE_PRESETS = ["Any time", "Last 24 hours", "Last 7 days", "Last 30 days", "Last year", "Custom range"];

  const toggleType = (t) => {
    onChange({ ...filters, type: filters.type === t ? "" : t });
  };

  const handleDatePreset = (p) => {
    setDatePreset(p);
    if (p === "Custom range") return; // user will provide dates manually
    const range = getDatePresetRange(p);
    onChange({ ...filters, ...range });
  };

  const handleCustomDateApply = () => {
    const from = customFrom ? new Date(customFrom).toISOString() : "";
    const to = customTo ? new Date(customTo + "T23:59:59").toISOString() : "";
    onChange({ ...filters, from, to });
  };

  return (
    <aside className="filters-panel">
      <div className="filters-header">
        <span>Filters</span>
        <button className="clear-all" onClick={() => {
          onChange({ type: "", lang: "", from: "", to: "", sort: "relevance", rows: 10 });
          setDatePreset("Any time");
          setCustomFrom("");
          setCustomTo("");
        }}>
          Clear All
        </button>
      </div>

      {/* ── Date ─────────────────────────────────── */}
      <div className="filter-section">
        <div className="filter-label">Publication Date</div>
        {DATE_PRESETS.map(p => (
          <label key={p} className="radio-row">
            <input type="radio" name="date" checked={datePreset === p} onChange={() => handleDatePreset(p)} />
            <span>{p}</span>
          </label>
        ))}
        {datePreset === "Custom range" && (
          <div className="custom-date-inputs">
            <div className="date-row">
              <label className="date-label">From</label>
              <input type="date" className="date-input" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
            </div>
            <div className="date-row">
              <label className="date-label">To</label>
              <input type="date" className="date-input" value={customTo} onChange={e => setCustomTo(e.target.value)} />
            </div>
            <button className="apply-date-btn" onClick={handleCustomDateApply}>Apply Range</button>
          </div>
        )}
      </div>

      {/* ── Topic ────────────────────────────────── */}
      <div className="filter-section">
        <div className="filter-label">Topic</div>
        {(showMore ? TYPES : TYPES.slice(0, 5)).map((t) => (
          <label key={t} className="check-row">
            <input type="checkbox" checked={filters.type === t} onChange={() => toggleType(t)} />
            <span className="check-label" style={{ textTransform: "capitalize" }}>{t}</span>
          </label>
        ))}
        <button className="show-more" onClick={() => setShowMore(v => !v)}>
          {showMore ? "Show less ∧" : "Show more ∨"}
        </button>
      </div>

      {/* ── Language ──────────────────────────────── */}
      <div className="filter-section">
        <div className="filter-label">Language</div>
        {LANGS.map(l => (
          <label key={l.code} className="check-row">
            <input type="checkbox" checked={filters.lang === l.code} onChange={() => onChange({ ...filters, lang: filters.lang === l.code ? "" : l.code })} />
            <span>{l.label}</span>
          </label>
        ))}
      </div>

      {/* ── Sort ──────────────────────────────────── */}
      <div className="filter-section">
        <div className="filter-label">Sort By</div>
        {[
          { value: "relevance", label: "Relevance" },
          { value: "date", label: "Newest First" },
          { value: "date_asc", label: "Oldest First" },
        ].map(s => (
          <label key={s.value} className="radio-row">
            <input type="radio" name="sort" checked={filters.sort === s.value} onChange={() => onChange({ ...filters, sort: s.value })} />
            <span>{s.label}</span>
          </label>
        ))}
      </div>

      {/* ── Results Per Page ──────────────────────── */}
      <div className="filter-section">
        <div className="filter-label">Results Per Page</div>
        {[10, 20, 50, 100].map(size => (
          <label key={size} className="radio-row">
            <input type="radio" name="rows" checked={Number(filters.rows) === size} onChange={() => onChange({ ...filters, rows: size })} />
            <span>{size} results</span>
          </label>
        ))}
      </div>
    </aside>
  );
}
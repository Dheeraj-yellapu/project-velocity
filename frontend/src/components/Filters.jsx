import { useEffect, useRef, useState } from "react";
import { searchService } from "../services/searchService";
const LANGS = [{ code: "en", label: "English" }, { code: "fr", label: "French" }, { code: "de", label: "German" }, { code: "es", label: "Spanish" }];
const HARD_TOPIC_OPTIONS = [
  { value: "ENVIRONMENT", label: "ENVIRONMENT", count: 0 },
  { value: "BUSINESS", label: "BUSINESS", count: 0 },
  { value: "POLITICS", label: "POLITICS", count: 0 },
  { value: "SPORTS", label: "SPORTS", count: 0 },
  { value: "ECONOMY", label: "ECONOMY", count: 0 },
  { value: "TECHNOLOGY", label: "TECHNOLOGY", count: 0 },
  { value: "HEALTH", label: "HEALTH", count: 0 },
  { value: "WORLD", label: "WORLD", count: 0 },
];

function normalizeTopicInput(value = "") {
  return String(value).trim().toLowerCase();
}

function normalizeDynamicTopicValue(selectedTopic = "") {
  return String(selectedTopic).trim().toUpperCase();
}

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
  const [topicQuery, setTopicQuery] = useState(filters.type || "");
  const [topicOptions, setTopicOptions] = useState(HARD_TOPIC_OPTIONS);
  const [topicOptionsLoading, setTopicOptionsLoading] = useState(false);
  const [topicLookupError, setTopicLookupError] = useState("");
  const debounceRef = useRef(null);

  const DATE_PRESETS = ["Any time", "Last 24 hours", "Last 7 days", "Last 30 days", "Last year", "Custom range"];
  const hardcodedTopicSet = new Set(HARD_TOPIC_OPTIONS.map((topic) => topic.value));

  const toggleType = (t) => {
    const isHardcodedTopic = hardcodedTopicSet.has(String(t || "").trim());
    const nextTypeValue = isHardcodedTopic ? String(t || "").trim() : normalizeDynamicTopicValue(t);
    setTopicQuery(nextTypeValue || "");
    onChange({ ...filters, type: normalizeTopicInput(filters.type) === normalizeTopicInput(nextTypeValue) ? "" : nextTypeValue });
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

  useEffect(() => {
    setTopicQuery(filters.type || "");
  }, [filters.type]);

  useEffect(() => {
    const normalizedQuery = normalizeTopicInput(topicQuery);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!normalizedQuery) {
      setTopicOptions(HARD_TOPIC_OPTIONS);
      setTopicLookupError("");
      setTopicOptionsLoading(false);
      return;
    }

    setTopicOptionsLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await searchService.getTopicTypes(normalizedQuery);
        const fromServer = Array.isArray(data?.topics) ? data.topics : [];
        const normalizedOptions = fromServer.map((topic) => ({
          value: String(topic?.value || "").trim(),
          label: String(topic?.value || "").toUpperCase(),
          count: Number(topic?.count) || 0,
        })).filter((topic) => topic.value);

        setTopicOptions(normalizedOptions);
        setTopicLookupError("");
      } catch (error) {
        setTopicLookupError("Unable to load topics");
        setTopicOptions(HARD_TOPIC_OPTIONS.filter((topic) => topic.value.includes(normalizedQuery)));
      } finally {
        setTopicOptionsLoading(false);
      }
    }, 250);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [topicQuery]);

  const applyTypedTopic = async () => {
    const normalizedQuery = normalizeTopicInput(topicQuery);
    if (!normalizedQuery) {
      onChange({ ...filters, type: "" });
      return;
    }

    setTopicOptionsLoading(true);
    try {
      const data = await searchService.getTopicTypes(normalizedQuery);
      const matchedTopic = typeof data?.matchedTopic === "string"
        ? String(data.matchedTopic).trim()
        : "";

      if (matchedTopic) {
        const isHardcodedTopic = hardcodedTopicSet.has(matchedTopic);
        const nextTypeValue = isHardcodedTopic ? matchedTopic : normalizeDynamicTopicValue(matchedTopic);
        onChange({ ...filters, type: nextTypeValue });
        setTopicQuery(nextTypeValue);
        setTopicLookupError("");
      } else {
        onChange({ ...filters, type: "" });
        setTopicLookupError("No exact topic match");
      }
    } catch (_error) {
      onChange({ ...filters, type: "" });
      setTopicLookupError("Unable to apply topic filter");
    } finally {
      setTopicOptionsLoading(false);
    }
  };

  const visibleTopics = topicOptions.filter((topic) => topic.value);

  const topicLimit = 8;
  const canShowMoreTopics = visibleTopics.length > topicLimit;
  const topicsToRender = showMore || !canShowMoreTopics ? visibleTopics : visibleTopics.slice(0, topicLimit);

  return (
    <aside className="filters-panel">
      <div className="filters-header">
        <span>Filters</span>
        <button className="clear-all" onClick={() => {
          onChange({ type: "", lang: "", from: "", to: "", sort: "relevance", rows: 10 });
          setDatePreset("Any time");
          setCustomFrom("");
          setCustomTo("");
          setTopicQuery("");
          setTopicLookupError("");
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
        <div className="source-search-wrap">
          <input
            type="text"
            className="source-search"
            placeholder="Search topic metadata"
            value={topicQuery}
            onChange={(e) => setTopicQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyTypedTopic();
              }
            }}
          />
          <button className="show-more" onClick={applyTypedTopic}>Apply</button>
        </div>
        {topicOptionsLoading && <div className="filter-loading">Loading topics...</div>}
        {!topicOptionsLoading && topicsToRender.map((topic) => (
          <label key={topic.value} className="check-row">
            <input type="checkbox" checked={normalizeTopicInput(filters.type) === normalizeTopicInput(topic.value)} onChange={() => toggleType(topic.value)} />
            <span className="check-label">{topic.label}</span>
          </label>
        ))}
        {!topicOptionsLoading && canShowMoreTopics && (
          <button className="show-more" onClick={() => setShowMore(v => !v)}>
            {showMore ? "Show less ∧" : "Show more ∨"}
          </button>
        )}
        {!topicOptionsLoading && visibleTopics.length === 0 && <div className="filter-loading">No topics available</div>}
        {!!topicLookupError && <div className="filter-loading">{topicLookupError}</div>}
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
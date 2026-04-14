import { useState } from "react";
import { helpers } from "../utils/helpers";

export default function ResultCard({ result }) {
  const [expanded, setExpanded] = useState(false);
  const SOURCE_ICONS = { "The Guardian": "G", "BBC News": "B", "Financial Times": "FT" };
  const domain = result.url ? new URL(result.url).hostname.replace("www.", "") : "";
  const sourceName = domain.includes("guardian") ? "The Guardian" : domain.includes("bbc") ? "BBC News" : domain.includes("ft") ? "Financial Times" : domain;
  
  // Handle title as array or string
  const titleText = Array.isArray(result.title) ? result.title[0] : result.title;
  const bodyText = Array.isArray(result.body) ? result.body[0] : result.body;
  const sumText = Array.isArray(result.summary) ? result.summary[0] : (result.summary || (Array.isArray(result.sum) ? result.sum[0] : result.sum));

  return (
    <article className="result-card">
      <div className="result-meta">
        <div className="source-badge">
          <span className="source-icon">{SOURCE_ICONS[sourceName]?.[0] || sourceName[0] || '?'}</span>
          <span className="source-name">{sourceName || 'Unknown Source'}</span>
        </div>
        {result.type && <span className="type-tag">{result.type}</span>}
      </div>
      <h3 className="result-title">
        <a href={result.url} target="_blank" rel="noopener noreferrer">{titleText}</a>
      </h3>
      {result.published_at && (
        <div className="result-date">{helpers.formatDate(result.published_at)}</div>
      )}
      <p className="result-sum">{sumText}</p>
      {expanded && <p className="result-body">{bodyText}</p>}
      <a href={result.url} className="result-url" target="_blank" rel="noopener noreferrer">{result.url}</a>
      {bodyText && (
        <button className="expand-btn" onClick={() => setExpanded(v => !v)}>
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </article>
  );
}
import { useState } from "react";
import { helpers } from "../utils/helpers";

export default function ResultCard({ result }) {
  const [expanded, setExpanded] = useState(false);
  const SOURCE_ICONS = { "The Guardian": "G", "BBC News": "B", "Financial Times": "FT" };
  const domain = result.url ? new URL(result.url).hostname.replace("www.", "") : "";
  const sourceName = domain.includes("guardian") ? "The Guardian" : domain.includes("bbc") ? "BBC News" : domain.includes("ft") ? "Financial Times" : domain;

  return (
    <article className="result-card">
      <div className="result-meta">
        <div className="source-badge">
          <span className="source-icon">{SOURCE_ICONS[sourceName]?.[0] || sourceName[0]}</span>
          <span className="source-name">{sourceName}</span>
        </div>
        {result.type && <span className="type-tag">{result.type}</span>}
      </div>
      <h3 className="result-title">
        <a href={result.url} target="_blank" rel="noopener noreferrer">{result.title}</a>
      </h3>
      <div className="result-date">{helpers.formatDate(result.pub)}</div>
      <p className="result-sum">{result.sum}</p>
      {expanded && <p className="result-body">{result.body}</p>}
      <a href={result.url} className="result-url" target="_blank" rel="noopener noreferrer">{result.url}</a>
      {result.body && (
        <button className="expand-btn" onClick={() => setExpanded(v => !v)}>
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </article>
  );
}
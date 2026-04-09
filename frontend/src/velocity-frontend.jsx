// /**
//  * VELOCITY — High QPS Search Engine Frontend
//  * Phase 1: Setup, Routing, Basic Pages
//  * Phase 2: Authentication, Mode Switching (User/Admin)
//  *
//  * Folder structure (logical separation within single artifact):
//  * src/
//  *  api/client.js           → fetch wrapper
//  *  services/searchService.js → search logic
//  *  hooks/useSearch.js      → search hook
//  *  utils/helpers.js        → date formatting, etc.
//  *  components/             → Navbar, SearchBar, ResultCard, Filters
//  *  pages/                  → Login, Search, AdminDashboard
//  *  layouts/                → MainLayout, AdminLayout
//  *  styles/global.css       → all styles (embedded in <style>)
//  *  App.jsx                 → routing root
//  */

// import { useState, useCallback, useEffect, useRef } from "react";

// // ─────────────────────────────────────────────
// // utils/helpers.js
// // ─────────────────────────────────────────────
// const helpers = {
//   formatDate(isoString) {
//     if (!isoString) return "";
//     const d = new Date(isoString);
//     return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
//   },
//   truncate(str, max = 160) {
//     if (!str) return "";
//     return str.length > max ? str.slice(0, max) + "…" : str;
//   },
//   formatQPS(n) {
//     return n >= 1000 ? (n / 1000).toFixed(1) + "k" : String(n);
//   },
// };

// // ─────────────────────────────────────────────
// // api/client.js
// // ─────────────────────────────────────────────
// const BASE_URL = "/api";

// const client = {
//   async get(path, params = {}) {
//     const url = new URL(BASE_URL + path, window.location.origin);
//     Object.entries(params).forEach(([k, v]) => v !== undefined && url.searchParams.set(k, v));
//     const res = await fetch(url.toString(), { headers: { "Content-Type": "application/json" } });
//     if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
//     return res.json();
//   },
// };

// // ─────────────────────────────────────────────
// // services/searchService.js
// // ─────────────────────────────────────────────
// const searchService = {
//   async search({ query, type, lang, from, to, sort = "relevance", start = 0, rows = 10 }) {
//     return client.get("/search", { q: query, type, lang, from, to, sort, start, rows });
//   },
//   async suggest(prefix) {
//     return client.get("/suggest", { q: prefix });
//   },
//   async getAnalytics(range = "6h") {
//     return client.get("/admin/analytics", { range });
//   },
//   async getLogs(page = 0) {
//     return client.get("/admin/logs", { page });
//   },
// };

// // ─────────────────────────────────────────────
// // hooks/useSearch.js
// // ─────────────────────────────────────────────
// function useSearch() {
//   const [query, setQuery] = useState("");
//   const [filters, setFilters] = useState({ type: "", lang: "", from: "", to: "", sort: "relevance" });
//   const [results, setResults] = useState([]);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState(null);
//   const [meta, setMeta] = useState({ total: 0, elapsed: 0 });
//   const [suggestions, setSuggestions] = useState([]);

//   const search = useCallback(async (q = query, f = filters) => {
//     if (!q.trim()) return;
//     setLoading(true);
//     setError(null);
//     const t0 = performance.now();
//     try {
//       const data = await searchService.search({ query: q, ...f });
//       setResults(data.results || []);
//       setMeta({ total: data.total || 0, elapsed: ((performance.now() - t0) / 1000).toFixed(2) });
//     } catch (e) {
//       setError(e.message);
//     } finally {
//       setLoading(false);
//     }
//   }, [query, filters]);

//   const fetchSuggestions = useCallback(async (prefix) => {
//     if (prefix.length < 2) { setSuggestions([]); return; }
//     try {
//       const data = await searchService.suggest(prefix);
//       setSuggestions(data.suggestions || []);
//     } catch { setSuggestions([]); }
//   }, []);

//   return { query, setQuery, filters, setFilters, results, loading, error, meta, suggestions, setSuggestions, search, fetchSuggestions };
// }

// // ─────────────────────────────────────────────
// // MOCK DATA — replaces real backend for demo
// // ─────────────────────────────────────────────
// const MOCK_RESULTS = [
//   { url: "https://theguardian.com/housing-2016", title: "Five steps to fixing the UK housing crisis in 2016", type: "Politics", pub: "2016-01-01T00:00:00Z", lang: "en", sum: "Headlines about the utter madness of our housing market dominated 2015. It's time to make some new year's resolutions...", body: "Perhaps in years to come 2015 will be remembered as the year the housing crisis went mainstream. My fellow housing and economics journalists have been wailing like Cassandra for years now..." },
//   { url: "https://bbc.com/news/uk-housing-market-slowdown", title: "UK housing market sees unexpected slowdown", type: "Economy", pub: "2024-03-15T00:00:00Z", lang: "en", sum: "The UK housing market has shown signs of cooling as interest rates remain high. House prices in several regions have plateaued...", body: "House prices in several regions have plateaued, with buyers becoming more cautious. Experts suggest this could be a turning point..." },
//   { url: "https://ft.com/content/uk-housing-approach", title: "Why the UK needs a new approach to housing", type: "Housing", pub: "2024-02-10T00:00:00Z", lang: "en", sum: "Britain's housing crisis demands bold solutions. After decades of underbuilding, local councils, housing associations, and the private sector must work together...", body: "Local councils, housing associations, and the private sector must work together to deliver affordable homes..." },
//   { url: "https://independent.co.uk/housing-policy", title: "Housing policy reform: what the experts say", type: "Society", pub: "2024-01-20T00:00:00Z", lang: "en", sum: "A panel of economists and urban planners share their views on what it will take to fix Britain's chronic housing shortage...", body: "The shortage of affordable housing continues to be one of the most pressing social issues in Britain today..." },
// ];

// const MOCK_SUGGESTIONS = ["housing crisis uk", "housing policy reforms", "affordable housing uk", "london rent prices"];

// const ADMIN_CODE = "velocity2024";

// // ─────────────────────────────────────────────
// // components/Navbar.jsx
// // ─────────────────────────────────────────────
// function Navbar({ mode, onNavigate, currentPage }) {
//   const [theme, setTheme] = useState("dark");

//   return (
//     <nav className="navbar">
//       <div className="navbar-brand" onClick={() => onNavigate(mode === "admin" ? "admin" : "search")}>
//         <div className="brand-icon">
//           <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
//             <circle cx="11" cy="11" r="10" stroke="#3B82F6" strokeWidth="1.5"/>
//             <circle cx="11" cy="11" r="6" stroke="#3B82F6" strokeWidth="1.5"/>
//             <circle cx="11" cy="11" r="2.5" fill="#3B82F6"/>
//           </svg>
//         </div>
//         <div>
//           <span className="brand-name">VELOCITY</span>
//           <span className="brand-sub">High QPS Search Engine</span>
//         </div>
//       </div>

//       {mode === "user" && (
//         <div className="navbar-links">
//           <button className={`nav-link ${currentPage === "search" ? "active" : ""}`} onClick={() => onNavigate("search")}>Search</button>
//           <button className="nav-link">About</button>
//         </div>
//       )}

//       {mode === "admin" && (
//         <div className="navbar-links">
//           <span className="nav-badge">Admin Mode</span>
//         </div>
//       )}

//       <div className="navbar-actions">
//         <button className="icon-btn" onClick={() => setTheme(t => t === "dark" ? "light" : "dark")} title="Toggle theme">
//           <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
//             <circle cx="8" cy="8" r="3.5"/>
//             <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M3.05 12.95l1.06-1.06M11.89 4.11l1.06-1.06" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
//           </svg>
//         </button>
//         <button className="admin-btn" onClick={() => onNavigate(mode === "admin" ? "search" : "login")}>
//           <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" style={{marginRight: 6}}>
//             <path d="M7 7a3 3 0 100-6 3 3 0 000 6zM2 12c0-2.76 2.24-5 5-5s5 2.24 5 5"/>
//           </svg>
//           {mode === "admin" ? "Exit Admin" : "Admin"}
//         </button>
//       </div>
//     </nav>
//   );
// }

// // ─────────────────────────────────────────────
// // components/SearchBar.jsx
// // ─────────────────────────────────────────────
// function SearchBar({ query, onChange, onSearch, suggestions, onSuggestionClick, onClear }) {
//   const [showSug, setShowSug] = useState(false);
//   const ref = useRef(null);

//   useEffect(() => {
//     const handler = (e) => { if (!ref.current?.contains(e.target)) setShowSug(false); };
//     document.addEventListener("mousedown", handler);
//     return () => document.removeEventListener("mousedown", handler);
//   }, []);

//   const handleKey = (e) => {
//     if (e.key === "Enter") { setShowSug(false); onSearch(); }
//   };

//   return (
//     <div className="searchbar-wrap" ref={ref}>
//       <div className="searchbar">
//         <svg className="search-icon" width="18" height="18" viewBox="0 0 18 18" fill="none">
//           <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
//           <path d="M12.5 12.5L16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
//         </svg>
//         <input
//           type="text"
//           className="search-input"
//           placeholder="Search news articles..."
//           value={query}
//           onChange={e => { onChange(e.target.value); setShowSug(true); }}
//           onFocus={() => setShowSug(true)}
//           onKeyDown={handleKey}
//         />
//         {query && (
//           <button className="clear-btn" onClick={() => { onClear(); setShowSug(false); }}>
//             <svg width="14" height="14" viewBox="0 0 14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
//               <path d="M2 2l10 10M12 2L2 12"/>
//             </svg>
//           </button>
//         )}
//         <button className="search-btn" onClick={() => { setShowSug(false); onSearch(); }}>Search</button>
//       </div>

//       {showSug && suggestions.length > 0 && (
//         <div className="suggestions">
//           <span className="sug-label">Suggestions:</span>
//           {suggestions.map((s, i) => (
//             <button key={i} className="sug-chip" onClick={() => { onSuggestionClick(s); setShowSug(false); }}>
//               {s}
//             </button>
//           ))}
//         </div>
//       )}
//     </div>
//   );
// }

// // ─────────────────────────────────────────────
// // components/Filters.jsx
// // ─────────────────────────────────────────────
// const TYPES = ["Politics", "Economy", "Housing", "Society", "World", "Tech", "Health"];
// const LANGS = [{ code: "en", label: "English" }, { code: "fr", label: "French" }, { code: "de", label: "German" }];
// const DATE_PRESETS = ["Any time", "Last 24 hours", "Last 7 days", "Last 30 days", "Custom range"];

// function Filters({ filters, onChange }) {
//   const [datePreset, setDatePreset] = useState("Any time");
//   const [showMore, setShowMore] = useState(false);

//   const toggleType = (t) => {
//     onChange({ ...filters, type: filters.type === t ? "" : t });
//   };

//   return (
//     <aside className="filters-panel">
//       <div className="filters-header">
//         <span>Filters</span>
//         <button className="clear-all" onClick={() => { onChange({ type: "", lang: "", from: "", to: "", sort: "relevance" }); setDatePreset("Any time"); }}>
//           Clear All
//         </button>
//       </div>

//       <div className="filter-section">
//         <div className="filter-label">Publication Date</div>
//         {DATE_PRESETS.map(p => (
//           <label key={p} className="radio-row">
//             <input type="radio" name="date" checked={datePreset === p} onChange={() => setDatePreset(p)} />
//             <span>{p}</span>
//             {p === "Custom range" && <svg width="14" height="14" viewBox="0 0 14 14" stroke="currentColor" strokeWidth="1.2" fill="none"><rect x="1" y="2" width="12" height="11" rx="1.5"/><path d="M5 1v2M9 1v2M1 5h12"/></svg>}
//           </label>
//         ))}
//       </div>

//       <div className="filter-section">
//         <div className="filter-label">Topic</div>
//         {(showMore ? TYPES : TYPES.slice(0, 5)).map((t, i) => (
//           <label key={t} className="check-row">
//             <input type="checkbox" checked={filters.type === t} onChange={() => toggleType(t)} />
//             <span className="check-label">{t}</span>
//             <span className="check-count">{[46,32,28,18,12,8,5][i]}</span>
//           </label>
//         ))}
//         <button className="show-more" onClick={() => setShowMore(v => !v)}>
//           {showMore ? "Show less ∧" : "Show more ∨"}
//         </button>
//       </div>

//       <div className="filter-section">
//         <div className="filter-label">Language</div>
//         {LANGS.map(l => (
//           <label key={l.code} className="check-row">
//             <input type="checkbox" checked={filters.lang === l.code} onChange={() => onChange({ ...filters, lang: filters.lang === l.code ? "" : l.code })} />
//             <span>{l.label}</span>
//           </label>
//         ))}
//       </div>

//       <div className="filter-section">
//         <div className="filter-label">Source</div>
//         <div className="source-search-wrap">
//           <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2"><circle cx="5" cy="5" r="3.5"/><path d="M8.5 8.5L11 11" strokeLinecap="round"/></svg>
//           <input className="source-search" type="text" placeholder="Search sources..." />
//         </div>
//         {["The Guardian", "BBC News", "Financial Times", "The Independent"].map((s, i) => (
//           <label key={s} className="check-row">
//             <input type="checkbox" />
//             <span>{s}</span>
//             <span className="check-count">{[23,18,12,9][i]}</span>
//           </label>
//         ))}
//       </div>
//     </aside>
//   );
// }

// // ─────────────────────────────────────────────
// // components/ResultCard.jsx
// // ─────────────────────────────────────────────
// function ResultCard({ result }) {
//   const [expanded, setExpanded] = useState(false);
//   const SOURCE_ICONS = { "The Guardian": "G", "BBC News": "B", "Financial Times": "FT" };
//   const domain = result.url ? new URL(result.url).hostname.replace("www.", "") : "";
//   const sourceName = domain.includes("guardian") ? "The Guardian" : domain.includes("bbc") ? "BBC News" : domain.includes("ft") ? "Financial Times" : domain;

//   return (
//     <article className="result-card">
//       <div className="result-meta">
//         <div className="source-badge">
//           <span className="source-icon">{SOURCE_ICONS[sourceName]?.[0] || sourceName[0]}</span>
//           <span className="source-name">{sourceName}</span>
//         </div>
//         {result.type && <span className="type-tag">{result.type}</span>}
//       </div>
//       <h3 className="result-title">
//         <a href={result.url} target="_blank" rel="noopener noreferrer">{result.title}</a>
//       </h3>
//       <div className="result-date">{helpers.formatDate(result.pub)}</div>
//       <p className="result-sum">{result.sum}</p>
//       {expanded && <p className="result-body">{result.body}</p>}
//       <a href={result.url} className="result-url" target="_blank" rel="noopener noreferrer">{result.url}</a>
//       {result.body && (
//         <button className="expand-btn" onClick={() => setExpanded(v => !v)}>
//           {expanded ? "Show less" : "Show more"}
//         </button>
//       )}
//     </article>
//   );
// }

// // ─────────────────────────────────────────────
// // layouts/MainLayout.jsx
// // ─────────────────────────────────────────────
// function MainLayout({ children, mode, onNavigate, currentPage }) {
//   return (
//     <div className="layout-main">
//       <Navbar mode={mode} onNavigate={onNavigate} currentPage={currentPage} />
//       <main className="layout-content">{children}</main>
//     </div>
//   );
// }

// // ─────────────────────────────────────────────
// // layouts/AdminLayout.jsx
// // ─────────────────────────────────────────────
// const ADMIN_SECTIONS = [
//   { id: "overview", icon: "◈", label: "Overview" },
//   { id: "analytics", icon: "↗", label: "Query Analytics" },
//   { id: "logs", icon: "≡", label: "Logs" },
//   { id: "heatmaps", icon: "⊞", label: "Heatmaps" },
//   { id: "performance", icon: "⚡", label: "Performance" },
//   { id: "settings", icon: "⚙", label: "Settings" },
// ];

// function AdminLayout({ children, activeSection, onSectionChange, onNavigate }) {
//   const now = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
//   const [time, setTime] = useState(now);

//   useEffect(() => {
//     const t = setInterval(() => setTime(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })), 1000);
//     return () => clearInterval(t);
//   }, []);

//   return (
//     <div className="layout-admin">
//       <aside className="admin-sidebar">
//         <div className="sidebar-brand" onClick={() => onNavigate("admin")}>
//           <div className="brand-icon sm">
//             <svg width="18" height="18" viewBox="0 0 22 22" fill="none">
//               <circle cx="11" cy="11" r="10" stroke="#3B82F6" strokeWidth="1.5"/>
//               <circle cx="11" cy="11" r="6" stroke="#3B82F6" strokeWidth="1.5"/>
//               <circle cx="11" cy="11" r="2.5" fill="#3B82F6"/>
//             </svg>
//           </div>
//           <div>
//             <span className="brand-name sm">VELOCITY</span>
//             <span className="brand-sub">High QPS Search Engine</span>
//           </div>
//         </div>

//         <nav className="sidebar-nav">
//           {ADMIN_SECTIONS.map(s => (
//             <button key={s.id} className={`sidebar-item ${activeSection === s.id ? "active" : ""}`} onClick={() => onSectionChange(s.id)}>
//               <span className="sidebar-icon">{s.icon}</span>
//               <span>{s.label}</span>
//             </button>
//           ))}
//         </nav>

//         <div className="sidebar-footer">
//           <button className="sidebar-item exit" onClick={() => onNavigate("search")}>
//             <span className="sidebar-icon">←</span>
//             <span>Exit Admin</span>
//           </button>
//         </div>
//       </aside>

//       <div className="admin-body">
//         <header className="admin-topbar">
//           <h2 className="admin-title">Admin Dashboard</h2>
//           <div className="admin-topbar-right">
//             <span className="topbar-time">Last updated: {time}</span>
//             <button className="icon-btn" title="Refresh">⟳</button>
//             <div className="admin-avatar">A</div>
//           </div>
//         </header>
//         <div className="admin-content">{children}</div>
//       </div>
//     </div>
//   );
// }

// // ─────────────────────────────────────────────
// // pages/Login.jsx
// // ─────────────────────────────────────────────
// function Login({ onLogin }) {
//   const [mode, setMode] = useState(null); // null | "user" | "admin"
//   const [code, setCode] = useState("");
//   const [showCode, setShowCode] = useState(false);
//   const [error, setError] = useState("");
//   const [loading, setLoading] = useState(false);

//   const handleUserContinue = () => { onLogin("user"); };

//   const handleAdminSelect = () => {
//     setMode("admin");
//     setError("");
//     setCode("");
//   };

//   const handleAdminSubmit = async () => {
//     if (!code) { setError("Please enter the access code"); return; }
//     setLoading(true);
//     await new Promise(r => setTimeout(r, 600));
//     if (code === ADMIN_CODE) {
//       onLogin("admin");
//     } else {
//       setError("Invalid access code");
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="login-page">
//       <div className="login-bg">
//         {[...Array(20)].map((_, i) => <div key={i} className="bg-dot" style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, animationDelay: `${Math.random() * 4}s` }} />)}
//       </div>

//       <div className="login-card">
//         <div className="login-brand">
//           <div className="brand-icon lg">
//             <svg width="36" height="36" viewBox="0 0 22 22" fill="none">
//               <circle cx="11" cy="11" r="10" stroke="#3B82F6" strokeWidth="1.5"/>
//               <circle cx="11" cy="11" r="6" stroke="#3B82F6" strokeWidth="1.5"/>
//               <circle cx="11" cy="11" r="2.5" fill="#3B82F6"/>
//             </svg>
//           </div>
//           <div className="brand-name lg">VELOCITY</div>
//           <div className="brand-sub">High QPS Search Engine</div>
//         </div>

//         <h1 className="login-title">Welcome</h1>
//         <p className="login-sub">Choose how you want to continue</p>

//         <div className="mode-cards">
//           <div className={`mode-card ${mode === "user" ? "selected" : ""}`} onClick={() => setMode("user")}>
//             <div className="mode-icon blue">
//               <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
//                 <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35" strokeLinecap="round"/>
//               </svg>
//             </div>
//             <div className="mode-label">User</div>
//             <div className="mode-desc">Search the news and explore articles</div>
//             <button className="mode-btn blue" onClick={handleUserContinue}>Continue as User</button>
//           </div>

//           <div className={`mode-card ${mode === "admin" ? "selected" : ""}`} onClick={handleAdminSelect}>
//             <div className="mode-icon amber">
//               <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
//                 <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
//               </svg>
//             </div>
//             <div className="mode-label">Admin</div>
//             <div className="mode-desc">Access analytics, logs and system insights</div>
//             <button className="mode-btn amber" onClick={handleAdminSelect}>Continue as Admin</button>
//           </div>
//         </div>

//         {mode === "admin" && (
//           <div className="admin-auth">
//             <label className="auth-label">Admin access code</label>
//             <div className="auth-input-wrap">
//               <input
//                 type={showCode ? "text" : "password"}
//                 className={`auth-input ${error ? "has-error" : ""}`}
//                 placeholder="Enter access code..."
//                 value={code}
//                 onChange={e => { setCode(e.target.value); setError(""); }}
//                 onKeyDown={e => e.key === "Enter" && handleAdminSubmit()}
//                 autoFocus
//               />
//               <button className="eye-btn" onClick={() => setShowCode(v => !v)}>
//                 {showCode
//                   ? <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M2 8s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z"/><circle cx="8" cy="8" r="1.5"/><path d="M2 2l12 12" strokeLinecap="round"/></svg>
//                   : <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M2 8s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z"/><circle cx="8" cy="8" r="1.5"/></svg>
//                 }
//               </button>
//             </div>
//             {error && <div className="auth-error">{error}</div>}
//             <button className="submit-btn" onClick={handleAdminSubmit} disabled={loading}>
//               {loading ? <span className="spinner" /> : "Enter Dashboard"}
//             </button>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }

// // ─────────────────────────────────────────────
// // pages/Search.jsx
// // ─────────────────────────────────────────────
// function Search({ onNavigate }) {
//   const { query, setQuery, filters, setFilters, results, loading, error, meta, suggestions, setSuggestions, search, fetchSuggestions } = useSearch();
//   const [hasSearched, setHasSearched] = useState(false);
//   const [sort, setSort] = useState("relevance");
//   const [viewMode, setViewMode] = useState("list");

//   // Use mock data for demo
//   const displayResults = hasSearched ? MOCK_RESULTS : [];
//   const displayMeta = hasSearched ? { total: 12540, elapsed: "0.38" } : { total: 0, elapsed: 0 };
//   const displaySuggestions = query.length >= 2 ? MOCK_SUGGESTIONS : [];

//   const handleSearch = () => {
//     setHasSearched(true);
//   };

//   const handleSuggestion = (s) => {
//     setQuery(s);
//     setHasSearched(true);
//   };

//   return (
//     <div className="search-page">
//       <div className="search-hero">
//         <SearchBar
//           query={query}
//           onChange={(q) => { setQuery(q); }}
//           onSearch={handleSearch}
//           suggestions={displaySuggestions}
//           onSuggestionClick={handleSuggestion}
//           onClear={() => { setQuery(""); setHasSearched(false); }}
//         />
//       </div>

//       {hasSearched && (
//         <div className="search-body">
//           <Filters filters={filters} onChange={setFilters} />

//           <section className="results-area">
//             <div className="results-meta-bar">
//               <span className="results-count">About {displayMeta.total.toLocaleString()} results ({displayMeta.elapsed}s)</span>
//               <div className="results-controls">
//                 <label className="sort-label">Sort by:</label>
//                 <select className="sort-select" value={sort} onChange={e => setSort(e.target.value)}>
//                   <option value="relevance">Relevance</option>
//                   <option value="date">Date</option>
//                   <option value="popularity">Popularity</option>
//                 </select>
//                 <button className={`view-btn ${viewMode === "list" ? "active" : ""}`} onClick={() => setViewMode("list")}>
//                   <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect y="2" width="16" height="2" rx="1"/><rect y="7" width="16" height="2" rx="1"/><rect y="12" width="16" height="2" rx="1"/></svg>
//                 </button>
//                 <button className={`view-btn ${viewMode === "grid" ? "active" : ""}`} onClick={() => setViewMode("grid")}>
//                   <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect width="7" height="7" rx="1"/><rect x="9" width="7" height="7" rx="1"/><rect y="9" width="7" height="7" rx="1"/><rect x="9" y="9" width="7" height="7" rx="1"/></svg>
//                 </button>
//               </div>
//             </div>

//             <div className={`results-list ${viewMode === "grid" ? "grid" : ""}`}>
//               {displayResults.map((r, i) => <ResultCard key={i} result={r} />)}
//             </div>
//           </section>
//         </div>
//       )}

//       {!hasSearched && (
//         <div className="search-empty">
//           <div className="empty-icon">
//             <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="#3B82F6" strokeWidth="1.5" opacity="0.4">
//               <circle cx="22" cy="22" r="16"/><path d="M34 34l10 10" strokeLinecap="round"/>
//             </svg>
//           </div>
//           <p className="empty-text">Enter a search query to explore news articles</p>
//         </div>
//       )}
//     </div>
//   );
// }

// // ─────────────────────────────────────────────
// // pages/AdminDashboard.jsx — Phase 5 placeholder + Phase 6 prep
// // ─────────────────────────────────────────────
// function Sparkline({ data, color = "#3B82F6", height = 60 }) {
//   if (!data || data.length === 0) return null;
//   const max = Math.max(...data);
//   const min = Math.min(...data);
//   const range = max - min || 1;
//   const w = 300, h = height;
//   const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 10) - 5}`).join(" ");
//   return (
//     <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height }} preserveAspectRatio="none">
//       <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round"/>
//       <polyline points={`0,${h} ${pts} ${w},${h}`} fill={color} fillOpacity="0.08" strokeWidth="0"/>
//     </svg>
//   );
// }

// const QPS_DATA = [980, 1020, 1100, 1050, 990, 1080, 1150, 1200, 1180, 1247, 1190, 1210, 1247, 1230, 1247];
// const LAT_DATA = [120, 138, 145, 130, 155, 142, 138, 150, 142, 145, 140, 148, 142, 139, 142];

// const TOP_QUERIES = [
//   { q: "housing crisis uk", count: 12543, lat: 120 },
//   { q: "interest rates", count: 8921, lat: 98 },
//   { q: "inflation 2024", count: 6231, lat: 110 },
//   { q: "election results", count: 4567, lat: 130 },
//   { q: "energy prices", count: 3210, lat: 95 },
// ];

// const HEATMAP_DATA = (() => {
//   const hours = ["12 AM", "6 AM", "12 PM", "6 PM"];
//   const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
//   return hours.map(h => days.map(d => Math.floor(Math.random() * 100)));
// })();

// function HeatmapCell({ value }) {
//   const intensity = value / 100;
//   const r = Math.round(30 + intensity * 200);
//   const g = Math.round(80 - intensity * 60);
//   const b = Math.round(180 - intensity * 150);
//   return <div className="heatmap-cell" style={{ background: `rgb(${r},${g},${b})`, opacity: 0.3 + intensity * 0.7 }} title={`${value}%`} />;
// }

// function AdminDashboard({ activeSection }) {
//   const [qpsRange, setQpsRange] = useState("6h");

//   if (activeSection === "overview") {
//     return (
//       <div className="admin-overview">
//         <div className="stat-grid">
//           {[
//             { label: "QPS (Current)", value: "1,247", delta: "+12.5%", color: "blue" },
//             { label: "Avg. Latency", value: "142 ms", delta: "+8.3%", color: "amber" },
//             { label: "Throughput", value: "89.3k", delta: "+5.7%", color: "green" },
//             { label: "Error Rate", value: "0.21%", delta: "+0.02%", color: "red" },
//           ].map(s => (
//             <div key={s.label} className="stat-card">
//               <div className="stat-label">{s.label}</div>
//               <div className="stat-value">{s.value}</div>
//               <div className={`stat-delta ${s.color}`}>{s.delta}</div>
//             </div>
//           ))}
//         </div>

//         <div className="charts-row">
//           <div className="chart-card wide">
//             <div className="chart-header">
//               <span className="chart-title">QPS Over Time</span>
//               <select className="chart-select" value={qpsRange} onChange={e => setQpsRange(e.target.value)}>
//                 <option value="1h">Last 1 hour</option>
//                 <option value="6h">Last 6 hours</option>
//                 <option value="24h">Last 24 hours</option>
//               </select>
//             </div>
//             <div className="chart-axes">
//               <div className="y-labels">
//                 {["2k", "1.5k", "1k", "500", "0"].map(l => <span key={l}>{l}</span>)}
//               </div>
//               <div className="chart-area">
//                 <Sparkline data={QPS_DATA} color="#3B82F6" height={120} />
//                 <div className="x-labels">
//                   {["10:00","10:30","11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30"].map(t => <span key={t}>{t}</span>)}
//                 </div>
//               </div>
//             </div>
//           </div>

//           <div className="chart-card">
//             <div className="chart-header"><span className="chart-title">Top Queries</span></div>
//             <table className="query-table">
//               <thead><tr><th>Query</th><th>Count</th><th>Avg. Latency</th></tr></thead>
//               <tbody>
//                 {TOP_QUERIES.map(q => (
//                   <tr key={q.q}>
//                     <td className="q-cell">{q.q}</td>
//                     <td>{q.count.toLocaleString()}</td>
//                     <td>{q.lat} ms</td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           </div>
//         </div>

//         <div className="chart-card">
//           <div className="chart-header"><span className="chart-title">Query Volume Heatmap</span></div>
//           <div className="heatmap-wrap">
//             <div className="heatmap-days">
//               {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => <span key={d}>{d}</span>)}
//             </div>
//             {["12 AM","6 AM","12 PM","6 PM"].map((h, hi) => (
//               <div key={h} className="heatmap-row">
//                 <span className="heatmap-hour">{h}</span>
//                 {HEATMAP_DATA[hi].map((v, di) => <HeatmapCell key={di} value={v} />)}
//               </div>
//             ))}
//             <div className="heatmap-legend">
//               <span>Low</span>
//               <div className="legend-bar" />
//               <span>High</span>
//             </div>
//           </div>
//         </div>
//       </div>
//     );
//   }

//   if (activeSection === "analytics") {
//     return (
//       <div className="admin-section-placeholder">
//         <div className="placeholder-icon">↗</div>
//         <h3>Query Analytics</h3>
//         <p>Full query analytics with frequency distribution, slow query detection, and pattern analysis — Phase 6 implementation.</p>
//         <div className="placeholder-tags">
//           <span>BM25 Scoring</span><span>Slow Query Detection</span><span>Pattern Analysis</span><span>Export CSV/PDF</span>
//         </div>
//       </div>
//     );
//   }

//   if (activeSection === "logs") {
//     return (
//       <div className="admin-logs">
//         <div className="chart-header" style={{marginBottom: 16}}>
//           <span className="chart-title">Query Logs</span>
//           <button className="export-btn">Export CSV</button>
//         </div>
//         <table className="query-table full">
//           <thead><tr><th>Timestamp</th><th>Query</th><th>Latency</th><th>Results</th><th>Status</th></tr></thead>
//           <tbody>
//             {[...Array(8)].map((_, i) => (
//               <tr key={i}>
//                 <td className="mono">{new Date(Date.now() - i * 45000).toLocaleTimeString()}</td>
//                 <td className="q-cell">{TOP_QUERIES[i % 5].q}</td>
//                 <td>{Math.floor(90 + Math.random() * 80)} ms</td>
//                 <td>{Math.floor(1000 + Math.random() * 15000).toLocaleString()}</td>
//                 <td><span className={`status-badge ${i === 3 ? "warn" : "ok"}`}>{i === 3 ? "Slow" : "OK"}</span></td>
//               </tr>
//             ))}
//           </tbody>
//         </table>
//       </div>
//     );
//   }

//   if (activeSection === "heatmaps") {
//     return (
//       <div className="admin-section-placeholder">
//         <div className="placeholder-icon">⊞</div>
//         <h3>Heatmap Visualizations</h3>
//         <p>Interactive D3.js/Leaflet heatmaps for query frequency by time, topic, and geographic distribution — Phase 6 implementation.</p>
//         <div className="placeholder-tags">
//           <span>D3.js Heatmaps</span><span>Leaflet Maps</span><span>Time-series</span><span>Topic Distribution</span>
//         </div>
//       </div>
//     );
//   }

//   if (activeSection === "performance") {
//     return (
//       <div className="admin-overview">
//         <div className="stat-grid">
//           {[
//             { label: "Cluster Status", value: "Healthy", delta: "5/5 nodes", color: "green" },
//             { label: "Index Size", value: "1.2 TB", delta: "↑ 0.3GB today", color: "blue" },
//             { label: "Cache Hit Rate", value: "78.4%", delta: "+2.1%", color: "amber" },
//             { label: "Active Shards", value: "12", delta: "ZK: healthy", color: "green" },
//           ].map(s => (
//             <div key={s.label} className="stat-card">
//               <div className="stat-label">{s.label}</div>
//               <div className="stat-value">{s.value}</div>
//               <div className={`stat-delta ${s.color}`}>{s.delta}</div>
//             </div>
//           ))}
//         </div>
//         <div className="chart-card">
//           <div className="chart-header"><span className="chart-title">Latency Over Time</span></div>
//           <div className="chart-axes">
//             <div className="chart-area"><Sparkline data={LAT_DATA} color="#F59E0B" height={100} /></div>
//           </div>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="admin-section-placeholder">
//       <div className="placeholder-icon">⚙</div>
//       <h3>Settings</h3>
//       <p>System configuration, rate limits, authentication settings — Phase 6 implementation.</p>
//     </div>
//   );
// }

// // ─────────────────────────────────────────────
// // App.jsx — routing root
// // Routes: / → Login, /search → Search, /admin → AdminDashboard
// // ─────────────────────────────────────────────
// export default function App() {
//   // Simple in-memory router
//   const [page, setPage] = useState("login"); // login | search | admin
//   const [authMode, setAuthMode] = useState(null); // user | admin
//   const [adminSection, setAdminSection] = useState("overview");

//   const navigate = (target) => setPage(target);

//   const handleLogin = (mode) => {
//     setAuthMode(mode);
//     navigate(mode === "admin" ? "admin" : "search");
//   };

//   if (page === "login") {
//     return (
//       <>
//         <GlobalStyles />
//         <Login onLogin={handleLogin} />
//       </>
//     );
//   }

//   if (page === "search") {
//     return (
//       <>
//         <GlobalStyles />
//         <MainLayout mode={authMode} onNavigate={navigate} currentPage="search">
//           <Search onNavigate={navigate} />
//         </MainLayout>
//       </>
//     );
//   }

//   if (page === "admin") {
//     return (
//       <>
//         <GlobalStyles />
//         <AdminLayout activeSection={adminSection} onSectionChange={setAdminSection} onNavigate={navigate}>
//           <AdminDashboard activeSection={adminSection} />
//         </AdminLayout>
//       </>
//     );
//   }

//   return null;
// }

// // ─────────────────────────────────────────────
// // styles/global.css — ALL styles here
// // RESET / LAYOUT / COMPONENTS / PAGES
// // ─────────────────────────────────────────────
// function GlobalStyles() {
//   return (
//     <style>{`
//       /* RESET */
//       *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
//       button { cursor: pointer; background: none; border: none; font: inherit; color: inherit; }
//       input, select { font: inherit; }
//       a { text-decoration: none; }

//       /* LAYOUT */
//       :root {
//         --bg: #0D1117;
//         --bg2: #161B22;
//         --bg3: #1C2128;
//         --border: rgba(255,255,255,0.08);
//         --border2: rgba(255,255,255,0.14);
//         --text: #E6EDF3;
//         --text2: #8B949E;
//         --blue: #3B82F6;
//         --blue-dim: rgba(59,130,246,0.15);
//         --amber: #F59E0B;
//         --amber-dim: rgba(245,158,11,0.15);
//         --green: #10B981;
//         --green-dim: rgba(16,185,129,0.15);
//         --red: #EF4444;
//         --red-dim: rgba(239,68,68,0.12);
//         --font: 'IBM Plex Mono', 'JetBrains Mono', 'Fira Code', monospace;
//         --font-sans: 'DM Sans', 'Inter', system-ui, sans-serif;
//         --radius: 8px;
//         --radius-lg: 12px;
//       }

//       body, html { height: 100%; }
//       #root { height: 100%; font-family: var(--font-sans); background: var(--bg); color: var(--text); }

//       .layout-main { display: flex; flex-direction: column; min-height: 100vh; }
//       .layout-content { flex: 1; }

//       .layout-admin { display: flex; height: 100vh; overflow: hidden; }

//       /* COMPONENTS — Navbar */
//       .navbar {
//         display: flex; align-items: center; gap: 24px;
//         padding: 0 24px; height: 56px;
//         background: var(--bg2); border-bottom: 1px solid var(--border);
//         position: sticky; top: 0; z-index: 100;
//       }
//       .navbar-brand { display: flex; align-items: center; gap: 10px; cursor: pointer; }
//       .brand-icon { display: flex; align-items: center; justify-content: center; }
//       .brand-icon.sm { }
//       .brand-icon.lg { margin-bottom: 8px; }
//       .brand-name { display: block; font-family: var(--font); font-size: 14px; font-weight: 700; letter-spacing: 2px; color: var(--text); }
//       .brand-name.sm { font-size: 12px; }
//       .brand-name.lg { font-size: 22px; letter-spacing: 3px; }
//       .brand-sub { display: block; font-size: 10px; color: var(--text2); letter-spacing: 0.5px; }
//       .navbar-links { display: flex; gap: 4px; margin-left: auto; }
//       .nav-link { padding: 6px 16px; border-radius: var(--radius); color: var(--text2); font-size: 14px; transition: all 0.15s; }
//       .nav-link:hover { color: var(--text); background: var(--bg3); }
//       .nav-link.active { color: var(--text); border-bottom: 2px solid var(--blue); border-radius: 0; }
//       .nav-badge { font-size: 11px; background: var(--amber-dim); color: var(--amber); padding: 4px 10px; border-radius: 20px; border: 1px solid rgba(245,158,11,0.3); margin-left: auto; }
//       .navbar-actions { display: flex; align-items: center; gap: 8px; margin-left: auto; }
//       .icon-btn { padding: 6px; border-radius: var(--radius); color: var(--text2); display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
//       .icon-btn:hover { background: var(--bg3); color: var(--text); }
//       .admin-btn { display: flex; align-items: center; padding: 6px 14px; border-radius: var(--radius); border: 1px solid var(--border2); font-size: 13px; color: var(--text2); transition: all 0.15s; }
//       .admin-btn:hover { border-color: var(--blue); color: var(--blue); }

//       /* COMPONENTS — SearchBar */
//       .searchbar-wrap { position: relative; }
//       .searchbar { display: flex; align-items: center; gap: 0; background: var(--bg2); border: 1px solid var(--border2); border-radius: var(--radius-lg); overflow: hidden; transition: border-color 0.15s; }
//       .searchbar:focus-within { border-color: var(--blue); }
//       .search-icon { margin-left: 14px; color: var(--text2); flex-shrink: 0; }
//       .search-input { flex: 1; background: none; border: none; outline: none; padding: 14px 12px; color: var(--text); font-size: 15px; }
//       .search-input::placeholder { color: var(--text2); }
//       .clear-btn { padding: 8px; color: var(--text2); display: flex; align-items: center; }
//       .clear-btn:hover { color: var(--text); }
//       .search-btn { background: var(--blue); color: #fff; padding: 0 24px; height: 48px; font-size: 14px; font-weight: 600; transition: opacity 0.15s; flex-shrink: 0; }
//       .search-btn:hover { opacity: 0.88; }
//       .suggestions { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
//       .sug-label { font-size: 12px; color: var(--text2); }
//       .sug-chip { font-size: 12px; padding: 4px 12px; border-radius: 20px; border: 1px solid var(--border2); color: var(--text2); background: var(--bg2); transition: all 0.15s; }
//       .sug-chip:hover { border-color: var(--blue); color: var(--blue); }

//       /* COMPONENTS — Filters */
//       .filters-panel { width: 220px; flex-shrink: 0; border-right: 1px solid var(--border); padding: 20px 16px; overflow-y: auto; }
//       .filters-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; font-size: 14px; font-weight: 600; }
//       .clear-all { font-size: 12px; color: var(--blue); }
//       .clear-all:hover { text-decoration: underline; }
//       .filter-section { margin-bottom: 20px; border-bottom: 1px solid var(--border); padding-bottom: 20px; }
//       .filter-label { font-size: 11px; font-weight: 600; letter-spacing: 0.8px; text-transform: uppercase; color: var(--text2); margin-bottom: 10px; }
//       .radio-row, .check-row { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text2); padding: 4px 0; cursor: pointer; }
//       .radio-row:hover, .check-row:hover { color: var(--text); }
//       .radio-row input, .check-row input { accent-color: var(--blue); }
//       .check-label { flex: 1; }
//       .check-count { font-size: 11px; color: var(--text2); }
//       .show-more { font-size: 12px; color: var(--blue); margin-top: 6px; }
//       .show-more:hover { text-decoration: underline; }
//       .source-search-wrap { display: flex; align-items: center; gap: 6px; background: var(--bg3); border: 1px solid var(--border); border-radius: var(--radius); padding: 6px 10px; margin-bottom: 10px; }
//       .source-search { background: none; border: none; outline: none; font-size: 12px; color: var(--text); width: 100%; }
//       .source-search::placeholder { color: var(--text2); }

//       /* COMPONENTS — ResultCard */
//       .result-card { border-bottom: 1px solid var(--border); padding: 20px 0; }
//       .result-card:last-child { border-bottom: none; }
//       .result-meta { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
//       .source-badge { display: flex; align-items: center; gap: 6px; }
//       .source-icon { width: 22px; height: 22px; border-radius: 4px; background: var(--bg3); border: 1px solid var(--border2); display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; color: var(--text2); }
//       .source-name { font-size: 13px; color: var(--text2); }
//       .type-tag { font-size: 11px; padding: 2px 10px; border-radius: 20px; border: 1px solid var(--border2); background: var(--blue-dim); color: var(--blue); }
//       .result-title { font-size: 17px; font-weight: 600; margin-bottom: 4px; }
//       .result-title a { color: var(--blue); }
//       .result-title a:hover { text-decoration: underline; }
//       .result-date { font-size: 12px; color: var(--text2); margin-bottom: 8px; }
//       .result-sum { font-size: 14px; color: var(--text2); line-height: 1.6; margin-bottom: 8px; }
//       .result-body { font-size: 13px; color: var(--text2); line-height: 1.6; margin-bottom: 8px; border-left: 2px solid var(--blue); padding-left: 12px; }
//       .result-url { font-size: 12px; color: var(--green); display: block; margin-bottom: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
//       .expand-btn { font-size: 12px; color: var(--blue); }
//       .expand-btn:hover { text-decoration: underline; }

//       /* COMPONENTS — Admin Sidebar */
//       .admin-sidebar { width: 220px; flex-shrink: 0; background: var(--bg2); border-right: 1px solid var(--border); display: flex; flex-direction: column; }
//       .sidebar-brand { display: flex; align-items: center; gap: 10px; padding: 18px 16px; border-bottom: 1px solid var(--border); cursor: pointer; }
//       .sidebar-nav { flex: 1; padding: 12px 8px; overflow-y: auto; }
//       .sidebar-item { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: var(--radius); font-size: 13px; color: var(--text2); width: 100%; text-align: left; transition: all 0.12s; margin-bottom: 2px; }
//       .sidebar-item:hover { background: var(--bg3); color: var(--text); }
//       .sidebar-item.active { background: var(--blue-dim); color: var(--blue); }
//       .sidebar-item.exit { color: var(--text2); margin-top: 8px; }
//       .sidebar-icon { font-size: 14px; width: 20px; text-align: center; }
//       .sidebar-footer { padding: 12px 8px; border-top: 1px solid var(--border); }

//       /* COMPONENTS — Admin Topbar */
//       .admin-body { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
//       .admin-topbar { display: flex; align-items: center; justify-content: space-between; padding: 14px 24px; border-bottom: 1px solid var(--border); background: var(--bg2); }
//       .admin-title { font-size: 16px; font-weight: 600; }
//       .admin-topbar-right { display: flex; align-items: center; gap: 12px; }
//       .topbar-time { font-size: 12px; color: var(--text2); font-family: var(--font); }
//       .admin-avatar { width: 30px; height: 30px; border-radius: 50%; background: var(--blue-dim); border: 1px solid rgba(59,130,246,0.4); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: var(--blue); }
//       .admin-content { flex: 1; overflow-y: auto; padding: 24px; }

//       /* COMPONENTS — Admin Overview */
//       .admin-overview { display: flex; flex-direction: column; gap: 20px; }
//       .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
//       .stat-card { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 18px 20px; }
//       .stat-label { font-size: 12px; color: var(--text2); margin-bottom: 8px; }
//       .stat-value { font-size: 26px; font-weight: 700; font-family: var(--font); margin-bottom: 4px; }
//       .stat-delta { font-size: 12px; }
//       .stat-delta.blue { color: var(--blue); }
//       .stat-delta.amber { color: var(--amber); }
//       .stat-delta.green { color: var(--green); }
//       .stat-delta.red { color: var(--red); }
//       .charts-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
//       .chart-card { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 18px 20px; }
//       .chart-card.wide { }
//       .chart-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
//       .chart-title { font-size: 13px; font-weight: 600; }
//       .chart-select { background: var(--bg3); border: 1px solid var(--border2); border-radius: var(--radius); color: var(--text); padding: 4px 8px; font-size: 12px; }
//       .chart-axes { display: flex; gap: 8px; }
//       .y-labels { display: flex; flex-direction: column; justify-content: space-between; font-size: 11px; color: var(--text2); font-family: var(--font); padding-bottom: 20px; }
//       .chart-area { flex: 1; }
//       .x-labels { display: flex; justify-content: space-between; font-size: 10px; color: var(--text2); font-family: var(--font); margin-top: 4px; }
//       .query-table { width: 100%; border-collapse: collapse; font-size: 13px; }
//       .query-table th { font-size: 11px; color: var(--text2); text-align: left; padding: 0 0 10px; font-weight: 500; border-bottom: 1px solid var(--border); }
//       .query-table td { padding: 8px 0; border-bottom: 1px solid var(--border); color: var(--text2); }
//       .query-table.full td, .query-table.full th { padding: 8px 12px; }
//       .q-cell { color: var(--text); font-family: var(--font); font-size: 12px; }
//       .mono { font-family: var(--font); font-size: 12px; }
//       .status-badge { font-size: 11px; padding: 2px 8px; border-radius: 20px; }
//       .status-badge.ok { background: var(--green-dim); color: var(--green); }
//       .status-badge.warn { background: var(--amber-dim); color: var(--amber); }
//       .export-btn { font-size: 12px; padding: 5px 12px; border: 1px solid var(--border2); border-radius: var(--radius); color: var(--text2); }
//       .export-btn:hover { border-color: var(--blue); color: var(--blue); }
//       .admin-logs { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 18px 20px; }

//       /* COMPONENTS — Heatmap */
//       .heatmap-wrap { display: flex; flex-direction: column; gap: 4px; }
//       .heatmap-days { display: flex; gap: 4px; padding-left: 52px; margin-bottom: 2px; }
//       .heatmap-days span { flex: 1; text-align: center; font-size: 11px; color: var(--text2); }
//       .heatmap-row { display: flex; align-items: center; gap: 4px; }
//       .heatmap-hour { width: 48px; font-size: 11px; color: var(--text2); flex-shrink: 0; }
//       .heatmap-cell { flex: 1; height: 28px; border-radius: 3px; cursor: pointer; transition: opacity 0.15s; }
//       .heatmap-cell:hover { opacity: 1 !important; outline: 1px solid rgba(255,255,255,0.3); }
//       .heatmap-legend { display: flex; align-items: center; gap: 8px; margin-top: 8px; padding-left: 52px; font-size: 11px; color: var(--text2); }
//       .legend-bar { flex: 1; height: 8px; border-radius: 4px; background: linear-gradient(to right, rgb(30,80,180), rgb(230,60,30)); max-width: 200px; }

//       /* COMPONENTS — Placeholder */
//       .admin-section-placeholder { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 60px 24px; background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-lg); min-height: 300px; }
//       .placeholder-icon { font-size: 36px; margin-bottom: 16px; opacity: 0.3; }
//       .admin-section-placeholder h3 { font-size: 18px; margin-bottom: 8px; }
//       .admin-section-placeholder p { font-size: 14px; color: var(--text2); max-width: 400px; line-height: 1.6; }
//       .placeholder-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 20px; justify-content: center; }
//       .placeholder-tags span { font-size: 12px; padding: 4px 12px; border-radius: 20px; border: 1px solid var(--border2); color: var(--text2); }

//       /* PAGES — Login */
//       .login-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--bg); position: relative; overflow: hidden; }
//       .login-bg { position: absolute; inset: 0; pointer-events: none; }
//       .bg-dot { position: absolute; width: 2px; height: 2px; border-radius: 50%; background: var(--blue); opacity: 0.2; animation: pulse 4s ease-in-out infinite; }
//       @keyframes pulse { 0%, 100% { opacity: 0.1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(2); } }
//       .login-card { background: var(--bg2); border: 1px solid var(--border2); border-radius: 20px; padding: 40px; width: 100%; max-width: 520px; position: relative; z-index: 1; }
//       .login-brand { display: flex; flex-direction: column; align-items: center; margin-bottom: 28px; }
//       .login-title { font-size: 26px; font-weight: 700; text-align: center; margin-bottom: 8px; }
//       .login-sub { font-size: 14px; color: var(--text2); text-align: center; margin-bottom: 28px; }
//       .mode-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
//       .mode-card { background: var(--bg3); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 24px 16px; text-align: center; cursor: pointer; transition: border-color 0.15s; }
//       .mode-card.selected { border-color: var(--blue); }
//       .mode-card:hover { border-color: var(--border2); }
//       .mode-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; }
//       .mode-icon.blue { background: var(--blue-dim); color: var(--blue); }
//       .mode-icon.amber { background: var(--amber-dim); color: var(--amber); }
//       .mode-label { font-size: 16px; font-weight: 700; margin-bottom: 6px; }
//       .mode-desc { font-size: 12px; color: var(--text2); line-height: 1.5; margin-bottom: 16px; }
//       .mode-btn { width: 100%; padding: 10px; border-radius: var(--radius); font-size: 13px; font-weight: 600; transition: opacity 0.15s; }
//       .mode-btn.blue { background: var(--blue); color: #fff; }
//       .mode-btn.amber { background: var(--amber); color: #000; }
//       .mode-btn:hover { opacity: 0.88; }
//       .admin-auth { display: flex; flex-direction: column; gap: 10px; }
//       .auth-label { font-size: 12px; color: var(--text2); text-align: center; }
//       .auth-input-wrap { position: relative; }
//       .auth-input { width: 100%; background: var(--bg3); border: 1px solid var(--border2); border-radius: var(--radius); padding: 12px 40px 12px 14px; color: var(--text); font-size: 14px; outline: none; transition: border-color 0.15s; }
//       .auth-input:focus { border-color: var(--blue); }
//       .auth-input.has-error { border-color: var(--red); }
//       .eye-btn { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); color: var(--text2); display: flex; }
//       .auth-error { font-size: 12px; color: var(--red); text-align: center; }
//       .submit-btn { background: var(--blue); color: #fff; padding: 13px; border-radius: var(--radius); font-size: 14px; font-weight: 600; width: 100%; display: flex; align-items: center; justify-content: center; transition: opacity 0.15s; }
//       .submit-btn:hover:not(:disabled) { opacity: 0.88; }
//       .submit-btn:disabled { opacity: 0.6; }
//       .spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.6s linear infinite; }
//       @keyframes spin { to { transform: rotate(360deg); } }

//       /* PAGES — Search */
//       .search-page { display: flex; flex-direction: column; height: calc(100vh - 56px); }
//       .search-hero { padding: 28px 32px 0; }
//       .search-body { display: flex; flex: 1; overflow: hidden; }
//       .results-area { flex: 1; overflow-y: auto; padding: 20px 28px; }
//       .results-meta-bar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 8px; }
//       .results-count { font-size: 13px; color: var(--text2); }
//       .results-controls { display: flex; align-items: center; gap: 8px; }
//       .sort-label { font-size: 13px; color: var(--text2); }
//       .sort-select { background: var(--bg2); border: 1px solid var(--border2); border-radius: var(--radius); color: var(--text); padding: 5px 10px; font-size: 13px; }
//       .view-btn { padding: 6px 8px; border-radius: var(--radius); color: var(--text2); display: flex; align-items: center; transition: all 0.12s; }
//       .view-btn:hover { background: var(--bg3); color: var(--text); }
//       .view-btn.active { background: var(--blue-dim); color: var(--blue); }
//       .results-list.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
//       .search-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; }
//       .empty-icon { opacity: 0.4; }
//       .empty-text { font-size: 14px; color: var(--text2); }

//       /* Scrollbar */
//       ::-webkit-scrollbar { width: 6px; height: 6px; }
//       ::-webkit-scrollbar-track { background: transparent; }
//       ::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 3px; }
//     `}</style>
//   );
// }

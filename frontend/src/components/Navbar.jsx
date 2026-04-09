import { useState } from "react";

export default function Navbar({ mode, onNavigate, currentPage }) {
  const [theme, setTheme] = useState("dark");

  return (
    <nav className="navbar">
      <div className="navbar-brand" onClick={() => onNavigate(mode === "admin" ? "admin" : "dashboard")}>
        <div className="brand-icon">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <circle cx="11" cy="11" r="10" stroke="#3B82F6" strokeWidth="1.5"/>
            <circle cx="11" cy="11" r="6" stroke="#3B82F6" strokeWidth="1.5"/>
            <circle cx="11" cy="11" r="2.5" fill="#3B82F6"/>
          </svg>
        </div>
        <div>
          <span className="brand-name">VELOCITY</span>
          <span className="brand-sub">High QPS Search Engine</span>
        </div>
      </div>

      {mode === "user" && (
        <div className="navbar-links">
          <button className={`nav-link ${currentPage === "dashboard" ? "active" : ""}`} onClick={() => onNavigate("dashboard")}>Dashboard</button>
          <button className={`nav-link ${currentPage === "search" ? "active" : ""}`} onClick={() => onNavigate("search")}>Search</button>
          <button className="nav-link">About</button>
        </div>
      )}

      {mode === "admin" && (
        <div className="navbar-links">
          <span className="nav-badge">Admin Mode</span>
        </div>
      )}

      <div className="navbar-actions">
        <button className="icon-btn" onClick={() => setTheme(t => t === "dark" ? "light" : "dark")} title="Toggle theme">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="8" cy="8" r="3.5"/>
            <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M3.05 12.95l1.06-1.06M11.89 4.11l1.06-1.06" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
        </button>
        <button className="admin-btn" onClick={() => onNavigate(mode === "admin" ? "search" : "login")}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" style={{marginRight: 6}}>
            <path d="M7 7a3 3 0 100-6 3 3 0 000 6zM2 12c0-2.76 2.24-5 5-5s5 2.24 5 5"/>
          </svg>
          {mode === "admin" ? "Exit Admin" : "Admin"}
        </button>
      </div>
    </nav>
  );
}
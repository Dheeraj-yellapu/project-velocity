import { useNavigate, useLocation } from "react-router-dom";

export default function Navbar({ mode, currentPage }) {
  const navigate = useNavigate();
  const location = useLocation();

  const activePage = currentPage || (location.pathname.includes("/search") ? "search" : "dashboard");

  return (
    <nav className="navbar">
      <div className="navbar-brand" onClick={() => navigate(mode === "admin" ? "/admin" : "/user")}>
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
          <button className={`nav-link ${activePage === "dashboard" ? "active" : ""}`} onClick={() => navigate("/user")}>Dashboard</button>
          <button className={`nav-link ${activePage === "search" ? "active" : ""}`} onClick={() => navigate("/user/search")}>Search</button>
        </div>
      )}

      {mode === "admin" && (
        <div className="navbar-links">
          <span className="nav-badge">Admin Mode</span>
        </div>
      )}

      <div className="navbar-actions">
        <button className="admin-btn" onClick={() => navigate(mode === "admin" ? "/user" : "/admin")}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" style={{marginRight: 6}}>
            <path d="M7 7a3 3 0 100-6 3 3 0 000 6zM2 12c0-2.76 2.24-5 5-5s5 2.24 5 5"/>
          </svg>
          {mode === "admin" ? "Switch to Search" : "Admin"}
        </button>
      </div>
    </nav>
  );
}
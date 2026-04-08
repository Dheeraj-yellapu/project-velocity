import { useState, useEffect } from "react";

const ADMIN_SECTIONS = [
  { id: "overview", icon: "◈", label: "Overview" },
  { id: "analytics", icon: "↗", label: "Query Analytics" },
  { id: "logs", icon: "≡", label: "Logs" },
  { id: "heatmaps", icon: "⊞", label: "Heatmaps" },
  { id: "performance", icon: "⚡", label: "Performance" },
  { id: "settings", icon: "⚙", label: "Settings" },
];

export default function AdminLayout({ children, activeSection, onSectionChange, onNavigate }) {
  const now = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const [time, setTime] = useState(now);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="layout-admin">
      <aside className="admin-sidebar">
        <div className="sidebar-brand" onClick={() => onNavigate("admin")}>
          <div className="brand-icon sm">
            <svg width="18" height="18" viewBox="0 0 22 22" fill="none">
              <circle cx="11" cy="11" r="10" stroke="#3B82F6" strokeWidth="1.5"/>
              <circle cx="11" cy="11" r="6" stroke="#3B82F6" strokeWidth="1.5"/>
              <circle cx="11" cy="11" r="2.5" fill="#3B82F6"/>
            </svg>
          </div>
          <div>
            <span className="brand-name sm">VELOCITY</span>
            <span className="brand-sub">High QPS Search Engine</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {ADMIN_SECTIONS.map(s => (
            <button key={s.id} className={`sidebar-item ${activeSection === s.id ? "active" : ""}`} onClick={() => onSectionChange(s.id)}>
              <span className="sidebar-icon">{s.icon}</span>
              <span>{s.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="sidebar-item exit" onClick={() => onNavigate("search")}>
            <span className="sidebar-icon">←</span>
            <span>Exit Admin</span>
          </button>
        </div>
      </aside>

      <div className="admin-body">
        <header className="admin-topbar">
          <h2 className="admin-title">Admin Dashboard</h2>
          <div className="admin-topbar-right">
            <span className="topbar-time">Last updated: {time}</span>
            <button className="icon-btn" title="Refresh">⟳</button>
            <div className="admin-avatar">A</div>
          </div>
        </header>
        <div className="admin-content">{children}</div>
      </div>
    </div>
  );
}
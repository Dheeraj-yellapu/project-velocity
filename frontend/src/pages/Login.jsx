import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState(null); // null | "user" | "admin"
  const [code, setCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleUserContinue = () => { navigate("/user"); };

  const handleAdminSelect = () => {
    setMode("admin");
    setError("");
    setCode("");
  };

  const handleAdminSubmit = async () => {
    if (!code) { setError("Please enter the access code"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/settings/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload.error || "Invalid access code");
        setLoading(false);
        return;
      }

      navigate("/admin");
    } catch (_err) {
      setError("Unable to verify access code right now");
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg">
        {[...Array(20)].map((_, i) => <div key={i} className="bg-dot" style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, animationDelay: `${Math.random() * 4}s` }} />)}
      </div>

      <div className="login-card">
        <div className="login-brand">
          <div className="brand-icon lg">
            <svg width="36" height="36" viewBox="0 0 22 22" fill="none">
              <circle cx="11" cy="11" r="10" stroke="#3B82F6" strokeWidth="1.5"/>
              <circle cx="11" cy="11" r="6" stroke="#3B82F6" strokeWidth="1.5"/>
              <circle cx="11" cy="11" r="2.5" fill="#3B82F6"/>
            </svg>
          </div>
          <div className="brand-name lg">VELOCITY</div>
          <div className="brand-sub">High QPS Search Engine</div>
        </div>

        <h1 className="login-title">Welcome</h1>
        <p className="login-sub">Choose how you want to continue</p>

        <div className="mode-cards">
          <div className={`mode-card ${mode === "user" ? "selected" : ""}`} onClick={() => setMode("user")}>
            <div className="mode-icon blue">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="mode-label">User</div>
            <div className="mode-desc">Search the news and explore articles</div>
            <button className="mode-btn blue" onClick={handleUserContinue}>Continue as User</button>
          </div>

          <div className={`mode-card ${mode === "admin" ? "selected" : ""}`} onClick={handleAdminSelect}>
            <div className="mode-icon amber">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <div className="mode-label">Admin</div>
            <div className="mode-desc">Access analytics, logs and system insights</div>
            <button className="mode-btn amber" onClick={handleAdminSelect}>Continue as Admin</button>
          </div>
        </div>

        {mode === "admin" && (
          <div className="admin-auth">
            <label className="auth-label">Admin access code</label>
            <div className="auth-input-wrap">
              <input
                type={showCode ? "text" : "password"}
                className={`auth-input ${error ? "has-error" : ""}`}
                placeholder="Enter access code..."
                value={code}
                onChange={e => { setCode(e.target.value); setError(""); }}
                onKeyDown={e => e.key === "Enter" && handleAdminSubmit()}
                autoFocus
              />
              <button className="eye-btn" onClick={() => setShowCode(v => !v)}>
                {showCode
                  ? <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M2 8s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z"/><circle cx="8" cy="8" r="1.5"/><path d="M2 2l12 12" strokeLinecap="round"/></svg>
                  : <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M2 8s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z"/><circle cx="8" cy="8" r="1.5"/></svg>
                }
              </button>
            </div>
            {error && <div className="auth-error">{error}</div>}
            <button className="submit-btn" onClick={handleAdminSubmit} disabled={loading}>
              {loading ? <span className="spinner" /> : "Enter Dashboard"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
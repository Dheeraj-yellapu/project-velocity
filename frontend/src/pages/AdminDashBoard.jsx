import { useState } from "react";

function Sparkline({ data, color = "#3B82F6", height = 60 }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 300, h = height;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 10) - 5}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height }} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round"/>
      <polyline points={`0,${h} ${pts} ${w},${h}`} fill={color} fillOpacity="0.08" strokeWidth="0"/>
    </svg>
  );
}

const QPS_DATA = [980, 1020, 1100, 1050, 990, 1080, 1150, 1200, 1180, 1247, 1190, 1210, 1247, 1230, 1247];
const LAT_DATA = [120, 138, 145, 130, 155, 142, 138, 150, 142, 145, 140, 148, 142, 139, 142];

const TOP_QUERIES = [
  { q: "housing crisis uk", count: 12543, lat: 120 },
  { q: "interest rates", count: 8921, lat: 98 },
  { q: "inflation 2024", count: 6231, lat: 110 },
  { q: "election results", count: 4567, lat: 130 },
  { q: "energy prices", count: 3210, lat: 95 },
];

const HEATMAP_DATA = (() => {
  const hours = ["12 AM", "6 AM", "12 PM", "6 PM"];
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return hours.map(h => days.map(d => Math.floor(Math.random() * 100)));
})();

function HeatmapCell({ value }) {
  const intensity = value / 100;
  const r = Math.round(30 + intensity * 200);
  const g = Math.round(80 - intensity * 60);
  const b = Math.round(180 - intensity * 150);
  return <div className="heatmap-cell" style={{ background: `rgb(${r},${g},${b})`, opacity: 0.3 + intensity * 0.7 }} title={`${value}%`} />;
}

export default function AdminDashboard({ activeSection }) {
  const [qpsRange, setQpsRange] = useState("6h");

  if (activeSection === "overview") {
    return (
      <div className="admin-overview">
        <div className="stat-grid">
          {[
            { label: "QPS (Current)", value: "1,247", delta: "+12.5%", color: "blue" },
            { label: "Avg. Latency", value: "142 ms", delta: "+8.3%", color: "amber" },
            { label: "Throughput", value: "89.3k", delta: "+5.7%", color: "green" },
            { label: "Error Rate", value: "0.21%", delta: "+0.02%", color: "red" },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div className="stat-label">{s.label}</div>
              <div className="stat-value">{s.value}</div>
              <div className={`stat-delta ${s.color}`}>{s.delta}</div>
            </div>
          ))}
        </div>

        <div className="charts-row">
          <div className="chart-card wide">
            <div className="chart-header">
              <span className="chart-title">QPS Over Time</span>
              <select className="chart-select" value={qpsRange} onChange={e => setQpsRange(e.target.value)}>
                <option value="1h">Last 1 hour</option>
                <option value="6h">Last 6 hours</option>
                <option value="24h">Last 24 hours</option>
              </select>
            </div>
            <div className="chart-axes">
              <div className="y-labels">
                {["2k", "1.5k", "1k", "500", "0"].map(l => <span key={l}>{l}</span>)}
              </div>
              <div className="chart-area">
                <Sparkline data={QPS_DATA} color="#3B82F6" height={120} />
                <div className="x-labels">
                  {["10:00","10:30","11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30"].map(t => <span key={t}>{t}</span>)}
                </div>
              </div>
            </div>
          </div>

          <div className="chart-card">
            <div className="chart-header"><span className="chart-title">Top Queries</span></div>
            <table className="query-table">
              <thead><tr><th>Query</th><th>Count</th><th>Avg. Latency</th></tr></thead>
              <tbody>
                {TOP_QUERIES.map(q => (
                  <tr key={q.q}>
                    <td className="q-cell">{q.q}</td>
                    <td>{q.count.toLocaleString()}</td>
                    <td>{q.lat} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-header"><span className="chart-title">Query Volume Heatmap</span></div>
          <div className="heatmap-wrap">
            <div className="heatmap-days">
              {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => <span key={d}>{d}</span>)}
            </div>
            {["12 AM","6 AM","12 PM","6 PM"].map((h, hi) => (
              <div key={h} className="heatmap-row">
                <span className="heatmap-hour">{h}</span>
                {HEATMAP_DATA[hi].map((v, di) => <HeatmapCell key={di} value={v} />)}
              </div>
            ))}
            <div className="heatmap-legend">
              <span>Low</span>
              <div className="legend-bar" />
              <span>High</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (activeSection === "analytics") {
    return (
      <div className="admin-section-placeholder">
        <div className="placeholder-icon">↗</div>
        <h3>Query Analytics</h3>
        <p>Full query analytics with frequency distribution, slow query detection, and pattern analysis — Phase 6 implementation.</p>
        <div className="placeholder-tags">
          <span>BM25 Scoring</span><span>Slow Query Detection</span><span>Pattern Analysis</span><span>Export CSV/PDF</span>
        </div>
      </div>
    );
  }

  if (activeSection === "logs") {
    return (
      <div className="admin-logs">
        <div className="chart-header" style={{marginBottom: 16}}>
          <span className="chart-title">Query Logs</span>
          <button className="export-btn">Export CSV</button>
        </div>
        <table className="query-table full">
          <thead><tr><th>Timestamp</th><th>Query</th><th>Latency</th><th>Results</th><th>Status</th></tr></thead>
          <tbody>
            {[...Array(8)].map((_, i) => (
              <tr key={i}>
                <td className="mono">{new Date(Date.now() - i * 45000).toLocaleTimeString()}</td>
                <td className="q-cell">{TOP_QUERIES[i % 5].q}</td>
                <td>{Math.floor(90 + Math.random() * 80)} ms</td>
                <td>{Math.floor(1000 + Math.random() * 15000).toLocaleString()}</td>
                <td><span className={`status-badge ${i === 3 ? "warn" : "ok"}`}>{i === 3 ? "Slow" : "OK"}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (activeSection === "heatmaps") {
    return (
      <div className="admin-section-placeholder">
        <div className="placeholder-icon">⊞</div>
        <h3>Heatmap Visualizations</h3>
        <p>Interactive D3.js/Leaflet heatmaps for query frequency by time, topic, and geographic distribution — Phase 6 implementation.</p>
        <div className="placeholder-tags">
          <span>D3.js Heatmaps</span><span>Leaflet Maps</span><span>Time-series</span><span>Topic Distribution</span>
        </div>
      </div>
    );
  }

  if (activeSection === "performance") {
    return (
      <div className="admin-overview">
        <div className="stat-grid">
          {[
            { label: "Cluster Status", value: "Healthy", delta: "5/5 nodes", color: "green" },
            { label: "Index Size", value: "1.2 TB", delta: "↑ 0.3GB today", color: "blue" },
            { label: "Cache Hit Rate", value: "78.4%", delta: "+2.1%", color: "amber" },
            { label: "Active Shards", value: "12", delta: "ZK: healthy", color: "green" },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div className="stat-label">{s.label}</div>
              <div className="stat-value">{s.value}</div>
              <div className={`stat-delta ${s.color}`}>{s.delta}</div>
            </div>
          ))}
        </div>
        <div className="chart-card">
          <div className="chart-header"><span className="chart-title">Latency Over Time</span></div>
          <div className="chart-axes">
            <div className="chart-area"><Sparkline data={LAT_DATA} color="#F59E0B" height={100} /></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-section-placeholder">
      <div className="placeholder-icon">⚙</div>
      <h3>Settings</h3>
      <p>System configuration, rate limits, authentication settings — Phase 6 implementation.</p>
    </div>
  );
}
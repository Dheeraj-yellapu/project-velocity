import { useState, useEffect } from "react";

function Sparkline({ data, color = "#3B82F6", height = 60 }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 300, h = height;
  const pts = data.map((v, i) => `${(i / (data.length - 1 || 1)) * w},${h - ((v - min) / range) * (h - 10) - 5}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height }} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round"/>
      <polyline points={`0,${h} ${pts} ${w},${h}`} fill={color} fillOpacity="0.08" strokeWidth="0"/>
    </svg>
  );
}

function HeatmapCell({ value }) {
  const intensity = value / 100;
  const r = Math.round(30 + intensity * 200);
  const g = Math.round(80 - intensity * 60);
  const b = Math.round(180 - intensity * 150);
  return <div className="heatmap-cell" style={{ background: `rgb(${r},${g},${b})`, opacity: 0.3 + intensity * 0.7 }} title={`${value}%`} />;
}

export default function AdminDashboard({ activeSection }) {
  const [qpsRange, setQpsRange] = useState("1h");
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await fetch(`/api/analytics?range=${qpsRange}`);
        const data = await res.json();
        setAnalytics(data);
      } catch (err) {
        console.error("Failed to load analytics", err);
      }
    };
    
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 3000); // refresh every 3 seconds
    return () => clearInterval(interval);
  }, [qpsRange]);

  if (!analytics) {
    return <div className="admin-overview" style={{ padding: 40, textAlign: 'center', opacity: 0.7 }}>Loading Live Analytics...</div>;
  }

  const { stats, charts, topQueries, heatmapData, logs } = analytics;

  if (activeSection === "overview") {
    return (
      <div className="admin-overview">
        <div className="stat-grid">
          {[
            { label: "QPS (Current)", value: stats.qpsText, delta: "Live", color: "blue" },
            { label: "Avg. Latency", value: stats.latencyText, delta: "Live", color: "amber" },
            { label: "Throughput", value: stats.throughputText, delta: "Total in range", color: "green" },
            { label: "Error Rate", value: stats.errorRateText, delta: "Live", color: "red" },
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
                {/* Dynamically adjust y labels? Keeping static layout for simplicity */}
                {["High", "", "Mid", "", "Low"].map((l, i) => <span key={i}>{l}</span>)}
              </div>
              <div className="chart-area">
                <Sparkline data={charts.qpsData} color="#3B82F6" height={120} />
                <div className="x-labels">
                  <span>Start of Range</span>
                  <span></span>
                  <span>Now</span>
                </div>
              </div>
            </div>
          </div>

          <div className="chart-card">
            <div className="chart-header"><span className="chart-title">Top Queries</span></div>
            <table className="query-table">
              <thead><tr><th>Query</th><th>Count</th><th>Avg. Latency</th></tr></thead>
              <tbody>
                {topQueries.length > 0 ? topQueries.map(q => (
                  <tr key={q.q}>
                    <td className="q-cell">{q.q}</td>
                    <td>{q.count.toLocaleString()}</td>
                    <td>{q.lat} ms</td>
                  </tr>
                )) : <tr><td colSpan="3" style={{textAlign:"center", padding:20, opacity:0.5}}>No queries yet</td></tr>}
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
                {heatmapData[hi].map((v, di) => <HeatmapCell key={di} value={v} />)}
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
    const { fast, medium, slow } = analytics.queryAnalytics?.latencyDistribution || { fast:0, medium:0, slow:0 };
    const total = (fast + medium + slow) || 1;
    const fastPct = ((fast/total)*100).toFixed(1);
    const medPct = ((medium/total)*100).toFixed(1);
    const slowPct = ((slow/total)*100).toFixed(1);

    return (
      <div className="admin-overview">
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-label">Fast Queries (&lt;50ms)</div>
            <div className="stat-value" style={{color: 'rgb(22, 163, 74)'}}>{fastPct}%</div>
            <div className="stat-delta">{fast} queries</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Medium Queries (&lt;200ms)</div>
            <div className="stat-value" style={{color: 'rgb(245, 158, 11)'}}>{medPct}%</div>
            <div className="stat-delta">{medium} queries</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Slow Queries (&ge;200ms)</div>
            <div className="stat-value" style={{color: 'rgb(220, 38, 38)'}}>{slowPct}%</div>
            <div className="stat-delta">{slow} queries</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Cache Solr Bypass</div>
            <div className="stat-value">{stats.cacheHitRateText}</div>
            <div className="stat-delta blue">Overall Hit Ratio</div>
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-header"><span className="chart-title">Top 5 Slowest Queries</span></div>
          <table className="query-table full">
            <thead><tr><th>Timestamp</th><th>Query</th><th>Latency</th><th>Source</th></tr></thead>
            <tbody>
              {analytics.queryAnalytics?.slowQueries.length > 0 ? analytics.queryAnalytics.slowQueries.map((q, i) => (
                <tr key={i}>
                  <td className="mono">{new Date(q.timestamp).toLocaleTimeString()}</td>
                  <td className="q-cell">{q.query}</td>
                  <td><span style={{color: 'rgb(220, 38, 38)', fontWeight: 'bold'}}>{q.latency} ms</span></td>
                  <td>{q.source === "cache" ? "Hit" : "Miss (Solr)"}</td>
                </tr>
              )) : <tr><td colSpan="4" style={{textAlign:"center", padding:20, opacity:0.5}}>No queries yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (activeSection === "logs") {
    return (
      <div className="admin-logs">
        <div className="chart-header" style={{marginBottom: 16}}>
          <span className="chart-title">Live Query Logs ({logs.length})</span>
          <button className="export-btn">Refresh</button>
        </div>
        <table className="query-table full">
          <thead><tr><th>Timestamp</th><th>Query</th><th>Latency</th><th>Results</th><th>Cache</th><th>Status</th></tr></thead>
          <tbody>
            {logs.length > 0 ? logs.map((log, i) => (
              <tr key={i}>
                <td className="mono">{new Date(log.timestamp).toLocaleTimeString()}</td>
                <td className="q-cell">{log.query}</td>
                <td>{log.latency} ms</td>
                <td>{log.results.toLocaleString()}</td>
                <td>{log.source === "cache" ? "Hit" : "Miss"}</td>
                <td><span className={`status-badge ${log.status === 'error' ? 'warn' : (log.latency > 500 ? 'warn' : 'ok')}`}>
                  {log.status === 'error' ? 'Error' : (log.latency > 500 ? 'Slow' : 'OK')}
                </span></td>
              </tr>
            )) : <tr><td colSpan="6" style={{textAlign:"center", padding:40, opacity:0.5}}>No recent logs to display</td></tr>}
          </tbody>
        </table>
      </div>
    );
  }

  if (activeSection === "heatmaps") {
    // calculate busiest day and time
    let maxV = 0; let mHi = 0; let mDi = 0;
    heatmapData.forEach((row, hi) => {
      row.forEach((v, di) => {
        if (v > maxV) { maxV = v; mHi = hi; mDi = di; }
      });
    });
    const days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
    const hours = ["12 AM - 6 AM","6 AM - 12 PM","12 PM - 6 PM","6 PM - 12 AM"];

    return (
      <div className="admin-overview">
        <div className="stat-grid" style={{gridTemplateColumns: '1fr 1fr'}}>
          <div className="stat-card">
            <div className="stat-label">Busiest Time of Day</div>
            <div className="stat-value">{maxV > 0 ? hours[mHi] : "N/A"}</div>
            <div className="stat-delta blue">Peak traffic window</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Busiest Day of Week</div>
            <div className="stat-value">{maxV > 0 ? days[mDi] : "N/A"}</div>
            <div className="stat-delta green">Peak engagement day</div>
          </div>
        </div>

        <div className="chart-card wide" style={{padding: '40px 20px'}}>
          <div className="chart-header" style={{marginBottom: 30}}><span className="chart-title">Global Query Volume Heatmap</span></div>
          <div className="heatmap-wrap" style={{transform: 'scale(1.2)', transformOrigin: 'top center', marginBottom: 60}}>
            <div className="heatmap-days">
              {days.map(d => <span key={d}>{d}</span>)}
            </div>
            {["12 AM","6 AM","12 PM","6 PM"].map((h, hi) => (
              <div key={h} className="heatmap-row">
                <span className="heatmap-hour">{h}</span>
                {heatmapData[hi].map((v, di) => <HeatmapCell key={di} value={v} />)}
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

  if (activeSection === "performance") {
    return (
      <div className="admin-overview">
        <div className="stat-grid">
          {[
            { label: "Cluster Status", value: "Healthy", delta: "5/5 nodes", color: "green" },
            { label: "Index Size", value: "Live", delta: "↑ Connected", color: "blue" },
            { label: "Cache Hit Rate", value: stats.cacheHitRateText, delta: "Live", color: "amber" },
            { label: "Active Shards", value: "Solr", delta: "ZK: healthy", color: "green" },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div className="stat-label">{s.label}</div>
              <div className="stat-value">{s.value}</div>
              <div className={`stat-delta ${s.color}`}>{s.delta}</div>
            </div>
          ))}
        </div>
        <div className="chart-card">
          <div className="chart-header"><span className="chart-title">Latency Over Time (Bucket Averages)</span></div>
          <div className="chart-axes">
            <div className="chart-area"><Sparkline data={charts.latData} color="#F59E0B" height={100} /></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-section-placeholder">
      <div className="placeholder-icon">⚙</div>
      <h3>Settings</h3>
      <p>System configuration, rate limits, authentication settings.</p>
    </div>
  );
}
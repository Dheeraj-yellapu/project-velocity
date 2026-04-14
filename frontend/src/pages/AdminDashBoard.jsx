import { useState, useEffect, useRef } from "react";
import Papa from "papaparse";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { Line, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, BarElement, Filler } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, BarElement, Filler);

function HeatmapCell({ value }) {
  const count = typeof value === "object" && value !== null ? value.count ?? 0 : Number(value) || 0;
  const percent = typeof value === "object" && value !== null ? value.percent ?? 0 : Number(value) || 0;
  const bucket = Math.max(0, Math.min(9, Math.floor(percent / 10)));
  return <div className={`heatmap-cell heatmap-cell-${bucket}`} title={`${count} queries (${percent}%)`} />;
}

function getHeatmapCount(value) {
  if (typeof value === "object" && value !== null) {
    return value.count ?? 0;
  }
  return Number(value) || 0;
}

export default function AdminDashboard({ activeSection }) {
  const [qpsRange, setQpsRange] = useState("1h");
  const [analytics, setAnalytics] = useState(null);
  const [benchmarkData, setBenchmarkData] = useState(null);
  const [runningBenchmark, setRunningBenchmark] = useState(false);
  const [sysMetrics, setSysMetrics] = useState(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswordEditor, setShowPasswordEditor] = useState(false);
  const [passwordChangedAt, setPasswordChangedAt] = useState(null);
  const [passwordAgeNow, setPasswordAgeNow] = useState(Date.now());
  const [settingsError, setSettingsError] = useState("");
  const [settingsSuccess, setSettingsSuccess] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [clearingLogs, setClearingLogs] = useState(false);
  const adminSettingsRef = useRef(null);
  const reportRef = useRef(null);
  const qpsChartRef = useRef(null);
  const latencyChartRef = useRef(null);
  const overviewHeatmapRef = useRef(null);
  const globalHeatmapRef = useRef(null);
  const weeklyHeatmapRef = useRef(null);

  const fetchAnalyticsData = async () => {
    try {
      const res = await fetch(`/api/analytics?range=${qpsRange}`);
      const data = await res.json();
      setAnalytics(data);
    } catch (err) {
      console.error("Failed to load analytics", err);
    }
  };

  const fetchMetrics = async () => {
    try {
      const res = await fetch(`/api/metrics`);
      const data = await res.json();
      setSysMetrics(data);
    } catch (_err) {}
  };

  const fetchPasswordMeta = async () => {
    try {
      const res = await fetch("/api/admin/settings/password-meta");
      const payload = await res.json().catch(() => ({}));
      if (res.ok && payload.changedAt) {
        setPasswordChangedAt(Number(payload.changedAt));
      }
    } catch (_err) {}
  };

  useEffect(() => {
    fetchAnalyticsData();
    fetchMetrics();
    const interval = setInterval(() => {
      fetchAnalyticsData();
      if (activeSection === "profiling") fetchMetrics();
    }, 3000);
    return () => clearInterval(interval);
  }, [qpsRange, activeSection]);

  useEffect(() => {
    if (activeSection !== "settings") return;
    fetchPasswordMeta();
    const timer = setInterval(() => setPasswordAgeNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, [activeSection]);

  const getRelativePasswordAge = () => {
    if (!passwordChangedAt) return "just now";
    const diffMs = Math.max(0, passwordAgeNow - passwordChangedAt);
    const sec = Math.floor(diffMs / 1000);
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.floor(hr / 24);
    return `${day}d ago`;
  };

  const handleChangePassword = async () => {
    setSettingsError("");
    setSettingsSuccess("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setSettingsError("Please fill all password fields.");
      return;
    }

    setUpdatingPassword(true);
    try {
      const res = await fetch("/api/admin/settings/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSettingsError(payload.error || "Failed to update password.");
      } else {
        setSettingsSuccess(payload.message || "Password updated successfully.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setShowPasswordEditor(false);
        setPasswordAgeNow(Date.now());
        await fetchPasswordMeta();
      }
    } catch (_err) {
      setSettingsError("Unable to update password right now.");
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleClearLogs = async () => {
    setSettingsError("");
    setSettingsSuccess("");
    setClearingLogs(true);
    try {
      const res = await fetch("/api/admin/settings/clear-logs", { method: "POST" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSettingsError(payload.error || "Failed to clear logs.");
      } else {
        setSettingsSuccess(payload.message || "All logs have been cleared.");
        await fetchAnalyticsData();
      }
    } catch (_err) {
      setSettingsError("Unable to clear logs right now.");
    } finally {
      setClearingLogs(false);
    }
  };

  if (!analytics) {
    return <div className="admin-overview admin-loading">Loading Live Analytics...</div>;
  }

  const {
    stats,
    charts,
    topQueries,
    heatmapData = [
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
    ],
    weeklyHeatmap,
    logs,
  } = analytics;
  const qpsSeries = charts?.qpsData ?? [];
  const qpsPointCount = qpsSeries.length || 1;
  const rangeMinutesByKey = { "1h": 60, "6h": 360, "24h": 1440 };
  const totalRangeMinutes = rangeMinutesByKey[qpsRange] ?? 60;
  const bucketMinutes = totalRangeMinutes / qpsPointCount;
  const bucketSeconds = bucketMinutes * 60;
  const qpsMaxData = qpsSeries.length > 0 ? Math.max(...qpsSeries) : 0;
  const peakQpsPerSecond = Number(stats?.maxQpsPerSecond || 0);
  const qpsScaleMax = qpsMaxData > 0 ? Number((qpsMaxData * 1.1).toFixed(4)) : 1;
  const qpsScaleMid = qpsScaleMax / 2;
  const formatQpsValue = (value) => {
    if (value >= 100) return value.toFixed(0);
    if (value >= 10) return value.toFixed(1);
    if (value >= 1) return value.toFixed(2);
    if (value >= 0.1) return value.toFixed(3);
    return value.toFixed(4);
  };
  const qpsLabels = qpsSeries.map((_, i) => {
    const minutesAgo = Math.round((qpsPointCount - 1 - i) * bucketMinutes);
    return minutesAgo === 0 ? "Now" : `${minutesAgo}m ago`;
  });

  const exportQpsGraphPng = () => {
    if (!qpsChartRef.current || qpsSeries.length === 0) return;
    const imageUrl = qpsChartRef.current.toBase64Image("image/png", 1);
    const link = document.createElement("a");
    link.href = imageUrl;
    link.setAttribute("download", `velocity_qps_over_time_${new Date().getTime()}.png`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportQpsGraphCsv = () => {
    if (qpsSeries.length === 0) return;
    const csvRows = qpsSeries.map((qps, i) => ({
      range: qpsRange,
      label: qpsLabels[i],
      qps: Number(qps),
    }));
    const csv = Papa.unparse(csvRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `velocity_qps_over_time_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadBlobAsFile = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportElementAsPng = async (elementRef, filePrefix) => {
    if (!elementRef?.current) return;
    const canvas = await html2canvas(elementRef.current, {
      scale: 2,
      backgroundColor: null,
    });
    canvas.toBlob((blob) => {
      if (!blob) return;
      downloadBlobAsFile(blob, `${filePrefix}_${new Date().getTime()}.png`);
    }, "image/png");
  };

  const heatmapToCsvRows = (matrix, rowLabels, colLabels, sectionLabel) => {
    const rows = [];
    for (let rowIndex = 0; rowIndex < matrix.length; rowIndex += 1) {
      const row = matrix[rowIndex] || [];
      for (let colIndex = 0; colIndex < colLabels.length; colIndex += 1) {
        const rawValue = row[colIndex] ?? 0;
        const count = typeof rawValue === "object" && rawValue !== null ? rawValue.count ?? 0 : Number(rawValue) || 0;
        const percent = typeof rawValue === "object" && rawValue !== null ? rawValue.percent ?? 0 : Number(rawValue) || 0;
        rows.push({
          section: sectionLabel,
          row: rowLabels[rowIndex] ?? `Row ${rowIndex + 1}`,
          column: colLabels[colIndex] ?? `Col ${colIndex + 1}`,
          count,
          percent,
        });
      }
    }
    return rows;
  };

  const systemConfig = {
    l1CacheMaxEntries: 500,
    l1TtlSec: 30.0,
    l2CacheTtlSec: 300.0,
    defaultSolrRows: 10,
  };

  if (activeSection === "overview") {
    return (
      <div className="admin-overview">
        <div className="stat-grid overview-stat-grid">
          {[
            { label: "QPS (Current)", value: stats.qpsText, delta: "Live", color: "blue" },
            { label: "Highest QPS", value: peakQpsPerSecond.toLocaleString(), delta: "Peak in 1s window", color: "blue" },
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
              <div className="qps-header-controls">
                  <div className="qps-export-controls">
                    <button className="export-btn" onClick={exportQpsGraphPng} disabled={qpsSeries.length === 0}>Export PNG</button>
                    <button className="export-btn" onClick={exportQpsGraphCsv} disabled={qpsSeries.length === 0}>Export CSV</button>
                  </div>
                  <select className="chart-select" value={qpsRange} onChange={e => setQpsRange(e.target.value)}>
                    <option value="1h">Last 1 hour</option>
                    <option value="6h">Last 6 hours</option>
                    <option value="24h">Last 24 hours</option>
                  </select>
              </div>
            </div>
            <div className="chart-axes">
              <div className="y-labels">
                {[formatQpsValue(qpsScaleMax), "", formatQpsValue(qpsScaleMid), "", "0"].map((l, i) => <span key={i}>{l}</span>)}
              </div>
              <div className="chart-area qps-chart-area">
                <Line 
                   ref={qpsChartRef}
                   data={{
                     labels: qpsLabels,
                     datasets: [
                       {
                         label: 'Live QPS',
                         data: qpsSeries,
                         borderColor: '#3B82F6',
                         backgroundColor: 'rgba(59, 130, 246, 0.1)',
                         fill: true,
                         tension: 0.3,
                       },
                     ]
                   }} 
                   options={{ 
                     maintainAspectRatio: false, 
                     interaction: { mode: 'index', intersect: false },
                     plugins: { 
                       legend: { display: false }, 
                        tooltip: {
                          enabled: true,
                          mode: 'index',
                          intersect: false,
                          callbacks: {
                            label: (ctx) => {
                              const qps = Number(ctx.parsed.y || 0);
                              const approxRequests = Math.round(qps * bucketSeconds);
                              return `QPS: ${formatQpsValue(qps)} (~${approxRequests} req/${Math.round(bucketMinutes)}m bucket)`;
                            }
                          }
                        }
                     }, 
                     elements: { point: { radius: 2, hoverRadius: 5 } },
                     scales: {
                       x: { display: false },
                       y: { display: false, min: 0, max: qpsScaleMax }
                     }
                   }} 
                />
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
                )) : <tr><td colSpan="3" className="table-empty">No queries yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-header">
            <span className="chart-title">Query Volume Heatmap</span>
            <button className="export-btn" onClick={() => exportElementAsPng(overviewHeatmapRef, "velocity_overview_heatmap")}>Export PNG</button>
          </div>
          <div ref={overviewHeatmapRef} className="heatmap-wrap">
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
            <div className="stat-value stat-value-fast">{fastPct}%</div>
            <div className="stat-delta">{fast} queries</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Medium Queries (&lt;200ms)</div>
            <div className="stat-value stat-value-medium">{medPct}%</div>
            <div className="stat-delta">{medium} queries</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Slow Queries (&ge;200ms)</div>
            <div className="stat-value stat-value-slow">{slowPct}%</div>
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
                  <td><span style={{color: 'rgb(220, 38, 38)', fontWeight: 'bold'}}>{typeof q.latency === 'number' ? q.latency.toFixed(2) : q.latency} ms</span></td>
                  <td>{q.source === "cache" ? "Hit" : "Miss (Solr)"}</td>
                </tr>
              )) : <tr><td colSpan="4" className="table-empty">No queries yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (activeSection === "logs") {
    return (
      <div className="admin-logs">
        <div className="chart-header logs-header">
          <span className="chart-title">Live Query Logs ({logs.length})</span>
          <button className="export-btn">Refresh</button>
        </div>
        <table className="query-table full">
          <thead><tr><th>Timestamp</th><th>Query</th><th>Solr Node</th><th>Backend</th><th>Latency</th><th>Results</th><th>Cache</th><th>Status</th></tr></thead>
          <tbody>
            {logs.length > 0 ? logs.map((log, i) => (
              <tr key={i}>
                <td className="mono">{new Date(log.timestamp).toLocaleTimeString()}</td>
                <td className="q-cell">{log.query}</td>
                <td className="mono">{log.servedBy || log.ip || "-"}</td>
                <td className="mono">{log.backendId || "-"}</td>
                <td>{typeof log.latency === 'number' ? log.latency.toFixed(2) : log.latency} ms</td>
                <td>{log.results.toLocaleString()}</td>
                <td>{log.source === "cache" ? "Hit" : "Miss"}</td>
                <td><span className={`status-badge ${log.status === 'error' ? 'warn' : (log.latency > 500 ? 'warn' : 'ok')}`}>
                  {log.status === 'error' ? 'Error' : (log.latency > 500 ? 'Slow' : 'OK')}
                </span></td>
              </tr>
            )) : <tr><td colSpan="8" className="table-empty table-empty-lg">No recent logs to display</td></tr>}
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
        const count = getHeatmapCount(v);
        if (count > maxV) { maxV = count; mHi = hi; mDi = di; }
      });
    });
    const days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
    const hours = ["12 AM - 6 AM","6 AM - 12 PM","12 PM - 6 PM","6 PM - 12 AM"];

    const exportGlobalHeatmapCsv = () => {
      const csvRows = heatmapToCsvRows(heatmapData, ["12 AM", "6 AM", "12 PM", "6 PM"], days, "Global Query Volume Heatmap");
      const csv = Papa.unparse(csvRows);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      downloadBlobAsFile(blob, `velocity_global_heatmap_${new Date().getTime()}.csv`);
    };

    const exportWeeklyHeatmapCsv = () => {
      const csvRows = heatmapToCsvRows(
        weeklyHeatmap?.data || [],
        weeklyHeatmap?.weekLabels || [],
        weeklyHeatmap?.dayLabels || days,
        "Previous 5 Weeks Daily Heatmap"
      );
      const csv = Papa.unparse(csvRows);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      downloadBlobAsFile(blob, `velocity_weekly_heatmap_${new Date().getTime()}.csv`);
    };

    return (
      <div className="admin-overview">
        <div className="stat-grid stat-grid-two">
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

        <div className="chart-card wide heatmap-global-card">
          <div className="chart-header heatmap-global-header">
            <span className="chart-title">Global Query Volume Heatmap</span>
            <div className="heatmap-export-actions">
              <button className="export-btn" onClick={() => exportElementAsPng(globalHeatmapRef, "velocity_global_heatmap")}>Export PNG</button>
              <button className="export-btn" onClick={exportGlobalHeatmapCsv}>Export CSV</button>
            </div>
          </div>
          <div ref={globalHeatmapRef} className="heatmap-wrap heatmap-global-wrap">
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

        <div className="chart-card wide">
          <div className="chart-header">
            <span className="chart-title">Previous 5 Weeks (Daily Heatmap)</span>
            <div className="heatmap-export-actions">
              <button className="export-btn" onClick={() => exportElementAsPng(weeklyHeatmapRef, "velocity_weekly_heatmap")}>Export PNG</button>
              <button className="export-btn" onClick={exportWeeklyHeatmapCsv} disabled={!weeklyHeatmap?.data?.length}>Export CSV</button>
            </div>
          </div>
          <div ref={weeklyHeatmapRef} className="heatmap-wrap weekly-heatmap-wrap">
            <div className="heatmap-days weekly-heatmap-days">
              {(weeklyHeatmap?.dayLabels || days).map((d) => <span key={d}>{d}</span>)}
            </div>
            {(weeklyHeatmap?.data || []).map((row, wi) => (
              <div key={wi} className="heatmap-row">
                <span className="heatmap-hour weekly-heatmap-week-label">
                  {weeklyHeatmap?.weekLabels?.[wi] || `Week ${wi + 1}`}
                </span>
                {row.map((v, di) => <HeatmapCell key={`${wi}-${di}`} value={v} />)}
              </div>
            ))}
            {!weeklyHeatmap?.data?.length && <div className="table-empty">No weekly history yet</div>}
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
    
    const runBenchmark = async () => {
      setRunningBenchmark(true);
      try {
        const res = await fetch("/api/benchmark");
        const data = await res.json();
        setBenchmarkData(data);
      } catch (err) {
        console.error(err);
      }
      setRunningBenchmark(false);
    };

    const exportCSV = () => {
      if (!benchmarkData) return;
      const csv = Papa.unparse(benchmarkData.benchmark);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `velocity_benchmark_${new Date().getTime()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    const exportPDF = async () => {
      if (!benchmarkData || !reportRef.current) return;
      const canvas = await html2canvas(reportRef.current, { scale: 2 });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`velocity_benchmark_${new Date().getTime()}.pdf`);
    };

    const lineChartData = {
      labels: charts.latData.map((_, i) => i + 1),
      datasets: [
        {
          label: 'Bucket Average Latency (ms)',
          data: charts.latData,
          borderColor: '#F59E0B',
          backgroundColor: 'rgba(245, 158, 11, 0.5)',
          tension: 0.3,
        },
      ],
    };

    const exportLatencyGraphPng = () => {
      if (!latencyChartRef.current || !charts.latData?.length) return;
      const imageUrl = latencyChartRef.current.toBase64Image("image/png", 1);
      const link = document.createElement("a");
      link.href = imageUrl;
      link.setAttribute("download", `velocity_latency_over_time_${new Date().getTime()}.png`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    const exportLatencyGraphCsv = () => {
      if (!charts.latData?.length) return;
      const csvRows = charts.latData.map((latencyMs, index) => ({
        bucket: index + 1,
        latencyMs: Number(latencyMs),
      }));
      const csv = Papa.unparse(csvRows);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      downloadBlobAsFile(blob, `velocity_latency_over_time_${new Date().getTime()}.csv`);
    };

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
        
        <div className="chart-card wide benchmark-card">
          <div className="chart-header">
            <span className="chart-title">Run Platform Benchmark</span>
            <div className="benchmark-actions">
               <button className="export-btn search-button benchmark-run-btn" onClick={runBenchmark} disabled={runningBenchmark}>{runningBenchmark ? 'Running...' : 'Run Benchmark'}</button>
               {benchmarkData && <button className="export-btn" onClick={exportCSV}>Export CSV</button>}
               {benchmarkData && <button className="export-btn" onClick={exportPDF}>Export PDF</button>}
            </div>
          </div>
          
          {benchmarkData && (
             <div ref={reportRef} className="benchmark-report">
               <h3>Benchmark Results</h3>
               <div className="benchmark-summary-grid">
                  <div className="benchmark-summary-item">
                    <div className="benchmark-summary-label">Avg Raw Solr Latency</div>
                    <div className="benchmark-summary-value">{benchmarkData.summary.avg_raw_latency_ms} ms</div>
                  </div>
                  <div className="benchmark-summary-item">
                    <div className="benchmark-summary-label">Avg Cached Latency</div>
                    <div className="benchmark-summary-value benchmark-summary-value-green">{benchmarkData.summary.avg_cached_latency_ms} ms</div>
                  </div>
                  <div className="benchmark-summary-item">
                    <div className="benchmark-summary-label">Avg Configured Speedup</div>
                    <div className="benchmark-summary-value benchmark-summary-value-blue">{benchmarkData.summary.avg_speedup}</div>
                  </div>
                  <div className="benchmark-summary-item">
                    <div className="benchmark-summary-label">Queries Tested</div>
                    <div className="benchmark-summary-value">{benchmarkData.summary.total_queries}</div>
                  </div>
               </div>
               
               <div className="benchmark-bar-wrap">
                  <Bar data={{
                    labels: benchmarkData.benchmark.map(b => b.query),
                    datasets: [
                      { label: 'Raw Latency (ms)', data: benchmarkData.benchmark.map(b => b.raw_solr_latency_ms), backgroundColor: 'rgba(239, 68, 68, 0.8)' },
                      { label: 'Cached Latency (ms)', data: benchmarkData.benchmark.map(b => b.cached_latency_ms), backgroundColor: 'rgba(34, 197, 94, 0.8)' }
                    ]
                  }} options={{ 
                    maintainAspectRatio: false, 
                    interaction: { mode: 'index', intersect: false },
                    plugins: { 
                      title: { display: true, text: 'Query Latency Comparison' },
                      tooltip: { enabled: true, mode: 'index', intersect: false }
                    } 
                  }} />
               </div>

               <table className="query-table full">
                 <thead><tr><th>Query</th><th>Hits</th><th>Raw Latency</th><th>Cached Latency</th><th>Speedup</th></tr></thead>
                 <tbody>
                    {benchmarkData.benchmark.map((b, i) => (
                      <tr key={i}>
                        <td className="q-cell">{b.query}</td>
                        <td>{b.num_results.toLocaleString()}</td>
                        <td>{b.raw_solr_latency_ms} ms</td>
                        <td>{b.cached_latency_ms} ms</td>
                        <td className="speedup-value">{b.speedup}</td>
                      </tr>
                    ))}
                 </tbody>
               </table>
             </div>
          )}
        </div>

        <div className="chart-card">
          <div className="chart-header">
            <span className="chart-title">Latency Over Time (Bucket Averages)</span>
            <div className="heatmap-export-actions">
              <button className="export-btn" onClick={exportLatencyGraphPng} disabled={!charts.latData?.length}>Export PNG</button>
              <button className="export-btn" onClick={exportLatencyGraphCsv} disabled={!charts.latData?.length}>Export CSV</button>
            </div>
          </div>
             <div className="line-chart-wrap">
               <Line ref={latencyChartRef} data={lineChartData} options={{ 
                 maintainAspectRatio: false, 
                 interaction: { mode: 'index', intersect: false },
                 plugins: { legend: { display: false }, tooltip: { enabled: true, mode: 'index', intersect: false } }, 
                 elements: { point: { radius: 3, hoverRadius: 6 } } 
               }} />
             </div>
        </div>
      </div>
    );
  }

  if (activeSection === "profiling") {
     if (!sysMetrics) return <div className="loading-center">Loading Profiling Metrics...</div>;
     if (sysMetrics.error && (!sysMetrics.systems || sysMetrics.systems.length === 0)) {
       return <div className="loading-center loading-error">Failed to load profiling data: {sysMetrics.details}</div>;
     }

     const systems = Array.isArray(sysMetrics.systems) ? sysMetrics.systems : [];
     const cluster = sysMetrics.cluster || null;
    
    return (
       <div className="admin-overview">
        <div className="chart-header profiling-header">
           <span className="chart-title">Prometheus / Grafana Style Profiling</span>
           <span className="source-indicator solr"><span className="source-dot" /> Live Metrics ({systems.length} systems)</span>
         </div>
        <div className="system-metrics-grid">
          {systems.map((system) => {
            if (system.status !== "ok") {
              return (
                <div className="chart-card profiling-card system-card" key={system.url || system.systemNo}>
                  <h4 className="system-title-row">
                    <span>{`System ${system.systemNo}: ${system.ip}`}</span>
                    <span className="system-status down">down</span>
                  </h4>
                  <div className="metric-meta">Unable to fetch this system right now: {system.error || "Unknown error"}</div>
                </div>
              );
            }

            return (
              <div className="chart-card profiling-card system-card" key={system.url || system.systemNo}>
                <h4 className="system-title-row">
                  <span>{`System ${system.systemNo}: ${system.ip}`}</span>
                  <span className="system-status up">live</span>
                </h4>

                <div className="metric-stack">
                  <div>
                    <h5 className="metric-title-row">CPU Usage<span>{system.cpu.percent}%</span></h5>
                    <progress className={`metric-progress ${system.cpu.percent > 80 ? "metric-progress-danger" : "metric-progress-blue"}`} value={system.cpu.percent} max="100" />
                    <div className="metric-meta">
                      <div>Load Avg: {system.cpu.load}</div>
                      <div>Cores: {system.cpu.cores}</div>
                    </div>
                  </div>

                  <div>
                    <h5 className="metric-title-row">Memory (JVM)<span>{system.memory.percent}%</span></h5>
                    <progress className={`metric-progress ${system.memory.percent > 85 ? "metric-progress-danger" : "metric-progress-green"}`} value={system.memory.percent} max="100" />
                    <div className="metric-meta">
                      <div>Used: {system.memory.usedStr}</div>
                      <div>Max: {system.memory.totalStr}</div>
                    </div>
                  </div>

                  <div>
                    <h5 className="metric-title-row">Disk I/O (Solr Core)<span>{system.disk.percent}%</span></h5>
                    <progress className={`metric-progress ${system.disk.percent > 90 ? "metric-progress-danger" : "metric-progress-purple"}`} value={system.disk.percent} max="100" />
                    <div className="metric-meta">
                      <div>Index Size: {system.disk.usedStr}</div>
                      <div>Allocated Limit: {system.disk.totalStr}</div>
                    </div>
                  </div>

                  <div className="metric-meta system-extra-meta">
                    <div>Node Uptime: {system.solr.upTimeText}</div>
                    <div>Solr Version: {system.solr.version}</div>
                    <div>Total Docs: {Number(system.solr.docs || 0).toLocaleString()}</div>
                    <div>Collections: {system.solr.collections}</div>
                    <div>Replicas: {system.solr.replicas}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {cluster && (
          <div className="chart-card wide solr-state-card">
            <h4 className="solr-state-title">Solr Cloud Cluster State</h4>
            <div className="solr-state-grid">
              <div>
                <div className="solr-state-label">Version</div>
                <div className="solr-state-value">{cluster.version}</div>
              </div>
              <div>
                <div className="solr-state-label">Total Documents</div>
                <div className="solr-state-value">{Number(cluster.totalDocuments || 0).toLocaleString()}</div>
              </div>
              <div>
                <div className="solr-state-label">Max Uptime (Across Systems)</div>
                <div className="solr-state-value">{cluster.uptimeText}</div>
              </div>
              <div>
                <div className="solr-state-label">Live Systems</div>
                <div className="solr-state-value">{cluster.liveSystems}</div>
              </div>
              <div>
                <div className="solr-state-label">Collections</div>
                <div className="solr-state-value">{cluster.collections}</div>
              </div>
              <div>
                <div className="solr-state-label">Replicas</div>
                <div className="solr-state-value">{cluster.replicas}</div>
              </div>
            </div>
          </div>
        )}
       </div>
    );
  }

  return (
    <div className="admin-overview" ref={adminSettingsRef}>
      <div className="stat-grid settings-grid">
        <div className="chart-card">
          <div className="chart-header">
             <span className="chart-title">Account Security</span>
          </div>
          <div className="settings-section-body">
            {!showPasswordEditor ? (
              <>
                <div className="security-field">
                  <label className="settings-label">Current Admin Password</label>
                  <input type="password" value="********" className="settings-input" disabled />
                  <small className="settings-hint">Password changed {getRelativePasswordAge()}</small>
                </div>
                <button
                  className="search-button export-btn change-password-btn"
                  onClick={() => {
                    setSettingsError("");
                    setSettingsSuccess("");
                    setShowPasswordEditor(true);
                  }}
                >
                  Change Password
                </button>
              </>
            ) : (
              <>
                <div className="security-field">
                  <label className="settings-label">Current Password</label>
                  <input
                    type="password"
                    placeholder="Enter current password"
                    className="settings-input"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </div>
                <div className="security-field">
                  <label className="settings-label">New Password</label>
                  <input
                    type="password"
                    placeholder="Enter new password"
                    className="settings-input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
                <div className="security-field">
                  <label className="settings-label">Confirm New Password</label>
                  <input
                    type="password"
                    placeholder="Confirm new password"
                    className="settings-input"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
                <div className="password-actions-row">
                  <button className="search-button export-btn change-password-btn" onClick={handleChangePassword} disabled={updatingPassword}>
                    {updatingPassword ? "Updating..." : "Confirm Change"}
                  </button>
                  <button
                    className="export-btn cancel-password-btn"
                    onClick={() => {
                      setShowPasswordEditor(false);
                      setCurrentPassword("");
                      setNewPassword("");
                      setConfirmPassword("");
                      setSettingsError("");
                    }}
                    disabled={updatingPassword}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-header">
             <span className="chart-title">Instance Preferences</span>
          </div>
          <div className="settings-section-body">
             <div className="preference-row">
               <div>
                 <div className="preference-title">Clear Logs</div>
                 <div className="preference-subtitle">Delete all search logs from analytics history.</div>
               </div>
               <button className="export-btn clear-logs-btn" onClick={handleClearLogs} disabled={clearingLogs}>
                 {clearingLogs ? "Clearing..." : "Clear Logs"}
               </button>
             </div>
          </div>
        </div>

        {(settingsError || settingsSuccess) && (
          <div className={`chart-card settings-feedback ${settingsError ? "settings-feedback-error" : "settings-feedback-success"}`}>
            {settingsError || settingsSuccess}
          </div>
        )}
        
        <div className="chart-card full-width-card">
          <div className="chart-header">
             <span className="chart-title">System Configuration (Read-only)</span>
          </div>
          <div className="settings-section-body">
             <div className="config-grid">
               <div className="config-item">
                 <div className="config-item-label">L1 Cache Max Entries</div>
                 <div className="config-item-value">{systemConfig.l1CacheMaxEntries} items</div>
               </div>
               <div className="config-item">
                 <div className="config-item-label">L1 TTL</div>
                 <div className="config-item-value">{systemConfig.l1TtlSec.toFixed(1)} sec</div>
               </div>
               <div className="config-item">
                 <div className="config-item-label">L2 Cache TTL</div>
                 <div className="config-item-value">{systemConfig.l2CacheTtlSec.toFixed(1)} sec</div>
               </div>
               <div className="config-item">
                 <div className="config-item-label">Default Solr Rows</div>
                 <div className="config-item-value">{systemConfig.defaultSolrRows} results</div>
               </div>
             </div>
          </div>
        </div>

      </div>
    </div>
  );
}
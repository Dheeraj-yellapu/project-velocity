import { useState, useEffect, useRef } from "react";
import Papa from "papaparse";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { Line, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, BarElement, Filler } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, BarElement, Filler);

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
  const [benchmarkData, setBenchmarkData] = useState(null);
  const [runningBenchmark, setRunningBenchmark] = useState(false);
  const [sysMetrics, setSysMetrics] = useState(null);
  const adminSettingsRef = useRef(null);
  const reportRef = useRef(null);

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
    
    const fetchMetrics = async () => {
      try {
        const res = await fetch(`/api/metrics`);
        const data = await res.json();
        setSysMetrics(data);
      } catch(err) {}
    };

    fetchAnalytics();
    fetchMetrics();
    const interval = setInterval(() => {
      if (activeSection !== "profiling" && activeSection !== "overview") return;
      fetchAnalytics();
      if (activeSection === "profiling") fetchMetrics();
    }, 3000);
    return () => clearInterval(interval);
  }, [qpsRange, activeSection]);

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
              <div style={{ marginLeft: "auto", display: "flex", gap: "10px", alignItems: "center" }}>
                  <div style={{ fontSize: "14px", fontWeight: "bold", color: "#3B82F6" }}>
                      Max: {Math.max(...charts.qpsData).toFixed(1)} QPS | Min: {Math.min(...charts.qpsData).toFixed(1)} QPS
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
                {/* Dynamically adjust y labels? Keeping static layout for simplicity */}
                {[Math.max(...charts.qpsData).toFixed(1), "", ((Math.max(...charts.qpsData) + Math.min(...charts.qpsData))/2).toFixed(1), "", Math.min(...charts.qpsData).toFixed(1)].map((l, i) => <span key={i}>{l}</span>)}
              </div>
              <div className="chart-area" style={{height: "140px", position: "relative", width: "100%"}}>
                <Line 
                   data={{
                     labels: charts.qpsData.map((_, i) => `${i*4}m ago`),
                     datasets: [
                       {
                         label: 'Live QPS',
                         data: charts.qpsData,
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
                       tooltip: { enabled: true, mode: 'index', intersect: false }
                     }, 
                     elements: { point: { radius: 2, hoverRadius: 5 } },
                     scales: {
                       x: { display: false },
                       y: { display: false }
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
        
        <div className="chart-card wide" style={{marginBottom: "30px"}}>
          <div className="chart-header">
            <span className="chart-title">Run Platform Benchmark</span>
            <div style={{display: 'flex', gap: '10px'}}>
               <button className="export-btn search-button" style={{margin:0}} onClick={runBenchmark} disabled={runningBenchmark}>{runningBenchmark ? 'Running...' : 'Run Benchmark'}</button>
               {benchmarkData && <button className="export-btn" onClick={exportCSV}>Export CSV</button>}
               {benchmarkData && <button className="export-btn" onClick={exportPDF}>Export PDF</button>}
            </div>
          </div>
          
          {benchmarkData && (
             <div ref={reportRef} style={{padding: '20px', background: '#fff'}}>
               <h3>Benchmark Results</h3>
               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginBottom: '20px' }}>
                  <div style={{padding: '15px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0'}}>
                    <div style={{fontSize: '12px', color: '#64748b'}}>Avg Raw Solr Latency</div>
                    <div style={{fontSize: '20px', fontWeight: 'bold'}}>{benchmarkData.summary.avg_raw_latency_ms} ms</div>
                  </div>
                  <div style={{padding: '15px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0'}}>
                    <div style={{fontSize: '12px', color: '#64748b'}}>Avg Cached Latency</div>
                    <div style={{fontSize: '20px', fontWeight: 'bold', color: '#16a34a'}}>{benchmarkData.summary.avg_cached_latency_ms} ms</div>
                  </div>
                  <div style={{padding: '15px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0'}}>
                    <div style={{fontSize: '12px', color: '#64748b'}}>Avg Configured Speedup</div>
                    <div style={{fontSize: '20px', fontWeight: 'bold', color: '#3b82f6'}}>{benchmarkData.summary.avg_speedup}</div>
                  </div>
                  <div style={{padding: '15px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0'}}>
                    <div style={{fontSize: '12px', color: '#64748b'}}>Queries Tested</div>
                    <div style={{fontSize: '20px', fontWeight: 'bold'}}>{benchmarkData.summary.total_queries}</div>
                  </div>
               </div>
               
               <div style={{height: '300px', marginBottom: '30px'}}>
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
                        <td style={{color: '#16a34a', fontWeight: 'bold'}}>{b.speedup}</td>
                      </tr>
                    ))}
                 </tbody>
               </table>
             </div>
          )}
        </div>

        <div className="chart-card">
          <div className="chart-header"><span className="chart-title">Latency Over Time (Bucket Averages)</span></div>
             <div style={{height: "250px", padding: "10px"}}>
               <Line data={lineChartData} options={{ 
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
    if (!sysMetrics) return <div style={{padding:40, textAlign:'center'}}>Loading Profiling Metrics...</div>;
    return (
       <div className="admin-overview">
         <div className="chart-header" style={{marginBottom: 20}}>
           <span className="chart-title">Prometheus / Grafana Style Profiling</span>
           <span className="source-indicator solr"><span className="source-dot" /> Live Metrics</span>
         </div>
         <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            <div className="chart-card" style={{padding: '20px'}}>
              <h4 style={{margin: '0 0 15px 0', display: 'flex', justifyContent: 'space-between'}}>CPU Usage<span>{sysMetrics.cpu.percent}%</span></h4>
              <div style={{height: '10px', background: '#e2e8f0', borderRadius: '5px', overflow: 'hidden'}}>
                 <div style={{height: '100%', width: `${sysMetrics.cpu.percent}%`, background: sysMetrics.cpu.percent > 80 ? '#ef4444' : '#3b82f6', transition: 'width 0.5s'}} />
              </div>
              <div style={{marginTop: '15px', fontSize: '13px', color: '#64748b'}}>
                 <div>Load Avg: {sysMetrics.cpu.load}</div>
                 <div>Cores: {sysMetrics.cpu.cores} Array(vCPUs)</div>
              </div>
            </div>

            <div className="chart-card" style={{padding: '20px'}}>
              <h4 style={{margin: '0 0 15px 0', display: 'flex', justifyContent: 'space-between'}}>Memory (JVM)<span>{sysMetrics.memory.percent}%</span></h4>
              <div style={{height: '10px', background: '#e2e8f0', borderRadius: '5px', overflow: 'hidden'}}>
                 <div style={{height: '100%', width: `${sysMetrics.memory.percent}%`, background: sysMetrics.memory.percent > 85 ? '#ef4444' : '#10b981', transition: 'width 0.5s'}} />
              </div>
              <div style={{marginTop: '15px', fontSize: '13px', color: '#64748b'}}>
                 <div>Used: {sysMetrics.memory.usedStr}</div>
                 <div>Max: {sysMetrics.memory.totalStr}</div>
              </div>
            </div>

            <div className="chart-card" style={{padding: '20px'}}>
              <h4 style={{margin: '0 0 15px 0', display: 'flex', justifyContent: 'space-between'}}>Disk I/O (Solr Core)<span>{sysMetrics.disk.percent}%</span></h4>
              <div style={{height: '10px', background: '#e2e8f0', borderRadius: '5px', overflow: 'hidden'}}>
                 <div style={{height: '100%', width: `${sysMetrics.disk.percent}%`, background: sysMetrics.disk.percent > 90 ? '#ef4444' : '#8b5cf6', transition: 'width 0.5s'}} />
              </div>
              <div style={{marginTop: '15px', fontSize: '13px', color: '#64748b'}}>
                 <div>Index Size: {sysMetrics.disk.usedStr}</div>
                 <div>Allocated Limit: {sysMetrics.disk.totalStr}</div>
              </div>
            </div>
         </div>
         
         <div className="chart-card wide" style={{marginTop: '20px', padding: '20px'}}>
           <h4 style={{margin: '0 0 15px 0'}}>Solr Engine State</h4>
           <div style={{display: 'flex', gap: '30px'}}>
              <div>
                 <div style={{fontSize: '12px', color: '#64748b'}}>Version</div>
                 <div style={{fontSize: '18px', fontWeight: 'bold'}}>{sysMetrics.solr.version}</div>
              </div>
              <div>
                 <div style={{fontSize: '12px', color: '#64748b'}}>Total Documents</div>
                 <div style={{fontSize: '18px', fontWeight: 'bold'}}>{sysMetrics.solr.docs.toLocaleString()}</div>
              </div>
              <div>
                 <div style={{fontSize: '12px', color: '#64748b'}}>Uptime</div>
                 <div style={{fontSize: '18px', fontWeight: 'bold'}}>{sysMetrics.solr.upTimeText}</div>
              </div>
           </div>
         </div>
       </div>
    );
  }

  return (
    <div className="admin-overview" ref={adminSettingsRef}>
      <div className="stat-grid" style={{gridTemplateColumns: 'minmax(300px, 1fr) minmax(300px, 1fr)'}}>
        <div className="chart-card">
          <div className="chart-header">
             <span className="chart-title">Account Security</span>
          </div>
          <div style={{padding: '20px'}}>
             <div style={{marginBottom: '15px'}}>
               <label style={{display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#475569', marginBottom: '5px'}}>Current Admin Password</label>
               <input type="password" placeholder="velocity2024" style={{width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px'}} disabled />
               <small style={{color: '#94a3b8', display: 'block', marginTop: '5px'}}>Hardcoded for current version.</small>
             </div>
             <button className="search-button export-btn" style={{margin: 0, padding: '10px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer'}} onClick={() => alert("Feature coming soon in next sprint.")}>Change Password</button>
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-header">
             <span className="chart-title">Instance Preferences</span>
          </div>
          <div style={{padding: '20px'}}>
             <div style={{marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
               <div>
                 <div style={{fontWeight: 'bold', fontSize: '14px', color: '#334155'}}>Dark Mode</div>
                 <div style={{fontSize: '12px', color: '#64748b'}}>Enable dark theme for admin console</div>
               </div>
               <input type="checkbox" style={{width: '40px', height: '20px', cursor: 'pointer'}} />
             </div>
             
             <div style={{marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '15px'}}>
               <div>
                 <div style={{fontWeight: 'bold', fontSize: '14px', color: '#334155'}}>Email Alerts</div>
                 <div style={{fontSize: '12px', color: '#64748b'}}>Receive daily health report digests</div>
               </div>
               <input type="checkbox" style={{width: '40px', height: '20px', cursor: 'pointer'}} defaultChecked />
             </div>

             <div style={{marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '15px'}}>
               <div>
                 <div style={{fontWeight: 'bold', fontSize: '14px', color: '#334155'}}>Auto-clear Logs</div>
                 <div style={{fontSize: '12px', color: '#64748b'}}>Archive metrics older than 30 days</div>
               </div>
               <input type="checkbox" style={{width: '40px', height: '20px', cursor: 'pointer'}} defaultChecked />
             </div>
          </div>
        </div>
        
        <div className="chart-card" style={{gridColumn: '1 / -1'}}>
          <div className="chart-header">
             <span className="chart-title">System Configuration (Read-only)</span>
          </div>
          <div style={{padding: '20px'}}>
             <div style={{display: 'flex', gap: '20px'}}>
               <div style={{flex: 1, padding: '15px', background: '#f8fafc', borderRadius: '8px'}}>
                 <div style={{fontSize: '12px', color: '#64748b'}}>L1 Cache Max Entries</div>
                 <div style={{fontSize: '16px', fontWeight: 'bold'}}>500 items</div>
               </div>
               <div style={{flex: 1, padding: '15px', background: '#f8fafc', borderRadius: '8px'}}>
                 <div style={{fontSize: '12px', color: '#64748b'}}>L1 TTL</div>
                 <div style={{fontSize: '16px', fontWeight: 'bold'}}>30.0 sec</div>
               </div>
               <div style={{flex: 1, padding: '15px', background: '#f8fafc', borderRadius: '8px'}}>
                 <div style={{fontSize: '12px', color: '#64748b'}}>L2 Cache TTL</div>
                 <div style={{fontSize: '16px', fontWeight: 'bold'}}>300.0 sec</div>
               </div>
               <div style={{flex: 1, padding: '15px', background: '#f8fafc', borderRadius: '8px'}}>
                 <div style={{fontSize: '12px', color: '#64748b'}}>Default Solr Rows</div>
                 <div style={{fontSize: '16px', fontWeight: 'bold'}}>10 results</div>
               </div>
             </div>
          </div>
        </div>

      </div>
    </div>
  );
}
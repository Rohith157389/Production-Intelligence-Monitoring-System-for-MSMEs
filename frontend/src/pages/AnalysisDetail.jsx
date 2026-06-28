import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import api from '../api/client';
import { THEME, tooltipStyle } from '../components/IndustrialUI';

const METRIC_KEYS = {
  efficiency: 'efficiencyPercent',
  idle: 'idleDurationMinutes',
  overload: 'overloadEvents',
  stoppage: 'stoppageEvents',
  interruption: 'delayEvents',
  power: 'powerQualityScore',
};

const TITLES = {
  efficiency: 'Production Efficiency Analysis',
  idle: 'Machine Idle Time Analysis',
  overload: 'Machine Overload Analysis',
  stoppage: 'Production Stoppage Analysis',
  interruption: 'Production Interruption Analysis',
  power: 'Power Quality Analysis',
};

const tooltip = tooltipStyle;

export default function AnalysisDetail() {
  const { type } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 7);
      try {
        const res = await api.get(`/intelligence/analysis/${type}`, {
          params: { startDate: start.toISOString(), endDate: end.toISOString() },
        });
        setData(res.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [type]);

  const downloadPdf = () => {
    const token = localStorage.getItem('token');
    fetch(`/api/reports/pdf/daily?date=${new Date().toISOString().slice(0, 10)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.blob())
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `PIMS_${type}_analysis.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      });
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="w-12 h-12 border-2 border-gray-800 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="mb-6">
          <Link to="/dashboard" className="text-gray-900 font-bold text-sm hover:underline mb-2 inline-block">
            ← Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{TITLES[type] || 'Detailed Analysis'}</h1>
        </div>
        <button onClick={downloadPdf} className="btn-primary">
          Export PDF Report
        </button>
      </div>

      {/* Summary */}
      <section className="ind-panel">
        <div className="ind-panel-header"><span>Summary</span></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(data?.summary || {}).map(([key, val]) => (
            <div key={key} className="bg-gray-50 rounded p-3 border border-gray-200">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">{key.replace(/([A-Z])/g, ' $1')}</p>
              <p className="text-lg font-bold text-gray-900 font-mono">{String(val)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Trend Analysis */}
      <section className="ind-panel">
        <div className="ind-panel-header"><span>Trend Analysis</span></div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data?.trendAnalysis || []}>
            <CartesianGrid strokeDasharray="3 3" stroke={THEME.grid} />
            <XAxis dataKey="date" tick={{ fill: THEME.muted, fontSize: 10 }} />
            <YAxis tick={{ fill: THEME.muted, fontSize: 10 }} />
            <Tooltip {...tooltipStyle} />
            <Line type="monotone" dataKey="efficiency" stroke="#00d4aa" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="idle" stroke="#f59e0b" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="stoppage" stroke="#ef4444" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </section>

      {/* Historical / Issue Frequency */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="ind-panel">
          <div className="ind-panel-header"><span>Issue Frequency Analysis</span></div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data?.issueFrequency || []}>
              <CartesianGrid strokeDasharray="3 3" stroke={THEME.grid} />
              <XAxis dataKey="machine" tick={{ fill: THEME.muted, fontSize: 9 }} />
              <YAxis tick={{ fill: THEME.muted, fontSize: 9 }} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey={METRIC_KEYS[type] || 'overloadEvents'} fill="#00d4aa" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>

        <section className="ind-panel">
          <div className="ind-panel-header"><span>Impact Analysis</span></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(data?.impactAnalysis || []).map((item, i) => (
              <div key={i} className="bg-gray-50 rounded p-3 border-l-2 border-gray-800 border-y border-r border-gray-200">
                <p className="text-sm font-semibold text-gray-900">{item.machine}</p>
                <p className="text-xs text-gray-600 mt-1">{item.impact}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Event Timeline */}
      <section className="ind-panel">
        <div className="ind-panel-header"><span>Event Timeline</span></div>
        {(data?.eventTimeline || []).length === 0 ? (
          <p className="text-gray-500 text-sm">No events in period</p>
        ) : (
          <div className="space-y-2">
            {data.eventTimeline.map((ev, i) => (
              <div key={i} className="flex gap-4 py-2 border-b border-gray-200">
                <span className="text-gray-900 font-bold font-mono text-sm w-24">{ev.time}</span>
                <span className="text-sm text-gray-700 flex-1">{ev.label}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Sensor Data Logs - only on drill-down */}
      <section className="ind-panel">
        <div className="ind-panel-header">
          <span>Sensor Data Logs</span>
          <span className="text-[10px] normal-case text-slate-600">Raw readings — audit reference only</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-gray-500 border-b border-gray-200">
                <th className="pb-2 font-medium">Time</th>
                <th className="pb-2 pr-3 text-left">Machine</th>
                <th className="pb-2 pr-3">Current</th>
                <th className="pb-2 pr-3">Voltage</th>
                <th className="pb-2 pr-3">Temp</th>
                <th className="pb-2 pr-3">Count</th>
              </tr>
            </thead>
            <tbody>
              {(data?.sensorLogs || []).slice(0, 20).map((r, i) => (
                <tr key={i} className="border-b border-gray-200 text-gray-600 font-mono">
                  <td className="py-2">{new Date(r.timestamp).toLocaleString()}</td>
                  <td className="py-2 pr-3">{r.machine}</td>
                  <td className="py-2 pr-3 text-center">{r.current}A</td>
                  <td className="py-2 pr-3 text-center">{r.voltage}V</td>
                  <td className="py-2 pr-3 text-center">{r.temperature}°C</td>
                  <td className="py-2 pr-3 text-center">{r.objectCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

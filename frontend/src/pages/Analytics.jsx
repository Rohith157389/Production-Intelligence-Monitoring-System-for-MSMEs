import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area,
} from 'recharts';
import api from '../api/client';

export default function Analytics() {
  const [trends, setTrends] = useState([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrends = async () => {
      setLoading(true);
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - days);
      try {
        const res = await api.get('/dashboard/trends', {
          params: {
            startDate: start.toISOString(),
            endDate: end.toISOString(),
          },
        });
        setTrends(res.data.combined || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchTrends();
  }, [days]);

  const chartProps = {
    margin: { top: 5, right: 20, left: 0, bottom: 5 },
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Historical Analytics</h1>
          <p className="text-gray-500 text-sm mt-1">Runtime, downtime, production, efficiency & temperature trends</p>
        </div>
        <select
          className="input-field w-40"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        >
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {loading ? (
        <div className="card text-center py-12 text-gray-400">
          <div className="w-12 h-12 border-2 border-gray-800 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          Processing historical data...
        </div>
      ) : trends.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          No trend data available. Add sensor readings to see analytics.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="Runtime vs Downtime Trends">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={trends} {...chartProps}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="runtime"
                  stackId="1"
                  stroke="#22c55e"
                  fill="#22c55e"
                  fillOpacity={0.4}
                  name="Runtime (min)"
                />
                <Area
                  type="monotone"
                  dataKey="downtime"
                  stackId="2"
                  stroke="#ef4444"
                  fill="#ef4444"
                  fillOpacity={0.4}
                  name="Downtime (min)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Production Trends">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={trends} {...chartProps}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="production"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name="Production Count"
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Efficiency Trends">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={trends} {...chartProps}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} unit="%" />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="efficiency"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name="Efficiency %"
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Temperature Trends">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={trends} {...chartProps}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} unit="°C" />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="temperature"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name="Avg Temp (°C)"
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="card">
      <h3 className="font-semibold mb-4">{title}</h3>
      {children}
    </div>
  );
}

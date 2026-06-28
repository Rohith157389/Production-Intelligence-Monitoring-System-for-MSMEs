import { useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const severityColors = {
  info: 'bg-blue-100 text-blue-700',
  warning: 'bg-amber-100 text-amber-700',
  critical: 'bg-red-100 text-red-700',
};

const typeLabels = {
  high_temperature: 'High Temperature',
  voltage_drop: 'Voltage Drop',
  overload: 'Overload',
  production_stoppage: 'Production Stoppage',
  low_efficiency: 'Low Efficiency',
};

export default function Alerts() {
  const { isAdmin } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [filter, setFilter] = useState('unacknowledged');
  const [loading, setLoading] = useState(true);

  const fetchAlerts = async () => {
    try {
      const params =
        filter === 'all'
          ? {}
          : { acknowledged: filter === 'acknowledged' ? 'true' : 'false' };
      const res = await api.get('/alerts', { params: { ...params, limit: 100 } });
      setAlerts(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchAlerts();
  }, [filter]);

  const acknowledge = async (id) => {
    await api.patch(`/alerts/${id}/acknowledge`);
    fetchAlerts();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Alerts</h1>
          <p className="text-gray-500 text-sm mt-1">
            Real-time notifications for critical and warning events
          </p>
        </div>
        <div className="flex gap-2">
          {['unacknowledged', 'acknowledged', 'all'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded text-sm ${
                filter === f
                  ? 'bg-gray-800 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading alerts...</div>
        ) : alerts.length === 0 ? (
          <div className="card text-center py-12 text-gray-500">No alerts found</div>
        ) : (
          <div className="space-y-3">
            {alerts.map((a) => (
              <div
                key={a.id}
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border-l-4 ${
                  severityColors[a.severity] || severityColors.warning
                } bg-white border border-gray-200 shadow-sm ${
                  a.is_acknowledged ? 'opacity-60' : ''
                }`}
              >
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 uppercase">
                      {a.severity}
                    </span>
                    <span className="font-semibold text-gray-900">{typeLabels[a.alert_type] || a.alert_type}</span>
                    {a.machine_name && <span className="text-xs text-gray-500">{a.machine_name}</span>}
                  </div>
                  <p className="text-sm text-gray-700">{a.message}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(a.created_at).toLocaleString()}
                  </p>
                </div>
                {isAdmin && !a.is_acknowledged && (
                  <button onClick={() => acknowledge(a.id)} className="btn-secondary text-sm shrink-0">
                    Acknowledge
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

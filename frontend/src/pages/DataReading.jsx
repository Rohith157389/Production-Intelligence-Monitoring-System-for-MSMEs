import { useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function DataReading() {
  const [machines, setMachines] = useState([]);
  const [recentReadings, setRecentReadings] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [machRes, readRes] = await Promise.all([
        api.get('/machines'),
        api.get('/sensor-readings', { params: { limit: 20 } })
      ]);
      
      const parsedMachines = machRes.data.map(m => ({
        ...m,
        parameters: (typeof m.parameters === 'string' ? JSON.parse(m.parameters) : m.parameters) || {}
      }));
      setMachines(parsedMachines);
      setRecentReadings(readRes.data);
    } catch (err) {
      console.error('Failed to load data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      api.get('/sensor-readings', { params: { limit: 20 } }).then(res => setRecentReadings(res.data));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleParameter = async (machineId, param, currentValue) => {
    const machine = machines.find(m => m.id === machineId);
    if (!machine) return;

    const updatedParams = { ...machine.parameters, [param]: !currentValue };
    setMachines(machines.map(m => m.id === machineId ? { ...m, parameters: updatedParams } : m));

    try {
      await api.put(`/machines/${machineId}`, { parameters: updatedParams });
    } catch (err) {
      alert('Failed to save parameter changes.');
      setMachines(machines.map(m => m.id === machineId ? { ...m, parameters: machine.parameters } : m));
    }
  };

  const getParamLabel = (key) => {
    const labels = {
      current: 'Current',
      voltage: 'Voltage',
      temperature: 'Temperature',
      vibration: 'Vibration',
      objectCount: 'Object Count'
    };
    return labels[key] || key;
  };

  return (
    <div className="space-y-6">
      <div className="mb-6 flex justify-between items-center border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            Data Reading
            <span className="relative flex h-3 w-3">
              {recentReadings.length > 0 ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </>
              ) : (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </>
              )}
            </span>
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Configure machine sensor parameters and view the live telemetry feed.
          </p>
        </div>
      </div>

      {/* PARAMETER CONFIGURATION SECTION */}
      <div className="ind-panel mb-8">
          <h3 className="font-semibold text-lg mb-4">Machine Sensor Parameters</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {machines.map((m) => (
              <div key={m.id} className="p-4 rounded-xl border border-gray-200 bg-white shadow-sm">
                <h3 className="font-bold text-gray-900 mb-2">{m.machine_name}</h3>
                <div className="flex flex-col gap-y-2">
                  {['current', 'voltage', 'temperature', 'vibration', 'objectCount'].map((param) => {
                    const isChecked = m.parameters[param] || false;
                    return (
                      <label key={param} className="flex items-center space-x-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleParameter(m.id, param, isChecked)}
                          className="w-4 h-4 rounded border-gray-300 bg-white text-indigo-600 focus:ring-indigo-500 transition-colors"
                        />
                        <span className={`text-sm transition-colors ${isChecked ? 'text-gray-900 font-medium' : 'text-gray-500 group-hover:text-gray-700'}`}>
                          {getParamLabel(param)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

      {/* LIVE FEED SECTION */}
      <div className="ind-panel">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-semibold text-lg">Incoming Data</h3>
          <div className="flex items-center gap-3">
            <button 
                onClick={async () => {
                  if (machines.length === 0) return alert('No machines available');
                  const m = machines[0];
                  try {
                    await api.post('/sensor-data', {
                      machineId: m.machine_id,
                      current: Math.random() * 20 + 5,
                      voltage: Math.random() * 20 + 220,
                      temperature: Math.random() * 30 + 40,
                      vibration: Math.random() * 5,
                      objectCount: Math.floor(Math.random() * 10) + 100
                    });
                    fetchData();
                  } catch (e) {
                    alert('Simulation failed');
                  }
                }}
                className="btn-primary text-xs px-3 py-1.5"
              >
                Simulate Data (Test)
              </button>
              <button 
                onClick={fetchData}
                className="btn-secondary text-xs px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50"
              >
                Refresh
              </button>
            <span className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-full font-medium border border-gray-200">
              Auto-refreshing (1s)
            </span>
          </div>
        </div>
        
        {loading ? (
          <div className="text-center py-12 text-gray-500">Connecting to IoT stream...</div>
        ) : recentReadings.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-lg">
            <span className="text-4xl block mb-2">📡</span>
            <p className="text-gray-500 font-medium">Listening for IoT Data...</p>
            <p className="text-gray-400 text-xs mt-1">No readings have been received from sensors yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {recentReadings.map((r) => {
              // Find the machine to know which parameters are tracked
              const m = machines.find(mac => mac.machine_id === r.machine_id) || {};
              const params = m.parameters || { current: true, voltage: true, temperature: true, vibration: true, objectCount: true };

              return (
              <div
                key={r.id}
                className="p-4 rounded-xl border border-gray-200 bg-white shadow-sm relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500"></div>
                
                {/* Machine Name & Time */}
                <div className="flex items-center gap-3 min-w-[200px]">
                  <div>
                    <span className="font-bold text-gray-900 block text-base">{r.machine_name}</span>
                    <span className="text-[10px] text-gray-400 font-mono bg-gray-50 px-2 py-0.5 rounded border border-gray-100 whitespace-nowrap">
                      {new Date(r.recorded_at).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
                
                {/* Active Parameters in a horizontal list */}
                <div className="flex-1 flex flex-wrap gap-3">
                  {params.current && (
                    <div className="bg-gray-50 px-3 py-1.5 rounded border border-gray-100 flex items-center gap-2">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Current:</span>
                      <span className="font-mono text-gray-800 font-semibold">{r.current_ampere} <span className="text-xs text-gray-500">A</span></span>
                    </div>
                  )}
                  {params.voltage && (
                    <div className="bg-gray-50 px-3 py-1.5 rounded border border-gray-100 flex items-center gap-2">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Voltage:</span>
                      <span className="font-mono text-gray-800 font-semibold">{r.voltage_volt} <span className="text-xs text-gray-500">V</span></span>
                    </div>
                  )}
                  {params.temperature && (
                    <div className="bg-gray-50 px-3 py-1.5 rounded border border-gray-100 flex items-center gap-2">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Temp:</span>
                      <span className="font-mono text-gray-800 font-semibold">{r.temperature_celsius} <span className="text-xs text-gray-500">°C</span></span>
                    </div>
                  )}
                  {params.vibration && (
                    <div className="bg-gray-50 px-3 py-1.5 rounded border border-gray-100 flex items-center gap-2">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Vibe:</span>
                      <span className="font-mono text-gray-800 font-semibold">{r.vibration_mm_s || 0} <span className="text-xs text-gray-500">mm/s</span></span>
                    </div>
                  )}
                  {params.objectCount && (
                    <div className="bg-gray-50 px-3 py-1.5 rounded border border-gray-100 flex items-center gap-2">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Count:</span>
                      <span className="font-mono text-gray-800 font-semibold">{r.object_count}</span>
                    </div>
                  )}
                </div>
                
                {/* Source */}
                <div className="flex items-center gap-2 md:self-center">
                  <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Source</span>
                  <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold capitalize">
                    {r.source || 'IoT Device'}
                  </span>
                </div>
              </div>
            )})}
          </div>
        )}
      </div>
    </div>
  );
}

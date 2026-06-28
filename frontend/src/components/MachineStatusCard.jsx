const STATUS_CONFIG = {
  running: { label: 'Running', color: 'border-emerald-500 bg-emerald-50', dot: 'bg-emerald-500', text: 'text-emerald-800' },
  idle: { label: 'Idle', color: 'border-amber-400 bg-amber-50', dot: 'bg-amber-400', text: 'text-amber-800' },
  stopped: { label: 'Stopped', color: 'border-red-500 bg-red-50', dot: 'bg-red-500', text: 'text-red-800' },
  overload: { label: 'Overload', color: 'border-orange-500 bg-orange-50', dot: 'bg-orange-500', text: 'text-orange-800' },
  power_issue: { label: 'Power Issue', color: 'border-blue-500 bg-blue-50', dot: 'bg-blue-500', text: 'text-blue-800' },
};

export default function MachineStatusCard({ machine }) {
  const cfg = STATUS_CONFIG[machine.status] || STATUS_CONFIG.stopped;

  return (
    <div className={`rounded-xl border-2 p-4 ${cfg.color} transition-shadow hover:shadow-md`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-slate-900">{machine.machineName}</h3>
          <p className="text-xs text-slate-500 font-mono">{machine.machineId}</p>
        </div>
        <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.text} bg-white`}>
          <span className={`w-2 h-2 rounded-full ${cfg.dot} animate-pulse`} />
          {cfg.label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <Metric label="Voltage" value={`${machine.currentVoltage} V`} />
        <Metric label="Temp" value={`${machine.currentTemperature}°C`} />
        <Metric label="Current" value={`${machine.currentAmpere} A`} />
        <Metric label="Production" value={machine.productionCount} />
      </div>

      <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-black/5">
        Last updated:{' '}
        {machine.lastUpdated
          ? new Date(machine.lastUpdated).toLocaleString()
          : 'No data'}
      </p>
      {machine.hasActiveAlert && (
        <p className="text-xs font-medium text-red-600 mt-1">Active alert</p>
      )}
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="bg-white rounded-lg px-2 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="font-semibold text-slate-900">{value}</p>
    </div>
  );
}

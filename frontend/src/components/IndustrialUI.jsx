import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

export const THEME = {
  bg: '#F9FAFB',       // Gray 50
  card: '#FFFFFF',     // White
  border: '#E5E7EB',   // Gray 200
  accent: '#374151',   // Gray 700
  healthy: '#22C55E',  // Green 500
  warn: '#F59E0B',     // Amber 500
  critical: '#EF4444', // Red 500
  text: '#111827',     // Gray 900
  muted: '#6B7280',    // Gray 500
  grid: '#E5E7EB',     // Gray 200
};

export const CHART_COLORS = ['#6366F1', '#14B8A6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#3B82F6'];

export function NoData({ height = 200, message = 'No Data Available' }) {
  return (
    <div
      className="flex items-center justify-center rounded-lg border border-dashed text-sm"
      style={{ height, borderColor: THEME.border, color: THEME.muted, background: `${THEME.bg}80` }}
    >
      {message}
    </div>
  );
}

export function ChartBox({ hasData, height = 220, children, message }) {
  if (!hasData) return <NoData height={height} message={message} />;
  return <div style={{ height, minHeight: height }}>{children}</div>;
}

export function SemiGauge({ value, max = 100, label, color = THEME.accent, size = 180 }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const data = [
    { value: pct || 0.5 },
    { value: 100 - (pct || 0.5) },
  ];

  return (
    <div className="flex flex-col items-center">
      <div style={{ width: size, height: size * 0.55 }} className="relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="90%"
              startAngle={180}
              endAngle={0}
              innerRadius="55%"
              outerRadius="90%"
              dataKey="value"
              stroke="none"
            >
              <Cell fill={color} />
              <Cell fill={THEME.border} />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute bottom-2 left-0 right-0 text-center">
          <span className="text-3xl font-bold font-mono" style={{ color: THEME.text }}>{Math.round(value)}</span>
          <span className="text-sm ml-0.5" style={{ color: THEME.muted }}>%</span>
        </div>
      </div>
      {label && <p className="text-xs mt-1 uppercase tracking-wide font-medium" style={{ color: THEME.muted }}>{label}</p>}
    </div>
  );
}

export function CircularGauge({ value, max = 100, label, color = THEME.accent, size = 160 }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const data = [{ value: pct || 0.5 }, { value: 100 - (pct || 0.5) }];

  return (
    <div className="flex flex-col items-center">
      <div style={{ width: size, height: size }} className="relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              startAngle={220}
              endAngle={-40}
              innerRadius="68%"
              outerRadius="95%"
              dataKey="value"
              stroke="none"
            >
              <Cell fill={color} />
              <Cell fill={THEME.border} />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
          <span className="text-2xl font-bold font-mono" style={{ color: THEME.text }}>{Math.round(value)}</span>
          <span className="text-[10px]" style={{ color: THEME.muted }}>/ {max}</span>
        </div>
      </div>
      {label && <p className="text-xs font-medium mt-1" style={{ color: THEME.muted }}>{label}</p>}
    </div>
  );
}

export function KPICard({ label, value, unit, color = THEME.accent }) {
  return (
    <div
      className="rounded-lg p-3 border-l-4 flex flex-col justify-center items-center text-center min-h-[120px] gap-2 overflow-hidden"
      style={{ background: THEME.card, borderColor: THEME.border, borderLeftColor: color }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider leading-snug w-full" style={{ color: THEME.muted }}>
        {label}
      </p>
      <p className="text-lg xl:text-xl font-bold font-mono leading-tight w-full break-all px-1" style={{ color: THEME.text }}>
        {value}
        {unit && <span className="text-xs ml-1 font-medium" style={{ color: THEME.muted }}>{unit}</span>}
      </p>
    </div>
  );
}

export function AnalyticsPanel({ title, children, linkTo, metrics }) {
  return (
    <div className="rounded-lg border p-4 lg:p-5" style={{ background: THEME.card, borderColor: THEME.border }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: THEME.accent }}>
          {title}
        </h3>
        {linkTo && (
          <Link to={linkTo} className="text-xs font-medium hover:underline" style={{ color: THEME.accent }}>
            View Detailed Analysis →
          </Link>
        )}
      </div>
      {metrics && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          {metrics.map((m) => (
            <div key={m.label} className="rounded p-2 text-center flex flex-col justify-center overflow-hidden border" style={{ background: THEME.bg, borderColor: THEME.border }}>
              <p className="text-[9px] font-semibold uppercase leading-tight truncate" title={m.label} style={{ color: THEME.muted }}>{m.label}</p>
              <p className="text-sm font-bold font-mono mt-1 truncate" style={{ color: THEME.text }}>{m.value}</p>
            </div>
          ))}
        </div>
      )}
      {children}
    </div>
  );
}

export const tooltipStyle = {
  contentStyle: { background: THEME.card, border: `1px solid ${THEME.border}`, borderRadius: 8, color: THEME.text, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' },
  labelStyle: { color: THEME.muted, fontWeight: 'bold' },
};

import { useCallback, useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import api from '../api/client';
import {
  SemiGauge,
  CircularGauge,
  KPICard,
  AnalyticsPanel,
  ChartBox,
  NoData,
  THEME,
  CHART_COLORS,
  tooltipStyle,
} from '../components/IndustrialUI';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const load = useCallback(async () => {
    try {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - days);
      const res = await api.get('/intelligence/dashboard', {
        params: { startDate: start.toISOString(), endDate: end.toISOString() },
      });
      setData(res.data);
      setLastUpdated(new Date());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    setLoading(true);
    load();
    const interval = setInterval(load, 15000);
    const onRefresh = () => load();
    window.addEventListener('pims-refresh', onRefresh);
    window.addEventListener('focus', onRefresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener('pims-refresh', onRefresh);
      window.removeEventListener('focus', onRefresh);
    };
  }, [load]);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: THEME.accent, borderTopColor: 'transparent' }} />
        <p className="text-sm" style={{ color: THEME.muted }}>Loading factory intelligence...</p>
      </div>
    );
  }

  const fb = data?.factoryBar || {};
  const s = data?.sections || {};
  const trends = data?.trends || [];
  const timeline = data?.timeline || [];
  const hasData = data?.hasData;
  const H = 240;

  return (
    <div className="space-y-4 pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Factory Overview</h1>
          <p className="text-gray-500 text-sm mt-1">Real-time status of all production lines</p>
          <p className="text-xs mt-1" style={{ color: THEME.muted }}>
            {data?.machineCount || 0} machines · {data?.totalReadings || 0} records
            {lastUpdated && ` · Updated ${lastUpdated.toLocaleTimeString()}`}
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white p-1.5 rounded-lg border border-gray-200 shadow-sm transition-colors">
          <button onClick={load} className="btn-secondary text-xs px-3 py-1.5">Refresh</button>
          <select className="input-field w-36 text-sm" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={1}>Last 24 Hours</option>
            <option value={7}>Last 7 Days</option>
            <option value={14}>Last 14 Days</option>
            <option value={30}>Last 30 Days</option>
          </select>
        </div>
      </div>

      {/* TOP FACTORY PERFORMANCE BAR */}
      <section>
        <p className="text-[10px] uppercase tracking-widest mb-2 font-semibold" style={{ color: THEME.muted }}>
          Factory Performance
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2">
          <KPICard label="Target Production" value={fb.targetProduction ?? 0} color={THEME.muted} />
          <KPICard label="Actual Production" value={fb.actualProduction ?? 0} color={THEME.healthy} />
          <KPICard label="Target Achievement" value={`${fb.targetAchievementPercent ?? 0}%`} color={THEME.accent} />
          <KPICard label="Current Shift" value={fb.currentShift?.split(' ')[0] || '—'} unit="" color={THEME.accent} />
          <KPICard label="Machine Status" value={fb.machineStatus?.split('/')[0]?.trim() || '—'} color={THEME.healthy} />
          <KPICard label="Efficiency" value={`${fb.productionEfficiency ?? 0}%`} color={THEME.accent} />
          <KPICard label="Production Gap" value={fb.productionGap ?? 0} unit="units" color={THEME.warn} />
          <KPICard label="Power Quality" value={fb.powerQualityScore ?? 0} unit="/100" color={THEME.accent} />
        </div>
      </section>

      {/* ANALYTICS GRID */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Efficiency */}
        <AnalyticsPanel
          title="Production Efficiency"
          linkTo="/analysis/efficiency"
          metrics={[
            { label: 'Efficiency', value: `${s.efficiency?.efficiencyPercent ?? 0}%` },
            { label: 'Target', value: s.efficiency?.targetProduction ?? 0 },
            { label: 'Gap', value: s.efficiency?.productionGap ?? 0 },
          ]}
        >
          <div className="grid grid-cols-2 gap-3">
            <ChartBox hasData={s.efficiency?.hasData} height={H}>
              <SemiGauge value={s.efficiency?.efficiencyPercent ?? 0} label="Efficiency %" color={gaugeColor(s.efficiency?.efficiencyPercent)} size={200} />
            </ChartBox>
            <ChartBox hasData={(s.efficiency?.targetVsActual?.length ?? 0) > 0} height={H}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={s.efficiency?.targetVsActual || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke={THEME.grid} />
                  <XAxis dataKey="name" tick={{ fill: THEME.muted, fontSize: 10 }} />
                  <YAxis tick={{ fill: THEME.muted, fontSize: 10 }} />
                  <Tooltip {...tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="target" fill="#94a3b8" name="Target" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="actual" fill={THEME.accent} name="Actual" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartBox>
          </div>
          <ChartBox hasData={(s.efficiency?.trend?.length ?? 0) > 0} height={120} message="Need more historical entries for trend">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={s.efficiency?.trend || []}>
                <CartesianGrid stroke={THEME.grid} strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: THEME.muted, fontSize: 9 }} />
                <YAxis tick={{ fill: THEME.muted, fontSize: 9 }} />
                <Tooltip {...tooltipStyle} />
                <Line type="monotone" dataKey="value" stroke={THEME.accent} strokeWidth={2} dot={{ r: 3 }} name="Efficiency %" />
              </LineChart>
            </ResponsiveContainer>
          </ChartBox>
        </AnalyticsPanel>

        {/* Idle */}
        <AnalyticsPanel
          title="Machine Idle Time"
          linkTo="/analysis/idle"
          metrics={[
            { label: 'Duration', value: `${s.idle?.idleDurationMinutes ?? 0} min` },
            { label: 'Events', value: s.idle?.idleEvents ?? 0 },
            { label: 'Idle %', value: `${s.idle?.idlePercentage ?? 0}%` },
          ]}
        >
          <div className="grid grid-cols-2 gap-3">
            <ChartBox hasData={!!s.idle?.donut} height={H}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={s.idle?.donut} cx="50%" cy="50%" innerRadius={45} outerRadius={65} dataKey="value" stroke="none">
                    <Cell fill={THEME.healthy} />
                    <Cell fill={THEME.warn} />
                  </Pie>
                  <Tooltip {...tooltipStyle} />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartBox>
            <ChartBox hasData={(s.idle?.byMachine?.length ?? 0) > 0 && hasData} height={H}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={s.idle?.byMachine || []}>
                  <CartesianGrid stroke={THEME.grid} strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fill: THEME.muted, fontSize: 9 }} />
                  <YAxis tick={{ fill: THEME.muted, fontSize: 9 }} />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="idle" fill={THEME.warn} name="Idle (min)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="events" fill={THEME.critical} name="Events" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartBox>
          </div>
          <ChartBox hasData={(s.idle?.trend?.length ?? 0) > 0} height={120}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={s.idle?.trend || []}>
                <CartesianGrid stroke={THEME.grid} strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fill: THEME.muted, fontSize: 9 }} />
                <YAxis tick={{ fill: THEME.muted, fontSize: 9 }} />
                <Tooltip {...tooltipStyle} />
                <Line type="monotone" dataKey="value" stroke={THEME.warn} strokeWidth={2} dot={false} name="Idle (min)" />
              </LineChart>
            </ResponsiveContainer>
          </ChartBox>
        </AnalyticsPanel>

        {/* Overload */}
        <AnalyticsPanel
          title="Machine Overload"
          linkTo="/analysis/overload"
          metrics={[
            { label: 'Max Current', value: `${s.overload?.maximumCurrent ?? 0}A` },
            { label: 'Rated', value: `${Math.round(s.overload?.ratedCurrent ?? 0)}A` },
            { label: 'Events', value: s.overload?.overloadEvents ?? 0 },
          ]}
        >
          <div className="grid grid-cols-2 gap-3">
            <ChartBox hasData={s.overload?.hasData} height={H}>
              <SemiGauge value={s.overload?.currentUtilizationPercent ?? 0} label="Utilization %" color={s.overload?.currentUtilizationPercent > 100 ? THEME.critical : THEME.warn} size={200} />
            </ChartBox>
            <ChartBox hasData={(s.overload?.byMachine?.length ?? 0) > 0 && hasData} height={H}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={s.overload?.byMachine || []}>
                  <XAxis dataKey="name" tick={{ fill: THEME.muted, fontSize: 9 }} />
                  <YAxis tick={{ fill: THEME.muted, fontSize: 9 }} />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="events" fill={THEME.critical} name="Events" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartBox>
          </div>
          <ChartBox hasData={(s.overload?.trend?.length ?? 0) > 0} height={120}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={s.overload?.trend || []}>
                <XAxis dataKey="date" tick={{ fill: THEME.muted, fontSize: 9 }} />
                <YAxis tick={{ fill: THEME.muted, fontSize: 9 }} />
                <Tooltip {...tooltipStyle} />
                <Line type="monotone" dataKey="value" stroke={THEME.critical} strokeWidth={2} dot={false} name="Utilization %" />
              </LineChart>
            </ResponsiveContainer>
          </ChartBox>
        </AnalyticsPanel>

        {/* Stoppage */}
        <AnalyticsPanel
          title="Production Stoppage"
          linkTo="/analysis/stoppage"
          metrics={[
            { label: 'Stoppages', value: s.stoppage?.stoppageEvents ?? 0 },
            { label: 'Longest', value: `${s.stoppage?.longestStoppageMinutes ?? 0} min` },
            { label: 'Total', value: `${s.stoppage?.totalStoppageDurationMinutes ?? 0} min` },
          ]}
        >
          <div className="grid grid-cols-2 gap-3">
            <ChartBox hasData={!!s.stoppage?.runningVsStopped} height={H}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={s.stoppage?.runningVsStopped} cx="50%" cy="50%" outerRadius={70} dataKey="value" stroke="none">
                    {s.stoppage?.runningVsStopped?.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? THEME.healthy : THEME.critical} />
                    ))}
                  </Pie>
                  <Tooltip {...tooltipStyle} />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartBox>
            <ChartBox hasData={(s.stoppage?.byMachine?.length ?? 0) > 0 && hasData} height={H}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={s.stoppage?.byMachine || []}>
                  <XAxis dataKey="name" tick={{ fill: THEME.muted, fontSize: 9 }} />
                  <YAxis tick={{ fill: THEME.muted, fontSize: 9 }} />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="duration" fill={THEME.critical} name="Duration (min)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartBox>
          </div>
        </AnalyticsPanel>

        {/* Interruption */}
        <AnalyticsPanel
          title="Production Interruptions"
          linkTo="/analysis/interruption"
          metrics={[
            { label: 'Events', value: s.interruption?.delayEvents ?? 0 },
            { label: 'Avg Delay', value: `${s.interruption?.averageDelaySeconds ?? 0}s` },
            { label: 'Lost', value: s.interruption?.lostProductionQuantity ?? 0 },
          ]}
        >
          <div className="grid grid-cols-2 gap-3">
            <ChartBox hasData={s.interruption?.hasData} height={H}>
              <SemiGauge value={Math.min(100, s.interruption?.averageDelaySeconds ?? 0)} max={120} label="Avg Delay (s)" color={THEME.warn} size={200} />
            </ChartBox>
            <ChartBox hasData={(s.interruption?.cycleComparison?.length ?? 0) > 0} height={H} message="Need 2+ readings with production increase">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={s.interruption?.cycleComparison || []}>
                  <XAxis dataKey="name" tick={{ fill: THEME.muted, fontSize: 9 }} />
                  <YAxis tick={{ fill: THEME.muted, fontSize: 9 }} />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="expected" fill="#94a3b8" name="Expected (s)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="actual" fill={THEME.warn} name="Actual (s)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartBox>
          </div>
        </AnalyticsPanel>

        {/* Power Quality */}
        <AnalyticsPanel
          title="Power Quality"
          linkTo="/analysis/power"
          metrics={[
            { label: 'Failures', value: s.power?.powerFailures ?? 0 },
            { label: 'V Drops', value: s.power?.voltageDrops ?? 0 },
            { label: 'PQ Score', value: s.power?.powerQualityScore ?? 0 },
          ]}
        >
          <div className="grid grid-cols-2 gap-3">
            <ChartBox hasData={s.power?.hasData} height={H}>
              <CircularGauge value={s.power?.powerQualityScore ?? 0} label="Power Quality" color={THEME.accent} />
            </ChartBox>
            <ChartBox hasData={!!s.power?.pie} height={H}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={s.power?.pie} cx="50%" cy="50%" outerRadius={70} dataKey="value" stroke="none">
                    {s.power?.pie?.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip {...tooltipStyle} />
                  <Legend verticalAlign="bottom" height={48} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartBox>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <ChartBox hasData={(s.power?.voltageTrend?.length ?? 0) > 0} height={110}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={s.power?.voltageTrend || []}>
                  <XAxis dataKey="date" tick={{ fill: THEME.muted, fontSize: 8 }} />
                  <YAxis tick={{ fill: THEME.muted, fontSize: 8 }} domain={['auto', 'auto']} />
                  <Tooltip {...tooltipStyle} />
                  <Line type="monotone" dataKey="value" stroke={THEME.accent} strokeWidth={2} dot={false} name="Voltage (V)" />
                </LineChart>
              </ResponsiveContainer>
            </ChartBox>
            <ChartBox hasData={(s.power?.currentTrend?.length ?? 0) > 0} height={110}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={s.power?.currentTrend || []}>
                  <XAxis dataKey="date" tick={{ fill: THEME.muted, fontSize: 8 }} />
                  <YAxis tick={{ fill: THEME.muted, fontSize: 8 }} />
                  <Tooltip {...tooltipStyle} />
                  <Line type="monotone" dataKey="value" stroke={THEME.warn} strokeWidth={2} dot={false} name="Current (A)" />
                </LineChart>
              </ResponsiveContainer>
            </ChartBox>
          </div>
        </AnalyticsPanel>
      </div>

      {/* BOTTOM FACTORY ANALYTICS */}
      <section className="rounded-lg border p-4" style={{ background: THEME.card, borderColor: THEME.border }}>
        <h3 className="font-semibold text-gray-900 mb-4">Production Trend (Past 12h)</h3>
        {!hasData || trends.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-slate-500 mb-4">No live data available from sensors.</p>
            <button onClick={load} className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors">
              Refresh Live Readings
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <FactoryTrend title="Production" data={trends} dataKey="production" color={THEME.accent} />
            <FactoryTrend title="Efficiency" data={trends} dataKey="efficiency" color={THEME.healthy} />
            <FactoryTrend title="Idle Time" data={trends} dataKey="idle" color={THEME.warn} />
            <FactoryTrend title="Stoppage" data={trends} dataKey="stoppage" color={THEME.critical} />
            <FactoryTrend title="Overload Events" data={trends} dataKey="overload" color={THEME.critical} />
            <FactoryTrend title="Power Issues" data={trends} dataKey="powerIssues" color={THEME.accent} />
          </div>
        )}
      </section>

      {/* EVENT TIMELINE */}
      <section className="rounded-lg border p-4" style={{ background: THEME.card, borderColor: THEME.border }}>
        <h3 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: THEME.accent }}>
          Event Timeline
        </h3>
        {!hasData || timeline.length === 0 ? (
          <NoData height={80} message="No events detected in this period" />
        ) : (
          <div className="space-y-0 max-h-80 overflow-y-auto">
            {timeline.map((ev, i) => (
              <div key={ev.id || i} className="flex gap-4 py-3 border-b last:border-0" style={{ borderColor: THEME.border }}>
                <span className="w-20 shrink-0 font-mono text-sm font-bold" style={{ color: THEME.accent }}>{ev.time}</span>
                <span className="text-sm text-gray-900">{ev.label}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function FactoryTrend({ title, data, dataKey, color }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide mb-2" style={{ color: THEME.muted }}>{title}</p>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={data}>
          <CartesianGrid stroke={THEME.grid} strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fill: THEME.muted, fontSize: 8 }} />
          <YAxis tick={{ fill: THEME.muted, fontSize: 8 }} />
          <Tooltip {...tooltipStyle} />
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={{ r: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function gaugeColor(pct) {
  if (pct >= 80) return THEME.healthy;
  if (pct >= 50) return THEME.warn;
  return THEME.critical;
}

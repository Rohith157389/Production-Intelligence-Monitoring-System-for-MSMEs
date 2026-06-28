const { query } = require('../config/db');
const {
  isRunning,
  isStopped,
  computeIntervals,
  getMachineReadings,
  getMachineMetrics,
} = require('./metricsService');

function isIdle(reading, previousReading) {
  if (!reading || !previousReading) return false;
  return (
    isRunning(reading) &&
    isRunning(previousReading) &&
    Number(reading.object_count) <= Number(previousReading.object_count)
  );
}

function deriveMachineStatus(latest, previous, activeAlertTypes) {
  if (activeAlertTypes.includes('overload')) return 'overload';
  if (activeAlertTypes.includes('power_issue') || activeAlertTypes.includes('voltage_drop')) {
    return 'power_issue';
  }
  if (!latest) return 'stopped';
  if (isIdle(latest, previous)) return 'idle';
  if (isRunning(latest)) return 'running';
  if (isStopped(latest)) return 'stopped';
  return 'stopped';
}

function formatTime(date) {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatTimelineMessage(event) {
  const name = event.machine_name || event.machine_code || 'Machine';
  const time = formatTime(event.recorded_at || event.created_at);

  const templates = {
    overload: `${name} — Overload Detected`,
    power_issue: `${name} — Power Issue Detected`,
    production_stoppage: `${name} — Production Stoppage`,
    high_temperature: `${name} — High Temperature Alert`,
    voltage_drop: `${name} — Voltage Drop Detected`,
    low_efficiency: `${name} — Low Production Efficiency`,
    idle: `${name} entered Idle State`,
    running: `${name} Resumed Production`,
    stopped: `${name} — Machine Stopped`,
  };

  const label = templates[event.event_type || event.alert_type] || `${name} — ${event.event_type}`;
  return { time, label, timestamp: event.recorded_at || event.created_at, machineName: name };
}

async function getLatestReadingPair(machineId) {
  const res = await query(
    `SELECT * FROM sensor_readings WHERE machine_id = $1 ORDER BY recorded_at DESC LIMIT 2`,
    [machineId]
  );
  return { latest: res.rows[0], previous: res.rows[1] };
}

async function getMachineBoard(startDate, endDate, industryFilter) {
  let sql = 'SELECT * FROM machines WHERE is_active = true';
  const params = [];
  if (industryFilter) {
    params.push(industryFilter);
    sql += ` AND industry_name = $${params.length}`;
  }
  sql += ' ORDER BY machine_name';
  const machinesRes = await query(sql, params);
  const board = [];

  for (const machine of machinesRes.rows) {
    const { latest, previous } = await getLatestReadingPair(machine.id);

    const alertsRes = await query(
      `SELECT alert_type FROM alerts
       WHERE machine_id = $1 AND is_acknowledged = false`,
      [machine.id]
    );
    const alertTypes = alertsRes.rows.map((a) => a.alert_type);

    const recentEvents = await query(
      `SELECT event_type FROM events
       WHERE machine_id = $1 AND recorded_at >= NOW() - INTERVAL '2 hours'
       ORDER BY recorded_at DESC LIMIT 1`,
      [machine.id]
    );
    if (recentEvents.rows[0]?.event_type === 'overload') alertTypes.push('overload');
    if (recentEvents.rows[0]?.event_type === 'power_issue') alertTypes.push('power_issue');

    const status = deriveMachineStatus(latest, previous, [...new Set(alertTypes)]);
    const metrics = await getMachineMetrics(machine.id, startDate, endDate);

    board.push({
      id: machine.id,
      machineId: machine.machine_id,
      machineName: machine.machine_name,
      department: machine.department,
      status,
      currentVoltage: latest ? Number(latest.voltage_volt) : 0,
      currentTemperature: latest ? Number(latest.temperature_celsius) : 0,
      currentAmpere: latest ? Number(latest.current_ampere) : 0,
      productionCount: latest ? Number(latest.object_count) : 0,
      lastUpdated: latest?.recorded_at || null,
      hasActiveAlert: alertTypes.length > 0,
      efficiency: metrics?.productionEfficiency || 0,
    });
  }

  return board;
}

async function getEventTimeline(startDate, endDate, limit = 50, industryFilter) {
  const params = [];
  let eventSql = `
    SELECT e.*, m.machine_name, m.machine_id as machine_code
    FROM events e
    JOIN machines m ON m.id = e.machine_id
    WHERE 1=1
  `;
  let alertSql = `
    SELECT a.*, m.machine_name, m.machine_id as machine_code
    FROM alerts a
    LEFT JOIN machines m ON m.id = a.machine_id
    WHERE 1=1
  `;

  if (industryFilter) {
    params.push(industryFilter);
    eventSql += ` AND m.industry_name = $${params.length}`;
    alertSql += ` AND m.industry_name = $${params.length}`;
  }

  if (startDate) {
    params.push(startDate);
    eventSql += ` AND e.recorded_at >= $${params.length}`;
    alertSql += ` AND a.created_at >= $${params.length}`;
  }
  if (endDate) {
    params.push(endDate);
    eventSql += ` AND e.recorded_at <= $${params.length}`;
    alertSql += ` AND a.created_at <= $${params.length}`;
  }

  eventSql += ' ORDER BY e.recorded_at DESC LIMIT 30';
  alertSql += ' ORDER BY a.created_at DESC LIMIT 30';

  const [eventsRes, alertsRes] = await Promise.all([
    query(eventSql, params),
    query(alertSql, params),
  ]);

  const timeline = [];

  eventsRes.rows.forEach((e) => {
    const formatted = formatTimelineMessage(e);
    timeline.push({
      id: e.id,
      type: 'event',
      eventType: e.event_type,
      ...formatted,
      details: typeof e.details === 'string' ? JSON.parse(e.details || '{}') : e.details || {},
    });
  });

  alertsRes.rows.forEach((a) => {
    const formatted = formatTimelineMessage(a);
    timeline.push({
      id: a.id,
      type: 'alert',
      eventType: a.alert_type,
      ...formatted,
      severity: a.severity,
    });
  });

  let mSql = 'SELECT id, machine_name, machine_id FROM machines WHERE is_active = true';
  const mParams = [];
  if (industryFilter) {
    mParams.push(industryFilter);
    mSql += ` AND industry_name = $${mParams.length}`;
  }
  const machinesRes = await query(mSql, mParams);
  for (const m of machinesRes.rows) {
    const readings = await getMachineReadings(m.id, startDate, endDate);
    for (let i = 1; i < readings.length; i++) {
      const prev = readings[i - 1];
      const curr = readings[i];
      if (isIdle(curr, prev) && !isIdle(prev, readings[i - 2] || prev)) {
        timeline.push({
          id: `idle-${m.id}-${curr.recorded_at}`,
          type: 'derived',
          eventType: 'idle',
          time: formatTime(curr.recorded_at),
          label: `${m.machine_name} entered Idle State`,
          timestamp: curr.recorded_at,
          machineName: m.machine_name,
        });
      }
      if (isRunning(curr) && isStopped(prev)) {
        timeline.push({
          id: `resume-${m.id}-${curr.recorded_at}`,
          type: 'derived',
          eventType: 'running',
          time: formatTime(curr.recorded_at),
          label: `${m.machine_name} Resumed Production`,
          timestamp: curr.recorded_at,
          machineName: m.machine_name,
        });
      }
    }
  }

  timeline.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return timeline.slice(0, limit);
}

async function getIssueSummary(startDate, endDate, industryFilter) {
  let mSql = 'SELECT id FROM machines WHERE is_active = true';
  const mParams = [];
  if (industryFilter) {
    mParams.push(industryFilter);
    mSql += ` AND industry_name = $${mParams.length}`;
  }
  const machinesRes = await query(mSql, mParams);
  let idleDuration = 0;
  let stoppageCount = 0;
  let overloadCount = 0;
  let powerIssueCount = 0;
  let lowEfficiencyCount = 0;
  let idleEventCount = 0;

  for (const m of machinesRes.rows) {
    const metrics = await getMachineMetrics(m.id, startDate, endDate);
    idleDuration += metrics?.idleTimeMinutes || 0;

    const readings = await getMachineReadings(m.id, startDate, endDate);
    for (let i = 1; i < readings.length; i++) {
      if (isIdle(readings[i], readings[i - 1])) idleEventCount++;
    }
  }

  const params = [];
  let eventWhere = 'WHERE 1=1';
  if (industryFilter) {
    params.push(industryFilter);
    eventWhere += ` AND m.industry_name = $${params.length}`;
  }

  if (startDate) {
    params.push(startDate);
    eventWhere += ` AND e.recorded_at >= $${params.length}`;
  }
  if (endDate) {
    params.push(endDate);
    eventWhere += ` AND e.recorded_at <= $${params.length}`;
  }

  const eventsRes = await query(
    `SELECT e.event_type, COUNT(*)::int as count FROM events e JOIN machines m ON m.id = e.machine_id ${eventWhere} GROUP BY e.event_type`,
    params
  );

  eventsRes.rows.forEach((r) => {
    if (r.event_type === 'production_stoppage') stoppageCount += r.count;
    if (r.event_type === 'overload') overloadCount += r.count;
    if (r.event_type === 'power_issue') powerIssueCount += r.count;
  });

  const alertParams = ['low_efficiency'];
  let alertWhere = `WHERE a.alert_type = $1`;
  if (industryFilter) {
    alertParams.push(industryFilter);
    alertWhere += ` AND m.industry_name = $${alertParams.length}`;
  }

  if (startDate) {
    alertParams.push(startDate);
    alertWhere += ` AND a.created_at >= $${alertParams.length}`;
  }
  if (endDate) {
    alertParams.push(endDate);
    alertWhere += ` AND a.created_at <= $${alertParams.length}`;
  }

  const alertRes = await query(
    `SELECT COUNT(*)::int as count FROM alerts a JOIN machines m ON m.id = a.machine_id ${alertWhere}`,
    alertParams
  );
  lowEfficiencyCount = alertRes.rows[0]?.count || 0;

  return [
    {
      issueType: 'Idle Time',
      occurrences: idleEventCount,
      totalDurationMinutes: Math.round(idleDuration * 10) / 10,
    },
    {
      issueType: 'Production Stoppages',
      occurrences: stoppageCount,
      totalDurationMinutes: stoppageCount * 5,
    },
    {
      issueType: 'Overload Events',
      occurrences: overloadCount,
      totalDurationMinutes: overloadCount * 10,
    },
    {
      issueType: 'Power Issues',
      occurrences: powerIssueCount,
      totalDurationMinutes: powerIssueCount * 2,
    },
    {
      issueType: 'Low Efficiency Events',
      occurrences: lowEfficiencyCount,
      totalDurationMinutes: lowEfficiencyCount * 15,
    },
  ];
}

async function getEnhancedTrends(startDate, endDate, industryFilter) {
  let mSql = 'SELECT id, machine_name, target_quantity FROM machines WHERE is_active = true';
  const mParams = [];
  if (industryFilter) {
    mParams.push(industryFilter);
    mSql += ` AND industry_name = $${mParams.length}`;
  }
  const machinesRes = await query(mSql, mParams);
  const aggregated = {};

  for (const m of machinesRes.rows) {
    const readings = await getMachineReadings(m.id, startDate, endDate);
    const buckets = {};

    for (const r of readings) {
      const key = new Date(r.recorded_at).toISOString().slice(0, 10);
      if (!buckets[key]) {
        buckets[key] = { date: key, readings: [], temps: [] };
      }
      buckets[key].readings.push(r);
      buckets[key].temps.push(Number(r.temperature_celsius));
    }

    const target = Number(m.target_quantity) || 1;

    for (const key of Object.keys(buckets)) {
      const b = buckets[key];
      const { runtime, downtime, idleTime } = computeIntervals(b.readings);
      const lastReading = b.readings[b.readings.length - 1];
      const production = lastReading ? Number(lastReading.object_count) : 0;
      const avgTemp = b.temps.reduce((a, v) => a + v, 0) / (b.temps.length || 1);

      if (!aggregated[key]) {
        aggregated[key] = {
          date: key,
          runtime: 0,
          downtime: 0,
          production: 0,
          efficiency: 0,
          temperature: 0,
          count: 0,
        };
      }
      aggregated[key].runtime += runtime;
      aggregated[key].downtime += downtime;
      aggregated[key].production += production;
      aggregated[key].efficiency += (production / target) * 100;
      aggregated[key].temperature += avgTemp;
      aggregated[key].count += 1;
    }
  }

  return Object.values(aggregated)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((p) => ({
      date: p.date,
      runtime: Math.round(p.runtime * 10) / 10,
      downtime: Math.round(p.downtime * 10) / 10,
      production: p.production,
      efficiency: p.count ? Math.round((p.efficiency / p.count) * 10) / 10 : 0,
      temperature: p.count ? Math.round((p.temperature / p.count) * 10) / 10 : 0,
    }));
}

async function getProductionHealthSummary(startDate, endDate, industryFilter) {
  const board = await getMachineBoard(startDate, endDate, industryFilter);
  
  let mSql = 'SELECT COUNT(*)::int as count FROM machines WHERE is_active = true';
  const mParams = [];
  if (industryFilter) {
    mParams.push(industryFilter);
    mSql += ` AND industry_name = $${mParams.length}`;
  }
  const machinesRes = await query(mSql, mParams);

  let aSql = 'SELECT COUNT(DISTINCT a.machine_id)::int as count FROM alerts a JOIN machines m ON m.id = a.machine_id WHERE a.is_acknowledged = false';
  const aParams = [];
  if (industryFilter) {
    aParams.push(industryFilter);
    aSql += ` AND m.industry_name = $${aParams.length}`;
  }
  const alertsRes = await query(aSql, aParams);

  let totalProduction = 0;
  let totalRuntime = 0;
  let totalDowntime = 0;
  let efficiencySum = 0;

  const statusCounts = {
    running: 0,
    stopped: 0,
    idle: 0,
    overload: 0,
    power_issue: 0,
  };

  for (const m of board) {
    statusCounts[m.status] = (statusCounts[m.status] || 0) + 1;
    totalProduction += m.productionCount;
    efficiencySum += m.efficiency;
    const metrics = await getMachineMetrics(m.id, startDate, endDate);
    totalRuntime += metrics?.runtimeMinutes || 0;
    totalDowntime += metrics?.downtimeMinutes || 0;
  }

  let mwSql = 'SELECT COUNT(DISTINCT a.machine_id)::int as count FROM alerts a JOIN machines m ON m.id = a.machine_id WHERE a.is_acknowledged = false AND a.machine_id IS NOT NULL';
  const mwParams = [];
  if (industryFilter) {
    mwParams.push(industryFilter);
    mwSql += ` AND m.industry_name = $${mwParams.length}`;
  }
  const machinesWithAlerts = await query(mwSql, mwParams);

  return {
    totalMachines: machinesRes.rows[0]?.count || 0,
    runningMachines: statusCounts.running || 0,
    stoppedMachines: statusCounts.stopped || 0,
    idleMachines: statusCounts.idle || 0,
    overloadMachines: statusCounts.overload || 0,
    powerIssueMachines: statusCounts.power_issue || 0,
    machinesWithActiveAlerts: machinesWithAlerts.rows[0]?.count || 0,
    unacknowledgedAlerts: alertsRes.rows[0]?.count || 0,
    overallProductionEfficiency:
      board.length > 0 ? Math.round((efficiencySum / board.length) * 10) / 10 : 0,
    totalProductionCount: totalProduction,
    totalRuntimeMinutes: Math.round(totalRuntime * 10) / 10,
    totalDowntimeMinutes: Math.round(totalDowntime * 10) / 10,
    statusCounts,
  };
}

async function getEnhancedDashboard(startDate, endDate, industryFilter) {
  const [health, machineBoard, timeline, issueSummary, trends] = await Promise.all([
    getProductionHealthSummary(startDate, endDate, industryFilter),
    getMachineBoard(startDate, endDate, industryFilter),
    getEventTimeline(startDate, endDate, 50, industryFilter),
    getIssueSummary(startDate, endDate, industryFilter),
    getEnhancedTrends(startDate, endDate, industryFilter),
  ]);

  return {
    health,
    machineBoard,
    timeline,
    issueSummary,
    trends,
    period: { startDate, endDate },
  };
}

module.exports = {
  getEnhancedDashboard,
  getProductionHealthSummary,
  getMachineBoard,
  getEventTimeline,
  getIssueSummary,
  getEnhancedTrends,
  deriveMachineStatus,
};

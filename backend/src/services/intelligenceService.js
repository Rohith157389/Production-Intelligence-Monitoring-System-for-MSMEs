const { query } = require('../config/db');

function intervalMinutes(prev, curr) {
  const ms = new Date(curr.recorded_at) - new Date(prev.recorded_at);
  return Math.max(0, ms / 60000);
}

function intervalSeconds(prev, curr) {
  const ms = new Date(curr.recorded_at) - new Date(prev.recorded_at);
  return Math.max(0, ms / 1000);
}

function round(n, d = 1) {
  if (!Number.isFinite(n)) return 0;
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

function getShift() {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 14) return 'Shift-A (06:00–14:00)';
  if (hour >= 14 && hour < 22) return 'Shift-B (14:00–22:00)';
  return 'Shift-C (22:00–06:00)';
}

async function getMachineReadings(machineId, startDate, endDate) {
  let sql = `SELECT * FROM sensor_readings WHERE machine_id = $1`;
  const params = [machineId];
  if (startDate) {
    params.push(startDate);
    sql += ` AND recorded_at >= $${params.length}`;
  }
  if (endDate) {
    params.push(endDate);
    sql += ` AND recorded_at <= $${params.length}`;
  }
  sql += ' ORDER BY recorded_at ASC';
  const result = await query(sql, params);
  return result.rows;
}

async function getTotalReadingCount(startDate, endDate, industryFilter) {
  let sql = `
    SELECT COUNT(*)::int AS count 
    FROM sensor_readings r
  `;
  const params = [];
  
  if (industryFilter) {
    sql += ` JOIN machines m ON m.id = r.machine_id WHERE m.industry_name = $1`;
    params.push(industryFilter);
  } else {
    sql += ` WHERE 1=1`;
  }

  if (startDate) {
    params.push(startDate);
    sql += ` AND r.recorded_at >= $${params.length}`;
  }
  if (endDate) {
    params.push(endDate);
    sql += ` AND r.recorded_at <= $${params.length}`;
  }
  const res = await query(sql, params);
  return res.rows[0]?.count || 0;
}

async function getActiveMachines(industryFilter) {
  let sql = 'SELECT * FROM machines WHERE COALESCE(is_active, true) = true';
  const params = [];
  if (industryFilter) {
    params.push(industryFilter);
    sql += ` AND industry_name = $${params.length}`;
  }
  sql += ' ORDER BY machine_name';
  const res = await query(sql, params);
  return res.rows;
}

function computeIdleMetrics(readings) {
  let idleDuration = 0;
  let idleEvents = 0;
  let totalDuration = 0;
  let inIdle = false;

  if (readings.length === 1) {
    const r = readings[0];
    const currentOn = Number(r.current_ampere) > 0.5;
    return {
      idleDurationMinutes: 0,
      idleEvents: currentOn ? 0 : 0,
      idlePercentage: 0,
      productiveTimeMinutes: currentOn ? 1 : 0,
      totalDurationMinutes: 1,
    };
  }

  for (let i = 1; i < readings.length; i++) {
    const prev = readings[i - 1];
    const curr = readings[i];
    const mins = intervalMinutes(prev, curr);
    totalDuration += mins;

    const currentOn = Number(curr.current_ampere) > 0.5 && Number(prev.current_ampere) > 0.5;
    const countFlat = Number(curr.object_count) <= Number(prev.object_count);

    if (currentOn && countFlat) {
      idleDuration += mins;
      if (!inIdle) {
        idleEvents++;
        inIdle = true;
      }
    } else {
      inIdle = false;
    }
  }

  const productiveTime = Math.max(0, totalDuration - idleDuration);
  const idlePercentage = totalDuration > 0 ? (idleDuration / totalDuration) * 100 : 0;

  return {
    idleDurationMinutes: round(idleDuration),
    idleEvents,
    idlePercentage: round(idlePercentage),
    productiveTimeMinutes: round(productiveTime),
    totalDurationMinutes: round(totalDuration),
  };
}

function computeOverloadMetrics(readings, ratedCurrent) {
  const rated = Number(ratedCurrent) || 15;
  let overloadEvents = 0;
  let overloadDuration = 0;
  let maxCurrent = 0;
  let wasOverloaded = false;
  const utilizationSamples = [];

  for (let i = 0; i < readings.length; i++) {
    const curr = Number(readings[i].current_ampere);
    maxCurrent = Math.max(maxCurrent, curr);
    const util = rated > 0 ? (curr / rated) * 100 : 0;
    utilizationSamples.push(util);

    const overloaded = curr > rated;
    if (overloaded) {
      if (!wasOverloaded) overloadEvents++;
      wasOverloaded = true;
      if (i > 0) overloadDuration += intervalMinutes(readings[i - 1], readings[i]);
    } else {
      wasOverloaded = false;
    }
  }

  const avgUtil =
    utilizationSamples.length > 0
      ? utilizationSamples.reduce((a, b) => a + b, 0) / utilizationSamples.length
      : 0;

  return {
    overloadEvents,
    overloadDurationMinutes: round(overloadDuration),
    maximumCurrent: round(maxCurrent, 2),
    currentUtilizationPercent: round(avgUtil),
    ratedCurrent: rated,
  };
}

function computeStoppageMetrics(readings, thresholdMinutes = 5) {
  let stoppageEvents = 0;
  let totalStoppageDuration = 0;
  let longestStoppage = 0;
  let flatStart = null;

  for (let i = 1; i < readings.length; i++) {
    const prev = readings[i - 1];
    const curr = readings[i];
    const countSame = Number(curr.object_count) === Number(prev.object_count);

    if (countSame) {
      if (flatStart === null) flatStart = prev.recorded_at;
    } else if (flatStart !== null) {
      const duration = (new Date(prev.recorded_at) - new Date(flatStart)) / 60000;
      if (duration >= thresholdMinutes) {
        stoppageEvents++;
        totalStoppageDuration += duration;
        longestStoppage = Math.max(longestStoppage, duration);
      }
      flatStart = null;
    }
  }

  if (flatStart !== null && readings.length > 0) {
    const last = readings[readings.length - 1];
    const duration = (new Date(last.recorded_at) - new Date(flatStart)) / 60000;
    if (duration >= thresholdMinutes) {
      stoppageEvents++;
      totalStoppageDuration += duration;
      longestStoppage = Math.max(longestStoppage, duration);
    }
  }

  const avgStoppage = stoppageEvents > 0 ? totalStoppageDuration / stoppageEvents : 0;

  return {
    stoppageEvents,
    totalStoppageDurationMinutes: round(totalStoppageDuration),
    longestStoppageMinutes: round(longestStoppage),
    averageStoppageDurationMinutes: round(avgStoppage),
  };
}

function computeInterruptionMetrics(readings, expectedCycleSeconds) {
  const expected = Number(expectedCycleSeconds) || 60;
  let delayEvents = 0;
  let totalDelay = 0;
  let maxDelay = 0;
  let lostProduction = 0;
  const delays = [];
  const cycleComparison = [];

  for (let i = 1; i < readings.length; i++) {
    const prev = readings[i - 1];
    const curr = readings[i];
    const countDelta = Number(curr.object_count) - Number(prev.object_count);

    if (countDelta > 0) {
      const elapsed = intervalSeconds(prev, curr);
      const actualCycle = elapsed / countDelta;

      cycleComparison.push({
        name: new Date(curr.recorded_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        expected,
        actual: round(actualCycle),
      });

      if (actualCycle > expected) {
        delayEvents++;
        const delay = actualCycle - expected;
        totalDelay += delay;
        maxDelay = Math.max(maxDelay, delay);
        delays.push(delay);
        lostProduction += Math.floor(delay / expected);
      }
    }
  }

  return {
    delayEvents,
    averageDelaySeconds: delays.length ? round(totalDelay / delays.length) : 0,
    maximumDelaySeconds: round(maxDelay),
    lostProductionQuantity: lostProduction,
    expectedCycleTimeSeconds: expected,
    cycleComparison,
  };
}

function computePowerQuality(readings, voltageThreshold = 200) {
  let powerFailures = 0;
  let voltageDrops = 0;
  let voltageFluctuations = 0;
  let currentFluctuations = 0;
  let impactDuration = 0;
  let score = 100;

  for (let i = 0; i < readings.length; i++) {
    const v = Number(readings[i].voltage_volt);
    const c = Number(readings[i].current_ampere);

    if (v <= 10 && i > 0) {
      powerFailures++;
      score -= 15;
      impactDuration += intervalMinutes(readings[i - 1], readings[i]);
    } else if (v < voltageThreshold && v > 0) {
      voltageDrops++;
      score -= 8;
      if (i > 0) impactDuration += intervalMinutes(readings[i - 1], readings[i]);
    }

    if (i > 0) {
      const prevV = Number(readings[i - 1].voltage_volt);
      const prevC = Number(readings[i - 1].current_ampere);
      if (prevV > 0 && Math.abs(v - prevV) / prevV > 0.08) {
        voltageFluctuations++;
        score -= 3;
      }
      if (prevC > 0 && Math.abs(c - prevC) / prevC > 0.25) {
        currentFluctuations++;
        score -= 2;
      }
    }
  }

  score = Math.max(0, Math.min(100, score));

  return {
    powerFailures,
    voltageDrops,
    voltageFluctuations,
    currentFluctuations,
    powerQualityScore: round(score),
    powerEvents: powerFailures + voltageDrops + voltageFluctuations + currentFluctuations,
    totalImpactDurationMinutes: round(impactDuration),
    pie: [
      { name: 'Power Failures', value: powerFailures },
      { name: 'Voltage Drops', value: voltageDrops },
      { name: 'Voltage Fluctuations', value: voltageFluctuations },
      { name: 'Current Fluctuations', value: currentFluctuations },
    ],
  };
}

function computeEfficiency(readings, targetProduction) {
  const target = Number(targetProduction) || 1;
  const actual = readings.length ? Number(readings[readings.length - 1].object_count) : 0;
  const efficiency = target > 0 ? (actual / target) * 100 : 0;
  const gap = Math.max(0, target - actual);

  return {
    efficiencyPercent: round(Math.min(efficiency, 999)),
    targetAchievementPercent: round(Math.min(efficiency, 100)),
    targetProduction: target,
    actualProduction: actual,
    productionGap: gap,
  };
}

function computeRunningVsStopped(readings) {
  let running = 0;
  let stopped = 0;

  if (readings.length === 1) {
    const r = readings[0];
    const isRun = Number(r.current_ampere) > 0.5;
    return { runningMinutes: isRun ? 1 : 0, stoppedMinutes: isRun ? 0 : 1 };
  }

  for (let i = 1; i < readings.length; i++) {
    const mins = intervalMinutes(readings[i - 1], readings[i]);
    const runningNow = Number(readings[i].current_ampere) > 0.5;
    if (runningNow) running += mins;
    else stopped += mins;
  }

  return { runningMinutes: round(running), stoppedMinutes: round(stopped) };
}

function dedupeReadings(readings) {
  const seen = new Set();
  return readings.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
}

function buildReadingTrends(readings, machine, combined) {
  const sorted = dedupeReadings(readings).sort(
    (a, b) => new Date(a.recorded_at) - new Date(b.recorded_at)
  );

  for (const r of sorted) {
    const key = new Date(r.recorded_at).toISOString().slice(0, 10);
    if (!combined[key]) {
      combined[key] = {
        date: key,
        production: 0,
        efficiency: 0,
        idle: 0,
        stoppage: 0,
        overload: 0,
        powerIssues: 0,
        utilization: 0,
        voltage: 0,
        current: 0,
        count: 0,
      };
    }
  }

  const byDate = {};
  for (const r of sorted) {
    const key = new Date(r.recorded_at).toISOString().slice(0, 10);
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(r);
  }

  for (const date of Object.keys(byDate)) {
    const slice = byDate[date];
    const eff = computeEfficiency(slice, machine.target_quantity);
    const idle = computeIdleMetrics(slice);
    const stop = computeStoppageMetrics(slice, machine.stoppage_duration_minutes || 5);
    const ovl = computeOverloadMetrics(slice, machine.rated_current || 15);
    const pwr = computePowerQuality(slice, machine.voltage_min_threshold || 200);

    const avgV = slice.reduce((s, r) => s + Number(r.voltage_volt), 0) / slice.length;
    const avgC = slice.reduce((s, r) => s + Number(r.current_ampere), 0) / slice.length;

    combined[date].production += eff.actualProduction;
    combined[date].efficiency += eff.efficiencyPercent;
    combined[date].idle += idle.idleDurationMinutes;
    combined[date].stoppage += stop.totalStoppageDurationMinutes;
    combined[date].overload += ovl.overloadEvents;
    combined[date].powerIssues += pwr.powerEvents;
    combined[date].utilization += ovl.currentUtilizationPercent;
    combined[date].voltage += avgV;
    combined[date].current += avgC;
    combined[date].count += 1;
  }
}

async function computeMachineIntelligence(machine, startDate, endDate) {
  const readings = await getMachineReadings(machine.id, startDate, endDate);
  const rated = machine.rated_current || machine.current_overload_threshold || 15;
  const expectedCycle = machine.expected_cycle_time_seconds || 60;
  const threshold = machine.stoppage_duration_minutes || 5;
  const voltageThreshold = machine.voltage_min_threshold || 200;

  const latest = readings[readings.length - 1];
  const isRunning = latest && Number(latest.current_ampere) > 0.5;

  return {
    machineId: machine.machine_id,
    machineName: machine.machine_name,
    department: machine.department,
    status: isRunning ? 'Running' : readings.length ? 'Stopped' : 'No Data',
    idle: computeIdleMetrics(readings),
    overload: computeOverloadMetrics(readings, rated),
    stoppage: computeStoppageMetrics(readings, threshold),
    interruption: computeInterruptionMetrics(readings, expectedCycle),
    power: computePowerQuality(readings, voltageThreshold),
    efficiency: computeEfficiency(readings, machine.target_quantity),
    runtime: computeRunningVsStopped(readings),
    readingCount: readings.length,
  };
}

async function getFactoryTrends(machines, startDate, endDate) {
  const combined = {};

  for (const m of machines) {
    const readings = await getMachineReadings(m.id, startDate, endDate);
    buildReadingTrends(readings, m, combined);
  }

  return Object.values(combined)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((p) => ({
      date: p.date,
      production: p.production,
      efficiency: p.count ? round(p.efficiency / p.count) : 0,
      idle: round(p.idle),
      stoppage: round(p.stoppage),
      overload: p.overload,
      powerIssues: p.powerIssues,
      utilization: p.count ? round(p.utilization / p.count) : 0,
      voltage: p.count ? round(p.voltage / p.count) : 0,
      current: p.count ? round(p.current / p.count, 2) : 0,
    }));
}

function safeDonut(productive, idle) {
  const p = Math.max(0, productive);
  const i = Math.max(0, idle);
  if (p === 0 && i === 0) return null;
  return [
    { name: 'Productive', value: p || 0.001 },
    { name: 'Idle', value: i || 0.001 },
  ];
}

function safePie(running, stopped) {
  const r = Math.max(0, running);
  const s = Math.max(0, stopped);
  if (r === 0 && s === 0) return null;
  return [
    { name: 'Running', value: r || 0.001 },
    { name: 'Stopped', value: s || 0.001 },
  ];
}

function buildAnalyticsSections(machineMetrics, trends) {
  if (!machineMetrics.length) {
    return emptySections();
  }

  const agg = (path) =>
    machineMetrics.reduce((s, m) => {
      const parts = path.split('.');
      let v = m;
      parts.forEach((p) => { v = v?.[p]; });
      return s + (Number(v) || 0);
    }, 0);

  const avg = (path) => round(agg(path) / machineMetrics.length);

  const totalIdle = agg('idle.idleDurationMinutes');
  const totalProductive = agg('idle.productiveTimeMinutes');
  const runningVsStopped = machineMetrics.reduce(
    (acc, m) => ({
      running: acc.running + m.runtime.runningMinutes,
      stopped: acc.stopped + m.runtime.stoppedMinutes,
    }),
    { running: 0, stopped: 0 }
  );

  const powerPie = [
    { name: 'Power Failures', value: agg('power.powerFailures') },
    { name: 'Voltage Drops', value: agg('power.voltageDrops') },
    { name: 'Voltage Fluctuations', value: agg('power.voltageFluctuations') },
    { name: 'Current Fluctuations', value: agg('power.currentFluctuations') },
  ];

  const cycleComparison = machineMetrics.flatMap((m) => m.interruption.cycleComparison || []);

  return {
    efficiency: {
      efficiencyPercent: avg('efficiency.efficiencyPercent'),
      targetProduction: agg('efficiency.targetProduction'),
      actualProduction: agg('efficiency.actualProduction'),
      productionGap: agg('efficiency.productionGap'),
      targetVsActual: machineMetrics.map((m) => ({
        name: m.machineName.slice(0, 12),
        target: m.efficiency.targetProduction,
        actual: m.efficiency.actualProduction,
      })),
      trend: trends.map((t) => ({ date: t.date, value: t.efficiency })),
      hasData: machineMetrics.some((m) => m.readingCount > 0),
    },
    idle: {
      idleDurationMinutes: totalIdle,
      idleEvents: agg('idle.idleEvents'),
      idlePercentage:
        totalIdle + totalProductive > 0
          ? round((totalIdle / (totalIdle + totalProductive)) * 100)
          : 0,
      productiveTimeMinutes: totalProductive,
      donut: safeDonut(totalProductive, totalIdle),
      byMachine: machineMetrics.map((m) => ({
        name: m.machineName.slice(0, 12),
        idle: m.idle.idleDurationMinutes,
        events: m.idle.idleEvents,
      })),
      trend: trends.map((t) => ({ date: t.date, value: t.idle })),
      hasData: machineMetrics.some((m) => m.readingCount > 0),
    },
    overload: {
      overloadEvents: agg('overload.overloadEvents'),
      maximumCurrent: Math.max(...machineMetrics.map((m) => m.overload.maximumCurrent), 0),
      ratedCurrent: avg('overload.ratedCurrent'),
      currentUtilizationPercent: avg('overload.currentUtilizationPercent'),
      byMachine: machineMetrics.map((m) => ({
        name: m.machineName.slice(0, 12),
        events: m.overload.overloadEvents,
        utilization: m.overload.currentUtilizationPercent,
      })),
      trend: trends.map((t) => ({ date: t.date, value: t.utilization })),
      hasData: machineMetrics.some((m) => m.readingCount > 0),
    },
    stoppage: {
      stoppageEvents: agg('stoppage.stoppageEvents'),
      longestStoppageMinutes: Math.max(
        ...machineMetrics.map((m) => m.stoppage.longestStoppageMinutes),
        0
      ),
      totalStoppageDurationMinutes: agg('stoppage.totalStoppageDurationMinutes'),
      runningVsStopped: safePie(runningVsStopped.running, runningVsStopped.stopped),
      byMachine: machineMetrics.map((m) => ({
        name: m.machineName.slice(0, 12),
        duration: m.stoppage.totalStoppageDurationMinutes,
        events: m.stoppage.stoppageEvents,
      })),
      trend: trends.map((t) => ({ date: t.date, value: t.stoppage })),
      hasData: machineMetrics.some((m) => m.readingCount > 0),
    },
    interruption: {
      delayEvents: agg('interruption.delayEvents'),
      averageDelaySeconds: avg('interruption.averageDelaySeconds'),
      maximumDelaySeconds: Math.max(
        ...machineMetrics.map((m) => m.interruption.maximumDelaySeconds),
        0
      ),
      lostProductionQuantity: agg('interruption.lostProductionQuantity'),
      cycleComparison: cycleComparison.length
        ? cycleComparison.slice(-10)
        : machineMetrics.map((m) => ({
            name: m.machineName.slice(0, 10),
            expected: m.interruption.expectedCycleTimeSeconds,
            actual: m.interruption.expectedCycleTimeSeconds,
          })),
      trend: trends.map((t) => ({ date: t.date, value: t.production })),
      hasData: machineMetrics.some((m) => m.readingCount > 1),
    },
    power: {
      powerFailures: agg('power.powerFailures'),
      voltageDrops: agg('power.voltageDrops'),
      voltageFluctuations: agg('power.voltageFluctuations'),
      currentFluctuations: agg('power.currentFluctuations'),
      powerQualityScore: avg('power.powerQualityScore'),
      pie: powerPie.some((p) => p.value > 0)
        ? powerPie.filter((p) => p.value > 0)
        : [{ name: 'Normal', value: 1 }],
      voltageTrend: trends.map((t) => ({ date: t.date, value: t.voltage })),
      currentTrend: trends.map((t) => ({ date: t.date, value: t.current })),
      hasData: machineMetrics.some((m) => m.readingCount > 0),
    },
  };
}

function emptySections() {
  const empty = { hasData: false, trend: [] };
  return {
    efficiency: { ...empty, efficiencyPercent: 0, targetProduction: 0, actualProduction: 0, productionGap: 0, targetVsActual: [] },
    idle: { ...empty, idleDurationMinutes: 0, idleEvents: 0, idlePercentage: 0, donut: null, byMachine: [] },
    overload: { ...empty, overloadEvents: 0, maximumCurrent: 0, ratedCurrent: 0, currentUtilizationPercent: 0, byMachine: [] },
    stoppage: { ...empty, stoppageEvents: 0, longestStoppageMinutes: 0, totalStoppageDurationMinutes: 0, runningVsStopped: null, byMachine: [] },
    interruption: { ...empty, delayEvents: 0, averageDelaySeconds: 0, maximumDelaySeconds: 0, lostProductionQuantity: 0, cycleComparison: [] },
    power: { ...empty, powerFailures: 0, voltageDrops: 0, voltageFluctuations: 0, currentFluctuations: 0, powerQualityScore: 100, pie: null, voltageTrend: [], currentTrend: [] },
  };
}

async function getEventTimeline(startDate, endDate, machines, limit = 40) {
  const timeline = [];
  const params = [];
  let sql = `SELECT e.*, m.machine_name FROM events e JOIN machines m ON m.id = e.machine_id WHERE 1=1`;
  if (startDate) {
    params.push(startDate);
    sql += ` AND e.recorded_at >= $${params.length}`;
  }
  if (endDate) {
    params.push(endDate);
    sql += ` AND e.recorded_at <= $${params.length}`;
  }
  sql += ' ORDER BY e.recorded_at DESC LIMIT 50';

  const events = await query(sql, params);
  events.rows.forEach((e) => {
    timeline.push({
      id: e.id,
      time: new Date(e.recorded_at).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }),
      timestamp: e.recorded_at,
      label: formatEventLabel(e.event_type, e.machine_name),
      type: e.event_type,
    });
  });

  for (const m of machines) {
    const readings = await getMachineReadings(m.id, startDate, endDate);
    for (let i = 1; i < readings.length; i++) {
      const prev = readings[i - 1];
      const curr = readings[i];
      if (
        Number(curr.current_ampere) > 0 &&
        Number(prev.current_ampere) > 0 &&
        Number(curr.object_count) <= Number(prev.object_count)
      ) {
        timeline.push({
          id: `idle-${i}-${m.id}`,
          time: new Date(curr.recorded_at).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          }),
          timestamp: curr.recorded_at,
          label: `${m.machine_name} — Machine Idle Detected`,
          type: 'idle',
        });
      }
      const rated = m.rated_current || 15;
      if (Number(curr.current_ampere) > rated) {
        timeline.push({
          id: `ovl-${i}-${m.id}`,
          time: new Date(curr.recorded_at).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          }),
          timestamp: curr.recorded_at,
          label: `${m.machine_name} — Overload Detected`,
          type: 'overload',
        });
      }
    }
  }

  timeline.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return timeline.slice(0, limit);
}

function formatEventLabel(type, machineName) {
  const labels = {
    overload: 'Overload Detected',
    power_issue: 'Voltage Drop Detected',
    production_stoppage: 'Production Stoppage Detected',
  };
  return `${machineName} — ${labels[type] || type.replace(/_/g, ' ')}`;
}

async function getIntelligenceDashboard(startDate, endDate, industryFilter) {
  const machines = await getActiveMachines(industryFilter);
  const totalReadings = await getTotalReadingCount(startDate, endDate, industryFilter);
  const machineMetrics = [];

  let totals = {
    efficiencySum: 0,
    targetAchievementSum: 0,
    actualProduction: 0,
    targetProduction: 0,
    productionGap: 0,
    idleDuration: 0,
    stoppageDuration: 0,
    overloadEvents: 0,
    powerScoreSum: 0,
    running: 0,
    stopped: 0,
  };

  for (const m of machines) {
    const intel = await computeMachineIntelligence(m, startDate, endDate);
    machineMetrics.push(intel);
    totals.efficiencySum += intel.efficiency.efficiencyPercent;
    totals.targetAchievementSum += intel.efficiency.targetAchievementPercent;
    totals.actualProduction += intel.efficiency.actualProduction;
    totals.targetProduction += intel.efficiency.targetProduction;
    totals.productionGap += intel.efficiency.productionGap;
    totals.idleDuration += intel.idle.idleDurationMinutes;
    totals.stoppageDuration += intel.stoppage.totalStoppageDurationMinutes;
    totals.overloadEvents += intel.overload.overloadEvents;
    totals.powerScoreSum += intel.power.powerQualityScore;
    if (intel.status === 'Running') totals.running++;
    else if (intel.status === 'Stopped') totals.stopped++;
  }

  const n = machines.length || 1;
  const trends = await getFactoryTrends(machines, startDate, endDate);

  const kpis = {
    productionEfficiencyPercent: round(totals.efficiencySum / n),
    targetAchievementPercent: round(totals.targetAchievementSum / n),
    productionCount: totals.actualProduction,
    productionGap: totals.productionGap,
    totalIdleTimeMinutes: round(totals.idleDuration),
    totalStoppageTimeMinutes: round(totals.stoppageDuration),
    totalOverloadEvents: totals.overloadEvents,
    powerQualityScore: round(totals.powerScoreSum / n),
  };

  const factoryBar = {
    targetProduction: totals.targetProduction,
    actualProduction: totals.actualProduction,
    targetAchievementPercent: round(totals.targetAchievementSum / n),
    currentShift: getShift(),
    machineStatus: `${totals.running} Running / ${totals.stopped} Stopped / ${machines.length} Total`,
    productionEfficiency: round(totals.efficiencySum / n),
    productionGap: totals.productionGap,
    powerQualityScore: round(totals.powerScoreSum / n),
  };

  return {
    kpis,
    factoryBar,
    sections: buildAnalyticsSections(machineMetrics, trends),
    trends,
    timeline: await getEventTimeline(startDate, endDate, machines),
    machineCount: machines.length,
    totalReadings,
    hasData: totalReadings > 0,
    period: { startDate, endDate },
    updatedAt: new Date().toISOString(),
  };
}

async function getDetailedAnalysis(type, startDate, endDate, machineId, industryFilter) {
  let machines = await getActiveMachines(industryFilter);
  if (machineId) {
    machines = machines.filter((m) => m.machine_id === machineId || m.id === machineId);
  }

  const dashboard = await getIntelligenceDashboard(startDate, endDate, industryFilter);
  const analyses = [];

  for (const m of machines) {
    const intel = await computeMachineIntelligence(m, startDate, endDate);
    analyses.push({
      machineName: m.machine_name,
      machineId: m.machine_id,
      metrics: intel[type] || intel,
      full: intel,
    });
  }

  const readings = [];
  for (const m of machines) {
    const rows = await getMachineReadings(m.id, startDate, endDate);
    rows.forEach((r) => readings.push({ ...r, machine_name: m.machine_name }));
  }
  readings.sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at));

  return {
    type,
    summary: dashboard.sections[type] || {},
    trendAnalysis: dashboard.trends,
    historicalAnalysis: analyses,
    issueFrequency: analyses.map((a) => ({ machine: a.machineName, ...(a.metrics || {}) })),
    eventTimeline: dashboard.timeline,
    impactAnalysis: buildImpactAnalysis(type, analyses),
    sensorLogs: readings.slice(0, 100).map((r) => ({
      machine: r.machine_name,
      timestamp: r.recorded_at,
      current: r.current_ampere,
      voltage: r.voltage_volt,
      temperature: r.temperature_celsius,
      vibration: r.vibration,
      rpm: r.rpm,
      objectCount: r.object_count,
      source: r.source,
    })),
    hasData: dashboard.hasData,
    period: { startDate, endDate },
  };
}

function buildImpactAnalysis(type, analyses) {
  const impacts = [];
  for (const a of analyses) {
    const m = a.full;
    const map = {
      efficiency: `Production gap of ${m.efficiency.productionGap} units (${m.efficiency.targetAchievementPercent}% achieved)`,
      idle: `${m.idle.idleDurationMinutes} min idle (${m.idle.idlePercentage}% of monitored time)`,
      overload: `${m.overload.overloadEvents} overload events, peak ${m.overload.maximumCurrent}A vs rated ${m.overload.ratedCurrent}A`,
      stoppage: `${m.stoppage.totalStoppageDurationMinutes} min stoppage, longest ${m.stoppage.longestStoppageMinutes} min`,
      interruption: `${m.interruption.lostProductionQuantity} units lost, avg delay ${m.interruption.averageDelaySeconds}s`,
      power: `PQ score ${m.power.powerQualityScore}/100, ${m.power.powerEvents} events detected`,
    };
    if (map[type]) impacts.push({ machine: a.machineName, impact: map[type] });
  }
  return impacts;
}

module.exports = {
  getIntelligenceDashboard,
  getDetailedAnalysis,
  computeMachineIntelligence,
};

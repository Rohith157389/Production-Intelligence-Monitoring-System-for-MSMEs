const { query } = require('../config/db');

function isRunning(reading) {
  const current = Number(reading.current_ampere || 0);
  return current > 0.5;
}

function isStopped(reading) {
  const current = Number(reading.current_ampere || 0);
  return current <= 0.5;
}

function intervalMinutes(prev, curr) {
  const ms = new Date(curr.recorded_at) - new Date(prev.recorded_at);
  return Math.max(0, ms / 60000);
}

function computeIntervals(readings) {
  if (readings.length < 2) return { runtime: 0, downtime: 0, idleTime: 0 };

  let runtime = 0;
  let downtime = 0;
  let idleTime = 0;

  for (let i = 1; i < readings.length; i++) {
    const prev = readings[i - 1];
    const curr = readings[i];
    const minutes = intervalMinutes(prev, curr);

    if (isRunning(prev) && isRunning(curr)) {
      runtime += minutes;
      if (Number(curr.object_count) <= Number(prev.object_count)) {
        idleTime += minutes;
      }
    } else if (isStopped(prev) && isStopped(curr)) {
      downtime += minutes;
    } else if (isRunning(prev) || isRunning(curr)) {
      runtime += minutes * 0.5;
    } else if (isStopped(prev) || isStopped(curr)) {
      downtime += minutes * 0.5;
    }
  }

  return { runtime, downtime, idleTime };
}

async function getMachineReadings(machineUuid, startDate, endDate) {
  let sql = `
    SELECT * FROM sensor_readings
    WHERE machine_id = $1
  `;
  const params = [machineUuid];

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

async function getMachineMetrics(machineUuid, startDate, endDate) {
  const readings = await getMachineReadings(machineUuid, startDate, endDate);
  const machineRes = await query('SELECT * FROM machines WHERE id = $1', [machineUuid]);
  const machine = machineRes.rows[0];

  if (!machine) return null;

  const latest = readings[readings.length - 1];
  const { runtime, downtime, idleTime } = computeIntervals(readings);

  const productionCount = latest ? Number(latest.object_count) : 0;
  const runtimeHours = runtime / 60 || 0.001;
  const productionRate = productionCount / runtimeHours;

  const maxTemp = readings.length
    ? Math.max(...readings.map((r) => Number(r.temperature_celsius)))
    : 0;
  const avgCurrent = readings.length
    ? readings.reduce((s, r) => s + Number(r.current_ampere), 0) / readings.length
    : 0;

  const target = Number(machine.target_quantity) || 1;
  const efficiency = (productionCount / target) * 100;

  const status = latest && isRunning(latest) ? 'running' : 'stopped';

  return {
    machineId: machine.machine_id,
    machineName: machine.machine_name,
    status,
    runtimeMinutes: Math.round(runtime * 10) / 10,
    downtimeMinutes: Math.round(downtime * 10) / 10,
    idleTimeMinutes: Math.round(idleTime * 10) / 10,
    productionCount,
    productionRate: Math.round(productionRate * 100) / 100,
    maxTemperature: Math.round(maxTemp * 10) / 10,
    averageCurrent: Math.round(avgCurrent * 100) / 100,
    productionEfficiency: Math.round(efficiency * 10) / 10,
    targetQuantity: target,
    readingCount: readings.length,
  };
}

async function getDashboardSummary(startDate, endDate, industryFilter) {
  let sql = 'SELECT * FROM machines WHERE is_active = true';
  const params = [];
  if (industryFilter) {
    params.push(industryFilter);
    sql += ` AND industry_name = $${params.length}`;
  }
  sql += ' ORDER BY machine_name';
  const machinesRes = await query(sql, params);
  const machines = machinesRes.rows;

  const metricsList = [];
  let totalProduction = 0;
  let totalRuntime = 0;
  let totalDowntime = 0;
  let totalIdle = 0;
  let activeCount = 0;
  let stoppedCount = 0;
  let efficiencySum = 0;

  for (const machine of machines) {
    const m = await getMachineMetrics(machine.id, startDate, endDate);
    if (!m) continue;
    metricsList.push({ ...m, id: machine.id });
    totalProduction += m.productionCount;
    totalRuntime += m.runtimeMinutes;
    totalDowntime += m.downtimeMinutes;
    totalIdle += m.idleTimeMinutes;
    if (m.status === 'running') activeCount++;
    else stoppedCount++;
    efficiencySum += m.productionEfficiency;
  }

  const avgEfficiency = machines.length ? efficiencySum / machines.length : 0;

  return {
    totalMachines: machines.length,
    activeMachines: activeCount,
    stoppedMachines: stoppedCount,
    totalProductionCount: totalProduction,
    totalRuntimeMinutes: Math.round(totalRuntime * 10) / 10,
    totalDowntimeMinutes: Math.round(totalDowntime * 10) / 10,
    totalIdleTimeMinutes: Math.round(totalIdle * 10) / 10,
    productionEfficiency: Math.round(avgEfficiency * 10) / 10,
    machines: metricsList,
  };
}

async function getTrendData(machineUuid, startDate, endDate, interval = 'day') {
  const readings = await getMachineReadings(machineUuid, startDate, endDate);
  const buckets = {};

  for (const r of readings) {
    const d = new Date(r.recorded_at);
    let key;
    if (interval === 'hour') {
      key = `${d.toISOString().slice(0, 13)}:00`;
    } else {
      key = d.toISOString().slice(0, 10);
    }
    if (!buckets[key]) {
      buckets[key] = { date: key, readings: [], temps: [], counts: [] };
    }
    buckets[key].readings.push(r);
    buckets[key].temps.push(Number(r.temperature_celsius));
    buckets[key].counts.push(Number(r.object_count));
  }

  const trends = Object.keys(buckets).sort().map((key) => {
    const b = buckets[key];
    const { runtime, downtime, idleTime } = computeIntervals(b.readings);
    const lastCount = b.counts[b.counts.length - 1] || 0;
    const avgTemp = b.temps.reduce((a, t) => a + t, 0) / (b.temps.length || 1);
    return {
      date: key,
      runtime: Math.round(runtime * 10) / 10,
      downtime: Math.round(downtime * 10) / 10,
      idleTime: Math.round(idleTime * 10) / 10,
      production: lastCount,
      temperature: Math.round(avgTemp * 10) / 10,
      efficiency: 0,
    };
  });

  const machineRes = await query('SELECT target_quantity FROM machines WHERE id = $1', [machineUuid]);
  const target = Number(machineRes.rows[0]?.target_quantity) || 1;
  trends.forEach((t) => {
    t.efficiency = Math.round((t.production / target) * 1000) / 10;
  });

  return trends;
}

async function getAllMachinesTrends(startDate, endDate, industryFilter) {
  let sql = 'SELECT id, machine_name FROM machines WHERE is_active = true';
  const params = [];
  if (industryFilter) {
    params.push(industryFilter);
    sql += ` AND industry_name = $${params.length}`;
  }
  const machinesRes = await query(sql, params);
  const result = {};

  for (const m of machinesRes.rows) {
    result[m.machine_name] = await getTrendData(m.id, startDate, endDate);
  }

  const aggregated = {};
  for (const name of Object.keys(result)) {
    for (const point of result[name]) {
      if (!aggregated[point.date]) {
        aggregated[point.date] = {
          date: point.date,
          runtime: 0,
          downtime: 0,
          production: 0,
          efficiency: 0,
          temperature: 0,
          count: 0,
        };
      }
      aggregated[point.date].runtime += point.runtime;
      aggregated[point.date].downtime += point.downtime;
      aggregated[point.date].production += point.production;
      aggregated[point.date].efficiency += point.efficiency;
      aggregated[point.date].temperature += point.temperature;
      aggregated[point.date].count += 1;
    }
  }

  const combined = Object.values(aggregated)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((p) => ({
      date: p.date,
      runtime: Math.round(p.runtime * 10) / 10,
      downtime: Math.round(p.downtime * 10) / 10,
      production: p.production,
      efficiency: p.count ? Math.round((p.efficiency / p.count) * 10) / 10 : 0,
      temperature: p.count ? Math.round((p.temperature / p.count) * 10) / 10 : 0,
    }));

  return { byMachine: result, combined };
}

module.exports = {
  isRunning,
  isStopped,
  computeIntervals,
  getMachineReadings,
  getMachineMetrics,
  getDashboardSummary,
  getTrendData,
  getAllMachinesTrends,
};

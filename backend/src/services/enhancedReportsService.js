const PDFDocument = require('pdfkit');
const { query } = require('../config/db');
const {
  getMachineMetrics,
  getMachineReadings,
  isRunning,
  computeIntervals,
} = require('./metricsService');
const { getDateRange } = require('./reportsService');

function getShift(date) {
  const hour = new Date(date).getHours();
  if (hour >= 6 && hour < 14) return 'Morning (06:00–14:00)';
  if (hour >= 14 && hour < 22) return 'Afternoon (14:00–22:00)';
  return 'Night (22:00–06:00)';
}

function parseDetails(details) {
  if (!details) return {};
  if (typeof details === 'object') return details;
  try {
    return JSON.parse(details);
  } catch {
    return {};
  }
}

async function getReadingNearTime(machineId, timestamp) {
  const res = await query(
    `SELECT *
     FROM sensor_readings
     WHERE machine_id = $1
     ORDER BY recorded_at DESC
     LIMIT 1`,
    [machineId]
  );

  return res.rows[0];
}

function sensorSnapshot(reading) {
  if (!reading) {
    return { current: 0, temperature: 0, voltage: 0, objectCount: 0 };
  }
  return {
    current: Number(reading.current_ampere),
    temperature: Number(reading.temperature_celsius),
    voltage: Number(reading.voltage_volt),
    objectCount: Number(reading.object_count),
  };
}

function eventObservation(eventType, details, snapshot, userRole) {
  const d = parseDetails(details);
  const isUser = userRole === 'user';
  switch (eventType) {
    case 'production_stoppage':
      if (isUser) {
        return 'Production stoppage detected.';
      }
      return `Production halted for approximately ${d.durationMinutes || 5} minutes. Machine was not drawing current.`;
    case 'power_issue':
      if (isUser) {
        return 'Voltage dropped below the configured threshold.';
      }
      return `Voltage dropped to ${d.voltage || snapshot.voltage}V, below the configured threshold of ${d.threshold || 200}V.`;
    case 'overload':
      if (isUser) {
        return 'Overload condition detected.';
      }
      return `Overload condition: current at ${snapshot.current}A, temperature at ${snapshot.temperature}°C.`;
    default:
      return 'Abnormal operating condition detected during this period.';
  }
}

async function getMachinePerformance(machineId, startDate, endDate) {
  const readings = await getMachineReadings(machineId, startDate, endDate);
  if (!readings.length) {
    return {
      averageTemperature: 0,
      maximumTemperature: 0,
      averageCurrent: 0,
      maximumCurrent: 0,
      productionOutput: 0,
    };
  }

  const temps = readings.map((r) => Number(r.temperature_celsius));
  const currents = readings.map((r) => Number(r.current_ampere));

  return {
    averageTemperature: Math.round((temps.reduce((a, b) => a + b, 0) / temps.length) * 10) / 10,
    maximumTemperature: Math.max(...temps),
    averageCurrent: Math.round((currents.reduce((a, b) => a + b, 0) / currents.length) * 100) / 100,
    maximumCurrent: Math.max(...currents),
    productionOutput: Number(readings[readings.length - 1].object_count),
  };
}

async function getRecurringIssues(machineId, startDate, endDate) {
  const metrics = await getMachineMetrics(machineId, startDate, endDate);
  const eventsRes = await query(
    `SELECT event_type, COUNT(*)::int as count FROM events
     WHERE machine_id = $1 AND recorded_at >= $2 AND recorded_at <= $3
     GROUP BY event_type`,
    [machineId, startDate, endDate]
  );

  const counts = { overload: 0, power_issue: 0, production_stoppage: 0 };
  eventsRes.rows.forEach((r) => {
    counts[r.event_type] = r.count;
  });

  const idleAlerts = await query(
    `SELECT COUNT(*)::int as count FROM alerts
     WHERE machine_id = $1 AND alert_type = 'low_efficiency'
     AND created_at >= $2 AND created_at <= $3`,
    [machineId, startDate, endDate]
  );

  const readings = await getMachineReadings(machineId, startDate, endDate);
  let idleEvents = 0;
  for (let i = 1; i < readings.length; i++) {
    if (
      isRunning(readings[i]) &&
      isRunning(readings[i - 1]) &&
      Number(readings[i].object_count) <= Number(readings[i - 1].object_count)
    ) {
      idleEvents++;
    }
  }

  return {
    totalIdleEvents: idleEvents,
    totalIdleDurationMinutes: metrics.idleTimeMinutes,
    totalStoppages: counts.production_stoppage,
    totalOverloadEvents: counts.overload,
    totalPowerIssues: counts.power_issue,
    lowEfficiencyAlerts: idleAlerts.rows[0]?.count || 0,
  };
}

function buildEnhancedObservations(metrics, recurring, events, targetQuantity) {
  const observations = [];

  if (recurring.totalIdleDurationMinutes > 0) {
    observations.push(
      `Machine remained idle for ${Math.round(recurring.totalIdleDurationMinutes)} minutes.`
    );
  }
  if (metrics.productionEfficiency < 80) {
    observations.push(
      `Production efficiency dropped below 80% (actual: ${metrics.productionEfficiency}%).`
    );
  }
  if (recurring.totalPowerIssues > 0) {
    observations.push(
      `${recurring.totalPowerIssues} power interruption(s) were detected.`
    );
  }
  observations.push(
    `Production target achievement was ${Math.min(100, Math.round(metrics.productionEfficiency))}%.`
  );
  if (recurring.totalStoppages > 1) {
    observations.push('Machine experienced multiple stoppages.');
  }
  if (recurring.totalOverloadEvents > 0) {
    observations.push(
      `${recurring.totalOverloadEvents} overload event(s) recorded during the period.`
    );
  }
  if (metrics.downtimeMinutes > 30) {
    observations.push(
      `Extended downtime of ${Math.round(metrics.downtimeMinutes)} minutes impacted production.`
    );
  }
  if (observations.length === 0) {
    observations.push('Operations remained within normal parameters for this period.');
  }

  return observations;
}

async function generateEnhancedReport(period, dateStr, industryFilter, userRole) {
  const { start, end, label } = getDateRange(period, dateStr);
  let sql = 'SELECT * FROM machines WHERE is_active = true';
  const params = [];
  if (industryFilter) {
    params.push(industryFilter);
    sql += ` AND industry_name = $${params.length}`;
  }
  sql += ' ORDER BY machine_name';
  const machinesRes = await query(sql, params);

  const report = {
    period,
    label,
    startDate: start,
    endDate: end,
    generatedAt: new Date().toISOString(),
    userRole,
    executiveSummary: {
      totalMachines: machinesRes.rows.length,
      reportPeriod: label,
      generatedAt: new Date().toISOString(),
    },
    machines: [],
    factoryObservations: [],
  };

  let factoryProduction = 0;
  let factoryEfficiencySum = 0;

  for (const machine of machinesRes.rows) {
    const metrics = await getMachineMetrics(machine.id, start, end);
    const performance = await getMachinePerformance(machine.id, start, end);
    const recurring = await getRecurringIssues(machine.id, start, end);

    const eventsRes = await query(
      `SELECT * FROM events WHERE machine_id = $1 AND recorded_at >= $2 AND recorded_at <= $3
       ORDER BY recorded_at ASC`,
      [machine.id, start, end]
    );

    const eventAnalysis = [];
    for (const e of eventsRes.rows) {
      const snapshotReading = await getReadingNearTime(machine.id, e.recorded_at);
      const snapshot = sensorSnapshot(snapshotReading);
      const details = parseDetails(e.details);
      const durationMin = details.durationMinutes || 10;

      eventAnalysis.push({
        eventType: e.event_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        startTime: e.recorded_at,
        endTime: new Date(new Date(e.recorded_at).getTime() + durationMin * 60000).toISOString(),
        durationMinutes: durationMin,
        sensorSnapshot: snapshot,
        observation: eventObservation(e.event_type, e.details, snapshot, userRole),
      });
    }

    const observations = buildEnhancedObservations(
      metrics,
      recurring,
      eventsRes.rows,
      machine.target_quantity
    );

    factoryProduction += metrics.productionCount;
    factoryEfficiencySum += metrics.productionEfficiency;

    report.machines.push({
      productionSummary: {
        machineName: machine.machine_name,
        machineId: machine.machine_id,
        department: machine.department,
        date: label,
        shift: getShift(start),
        runtime: metrics.runtimeMinutes,
        downtime: metrics.downtimeMinutes,
        idleTime: metrics.idleTimeMinutes,
        productionCount: metrics.productionCount,
        productionRate: metrics.productionRate,
        efficiencyPercent: metrics.productionEfficiency,
        targetQuantity: machine.target_quantity,
      },
      eventAnalysis,
      machinePerformance: performance,
      recurringIssueAnalysis: recurring,
      observations,
    });
  }

  report.executiveSummary.totalProduction = factoryProduction;
  report.executiveSummary.averageEfficiency =
    machinesRes.rows.length > 0
      ? Math.round((factoryEfficiencySum / machinesRes.rows.length) * 10) / 10
      : 0;

  report.factoryObservations = [
    `Report covers ${machinesRes.rows.length} active machines for period: ${label}.`,
    `Total production output: ${factoryProduction} units.`,
    `Average efficiency across factory: ${report.executiveSummary.averageEfficiency}%.`,
  ];

  const allEvents = report.machines.flatMap((m) =>
    m.eventAnalysis.map((e) => ({
      ...e,
      machineName: m.productionSummary.machineName,
    }))
  );
  report.eventTimeline = allEvents.sort(
    (a, b) => new Date(a.startTime) - new Date(b.startTime)
  );

  return report;
}

function drawSectionHeader(doc, title) {
  doc.moveDown(0.5);
  doc.fontSize(12).fillColor('#1e3a8a').text(title, { underline: true });
  doc.fillColor('#000000');
  doc.moveDown(0.3);
}

function generateEnhancedPdf(report, res) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const filename = `PMRS_Audit_${report.period}_${report.label.replace(/[^\w]/g, '_')}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  doc.rect(0, 0, doc.page.width, 80).fill('#1e3a8a');
  doc.fillColor('#ffffff').fontSize(22).text('PRODUCTION MONITORING', 50, 25, { align: 'left' });
  doc.fontSize(12).text('Industrial Production Audit Report', 50, 52);
  doc.fillColor('#000000');

  doc.y = 100;
  doc.fontSize(10).text(`Report Period: ${report.label}`, { align: 'right' });
  doc.text(`Generated: ${new Date(report.generatedAt).toLocaleString()}`, { align: 'right' });
  doc.moveDown(1);

  drawSectionHeader(doc, 'EXECUTIVE SUMMARY');
  doc.fontSize(10);
  doc.text(`Total Machines Monitored: ${report.executiveSummary.totalMachines}`, { indent: 20 });
  doc.text(`Total Production Output: ${report.executiveSummary.totalProduction} units`, { indent: 20 });
  doc.text(`Average Factory Efficiency: ${report.executiveSummary.averageEfficiency}%`, { indent: 20 });
  doc.moveDown(0.5);
  report.factoryObservations.forEach((o) => doc.text(`• ${o}`, { indent: 20 }));
  doc.moveDown(0.5);

  report.machines.forEach((m, idx) => {
    if (idx > 0) doc.addPage();

    const ps = m.productionSummary;
    doc.fontSize(16).fillColor('#1e40af').text(ps.machineName);
    doc.fontSize(10).fillColor('#64748b').text(`${ps.machineId} | ${ps.department} | ${ps.date}`);
    doc.fillColor('#000000').moveDown(0.5);

    drawSectionHeader(doc, 'SECTION 1: PRODUCTION SUMMARY');
    doc.fontSize(10);
    doc.text(`Shift: ${ps.shift}`, { indent: 20 });
    doc.text(`Runtime: ${ps.runtime} min  |  Downtime: ${ps.downtime} min  |  Idle: ${ps.idleTime} min`, { indent: 20 });
    doc.text(`Production: ${ps.productionCount} units  |  Rate: ${ps.productionRate}/hr  |  Efficiency: ${ps.efficiencyPercent}%`, { indent: 20 });
    doc.text(`Target Quantity: ${ps.targetQuantity}`, { indent: 20 });

    drawSectionHeader(doc, 'SECTION 2: EVENT ANALYSIS');
    if (m.eventAnalysis.length === 0) {
      doc.text('No abnormal events recorded.', { indent: 20 });
    } else {
      m.eventAnalysis.forEach((ev, i) => {
        doc.fontSize(10).fillColor('#334155').text(`${i + 1}. ${ev.eventType}`, { indent: 20 });
        doc.fillColor('#000000').fontSize(9);
        doc.text(`Start: ${new Date(ev.startTime).toLocaleString()}  |  Duration: ${ev.durationMinutes} min`, { indent: 35 });
        if (report.userRole !== 'user') {
          doc.text(`Sensor: ${ev.sensorSnapshot.current}A | ${ev.sensorSnapshot.temperature}°C | ${ev.sensorSnapshot.voltage}V | Count ${ev.sensorSnapshot.objectCount}`, { indent: 35 });
        }
        doc.text(`Observation: ${ev.observation}`, { indent: 35 });
        doc.moveDown(0.2);
      });
    }

    if (report.userRole !== 'user') {
      drawSectionHeader(doc, 'SECTION 3: MACHINE PERFORMANCE');
      const perf = m.machinePerformance;
      doc.fontSize(10);
      doc.text(`Avg Temp: ${perf.averageTemperature}°C  |  Max Temp: ${perf.maximumTemperature}°C`, { indent: 20 });
      doc.text(`Avg Current: ${perf.averageCurrent}A  |  Max Current: ${perf.maximumCurrent}A`, { indent: 20 });
      doc.text(`Production Output: ${perf.productionOutput} units`, { indent: 20 });
    }

    drawSectionHeader(doc, 'SECTION 4: RECURRING ISSUE ANALYSIS');
    const rec = m.recurringIssueAnalysis;
    doc.text(`Idle Events: ${rec.totalIdleEvents}  |  Idle Duration: ${rec.totalIdleDurationMinutes} min`, { indent: 20 });
    doc.text(`Stoppages: ${rec.totalStoppages}  |  Overloads: ${rec.totalOverloadEvents}  |  Power Issues: ${rec.totalPowerIssues}`, { indent: 20 });

    drawSectionHeader(doc, 'SECTION 5: AUTO-GENERATED OBSERVATIONS');
    m.observations.forEach((o) => doc.text(`• ${o}`, { indent: 20 }));
  });

  doc.addPage();
  drawSectionHeader(doc, 'APPENDIX: EVENT TIMELINE (FACTORY-WIDE)');
  doc.fontSize(9);
  if (!report.eventTimeline?.length) {
    doc.text('No events in this period.', { indent: 20 });
  } else {
    report.eventTimeline.forEach((ev) => {
      doc.text(
        `${new Date(ev.startTime).toLocaleString()} — ${ev.machineName}: ${ev.eventType} (${ev.durationMinutes} min)`,
        { indent: 20 }
      );
    });
  }

  doc.end();
}

function generateEnhancedPdfBuffer(report) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      resolve(Buffer.concat(buffers));
    });
    doc.on('error', reject);

    doc.rect(0, 0, doc.page.width, 80).fill('#1e3a8a');
    doc.fillColor('#ffffff').fontSize(22).text('PRODUCTION MONITORING', 50, 25, { align: 'left' });
    doc.fontSize(12).text('Industrial Production Audit Report', 50, 52);
    doc.fillColor('#000000');

    doc.y = 100;
    doc.fontSize(10).text(`Report Period: ${report.label}`, { align: 'right' });
    doc.text(`Generated: ${new Date(report.generatedAt).toLocaleString()}`, { align: 'right' });
    doc.moveDown(1);

    drawSectionHeader(doc, 'EXECUTIVE SUMMARY');
    doc.fontSize(10);
    doc.text(`Total Machines Monitored: ${report.executiveSummary.totalMachines}`, { indent: 20 });
    doc.text(`Total Production Output: ${report.executiveSummary.totalProduction} units`, { indent: 20 });
    doc.text(`Average Factory Efficiency: ${report.executiveSummary.averageEfficiency}%`, { indent: 20 });
    doc.moveDown(0.5);
    report.factoryObservations.forEach((o) => doc.text(`• ${o}`, { indent: 20 }));
    doc.moveDown(0.5);

    report.machines.forEach((m, idx) => {
      if (idx > 0) doc.addPage();

      const ps = m.productionSummary;
      doc.fontSize(16).fillColor('#1e40af').text(ps.machineName);
      doc.fontSize(10).fillColor('#64748b').text(`${ps.machineId} | ${ps.department} | ${ps.date}`);
      doc.fillColor('#000000').moveDown(0.5);

      drawSectionHeader(doc, 'SECTION 1: PRODUCTION SUMMARY');
      doc.fontSize(10);
      doc.text(`Shift: ${ps.shift}`, { indent: 20 });
      doc.text(`Runtime: ${ps.runtime} min  |  Downtime: ${ps.downtime} min  |  Idle: ${ps.idleTime} min`, { indent: 20 });
      doc.text(`Production: ${ps.productionCount} units  |  Rate: ${ps.productionRate}/hr  |  Efficiency: ${ps.efficiencyPercent}%`, { indent: 20 });
      doc.text(`Target Quantity: ${ps.targetQuantity}`, { indent: 20 });

      drawSectionHeader(doc, 'SECTION 2: EVENT ANALYSIS');
      if (m.eventAnalysis.length === 0) {
        doc.text('No abnormal events recorded.', { indent: 20 });
      } else {
        m.eventAnalysis.forEach((ev, i) => {
          doc.fontSize(10).fillColor('#334155').text(`${i + 1}. ${ev.eventType}`, { indent: 20 });
          doc.fillColor('#000000').fontSize(9);
          doc.text(`Start: ${new Date(ev.startTime).toLocaleString()}  |  Duration: ${ev.durationMinutes} min`, { indent: 35 });
          if (report.userRole !== 'user') {
            doc.text(`Sensor: ${ev.sensorSnapshot.current}A | ${ev.sensorSnapshot.temperature}°C | ${ev.sensorSnapshot.voltage}V | Count ${ev.sensorSnapshot.objectCount}`, { indent: 35 });
          }
          doc.text(`Observation: ${ev.observation}`, { indent: 35 });
          doc.moveDown(0.2);
        });
      }

      if (report.userRole !== 'user') {
        drawSectionHeader(doc, 'SECTION 3: MACHINE PERFORMANCE');
        const perf = m.machinePerformance;
        doc.fontSize(10);
        doc.text(`Avg Temp: ${perf.averageTemperature}°C  |  Max Temp: ${perf.maximumTemperature}°C`, { indent: 20 });
        doc.text(`Avg Current: ${perf.averageCurrent}A  |  Max Current: ${perf.maximumCurrent}A`, { indent: 20 });
        doc.text(`Production Output: ${perf.productionOutput} units`, { indent: 20 });
      }

      drawSectionHeader(doc, 'SECTION 4: RECURRING ISSUE ANALYSIS');
      const rec = m.recurringIssueAnalysis;
      doc.text(`Idle Events: ${rec.totalIdleEvents}  |  Idle Duration: ${rec.totalIdleDurationMinutes} min`, { indent: 20 });
      doc.text(`Stoppages: ${rec.totalStoppages}  |  Overloads: ${rec.totalOverloadEvents}  |  Power Issues: ${rec.totalPowerIssues}`, { indent: 20 });

      drawSectionHeader(doc, 'SECTION 5: AUTO-GENERATED OBSERVATIONS');
      m.observations.forEach((o) => doc.text(`• ${o}`, { indent: 20 }));
    });

    doc.addPage();
    drawSectionHeader(doc, 'APPENDIX: EVENT TIMELINE (FACTORY-WIDE)');
    doc.fontSize(9);
    if (!report.eventTimeline?.length) {
      doc.text('No events in this period.', { indent: 20 });
    } else {
      report.eventTimeline.forEach((ev) => {
        doc.text(
          `${new Date(ev.startTime).toLocaleString()} — ${ev.machineName}: ${ev.eventType} (${ev.durationMinutes} min)`,
          { indent: 20 }
        );
      });
    }

    doc.end();
  });
}

module.exports = { generateEnhancedReport, generateEnhancedPdf, generateEnhancedPdfBuffer };

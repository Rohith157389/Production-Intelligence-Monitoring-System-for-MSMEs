const PDFDocument = require('pdfkit');
const { query } = require('../config/db');
const { getMachineMetrics } = require('./metricsService');

function getDateRange(period, dateStr) {
  const base = dateStr ? new Date(dateStr) : new Date();
  let start, end, label;

  if (period === 'daily') {
    start = new Date(base);
    start.setHours(0, 0, 0, 0);
    end = new Date(base);
    end.setHours(23, 59, 59, 999);
    label = start.toISOString().slice(0, 10);
  } else if (period === 'weekly') {
    const ref = new Date(base);
    const day = ref.getDay();
    const diff = ref.getDate() - day + (day === 0 ? -6 : 1);
    start = new Date(ref.getFullYear(), ref.getMonth(), diff);
    start.setHours(0, 0, 0, 0);
    end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    label = `Week of ${start.toISOString().slice(0, 10)}`;
  } else {
    start = new Date(base.getFullYear(), base.getMonth(), 1);
    end = new Date(base.getFullYear(), base.getMonth() + 1, 0, 23, 59, 59, 999);
    label = `${start.toLocaleString('default', { month: 'long' })} ${start.getFullYear()}`;
  }

  return { start: start.toISOString(), end: end.toISOString(), label };
}

async function getEventCounts(machineId, startDate, endDate) {
  const result = await query(
    `SELECT event_type, COUNT(*)::int as count
     FROM events
     WHERE machine_id = $1 AND recorded_at >= $2 AND recorded_at <= $3
     GROUP BY event_type`,
    [machineId, startDate, endDate]
  );

  const counts = { overload: 0, power_issue: 0, production_stoppage: 0 };
  result.rows.forEach((r) => {
    counts[r.event_type] = r.count;
  });
  return counts;
}

function buildObservations(metrics, events) {
  const observations = [];

  if (events.production_stoppage > 0) {
    observations.push(
      `Machine experienced ${events.production_stoppage} stoppage(s).`
    );
  }
  if (metrics.idleTimeMinutes > 0) {
    observations.push(
      `Machine remained idle for ${Math.round(metrics.idleTimeMinutes)} minutes.`
    );
  }
  if (events.power_issue > 0) {
    observations.push(
      `Voltage dropped below threshold ${events.power_issue} time(s).`
    );
  }
  if (events.overload > 0) {
    observations.push(
      `Machine experienced ${events.overload} overload event(s).`
    );
  }
  if (metrics.productionEfficiency < 60) {
    observations.push(
      `Production efficiency was below target at ${metrics.productionEfficiency}%.`
    );
  }
  if (metrics.downtimeMinutes > 30) {
    observations.push(
      `Significant downtime of ${Math.round(metrics.downtimeMinutes)} minutes recorded.`
    );
  }
  if (observations.length === 0) {
    observations.push('No significant abnormalities detected during this period.');
  }

  return observations;
}

async function generateReport(period, dateStr) {
  const { start, end, label } = getDateRange(period, dateStr);
  const machinesRes = await query(
    'SELECT * FROM machines WHERE is_active = true ORDER BY machine_name'
  );

  const report = {
    period,
    label,
    startDate: start,
    endDate: end,
    generatedAt: new Date().toISOString(),
    machines: [],
  };

  for (const machine of machinesRes.rows) {
    const metrics = await getMachineMetrics(machine.id, start, end);
    const events = await getEventCounts(machine.id, start, end);
    const observations = buildObservations(metrics, events);

    report.machines.push({
      machineName: machine.machine_name,
      machineId: machine.machine_id,
      department: machine.department,
      runtime: metrics.runtimeMinutes,
      downtime: metrics.downtimeMinutes,
      idleTime: metrics.idleTimeMinutes,
      productionCount: metrics.productionCount,
      productionRate: metrics.productionRate,
      averageRpm: metrics.averageRpm,
      maxTemperature: metrics.maxTemperature,
      averageCurrent: metrics.averageCurrent,
      powerIssueEvents: events.power_issue,
      overloadEvents: events.overload,
      productionStoppages: events.production_stoppage,
      productionEfficiency: metrics.productionEfficiency,
      observations,
    });
  }

  return report;
}

function generatePdf(report, res) {
  const doc = new PDFDocument({ margin: 50 });
  const filename = `PMRS_${report.period}_report_${report.label.replace(/\s/g, '_')}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  doc.fontSize(20).text('Production Monitoring & Reporting System', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(14).text(`${report.period.charAt(0).toUpperCase() + report.period.slice(1)} Report`, { align: 'center' });
  doc.fontSize(10).text(`Period: ${report.label}`, { align: 'center' });
  doc.text(`Generated: ${new Date(report.generatedAt).toLocaleString()}`, { align: 'center' });
  doc.moveDown(1.5);

  report.machines.forEach((m, idx) => {
    if (idx > 0) doc.addPage();

    doc.fontSize(14).fillColor('#1e40af').text(m.machineName);
    doc.fontSize(10).fillColor('#000').text(`ID: ${m.machineId} | Department: ${m.department}`);
    doc.moveDown(0.5);

    doc.fontSize(11).text('Production Metrics', { underline: true });
    doc.fontSize(10);
    doc.text(`Runtime: ${m.runtime} min | Downtime: ${m.downtime} min | Idle: ${m.idleTime} min`);
    doc.text(`Production Count: ${m.productionCount} | Rate: ${m.productionRate}/hr`);
    doc.text(`Efficiency: ${m.productionEfficiency}%`);
    doc.moveDown(0.3);

    doc.fontSize(11).text('Sensor Averages', { underline: true });
    doc.fontSize(10);
    doc.text(`Avg RPM: ${m.averageRpm} | Max Temp: ${m.maxTemperature}°C | Avg Current: ${m.averageCurrent}A`);
    doc.moveDown(0.3);

    doc.fontSize(11).text('Events', { underline: true });
    doc.fontSize(10);
    doc.text(`Power Issues: ${m.powerIssueEvents} | Overloads: ${m.overloadEvents} | Stoppages: ${m.productionStoppages}`);
    doc.moveDown(0.5);

    doc.fontSize(11).text('Observations', { underline: true });
    doc.fontSize(10);
    m.observations.forEach((obs) => {
      doc.text(`• ${obs}`);
    });
  });

  doc.end();
}

module.exports = { generateReport, generatePdf, getDateRange };

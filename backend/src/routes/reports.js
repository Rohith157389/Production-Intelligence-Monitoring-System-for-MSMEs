const express = require('express');
const { authenticate } = require('../middleware/auth');
const { getMachineMetrics } = require('../services/metricsService');
const { query } = require('../config/db');
const {
  generateEnhancedReport,
  generateEnhancedPdf,
} = require('../services/enhancedReportsService');

const router = express.Router();
router.use(authenticate);

async function sendReport(period, date, res, industryFilter, userRole) {
  const report = await generateEnhancedReport(period, date, industryFilter, userRole);
  res.json(report);
}

router.get('/daily', async (req, res) => {
  try {
    await sendReport('daily', req.query.date, res, req.industryFilter, req.user?.role);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate daily report' });
  }
});

router.get('/weekly', async (req, res) => {
  try {
    await sendReport('weekly', req.query.date, res, req.industryFilter, req.user?.role);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate weekly report' });
  }
});

router.get('/monthly', async (req, res) => {
  try {
    await sendReport('monthly', req.query.date, res, req.industryFilter, req.user?.role);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate monthly report' });
  }
});

router.get('/pdf/:period', async (req, res) => {
  try {
    const { period } = req.params;
    if (!['daily', 'weekly', 'monthly'].includes(period)) {
      return res.status(400).json({ error: 'Invalid period' });
    }
    const report = await generateEnhancedReport(period, req.query.date, req.industryFilter, req.user?.role);
    generateEnhancedPdf(report, res);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate PDF' });
    }
  }
});

router.get('/machine/:id/metrics', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const metrics = await getMachineMetrics(req.params.id, startDate, endDate);
    if (!metrics) return res.status(404).json({ error: 'Machine not found' });
    res.json(metrics);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

router.get('/events', async (req, res) => {
  try {
    const { machineId, startDate, endDate } = req.query;
    let sql = `
      SELECT e.*, m.machine_name, m.machine_id as machine_code
      FROM events e
      JOIN machines m ON m.id = e.machine_id
      WHERE 1=1
    `;
    const params = [];

    if (machineId) {
      params.push(machineId);
      sql += ` AND (m.machine_id = $${params.length} OR m.id::text = $${params.length})`;
    }
    if (startDate) {
      params.push(startDate);
      sql += ` AND e.recorded_at >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
      sql += ` AND e.recorded_at <= $${params.length}`;
    }

    sql += ' ORDER BY e.recorded_at DESC LIMIT 100';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

module.exports = router;

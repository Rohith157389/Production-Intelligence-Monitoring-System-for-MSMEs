const express = require('express');
const { authenticate } = require('../middleware/auth');
const { getDashboardSummary, getAllMachinesTrends } = require('../services/metricsService');
const { getEnhancedDashboard } = require('../services/dashboardService');

const router = express.Router();
router.use(authenticate);

router.get('/enhanced', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const end = endDate || new Date().toISOString();
    const start =
      startDate ||
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const data = await getEnhancedDashboard(start, end, req.industryFilter);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch enhanced dashboard' });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const summary = await getDashboardSummary(startDate, endDate, req.industryFilter);
    res.json(summary);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch dashboard summary' });
  }
});

router.get('/trends', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const trends = await getAllMachinesTrends(startDate, endDate, req.industryFilter);
    res.json(trends);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch trends' });
  }
});

module.exports = router;

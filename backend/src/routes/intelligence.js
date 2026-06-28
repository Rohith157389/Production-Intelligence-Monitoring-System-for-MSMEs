const express = require('express');
const { authenticate } = require('../middleware/auth');
const {
  getIntelligenceDashboard,
  getDetailedAnalysis,
} = require('../services/intelligenceService');

const router = express.Router();
router.use(authenticate);

router.get('/dashboard', async (req, res) => {
  try {
    const end = req.query.endDate || new Date().toISOString();
    const start =
      req.query.startDate ||
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const data = await getIntelligenceDashboard(start, end, req.industryFilter);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch intelligence dashboard' });
  }
});

router.get('/analysis/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const valid = ['efficiency', 'idle', 'overload', 'stoppage', 'interruption', 'power'];
    if (!valid.includes(type)) {
      return res.status(400).json({ error: 'Invalid analysis type' });
    }
    const end = req.query.endDate || new Date().toISOString();
    const start =
      req.query.startDate ||
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const data = await getDetailedAnalysis(type, start, end, req.query.machineId, req.industryFilter);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch detailed analysis' });
  }
});

module.exports = router;

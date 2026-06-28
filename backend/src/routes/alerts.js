const express = require('express');
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { acknowledged, machineId, limit = 50 } = req.query;
    let sql = `
      SELECT a.*, m.machine_name, m.machine_id as machine_code
      FROM alerts a
      LEFT JOIN machines m ON m.id = a.machine_id
      WHERE 1=1
    `;
    const params = [];

    if (req.industryFilter) {
      params.push(req.industryFilter);
      sql += ` AND m.industry_name = $${params.length}`;
    }

    if (acknowledged !== undefined) {
      params.push(acknowledged === 'true');
      sql += ` AND a.is_acknowledged = $${params.length}`;
    }
    if (machineId) {
      params.push(machineId);
      sql += ` AND (m.machine_id = $${params.length} OR m.id::text = $${params.length})`;
    }

    params.push(parseInt(limit, 10));
    sql += ` ORDER BY a.created_at DESC LIMIT $${params.length}`;

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

router.patch('/:id/acknowledge', async (req, res) => {
  try {
    const result = await query(
      'UPDATE alerts SET is_acknowledged = true WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Alert not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    let sql = `
      SELECT a.alert_type, a.severity, COUNT(*)::int as count
      FROM alerts a
      LEFT JOIN machines m ON m.id = a.machine_id
      WHERE a.is_acknowledged = false
    `;
    const params = [];
    if (req.industryFilter) {
      params.push(req.industryFilter);
      sql += ` AND m.industry_name = $${params.length}`;
    }
    sql += ` GROUP BY a.alert_type, a.severity`;
    
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch alert stats' });
  }
});

module.exports = router;

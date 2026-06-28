const express = require('express');
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const filter = req.industryFilter;
    const sql = filter ? 'SELECT * FROM machines WHERE industry_name = $1 ORDER BY machine_name' : 'SELECT * FROM machines ORDER BY machine_name';
    const params = filter ? [filter] : [];
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch machines' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM machines WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Machine not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch machine' });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      machineId,
      machineName,
      machineType,
      department,
      installationDate,
      targetQuantity,
      ratedCurrent,
      expectedCycleTimePerProduct,
      parameters,
    } = req.body;

    if (!machineId || !machineName || !machineType || !department || !installationDate) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    const industryName = req.industryFilter || null; // For admin, it might be null if not selected, or from headers

    const result = await query(
      `INSERT INTO machines (machine_id, machine_name, machine_type, department, installation_date, target_quantity, rated_current, expected_cycle_time_seconds, parameters, industry_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        machineId,
        machineName,
        machineType,
        department,
        installationDate,
        targetQuantity || 1000,
        ratedCurrent || 15,
        expectedCycleTimePerProduct || 60,
        parameters || { current: true, voltage: true, temperature: true, vibration: true, objectCount: true },
        industryName
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Machine ID already exists' });
    }
    res.status(500).json({ error: 'Failed to create machine' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const {
      machineName,
      machineType,
      department,
      installationDate,
      targetQuantity,
      ratedCurrent,
      expectedCycleTimePerProduct,
      isActive,
      currentOverloadThreshold,
      temperatureOverloadThreshold,
      voltageMinThreshold,
      stoppageDurationMinutes,
      highTemperatureThreshold,
      lowEfficiencyThreshold,
      parameters,
    } = req.body;

    const result = await query(
      `UPDATE machines SET
        machine_name = COALESCE($2, machine_name),
        machine_type = COALESCE($3, machine_type),
        department = COALESCE($4, department),
        installation_date = COALESCE($5, installation_date),
        target_quantity = COALESCE($6, target_quantity),
        rated_current = COALESCE($7, rated_current),
        expected_cycle_time_seconds = COALESCE($8, expected_cycle_time_seconds),
        is_active = COALESCE($9, is_active),
        current_overload_threshold = COALESCE($10, current_overload_threshold),
        temperature_overload_threshold = COALESCE($11, temperature_overload_threshold),
        voltage_min_threshold = COALESCE($12, voltage_min_threshold),
        stoppage_duration_minutes = COALESCE($13, stoppage_duration_minutes),
        high_temperature_threshold = COALESCE($14, high_temperature_threshold),
        low_efficiency_threshold = COALESCE($15, low_efficiency_threshold),
        parameters = COALESCE($16, parameters),
        updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [
        req.params.id,
        machineName,
        machineType,
        department,
        installationDate,
        targetQuantity,
        ratedCurrent,
        expectedCycleTimePerProduct,
        isActive,
        currentOverloadThreshold,
        temperatureOverloadThreshold,
        voltageMinThreshold,
        stoppageDurationMinutes,
        highTemperatureThreshold,
        lowEfficiencyThreshold,
        parameters,
      ]
    );

    if (!result.rows[0]) return res.status(404).json({ error: 'Machine not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update machine' });
  }
});

router.delete('/:id', async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can delete machines' });
  }
  try {
    const result = await query('DELETE FROM machines WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Machine not found' });
    res.json({ message: 'Machine deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete machine' });
  }
});

module.exports = router;

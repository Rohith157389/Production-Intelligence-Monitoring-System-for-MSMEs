const express = require('express');
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { analyzeReading } = require('../services/detectionService');

const router = express.Router();

function normalizeSensorPayload(body) {
  if (!body) return {};
  const machineId =
    body.machineId ||
    body.machine_id ||
    body.machineCode ||
    body.machine_code ||
    body.machine ||
    body.id;

  return {
    machineId,
    current: Number(body.current ?? body.current_ampere ?? body.current_amp ?? body.curr ?? 0),
    voltage: Number(body.voltage ?? body.voltage_volt ?? body.voltage_v ?? 0),
    temperature: Number(body.temperature ?? body.temperature_celsius ?? body.temp ?? 0),
    vibration: Number(body.vibration ?? body.vibration_g ?? body.vibe ?? 0),
    objectCount: Number(body.objectCount ?? body.object_count ?? body.count ?? body.obj_count ?? 0),
    timestamp: body.timestamp || body.recorded_at || body.time || body.datetime,
  };
}

async function processSensorReading(body, source = 'manual') {
  const {
    machineId,
    current,
    voltage,
    temperature,
    vibration,
    objectCount,
    timestamp,
  } = normalizeSensorPayload(body);

  const machineRes = await query(
    'SELECT * FROM machines WHERE machine_id = $1 OR id::text = $1',
    [machineId]
  );
  const machine = machineRes.rows[0];
  if (!machine) {
    const err = new Error('Machine not found');
    err.status = 404;
    throw err;
  }

  const recordedAt = timestamp ? new Date(timestamp) : new Date();

  const insertResult = await query(
    `INSERT INTO sensor_readings
     (machine_id, current_ampere, voltage_volt, temperature_celsius, vibration, object_count, recorded_at, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      machine.id,
      current ?? 0,
      voltage ?? 0,
      temperature ?? 0,
      vibration ?? 0,
      objectCount ?? 0,
      recordedAt,
      source,
    ]
  );

  const reading = insertResult.rows[0];

  const prevResult = await query(
    `SELECT * FROM sensor_readings
     WHERE machine_id = $1 AND id != $2
     ORDER BY recorded_at DESC LIMIT 1`,
    [machine.id, reading.id]
  );

  const events = await analyzeReading(machine, reading, prevResult.rows[0]);

  const isRunning =
    Number(reading.current_ampere) > 0.5;

  return {
    reading,
    machineStatus: isRunning ? 'running' : 'stopped',
    detectedEvents: events,
  };
}

router.post('/', authenticate, async (req, res) => {
  try {
    const result = await processSensorReading(req.body, 'manual');
    res.status(201).json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed to save reading' });
  }
});

async function iotHandler(req, res) {
  const apiKey = req.headers['x-api-key'];
  if (process.env.IOT_API_KEY && apiKey !== process.env.IOT_API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  try {
    const result = await processSensorReading(req.body, 'iot');
    res.status(201).json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed to save IoT reading' });
  }
}

router.get('/', authenticate, async (req, res) => {
  try {
    const { machineId, limit = 100, startDate, endDate } = req.query;
    let sql = `
      SELECT sr.*, m.machine_id as machine_code, m.machine_name
      FROM sensor_readings sr
      JOIN machines m ON m.id = sr.machine_id
      WHERE 1=1
    `;
    const params = [];

    if (req.industryFilter) {
      params.push(req.industryFilter);
      sql += ` AND m.industry_name = $${params.length}`;
    }

    if (machineId) {
      params.push(machineId);
      sql += ` AND (m.machine_id = $${params.length} OR m.id::text = $${params.length})`;
    }
    if (startDate) {
      params.push(startDate);
      sql += ` AND sr.recorded_at >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
      sql += ` AND sr.recorded_at <= $${params.length}`;
    }

    params.push(parseInt(limit, 10));
    sql += ` ORDER BY sr.recorded_at DESC LIMIT $${params.length}`;

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch readings' });
  }
});

router.iotHandler = iotHandler;
module.exports = router;

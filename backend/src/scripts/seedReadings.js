const { setupDatabase, pool, query } = require('../config/db');
const { analyzeReading } = require('../services/detectionService');

async function seedReadings() {
  try {
    await setupDatabase();
    const machines = await query('SELECT * FROM machines');
    if (machines.rows.length === 0) {
      console.log('No machines found. Run npm run db:seed first.');
      process.exit(1);
    }

    const now = Date.now();
    let count = 0;

    for (const machine of machines.rows) {
      let objectCount = 0;
      for (let h = 48; h >= 0; h -= 2) {
        const recordedAt = new Date(now - h * 3600000);
        const isRunning = h % 8 !== 0 && h % 12 !== 0;
        const current = isRunning ? 8 + Math.random() * 5 : 0;
        const rpm = isRunning ? 1200 + Math.random() * 200 : 0;
        if (isRunning && Math.random() > 0.3) objectCount += Math.floor(Math.random() * 15);

        const voltage = 210 + Math.random() * 20 - (h % 20 === 0 ? 30 : 0);
        const temperature = isRunning ? 55 + Math.random() * 20 : 25 + Math.random() * 5;

        const result = await query(
          `INSERT INTO sensor_readings
           (machine_id, current_ampere, voltage_volt, temperature_celsius, vibration, rpm, object_count, recorded_at, source)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'manual')
           RETURNING *`,
          [
            machine.id,
            Math.round(current * 100) / 100,
            Math.round(voltage * 100) / 100,
            Math.round(temperature * 10) / 10,
            Math.round(Math.random() * 2 * 10000) / 10000,
            Math.round(rpm),
            objectCount,
            recordedAt,
          ]
        );

        const prev = await query(
          `SELECT * FROM sensor_readings WHERE machine_id = $1 AND id != $2 ORDER BY recorded_at DESC LIMIT 1`,
          [machine.id, result.rows[0].id]
        );
        await analyzeReading(machine, result.rows[0], prev.rows[0]);
        count++;
      }
    }

    console.log(`Created ${count} sample sensor readings.`);
  } catch (err) {
    console.error('Seed readings failed:', err.message);
    process.exit(1);
  } finally {
    const p = pool();
    if (p?.end) await p.end();
  }
}

seedReadings();

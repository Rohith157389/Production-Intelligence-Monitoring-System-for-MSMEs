const { query } = require('../config/db');
const { isRunning, isStopped } = require('./metricsService');

async function createEvent(machineId, eventType, details, recordedAt) {
  await query(
    `INSERT INTO events (machine_id, event_type, details, recorded_at)
     VALUES ($1, $2, $3, $4)`,
    [machineId, eventType, JSON.stringify(details), recordedAt || new Date()]
  );
}

async function createAlert(machineId, alertType, message, severity = 'warning', metadata = {}) {
  const recent = await query(
    `SELECT id FROM alerts
     WHERE machine_id = $1 AND alert_type = $2
     AND created_at > NOW() - INTERVAL '30 minutes'
     LIMIT 1`,
    [machineId, alertType]
  );
  if (recent.rows.length > 0) return;

  await query(
    `INSERT INTO alerts (machine_id, alert_type, message, severity, metadata)
     VALUES ($1, $2, $3, $4, $5)`,
    [machineId, alertType, message, severity, JSON.stringify(metadata)]
  );
}

async function analyzeReading(machine, reading, previousReading) {
  const events = [];
  const recordedAt = reading.recorded_at || new Date();

  const current = Number(reading.current_ampere);
  const voltage = Number(reading.voltage_volt);
  const temp = Number(reading.temperature_celsius);
  const vibration = Number(reading.vibration || reading.vibration_mms || 0);

  // 1. Current Alerts
  if (current > 10) {
    await createEvent(machine.id, 'overload', { current }, recordedAt);
    await createAlert(machine.id, 'high_current_critical', `Critical: Overload detected on ${machine.machine_name} (${current}A)`, 'critical', { current });
    events.push('overload');
  } else if (current >= 8 && current <= 10) {
    await createAlert(machine.id, 'high_current_warning', `Warning: High current on ${machine.machine_name} (${current}A)`, 'warning', { current });
  }

  // 2. Voltage Alerts
  if ((voltage < 205 && voltage > 0) || voltage > 240) {
    await createEvent(machine.id, 'power_issue', { voltage }, recordedAt);
    await createAlert(machine.id, 'voltage_critical', `Critical: Voltage out of bounds on ${machine.machine_name} (${voltage}V)`, 'critical', { voltage });
    events.push('power_issue');
  } else if ((voltage >= 205 && voltage < 215) || (voltage > 230 && voltage <= 240)) {
    await createAlert(machine.id, 'voltage_warning', `Warning: Voltage fluctuations on ${machine.machine_name} (${voltage}V)`, 'warning', { voltage });
  }

  // 3. Temperature Alerts
  if (temp > 40) {
    await createAlert(machine.id, 'high_temperature_critical', `Critical: Overheating on ${machine.machine_name} (${temp}°C)`, 'critical', { temperature: temp });
    events.push('high_temperature');
  } else if (temp >= 31 && temp <= 35) {
    await createAlert(machine.id, 'temperature_warning', `Warning: Elevated temperature on ${machine.machine_name} (${temp}°C)`, 'warning', { temperature: temp });
  }

  // 4. Vibration Alerts
  if (vibration > 4.0) {
    await createAlert(machine.id, 'vibration_critical', `Critical: Severe vibration on ${machine.machine_name} (${vibration} mm/s)`, 'critical', { vibration });
  } else if (vibration >= 2.0 && vibration <= 4.0) {
    await createAlert(machine.id, 'vibration_warning', `Warning: High vibration on ${machine.machine_name} (${vibration} mm/s)`, 'warning', { vibration });
  }

  // 5. Object Count (Production Stoppage)
  if (isStopped(reading)) {
    const stoppedReadings = await query(
      `SELECT recorded_at FROM sensor_readings
       WHERE machine_id = $1 AND current_ampere <= 0.5
       ORDER BY recorded_at DESC LIMIT 60`, // enough for 5 minutes at 1 reading per sec? Let's just use time query
      [machine.id]
    );

    if (stoppedReadings.rows.length >= 2) {
      const oldest = new Date(stoppedReadings.rows[stoppedReadings.rows.length - 1].recorded_at);
      const newest = new Date(stoppedReadings.rows[0].recorded_at);
      const durationMin = (newest - oldest) / 60000;

      if (durationMin >= 5) {
        await createEvent(machine.id, 'production_stoppage', { durationMinutes: durationMin }, recordedAt);
        await createAlert(machine.id, 'stoppage_critical', `Critical: Production stoppage on ${machine.machine_name} for >5 mins`, 'critical', { durationMinutes: durationMin });
        events.push('production_stoppage');
      } else if (durationMin >= 1 && durationMin < 2) { // Just to not spam
        await createAlert(machine.id, 'stoppage_warning', `Warning: Machine idle for >1 min on ${machine.machine_name}`, 'warning', { durationMinutes: durationMin });
      }
    }
  }

  return events;
}

module.exports = { createEvent, createAlert, analyzeReading };

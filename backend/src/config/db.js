const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

let pool;
let memoryDb = null;

function createMemoryPool() {
  const { newDb, DataType } = require('pg-mem');
  memoryDb = newDb();

  memoryDb.public.registerFunction({
    name: 'uuid_generate_v4',
    returns: DataType.uuid,
    impure: true,
    implementation: () => crypto.randomUUID(),
  });

  memoryDb.public.registerFunction({
    name: 'now',
    returns: DataType.timestamptz,
    impure: true,
    implementation: () => new Date(),
  });

  const adapter = memoryDb.adapters.createPg();
  return new adapter.Pool();
}

async function runSchema(client, useMemory) {
  if (useMemory) {
    const statements = require('./memorySchema');
    for (const stmt of statements) {
      await client.query(stmt);
    }
    return;
  }

  const schemaPath = path.join(__dirname, '../scripts/schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8').replace(
    /CREATE EXTENSION IF NOT EXISTS[^;]+;/gi,
    ''
  );

  const statements = schema
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'));

  for (const stmt of statements) {
    await client.query(stmt);
  }
}

async function seedIfEmpty(client) {
  const bcrypt = require('bcryptjs');

  const users = await client.query('SELECT COUNT(*)::int AS count FROM users');
  if (users.rows[0].count === 0) {
    const adminHash = await bcrypt.hash('admin123', 10);
    const managerHash = await bcrypt.hash('manager123', 10);
    const rohithHash = await bcrypt.hash('#Rohith157389', 10);
    await client.query(
      `INSERT INTO users (email, password_hash, full_name, role, industry_name, location) VALUES ($1, $2, $3, $4, $5, $6)`,
      ['p.rohithkumarreddy21@gmail.com', rohithHash, 'Rohith', 'admin', 'Default Industry', 'HQ']
    );
    await client.query(
      `INSERT INTO users (email, password_hash, full_name, role, industry_name, location) VALUES ($1, $2, $3, $4, $5, $6)`,
      ['admin@pmrs.com', adminHash, 'System Admin', 'admin', 'Default Industry', 'HQ']
    );
    await client.query(
      `INSERT INTO users (email, password_hash, full_name, role, industry_name, location) VALUES ($1, $2, $3, $4, $5, $6)`,
      ['manager@pmrs.com', managerHash, 'Factory Manager', 'factory_manager', 'Default Industry', 'New York']
    );
    console.log('Seeded demo users.');
  }

  const machineCount = await client.query('SELECT COUNT(*)::int AS count FROM machines');
  if (machineCount.rows[0].count === 0) {
    const machines = [
      ['MCH-001', 'CNC Lathe Alpha', 'CNC Lathe', 'Machining', '2023-01-15', 500, 12, 45, 'Default Industry'],
      ['MCH-002', 'Injection Molder Beta', 'Injection Molder', 'Molding', '2023-03-20', 800, 18, 30, 'Default Industry'],
      ['MCH-003', 'Assembly Line Gamma', 'Assembly Line', 'Assembly', '2023-06-10', 1200, 10, 20, 'Default Industry'],
    ];
    for (const m of machines) {
      await client.query(
        `INSERT INTO machines (machine_id, machine_name, machine_type, department, installation_date, target_quantity, rated_current, expected_cycle_time_seconds, industry_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        m
      );
    }
    console.log('Seeded demo machines.');
  }

  await seedDemoReadings(client);
}

async function seedDemoReadings(client) {
  const readingCount = await client.query('SELECT COUNT(*)::int AS count FROM sensor_readings');
  if (readingCount.rows[0].count > 0) return;

  const machines = await client.query('SELECT * FROM machines');
  if (machines.rows.length === 0) return;

  const now = Date.now();
  let total = 0;

  for (const machine of machines.rows) {
    let objectCount = 0;
    for (let h = 72; h >= 0; h -= 3) {
      const recordedAt = new Date(now - h * 3600000);
      const isRunning = h % 9 !== 0 && h % 15 !== 0;
      const current = isRunning ? 6 + Math.random() * 8 : 0;
      if (isRunning && Math.random() > 0.35) objectCount += Math.floor(Math.random() * 12 + 1);

      const voltage = 215 + Math.random() * 15 - (h % 18 === 0 ? 35 : 0);
      const temperature = isRunning ? 50 + Math.random() * 25 : 22 + Math.random() * 5;
      const overload = h % 24 === 0 && isRunning;

      await client.query(
        `INSERT INTO sensor_readings
         (machine_id, current_ampere, voltage_volt, temperature_celsius, vibration, object_count, recorded_at, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'manual')`,
        [
          machine.id,
          round2(overload ? (Number(machine.rated_current) || 12) + 3 : current),
          round2(voltage),
          round2(temperature),
          round2(Math.random() * 1.5),
          objectCount,
          recordedAt,
        ]
      );
      total++;
    }
  }

  console.log(`Seeded ${total} demo sensor readings for dashboard.`);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

async function setupDatabase() {
  const useMemory = process.env.USE_MEMORY_DB === 'true';

  if (useMemory) {
    pool = createMemoryPool();
    const client = await pool.connect();
    try {
      await runSchema(client, true);
      await seedIfEmpty(client);
      console.log('Using in-memory database (no PostgreSQL required).');
    } finally {
      client.release();
    }
    return;
  }

  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  pool.on('error', (err) => console.error('Unexpected database error', err));

  try {
    await pool.query('SELECT 1');
    console.log('Connected to PostgreSQL.');
    const client = await pool.connect();
    try {
      await runSchema(client, false);
      await seedIfEmpty(client);
    } finally {
      client.release();
    }
  } catch (err) {
    console.warn('PostgreSQL unavailable, falling back to in-memory database.');
    process.env.USE_MEMORY_DB = 'true';
    pool = createMemoryPool();
    const client = await pool.connect();
    try {
      await runSchema(client, true);
      await seedIfEmpty(client);
    } finally {
      client.release();
    }
  }
}

function query(text, params) {
  return pool.query(text, params);
}

module.exports = { pool: () => pool, query, setupDatabase };

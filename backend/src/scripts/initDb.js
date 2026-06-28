require('dotenv').config();
const { setupDatabase, pool } = require('../config/db');

async function initDb() {
  try {
    process.env.USE_MEMORY_DB = process.env.USE_MEMORY_DB || 'true';
    await setupDatabase();
    console.log('Database initialized successfully.');
  } catch (err) {
    console.error('Failed to initialize database:', err.message);
    process.exit(1);
  } finally {
    const p = pool();
    if (p?.end) await p.end();
  }
}

initDb();

const bcrypt = require('bcryptjs');
const { setupDatabase, pool, query } = require('../config/db');

async function seed() {
  try {
    await setupDatabase();
    const adminHash = await bcrypt.hash('admin123', 10);
    const managerHash = await bcrypt.hash('manager123', 10);

    await query(
      `INSERT INTO users (email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)
       ON CONFLICT (email) DO NOTHING`,
      [
        'admin@pmrs.com', adminHash, 'System Admin', 'admin',
        'manager@pmrs.com', managerHash, 'Factory Manager', 'factory_manager',
      ]
    );

    const machines = [
      ['MCH-001', 'CNC Lathe Alpha', 'CNC Lathe', 'Machining', '2023-01-15', 500],
      ['MCH-002', 'Injection Molder Beta', 'Injection Molder', 'Molding', '2023-03-20', 800],
      ['MCH-003', 'Assembly Line Gamma', 'Assembly Line', 'Assembly', '2023-06-10', 1200],
    ];

    for (const m of machines) {
      await query(
        `INSERT INTO machines (machine_id, machine_name, machine_type, department, installation_date, target_quantity)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (machine_id) DO NOTHING`,
        m
      );
    }

    console.log('Seed data created.');
    console.log('  Admin: admin@pmrs.com / admin123');
    console.log('  Manager: manager@pmrs.com / manager123');
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    const p = pool();
    if (p?.end) await p.end();
  }
}

seed();

module.exports = [
  `CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    industry_name VARCHAR(255),
    location VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE TABLE machines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    machine_id VARCHAR(100) UNIQUE NOT NULL,
    machine_name VARCHAR(255) NOT NULL,
    machine_type VARCHAR(100) NOT NULL,
    department VARCHAR(100) NOT NULL,
    industry_name VARCHAR(255),
    installation_date DATE NOT NULL,
    rated_current REAL DEFAULT 15,
    expected_cycle_time_seconds REAL DEFAULT 60,
    target_quantity INTEGER DEFAULT 1000,
    current_overload_threshold REAL DEFAULT 15,
    temperature_overload_threshold REAL DEFAULT 75,
    voltage_min_threshold REAL DEFAULT 200,
    stoppage_duration_minutes INTEGER DEFAULT 5,
    high_temperature_threshold REAL DEFAULT 70,
    low_efficiency_threshold REAL DEFAULT 60,
    is_active BOOLEAN DEFAULT true,
    parameters TEXT DEFAULT '{"current": true, "voltage": true, "temperature": true, "vibration": true, "objectCount": true}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE TABLE sensor_readings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    machine_id UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    current_ampere REAL NOT NULL DEFAULT 0,
    voltage_volt REAL NOT NULL DEFAULT 0,
    temperature_celsius REAL NOT NULL DEFAULT 0,
    vibration REAL NOT NULL DEFAULT 0,
    object_count INTEGER NOT NULL DEFAULT 0,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source VARCHAR(50) DEFAULT 'manual',
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    machine_id UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    details TEXT DEFAULT '{}',
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    machine_id UUID REFERENCES machines(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(20) DEFAULT 'warning',
    is_acknowledged BOOLEAN DEFAULT false,
    metadata TEXT DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL,
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`
];

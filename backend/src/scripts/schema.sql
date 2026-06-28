-- Production Monitoring & Reporting System Schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'factory_manager', 'user')),
  industry_name VARCHAR(255),
  location VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS machines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  machine_id VARCHAR(100) UNIQUE NOT NULL,
  machine_name VARCHAR(255) NOT NULL,
  machine_type VARCHAR(100) NOT NULL,
  department VARCHAR(100) NOT NULL,
  industry_name VARCHAR(255),
  installation_date DATE NOT NULL,
  target_quantity INTEGER DEFAULT 1000,
  rated_current DECIMAL(10,2) DEFAULT 15,
  expected_cycle_time_seconds DECIMAL(10,2) DEFAULT 60,
  current_overload_threshold DECIMAL(10,2) DEFAULT 15,
  temperature_overload_threshold DECIMAL(10,2) DEFAULT 75,
  voltage_min_threshold DECIMAL(10,2) DEFAULT 200,
  stoppage_duration_minutes INTEGER DEFAULT 5,
  high_temperature_threshold DECIMAL(10,2) DEFAULT 70,
  low_efficiency_threshold DECIMAL(10,2) DEFAULT 60,
  is_active BOOLEAN DEFAULT true,
  parameters JSONB DEFAULT '{"current": true, "voltage": true, "temperature": true, "vibration": true, "objectCount": true}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sensor_readings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  machine_id UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  current_ampere DECIMAL(10,2) NOT NULL DEFAULT 0,
  voltage_volt DECIMAL(10,2) NOT NULL DEFAULT 0,
  temperature_celsius DECIMAL(10,2) NOT NULL DEFAULT 0,
  vibration DECIMAL(10,4) NOT NULL DEFAULT 0,
  object_count INTEGER NOT NULL DEFAULT 0,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source VARCHAR(50) DEFAULT 'manual' CHECK (source IN ('manual', 'iot')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sensor_readings_machine ON sensor_readings(machine_id);
CREATE INDEX IF NOT EXISTS idx_sensor_readings_recorded_at ON sensor_readings(recorded_at);

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  machine_id UUID NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  details JSONB DEFAULT '{}',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_machine ON events(machine_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);

CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  machine_id UUID REFERENCES machines(id) ON DELETE CASCADE,
  alert_type VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  severity VARCHAR(20) DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  is_acknowledged BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_machine ON alerts(machine_id);
CREATE INDEX IF NOT EXISTS idx_alerts_acknowledged ON alerts(is_acknowledged);

CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_type VARCHAR(50) NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);

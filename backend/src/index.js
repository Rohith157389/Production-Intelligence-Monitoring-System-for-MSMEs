require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { setupDatabase } = require('./config/db');

const authRoutes = require('./routes/auth');
const machineRoutes = require('./routes/machines');
const sensorRoutes = require('./routes/sensorData');
const dashboardRoutes = require('./routes/dashboard');
const alertRoutes = require('./routes/alerts');
const reportRoutes = require('./routes/reports');
const usersRouter = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'PIMS API',
    version: '1.0.0',
    database: process.env.USE_MEMORY_DB === 'true' ? 'memory' : 'postgresql',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/machines', machineRoutes);
app.use('/api/sensor-readings', sensorRoutes);
app.post('/api/sensor-data', sensorRoutes.iotHandler);
app.post('/api/iot-sensor-data', sensorRoutes.iotHandler);
app.use('/api/intelligence', require('./routes/intelligence'));
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/users', usersRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  await setupDatabase();
  app.listen(PORT, () => {
    console.log(`PMRS API running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

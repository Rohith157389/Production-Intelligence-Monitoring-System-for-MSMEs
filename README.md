# Production Monitoring & Reporting System (PMRS)

A full-stack web application for MSME manufacturing industries to monitor production activities, calculate metrics, detect abnormalities, and generate reports.

## Features

- **JWT Authentication** with Admin and Factory Manager roles
- **Machine Registration** — ID, name, type, department, installation date
- **Manual Sensor Data Entry** — current, voltage, temperature, vibration, RPM, object count
- **Dashboard** — machines, production, runtime, downtime, idle time, efficiency with charts
- **Derived Metrics** — running status, runtime, downtime, idle time, production rate, efficiency
- **Event Detection** — overload, power issues, production stoppage
- **Alerts** — high temperature, voltage drop, overload, stoppage, low efficiency
- **Reports** — daily, weekly, monthly with observations and PDF export
- **Historical Analytics** — trend charts for runtime, production, efficiency, temperature
- **IoT Ready** — `POST /api/sensor-data` for future ESP32 integration

## Tech Stack

| Layer    | Technology              |
|----------|-------------------------|
| Frontend | React, Tailwind, Recharts |
| Backend  | Node.js, Express        |
| Database | PostgreSQL              |
| Auth     | JWT                     |

## Quick Start

### Prerequisites

- Node.js 18+
- Docker (for PostgreSQL) or a local PostgreSQL instance

### 1. Start Database

```bash
docker compose up -d
```

### 2. Backend Setup

```bash
cd backend
npm install
cp .env.example .env   # if .env doesn't exist
npm run db:init
npm run db:seed
node src/scripts/seedReadings.js   # optional demo sensor data
npm run dev
```

API runs at **http://localhost:5000**

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

App runs at **http://localhost:3000**

## Demo Accounts

| Role            | Email              | Password    |
|-----------------|--------------------|-------------|
| Admin           | admin@pmrs.com     | admin123    |
| Factory Manager | manager@pmrs.com   | manager123  |

## API Endpoints

### Auth
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/register` (admin only)

### Machines
- `GET/POST /api/machines`
- `PUT/DELETE /api/machines/:id`

### Sensor Data
- `POST /api/sensor-readings` (authenticated, manual entry)
- `GET /api/sensor-readings`
- `POST /api/sensor-data` (IoT — optional `X-API-Key` header)

### Dashboard & Analytics
- `GET /api/dashboard/summary`
- `GET /api/dashboard/trends`

### Alerts
- `GET /api/alerts`
- `PATCH /api/alerts/:id/acknowledge`

### Reports
- `GET /api/reports/daily|weekly|monthly`
- `GET /api/reports/pdf/:period?date=YYYY-MM-DD`

## IoT Integration (Future)

Send sensor data from ESP32 or other devices. The backend accepts both `application/json` and `application/x-www-form-urlencoded` payloads, and normalizes common field names such as `machineId`, `machine_id`, `current_ampere`, and `object_count`.

```http
POST /api/sensor-data
Content-Type: application/json
X-API-Key: esp32-dev-key

{
  "machine_id": "MCH-001",
  "current": 10.5,
  "voltage": 220,
  "temperature": 65,
  "vibration": 0.12,
  "rpm": 1450,
  "object_count": 150,
  "timestamp": "2026-05-30T10:30:00Z"
}
```

Or send URL-encoded form data:

```http
POST /api/sensor-data
Content-Type: application/x-www-form-urlencoded
X-API-Key: esp32-dev-key

machine_id=MCH-001&current=10.5&voltage=220&temperature=65&vibration=0.12&rpm=1450&object_count=150&timestamp=2026-05-30T10:30:00Z
```

You can also post to `/api/iot-sensor-data` as an explicit hardware ingestion endpoint.

### ESP32 Example

A complete ESP32 sketch is available at `backend/esp32_iot_example.ino`.

Replace the Wi-Fi credentials and backend URL, then use `X-API-Key` if you have `IOT_API_KEY` configured.

Compatible sensors: ACS712 (current), Hall Effect (RPM), DS18B20 (temperature), MPU6050 (vibration), IR counter (objects).

## Metric Logic

| Metric              | Rule                                              |
|---------------------|---------------------------------------------------|
| Running Status      | Current > 0 AND RPM > 0                           |
| Runtime             | Duration where running                            |
| Downtime            | Duration where current = 0 AND rpm = 0            |
| Idle Time           | Running but object count not increasing           |
| Production Count    | Latest object count                               |
| Production Rate     | Object count / runtime (hours)                    |
| Efficiency          | Actual output / target × 100                      |

## Project Structure

```
pd/
├── backend/          # Express API
├── frontend/         # React SPA
├── docker-compose.yml
└── README.md
```

## License

MIT

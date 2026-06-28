const axios = require('axios');

const backendUrl = 'http://localhost:5000/api/sensor-data';
const apiKey = 'esp32-dev-key'; // Simulated API key

// Realistic ranges for a running machine (Normal State)
const RANGES = {
  currentMin: 4.5, currentMax: 7.5, // Amps (Normal 4-8A)
  voltageMin: 216.0, voltageMax: 229.0, // Volts (Normal 215-230V)
  tempMin: 21.0, tempMax: 29.0, // Celsius (Normal 20-30°C)
  vibMin: 0.6, vibMax: 1.9, // mm/s (Normal 0.5-2.0)
};

let objectCount = 100;
let totalSeconds = 0;
const MAX_SECONDS = 3600; // 1 hour

console.log(`Starting continuous simulation for 1 hour (${MAX_SECONDS} seconds)...`);
console.log(`Target: ${backendUrl}`);

const interval = setInterval(async () => {
  if (totalSeconds >= MAX_SECONDS) {
    console.log('Finished 1 hour of simulation. Stopping.');
    clearInterval(interval);
    return;
  }

  // Simulate realistic slight fluctuations
  const current = (Math.random() * (RANGES.currentMax - RANGES.currentMin) + RANGES.currentMin).toFixed(2);
  const voltage = (Math.random() * (RANGES.voltageMax - RANGES.voltageMin) + RANGES.voltageMin).toFixed(2);
  const temperature = (Math.random() * (RANGES.tempMax - RANGES.tempMin) + RANGES.tempMin).toFixed(2);
  const vibration = (Math.random() * (RANGES.vibMax - RANGES.vibMin) + RANGES.vibMin).toFixed(4);
  
  // Randomly increment object count (e.g., 20% chance every second)
  if (Math.random() > 0.8) {
    objectCount++;
  }

  const payload = {
    machine_id: 'MCH-001',
    current: Number(current),
    voltage: Number(voltage),
    temperature: Number(temperature),
    vibration: Number(vibration),
    object_count: objectCount,
    timestamp: new Date().toISOString()
  };

  try {
    const res = await axios.post(backendUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      }
    });
    totalSeconds++;
    process.stdout.write(`\r[${totalSeconds}/${MAX_SECONDS}s] Sent data -> Current: ${current}A | Temp: ${temperature}°C | Count: ${objectCount} | Status: ${res.status}`);
  } catch (err) {
    console.error('\nFailed to send data:', err.message);
  }

}, 1000); // 1000 ms = 1 second

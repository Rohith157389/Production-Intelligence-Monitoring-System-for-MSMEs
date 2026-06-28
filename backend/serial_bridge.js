/*
Node.js Serial -> HTTP bridge

Usage:
  1) Install dependencies:
     npm install serialport @serialport/parser-readline axios minimist

  2) Run the bridge (adjust COM port / url / key):
     node serial_bridge.js --port COM3 --baud 115200 --url http://localhost:5000/api/sensor-data --key esp32-dev-key

Behavior:
  - Reads newline-delimited JSON from the Arduino serial port.
  - Parses each line and posts it to the configured backend URL with optional X-API-Key header.
  - If a parsed line lacks a timestamp, bridge adds an ISO timestamp before posting.
*/

const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const axios = require('axios');
const argv = require('minimist')(process.argv.slice(2));

const portName = argv.port || argv.p || 'COM3';
const baudRate = parseInt(argv.baud || argv.b || '115200', 10);
const backendUrl = argv.url || argv.u || 'http://localhost:5000/api/sensor-data';
const apiKey = argv.key || argv.k || '';

console.log('Serial bridge starting');
console.log('port:', portName, 'baud:', baudRate);
console.log('backend:', backendUrl, 'apiKey:', apiKey ? '***' : '(none)');

const port = new SerialPort({ path: portName, baudRate }, (err) => {
  if (err) return console.error('Error opening port:', err.message);
});

const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

parser.on('data', async (line) => {
  line = line.trim();
  if (!line) return;
  let payload;
  try {
    payload = JSON.parse(line);
  } catch (err) {
    console.warn('Ignoring non-JSON line:', line);
    return;
  }

  // Ensure minimal fields
  if (!payload.timestamp) payload.timestamp = new Date().toISOString();

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['X-API-Key'] = apiKey;
    const res = await axios.post(backendUrl, payload, { headers });
    console.log('Posted:', payload, '-> status', res.status);
  } catch (err) {
    console.error('POST failed:', err.message || err);
  }
});

port.on('open', () => console.log('Serial port opened'));
port.on('error', (err) => console.error('Serial error:', err.message));

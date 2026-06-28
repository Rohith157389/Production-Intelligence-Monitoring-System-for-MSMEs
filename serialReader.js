const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

const portName = process.argv[2] || 'COM8';
const baudRate = parseInt(process.argv[3] || '115200', 10);

const port = new SerialPort({ path: portName, baudRate }, (err) => {
  if (err) return console.error('Error opening port:', err.message);
  console.log(`Reading from ${portName} at ${baudRate} baud...`);
});

const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));
parser.on('data', (line) => console.log(line.trim()));
port.on('error', (err) => console.error('Error:', err.message));

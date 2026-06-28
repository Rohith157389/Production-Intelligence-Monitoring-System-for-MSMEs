const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

const port = new SerialPort({
  path: 'COM8',
  baudRate: 115200
});

const parser = port.pipe(
  new ReadlineParser({ delimiter: '\r\n' })
);

parser.on('data', (line) => {
  console.log('Received:', line);

  try {
    const data = JSON.parse(line);
    console.log('Temperature:', data.temperature);
  } catch (err) {
    console.log('Invalid JSON');
  }
});
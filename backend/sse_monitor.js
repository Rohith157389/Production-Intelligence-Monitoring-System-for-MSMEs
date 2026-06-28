const url = process.argv[2] || 'http://localhost:5000/api/stream';
const RECONNECT_DELAY_MS = 3000;

async function start() {
  while (true) {
    try {
      console.log(`Connecting to SSE stream: ${url}`);
      const res = await fetch(url, { headers: { Accept: 'text/event-stream' } });
      if (!res.ok) {
        throw new Error(`Failed to connect to stream: ${res.status} ${res.statusText}`);
      }

      console.log('Connected to SSE stream. Waiting for readings...');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          throw new Error('SSE stream closed by server');
        }

        buffer += decoder.decode(value, { stream: true });

        let index;
        while ((index = buffer.indexOf('\n\n')) !== -1) {
          const chunk = buffer.slice(0, index);
          buffer = buffer.slice(index + 2);
          processEventBlock(chunk);
        }
      }
    } catch (err) {
      console.error('SSE error:', err.message || err);
      console.log(`Reconnecting in ${RECONNECT_DELAY_MS / 1000} seconds...`);
      await new Promise((resolve) => setTimeout(resolve, RECONNECT_DELAY_MS));
    }
  }
}

function processEventBlock(block) {
  const lines = block.split(/\r?\n/).filter(Boolean);
  let event = 'message';
  let data = '';

  for (const line of lines) {
    if (line.startsWith('event:')) {
      event = line.slice('event:'.length).trim();
    } else if (line.startsWith('data:')) {
      data += line.slice('data:'.length).trim();
    }
  }

  if (!data) return;

  try {
    const payload = JSON.parse(data);
    if (event === 'reading') {
      const reading = payload.reading || payload;
      const status = payload.machineStatus || 'unknown';
      const events = payload.detectedEvents || [];
      console.log('\n=== LIVE SOFTWARE READING ===');
      console.log(`Machine: ${reading.machine_id || reading.machineId || reading.machine_code || 'unknown'}`);
      console.log(`Timestamp: ${reading.recorded_at || reading.timestamp || 'unknown'}`);
      console.log(`Temperature: ${reading.temperature_celsius ?? reading.temperature ?? 0} °C`);
      console.log(`Current: ${reading.current_ampere ?? reading.current ?? 0} A`);
      console.log(`Voltage: ${reading.voltage_volt ?? reading.voltage ?? 0} V`);
      console.log(`Vibration: ${reading.vibration ?? 0}`);
      console.log(`Count: ${reading.object_count ?? reading.objectCount ?? 0}`);
      console.log(`Source: ${reading.source || payload.source || 'iot'}`);
      console.log(`Status: ${status}`);
      if (events.length) {
        console.log(`Detected Events: ${events.join(', ')}`);
      }
      console.log('Raw payload:', JSON.stringify(payload));
    }
  } catch (err) {
    console.error('Failed to parse SSE payload:', err.message);
  }
}

start();

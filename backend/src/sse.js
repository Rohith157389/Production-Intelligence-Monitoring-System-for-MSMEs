const clients = new Set();

function addClient(res) {
  // set headers for SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write('\n');

  clients.add(res);

  reqCloseHandler(res);
}

function reqCloseHandler(res) {
  res.on('close', () => {
    clients.delete(res);
  });
}

function sendReading(payload) {
  const data = JSON.stringify(payload);
  for (const res of Array.from(clients)) {
    try {
      res.write(`event: reading\n`);
      res.write(`data: ${data}\n\n`);
    } catch (err) {
      clients.delete(res);
    }
  }
}

module.exports = { addClient, sendReading };

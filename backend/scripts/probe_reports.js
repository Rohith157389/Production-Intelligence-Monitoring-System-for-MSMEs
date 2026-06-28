const http = require('http');
function probe(path) {
  return new Promise((resolve) => {
    http.get({ host: '127.0.0.1', port: 5000, path, headers: { 'Content-Type': 'application/json' } }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', (err) => resolve({ error: err.message }));
  });
}
(async () => {
  console.log('HEALTH', await probe('/api/health'));
  console.log('REPORT', await probe('/api/reports/daily?date=2026-06-03'));
})();

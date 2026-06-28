const http = require('http');
const querystring = require('querystring');
const port = Number(process.argv[2] || 5000);
function send(options, data) {
  return new Promise((resolve) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', (err) => resolve({ error: err.message }));
    if (data) req.write(data);
    req.end();
  });
}
(async () => {
  const loginData = JSON.stringify({ email: 'admin@pmrs.com', password: 'admin123' });
  const loginRes = await send({ host: '127.0.0.1', port, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(loginData) } }, loginData);
  console.log('LOGIN', loginRes);
  const token = loginRes.body ? JSON.parse(loginRes.body).token : null;
  const reportRes = await send({ host: '127.0.0.1', port, path: '/api/reports/daily?date=2026-06-03', method: 'GET', headers: { Authorization: `Bearer ${token}` } });
  console.log('REPORT-AUTH', reportRes);
})();

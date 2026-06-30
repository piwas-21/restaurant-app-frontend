const http = require('http');

const options = {
  // IPv4 loopback explicitly: the Next.js standalone server binds to IPv4
  // 0.0.0.0 (HOSTNAME=0.0.0.0), but 'localhost' resolves to IPv6 ::1 first on
  // Node 18+, so the probe gets ECONNREFUSED and the container is marked
  // unhealthy even though it serves fine. 127.0.0.1 hits the bound interface.
  hostname: '127.0.0.1',
  port: process.env.PORT || 3000,
  path: '/api/health',
  method: 'GET',
  timeout: 2000,
};

const healthCheck = http.request(options, (res) => {
  console.log(`Health check status: ${res.statusCode}`);
  if (res.statusCode === 200) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});

healthCheck.on('error', (err) => {
  console.error('Health check failed:', err.message);
  process.exit(1);
});

healthCheck.on('timeout', () => {
  console.error('Health check timed out');
  healthCheck.destroy();
  process.exit(1);
});

healthCheck.end();

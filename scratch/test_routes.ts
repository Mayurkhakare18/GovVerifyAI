import http from 'http';

const routes = [
  '/',
  '/app',
  '/app/verify',
  '/app/history',
  '/app/sources',
  '/app/profile',
  '/api/health',
];

async function checkRoute(path: string): Promise<{ path: string; status: number; ok: boolean }> {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:3000${path}`, (res) => {
      resolve({ path, status: res.statusCode || 0, ok: res.statusCode === 200 });
    });
    req.on('error', (err) => {
      console.error(`Error on ${path}:`, err.message);
      resolve({ path, status: 0, ok: false });
    });
  });
}

async function run() {
  console.log('Testing all frontend and API routes on http://localhost:3000...\n');
  for (const r of routes) {
    const res = await checkRoute(r);
    console.log(`Route [${res.path}] -> Status: ${res.status} ${res.ok ? '✅ OK' : '❌ FAILED'}`);
  }
}

run();

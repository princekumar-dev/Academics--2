import axios from 'axios';

const API = process.env.API_URL || process.env.VITE_API_URL || 'http://localhost:3001';
const TIMEOUT = 30000;

const endpoints = [
  { name: 'root', method: 'get', path: '/' },
  { name: 'service-worker', method: 'get', path: '/service-worker.js' },
  { name: 'whatsapp-status', method: 'get', path: '/api/whatsapp-dispatch?action=status' },
  { name: 'whatsapp-connection', method: 'get', path: '/api/whatsapp-dispatch?action=connection-status' },
  { name: 'vapid', method: 'get', path: '/api/notifications/vapid-public-key' },
];

async function check(ep) {
  const url = (ep.path.startsWith('http') ? ep.path : `${API}${ep.path}`);
  const start = Date.now();
  try {
    const res = await axios({ method: ep.method, url, timeout: TIMEOUT });
    const ms = Date.now() - start;
    return { ok: true, status: res.status, time: ms, data: res.data };
  } catch (err) {
    const ms = Date.now() - start;
    if (err.response) {
      return { ok: false, status: err.response.status, time: ms, data: err.response.data, message: err.message };
    }
    return { ok: false, status: null, time: ms, data: null, message: err.message };
  }
}

(async function main(){
  console.log('Smoke tests starting. API base:', API);
  const results = [];
  for (const ep of endpoints) {
    process.stdout.write(`Checking ${ep.name} -> ${ep.path} ... `);
    // eslint-disable-next-line no-await-in-loop
    const r = await check(ep);
    results.push({ ep: ep.name, path: ep.path, ...r });
    if (r.ok) {
      console.log(`OK ${r.status} (${r.time}ms)`);
    } else {
      console.log(`FAIL ${r.status ?? '-'} (${r.time}ms) -> ${r.message}`);
    }
  }

  console.log('\nSummary:');
  let failed = 0;
  for (const r of results) {
    console.log(`- ${r.ep}: ${r.ok ? 'OK' : 'FAIL'} time=${r.time} status=${r.status} ${r.ok ? '' : 'msg='+r.message}`);
    if (!r.ok) failed++;
  }

  if (failed) {
    console.error(`\nSmoke tests completed with ${failed} failure(s)`);
    process.exit(2);
  }
  console.log('\nSmoke tests passed.');
  process.exit(0);
})();

// Diagnostic only (not part of the repair test suite): find why two
// traffic cars barely move. Samples traffic + peds for ~50 wall-seconds
// and reports, for each slow car, the nearest ped / vehicle / driven car.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('/home/hatch/workspace/tools/pw/node_modules/playwright-core');

const ROOT = path.resolve(__dirname, '..');
const CHROME = '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const PORT = 8925;
const BASE = `http://127.0.0.1:${PORT}/`;

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      let fp = path.join(ROOT, 'game', url === '/' ? 'index.html' : url);
      if (!fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); res.end(); return; }
      const ext = path.extname(fp);
      const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' }[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime });
      fs.createReadStream(fp).pipe(res);
    });
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

async function main() {
  const server = await serve();
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 480, height: 270 } });
  page.on('pageerror', (e) => console.log('PAGEERROR:', String(e).slice(0, 120)));
  await page.goto(BASE + '?lowfx=1&shot=play', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__embers && window.__embers.frames > 5, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  // Dismiss the start screen so the game is in 'playing' state.
  await page.evaluate(() => { document.querySelector('#startBtn')?.click(); });
  await page.waitForTimeout(1000);

  const embers = (expr) => page.evaluate((e) => new Function('e', 'return e.' + e)(window.__embers), expr);

  const N = 25; // 25 samples x 2s = 50 wall-seconds
  const samples = [];
  for (let s = 0; s < N; s++) {
    const cars = await embers('vehicles.filter(v=>v.traffic).map(v=>({x:+v.x.toFixed(1),z:+v.z.toFixed(1),s:+v.speed.toFixed(2),h:+v.heading.toFixed(2)}))');
    const peds = await embers('npcs.pedestrians.map(p=>({x:+p.x.toFixed(1),z:+p.z.toFixed(1),st:p.state}))');
    const driven = await embers('vehicles.filter(v=>!v.traffic).map(v=>({n:v.name,x:+v.x.toFixed(1),z:+v.z.toFixed(1),s:+v.speed.toFixed(2)}))');
    samples.push({ cars, peds, driven });
    await page.waitForTimeout(2000);
  }
  // Per-car path length + final position.
  for (let i = 0; i < 7; i++) {
    let path = 0;
    for (let s = 1; s < N; s++) {
      path += Math.hypot(samples[s].cars[i].x - samples[s - 1].cars[i].x, samples[s].cars[i].z - samples[s - 1].cars[i].z);
    }
    const c = samples[N - 1].cars[i];
    console.log(`car[${i}] path=${path.toFixed(1)}m final=(${c.x},${c.z}) speed=${c.s} heading=${c.h}`);
  }
  // For the slowest two cars, nearest ped / vehicle / driven car at the end.
  const paths = samples.map((_, i) => 0);
  for (let i = 0; i < 7; i++) {
    let p = 0;
    for (let s = 1; s < N; s++) p += Math.hypot(samples[s].cars[i].x - samples[s - 1].cars[i].x, samples[s].cars[i].z - samples[s - 1].cars[i].z);
    paths[i] = p;
  }
  const slow = [...paths.entries()].sort((a, b) => a[1] - b[1]).slice(0, 2).map(([i]) => i);
  const last = samples[N - 1];
  for (const i of slow) {
    const c = last.cars[i];
    console.log(`\n-- slow car[${i}] at (${c.x},${c.z}) heading=${c.h} speed=${c.s}`);
    // nearest ped
    let best = null;
    for (const p of last.peds) {
      const d = Math.hypot(p.x - c.x, p.z - c.z);
      if (!best || d < best.d) best = { d, ...p };
    }
    console.log(`   nearest ped: ${best.d.toFixed(1)}m at (${best.x},${best.z}) state=${best.st}`);
    // nearest other traffic car
    best = null;
    for (let j = 0; j < 7; j++) {
      if (j === i) continue;
      const o = last.cars[j];
      const d = Math.hypot(o.x - c.x, o.z - c.z);
      if (!best || d < best.d) best = { d, j, ...o };
    }
    console.log(`   nearest traffic car[${best.j}]: ${best.d.toFixed(1)}m at (${best.x},${best.z}) speed=${best.s}`);
    // nearest driven car
    best = null;
    for (const d0 of last.driven) {
      const d = Math.hypot(d0.x - c.x, d0.z - c.z);
      if (!best || d < best.d) best = { d, ...d0 };
    }
    console.log(`   nearest driven (${best.n}): ${best.d.toFixed(1)}m at (${best.x},${best.z}) speed=${best.s}`);
    // player position
    const pp = await embers('playerPos');
    console.log(`   player at (${pp.x.toFixed(1)},${pp.z.toFixed(1)}) dist=${Math.hypot(pp.x - c.x, pp.z - c.z).toFixed(1)}m`);
  }
  await browser.close();
  server.close();
}
main().catch((e) => { console.error('DIAG CRASH:', e.message); process.exit(1); });

// Diagnostic 2: observe the stuck traffic car directly — teleport the
// player near it, screenshot it, and evaluate the exact `blocked`
// condition the game uses (vehicle within 10 m ahead, dot > 0.86;
// ped within 8 m ahead, dot > 0.8).
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('/home/hatch/workspace/tools/pw/node_modules/playwright-core');

const ROOT = path.resolve(__dirname, '..');
const CHROME = '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const PORT = 8926;
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
  await page.evaluate(() => { document.querySelector('#startBtn')?.click(); });
  await page.waitForTimeout(1000);

  const embers = (expr) => page.evaluate((e) => new Function('e', 'return e.' + e)(window.__embers), expr);

  // Let traffic run for ~35 wall-seconds, sampling car paths.
  const N = 12;
  const samples = [];
  for (let s = 0; s < N; s++) {
    const cars = await embers('vehicles.filter(v=>v.traffic).map(v=>({x:+v.x.toFixed(1),z:+v.z.toFixed(1),s:+v.speed.toFixed(2),h:+v.heading.toFixed(2)}))');
    samples.push(cars);
    await page.waitForTimeout(3000);
  }
  const paths = new Array(7).fill(0);
  for (let i = 0; i < 7; i++) {
    for (let s = 1; s < N; s++) paths[i] += Math.hypot(samples[s][i].x - samples[s - 1][i].x, samples[s][i].z - samples[s - 1][i].z);
  }
  console.log('paths over ~35s:', paths.map((p) => p.toFixed(1)).join(', '));
  const slowIdx = [...paths.entries()].sort((a, b) => a[1] - b[1])[0][0];
  const c = samples[N - 1][slowIdx];
  console.log(`slowest = car[${slowIdx}] at (${c.x},${c.z}) speed=${c.s} heading=${c.h}`);

  // Evaluate the blocked condition for this car right now, using the
  // __embers projections (vehicles list + pedestrians list). Compute in
  // Node: the embers helper only accepts a property expression after `e.`.
  const allVeh = await embers('vehicles');
  const allPeds = await embers('npcs.pedestrians');
  const me = allVeh.filter((v) => v.traffic)[slowIdx];
  const fx = Math.sin(me.heading), fz = Math.cos(me.heading);
  console.log('me:', JSON.stringify({ x: +me.x.toFixed(1), z: +me.z.toFixed(1), speed: +me.speed.toFixed(2), heading: +me.heading.toFixed(2) }));
  console.log('nearby (within 12 m vehicles / 10 m peds):');
  for (const o of allVeh) {
    if (o === me) continue;
    const dx = o.x - me.x, dz = o.z - me.z;
    const d = Math.hypot(dx, dz);
    if (d < 12) {
      const dot = (dx * fx + dz * fz) / (d || 1);
      console.log(`  veh ${o.name}: (${o.x.toFixed(1)},${o.z.toFixed(1)}) d=${d.toFixed(1)} dot=${dot.toFixed(2)} speed=${o.speed.toFixed(2)} traffic=${!!o.traffic} police=${!!o.police} drivable=${!!o.drivable}`);
    }
  }
  for (const p of allPeds) {
    const dx = p.x - me.x, dz = p.z - me.z;
    const d = Math.hypot(dx, dz);
    if (d < 10) {
      const dot = (dx * fx + dz * fz) / (d || 1);
      console.log(`  ped: (${p.x.toFixed(1)},${p.z.toFixed(1)}) d=${d.toFixed(1)} dot=${dot.toFixed(2)} state=${p.state}`);
    }
  }

  // Teleport the player 12 m in front-side of the car and look at it.
  const px = c.x + 9, pz = c.z + 9;
  await embers(`setPlayerPos(${px}, ${pz})`);
  const yaw = Math.atan2(-(c.x - px), -(c.z - pz));
  await embers(`setCamYaw(${yaw})`);
  await embers(`setFacing(${Math.atan2(c.x - px, c.z - pz)})`);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(__dirname, 'diag-stuck-car.jpg') });
  console.log('screenshot saved diag-stuck-car.jpg, player at', px.toFixed(1), pz.toFixed(1), 'looking at car');
  await browser.close();
  server.close();
}
main().catch((e) => { console.error('DIAG CRASH:', e.message); process.exit(1); });

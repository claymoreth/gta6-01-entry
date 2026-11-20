// Diagnostic 5: who blocks the stuck dermaga police car? After ~25 s,
// dump every vehicle/ped within 12 m of it with the dot product the
// game's `blocked` check uses (dot > 0.86 vehicle, > 0.8 ped).
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('/home/hatch/workspace/tools/pw/node_modules/playwright-core');

const ROOT = path.resolve(__dirname, '..');
const CHROME = '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const PORT = 8929;
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
  await page.waitForTimeout(25000); // let the police car get stuck
  const embers = (expr) => page.evaluate((e) => new Function('e', 'return e.' + e)(window.__embers), expr);

  for (let round = 0; round < 3; round++) {
    const veh = await embers('vehicles');
    const pol = await embers('npcs.police');
    const peds = await embers('npcs.pedestrians');
    const cars = pol.filter((u) => u.kind === 'car');
    const pc = cars.reduce((a, b) => (Math.abs(a.x - 118) < Math.abs(b.x - 118) ? a : b));
    const fx = Math.sin(pc.heading), fz = Math.cos(pc.heading);
    console.log(`\n--- round ${round}: police car at (${pc.x.toFixed(1)},${pc.z.toFixed(1)}) heading=${pc.heading.toFixed(2)} speed=${pc.speed.toFixed(2)} state=${pc.state} forward=(${fx.toFixed(2)},${fz.toFixed(2)})`);
    for (const o of veh) {
      const dx = o.x - pc.x, dz = o.z - pc.z;
      const d = Math.hypot(dx, dz);
      if (d < 12 && d > 0.01) {
        const dot = (dx * fx + dz * fz) / d;
        console.log(`  veh ${o.name}: (${o.x.toFixed(1)},${o.z.toFixed(1)}) d=${d.toFixed(1)} dot=${dot.toFixed(2)} speed=${o.speed.toFixed(2)} traffic=${!!o.traffic} police=${!!o.police}${dot > 0.86 ? '  <-- BLOCKS' : ''}`);
      }
    }
    for (const p of peds) {
      const dx = p.x - pc.x, dz = p.z - pc.z;
      const d = Math.hypot(dx, dz);
      if (d < 10 && d > 0.01) {
        const dot = (dx * fx + dz * fz) / d;
        console.log(`  ped: (${p.x.toFixed(1)},${p.z.toFixed(1)}) d=${d.toFixed(1)} dot=${dot.toFixed(2)} state=${p.state}${dot > 0.8 ? '  <-- BLOCKS' : ''}`);
      }
    }
    await page.waitForTimeout(5000);
  }
  await browser.close();
  server.close();
}
main().catch((e) => { console.error('DIAG CRASH:', e.message); process.exit(1); });

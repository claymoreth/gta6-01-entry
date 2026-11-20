// Diagnostic 4: watch the dermaga police car from spawn (t=0). Report
// its position / speed / heading / damage / state every 2 wall-seconds
// for the first ~40 s, plus the nearest vehicle within 6 m.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('/home/hatch/workspace/tools/pw/node_modules/playwright-core');

const ROOT = path.resolve(__dirname, '..');
const CHROME = '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const PORT = 8928;
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
  await page.waitForTimeout(500);
  const embers = (expr) => page.evaluate((e) => new Function('e', 'return e.' + e)(window.__embers), expr);

  console.log('t | police-dermaga (x,z) speed heading damage state | nearest vehicle <6m');
  for (let s = 0; s <= 20; s++) {
    const veh = await embers('vehicles');
    const pol = await embers('npcs.police');
    // the dermaga police car is the one with kind 'car' whose route is dermaga;
    // identify by proximity to spawn (118,40) at s=0, then track by index.
    const cars = pol.filter((u) => u.kind === 'car');
    // pick the car nearer to x=118 (dermaga) vs the ew one near x=10
    const pc = cars.reduce((a, b) => (Math.abs(a.x - 118) < Math.abs(b.x - 118) ? a : b));
    let near = null;
    for (const o of veh) {
      const d = Math.hypot(o.x - pc.x, o.z - pc.z);
      if (d < 6 && d > 0.01 && (!near || d < near.d)) near = { d, n: o.name, x: +o.x.toFixed(1), z: +o.z.toFixed(1), s: +o.speed.toFixed(2) };
    }
    console.log(
      `${String(s * 2).padStart(3)} | (${pc.x.toFixed(1)},${pc.z.toFixed(1)}) sp=${pc.speed.toFixed(2)} hd=${pc.heading.toFixed(2)} dmg=${pc.damage.toFixed(2)} st=${pc.state} | ` +
      (near ? `${near.n} d=${near.d.toFixed(1)} @(${near.x},${near.z}) sp=${near.s}` : 'none <6m')
    );
    await page.waitForTimeout(2000);
  }
  await browser.close();
  server.close();
}
main().catch((e) => { console.error('DIAG CRASH:', e.message); process.exit(1); });

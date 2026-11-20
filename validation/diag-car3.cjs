// Diagnostic 3: track traffic car[3] (dermaga, the slow one) + both police
// cars over ~90 wall-seconds. Is car[3] permanently blocked, or does it
// resume when the vehicle ahead moves on? Reports police state too.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('/home/hatch/workspace/tools/pw/node_modules/playwright-core');

const ROOT = path.resolve(__dirname, '..');
const CHROME = '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const PORT = 8927;
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

  console.log('t(s) | car3 (x,z) speed | nearest police car: dist/state/speed | nearest ped ahead');
  for (let s = 0; s <= 30; s++) {
    const veh = await embers('vehicles');
    const peds = await embers('npcs.pedestrians');
    const pol = await embers('npcs.police');
    const c3 = veh.filter((v) => v.traffic)[3];
    const fx = Math.sin(c3.heading), fz = Math.cos(c3.heading);
    // nearest police car (by distance) + its state
    let np = null;
    for (const p of pol.filter((u) => u.kind === 'car')) {
      const d = Math.hypot(p.x - c3.x, p.z - c3.z);
      if (!np || d < np.d) np = { d, ...p };
    }
    // nearest ped ahead of car3 (dot > 0.8, within 8 m)
    let nped = null;
    for (const p of peds) {
      const dx = p.x - c3.x, dz = p.z - c3.z;
      const d = Math.hypot(dx, dz);
      if (d < 8) {
        const dot = (dx * fx + dz * fz) / (d || 1);
        if (dot > 0.8 && (!nped || d < nped.d)) nped = { d, dot, ...p };
      }
    }
    console.log(
      `${String(s * 3).padStart(3)} | (${c3.x.toFixed(1)},${c3.z.toFixed(1)}) ${c3.speed.toFixed(2)} | ` +
      `pol d=${np.d.toFixed(1)} st=${np.state} sp=${np.speed.toFixed(2)} @(${np.x.toFixed(0)},${np.z.toFixed(0)}) | ` +
      (nped ? `ped d=${nped.d.toFixed(1)} dot=${nped.dot.toFixed(2)} st=${nped.state}` : 'no ped ahead')
    );
    await page.waitForTimeout(3000);
  }
  await browser.close();
  server.close();
}
main().catch((e) => { console.error('DIAG CRASH:', e.message); process.exit(1); });

// Diagnostic 6: does pressing E next to a held traffic car still enter it
// after the repair? Also: does a punch (F) make a placed ped flee/down?
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('/home/hatch/workspace/tools/pw/node_modules/playwright-core');

const ROOT = path.resolve(__dirname, '..');
const CHROME = '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const PORT = 8930;
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
  page.on('pageerror', (e) => console.log('PAGEERROR:', String(e).slice(0, 140)));
  await page.goto(BASE + '?lowfx=1&shot=play', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__embers && window.__embers.frames > 5, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { document.querySelector('#startBtn')?.click(); });
  await page.waitForTimeout(1000);
  const embers = (expr) => page.evaluate((e) => new Function('e', 'return e.' + e)(window.__embers), expr);
  const waitGame = async (secs) => {
    const t0 = await embers('frames');
    await page.waitForFunction((f0) => window.__embers.frames > f0 + 60, t0, { timeout: 60000 }).catch(() => {});
  };

  // --- Test 1: enter a held traffic car with E ---
  await embers('debugResetNpcs()');
  await embers('debugHoldTraffic(0, 120)');
  const cars = await embers('vehicles');
  const tc = cars.find((v) => v.traffic);
  console.log('traffic car 0 at', tc.x.toFixed(1), tc.z.toFixed(1), 'type', tc.type);
  await embers(`teleport(${tc.x + 2}, ${tc.z})`);
  await page.waitForTimeout(1500);
  const cars2 = await embers('vehicles');
  const tc2 = cars2.find((v) => v.traffic);
  console.log('traffic car 0 now at', tc2.x.toFixed(1), tc2.z.toFixed(1), '(moved', Math.hypot(tc2.x - tc.x, tc2.z - tc.z).toFixed(1), 'm while held)');
  const pp = await embers('playerPos');
  console.log('player at', pp.x.toFixed(1), pp.z.toFixed(1), 'dist to car', Math.hypot(pp.x - tc2.x, pp.z - tc2.z).toFixed(1));
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(1500);
  console.log('after E: driving =', await embers('driving'), ', drivenCar =', JSON.stringify(await embers('drivenCar')));
  await embers('exitCar()');

  // --- Test 2: punch a placed ped ---
  await embers('debugResetNpcs()');
  const p0 = await embers('playerPos');
  await embers(`debugPlacePed(0, ${p0.x + 1.5}, ${p0.z})`);
  // face the ped (east)
  await embers('setFacing(1.5708)');
  await embers('setCamYaw(1.5708)');
  await page.waitForTimeout(800);
  let ped = (await embers('npcs.pedestrians'))[0];
  console.log('ped placed at', ped.x.toFixed(1), ped.z.toFixed(1), 'state', ped.state);
  for (let i = 1; i <= 3; i++) {
    await page.keyboard.press('KeyF');
    await page.waitForTimeout(900);
    ped = (await embers('npcs.pedestrians'))[0];
    console.log(`after punch ${i}: ped state=${ped.state} at (${ped.x.toFixed(1)},${ped.z.toFixed(1)})`);
  }
  await browser.close();
  server.close();
}
main().catch((e) => { console.error('DIAG CRASH:', e.message); process.exit(1); });

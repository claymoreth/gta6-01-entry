// Smoke-visual probe (temporary; deleted after use): place the sedan with
// 65% damage, drive it, screenshot the hood smoke puffs.
const { spawn } = require('node:child_process');
const { chromium } = require('/home/hatch/workspace/tools/pw/node_modules/playwright-core');
const path = require('node:path');
const PORT = 8916;
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

(async () => {
  const server = spawn('node', ['serve.ts', '--port', String(PORT)], {
    cwd: '/home/hatch/workspace/makefun/gta6-01-entry', stdio: ['ignore', 'pipe', 'pipe'],
  });
  await sleep(1200);
  const browser = await chromium.launch({
    executablePath: '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome',
    args: ['--no-sandbox', '--disable-gpu-sandbox', '--use-gl=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 120)); });
  await page.goto(`http://127.0.0.1:${PORT}/?shot=play&lowfx=1`, { waitUntil: 'load', timeout: 30000 });
  await sleep(3000);
  await page.evaluate(() => window.__embers.placeCar('sedan', 20, 2.5, Math.PI, 0.65));
  await page.evaluate(() => window.__embers.enterCar('sedan'));
  await sleep(800);
  await page.keyboard.down('KeyW');
  await sleep(9000);
  const st = await page.evaluate(() => ({
    damage: window.__embers.drivenCar.damage,
    speedKmh: window.__embers.speedKmh,
    frames: window.__embers.frames,
  }));
  console.log('state:', JSON.stringify(st));
  await page.screenshot({ path: path.join('/home/hatch/workspace/makefun/gta6-01-entry/validation', 'smoke-probe.jpg'), type: 'jpeg', quality: 82 });
  await page.keyboard.up('KeyW');
  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
  server.kill();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });

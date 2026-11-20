// Diagnostic: track traffic car[2] (and all traffic cars) for 60 wall-s:
// position, speed, heading, distance to its loop, and what is near it.
const { chromium } = require('/home/hatch/workspace/tools/pw/node_modules/playwright-core');
const { spawn } = require('child_process');
const REPO = '/home/hatch/workspace/makefun/gta6-01-entry';
const PORT = 8938;
const CHROME = '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function embers(page, expr) {
  return page.evaluate((e) => new Function('e', 'return e.' + e)(window.__embers), expr);
}
(async () => {
  const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'] });
  await sleep(1500);
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => console.log('PAGE-ERR:', String(e).slice(0, 160)));
  await page.goto(`http://127.0.0.1:${PORT}/?lowfx=1&shot=play`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__embers && window.__embers.frames > 5, null, { timeout: 30000 });
  // Sample traffic cars (type traffic) every 5 wall-seconds.
  const start = {};
  for (let t = 0; t <= 60; t += 5) {
    if (t > 0) await sleep(5000);
    const cars = (await embers(page, 'vehicles')).filter((c) => c.traffic);
    // index traffic cars by their order in the vehicles array (traffic idx)
    const line = cars.map((c, i) => {
      if (!start[i]) start[i] = { x: c.x, z: c.z };
      const moved = Math.hypot(c.x - start[i].x, c.z - start[i].z);
      return `[${i}](${c.x.toFixed(0)},${c.z.toFixed(0)}) spd=${c.speed.toFixed(1)} h=${c.heading.toFixed(2)} moved=${moved.toFixed(1)}`;
    }).join(' ');
    console.log(`t=${t} ${line}`);
  }
  await browser.close();
  server.kill();
  process.exit(0);
})().catch((e) => { console.error('DIAG ERR', e); process.exit(1); });

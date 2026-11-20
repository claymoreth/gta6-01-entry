// Diagnostic: WHEN does the player get pushed off (0,0), and by what?
// Teleports to (0,0), then samples player pos + nearest traffic car every
// 2 wall-seconds for 60 wall-seconds.
const { chromium } = require('/home/hatch/workspace/tools/pw/node_modules/playwright-core');
const { spawn } = require('child_process');
const REPO = '/home/hatch/workspace/makefun/gta6-01-entry';
const PORT = 8935;
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
  await embers(page, 'teleport(0, 0)');
  await sleep(500);
  let last = await embers(page, 'playerPos');
  console.log(`t=0 player (${last.x.toFixed(2)}, ${last.z.toFixed(2)})`);
  for (let t = 2; t <= 60; t += 2) {
    await sleep(2000);
    const p = await embers(page, 'playerPos');
    const moved = Math.hypot(p.x - last.x, p.z - last.z);
    // nearest traffic car
    const cars = await embers(page, 'vehicles');
    let nearest = null, nd = 1e9;
    for (const c of cars) {
      const d = Math.hypot(c.x - p.x, c.z - p.z);
      if (d < nd) { nd = d; nearest = c; }
    }
    const tag = moved > 0.05 ? '  <<<< MOVED' : '';
    console.log(`t=${t} player (${p.x.toFixed(2)}, ${p.z.toFixed(2)}) moved=${moved.toFixed(2)} nearestCar type=${nearest ? nearest.type : '-'} traffic=${nearest ? nearest.traffic : '-'} dist=${nd.toFixed(1)} at (${nearest ? nearest.x.toFixed(1) : '-'},${nearest ? nearest.z.toFixed(1) : '-'}) h=${nearest ? nearest.heading.toFixed(2) : '-'} spd=${nearest ? nearest.speed.toFixed(1) : '-'}${tag}`);
    last = p;
  }
  await browser.close();
  server.kill();
  process.exit(0);
})().catch((e) => { console.error('DIAG ERR', e); process.exit(1); });

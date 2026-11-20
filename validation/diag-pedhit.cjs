// Diagnostic: reproduce Phase 4 ped-hit test (section 8) exactly and log
// car/ped positions to find why no ped goes down.
const { chromium } = require('/home/hatch/workspace/tools/pw/node_modules/playwright-core');
const { spawn } = require('child_process');
const REPO = '/home/hatch/workspace/makefun/gta6-01-entry';
const PORT = 8937;
const CHROME = '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function embers(page, expr) {
  return page.evaluate((e) => new Function('e', 'return e.' + e)(window.__embers), expr);
}
async function waitGame(page, secs, maxMs = 60000) {
  const t0 = await embers(page, 'time');
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const t = await embers(page, 'time');
    if (t - t0 >= secs) return true;
    await sleep(300);
  }
  return false;
}
(async () => {
  const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'] });
  await sleep(1500);
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => console.log('PAGE-ERR:', String(e).slice(0, 160)));
  await page.goto(`http://127.0.0.1:${PORT}/?lowfx=1&shot=play`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__embers && window.__embers.frames > 5, null, { timeout: 30000 });
  await embers(page, 'debugResetNpcs()');
  await embers(page, 'debugPlacePed(0, 30, 2.5)');
  await embers(page, 'debugPlacePolice(0, 24, -4)');
  await embers(page, `placeCar('sedan', 10, 2.5, ${Math.PI / 2}, 0)`);
  const entered = await embers(page, `enterCar('sedan')`);
  console.log(`enterCar returned: ${entered}, driving=${await embers(page, 'driving')}`);
  await waitGame(page, 1, 30000);
  let driven = await embers(page, 'drivenCar');
  console.log(`drivenCar: ${JSON.stringify(driven)}`);
  await page.keyboard.down('KeyW');
  for (let i = 0; i < 30; i++) {
    await sleep(2000);
    driven = await embers(page, 'drivenCar');
    const peds = await embers(page, 'npcs.pedestrians');
    const ped0 = peds[0];
    const down = peds.find((p) => p.state === 'down');
    const cars = await embers(page, 'vehicles');
    const police = cars.find((c) => c.police);
    console.log(`t=${(i + 1) * 2}s car=(${driven ? driven.x.toFixed(1) : '-'},${driven ? driven.z.toFixed(1) : '-'}) h=${driven ? driven.heading.toFixed(2) : '-'} spd=${driven ? driven.speed.toFixed(1) : '-'} | ped0=(${ped0.x.toFixed(1)},${ped0.z.toFixed(1)}) state=${ped0.state} | policeCar=(${police ? police.x.toFixed(1) : '-'},${police ? police.z.toFixed(1) : '-'}) | anyDown=${down ? down.index : 'none'}`);
    if (down) break;
  }
  await page.keyboard.up('KeyW');
  const crimes = await embers(page, 'npcs.crimes');
  console.log(`crimes: ${JSON.stringify(crimes.map((c) => c.type))}`);
  await browser.close();
  server.kill();
  process.exit(0);
})().catch((e) => { console.error('DIAG ERR', e); process.exit(1); });

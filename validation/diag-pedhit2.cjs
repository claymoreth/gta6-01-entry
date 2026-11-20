// Diagnostic: reproduce Phase 4 sections 7+8 in sequence, logging the
// section-8 geometry (sedan, ped0, nearest traffic, police car) to find
// why the ped-hit check fails 3/3 in the full suite but passes isolated.
const { chromium } = require('/home/hatch/workspace/tools/pw/node_modules/playwright-core');
const { spawn } = require('child_process');
const REPO = '/home/hatch/workspace/makefun/gta6-01-entry';
const PORT = 8938;
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
  const page = await browser.newPage({ viewport: { width: 480, height: 270 } });
  page.on('pageerror', (e) => console.log('PAGE-ERR:', String(e).slice(0, 160)));
  await page.goto(`http://127.0.0.1:${PORT}/?lowfx=1&shot=play`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__embers && window.__embers.frames > 5, null, { timeout: 30000 });
  // Let traffic circulate / police patrol for a while, like the real suite.
  await sleep(60000);
  const pre = await embers(page, 'vehicles');
  console.log('traffic at section-7 start:', JSON.stringify(pre.filter((v) => v.traffic).map((v) => [v.index, +v.x.toFixed(1), +v.z.toFixed(1)])));
  // ---- Section 7 verbatim ----
  await embers(page, 'debugResetNpcs()');
  await embers(page, 'debugHoldTraffic(0, 120)');
  const cars = await embers(page, 'vehicles');
  const tc = cars.find((v) => v.traffic);
  console.log('theft target traffic car:', JSON.stringify(tc));
  await embers(page, `debugPlacePolice(0, ${tc.x + 6}, ${tc.z})`);
  await embers(page, `teleport(${tc.x + 2}, ${tc.z})`);
  await waitGame(page, 1, 30000);
  await page.keyboard.press('KeyE');
  await waitGame(page, 1, 30000);
  console.log('after E: driving=', await embers(page, 'driving'), 'wanted=', JSON.stringify(await embers(page, 'npcs.wanted')));
  await embers(page, 'exitCar()');
  // ---- Section 8 verbatim, with logging ----
  await embers(page, 'debugResetNpcs()');
  await embers(page, `debugPlacePed(0, 30, 2.5)`);
  await embers(page, `debugPlacePolice(0, 24, -4)`);
  await embers(page, `placeCar('sedan', 10, 2.5, ${Math.PI / 2}, 0)`);
  await embers(page, `enterCar('sedan')`);
  await waitGame(page, 1, 30000);
  await page.keyboard.down('KeyW');
  for (let i = 0; i < 45; i++) {
    await sleep(2000);
    const driven = await embers(page, 'drivenCar');
    const peds = await embers(page, 'npcs.pedestrians');
    const ped0 = peds[0];
    const down = peds.find((p) => p.state === 'down');
    const vs = await embers(page, 'vehicles');
    const traffic = vs.filter((v) => v.traffic).map((v) => `#${v.index}(${v.x.toFixed(0)},${v.z.toFixed(0)})`).join(' ');
    console.log(`t=${(i + 1) * 2}s car=(${driven ? driven.x.toFixed(1) : '-'},${driven ? driven.z.toFixed(1) : '-'}) spd=${driven ? driven.speed.toFixed(1) : '-'} | ped0=(${ped0.x.toFixed(1)},${ped0.z.toFixed(1)}) ${ped0.state} | traffic: ${traffic} | down=${down ? down.index : 'none'}`);
    if (down) break;
  }
  await page.keyboard.up('KeyW');
  const crimes = await embers(page, 'npcs.crimes');
  console.log(`crimes: ${JSON.stringify(crimes.map((c) => c.type))}`);
  await browser.close();
  server.kill();
  process.exit(0);
})().catch((e) => { console.error('DIAG ERR', e); process.exit(1); });

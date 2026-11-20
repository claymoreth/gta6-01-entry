// Probe: game-time ratio + ped effective flee speed (480x270, lowfx).
const { chromium } = require('/home/hatch/workspace/tools/pw/node_modules/playwright-core');
const { spawn } = require('child_process');
const REPO = '/home/hatch/workspace/makefun/gta6-01-entry';
const PORT = 8939;
const CHROME = '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function embers(page, expr) {
  return page.evaluate((e) => new Function('e', 'return e.' + e)(window.__embers), expr);
}
(async () => {
  const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'] });
  await sleep(1500);
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 480, height: 270 } });
  await page.goto(`http://127.0.0.1:${PORT}/?lowfx=1&shot=play`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__embers && window.__embers.frames > 5, null, { timeout: 30000 });
  await embers(page, 'debugResetNpcs()');
  await embers(page, `debugPlacePed(0, 30, 2.5)`);
  await embers(page, `debugPlacePolice(0, 24, -4)`);
  await embers(page, `placeCar('sedan', 10, 2.5, ${Math.PI / 2}, 0)`);
  await embers(page, `enterCar('sedan')`);
  await sleep(1000);
  await page.keyboard.down('KeyW');
  for (let i = 0; i < 16; i++) {
    await sleep(1000);
    const driven = await embers(page, 'drivenCar');
    const peds = await embers(page, 'npcs.pedestrians');
    const ped0 = peds[0];
    const frames = await embers(page, 'frames');
    console.log(`wall=${i + 1}s frames=${frames} car=(${driven.x.toFixed(1)},${driven.z.toFixed(2)}) spd=${driven.speed.toFixed(1)} | ped0=(${ped0.x.toFixed(1)},${ped0.z.toFixed(2)}) ${ped0.state}`);
    if (peds.find((p) => p.state === 'down')) break;
  }
  await page.keyboard.up('KeyW');
  await browser.close();
  server.kill();
  process.exit(0);
})().catch((e) => { console.error('PROBE ERR', e); process.exit(1); });

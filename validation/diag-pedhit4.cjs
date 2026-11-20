// Probe: player spawn position on a fresh page + sedan position right
// after placeCar (before/after enterCar), to explain the z=2.57 nudge.
const { chromium } = require('/home/hatch/workspace/tools/pw/node_modules/playwright-core');
const { spawn } = require('child_process');
const REPO = '/home/hatch/workspace/makefun/gta6-01-entry';
const PORT = 8940;
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
  console.log('fresh spawn playerPos:', JSON.stringify(await embers(page, 'playerPos')));
  const before = await embers(page, 'vehicles');
  const sedan0 = before.find((v) => v.type === 'sedan' && !v.traffic);
  console.log('sedan before placeCar:', JSON.stringify(sedan0));
  await embers(page, `placeCar('sedan', 10, 2.5, ${Math.PI / 2}, 0)`);
  const atPlace = await embers(page, 'vehicles');
  console.log('sedan right after placeCar:', JSON.stringify(atPlace.find((v) => v.type === 'sedan' && !v.traffic)));
  console.log('playerPos after placeCar:', JSON.stringify(await embers(page, 'playerPos')));
  await embers(page, `enterCar('sedan')`);
  await sleep(1000);
  const afterEnter = await embers(page, 'vehicles');
  console.log('sedan 1s after enterCar:', JSON.stringify(afterEnter.find((v) => v.type === 'sedan' && !v.traffic)));
  console.log('playerPos after enterCar:', JSON.stringify(await embers(page, 'playerPos')));
  console.log('drivenCar:', JSON.stringify(await embers(page, 'drivenCar')));
  await browser.close();
  server.kill();
  process.exit(0);
})().catch((e) => { console.error('PROBE ERR', e); process.exit(1); });

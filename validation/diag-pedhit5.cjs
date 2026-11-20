// Probe: what is near (10,2.5) at fresh load? Log all vehicles right
// after placeCar, and the sedan pos over the next 2s (no driving).
const { chromium } = require('/home/hatch/workspace/tools/pw/node_modules/playwright-core');
const { spawn } = require('child_process');
const REPO = '/home/hatch/workspace/makefun/gta6-01-entry';
const PORT = 8941;
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
  const vs0 = await embers(page, 'vehicles');
  console.log('vehicles at load:', JSON.stringify(vs0.map((v) => [v.type, +v.x.toFixed(1), +v.z.toFixed(1), v.traffic ? 'T' : (v.police ? 'P' : '')])));
  await embers(page, `placeCar('sedan', 10, 2.5, ${Math.PI / 2}, 0)`);
  for (let i = 0; i < 5; i++) {
    const vs = await embers(page, 'vehicles');
    const s = vs.find((v) => v.type === 'sedan' && !v.traffic);
    console.log(`t=${i} sedan=(${s.x.toFixed(3)},${s.z.toFixed(3)}) spd=${s.speed}`);
    await sleep(400);
  }
  await browser.close();
  server.kill();
  process.exit(0);
})().catch((e) => { console.error('PROBE ERR', e); process.exit(1); });

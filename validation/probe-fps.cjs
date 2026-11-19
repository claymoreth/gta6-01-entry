// Quick probe: wall-clock frame rate of the game in headless SwiftShader
// at several viewports, plus movement speed sanity. Not part of the entry.
const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('/home/hatch/workspace/tools/pw/node_modules/playwright-core');

const REPO = path.resolve(__dirname, '..');
const PORT = 8912;
const CHROME = '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitForServer(url, tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(url, (res) => { res.resume(); resolve(); });
        req.on('error', reject);
        req.setTimeout(1000, () => req.destroy(new Error('t')));
      });
      return true;
    } catch { await sleep(250); }
  }
  return false;
}

(async () => {
  const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: REPO, stdio: 'ignore' });
  await waitForServer(`http://127.0.0.1:${PORT}/`);
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [w, h] of [[1280, 720], [960, 540], [640, 360]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded' });
    await sleep(2500);
    await page.click('#start-btn');
    await sleep(500);
    const f0 = await page.evaluate(() => window.__embers.frames);
    const p0 = await page.evaluate(() => ({ ...window.__embers.playerPos }));
    await page.keyboard.down('KeyW');
    await sleep(5000);
    await page.keyboard.up('KeyW');
    const f1 = await page.evaluate(() => window.__embers.frames);
    const p1 = await page.evaluate(() => ({ ...window.__embers.playerPos }));
    const wallFps = (f1 - f0) / 5;
    const moved = Math.hypot(p1.x - p0.x, p1.z - p0.z);
    console.log(`${w}x${h}: wall FPS=${wallFps.toFixed(1)}  moved ${moved.toFixed(2)}m in 5s wall (game-time ~${((f1 - f0) * 0.05).toFixed(1)}s)`);
    await page.close();
  }
  await browser.close();
  server.kill();
})().catch((e) => { console.error('PROBE CRASH:', e); process.exit(1); });

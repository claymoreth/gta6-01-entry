// FPS probe: measure settled wall-clock FPS at 640x360 lowfx and
// 1280x720 full quality, to compare against the Phase 3 baseline
// (7.8 FPS lowfx / 1.2 FPS full). SwiftShader only — not a real GPU.
const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('/home/hatch/workspace/tools/pw/node_modules/playwright-core');

const REPO = path.resolve(__dirname, '..');
const PORT = 8918;
const BASE = `http://127.0.0.1:${PORT}/`;
const CHROME = '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
async function waitForServer(url, tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(url, (res) => { res.resume(); resolve(res.statusCode); });
        req.on('error', reject);
        req.setTimeout(1000, () => req.destroy(new Error('timeout')));
      });
      return true;
    } catch { await sleep(250); }
  }
  return false;
}

(async () => {
  const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'] });
  const up = await waitForServer(BASE);
  console.log('server up:', up);
  if (!up) { server.kill(); process.exit(1); }
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--no-sandbox', '--disable-gpu-sandbox', '--use-gl=swiftshader'],
  });

  async function probe(label, url, seconds) {
    const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
    if (label.includes('1280')) await page.setViewportSize({ width: 1280, height: 720 });
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 120)); });
    page.on('pageerror', (e) => errors.push('PAGEERROR: ' + String(e).slice(0, 120)));
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    // Warm up (shader compile + scene settle), then measure frames over
    // a wall-clock window — the honest way (game dt is clamped, so the
    // in-game FPS meter is a 0.5 s average, not a long-run rate).
    await sleep(8000);
    const f0 = await page.evaluate(() => window.__embers.frames);
    const t0 = Date.now();
    await sleep(seconds * 1000);
    const f1 = await page.evaluate(() => window.__embers.frames);
    const t1 = Date.now();
    const fps = (f1 - f0) / ((t1 - t0) / 1000);
    const stats = await page.evaluate(() => ({
      fpsMeter: window.__embers.fps,
      drawCalls: window.__embers.drawCalls,
      triangles: window.__embers.triangles,
    }));
    console.log(`${label}: wall FPS ${fps.toFixed(2)} (meter ${stats.fpsMeter.toFixed(2)}), drawCalls ${stats.drawCalls}, triangles ${stats.triangles}, errors ${errors.length}`);
    await page.close();
  }

  await probe('640x360 lowfx', BASE + '?lowfx=1&shot=play', 15);
  await probe('1280x720 full ', BASE + '?shot=play', 15);
  await browser.close();
  server.kill();
  process.exit(0);
})();

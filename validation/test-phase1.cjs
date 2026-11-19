// CITY OF EMBERS — Phase 1 acceptance test, round 2 (original, in-session).
// Serves game/ over HTTP (never file://), drives it with Playwright.
//
// Two sessions:
//  A. LOGIC — 640x360 + ?lowfx=1 (no AA/shadows) so headless SwiftShader
//     (a software rasterizer) runs fast enough to exercise movement,
//     sprint, camera orbit, collision, ground and pause in wall-clock time.
//     Game logic is identical in both modes; only raster effects differ.
//  B. VISUALS — 1280x720 full quality: real gameplay screenshots + honest
//     wall-clock FPS + draw-call counts.
//
// Run from the repo root:  node validation/test-phase1.cjs
// Requires playwright-core at ~/workspace/tools/pw/node_modules/.

const { spawn } = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('/home/hatch/workspace/tools/pw/node_modules/playwright-core');

const REPO = path.resolve(__dirname, '..');
const PORT = 8911;
const BASE = `http://127.0.0.1:${PORT}/`;
const CHROME = '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail: detail ?? '' });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}
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
// Poll fn until it returns truthy or timeout (ms). Returns the last value.
async function poll(fn, timeoutMs, intervalMs = 400) {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeoutMs) {
    last = await fn();
    if (last) return last;
    await sleep(intervalMs);
  }
  return last;
}

(async () => {
  const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'] });
  let serverLog = '';
  server.stdout.on('data', (d) => { serverLog += d; });
  server.stderr.on('data', (d) => { serverLog += d; });
  const up = await waitForServer(BASE);
  check('HTTP server serves game/', up, (serverLog.trim().split('\n')[0] ?? '').replace('(node:8582) ', ''));

  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

  // ================= SESSION A: LOGIC (640x360, lowfx) =================
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('requestfailed', (r) => failedRequests.push(`${r.url()} :: ${r.failure()?.errorText}`));
  page.on('response', (r) => { if (r.status() >= 400) failedRequests.push(`${r.url()} :: HTTP ${r.status()}`); });

  await page.goto(BASE + '?lowfx=1', { waitUntil: 'domcontentloaded' });
  await sleep(3000);
  const menuVisible = await page.evaluate(() => !document.getElementById('start-screen').classList.contains('hidden'));
  check('Start screen visible on load', menuVisible);
  const webglOk = await page.evaluate(() => {
    const c = document.getElementById('game');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    return !!gl && !gl.isContextLost();
  });
  check('WebGL context alive', webglOk);

  await page.click('#start-btn');
  await sleep(800);
  check('Start Game button starts play', (await page.evaluate(() => window.__embers.state)) === 'playing');

  // Movement: hold W until the player has walked >3m (or 20s timeout).
  const p0 = await page.evaluate(() => ({ ...window.__embers.playerPos }));
  await page.keyboard.down('KeyW');
  const moved = await poll(async () => {
    const p = await page.evaluate(() => ({ ...window.__embers.playerPos }));
    const d = Math.hypot(p.x - p0.x, p.z - p0.z);
    return d > 3 ? { d, p } : null;
  }, 20000);
  await page.keyboard.up('KeyW');
  check('WASD movement moves the player', !!moved, moved ? `moved ${moved.d.toFixed(2)}m` : 'barely moved in 20s');

  // Sprint vs walk over equal wall time (5s each).
  async function distanceOver(keys, ms) {
    const a = await page.evaluate(() => ({ ...window.__embers.playerPos }));
    for (const k of keys) await page.keyboard.down(k);
    await sleep(ms);
    for (const k of keys) await page.keyboard.up(k);
    const b = await page.evaluate(() => ({ ...window.__embers.playerPos }));
    return Math.hypot(b.x - a.x, b.z - a.z);
  }
  const walkDist = await distanceOver(['KeyW'], 5000);
  const sprintDist = await distanceOver(['ShiftLeft', 'KeyW'], 5000);
  check('Sprint is faster than walk', sprintDist > walkDist * 1.4, `walk ${walkDist.toFixed(2)}m vs sprint ${sprintDist.toFixed(2)}m per 5s`);

  // Mouse orbit.
  const yaw0 = await page.evaluate(() => window.__embers.camYaw);
  await page.mouse.move(320, 180);
  await page.mouse.down();
  for (let i = 0; i < 20; i++) { await page.mouse.move(320 + i * 12, 180); await sleep(16); }
  await page.mouse.up();
  await sleep(400);
  const yaw1 = await page.evaluate(() => window.__embers.camYaw);
  check('Mouse drag rotates camera', Math.abs(yaw1 - yaw0) > 0.3, `yaw ${yaw0.toFixed(2)} -> ${yaw1.toFixed(2)}`);

  // Building collision: restart, then hold W+D toward the tower at (18,-20)
  // (spans x 11..25, z -26..-14). The player must stop at z >= -13.5 and
  // must have moved east past x=8 (sliding along the wall is fine).
  await page.evaluate(() => { window.__embers.start(); });
  await sleep(300);
  await page.keyboard.down('KeyW');
  await page.keyboard.down('KeyD');
  const atWall = await poll(async () => {
    const p = await page.evaluate(() => ({ ...window.__embers.playerPos }));
    return (p.z <= -12.5 && p.x > 8) ? p : null;
  }, 45000);
  await page.keyboard.up('KeyW');
  await page.keyboard.up('KeyD');
  const pc = atWall || (await page.evaluate(() => ({ ...window.__embers.playerPos })));
  check('Building collision blocks the player', pc.z >= -13.6 && pc.x > 8, `pos (${pc.x.toFixed(1)}, ${pc.z.toFixed(1)})`);

  // Ground: Y stays 0.
  const py = await page.evaluate(() => window.__embers.playerPos.y);
  check('Player stays on the ground (y=0)', py === 0, `y=${py}`);

  // Pause / resume via Escape.
  await page.keyboard.press('Escape');
  const paused = await poll(async () => (await page.evaluate(() => window.__embers.state)) === 'paused' ? true : null, 8000);
  await sleep(300);
  check('ESC pauses the game', !!paused, `state=${await page.evaluate(() => window.__embers.state)}`);
  await page.click('#resume-btn');
  await sleep(500);
  check('Resume returns to play', (await page.evaluate(() => window.__embers.state)) === 'playing');
  const drawCalls = await page.evaluate(() => window.__embers.drawCalls);
  const tris = await page.evaluate(() => window.__embers.triangles);
  console.log(`INFO  draw calls=${drawCalls} triangles=${tris}`);
  check('No page errors', pageErrors.length === 0, pageErrors.join(' | ') || '0 errors');
  check('No console errors', consoleErrors.length === 0, consoleErrors.join(' | ') || '0 errors');
  check('No failed requests', failedRequests.length === 0, failedRequests.join(' | ') || '0 failed');
  await page.close();

  // ================= SESSION B: VISUALS (1280x720, full quality) =================
  const page2 = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const page2Errors = [];
  page2.on('pageerror', (e) => page2Errors.push(String(e)));
  await page2.goto(BASE + '?shot=play', { waitUntil: 'domcontentloaded' });
  await sleep(6000); // let the night scene settle (shadows, lights)
  const state2 = await page2.evaluate(() => window.__embers.state);
  check('Full-quality session auto-starts via ?shot=play', state2 === 'playing', `state=${state2}`);
  // Walk forward a little so the character is mid-street with towers ahead.
  await page2.keyboard.down('KeyW');
  await sleep(2500);
  await page2.keyboard.up('KeyW');
  await page2.screenshot({ path: path.join(REPO, 'screenshots', '01-city-exploration.jpg'), type: 'jpeg', quality: 82 });
  // Second angle: orbit the camera ~70 degrees, screenshot near the towers.
  await page2.mouse.move(640, 360);
  await page2.mouse.down();
  for (let i = 0; i < 25; i++) { await page2.mouse.move(640 + i * 14, 340); await sleep(16); }
  await page2.mouse.up();
  await sleep(2500);
  await page2.screenshot({ path: path.join(REPO, 'screenshots', '02-night-street.jpg'), type: 'jpeg', quality: 82 });
  // Honest wall-clock FPS: sample rendered frames over 5 wall seconds.
  const f0 = await page2.evaluate(() => window.__embers.frames);
  await sleep(5000);
  const f1 = await page2.evaluate(() => window.__embers.frames);
  const wallFps = (f1 - f0) / 5;
  const hudFps = await page2.evaluate(() => window.__embers.fps);
  console.log(`INFO  wall FPS @1280x720 full quality (headless SwiftShader) = ${wallFps.toFixed(1)}; HUD meter = ${hudFps.toFixed(1)}`);
  check('No page errors in visual session', page2Errors.length === 0, page2Errors.join(' | ') || '0 errors');
  for (const f of ['01-city-exploration.jpg', '02-night-street.jpg']) {
    const sz = fs.statSync(path.join(REPO, 'screenshots', f)).size;
    check(`Screenshot ${f} <= 256 KiB`, sz <= 262144, `${(sz / 1024).toFixed(1)} KiB`);
  }
  await page2.close();
  await browser.close();
  server.kill();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n==== PHASE 1 TESTS: ${results.length - failed.length}/${results.length} passed ====`);
  if (failed.length) { console.log('FAILED: ' + failed.map((f) => f.name).join(', ')); process.exitCode = 1; }
})().catch((e) => { console.error('TEST RUNNER CRASH:', e); process.exit(1); });

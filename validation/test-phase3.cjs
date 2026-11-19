// CITY OF EMBERS — Phase 3 acceptance test (original, in-session).
// Serves game/ over HTTP (never file://), drives it with Playwright.
//
// Two sessions:
//  A. LOGIC — 640x360 + ?lowfx=1 so headless SwiftShader runs fast
//     enough: vehicles present, traffic moves, enter prompt, E enter/exit,
//     accelerate / brake / reverse / steer / handbrake, vehicle collision,
//     speedometer HUD, traffic separation, on-foot regression.
//  B. VISUALS — 1280x720 full quality: ?shot=drive screenshot of Raka
//     driving the sedan with a live speedometer, honest wall-clock FPS.
//
// Run from the repo root:  node validation/test-phase3.cjs
// Requires playwright-core at ~/workspace/tools/pw/node_modules/.

const { spawn } = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('/home/hatch/workspace/tools/pw/node_modules/playwright-core');

const REPO = path.resolve(__dirname, '..');
const PORT = 8914;
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
// Poll fn until it returns a truthy value (or timeout). Returns the last
// value seen, so the caller can report what actually happened.
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
const embers = (page, expr) => page.evaluate((e) => {
  // eslint-disable-next-line no-new-func
  return new Function('e', `return (${e})`)(window.__embers);
}, expr);

(async () => {
  const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'] });
  let serverLog = '';
  server.stdout.on('data', (d) => { serverLog += d; });
  server.stderr.on('data', (d) => { serverLog += d; });
  const up = await waitForServer(BASE);
  check('server up', up, up ? BASE : serverLog.slice(-500));
  if (!up) { server.kill(); process.exit(1); }

  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--no-sandbox', '--disable-gpu-sandbox', '--use-gl=swiftshader'],
  });

  // ================= SESSION A — logic (640x360, lowfx) =================
  const testStart = Date.now();
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${((Date.now() - testStart) / 1000).toFixed(0)}s] ${m.text().slice(0, 160)}`); });
  page.on('pageerror', (e) => errors.push(`[${((Date.now() - testStart) / 1000).toFixed(0)}s] PAGEERROR: ${e.message}`));
  page.on('requestfailed', (r) => errors.push(`[${((Date.now() - testStart) / 1000).toFixed(0)}s] REQFAIL: ${r.url()}`));
  await page.goto(`${BASE}?shot=play&lowfx=1`, { waitUntil: 'load', timeout: 30000 });
  await sleep(4000);
  check('game playing', (await page.evaluate(() => window.__embers.state)) === 'playing');

  // 1. Vehicles present: 3 drivable + 7 traffic, at their spawn spots.
  const vs = await page.evaluate(() => window.__embers.vehicles);
  const drivable = vs.filter((v) => v.drivable);
  const traffic = vs.filter((v) => v.traffic);
  check('vehicles present', vs.length === 10 && drivable.length === 3 && traffic.length === 7,
    `${vs.length} total, ${drivable.length} drivable (${drivable.map((v) => v.type).join(',')}), ${traffic.length} traffic`);
  const sedan = vs.find((v) => v.type === 'sedan');
  check('sedan spawn', sedan && Math.abs(sedan.x - 28) < 1 && Math.abs(sedan.z + 11.5) < 1,
    sedan ? `(${sedan.x.toFixed(1)}, ${sedan.z.toFixed(1)})` : 'missing');
  const truck = vs.find((v) => v.type === 'truck');
  check('truck spawn', truck && Math.abs(truck.x - 108) < 1 && Math.abs(truck.z - 30) < 1,
    truck ? `(${truck.x.toFixed(1)}, ${truck.z.toFixed(1)})` : 'missing');

  // 2. Traffic moves on its loops.
  const t0 = await page.evaluate(() => window.__embers.vehicles.filter((v) => v.traffic).map((v) => ({ x: v.x, z: v.z })));
  const moved = await poll(async () => {
    const t1 = await page.evaluate(() => window.__embers.vehicles.filter((v) => v.traffic).map((v) => ({ x: v.x, z: v.z })));
    const d = Math.max(...t1.map((p, i) => Math.hypot(p.x - t0[i].x, p.z - t0[i].z)));
    return d > 3 ? d : null;
  }, 45000);
  check('traffic moves', !!moved, moved ? `max displacement ${moved.toFixed(1)} m` : 'no car moved > 3 m in 45 s');

  // 3. On-foot regression: walking still moves the player.
  const p0 = await page.evaluate(() => window.__embers.playerPos);
  await page.keyboard.down('KeyW');
  const walked = await poll(async () => {
    const p1 = await page.evaluate(() => window.__embers.playerPos);
    return Math.hypot(p1.x - p0.x, p1.z - p0.z) > 1.5 ? Math.hypot(p1.x - p0.x, p1.z - p0.z) : null;
  }, 20000);
  await page.keyboard.up('KeyW');
  check('walk still works (regression)', !!walked, walked ? `moved ${walked.toFixed(1)} m` : 'player did not move');

  // 4. Enter prompt appears near the sedan.
  await page.evaluate(() => window.__embers.teleport(28, -14));
  await sleep(1500);
  const prompt = await page.evaluate(() => {
    const el = document.getElementById('interact-prompt');
    return { hidden: el.classList.contains('hidden'), text: el.textContent };
  });
  check('enter prompt near car', !prompt.hidden && prompt.text.includes('Tekan E'),
    JSON.stringify(prompt));

  // 5. Press E -> driving, speedometer visible.
  await page.keyboard.press('KeyE');
  await sleep(1200);
  const entered = await page.evaluate(() => ({
    driving: window.__embers.driving,
    car: window.__embers.drivenCar,
    speedoHidden: document.getElementById('speedo').classList.contains('hidden'),
  }));
  check('enter vehicle (E)', entered.driving && entered.car && entered.car.type === 'sedan' && !entered.speedoHidden,
    JSON.stringify(entered.car));

  // 6. Accelerate: hold W, speed rises above 20 km/h.
  await page.keyboard.down('KeyW');
  const fast = await poll(async () => {
    const kmh = await page.evaluate(() => window.__embers.speedKmh);
    return kmh > 20 ? kmh : null;
  }, 40000);
  check('accelerate', !!fast, fast ? `${fast.toFixed(0)} km/h` : 'never passed 20 km/h');
  // Speedometer HUD shows a live number.
  const speedoNum = await page.evaluate(() => document.getElementById('speed-num').textContent);
  check('speedometer HUD live', Number(speedoNum) > 0, `speed-num = ${speedoNum}`);

  // 7. Steering: hold W+D, heading decreases (right turn from east).
  const h0 = await page.evaluate(() => window.__embers.drivenCar.heading);
  await page.keyboard.down('KeyD');
  const turned = await poll(async () => {
    const h1 = await page.evaluate(() => window.__embers.drivenCar.heading);
    let dh = h0 - h1;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    return dh > 0.3 ? dh : null;
  }, 30000);
  await page.keyboard.up('KeyD');
  check('steering (D = right)', !!turned, turned ? `heading -${turned.toFixed(2)} rad` : `heading stayed ~${h0.toFixed(2)}`);

  // 8. Brake: hold S while moving, speed falls below half.
  const vBefore = await page.evaluate(() => window.__embers.speedKmh);
  await page.keyboard.up('KeyW');
  await page.keyboard.down('KeyS');
  const braked = await poll(async () => {
    const kmh = await page.evaluate(() => window.__embers.speedKmh);
    return kmh < vBefore * 0.5 ? true : null; // boolean: 0 km/h is falsy in JS
  }, 30000);
  await page.keyboard.up('KeyS');
  const vAfterBrake = await page.evaluate(() => window.__embers.speedKmh);
  check('brake (S while moving)', braked === true, `from ${vBefore.toFixed(0)} to ${vAfterBrake.toFixed(0)} km/h`);

  // 9. Reverse: from (near) stop, hold S, speed goes negative.
  await page.keyboard.down('KeyS');
  const rev = await poll(async () => {
    const s = await page.evaluate(() => window.__embers.drivenCar.speed);
    return s < -1 ? s : null;
  }, 30000);
  await page.keyboard.up('KeyS');
  check('reverse (S from stop)', !!rev, rev != null ? `${rev.toFixed(1)} m/s` : 'never reversed');

  // 10. Handbrake: accelerate the sports car, then Space stops it fast.
  await page.keyboard.press('KeyE'); // exit sedan
  await sleep(800);
  const exited1 = await page.evaluate(() => window.__embers.driving);
  check('exit vehicle (E)', !exited1, exited1 ? 'still driving' : 'on foot');
  await page.evaluate(() => window.__embers.enterCar('sports'));
  await sleep(800);
  await page.keyboard.down('KeyW');
  const fast2 = await poll(async () => {
    const kmh = await page.evaluate(() => window.__embers.speedKmh);
    return kmh > 25 ? kmh : null;
  }, 40000);
  await page.keyboard.up('KeyW');
  const vHb = await page.evaluate(() => window.__embers.speedKmh);
  await page.keyboard.down('Space');
  const hb = await poll(async () => {
    const kmh = await page.evaluate(() => window.__embers.speedKmh);
    return kmh < 5 ? true : null; // boolean: 0 km/h is falsy in JS
  }, 20000);
  await page.keyboard.up('Space');
  const vAfterHb = await page.evaluate(() => window.__embers.speedKmh);
  check('handbrake (Space)', !!fast2 && hb === true, `reached ${fast2 ? fast2.toFixed(0) : '—'} km/h, handbrake to ${vAfterHb.toFixed(0)} km/h (from ${vHb.toFixed(0)})`);

  // 11. Collision: sedan placed on the road facing north, driven into
  // tower [18,-20] (south face z=-14, 16.5 m run) — damage must rise.
  await page.keyboard.press('KeyE'); // exit sports
  await sleep(800);
  await page.evaluate(() => window.__embers.placeCar('sedan', 20, 2.5, Math.PI));
  await page.evaluate(() => window.__embers.enterCar('sedan'));
  await sleep(800);
  await page.keyboard.down('KeyW');
  const dmg = await poll(async () => {
    const d = await page.evaluate(() => window.__embers.drivenCar.damage);
    return d > 0.02 ? d : null;
  }, 45000);
  await page.keyboard.up('KeyW');
  check('vehicle collision + damage', !!dmg, dmg != null ? `damage ${(dmg * 100).toFixed(0)}%` : 'no damage after 45 s of driving north into the tower');
  const speedoAfter = await page.evaluate(() => document.getElementById('speed-num').textContent);
  check('speedometer still live after crash', Number(speedoAfter) >= 0, `speed-num = ${speedoAfter}`);

  // 12. Traffic separation: no two cars overlap.
  const vs2 = await page.evaluate(() => window.__embers.vehicles);
  let minD = Infinity;
  for (let i = 0; i < vs2.length; i++) {
    for (let j = i + 1; j < vs2.length; j++) {
      minD = Math.min(minD, Math.hypot(vs2[i].x - vs2[j].x, vs2[i].z - vs2[j].z));
    }
  }
  check('traffic separation (no overlap)', minD > 2.0, `min pairwise distance ${minD.toFixed(2)} m`);
  const inBounds = vs2.every((v) => Math.abs(v.x) <= 170 && Math.abs(v.z) <= 70);
  check('all cars inside world bounds', inBounds, inBounds ? '' : JSON.stringify(vs2.filter((v) => Math.abs(v.x) > 170 || Math.abs(v.z) > 70)));

  // 13. Exit + speedometer hides.
  await page.keyboard.press('KeyE');
  await sleep(1000);
  const exited2 = await page.evaluate(() => ({
    driving: window.__embers.driving,
    speedoHidden: document.getElementById('speedo').classList.contains('hidden'),
    playerPos: window.__embers.playerPos,
    carPos: window.__embers.drivenCar ? null : undefined,
  }));
  const nearCar = await page.evaluate(() => {
    const p = window.__embers.playerPos;
    const cars = window.__embers.vehicles.filter((v) => v.drivable);
    return Math.min(...cars.map((c) => Math.hypot(p.x - c.x, p.z - c.z)));
  });
  check('exit vehicle, player beside car', !exited2.driving && exited2.speedoHidden && nearCar < 4,
    `driving=${exited2.driving}, speedoHidden=${exited2.speedoHidden}, nearest car ${nearCar.toFixed(1)} m`);

  // 14. District regression: teleport to waterfront, district changes.
  await page.evaluate(() => window.__embers.teleport(140, 40));
  await sleep(1500);
  const dist = await page.evaluate(() => window.__embers.district);
  check('district detection (regression)', /WATERFRONT/i.test(dist.district),
    `${dist.district} · ${dist.street}`);

  const fpsA = await page.evaluate(() => window.__embers.fps);
  const dcA = await page.evaluate(() => window.__embers.drawCalls);
  const triA = await page.evaluate(() => window.__embers.triangles);
  console.log(`SESSION A perf: FPS ${fpsA.toFixed(1)} (wall-clock, 640x360 lowfx) · draw calls ${dcA} · triangles ${triA}`);
  check('no console errors / failed requests', errors.length === 0, errors.length ? errors.slice(0, 5).join(' | ') : 'clean');
  await page.close();

  // ================= SESSION B — visuals (1280x720, full quality) =================
  const shot = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errorsB = [];
  shot.on('console', (m) => { if (m.type() === 'error') errorsB.push(m.text()); });
  shot.on('pageerror', (e) => errorsB.push('PAGEERROR: ' + e.message));
  shot.on('requestfailed', (r) => errorsB.push('REQFAIL: ' + r.url()));
  await shot.goto(`${BASE}?shot=drive&seed=1`, { waitUntil: 'load', timeout: 30000 });
  // Let a few frames render (SwiftShader is slow at 1280x720).
  await poll(async () => (await shot.evaluate(() => window.__embers.frames)) > 3, 60000, 1000);
  // Hold W briefly so the car is visibly rolling with a live speedometer.
  await shot.keyboard.down('KeyW');
  await sleep(5000);
  await shot.keyboard.up('KeyW');
  await sleep(1500);
  const driveState = await shot.evaluate(() => ({
    driving: window.__embers.driving,
    car: window.__embers.drivenCar,
    speedKmh: window.__embers.speedKmh,
    fps: window.__embers.fps,
    drawCalls: window.__embers.drawCalls,
    triangles: window.__embers.triangles,
    speedo: document.getElementById('speed-num').textContent,
    speedoHidden: document.getElementById('speedo').classList.contains('hidden'),
  }));
  console.log('SHOT drive state:', JSON.stringify(driveState));
  check('shot=drive: driving with live speedometer', driveState.driving && !driveState.speedoHidden && Number(driveState.speedo) > 0,
    `driving=${driveState.driving}, speedo=${driveState.speedo} km/h`);
  const shotPath = path.join(REPO, 'screenshots', '04-vehicle-driving.jpg');
  await shot.screenshot({ path: shotPath, type: 'jpeg', quality: 82 });
  const shotStat = fs.statSync(shotPath);
  check('screenshot 04-vehicle-driving.jpg saved', shotStat.size > 10000, `${(shotStat.size / 1024).toFixed(0)} KiB`);
  console.log(`SESSION B perf: FPS ${driveState.fps.toFixed(1)} (wall-clock, 1280x720 full quality) · draw calls ${driveState.drawCalls} · triangles ${driveState.triangles}`);
  check('no console errors / failed requests (visuals)', errorsB.length === 0, errorsB.length ? errorsB.slice(0, 5).join(' | ') : 'clean');
  await shot.close();

  await browser.close();
  server.kill();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n==== PHASE 3: ${results.length - failed.length}/${results.length} PASS ====`);
  if (failed.length) {
    console.log('FAILED:');
    for (const f of failed) console.log(` - ${f.name}: ${f.detail}`);
  }
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

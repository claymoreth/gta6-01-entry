// CITY OF EMBERS — Repair C+FACE acceptance test (original, in-session).
// Serves game/ over HTTP (never file://), drives it with Playwright.
//
// Two sessions:
//  A. LOGIC — 480x270 + ?lowfx=1: M4 objective text + unwitnessed toast +
//     witnessed escalation + M4 completion, vehicle nose-vs-travel angle,
//     traffic route-following over 60 wall-seconds.
//  B. VISUALS — 1280x720 full quality: lighting brightness + light pools,
//     player face from the front, driving + traffic + M4 screenshots saved
//     to validation/ (NOT screenshots/), plus the dossier 04 re-take.
//
// Run from the repo root:  node validation/test-repair-cface.cjs
// Requires playwright-core at ~/workspace/tools/pw/node_modules/.

const { spawn, execFile } = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('/home/hatch/workspace/tools/pw/node_modules/playwright-core');

const REPO = path.resolve(__dirname, '..');
const PORT = 8923;
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
function isFlakyShaderError(text) {
  return /THREE\.WebGLProgram: Shader Error/.test(text) && /Program Info Log:\s*$/.test(text);
}
function realErrors(list) {
  return list.filter((e) => !isFlakyShaderError(e));
}
const embers = (page, expr) => page.evaluate((e) => {
  return new Function('e', `return e.${e}`)(window.__embers);
}, expr);
async function waitGame(page, gameSeconds, timeoutMs = 120000) {
  const f0 = await embers(page, 'frames');
  const target = f0 + Math.ceil(gameSeconds / 0.05);
  const ok = await poll(async () => (await embers(page, 'frames')) >= target, timeoutMs, 500);
  return !!ok;
}
async function snap(page, name) {
  const p = path.join(REPO, 'validation', name);
  await page.screenshot({ path: p, type: 'jpeg', quality: 82 });
  const size = fs.statSync(p).size;
  console.log(`${name}: ${(size / 1024).toFixed(0)} KiB`);
  return p;
}
function meanBrightness(file) {
  return new Promise((resolve, reject) => {
    const code = [
      'from PIL import Image',
      `im = Image.open(${JSON.stringify(file)}).convert("L")`,
      'px = list(im.getdata())',
      'print(sum(px) / len(px))',
    ].join('\n');
    execFile('python3', ['-c', code], (err, stdout) => {
      if (err) return reject(err);
      resolve(parseFloat(stdout.trim()));
    });
  });
}
// Distance from (x,z) to the nearest segment of a polyline loop.
function distToLoop(x, z, loop) {
  let best = Infinity;
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i];
    const b = loop[(i + 1) % loop.length];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len2 = dx * dx + dz * dz;
    let t = len2 === 0 ? 0 : ((x - a.x) * dx + (z - a.z) * dz) / len2;
    t = Math.max(0, Math.min(1, t));
    const px = a.x + dx * t;
    const pz = a.z + dz * t;
    best = Math.min(best, Math.hypot(x - px, z - pz));
  }
  return best;
}
const LOOPS = {
  ew: [
    { x: -160, z: 2.5 }, { x: 160, z: 2.5 }, { x: 166, z: 0 },
    { x: 160, z: -2.5 }, { x: -160, z: -2.5 }, { x: -166, z: 0 },
  ],
  dermaga: [
    { x: 118, z: 55 }, { x: 118, z: -55 }, { x: 115, z: -58 },
    { x: 112, z: -55 }, { x: 112, z: 55 }, { x: 115, z: 58 },
  ],
  melati: [
    { x: -112, z: 50 }, { x: -112, z: -50 }, { x: -115, z: -53 },
    { x: -118, z: -50 }, { x: -118, z: 50 }, { x: -115, z: 53 },
  ],
};
function distToAnyLoop(x, z) {
  return Math.min(
    distToLoop(x, z, LOOPS.ew),
    distToLoop(x, z, LOOPS.dermaga),
    distToLoop(x, z, LOOPS.melati),
  );
}
function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

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

  // ================= SESSION A — logic (480x270, lowfx) =================
  const testStart = Date.now();
  const page = await browser.newPage({ viewport: { width: 480, height: 270 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${((Date.now() - testStart) / 1000).toFixed(0)}s] ${m.text().slice(0, 160)}`); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + String(e).slice(0, 160)));
  page.on('requestfailed', (r) => errors.push('REQFAIL: ' + r.url()));
  await page.goto(BASE + '?lowfx=1&shot=play', { waitUntil: 'domcontentloaded' });
  await poll(async () => (await embers(page, 'frames')) > 5, 60000, 500);
  check('game loads + playing', (await embers(page, 'state')) === 'playing',
    `state=${await embers(page, 'state')}`);
  await page.evaluate(() => localStorage.removeItem('city-of-embers-save-v1'));

  // ---- 1. M4 objective text tells the player how to attract police ----
  await embers(page, 'debugSetMission(3)');
  await sleep(500);
  const m4text = (await embers(page, 'mission')).text.title;
  check('M4 objective explains the trigger', /commit a crime where people can see you/.test(m4text),
    `title=${m4text}`);

  // ---- 2. Unwitnessed crime: toast + wanted stays 0 ----
  // Find a spot with no witness in range (no ped within 30 m, no police
  // unit within 50 m) so the crime is genuinely unwitnessed.
  const candidates = [[150, 40], [158, -30], [-160, 55], [60, -60], [-60, 60], [140, -55]];
  let spot = null;
  for (const [cx, cz] of candidates) {
    await embers(page, `teleport(${cx}, ${cz})`);
    await sleep(700);
    const n = await embers(page, 'npcs');
    const minPed = Math.min(...n.pedestrians.map((p) => Math.hypot(p.x - cx, p.z - cz)));
    const minPol = Math.min(...n.police.map((p) => Math.hypot(p.x - cx, p.z - cz)));
    console.log(`  candidate (${cx},${cz}): nearest ped ${minPed.toFixed(1)} m, nearest police ${minPol.toFixed(1)} m`);
    if (minPed > 30 && minPol > 50) { spot = [cx, cz]; break; }
  }
  check('found a witness-free spot for the unwitnessed test', spot !== null,
    spot ? `spot=(${spot[0]},${spot[1]})` : 'no candidate was witness-free');
  let unwit = null;
  if (spot) {
    await embers(page, 'debugResetNpcs()');
    await embers(page, `teleport(${spot[0]}, ${spot[1]})`);
    await sleep(800);
    const before = (await embers(page, 'npcs.wanted')).level;
    await embers(page, `debugCrime('weaponFire', 'repair-unwit-1')`);
    await sleep(600);
    const crimes = await embers(page, 'npcs.crimes');
    const last = crimes[crimes.length - 1];
    const after = await embers(page, 'npcs.wanted');
    const toast = await page.evaluate(() => document.getElementById('toast').textContent);
    unwit = { last, after, toast, before };
    check('unwitnessed crime: logged witnessed=false', last && last.witnessed === false,
      last ? `type=${last.type} witnessed=${last.witnessed}` : 'no crime logged');
    check('unwitnessed crime: wanted stays 0', after.level === 0,
      `level ${before} -> ${after.level}, heat=${after.heat.toFixed(1)}`);
    check('unwitnessed crime: toast explains no one saw it', /No one saw that/.test(toast),
      `toast="${toast}"`);
  }

  // ---- 3. Witnessed crime: real pistol shot near an officer raises wanted ----
  await embers(page, 'debugResetNpcs()');
  await embers(page, 'teleport(0, 0)');
  await sleep(500);
  await embers(page, 'debugPlacePolice(0, 8, -6)');
  await sleep(600);
  const los = await embers(page, 'debugLOS(8, -6, 0, 0)');
  check('officer has line of sight to player', los === true, `los=${los}`);
  await embers(page, 'combatSwitch(1)');
  await sleep(400);
  // Aim into empty air so the shot hits nothing but is still a crime.
  const p0 = await embers(page, 'playerPos');
  const yaw = Math.atan2(-(0 - p0.x), -(-40 - p0.z));
  await embers(page, `setCamYaw(${yaw})`);
  await embers(page, `setFacing(${Math.atan2(0 - p0.x, -40 - p0.z)})`);
  await sleep(300);
  await embers(page, 'combatFire()');
  await sleep(1500);
  const wanted = await embers(page, 'npcs.wanted');
  check('witnessed shot raises wanted to level >= 1', wanted.level >= 1,
    `level=${wanted.level} heat=${wanted.heat.toFixed(1)} status=${wanted.status}`);
  await embers(page, 'debugResetNpcs()');

  // ---- 4. M4 completion: wanted >= 1 then back to 0 -> M5 + $200 ----
  await embers(page, 'debugSetMission(3)');
  await sleep(400);
  const money0 = (await embers(page, 'combat')).money;
  await embers(page, 'debugSetHeat(45)');
  await sleep(1200);
  const w4 = await embers(page, 'npcs.wanted');
  check('M4: wanted raised to level >= 1', w4.level >= 1, `level=${w4.level}`);
  const m4mid = (await embers(page, 'mission')).text.title;
  check('M4 objective flips to Lose the police once wanted', /Lose the police/.test(m4mid),
    `title=${m4mid}`);
  await embers(page, 'debugSetHeat(0)');
  const m4ok = await poll(async () => (await embers(page, 'mission')).index === 4, 30000, 500);
  const money1 = (await embers(page, 'combat')).money;
  check('M4 completes when wanted back to 0 -> M5 starts', m4ok,
    `mission index=${(await embers(page, 'mission')).index}`);
  check('M4 reward +$200', money1 === money0 + 200, `money $${money0} -> $${money1}`);

  // ---- 5. Vehicle nose vs travel direction (must be near 0 deg, was 90.0) ----
  await embers(page, 'debugResetNpcs()');
  const entered = await embers(page, `enterCar('sedan')`);
  check('entered the Ember Sedan', entered === true && (await embers(page, 'driving')) === true,
    `entered=${entered} driving=${await embers(page, 'driving')}`);
  const d0 = await embers(page, 'drivenCar');
  await page.keyboard.down('KeyW');
  await sleep(6000);
  await page.keyboard.up('KeyW');
  const d1 = await embers(page, 'drivenCar');
  const dx = d1.x - d0.x;
  const dz = d1.z - d0.z;
  const moved = Math.hypot(dx, dz);
  const velHeading = Math.atan2(dx, dz);
  const noseHeading = d1.heading;
  const angleDeg = Math.abs(wrapAngle(velHeading - noseHeading)) * 180 / Math.PI;
  check('sedan moved a measurable distance while driving', moved > 3,
    `moved ${moved.toFixed(1)} m, speed ${d1.speed.toFixed(1)} m/s`);
  check('nose-vs-travel angle near 0 degrees (was 90.0)', moved > 3 && angleDeg < 12,
    `angle=${angleDeg.toFixed(1)} deg (vel heading=${velHeading.toFixed(2)}, nose heading=${noseHeading.toFixed(2)})`);
  await embers(page, 'exitCar()');

  // ---- 6. Traffic route-following over 60 wall-seconds ----
  const tCars0 = (await embers(page, 'vehicles')).filter((v) => v.traffic);
  check('7 traffic cars present', tCars0.length === 7, `count=${tCars0.length}`);
  const track = tCars0.map((c, i) => ({
    i, path: 0, maxOff: 0, last: { x: c.x, z: c.z },
    off0: distToAnyLoop(c.x, c.z),
  }));
  const SAMPLES = 30;
  for (let s = 0; s < SAMPLES; s++) {
    await sleep(2000);
    const cars = (await embers(page, 'vehicles')).filter((v) => v.traffic);
    for (let i = 0; i < cars.length && i < track.length; i++) {
      const t = track[i];
      const step = Math.hypot(cars[i].x - t.last.x, cars[i].z - t.last.z);
      t.path += step;
      t.last = { x: cars[i].x, z: cars[i].z };
      t.maxOff = Math.max(t.maxOff, distToAnyLoop(cars[i].x, cars[i].z));
      t.offEnd = distToAnyLoop(cars[i].x, cars[i].z);
    }
  }
  let trafficOk = true;
  for (const t of track) {
    const okPath = t.path > 15;
    const okOff = t.maxOff < 20;
    const okEnd = t.offEnd < 15;
    console.log(`  traffic[${t.i}]: path=${t.path.toFixed(1)} m, max off-loop=${t.maxOff.toFixed(1)} m, end off-loop=${t.offEnd.toFixed(1)} m`);
    if (!okPath || !okOff || !okEnd) trafficOk = false;
  }
  check('every traffic car keeps moving and stays near its loop', trafficOk,
    'see per-car lines above (pre-fix: 2 cars moved 0 m, max off-loop 63.5 m)');

  // ---- 7. No console errors (Session A) ----
  const realA = realErrors(errors);
  check('no real console/page errors (Session A)', realA.length === 0,
    realA.length ? realA.slice(0, 3).join(' ;; ') : 'clean');
  const flakyA = errors.length - realA.length;
  if (flakyA > 0) console.log(`(note: ${flakyA} flaky SwiftShader shader error(s) filtered)`);
  await page.close();

  // ================= SESSION B — visuals (1280x720) =================
  const pageB = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errorsB = [];
  pageB.on('console', (m) => { if (m.type() === 'error') errorsB.push(m.text().slice(0, 160)); });
  pageB.on('pageerror', (e) => errorsB.push('PAGEERROR: ' + String(e).slice(0, 160)));
  pageB.on('requestfailed', (r) => errorsB.push('REQFAIL: ' + r.url()));
  await pageB.goto(BASE + '?shot=play', { waitUntil: 'domcontentloaded' });
  await poll(async () => (await embers(pageB, 'frames')) > 5, 60000, 1000);
  await pageB.evaluate(() => localStorage.removeItem('city-of-embers-save-v1'));

  // (1) Lighting: road at (60, 0), away from the Downtown center lights.
  await embers(pageB, 'teleport(60, 0)');
  await embers(pageB, 'setFacing(1.5708)');
  await embers(pageB, 'setCamYaw(1.5708)');
  await sleep(1500);
  const lightShot = await snap(pageB, 'repair-04-lighting.jpg');
  const bright = await meanBrightness(lightShot);
  console.log(`lighting brightness at (60,0): mean ${bright.toFixed(1)}/255 (pre-fix: 16.6)`);
  check('road brightness clearly higher than pre-fix 16.6', bright > 19,
    `mean=${bright.toFixed(1)}/255`);

  // (2) Face: front view of the player.
  await embers(pageB, 'teleport(0, 0)');
  await embers(pageB, 'setFacing(3.1416)');
  await embers(pageB, 'setCamYaw(3.1416)');
  await sleep(1500);
  await snap(pageB, 'repair-05-face.jpg');

  // (3) Vehicle: sedan driving (also the dossier 04 re-take).
  await embers(pageB, `enterCar('sedan')`);
  await pageB.keyboard.down('KeyW');
  await sleep(4000);
  await pageB.keyboard.up('KeyW');
  const dcB = await embers(pageB, 'drivenCar');
  console.log(`vehicle shot: sedan at (${dcB.x.toFixed(1)},${dcB.z.toFixed(1)}) heading=${dcB.heading.toFixed(2)} speed=${dcB.speed.toFixed(1)}`);
  await snap(pageB, 'repair-02-vehicle.jpg');
  const shot04 = path.join(REPO, 'screenshots', '04-vehicle-driving.jpg');
  await pageB.screenshot({ path: shot04, type: 'jpeg', quality: 82 });
  console.log(`screenshots/04-vehicle-driving.jpg: ${(fs.statSync(shot04).size / 1024).toFixed(0)} KiB (re-taken)`);
  await embers(pageB, 'exitCar()');

  // (4) Traffic: cars on Jalan Merdeka from a high vantage.
  await embers(pageB, 'teleport(0, 25)');
  await embers(pageB, 'setFacing(3.1416)');
  await embers(pageB, 'setCamYaw(3.1416)');
  await sleep(1500);
  const carsB = (await embers(pageB, 'vehicles')).filter((v) => v.traffic);
  const nearRoad = carsB.filter((c) => distToAnyLoop(c.x, c.z) < 10).length;
  console.log(`traffic shot: ${nearRoad}/${carsB.length} traffic cars within 10 m of a loop road`);
  await snap(pageB, 'repair-03-traffic.jpg');
  check('traffic visible near roads in the visual session', nearRoad >= 5,
    `${nearRoad}/7 cars within 10 m of a loop`);

  // (5) M4: mission UI + unwitnessed toast.
  await embers(pageB, 'debugSetMission(3)');
  await embers(pageB, 'teleport(150, 40)');
  await sleep(800);
  await embers(pageB, `debugCrime('weaponFire', 'repair-m4-shot-1')`);
  await sleep(500);
  await snap(pageB, 'repair-01-m4.jpg');

  const realB = realErrors(errorsB);
  check('no real console/page errors (Session B)', realB.length === 0,
    realB.length ? realB.slice(0, 3).join(' ;; ') : 'clean');
  await pageB.close();
  await browser.close();
  server.kill();

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  console.log(`\nREPAIR C+FACE: ${passed}/${results.length} checks passed`);
  if (failed.length) {
    console.log('FAILED:');
    for (const f of failed) console.log(` - ${f.name} — ${f.detail}`);
  }
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error('TEST CRASH:', e);
  process.exit(2);
});

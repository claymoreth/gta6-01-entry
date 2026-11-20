// CITY OF EMBERS — Phase 5 acceptance test (original, in-session).
// Serves game/ over HTTP (never file://), drives it with Playwright.
//
// Two sessions:
//  A. LOGIC — 480x270 + ?lowfx=1: combat controls + cooldowns, NPC
//     damage/down/flee/recover, police escalation from combat, HUD
//     weapon/ammo + mission UI, five missions in order, save/load +
//     refresh survival, WASTED/respawn, English-only visible text,
//     no console errors.
//  B. VISUALS — 1280x720 full quality: 7 genuine gameplay screenshots
//     (firing, NPC down, police response, mission brief, mission
//     complete, WASTED, save) saved to validation/ (NOT screenshots/).
//
// Run from the repo root:  node validation/test-phase5.cjs
// Requires playwright-core at ~/workspace/tools/pw/node_modules/.

const { spawn } = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('/home/hatch/workspace/tools/pw/node_modules/playwright-core');

const REPO = path.resolve(__dirname, '..');
const PORT = 8919;
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
const ID_WORDS = [
  'Tekan', 'Tangan', 'Jalan', 'Taman', 'Mercusuar', 'Plaza Merdeka', 'Dermaga',
  'Balai', 'Rumah', 'Kantor', 'Menara', 'Sedan Ember', 'Sports Ember',
  'Truk Ember', 'Pergi', 'tujuan', 'bergerak', 'lari', 'masuk', 'putar',
  'jeda', 'Kosong', 'Hijau', 'KM/J', 'kendaraan', 'mobil', 'Selamat',
  'Keluar', 'menunggumu', 'Jelajahi', 'Kota', 'Malam', 'Gudang', 'Kontainer',
  'KAMPUNG', 'Perumahan', 'Pasar', 'Persimpangan', 'Sempit', 'Mobil Warga',
  'KENDARAAN', 'SPASI', 'Panah', 'mengemudi', 'orisinal', 'Dibangun',
  'distrik', 'pesisir', 'tropis', 'klik', 'tandai',
];
function scanIndonesian(text) {
  const found = [];
  for (const w of ID_WORDS) {
    const re = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(text)) found.push(w);
  }
  return found;
}
// Aim the camera (and the pistol) from the player toward (tx, tz).
async function aimAt(page, tx, tz) {
  const p = await embers(page, 'playerPos');
  const dx = tx - p.x, dz = tz - p.z;
  const yaw = Math.atan2(-dx, -dz);
  await embers(page, `setCamYaw(${yaw})`);
  await embers(page, `setFacing(${Math.atan2(dx, dz)})`);
  await sleep(300);
  return yaw;
}
function yawTo(px, pz, tx, tz) {
  return Math.atan2(tx - px, tz - pz) + Math.PI;
}
async function snap(page, name) {
  const p = path.join(REPO, 'validation', name);
  await page.screenshot({ path: p, type: 'jpeg', quality: 82 });
  const size = fs.statSync(p).size;
  console.log(`${name}: ${(size / 1024).toFixed(0)} KiB`);
  return p;
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
  const fStart = await embers(page, 'frames');
  const tStart = Date.now();
  await sleep(5000);
  const fEnd = await embers(page, 'frames');
  const fpsA = (fEnd - fStart) / ((Date.now() - tStart) / 1000);
  console.log(`SESSION A perf: FPS ${fpsA.toFixed(1)} (wall-clock, 480x270 lowfx)`);

  // Clear any save from earlier runs so the test starts fresh.
  await page.evaluate(() => localStorage.removeItem('city-of-embers-save-v1'));

  // ---- 1. Weapon switch + HUD weapon/ammo ----
  await embers(page, 'combatSwitch(1)');
  await sleep(500);
  let c = await embers(page, 'combat');
  check('switch to Pistol', c.weapon === 'Pistol', `weapon=${c.weapon}`);
  const wDom = await page.evaluate(() => ({
    w: document.getElementById('weapon').textContent,
    a: document.getElementById('ammo').textContent,
  }));
  check('HUD weapon/ammo shows Pistol 12 / 48', wDom.w === 'Pistol' && wDom.a === '12 / 48',
    `weapon=${wDom.w} ammo=${wDom.a}`);
  await embers(page, 'combatSwitch(0)');
  await sleep(300);
  c = await embers(page, 'combat');
  check('switch back to Bare Hands', c.weapon === 'Bare Hands' && c.ammo === '—',
    `weapon=${c.weapon} ammo=${c.ammo}`);
  await embers(page, 'combatSwitch(1)');

  // ---- 2. Fire + cooldown + ammo ----
  // Place a pedestrian 6 m in front of the player on open road, aim at it.
  await embers(page, 'teleport(0, 0)');
  await embers(page, 'debugPlacePed(0, 0, -6)');
  await sleep(800);
  await aimAt(page, 0, -6);
  const mag0 = (await embers(page, 'combat')).ammo;
  await embers(page, 'combatFire()');
  await sleep(400);
  let mag1 = (await embers(page, 'combat')).ammo;
  check('fire once: ammo drops 12 -> 11', mag0 === '12 / 48' && mag1 === '11 / 48',
    `before=${mag0} after=${mag1}`);
  // Immediate second shot must be blocked by the 0.28 s fire cooldown.
  await embers(page, 'combatFire()');
  await sleep(200);
  const magBlocked = (await embers(page, 'combat')).ammo;
  check('fire cooldown blocks immediate re-fire', magBlocked === '11 / 48',
    `ammo=${magBlocked}`);
  await waitGame(page, 0.5);
  await embers(page, 'combatFire()');
  await sleep(400);
  const mag2 = (await embers(page, 'combat')).ammo;
  check('fire after cooldown: ammo drops to 10', mag2 === '10 / 48', `ammo=${mag2}`);
  // Two pistol hits (2 dmg each, ped HP 3) must down the pedestrian.
  const pedAfter = (await embers(page, 'npcs.pedestrians'))[0];
  check('ped down after 2 pistol hits', pedAfter.state === 'down',
    `ped0 state=${pedAfter.state}`);
  // Downed ped recovers after the 8 s down timer (gets up and flees).
  const recovered = await poll(async () => {
    const p = (await embers(page, 'npcs.pedestrians'))[0];
    return p.state !== 'down' ? p.state : null;
  }, 90000, 1000);
  check('downed ped recovers (gets up)', recovered !== null && recovered !== undefined,
    `recovered state=${recovered}`);

  // ---- 3. Melee punch ----
  await embers(page, 'combatSwitch(0)');
  await embers(page, 'debugPlacePed(1, 0, -2)');
  await sleep(600);
  await aimAt(page, 0, -2);
  await embers(page, 'combatMelee()');
  await sleep(500);
  let ped1 = (await embers(page, 'npcs.pedestrians'))[1];
  check('punch makes ped flee', ped1.state === 'flee', `ped1 state=${ped1.state}`);
  // Two more punches (3 total, 1 dmg each, HP 3) must down the ped.
  // Re-place the ped before each punch: a hit makes it flee, so without
  // re-placing the later punches would swing at empty air.
  for (let i = 0; i < 3; i++) {
    await embers(page, 'debugPlacePed(1, 0, -2)');
    await sleep(400);
    await aimAt(page, 0, -2);
    await embers(page, 'combatMelee()');
    await waitGame(page, 0.8);
  }
  ped1 = (await embers(page, 'npcs.pedestrians'))[1];
  check('3 punches down the ped', ped1.state === 'down', `ped1 state=${ped1.state}`);

  // ---- 4. Reload ----
  await embers(page, 'combatSwitch(1)');
  await embers(page, 'debugSetAmmo(0, 48)');
  await sleep(300);
  let cr = await embers(page, 'combat');
  check('ammo set to 0 / 48', cr.ammo === '0 / 48', `ammo=${cr.ammo}`);
  await embers(page, 'combatReload()');
  await sleep(300);
  cr = await embers(page, 'combat');
  check('reload shows Reloading…', cr.ammo === 'Reloading…', `ammo=${cr.ammo}`);
  await waitGame(page, 1.5);
  cr = await embers(page, 'combat');
  check('reload completes: mag 12 / 36', cr.ammo === '12 / 36', `ammo=${cr.ammo}`);

  // ---- 5. Police escalation from witnessed combat ----
  await embers(page, 'debugResetNpcs()');
  await embers(page, 'teleport(0, 0)');
  await sleep(500);
  // Place a foot officer 10 m away with a clear line of sight.
  await embers(page, 'debugPlacePolice(0, 8, -6)');
  await sleep(600);
  const los = await embers(page, 'debugLOS(8, -6, 0, 0)');
  check('officer has line of sight to player', los === true, `los=${los}`);
  // Fire into empty air: weaponFire crime, witnessed by the officer.
  await aimAt(page, 0, -40);
  await embers(page, 'combatFire()');
  await sleep(1500);
  const wanted = await embers(page, 'npcs.wanted');
  check('witnessed shot raises wanted to level 1', wanted.level >= 1,
    `level=${wanted.level} heat=${wanted.heat.toFixed(1)}`);
  await embers(page, 'debugResetNpcs()');

  // ---- 6. Mission UI + M1 -> M2 ----
  const m0 = await embers(page, 'mission');
  check('M1 title: Go to Melati Park', /Go to Melati Park/.test(m0.text.title),
    `title=${m0.text.title}`);
  check('M1 progress: Mission 1/5', m0.text.progress === 'Mission 1/5',
    `progress=${m0.text.progress}`);
  const money0 = (await embers(page, 'combat')).money;
  await embers(page, 'teleport(-140, 37)');
  const m1ok = await poll(async () => (await embers(page, 'mission')).index === 1, 30000, 500);
  check('M1 completes on arrival -> M2 starts', m1ok,
    `mission index=${(await embers(page, 'mission')).index}`);
  const m1 = await embers(page, 'mission');
  check('M2 title: The Delivery', /The Delivery/.test(m1.text.title), `title=${m1.text.title}`);
  const money1 = (await embers(page, 'combat')).money;
  check('M1 reward +$100', money1 === money0 + 100, `money ${money0} -> ${money1}`);
  // M2 timer counts down.
  const t1 = (await embers(page, 'mission')).timer;
  await waitGame(page, 3);
  const t2 = (await embers(page, 'mission')).timer;
  check('M2 timer counts down', t2 < t1 && t2 > 0, `timer ${t1} -> ${t2}`);
  // Complete M2 by delivering to the pier.
  await embers(page, 'teleport(156, 0)');
  const m2ok = await poll(async () => (await embers(page, 'mission')).index === 2, 30000, 500);
  check('M2 completes on delivery -> M3 starts', m2ok,
    `mission index=${(await embers(page, 'mission')).index}`);

  // ---- 7. M3: find + drive the Ember Sports car ----
  const m3 = await embers(page, 'mission');
  check('M3 title: Lost Vehicle / Find the Ember Sports car',
    /Lost Vehicle/.test(m3.text.title) && /Find the Ember Sports car/.test(m3.text.title),
    `title=${m3.text.title}`);
  await embers(page, 'enterCar("sports")');
  await sleep(1000);
  const m3b = await embers(page, 'mission');
  check('M3 step 1 after entering sports car', m3b.step === 1 && /Drive to Ember Pier/.test(m3b.text.title),
    `step=${m3b.step} title=${m3b.text.title}`);
  // Drive the sports car to the pier (place it there while driving).
  await embers(page, 'placeCar("sports", 154, 0, 1.5708, 0)');
  const m3ok = await poll(async () => (await embers(page, 'mission')).index === 3, 30000, 500);
  check('M3 completes driving sports to pier -> M4 starts', m3ok,
    `mission index=${(await embers(page, 'mission')).index}`);
  await embers(page, 'exitCar()');

  // ---- 8. M4: raise wanted, then lose it ----
  const m4 = await embers(page, 'mission');
  check('M4 title: Police Pressure', /Police Pressure/.test(m4.text.title),
    `title=${m4.text.title}`);
  await embers(page, 'debugSetHeat(45)');
  await sleep(1500);
  const w4 = await embers(page, 'npcs.wanted');
  check('M4: wanted raised (level >= 2)', w4.level >= 2, `level=${w4.level}`);
  await embers(page, 'debugSetHeat(0)');
  const m4ok = await poll(async () => (await embers(page, 'mission')).index === 4, 30000, 500);
  check('M4 completes when wanted back to 0 -> M5 starts', m4ok,
    `mission index=${(await embers(page, 'mission')).index}`);

  // ---- 9. M5: four waypoints -> story complete ----
  const m5 = await embers(page, 'mission');
  check('M5 title: Final Connection', /Final Connection/.test(m5.text.title),
    `title=${m5.text.title}`);
  const stops = [[0, 0], [168, 0], [-155, -10], [132, 45]];
  let m5ok = true;
  for (let i = 0; i < stops.length; i++) {
    await embers(page, `teleport(${stops[i][0]}, ${stops[i][1]})`);
    const stepOk = await poll(async () => {
      const m = await embers(page, 'mission');
      return (m.step === i + 1 || m.done) ? true : null;
    }, 30000, 500);
    if (!stepOk) { m5ok = false; break; }
  }
  const m5end = await embers(page, 'mission');
  check('M5 all 4 stops -> story complete', m5ok && m5end.done === true,
    `done=${m5end.done} title=${m5end.text.title}`);
  const moneyEnd = (await embers(page, 'combat')).money;
  check('total mission rewards $1350', moneyEnd === 1350, `money=$${moneyEnd}`);

  // ---- 10. Save / load / refresh survival ----
  await embers(page, 'debugSetMission(2)');
  await embers(page, 'teleport(30, 10)');
  await sleep(500);
  const saved = await embers(page, 'saveGame()');
  const hasKey = await page.evaluate(() => !!localStorage.getItem('city-of-embers-save-v1'));
  check('saveGame writes localStorage', saved === true && hasKey, `saved=${saved} key=${hasKey}`);
  // Reload and continue.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await poll(async () => (await embers(page, 'frames')) > 5, 60000, 500);
  const contVisible = await page.evaluate(() => !document.getElementById('continue-btn').classList.contains('hidden'));
  check('CONTINUE button visible after reload with save', contVisible, `visible=${contVisible}`);
  await page.evaluate(() => document.getElementById('continue-btn').click());
  await sleep(1500);
  const mAfter = await embers(page, 'mission');
  const posAfter = await embers(page, 'playerPos');
  check('continue restores mission 2 + position', mAfter.index === 2 && Math.abs(posAfter.x - 30) < 1 && Math.abs(posAfter.z - 10) < 1,
    `mission=${mAfter.index} pos=(${posAfter.x.toFixed(1)},${posAfter.z.toFixed(1)})`);
  // Corrupt save: game must still load and hide CONTINUE.
  // (The URL keeps ?shot=play, so the game auto-starts — state is
  // 'playing', not 'menu'. That is the test URL, not a game bug.)
  await page.evaluate(() => localStorage.setItem('city-of-embers-save-v1', 'not json{{{'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await poll(async () => (await embers(page, 'frames')) > 5, 60000, 500);
  const contHidden = await page.evaluate(() => document.getElementById('continue-btn').classList.contains('hidden'));
  const stateOk = ['menu', 'playing'].includes(await embers(page, 'state'));
  check('corrupt save: game loads, CONTINUE hidden', contHidden && stateOk,
    `hidden=${contHidden} state=${await embers(page, 'state')}`);
  await page.evaluate(() => localStorage.removeItem('city-of-embers-save-v1'));
  await page.evaluate(() => document.getElementById('start-btn').click());
  await sleep(1500);

  // ---- 11. WASTED + respawn ----
  const moneyBefore = (await embers(page, 'combat')).money;
  await embers(page, 'combatDamage(200)');
  await sleep(800);
  const wastedOn = await embers(page, 'wasted');
  const wastedVisible = await page.evaluate(() => !document.getElementById('wasted-screen').classList.contains('hidden'));
  check('WASTED screen shows on lethal damage', wastedOn === true && wastedVisible,
    `wasted=${wastedOn} visible=${wastedVisible}`);
  const respawned = await poll(async () => {
    const w = await embers(page, 'wasted');
    return w === false ? true : null;
  }, 60000, 500);
  check('respawn after WASTED timer', respawned === true, `respawned=${respawned}`);
  const posR = await embers(page, 'playerPos');
  const cR = await embers(page, 'combat');
  // Respawn puts the player at the safehouse centre; collision pushes
  // them a few metres clear of the building, so allow < 10 m (the
  // safehouse hiding zone is r=8).
  const nearSafe = (Math.hypot(posR.x + 155, posR.z + 10) < 10) || (Math.hypot(posR.x - 132, posR.z - 45) < 10);
  check('respawn at nearest safehouse, health 100, -$100', nearSafe && cR.health === 100 && cR.money === Math.max(0, moneyBefore - 100),
    `pos=(${posR.x.toFixed(1)},${posR.z.toFixed(1)}) health=${cR.health} money=$${cR.money} (was $${moneyBefore})`);

  // ---- 12. English-only visible text ----
  const allText = await page.evaluate(() => {
    const els = ['district-name', 'street-name', 'mission', 'mission-progress', 'weapon', 'ammo', 'hint', 'gps-name', 'toast', 'interact-prompt'];
    return els.map((id) => { const el = document.getElementById(id); return el ? el.textContent : ''; }).join(' | ');
  });
  const bad = scanIndonesian(allText);
  check('HUD visible text: no Indonesian words', bad.length === 0,
    bad.length ? `found: ${bad.join(', ')}` : 'clean');

  // ---- 13. No console errors (Session A) ----
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
  const fB0 = await embers(pageB, 'frames');
  const tB0 = Date.now();
  await sleep(5000);
  const fB1 = await embers(pageB, 'frames');
  const fpsB = (fB1 - fB0) / ((Date.now() - tB0) / 1000);
  const dcB = await embers(pageB, 'drawCalls');
  const triB = await embers(pageB, 'triangles');
  console.log(`SESSION B perf: FPS ${fpsB.toFixed(1)} (wall-clock, 1280x720 full) — ${dcB} draw calls, ${triB} triangles`);

  // (1) Combat: pistol equipped, aiming at a pedestrian, firing.
  await embers(pageB, 'combatSwitch(1)');
  await embers(pageB, 'teleport(0, 0)');
  await embers(pageB, 'debugPlacePed(0, 0, -8)');
  await sleep(1000);
  await aimAt(pageB, 0, -8);
  await embers(pageB, 'combatFire()');
  await sleep(600);
  await snap(pageB, 'p5-01-combat.jpg');

  // (2) NPC down: two shots, ped lying on the road.
  await waitGame(pageB, 0.5);
  await embers(pageB, 'combatFire()');
  await sleep(800);
  const pedB = (await embers(pageB, 'npcs.pedestrians'))[0];
  console.log(`p5-02: ped0 state=${pedB.state} at (${pedB.x.toFixed(1)},${pedB.z.toFixed(1)})`);
  await snap(pageB, 'p5-02-npc-down.jpg');

  // (3) Police response: witnessed crime -> pursuit, wanted HUD.
  await embers(pageB, 'debugResetNpcs()');
  await embers(pageB, 'debugPlacePolice(0, 6, -8)');
  await sleep(800);
  await aimAt(pageB, 0, -40);
  await embers(pageB, 'combatFire()');
  await sleep(2500);
  const wB = await embers(pageB, 'npcs.wanted');
  console.log(`p5-03: wanted level=${wB.level} status=${wB.status}`);
  await snap(pageB, 'p5-03-police-response.jpg');

  // (4) Mission brief: M1 HUD (title + objective + progress).
  await embers(pageB, 'debugResetNpcs()');
  await embers(pageB, 'debugSetMission(0)');
  await embers(pageB, 'teleport(0, 0)');
  await sleep(1200);
  const yaw4 = yawTo(0, 0, -20, -30);
  await embers(pageB, `setCamYaw(${yaw4})`);
  await sleep(800);
  await snap(pageB, 'p5-04-mission-brief.jpg');

  // (5) Mission complete: finish M1, toast + M2 visible.
  await embers(pageB, 'teleport(-140, 37)');
  await sleep(2000);
  const mB = await embers(pageB, 'mission');
  console.log(`p5-05: mission index=${mB.index} title=${mB.text.title}`);
  await snap(pageB, 'p5-05-mission-complete.jpg');

  // (6) WASTED screen.
  await embers(pageB, 'combatDamage(200)');
  await sleep(1000);
  await snap(pageB, 'p5-06-wasted.jpg');

  // (7) Save: pause menu with the SAVE button (after respawn).
  await poll(async () => (await embers(pageB, 'wasted')) === false, 120000, 1000);
  await pageB.keyboard.press('Escape');
  await sleep(800);
  await pageB.evaluate(() => document.getElementById('save-btn').click());
  await sleep(600);
  const saveOk = await pageB.evaluate(() => !!localStorage.getItem('city-of-embers-save-v1'));
  console.log(`p5-07: save written=${saveOk}`);
  await snap(pageB, 'p5-07-save.jpg');

  const realB = realErrors(errorsB);
  check('no real console/page errors (Session B)', realB.length === 0,
    realB.length ? realB.slice(0, 3).join(' ;; ') : 'clean');
  await pageB.close();
  await browser.close();
  server.kill();

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  console.log(`\nPHASE 5: ${passed}/${results.length} checks passed`);
  if (failed.length) {
    console.log('FAILED:');
    for (const f of failed) console.log(` - ${f.name} — ${f.detail}`);
  }
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error('TEST CRASH:', e);
  process.exit(2);
});

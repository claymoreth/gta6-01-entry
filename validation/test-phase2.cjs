// CITY OF EMBERS — Phase 2 acceptance test (original, in-session).
// Serves game/ over HTTP (never file://), drives it with Playwright.
//
// Two sessions:
//  A. LOGIC — 640x360 + ?lowfx=1 so headless SwiftShader runs fast
//     enough: district detection, walking across district boundaries,
//     minimap-click waypoint, GPS distance shrinking, waypoint arrival
//     advancing the mission, minimap player position, HUD readability.
//  B. VISUALS — 1280x720 full quality: ?shot=district screenshot of the
//     waterfront + HUD + minimap + waypoint, honest wall-clock FPS.
//
// Run from the repo root:  node validation/test-phase2.cjs
// Requires playwright-core at ~/workspace/tools/pw/node_modules/.

const { spawn } = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('/home/hatch/workspace/tools/pw/node_modules/playwright-core');

const REPO = path.resolve(__dirname, '..');
const PORT = 8912;
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
  check('Start screen visible on load', await page.evaluate(() => !document.getElementById('start-screen').classList.contains('hidden')));
  await page.click('#start-btn');
  await sleep(800);
  check('Start Game button starts play', (await page.evaluate(() => window.__embers.state)) === 'playing');

  const districtAt = (x, z) => page.evaluate(([x, z]) => {
    window.__embers.teleport(x, z);
    return window.__embers.district.district;
  }, [x, z]);
  const dDowntown = await districtAt(0, 14);
  check('Downtown district detected', /DOWNTOWN/.test(dDowntown), dDowntown);
  const dRes = await districtAt(-100, 0);
  check('Residential district detected', /RESIDENTIAL/.test(dRes), dRes);
  const dWater = await districtAt(100, 0);
  check('Waterfront district detected', /WATERFRONT/.test(dWater), dWater);
  const dPark = await districtAt(-140, 37);
  check('Melati Park district detected', /Melati Park/.test(dPark), dPark);
  const dPier = await districtAt(160, 0);
  check('Ember Pier district detected', /Ember Pier/.test(dPier), dPier);

  // Walk across the west boundary: teleport just inside downtown (x=-58),
  // hold A (west in camera space at yaw 0) until x < -60 and the district
  // flips to RESIDENTIAL. Proves the EW road is connected, no wall.
  await page.evaluate(() => window.__embers.teleport(-58, 0));
  await sleep(300);
  await page.keyboard.down('KeyA');
  const crossedW = await poll(async () => {
    const p = await page.evaluate(() => ({ ...window.__embers.playerPos }));
    const d = await page.evaluate(() => window.__embers.district.district);
    return (p.x < -61 && /RESIDENTIAL/.test(d)) ? { p, d } : null;
  }, 30000);
  await page.keyboard.up('KeyA');
  check('Player walks west across into Residential', !!crossedW,
    crossedW ? `pos (${crossedW.p.x.toFixed(1)}, ${crossedW.p.z.toFixed(1)}) — ${crossedW.d}` : 'did not cross in 30s');

  // Walk across the east boundary: teleport just inside downtown (x=58),
  // hold D (east) until x > 60 and the district flips to WATERFRONT.
  await page.evaluate(() => window.__embers.teleport(58, 0));
  await sleep(300);
  await page.keyboard.down('KeyD');
  const crossedE = await poll(async () => {
    const p = await page.evaluate(() => ({ ...window.__embers.playerPos }));
    const d = await page.evaluate(() => window.__embers.district.district);
    return (p.x > 61 && /WATERFRONT/.test(d)) ? { p, d } : null;
  }, 30000);
  await page.keyboard.up('KeyD');
  check('Player walks east across into Waterfront', !!crossedE,
    crossedE ? `pos (${crossedE.p.x.toFixed(1)}, ${crossedE.p.z.toFixed(1)}) — ${crossedE.d}` : 'did not cross in 30s');

  // GPS: click the minimap at the world point (100, -20) and verify a
  // waypoint appears there.
  const mm = await page.evaluate(() => {
    const r = document.getElementById('minimap').getBoundingClientRect();
    const px = window.__embers.minimapPixel(100, -20);
    return { rect: { left: r.left, top: r.top, width: r.width, height: r.height }, px };
  });
  await page.mouse.click(mm.rect.left + (mm.px.x / 180) * mm.rect.width, mm.rect.top + (mm.px.y / 180) * mm.rect.height);
  await sleep(500);
  const wp = await page.evaluate(() => window.__embers.waypoint);
  check('GPS waypoint set by minimap click', !!wp && Math.abs(wp.x - 100) < 6 && Math.abs(wp.z + 20) < 6,
    wp ? `waypoint (${wp.x.toFixed(1)}, ${wp.z.toFixed(1)}) "${wp.name}"` : 'no waypoint');
  const dist0 = await page.evaluate(() => window.__embers.waypointDistance);
  check('GPS distance readout is positive', dist0 > 10, `${dist0.toFixed(1)} m`);

  // Walk toward the waypoint and verify the distance shrinks.
  // Face the waypoint: camera yaw so that W walks toward it. The waypoint
  // is NE of the player (player near x=58..61, z=0; waypoint at 100,-20).
  // Use the debug teleport to stand at (80, 0), face north-east by setting
  // the camera via a drag is unreliable; instead walk north (W) then east
  // (D) in turn and check the distance drops overall.
  await page.evaluate(() => window.__embers.teleport(80, 0));
  await sleep(300);
  const dBefore = await page.evaluate(() => window.__embers.waypointDistance);
  await page.keyboard.down('KeyD');
  await sleep(10000); // SwiftShader is slow (~2 FPS): 10s wall ≈ 1s game-time ≈ 4m
  await page.keyboard.up('KeyD');
  const dAfter = await page.evaluate(() => window.__embers.waypointDistance);
  check('GPS distance shrinks as the player approaches', dAfter < dBefore - 2,
    `${dBefore.toFixed(1)} m -> ${dAfter.toFixed(1)} m`);

  // Arrival: teleport within the arrival radius and verify the waypoint
  // clears (custom waypoint) and the mission waypoint resumes.
  const wpNow = await page.evaluate(() => window.__embers.waypoint);
  await page.evaluate(([x, z]) => window.__embers.teleport(x, z), [wpNow.x - 2, wpNow.z]);
  await sleep(1200);
  const wpAfter = await page.evaluate(() => window.__embers.waypoint);
  const missionAfter = await page.evaluate(() => window.__embers.mission);
  check('Waypoint arrival clears the custom waypoint', !!wpAfter && wpAfter.custom === false,
    wpAfter ? `now "${wpAfter.name}" custom=${wpAfter.custom}` : 'no waypoint');
  check('Mission waypoint resumes after custom arrival', !!wpAfter && /Melati Park|Ember Lighthouse|Merdeka Plaza/.test(wpAfter.name),
    wpAfter ? `"${wpAfter.name}"` : 'none');

  // Mission arrival: teleport onto the mission waypoint (Melati Park)
  // and verify the mission index advances.
  const m0 = await page.evaluate(() => window.__embers.mission.index);
  const missionWp = await page.evaluate(() => window.__embers.waypoint);
  await page.evaluate(([x, z]) => window.__embers.teleport(x, z), [missionWp.x, missionWp.z]);
  await sleep(1200);
  const m1 = await page.evaluate(() => window.__embers.mission.index);
  check('Mission objective advances on arrival', m1 === m0 + 1, `index ${m0} -> ${m1}`);

  // Minimap shows the player: read the canvas pixel at the player's map
  // position — it must be the yellow player arrow, not the background.
  const pix = await page.evaluate(() => {
    const p = window.__embers.playerPos;
    const m = window.__embers.minimapPixel(p.x, p.z);
    const c = document.getElementById('minimap');
    const g = c.getContext('2d');
    const d = g.getImageData(Math.round(m.x), Math.round(m.y), 1, 1).data;
    return { r: d[0], g: d[1], b: d[2], a: d[3] };
  });
  check('Minimap shows the player position', pix.r > 180 && pix.g > 150 && pix.b < 120,
    `pixel rgba(${pix.r},${pix.g},${pix.b},${pix.a})`);

  // HUD readability: all key elements exist and carry text.
  const hudText = await page.evaluate(() => {
    const t = (id) => document.getElementById(id)?.textContent?.trim() ?? '';
    return {
      district: t('district-name'), street: t('street-name'), mission: t('mission'),
      progress: t('mission-progress'), health: t('health-num'), armour: t('armour-num'),
      money: t('money'), weapon: t('weapon'), ammo: t('ammo'), wanted: t('wanted'),
      gpsVisible: !document.getElementById('gps').classList.contains('hidden'),
    };
  });
  check('HUD shows district + street', hudText.district.length > 3 && hudText.street.length > 2,
    `${hudText.district} / ${hudText.street}`);
  check('HUD shows mission + progress', hudText.mission.length > 5 && /Mission \d\/5/.test(hudText.progress),
    `${hudText.mission} (${hudText.progress})`);
  check('HUD shows health + armour numbers', hudText.health === '100' && hudText.armour === '50',
    `health ${hudText.health}, armour ${hudText.armour}`);
  check('HUD shows money + weapon + ammo + wanted', /^\$\d+$/.test(hudText.money) && hudText.weapon.length > 3 && hudText.wanted.includes('WANTED'),
    `${hudText.money} / ${hudText.weapon} / ${hudText.ammo} / ${hudText.wanted}`);
  check('GPS readout visible while a waypoint is active', hudText.gpsVisible, 'gps element shown');

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
  await page2.goto(BASE + '?shot=district', { waitUntil: 'domcontentloaded' });
  await sleep(7000); // let the night scene settle (shadows, lights)
  const state2 = await page2.evaluate(() => window.__embers.state);
  check('District shot session auto-starts', state2 === 'playing', `state=${state2}`);
  const wp2 = await page2.evaluate(() => window.__embers.waypoint);
  check('District shot has a waypoint on the lighthouse', !!wp2 && Math.abs(wp2.x - 168) < 3,
    wp2 ? `waypoint (${wp2.x.toFixed(1)}, ${wp2.z.toFixed(1)}) "${wp2.name}"` : 'no waypoint');
  await page2.screenshot({ path: path.join(REPO, 'screenshots', '03-districts-gps.jpg'), type: 'jpeg', quality: 82 });
  const f0 = await page2.evaluate(() => window.__embers.frames);
  await sleep(5000);
  const f1 = await page2.evaluate(() => window.__embers.frames);
  const wallFps = (f1 - f0) / 5;
  const hudFps = await page2.evaluate(() => window.__embers.fps);
  const dc2 = await page2.evaluate(() => window.__embers.drawCalls);
  const tr2 = await page2.evaluate(() => window.__embers.triangles);
  console.log(`INFO  wall FPS @1280x720 full quality (headless SwiftShader) = ${wallFps.toFixed(1)}; HUD meter = ${hudFps.toFixed(1)}; draw calls=${dc2} triangles=${tr2}`);
  check('No page errors in visual session', page2Errors.length === 0, page2Errors.join(' | ') || '0 errors');
  const sz = fs.statSync(path.join(REPO, 'screenshots', '03-districts-gps.jpg')).size;
  check('Screenshot 03-districts-gps.jpg <= 256 KiB', sz <= 262144, `${(sz / 1024).toFixed(1)} KiB`);
  await page2.close();
  await browser.close();
  server.kill();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n==== PHASE 2 TESTS: ${results.length - failed.length}/${results.length} passed ====`);
  if (failed.length) { console.log('FAILED: ' + failed.map((f) => f.name).join(', ')); process.exitCode = 1; }
})().catch((e) => { console.error('TEST RUNNER CRASH:', e); process.exit(1); });

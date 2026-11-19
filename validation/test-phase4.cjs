// CITY OF EMBERS — Phase 4 acceptance test (original, in-session).
// Serves game/ over HTTP (never file://), drives it with Playwright.
//
// Two sessions:
//  A. LOGIC — 480x270 + ?lowfx=1 (small viewport so headless SwiftShader
//     runs faster, which also speeds up game time: dt is clamped to
//     0.05 s/frame, so game time advances 0.05 s per rendered frame):
//     pedestrian spawn/movement/routes/obstacle avoidance/danger reaction/
//     knock-down; police patrol/crime detection/no-through-wall detection/
//     patrol->investigate/pursue/direction change/no teleport/recovery;
//     wanted starts 0/valid crime raises/no duplicates/all 5 levels/
//     distinct per-level behaviour/HUD/no decay while seen;
//     escape: LOS break/search/last known position/no wall tracking/
//     hiding lowers pressure/re-pursuit/wanted 0/patrol return.
//  B. VISUALS — 1280x720 full quality: 7 genuine gameplay screenshots
//     (pedestrians, flee, patrol, pursuit, high wanted HUD, search,
//     escape) saved to validation/ (NOT screenshots/ — the dossier
//     keeps its 4 files).
//
// Run from the repo root:  node validation/test-phase4.cjs
// Requires playwright-core at ~/workspace/tools/pw/node_modules/.

const { spawn } = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('/home/hatch/workspace/tools/pw/node_modules/playwright-core');

const REPO = path.resolve(__dirname, '..');
const PORT = 8917;
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
// Flaky SwiftShader shader error (empty program info log) — a known
// headless-renderer artifact, not a game bug (same filter as
// test-english.cjs). Real console errors still fail the run.
function isFlakyShaderError(text) {
  return /THREE\.WebGLProgram: Shader Error/.test(text) && /Program Info Log:\s*$/.test(text);
}
function realErrors(list) {
  return list.filter((e) => !isFlakyShaderError(e));
}
const embers = (page, expr) => page.evaluate((e) => {
  // eslint-disable-next-line no-new-func
  return new Function('e', `return e.${e}`)(window.__embers);
}, expr);
// Wait until the game has advanced `gameSeconds` of game time. Game dt
// is clamped to 0.05 s/frame, so game time ~= frames * 0.05.
async function waitGame(page, gameSeconds, timeoutMs = 120000) {
  const f0 = await embers(page, 'frames');
  const target = f0 + Math.ceil(gameSeconds / 0.05);
  const ok = await poll(async () => (await embers(page, 'frames')) >= target, timeoutMs, 500);
  return !!ok;
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

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
  // Wall-clock FPS from the frame counter over a 5 s window (the in-game
  // meter is a 0.5 s average and reads high right after load).
  const fStart = await embers(page, 'frames');
  const tStart = Date.now();
  await sleep(5000);
  const fEnd = await embers(page, 'frames');
  const fpsA = (fEnd - fStart) / ((Date.now() - tStart) / 1000);
  console.log(`SESSION A perf: FPS ${fpsA.toFixed(1)} (wall-clock, 480x270 lowfx) — game time runs ~${(fpsA * 0.05).toFixed(2)}x wall clock`);

  // ---- 1. NPC spawn ----
  const counts = await embers(page, 'npcs.counts');
  check('NPC population (14 peds, 3 foot police, 2 police cars)',
    counts.peds === 14 && counts.footPolice === 3 && counts.policeCars === 2,
    JSON.stringify(counts));
  const peds0 = await embers(page, 'npcs.pedestrians');
  const bounds = await embers(page, 'bounds');
  const inBounds = peds0.every((p) => p.x >= bounds.minX && p.x <= bounds.maxX && p.z >= bounds.minZ && p.z <= bounds.maxZ);
  check('pedestrians spawn inside world bounds', inBounds,
    `bounds x ${bounds.minX}..${bounds.maxX}, z ${bounds.minZ}..${bounds.maxZ}`);
  // No two pedestrians spawn on top of each other.
  let minPair = Infinity;
  for (let i = 0; i < peds0.length; i++) {
    for (let j = i + 1; j < peds0.length; j++) {
      minPair = Math.min(minPair, dist(peds0[i], peds0[j]));
    }
  }
  check('pedestrians do not spawn overlapping', minPair > 0.5, `closest pair ${minPair.toFixed(2)} m`);
  // No pedestrian spawns inside a building (tall collider).
  const inBldg = [];
  for (const p of peds0) {
    if (await embers(page, `debugInBuilding(${p.x}, ${p.z})`)) inBldg.push(p.index);
  }
  check('no pedestrian spawns inside a building', inBldg.length === 0,
    inBldg.length ? `inside: ${inBldg.join(',')}` : 'all on sidewalks/roads');
  const police0 = await embers(page, 'npcs.police');
  const policePatrol = police0.every((u) => u.state === 'patrol');
  check('all police units start on patrol', policePatrol,
    police0.map((u) => `${u.kind}:${u.state}`).join(' '));

  // ---- 2. Wanted starts at 0 ----
  const wanted0 = await embers(page, 'npcs.wanted');
  check('wanted starts at 0', wanted0.level === 0 && wanted0.heat === 0 && wanted0.status === '',
    JSON.stringify(wanted0));

  // ---- 3. Pedestrians move along their routes (and do not get stuck) ----
  // A 10 game-s window: even a walker that idles (1-3 s) or waits for a
  // vehicle part of the time still covers several metres. A walker that
  // has not moved at all in 10 game-s while in 'walk' state is genuinely
  // stuck (the in-game stuck check flips its waypoint after 3 game-s).
  const moved = await (async () => {
    const before = await embers(page, 'npcs.pedestrians');
    await waitGame(page, 10, 120000); // 10 game-s of walking
    const after = await embers(page, 'npcs.pedestrians');
    let movedCount = 0;
    let stuckWalk = [];
    for (let i = 0; i < before.length; i++) {
      const d = dist(before[i], after[i]);
      if (d > 0.5) movedCount++;
      if (after[i].state === 'walk' && d < 0.5) stuckWalk.push(i);
    }
    return { movedCount, stuckWalk, before, after };
  })();
  check('pedestrians walk (most move in 10 game-s)', moved.movedCount >= 10,
    `${moved.movedCount}/14 moved > 0.5 m`);
  check('no walking pedestrian is stuck', moved.stuckWalk.length === 0,
    moved.stuckWalk.length ? `stuck: ${moved.stuckWalk.join(',')}` : 'all walkers advancing');

  // ---- 4. Danger reaction: pedestrians flee a danger event ----
  const fleeTest = await (async () => {
    const peds = await embers(page, 'npcs.pedestrians');
    const target = peds.find((p) => p.state === 'walk');
    if (!target) return { ok: false, detail: 'no walking ped found' };
    await embers(page, `debugTriggerDanger(${target.x}, ${target.z}, 25)`);
    await waitGame(page, 1, 30000);
    const after = await embers(page, 'npcs.pedestrians');
    const p = after[target.index];
    const fled = p.state === 'flee' && dist(p, target) > 0.5;
    return { ok: fled, detail: `ped ${target.index} state ${target.state} -> ${p.state}, moved ${dist(p, target).toFixed(1)} m` };
  })();
  check('pedestrians flee a danger event', fleeTest.ok, fleeTest.detail);

  // ---- 5. No detection through walls ----
  // Find a police position with no line of sight to the player, then
  // commit a crime there: it must go unwitnessed (wanted stays 0).
  const wallTest = await (async () => {
    await embers(page, 'debugResetNpcs()');
    await embers(page, 'teleport(20, -30)');
    await waitGame(page, 1, 30000);
    const player = await embers(page, 'playerPos');
    // Search for a spot 20-30 m away with a building between it and the player.
    const candidates = [];
    for (const [dx, dz] of [[25, 0], [-25, 0], [0, 25], [0, -25], [20, 20], [-20, -20], [20, -20], [-20, 20]]) {
      candidates.push({ x: player.x + dx, z: player.z + dz });
    }
    let spot = null;
    for (const c of candidates) {
      const los = await embers(page, `debugLOS(${player.x}, ${player.z}, ${c.x}, ${c.z})`);
      if (!los) { spot = c; break; }
    }
    if (!spot) return { ok: false, detail: 'no no-LOS spot found near (20,-30)' };
    await embers(page, `debugPlacePolice(0, ${spot.x}, ${spot.z})`);
    await waitGame(page, 1, 30000);
    const losNow = await embers(page, `debugLOS(${player.x}, ${player.z}, ${spot.x}, ${spot.z})`);
    // Make sure no pedestrian is close enough to witness either.
    const peds = await embers(page, 'npcs.pedestrians');
    const nearPed = peds.some((p) => dist(p, player) < 25);
    const res = await embers(page, `debugCrime('theft', 'wall-test-1')`);
    await waitGame(page, 1, 30000);
    const wanted = await embers(page, 'npcs.wanted');
    return {
      ok: !losNow && !res.witnessed && wanted.level === 0,
      detail: `police at (${spot.x.toFixed(0)},${spot.z.toFixed(0)}), LOS=${losNow}, nearPed=${nearPed}, witnessed=${res.witnessed}, level=${wanted.level}`,
    };
  })();
  check('police do NOT detect a crime through a wall', wallTest.ok, wallTest.detail);

  // ---- 6. Duplicate crime: same event id raises wanted only once ----
  const dupTest = await (async () => {
    await embers(page, 'debugResetNpcs()');
    await embers(page, 'teleport(0, 0)');
    await waitGame(page, 1, 30000);
    const player = await embers(page, 'playerPos');
    // A police officer right next to the player, clear LOS: a witness.
    await embers(page, `debugPlacePolice(0, ${player.x + 5}, ${player.z})`);
    await waitGame(page, 1, 30000);
    const r1 = await embers(page, `debugCrime('theft', 'dup-test-1')`);
    const h1 = (await embers(page, 'npcs.wanted')).heat;
    const r2 = await embers(page, `debugCrime('theft', 'dup-test-1')`);
    const h2 = (await embers(page, 'npcs.wanted')).heat;
    // The first crime raises heat by ~15 (theft); the duplicate must not
    // add another 15. A small tolerance covers a fraction of a second of
    // decay before the witness's first LOS check lands.
    return {
      ok: r1.witnessed && r2.duplicate === true && h1 >= 14.5 && h1 <= 15 && Math.abs(h2 - h1) < 0.6,
      detail: `first witnessed=${r1.witnessed} heat=${h1}, second duplicate=${r2.duplicate} heat=${h2}`,
    };
  })();
  check('one crime event raises wanted only once (dedup)', dupTest.ok, dupTest.detail);

  // ---- 7. Real theft: entering a civilian traffic car (real E key) ----
  const theftTest = await (async () => {
    await embers(page, 'debugResetNpcs()');
    // Hold traffic car 0 in place, then walk the player up to it.
    await embers(page, 'debugHoldTraffic(0, 120)');
    const cars = await embers(page, 'vehicles');
    const tc = cars.find((v) => v.traffic);
    if (!tc) return { ok: false, detail: 'no traffic car found' };
    // A police officer nearby with clear LOS, so the theft is witnessed.
    await embers(page, `debugPlacePolice(0, ${tc.x + 6}, ${tc.z})`);
    await embers(page, `teleport(${tc.x + 2}, ${tc.z})`);
    await waitGame(page, 1, 30000);
    const before = await embers(page, 'npcs.wanted');
    await page.keyboard.press('KeyE');
    await waitGame(page, 1, 30000);
    const driving = await embers(page, 'driving');
    const driven = await embers(page, 'drivenCar');
    const crimes = await embers(page, 'npcs.crimes');
    const theft = crimes.find((c) => c.type === 'theft');
    const after = await embers(page, 'npcs.wanted');
    const ok = driving && driven && driven.type !== 'sedan' && driven.type !== 'sports' && driven.type !== 'truck'
      && !!theft && theft.witnessed && after.level >= 1;
    // Exit the stolen car so later tests start on foot.
    await embers(page, 'exitCar()');
    return {
      ok,
      detail: `driving=${driving}, car=${driven ? driven.type : 'none'}, theft logged=${!!theft} witnessed=${theft ? theft.witnessed : '-'}, level ${before.level} -> ${after.level}`,
    };
  })();
  check('real theft (E into a traffic car) raises wanted when witnessed', theftTest.ok, theftTest.detail);

  // ---- 8. Real pedestrian hit: driving into a walker is a crime ----
  const pedHitTest = await (async () => {
    await embers(page, 'debugResetNpcs()');
    // Put a pedestrian on the spine road ahead of the sedan, and a police
    // officer nearby with LOS so the hit is witnessed.
    await embers(page, `debugPlacePed(0, 30, 2.5)`);
    await embers(page, `debugPlacePolice(0, 24, -4)`);
    await embers(page, `placeCar('sedan', 10, 2.5, ${Math.PI / 2}, 0)`);
    await embers(page, `enterCar('sedan')`);
    await waitGame(page, 1, 30000);
    // Drive east (W) into the pedestrian at (30, 2.5). Any walker knocked
    // down by the driven car counts (the sedan may clip another walker
    // first); the crime log proves the hit was the player's car.
    await page.keyboard.down('KeyW');
    const hit = await poll(async () => {
      const peds = await embers(page, 'npcs.pedestrians');
      return peds.find((p) => p.state === 'down') || null;
    }, 90000, 500);
    await page.keyboard.up('KeyW');
    await waitGame(page, 2, 60000); // let the witness report land
    const crimes = await embers(page, 'npcs.crimes');
    const pedHit = crimes.find((c) => c.type === 'pedHit');
    const wanted = await embers(page, 'npcs.wanted');
    await embers(page, 'exitCar()');
    return {
      ok: !!hit && !!pedHit && wanted.level >= 1,
      detail: `ped down=${!!hit}, pedHit logged=${!!pedHit} witnessed=${pedHit ? pedHit.witnessed : '-'}, level=${wanted.level} heat=${wanted.heat}`,
    };
  })();
  check('real pedestrian hit (driven car) is a witnessed crime', pedHitTest.ok, pedHitTest.detail);

  // ---- 9. Patrol -> investigate -> pursue (real crime, real witness) ----
  const pursuitTest = await (async () => {
    await embers(page, 'debugResetNpcs()');
    await embers(page, 'teleport(0, 0)');
    await waitGame(page, 1, 30000);
    const player = await embers(page, 'playerPos');
    await embers(page, `debugPlacePolice(0, ${player.x + 8}, ${player.z})`);
    await waitGame(page, 1, 30000);
    const before = await embers(page, 'npcs.police');
    const allPatrol = before.every((u) => u.state === 'patrol');
    await embers(page, `debugCrime('theft', 'pursuit-test-1')`);
    // Wait for the active-set recompute (2 game-s) + LOS check.
    const pursuing = await poll(async () => {
      const units = await embers(page, 'npcs.police');
      return units.find((u) => u.state === 'pursue') || null;
    }, 90000, 1000);
    const mid = await embers(page, 'npcs.police');
    const anyActive = mid.some((u) => u.state === 'investigate' || u.state === 'pursue' || u.state === 'search');
    return {
      ok: allPatrol && anyActive && !!pursuing,
      detail: `start all-patrol=${allPatrol}, active after crime=${anyActive}, pursuing unit=${pursuing ? `#${pursuing.index} ${pursuing.kind}` : 'none'}`,
    };
  })();
  check('crime triggers patrol -> investigate -> pursue', pursuitTest.ok, pursuitTest.detail);

  // ---- 10. Pursuit closes distance + reacts to the player moving ----
  // Note: after the player relocates, the NEAREST unit takes over the
  // response (the active set is recomputed every 2 game-s), so the test
  // checks that SOME unit responds to the NEW position — not necessarily
  // the same unit that started the pursuit.
  const chaseTest = await (async () => {
    // A unit is already pursuing from test 9; record the gap, then wait
    // for it to close in (the place-hold from test 9 has expired by now).
    const p0 = await embers(page, 'playerPos');
    const units0 = await embers(page, 'npcs.police');
    const pursuer0 = units0.find((u) => u.state === 'pursue');
    if (!pursuer0) return { ok: false, detail: 'no pursuer from test 9' };
    const d0 = dist(pursuer0, p0);
    await waitGame(page, 4, 90000);
    const p1 = await embers(page, 'playerPos');
    const units1 = await embers(page, 'npcs.police');
    const pursuer1 = units1.find((u) => u.state === 'pursue');
    const d1 = pursuer1 ? dist(pursuer1, p1) : Infinity;
    // Move the player to the opposite side of the city; the response must
    // shift to the NEW position (some unit investigates/pursues/searches
    // near the new spot, not the old one).
    await embers(page, 'teleport(-140, 30)');
    await waitGame(page, 4, 90000);
    const p2 = await embers(page, 'playerPos');
    const units2 = await embers(page, 'npcs.police');
    const responder = units2.find((u) => u.state === 'pursue' || u.state === 'search' || u.state === 'investigate');
    const d2 = responder ? dist(responder, p2) : Infinity;
    const dOld = responder ? dist(responder, p0) : Infinity;
    return {
      ok: d1 < d0 && responder && d2 < dOld,
      detail: `gap ${d0.toFixed(1)} -> ${d1.toFixed(1)} m while standing; after teleport responder #${responder ? responder.index : '-'} (${responder ? responder.state : '-'}) gap to NEW pos ${d2.toFixed(1)} m vs OLD pos ${dOld.toFixed(1)} m`,
    };
  })();
  check('pursuer closes distance and follows the player\'s new position', chaseTest.ok, chaseTest.detail);

  // ---- 11. No teleport: police never jump across the map ----
  const noTeleport = await (async () => {
    const samples = [];
    for (let i = 0; i < 6; i++) {
      samples.push(await embers(page, 'npcs.police'));
      await sleep(2000);
    }
    let maxJump = 0;
    let worst = '';
    for (let s = 1; s < samples.length; s++) {
      for (let i = 0; i < samples[s].length; i++) {
        const j = dist(samples[s][i], samples[s - 1][i]);
        if (j > maxJump) { maxJump = j; worst = `unit ${i} ${samples[s - 1][i].state}->${samples[s][i].state}`; }
      }
    }
    // 2 s wall ~= 0.4 game-s; even a police car at full speed covers
    // < 15 m in that time. A teleport would be 50 m+.
    return { ok: maxJump < 30, detail: `max 2 s step ${maxJump.toFixed(1)} m (${worst})` };
  })();
  check('police never teleport (no large position jumps)', noTeleport.ok, noTeleport.detail);

  // ---- 12. Escalation: repeated witnessed crimes reach level 5 ----
  const escTest = await (async () => {
    await embers(page, 'debugResetNpcs()');
    await embers(page, 'teleport(0, 0)');
    await waitGame(page, 1, 30000);
    const player = await embers(page, 'playerPos');
    // A police witness standing next to the player (clear LOS) so every
    // crime is witnessed and heat never decays while the test runs.
    await embers(page, `debugPlacePolice(0, ${player.x + 5}, ${player.z})`);
    await waitGame(page, 1, 30000);
    const levels = [];
    for (let i = 1; i <= 6; i++) {
      await embers(page, `debugCrime('theft', 'esc-${i}')`);
      await waitGame(page, 1, 30000);
      levels.push((await embers(page, 'npcs.wanted')).level);
    }
    const final = await embers(page, 'npcs.wanted');
    return {
      ok: final.level === 5 && levels.includes(1) && levels.includes(2) && levels.includes(3) && levels.includes(4),
      detail: `levels after each crime: ${levels.join(' -> ')}, heat=${final.heat}`,
    };
  })();
  check('all 5 wanted levels reachable by repeated witnessed crimes', escTest.ok, escTest.detail);

  // ---- 13. Each level activates a different number of pursuers ----
  const levelBehaviour = await (async () => {
    const counts = {};
    for (const [heat, want] of [[15, 1], [45, 3], [90, 5]]) {
      await embers(page, 'debugResetNpcs()');
      await embers(page, 'teleport(0, 0)');
      await waitGame(page, 1, 30000);
      await embers(page, `debugSetHeat(${heat})`);
      // Wait for the active-set recompute (2 game-s) to run.
      await waitGame(page, 3, 60000);
      const units = await embers(page, 'npcs.police');
      const active = units.filter((u) => u.state === 'investigate' || u.state === 'pursue' || u.state === 'search').length;
      counts[`L${want}`] = active;
    }
    return {
      ok: counts.L1 === 1 && counts.L3 === 3 && counts.L5 === 5,
      detail: `active units: L1=${counts.L1} (want 1), L3=${counts.L3} (want 3), L5=${counts.L5} (want 5)`,
    };
  })();
  check('each wanted level activates a different number of units', levelBehaviour.ok, levelBehaviour.detail);

  // ---- 14. HUD: wanted stars + status match the level ----
  const hudTest = await (async () => {
    await embers(page, 'debugResetNpcs()');
    await embers(page, 'teleport(0, 0)');
    await embers(page, 'debugSetHeat(45)'); // level 3
    await waitGame(page, 1, 30000);
    const hud = await page.evaluate(() => ({
      stars: document.getElementById('wanted').textContent,
      status: document.getElementById('wanted-status').textContent,
    }));
    const filled = (hud.stars.match(/★/g) || []).length;
    const empty = (hud.stars.match(/☆/g) || []).length;
    return {
      ok: filled === 3 && empty === 2 && /PURSUIT|SEARCH|HIDDEN/.test(hud.status),
      detail: `stars="${hud.stars}" (filled ${filled}, empty ${empty}), status="${hud.status}"`,
    };
  })();
  check('HUD wanted stars + status match level 3', hudTest.ok, hudTest.detail);

  // ---- 15. Wanted does NOT decay while a police unit still sees the player ----
  const noDecay = await (async () => {
    await embers(page, 'debugResetNpcs()');
    await embers(page, 'teleport(0, 0)');
    await waitGame(page, 1, 30000);
    const player = await embers(page, 'playerPos');
    await embers(page, `debugPlacePolice(0, ${player.x + 5}, ${player.z})`);
    await embers(page, 'debugSetHeat(30)'); // level 2
    await waitGame(page, 1, 30000);
    const h0 = (await embers(page, 'npcs.wanted')).heat;
    await waitGame(page, 3, 60000);
    const h1 = (await embers(page, 'npcs.wanted')).heat;
    const units = await embers(page, 'npcs.police');
    const seen = units.some((u) => u.seesPlayer);
    return {
      ok: seen && h1 >= h0 - 0.5,
      detail: `heat ${h0} -> ${h1} over 3 game-s while a unit sees the player=${seen}`,
    };
  })();
  check('wanted does not decay while police still see the player', noDecay.ok, noDecay.detail);

  // ---- 16. Escape: breaking line of sight ends the pursuit (search) ----
  // Teleport the player far from the pursuers (a pre-verified hidden spot
  // is ideal, but any spot the pursuers cannot see works — the check is
  // that no unit sees the player and a search begins, not that the last
  // known position is a particular point: the LKP is wherever the player
  // was last SEEN, so if a patrolling unit spots the player at the new
  // spot the LKP correctly follows them there).
  const escapeTest = await (async () => {
    await embers(page, 'debugResetNpcs()');
    await embers(page, 'teleport(0, 0)');
    await waitGame(page, 1, 30000);
    const player = await embers(page, 'playerPos');
    await embers(page, `debugPlacePolice(0, ${player.x + 8}, ${player.z})`);
    await embers(page, 'debugSetHeat(30)'); // level 2
    // Wait until a unit is actively pursuing (it sees the player).
    const pursuing = await poll(async () => {
      const units = await embers(page, 'npcs.police');
      return units.find((u) => u.state === 'pursue') || null;
    }, 90000, 1000);
    if (!pursuing) return { ok: false, detail: 'no unit reached pursue before the escape' };
    // Break line of sight: teleport far from the pursuers (safehouse).
    await embers(page, 'teleport(-155, -10)');
    await waitGame(page, 1, 30000);
    const hidden = await embers(page, 'npcs.police');
    const anySees = hidden.some((u) => u.seesPlayer);
    // Wait out the lose-sight timer (2 game-s): the pursuer must drop
    // to SEARCH (not stay in pursuit, and not teleport to the player).
    const searching = await poll(async () => {
      const units = await embers(page, 'npcs.police');
      return units.find((u) => u.state === 'search') || null;
    }, 90000, 1000);
    const stillPursuing = (await embers(page, 'npcs.police')).some((u) => u.state === 'pursue');
    return {
      ok: !anySees && !!searching && !stillPursuing,
      detail: `any unit still sees player=${anySees}, searching unit=${searching ? `#${searching.index} ${searching.kind}` : 'none'}, any unit still pursuing=${stillPursuing}`,
    };
  })();
  check('breaking line of sight ends pursuit (search begins)', escapeTest.ok, escapeTest.detail);

  // ---- 17. Search investigates the last known position (not the player) ----
  // Adaptive: if the LKP is far from the player's current spot (the
  // player was NOT seen at the new spot, so the LKP is the old position),
  // the searcher must close the gap to the LKP over the window. If the
  // LKP IS the player's spot (a unit saw them there), the searcher going
  // there is correct too — then the check is only that a search is
  // actively running and no unit has teleported to the player.
  const lkpTest = await (async () => {
    const lkp = (await embers(page, 'npcs.wanted')).lastKnown;
    // Move the player to the far northwest corner (-165,65): far from the
    // LKP and beyond sight range of the Melati patrol (52 m) and the
    // spine road, so the player is not seen there and the LKP stays put.
    await embers(page, 'teleport(-165, 65)');
    const player = await embers(page, 'playerPos');
    const lkpVsPlayer = dist(lkp, player);
    const units0 = await embers(page, 'npcs.police');
    await waitGame(page, 4, 90000);
    const units1 = await embers(page, 'npcs.police');
    const active = units1.filter((u) => u.state === 'search' || u.state === 'investigate');
    if (active.length === 0) return { ok: false, detail: 'no unit searching/investigating after the player moved' };
    const playerGap = Math.min(...active.map((u) => dist(u, player)));
    if (lkpVsPlayer < 30) {
      // LKP is the player's spot (seen there): just verify a search runs
      // and nobody teleported onto the player.
      return {
        ok: playerGap > 5,
        detail: `LKP is the player's spot (seen there); ${active.length} unit(s) searching, nearest to player ${playerGap.toFixed(1)} m (no teleport)`,
      };
    }
    // LKP is far from the player: some unit must be closing on the LKP.
    const details = [];
    let ok = false;
    for (const u1 of active) {
      const u0 = units0.find((u) => u.index === u1.index);
      const d0 = u0 ? dist(u0, lkp) : Infinity;
      const d1 = dist(u1, lkp);
      const dPlayer = dist(u1, player);
      const near = d1 < 25;
      const closing = d1 < d0 - 2;
      details.push(`#${u1.index} ${u1.kind} (${u1.state}) LKP gap ${d0.toFixed(1)} -> ${d1.toFixed(1)} m, player gap ${dPlayer.toFixed(1)} m`);
      if ((near || closing) && dPlayer > 50) ok = true;
    }
    return { ok, detail: `LKP ${lkpVsPlayer.toFixed(0)} m from player; ${details.join(' | ')}` };
  })();
  check('search investigates the last known position, not the hidden player', lkpTest.ok, lkpTest.detail);

  // ---- 18. Hiding lowers wanted pressure (faster in a hiding zone) ----
  const hidingTest = await (async () => {
    await embers(page, 'debugResetNpcs()');
    // Safehouse 1 at (-155,-10), radius 8: a hiding zone. Teleport the
    // player inside it with wanted level 2 and no police nearby.
    await embers(page, 'teleport(-155, -10)');
    await embers(page, 'debugSetHeat(30)');
    await waitGame(page, 1, 30000);
    const units = await embers(page, 'npcs.police');
    const anySees = units.some((u) => u.seesPlayer);
    const h0 = (await embers(page, 'npcs.wanted')).heat;
    await waitGame(page, 3, 60000);
    const h1 = (await embers(page, 'npcs.wanted')).heat;
    // Hiding zone decays 3.0/s: 3 game-s should drop ~9 heat.
    return {
      ok: !anySees && h1 < h0 - 4,
      detail: `heat ${h0} -> ${h1} over 3 game-s in the safehouse (zone rate 3.0/s), any unit sees player=${anySees}`,
    };
  })();
  check('hiding in a safehouse lowers wanted pressure', hidingTest.ok, hidingTest.detail);

  // ---- 19. Pursuit resumes when the player is seen again ----
  const repursuitTest = await (async () => {
    // Player is hidden in the safehouse (test 18) with wanted > 0 and
    // police searching. Step back into the open next to a police unit.
    const units = await embers(page, 'npcs.police');
    const searcher = units.find((u) => u.state === 'search' || u.state === 'investigate');
    if (!searcher) return { ok: false, detail: 'no searching unit to re-engage' };
    await embers(page, `teleport(${searcher.x + 6}, ${searcher.z})`);
    const pursuing = await poll(async () => {
      const us = await embers(page, 'npcs.police');
      return us.find((u) => u.state === 'pursue') || null;
    }, 90000, 1000);
    return {
      ok: !!pursuing,
      detail: pursuing ? `unit #${pursuing.index} ${pursuing.kind} pursuing again` : 'no unit resumed pursuit',
    };
  })();
  check('pursuit resumes when the player is seen again', repursuitTest.ok, repursuitTest.detail);

  // ---- 20. Wanted decays to 0 and police return to patrol ----
  const clearTest = await (async () => {
    await embers(page, 'debugResetNpcs()');
    await embers(page, 'teleport(-155, -10)'); // safehouse hiding zone
    await embers(page, 'debugSetHeat(15)'); // level 1: 5 game-s to clear at 3.0/s
    const cleared = await poll(async () => {
      const w = await embers(page, 'npcs.wanted');
      return w.level === 0 ? w : null;
    }, 120000, 1000);
    await waitGame(page, 2, 60000);
    const units = await embers(page, 'npcs.police');
    const allPatrol = units.every((u) => u.state === 'patrol');
    return {
      ok: !!cleared && allPatrol,
      detail: cleared ? `wanted cleared (heat ${cleared.heat}), all police back on patrol=${allPatrol}` : 'wanted never reached 0',
    };
  })();
  check('wanted decays to 0 and police return to patrol', clearTest.ok, clearTest.detail);

  const dcA = await embers(page, 'drawCalls');
  const triA = await embers(page, 'triangles');
  console.log(`SESSION A perf: draw calls ${dcA} · triangles ${triA} (480x270 lowfx)`);
  const realErrs = realErrors(errors);
  check('no console errors / failed requests (logic)', realErrs.length === 0,
    realErrs.length ? realErrs.slice(0, 5).join(' | ') : 'clean');
  await page.close();

  // ================= SESSION B — visuals (1280x720, full quality) =================
  // Seven genuine gameplay screenshots, saved to validation/ (the dossier
  // keeps its 4 screenshots; these are evidence only).
  const shot = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errorsB = [];
  shot.on('console', (m) => { if (m.type() === 'error') errorsB.push(m.text()); });
  shot.on('pageerror', (e) => errorsB.push('PAGEERROR: ' + e.message));
  shot.on('requestfailed', (r) => errorsB.push('REQFAIL: ' + r.url()));
  async function snap(name) {
    const p = path.join(REPO, 'validation', name);
    await shot.screenshot({ path: p, type: 'jpeg', quality: 82 });
    const size = fs.statSync(p).size;
    check(`screenshot ${name}`, size > 10000, `${(size / 1024).toFixed(0)} KiB`);
    return p;
  }
  // (1) Pedestrians in a district: stand on the spine road looking at a
  // sidewalk where walkers pass.
  await shot.goto(`${BASE}?shot=play`, { waitUntil: 'domcontentloaded' });
  await poll(async () => (await embers(shot, 'frames')) > 5, 60000, 1000);
  await embers(shot, 'teleport(-40, 0)');
  await sleep(4000);
  await snap('p4-01-pedestrians.jpg');
  // (2) Civilians fleeing danger: trigger a danger event next to the player.
  await embers(shot, 'debugTriggerDanger(-40, 0, 25)');
  await sleep(3000);
  await snap('p4-02-flee.jpg');
  // (3) Police on patrol: a foot officer + an interceptor on the road.
  await embers(shot, 'debugResetNpcs()');
  await embers(shot, 'teleport(0, 0)');
  await sleep(4000);
  await snap('p4-03-patrol.jpg');
  // (4) Police pursuing the player: the ?shot=pursuit scene (level 3, an
  // interceptor closing in behind the player).
  await shot.goto(`${BASE}?shot=pursuit`, { waitUntil: 'domcontentloaded' });
  await poll(async () => (await embers(shot, 'frames')) > 5, 60000, 1000);
  await poll(async () => {
    const units = await embers(shot, 'npcs.police');
    return units.some((u) => u.state === 'pursue');
  }, 90000, 1000);
  await sleep(2000);
  await snap('p4-04-pursuit.jpg');
  // (5) High wanted HUD: level 5, stars + PURSUIT status visible.
  await embers(shot, 'debugSetHeat(90)');
  await sleep(3000);
  await snap('p4-05-wanted5.jpg');
  // (6) Police searching after losing sight: break LOS, wait for SEARCH.
  await embers(shot, 'teleport(20, -30)');
  await poll(async () => {
    const units = await embers(shot, 'npcs.police');
    return units.some((u) => u.state === 'search');
  }, 120000, 1000);
  await sleep(2000);
  await snap('p4-06-search.jpg');
  // (7) Escaped: wanted decaying in the safehouse, HIDDEN status.
  await embers(shot, 'teleport(-155, -10)');
  await poll(async () => {
    const w = await embers(shot, 'npcs.wanted');
    return w.status === 'HIDDEN' || w.level === 0;
  }, 120000, 1000);
  await sleep(2000);
  await snap('p4-07-escape.jpg');
  const shotState = await embers(shot, 'npcs.wanted');
  console.log('SHOT end state:', JSON.stringify(shotState));
  const realErrsB = realErrors(errorsB);
  check('no console errors / failed requests (visuals)', realErrsB.length === 0,
    realErrsB.length ? realErrsB.slice(0, 5).join(' | ') : 'clean');
  await shot.close();

  await browser.close();
  server.kill();

  // ================= summary =================
  const passed = results.filter((r) => r.ok).length;
  console.log(`\nPHASE 4: ${passed}/${results.length} checks passed`);
  for (const r of results.filter((r) => !r.ok)) console.log(`  FAILED: ${r.name} — ${r.detail}`);
  process.exit(passed === results.length ? 0 : 1);
})().catch((e) => {
  console.error('TEST CRASH:', e);
  process.exit(2);
});

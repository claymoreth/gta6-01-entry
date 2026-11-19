// CITY OF EMBERS — Phase 4 screenshot retakes (original, in-session).
// Re-takes the four validation screenshots that need clear framing:
// p4-01 pedestrians, p4-02 flee, p4-03 patrol, p4-07 escape.
// The camera yaw is set explicitly (new setCamYaw hook) so the subject
// is centred in frame instead of relying on the default view direction.
//
// Run from the repo root:  node validation/shot-phase4.cjs
const { spawn } = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('/home/hatch/workspace/tools/pw/node_modules/playwright-core');

const REPO = path.resolve(__dirname, '..');
const PORT = 8923;
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
async function poll(fn, timeoutMs, intervalMs = 500) {
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
  return new Function('e', `return e.${e}`)(window.__embers);
}, expr);
// Camera yaw that looks from the player toward (tx, tz): the camera sits
// behind the player, opposite the subject, looking at it.
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
  const up = await waitForServer(BASE);
  console.log('server up:', up);
  if (!up) { server.kill(); process.exit(1); }
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--no-sandbox', '--disable-gpu-sandbox', '--use-gl=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 120)); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + String(e).slice(0, 120)));
  await page.goto(BASE + '?shot=play', { waitUntil: 'domcontentloaded' });
  await poll(async () => (await embers(page, 'frames')) > 5, 60000, 1000);

  // (1) Pedestrians: stand on the downtown north sidewalk next to a
  // walker and look at them — the walker fills the frame.
  {
    const peds = await embers(page, 'npcs.pedestrians');
    const ped = peds.find((p) => p.state === 'walk');
    const px = ped.x - 5;
    const pz = ped.z + 3;
    await embers(page, `teleport(${px}, ${pz})`);
    await sleep(1500);
    const pedNow = (await embers(page, 'npcs.pedestrians'))[ped.index];
    const yaw = yawTo(px, pz, pedNow.x, pedNow.z);
    await embers(page, `setCamYaw(${yaw})`);
    await embers(page, `setFacing(${yaw + Math.PI})`);
    await sleep(1500);
    console.log(`p4-01: ped #${ped.index} at (${pedNow.x.toFixed(1)},${pedNow.z.toFixed(1)}) state=${pedNow.state}, player at (${px},${pz})`);
    await snap(page, 'p4-01-pedestrians.jpg');
  }

  // (2) Flee: trigger danger next to the player; the nearby walkers run
  // away from the player, straight into the camera's view.
  {
    const player = await embers(page, 'playerPos');
    await embers(page, `debugTriggerDanger(${player.x}, ${player.z}, 25)`);
    await sleep(2500);
    const peds = await embers(page, 'npcs.pedestrians');
    const fleeing = peds.filter((p) => p.state === 'flee');
    console.log(`p4-02: ${fleeing.length} pedestrians fleeing`);
    if (fleeing.length > 0) {
      const f = fleeing[0];
      const yaw = yawTo(player.x, player.z, f.x, f.z);
      await embers(page, `setCamYaw(${yaw})`);
      await sleep(1200);
    }
    await snap(page, 'p4-02-flee.jpg');
  }

  // (3) Police patrol: stand near a foot officer on patrol and look at
  // them (navy uniform, cap, badge).
  {
    await embers(page, 'debugResetNpcs()');
    await sleep(1500);
    const police = await embers(page, 'npcs.police');
    const officer = police.find((u) => u.kind === 'foot' || u.kind === undefined);
    const px = officer.x + 4;
    const pz = officer.z + 4;
    await embers(page, `teleport(${px}, ${pz})`);
    await sleep(1500);
    const offNow = (await embers(page, 'npcs.police'))[officer.index];
    const yaw = yawTo(px, pz, offNow.x, offNow.z);
    await embers(page, `setCamYaw(${yaw})`);
    await sleep(1500);
    console.log(`p4-03: officer #${officer.index} at (${offNow.x.toFixed(1)},${offNow.z.toFixed(1)}) state=${offNow.state}`);
    await snap(page, 'p4-03-patrol.jpg');
  }

  // (7) Escape: wanted level 5, then hide in the safehouse until the
  // level has clearly dropped (5 -> 3 stars or fewer) — the HUD shows
  // the wanted level decreasing.
  {
    await embers(page, 'debugResetNpcs()');
    await embers(page, 'teleport(-155, -10)');
    await embers(page, 'debugSetHeat(90)'); // level 5
    await sleep(2000);
    const dropped = await poll(async () => {
      const w = await embers(page, 'npcs.wanted');
      return w.level <= 3 ? w : null;
    }, 180000, 1000);
    const w = await embers(page, 'npcs.wanted');
    console.log(`p4-07: wanted level ${dropped ? dropped.level : w.level}, heat ${w.heat.toFixed(1)}, status=${w.status}`);
    await snap(page, 'p4-07-escape.jpg');
  }

  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
  server.kill();
  process.exit(0);
})();

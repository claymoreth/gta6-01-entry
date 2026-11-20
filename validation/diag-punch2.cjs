// Diagnostic: reproduce Phase 5 sections 2 (pistol) + 3 (punch) exactly,
// logging player position / facing right before the punch.
const { chromium } = require('/home/hatch/workspace/tools/pw/node_modules/playwright-core');
const { spawn } = require('child_process');
const REPO = '/home/hatch/workspace/makefun/gta6-01-entry';
const PORT = 8934;
const CHROME = '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function embers(page, expr) {
  return page.evaluate((e) => new Function('e', 'return e.' + e)(window.__embers), expr);
}
async function waitGame(page, secs, maxMs = 60000) {
  const t0 = await embers(page, 'time');
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const t = await embers(page, 'time');
    if (t - t0 >= secs) return true;
    await sleep(300);
  }
  return false;
}
async function poll(fn, maxMs, interval) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const v = await fn();
    if (v !== null && v !== undefined) return v;
    await sleep(interval);
  }
  return null;
}
async function aimAt(page, tx, tz) {
  const p = await embers(page, 'playerPos');
  const dx = tx - p.x, dz = tz - p.z;
  const yaw = Math.atan2(-dx, -dz);
  await embers(page, `setCamYaw(${yaw})`);
  await embers(page, `setFacing(${Math.atan2(dx, dz)})`);
  await sleep(300);
  return yaw;
}
(async () => {
  const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'] });
  await sleep(1500);
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE-ERR:', m.text().slice(0, 160)); });
  page.on('pageerror', (e) => console.log('PAGE-ERR:', String(e).slice(0, 160)));
  await page.goto(`http://127.0.0.1:${PORT}/?lowfx=1&shot=play`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__embers && window.__embers.frames > 5, null, { timeout: 30000 });

  // ---- Section 2 (pistol), as in test-phase5 ----
  // Section 1 ends with combatSwitch(1) (pistol) — replicate that, else
  // combatFire() degrades to a melee swing and poisons meleeCd.
  await embers(page, 'combatSwitch(1)');
  await embers(page, 'teleport(0, 0)');
  await embers(page, 'debugPlacePed(0, 0, -6)');
  await sleep(800);
  await aimAt(page, 0, -6);
  await embers(page, 'combatFire()');
  await sleep(400);
  await waitGame(page, 0.5);
  await embers(page, 'combatFire()');
  await sleep(400);
  const ped0 = (await embers(page, 'npcs.pedestrians'))[0];
  console.log(`ped0 after 2 shots: state=${ped0.state}`);
  const recovered = await poll(async () => {
    const p = (await embers(page, 'npcs.pedestrians'))[0];
    return p.state !== 'down' ? p.state : null;
  }, 90000, 1000);
  console.log(`ped0 recovered: ${recovered}`);
  const pBefore = await embers(page, 'playerPos');
  console.log(`player before punch section: (${pBefore.x.toFixed(2)}, ${pBefore.z.toFixed(2)})`);

  // ---- Section 3 (punch), as in test-phase5 ----
  await embers(page, 'combatSwitch(0)');
  await embers(page, 'debugPlacePed(1, 0, -2)');
  await sleep(600);
  await aimAt(page, 0, -2);
  const pPunch = await embers(page, 'playerPos');
  const ped1 = (await embers(page, 'npcs.pedestrians'))[1];
  const dist = Math.hypot(ped1.x - pPunch.x, ped1.z - pPunch.z);
  console.log(`at punch: player=(${pPunch.x.toFixed(2)}, ${pPunch.z.toFixed(2)}) ped1=(${ped1.x.toFixed(2)}, ${ped1.z.toFixed(2)}) state=${ped1.state} dist=${dist.toFixed(2)}`);
  const hit = await embers(page, 'combatMelee()');
  console.log(`combatMelee() returned: ${hit}`);
  await sleep(500);
  const ped1After = (await embers(page, 'npcs.pedestrians'))[1];
  console.log(`after punch: ped1 state=${ped1After.state}`);

  await browser.close();
  server.kill();
  process.exit(0);
})().catch((e) => { console.error('DIAG ERR', e); process.exit(1); });

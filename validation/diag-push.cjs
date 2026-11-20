// Diagnostic: does standing at (0,0) get the player pushed by traffic?
// Reproduces the Phase 5 situation: player waits at (0,0) during a long
// recovery poll, then the punch test expects the player still near (0,0).
const { chromium } = require('/home/hatch/workspace/tools/pw/node_modules/playwright-core');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const REPO = '/home/hatch/workspace/makefun/gta6-01-entry';
const PORT = 8933;
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

(async () => {
  const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'] });
  await sleep(1500);
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE-ERR:', m.text().slice(0, 160)); });
  page.on('pageerror', (e) => console.log('PAGE-ERR:', String(e).slice(0, 160)));
  await page.goto(`http://127.0.0.1:${PORT}/?lowfx=1&shot=play`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__embers && window.__embers.frames > 5, null, { timeout: 30000 });

  // Teleport to (0,0) like Phase 5 section 2, then wait 30 game-seconds
  // (approximating the recovery poll duration).
  await embers(page, 'teleport(0, 0)');
  const p0 = await embers(page, 'playerPos');
  console.log(`start player at (${p0.x.toFixed(1)}, ${p0.z.toFixed(1)})`);
  await waitGame(page, 30);
  const p1 = await embers(page, 'playerPos');
  const moved = Math.hypot(p1.x - p0.x, p1.z - p0.z);
  console.log(`after 30 game-s player at (${p1.x.toFixed(1)}, ${p1.z.toFixed(1)}) — moved ${moved.toFixed(1)} m`);
  // Now place ped 1 at (0,-2) and punch, as Phase 5 section 3 does.
  await embers(page, 'debugPlacePed(1, 0, -2)');
  await sleep(600);
  const peds = await embers(page, 'npcs.pedestrians');
  console.log(`pedestrians: ${JSON.stringify(peds)}`);
  const ped = peds[1];
  if (!ped) { console.log('NO ped index 1'); await browser.close(); server.kill(); process.exit(0); }
  const dist = Math.hypot(ped.x - p1.x, ped.z - p1.z);
  console.log(`ped1 at (${ped.x.toFixed(1)}, ${ped.z.toFixed(1)}), dist from player ${dist.toFixed(1)} m (punch range 2.2)`);
  await embers(page, 'combatSwitch(0)');
  // Aim at the ped.
  const dx = 0 - p1.x, dz = -2 - p1.z;
  await embers(page, `setFacing(${Math.atan2(dx, dz)})`);
  await sleep(300);
  await embers(page, 'combatMelee()');
  await sleep(500);
  const pedAfter = (await embers(page, 'npcs.pedestrians'))[1];
  console.log(`after punch: ped1 state=${pedAfter.state}`);

  await browser.close();
  server.kill();
  process.exit(0);
})().catch((e) => { console.error('DIAG ERR', e); process.exit(1); });

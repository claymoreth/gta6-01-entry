// Diagnostic: after pistol shots (crime -> police respond), sample player
// pos + nearest vehicle every 2 wall-seconds to catch what pushes the player.
const { chromium } = require('/home/hatch/workspace/tools/pw/node_modules/playwright-core');
const { spawn } = require('child_process');
const REPO = '/home/hatch/workspace/makefun/gta6-01-entry';
const PORT = 8936;
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
async function aimAt(page, tx, tz) {
  const p = await embers(page, 'playerPos');
  const dx = tx - p.x, dz = tz - p.z;
  const yaw = Math.atan2(-dx, -dz);
  await embers(page, `setCamYaw(${yaw})`);
  await embers(page, `setFacing(${Math.atan2(dx, dz)})`);
  await sleep(300);
}
(async () => {
  const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'] });
  await sleep(1500);
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => console.log('PAGE-ERR:', String(e).slice(0, 160)));
  await page.goto(`http://127.0.0.1:${PORT}/?lowfx=1&shot=play`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__embers && window.__embers.frames > 5, null, { timeout: 30000 });
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
  let last = await embers(page, 'playerPos');
  console.log(`t=0 player (${last.x.toFixed(2)}, ${last.z.toFixed(2)}) wanted=${JSON.stringify(await embers(page, 'npcs.wanted'))}`);
  for (let t = 2; t <= 60; t += 2) {
    await sleep(2000);
    const p = await embers(page, 'playerPos');
    const moved = Math.hypot(p.x - last.x, p.z - last.z);
    const cars = await embers(page, 'vehicles');
    let nearest = null, nd = 1e9;
    for (const c of cars) {
      const d = Math.hypot(c.x - p.x, c.z - p.z);
      if (d < nd) { nd = d; nearest = c; }
    }
    const units = await embers(page, 'npcs.police');
    const states = units.map((u) => `${u.index}:${u.state}`).join(',');
    const tag = moved > 0.05 ? '  <<<< MOVED' : '';
    console.log(`t=${t} player (${p.x.toFixed(2)}, ${p.z.toFixed(2)}) moved=${moved.toFixed(2)} nearest type=${nearest.type} police=${nearest.police} traffic=${nearest.traffic} dist=${nd.toFixed(1)} at (${nearest.x.toFixed(1)},${nearest.z.toFixed(1)}) h=${nearest.heading.toFixed(2)} spd=${nearest.speed.toFixed(1)} | policeStates[${states}]${tag}`);
    last = p;
  }
  await browser.close();
  server.kill();
  process.exit(0);
})().catch((e) => { console.error('DIAG ERR', e); process.exit(1); });

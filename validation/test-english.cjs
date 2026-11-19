// CITY OF EMBERS — English localisation verification (original, in-session).
// Serves game/ over HTTP (never file://), drives it with Playwright.
//
// Session A (logic, 640x360 + ?lowfx=1): start screen, HUD, district /
// street names in all 3 districts, mission + GPS text, enter prompt,
// driving HUD (speedo + car name + KM/H), pause screen, and a full scan
// of ALL visible DOM text for leftover Indonesian words.
// Session B (visuals, 1280x720 full quality): ?shot=drive screenshot
// proving the English driving UI — saved as validation/05-english-ui.jpg
// (NOT screenshots/: the dossier caps screenshots/ at 4 files, and a 5th
// file there breaks main.ts with DossierError screenshots.max).
//
// Run from the repo root:  node validation/test-english.cjs
// Requires playwright-core at ~/workspace/tools/pw/node_modules/.

const { spawn } = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('/home/hatch/workspace/tools/pw/node_modules/playwright-core');

const REPO = path.resolve(__dirname, '..');
const PORT = 8916;
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

// Indonesian words/phrases that must NOT appear in any visible text.
// Proper names (Ember, Melati, Merdeka) are allowed — they stay by design.
// "Plaza" alone is English too, so only the old phrase "Plaza Merdeka" is flagged.
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

// Known flaky SwiftShader validation error (documented in Phase 3: it
// appeared in 2 of 3 runs even before the spotlight fix, with an EMPTY
// program info log — the program actually compiled). It is unrelated to
// localisation (no material/light/shader code changed here) and does not
// break rendering. Filtered from the hard error check, but counted and
// reported separately.
function isFlakyShaderError(text) {
  return /THREE\.WebGLProgram: Shader Error/.test(text) && /Program Info Log:\s*$/.test(text);
}
function hardErrors(list) {
  return list.filter((e) => !isFlakyShaderError(e));
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

  // ================= SESSION A — logic + text scan (640x360 lowfx) =================
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('requestfailed', (r) => errors.push('REQFAIL: ' + r.url()));
  await page.goto(`${BASE}?lowfx=1&seed=1`, { waitUntil: 'load', timeout: 30000 });
  await poll(async () => (await page.evaluate(() => window.__embers && window.__embers.frames)) > 3, 60000, 1000);

  // 1. Start screen (visible before starting).
  const startText = await page.evaluate(() => document.getElementById('start-screen').innerText);
  check('start screen English tagline', /A tropical coastal city/.test(startText) && /Explore Ember Bay on foot or by car/.test(startText), startText.split('\n').slice(0, 2).join(' | '));
  check('start screen controls English', /move \/ drive/.test(startText) && /enter \/ exit car/.test(startText) && /SPACE/.test(startText) && /rotate camera/.test(startText) && /mark destination/.test(startText) && /pause/.test(startText), 'controls block ok');
  const startBad = scanIndonesian(startText);
  check('start screen: no Indonesian words', startBad.length === 0, startBad.length ? `found: ${startBad.join(', ')}` : 'clean');

  // 2. Start the game, check the welcome toast + HUD.
  // Atomic click+read: the welcome toast is replaced by the district toast
  // on the next frame (pre-existing Phase 1 behaviour), so read it in the
  // same JS task as the click — no frame can interleave.
  const toast = await page.evaluate(() => {
    document.getElementById('start-btn').click();
    return document.getElementById('toast').textContent;
  });
  check('welcome toast English', toast === 'Welcome to Ember Bay', `"${toast}"`);
  const hudText = await page.evaluate(() => {
    const ids = ['district-name', 'street-name', 'mission', 'mission-progress', 'weapon', 'hint', 'gps-name'];
    return ids.map((id) => `${id}=${document.getElementById(id).textContent}`).join(' | ');
  });
  check('HUD English (district/street/mission/weapon/hint)', /Merdeka Street/.test(hudText) && /Go to Melati Park/.test(hudText) && /0\/3 objectives/.test(hudText) && /Bare Hands/.test(hudText) && /move/.test(hudText) && /enter car/.test(hudText), hudText);

  // 3. District / street names in all 3 districts (via teleport).
  const districtAt = async (x, z) => {
    await page.evaluate(([px, pz]) => window.__embers.teleport(px, pz), [x, z]);
    await sleep(1200);
    return page.evaluate(() => window.__embers.district);
  };
  const dPark = await districtAt(-140, 37);
  check('Residential: Melati Park / Park Road', dPark.district === 'RESIDENTIAL — Melati Park' && dPark.street === 'Park Road', `${dPark.district} · ${dPark.street}`);
  const dPier = await districtAt(100, 0);
  check('Waterfront: Ember Pier / Merdeka Street', dPier.district === 'WATERFRONT — Ember Pier' && dPier.street === 'Merdeka Street', `${dPier.district} · ${dPier.street}`);
  const dPierEnd = await districtAt(160, 0);
  check('Waterfront pier end: Wooden Pier', dPierEnd.district === 'WATERFRONT — Ember Pier' && dPierEnd.street === 'Wooden Pier', `${dPierEnd.district} · ${dPierEnd.street}`);
  const dDown = await districtAt(0, 0);
  check('Downtown: Merdeka Junction', dDown.district === 'EMBER BAY — DOWNTOWN' && dDown.street === 'Merdeka Junction', `${dDown.district} · ${dDown.street}`);
  const dBeach = await districtAt(30, 0);
  check('Downtown EW spine: Beach Road', dBeach.street === 'Beach Road', `${dBeach.district} · ${dBeach.street}`);

  // 4. GPS waypoint name is English (any of the 3 mission stops — the
  // teleport onto Melati Park above legitimately advanced the mission).
  await page.evaluate(() => window.__embers.teleport(0, 0));
  await sleep(800);
  const gps = await page.evaluate(() => {
    const w = window.__embers.waypoint;
    return w ? w.name : null;
  });
  check('mission waypoint name English', ['Melati Park', 'Ember Lighthouse', 'Merdeka Plaza'].includes(gps), `"${gps}"`);

  // 5. Enter prompt near the sedan (English, new car name).
  await page.evaluate(() => window.__embers.teleport(28, -14));
  await sleep(1500);
  const prompt = await page.evaluate(() => {
    const el = document.getElementById('interact-prompt');
    return { hidden: el.classList.contains('hidden'), text: el.textContent };
  });
  check('enter prompt English', !prompt.hidden && prompt.text === 'Press E to enter — Ember Sedan', JSON.stringify(prompt));

  // 6. Press E -> driving: speedo name + unit English, car rolls.
  await page.keyboard.press('KeyE');
  await sleep(800);
  await page.keyboard.down('KeyW');
  const kmh = await poll(async () => {
    const v = await page.evaluate(() => window.__embers.speedKmh);
    return v > 5 ? v : null;
  }, 40000);
  await page.keyboard.up('KeyW');
  const speedo = await page.evaluate(() => ({
    name: document.getElementById('speedo-name').textContent,
    unit: document.getElementById('speed-unit').textContent,
    num: document.getElementById('speed-num').textContent,
    hidden: document.getElementById('speedo').classList.contains('hidden'),
  }));
  check('driving HUD English (EMBER SEDAN + KM/H)', !speedo.hidden && speedo.name === 'EMBER SEDAN' && speedo.unit === 'KM/H' && Number(speedo.num) > 0,
    `${speedo.name} ${speedo.num} ${speedo.unit} (peak ${kmh ? kmh.toFixed(0) : '—'} km/h)`);
  // Exit: the 'Exited vehicle' toast is set by exitVehicle() but overwritten
  // in the SAME frame by the district toast when the exit spot crosses a
  // district boundary (pre-existing Phase 3 quirk — the sedan exit spot at
  // z -8.9 crosses into the Beach Road zone). So verify the exit itself
  // happened and every toast value seen is English instead of the exact
  // transient string; the 'Exited vehicle' literal is verified in source.
  await page.keyboard.press('KeyE'); // exit
  const exitToasts = await page.evaluate(() => {
    return new Promise((resolve) => {
      const vals = [document.getElementById('toast').textContent];
      const t0 = Date.now();
      const iv = setInterval(() => {
        const t = document.getElementById('toast').textContent;
        if (!vals.includes(t)) vals.push(t);
        if (Date.now() - t0 > 2000) { clearInterval(iv); resolve(vals); }
      }, 40);
    });
  });
  const exitedOk = await page.evaluate(() => !window.__embers.driving);
  const exitBad = exitToasts.flatMap((t) => scanIndonesian(t));
  check('exit vehicle works, toast English', exitedOk && exitBad.length === 0,
    `driving=${!exitedOk}, toasts seen: ${JSON.stringify(exitToasts)}`);

  // 7. Pause screen English.
  await page.keyboard.press('Escape');
  await sleep(800);
  const pauseText = await page.evaluate(() => document.getElementById('pause-screen').innerText);
  check('pause screen English', /PAUSED/.test(pauseText) && /Ember Bay awaits you/.test(pauseText), pauseText.replace(/\n/g, ' | '));
  await page.click('#resume-btn');
  await sleep(800);

  // 8. Full visible-DOM scan for leftover Indonesian words (HUD state).
  const allText = await page.evaluate(() => document.body.innerText);
  const bad = scanIndonesian(allText);
  check('visible DOM: no Indonesian words', bad.length === 0, bad.length ? `found: ${bad.join(', ')} in: ${allText.replace(/\n/g, ' | ').slice(0, 400)}` : 'clean');

  const fpsA = await page.evaluate(() => window.__embers.fps);
  console.log(`SESSION A perf: FPS ${fpsA.toFixed(1)} (wall-clock, 640x360 lowfx)`);
  const hardA = hardErrors(errors);
  const flakyA = errors.length - hardA.length;
  check('no console errors / failed requests (logic)', hardA.length === 0,
    hardA.length ? hardA.slice(0, 5).join(' | ') : (flakyA ? `clean (plus ${flakyA} known flaky SwiftShader shader-validation error, empty program log)` : 'clean'));
  await page.close();

  // ================= SESSION B — visuals (1280x720, full quality) =================
  const shot = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errorsB = [];
  shot.on('console', (m) => { if (m.type() === 'error') errorsB.push(m.text()); });
  shot.on('pageerror', (e) => errorsB.push('PAGEERROR: ' + e.message));
  shot.on('requestfailed', (r) => errorsB.push('REQFAIL: ' + r.url()));
  await shot.goto(`${BASE}?shot=drive&seed=1`, { waitUntil: 'load', timeout: 30000 });
  await poll(async () => (await shot.evaluate(() => window.__embers.frames)) > 3, 60000, 1000);
  await shot.keyboard.down('KeyW');
  await sleep(5000);
  await shot.keyboard.up('KeyW');
  await sleep(1500);
  const driveState = await shot.evaluate(() => ({
    driving: window.__embers.driving,
    speedKmh: window.__embers.speedKmh,
    speedo: document.getElementById('speed-num').textContent,
    speedoName: document.getElementById('speedo-name').textContent,
    speedoUnit: document.getElementById('speed-unit').textContent,
    mission: document.getElementById('mission').textContent,
    district: document.getElementById('district-name').textContent,
    street: document.getElementById('street-name').textContent,
    fps: window.__embers.fps,
    drawCalls: window.__embers.drawCalls,
    triangles: window.__embers.triangles,
  }));
  console.log('SHOT drive state:', JSON.stringify(driveState));
  check('shot=drive: English driving HUD', driveState.driving && driveState.speedoName === 'EMBER SEDAN' && driveState.speedoUnit === 'KM/H' && Number(driveState.speedo) > 0 && /Go to/.test(driveState.mission),
    `${driveState.speedoName} ${driveState.speedo} ${driveState.speedoUnit} · ${driveState.mission} · ${driveState.district} · ${driveState.street}`);
  const shotPath = path.join(REPO, 'validation', '05-english-ui.jpg');
  await shot.screenshot({ path: shotPath, type: 'jpeg', quality: 82 });
  const shotStat = fs.statSync(shotPath);
  check('screenshot validation/05-english-ui.jpg saved', shotStat.size > 10000 && shotStat.size <= 262144, `${(shotStat.size / 1024).toFixed(0)} KiB`);
  console.log(`SESSION B perf: FPS ${driveState.fps.toFixed(1)} (wall-clock, 1280x720 full quality) · draw calls ${driveState.drawCalls} · triangles ${driveState.triangles}`);
  const hardB = hardErrors(errorsB);
  const flakyB = errorsB.length - hardB.length;
  check('no console errors / failed requests (visuals)', hardB.length === 0,
    hardB.length ? hardB.slice(0, 5).join(' | ') : (flakyB ? `clean (plus ${flakyB} known flaky SwiftShader shader-validation error, empty program log)` : 'clean'));
  await shot.close();

  await browser.close();
  server.kill();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n==== ENGLISH CHECK: ${results.length - failed.length}/${results.length} PASS ====`);
  if (failed.length) {
    console.log('FAILED:');
    for (const f of failed) console.log(` - ${f.name}: ${f.detail}`);
  }
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

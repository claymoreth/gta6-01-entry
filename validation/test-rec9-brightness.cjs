// CITY OF EMBERS — Recording 9 brightness acceptance test.
// Five INDEPENDENT brightness measurements at (60,0), same protocol as
// Recording 8 Session B (1280x720, ?shot=play, teleport(60,0),
// setFacing(1.5708), setCamYaw(1.5708), 1500 ms settle, JPEG q82,
// PIL grayscale mean of the whole frame).
// Each run is a FRESH page load (new browser context per run).
// PASS only if EVERY measurement is >= 21.5/255.
// Run from the repo root:  node validation/test-rec9-brightness.cjs

const { spawn, execFile } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('/home/hatch/workspace/tools/pw/node_modules/playwright-core');

const REPO = path.resolve(__dirname, '..');
const PORT = 8928;
const BASE = `http://127.0.0.1:${PORT}/`;
const CHROME = '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const RUNS = 5;
const THRESHOLD = 21.5;

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
const embers = (page, expr) => page.evaluate((e) => {
  return new Function('e', `return e.${e}`)(window.__embers);
}, expr);
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

(async () => {
  const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'] });
  let serverLog = '';
  server.stdout.on('data', (d) => { serverLog += d; });
  server.stderr.on('data', (d) => { serverLog += d; });
  const up = await waitForServer(BASE);
  console.log(`server up: ${up}`);
  if (!up) { console.log(serverLog.slice(0, 500)); server.kill(); process.exit(2); }

  const values = [];
  for (let run = 1; run <= RUNS; run++) {
    const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 120)); });
    page.on('pageerror', (e) => errors.push('PAGEERROR: ' + String(e).slice(0, 120)));
    await page.goto(BASE + '?shot=play', { waitUntil: 'domcontentloaded' });
    await poll(async () => (await embers(page, 'frames')) > 5, 60000, 1000);
    await page.evaluate(() => localStorage.removeItem('city-of-embers-save-v1'));
    await embers(page, 'teleport(60, 0)');
    await embers(page, 'setFacing(1.5708)');
    await embers(page, 'setCamYaw(1.5708)');
    await sleep(1500);
    const shot = path.join(REPO, 'validation', `rec9-lighting-${run}.jpg`);
    await page.screenshot({ path: shot, type: 'jpeg', quality: 82 });
    const bright = await meanBrightness(shot);
    const size = fs.statSync(shot).size;
    console.log(`run ${run}: brightness ${bright.toFixed(1)}/255 (${(size / 1024).toFixed(0)} KiB)${errors.length ? ' [errors: ' + errors.slice(0, 2).join(' ;; ') + ']' : ''}`);
    values.push(bright);
    await browser.close();
  }
  server.kill();

  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const allPass = values.every((v) => v >= THRESHOLD);
  console.log(`\nREC9 brightness (60,0): values [${values.map((v) => v.toFixed(1)).join(', ')}]`);
  console.log(`min=${min.toFixed(1)} max=${max.toFixed(1)} avg=${avg.toFixed(1)} threshold=${THRESHOLD}`);
  console.log(allPass ? 'REC9 BRIGHTNESS: PASS (all 5 >= 21.5)' : 'REC9 BRIGHTNESS: FAIL (not all >= 21.5)');
  process.exit(allPass ? 0 : 1);
})();

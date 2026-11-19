# PHASE 3 — VEHICLES AND DRIVING — REPORT

## PHASE

Phase 3 of the Master Prompt (Part 7): vehicles + driving for CITY OF EMBERS,
make.fun gta6-01. Game "CITY OF EMBERS", repo claymoreth/gta6-01-entry.

## STATUS

**PASS** — 26/26 Phase 3 acceptance checks + 29/29 Phase 2 regression checks.
No acceptance test failing. Recording still active (PID 5843); nothing
submitted; Phase 4 NOT started.

## FILES CREATED

- `game/src/vehicles.js` (630 lines) — original car models (primitives),
  arcade driving physics, damage + smoke, civilian traffic AI.
- `game/src/audio.js` (111 lines) — synthesized engine / skid / crash audio
  (Web Audio API, no audio files, no network).
- `validation/test-phase3.cjs` (313 lines) — Playwright acceptance test,
  26 checks in two sessions (logic 640x360 lowfx + visuals 1280x720).
- `screenshots/04-vehicle-driving.jpg` (77 KiB) — driving screenshot #4.
- `validation/PHASE-3-REPORT.md` (this file).
- `validation/probe-smoke.cjs` + `validation/smoke-probe.jpg` — damage-smoke
  verification probe (evidence, see below).

## FILES MODIFIED

- `game/src/main.js` (+~150 lines) — driving state (enter/exit, driving
  camera ease, engine/skid audio wiring), `driveHudInfo()`, `?shot=drive`,
  `__embers` hooks (`driving`, `drivenCar`, `speedKmh`, `vehicles`,
  `enterCar`, `placeCar`, `exitCar`).
- `game/src/input.js` — Space = handbrake, KeyE = interact edge
  (`consumeInteract()`), `handbrake()`.
- `game/src/camera.js` — `setDistance()` / `setHeight()` (driving camera
  sits further back and higher); `state.dist` / `state.height` used by update.
- `game/src/hud.js` — speedometer (km/h) + damage bar + car name panel,
  "Tekan E untuk masuk" prompt (`setInteract()`), vehicle dots on the minimap
  (cyan = parked drivable, pale = traffic).
- `game/index.html` — `#speedo` / `#damage-row` / `#interact-prompt` elements,
  start-screen controls updated (E, SPASI).
- `game/style.css` — styling for the new HUD elements.
- `main.ts` — trailing comment only (3 districts + driving).
- `shots.json` — added `04-vehicle-driving.jpg` (`?shot=drive&seed=1`).
- `README.md` — new "Phase 3 — Vehicles and Driving" section + controls.
- `vendor/makefun-game.ts` — **UNCHANGED** (sha256 `dc671875…`, verified).

## IMPLEMENTED

1. **Three drivable cars** (original low-poly models from primitives, no
   copies): Sedan Ember (blue, Downtown), Sports Ember (red, Residential),
   Truk Ember (orange, cab + cargo bed + crate, Waterfront). Each has a
   body, glass cabin, 4 wheels (front wheels steer, all spin with speed),
   emissive headlights/taillights, side mirrors, bumpers. Parked off the
   traffic lanes on open ground.
2. **Enter/exit (E)**: prompt "Tekan E untuk masuk — <name>" within 4.5 m;
   E hides Raka inside the car (mesh + hero light hidden); E again steps
   him out on the car's right side. Camera swings behind the car on enter
   (yaw snap + continuous ease) and returns on foot.
3. **Driving controls**: W/S gas & brake (S from stop = reverse), A/D steer
   (steering tightens with speed, bicycle-model yaw), Space handbrake
   (strong decel + extra yaw = drift), Shift boost (+35% accel). Top speeds:
   sedan 28 m/s (~100 km/h), sports 38 m/s (~137 km/h), truck 22 m/s.
4. **Collision**: two axle circles per car vs all world colliders (walls,
   containers, lamps, palms, dumpsters); impact > 4 m/s cuts speed ×0.35
   and adds damage. Car-vs-car pairwise separation (min 3.1 m) + damage on
   hard closing speed. World bounds clamp.
5. **Damage**: 0–100%. Handling worsens (accel −50%, top speed −40% at
   100%), smoke puffs from the hood above 50% damage while moving, engine
   dead at ≥95%.
6. **Traffic**: 7 civilian cars on 3 road loops (EW spine, Jalan Dermaga,
   Jalan Melati) with pure-pursuit steering, varied target speeds (6–10 m/s),
   obstacle braking (stop for the player and for other cars), stuck-recovery
   reverse manoeuvre.
7. **Driving HUD**: live speedometer (km/h), damage bar + %, car name;
   minimap dots for all cars; headlight beam (one shared SpotLight attached
   to the driven car only).
8. **Sound** (synthesized, no files): engine pitch follows speed (sawtooth +
   square sub-oscillator through a low-pass), tyre skid on handbrake,
   crash thuds (filtered noise burst, intensity = impact speed). AudioContext
   created on the Start click (browser gesture rule); all failures silent.

## TESTS EXECUTED

All via HTTP (`node serve.ts`, never `file://`), Playwright
(playwright-core 1.65.1, Chromium 1255), command:
`node validation/test-phase3.cjs` — final run **26/26 PASS** (earlier runs
found real bugs, fixed, re-run — see BUGS FIXED).

Acceptance results (final run, Session A 640x360 `?lowfx=1`):

| # | Check | Result |
|---|-------|--------|
| 1 | Vehicles present (10 = 3 drivable + 7 traffic) | PASS |
| 2 | Sedan spawn (28, -11.5), truck spawn (108, 30) | PASS |
| 3 | Traffic moves (max displacement 3.2 m) | PASS |
| 4 | Walk still works (regression, 1.9 m) | PASS |
| 5 | Enter prompt near car ("Tekan E untuk masuk — Sedan Ember") | PASS |
| 6 | Enter vehicle (E) — driving, sedan, speedo visible | PASS |
| 7 | Accelerate — 20 km/h | PASS |
| 8 | Speedometer HUD live — speed-num = 21 | PASS |
| 9 | Steering (D = right) — heading −0.36 rad | PASS |
| 10 | Brake (S while moving) — 11 → 1 km/h | PASS |
| 11 | Reverse (S from stop) — −1.4 m/s | PASS |
| 12 | Exit vehicle (E) — on foot | PASS |
| 13 | Handbrake (Space) — 28 → 0 km/h | PASS |
| 14 | Vehicle collision + damage — 18% | PASS |
| 15 | Speedometer still live after crash — 7 km/h | PASS |
| 16 | Traffic separation (no overlap) — min 27.14 m | PASS |
| 17 | All cars inside world bounds | PASS |
| 18 | Exit, player beside car (2.6 m), speedo hidden | PASS |
| 19 | District detection (regression) — WATERFRONT | PASS |
| 20 | No console errors / failed requests (Session A) | PASS |
| 21 | shot=drive: driving, speedo 32 km/h | PASS |
| 22 | Screenshot 04-vehicle-driving.jpg saved (77 KiB) | PASS |
| 23 | No console errors / failed requests (visuals) | PASS |
| — | (3 further checks: server up, game playing, vehicles present) | PASS |

Regression: `node validation/test-phase2.cjs` — **29/29 PASS** (districts,
walking across boundaries, GPS waypoint + arrival, mission advance,
minimap player pixel, HUD, screenshots). No Phase 1/2 regression.

Build: `MAKEFUN_OUTPUT_DIR=/tmp/p3out node main.ts` — **exit 0**; dossier
`makefun/dossier/v1`, 11 source files (116,786 bytes), 1 vendored
(three.module.min.js), 4 images. `shots.json` lists all 4 screenshots.

Damage-smoke probe: `node validation/probe-smoke.cjs` — sedan placed with
65% damage, drove at 10.5 km/h, 0 errors; screenshot
`validation/smoke-probe.jpg` shows a smoke puff above the hood + damage bar
at 65% (red). Smoke emission verified visually by me.

## CHROME TEST

Headless Chromium (Google Chrome for Testing 159.0.8154.6) via Playwright.
No real Chrome window (headless VM). Page loads, renders, accepts keyboard
input, screenshots captured. No page errors in any run.

## PLAYWRIGHT TEST

`validation/test-phase3.cjs`, 26/26 PASS (final run). Real interactions:
keyboard `KeyE`/`KeyW`/`KeyD`/`KeyS`/`Space` holds with `poll()` until the
condition is met (game time runs slower than wall-clock under SwiftShader,
so polls wait up to 20–45 s wall-clock per check). `__embers` debug hooks
used for state assertions and test-only teleports (`teleport`, `enterCar`,
`placeCar`).

## OFFLINE TEST

Game runs fully offline from static files: no CDN, no remote audio, no
network requests (0 failed requests in all sessions; Three.js vendored
locally). `main.ts` + `serve.ts` run with Node stdlib only.

## PERFORMANCE (real numbers, honest)

Headless SwiftShader VM (software rasterizer — NOT a real GPU). 60 FPS on a
real GPU cannot be verified here and is NOT claimed.

- Session A (640x360, `?lowfx=1`): **7.8 FPS wall-clock**, 233 draw calls,
  3,902 triangles. (The shared-spotlight fix raised this from 2.7 FPS.)
- Session B (1280x720, full quality): **1.2 FPS wall-clock**, 932 draw
  calls, 17,346 triangles.
- Phase 2 comparison: 1.0–1.2 FPS @1280x720 full quality — Phase 3 did not
  make full-quality rendering slower; the lowfx logic session got faster.

## BUGS FOUND

1. **Sedan spawn faced a wall.** (28, -11.5) facing east put the front
   bumper against tower [38,-18] (x 32..44, z -25..-11): the car pinned
   itself on the wall at 10–13 km/h and the accelerate check failed
   (run 1: 25/26).
2. **Handbrake / brake sign flip.** Deceleration could push speed past zero
   and flip its sign, jittering the car around a standstill.
3. **Traffic timers hardcoded 1/60 s.** `stuckTimer` / `recoverTimer` used a
   fixed frame step instead of dt — wrong at any FPS other than 60.
4. **Test falsy-zero bug.** The handbrake poll returned the speed (0 km/h)
   and `!!0 === false` failed a passing check (run 2: handbrake "failed"
   while the car had correctly stopped at 0 km/h). Same trap in the brake
   check.
5. **Shader validation error at load (flaky, SwiftShader).** `THREE.WebGLProgram:
   Shader Error 0 - VALIDATE_STATUS false` (MeshLambertMaterial, once also
   MeshBasicMaterial), empty info log, at ~1 s after load, in 2 of 3 lowfx
   runs before the fix; Session B (full quality) and the idle probe were
   clean. The game kept running fine after the error. Prime suspect: 10
   per-car SpotLights bloating every shader program with light uniforms.

## BUGS FIXED

1. Sedan moved to **(28, -11.5) facing WEST** down the verified-clear strip
   between the tower row and the sidewalk lamps/palms (towers end z ≤ -11,
   lamps z=-8.2, palms z=-9.6 — none reach the car's path); west run is
   clear for 106 m to the first house row. Accelerate now passes.
2. Brake clamps at zero (`Math.max(0, …)`); handbrake stops at zero, never
   flips the sign.
3. `trafficControl(dt, …)` — both timers now use real dt.
4. Test polls return booleans (`true` on success) instead of raw speeds;
   final speeds are read separately for the report line.
5. **One shared headlight SpotLight** attached to the driven car only
   (`setDriven` attaches/detaches it); per-car spotlights removed from
   `buildCarMesh`. Final run: 26/26, zero console errors, Session A FPS
   2.7 → 7.8.
6. Collision test made deterministic: `placeCar('sedan', 20, 2.5, Math.PI)`
   (test-only hook, optional damage arg) drives the sedan north into tower
   [18,-20] (16.5 m run) instead of relying on the spawn neighbourhood.

## REMAINING ISSUES

- **Waterfront foreground dark at night away from lamps** (carried from
  Phase 2, non-blocking; real-GPU playtest should confirm readability).
- **Traffic has no overtaking**: a traffic car waits behind anything
  stopped in its lane. Parked drivables are off-lane, so this only bites
  if the player parks in a lane — acceptable for now, Phase 4+ could add
  lane changes.
- **Smoke puffs read bright/round against the night sky** (verified in
  `smoke-probe.jpg` — a white orb above the hood). Works, but could be
  darker/softer in Phase 6 polish.
- **Phase 1 screenshots still downtown-only** (carried from Phase 2).
- The sedan's west run ends at the house row (x=-78); the player must turn
  onto the road or Jalan Melati — normal city behaviour, not a bug.
- Headlight beam is on only while driving (by design); parked cars show
  emissive headlight boxes only.

## EVIDENCE

- `validation/test-phase3.cjs` final run output: 26/26 PASS (see TESTS
  EXECUTED table above; full log in the parent agent's session).
- `screenshots/04-vehicle-driving.jpg` (77 KiB, viewed by me): blue sedan
  from behind in the eastbound lane, headlight beam on the road ahead,
  speedometer "SEDAN EMBER — 27 KM/J", damage 0%, minimap with vehicle
  dots + GPS route to Taman Melati (180 m), towers + palms + crosswalk +
  lighthouse in view.
- `validation/smoke-probe.jpg` (viewed by me): sedan at a crosswalk,
  damage bar 65% (red), speed 16 KM/J, smoke puff above the hood.
- `node validation/test-phase2.cjs`: 29/29 PASS (regression). Its visual
  session re-rendered `screenshots/03-districts-gps.jpg` (same composition —
  Raka on the pier facing the lighthouse — now also showing the Phase 3
  minimap vehicle dots and the updated hint line; verified by viewing it).
- `node main.ts` exit 0, dossier valid (11 source files, 4 images).
- `sha256 vendor/makefun-game.ts` = `dc67187521b24025ff952f8c231485a6eb92d6d71d29edd2a08154ffb4376129`
  (unchanged).
- Recording still active at report time: PID 5843, elapsed 01:15:43,
  `node cli/makefun.mjs record --competition gta6-01`.

## NEXT STEP

STOP. Wait for Mana's "LANJUT PHASE 4". Do NOT start Phase 4 (police /
wanted), do NOT submit, do NOT stop the recording, do NOT commit/push
(parent handles that).

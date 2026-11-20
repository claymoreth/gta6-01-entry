# PHASE 5 — Combat, Missions and Progression — CLOSEOUT REPORT

## PHASE
Phase 5 — Combat, Missions and Progression (master prompt Part 9).

## STATUS
**PASS** — all 43 Phase 5 checks pass; all regressions pass (P1 18/18, P2 29/29, P3 26/26, English 21/21, P4 36/36).

## FILES
Created:
- `game/src/combat.js` — 10,946 bytes (new: combat, missions, save/load, player damage)
- `validation/test-phase5.cjs` — 22,801 bytes (43 checks, Playwright via HTTP)
- `validation/test-phase5-run3.log` — final run, 43/43 PASS
- `validation/p5-01-combat.jpg` (104 KiB), `p5-02-npc-down.jpg` (101 KiB), `p5-03-police-response.jpg` (104 KiB), `p5-04-mission-brief.jpg` (106 KiB), `p5-05-mission-complete.jpg` (71 KiB), `p5-06-wasted.jpg` (42 KiB), `p5-07-save.jpg` (38 KiB) — all 1280x720, viewed by the builder
- `validation/PHASE-5-REPORT.md` — this file

Modified (game source only):
- `game/src/main.js` — 16,306 bytes (was 15,726): combat wiring, mission system replaced, WASTED state, save/load buttons, `__embers` combat/mission/save hooks, waypoint refresh on mission change
- `game/src/npcs.js` — 39,833 bytes (was 38,983): crime types assault (25) + weaponFire (15), FootPolice down support, `clearWanted()`
- `game/src/hud.js` — 12,319 bytes (was 11,361): real health/armour/money/weapon/ammo from combat, crosshair armed/hit/fire states, damage flash, WASTED overlay
- `game/src/input.js` — 3,874 bytes (was 3,039): fire (mouse, pointer-locked), melee (F), reload (R), weapon switch (Q / 1 / 2)
- `game/src/audio.js` — 5,005 bytes (was 4,405): `shot()` synth, `sfx()` noise helper
- `game/index.html` — 4,413 bytes (was 3,921): damage overlay, WASTED screen, CONTINUE + SAVE buttons, combat controls list
- `game/style.css` — 6,614 bytes (was 6,278): crosshair states, damage flash, WASTED heading

Modified (validation only — not counted in dossier):
- `validation/test-english.cjs` — 2 assertions updated for the new mission format (progress `Mission N/5`; waypoint list + Ember Pier, Green House, Pier Office, Ember Sports)
- `validation/test-phase2.cjs` — 2 assertions updated (progress `/Mission \d\/5/`; money accepts any `$N` after the M1 $100 reward)

Unchanged: `vendor/makefun-game.ts` (sha256 `dc67187521b24025ff952f8c231485a6eb92d6d71d29edd2a08154ffb4376129` = kit), `main.ts`, `world.js`, `vehicles.js`, `camera.js`, `collision.js`, `player.js`. No commit, no push, no submit, no Phase 6.

## IMPLEMENTED
- **Combat.** Hitscan pistol (chosen over projectiles: simpler, reliable at low FPS). Aim from camera yaw/pitch; range 40 m; nearest ped/foot-police within 0.9 m of the ray and closer than the nearest building (via `segmentClearT`) — shots do not pass through buildings. Left-click fires only when pointer-locked (first canvas click locks, does not fire). F = melee punch (range 2.2 m, 60-degree arc, 1 dmg, 0.6 s cooldown). Pistol 2 dmg, 0.28 s fire cooldown, magazine 12 + reserve 48, R reload 1.2 s, Q toggle / 1 Fists / 2 Pistol. Dry-fire click + "Magazine empty — Press R to reload" toast. Ammo restocked to >=48 reserve on mission complete; magazine refilled on respawn (no soft-lock). Firing on foot only, not while driving. Player facing set to aim yaw on fire.
- **NPC combat.** Per-NPC health via WeakMap in combat.js (ped 3, foot police 4) — no npcs.js health field needed. 2 pistol hits or 3 punches to down. On hp <= 0 the existing `knockDown()` runs, then downTimer is overridden to 8 s (down -> get up and flee, reusing existing states). Non-lethal hit: pedestrians `fleeFromPoint`, foot police set to `pursue`. FootPolice gained a down state in npcs.js (downTimer, `knockDown()`, lying pose, stand-still while down).
- **Police response.** Witnessed combat is a crime, reusing the Phase 4 `reportCrime` witness + line-of-sight + dedup system. New crime types: assault 25 heat, weaponFire 15 heat. Assault dedups per target (`ped-<index>`, 5 s cooldown); weaponFire dedups per event (once per 5 s). No crime if the ped is already down. Police pursue as in Phase 4.
- **Player damage / defeat.** Police in `pursue` within 2.0 m damage the player 6 per hit, global 1.2 s cooldown. Armour absorbs 1:1 first, then health. Health regenerates +3/s after 6 s without damage, +10/s inside a safehouse (8 m). Health 0 -> WASTED overlay 2.5 s -> respawn at the nearest safehouse (Green House or Pier Office), health 100, armour 50, magazine refilled, reserve >=24, money -$100 (min $0), wanted cleared via `clearWanted()`. WASTED fails/restarts the timed mission M2 and resets M4 `hadHeat`; other missions keep progress. New game state `wasted` (input paused, still renders).
- **Five connected missions** (original story, protagonist Raka, Ember Bay). M1 "First Arrival" — go to Melati Park (-140,37), meet Dara, $100. M2 "The Delivery" — timed 120 s, deliver to Ember Pier (156,0), $250, fail -> retry M2. M3 "Lost Vehicle" — step 0 enter the Ember Sports car (-100,-20), step 1 drive it to Ember Pier, $300. M4 "Police Pressure" — raise wanted >=1 then lose it back to 0 (waypoint = nearest safehouse as a hiding hint), $200. M5 "Final Connection" — 4 goto steps: Merdeka Plaza (0,0) -> Ember Lighthouse (168,0) -> Green House (-155,-10) -> Pier Office (132,45), $500. Total rewards $1,350. Mission HUD: title `M{n} — {title}: {objective}`, progress `Mission {n}/5` (+ `· Ns left` for the M2 timer). Completing a mission: cash += reward, toast, blip, save, advance. All done -> "Story complete — Ember Bay is yours!".
- **Save / load.** localStorage key `city-of-embers-save-v1`: `{x, z, money, health, armour, mi, si, w, mag, res, done}`. Save on mission complete + on WASTED respawn + pause-menu SAVE button + `__embers.saveGame()`. Load via CONTINUE button on the start screen (shown only if a valid save exists), with try/catch fallback (missing/corrupt -> null, CONTINUE hidden). `startGame(fresh)` — fresh calls `combat.reset()`, continue calls `combat.continueGame()` after `player.reset()`. Progress survives a browser refresh (verified by test).
- **HUD.** Weapon name + ammo display (real values from combat, not hardcoded), mission title/objective/progress, combat notifications (all English). Crosshair: ring when pistol equipped, yellow flash on fire, red flash + hit marker on hit. Red damage flash on player hurt. WASTED overlay. Existing HUD (district/street, GPS, compass, minimap, health/armour bars, money, wanted stars, speedometer) preserved.

## TESTS
`validation/test-phase5.cjs` — Playwright via HTTP (`node serve.ts`), Session A logic 480x270 lowfx + Session B visuals 1280x720. Final run (`validation/test-phase5-run3.log`): **43/43 PASS, exit 0.**
- Combat: switch Pistol / HUD 12/48, switch back to Bare Hands, fire 12->11, cooldown blocks immediate re-fire, fire after cooldown ->10.
- NPC damage: ped down after 2 pistol hits; downed ped recovers (gets up, state flee); punch makes ped flee; 3 punches down a ped.
- Ammo: 0/48 -> "Reloading…" -> 12/36.
- Police: officer LOS true; witnessed shot raises wanted >=1.
- Missions: M1 title/progress, M1 completes -> M2 (+$100); M2 timer counts down, M2 completes -> M3; M3 title, step 1 after entering sports car, M3 completes driving sports to pier -> M4; M4 title, wanted >=2, M4 completes at wanted 0 -> M5; M5 title, all 4 stops -> story complete; total rewards $1,350.
- Save/load: saveGame writes localStorage; CONTINUE visible after reload; continue restores mission 2 + position (30,10); corrupt save loads + CONTINUE hidden.
- WASTED: screen shows on lethal damage; respawn after timer; respawn at nearest safehouse, health 100, -$100.
- English: HUD visible text has no Indonesian words (45-word scan); no real console/page errors in either session.

Regressions (all re-run after the Phase 5 changes; logs `validation/regress-*-p5*.log`):
- Phase 1: **18/18 PASS** (`regress-p1-p5.log`)
- Phase 2: **29/29 PASS** (`regress-p2-p5b.log`) — after 2 test-expectation updates (see BUGS)
- Phase 3: **26/26 PASS** (`regress-p3-p5.log`)
- English: **21/21 PASS** (`regress-english-p5b.log`) — after 1 test-expectation update (waypoint list + Ember Sports)
- Phase 4: **36/36 PASS** (`regress-p4-p5b.log`, re-run) — first run was 33/36; the 3 failures were flaky timing, not regressions (see BUGS)
- Total: 130/130 regression checks + 43/43 Phase 5 = **173/173 PASS**.

## CHROME
Google Chrome for Testing 159.0.8154.6 via Playwright (`~/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome`), headless, SwiftShader. Served over HTTP (`node serve.ts`), never file://.

## PLAYWRIGHT
playwright-core 1.65.1 (`~/workspace/tools/pw/`). Same pattern as test-phase4.cjs: `embers(page, expr)` helper via `new Function`, `waitGame` via frames (dt clamp 0.05 s/frame), flaky SwiftShader shader-error filter (`THREE.WebGLProgram Shader Error` + empty Program Info Log).

## OFFLINE
Game runs fully offline: Three.js vendored locally (`game/vendor/three.module.min.js`), no CDN, no remote requests, no audio files (all Web Audio synth). 0 failed requests in every test session.

## PERFORMANCE
Honest SwiftShader numbers (this VM, software rasterizer, 1.5 vCPU — NOT real GPU):
- Phase 5 Session A: **6.8 FPS** @ 480x270 lowfx.
- Phase 5 Session B: **0.8 FPS** @ 1280x720 full quality, 900 draw calls, 19,790 triangles.
- Phase 4 regression re-run Session A: 6.9 FPS (game time ~0.34x wall clock), 1,277 draw calls, 24,698 triangles.
- vs Phase 3 baseline (7.8 FPS lowfx, 1.2 FPS full): not meaningfully worse. 60 FPS on a real GPU is UNVERIFIED and NOT claimed. Game logic is frame-rate independent (dt clamp 0.05 s).

## BUGS
Fixed during Phase 5 (found by test runs 1–2, fixed before run 3):
1. **Stale mission waypoint (GAME BUG, run 1).** When a mission advanced WITHOUT an arrival (M3 step 0->1 on car entry, M4 completion via heat check, M5 step advances), the old waypoint stayed live: entering the sports car left the waypoint at the car spawn, so the player standing there instantly "arrived" and completed M3 without driving; M5's waypoint stayed at Merdeka Plaza. Fix in `main.js`: (a) a per-frame check refreshes the waypoint whenever `missionIndex:missionStep` changes; (b) `enterVehicle` refreshes synchronously after `combat.onEnterCar` returns true (the per-frame check alone was too late — `checkArrival` runs before it in the same frame and the stale waypoint fired first). Run 3: 43/43.
2. **3-punch test (TEST BUG, run 1).** A hit makes the ped flee, so punches 2–3 swung at empty air. Fix: re-place the ped before EACH punch.
3. **Corrupt-save check (TEST BUG, run 1).** The test URL keeps `?shot=play`, so the game auto-starts; state `playing` is correct for that URL. Fix: accept `menu` OR `playing`.
4. **Respawn tolerance (TEST BUG, run 1).** Respawn puts the player at the safehouse centre but building collision pushes ~4 m clear. Fix: tolerance <2 m -> <10 m (safehouse hiding zone is r=8).

Test-expectation updates for the new mission system (game behaviour correct; same precedent as Phase 4 report section 6):
5. **test-phase2.cjs (2 asserts).** Progress format changed `0/3 objectives` -> `Mission N/5` (`/\d\/3/` -> `/Mission \d\/5/`). Money is $100 after M1 completes (was $0 when missions had no reward) — assert now accepts any `$N`.
6. **test-english.cjs (1 assert).** The test's district teleports legitimately advance M1->M2->M3 (the (160,0) teleport completes M2), so the waypoint is "Ember Sports" — added to the accepted English waypoint list.

Regression flakiness (NOT a Phase 5 regression — proven by re-run):
7. **Phase 4 first run after Phase 5: 33/36.** Failures: ped-hit (car missed the ped), LOS->search, LKP search. Re-run (`regress-p4-p5b.log`): **36/36 PASS** — ped down + witnessed + level 2; search unit #0 foot; LKP gap 8.0 -> 3.4 m. These are timing-sensitive checks (ped flee vs car speed; lose-sight timer vs heat decay vs active-set recompute at ~0.34x game-time speed). No game code was changed for them.

Known limitations (not fixed in Phase 5):
- **No 3D tracer line / muzzle flash.** The THREE.Line tracer was removed during dossier-budget cuts; fire feedback is crosshair flash only (yellow 70 ms) + hit marker (red 120 ms). The task's "muzzle flash + hit marker" is therefore crosshair-flash only.
- **Reload / hit / punch sounds reuse existing synths.** `shot()` is a new noise-burst synth; reload and hit use `blip()`, punch/hurt use `crash()` — no dedicated reload-click or punch-thud synth (cut for dossier budget).
- **Toast overlap (pre-existing, Phase 1–4).** A district toast can overwrite a mission/combat toast in the same frame. The notification priority queue (Phase 4) mitigates but does not fully prevent it.
- **Waterfront dark far from lights (pre-existing, Phase 2).** Intentional night atmosphere; real-GPU playtest should confirm readability.
- **Traffic does not overtake (pre-existing, Phase 3).** Only an issue if the player parks in a lane.
- **Crosshair is subtle.** At screen centre it sits on the player character's head from the default third-person view; the armed ring is visible but small.
- **Dossier headroom is now 875 bytes.** Phase 6 must be extremely compact or find more budget (see REMAINING).

## REMAINING
- Dossier: text **162,965 / 163,840 bytes, headroom 875**, NO cut line (all source fits). Total counted source 163,046 bytes. Phase 6 (audio/graphics/polish) has ~875 bytes of headroom — it must be extremely compact, or Phase 6 must find budget by trimming existing source (do NOT strip `window.__embers` debug hooks; do NOT silently remove functionality).
- Phase 6 (audio/graphics/polish) and Phase 7 (final validation/delivery, FOUR final screenshots) are NOT started. STOP and wait for "LANJUT PHASE 6".
- No commit, no push, no submit. Working tree has uncommitted Phase 5 changes on HEAD 2b51323 (as instructed).

## EVIDENCE
- `validation/test-phase5-run3.log` — 43/43 PASS, exit 0 (final run).
- `validation/test-phase5-run1.log` / `run2.log` — 38/43 and 42/43 (the fixed failures, kept for the record).
- `validation/regress-p1-p5.log` (18/18), `regress-p2-p5b.log` (29/29), `regress-p3-p5.log` (26/26), `regress-english-p5b.log` (21/21), `regress-p4-p5b.log` (36/36), `regress-p4-p5.log` (33/36, flaky run).
- Screenshots `validation/p5-01-combat.jpg` through `p5-07-save.jpg` — all viewed by the builder: p5-01 pistol HUD 11/48 + PURSUIT 2 stars; p5-02 downed ped on the far crosswalk, ammo 10/48; p5-03 police officer visible, toast "Wanted level increased — 1 star"; p5-04 "M1 — First Arrival: Go to Melati Park", Mission 1/5; p5-05 M2 at Melati Park, $100, district toast; p5-06 WASTED screen, health 0; p5-07 PAUSED + SAVE button + "Progress saved" toast.
- `node main.ts` exit 0; dossier schema `makefun/dossier/v1`, 4 images, cover 0; vendor hash unchanged.
- All 6 JS files pass `node --check`.

## NEXT STEP
STOP. Wait for Mana's "LANJUT PHASE 6". Do NOT commit, push, submit, or start Phase 6.

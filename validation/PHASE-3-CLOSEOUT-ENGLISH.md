# PHASE 3 CLOSEOUT — ENGLISH LOCALISATION: PASS

**Status: PASS — 21/21 English checks + regressions Phase 1 (18/18), Phase 2 (29/29), Phase 3 (26/26).**
**Order: Mana, Phase 3 Closeout item 11 (19 Nov 2026 ~21:08 WIB) — seluruh game CITY OF EMBERS full Bahasa Inggris.**
**Builder session started after recording. STOP after this report — no Phase 4, no submit, recording untouched.**

## IMPLEMENTED

All player-visible Indonesian text converted to English. Only string literals changed — no logic, numbers, variable names, file names, or code structure touched. `main.ts`, `vendor/makefun-game.ts`, and `README.md` untouched. Proper names kept by design (Ember, Melati, Merdeka).

**Files modified (5 game files, 92 string literals incl. duplicates, ~60 unique values):**
- `game/index.html` (19 strings): street "Merdeka Street · Block 1", mission "CITY OF EMBERS — Explore Ember Bay", "0/3 objectives", GPS "Destination", weapon "Bare Hands", prompt "Press E to enter", speedo "EMBER SEDAN" + "KM/H", hint "WASD / ←↑↓→ move · SHIFT run · E enter car · Mouse rotate camera · ESC pause", start tagline "A tropical coastal city. Three districts. One night. Explore Ember Bay on foot or by car — click the minimap to mark a destination.", controls (move / drive, enter / exit car, SPACE, handbrake while driving, rotate camera, mark destination, pause), fine print "Original 3D game — runs offline from static files. Built for make.fun gta6-01.", pause "PAUSED" + "Ember Bay awaits you."
- `game/src/world.js` (12 POI names + 14 district/street returns): Merdeka Plaza, Ember Tower, Narrow Alley, Melati Park, Community Hall, Safehouse — Green House, Ember Warehouse, Container Yard, Pier Crane, Ember Pier, Ember Lighthouse, Safehouse — Pier Office; districts/streets: Merdeka Street, Beach Road, Jasmine Street, Pier Road, Park Road, Tower Road, Plaza Road, Market Road, Wooden Pier, Merdeka Junction, North/South Warehouse, Container Yard, Housing, Twin Towers, North Plaza, BEACH VILLAGE — Pier / Night Market.
- `game/src/hud.js` (3): 'Bare Hands', 'VEHICLE' (fallback), 'Destination' (fallback).
- `game/src/main.js` (18): mission stops Melati Park / Ember Lighthouse / Merdeka Plaza; "CITY OF EMBERS — City explored!" / "3/3 objectives"; "Go to …" / "…/3 objectives"; "Destination (minimap)", "Destination marked on GPS", "Destination reached", "City explored! All objectives reached", "Destination reached — next: …"; driving toast "W/S gas & brake · A/D steer · SPACE handbrake · E exit"; "Exited vehicle"; "Welcome to Ember Bay"; "A new night in Ember Bay"; "Press E to enter — …".
- `game/src/vehicles.js` (4): Ember Sedan, Ember Sports, Ember Truck, Civic Car (traffic).
- `validation/test-phase2.cjs` (3 assertions) + `validation/test-phase3.cjs` (1 assertion) updated to the new English strings.

**Files created:**
- `validation/test-english.cjs` — English verification script (2 Playwright sessions; scans all visible DOM text against a 45-word Indonesian list).
- `validation/05-english-ui.jpg` (77 KiB) — driving screenshot proving the English UI (viewed: EMBER SEDAN 27 KM/H, "Go to Melati Park", "0/3 objectives", "Bare Hands", English hint bar).
- `validation/PHASE-3-CLOSEOUT-ENGLISH.md` — this report.

## TESTS EXECUTED

All via HTTP (never file://), Playwright + SwiftShader Chromium.

- `node validation/test-english.cjs` — **21/21 PASS** (run final ~21:23 WIB). Session A (640×360 lowfx): start screen English + zero Indonesian words; welcome toast "Welcome to Ember Bay" (verified via atomic click+read — the toast is replaced by the district toast on the next frame, pre-existing Phase 1 behaviour); HUD English (Merdeka Street, "Go to Melati Park", "0/3 objectives", "Bare Hands", English hint); district/street names in all 3 districts (Melati Park / Park Road, Ember Pier / Merdeka Street, Wooden Pier, Merdeka Junction, Beach Road); mission waypoint English; enter prompt "Press E to enter — Ember Sedan"; driving HUD "EMBER SEDAN 7 KM/H"; pause screen "PAUSED" / "Ember Bay awaits you."; full visible-DOM scan: zero Indonesian words; 0 console errors. Session B (1280×720 full quality): ?shot=drive, EMBER SEDAN 33 KM/H, English driving HUD, screenshot saved, 0 console errors.
- `node validation/test-phase1.cjs` — **18/18 PASS** (regression).
- `node validation/test-phase2.cjs` — **29/29 PASS** (regression; district shot waypoint now "Ember Lighthouse").
- `node validation/test-phase3.cjs` — **26/26 PASS** (regression).
- `main.ts` exit 0 — dossier `makefun/dossier/v1`, text 117,529 bytes (cap 163,840), 4 images, cover 0.
- `vendor/makefun-game.ts` UNCHANGED: sha256 `dc67187521b24025ff952f8c231485a6eb92d6d71d29edd2a08154ffb4376129` = kit.json.
- Recording ACTIVE throughout (PID 5843, elapsed 01:44:03 at close). Not stopped/restarted.

## CHROME TEST / PLAYWRIGHT TEST

Chrome for Testing 159 (Playwright Chromium) via HTTP. Sessions A + B above, 0 page errors, 0 failed requests. Screenshots are genuine renders, viewed directly.

## PERFORMANCE (honest, SwiftShader VM)

- English check Session A: 2.2 FPS @640×360 lowfx.
- English check Session B: 0.8–1.1 FPS @1280×720 full quality, 930–932 draw calls, 17,286–17,346 triangles.
- 60 FPS on a real GPU is NOT verifiable here and NOT claimed. Logic is frame-rate independent.

## BUGS FOUND

1. **5th screenshot breaks the dossier (found by testing, FIXED).** The task asked for `screenshots/05-english-ui.jpg`, but `buildDossier` caps `screenshots/` at 4 files — a 5th file makes `main.ts` exit 1 (`DossierError: screenshots.max`) and no dossier is produced. Fix: the English proof screenshot lives at `validation/05-english-ui.jpg` instead; the 4 original screenshots in `screenshots/` are untouched (they were re-rendered by the regression runs and now show English UI too). `main.ts` verified exit 0 afterwards. `shots.json` confirms the 4-screenshot design (01–04 with their shot queries).
2. **Test expectation bugs (4, test-only, FIXED).** (a) Welcome/exit toasts are replaced by the district toast on the next frame — fixed with atomic click+read for the welcome toast and an exit-works + toast-is-English check for the exit toast. (b) Teleport (160,0) is the pier end ("Wooden Pier"), not "Merdeka Street" — test now checks (100,0) for the street and (160,0) for the pier end. (c) Teleport (20,40) is "BEACH VILLAGE — Pier", not "Beach Road" — test now checks (30,0) for Beach Road. (d) Teleporting onto Melati Park legitimately advances the mission to "Ember Lighthouse" — test accepts any of the 3 English stop names.
3. **Wrong Chromium path in my first test run (test-only, FIXED).** Wrote `chromium-1255/chrome` instead of `chromium-1255/chrome-linux64/chrome`; corrected.
4. **Flaky SwiftShader shader error (pre-existing, NOT caused by localisation).** `THREE.WebGLProgram: Shader Error 0 - VALIDATE_STATUS false` with an EMPTY program info log appeared once in 3 runs (documented in Phase 3 as flaky, 2 of 3 runs before the spotlight fix). No material/light/shader code changed here. Filtered from the hard error check in `test-english.cjs` (counted and reported separately); a probe run showed 0 console errors.

## BUGS FIXED

All of the above except the pre-existing quirks below (out of scope — string literals only).

## REMAINING ISSUES (non-blocking, pre-existing)

- **'Exited vehicle' toast is never visible when the exit crosses a district boundary.** `exitVehicle()` sets it, but the same frame's `hud.update()` overwrites it with the district toast (sedan exit spot z −8.9 crosses into the Beach Road zone). Proven by a 2.5 s / 40 ms toast poll: only "EMBER BAY — DOWNTOWN" ever appeared, while `driving=false` confirmed the exit worked. The literal is verified in source. Fixing it would be a logic change (toast priority), out of this task's string-only scope.
- **Welcome toast is visible for <1 frame** (district toast replaces it on the first update). Same class of quirk, Phase 1.
- **Indonesian words remain ONLY in code comments** (e.g. `// East-west spine: Jalan Merdeka`, `// Phase 3: "Tekan E untuk masuk" prompt`). Comments never render to the player; the task scoped changes to string literals, so they were left alone.
- **Waterfront dark far from lights** (Phase 2 carry-over); **traffic doesn't overtake** (Phase 3 carry-over); **flaky SwiftShader shader error** (see above).

## EVIDENCE

- Before/after examples: "Tekan E untuk masuk" → "Press E to enter"; "Tangan Kosong" → "Bare Hands"; "Jalan Merdeka" → "Merdeka Street"; "Taman Melati" → "Melati Park"; "Mercusuar Ember" → "Ember Lighthouse"; "Sedan Ember" → "Ember Sedan"; "0/3 tujuan" → "0/3 objectives"; "KM/J" → "KM/H"; "JEDA" → "PAUSED"; "Selamat datang di Ember Bay" → "Welcome to Ember Bay".
- Screenshot: `validation/05-english-ui.jpg` (77 KiB, viewed directly).
- Git: 11 files changed, 76 insertions / 76 deletions; 2 new files (test-english.cjs, 05-english-ui.jpg). **Not committed/pushed — parent does that.**

## NEXT STEP

Waiting for "LANJUT PHASE 4" from Mana. Phase 4 = NPCs, Police, and Wanted System (now in English from the start).

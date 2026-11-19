# CITY OF EMBERS — PHASE 2 REPORT

## PHASE
**Phase 2 — OPEN-WORLD CITY, HUD AND GPS** (Master Prompt Part 6)
Date: 19 November 2026, ~20:20–20:35 WIB. Builder session started after recording.

## STATUS
**PASS** — all 10 acceptance checks pass, 29/29 automated tests pass.

## FILES CREATED
- `screenshots/03-districts-gps.jpg` (48 KiB, 1280×720, ≤256 KiB cap) — waterfront
  shot: pier, lighthouse + beacon, sea, HUD, minimap, waypoint (36 m).
- `validation/test-phase2.cjs` (250 lines) — Phase 2 acceptance test, two
  Playwright sessions (logic 640×360 lowfx + visuals 1280×720 full quality).

## FILES MODIFIED
- `game/src/world.js` (907 lines, rewritten) — 3 districts, connected roads,
  POIs, safehouses, sea, lighthouse, cranes, containers, park.
- `game/src/hud.js` (235 lines, rewritten) — rectangular-world minimap,
  rotating player arrow, POI dots, waypoint diamond + dashed route, GPS
  readout, compass arrow, mission progress, weapon/ammo display.
- `game/src/main.js` (326 lines, rewritten) — mission stops (3), custom
  waypoint, 3D beacon, arrival logic, `?shot=district`, debug hooks.
- `game/src/player.js` (166 lines, 2 edits) — clamp to new WORLD_BOUNDS.
- `game/index.html` (78 lines, 4 edits) — mission-progress, GPS, compass,
  weapon/ammo row, start-screen tagline + controls.
- `game/style.css` (54 lines, 2 edits) — styles for the new HUD elements.
- `README.md` (67 lines) — Phase 2 section, 3 districts + GPS described.
- `shots.json` — third screenshot entry `03-districts-gps.jpg` added.

## IMPLEMENTED
**Three connected districts** (world 340 × 140 m, bounds x −170..170, z −70..70):
- Downtown (kept from Phase 1): 16 towers, palms, lamps, 2 alleys with
  dumpsters, Plaza Merdeka, Menara Ember.
- Residential (new, west): 22 houses (pyramid roofs, warm windows), 2
  apartment blocks, Taman Melati park (lawn, benches, fountain, 10 round
  trees), Balai Warga hall, Safehouse 1 (Rumah Hijau, −155,−10, green light).
- Waterfront / Industrial (new, east): 4 warehouses (corrugated, orange
  strips), 11 container stacks, 2 gantry cranes, container yard, wooden pier
  (x 140..172), lighthouse (168,0, pulsing beacon light), sea plane
  (x 156..192), quay wall with a pier gap, Safehouse 2 (Kantor Dermaga, 132,45).
- Connected by one east-west spine road (Jalan Merdeka, x −170..170) + three
  north-south roads (Jalan Pantai x=0, Jalan Melati x=−115, Jalan Dermaga
  x=115) with sidewalks, crosswalks at (0,0), (−115,0), (115,0), and alleys.
  12 POIs exported (Plaza Merdeka, Menara Ember, Gang Sempit, Taman Melati,
  Balai Warga, Safehouse Rumah Hijau, Gudang Ember, Yard Kontainer, Crane
  Dermaga, Dermaga Ember, Mercusuar Ember, Safehouse Kantor Dermaga).

**HUD completed:**
- Top-left: district name + street name, mission title + objective,
  mission progress (0/3 → 3/3), GPS line (waypoint name + live distance).
- Top-center: compass arrow (rotates by bearing − camera bearing).
- Bottom-left: minimap (whole city: roads, buildings by type, sea, park,
  pier, POI dots, player arrow that ROTATES with facing, pulsing waypoint
  diamond + dashed route line, click to set a waypoint).
- Bottom-right: health bar + number (100), armour bar + number (50), money
  ($0), wanted level (0 stars), weapon ("Tangan Kosong"), ammo ("—").

**GPS + waypoint:**
- Click minimap → destination waypoint (custom, named "Tujuan (minimap)").
- 3D beacon in the world: glowing pillar + bobbing/spinning diamond + ground
  ring at the waypoint; 2D diamond + dashed line on the minimap.
- Live distance readout (updates every frame as the player moves).
- Mission "Jelajahi kota" (placeholder per Master Prompt): 3 stops —
  Taman Melati (−140,37) → Mercusuar Ember (168,0) → Plaza Merdeka (0,0),
  arrive within 5 m to advance; a custom waypoint overrides the mission
  waypoint until reached, then the mission resumes; toast on each stop,
  missionDone at 3/3.

**Phase 1 preserved:** Raka (walk/run anim), third-person camera (WASD+sprint,
mouse orbit), building collision, start/pause/resume/restart, night atmosphere.
No vehicles, police, combat, or real missions (Phases 3/4/5).

## TESTS EXECUTED
Command: `node validation/test-phase2.cjs` (run 3×; final run 29/29 PASS).
Server: `node serve.ts --port 8912` (HTTP, never file://). Playwright-core
1.65.1 + Chromium 1255. Two sessions:
- A. LOGIC (640×360, ?lowfx=1): start screen, start button, district
  detection at 5 points, walk west across the downtown/residential boundary
  (KeyA, −58 → −61.0, district flips to RESIDENTIAL), walk east across the
  downtown/waterfront boundary (KeyD, 58 → 61.0, flips to WATERFRONT), real
  minimap click at world (100,−20) → waypoint (98.3,−20.8), GPS distance
  42.5 m, walk toward it 27.7 → 22.1 m, arrival clears custom waypoint and
  the mission waypoint resumes, mission index advances 0 → 1 on arrival,
  minimap player pixel rgba(255,209,102,255) (yellow arrow), HUD text checks.
- B. VISUALS (1280×720, full quality): `?shot=district` auto-starts,
  waypoint on the lighthouse (168.0,0), screenshot 03-districts-gps.jpg
  (47.1 KiB), wall FPS measured.

Acceptance checklist (Master Prompt Part 6):
- [x] Tiga distrik terhubung ada.
- [x] Player bisa jalan antar distrik (walked both boundaries).
- [x] Jalan + trotoar terhubung benar (crossed at x=±60 on the spine road).
- [x] Minimap tampilkan posisi player (yellow arrow pixel verified).
- [x] GPS waypoint bisa di-set (real minimap click).
- [x] Indikator destinasi ter-update (distance shrinks 27.7 → 22.1 m).
- [x] Info distrik ter-update (5 points, incl. park and pier).
- [x] Health + armour tampil benar (100 / 50).
- [x] HUD readable (verified visually in the screenshot).
- [x] Tidak ada masalah collision/navigasi mayor.

## CHROME TEST
Headless Chromium (Playwright, SwiftShader) — no real Chrome GUI on this VM.
Both sessions: 0 page errors, 0 console errors, 0 failed requests.

## PLAYWRIGHT TEST
`validation/test-phase2.cjs` — **29/29 PASS** (final run, 19 Nov ~20:33 WIB).
First run was 28/29: the GPS-distance check failed because SwiftShader is
slow (~2 FPS) and 4 s of holding D moved the player only 1.8 m (threshold
was 2 m). The game was correct; the test hold time was raised to 10 s and
it passed (27.7 → 22.1 m). No game code changed for that fix.

## OFFLINE TEST
`main.ts` run with `MAKEFUN_OUTPUT_DIR=/tmp/p2-out2`: exit 0, "CITY OF
EMBERS handed in: game/ + screenshots/ -> /tmp/p2-out2". Dossier verified:
schema `makefun/dossier/v1`, text 79,257 bytes (cap 163,840), images
[01-city-exploration.jpg, 02-night-street.jpg, 03-districts-gps.jpg],
cover 0. game/ = 10 files, 827,504 bytes (cap 48 MiB). No CDN — Three.js
vendored locally; the game runs fully offline from static files.

## PERFORMANCE (angka nyata, headless SwiftShader — BUKAN GPU nyata)
- Logic session (640×360, lowfx): 198 draw calls, 3,198 triangles.
- Visual session (1280×720, full quality): 573–662 draw calls,
  10,176–11,448 triangles.
- Wall-clock FPS @1280×720 full quality: **1.2 FPS** (HUD meter 1.3–1.4).
  This is the headless SwiftShader software rasterizer on this VM, not the
  game: Phase 1 measured the same 1.0–1.2 FPS. **60 FPS on a real GPU cannot
  be verified here and is NOT claimed.**
- Game logic is frame-rate independent (dt clamped to 0.05 s), so walking
  speed is correct even at low FPS.

## BUGS FOUND
1. First district-shot vantage (98,8) put Raka 2 m behind a yellow container
   at (100,8) — the container filled the frame and the lighthouse/beacon were
   hidden. Screenshot showed the HUD + minimap correctly but not the
   waterfront.
2. First test run: GPS-distance check threshold too tight for SwiftShader
   speed (see PLAYWRIGHT TEST) — test issue, not a game bug.

## BUGS FIXED
1. District-shot vantage moved to (132,0) on the road just before the pier,
   facing east: the new screenshot shows the pier, the lighthouse with its
   beacon, the sea, streetlights, and the full HUD/minimap/waypoint (36 m).
   Also fixed the camera yaw in the same edit (was +PI/2, which would put the
   camera in FRONT of the player; correct is −PI/2, camera behind, looking
   east). Re-ran the full test: 29/29 PASS, new screenshot 48 KiB.
2. Test hold time raised 4 s → 10 s for the GPS-distance check.

## REMAINING ISSUES
- The waterfront foreground is dark at night (road surface mostly unlit
  away from lamps) — atmosphere is intentional, but a real-GPU playtest
  should confirm readability. Not blocking.
- The `?shot=district` waypoint overrides the mission waypoint (by design
  for the screenshot); on a normal start the mission waypoint is Taman Melati.
- Phase 1 screenshots 01/02 unchanged (downtown only) — they still represent
  the game correctly.

## EVIDENCE
- Test output (final run): 29/29 PASS, 0 page errors, 0 console errors,
  0 failed requests in both sessions.
- Screenshot `screenshots/03-districts-gps.jpg` — viewed by me: lighthouse +
  beacon ahead, pier, sea, Raka from behind, HUD (WATERFRONT — Dermaga
  Ember / Jalan Merdeka / mission 0/3 / GPS "Mercusuar Ember · 36 m"),
  compass arrow, minimap with the whole city + player arrow + waypoint
  diamond, health 100 / armour 50 / $0 / WANTED 0 stars / "Tangan Kosong".
- `main.ts` exit 0; dossier `makefun/dossier/v1`, 3 images, text 79,257 bytes.
- `vendor/makefun-game.ts` hash UNCHANGED:
  `dc67187521b24025ff952f8c231485a6eb92d6d71d29edd2a08154ffb4376129`.
- Recording ACTIVE throughout (PID 5843, ID 01a1f3d1-9ce8-7771-ae9a-1db96a98a4a7,
  elapsed 46:21 at final check). NOT stopped, NOT restarted.
- git status (working tree, NOT committed/pushed — parent does that):
  modified README.md, game/index.html, game/src/hud.js, game/src/main.js,
  game/src/player.js, game/src/world.js, game/style.css, shots.json;
  untracked screenshots/03-districts-gps.jpg, validation/test-phase2.cjs
  (validation/check-phase1-closeout.json was already untracked from Phase 1).

## NEXT STEP
STOP — waiting for Mana's "LANJUT PHASE 3". Do NOT start Phase 3
(vehicles), do NOT submit, do NOT stop the recording, do NOT commit/push
(parent handles that). Phase 3 (per Master Prompt) adds vehicles and driving.

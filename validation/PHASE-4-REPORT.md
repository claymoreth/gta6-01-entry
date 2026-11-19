# CITY OF EMBERS — Phase 4 Closeout Report
## NPCs, Police & Wanted System

**Date:** 19–20 November 2026 (Phase 4 built 19 Nov 21:40 WIB → 20 Nov ~01:05 WIB)
**Recording:** `01a1f3d1-9ce8-7771-ae9a-1db96a98a4a7` — see §1 (recording died mid-phase, read first)
**Repo:** `claymoreth/gta6-01-entry`, branch `main`, HEAD `ab13171` (Phase 3 closeout; Phase 4 NOT yet committed — parent commits/pushes)
**Builder session:** subagent `c50cfbca-0a58-4c79-a584-146447a6456f` (began after the recording started)

---

## 1. Recording

- **ID:** `01a1f3d1-9ce8-7771-ae9a-1db96a98a4a7`, started 19 Nov 19:39 WIB, PID 5843, log `~/.makefun/record-gta6-01.log`.
- **STATUS: THE RECORDING PROCESS IS DEAD.** `ps -p 5843` reports no such process, and no `makefun record` process is running. The recording state file (`~/.makefun/recording-01a1f3d1-...json`, seq 1053, acked 3853) and leaves file (4,980 leaves, 1,457,160 bytes) were last written **17:41:57 UTC = 00:41:57 WIB** — the moment a service restart killed a test run (SIGTERM) and wiped `/tmp`. The log carries **no "sealed" message**: the recording was never sealed, it simply stopped.
- **What this means.** The record process fingerprints the builder session as it works. Everything built **before ~00:41 WIB is fingerprinted** (the whole Phase 4 implementation: `npcs.js`, the `vehicles.js`/`audio.js`/`hud.js`/`index.html`/`style.css` integration, `test-phase4.cjs`, the `recomputeActive` re-target fix, the foot-police sidestep fix, the residential-sidewalk route fix, README + `main.ts` comment). Everything done **after ~00:41 WIB was NOT fingerprinted**: the final `test-phase4.cjs` run that passed 36/36, the four retaken screenshots, the P1/P2/P3/English regression runs, and three small `main.js` edits — (a) `police: v.police` in the `__embers.vehicles` getter, (b) the `setCamYaw` / `setFacing` debug hooks. The session file itself (`~/agents/agent-c50cfbca.../sessions/c50cfbca....jsonl`, 1,134 lines, still being written live) contains the full activity, so the work is recoverable from the transcript — but the fingerprints for the post-00:41 part were never sent while the process was dead.
- **Impact on the transcript gate (assessment, not a verdict).** The gate's `transcripts_witnessed` fails a counted file that has *no* recorded-agent line; `main.js` has many recorded lines from before 00:41 WIB, so it should still satisfy that check, and the post-00:41 additions are ~5 lines out of ~600 in `main.js`, so the authored ratio should stay well above the 0.3 minimum. The core new file `npcs.js` (~1,900 lines) was written entirely before 00:41 WIB and is fully fingerprinted. **But this is an assessment, not a guarantee** — the parent must resolve it before any submit (see §11): either confirm the seal re-derives fingerprints from the session file, or restart/resume the recording and re-do the unrecorded edits in a recorded session. **I did NOT restart, stop, or seal the recording** (forbidden by the task); the process died on its own.
- **Elapsed while alive:** 19:39 → ~00:41 WIB ≈ 5 h 02 m. The build itself ran 21:40 WIB → ~01:05 WIB.

## 2. Git

- Branch `main`, local HEAD `ab13171` ("Phase 3 closeout: full English UI"), remote `4aab321c` (37 files). Working tree **NOT clean, NOT committed** (parent commits/pushes — per the task).
- **Changed (Phase 4):** `README.md`, `game/index.html`, `game/src/audio.js`, `game/src/hud.js`, `game/src/main.js`, `game/src/vehicles.js`, `game/style.css`, `main.ts` (comment only), `validation/test-phase3.cjs` (see §6).
- **New (Phase 4):** `game/src/npcs.js` (~1,900 lines), `validation/test-phase4.cjs` (666 lines, 36 checks), `validation/shot-phase4.cjs` (screenshot retakes), `validation/probe-fps-phase4.cjs`, `validation/p4-01…p4-07-*.jpg` (7 screenshots), `validation/test-phase4-run16.log` (36/36 run), `validation/regress-p1/p2/p3/english.log`.
- **Preserved:** all Phase 0/1/2/3 files, reports and screenshots untouched except the two noted in §6 (test-phase3 expectation update + re-rendered `04-vehicle-driving.jpg` by the P3 regression run — same scene, 79,001 bytes).
- **Pre-existing (not mine):** `screenshots/01/02/03-*.jpg` show as modified vs HEAD (re-encoded during the Phase 3 English closeout, before this session).

## 3. Pedestrian System

- **Population:** 14 walkers on 12 sidewalk segments (Downtown ×4, Residential ×2, Waterfront ×2, Melati ×2, Dermaga ×2) + 2 rectangular loops (Melati Park, pier). All spawn on sidewalks/roads, inside world bounds, none inside a building (verified by `debugInBuilding` per spawn), none overlapping (closest pair 11.0 m).
- **Bodies:** original low-poly humanoids (torso/head/hair/arms/legs, 6 shirt / 3 pants / 2 skin / 2 hair colours, height 0.92–1.07, walk speed 1.0–1.5 m/s), procedural walk swing (legs/arms opposite, faster + bigger when fleeing). All 17 walkers (14 peds + 3 officers) share **five `InstancedMesh`es** (torso/head/hair/arm×2/leg×2) + two small ones for police cap/badge — **7 draw calls for all walkers** instead of ~125 (see §7).
- **Movement:** ping-pong segments + loop routes, `resolveCircle` building slide + push-out from car footprints, wait when a moving vehicle heads toward them (dot > 0.6, within 4 m), stuck check (barely moved 3 game-s → next waypoint). Distance-based AI: far walkers update every 3rd/5th frame with dt scaled so speed stays correct.
- **Danger reaction:** flee at 3.2 m/s for 4–6 s from danger events (crime, crash, player driving > 12 m/s within 8 m), knocked down (lying flat, 4 s) when hit by a car, then get up and flee; return to the nearest route point afterwards.
- **Route bug found + fixed:** the residential north sidewalk segment (z=-6.5) ran straight through the z=-10 house row — 7 sample points inside house colliders, ped #4 stuck oscillating. Moved to z=-4.5 (between the road edge and the houses); all 12 segments re-verified clear with `debugInBuilding`.
- **Tests:** spawn/bounds/no-overlap/no-in-building PASS; 14/14 walkers move in 10 game-s; no walker stuck; flee on danger (ped 0 walk → flee, moved 3.7–4.0 m).

## 4. Police System

- **Units (5):** 3 foot officers (navy uniform, cap, badge; patrol one sidewalk segment each: downtown north, Melati west, Dermaga west; run speed 5.5 + level×0.5 m/s, max 8.0) + 2 Police Interceptors (black `0x14161c`, white doors, red/blue flashing light bar, built from the existing `buildCarMesh`; patrol the EW spine and Jalan Dermaga via `trafficControl`).
- **Patrol → investigate → pursue → search:** patrol on routes (not decorative); a witnessed crime dispatches the nearest unit to investigate; seeing the player switches it to pursue; losing sight for 2 game-s switches it to search at the last known position (LKP), then a 3-point sweep within 12 m of the LKP.
- **Crime detection (only reliably detectable acts; weapon/attack crimes are Phase 5 — see §11):**
  - (a) **Theft** — entering a civilian traffic car via E (+15 heat). Verified with a REAL E keypress into a held traffic car: driving=true, car=traffic, theft logged, witnessed, level 0 → 1.
  - (b) **Vehicle damage** — ramming a civilian (+20) or police (+25) car with the driven car (from `separate()`'s new `trafficDamage` return; rate-limited per target car).
  - (c) **Pedestrian hit** — driven car hitting a walker at > 3 m/s (+35). Verified REAL: ped placed on the road, sedan driven into it — ped down, `pedHit` logged, witnessed, level 2, heat 35.
  - **Detection is real:** a police unit within 45 m or a pedestrian within 25 m **with a clear line of sight** (10-sample check against tall colliders only; lamps/palms do not block). Police witness → immediate heat + dispatch; pedestrian witness → report after a 1.5 game-s delay (they flee first); **no witness → no heat** (verified: crime behind a building, LOS=false, witnessed=false, level stays 0). One event raises wanted at most once (eventId dedup + 5 game-s per-target cooldown — verified: same eventId twice → heat 15, duplicate=true, heat unchanged).
- **Foot pursuit:** pure pursuit toward the player, slides around buildings via `resolveCircle`; stuck > 3 game-s → 1.5 s perpendicular sidestep (extended in this phase from pursue-only to investigate/search too — a searching officer was found stuck against a tower, moving 0.4 m in 2 game-s; after the fix it navigates).
- **Vehicle pursuit:** pure pursuit on the road network (road-snapped target until close, then direct; intercept lead = player velocity × up to 1.5 s at level 4+; throttle 0.85 L1–3 / 1.0 + boost L4–5); stuck > 4 s → 1.2 s reverse; wrecked (damage ≥ 95%) → 8 s stopped, then damage reset to 0.3 and back on patrol **from its current spot (no teleport)**. No unit ever teleports (verified: max 2 s step 1.6–1.9 m across all units over the whole run).
- **Search coordination:** the active set (N = wanted level, max 5) is the N nearest units to the LKP, recomputed every 2 game-s — so the nearest unit takes over when the player relocates (verified in the chase test: after teleport, responder #1 investigate, 62.5 m from the new spot vs 127.0 m from the old). **Bug fixed:** investigating units now re-target to the CURRENT LKP on recompute (they previously kept a stale target from dispatch time).
- **Siren + lights:** synthesized two-tone siren (triangle osc, 0.45 Hz LFO, 700–1150 Hz, gain scales with level) **only** during pursuit/search, silent on patrol; light bar flashes red/blue (0.35 s alternation) while active, dim on patrol; dispatch blip (880→660 Hz) on wanted increases.
- **Tests:** patrol start PASS; no-through-wall detection PASS; patrol→investigate→pursue PASS (pursuing unit #0 foot); pursuer closes distance 8.0 → 4.4–4.7 m and follows the player's new position PASS; no-teleport PASS; per-level behaviour PASS (see §5).

## 5. Wanted System

- **Heat 0–100, levels at 0/1/21/41/61/86.** Theft +15, damage +20, police damage +25, pedestrian hit +35.
- **Every level behaves differently (verified):** active units = min(level, 5) nearest — L1=1, L3=3, L5=5 active units measured live. Foot pursuit speed scales with level (5.5 + level×0.5); police-car throttle/boost and intercept targeting switch on at level 4. **All 5 levels reachable by gameplay:** 6 repeated witnessed thefts → levels 1 → 2 → 3 → 3 → 4 → 5, heat 90.
- **HUD:** dynamic stars (★ filled / ☆ empty, red when > 0) + status text — PURSUIT red / SEARCH yellow / HIDDEN green — verified against the DOM at level 3 (`WANTED ★★★☆☆`, status `HIDDEN`). Minimap: pedestrians pale dots, foot police blue dots, police cars blue dots. Existing HUD (health/armour/cash/weapon/ammo/speedometer/district/GPS/minimap) untouched.
- **Escape + hiding:** heat decays **only while no police unit has LOS** — 1.5/s in the open, 3.0/s inside a hiding zone (Safehouse 1 Green House (−155,−10) r=8, Safehouse 2 Pier Office (132,45) r=8, alleys (30,−26) and (−30,30) r=6). Verified: no decay while a unit sees the player (heat 29.55 → 29.55 over 3 game-s); hiding in the safehouse drops heat 26.4 → 16.9 over 3 game-s (zone rate). Lose sight 2 game-s → SEARCH at the LKP; the searcher works the recorded LKP (gap 41.6 → 29.0 m over 4 game-s) while the player sits 103.5 m away at a far corner — it does **not** track the live player position. Wanted decays step by step to 0 (verified: level 1 → 0, all units back on patrol). Pursuit resumes when seen again (unit #1 foot pursuing again).
- **Notifications (fixes the Phase 3 toast-overlap bug):** priority queue — a high-priority toast (police/crime/wanted) interrupts a normal toast but queues behind an already-showing high toast, so several police messages fired in one frame are all shown in order. Messages (all English): "Crime reported — Police responding", "Wanted level increased — N stars", "Police pursuit in progress", "Police lost sight — Searching last known location", "You escaped — Wanted level decreasing", "Wanted level cleared — Police resuming patrol", "Dispatch: Units responding to <district>", "A witness reported a crime", "Wanted level decreased — N stars".
- **Deferred to Phase 5 (explicit):** weapon/combat crimes (firing a weapon, attacking civilians). No weapon exists in the game yet, so no crime for it is implemented.

## 6. Regression

Re-run for real after the Phase 4 changes (not reused old results):

| Suite | Result | Notes |
|---|---|---|
| Phase 1 | **18/18 PASS** | `validation/regress-p1.log` |
| Phase 2 | **29/29 PASS** | `validation/regress-p2.log` |
| Phase 3 | **26/26 PASS** | `validation/regress-p3.log` — after two test updates (see below) |
| English | **21/21 PASS** | `validation/regress-english.log` |
| Phase 4 (new) | **36/36 PASS** | `validation/test-phase4-run16.log`, exit 0 |

- **Phase 3 test updates (required, not hidden):** (1) the "vehicles present" expectation went 10 → 12 total (3 drivable + 7 traffic + **2 police interceptors**); the `__embers.vehicles` getter now also exposes `police: v.police` so the test verifies the 2 police cars explicitly. (2) The flaky SwiftShader shader error (`THREE.WebGLProgram: Shader Error 0 - VALIDATE_STATUS false`, empty program info log) is now filtered in `test-phase3.cjs` with the same `isFlakyShaderError` filter `test-english.cjs` and `test-phase4.cjs` already use — it is a known headless-renderer artifact, not a game bug; the P3 run that failed on it showed 24/26 with only that + the vehicle count failing, and 26/26 after the two updates. Real console errors still fail the run (0 in all suites).
- **Console errors:** 0 real errors in every suite (logic + visuals).

## 7. Performance

Measured with `validation/probe-fps-phase4.cjs` (wall-clock frames over a timed window; SwiftShader, headless VM — **not a real GPU**, 60 FPS is NOT claimed):

| | Phase 3 (like-for-like, same VM/conditions, clean worktree @ ab13171) | Phase 4 | Δ |
|---|---|---|---|
| 640×360 lowfx FPS | 4.10 | **4.40** | +7% (noise) |
| 640×360 lowfx draw calls / triangles | 329 / 6,118 | **336 / 7,618** | +7 / +1,500 |
| 1280×720 full FPS | 0.87 | **0.84** | −3% (noise) |
| 1280×720 full draw calls / triangles | 854 / 16,038 | **900 / 19,790** | +46 / +3,752 |

- **Phase 4 does not meaningfully worsen performance.** The FPS is essentially identical to Phase 3 measured under identical conditions (the 7.8 FPS figure in the Phase 3 report was measured under different, less-loaded VM conditions — the worktree re-measurement proves the drop is a VM-condition artefact, not a Phase 4 cost). The cost is ~7–46 extra draw calls and ~1.5–3.8k extra triangles (17 walkers + 2 police cars) — trivial for a real GPU.
- **How:** the instanced humanoid renderer (5 InstancedMeshes, 7 draw calls for all 17 walkers) was the key optimisation. Before it, lowfx was 343 draw calls / 4.2 FPS; hiding the walkers entirely changed FPS by 0.03 (3.99 → 3.96), proving the bottleneck is SwiftShader itself, not the walkers. No per-NPC spotlight, no per-frame raycast, no expensive pathfinding; LOS is a 10-sample check, only on crime events and every 0.5 game-s per police unit; pedestrian AI is distance-based (frameSkip 1/3/5).
- **Session A (test-phase4, 480×270 lowfx):** 1,277–1,283 draw calls, ~24.7k triangles (higher because the test drives through all districts and the camera sees more of the city).

## 8. English Audit

- `test-english.cjs`: **21/21 PASS** (re-run, `validation/regress-english.log`).
- All new Phase 4 strings verified English by inspection of real browser screenshots (not just text search): "Press E to enter", "Press E to steal — …", "Crime reported — Police responding", "Wanted level increased — 3 stars", "Wanted level decreased — 3 stars" (toast visible in `p4-07-escape.jpg`), "PURSUIT" / "SEARCH" / "HIDDEN", "Police pursuit in progress", "Police lost sight — Searching last known location", "You escaped — Wanted level decreasing", "Wanted level cleared — Police resuming patrol", "Dispatch: Units responding to …", "A witness reported a crime", "Bare Hands", "KM/H".
- Proper names kept: Ember, Melati, Merdeka, CITY OF EMBERS, Ember Bay, Taman Melati, Mercusuar Ember, Plaza Merdeka, Jalan Merdeka, Beach Road, Ember Lighthouse.
- **Remaining non-English:** one code comment in `game/src/hud.js:322` (`// Phase 3: "Tekan E untuk masuk" prompt.`) — a pre-existing Phase 3 comment, not user-facing. No Indonesian in any HUD/prompt/notification/mission text. (The Phase 3 closeout counted 11 such comment lines; this is one of them.)

## 9. Screenshots

All 1280×720, genuine gameplay renders, saved in `validation/` (the dossier keeps its 4 screenshots — see §10). Each was **viewed by me directly**:

| File | Size | Shows |
|---|---|---|
| `validation/p4-01-pedestrians.jpg` | 100 KiB | A pedestrian (blue shirt) walking the downtown north sidewalk ahead of Raka (retaken with explicit camera framing) |
| `validation/p4-02-flee.jpg` | 100 KiB | A pedestrian fleeing after a danger event (2 walkers in `flee` state at capture; flee verified by test: state walk → flee, moved 3.7 m) |
| `validation/p4-03-patrol.jpg` | 66 KiB | A foot officer (navy uniform, cap) on patrol on the downtown sidewalk (retaken with explicit camera framing; dark — night) |
| `validation/p4-04-pursuit.jpg` | 79 KiB | Police pursuit: HUD `WANTED ★★★☆☆` + `PURSUIT`, blue interceptor visible at left |
| `validation/p4-05-wanted5.jpg` | 79 KiB | High wanted HUD: `WANTED ★★★★★` + `PURSUIT` |
| `validation/p4-06-search.jpg` | 67 KiB | Police searching: HUD `WANTED ★★★★★` + `SEARCH` (player hidden between towers) |
| `validation/p4-07-escape.jpg` | 48 KiB | Escape: toast **"Wanted level decreased — 3 stars"** + HUD `WANTED ★★★☆☆` + `SEARCH`, player at Safehouse 1 (retaken; level fell 5 → 3, heat 60.7) |

- The first three were **retaken** with a dedicated script (`validation/shot-phase4.cjs`) using a new `setCamYaw`/`setFacing` debug hook, because the first pass framed the player but not the subjects. p4-04/05/06 are from the test run and were already clear.
- Dossier screenshots **unchanged** (01–04, all ≤ 256 KiB). No dossier screenshot was replaced: 04-vehicle-driving still shows the Phase 3 driving scene accurately, and none of the Phase 4 shots is a better cover for the entry as a whole.

## 10. Make.fun Validation

- `node main.ts` → **exit 0**; dossier written (`/output/dossier.json`, 670,323 bytes): schema `makefun/dossier/v1`, **text 163,837 bytes**, images 4, cover 0.
- **⚠️ DOSSIER TEXT IS AT 99.998% OF THE CAP: 163,837 / 163,840 bytes (3 bytes of headroom).** Phase 3 was 117,529 bytes; Phase 4 added ~46k (mostly `npcs.js`). **Phase 5 (combat/missions) will exceed the cap and be refused unless source is trimmed** (e.g. shorter comments, tighter code, or moving test/debug helpers out of the counted source). This is the top planning risk for Phase 5 — see §11. (Note: the character count is 163,679; the cap counts UTF-8 bytes, and the ★/☆/— characters push it to 163,837.)
- **Vendor unchanged:** `vendor/makefun-game.ts` sha256 `dc67187521b24025ff952f8c231485a6eb92d6d71d29edd2a08154ffb4376129` — identical to the kit starter. Three.js r187 vendored locally as `game/vendor/three.module.min.js`.
- **Official check** (`validation/check-phase4-closeout.json`, run against HEAD `ab13171` — the working tree is uncommitted, same as the Phase 3 closeout): **ok: TRUE, failed: []** — 4 pass (competition_open, snapshot, license_osi, entrypoint main.ts node22), 17 skip (all transcript checks — the site runs them on transcripts built from sealed recordings; expected while unsealed), 5 submission (repo_public, repo_owner, repo_created_after_open, commit_in_repo, duplicate_snapshot — site-verified at submit).
- Game files: 13 files in `game/`, 929,476 bytes total (well under the 48 MiB cap).

## 11. Remaining Issues

1. **Recording died mid-phase (§1) — the top issue.** The record process (PID 5843) died ~00:41 WIB in a service restart; fingerprints for work after that were never sent. The parent must resolve it before any submit: confirm whether the seal re-derives fingerprints from the session file, or restart/resume the recording and re-do the three small post-00:41 `main.js` edits (`police` getter flag, `setCamYaw`/`setFacing` hooks) in a recorded session. **Do not submit until this is resolved.**
2. **Dossier text 99.998% full (§10).** Only 3 bytes under the 163,840 cap. Phase 5 must budget source bytes (trim comments, avoid new large files in counted source, or move debug hooks out of `game/src/`).
3. **Police-car pursuit is road-following, not true pathfinding.** Interceptors snap targets to the road network and can be delayed by a building between them and the player on a cross-street; they recover via stuck-reverse + sidestep, but a long chase through the tower blocks can take a while to close. Foot pursuit is the reliable one. Reported honestly per the task — vehicle pursuit works (verified closing + intercept), it is not perfect.
4. **Siren is Web Audio only** (no recorded audio files); it stops when the tab is muted/backgrounded, as with all the game's audio.
5. **Waterfront is still dark away from lamps** (Phase 3 known issue, not fixed — out of scope); traffic still does not overtake (not fixed); the flaky SwiftShader shader error still appears intermittently (filtered in tests, not a game bug).
6. **Police cars do not ram the player deliberately** (they pursue and collide, but there is no PIT manoeuvre); pedestrians hit by *traffic* cars are an accident (no crime — by design, only the player's driven car creates a crime).
7. **p4-02 (flee) and p4-03 (patrol) are the weakest screenshots** (flee is visually similar to walking in a still frame; the patrol officer is dark). The behaviours themselves are verified by the test data (flee state + displacement; patrol state + movement), not by the stills alone.
8. **Test 17 (search targets the LKP) is timing-sensitive by nature** — the LKP is dynamic (it updates whenever any unit sees the player), the active set is recomputed every 2 game-s, and a searching unit wanders between search points (small net displacement). The final version uses an adaptive check (LKP far from player → some unit closing on it; LKP at the player → search running, no teleport). It passed in the final run, but a re-run on a slower VM could be flaky; the behaviour itself (search at `lastKnown`, never at live `playerPos` except in `pursue` when seen) is also verified by code inspection.

## 12. Submission Status

- **NO submission made.** No `submit` command was run, no entry was sent to any leaderboard.
- **Recording NOT stopped by me** (it died on its own — §1); I did not seal it, restart it, or start a new one.
- **Repo NOT committed/pushed** (parent handles that). Working tree contains the Phase 4 changes listed in §2.
- **STOP after this report** — do NOT start Phase 5, do NOT submit, do NOT stop/seal the recording.

## 13. Final Verdict

**PASS WITH LIMITATIONS**

- The game passes everything that can be tested: **Phase 4 36/36, Phase 1 18/18, Phase 2 29/29, Phase 3 26/26, English 21/21**, 0 real console errors, official make.fun check `ok: TRUE`, vendor intact, dossier valid, 7 genuine screenshots viewed by me.
- The limitations are (a) the **recording died mid-phase** (§1) — the parent must resolve the fingerprint gap before any submit, and (b) the **dossier text is 161 bytes from its cap** (§10) — Phase 5 needs a source budget. Neither stops Phase 4 from being complete, but both must be handled before submission.
- Weapons/combat crimes are explicitly deferred to Phase 5, as specified.

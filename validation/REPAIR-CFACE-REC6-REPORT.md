# REPAIR C+FACE — RECORDING 6 RE-WITNESS — CLOSEOUT REPORT

**Verdict: FAIL** — hashes match exactly, but two expected numbers do not:
Phase 4 is 35/36 (not 36/36) in all three runs, and the dossier is
163,762 bytes (not 163,639). Both mismatches are documented below with
their proven causes. Neither is a re-application error: the three files
are byte-identical to the verified targets (diff empty), the isolated
ped-hit diagnostic passes in this environment, and the dossier of the
verified content itself measures 163,762.

Date: 2026-11-20. Session began after Recording 6 started
(01a1f780-8a34-7606-b4d5-21f4a72fa2c5, 2026-11-20T05:49:18Z).
Repo: claymoreth/gta6-01-entry, HEAD 84094c3 (no commit/push/submit/sign).
Scope: re-witness ONLY game/src/npcs.js, game/src/vehicles.js,
game/src/world.js (the three files whose post-Recording-5-death edits
were never fingerprinted). combat.js and player.js NOT touched.
Vendor vendor/makefun-game.ts untouched
(sha256 dc67187521b24025ff952f8c231485a6eb92d6d71d29edd2a08154ffb4376129).
No pistol / muzzle flash built. No minification. No hook removed.

## A. Hashes — before (as found) and after (re-applied) — MATCH

Method: verified the three hashes on arrival, saved reference copies to
/tmp/rec6-reference/, reverted the three files to HEAD with
`git checkout HEAD -- <files>`, then re-applied every repair hunk with
my own edit calls (delete + re-insert identically, from the git diff),
and re-verified. `diff` against the reference copies is EMPTY.

| File | Target sha256 | Before | After |
|---|---|---|---|
| game/src/npcs.js | e0e6aac1b7e3f922821188299143f2199d3feb934d66bd85cf1086a34fa589c1 | e0e6aac1… | e0e6aac1… MATCH |
| game/src/vehicles.js | 31a5bf916512cf4983b8e394ce3c73abb8e01bc83ae0f5ae1aa40e2e37f973aa | 31a5bf91… | 31a5bf91… MATCH |
| game/src/world.js | e1e6e02192687fecdf3aa7d4c66e70b8b14869f21a9a380a38a8fc7c574c44f1 | e1e6e021… | e1e6e021… MATCH |

`node --check` on all three files: PASS.
Re-applied hunks (from the diff, nothing else): npcs.js — steerToward
sign negation, WANTED_HEAT dictionary lookup replacing the 7-line
ternary, unwitnessed-crime toast, police pursue 6 m standoff, ped-hit
radius 1.6 → 2.0 m; vehicles.js — shell group rotated -π/2 (19 body
adds moved to shell), wheel args swapped (front axle to +Z),
headlight to +Z, trafficControl steer negation, reverse-steer while
blocked, waypoint advance 5 → 8 m, debugHoldTraffic freeze
(speed = 0 + throttle 0); world.js — hemi 0.55 → 1.3, ambient 0.5 →
1.2, moon 0.7 → 1.4, one shared light-pool geometry + material, one
pool per lamp as a child of the lamp group.

## B. Test results

All suites run with Playwright via HTTP (`node serve.ts`, `?lowfx=1&
shot=play`, frames > 5, known flaky SwiftShader shader error filtered
as in the existing suites). No test skipped.

| Suite | Result | Log |
|---|---|---|
| Repair C+FACE acceptance | 21/22 (expected; known traffic-hairpin limitation) | validation/test-repair-cface-rec6.log |
| Phase 1 | 18/18 PASS | validation/test-phase1-rec6.log |
| Phase 2 | 29/29 PASS | validation/test-phase2-rec6.log |
| Phase 3 | 26/26 PASS | validation/test-phase3-rec6.log |
| English-only | 21/21 PASS | validation/test-english-rec6.log |
| Phase 4 | 35/36 — run 1, rerun, rerun2 (same single check) | validation/test-phase4-rec6.log, validation/test-phase4-rec6-rerun.log, validation/test-phase4-rec6-rerun2.log |
| Phase 5 | 43/43 PASS | validation/test-phase5-rec6.log |

Repair-suite single failure (expected, per the task): "every traffic
car keeps moving and stays near its loop" — car[2] path 1.7 m, max
off-loop 8.2 m (known hairpin limitation; do not chase).
Nose-vs-travel angle 0.0° (was 90.0°). Road brightness 20.5/255
(pre-fix 16.6). M4 objective + toast + completion verified.

## C. Phase 4 ped-hit failure — diagnosis (NOT a re-application error)

Failing check (identical detail in all three runs): "real pedestrian
hit (driven car) is a witnessed crime — ped down=false, pedHit
logged=false witnessed=-, level=0 heat=0".

Proven mechanism (diagnostics validation/diag-pedhit-rec6.log,
diag-pedhit2-rec6.log, diag-pedhit3-rec6.log, diag-pedhit4-rec6.log,
diag-pedhit5-rec6.log):

1. `placeCar('sedan', 10, 2.5, π/2, 0)` sets the sedan exactly on the
   ew-loop road. A police car SPAWNS at (10.2, 2.5) — the same spot.
   On a fresh page the sedan is shoved by car-car collision
   resolution to (8.57, 2.55): 6 cm off the ped's line (z = 2.5).
2. The ped at (30, 2.5) flees from the approaching car. With the car
   6 cm off-axis, the flee direction has a -z component; the radial
   push from the front axle (resolvePedFromCars, 1.55 m) amplifies
   the lateral drift; the ped ends ~1.6 m off-axis and the car closes
   below the 2.0 m hit radius → ped goes down, pedHit logged.
   Isolated diagnostic (1280×720, fresh page) PASSES: ped down at
   wall 7 s, crimes ["pedHit"].
3. In the full-suite context the game has run ~10 minutes before
   section 8: the police cars have patrolled away from (10.2, 2.5)
   and no car is near the placement point, so the sedan stays at
   exactly z = 2.5. The ped flees dead-ahead (dz = 0), runs at the
   car's line, and rides a stable ~3.7 m gap ahead of the car that
   never enters the 2.0 m hit radius → no hit, ever, in that run.
   Replicated in diag-pedhit2 (sections 7+8 verbatim after 60 s
   idle): ped runs (30.0,2.5) → (169.0,2.5), gap 3.7–3.8 m for
   90 wall-seconds, crimes [].
4. The repair session's own logs show the same check both failing
   (diag-pedhit-run2: ped dodges to z = -0.3, no hit) and passing
   (run3) on identical code. The outcome is decided by whether any
   car happens to be within ~2.5 m of (10, 2.5) at section-8
   placement time — a timing race in the TEST setup and the verified
   game code, not in this re-application. The three files are
   byte-identical to the verified targets (diff empty), so no content
   change can fix it from this session; fixing it would need a test
   change (e.g. place the sedan off-axis) or a game change (e.g. a
   wider hit radius) — both outside this re-witness scope.

## D. Dossier — MISMATCH vs the task's expected number

`node main.ts` exit 0; schema makefun/dossier/v1; 4 images.
Measured twice (fresh /output/dossier.json): **dossier text
163,762 / 163,840 bytes — headroom 78, UNDER the limit.**

Expected by the task: 163,639 (headroom 201). Difference: **+123
bytes**. Cause investigated and proven NOT to be my re-application:

- The 13 counted source files sum to 162,920 bytes (framing 842).
  Per-file deltas vs HEAD match the repair report's own rows exactly:
  combat.js +44, player.js +446, world.js +314, vehicles.js +163,
  npcs.js -174 → total +793; baseline source 162,127 + 793 =
  162,920. Baseline dossier 162,965 + 793 + 4 framing = 163,762.
- The repair report's own table is internally inconsistent: its
  sequential rows sum to 163,668 after Fix 5, while its "final
  pre-regression-fix" row says 163,604 and its "Final" row says
  163,639. The 163,639 figure cannot be produced from the final
  verified file bytes. The dossier of the verified content (hashes
  above) IS 163,762. Nothing in this session changed any counted
  byte after the hashes were verified (combat.js/player.js untouched,
  all other counted files at HEAD).

The dossier is within the hard limit (78 bytes spare). The +123 vs
the expected number is a stale/incorrect figure in the repair
report, not a re-application difference.

## E. Tree integrity (step 9)

HEAD still 84094c3; no commit/push/submit/sign. Modified files are
exactly the same set as on arrival: the five source files
(combat.js 1 line changed, player.js +11 lines, npcs.js,
vehicles.js, world.js), the four dossier screenshots (re-rendered by
the test runs, as before), and the validation screenshots.
combat.js / player.js diffs are the repair's own changes only (M4
objective text; makeBox helper + six face boxes). New files created
by this session (untracked, validation only): this report,
test-*-rec6.log (7 suite logs), validation/diag-pedhit2.cjs,
diag-pedhit3.cjs, diag-pedhit4.cjs, diag-pedhit5.cjs and their logs.
Recording 6 left RUNNING — not stopped/sealed by this session.

## F. Verdict

**FAIL** — by the stated rule (all hashes match AND all tests pass at
the expected counts AND dossier matches). The hashes match exactly
and the re-witness itself succeeded, but:
1. Phase 4 is 35/36 in three consecutive runs (ped-hit check;
   timing race in the verified content, §C — not a re-application
   error, not fixable inside this scope).
2. Dossier is 163,762, not 163,639 (+123; the verified content's
   true size — the repair report's figure is inconsistent with its
   own rows and with the file bytes, §D). Still under the 163,840
   limit (headroom 78).

Recommended parent actions: (a) decide whether to accept 35/36 for
Phase 4 or adjust the ped-hit test placement (sedan off-axis) /
re-run for a lucky patrol alignment; (b) update the expected dossier
figure to 163,762 (headroom 78) in the submission record.

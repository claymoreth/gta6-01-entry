# CITY OF EMBERS — Open-World Crime Game (make.fun gta6-01)

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/claymoreth/gta6-01-entry/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/claymoreth/gta6-01-entry/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original third-person 3D open-world crime game set in Ember Bay, a fictional
tropical coastal metropolis, playable offline in a desktop browser from static
files. Three connected districts: Downtown towers with glowing windows,
Residential houses and Taman Melati park, and the Waterfront with warehouses,
a container yard, cranes, a wooden pier and a lighthouse over the sea.
Raka — a young man walking the city on foot — explores it all with a GPS
waypoint system and a live minimap.

Built fresh in a recorded agent session for make.fun bounty gta6-01. All city,
characters, vehicles, names, story, art, sound and music are original — nothing
from Rockstar Games and nothing copied from any other entry.

## Play

Serve `game/` and open it in desktop Chrome:

```
node serve.ts
# open http://localhost:8080
```

Controls: WASD / arrow keys to move, SHIFT to sprint, mouse to orbit the
camera (click to lock), click the minimap to set a GPS waypoint, ESC / P to pause.
Near a parked car, press E to get in: W/S is gas and brake (S from a stop
reverses), A/D steers, SPACE is the handbrake, SHIFT boosts, E gets out again.
Stealing a civilian traffic car, ramming one, or hitting a pedestrian with
your car is a crime — if a police officer or a witness sees it, your wanted
level rises and the police respond. Break line of sight and hide (safehouses
and alleys help) to let the heat decay.

## Phase 1 — 3D Vertical Slice

- Real-time 3D (Three.js r187, vendored locally under `game/vendor/` — no CDN).
- Third-person camera behind a fully 3D character with walk/run animation.
- One city block: roads, sidewalks, crosswalks, 16 towers, palms, streetlights.
- Night atmosphere: purple-blue ambient, warm emissive windows, fog, stars.
- Building collision, world bounds, HUD with live minimap, start/pause/restart.

## Phase 2 — Open-World City, HUD and GPS

- Three connected districts: Downtown (towers), Residential (houses, park,
  Balai Warga, safehouse), Waterfront (warehouses, container yard, cranes,
  pier, lighthouse, sea) — linked by one east-west spine road plus three
  north-south roads, with crosswalks, alleys, landmarks and two safehouses.
- GPS waypoint: click the minimap to set a destination; a 3D beacon marks it
  in the world, the minimap draws a dashed route, the HUD shows live distance
  and a compass arrow pointing at it.
- Exploration mission: three stops (Taman Melati, Mercusuar Ember,
  Plaza Merdeka) with objective tracking and progress (0/3 → 3/3).
- HUD completed: mission + progress, GPS distance, compass, weapon/ammo
  placeholders, health/armour, money, wanted level, district + street names.
- Minimap now covers the whole city: roads, buildings by type, sea, park,
  pier, POI dots, player arrow (rotates with facing), waypoint diamond.

## Phase 3 — Vehicles and Driving

- Three drivable cars, all original low-poly models built from primitives:
  a blue Sedan Ember (Downtown), a red Sports Ember (Residential), an orange
  Truk Ember with a cargo bed (Waterfront). Four spinning wheels, headlights
  and taillights, a working headlight beam at night.
- Enter/exit with E (prompt appears near a car); the camera swings behind
  the car while driving and returns on foot. Raka hides inside the car.
- Arcade driving: gas, brake, reverse, steering that tightens with speed,
  handbrake drift, boost, world collision (walls, containers, lamps),
  vehicle-vs-vehicle collision, and damage — a badly damaged car smokes,
  handles worse, and dies at 95% damage.
- Civilian traffic: seven cars on three road loops (east-west spine,
  Jalan Dermaga, Jalan Melati) with pure-pursuit steering, varied speeds,
  obstacle braking (they stop for the player and for other cars), and a
  stuck-recovery reverse manoeuvre.
- Driving HUD: live speedometer in km/h, damage bar, car name; cars appear
  as dots on the minimap (cyan for parked drivables, pale for traffic).
- Synthesized sound (Web Audio, no files): engine pitch follows speed,
  tyre skid on handbrake, crash thuds on impact.

## Phase 4 — NPCs, Police and Wanted System

- Pedestrians: 14 original low-poly walkers on sidewalk routes across all
  three districts, with procedural walk animation, varied clothing, build
  and speed. They wait for passing cars, step around obstacles and vehicles,
  flee danger (crashes, reckless driving), get knocked down when hit by a
  car, then get up and run. All walkers share five instanced meshes (one
  draw call per body part), so 17 walkers cost only 7 draw calls.
- Police: 3 foot officers on patrol routes plus 2 Police Interceptors
  (black-and-white, red/blue flashing light bar, siren) driving the road
  network. Officers patrol, investigate incidents, pursue on foot and by
  car (road-following pursuit with intercept targeting at high wanted
  levels), search the last known position when they lose sight, and return
  to patrol when the heat clears. No teleporting, no seeing through walls.
- Crime detection (only reliably detectable acts): stealing a civilian
  traffic car, ramming a civilian or police car, hitting a pedestrian with
  your car. Detection needs a witness — a police unit within 45 m or a
  pedestrian within 25 m with a clear line of sight (buildings block
  sight). A civilian witness reports after a short delay; with no witness
  the crime goes unnoticed. One event raises wanted at most once.
- Wanted 0–5 stars: heat 0–100, thresholds 1/21/41/61/86. Each level
  activates more units (1 at level 1 … all 5 at level 5), with faster
  foot pursuit, higher police-car throttle and boost, and intercept
  targeting from level 4. The HUD shows live stars plus PURSUIT / SEARCH /
  HIDDEN status, and the minimap shows pedestrians (pale) and police (blue).
- Escape and hiding: heat decays only while no police unit sees you —
  1.5/s in the open, 3.0/s inside a hiding zone (the two safehouses and two
  alleys). Lose sight for 2 s and the police switch to SEARCH at your last
  known position; stay hidden and the level falls step by step to 0.
- Audio and feedback: a synthesized two-tone siren while a pursuit or
  search is active (silent on patrol), a dispatch blip on wanted changes,
  and priority notifications (crime reported, wanted up/down, pursuit,
  lost sight, escaped, cleared) that queue instead of overwriting each other.
- Weapons and attacks are NOT in this phase — firing a weapon or attacking
  civilians is Phase 5.

Later phases add combat, missions, and audio.

## Tech

- `main.ts` (Node 22, stdlib only) hands the entry in: copies `game/` and
  `screenshots/` to the output dir and writes `dossier.json` via
  `vendor/makefun-game.ts` (unchanged kit library).
- `game/` holds the whole game: `index.html`, `style.css`, `src/*.js`, and
  `vendor/three.module.min.js` (official Three.js build, minified locally).

## License

MIT. See LICENSE.

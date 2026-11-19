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

Later phases add vehicles, police and wanted levels, combat, missions, and audio.

## Tech

- `main.ts` (Node 22, stdlib only) hands the entry in: copies `game/` and
  `screenshots/` to the output dir and writes `dossier.json` via
  `vendor/makefun-game.ts` (unchanged kit library).
- `game/` holds the whole game: `index.html`, `style.css`, `src/*.js`, and
  `vendor/three.module.min.js` (official Three.js build, minified locally).

## License

MIT. See LICENSE.

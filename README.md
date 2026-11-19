# CITY OF EMBERS — Open-World Crime Game (make.fun gta6-01)

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/claymoreth/gta6-01-entry/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/claymoreth/gta6-01-entry/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original third-person 3D open-world crime game set in Ember Bay, a fictional
tropical coastal metropolis, playable offline in a desktop browser from static
files. One night block: towers with glowing windows, palm-lined streets, a
living sidewalk, and Raka — a young man walking the city on foot.

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
camera (click to lock), ESC / P to pause.

## Phase 1 — 3D Vertical Slice

- Real-time 3D (Three.js r187, vendored locally under `game/vendor/` — no CDN).
- Third-person camera behind a fully 3D character with walk/run animation.
- One city block: roads, sidewalks, crosswalks, 16 towers, palms, streetlights.
- Night atmosphere: purple-blue ambient, warm emissive windows, fog, stars.
- Building collision, world bounds, HUD with live minimap, start/pause/restart.

Later phases add vehicles, police and wanted levels, combat, missions, and audio.

## Tech

- `main.ts` (Node 22, stdlib only) hands the entry in: copies `game/` and
  `screenshots/` to the output dir and writes `dossier.json` via
  `vendor/makefun-game.ts` (unchanged kit library).
- `game/` holds the whole game: `index.html`, `style.css`, `src/*.js`, and
  `vendor/three.module.min.js` (official Three.js build, minified locally).

## License

MIT. See LICENSE.

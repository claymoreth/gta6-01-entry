// CITY OF EMBERS — HUD + minimap + overlays (original, Phase 1).
// DOM-based HUD over the WebGL canvas; the minimap is a 2D canvas drawn
// from the same world layout the 3D scene uses (roads, buildings, player).

import { WORLD_HALF } from './world.js';

export function createHud(world) {
  const el = {
    hud: document.getElementById('hud'),
    districtName: document.getElementById('district-name'),
    streetName: document.getElementById('street-name'),
    mission: document.getElementById('mission'),
    pos: document.getElementById('pos'),
    minimap: document.getElementById('minimap'),
    healthFill: document.getElementById('health-fill'),
    armourFill: document.getElementById('armour-fill'),
    healthNum: document.getElementById('health-num'),
    armourNum: document.getElementById('armour-num'),
    money: document.getElementById('money'),
    wanted: document.getElementById('wanted'),
    toast: document.getElementById('toast'),
    startScreen: document.getElementById('start-screen'),
    pauseScreen: document.getElementById('pause-screen'),
    startBtn: document.getElementById('start-btn'),
    resumeBtn: document.getElementById('resume-btn'),
    restartBtn: document.getElementById('restart-btn'),
  };
  const mctx = el.minimap.getContext('2d');
  const SIZE = 180;
  const scale = SIZE / (WORLD_HALF * 2 + 8);

  // Building footprints for the minimap, derived from the colliders.
  const buildings = world.colliders.filter((c) => c.name === 'building');

  let toastTimer = 0;
  function showToast(text, ms) {
    el.toast.textContent = text;
    el.toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.add('hidden'), ms ?? 2600);
  }

  function drawMinimap(player) {
    const g = mctx;
    g.clearRect(0, 0, SIZE, SIZE);
    // background
    g.fillStyle = '#0d0d24';
    g.fillRect(0, 0, SIZE, SIZE);
    const toMap = (x, z) => [(x + WORLD_HALF + 4) * scale, (z + WORLD_HALF + 4) * scale];
    // roads
    g.fillStyle = '#2c2c3e';
    const [rx] = toMap(-5, 0);
    const [, rz] = toMap(0, -5);
    g.fillRect(0, rz, SIZE, 10 * scale);
    g.fillRect(rx, 0, 10 * scale, SIZE);
    // buildings
    g.fillStyle = '#5a5a8a';
    for (const b of buildings) {
      const [x, z] = toMap(b.minX, b.minZ);
      g.fillRect(x, z, (b.maxX - b.minX) * scale, (b.maxZ - b.minZ) * scale);
    }
    // player arrow (rotates with facing). Map x = world x, map y = world z;
    // world forward is (sin f, cos f), so the map angle is atan2(dx, -dz)
    // because "up" on the map is -z (north).
    const [px, pz] = toMap(player.pos.x, player.pos.z);
    g.save();
    g.fillStyle = '#ffd166';
    g.beginPath();
    g.moveTo(0, -7);
    g.lineTo(5, 6);
    g.lineTo(-5, 6);
    g.closePath();
    g.fill();
    g.restore();
    // north marker
    g.fillStyle = '#c9cfff';
    g.font = 'bold 10px sans-serif';
    g.fillText('N', 6, 12);
  }

  let lastDistrict = '';
  function update(dt, fps, player) {
    const { district, street } = world.districtAt(player.pos.x, player.pos.z);
    if (district !== lastDistrict) {
      lastDistrict = district;
      el.districtName.textContent = district;
      el.streetName.textContent = street;
      showToast(district);
    } else {
      el.streetName.textContent = street;
    }
    el.pos.textContent = `x ${player.pos.x.toFixed(1)} · z ${player.pos.z.toFixed(1)}`;
    el.healthFill.style.width = '100%';
    el.healthNum.textContent = '100';
    el.armourFill.style.width = '50%';
    el.armourNum.textContent = '50';
    el.money.textContent = '$0';
    el.wanted.textContent = 'WANTED ☆☆☆☆☆';
    drawMinimap(player);
  }

  function showStart() {
    el.startScreen.classList.remove('hidden');
    el.pauseScreen.classList.add('hidden');
    el.hud.classList.add('hidden');
  }
  function showGame() {
    el.startScreen.classList.add('hidden');
    el.pauseScreen.classList.add('hidden');
    el.hud.classList.remove('hidden');
  }
  function showPause() {
    el.pauseScreen.classList.remove('hidden');
  }
  function hidePause() {
    el.pauseScreen.classList.add('hidden');
  }

  return {
    el, showToast, update, showStart, showGame, showPause, hidePause,
  };
}

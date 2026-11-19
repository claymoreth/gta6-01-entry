// CITY OF EMBERS — HUD + minimap + GPS + overlays (original, Phase 2).
// DOM-based HUD over the WebGL canvas; the minimap is a 2D canvas drawn
// from the same world layout the 3D scene uses (roads, buildings, sea,
// POIs, player, waypoint). Clicking the minimap sets a GPS waypoint.

import { WORLD_BOUNDS } from './world.js';

export function createHud(world, callbacks) {
  const el = {
    hud: document.getElementById('hud'),
    districtName: document.getElementById('district-name'),
    streetName: document.getElementById('street-name'),
    mission: document.getElementById('mission'),
    missionProgress: document.getElementById('mission-progress'),
    gps: document.getElementById('gps'),
    gpsDist: document.getElementById('gps-dist'),
    gpsName: document.getElementById('gps-name'),
    compass: document.getElementById('compass'),
    compassArrow: document.getElementById('compass-arrow'),
    pos: document.getElementById('pos'),
    minimap: document.getElementById('minimap'),
    healthFill: document.getElementById('health-fill'),
    armourFill: document.getElementById('armour-fill'),
    healthNum: document.getElementById('health-num'),
    armourNum: document.getElementById('armour-num'),
    money: document.getElementById('money'),
    weapon: document.getElementById('weapon'),
    ammo: document.getElementById('ammo'),
    wanted: document.getElementById('wanted'),
    speedo: document.getElementById('speedo'),
    speedoName: document.getElementById('speedo-name'),
    speedNum: document.getElementById('speed-num'),
    damageRow: document.getElementById('damage-row'),
    damageFill: document.getElementById('damage-fill'),
    damageNum: document.getElementById('damage-num'),
    interactPrompt: document.getElementById('interact-prompt'),
    toast: document.getElementById('toast'),
    startScreen: document.getElementById('start-screen'),
    pauseScreen: document.getElementById('pause-screen'),
    startBtn: document.getElementById('start-btn'),
    resumeBtn: document.getElementById('resume-btn'),
    restartBtn: document.getElementById('restart-btn'),
  };
  const mctx = el.minimap.getContext('2d');
  const SIZE = 180;
  const BW = WORLD_BOUNDS;
  const mapW = BW.maxX - BW.minX + 8;
  const mapH = BW.maxZ - BW.minZ + 8;
  const scale = SIZE / mapW;
  const yOff = (SIZE - mapH * scale) / 2;
  const toMap = (x, z) => [(x - BW.minX + 4) * scale, (z - BW.minZ + 4) * scale + yOff];
  const toWorld = (px, py) => [(px / scale) + BW.minX - 4, ((py - yOff) / scale) + BW.minZ - 4];

  // Building footprints for the minimap, derived from the colliders.
  const drawable = world.colliders.filter((c) =>
    ['building', 'house', 'warehouse', 'container', 'crane', 'office', 'lighthouse'].includes(c.name));
  const fillFor = {
    building: '#5a5a8a',
    house: '#7a6a55',
    warehouse: '#9a6a35',
    container: '#3a7a8a',
    crane: '#8a6a2f',
    office: '#6a6a7a',
    lighthouse: '#e8e4da',
  };

  let toastTimer = 0;
  function showToast(text, ms) {
    el.toast.textContent = text;
    el.toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.add('hidden'), ms ?? 2600);
  }

  // Minimap click -> GPS waypoint (world coords, clamped to the city).
  el.minimap.style.pointerEvents = 'auto';
  el.minimap.style.cursor = 'crosshair';
  el.minimap.addEventListener('click', (e) => {
    const rect = el.minimap.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (SIZE / rect.width);
    const py = (e.clientY - rect.top) * (SIZE / rect.height);
    const [wx, wz] = toWorld(px, py);
    const cx = Math.max(BW.minX + 2, Math.min(BW.maxX - 2, wx));
    const cz = Math.max(BW.minZ + 2, Math.min(BW.maxZ - 2, wz));
    if (callbacks && callbacks.onMinimapClick) callbacks.onMinimapClick(cx, cz);
  });

  let pulseT = 0;
  function drawMinimap(player, waypoint, vehicles) {
    const g = mctx;
    g.clearRect(0, 0, SIZE, SIZE);
    g.fillStyle = '#0d0d24';
    g.fillRect(0, 0, SIZE, SIZE);
    // sea strip on the east edge
    g.fillStyle = '#0a2a4a';
    const [seaX] = toMap(156, 0);
    g.fillRect(seaX, yOff, SIZE - seaX, mapH * scale);
    // roads: EW spine + 3 NS roads
    g.fillStyle = '#2c2c3e';
    const [, rz0] = toMap(0, -5);
    g.fillRect(0, rz0, SIZE, 10 * scale);
    for (const rx of [0, -115, 115]) {
      const [mx] = toMap(rx - 5, 0);
      const w = (rx === 115 ? 12 : rx === -115 ? 8 : 10) * scale;
      g.fillRect(mx, yOff, w, mapH * scale);
    }
    // park lawn
    g.fillStyle = '#1d4d28';
    const [parkX, parkY] = toMap(-152, 22);
    g.fillRect(parkX, parkY, 24 * scale, 30 * scale);
    // pier
    g.fillStyle = '#5a3d24';
    const [pierX, pierY] = toMap(140, -4);
    g.fillRect(pierX, pierY, 32 * scale, 8 * scale);
    // buildings
    for (const b of drawable) {
      g.fillStyle = fillFor[b.name] || '#555';
      const [x, z] = toMap(b.minX, b.minZ);
      g.fillRect(x, z, (b.maxX - b.minX) * scale, (b.maxZ - b.minZ) * scale);
    }
    // POI dots
    for (const p of world.pois) {
      const [x, z] = toMap(p.x, p.z);
      g.fillStyle = p.color;
      g.beginPath();
      g.arc(x, z, p.kind === 'safehouse' ? 3.5 : 2.5, 0, Math.PI * 2);
      g.fill();
    }
    // vehicles: traffic as pale dots, parked drivables as cyan dots.
    // The driven car is the player arrow itself (player.pos tracks it).
    if (vehicles) {
      for (const v of vehicles) {
        if (v.driven) continue;
        const [x, z] = toMap(v.x, v.z);
        g.fillStyle = v.drivable ? '#4ad8ff' : '#d8dce8';
        g.beginPath();
        g.arc(x, z, v.drivable ? 2.6 : 2, 0, Math.PI * 2);
        g.fill();
      }
    }
    // waypoint: line from player, then a pulsing diamond
    if (waypoint) {
      const [px, pz] = toMap(player.pos.x, player.pos.z);
      const [wx, wz] = toMap(waypoint.x, waypoint.z);
      g.strokeStyle = 'rgba(255,209,102,0.8)';
      g.lineWidth = 1.5;
      g.setLineDash([4, 3]);
      g.beginPath();
      g.moveTo(px, pz);
      g.lineTo(wx, wz);
      g.stroke();
      g.setLineDash([]);
      const pr = 4 + Math.sin(pulseT * 5) * 1.5;
      g.fillStyle = '#ffd166';
      g.beginPath();
      g.moveTo(wx, wz - pr);
      g.lineTo(wx + pr, wz);
      g.lineTo(wx, wz + pr);
      g.lineTo(wx - pr, wz);
      g.closePath();
      g.fill();
      g.strokeStyle = '#1a1030';
      g.lineWidth = 1;
      g.stroke();
    }
    // player arrow (rotates with facing; map up is -z / north)
    const [px, pz] = toMap(player.pos.x, player.pos.z);
    const mapAngle = Math.atan2(Math.sin(player.facing), -Math.cos(player.facing));
    g.save();
    g.translate(px, pz);
    g.rotate(mapAngle);
    g.fillStyle = '#ffd166';
    g.beginPath();
    g.moveTo(0, -7);
    g.lineTo(5, 6);
    g.lineTo(-5, 6);
    g.closePath();
    g.fill();
    g.strokeStyle = '#1a1030';
    g.lineWidth = 1;
    g.stroke();
    g.restore();
    // north marker
    g.fillStyle = '#c9cfff';
    g.font = 'bold 10px sans-serif';
    g.fillText('N', 6, 12);
  }

  let lastDistrict = '';
  // drive: { driving, speedKmh, name, damage, vehicles } or null (on foot).
  // vehicles = [{ x, z, drivable, driven }] for minimap dots.
  function update(dt, fps, player, gps, drive) {
    pulseT += dt;
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
    el.weapon.textContent = 'Bare Hands';
    el.ammo.textContent = '—';
    el.wanted.textContent = 'WANTED ☆☆☆☆☆';
    // Phase 3: driving panel — speedometer (km/h) + damage bar + car name.
    const driving = !!(drive && drive.driving);
    el.speedo.classList.toggle('hidden', !driving);
    if (driving) {
      el.speedNum.textContent = `${Math.round(Math.abs(drive.speedKmh || 0))}`;
      el.speedoName.textContent = (drive.name || 'VEHICLE').toUpperCase();
      const dmg = Math.max(0, Math.min(1, drive.damage || 0));
      el.damageRow.classList.remove('hidden');
      el.damageFill.style.width = `${dmg * 100}%`;
      el.damageNum.textContent = `${Math.round(dmg * 100)}%`;
    }
    // GPS readout + compass arrow toward the waypoint (relative to camera).
    if (gps && gps.waypoint) {
      el.gps.classList.remove('hidden');
      el.gpsName.textContent = gps.waypoint.name || 'Destination';
      el.gpsDist.textContent = `${Math.round(gps.distance)} m`;
      el.compass.classList.remove('hidden');
      // Camera looks along (-sin yaw, -cos yaw); bearing to waypoint is
      // atan2(dx, dz) in world space. Arrow rotation = bearing - camBearing.
      const camBearing = Math.atan2(-Math.sin(gps.camYaw), -Math.cos(gps.camYaw));
      const rel = gps.bearing - camBearing;
      el.compassArrow.style.transform = `rotate(${rel}rad)`;
    } else {
      el.gps.classList.add('hidden');
      el.compass.classList.add('hidden');
    }
    drawMinimap(player, gps ? gps.waypoint : null, drive ? drive.vehicles : null);
  }

  // Phase 3: "Tekan E untuk masuk" prompt. text=null hides it.
  function setInteract(text) {
    if (text) {
      el.interactPrompt.textContent = text;
      el.interactPrompt.classList.remove('hidden');
    } else {
      el.interactPrompt.classList.add('hidden');
    }
  }

  function setMission(mission) {
    el.mission.textContent = mission.title;
    el.missionProgress.textContent = mission.progress;
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
    el, showToast, update, setMission, setInteract, showStart, showGame, showPause, hidePause,
    worldToMap: toMap, mapToWorld: toWorld,
  };
}

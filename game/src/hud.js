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
    wantedStatus: document.getElementById('wanted-status'),
    speedo: document.getElementById('speedo'),
    speedoName: document.getElementById('speedo-name'),
    speedNum: document.getElementById('speed-num'),
    damageRow: document.getElementById('damage-row'),
    damageFill: document.getElementById('damage-fill'),
    damageNum: document.getElementById('damage-num'),
    interactPrompt: document.getElementById('interact-prompt'),
    crosshair: document.getElementById('crosshair'),
    dmg: document.getElementById('dmg'),
    wastedScreen: document.getElementById('wasted-screen'),
    toast: document.getElementById('toast'),
    startScreen: document.getElementById('start-screen'),
    pauseScreen: document.getElementById('pause-screen'),
    startBtn: document.getElementById('start-btn'),
    continueBtn: document.getElementById('continue-btn'),
    resumeBtn: document.getElementById('resume-btn'),
    saveBtn: document.getElementById('save-btn'),
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
  let toastShowing = false;
  let toastPriority = 'normal';
  const toastQueue = [];
  function displayToast(text, ms, priority) {
    toastShowing = true;
    toastPriority = priority || 'normal';
    el.toast.textContent = text;
    el.toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastShowing = false;
      toastPriority = 'normal';
      el.toast.classList.add('hidden');
      const next = toastQueue.shift();
      if (next) displayToast(next.text, next.ms, next.priority);
    }, ms ?? 2600);
  }
  function showToast(text, ms, priority) {
    priority = priority || 'normal';
    if (text === el.toast.textContent && toastShowing) return;
    if (toastQueue.some((t) => t.text === text)) return;
    if (!toastShowing) {
      displayToast(text, ms, priority);
      return;
    }
    if (priority === 'high' && toastPriority !== 'high') {
      displayToast(text, ms, priority);
      return;
    }
    if (priority === 'high') {
      const idx = toastQueue.findIndex((t) => t.priority !== 'high');
      const item = { text, ms, priority };
      if (idx === -1) toastQueue.push(item);
      else toastQueue.splice(idx, 0, item);
    } else {
      toastQueue.push({ text, ms, priority });
    }
    while (toastQueue.length > 3) toastQueue.shift();
  }
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
  function drawMinimap(player, waypoint, vehicles, npcs) {
    const g = mctx;
    g.clearRect(0, 0, SIZE, SIZE);
    g.fillStyle = '#0d0d24';
    g.fillRect(0, 0, SIZE, SIZE);
    g.fillStyle = '#0a2a4a';
    const [seaX] = toMap(156, 0);
    g.fillRect(seaX, yOff, SIZE - seaX, mapH * scale);
    g.fillStyle = '#2c2c3e';
    const [, rz0] = toMap(0, -5);
    g.fillRect(0, rz0, SIZE, 10 * scale);
    for (const rx of [0, -115, 115]) {
      const [mx] = toMap(rx - 5, 0);
      const w = (rx === 115 ? 12 : rx === -115 ? 8 : 10) * scale;
      g.fillRect(mx, yOff, w, mapH * scale);
    }
    g.fillStyle = '#1d4d28';
    const [parkX, parkY] = toMap(-152, 22);
    g.fillRect(parkX, parkY, 24 * scale, 30 * scale);
    g.fillStyle = '#5a3d24';
    const [pierX, pierY] = toMap(140, -4);
    g.fillRect(pierX, pierY, 32 * scale, 8 * scale);
    for (const b of drawable) {
      g.fillStyle = fillFor[b.name] || '#555';
      const [x, z] = toMap(b.minX, b.minZ);
      g.fillRect(x, z, (b.maxX - b.minX) * scale, (b.maxZ - b.minZ) * scale);
    }
    for (const p of world.pois) {
      const [x, z] = toMap(p.x, p.z);
      g.fillStyle = p.color;
      g.beginPath();
      g.arc(x, z, p.kind === 'safehouse' ? 3.5 : 2.5, 0, Math.PI * 2);
      g.fill();
    }
    if (vehicles) {
      for (const v of vehicles) {
        if (v.driven) continue;
        const [x, z] = toMap(v.x, v.z);
        g.fillStyle = v.police ? '#2a6bff' : v.drivable ? '#4ad8ff' : '#d8dce8';
        g.beginPath();
        g.arc(x, z, v.police ? 2.6 : v.drivable ? 2.6 : 2, 0, Math.PI * 2);
        g.fill();
      }
    }
    if (npcs) {
      if (npcs.peds) {
        g.fillStyle = '#c9cfff';
        for (const p of npcs.peds) {
          const [x, z] = toMap(p.x, p.z);
          g.beginPath();
          g.arc(x, z, 1.2, 0, Math.PI * 2);
          g.fill();
        }
      }
      if (npcs.police) {
        g.fillStyle = '#2a6bff';
        for (const p of npcs.police) {
          if (p.car) continue;
          const [x, z] = toMap(p.x, p.z);
          g.beginPath();
          g.arc(x, z, 2.2, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
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
    g.fillStyle = '#c9cfff';
    g.font = 'bold 10px sans-serif';
    g.fillText('N', 6, 12);
  }
  let lastDistrict = '';
  function update(dt, fps, player, gps, drive, wanted, npcs, combat) {
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
    const c = combat;
    el.healthFill.style.width = `${Math.max(0, Math.min(100, c.health))}%`;
    el.healthNum.textContent = `${Math.max(0, c.health)}`;
    el.armourFill.style.width = `${Math.max(0, Math.min(100, c.armour))}%`;
    el.armourNum.textContent = `${Math.max(0, c.armour)}`;
    el.money.textContent = `$${c.money}`;
    el.weapon.textContent = c.weapon;
    el.ammo.textContent = c.ammo;
    if (el.crosshair) el.crosshair.classList.toggle('armed', c.weapon === 'Pistol');
    const wLevel = wanted ? (wanted.level || 0) : 0;
    const wStatus = wanted ? (wanted.status || '') : '';
    el.wanted.textContent = `WANTED ${'★'.repeat(wLevel)}${'☆'.repeat(5 - wLevel)}`;
    el.wanted.style.color = wLevel > 0 ? '#ff5d5d' : '#8a8fa8';
    if (el.wantedStatus) {
      el.wantedStatus.textContent = wStatus;
      el.wantedStatus.classList.toggle('hidden', !wStatus);
      el.wantedStatus.style.color =
        wStatus === 'PURSUIT' ? '#ff5d5d' : wStatus === 'SEARCH' ? '#ffd166' : '#7ef0a8';
    }
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
    if (gps && gps.waypoint) {
      el.gps.classList.remove('hidden');
      el.gpsName.textContent = gps.waypoint.name || 'Destination';
      el.gpsDist.textContent = `${Math.round(gps.distance)} m`;
      el.compass.classList.remove('hidden');
      const camBearing = Math.atan2(-Math.sin(gps.camYaw), -Math.cos(gps.camYaw));
      const rel = gps.bearing - camBearing;
      el.compassArrow.style.transform = `rotate(${rel}rad)`;
    } else {
      el.gps.classList.add('hidden');
      el.compass.classList.add('hidden');
    }
    drawMinimap(player, gps ? gps.waypoint : null, drive ? drive.vehicles : null, npcs || null);
  }
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
  function flashCross(cls, ms) {
    if (!el.crosshair) return;
    el.crosshair.classList.add(cls);
    setTimeout(() => el.crosshair.classList.remove(cls), ms);
  }
  function flashDamage() {
    if (!el.dmg) return;
    el.dmg.style.opacity = '1';
    setTimeout(() => { el.dmg.style.opacity = '0'; }, 60);
  }
  function setWasted(on) {
    if (el.wastedScreen) el.wastedScreen.classList.toggle('hidden', !on);
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
    flashCross, flashDamage, setWasted,
    worldToMap: toMap, mapToWorld: toWorld,
  };
}

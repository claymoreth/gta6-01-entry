import { segmentClearT } from './collision.js';
const SAVE_KEY = 'city-of-embers-save-v1';
const MS = [
  { t: 'First Arrival', s: [[-140, 37, 'Melati Park']], r: 100, k: 0 },
  { t: 'The Delivery', s: [[156, 0, 'Ember Pier']], r: 250, k: 1, time: 120 },
  { t: 'Lost Vehicle', s: [[-100, -20, 'Ember Sports'], [156, 0, 'Ember Pier']], r: 300, k: 2 },
  { t: 'Police Pressure', s: [], r: 200, k: 3 },
  { t: 'Final Connection', s: [[0, 0, 'Merdeka Plaza'], [168, 0, 'Ember Lighthouse'], [-155, -10, 'Green House'], [132, 45, 'Pier Office']], r: 500, k: 0 },
];
const SAFE = [[-155, -10, 'Green House'], [132, 45, 'Pier Office']];
export function createCombat(o) {
  const { world, player, npcs, vehicles, hud, audio, input, cam } = o;
  const allPeds = [...npcs.pedestrians, ...npcs.footPolice];
  let weapon = 0, mag = 12, reserve = 48, reloading = 0, fireCd = 0, meleeCd = 0;
  let health = 100, armour = 50, money = 0, gameTime = 0, lastHurt = -100, hurtCd = 0;
  let wasted = false, wastedT = 0, mi = 0, si = 0, timer = 0, hadHeat = false, allDone = false;
  let hpMap = new WeakMap();
  function nearestSafe() {
    let best = SAFE[0], bd = Infinity;
    for (const s of SAFE) {
      const d = Math.hypot(s[0] - player.pos.x, s[1] - player.pos.z);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }
  function hurtPed(p, dmg, fx, fz) {
    if (p.state === 'down') return false;
    const cop = p.kind === 'foot';
    let h = hpMap.get(p);
    if (h === undefined) h = cop ? 4 : 3;
    h -= dmg;
    hpMap.set(p, h);
    if (h <= 0) { p.knockDown(fx, fz); p.downTimer = 8; return true; }
    if (cop) p.state = 'pursue';
    else p.fleeFromPoint(fx, fz, 5);
    return false;
  }
  function fire() {
    if (wasted || reloading > 0 || fireCd > 0) return false;
    if (weapon === 0) return melee();
    if (mag <= 0) { audio.blip(); hud.showToast('Magazine empty — Press R to reload'); return false; }
    fireCd = .28;
    mag -= 1;
    const cp = Math.cos(cam.pitch);
    const d = { x: -Math.sin(cam.yaw) * cp, z: -Math.cos(cam.yaw) * cp };
    const ox = player.pos.x, oz = player.pos.z;
    const tBlock = segmentClearT(ox, 1.45, oz, ox + d.x * 40, 1.45, oz + d.z * 40, world.colliders) * 40;
    let best = null, bestT = tBlock;
    for (const p of allPeds) {
      if (p.state === 'down') continue;
      const rx = p.pos.x - ox, rz = p.pos.z - oz;
      const t = rx * d.x + rz * d.z;
      if (t < .5 || t >= bestT) continue;
      const cx = rx - d.x * t, cz = rz - d.z * t;
      if (cx * cx + cz * cz < .81) { best = p; bestT = t; }
    }
    hud.flashCross('fire', 70);
    player.showFlash();
    audio.shot();
    player.facing = Math.atan2(d.x, d.z);
    if (best) {
      hud.flashCross('hit', 120);
      audio.blip();
      const down = hurtPed(best, 2, ox, oz);
      npcs.reportCrime('assault', best.pos.x, best.pos.z, { target: `ped-${best.index}` });
      if (down) hud.showToast('Target down');
    } else {
      npcs.reportCrime('weaponFire', ox, oz, { target: 'weaponFire' });
    }
    return true;
  }
  function melee() {
    if (wasted || meleeCd > 0) return false;
    meleeCd = .6;
    const fx = Math.sin(player.facing), fz = Math.cos(player.facing);
    let hitAny = false;
    for (const p of allPeds) {
      if (p.state === 'down') continue;
      const dx = p.pos.x - player.pos.x, dz = p.pos.z - player.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 2.2 || d < .01) continue;
      if ((dx * fx + dz * fz) / d < .5) continue;
      hitAny = true;
      const down = hurtPed(p, 1, player.pos.x, player.pos.z);
      npcs.reportCrime('assault', p.pos.x, p.pos.z, { target: `ped-${p.index}` });
      if (down) hud.showToast('Target down');
    }
    if (hitAny) { hud.flashCross('hit', 120); audio.blip(); audio.crash(1); }
    return hitAny;
  }
  function reload() {
    if (wasted || weapon === 0 || reloading > 0 || mag >= 12 || reserve <= 0) return false;
    reloading = 1.2;
    audio.blip();
    return true;
  }
  function switchWeapon(i) {
    if (wasted) return;
    weapon = i === -1 ? (weapon === 0 ? 1 : 0) : (i === 1 ? 1 : 0);
    reloading = 0;
    player.setWeapon(weapon);
  }
  function hurtPlayer(amount) {
    if (wasted) return;
    let a = amount;
    if (armour > 0) { const ab = Math.min(armour, a); armour -= ab; a -= ab; }
    health -= a;
    lastHurt = gameTime;
    hud.flashDamage();
    audio.crash(1);
    if (health <= 0) {
      health = 0;
      wasted = true;
      wastedT = 2.5;
      player.group.visible = false;
      if (mi === 1) timer = 120;
      if (mi === 3) hadHeat = false;
      hud.setWasted(true);
      audio.blip();
      npcs.clearWanted();
    }
  }
  function respawn() {
    const best = nearestSafe();
    player.pos.set(best[0], 0, best[1]);
    player.vel.set(0, 0, 0);
    player.group.visible = true;
    health = 100;
    armour = 50;
    mag = 12;
    reserve = Math.max(reserve, 24);
    money = Math.max(0, money - 100);
    wasted = false;
    hud.setWasted(false);
    hud.showToast(`Respawned at ${best[2]} — $100 lost`);
    save();
  }
  function curStep() {
    const m = MS[mi];
    if (!m || si >= m.s.length) return null;
    return m.s[si];
  }
  function waypoint() {
    if (allDone) return null;
    const m = MS[mi];
    if (m.k === 3) {
      const best = nearestSafe();
      return { x: best[0], z: best[1], name: best[2], custom: false };
    }
    const st = curStep();
    if (!st) return null;
    return { x: st[0], z: st[1], name: st[2], custom: false };
  }
  function missionText() {
    if (allDone) return { title: 'CITY OF EMBERS — Story complete!', progress: '5/5 missions' };
    const m = MS[mi];
    const st = curStep();
    const obj = m.k === 3 ? (hadHeat ? 'Lose the police' : 'Get the police on your tail — commit a crime where people can see you')
      : m.k === 2 && si === 0 ? 'Find the Ember Sports car'
      : m.k === 2 ? 'Drive to Ember Pier'
      : `Go to ${st ? st[2] : ''}`;
    return { title: `M${mi + 1} — ${m.t}: ${obj}`, progress: `Mission ${mi + 1}/5${m.k === 1 && timer > 0 ? ` · ${Math.ceil(timer)}s left` : ''}` };
  }
  function completeMission() {
    const m = MS[mi];
    money += m.r;
    if (reserve < 48) reserve = 48;
    hud.showToast(`Mission complete — ${m.t} +$${m.r}`);
    audio.blip();
    mi += 1;
    si = 0;
    timer = 0;
    hadHeat = false;
    if (mi >= MS.length) { allDone = true; hud.showToast('Story complete — Ember Bay is yours!'); }
    hud.setMission(missionText());
    save();
  }
  function arrive() {
    if (allDone) return false;
    const m = MS[mi];
    if (m.k === 3 || (m.k === 2 && si === 0)) return false;
    if (m.k === 2 && si === 1) {
      const dc = vehicles.driven;
      if (!dc || dc.typeName !== 'sports') return false;
    }
    si += 1;
    if (si >= m.s.length) completeMission();
    else hud.setMission(missionText());
    return true;
  }
  function onEnterCar(car) {
    if (allDone || MS[mi].k !== 2 || si !== 0) return false;
    if (car.typeName !== 'sports') return false;
    si = 1;
    hud.setMission(missionText());
    hud.showToast('Ember Sports found — Drive it to the pier');
    return true;
  }
  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ x: player.pos.x, z: player.pos.z, money, health, armour, mi, si, w: weapon, mag, res: reserve, done: allDone }));
      return true;
    } catch (e) { return false; }
  }
  function loadSave() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (!s || typeof s.x !== 'number' || typeof s.mi !== 'number') return null;
      return s;
    } catch (e) { return null; }
  }
  function continueGame() {
    const s = loadSave();
    if (!s) return false;
    player.pos.set(s.x, 0, s.z);
    player.vel.set(0, 0, 0);
    money = s.money || 0;
    health = s.health ?? 100;
    armour = s.armour ?? 50;
    mi = Math.min(s.mi, MS.length - 1);
    si = s.si || 0;
    allDone = !!s.done;
    weapon = s.w === 1 ? 1 : 0;
    mag = s.mag ?? 12;
    reserve = s.res ?? 48;
    timer = 0;
    hadHeat = false;
    hud.setMission(missionText());
    return true;
  }
  function reset() {
    weapon = 0; mag = 12; reserve = 48; reloading = 0; fireCd = 0; meleeCd = 0;
    health = 100; armour = 50; money = 0; lastHurt = -100; hurtCd = 0;
    wasted = false; wastedT = 0; mi = 0; si = 0; timer = 0; hadHeat = false; allDone = false;
    hpMap = new WeakMap();
    player.setWeapon(0);
    hud.setMission(missionText());
  }
  function info() {
    return {
      weapon: weapon === 0 ? 'Bare Hands' : 'Pistol',
      ammo: weapon === 0 ? '—' : (reloading > 0 ? 'Reloading…' : `${mag} / ${reserve}`),
      health: Math.ceil(health), armour: Math.ceil(armour), money,
    };
  }
  function update(dt, ctx) {
    gameTime += dt;
    if (fireCd > 0) fireCd -= dt;
    if (meleeCd > 0) meleeCd -= dt;
    if (hurtCd > 0) hurtCd -= dt;
    if (reloading > 0) {
      reloading -= dt;
      if (reloading <= 0) {
        const take = Math.min(12 - mag, reserve);
        mag += take;
        reserve -= take;
        hud.showToast('Reloaded');
      }
    }
    if (wasted) {
      wastedT -= dt;
      if (wastedT <= 0) respawn();
      return;
    }
    if (!ctx.driving) {
      if (input.consumeFire()) fire();
      if (input.consumeMelee()) melee();
      if (input.consumeReload()) reload();
      const sw = input.consumeSwitch();
      if (sw !== null) switchWeapon(sw);
    }
    if (health < 100 && gameTime - lastHurt > 6) {
      const s = nearestSafe();
      const inSafe = Math.hypot(s[0] - player.pos.x, s[1] - player.pos.z) <= 8;
      health = Math.min(100, health + (inSafe ? 10 : 3) * dt);
    }
    if (hurtCd <= 0) {
      for (const u of npcs.units) {
        if (u.state === 'pursue' && Math.hypot(u.pos.x - player.pos.x, u.pos.z - player.pos.z) < 2.0) {
          hurtPlayer(6);
          hurtCd = 1.2;
          break;
        }
      }
    }
    if (!allDone) {
      const m = MS[mi];
      if (m.k === 1) {
        if (timer <= 0) timer = m.time;
        timer -= dt;
        if (timer <= 0) {
          timer = m.time;
          hud.showToast('Delivery failed — Time ran out. Try again.');
          audio.blip();
        }
      }
      if (m.k === 3) {
        const w = npcs.wantedInfo();
        if (w.level >= 1) hadHeat = true;
        if (hadHeat && w.level === 0) completeMission();
      }
    }
  }
  return {
    update, fire, melee, reload, switchWeapon, onEnterCar, arrive, waypoint, missionText, info,
    save, loadSave, continueGame, reset,
    get wasted() { return wasted; },
    get missionIndex() { return mi; },
    get missionDone() { return allDone; },
    get missionStep() { return si; },
    get missionTimer() { return Math.max(0, Math.ceil(timer)); },
    debugHurt(n) { hurtPlayer(n || 10); },
    debugSetMission(i) { mi = Math.max(0, Math.min(MS.length - 1, i)); si = 0; timer = 0; hadHeat = false; allDone = false; hud.setMission(missionText()); return mi; },
    debugSetAmmo(m, r) { mag = m; reserve = r; },
  };
}

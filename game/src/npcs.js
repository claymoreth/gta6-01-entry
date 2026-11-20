import * as THREE from 'three';
import { resolveCircle, clamp } from './collision.js';
import { WORLD_BOUNDS } from './world.js';
const PED_COUNT = 14;
const FOOT_POLICE_COUNT = 3;
const WANTED_HEAT = { theft: 15, damage: 20, policeDamage: 25, pedHit: 35, assault: 25, weaponFire: 15 };
const LEVEL_HEAT = [0, 1, 21, 41, 61, 86];
function levelForHeat(h) {
  if (h <= 0) return 0;
  if (h < LEVEL_HEAT[2]) return 1;
  if (h < LEVEL_HEAT[3]) return 2;
  if (h < LEVEL_HEAT[4]) return 3;
  if (h < LEVEL_HEAT[5]) return 4;
  return 5;
}
const HEAT_DECAY = 1.5;
const HEAT_DECAY_HIDING = 3.0;
const WITNESS_RANGE_PED = 25;
const WITNESS_RANGE_POLICE = 45;
const LOS_RANGE_FOOT = 45;
const LOS_RANGE_CAR = 60;
const DAMAGE_CRIME_COOLDOWN = 5;
const PED_REPORT_DELAY = 1.5;
const LOSE_SIGHT_TIME = 2;
const ACTIVE_RECOMPUTE = 2;
const HIDING_ZONES = [
  { x: -155, z: -10, r: 8, name: 'Safehouse — Green House' },
  { x: 132, z: 45, r: 8, name: 'Safehouse — Pier Office' },
  { x: 30, z: -26, r: 6, name: 'Narrow Alley' },
  { x: -30, z: 30, r: 6, name: 'Narrow Alley' },
];
function inHidingZone(x, z) {
  for (const zn of HIDING_ZONES) {
    if (Math.hypot(x - zn.x, z - zn.z) <= zn.r) return zn;
  }
  return null;
}
const PED_SEGMENTS = [
  [{ x: -50, z: -6.5 }, { x: 50, z: -6.5 }],
  [{ x: -50, z: 6.5 }, { x: 50, z: 6.5 }],
  [{ x: -6.5, z: -50 }, { x: -6.5, z: 50 }],
  [{ x: 6.5, z: -50 }, { x: 6.5, z: 50 }],
  [{ x: -160, z: -4.5 }, { x: -70, z: -4.5 }],
  [{ x: -160, z: 6.5 }, { x: -70, z: 6.5 }],
  [{ x: -120.5, z: -50 }, { x: -120.5, z: 50 }],
  [{ x: -109.5, z: -50 }, { x: -109.5, z: 50 }],
  [{ x: 70, z: -6.5 }, { x: 150, z: -6.5 }],
  [{ x: 70, z: 6.5 }, { x: 150, z: 6.5 }],
  [{ x: 107.5, z: -50 }, { x: 107.5, z: 50 }],
  [{ x: 122.5, z: -50 }, { x: 122.5, z: 50 }],
];
const PED_LOOPS = [
  [{ x: -152, z: 24 }, { x: -130, z: 24 }, { x: -130, z: 50 }, { x: -152, z: 50 }],
  [{ x: 142, z: -3 }, { x: 168, z: -3 }, { x: 168, z: 3 }, { x: 142, z: 3 }],
];
const POLICE_PATROLS = [
  [{ x: -50, z: -6.5 }, { x: 50, z: -6.5 }],
  [{ x: -120.5, z: -50 }, { x: -120.5, z: 50 }],
  [{ x: 107.5, z: -50 }, { x: 107.5, z: 50 }],
];
const GEO = {
  torso: new THREE.BoxGeometry(0.46, 0.58, 0.26),
  head: new THREE.BoxGeometry(0.28, 0.3, 0.28),
  hair: new THREE.BoxGeometry(0.3, 0.09, 0.3),
  arm: new THREE.BoxGeometry(0.13, 0.55, 0.15).translate(0, -0.275, 0),
  leg: new THREE.BoxGeometry(0.17, 0.72, 0.19).translate(0, -0.36, 0),
  cap: new THREE.BoxGeometry(0.32, 0.07, 0.32),
  badge: new THREE.BoxGeometry(0.1, 0.12, 0.03),
};
const SHIRT_COLORS = [0x3a6db3, 0xd23a2f, 0x3a7a4a, 0xb38a2f, 0x7a4a8a, 0xd8d8d8];
const PANTS_COLORS = [0x2c3e63, 0x3a3a3a, 0x6b4a2f];
const SKIN_COLORS = [0xc98d64, 0x8a5a3a];
const HAIR_COLORS = [0x14100c, 0x4a3220];
const POLICE_SHIRT = 0x1a2a4a;
const POLICE_PANTS = 0x14161c;
class HumanoidRenderer {
  constructor(scene, count, policeCount) {
    this.count = count;
    this.policeCount = policeCount;
    const white = new THREE.MeshLambertMaterial({ color: 0xffffff });
    this.torso = new THREE.InstancedMesh(GEO.torso, white, count);
    this.head = new THREE.InstancedMesh(GEO.head, white, count);
    this.hair = new THREE.InstancedMesh(GEO.hair, white, count);
    this.arm = new THREE.InstancedMesh(GEO.arm, white, count * 2);
    this.leg = new THREE.InstancedMesh(GEO.leg, white, count * 2);
    this.cap = new THREE.InstancedMesh(
      GEO.cap, new THREE.MeshLambertMaterial({ color: 0x101018 }), policeCount);
    this.badge = new THREE.InstancedMesh(
      GEO.badge, new THREE.MeshBasicMaterial({ color: 0xffd166 }), policeCount);
    for (const m of [this.torso, this.head, this.hair, this.arm, this.leg, this.cap, this.badge]) {
      m.castShadow = true;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(m);
    }
    this._base = new THREE.Matrix4();
    this._part = new THREE.Matrix4();
    this._o = new THREE.Object3D();
    this._c = new THREE.Color();
  }
  setColors(i, shirt, pants, skin, hair) {
    this._c.setHex(shirt);
    this.torso.setColorAt(i, this._c);
    this.arm.setColorAt(i * 2, this._c);
    this.arm.setColorAt(i * 2 + 1, this._c);
    this._c.setHex(pants);
    this.leg.setColorAt(i * 2, this._c);
    this.leg.setColorAt(i * 2 + 1, this._c);
    this._c.setHex(skin);
    this.head.setColorAt(i, this._c);
    this._c.setHex(hair);
    this.hair.setColorAt(i, this._c);
    for (const m of [this.torso, this.head, this.hair, this.arm, this.leg]) {
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }
  _place(mesh, idx, px, py, pz, rx) {
    this._o.position.set(px, py, pz);
    this._o.rotation.set(rx, 0, 0);
    this._o.scale.set(1, 1, 1);
    this._o.updateMatrix();
    this._part.multiplyMatrices(this._base, this._o.matrix);
    mesh.setMatrixAt(idx, this._part);
  }
  setPose(i, pos, heading, swing, height, lying, policeIndex) {
    const base = this._base;
    base.makeTranslation(pos.x, lying ? 0.25 : 0, pos.z);
    this._part.makeRotationY(heading);
    base.multiply(this._part);
    if (lying) {
      this._part.makeRotationX(-Math.PI / 2);
      base.multiply(this._part);
    }
    this._part.makeScale(1, height, 1);
    base.multiply(this._part);
    this._place(this.torso, i, 0, 1.12, 0, 0);
    this._place(this.head, i, 0, 1.62, 0, 0);
    this._place(this.hair, i, 0, 1.8, 0, 0);
    this._place(this.arm, i * 2, -0.31, 1.38, 0, -swing * 0.8);
    this._place(this.arm, i * 2 + 1, 0.31, 1.38, 0, swing * 0.8);
    this._place(this.leg, i * 2, -0.13, 0.82, 0, swing);
    this._place(this.leg, i * 2 + 1, 0.13, 0.82, 0, -swing);
    if (policeIndex >= 0) {
      this._place(this.cap, policeIndex, 0, 1.86, 0, 0);
      this._place(this.badge, policeIndex, 0.12, 1.28, 0.15, 0);
    }
    for (const m of [this.torso, this.head, this.hair, this.arm, this.leg, this.cap, this.badge]) {
      m.instanceMatrix.needsUpdate = true;
    }
  }
}
function resolvePedFromCars(x, z, vehicles) {
  let px = x;
  let pz = z;
  for (const v of vehicles) {
    const fx = Math.sin(v.heading);
    const fz = Math.cos(v.heading);
    const axle = v.type.wheelbase / 2;
    for (const s of [1, -1]) {
      const ax = v.pos.x + fx * axle * s;
      const az = v.pos.z + fz * axle * s;
      const dx = px - ax;
      const dz = pz - az;
      const d = Math.hypot(dx, dz);
      const minD = 0.4 + 1.15;
      if (d < minD && d > 0.001) {
        px = ax + (dx / d) * minD;
        pz = az + (dz / d) * minD;
      }
    }
  }
  return { x: px, z: pz };
}
class Pedestrian {
  constructor(renderer, route, index) {
    this.renderer = renderer;
    this.index = index;
    const vi = index;
    this.height = 0.92 + ((vi * 37) % 16) / 100;
    renderer.setColors(
      index,
      SHIRT_COLORS[vi % SHIRT_COLORS.length],
      PANTS_COLORS[vi % PANTS_COLORS.length],
      SKIN_COLORS[vi % SKIN_COLORS.length],
      HAIR_COLORS[Math.floor(vi / 2) % HAIR_COLORS.length],
    );
    this.route = route;
    this.speed = 1.0 + ((vi * 13) % 6) / 10;
    this.state = 'walk';
    this.wpIndex = 0;
    this.dir = 1;
    const start = route.points[0];
    this.pos = new THREE.Vector3(start.x, 0, start.z);
    this.heading = Math.atan2(route.points[1].x - start.x, route.points[1].z - start.z);
    this.walkPhase = vi * 1.7;
    this.swingAmp = 0.6;
    this.lying = false;
    this.idleTimer = 0;
    this.fleeTimer = 0;
    this.downTimer = 0;
    this.fleeFrom = { x: 0, z: 0 };
    this.frameCount = 0;
    this.frameSkip = 1;
    this.stuckTimer = 0;
    this.stuckX = start.x;
    this.stuckZ = start.z;
    this.syncPose();
  }
  syncPose() {
    const swing = Math.sin(this.walkPhase) * this.swingAmp;
    this.renderer.setPose(this.index, this.pos, this.heading, swing, this.height, this.lying, -1);
  }
  reset() {
    const start = this.route.points[0];
    this.pos.set(start.x, 0, start.z);
    this.heading = Math.atan2(this.route.points[1].x - start.x, this.route.points[1].z - start.z);
    this.state = 'walk';
    this.wpIndex = 0;
    this.dir = 1;
    this.swingAmp = 0.6;
    this.lying = false;
    this.idleTimer = 0;
    this.fleeTimer = 0;
    this.downTimer = 0;
    this.frameCount = 0;
    this.frameSkip = 1;
    this.stuckTimer = 0;
    this.stuckX = start.x;
    this.stuckZ = start.z;
    this.syncPose();
  }
  targetPoint() {
    if (this.route.kind === 'segment') {
      return this.dir > 0 ? this.route.points[1] : this.route.points[0];
    }
    return this.route.points[this.wpIndex];
  }
  advanceWaypoint() {
    if (this.route.kind === 'segment') {
      this.dir = -this.dir;
    } else {
      this.wpIndex = (this.wpIndex + 1) % this.route.points.length;
    }
  }
  retargetNearest() {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < this.route.points.length; i++) {
      const p = this.route.points[i];
      const d = Math.hypot(p.x - this.pos.x, p.z - this.pos.z);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (this.route.kind === 'segment') {
      this.dir = best === 0 ? 1 : -1;
    } else {
      this.wpIndex = best;
    }
  }
  vehicleAhead(ctx) {
    for (const v of ctx.vehicles) {
      const dx = v.pos.x - this.pos.x;
      const dz = v.pos.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 4 || d < 0.01) continue;
      if (Math.abs(v.speed) < 0.5) continue;
      const fx = Math.sin(v.heading);
      const fz = Math.cos(v.heading);
      const dot = ((dx * fx + dz * fz) / d) * Math.sign(v.speed);
      if (dot > 0.6) return true;
    }
    return false;
  }
  moveToward(tx, tz, speed, dt, ctx) {
    const dx = tx - this.pos.x;
    const dz = tz - this.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.05) return 0;
    const vx = (dx / dist) * speed;
    const vz = (dz / dist) * speed;
    let nx = this.pos.x + vx * dt;
    let nz = this.pos.z + vz * dt;
    nx = clamp(nx, WORLD_BOUNDS.minX + 1, WORLD_BOUNDS.maxX - 1);
    nz = clamp(nz, WORLD_BOUNDS.minZ + 1, WORLD_BOUNDS.maxZ - 1);
    const solved = resolveCircle(nx, nz, 0.4, 0, 1.8, ctx.colliders);
    const pushed = resolvePedFromCars(solved.x, solved.z, ctx.vehicles);
    const moved = Math.hypot(pushed.x - this.pos.x, pushed.z - this.pos.z);
    this.pos.x = pushed.x;
    this.pos.z = pushed.z;
    const targetYaw = Math.atan2(vx, vz);
    let d = targetYaw - this.heading;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.heading += d * Math.min(1, 10 * dt);
    const running = speed > 2;
    this.swingAmp = running ? 0.85 : 0.6;
    this.walkPhase += speed * dt * 2.2 * (running ? 1.4 : 1);
    this.syncPose();
    return moved;
  }
  fleeFromPoint(x, z, seconds) {
    if (this.state === 'down') return;
    this.state = 'flee';
    this.fleeFrom = { x, z };
    this.fleeTimer = seconds;
  }
  knockDown(x, z) {
    if (this.state === 'down') return;
    this.state = 'down';
    this.downTimer = 4;
    this.fleeFrom = { x, z };
    this.lying = true;
    this.syncPose();
  }
  update(dt, ctx) {
    this.frameCount++;
    if (this.frameCount % this.frameSkip !== 0) return;
    const edt = dt * this.frameSkip;
    if (this.state === 'down') {
      this.downTimer -= edt;
      if (this.downTimer <= 0) {
        this.lying = false;
        this.state = 'flee';
        this.fleeTimer = 4 + Math.random() * 2;
        this.syncPose();
      }
      return;
    }
    if (this.state === 'flee') {
      this.fleeTimer -= edt;
      const dx = this.pos.x - this.fleeFrom.x;
      const dz = this.pos.z - this.fleeFrom.z;
      const d = Math.hypot(dx, dz) || 1;
      this.moveToward(this.pos.x + (dx / d) * 10, this.pos.z + (dz / d) * 10, 3.2, edt, ctx);
      if (this.fleeTimer <= 0) {
        this.state = 'walk';
        this.retargetNearest();
      }
      return;
    }
    if (this.state === 'idle') {
      this.idleTimer -= edt;
      this.swingAmp = 0;
      this.syncPose();
      if (this.idleTimer <= 0) this.state = 'walk';
      return;
    }
    if (this.state === 'wait') {
      if (!this.vehicleAhead(ctx)) {
        this.state = 'walk';
      } else {
        this.swingAmp = 0;
        this.syncPose();
        return;
      }
    }
    const wp = this.targetPoint();
    const dx = wp.x - this.pos.x;
    const dz = wp.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 1.0) {
      this.advanceWaypoint();
      if (Math.random() < 0.25) {
        this.state = 'idle';
        this.idleTimer = 1 + Math.random() * 2;
      }
      return;
    }
    if (this.vehicleAhead(ctx)) {
      this.state = 'wait';
      return;
    }
    const moved = this.moveToward(wp.x, wp.z, this.speed, edt, ctx);
    if (moved < 0.02) {
      this.stuckTimer += edt;
      if (this.stuckTimer > 3) {
        this.stuckTimer = 0;
        this.advanceWaypoint();
      }
    } else {
      this.stuckTimer = 0;
    }
    this.stuckX = this.pos.x;
    this.stuckZ = this.pos.z;
  }
}
class FootPolice {
  constructor(renderer, patrol, index, policeIndex) {
    this.kind = 'foot';
    this.renderer = renderer;
    this.index = index;
    this.policeIndex = policeIndex;
    this.height = 1.0;
    renderer.setColors(
      index,
      POLICE_SHIRT,
      POLICE_PANTS,
      SKIN_COLORS[index % SKIN_COLORS.length],
      HAIR_COLORS[index % HAIR_COLORS.length],
    );
    this.patrol = patrol;
    this.dir = 1;
    const start = patrol.points[0];
    this.pos = new THREE.Vector3(start.x, 0, start.z);
    this.heading = Math.atan2(patrol.points[1].x - start.x, patrol.points[1].z - start.z);
    this.walkPhase = index * 2.1;
    this.swingAmp = 0.6;
    this.state = 'patrol';
    this.target = { x: start.x, z: start.z };
    this.searchPoints = [];
    this.searchIndex = 0;
    this.scanTimer = 0;
    this.seesPlayer = false;
    this.loseTimer = 0;
    this.losTimer = index * 0.15;
    this.holdTimer = 0;
    this.stuckTimer = 0;
    this.stuckX = start.x;
    this.stuckZ = start.z;
    this.sidestepTimer = 0;
    this.sidestepDir = 1;
    this.downTimer = 0;
    this.lying = false;
    this.syncPose();
  }
  syncPose() {
    const swing = Math.sin(this.walkPhase) * this.swingAmp;
    this.renderer.setPose(this.index, this.pos, this.heading, swing, this.height, this.lying, this.policeIndex);
  }
  knockDown() {
    if (this.state === 'down') return;
    this.state = 'down';
    this.downTimer = 4;
    this.lying = true;
    this.syncPose();
  }
  reset() {
    const start = this.patrol.points[0];
    this.pos.set(start.x, 0, start.z);
    this.heading = Math.atan2(this.patrol.points[1].x - start.x, this.patrol.points[1].z - start.z);
    this.state = 'patrol';
    this.dir = 1;
    this.swingAmp = 0.6;
    this.searchPoints = [];
    this.searchIndex = 0;
    this.scanTimer = 0;
    this.seesPlayer = false;
    this.loseTimer = 0;
    this.losTimer = 0;
    this.holdTimer = 0;
    this.stuckTimer = 0;
    this.sidestepTimer = 0;
    this.downTimer = 0;
    this.lying = false;
    this.syncPose();
  }
  patrolTarget() {
    return this.dir > 0 ? this.patrol.points[1] : this.patrol.points[0];
  }
  moveToward(tx, tz, speed, dt, ctx) {
    const dx = tx - this.pos.x;
    const dz = tz - this.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.05) return 0;
    const vx = (dx / dist) * speed;
    const vz = (dz / dist) * speed;
    let nx = this.pos.x + vx * dt;
    let nz = this.pos.z + vz * dt;
    nx = clamp(nx, WORLD_BOUNDS.minX + 1, WORLD_BOUNDS.maxX - 1);
    nz = clamp(nz, WORLD_BOUNDS.minZ + 1, WORLD_BOUNDS.maxZ - 1);
    const solved = resolveCircle(nx, nz, 0.45, 0, 1.8, ctx.colliders);
    const pushed = resolvePedFromCars(solved.x, solved.z, ctx.vehicles);
    const moved = Math.hypot(pushed.x - this.pos.x, pushed.z - this.pos.z);
    this.pos.x = pushed.x;
    this.pos.z = pushed.z;
    const targetYaw = Math.atan2(vx, vz);
    let d = targetYaw - this.heading;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.heading += d * Math.min(1, 10 * dt);
    const running = speed > 2.5;
    this.swingAmp = running ? 0.85 : 0.6;
    this.walkPhase += speed * dt * 2.2 * (running ? 1.4 : 1);
    this.syncPose();
    return moved;
  }
  update(dt, ctx) {
    if (this.state === 'down') {
      this.downTimer -= dt;
      if (this.downTimer <= 0) {
        this.lying = false;
        this.state = 'patrol';
        this.syncPose();
      }
      return;
    }
    if (this.holdTimer > 0) {
      this.holdTimer -= dt;
      return;
    }
    const speed = this.state === 'patrol' ? 1.4 : this.state === 'pursue' ? ctx.runSpeed : 3.0;
    let tx;
    let tz;
    if (this.state === 'patrol') {
      const wp = this.patrolTarget();
      tx = wp.x;
      tz = wp.z;
      if (Math.hypot(tx - this.pos.x, tz - this.pos.z) < 1.0) this.dir = -this.dir;
    } else if (this.state === 'pursue') {
      tx = ctx.playerPos.x;
      tz = ctx.playerPos.z;
    } else {
      const t = this.searchPoints[this.searchIndex] || this.target;
      tx = t.x;
      tz = t.z;
      if (Math.hypot(tx - this.pos.x, tz - this.pos.z) < 2.5) {
        if (this.state === 'investigate') {
          this.scanTimer += dt;
          this.swingAmp = 0;
          this.syncPose();
          if (this.scanTimer > 2) {
            this.scanTimer = 0;
            if (ctx.wantedLevel > 0) {
              this.state = 'search';
              this.buildSearchPoints(ctx.lastKnown);
            } else {
              this.state = 'patrol';
            }
          }
          return;
        }
        this.searchIndex++;
        if (this.searchIndex >= this.searchPoints.length) {
          this.searchIndex = 0;
          if (ctx.wantedLevel > 0) this.buildSearchPoints(ctx.lastKnown);
          else this.state = 'patrol';
        }
        return;
      }
    }
    let mx = tx;
    let mz = tz;
    if (this.state !== 'patrol' && this.sidestepTimer > 0) {
      this.sidestepTimer -= dt;
      const dx = tx - this.pos.x;
      const dz = tz - this.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      mx = this.pos.x + (-dz / d) * this.sidestepDir * 6 + (dx / d) * 4;
      mz = this.pos.z + (dx / d) * this.sidestepDir * 6 + (dz / d) * 4;
    }
    const moved = this.moveToward(mx, mz, speed, dt, ctx);
    if (this.state !== 'patrol') {
      if (moved < 0.02) {
        this.stuckTimer += dt;
        if (this.stuckTimer > 3 && this.sidestepTimer <= 0) {
          this.stuckTimer = 0;
          this.sidestepTimer = 1.5;
          this.sidestepDir = Math.random() < 0.5 ? 1 : -1;
        }
      } else {
        this.stuckTimer = 0;
      }
    }
    this.stuckX = this.pos.x;
    this.stuckZ = this.pos.z;
  }
  buildSearchPoints(lkp) {
    this.searchPoints = [];
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 4 + Math.random() * 10;
      this.searchPoints.push({
        x: clamp(lkp.x + Math.cos(a) * r, WORLD_BOUNDS.minX + 2, WORLD_BOUNDS.maxX - 2),
        z: clamp(lkp.z + Math.sin(a) * r, WORLD_BOUNDS.minZ + 2, WORLD_BOUNDS.maxZ - 2),
      });
    }
    this.searchIndex = 0;
  }
}
function snapToRoad(x, z) {
  const cands = [
    { x: clamp(x, -170, 170), z: 0 },
    { x: 0, z: clamp(z, -70, 70) },
    { x: -115, z: clamp(z, -60, 60) },
    { x: 115, z: clamp(z, -60, 60) },
  ];
  let best = cands[0];
  let bestD = Infinity;
  for (const c of cands) {
    const d = Math.hypot(c.x - x, c.z - z);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}
function steerToward(car, tx, tz) {
  const dx = tx - car.pos.x;
  const dz = tz - car.pos.z;
  const desired = Math.atan2(dx, dz);
  let dh = desired - car.heading;
  while (dh > Math.PI) dh -= Math.PI * 2;
  while (dh < -Math.PI) dh += Math.PI * 2;
  return clamp(-dh * 1.6, -1, 1);
}
export function createNpcs(scene, world, vehicles, audio, hud) {
  const colliders = world.colliders;
  const tallColliders = colliders.filter((c) =>
    c.maxY > 3 && ['building', 'house', 'warehouse', 'container', 'crane', 'office', 'lighthouse'].includes(c.name));
  function losClear(x0, z0, x1, z1) {
    for (let i = 1; i < 10; i++) {
      const t = i / 10;
      const x = x0 + (x1 - x0) * t;
      const z = z0 + (z1 - z0) * t;
      for (const c of tallColliders) {
        if (x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ) return false;
      }
    }
    return true;
  }
  const renderer = new HumanoidRenderer(scene, PED_SEGMENTS.length + PED_LOOPS.length + FOOT_POLICE_COUNT, FOOT_POLICE_COUNT);
  const pedestrians = [];
  for (let i = 0; i < PED_SEGMENTS.length; i++) {
    pedestrians.push(new Pedestrian(renderer, { kind: 'segment', points: PED_SEGMENTS[i] }, i));
  }
  for (let i = 0; i < PED_LOOPS.length; i++) {
    pedestrians.push(new Pedestrian(renderer, { kind: 'loop', points: PED_LOOPS[i] }, PED_SEGMENTS.length + i));
  }
  const footPolice = [];
  for (let i = 0; i < FOOT_POLICE_COUNT; i++) {
    footPolice.push(new FootPolice(renderer, { kind: 'segment', points: POLICE_PATROLS[i] }, PED_SEGMENTS.length + PED_LOOPS.length + i, i));
  }
  const carUnits = vehicles.police.map((car, i) => ({
    kind: 'car',
    car,
    index: i,
    pos: car.pos,
    state: 'patrol',
    target: { x: car.pos.x, z: car.pos.z },
    searchPoints: [],
    searchIndex: 0,
    scanTimer: 0,
    seesPlayer: false,
    loseTimer: 0,
    losTimer: i * 0.25,
    holdTimer: 0,
    stuckTimer: 0,
    recoverTimer: 0,
    flashTimer: 0,
    flashOn: false,
    disabledTimer: 0,
  }));
  const units = [...footPolice, ...carUnits];
  let gameTime = 0;
  let heat = 0;
  let level = 0;
  let status = '';
  let prevStatus = '';
  let lastKnown = { x: 0, z: 0 };
  let lastSeenTime = -100;
  let lastPlayerPos = { x: 0, z: 0 };
  let anyLos = false;
  let recomputeTimer = 0;
  let crimeSeq = 0;
  const crimeLog = [];
  const seenEventIds = new Set();
  const damageCrimeAt = new Map();
  const pendingReports = [];
  function notify(text, ms) {
    hud.showToast(text, ms ?? 3000, 'high');
  }
  function applyHeat(amount, x, z) {
    const oldLevel = level;
    heat = Math.min(100, heat + amount);
    level = levelForHeat(heat);
    lastKnown = { x, z };
    lastSeenTime = gameTime;
    if (level > oldLevel) {
      notify(`Wanted level increased — ${level} star${level > 1 ? 's' : ''}`);
      audio.blip();
    }
  }
  function clearWanted() {
    heat = 0;
    level = 0;
    status = '';
    prevStatus = '';
    for (const u of units) {
      u.state = 'patrol';
      u.searchPoints = [];
      u.searchIndex = 0;
    }
    audio.setSiren(false, 0);
  }
  function dispatchTo(x, z) {
    const sorted = [...units].sort(
      (a, b) => Math.hypot(a.pos.x - x, a.pos.z - z) - Math.hypot(b.pos.x - x, b.pos.z - z),
    );
    const first = sorted[0];
    if (first) {
      first.state = 'investigate';
      first.target = { x, z };
      first.scanTimer = 0;
      if (first.kind === 'car') {
        first.searchPoints = [];
        first.searchIndex = 0;
      }
    }
    const d = world.districtAt(x, z);
    notify(`Dispatch: Units responding to ${d.district}`);
  }
  function triggerDanger(x, z, radius) {
    for (const p of pedestrians) {
      if (p.state === 'down') continue;
      const d = Math.hypot(p.pos.x - x, p.pos.z - z);
      if (d <= radius) p.fleeFromPoint(x, z, 4 + Math.random() * 2);
    }
  }
  function reportCrime(type, x, z, opts) {
    opts = opts || {};
    if (opts.eventId) {
      if (seenEventIds.has(opts.eventId)) return { witnessed: false, byPolice: false, duplicate: true };
      seenEventIds.add(opts.eventId);
      if (seenEventIds.size > 200) {
        const first = seenEventIds.values().next().value;
        seenEventIds.delete(first);
      }
    }
    if (opts.target) {
      const last = damageCrimeAt.get(opts.target) || -100;
      if (gameTime - last < DAMAGE_CRIME_COOLDOWN) return { witnessed: false, byPolice: false, duplicate: true };
      damageCrimeAt.set(opts.target, gameTime);
    }
    const heatAmount = WANTED_HEAT[type] || WANTED_HEAT.damage;
    let policeWitness = false;
    let pedWitness = false;
    for (const u of units) {
      const d = Math.hypot(u.pos.x - x, u.pos.z - z);
      if (d <= WITNESS_RANGE_POLICE && losClear(u.pos.x, u.pos.z, x, z)) {
        policeWitness = true;
        break;
      }
    }
    if (!policeWitness) {
      for (const p of pedestrians) {
        if (p.state === 'down') continue;
        const d = Math.hypot(p.pos.x - x, p.pos.z - z);
        if (d <= WITNESS_RANGE_PED && losClear(p.pos.x, p.pos.z, x, z)) {
          pedWitness = true;
          break;
        }
      }
    }
    const event = { id: ++crimeSeq, type, x, z, heat: heatAmount, witnessed: policeWitness || pedWitness, byPolice: policeWitness, time: gameTime };
    crimeLog.push(event);
    if (crimeLog.length > 20) crimeLog.shift();
    if (policeWitness) {
      notify('Crime reported — Police responding');
      applyHeat(heatAmount, x, z);
      dispatchTo(x, z);
      triggerDanger(x, z, 25);
      return { witnessed: true, byPolice: true, duplicate: false };
    }
    if (pedWitness) {
      notify('A witness reported a crime');
      pendingReports.push({ time: gameTime + PED_REPORT_DELAY, heat: heatAmount, x, z });
      triggerDanger(x, z, 25);
      return { witnessed: true, byPolice: false, duplicate: false };
    }
    notify('No one saw that — no wanted level');
    return { witnessed: false, byPolice: false, duplicate: false };
  }
  function buildCarSearchPoints(u, lkp) {
    u.searchPoints = [];
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 4 + Math.random() * 10;
      const p = snapToRoad(
        clamp(lkp.x + Math.cos(a) * r, WORLD_BOUNDS.minX + 2, WORLD_BOUNDS.maxX - 2),
        clamp(lkp.z + Math.sin(a) * r, WORLD_BOUNDS.minZ + 2, WORLD_BOUNDS.maxZ - 2),
      );
      u.searchPoints.push(p);
    }
    u.searchIndex = 0;
  }
  function applyStuckRecovery(u, car, control, dt) {
    if (u.recoverTimer > 0) {
      u.recoverTimer -= dt;
      return { throttle: -0.5, steer: -control.steer, handbrake: false, boost: false };
    }
    if (Math.abs(car.speed) < 0.5 && control.throttle > 0) {
      u.stuckTimer += dt;
      if (u.stuckTimer > 4) {
        u.stuckTimer = 0;
        u.recoverTimer = 1.2;
        return { throttle: -0.5, steer: -control.steer, handbrake: false, boost: false };
      }
    } else {
      u.stuckTimer = 0;
    }
    return control;
  }
  function updateLightBar(u, dt) {
    const bar = u.car.lightBar;
    if (!bar) return;
    const active = u.state === 'pursue' || u.state === 'search' || u.state === 'investigate';
    if (!active) {
      if (u.flashOn) {
        u.flashOn = false;
        bar.redMat.color.setHex(0x551111);
        bar.blueMat.color.setHex(0x111155);
      }
      return;
    }
    u.flashTimer -= dt;
    if (u.flashTimer <= 0) {
      u.flashTimer = 0.35;
      u.flashOn = !u.flashOn;
      bar.redMat.color.setHex(u.flashOn ? 0xff2a2a : 0x551111);
      bar.blueMat.color.setHex(u.flashOn ? 0x111155 : 0x2a6bff);
    }
  }
  function updatePoliceCar(u, dt, ctx) {
    const car = u.car;
    if (u.holdTimer > 0) {
      u.holdTimer -= dt;
      vehicles.updatePolice(car, dt, { throttle: -1, steer: 0, handbrake: false, boost: false });
      updateLightBar(u, dt);
      return;
    }
    if (car.damage >= 0.95) {
      u.disabledTimer += dt;
      vehicles.updatePolice(car, dt, { throttle: 0, steer: 0, handbrake: true, boost: false });
      if (u.disabledTimer > 8) {
        u.disabledTimer = 0;
        car.damage = 0.3;
        u.state = 'patrol';
      }
      updateLightBar(u, dt);
      return;
    }
    u.disabledTimer = 0;
    let control;
    if (u.state === 'patrol') {
      control = car.trafficControl(dt, vehicles.all, ctx.playerOnFoot, ctx.pedPositions);
    } else if (u.state === 'pursue') {
      const p = ctx.playerPos;
      const d = Math.hypot(p.x - car.pos.x, p.z - car.pos.z);
      let tx = p.x;
      let tz = p.z;
      if (d > 15) {
        const snapped = snapToRoad(p.x, p.z);
        tx = snapped.x;
        tz = snapped.z;
      } else if (level >= 4) {
        const lead = Math.min(1.5, d / 25);
        tx = p.x + ctx.playerVel.x * lead;
        tz = p.z + ctx.playerVel.z * lead;
      }
      const steer = steerToward(car, tx, tz);
      control = {
        throttle: d < 6 ? 0 : (level >= 4 ? 1.0 : 0.85),
        steer,
        handbrake: d < 6,
        boost: level >= 4,
      };
      control = applyStuckRecovery(u, car, control, dt);
    } else {
      const t = u.searchPoints[u.searchIndex] || u.target;
      const snapped = snapToRoad(t.x, t.z);
      const d = Math.hypot(snapped.x - car.pos.x, snapped.z - car.pos.z);
      if (d < 3) {
        if (u.state === 'investigate') {
          u.scanTimer += dt;
          control = { throttle: -1, steer: 0, handbrake: false, boost: false };
          if (u.scanTimer > 2) {
            u.scanTimer = 0;
            if (level > 0) {
              u.state = 'search';
              buildCarSearchPoints(u, lastKnown);
            } else {
              u.state = 'patrol';
            }
          }
        } else {
          u.searchIndex++;
          if (u.searchIndex >= u.searchPoints.length) {
            u.searchIndex = 0;
            if (level > 0) buildCarSearchPoints(u, lastKnown);
            else u.state = 'patrol';
          }
          control = { throttle: 0, steer: 0, handbrake: false, boost: false };
        }
      } else {
        const steer = steerToward(car, snapped.x, snapped.z);
        control = { throttle: 0.7, steer, handbrake: false, boost: false };
        control = applyStuckRecovery(u, car, control, dt);
      }
    }
    const crash = vehicles.updatePolice(car, dt, control);
    if (crash > 0) audio.crash(crash);
    updateLightBar(u, dt);
  }
  function recomputeActive() {
    const n = Math.min(level, units.length);
    const sorted = [...units].sort(
      (a, b) => Math.hypot(a.pos.x - lastKnown.x, a.pos.z - lastKnown.z) - Math.hypot(b.pos.x - lastKnown.x, b.pos.z - lastKnown.z),
    );
    const activeSet = new Set(sorted.slice(0, n));
    for (const u of units) {
      if (activeSet.has(u)) {
        if (u.state === 'patrol') {
          u.state = 'investigate';
          u.target = { ...lastKnown };
          u.scanTimer = 0;
          if (u.kind === 'car') {
            u.searchPoints = [];
            u.searchIndex = 0;
          }
        } else if (u.state === 'investigate') {
          u.target = { ...lastKnown };
        }
      } else if (u.state !== 'patrol') {
        u.state = 'patrol';
        u.searchPoints = [];
        u.searchIndex = 0;
      }
    }
  }
  function update(dt, ctx) {
    gameTime += dt;
    lastPlayerPos = { x: ctx.playerPos.x, z: ctx.playerPos.z };
    for (let i = pendingReports.length - 1; i >= 0; i--) {
      const r = pendingReports[i];
      if (gameTime >= r.time) {
        pendingReports.splice(i, 1);
        applyHeat(r.heat, r.x, r.z);
        dispatchTo(r.x, r.z);
      }
    }
    const pedPositions = [];
    for (const p of pedestrians) {
      const d = Math.hypot(p.pos.x - ctx.playerPos.x, p.pos.z - ctx.playerPos.z);
      p.frameSkip = d > 100 ? 5 : d > 60 ? 3 : 1;
      p.update(dt, { colliders, vehicles: ctx.vehicles });
      pedPositions.push({ x: p.pos.x, z: p.pos.z });
    }
    for (const o of footPolice) pedPositions.push({ x: o.pos.x, z: o.pos.z });
    for (const p of pedestrians) {
      if (p.state === 'down') continue;
      for (const v of ctx.vehicles) {
        const d = Math.hypot(v.pos.x - p.pos.x, v.pos.z - p.pos.z);
        if (d < 2.0 && Math.abs(v.speed) > 3) {
          p.knockDown(v.pos.x, v.pos.z);
          triggerDanger(p.pos.x, p.pos.z, 25);
          if (v === ctx.drivenCar) {
            v.speed *= 0.7;
            reportCrime('pedHit', p.pos.x, p.pos.z, {});
          }
          break;
        }
      }
    }
    if (ctx.drivenCar && Math.abs(ctx.drivenCar.speed) > 12) {
      for (const p of pedestrians) {
        if (p.state === 'down' || p.state === 'flee') continue;
        const d = Math.hypot(p.pos.x - ctx.drivenCar.pos.x, p.pos.z - ctx.drivenCar.pos.z);
        if (d < 8) p.fleeFromPoint(ctx.drivenCar.pos.x, ctx.drivenCar.pos.z, 4);
      }
    }
    anyLos = false;
    const runSpeed = 5.5 + level * 0.5;
    const footCtx = {
      colliders,
      vehicles: ctx.vehicles,
      playerPos: ctx.playerPos,
      wantedLevel: level,
      lastKnown,
      runSpeed,
    };
    for (const u of units) {
      u.losTimer -= dt;
      if (u.losTimer <= 0) {
        u.losTimer = 0.5;
        const range = u.kind === 'car' ? LOS_RANGE_CAR : LOS_RANGE_FOOT;
        const d = Math.hypot(u.pos.x - ctx.playerPos.x, u.pos.z - ctx.playerPos.z);
        u.seesPlayer = d <= range && losClear(u.pos.x, u.pos.z, ctx.playerPos.x, ctx.playerPos.z);
      }
      if (u.seesPlayer) {
        anyLos = true;
        lastKnown = { x: ctx.playerPos.x, z: ctx.playerPos.z };
        lastSeenTime = gameTime;
        u.loseTimer = 0;
        if (u.state === 'search' || u.state === 'investigate') u.state = 'pursue';
      } else if (u.state === 'pursue') {
        u.loseTimer += dt;
        if (u.loseTimer > LOSE_SIGHT_TIME) {
          u.state = 'search';
          if (u.kind === 'foot') u.buildSearchPoints(lastKnown);
          else buildCarSearchPoints(u, lastKnown);
        }
      }
    }
    recomputeTimer -= dt;
    if (recomputeTimer <= 0) {
      recomputeTimer = ACTIVE_RECOMPUTE;
      if (level > 0) recomputeActive();
    }
    for (const o of footPolice) o.update(dt, footCtx);
    for (const u of carUnits) {
      updatePoliceCar(u, dt, {
        playerPos: ctx.playerPos,
        playerVel: ctx.playerVel,
        playerOnFoot: ctx.playerOnFoot,
        pedPositions,
      });
    }
    let newStatus = '';
    if (level > 0) {
      if (anyLos) {
        newStatus = 'PURSUIT';
      } else {
        const searching = units.some((u) => u.state === 'search' || u.state === 'investigate');
        newStatus = searching ? 'SEARCH' : 'HIDDEN';
        const zone = inHidingZone(ctx.playerPos.x, ctx.playerPos.z);
        const rate = zone ? HEAT_DECAY_HIDING : HEAT_DECAY;
        const oldLevel = level;
        heat = Math.max(0, heat - rate * dt);
        level = levelForHeat(heat);
        if (level === 0) {
          notify('Wanted level cleared — Police resuming patrol');
          for (const u of units) {
            if (u.state !== 'patrol') {
              u.state = 'patrol';
              u.searchPoints = [];
              u.searchIndex = 0;
            }
          }
        } else if (level < oldLevel) {
          notify(`Wanted level decreased — ${level} star${level > 1 ? 's' : ''}`);
        }
      }
    }
    if (newStatus !== prevStatus) {
      if (newStatus === 'PURSUIT' && prevStatus !== 'PURSUIT') notify('Police pursuit in progress');
      if (newStatus === 'SEARCH' && prevStatus === 'PURSUIT') notify('Police lost sight — Searching last known location');
      if (newStatus === 'HIDDEN' && (prevStatus === 'SEARCH' || prevStatus === 'PURSUIT')) notify('You escaped — Wanted level decreasing');
      prevStatus = newStatus;
    }
    status = newStatus;
    const sirenOn = level > 0 && (status === 'PURSUIT' || status === 'SEARCH');
    audio.setSiren(sirenOn, level / 5);
  }
  function reset() {
    for (const p of pedestrians) p.reset();
    for (const o of footPolice) o.reset();
    for (const u of carUnits) {
      u.state = 'patrol';
      u.target = { x: u.car.pos.x, z: u.car.pos.z };
      u.searchPoints = [];
      u.searchIndex = 0;
      u.scanTimer = 0;
      u.seesPlayer = false;
      u.loseTimer = 0;
      u.holdTimer = 0;
      u.stuckTimer = 0;
      u.recoverTimer = 0;
      u.flashTimer = 0;
      u.flashOn = false;
      u.disabledTimer = 0;
      if (u.car.lightBar) {
        u.car.lightBar.redMat.color.setHex(0x551111);
        u.car.lightBar.blueMat.color.setHex(0x111155);
      }
    }
    gameTime = 0;
    heat = 0;
    level = 0;
    status = '';
    prevStatus = '';
    lastKnown = { x: 0, z: 0 };
    lastSeenTime = -100;
    anyLos = false;
    recomputeTimer = 0;
    crimeSeq = 0;
    crimeLog.length = 0;
    seenEventIds.clear();
    damageCrimeAt.clear();
    pendingReports.length = 0;
    audio.setSiren(false, 0);
  }
  function wantedInfo() {
    return { level, heat, status };
  }
  function minimapInfo() {
    return {
      peds: pedestrians.map((p) => ({ x: p.pos.x, z: p.pos.z })),
      police: units.map((u) => ({ x: u.pos.x, z: u.pos.z, car: u.kind === 'car' })),
    };
  }
  function pedPositions() {
    const out = pedestrians.map((p) => ({ x: p.pos.x, z: p.pos.z }));
    for (const o of footPolice) out.push({ x: o.pos.x, z: o.pos.z });
    return out;
  }
  const debug = {
    get pedestrians() {
      return pedestrians.map((p, i) => ({
        index: i, x: p.pos.x, z: p.pos.z, state: p.state, speed: p.speed,
        heading: p.heading,
      }));
    },
    get police() {
      return units.map((u, i) => ({
        index: i, kind: u.kind, x: u.pos.x, z: u.pos.z, state: u.state,
        seesPlayer: u.seesPlayer,
        heading: u.kind === 'car' ? u.car.heading : u.heading,
        speed: u.kind === 'car' ? u.car.speed : 0,
        damage: u.kind === 'car' ? u.car.damage : 0,
      }));
    },
    get wanted() {
      return { level, heat, status, lastKnown: { ...lastKnown }, lastSeenTime };
    },
    get crimes() {
      return crimeLog.map((c) => ({ ...c }));
    },
    get counts() {
      return { peds: pedestrians.length, footPolice: footPolice.length, policeCars: carUnits.length };
    },
    debugCrime(type, eventId) {
      return reportCrime(type, lastPlayerPos.x, lastPlayerPos.z, { eventId });
    },
    debugSetHeat(n) {
      heat = Math.max(0, Math.min(100, n));
      level = levelForHeat(heat);
      if (level === 0) status = '';
      lastKnown = { ...lastPlayerPos };
      lastSeenTime = gameTime;
      return { level, heat };
    },
    debugPlacePed(i, x, z) {
      const p = pedestrians[i];
      if (!p) return false;
      p.pos.set(x, 0, z);
      p.state = 'idle';
      p.idleTimer = 60;
      p.syncPose();
      return true;
    },
    debugPlacePolice(i, x, z) {
      const u = units[i];
      if (!u) return false;
      if (u.kind === 'foot') {
        u.pos.set(x, 0, z);
        u.holdTimer = 5;
        u.syncPose();
      } else {
        u.car.pos.set(x, 0, z);
        u.car.speed = 0;
        u.car.group.position.copy(u.car.pos);
        u.holdTimer = 5;
      }
      return true;
    },
    debugLOS(x0, z0, x1, z1) {
      return losClear(x0, z0, x1, z1);
    },
    debugInBuilding(x, z) {
      for (const c of tallColliders) {
        if (x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ) return true;
      }
      return false;
    },
    debugReset() {
      reset();
      return true;
    },
    debugTriggerDanger(x, z, radius) {
      triggerDanger(x, z, radius || 25);
      return true;
    },
    debugSetWalkersVisible(v) {
      for (const m of [renderer.torso, renderer.head, renderer.hair, renderer.arm, renderer.leg, renderer.cap, renderer.badge]) {
        m.visible = v;
      }
      return v;
    },
    debugHoldTraffic(i, seconds) {
      const car = vehicles.traffic[i];
      if (!car) return false;
      car.holdTimer = seconds || 60;
      car.speed = 0;
      return true;
    },
  };
  return {
    pedestrians,
    footPolice,
    carUnits,
    units,
    update,
    reset,
    reportCrime,
    clearWanted,
    triggerDanger,
    wantedInfo,
    minimapInfo,
    pedPositions,
    debug,
  };
}

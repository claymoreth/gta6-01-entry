import * as THREE from 'three';
import { resolveCircle, clamp } from './collision.js';
import { WORLD_BOUNDS } from './world.js';
const TYPES = {
  sedan: {
    name: 'Ember Sedan', color: 0x3a6db3, len: 4.4, wid: 1.9, h: 1.35,
    wheelbase: 2.7, wheelR: .34, topSpeed: 28, accel: 11, brake: 24,
    maxSteer: .55, reverseTop: 10,
  },
  sports: {
    name: 'Ember Sports', color: 0xd23a2f, len: 4.2, wid: 2.0, h: 1.08,
    wheelbase: 2.6, wheelR: .32, topSpeed: 38, accel: 15, brake: 28,
    maxSteer: .5, reverseTop: 12,
  },
  truck: {
    name: 'Ember Truck', color: 0xc47a1e, len: 6.4, wid: 2.4, h: 2.2,
    wheelbase: 3.9, wheelR: .45, topSpeed: 22, accel: 7, brake: 18,
    maxSteer: .45, reverseTop: 8,
  },
  police: {
    name: 'Police Interceptor', color: 0x14161c, len: 4.5, wid: 1.95, h: 1.3,
    wheelbase: 2.7, wheelR: .34, topSpeed: 32, accel: 13, brake: 26,
    maxSteer: .55, reverseTop: 10,
  },
  traffic: {
    name: 'Civic Car', color: 0x8a8f9a, len: 4.3, wid: 1.85, h: 1.3,
    wheelbase: 2.7, wheelR: .33, topSpeed: 11, accel: 6, brake: 16,
    maxSteer: .5, reverseTop: 6,
  },
};
const TRAFFIC_COLORS = [0x8a8f9a, 0xd8d8d8, 0x2f6d6b, 0xb8a03a, 0x5a5a6e, 0x7a4a6b, 0x3a5a8a];
let smokeTex = null;
function getSmokeTexture() {
  if (smokeTex) return smokeTex;
  const cv = document.createElement('canvas');
  cv.width = 64;
  cv.height = 64;
  const g = cv.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(200,200,200,0.85)');
  grad.addColorStop(.6, 'rgba(160,160,160,0.4)');
  grad.addColorStop(1, 'rgba(140,140,140,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  smokeTex = new THREE.CanvasTexture(cv);
  return smokeTex;
}
function buildCarMesh(type, color) {
  const t = TYPES[type];
  const group = new THREE.Group();
  const shell = new THREE.Group();
  shell.rotation.y = -Math.PI / 2;
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1a1a20 });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x16283a });
  const chromeMat = new THREE.MeshLambertMaterial({ color: 0x8a8f9a });
  const tyreMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  const hubMat = new THREE.MeshLambertMaterial({ color: 0x9a9aa2 });
  const halfL = t.len / 2;
  const halfW = t.wid / 2;
  if (type === 'truck') {
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(t.len, .5, t.wid), darkMat);
    chassis.position.y = .55;
    chassis.castShadow = true;
    shell.add(chassis);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.7, t.wid - .15), bodyMat);
    cab.position.set(halfL - 1.1, 1.35, 0);
    cab.castShadow = true;
    shell.add(cab);
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(.1, .8, t.wid - .5), glassMat);
    windshield.position.set(halfL - .15, 1.55, 0);
    shell.add(windshield);
    const bedWall = new THREE.MeshLambertMaterial({ color });
    const bedFloor = new THREE.Mesh(new THREE.BoxGeometry(3.6, .18, t.wid - .1), bedWall);
    bedFloor.position.set(-halfL + 1.9, .9, 0);
    bedFloor.castShadow = true;
    shell.add(bedFloor);
    for (const [bx, bz, bw, bd] of [
      [-halfL + .15, 0, .18, t.wid - .1],
      [-halfL + 1.9, halfW - .1, 3.6, .18],
      [-halfL + 1.9, -halfW + .1, 3.6, .18],
    ]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(bw, .9, bd), bedWall);
      wall.position.set(bx, 1.35, bz);
      wall.castShadow = true;
      shell.add(wall);
    }
    const crate = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1, 1.1), new THREE.MeshLambertMaterial({ color: 0x6b4a2f }));
    crate.position.set(-halfL + 1.6, 1.5, 0);
    crate.castShadow = true;
    shell.add(crate);
  } else {
    const body = new THREE.Mesh(new THREE.BoxGeometry(t.len, .55, t.wid), bodyMat);
    body.position.y = .55;
    body.castShadow = true;
    shell.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(t.len * .52, .5, t.wid * .82), glassMat);
    cabin.position.set(-t.len * .04, 1.05, 0);
    cabin.castShadow = true;
    shell.add(cabin);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(t.len * .46, .08, t.wid * .78), bodyMat);
    roof.position.set(-t.len * .04, 1.32, 0);
    roof.castShadow = true;
    shell.add(roof);
    const hood = new THREE.Mesh(new THREE.BoxGeometry(.7, .08, t.wid * .9), bodyMat);
    hood.position.set(halfL - .55, .86, 0);
    shell.add(hood);
    const bumperF = new THREE.Mesh(new THREE.BoxGeometry(.25, .3, t.wid + .06), darkMat);
    bumperF.position.set(halfL - .05, .42, 0);
    shell.add(bumperF);
    const bumperR = new THREE.Mesh(new THREE.BoxGeometry(.25, .3, t.wid + .06), darkMat);
    bumperR.position.set(-halfL + .05, .42, 0);
    shell.add(bumperR);
  }
  const headMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const s of [-1, 1]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(.12, .16, .42), headMat);
    head.position.set(halfL + .02, .72, s * (halfW - .45));
    shell.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(.12, .14, .5), tailMat);
    tail.position.set(-halfL - .02, .72, s * (halfW - .45));
    shell.add(tail);
  }
  for (const s of [-1, 1]) {
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(.16, .1, .08), darkMat);
    mirror.position.set(halfL * .45, 1, s * (halfW + .02));
    shell.add(mirror);
  }
  let lightBar = null;
  if (type === 'police') {
    const whiteMat = new THREE.MeshLambertMaterial({ color: 0xe8e8e8 });
    for (const s of [-1, 1]) {
      const door = new THREE.Mesh(new THREE.BoxGeometry(1.5, .5, .06), whiteMat);
      door.position.set(-.1, .62, s * (halfW + .01));
      shell.add(door);
    }
    const redMat = new THREE.MeshBasicMaterial({ color: 0x551111 });
    const blueMat = new THREE.MeshBasicMaterial({ color: 0x111155 });
    const barBase = new THREE.Mesh(new THREE.BoxGeometry(.7, .1, 1.1), darkMat);
    barBase.position.set(-.1, 1.42, 0);
    shell.add(barBase);
    const red = new THREE.Mesh(new THREE.BoxGeometry(.5, .16, .45), redMat);
    red.position.set(-.1, 1.52, .28);
    shell.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(.5, .16, .45), blueMat);
    blue.position.set(-.1, 1.52, -.28);
    shell.add(blue);
    lightBar = { redMat, blueMat };
  }
  const wheels = {};
  const wheelZ = halfW - .08;
  const axleF = t.wheelbase / 2;
  const axleR = -t.wheelbase / 2;
  function makeWheel(x, z, steered) {
    const steerG = new THREE.Group();
    steerG.position.set(x, t.wheelR, z);
    const spinG = new THREE.Group();
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(t.wheelR, t.wheelR, .24, 12), tyreMat);
    tyre.rotation.z = Math.PI / 2;
    tyre.castShadow = true;
    spinG.add(tyre);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(t.wheelR * .45, t.wheelR * .45, .26, 8), hubMat);
    hub.rotation.z = Math.PI / 2;
    spinG.add(hub);
    steerG.add(spinG);
    group.add(steerG);
    return { steerG, spinG };
  }
  const fl = makeWheel(wheelZ, axleF, true);
  const fr = makeWheel(-wheelZ, axleF, true);
  const rl = makeWheel(wheelZ, axleR, false);
  const rr = makeWheel(-wheelZ, axleR, false);
  wheels.steerL = fl.steerG;
  wheels.steerR = fr.steerG;
  wheels.spinFL = fl.spinG;
  wheels.spinFR = fr.spinG;
  wheels.spinRL = rl.spinG;
  wheels.spinRR = rr.spinG;
  group.add(shell);
  return { group, wheels, lightBar };
}
function resolveCar(pos, heading, type, speed, colliders) {
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const axle = type.wheelbase / 2;
  const r = type.wid / 2 + .15;
  let impact = 0;
  for (const s of [1, -1]) {
    const ax = pos.x + fx * axle * s;
    const az = pos.z + fz * axle * s;
    const solved = resolveCircle(ax, az, r, 0, 2.2, colliders);
    const dx = solved.x - ax;
    const dz = solved.z - az;
    if (dx !== 0 || dz !== 0) {
      pos.x += dx;
      pos.z += dz;
      impact = Math.max(impact, Math.abs(speed));
    }
  }
  return impact;
}
class Vehicle {
  constructor(scene, typeName, x, z, heading, opts) {
    this.typeName = typeName;
    this.type = TYPES[typeName];
    this.drivable = !!(opts && opts.drivable);
    this.traffic = !!(opts && opts.traffic);
    this.police = !!(opts && opts.police);
    this.stolen = false;
    const color = (opts && opts.color) ?? this.type.color;
    const built = buildCarMesh(typeName, color);
    this.group = built.group;
    this.wheels = built.wheels;
    this.lightBar = built.lightBar || null;
    this.pos = new THREE.Vector3(x, 0, z);
    this.heading = heading;
    this.speed = 0;
    this.steer = 0;
    this.damage = 0;
    this.spawn = { x, z, heading };
    this.group.position.copy(this.pos);
    this.group.rotation.y = heading;
    scene.add(this.group);
    this.route = (opts && opts.route) || null;
    this.wpIndex = (opts && opts.wpIndex) || 0;
    this.targetSpeed = (opts && opts.targetSpeed) || 8;
    this.stuckTimer = 0;
    this.recoverTimer = 0;
    this.smoke = [];
    this.smokeTimer = 0;
    for (let i = 0; i < 8; i++) {
      const mat = new THREE.SpriteMaterial({
        map: getSmokeTexture(), transparent: true, opacity: 0, depthWrite: false,
      });
      const spr = new THREE.Sprite(mat);
      spr.scale.set(.6, .6, 1);
      spr.visible = false;
      scene.add(spr);
      this.smoke.push({ spr, life: 0, maxLife: 1 });
    }
  }
  reset() {
    this.pos.set(this.spawn.x, 0, this.spawn.z);
    this.heading = this.spawn.heading;
    this.speed = 0;
    this.steer = 0;
    this.damage = 0;
    this.stolen = false;
    this.wpIndex = 0;
    this.stuckTimer = 0;
    this.recoverTimer = 0;
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.heading;
    if (this.lightBar) {
      this.lightBar.redMat.color.setHex(0x551111);
      this.lightBar.blueMat.color.setHex(0x111155);
    }
    for (const s of this.smoke) {
      s.spr.visible = false;
      s.spr.material.opacity = 0;
      s.life = 0;
    }
  }
  update(dt, control, colliders) {
    if (this.holdTimer > 0) {
      this.holdTimer -= dt;
      this.speed = 0;
      control = { throttle: 0, steer: 0, handbrake: false, boost: false };
    }
    const t = this.type;
    const speedRatio = clamp(Math.abs(this.speed) / t.topSpeed, 0, 1);
    const maxSteer = t.maxSteer * (1 - speedRatio * .55);
    const targetSteer = control.steer * maxSteer;
    this.steer += (targetSteer - this.steer) * Math.min(1, 8 * dt);
    const dmgFactor = 1 - this.damage * .5;
    const engineDead = this.damage >= .95;
    if (control.throttle > 0 && !engineDead) {
      this.speed += t.accel * dmgFactor * control.throttle * dt * (control.boost ? 1.35 : 1);
    } else if (control.throttle < 0) {
      if (this.speed > .5) {
        this.speed = Math.max(0, this.speed + t.brake * control.throttle * dt);
      } else if (!engineDead) {
        this.speed += t.accel * .55 * control.throttle * dt;
      }
    }
    if (control.handbrake) {
      const hb = t.brake * 1.3 * dt;
      this.speed = Math.abs(this.speed) <= hb ? 0 : this.speed - Math.sign(this.speed) * hb;
    }
    this.speed -= this.speed * .55 * dt;
    this.speed -= Math.sign(this.speed) * .6 * dt;
    if (Math.abs(this.speed) < .05 && control.throttle === 0 && !control.handbrake) this.speed = 0;
    const top = t.topSpeed * (1 - this.damage * .4);
    this.speed = clamp(this.speed, -t.reverseTop, top);
    const yawRate = (this.speed / t.wheelbase) * Math.tan(this.steer) * (control.handbrake ? 1.6 : 1);
    this.heading -= yawRate * dt;
    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    this.pos.x += fx * this.speed * dt;
    this.pos.z += fz * this.speed * dt;
    const impact = resolveCar(this.pos, this.heading, t, this.speed, colliders);
    let crash = 0;
    if (impact > 4) {
      this.damage = Math.min(1, this.damage + (impact - 4) * .02);
      this.speed *= .35;
      crash = impact;
    }
    this.pos.x = clamp(this.pos.x, WORLD_BOUNDS.minX + 2, WORLD_BOUNDS.maxX - 2);
    this.pos.z = clamp(this.pos.z, WORLD_BOUNDS.minZ + 2, WORLD_BOUNDS.maxZ - 2);
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.heading;
    const spin = (this.speed * dt) / t.wheelR;
    this.wheels.spinFL.rotation.x += spin;
    this.wheels.spinFR.rotation.x += spin;
    this.wheels.spinRL.rotation.x += spin;
    this.wheels.spinRR.rotation.x += spin;
    this.wheels.steerL.rotation.y = this.steer;
    this.wheels.steerR.rotation.y = this.steer;
    this.updateSmoke(dt);
    return crash;
  }
  updateSmoke(dt) {
    this.smokeTimer -= dt;
    if (this.damage > .5 && Math.abs(this.speed) > .5 && this.smokeTimer <= 0) {
      this.smokeTimer = .14;
      const fx = Math.sin(this.heading);
      const fz = Math.cos(this.heading);
      const puff = this.smoke.find((s) => s.life <= 0);
      if (puff) {
        puff.life = 1.1;
        puff.maxLife = 1.1;
        puff.spr.visible = true;
        puff.spr.position.set(
          this.pos.x + fx * this.type.len * .42,
          1.4,
          this.pos.z + fz * this.type.len * .42,
        );
        puff.spr.scale.set(.6, .6, 1);
      }
    }
    for (const s of this.smoke) {
      if (s.life <= 0) continue;
      s.life -= dt;
      if (s.life <= 0) {
        s.spr.visible = false;
        s.spr.material.opacity = 0;
        continue;
      }
      const k = 1 - s.life / s.maxLife;
      s.spr.position.y += dt * .9;
      const sc = .6 + k * 1.8;
      s.spr.scale.set(sc, sc, 1);
      s.spr.material.opacity = .5 * (1 - k);
    }
  }
  trafficControl(dt, others, playerOnFoot, pedestrians) {
    const wp = this.route[this.wpIndex];
    const dx = wp.x - this.pos.x;
    const dz = wp.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 8) {
      this.wpIndex = (this.wpIndex + 1) % this.route.length;
    }
    const desired = Math.atan2(dx, dz);
    let dh = desired - this.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    let steer = clamp(-dh * 1.6, -1, 1);
    if (this.recoverTimer > 0) {
      this.recoverTimer -= dt;
      return { throttle: -.5, steer: -steer, handbrake: false, boost: false };
    }
    if (Math.abs(this.speed) < .3 && Math.abs(steer) > .3) {
      this.stuckTimer += dt;
      if (this.stuckTimer > 4) {
        this.stuckTimer = 0;
        this.recoverTimer = 1.2;
        return { throttle: -.5, steer: -steer, handbrake: false, boost: false };
      }
    } else {
      this.stuckTimer = 0;
    }
    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    let blocked = false;
    for (const o of others) {
      if (o === this) continue;
      const ox = o.pos.x - this.pos.x;
      const oz = o.pos.z - this.pos.z;
      const d = Math.hypot(ox, oz);
      if (d > 10 || d < .01) continue;
      const dot = (ox * fx + oz * fz) / d;
      if (dot > .86) {
        blocked = true;
        break;
      }
    }
    if (!blocked && playerOnFoot) {
      const ox = playerOnFoot.x - this.pos.x;
      const oz = playerOnFoot.z - this.pos.z;
      const d = Math.hypot(ox, oz);
      if (d < 7 && d > .01) {
        const dot = (ox * fx + oz * fz) / d;
        if (dot > .8) blocked = true;
      }
    }
    if (!blocked && pedestrians) {
      for (const p of pedestrians) {
        const ox = p.x - this.pos.x;
        const oz = p.z - this.pos.z;
        const d = Math.hypot(ox, oz);
        if (d > 8 || d < .01) continue;
        const dot = (ox * fx + oz * fz) / d;
        if (dot > .8) {
          blocked = true;
          break;
        }
      }
    }
    const throttle = blocked ? -1 : this.speed < this.targetSpeed ? .65 : 0;
    if (blocked && this.speed < 0) steer = -steer;
    return { throttle, steer, handbrake: false, boost: false };
  }
}
export const LOOPS = {
  ew: [
    { x: -160, z: 2.5 }, { x: 160, z: 2.5 }, { x: 166, z: 0 },
    { x: 160, z: -2.5 }, { x: -160, z: -2.5 }, { x: -166, z: 0 },
  ],
  dermaga: [
    { x: 118, z: 55 }, { x: 118, z: -55 }, { x: 115, z: -58 },
    { x: 112, z: -55 }, { x: 112, z: 55 }, { x: 115, z: 58 },
  ],
  melati: [
    { x: -112, z: 50 }, { x: -112, z: -50 }, { x: -115, z: -53 },
    { x: -118, z: -50 }, { x: -118, z: 50 }, { x: -115, z: 53 },
  ],
};
export function createVehicles(scene, world) {
  const colliders = world.colliders;
  const drivables = [];
  const traffic = [];
  drivables.push(new Vehicle(scene, 'sedan', 28, -11.5, -Math.PI / 2, { drivable: true }));
  drivables.push(new Vehicle(scene, 'sports', -100, -20, -Math.PI / 2, { drivable: true }));
  drivables.push(new Vehicle(scene, 'truck', 108, 30, Math.PI, { drivable: true }));
  const trafficSpecs = [
    { loop: 'ew', at: 0, speed: 9, color: TRAFFIC_COLORS[0] },
    { loop: 'ew', at: 2, speed: 7, color: TRAFFIC_COLORS[1] },
    { loop: 'ew', at: 4, speed: 10, color: TRAFFIC_COLORS[2] },
    { loop: 'dermaga', at: 0, speed: 8, color: TRAFFIC_COLORS[3] },
    { loop: 'dermaga', at: 3, speed: 6, color: TRAFFIC_COLORS[4] },
    { loop: 'melati', at: 0, speed: 8, color: TRAFFIC_COLORS[5] },
    { loop: 'melati', at: 3, speed: 7, color: TRAFFIC_COLORS[6] },
  ];
  for (const spec of trafficSpecs) {
    const loop = LOOPS[spec.loop];
    const start = loop[spec.at];
    const next = loop[(spec.at + 1) % loop.length];
    const heading = Math.atan2(next.x - start.x, next.z - start.z);
    const car = new Vehicle(scene, 'traffic', start.x, start.z, heading, {
      traffic: true,
      color: spec.color,
      route: loop,
      wpIndex: (spec.at + 1) % loop.length,
      targetSpeed: spec.speed,
    });
    traffic.push(car);
  }
  const all = [...drivables, ...traffic];
  const police = [];
  const policeSpecs = [
    { loop: 'ew', at: 0, x: 10, z: 2.5, heading: Math.PI / 2 },
    { loop: 'dermaga', at: 0, x: 118, z: 40, heading: Math.PI },
  ];
  for (const spec of policeSpecs) {
    const loop = LOOPS[spec.loop];
    const car = new Vehicle(scene, 'police', spec.x, spec.z, spec.heading, {
      police: true,
      route: loop,
      wpIndex: 1,
      targetSpeed: 9,
    });
    police.push(car);
    all.push(car);
  }
  let driven = null;
  const headlight = new THREE.SpotLight(0xffe9a8, 0, 34, .5, .55, 1.4);
  const headlightTarget = new THREE.Object3D();
  headlight.target = headlightTarget;
  function nearestDrivable(x, z, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const v of drivables) {
      const d = Math.hypot(v.pos.x - x, v.pos.z - z);
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    return best ? { vehicle: best, dist: bestD } : null;
  }
  function resolvePlayer(player) {
    for (const v of all) {
      const fx = Math.sin(v.heading);
      const fz = Math.cos(v.heading);
      const axle = v.type.wheelbase / 2;
      for (const s of [1, -1]) {
        const ax = v.pos.x + fx * axle * s;
        const az = v.pos.z + fz * axle * s;
        const solved = resolveCircle(player.pos.x, player.pos.z, .45, 0, 1.8, [
          { minX: ax - 1.15, maxX: ax + 1.15, minZ: az - 1.15, maxZ: az + 1.15, minY: 0, maxY: 2, name: 'car' },
        ]);
        player.pos.x = solved.x;
        player.pos.z = solved.z;
      }
    }
  }
  function separate() {
    let worst = 0;
    const trafficDamage = [];
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i];
        const b = all[j];
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.z - a.pos.z;
        const d = Math.hypot(dx, dz);
        const minD = 3.1;
        if (d >= minD || d < .001) continue;
        const push = (minD - d) / 2;
        const nx = dx / d;
        const nz = dz / d;
        a.pos.x -= nx * push;
        a.pos.z -= nz * push;
        b.pos.x += nx * push;
        b.pos.z += nz * push;
        const closing = Math.abs(a.speed - b.speed);
        if (closing > 4 && (a === driven || b === driven)) {
          const hit = Math.min(closing, 14);
          worst = Math.max(worst, hit);
          const dmg = (hit - 4) * .015;
          a.damage = Math.min(1, a.damage + dmg);
          b.damage = Math.min(1, b.damage + dmg);
          a.speed *= .6;
          b.speed *= .6;
          const victim = a === driven ? b : a;
          if (victim.traffic || victim.police) {
            trafficDamage.push({ car: victim, amount: dmg });
          }
        }
      }
    }
    return { worst, trafficDamage };
  }
  function setDriven(v) {
    driven = v;
    if (headlight.parent) headlight.parent.remove(headlight);
    if (headlightTarget.parent) headlightTarget.parent.remove(headlightTarget);
    if (v) {
      headlight.position.set(0, 1, v.type.len / 2 - .2);
      headlightTarget.position.set(0, 0, v.type.len / 2 + 14);
      v.group.add(headlight);
      v.group.add(headlightTarget);
      headlight.intensity = 80;
    } else {
      headlight.intensity = 0;
    }
  }
  function reset() {
    for (const v of all) v.reset();
    setDriven(null);
  }
  function update(dt, control, playerOnFoot, pedestrians) {
    const crashes = [];
    if (driven && control) {
      const c = driven.update(dt, control, colliders);
      if (c > 0) crashes.push(c);
    }
    for (const car of traffic) {
      if (car === driven) continue;
      const ctrl = car.trafficControl(dt, all, playerOnFoot, pedestrians);
      const c = car.update(dt, ctrl, colliders);
      if (c > 0 && car === driven) crashes.push(c);
    }
    const sep = separate();
    if (sep.worst > 0) crashes.push(sep.worst);
    return { crashes, trafficDamage: sep.trafficDamage };
  }
  function updatePolice(car, dt, control) {
    return car.update(dt, control, colliders);
  }
  function nearestEnterable(x, z, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const v of [...drivables, ...traffic]) {
      const d = Math.hypot(v.pos.x - x, v.pos.z - z);
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    if (!best) return null;
    return { vehicle: best, dist: bestD, theft: !!best.traffic && !best.stolen };
  }
  return {
    drivables,
    traffic,
    police,
    all,
    LOOPS,
    get driven() { return driven; },
    nearestDrivable,
    nearestEnterable,
    updatePolice,
    resolvePlayer,
    setDriven,
    reset,
    update,
  };
}

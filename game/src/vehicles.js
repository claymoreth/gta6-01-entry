// CITY OF EMBERS — vehicles + driving + traffic (original, Phase 3).
// Arcade car physics (bicycle-ish model: throttle/brake/reverse, steering
// that tightens with speed, handbrake drift), original low-poly car models
// built from primitives, and civilian traffic that follows road loops with
// simple obstacle braking. No external assets, no network requests.
//
// Conventions (same as player.js): heading is a yaw around Y, forward =
// (sin heading, cos heading) in (x, z). Steering right (D) DECREASES the
// heading, so a car moving forward turns right. Speed is signed: + forward,
// - reverse. All motion is frame-rate independent (dt, clamped by main.js).

import * as THREE from 'three';
import { resolveCircle, clamp } from './collision.js';
import { WORLD_BOUNDS } from './world.js';

// ---- vehicle types (original Ember Bay fleet) ----
const TYPES = {
  sedan: {
    name: 'Sedan Ember', color: 0x3a6db3, len: 4.4, wid: 1.9, h: 1.35,
    wheelbase: 2.7, wheelR: 0.34, topSpeed: 28, accel: 11, brake: 24,
    maxSteer: 0.55, reverseTop: 10,
  },
  sports: {
    name: 'Sports Ember', color: 0xd23a2f, len: 4.2, wid: 2.0, h: 1.08,
    wheelbase: 2.6, wheelR: 0.32, topSpeed: 38, accel: 15, brake: 28,
    maxSteer: 0.5, reverseTop: 12,
  },
  truck: {
    name: 'Truk Ember', color: 0xc47a1e, len: 6.4, wid: 2.4, h: 2.2,
    wheelbase: 3.9, wheelR: 0.45, topSpeed: 22, accel: 7, brake: 18,
    maxSteer: 0.45, reverseTop: 8,
  },
  // Traffic cars reuse the sedan body with muted civic colours.
  traffic: {
    name: 'Mobil Warga', color: 0x8a8f9a, len: 4.3, wid: 1.85, h: 1.3,
    wheelbase: 2.7, wheelR: 0.33, topSpeed: 11, accel: 6, brake: 16,
    maxSteer: 0.5, reverseTop: 6,
  },
};

const TRAFFIC_COLORS = [0x8a8f9a, 0xd8d8d8, 0x2f6d6b, 0xb8a03a, 0x5a5a6e, 0x7a4a6b, 0x3a5a8a];

// ---- smoke texture (one shared canvas radial gradient) ----
let smokeTex = null;
function getSmokeTexture() {
  if (smokeTex) return smokeTex;
  const cv = document.createElement('canvas');
  cv.width = 64;
  cv.height = 64;
  const g = cv.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(200,200,200,0.85)');
  grad.addColorStop(0.6, 'rgba(160,160,160,0.4)');
  grad.addColorStop(1, 'rgba(140,140,140,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  smokeTex = new THREE.CanvasTexture(cv);
  return smokeTex;
}

// ---- car mesh (original, built from primitives) ----
// Returns { group, spinFL, spinFR, spinRL, spinRR, steerL, steerR }.
// Wheel hierarchy: steerGroup (rotation.y = steer, front only) ->
// spinGroup (rotation.x += speed*dt/r) -> cylinder mesh (axis along X).
function buildCarMesh(type, color) {
  const t = TYPES[type];
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1a1a20 });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x16283a });
  const chromeMat = new THREE.MeshLambertMaterial({ color: 0x8a8f9a });
  const tyreMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  const hubMat = new THREE.MeshLambertMaterial({ color: 0x9a9aa2 });

  const halfL = t.len / 2;
  const halfW = t.wid / 2;

  if (type === 'truck') {
    // Cab (front, tall) + open cargo bed (rear) + chassis.
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(t.len, 0.5, t.wid), darkMat);
    chassis.position.y = 0.55;
    chassis.castShadow = true;
    group.add(chassis);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.7, t.wid - 0.15), bodyMat);
    cab.position.set(halfL - 1.1, 1.35, 0);
    cab.castShadow = true;
    group.add(cab);
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, t.wid - 0.5), glassMat);
    windshield.position.set(halfL - 0.15, 1.55, 0);
    group.add(windshield);
    const bedWall = new THREE.MeshLambertMaterial({ color });
    // cargo bed: floor + 3 walls (open at the back)
    const bedFloor = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.18, t.wid - 0.1), bedWall);
    bedFloor.position.set(-halfL + 1.9, 0.9, 0);
    bedFloor.castShadow = true;
    group.add(bedFloor);
    for (const [bx, bz, bw, bd] of [
      [-halfL + 0.15, 0, 0.18, t.wid - 0.1],
      [-halfL + 1.9, halfW - 0.1, 3.6, 0.18],
      [-halfL + 1.9, -halfW + 0.1, 3.6, 0.18],
    ]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.9, bd), bedWall);
      wall.position.set(bx, 1.35, bz);
      wall.castShadow = true;
      group.add(wall);
    }
    // a crate in the bed
    const crate = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.0, 1.1), new THREE.MeshLambertMaterial({ color: 0x6b4a2f }));
    crate.position.set(-halfL + 1.6, 1.5, 0);
    crate.castShadow = true;
    group.add(crate);
  } else {
    // Sedan / sports / traffic: lower body + glass cabin + roof + bumpers.
    const body = new THREE.Mesh(new THREE.BoxGeometry(t.len, 0.55, t.wid), bodyMat);
    body.position.y = 0.55;
    body.castShadow = true;
    group.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(t.len * 0.52, 0.5, t.wid * 0.82), glassMat);
    cabin.position.set(-t.len * 0.04, 1.05, 0);
    cabin.castShadow = true;
    group.add(cabin);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(t.len * 0.46, 0.08, t.wid * 0.78), bodyMat);
    roof.position.set(-t.len * 0.04, 1.32, 0);
    roof.castShadow = true;
    group.add(roof);
    // hood + trunk ridges
    const hood = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, t.wid * 0.9), bodyMat);
    hood.position.set(halfL - 0.55, 0.86, 0);
    group.add(hood);
    const bumperF = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.3, t.wid + 0.06), darkMat);
    bumperF.position.set(halfL - 0.05, 0.42, 0);
    group.add(bumperF);
    const bumperR = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.3, t.wid + 0.06), darkMat);
    bumperR.position.set(-halfL + 0.05, 0.42, 0);
    group.add(bumperR);
  }

  // Headlights (warm emissive, front) + taillights (red, rear).
  const headMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const s of [-1, 1]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.42), headMat);
    head.position.set(halfL + 0.02, 0.72, s * (halfW - 0.45));
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.5), tailMat);
    tail.position.set(-halfL - 0.02, 0.72, s * (halfW - 0.45));
    group.add(tail);
  }
  // side mirrors
  for (const s of [-1, 1]) {
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.08), darkMat);
    mirror.position.set(halfL * 0.45, 1.0, s * (halfW + 0.02));
    group.add(mirror);
  }

  // Wheels: steer groups (front) -> spin groups -> tyre + hub.
  const wheels = {};
  const wheelZ = halfW - 0.08;
  const axleF = t.wheelbase / 2;
  const axleR = -t.wheelbase / 2;
  function makeWheel(x, z, steered) {
    const steerG = new THREE.Group();
    steerG.position.set(x, t.wheelR, z);
    const spinG = new THREE.Group();
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(t.wheelR, t.wheelR, 0.24, 12), tyreMat);
    tyre.rotation.z = Math.PI / 2; // cylinder axis along X (the axle)
    tyre.castShadow = true;
    spinG.add(tyre);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(t.wheelR * 0.45, t.wheelR * 0.45, 0.26, 8), hubMat);
    hub.rotation.z = Math.PI / 2;
    spinG.add(hub);
    steerG.add(spinG);
    group.add(steerG);
    return { steerG, spinG };
  }
  const fl = makeWheel(axleF, wheelZ, true);
  const fr = makeWheel(axleF, -wheelZ, true);
  const rl = makeWheel(axleR, wheelZ, false);
  const rr = makeWheel(axleR, -wheelZ, false);
  wheels.steerL = fl.steerG;
  wheels.steerR = fr.steerG;
  wheels.spinFL = fl.spinG;
  wheels.spinFR = fr.spinG;
  wheels.spinRL = rl.spinG;
  wheels.spinRR = rr.spinG;

  // No per-car light: a single shared headlight spotlight (created in
  // createVehicles) is attached to the driven car only. Ten spotlights in
  // the scene would bloat every shader program with light uniforms — the
  // headless SwiftShader validator failed such programs flakily at load.
  return { group, wheels };
}

// Push a car's two axle circles out of the world colliders.
// Returns the impact speed (|speed| at the moment of the push), 0 if free.
function resolveCar(pos, heading, type, speed, colliders) {
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const axle = type.wheelbase / 2;
  const r = type.wid / 2 + 0.15;
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

// ---- vehicle (physics + visuals + damage) ----
class Vehicle {
  constructor(scene, typeName, x, z, heading, opts) {
    this.typeName = typeName;
    this.type = TYPES[typeName];
    this.drivable = !!(opts && opts.drivable);
    this.traffic = !!(opts && opts.traffic);
    const color = (opts && opts.color) ?? this.type.color;
    const built = buildCarMesh(typeName, color);
    this.group = built.group;
    this.wheels = built.wheels;
    this.pos = new THREE.Vector3(x, 0, z);
    this.heading = heading;
    this.speed = 0;
    this.steer = 0;
    this.damage = 0;
    this.spawn = { x, z, heading };
    this.group.position.copy(this.pos);
    this.group.rotation.y = heading;
    scene.add(this.group);
    // traffic AI state
    this.route = (opts && opts.route) || null;
    this.wpIndex = (opts && opts.wpIndex) || 0;
    this.targetSpeed = (opts && opts.targetSpeed) || 8;
    this.stuckTimer = 0;
    this.recoverTimer = 0;
    // damage smoke pool
    this.smoke = [];
    this.smokeTimer = 0;
    for (let i = 0; i < 8; i++) {
      const mat = new THREE.SpriteMaterial({
        map: getSmokeTexture(), transparent: true, opacity: 0, depthWrite: false,
      });
      const spr = new THREE.Sprite(mat);
      spr.scale.set(0.6, 0.6, 1);
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
    this.wpIndex = 0;
    this.stuckTimer = 0;
    this.recoverTimer = 0;
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.heading;
    for (const s of this.smoke) {
      s.spr.visible = false;
      s.spr.material.opacity = 0;
      s.life = 0;
    }
  }

  // control: { throttle (-1..1), steer (-1..1), handbrake, boost }
  // Returns crash intensity (0 = no crash this frame).
  update(dt, control, colliders) {
    const t = this.type;
    const speedRatio = clamp(Math.abs(this.speed) / t.topSpeed, 0, 1);
    const maxSteer = t.maxSteer * (1 - speedRatio * 0.55);
    const targetSteer = control.steer * maxSteer;
    this.steer += (targetSteer - this.steer) * Math.min(1, 8 * dt);

    const dmgFactor = 1 - this.damage * 0.5;
    const engineDead = this.damage >= 0.95;
    if (control.throttle > 0 && !engineDead) {
      this.speed += t.accel * dmgFactor * control.throttle * dt * (control.boost ? 1.35 : 1);
    } else if (control.throttle < 0) {
      if (this.speed > 0.5) {
        // S while moving = brake, down to (but never past) a stop.
        this.speed = Math.max(0, this.speed + t.brake * control.throttle * dt);
      } else if (!engineDead) {
        // S from (near) stop = reverse.
        this.speed += t.accel * 0.55 * control.throttle * dt;
      }
    }
    if (control.handbrake) {
      // Handbrake: strong decel that stops at zero, never flips the sign
      // (a flipped sign would jitter the car around a standstill).
      const hb = t.brake * 1.3 * dt;
      this.speed = Math.abs(this.speed) <= hb ? 0 : this.speed - Math.sign(this.speed) * hb;
    }
    // drag + rolling resistance
    this.speed -= this.speed * 0.55 * dt;
    this.speed -= Math.sign(this.speed) * 0.6 * dt;
    if (Math.abs(this.speed) < 0.05 && control.throttle === 0 && !control.handbrake) this.speed = 0;
    const top = t.topSpeed * (1 - this.damage * 0.4);
    this.speed = clamp(this.speed, -t.reverseTop, top);

    // yaw: bicycle model. Steering right (steer > 0) decreases heading.
    const yawRate = (this.speed / t.wheelbase) * Math.tan(this.steer) * (control.handbrake ? 1.6 : 1);
    this.heading -= yawRate * dt;

    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    this.pos.x += fx * this.speed * dt;
    this.pos.z += fz * this.speed * dt;

    // world collision (walls, containers, lamps...) — two axle circles.
    const impact = resolveCar(this.pos, this.heading, t, this.speed, colliders);
    let crash = 0;
    if (impact > 4) {
      this.damage = Math.min(1, this.damage + (impact - 4) * 0.02);
      this.speed *= 0.35;
      crash = impact;
    }
    // world bounds
    this.pos.x = clamp(this.pos.x, WORLD_BOUNDS.minX + 2, WORLD_BOUNDS.maxX - 2);
    this.pos.z = clamp(this.pos.z, WORLD_BOUNDS.minZ + 2, WORLD_BOUNDS.maxZ - 2);

    // visuals: mesh transform, wheel spin + steer, smoke
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
    // emit puffs from the hood while badly damaged and moving
    this.smokeTimer -= dt;
    if (this.damage > 0.5 && Math.abs(this.speed) > 0.5 && this.smokeTimer <= 0) {
      this.smokeTimer = 0.14;
      const fx = Math.sin(this.heading);
      const fz = Math.cos(this.heading);
      const puff = this.smoke.find((s) => s.life <= 0);
      if (puff) {
        puff.life = 1.1;
        puff.maxLife = 1.1;
        puff.spr.visible = true;
        puff.spr.position.set(
          this.pos.x + fx * this.type.len * 0.42,
          1.4,
          this.pos.z + fz * this.type.len * 0.42,
        );
        puff.spr.scale.set(0.6, 0.6, 1);
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
      s.spr.position.y += dt * 0.9;
      const sc = 0.6 + k * 1.8;
      s.spr.scale.set(sc, sc, 1);
      s.spr.material.opacity = 0.5 * (1 - k);
    }
  }

  // Traffic AI: pure pursuit along a road loop + obstacle braking.
  // others: all vehicles (for the obstacle check). playerOnFoot: {x, z} or null.
  trafficControl(dt, others, playerOnFoot) {
    const wp = this.route[this.wpIndex];
    const dx = wp.x - this.pos.x;
    const dz = wp.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 5) {
      this.wpIndex = (this.wpIndex + 1) % this.route.length;
    }
    const desired = Math.atan2(dx, dz);
    let dh = desired - this.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    let steer = clamp(dh * 1.6, -1, 1);

    // stuck recovery: reversing briefly if jammed against something
    if (this.recoverTimer > 0) {
      this.recoverTimer -= dt;
      return { throttle: -0.5, steer: -steer, handbrake: false, boost: false };
    }
    if (Math.abs(this.speed) < 0.3 && Math.abs(steer) > 0.3) {
      this.stuckTimer += dt;
      if (this.stuckTimer > 4) {
        this.stuckTimer = 0;
        this.recoverTimer = 1.2;
        return { throttle: -0.5, steer: -steer, handbrake: false, boost: false };
      }
    } else {
      this.stuckTimer = 0;
    }

    // obstacle ahead? brake (throttle -1 = brake while moving).
    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    let blocked = false;
    for (const o of others) {
      if (o === this) continue;
      const ox = o.pos.x - this.pos.x;
      const oz = o.pos.z - this.pos.z;
      const d = Math.hypot(ox, oz);
      if (d > 10 || d < 0.01) continue;
      const dot = (ox * fx + oz * fz) / d; // 1 = straight ahead
      if (dot > 0.86) {
        blocked = true;
        break;
      }
    }
    if (!blocked && playerOnFoot) {
      const ox = playerOnFoot.x - this.pos.x;
      const oz = playerOnFoot.z - this.pos.z;
      const d = Math.hypot(ox, oz);
      if (d < 7 && d > 0.01) {
        const dot = (ox * fx + oz * fz) / d;
        if (dot > 0.8) blocked = true;
      }
    }
    const throttle = blocked ? -1 : this.speed < this.targetSpeed ? 0.65 : 0;
    return { throttle, steer, handbrake: false, boost: false };
  }
}

// ---- road loops for traffic (right-hand lanes) ----
const LOOPS = {
  // East-west spine: eastbound z=+2.5, westbound z=-2.5.
  ew: [
    { x: -160, z: 2.5 }, { x: 160, z: 2.5 }, { x: 166, z: 0 },
    { x: 160, z: -2.5 }, { x: -160, z: -2.5 }, { x: -166, z: 0 },
  ],
  // Jalan Dermaga (x=115, wide): northbound x=118, southbound x=112.
  dermaga: [
    { x: 118, z: 55 }, { x: 118, z: -55 }, { x: 115, z: -58 },
    { x: 112, z: -55 }, { x: 112, z: 55 }, { x: 115, z: 58 },
  ],
  // Jalan Melati (x=-115): northbound x=-112, southbound x=-118.
  melati: [
    { x: -112, z: 50 }, { x: -112, z: -50 }, { x: -115, z: -53 },
    { x: -118, z: -50 }, { x: -118, z: 50 }, { x: -115, z: 53 },
  ],
};

export function createVehicles(scene, world) {
  const colliders = world.colliders;
  const drivables = [];
  const traffic = [];

  // Parked drivables — OFF the traffic lanes, on open ground by the curb.
  // Sedan: downtown north frontage (28, -11.5), facing WEST down the clear
  // strip between the tower row and the sidewalk lamps/palms (the old spot
  // faced east straight into tower [38,-18] and pinned the car on its wall).
  drivables.push(new Vehicle(scene, 'sedan', 28, -11.5, -Math.PI / 2, { drivable: true }));
  // Sports: residential, open strip between house rows (-100, -20), facing west.
  drivables.push(new Vehicle(scene, 'sports', -100, -20, -Math.PI / 2, { drivable: true }));
  // Truck: waterfront, west shoulder of Jalan Dermaga (108, 30), facing north.
  drivables.push(new Vehicle(scene, 'truck', 108, 30, Math.PI, { drivable: true }));

  // Traffic: 7 civilian cars on the three loops.
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
  let driven = null;

  // One shared headlight beam, attached to the driven car only (see
  // buildCarMesh: per-car spotlights bloated every shader program).
  const headlight = new THREE.SpotLight(0xffe9a8, 0, 34, 0.5, 0.55, 1.4);
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

  // Push a walking player circle out of every vehicle's footprint
  // (two axle circles per car, so the push respects the car's length).
  function resolvePlayer(player) {
    for (const v of all) {
      const fx = Math.sin(v.heading);
      const fz = Math.cos(v.heading);
      const axle = v.type.wheelbase / 2;
      for (const s of [1, -1]) {
        const ax = v.pos.x + fx * axle * s;
        const az = v.pos.z + fz * axle * s;
        const solved = resolveCircle(player.pos.x, player.pos.z, 0.45, 0, 1.8, [
          { minX: ax - 1.15, maxX: ax + 1.15, minZ: az - 1.15, maxZ: az + 1.15, minY: 0, maxY: 2, name: 'car' },
        ]);
        player.pos.x = solved.x;
        player.pos.z = solved.z;
      }
    }
  }

  // Pairwise separation so cars never overlap each other. Returns the
  // hardest impact (for damage + crash sound) involving the driven car.
  function separate() {
    let worst = 0;
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i];
        const b = all[j];
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.z - a.pos.z;
        const d = Math.hypot(dx, dz);
        const minD = 3.1;
        if (d >= minD || d < 0.001) continue;
        const push = (minD - d) / 2;
        const nx = dx / d;
        const nz = dz / d;
        a.pos.x -= nx * push;
        a.pos.z -= nz * push;
        b.pos.x += nx * push;
        b.pos.z += nz * push;
        // closing speed along the line -> damage if hard
        const closing = Math.abs(a.speed - b.speed);
        if (closing > 4 && (a === driven || b === driven)) {
          const hit = Math.min(closing, 14);
          worst = Math.max(worst, hit);
          a.damage = Math.min(1, a.damage + (hit - 4) * 0.015);
          b.damage = Math.min(1, b.damage + (hit - 4) * 0.015);
          a.speed *= 0.6;
          b.speed *= 0.6;
        }
      }
    }
    return worst;
  }

  function setDriven(v) {
    driven = v;
    if (headlight.parent) headlight.parent.remove(headlight);
    if (headlightTarget.parent) headlightTarget.parent.remove(headlightTarget);
    if (v) {
      headlight.position.set(v.type.len / 2 - 0.2, 1.0, 0);
      headlightTarget.position.set(v.type.len / 2 + 14, 0, 0);
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

  // control: { throttle, steer, handbrake, boost } for the driven car, or
  // null when the player is on foot. playerOnFoot: {x, z} or null (driving).
  // Returns { crashes: [intensities] } for sound effects.
  function update(dt, control, playerOnFoot) {
    const crashes = [];
    if (driven && control) {
      const c = driven.update(dt, control, colliders);
      if (c > 0) crashes.push(c);
    }
    for (const car of traffic) {
      const ctrl = car.trafficControl(dt, all, playerOnFoot);
      const c = car.update(dt, ctrl, colliders);
      if (c > 0 && car === driven) crashes.push(c);
    }
    const sep = separate();
    if (sep > 0) crashes.push(sep);
    return { crashes };
  }

  return {
    drivables,
    traffic,
    all,
    get driven() { return driven; },
    nearestDrivable,
    resolvePlayer,
    setDriven,
    reset,
    update,
  };
}

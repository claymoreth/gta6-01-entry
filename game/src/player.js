import * as THREE from 'three';
import { resolveCircle, clamp } from './collision.js';
import { WORLD_BOUNDS } from './world.js';
const WALK_SPEED = 4.2;
const SPRINT_SPEED = 7.6;
const RADIUS = .45;
const HEIGHT = 1.8;
export function createPlayer(scene, colliders) {
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
  const jacket = new THREE.MeshLambertMaterial({ color: 0x8c2f39 });
  const jacketDark = new THREE.MeshLambertMaterial({ color: 0x6e232c });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x2c3e63 });
  const shoe = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  const hair = new THREE.MeshLambertMaterial({ color: 0x14100c });
  function makeBox(w, h, d, m, x, y, z) {
    const q = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    q.position.set(x, y, z);
    return q;
  }
  const torso = new THREE.Mesh(new THREE.BoxGeometry(.52, .62, .3), jacket);
  torso.position.y = 1.12;
  torso.castShadow = true;
  group.add(torso);
  const hem = new THREE.Mesh(new THREE.BoxGeometry(.54, .1, .32), jacketDark);
  hem.position.y = .84;
  group.add(hem);
  const collar = new THREE.Mesh(new THREE.BoxGeometry(.4, .08, .34), jacketDark);
  collar.position.y = 1.44;
  group.add(collar);
  const head = new THREE.Mesh(new THREE.BoxGeometry(.3, .34, .3), skin);
  head.position.y = 1.64;
  head.castShadow = true;
  group.add(head);
  const hairTop = new THREE.Mesh(new THREE.BoxGeometry(.32, .1, .32), hair);
  hairTop.position.y = 1.84;
  group.add(hairTop);
  const hairBack = new THREE.Mesh(new THREE.BoxGeometry(.32, .24, .08), hair);
  hairBack.position.set(0, 1.72, -.13);
  group.add(hairBack);
  for (const s of [-1, 1]) {
    group.add(makeBox(.04, .05, .02, hair, s * .07, 1.68, .16));
    group.add(makeBox(.03, .08, .08, skin, s * .16, 1.64, 0));
  }
  group.add(makeBox(.05, .08, .05, skin, 0, 1.62, .17));
  group.add(makeBox(.12, .02, .02, hair, 0, 1.52, .16));
  function limb(mat, w, h, d, x, y) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.y = -h / 2;
    mesh.castShadow = true;
    pivot.add(mesh);
    group.add(pivot);
    return pivot;
  }
  const armL = limb(jacket, .15, .58, .17, -.34, 1.38);
  const armR = limb(jacket, .15, .58, .17, .34, 1.38);
  for (const arm of [armL, armR]) {
    const hand = new THREE.Mesh(new THREE.BoxGeometry(.13, .12, .15), skin);
    hand.position.y = -.62;
    arm.add(hand);
  }
  const gun = makeBox(0.07, 0.1, 0.28, shoe, 0, -0.62, 0.12);
  gun.visible = false;
  armR.add(gun);
  const legL = limb(jeans, .19, .78, .21, -.14, .82);
  const legR = limb(jeans, .19, .78, .21, .14, .82);
  for (const leg of [legL, legR]) {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(.19, .09, .32), shoe);
    foot.position.set(0, -.8, .05);
    leg.add(foot);
  }
  scene.add(group);
  const heroLight = new THREE.PointLight(0xffd9a0, 12, 8, 1.6);
  heroLight.position.set(0, 3.2, -1.6);
  group.add(heroLight);
  const state = {
    group,
    pos: new THREE.Vector3(0, 0, 14),
    vel: new THREE.Vector3(0, 0, 0),
    facing: Math.PI,
    moving: false,
    sprinting: false,
    speed: 0,
    grounded: true,
    walkPhase: 0,
  };
  state.setWeapon = (w) => { gun.visible = w === 1; };
  state.showFlash = () => { heroLight.intensity = 42; state.flashT = 0.06; };
  group.position.copy(state.pos);
  group.rotation.y = state.facing;
  state.update = function update(dt, moveVec, camYaw) {
    const target = moveVec.sprint ? SPRINT_SPEED : WALK_SPEED;
    const sin = Math.sin(camYaw);
    const cos = Math.cos(camYaw);
    const wishX = -sin * moveVec.y + cos * moveVec.x;
    const wishZ = -cos * moveVec.y - sin * moveVec.x;
    const wishLen = Math.hypot(wishX, wishZ);
    const moving = wishLen > .01;
    state.moving = moving;
    state.sprinting = moving && moveVec.sprint;
    const tx = moving ? (wishX / wishLen) * target : 0;
    const tz = moving ? (wishZ / wishLen) * target : 0;
    const a = 1 - Math.exp(-8 * dt);
    state.vel.x += (tx - state.vel.x) * a;
    state.vel.z += (tz - state.vel.z) * a;
    let nx = state.pos.x + state.vel.x * dt;
    let nz = state.pos.z + state.vel.z * dt;
    nx = clamp(nx, WORLD_BOUNDS.minX + 1, WORLD_BOUNDS.maxX - 1);
    nz = clamp(nz, WORLD_BOUNDS.minZ + 1, WORLD_BOUNDS.maxZ - 1);
    const solved = resolveCircle(nx, nz, RADIUS, 0, HEIGHT, colliders);
    state.pos.x = solved.x;
    state.pos.z = solved.z;
    state.pos.y = 0;
    state.grounded = true;
    state.speed = Math.hypot(state.vel.x, state.vel.z);
    if (moving) {
      const targetYaw = Math.atan2(state.vel.x, state.vel.z);
      let d = targetYaw - state.facing;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      state.facing += d * Math.min(1, 12 * dt);
    }
    group.position.copy(state.pos);
    group.rotation.y = state.facing;
    const swingSpeed = state.speed * (state.sprinting ? 1.9 : 1.5);
    state.walkPhase += swingSpeed * dt * 2.2;
    const amp = state.sprinting ? .85 : .6;
    const s = Math.sin(state.walkPhase);
    const movingFactor = Math.min(1, state.speed / 2);
    legL.rotation.x = s * amp * movingFactor;
    legR.rotation.x = -s * amp * movingFactor;
    armL.rotation.x = -s * amp * .8 * movingFactor;
    armR.rotation.x = s * amp * .8 * movingFactor;
    torso.rotation.x = state.sprinting ? .12 * movingFactor : .03 * movingFactor;
    group.position.y = state.pos.y + Math.abs(Math.cos(state.walkPhase)) * .05 * movingFactor;
    if (state.flashT > 0) { state.flashT -= dt; if (state.flashT <= 0) heroLight.intensity = 12; }
  };
  state.reset = function reset() {
    state.pos.set(0, 0, 14);
    state.vel.set(0, 0, 0);
    state.facing = Math.PI;
    state.walkPhase = 0;
    group.position.copy(state.pos);
    group.rotation.y = state.facing;
  };
  return state;
}

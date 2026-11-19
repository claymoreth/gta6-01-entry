import * as THREE from 'three';
import { resolveCircle, clamp } from './collision.js';
import { WORLD_BOUNDS } from './world.js';
const WALK_SPEED = 4.2;
const SPRINT_SPEED = 7.6;
const RADIUS = 0.45;
const HEIGHT = 1.8;
export function createPlayer(scene, colliders) {
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
  const jacket = new THREE.MeshLambertMaterial({ color: 0x8c2f39 });
  const jacketDark = new THREE.MeshLambertMaterial({ color: 0x6e232c });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x2c3e63 });
  const shoe = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  const hair = new THREE.MeshLambertMaterial({ color: 0x14100c });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.3), jacket);
  torso.position.y = 1.12;
  torso.castShadow = true;
  group.add(torso);
  const hem = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.1, 0.32), jacketDark);
  hem.position.y = 0.84;
  group.add(hem);
  const collar = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.34), jacketDark);
  collar.position.y = 1.44;
  group.add(collar);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.34, 0.3), skin);
  head.position.y = 1.64;
  head.castShadow = true;
  group.add(head);
  const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.32), hair);
  hairTop.position.y = 1.84;
  group.add(hairTop);
  const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.24, 0.08), hair);
  hairBack.position.set(0, 1.72, -0.13);
  group.add(hairBack);
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
  const armL = limb(jacket, 0.15, 0.58, 0.17, -0.34, 1.38);
  const armR = limb(jacket, 0.15, 0.58, 0.17, 0.34, 1.38);
  for (const arm of [armL, armR]) {
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.12, 0.15), skin);
    hand.position.y = -0.62;
    arm.add(hand);
  }
  const legL = limb(jeans, 0.19, 0.78, 0.21, -0.14, 0.82);
  const legR = limb(jeans, 0.19, 0.78, 0.21, 0.14, 0.82);
  for (const leg of [legL, legR]) {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.09, 0.32), shoe);
    foot.position.set(0, -0.8, 0.05);
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
  group.position.copy(state.pos);
  group.rotation.y = state.facing;
  state.update = function update(dt, moveVec, camYaw) {
    const target = moveVec.sprint ? SPRINT_SPEED : WALK_SPEED;
    const sin = Math.sin(camYaw);
    const cos = Math.cos(camYaw);
    const wishX = -sin * moveVec.y + cos * moveVec.x;
    const wishZ = -cos * moveVec.y - sin * moveVec.x;
    const wishLen = Math.hypot(wishX, wishZ);
    const moving = wishLen > 0.01;
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
    const amp = state.sprinting ? 0.85 : 0.6;
    const s = Math.sin(state.walkPhase);
    const movingFactor = Math.min(1, state.speed / 2);
    legL.rotation.x = s * amp * movingFactor;
    legR.rotation.x = -s * amp * movingFactor;
    armL.rotation.x = -s * amp * 0.8 * movingFactor;
    armR.rotation.x = s * amp * 0.8 * movingFactor;
    torso.rotation.x = state.sprinting ? 0.12 * movingFactor : 0.03 * movingFactor;
    group.position.y = state.pos.y + Math.abs(Math.cos(state.walkPhase)) * 0.05 * movingFactor;
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

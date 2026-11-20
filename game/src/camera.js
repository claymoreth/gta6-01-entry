import * as THREE from 'three';
import { segmentClearT, clamp } from './collision.js';
const DIST = 6.0;
const HEIGHT_OFFSET = 1.7;
const PITCH_MIN = -.12;
const PITCH_MAX = .55;
const SENS = .0032;
export function createCamera(camera, colliders) {
  const state = {
    yaw: 0,
    pitch: .22,
    distance: DIST,
    dist: DIST,
    height: HEIGHT_OFFSET,
    target: new THREE.Vector3(),
    desired: new THREE.Vector3(),
  };
  state.orbit = function orbit(dx, dy) {
    state.yaw -= dx * SENS;
    state.pitch = clamp(state.pitch + dy * SENS, PITCH_MIN, PITCH_MAX);
  };
  state.reset = function reset() {
    state.yaw = 0;
    state.pitch = .22;
    state.distance = DIST;
    state.dist = DIST;
    state.height = HEIGHT_OFFSET;
  };
  state.setDistance = function setDistance(d) {
    state.dist = d;
  };
  state.setHeight = function setHeight(h) {
    state.height = h;
  };
  state.update = function update(dt, playerPos) {
    state.target.lerp(
      new THREE.Vector3(playerPos.x, playerPos.y + state.height, playerPos.z),
      Math.min(1, 14 * dt),
    );
    const cp = Math.cos(state.pitch);
    const sp = Math.sin(state.pitch);
    const ox = Math.sin(state.yaw) * cp;
    const oz = Math.cos(state.yaw) * cp;
    const oy = sp;
    state.desired.set(
      state.target.x + ox * state.dist,
      state.target.y + oy * state.dist,
      state.target.z + oz * state.dist,
    );
    if (state.desired.y < .5) state.desired.y = .5;
    const t = segmentClearT(
      state.target.x, state.target.y, state.target.z,
      state.desired.x, state.desired.y, state.desired.z,
      colliders,
    );
    const useDist = state.dist * Math.max(.25, t);
    camera.position.set(
      state.target.x + ox * useDist,
      Math.max(.5, state.target.y + oy * useDist),
      state.target.z + oz * useDist,
    );
    camera.lookAt(state.target);
  };
  return state;
}

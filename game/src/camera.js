// CITY OF EMBERS — third-person camera (original, Phase 1).
// Orbits behind the player with the mouse, smooth-follows, clamps pitch,
// and shortens itself out of buildings via a segment test.

import * as THREE from 'three';
import { segmentClearT, clamp } from './collision.js';

const DIST = 6.0;
const HEIGHT_OFFSET = 1.7; // target = player head height
const PITCH_MIN = -0.12; // looking slightly up from below
const PITCH_MAX = 0.55; // looking down from above
const SENS = 0.0032;

export function createCamera(camera, colliders) {
  const state = {
    yaw: 0, // camera sits south of the player, looking north (-z) at spawn
    pitch: 0.22,
    distance: DIST,
    target: new THREE.Vector3(),
    desired: new THREE.Vector3(),
  };

  // Consume mouse deltas (pixels) into orbit angles.
  state.orbit = function orbit(dx, dy) {
    state.yaw -= dx * SENS;
    state.pitch = clamp(state.pitch + dy * SENS, PITCH_MIN, PITCH_MAX);
  };

  state.reset = function reset() {
    state.yaw = 0;
    state.pitch = 0.22;
    state.distance = DIST;
  };

  // Follow the player; dt-smoothed. Returns nothing; moves the camera.
  state.update = function update(dt, playerPos) {
    // Smooth target: lerp the look target toward the player's head.
    state.target.lerp(
      new THREE.Vector3(playerPos.x, playerPos.y + HEIGHT_OFFSET, playerPos.z),
      Math.min(1, 14 * dt),
    );
    const cp = Math.cos(state.pitch);
    const sp = Math.sin(state.pitch);
    const ox = Math.sin(state.yaw) * cp;
    const oz = Math.cos(state.yaw) * cp;
    const oy = sp;
    state.desired.set(
      state.target.x + ox * DIST,
      state.target.y + oy * DIST,
      state.target.z + oz * DIST,
    );
    // Keep the camera above the ground and out of buildings.
    if (state.desired.y < 0.5) state.desired.y = 0.5;
    const t = segmentClearT(
      state.target.x, state.target.y, state.target.z,
      state.desired.x, state.desired.y, state.desired.z,
      colliders,
    );
    const useDist = DIST * Math.max(0.25, t);
    camera.position.set(
      state.target.x + ox * useDist,
      Math.max(0.5, state.target.y + oy * useDist),
      state.target.z + oz * useDist,
    );
    camera.lookAt(state.target);
  };

  return state;
}

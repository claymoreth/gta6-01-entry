// CITY OF EMBERS — bootstrap + game loop (original, Phase 1).
// Third-person 3D night city block. States: menu -> playing <-> paused.
// Rendering: Three.js r187 (local vendor), WebGL, shadows, fog.

import * as THREE from 'three';
import { buildWorld } from './world.js';
import { createPlayer } from './player.js';
import { createCamera } from './camera.js';
import { createInput } from './input.js';
import { createHud } from './hud.js';

const canvas = document.getElementById('game');
// ?lowfx=1 disables antialias + shadows: a test-only switch so the
// Playwright acceptance runs stay fast under headless SwiftShader (a
// software rasterizer). The shipped game always runs with full effects.
const lowFx = new URLSearchParams(window.location.search).get('lowfx') === '1';
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowFx });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = !lowFx;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 500);

const world = buildWorld(scene, { lowFx });
const player = createPlayer(scene, world.colliders);
const thirdPerson = createCamera(camera, world.colliders);
const input = createInput(canvas);
const hud = createHud(world);

let state = 'menu'; // menu | playing | paused
let lastTime = performance.now();
let fps = 60;
let fpsAccum = 0;
let fpsFrames = 0;
let fpsTimer = 0;
let frames = 0; // total rendered frames (wall-clock rate probe)

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

function startGame() {
  player.reset();
  thirdPerson.reset();
  state = 'playing';
  hud.showGame();
  hud.showToast('Selamat datang di Ember Bay');
}

function pauseGame() {
  if (state !== 'playing') return;
  state = 'paused';
  hud.showPause();
  if (document.pointerLockElement) document.exitPointerLock();
}

function resumeGame() {
  if (state !== 'paused') return;
  state = 'playing';
  hud.hidePause();
}

function restartGame() {
  player.reset();
  thirdPerson.reset();
  state = 'playing';
  hud.showGame();
  hud.showToast('Malam baru di Ember Bay');
}

hud.el.startBtn.addEventListener('click', startGame);
hud.el.resumeBtn.addEventListener('click', resumeGame);
hud.el.restartBtn.addEventListener('click', restartGame);

// Support ?shot=start|play for the automated screenshot runs: the shot
// harness starts the game directly so screenshots show gameplay, not menu.
// (Checked here, AFTER showStart, so the auto-start is not overridden.)
const shotParam = new URLSearchParams(window.location.search).get('shot');

function frame(now) {
  requestAnimationFrame(frame);
  frames += 1;
  const rawDt = (now - lastTime) / 1000; // wall-clock dt (unclamped)
  const dt = Math.min(0.05, rawDt); // game dt, clamped so low FPS = slow-mo, not jumps
  lastTime = now;

  // FPS from REAL wall-clock dt, so the meter is honest even when the
  // renderer is slow (a clamped-dt meter would read ~20 at 1 real FPS).
  fpsAccum += 1 / Math.max(rawDt, 1e-4);
  fpsFrames += 1;
  fpsTimer += rawDt;
  if (fpsTimer >= 0.5) {
    fps = fpsAccum / Math.max(1, fpsFrames);
    fpsAccum = 0;
    fpsFrames = 0;
    fpsTimer = 0;
  }

  if (input.consumePause()) {
    if (state === 'playing') pauseGame();
    else if (state === 'paused') resumeGame();
  }

  if (state === 'playing') {
    const mouse = input.consumeMouse();
    if (mouse.dx !== 0 || mouse.dy !== 0) thirdPerson.orbit(mouse.dx, mouse.dy);
    const mv = input.moveVector();
    player.update(dt, mv, thirdPerson.yaw);
    thirdPerson.update(dt, player.pos);
    world.update(dt, now / 1000);
    hud.update(dt, fps, player);
  } else if (state === 'menu') {
    // Slow cinematic orbit behind the spawn while on the menu.
    thirdPerson.yaw += dt * 0.05;
    thirdPerson.update(dt, player.pos);
  }
  // paused: freeze the world, keep rendering the last frame.

  renderer.render(scene, camera);
}

// Debug hooks for the Playwright acceptance tests (read-only state).
window.__embers = {
  get state() { return state; },
  get playerPos() { return { x: player.pos.x, y: player.pos.y, z: player.pos.z }; },
  get playerSpeed() { return player.speed; },
  get fps() { return fps; },
  get frames() { return frames; },
  get drawCalls() { return renderer.info.render.calls; },
  get triangles() { return renderer.info.render.triangles; },
  get camYaw() { return thirdPerson.yaw; },
  start: startGame,
};

hud.showStart();
if (shotParam === 'play') startGame();
requestAnimationFrame(frame);

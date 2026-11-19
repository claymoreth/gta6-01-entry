import * as THREE from 'three';
import { buildWorld } from './world.js';
import { createPlayer } from './player.js';
import { createCamera } from './camera.js';
import { createInput } from './input.js';
import { createHud } from './hud.js';
import { createVehicles } from './vehicles.js';
import { createAudio } from './audio.js';
import { createNpcs } from './npcs.js';
const canvas = document.getElementById('game');
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
const vehicles = createVehicles(scene, world);
const audio = createAudio();
const MISSION_STOPS = [
  { name: 'Melati Park', x: -140, z: 37 },
  { name: 'Ember Lighthouse', x: 168, z: 0 },
  { name: 'Merdeka Plaza', x: 0, z: 0 },
];
const ARRIVE_RADIUS = 5;
let missionIndex = 0;
let missionDone = false;
let customWaypoint = null;
let waypoint = null;
let beacon = null;
function missionText() {
  if (missionDone) return { title: 'CITY OF EMBERS — City explored!', progress: '3/3 objectives' };
  const stop = MISSION_STOPS[missionIndex];
  return {
    title: `CITY OF EMBERS — Go to ${stop.name}`,
    progress: `${missionIndex}/3 objectives`,
  };
}
function refreshWaypoint() {
  if (customWaypoint) {
    waypoint = { ...customWaypoint, custom: true };
  } else if (!missionDone) {
    const stop = MISSION_STOPS[missionIndex];
    waypoint = { x: stop.x, z: stop.z, name: stop.name, custom: false };
  } else {
    waypoint = null;
  }
  updateBeacon();
  hud.setMission(missionText());
}
function setCustomWaypoint(x, z) {
  customWaypoint = { x, z, name: 'Destination (minimap)' };
  refreshWaypoint();
  hud.showToast('Destination marked on GPS');
}
const hud = createHud(world, { onMinimapClick: setCustomWaypoint });
const npcs = createNpcs(scene, world, vehicles, audio, hud);
function makeBeacon() {
  const g = new THREE.Group();
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 30, 10, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffd166, transparent: true, opacity: 0.25,
      side: THREE.DoubleSide, depthWrite: false,
    }),
  );
  pillar.position.y = 15;
  g.add(pillar);
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.9),
    new THREE.MeshBasicMaterial({ color: 0xffd166 }),
  );
  diamond.position.y = 4.2;
  diamond.name = 'beacon-diamond';
  g.add(diamond);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.6, 2.2, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd166, side: THREE.DoubleSide, transparent: true, opacity: 0.8 }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  g.add(ring);
  g.visible = false;
  scene.add(g);
  return g;
}
beacon = makeBeacon();
function updateBeacon() {
  if (!waypoint) {
    beacon.visible = false;
    return;
  }
  beacon.visible = true;
  beacon.position.set(waypoint.x, 0, waypoint.z);
}
function checkArrival() {
  if (!waypoint) return;
  const dx = waypoint.x - player.pos.x;
  const dz = waypoint.z - player.pos.z;
  const d = Math.hypot(dx, dz);
  if (d > ARRIVE_RADIUS) return;
  if (waypoint.custom) {
    customWaypoint = null;
    hud.showToast('Destination reached');
    refreshWaypoint();
    return;
  }
  missionIndex += 1;
  if (missionIndex >= MISSION_STOPS.length) {
    missionDone = true;
    hud.showToast('City explored! All objectives reached');
  } else {
    hud.showToast(`Destination reached — next: ${MISSION_STOPS[missionIndex].name}`);
  }
  refreshWaypoint();
}
function waypointInfo() {
  if (!waypoint) return { waypoint: null, distance: 0, bearing: 0, camYaw: thirdPerson.yaw };
  const dx = waypoint.x - player.pos.x;
  const dz = waypoint.z - player.pos.z;
  return {
    waypoint,
    distance: Math.hypot(dx, dz),
    bearing: Math.atan2(dx, dz),
    camYaw: thirdPerson.yaw,
  };
}
let driving = false;
let drivenCar = null;
let theftSeq = 0;
function enterVehicle(car) {
  driving = true;
  drivenCar = car;
  vehicles.setDriven(car);
  player.group.visible = false;
  thirdPerson.yaw = car.heading + Math.PI;
  thirdPerson.setDistance(10.5);
  thirdPerson.setHeight(2.8);
  hud.setInteract(null);
  hud.showToast(`${car.type.name} — W/S gas & brake · A/D steer · SPACE handbrake · E exit`);
}
function exitVehicle() {
  if (!drivenCar) return;
  const rx = Math.cos(drivenCar.heading);
  const rz = -Math.sin(drivenCar.heading);
  player.pos.set(
    drivenCar.pos.x + rx * 2.6,
    0,
    drivenCar.pos.z + rz * 2.6,
  );
  player.vel.set(0, 0, 0);
  player.facing = drivenCar.heading;
  player.group.visible = true;
  driving = false;
  drivenCar = null;
  vehicles.setDriven(null);
  thirdPerson.setDistance(6.0);
  thirdPerson.setHeight(1.7);
  hud.showToast('Exited vehicle');
}
function drivingControl() {
  const mv = input.moveVector();
  return {
    throttle: mv.y,
    steer: mv.x,
    handbrake: input.handbrake(),
    boost: mv.sprint,
  };
}
function driveHudInfo() {
  const list = vehicles.all.map((v) => ({
    x: v.pos.x, z: v.pos.z, drivable: v.drivable, driven: v === drivenCar,
    police: v.police,
  }));
  if (!driving || !drivenCar) return { driving: false, vehicles: list };
  return {
    driving: true,
    speedKmh: drivenCar.speed * 3.6,
    name: drivenCar.type.name,
    damage: drivenCar.damage,
    vehicles: list,
  };
}
let state = 'menu';
let lastTime = performance.now();
let fps = 60;
let fpsAccum = 0;
let fpsFrames = 0;
let fpsTimer = 0;
let frames = 0;
function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
function startGame() {
  player.reset();
  player.group.visible = true;
  thirdPerson.reset();
  vehicles.reset();
  npcs.reset();
  driving = false;
  drivenCar = null;
  audio.init();
  missionIndex = 0;
  missionDone = false;
  customWaypoint = null;
  refreshWaypoint();
  state = 'playing';
  hud.showGame();
  hud.showToast('Welcome to Ember Bay');
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
  player.group.visible = true;
  thirdPerson.reset();
  vehicles.reset();
  npcs.reset();
  driving = false;
  drivenCar = null;
  missionIndex = 0;
  missionDone = false;
  customWaypoint = null;
  refreshWaypoint();
  state = 'playing';
  hud.showGame();
  hud.showToast('A new night in Ember Bay');
}
hud.el.startBtn.addEventListener('click', startGame);
hud.el.resumeBtn.addEventListener('click', resumeGame);
hud.el.restartBtn.addEventListener('click', restartGame);
const shotParam = new URLSearchParams(window.location.search).get('shot');
function frame(now) {
  requestAnimationFrame(frame);
  frames += 1;
  const rawDt = (now - lastTime) / 1000;
  const dt = Math.min(0.05, rawDt);
  lastTime = now;
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
    if (input.consumeInteract()) {
      if (driving) {
        exitVehicle();
      } else {
        const near = vehicles.nearestEnterable(player.pos.x, player.pos.z, 4.5);
        if (near) {
          enterVehicle(near.vehicle);
          if (near.theft) {
            theftSeq += 1;
            npcs.reportCrime('theft', near.vehicle.pos.x, near.vehicle.pos.z, {
              eventId: `theft-${theftSeq}`,
            });
          }
        }
      }
    }
    if (driving && drivenCar) {
      const ctrl = drivingControl();
      const result = vehicles.update(dt, ctrl, null, npcs.pedPositions());
      for (const c of result.crashes) audio.crash(c);
      for (const td of result.trafficDamage || []) {
        const v = vehicles.all[td.index];
        if (v) {
          npcs.reportCrime(v.police ? 'policeDamage' : 'damage', v.pos.x, v.pos.z, {
            target: `car-${td.index}`,
          });
        }
      }
      audio.setEngine(Math.abs(drivenCar.speed) / drivenCar.type.topSpeed, true);
      audio.setSkid(ctrl.handbrake && Math.abs(drivenCar.speed) > 4);
      player.pos.copy(drivenCar.pos);
      player.facing = drivenCar.heading;
      player.speed = drivenCar.speed;
      let dyaw = (drivenCar.heading + Math.PI) - thirdPerson.yaw;
      while (dyaw > Math.PI) dyaw -= Math.PI * 2;
      while (dyaw < -Math.PI) dyaw += Math.PI * 2;
      thirdPerson.yaw += dyaw * Math.min(1, 1.5 * dt);
      hud.setInteract(null);
    } else {
      const mv = input.moveVector();
      player.update(dt, mv, thirdPerson.yaw);
      const result = vehicles.update(dt, null, { x: player.pos.x, z: player.pos.z }, npcs.pedPositions());
      for (const c of result.crashes) audio.crash(c);
      audio.setEngine(0, false);
      audio.setSkid(false);
      vehicles.resolvePlayer(player);
      const near = vehicles.nearestEnterable(player.pos.x, player.pos.z, 4.5);
      if (near) {
        hud.setInteract(near.theft
          ? `Press E to steal — ${near.vehicle.type.name}`
          : `Press E to enter — ${near.vehicle.type.name}`);
      } else {
        hud.setInteract(null);
      }
    }
    const playerVel = driving && drivenCar
      ? { x: Math.sin(drivenCar.heading) * drivenCar.speed, z: Math.cos(drivenCar.heading) * drivenCar.speed }
      : { x: player.vel.x, z: player.vel.z };
    npcs.update(dt, {
      playerPos: player.pos,
      playerVel,
      playerOnFoot: driving ? null : { x: player.pos.x, z: player.pos.z },
      driving,
      drivenCar: driving ? drivenCar : null,
      vehicles: vehicles.all,
    });
    thirdPerson.update(dt, player.pos);
    world.update(dt, now / 1000);
    if (beacon.visible) {
      const diamond = beacon.getObjectByName('beacon-diamond');
      if (diamond) {
        diamond.rotation.y += dt * 1.5;
        diamond.position.y = 4.2 + Math.sin(now / 450) * 0.35;
      }
    }
    checkArrival();
    hud.update(dt, fps, player, waypointInfo(), driveHudInfo(), npcs.wantedInfo(), npcs.minimapInfo());
  } else if (state === 'menu') {
    thirdPerson.yaw += dt * 0.05;
    thirdPerson.update(dt, player.pos);
  }
  renderer.render(scene, camera);
}
window.__embers = {
  get state() { return state; },
  get playerPos() { return { x: player.pos.x, y: player.pos.y, z: player.pos.z }; },
  get playerSpeed() { return player.speed; },
  get fps() { return fps; },
  get frames() { return frames; },
  get drawCalls() { return renderer.info.render.calls; },
  get triangles() { return renderer.info.render.triangles; },
  get camYaw() { return thirdPerson.yaw; },
  get district() {
    const d = world.districtAt(player.pos.x, player.pos.z);
    return { district: d.district, street: d.street };
  },
  get waypoint() { return waypoint ? { ...waypoint } : null; },
  get waypointDistance() { return waypointInfo().distance; },
  get mission() {
    return { index: missionIndex, done: missionDone, text: missionText() };
  },
  get driving() { return driving; },
  get drivenCar() {
    if (!drivenCar) return null;
    return {
      name: drivenCar.type.name, type: drivenCar.typeName,
      x: drivenCar.pos.x, z: drivenCar.pos.z,
      heading: drivenCar.heading, speed: drivenCar.speed,
      damage: drivenCar.damage,
    };
  },
  get speedKmh() { return drivenCar ? Math.abs(drivenCar.speed) * 3.6 : 0; },
  get vehicles() {
    return vehicles.all.map((v) => ({
      name: v.type.name, type: v.typeName, drivable: v.drivable, traffic: v.traffic, police: v.police,
      x: v.pos.x, z: v.pos.z, heading: v.heading, speed: v.speed, damage: v.damage,
    }));
  },
  enterCar(typeName) {
    const car = vehicles.drivables.find((v) => v.typeName === typeName);
    if (!car) return false;
    const rx = Math.cos(car.heading);
    const rz = -Math.sin(car.heading);
    player.pos.set(car.pos.x + rx * 2.6, 0, car.pos.z + rz * 2.6);
    player.vel.set(0, 0, 0);
    enterVehicle(car);
    return true;
  },
  placeCar(typeName, x, z, heading, damage) {
    const car = vehicles.drivables.find((v) => v.typeName === typeName);
    if (!car) return false;
    car.pos.set(x, 0, z);
    car.heading = heading;
    car.speed = 0;
    car.steer = 0;
    car.damage = damage ?? 0;
    car.group.position.copy(car.pos);
    car.group.rotation.y = heading;
    return true;
  },
  exitCar() { if (driving) exitVehicle(); return !driving; },
  get npcs() { return npcs.debug; },
  debugCrime(type, eventId) { return npcs.debug.debugCrime(type, eventId); },
  debugSetHeat(n) { return npcs.debug.debugSetHeat(n); },
  debugPlacePed(i, x, z) { return npcs.debug.debugPlacePed(i, x, z); },
  debugPlacePolice(i, x, z) { return npcs.debug.debugPlacePolice(i, x, z); },
  debugHoldTraffic(i, seconds) { return npcs.debug.debugHoldTraffic(i, seconds); },
  debugLOS(x0, z0, x1, z1) { return npcs.debug.debugLOS(x0, z0, x1, z1); },
  debugInBuilding(x, z) { return npcs.debug.debugInBuilding(x, z); },
  debugResetNpcs() { return npcs.debug.debugReset(); },
  debugTriggerDanger(x, z, radius) { return npcs.debug.debugTriggerDanger(x, z, radius); },
  get pois() { return world.pois.map((p) => ({ ...p })); },
  get bounds() { return { ...world.bounds }; },
  minimapPixel(x, z) { const [px, py] = hud.worldToMap(x, z); return { x: px, y: py }; },
  start: startGame,
  teleport(x, z) {
    player.pos.set(x, 0, z);
    player.vel.set(0, 0, 0);
  },
  setCamYaw(yaw) { thirdPerson.yaw = yaw; return thirdPerson.yaw; },
  setFacing(yaw) { player.facing = yaw; return player.facing; },
  setWaypoint(x, z, name) {
    setCustomWaypoint(x, z);
    if (name && waypoint) waypoint.name = name;
  },
};
hud.showStart();
refreshWaypoint();
if (shotParam === 'play') startGame();
if (shotParam === 'drive') {
  startGame();
  window.__embers.enterCar('sedan');
  if (drivenCar) {
    drivenCar.pos.set(30, 0, 2.5);
    drivenCar.heading = Math.PI / 2;
    drivenCar.speed = 9;
    thirdPerson.yaw = drivenCar.heading + Math.PI;
  }
}
if (shotParam === 'district') {
  startGame();
  player.pos.set(132, 0, 0);
  player.facing = Math.PI / 2;
  thirdPerson.yaw = -Math.PI / 2;
  setCustomWaypoint(168, 0);
  if (waypoint) waypoint.name = 'Ember Lighthouse';
}
if (shotParam === 'pursuit') {
  startGame();
  player.pos.set(20, 0, 0);
  player.facing = Math.PI / 2;
  thirdPerson.yaw = -Math.PI / 2;
  const pc = vehicles.police[0];
  pc.pos.set(2, 0, 2.5);
  pc.heading = Math.PI / 2;
  pc.speed = 0;
  pc.group.position.copy(pc.pos);
  pc.group.rotation.y = pc.heading;
  window.__embers.debugSetHeat(45);
}
requestAnimationFrame(frame);

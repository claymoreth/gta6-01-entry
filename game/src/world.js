// CITY OF EMBERS — world builder (original, Phase 2).
// Three connected districts in one fictional tropical coastal metropolis:
// DOWNTOWN (centre, tall towers), RESIDENTIAL (west, houses + park),
// WATERFRONT (east, warehouses + containers + pier + sea).
// One east-west spine road links all three; north-south roads cross it.
// All geometry is generated here; no external assets, no network requests.

import * as THREE from 'three';
import { makeCollider } from './collision.js';

// Playable bounds: x in [-170, 170], z in [-70, 70].
export const WORLD_BOUNDS = { minX: -170, maxX: 170, minZ: -70, maxZ: 70 };

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Procedural facade: dark concrete with a grid of windows, some lit warm.
// The same canvas drives both the colour map and the emissive map, so lit
// windows glow at night while dark ones stay dark.
function facadeTexture(rand, litRatio, cols, rows) {
  const w = 128;
  const h = 256;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d');
  g.fillStyle = '#181d2e';
  g.fillRect(0, 0, w, h);
  // faint vertical panel seams
  g.fillStyle = 'rgba(255,255,255,0.04)';
  for (let x = 0; x < w; x += 16) g.fillRect(x, 0, 1, h);
  const cw = w / cols;
  const ch = h / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = rand() < litRatio;
      const x = c * cw + cw * 0.22;
      const y = r * ch + ch * 0.22;
      const ww = cw * 0.56;
      const hh = ch * 0.56;
      if (lit) {
        const warm = rand();
        g.fillStyle = warm < 0.6 ? '#ffd166' : warm < 0.85 ? '#ff9f43' : '#cfe8ff';
        g.fillRect(x, y, ww, hh);
      } else {
        g.fillStyle = '#0a0d18';
        g.fillRect(x, y, ww, hh);
      }
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Warm residential facade: softer wall, more windows lit, warmer palette.
function houseTexture(rand, litRatio) {
  const w = 128;
  const h = 128;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d');
  g.fillStyle = '#2e2620';
  g.fillRect(0, 0, w, h);
  const cols = 4;
  const rows = 2;
  const cw = w / cols;
  const ch = h / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = rand() < litRatio;
      const x = c * cw + cw * 0.25;
      const y = r * ch + ch * 0.25;
      if (lit) {
        g.fillStyle = rand() < 0.75 ? '#ffc978' : '#ffe9b8';
        g.fillRect(x, y, cw * 0.5, ch * 0.5);
      } else {
        g.fillStyle = '#120e0a';
        g.fillRect(x, y, cw * 0.5, ch * 0.5);
      }
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Corrugated warehouse wall: vertical rust-orange ribs.
function warehouseTexture(rand, base, rib) {
  const w = 128;
  const h = 128;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 8) {
    g.fillStyle = rib;
    g.fillRect(x, 0, 3, h);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(x + 5, 0, 2, h);
  }
  // a few small lit windows near the top
  for (let i = 0; i < 6; i++) {
    if (rand() < 0.7) {
      g.fillStyle = '#ffb347';
      g.fillRect(8 + i * 20, 14, 10, 8);
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Wooden planks for the pier.
function plankTexture() {
  const w = 128;
  const h = 128;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d');
  g.fillStyle = '#5a3d24';
  g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 16) {
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(0, y, w, 2);
    g.fillStyle = 'rgba(255,255,255,0.05)';
    g.fillRect(0, y + 2, w, 2);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 1);
  return tex;
}

// Dark sea with faint wave streaks.
function seaTexture() {
  const w = 256;
  const h = 256;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d');
  g.fillStyle = '#0a2036';
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const len = 12 + Math.random() * 30;
    g.strokeStyle = `rgba(120,180,230,${0.05 + Math.random() * 0.12})`;
    g.lineWidth = 1 + Math.random() * 1.5;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + len, y);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
}

function buildPalm(rand) {
  const palm = new THREE.Group();
  const height = 5 + rand() * 2.5;
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.22, height, 7), trunkMat);
  trunk.position.y = height / 2;
  trunk.rotation.z = (rand() - 0.5) * 0.12;
  trunk.castShadow = true;
  palm.add(trunk);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x1e6b34, side: THREE.DoubleSide });
  const crownY = height;
  const fronds = 7 + Math.floor(rand() * 3);
  for (let i = 0; i < fronds; i++) {
    const angle = (i / fronds) * Math.PI * 2 + rand() * 0.4;
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.04, 2.4), leafMat);
    leaf.position.set(Math.cos(angle) * 0.9, crownY - 0.15, Math.sin(angle) * 0.9);
    leaf.rotation.y = -angle + Math.PI / 2;
    leaf.rotation.x = 0.55 + rand() * 0.25; // droop
    leaf.translateZ(0.4);
    leaf.castShadow = true;
    palm.add(leaf);
  }
  const nutMat = new THREE.MeshLambertMaterial({ color: 0x7a5a2e });
  for (let i = 0; i < 3; i++) {
    const nut = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 5), nutMat);
    nut.position.set((rand() - 0.5) * 0.5, crownY - 0.35, (rand() - 0.5) * 0.5);
    palm.add(nut);
  }
  return palm;
}

// Round-canopy tree for the residential park and streets.
function buildTree(rand) {
  const tree = new THREE.Group();
  const height = 2.2 + rand() * 1.2;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.2, height, 7),
    new THREE.MeshLambertMaterial({ color: 0x4a3220 }),
  );
  trunk.position.y = height / 2;
  trunk.castShadow = true;
  tree.add(trunk);
  const canopyMat = new THREE.MeshLambertMaterial({ color: 0x2a7a3e });
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(1.4 + rand() * 0.6, 8, 6), canopyMat);
  canopy.position.y = height + 0.9;
  canopy.scale.y = 0.85;
  canopy.castShadow = true;
  tree.add(canopy);
  return tree;
}

export function buildWorld(scene, opts) {
  const lowFx = !!(opts && opts.lowFx);
  const rand = mulberry32(20261119);
  const colliders = [];
  const lamps = []; // real point lights, updated subtly for flicker life
  const pois = []; // points of interest for the minimap + GPS missions

  // ---- sky, fog, lights ----
  scene.background = new THREE.Color(0x0a0a1e);
  scene.fog = new THREE.FogExp2(0x0d0d26, 0.0075);

  const hemi = new THREE.HemisphereLight(0x4a4a8a, 0x0c0a14, 0.55);
  scene.add(hemi);
  const ambient = new THREE.AmbientLight(0x2a2a55, 0.5);
  scene.add(ambient);
  const moon = new THREE.DirectionalLight(0x9db4ff, 0.7);
  moon.position.set(-40, 60, -25);
  moon.castShadow = !lowFx;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.camera.left = -180;
  moon.shadow.camera.right = 180;
  moon.shadow.camera.top = 90;
  moon.shadow.camera.bottom = -90;
  moon.shadow.camera.far = 220;
  moon.shadow.bias = -0.0005;
  scene.add(moon);

  // Stars + moon disc
  {
    const starGeo = new THREE.BufferGeometry();
    const N = 500;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const a = rand() * Math.PI * 2;
      const e = 0.12 + rand() * 1.35;
      const r = 280;
      pos[i * 3] = Math.cos(a) * Math.cos(e) * r;
      pos[i * 3 + 1] = Math.sin(e) * r;
      pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xcdd8ff, size: 1.4, sizeAttenuation: false, fog: false }));
    scene.add(stars);
    const moonDisc = new THREE.Mesh(
      new THREE.CircleGeometry(9, 32),
      new THREE.MeshBasicMaterial({ color: 0xe8eeff, fog: false }),
    );
    moonDisc.position.set(-140, 150, -220);
    moonDisc.lookAt(0, 0, 0);
    scene.add(moonDisc);
  }

  // ---- ground, roads, sidewalks ----
  // Ground covers the whole city strip plus the sea bed under the water.
  const asphalt = new THREE.MeshLambertMaterial({ color: 0x17171f });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 180), asphalt);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const roadMat = new THREE.MeshLambertMaterial({ color: 0x232330 });
  const roadWideMat = new THREE.MeshLambertMaterial({ color: 0x262633 });
  // East-west spine: Jalan Merdeka, x -170..170, width 10.
  const roadEW = new THREE.Mesh(new THREE.PlaneGeometry(344, 10), roadMat);
  roadEW.rotation.x = -Math.PI / 2;
  roadEW.position.y = 0.02;
  roadEW.receiveShadow = true;
  scene.add(roadEW);
  // North-south downtown: Jalan Pantai, x=0, z -70..70.
  const roadNS0 = new THREE.Mesh(new THREE.PlaneGeometry(10, 144), roadMat);
  roadNS0.rotation.x = -Math.PI / 2;
  roadNS0.position.y = 0.02;
  roadNS0.receiveShadow = true;
  scene.add(roadNS0);
  // North-south residential: Jalan Melati, x=-115, z -60..60, width 8.
  const roadNSW = new THREE.Mesh(new THREE.PlaneGeometry(8, 124), roadMat);
  roadNSW.rotation.x = -Math.PI / 2;
  roadNSW.position.set(-115, 0.02, 0);
  roadNSW.receiveShadow = true;
  scene.add(roadNSW);
  // North-south waterfront: Jalan Dermaga, x=115, z -60..60, width 12 (trucks).
  const roadNSE = new THREE.Mesh(new THREE.PlaneGeometry(12, 124), roadWideMat);
  roadNSE.rotation.x = -Math.PI / 2;
  roadNSE.position.set(115, 0.02, 0);
  roadNSE.receiveShadow = true;
  scene.add(roadNSE);

  // Sidewalks: raised strips along every road.
  const walkMat = new THREE.MeshLambertMaterial({ color: 0x3b3b4c });
  function sidewalk(w, d, x, z) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(w, 0.18, d), walkMat);
    s.position.set(x, 0.09, z);
    s.receiveShadow = true;
    scene.add(s);
  }
  // EW spine sidewalks (both sides, full length).
  sidewalk(344, 3, 0, -6.5);
  sidewalk(344, 3, 0, 6.5);
  // Downtown NS sidewalks.
  sidewalk(3, 144, -6.5, 0);
  sidewalk(3, 144, 6.5, 0);
  // Residential NS sidewalks.
  sidewalk(3, 124, -120.5, 0);
  sidewalk(3, 124, -109.5, 0);
  // Waterfront NS sidewalks (wider road, sidewalks further out).
  sidewalk(3, 124, 107.5, 0);
  sidewalk(3, 124, 122.5, 0);

  // Lane dashes (centre lines) + crosswalk stripes at the 3 intersections.
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8c95a });
  const stripeMat = new THREE.MeshBasicMaterial({ color: 0xdfe3ee });
  for (let x = -168; x <= 168; x += 6) {
    if (Math.abs(x) < 9 || Math.abs(x + 115) < 8 || Math.abs(x - 115) < 9) continue;
    const d1 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.02, 0.18), dashMat);
    d1.position.set(x, 0.05, 0);
    scene.add(d1);
  }
  for (let z = -66; z <= 66; z += 6) {
    if (Math.abs(z) < 9) continue;
    const d2 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 2.4), dashMat);
    d2.position.set(0, 0.05, z);
    scene.add(d2);
    const d3 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 2.4), dashMat);
    d3.position.set(-115, 0.05, z);
    scene.add(d3);
    const d4 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 2.4), dashMat);
    d4.position.set(115, 0.05, z);
    scene.add(d4);
  }
  function crosswalk(cx, cz) {
    for (let i = -4; i <= 4; i++) {
      const s1 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.02, 9), stripeMat);
      s1.position.set(cx + i * 1.2, 0.05, cz + 9.2);
      scene.add(s1);
      const s2 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.02, 9), stripeMat);
      s2.position.set(cx + i * 1.2, 0.05, cz - 9.2);
      scene.add(s2);
      const s3 = new THREE.Mesh(new THREE.BoxGeometry(9, 0.02, 0.7), stripeMat);
      s3.position.set(cx + 9.2, 0.05, cz + i * 1.2);
      scene.add(s3);
      const s4 = new THREE.Mesh(new THREE.BoxGeometry(9, 0.02, 0.7), stripeMat);
      s4.position.set(cx - 9.2, 0.05, cz + i * 1.2);
      scene.add(s4);
    }
  }
  crosswalk(0, 0);
  crosswalk(-115, 0);
  crosswalk(115, 0);

  // ---- DOWNTOWN towers (Phase 1 block, unchanged) ----
  // x, z, width, depth, height — 16 towers in four quadrants.
  const specs = [
    [18, -20, 14, 12, 26], [38, -18, 12, 14, 38], [20, -42, 16, 12, 14], [42, -44, 14, 14, 22],
    [-20, -22, 12, 16, 32], [-40, -20, 14, 12, 18], [-22, -44, 14, 12, 46], [-44, -44, 12, 14, 26],
    [20, 20, 16, 14, 16], [42, 22, 12, 12, 30], [18, 44, 14, 12, 12], [44, 46, 16, 14, 20],
    [-20, 20, 12, 14, 24], [-42, 22, 14, 12, 14], [-22, 44, 16, 12, 34], [-44, 46, 12, 12, 18],
  ];
  const facades = [
    facadeTexture(mulberry32(11), 0.55, 8, 18),
    facadeTexture(mulberry32(22), 0.4, 7, 14),
    facadeTexture(mulberry32(33), 0.65, 9, 20),
    facadeTexture(mulberry32(44), 0.3, 6, 12),
  ];
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x12121e });
  const acMat = new THREE.MeshLambertMaterial({ color: 0x2a2a3a });
  for (const [x, z, w, d, h] of specs) {
    const tex = facades[Math.floor(rand() * facades.length)];
    const mat = new THREE.MeshLambertMaterial({
      map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.85,
    });
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    b.position.set(x, h / 2, z);
    b.castShadow = true;
    b.receiveShadow = true;
    scene.add(b);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.5, d + 0.4), roofMat);
    roof.position.set(x, h + 0.25, z);
    scene.add(roof);
    const nAc = 1 + Math.floor(rand() * 2);
    for (let i = 0; i < nAc; i++) {
      const ac = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 1.2), acMat);
      ac.position.set(x + (rand() - 0.5) * (w - 3), h + 0.9, z + (rand() - 0.5) * (d - 3));
      scene.add(ac);
    }
    if (h >= 30) {
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.2, 0.3, d + 0.2),
        new THREE.MeshBasicMaterial({ color: 0xff5d8f }),
      );
      strip.position.set(x, h - 0.4, z);
      scene.add(strip);
    }
    colliders.push(makeCollider(x - w / 2, z - d / 2, x + w / 2, z + d / 2, 0, h, 'building'));
  }
  pois.push({ name: 'Plaza Merdeka', x: 0, z: 0, kind: 'landmark', color: '#ffd166' });
  pois.push({ name: 'Menara Ember', x: -22, z: -44, kind: 'landmark', color: '#ffd166' });

  // ---- downtown alleys: 2 narrow gaps with dumpsters + a dim light ----
  const dumpMat = new THREE.MeshLambertMaterial({ color: 0x1e4d2a });
  function dumpster(x, z, ry) {
    const d = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.3, 1.1), dumpMat);
    d.position.set(x, 0.65, z);
    d.rotation.y = ry;
    d.castShadow = true;
    scene.add(d);
    colliders.push(makeCollider(x - 1.1, z - 0.6, x + 1.1, z + 0.6, 0, 1.3, 'dumpster'));
  }
  dumpster(30, -26, 0.3);
  dumpster(-30, 30, -0.2);
  pois.push({ name: 'Gang Sempit', x: 30, z: -26, kind: 'alley', color: '#8a8fa8' });

  // ---- palms along the downtown sidewalks (Phase 1, unchanged) ----
  const palmSpots = [];
  for (let x = -52; x <= 52; x += 13) {
    if (Math.abs(x) < 10) continue;
    palmSpots.push([x, -9.6], [x, 9.6]);
  }
  for (let z = -52; z <= 52; z += 13) {
    if (Math.abs(z) < 10) continue;
    palmSpots.push([-9.6, z], [9.6, z]);
  }
  for (const [x, z] of palmSpots) {
    const palm = buildPalm(rand);
    palm.position.set(x + (rand() - 0.5), 0, z + (rand() - 0.5));
    palm.rotation.y = rand() * Math.PI * 2;
    scene.add(palm);
    colliders.push(makeCollider(x - 0.35, z - 0.35, x + 0.35, z + 0.35, 0, 6, 'palm'));
  }

  // ---- streetlights (downtown: 6 real lights at the intersection) ----
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x22222e });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const lightSpots = [[-9, -9], [9, -9], [-9, 9], [9, 9], [-9, 0], [9, 0]];
  const lampSpots = [];
  for (let x = -50; x <= 50; x += 12.5) {
    if (Math.abs(x) < 10) continue;
    lampSpots.push([x, -8.2], [x, 8.2]);
  }
  for (let z = -50; z <= 50; z += 12.5) {
    if (Math.abs(z) < 10) continue;
    lampSpots.push([-8.2, z], [8.2, z]);
  }
  function lampPost(x, z, real) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 6.4, 8), poleMat);
    pole.position.y = 3.2;
    pole.castShadow = true;
    g.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.1), poleMat);
    arm.position.set(0.7, 6.3, 0);
    g.add(arm);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.14, 0.3), lampMat);
    head.position.set(1.4, 6.22, 0);
    g.add(head);
    g.position.set(x, 0, z);
    g.rotation.y = Math.atan2(-x, -z);
    scene.add(g);
    if (real) {
      const p = new THREE.PointLight(0xffc978, 60, 26, 1.8);
      p.position.set(x + Math.sin(g.rotation.y) * 1.4, 6.1, z + Math.cos(g.rotation.y) * 1.4);
      scene.add(p);
      lamps.push(p);
    }
    colliders.push(makeCollider(x - 0.2, z - 0.2, x + 0.2, z + 0.2, 0, 6.4, 'lamp'));
  }
  for (const [x, z] of lightSpots) lampPost(x, z, true);
  for (const [x, z] of lampSpots) lampPost(x, z, false);

  // ================= RESIDENTIAL (west, x -170..-60) =================
  // Low houses with warm windows + pyramid roofs, a park, round trees,
  // a community hall, and one marked safehouse. Quieter, warmer light.
  const houseTex = houseTexture(mulberry32(77), 0.7);
  const houseTex2 = houseTexture(mulberry32(78), 0.55);
  const roofRed = new THREE.MeshLambertMaterial({ color: 0x7a2e22 });
  const roofBrown = new THREE.MeshLambertMaterial({ color: 0x4a3220 });
  function house(x, z, w, d, h, tex, roof) {
    const mat = new THREE.MeshLambertMaterial({
      map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.7,
    });
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    b.position.set(x, h / 2, z);
    b.castShadow = true;
    b.receiveShadow = true;
    scene.add(b);
    // pyramid roof (4-sided cone)
    const r = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.72, 2.2, 4), roof);
    r.position.set(x, h + 1.1, z);
    r.rotation.y = Math.PI / 4;
    r.castShadow = true;
    scene.add(r);
    colliders.push(makeCollider(x - w / 2, z - d / 2, x + w / 2, z + d / 2, 0, h + 2.2, 'house'));
  }
  // House grid (columns x, rows z). Park occupies x -152..-128, z 22..52.
  const houseCols = [-155, -138, -95, -78];
  const houseRows = [-50, -30, -10, 12, 32, 52];
  for (const hx of houseCols) {
    for (const hz of houseRows) {
      if (hx >= -152 && hx <= -128 && hz >= 22 && hz <= 52) continue; // park
      const w = 7 + rand() * 2;
      const d = 7 + rand() * 2;
      const h = 6 + rand() * 3;
      house(hx, hz, w, d, h, rand() < 0.5 ? houseTex : houseTex2, rand() < 0.5 ? roofRed : roofBrown);
    }
  }
  // Two mid-rise apartment blocks at the south edge (transition to downtown).
  function apartment(x, z, w, d, h) {
    const tex = facades[Math.floor(rand() * facades.length)];
    const mat = new THREE.MeshLambertMaterial({
      map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.6,
    });
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    b.position.set(x, h / 2, z);
    b.castShadow = true;
    b.receiveShadow = true;
    scene.add(b);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.5, d + 0.4), roofMat);
    roof.position.set(x, h + 0.25, z);
    scene.add(roof);
    colliders.push(makeCollider(x - w / 2, z - d / 2, x + w / 2, z + d / 2, 0, h, 'building'));
  }
  apartment(-150, 60, 14, 10, 15);
  apartment(-85, 60, 12, 10, 12);

  // Taman Melati park: lawn, round trees, benches, a small fountain.
  {
    const lawn = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 30),
      new THREE.MeshLambertMaterial({ color: 0x1d4d28 }),
    );
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.set(-140, 0.03, 37);
    lawn.receiveShadow = true;
    scene.add(lawn);
    const benchMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
    for (const [bx, bz, ry] of [[-150, 26, 0], [-130, 48, Math.PI], [-146, 44, Math.PI / 2]]) {
      const bench = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 0.7), benchMat);
      bench.position.set(bx, 0.25, bz);
      bench.rotation.y = ry;
      bench.castShadow = true;
      scene.add(bench);
      colliders.push(makeCollider(bx - 1.1, bz - 0.4, bx + 1.1, bz + 0.4, 0, 0.6, 'bench'));
    }
    // fountain: stone basin + glowing water disc
    const basin = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.4, 0.7, 12),
      new THREE.MeshLambertMaterial({ color: 0x5a5a6a }),
    );
    basin.position.set(-140, 0.35, 37);
    basin.castShadow = true;
    scene.add(basin);
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(2.0, 16),
      new THREE.MeshBasicMaterial({ color: 0x4aa8ff }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(-140, 0.72, 37);
    scene.add(water);
    colliders.push(makeCollider(-142.4, 34.6, -137.6, 39.4, 0, 0.8, 'fountain'));
    // round trees in and around the park
    const parkTrees = [[-148, 24], [-132, 26], [-150, 48], [-132, 50], [-146, 36], [-134, 42], [-162, -42], [-100, -52], [-100, 52], [-168, 20]];
    for (const [tx, tz] of parkTrees) {
      const tree = buildTree(rand);
      tree.position.set(tx, 0, tz);
      tree.rotation.y = rand() * Math.PI * 2;
      scene.add(tree);
      colliders.push(makeCollider(tx - 0.3, tz - 0.3, tx + 0.3, tz + 0.3, 0, 4, 'tree'));
    }
    pois.push({ name: 'Taman Melati', x: -140, z: 37, kind: 'park', color: '#7ef0a8' });
  }

  // Balai Warga (community hall) — wider, pale walls, warm porch light.
  {
    const hallMat = new THREE.MeshLambertMaterial({ color: 0x8a7a5a });
    const hall = new THREE.Mesh(new THREE.BoxGeometry(16, 7, 10), hallMat);
    hall.position.set(-115, 3.5, -56);
    hall.castShadow = true;
    hall.receiveShadow = true;
    scene.add(hall);
    const porch = new THREE.Mesh(
      new THREE.BoxGeometry(6, 0.4, 3),
      new THREE.MeshLambertMaterial({ color: 0x3b3b4c }),
    );
    porch.position.set(-115, 0.2, -50);
    scene.add(porch);
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(8, 1.2, 0.3),
      new THREE.MeshBasicMaterial({ color: 0xffd166 }),
    );
    sign.position.set(-115, 6.4, -50.8);
    scene.add(sign);
    colliders.push(makeCollider(-123, -61, -107, -51, 0, 7, 'building'));
    pois.push({ name: 'Balai Warga', x: -115, z: -56, kind: 'landmark', color: '#ffd166' });
  }

  // Safehouse 1: the house at (-155, -10) gets a green door light.
  {
    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.9, 0.15),
      new THREE.MeshBasicMaterial({ color: 0x37d67a }),
    );
    glow.position.set(-155, 1.4, -5.8);
    scene.add(glow);
    const p = new THREE.PointLight(0x37d67a, 18, 12, 1.8);
    p.position.set(-155, 2.2, -5.2);
    scene.add(p);
    lamps.push(p);
    pois.push({ name: 'Safehouse — Rumah Hijau', x: -155, z: -10, kind: 'safehouse', color: '#37d67a' });
  }

  // Residential streetlights: 2 real lights (park + Melati intersection).
  for (const [x, z] of [[-140, 30], [-115, 9]]) lampPost(x, z, true);
  // Emissive-only lamp posts along Jalan Melati.
  for (let z = -50; z <= 50; z += 12.5) {
    if (Math.abs(z) < 10) continue;
    lampPost(-120.5, z, false);
    lampPost(-109.5, z, false);
  }

  // ================= WATERFRONT (east, x 60..170) =================
  // Warehouses, container yard, gantry cranes, wooden pier, lighthouse,
  // and the sea. Orange/red industrial lighting, wide truck roads.
  const whTex1 = warehouseTexture(mulberry32(91), '#4a3226', '#6b4a30');
  const whTex2 = warehouseTexture(mulberry32(92), '#33302e', '#4a4642');
  function warehouse(x, z, w, d, h, tex) {
    const mat = new THREE.MeshLambertMaterial({
      map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.55,
    });
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    b.position.set(x, h / 2, z);
    b.castShadow = true;
    b.receiveShadow = true;
    scene.add(b);
    // orange roofline strip
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.2, 0.35, d + 0.2),
      new THREE.MeshBasicMaterial({ color: 0xff7a2f }),
    );
    strip.position.set(x, h - 0.3, z);
    scene.add(strip);
    colliders.push(makeCollider(x - w / 2, z - d / 2, x + w / 2, z + d / 2, 0, h, 'warehouse'));
  }
  warehouse(85, -40, 24, 16, 10, whTex1);
  warehouse(85, 40, 24, 16, 12, whTex2);
  warehouse(140, -45, 20, 14, 9, whTex2);
  warehouse(140, 45, 20, 14, 11, whTex1);
  pois.push({ name: 'Gudang Ember', x: 85, z: -40, kind: 'industrial', color: '#ff7a2f' });

  // Container yard: stacks of coloured boxes between the warehouses.
  const containerCols = [0x2f6db3, 0xb33a2f, 0x3a7a4a, 0xb38a2f, 0x5a5a8a];
  const containerSpots = [
    [100, -15, 2], [100, -8, 1], [107, -15, 1], [107, -8, 2],
    [100, 8, 1], [100, 15, 2], [107, 8, 1],
    [122, -15, 1], [122, 8, 1], [130, -8, 2], [130, 15, 1],
  ];
  for (const [cx, cz, stack] of containerSpots) {
    const col = containerCols[Math.floor(rand() * containerCols.length)];
    const mat = new THREE.MeshLambertMaterial({ color: col });
    for (let s = 0; s < stack; s++) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(6, 2.6, 2.4), mat);
      c.position.set(cx, 1.3 + s * 2.6, cz);
      c.rotation.y = (rand() - 0.5) * 0.06;
      c.castShadow = true;
      c.receiveShadow = true;
      scene.add(c);
    }
    colliders.push(makeCollider(cx - 3, cz - 1.2, cx + 3, cz + 1.2, 0, stack * 2.6, 'container'));
  }
  pois.push({ name: 'Yard Kontainer', x: 112, z: 0, kind: 'industrial', color: '#ff7a2f' });

  // Gantry cranes: 4 legs + top beam + jib + hook block.
  function gantryCrane(x, z, h, ry) {
    const g = new THREE.Group();
    const steel = new THREE.MeshLambertMaterial({ color: 0x8a6a2f });
    const dark = new THREE.MeshLambertMaterial({ color: 0x2a2a30 });
    for (const [lx, lz] of [[-4, -3], [4, -3], [-4, 3], [4, 3]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.8, h, 0.8), steel);
      leg.position.set(lx, h / 2, lz);
      leg.castShadow = true;
      g.add(leg);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(11, 1.2, 1.2), steel);
    beam.position.set(0, h + 0.6, 0);
    beam.castShadow = true;
    g.add(beam);
    const jib = new THREE.Mesh(new THREE.BoxGeometry(14, 0.8, 0.8), dark);
    jib.position.set(6, h + 1.8, 0);
    g.add(jib);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2, 2.2), dark);
    cab.position.set(0, h - 1.5, 0);
    g.add(cab);
    const hook = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 0.8), dark);
    hook.position.set(10, h - 4, 0);
    g.add(hook);
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    scene.add(g);
    colliders.push(makeCollider(x - 4.5, z - 3.5, x + 4.5, z + 3.5, 0, h + 2, 'crane'));
  }
  gantryCrane(128, -28, 16, 0);
  gantryCrane(148, 28, 18, Math.PI / 2);
  pois.push({ name: 'Crane Dermaga', x: 128, z: -28, kind: 'landmark', color: '#ff7a2f' });

  // Wooden pier from the quay into the sea (walkable, flat).
  {
    const pierMat = new THREE.MeshLambertMaterial({ map: plankTexture() });
    const pier = new THREE.Mesh(new THREE.BoxGeometry(32, 0.3, 8), pierMat);
    pier.position.set(156, 0.15, 0);
    pier.receiveShadow = true;
    scene.add(pier);
    // support posts under the pier (visual only)
    const postMat = new THREE.MeshLambertMaterial({ color: 0x3a2a18 });
    for (let px = 142; px <= 170; px += 7) {
      for (const pz of [-3.4, 3.4]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 1.2, 6), postMat);
        post.position.set(px, -0.4, pz);
        scene.add(post);
      }
    }
    // pier edge rails (low, with gaps) — colliders keep the player on the pier
    const railMat = new THREE.MeshLambertMaterial({ color: 0x4a3220 });
    for (const pz of [-3.8, 3.8]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(32, 0.9, 0.15), railMat);
      rail.position.set(156, 0.75, pz);
      scene.add(rail);
      colliders.push(makeCollider(140, pz - 0.1, 172, pz + 0.1, 0, 1, 'rail'));
    }
    colliders.push(makeCollider(140, -4, 172, -3.8, 0, 1, 'rail'));
    // pier end rail (blocks walking off the end, lighthouse sits behind it)
    colliders.push(makeCollider(171.8, -4, 172.2, 4, 0, 1, 'rail'));
    pois.push({ name: 'Dermaga Ember', x: 156, z: 0, kind: 'landmark', color: '#4aa8ff' });
  }

  // Lighthouse at the pier end: white/red tower + glowing lamp room.
  let beaconLight = null;
  {
    const white = new THREE.MeshLambertMaterial({ color: 0xe8e4da });
    const red = new THREE.MeshLambertMaterial({ color: 0xb33a2f });
    const tower = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.0, 8, 12), white);
    base.position.y = 4;
    base.castShadow = true;
    tower.add(base);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 2.2, 12), red);
    band.position.y = 9;
    tower.add(band);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.5, 6, 12), white);
    top.position.y = 13;
    top.castShadow = true;
    tower.add(top);
    const lampRoom = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 2.2, 2.2),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8 }),
    );
    lampRoom.position.y = 17;
    tower.add(lampRoom);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(1.8, 1.6, 8), red);
    cap.position.y = 19;
    tower.add(cap);
    tower.position.set(168, 0.3, 0);
    scene.add(tower);
    beaconLight = new THREE.PointLight(0xffe9a8, 40, 60, 1.6);
    beaconLight.position.set(168, 17.3, 0);
    scene.add(beaconLight);
    colliders.push(makeCollider(166, -2, 170, 2, 0, 20, 'lighthouse'));
    pois.push({ name: 'Mercusuar Ember', x: 168, z: 0, kind: 'landmark', color: '#ffe9a8' });
  }

  // The sea: a dark blue plane east of the quay (x 156..192).
  let seaMat = null;
  {
    seaMat = new THREE.MeshLambertMaterial({ map: seaTexture(), color: 0x9fc4e8, emissive: 0x0a2036, emissiveIntensity: 0.4 });
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(40, 164), seaMat);
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(176, 0.01, 0);
    scene.add(sea);
  }

  // Quay wall along x=155 (keeps the player out of the sea; pier gap at z -4..4).
  {
    const quayMat = new THREE.MeshLambertMaterial({ color: 0x3a3a44 });
    for (const [z0, z1] of [[-62, -4], [4, 62]]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.1, z1 - z0), quayMat);
      wall.position.set(155, 0.55, (z0 + z1) / 2);
      wall.castShadow = true;
      scene.add(wall);
      colliders.push(makeCollider(154.4, z0, 155.6, z1, 0, 1.1, 'quay'));
    }
  }

  // Safehouse 2: a small office beside warehouse (140, 45), green door light.
  {
    const office = new THREE.Mesh(
      new THREE.BoxGeometry(7, 4.5, 5),
      new THREE.MeshLambertMaterial({ color: 0x4a4a58 }),
    );
    office.position.set(132, 2.25, 45);
    office.castShadow = true;
    scene.add(office);
    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.9, 0.15),
      new THREE.MeshBasicMaterial({ color: 0x37d67a }),
    );
    glow.position.set(132, 1.4, 42.4);
    scene.add(glow);
    colliders.push(makeCollider(128.5, 42.5, 135.5, 47.5, 0, 4.5, 'office'));
    pois.push({ name: 'Safehouse — Kantor Dermaga', x: 132, z: 45, kind: 'safehouse', color: '#37d67a' });
  }

  // Waterfront streetlights: 2 real lights (dock + yard), orange.
  for (const [x, z] of [[115, 9], [148, -9]]) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 7, 8), poleMat);
    pole.position.y = 3.5;
    pole.castShadow = true;
    g.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.14, 0.3), new THREE.MeshBasicMaterial({ color: 0xffb347 }));
    head.position.set(0.7, 6.9, 0);
    g.add(head);
    g.position.set(x, 0, z);
    scene.add(g);
    const p = new THREE.PointLight(0xff9a3d, 50, 26, 1.8);
    p.position.set(x, 6.8, z);
    scene.add(p);
    lamps.push(p);
    colliders.push(makeCollider(x - 0.2, z - 0.2, x + 0.2, z + 0.2, 0, 7, 'lamp'));
  }
  // Emissive-only lamps along Jalan Dermaga.
  for (let z = -50; z <= 50; z += 12.5) {
    if (Math.abs(z) < 10) continue;
    lampPost(107.5, z, false);
    lampPost(122.5, z, false);
  }
  // Emissive-only lamps along the EW spine, residential + waterfront stretches.
  for (let x = -165; x <= 165; x += 12.5) {
    if (Math.abs(x) < 55) continue; // downtown already has its own
    if (Math.abs(x + 115) < 9 || Math.abs(x - 115) < 9) continue; // intersections
    lampPost(x, -8.2, false);
    lampPost(x, 8.2, false);
  }

  // ---- district / street naming for the HUD ----
  function districtAt(x, z) {
    // Waterfront (east).
    if (x > 60) {
      if (x > 152) return { district: 'WATERFRONT — Dermaga Ember', street: 'Dermaga Kayu' };
      if (Math.abs(z) <= 9) return { district: 'WATERFRONT — Dermaga Ember', street: 'Jalan Merdeka' };
      if (z < -20) return { district: 'WATERFRONT — Gudang Utara', street: 'Jalan Dermaga' };
      if (z > 20) return { district: 'WATERFRONT — Gudang Selatan', street: 'Jalan Dermaga' };
      return { district: 'WATERFRONT — Yard Kontainer', street: 'Jalan Dermaga' };
    }
    // Residential (west).
    if (x < -60) {
      if (x < -125 && z >= 22 && z <= 52) return { district: 'RESIDENTIAL — Taman Melati', street: 'Jalan Taman' };
      if (Math.abs(z) <= 9) return { district: 'RESIDENTIAL — Perumahan', street: 'Jalan Merdeka' };
      if (Math.abs(x + 115) <= 9) return { district: 'RESIDENTIAL — Jalan Melati', street: 'Jalan Melati' };
      return { district: 'RESIDENTIAL — Perumahan', street: 'Jalan Melati' };
    }
    // Downtown (centre, Phase 1 names kept).
    if (Math.abs(x) <= 9 && Math.abs(z) <= 9) return { district: 'EMBER BAY — DOWNTOWN', street: 'Persimpangan Merdeka' };
    if (Math.abs(x) <= 9) return { district: 'EMBER BAY — DOWNTOWN', street: 'Jalan Merdeka' };
    if (Math.abs(z) <= 9) return { district: 'EMBER BAY — DOWNTOWN', street: 'Jalan Pantai' };
    if (x > 0 && z < 0) return { district: 'DOWNTOWN — Menara Kembar', street: 'Jalan Menara' };
    if (x < 0 && z < 0) return { district: 'DOWNTOWN — Plaza Utara', street: 'Jalan Plaza' };
    if (x > 0 && z > 0) return { district: 'KAMPUNG PANTAI — Dermaga', street: 'Jalan Dermaga' };
    return { district: 'KAMPUNG PANTAI — Pasar Malam', street: 'Jalan Pasar' };
  }

  function update(dt, t) {
    // gentle lamp flicker so the night feels alive
    for (let i = 0; i < lamps.length; i++) {
      lamps[i].intensity = (lamps[i].color.getHex() === 0x37d67a ? 18 : 60) + Math.sin(t * 7 + i * 2.4) * 2.5;
    }
    // lighthouse beacon pulse
    if (beaconLight) beaconLight.intensity = 40 + Math.sin(t * 1.6) * 22;
    // slow sea shimmer
    if (seaMat) seaMat.emissiveIntensity = 0.35 + Math.sin(t * 0.5) * 0.1;
  }

  return { colliders, districtAt, update, pois, bounds: WORLD_BOUNDS };
}

// CITY OF EMBERS — world builder (original, Phase 1).
// One night city block in a fictional tropical coastal metropolis: two
// crossing roads, sidewalks, 16 towers with glowing windows, palms,
// streetlights, fog and a starry sky. All geometry is generated here;
// no external assets, no network requests.

import * as THREE from 'three';
import { makeCollider } from './collision.js';

export const WORLD_HALF = 60; // playable bounds: x,z in [-60, 60]

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

export function buildWorld(scene, opts) {
  const lowFx = !!(opts && opts.lowFx);
  const rand = mulberry32(20261119);
  const colliders = [];
  const lamps = []; // real point lights, updated subtly for flicker life

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
  moon.shadow.camera.left = -70;
  moon.shadow.camera.right = 70;
  moon.shadow.camera.top = 70;
  moon.shadow.camera.bottom = -70;
  moon.shadow.camera.far = 160;
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
  const asphalt = new THREE.MeshLambertMaterial({ color: 0x17171f });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(150, 150), asphalt);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const roadMat = new THREE.MeshLambertMaterial({ color: 0x232330 });
  const roadEW = new THREE.Mesh(new THREE.PlaneGeometry(150, 10), roadMat);
  roadEW.rotation.x = -Math.PI / 2;
  roadEW.position.y = 0.02;
  roadEW.receiveShadow = true;
  scene.add(roadEW);
  const roadNS = new THREE.Mesh(new THREE.PlaneGeometry(10, 150), roadMat);
  roadNS.rotation.x = -Math.PI / 2;
  roadNS.position.y = 0.02;
  roadNS.receiveShadow = true;
  scene.add(roadNS);

  // Sidewalks: raised strips along both roads.
  const walkMat = new THREE.MeshLambertMaterial({ color: 0x3b3b4c });
  function sidewalk(w, d, x, z) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(w, 0.18, d), walkMat);
    s.position.set(x, 0.09, z);
    s.receiveShadow = true;
    scene.add(s);
  }
  sidewalk(150, 3, 0, -6.5);
  sidewalk(150, 3, 0, 6.5);
  sidewalk(3, 150, -6.5, 0);
  sidewalk(3, 150, 6.5, 0);

  // Lane dashes (centre lines) + crosswalk stripes at the intersection.
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8c95a });
  const stripeMat = new THREE.MeshBasicMaterial({ color: 0xdfe3ee });
  for (let x = -70; x <= 70; x += 6) {
    if (Math.abs(x) < 9) continue; // keep the intersection clear
    const d1 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.02, 0.18), dashMat);
    d1.position.set(x, 0.05, 0);
    scene.add(d1);
    const d2 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 2.4), dashMat);
    d2.position.set(0, 0.05, x);
    scene.add(d2);
  }
  for (let i = -4; i <= 4; i++) {
    const s1 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.02, 9), stripeMat);
    s1.position.set(i * 1.2, 0.05, 9.2);
    scene.add(s1);
    const s2 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.02, 9), stripeMat);
    s2.position.set(i * 1.2, 0.05, -9.2);
    scene.add(s2);
    const s3 = new THREE.Mesh(new THREE.BoxGeometry(9, 0.02, 0.7), stripeMat);
    s3.position.set(9.2, 0.05, i * 1.2);
    scene.add(s3);
    const s4 = new THREE.Mesh(new THREE.BoxGeometry(9, 0.02, 0.7), stripeMat);
    s4.position.set(-9.2, 0.05, i * 1.2);
    scene.add(s4);
  }

  // ---- buildings ----
  // x, z, width, depth, height — 16 towers in four quadrants.
  const specs = [
    [18, -20, 14, 12, 26], [38, -18, 12, 14, 38], [20, -42, 16, 12, 14], [42, -44, 14, 14, 22],
    [-20, -22, 12, 16, 32], [-40, -20, 14, 12, 18], [-22, -44, 14, 12, 46], [-44, -44, 12, 14, 26],
    [20, 20, 16, 14, 16], [42, 22, 12, 12, 30], [18, 44, 14, 12, 12], [44, 46, 16, 14, 20],
    [-20, 20, 12, 14, 24], [-42, 22, 14, 12, 14], [-22, 44, 16, 12, 34], [-44, 46, 12, 12, 18],
  ];
  // A few facade variants so towers don't look cloned.
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
    // rooftop plant boxes for silhouette variety
    const nAc = 1 + Math.floor(rand() * 2);
    for (let i = 0; i < nAc; i++) {
      const ac = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 1.2), acMat);
      ac.position.set(x + (rand() - 0.5) * (w - 3), h + 0.9, z + (rand() - 0.5) * (d - 3));
      scene.add(ac);
    }
    // glowing rooftop edge strip on the tallest towers
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

  // ---- palms along the sidewalks ----
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

  // ---- streetlights (6 real lights at the intersection + arms, rest emissive) ----
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
    // face the lamp toward the road centre
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

  // ---- district / street naming for the HUD ----
  function districtAt(x, z) {
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
      lamps[i].intensity = 60 + Math.sin(t * 7 + i * 2.4) * 2.5;
    }
  }

  return { colliders, districtAt, update };
}

export function makeCollider(minX, minZ, maxX, maxZ, minY, maxY, name) {
  return { minX, maxX, minZ, maxZ, minY: minY ?? 0, maxY: maxY ?? 100, name: name ?? 'solid' };
}
export function resolveCircle(x, z, radius, feetY, height, colliders) {
  let cx = x;
  let cz = z;
  const touched = [];
  for (const c of colliders) {
    if (feetY > c.maxY || feetY + height < c.minY) continue;
    const nearestX = Math.max(c.minX, Math.min(cx, c.maxX));
    const nearestZ = Math.max(c.minZ, Math.min(cz, c.maxZ));
    const dx = cx - nearestX;
    const dz = cz - nearestZ;
    const d2 = dx * dx + dz * dz;
    if (d2 >= radius * radius) continue;
    touched.push(c);
    if (d2 > 1e-9) {
      const d = Math.sqrt(d2);
      const push = (radius - d) / d;
      cx += dx * push;
      cz += dz * push;
    } else {
      const pLeft = cx - c.minX + radius;
      const pRight = c.maxX - cx + radius;
      const pBack = cz - c.minZ + radius;
      const pFront = c.maxZ - cz + radius;
      const m = Math.min(pLeft, pRight, pBack, pFront);
      if (m === pLeft) cx = c.minX - radius;
      else if (m === pRight) cx = c.maxX + radius;
      else if (m === pBack) cz = c.minZ - radius;
      else cz = c.maxZ + radius;
    }
  }
  return { x: cx, z: cz, touched };
}
export function segmentClearT(x0, y0, z0, x1, y1, z1, colliders) {
  const STEPS = 24;
  for (let i = 1; i <= STEPS; i++) {
    const t = i / STEPS;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    const z = z0 + (z1 - z0) * t;
    for (const c of colliders) {
      if (x > c.minX - 0.25 && x < c.maxX + 0.25 &&
          z > c.minZ - 0.25 && z < c.maxZ + 0.25 &&
          y > c.minY && y < c.maxY) {
        return Math.max(0, (i - 1) / STEPS);
      }
    }
  }
  return 1;
}
export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

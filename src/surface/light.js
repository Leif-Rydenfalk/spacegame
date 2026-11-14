// surface lighting: an RGB tile light map over a window around the camera, flood-propagated from emitters,
// plus a raycast headlamp cone whose ray lengths also shape the volumetric haze mesh.
import { THREE } from '../render.js';
import { world, T, isSolid } from './world.js';
export const LW = 176, LH = 104, RAYS = 96, REACH = 48;      // window in tiles; lamp reach in tiles (24 m)
const N = LW * LH;
const sr = new Float32Array(N), sg = new Float32Array(N), sb = new Float32Array(N), att = new Float32Array(N), direct = new Float32Array(N);
export const tileData = new Uint8Array(N), lightData = new Uint8Array(N * 4);
export const light = {
  ox: 0, oy: 0, emitters: [], lamp: { x: 0, y: 0, ang: 0, on: true, k: 1 }, rayD: new Float32Array(RAYS), tilesTex: null, lightTex: null, sky: [0.03, 0.045, 0.065],
  emit(tx, ty, r, g, b) { this.emitters.push(tx, ty, r, g, b); },
  at(tx, ty) { const i = Math.floor(tx) - this.ox, j = Math.floor(ty) - this.oy; if (i < 0 || j < 0 || i >= LW || j >= LH) return 0; const k = (j * LW + i) * 4; const v = (lightData[k] + lightData[k + 1] + lightData[k + 2]) / 765; return v * v * 4; },
};
// emission per tile kind: r, g, b, pulse amount
const EM = { [T.FUNGUS]: [0.03, 0.8, 0.58, 0.25], [T.POD]: [0.3, 0.1, 1.0, 0.4], [T.VINE]: [0.1, 0.34, 0.03, 0.2], [T.MOSS]: [0.06, 0.2, 0.02, 0.15], [T.LUMEN]: [0.1, 0.55, 0.7, 0.1], [T.LAVA]: [1.7, 0.3, 0.06, 0.2] };

export function initLight() {
  const t = light.tilesTex = new THREE.DataTexture(tileData, LW, LH, THREE.RedFormat, THREE.UnsignedByteType); t.magFilter = t.minFilter = THREE.NearestFilter;
  const l = light.lightTex = new THREE.DataTexture(lightData, LW, LH, THREE.RGBAFormat, THREE.UnsignedByteType); l.magFilter = l.minFilter = THREE.LinearFilter;
  t.needsUpdate = l.needsUpdate = true;
}
function sweep(a) {
  for (let j = 0; j < LH; j++) {
    let c = 0, o = j * LW; for (let i = 0; i < LW; i++, o++) { c *= att[o]; if (a[o] > c) c = a[o]; else a[o] = c; }
    c = 0; o = j * LW + LW - 1; for (let i = 0; i < LW; i++, o--) { c *= att[o]; if (a[o] > c) c = a[o]; else a[o] = c; }
  }
  for (let i = 0; i < LW; i++) {
    let c = 0, o = i; for (let j = 0; j < LH; j++, o += LW) { c *= att[o]; if (a[o] > c) c = a[o]; else a[o] = c; }
    c = 0; o = (LH - 1) * LW + i; for (let j = 0; j < LH; j++, o -= LW) { c *= att[o]; if (a[o] > c) c = a[o]; else a[o] = c; }
  }
}
// pure propagation, exported for the symmetry test
export function propagate(r, a, w, h, iters = 2) {
  for (let k = 0; k < iters; k++) {
    for (let j = 0; j < h; j++) { let c = 0, o = j * w; for (let i = 0; i < w; i++, o++) { c *= a[o]; if (r[o] > c) c = r[o]; else r[o] = c; } c = 0; o = j * w + w - 1; for (let i = 0; i < w; i++, o--) { c *= a[o]; if (r[o] > c) c = r[o]; else r[o] = c; } }
    for (let i = 0; i < w; i++) { let c = 0, o = i; for (let j = 0; j < h; j++, o += w) { c *= a[o]; if (r[o] > c) c = r[o]; else r[o] = c; } c = 0; o = (h - 1) * w + i; for (let j = 0; j < h; j++, o -= w) { c *= a[o]; if (r[o] > c) c = r[o]; else r[o] = c; } }
  }
}
export function computeLight(camTx, camTy, time) {
  const ox = light.ox = Math.floor(camTx) - (LW >> 1), oy = light.oy = Math.floor(camTy) - (LH >> 1), sky = light.sky;
  for (let j = 0, o = 0; j < LH; j++) for (let i = 0; i < LW; i++, o++) {
    const id = world.get(ox + i, oy + j), k = id & 31; tileData[o] = id; direct[o] = 0;
    att[o] = isSolid(id) ? 0.56 : 0.905;
    const e = EM[k];
    if (e) { const p = 1 - e[3] + e[3] * Math.sin(time * 0.8 + ((ox + i) * 12.9898 + (oy + j) * 78.233) % 6.283); sr[o] = e[0] * p; sg[o] = e[1] * p; sb[o] = e[2] * p; }
    else if (id === 0) { sr[o] = sky[0]; sg[o] = sky[1]; sb[o] = sky[2]; }
    else { sr[o] = sg[o] = sb[o] = 0; }
  }
  const E = light.emitters;
  for (let n = 0; n < E.length; n += 5) { const i = Math.floor(E[n]) - ox, j = Math.floor(E[n + 1]) - oy; if (i < 0 || j < 0 || i >= LW || j >= LH) continue; const o = j * LW + i; sr[o] += E[n + 2]; sg[o] += E[n + 3]; sb[o] += E[n + 4]; }
  E.length = 0;
  // headlamp: a cone of rays through the tile grid, soft at the edge, one tile of penetration into rock
  const L = light.lamp, half = 0.366;
  if (L.on) for (let r = 0; r < RAYS; r++) {
    const u = (r / (RAYS - 1)) * 2 - 1, a = L.ang + u * half, dx = Math.cos(a) * 0.5, dy = Math.sin(a) * 0.5, edge = Math.pow(1 - u * u, 1.5) * L.k;
    let x = L.x - ox, y = L.y - oy, pen = 0, d = 0;
    for (; d < REACH; d += 0.5) {
      x += dx; y += dy; const i = x | 0, j = y | 0; if (x < 0 || y < 0 || i >= LW || j >= LH) break;
      const o = j * LW + i, f = 1 - d / REACH, v = 2.8 * edge * f * f / (1 + d * d * 0.004) * (pen ? Math.pow(0.45, pen) : 1);
      if (v > direct[o]) direct[o] = v;
      if (att[o] < 0.6) { if (!pen) light.rayD[r] = d; pen += 0.5; if (pen > 1.2) break; }
    }
    if (!pen) light.rayD[r] = d;
  }
  if (L.on) for (let o = 0; o < N; o++) { const b = direct[o] * 0.22; if (b > 0) { sr[o] += b; sg[o] += b * 0.92; sb[o] += b * 0.78; } }
  for (let k = 0; k < 2; k++) { sweep(sr); sweep(sg); sweep(sb); }
  for (let o = 0, q = 0; o < N; o++, q += 4) {
    const d = direct[o];
    lightData[q] = Math.sqrt(Math.min(1, (sr[o] + d) * 0.25)) * 255; lightData[q + 1] = Math.sqrt(Math.min(1, (sg[o] + d * 0.92) * 0.25)) * 255; lightData[q + 2] = Math.sqrt(Math.min(1, (sb[o] + d * 0.78) * 0.25)) * 255; lightData[q + 3] = 255;
  }
  light.tilesTex.needsUpdate = true; light.lightTex.needsUpdate = true;
}

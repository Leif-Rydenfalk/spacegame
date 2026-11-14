// surface world: tiles in 32x32 chunks, generated on demand as a pure function of (x, y, seed).
import { hash, noise2, fbm } from '../core.js';
export const TS = 0.5;                       // metres per tile
export const GRAV = 8.7;                     // m/s^2, stated in the HUD
export const T = { AIR: 0, SOIL: 2, BASALT: 3, OBSIDIAN: 4, IRON: 5, COPPER: 6, LUMEN: 7, LAVA: 8, MOSS: 9, FUNGUS: 10, POD: 11, VINE: 12, PLATE: 13 };
export const WALL = 32;                      // bit: a back wall behind this tile (underground)
export const isSolid = id => { const k = id & 31; return (k >= 2 && k <= 7) || k === 9 || k === 13; };
export const HARD = { 2: 0.35, 3: 0.9, 4: 1.6, 5: 1.1, 6: 1.2, 7: 1.4, 9: 0.35, 10: 0.1, 11: 0.1, 12: 0.1, 13: 1.0 };
export const DROP = { 2: 'soil', 3: 'basalt', 4: 'basalt', 5: 'iron ore', 6: 'copper ore', 7: 'lumen', 9: 'soil', 10: 'lumen', 11: 'lumen', 13: 'plate' };
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function surfaceH(x) {
  const h = (fbm(x / 90, 0, 1, 4) - 0.5) * 44 + (noise2(x / 13, 3, 2) - 0.5) * 5;
  return Math.floor(h * smooth(26, 80, Math.abs(x)));   // the crash site is flat
}
export function solidGen(x, y) {
  const h = surfaceH(x); if (y > h) return false;
  const depth = h - y, open = Math.abs(x) > 30 && noise2(x / 46, 0, 33) > 0.62 ? 0 : 5;
  if (depth >= open) {
    const n = fbm(x / 38, y / 24, 5, 3);
    if (Math.abs(n - 0.5) < 0.03 + Math.min(depth, 60) * 0.0005) return false;
    if (depth > 8 && fbm(x / 24, y / 17, 9, 3) > 0.66) return false;
  }
  return true;
}
function gen(x, y) {
  const h = surfaceH(x), wall = y <= h ? WALL : 0;
  if (solidGen(x, y)) {
    const depth = h - y;
    let m = depth < 4 + hash(x, 0, 3) * 3 ? T.SOIL : y > -90 + noise2(x / 30, 0, 4) * 14 ? T.BASALT : T.OBSIDIAN;
    if (m !== T.SOIL) {
      if (depth < 80 && fbm(x / 8, y / 8, 21, 2) > 0.7) m = T.IRON;
      else if (depth > 12 && fbm(x / 8, y / 8, 22, 2) > 0.72) m = T.COPPER;
      else if (depth > 7 && fbm(x / 6, y / 6, 23, 2) > 0.73) m = T.LUMEN;
    }
    if ((m === T.SOIL || m === T.BASALT) && !solidGen(x, y + 1) && hash(x, y, 30) < (depth < 1 ? 0.3 : 0.45)) m = T.MOSS;
    return m | wall;
  }
  if (y < -120) return T.LAVA | wall;
  const cl = noise2(x / 12, y / 12, 41);
  if (solidGen(x, y - 1)) {
    const r = hash(x, y, 40);
    if (cl > 0.5 && r < 0.42) return T.FUNGUS | wall;
    if (r > 0.975) return T.POD | wall;
  }
  if (y <= h && hash(x, 0, 42) < 0.3 && cl < 0.55) { // vines hang one to three tiles under a ceiling
    const len = 1 + Math.floor(hash(x, 1, 43) * 3);
    for (let i = 1; i <= len; i++) { if (solidGen(x, y + i)) return T.VINE | wall; if (solidGen(x, y + i - 1)) break; }
  }
  return wall;
}

const CH = 32, chunks = new Map(); let lastKey = NaN, last = null;
function chunk(cx, cy) {
  const key = (cx + 32768) * 65536 + (cy + 32768);
  if (key === lastKey) return last;
  let c = chunks.get(key);
  if (!c) {
    c = { d: new Uint8Array(CH * CH), mod: false, used: 0 };
    for (let j = 0; j < CH; j++) for (let i = 0; i < CH; i++) c.d[j * CH + i] = gen(cx * CH + i, cy * CH + j);
    chunks.set(key, c);
    if (chunks.size > 400) for (const [k, v] of chunks) { if (!v.mod && v !== c) { chunks.delete(k); if (chunks.size <= 320) break; } }
  }
  lastKey = key; last = c; return c;
}
export const world = {
  chunks,
  get(x, y) { return chunk(x >> 5, y >> 5).d[((y & 31) << 5) | (x & 31)]; },
  set(x, y, id) { const c = chunk(x >> 5, y >> 5); c.d[((y & 31) << 5) | (x & 31)] = id; c.mod = true; },
  solid(x, y) { return isSolid(this.get(x, y)); },
  solidAt(mx, my) { return isSolid(this.get(Math.floor(mx / TS), Math.floor(my / TS))); },   // metres
  // first solid tile straight down from (tx, ty), at most n tiles; returns its y or null
  groundBelow(tx, ty, n = 24) { for (let i = 0; i < n; i++) if (isSolid(this.get(tx, ty - i))) return ty - i; return null; },
  // tile ray in metres; returns { d, x, y, tx, ty } of the first solid tile or null
  ray(x, y, dx, dy, max) {
    const st = 0.12, n = Math.ceil(max / st);
    for (let i = 1; i <= n; i++) { const px = x + dx * st * i, py = y + dy * st * i; const tx = Math.floor(px / TS), ty = Math.floor(py / TS); if (isSolid(this.get(tx, ty))) return { d: st * i, x: px, y: py, tx, ty }; }
    return null;
  },
};

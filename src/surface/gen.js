// surface generation: pure functions of (x, y, seed) in metres. No state, no imports from the rest of the surface.
import { noise2, fbm } from '../core.js';
export const CELL = 0.125;                   // metres per density sample
export const CH = 64;                        // samples per chunk side (8 m)
export const TS = 0.5;                       // metres per light cell and per machine placement cell
export const GRAV = 8.7;                     // m/s^2, stated in the HUD
export const SLAB = 0.02;                    // m: thickness of the slice the mass accounting uses (1 m2 of basalt = 58 kg)
export const LAVA_Y = -62;                   // m: open air below this is lava
export const WALL = 128;                     // material bit: a back wall behind this sample
export const M = { AIR: 0, SOIL: 1, BASALT: 2, OBSIDIAN: 3, IRON: 4, COPPER: 5, LUMEN: 6, PLATE: 7, HIVE: 8, XENO: 9, CONCRETE: 10, STEEL: 11 };
// rho kg/m3, hard = seconds of laser per metre of cut (relative), item = what the drill collects, keep = collected fraction
export const MAT = [
  { name: 'air', rho: 0, hard: 1, keep: 0 },
  { name: 'soil', rho: 1500, hard: 0.3, item: 'soil', keep: 0.3 },
  { name: 'basalt', rho: 2900, hard: 0.9, item: 'basalt', keep: 0.3 },
  { name: 'obsidian', rho: 2500, hard: 1.5, item: 'basalt', keep: 0.3 },
  { name: 'iron ore', rho: 5000, hard: 1.1, item: 'iron ore', keep: 1 },
  { name: 'copper ore', rho: 4200, hard: 1.2, item: 'copper ore', keep: 1 },
  { name: 'lumen', rho: 2100, hard: 1.4, item: 'lumen', keep: 1 },
  { name: 'plate', rho: 2400, hard: 1.0, item: 'iron', keep: 0.9 },
  { name: 'hive tissue', rho: 1100, hard: 0.45, item: 'biomass', keep: 0.5 },
  { name: 'xeno stone', rho: 3400, hard: 4.5, item: 'xeno shard', keep: 0.15 },
  { name: 'concrete', rho: 2400, hard: 2.0, item: 'basalt', keep: 0.2 },
  { name: 'steel', rho: 7800, hard: 3.5, item: 'iron', keep: 0.4 },
];
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function surfaceH(x) {                // metres; the crash site is flat
  const t = x * 2, h = (fbm(t / 90, 0, 1, 4) - 0.5) * 44 + (noise2(t / 13, 3, 2) - 0.5) * 5;
  return h * 0.5 * sm(13, 40, Math.abs(x));
}
// biome weights along x: 0 fungal forest (cyan), 1 violet thicket, 2 acid marsh. Returns the dominant one and a blend.
export function biome(x) { const n = noise2(x / 150 + 40, 0, 60) + (noise2(x / 37, 5, 61) - 0.5) * 0.25; return n < 0.42 ? 0 : n < 0.62 ? 1 : 2; }
export function lushness(x) { return (0.55 + 0.6 * noise2(x / 45, 2, 62)) * sm(5, 16, Math.abs(x)); }

// natural signed density in metres, positive inside rock; h = surfaceH(x)
export function natD(x, y, h) {
  const depth = h - y; if (depth < -0.8) return depth;
  let d = depth;
  const open = Math.abs(x) > 15 && noise2(x / 23, 0, 33) > 0.62 ? 0 : 2.5;
  if (depth > open - 1) {
    const n = fbm(x / 19, y / 12, 5, 3), w = 0.03 + Math.min(depth * 2, 60) * 0.0005;
    let c = (Math.abs(n - 0.5) - w) * 14;
    if (depth > 3) c = Math.min(c, (0.66 - fbm(x / 12, y / 8.5, 9, 3)) * 9);
    d = Math.min(d, Math.max(c, open - depth));
  }
  return d;
}
// ore fields, each a smooth scalar; the fine pass thresholds them
export const oreIron = (x, y) => fbm(x / 4, y / 4, 21, 2);
export const oreCopper = (x, y) => fbm(x / 4, y / 4, 22, 2);
export const oreLumen = (x, y) => fbm(x / 3, y / 3, 23, 2);
// signed distance of a stamp shape, negative inside
export function stampSD(s, x, y) {
  if (s.t === 'b') { const cx = (s.x0 + s.x1) / 2, cy = (s.y0 + s.y1) / 2, r = s.r || 0, dx = Math.abs(x - cx) - (s.x1 - s.x0) / 2 + r, dy = Math.abs(y - cy) - (s.y1 - s.y0) / 2 + r; return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - r; }
  if (s.t === 'e') { const dx = (x - s.x) / s.rx, dy = (y - s.y) / s.ry; return (Math.hypot(dx, dy) - 1) * Math.min(s.rx, s.ry); }
  const ex = s.x1 - s.x0, ey = s.y1 - s.y0, l2 = ex * ex + ey * ey || 1e-6, t = Math.min(1, Math.max(0, ((x - s.x0) * ex + (y - s.y0) * ey) / l2));
  return Math.hypot(x - s.x0 - ex * t, y - s.y0 - ey * t) - (s.r + (s.r1 === undefined ? 0 : (s.r1 - s.r) * t));
}
export function stampBox(s) {
  if (s.t === 'b') return [s.x0, s.y0, s.x1, s.y1];
  if (s.t === 'e') return [s.x - s.rx, s.y - s.ry, s.x + s.rx, s.y + s.ry];
  const r = Math.max(s.r, s.r1 || 0); return [Math.min(s.x0, s.x1) - r, Math.min(s.y0, s.y1) - r, Math.max(s.x0, s.x1) + r, Math.max(s.y0, s.y1) + r];
}

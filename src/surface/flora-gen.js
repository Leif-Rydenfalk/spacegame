// plant generators: pure functions of (type, biome, random source, lushness) that return a plant in local coordinates
// (root at 0,0, up is +y; hanging plants grow down). The play plane and every parallax layer draw the same species from
// here, so the forest behind the player is the forest the player walks in. A plant is a flat list of primitives:
//   [kind(0 seg, 1 blob), x1, y1, x2|w, y2|h, width|rot, r, g, b, a, shape, mode, sway1, sway2, taper, curve, rim, twinkle, flutter]
// Also here: the wind, one travelling field that every plant in every layer samples.
import { noise2 } from '../core.js';
import { C, mul, mix } from './state.js';

export const PAL = [
  { g: C.cyan, g2: [1.0, 0.5, 0.1], bark: [0.036, 0.05, 0.056], leaf: [0.016, 0.062, 0.054], leaf2: [0.03, 0.105, 0.07], cap: [0.045, 0.055, 0.07] },
  { g: C.violet, g2: [1.0, 0.1, 0.42], bark: [0.05, 0.032, 0.06], leaf: [0.046, 0.024, 0.08], leaf2: [0.085, 0.034, 0.12], cap: [0.065, 0.038, 0.085] },
  { g: C.acid, g2: [0.95, 0.8, 0.16], bark: [0.044, 0.05, 0.028], leaf: [0.028, 0.07, 0.018], leaf2: [0.052, 0.115, 0.024], cap: [0.055, 0.066, 0.03] },
];
// wind at a place and time: a slow breeze, gust fronts that travel downwind, and a fast flutter. About -0.4 .. 1.8.
export function wind(x, t) {
  const g = noise2(x * 0.021 - t * 0.33, t * 0.045, 5), g2 = noise2(x * 0.09 - t * 0.9, 3.3, 6);
  return 0.18 + Math.sin(t * 0.37 + x * 0.013) * 0.16 + g * g * 2.1 * (0.55 + 0.45 * Math.sin(t * 0.11 + 1.3)) + (g2 - 0.5) * 0.5;
}
const S = (p, x1, y1, x2, y2, w, c, taper = 0, curve = 0, rim = 0, a = 1, mode = 1, flut = 0, tw = 0) => { p.prims.push([0, x1, y1, x2, y2, w, c[0], c[1], c[2], a, 2, mode, 0, 0, taper, curve, rim, tw, flut]); };
const B = (p, x, y, w, h, rot, c, shape = 7, a = 1, mode = 1, rim = 0, flut = 0, taper = 0, curve = 0, tw = 0) => { p.prims.push([1, x, y, w, h, rot, c[0], c[1], c[2], a, shape, mode, 0, 0, taper, curve, rim, tw, flut]); };
const lit = (p, x, y, c, k) => p.lights.push(x, y, c[0] * k, c[1] * k, c[2] * k);
// a glow: wide dim halo, bright body, hot core
function glow(p, x, y, r, c, k = 1, flut = 0) { B(p, x, y, r * 5, r * 5, 0, mul(c, 0.34 * k), 1, 0.6, 2, 0, flut); B(p, x, y, r * 1.5, r * 1.9, 0, mul(c, 1.5 * k), 2, 0.95, 2, 0, flut); B(p, x, y + r * 0.1, r * 0.6, r * 0.8, 0, [c[0] * 1.2 + 1.1, c[1] * 1.2 + 0.9, c[2] * 1.2 + 0.9], 1, 1, 2, 0, flut); }
// a thread that hangs from (x, y) with a bead of light at its end
function thread(p, r, x, y, len, c, k = 1) { const dx = (r() - 0.5) * 0.12; S(p, x, y, x + dx, y - len, 0.028, mul(c, 0.3), 0, (r() - 0.5) * 0.08, 0, 0.9, 2, 0.6); B(p, x + dx, y - len, 0.085, 0.1, 0, mul(c, 2.1 * k), 1, 1, 2, 0, 0.6, 0, 0, 1 + r() * 2); }
// a vine that hangs in arcs with small leaves and beads along it
function vine(p, r, x, y, len, pal, beads = true) {
  const n = Math.max(2, Math.ceil(len / 0.55)); let px = x, py = y;
  for (let i = 0; i < n; i++) { const nx = x + Math.sin(i * 1.7 + x * 3) * 0.1, ny = py - len / n; S(p, px, py, nx, ny, 0.04 - i * 0.002, mul(pal.leaf, 1.25), 0, (i % 2 ? 1 : -1) * 0.04, 0, 1, 1, 0.5);
    if (r() < 0.6) B(p, nx + (i % 2 ? 0.1 : -0.1), ny + 0.06, 0.26, 0.1, (i % 2 ? -0.5 : 3.6), mul(pal.leaf2, 0.9 + r() * 0.4), 12, 1, 1, 0.3, 0.8, 0.2);
    if (beads && i % 2) B(p, nx, ny, 0.08, 0.09, 0, mul(pal.g, 1.6), 1, 0.95, 2, 0, 0.5, 0, 0, 1.5); px = nx; py = ny; }
  if (beads) B(p, px, py - 0.04, 0.11, 0.13, 0, mul(pal.g, 2.0), 1, 1, 2, 0, 0.6, 0, 0, 2);
  return py;
}
// a trunk along a path of points [x, y, width]; plates and a lit rim give it volume
function trunk(p, r, pts, pal, veins) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1, w1] = pts[i], [x2, y2, w2] = pts[i + 1], sh = 0.82 + 0.3 * r();
    S(p, x1, y1, x2, y2, w1, mul(pal.bark, sh), Math.max(0, 1 - w2 / w1), 0, 0.75);
    if (w1 > 0.16) { const o = (r() - 0.5) * w1 * 0.5; S(p, x1 + o, y1 + 0.05, x2 + o * 0.6, y2 - 0.05, w1 * 0.16, mul(pal.bark, 0.42), 0.3); if (r() < 0.6) S(p, x1 - o * 0.8, y1 + (y2 - y1) * 0.2, x2 - o, y2 - (y2 - y1) * 0.3, w1 * 0.1, mul(pal.bark, 1.7), 0.5, 0, 0, 0.7); }
    if (veins && r() < veins) { const o = (r() - 0.5) * w1 * 0.6; S(p, x1 + o, y1 + (y2 - y1) * 0.15, x2 + o * 0.7, y1 + (y2 - y1) * (0.5 + r() * 0.45), 0.03, mul(pal.g, 0.55), 0, 0, 0, 0.85, 2, 0, 0.6 + r()); }
  }
}
function roots(p, r, w0, pal, n, spread) {
  for (let i = 0; i < n; i++) { const d = (i % 2 ? 1 : -1), ex = d * (spread * (0.35 + r() * 0.65)), y0 = 0.25 + r() * (0.5 + w0 * 2);
    S(p, d * w0 * 0.3, y0, ex, -0.2, w0 * (0.4 + r() * 0.25), mul(pal.bark, 0.8 + r() * 0.3), 0.72, -d * (0.1 + r() * 0.3) * Math.sign(ex) * d, 0.5);
    if (r() < 0.5) B(p, ex * 0.6, y0 * 0.45, 0.5 + r() * 0.5, 0.26, 0, mul(pal.leaf, 1.1 + r() * 0.5), 7, 1, 1, 0.3); }
}
// the fungal giant: a tapering trunk, buttress roots, boughs that carry broad caps with a lit underside and threads
function capTree(p, r, lush, pal) {
  const H = p.H = (8 + r() * 9) * (0.65 + lush * 0.45), w0 = 0.32 + H * 0.03, lean = (r() - 0.5) * 0.5, ph = r() * 6.28, n = 9, pts = [];
  p.flex = 0.22 + H * 0.028; p.hp = 3 + H * 0.5; p.hw = w0 * 0.9; p.yieldK = H / 10;
  const px = t => lean * t * H * 0.3 + Math.sin(t * 4 + ph) * 0.3 * t, pw = t => w0 * (1 - 0.74 * t) + w0 * 0.8 * Math.exp(-t * 13);
  for (let i = 0; i <= n; i++) { const t = i / n; pts.push([px(t), t * H - 0.1, pw(t)]); }
  roots(p, r, w0, pal, 4 + Math.floor(r() * 3), 1.2 + w0 * 3);
  const caps = [[px(1), H - 0.1, 1]];
  const nb = 2 + Math.floor(r() * 4 * (0.5 + lush * 0.5));
  for (let i = 0; i < nb; i++) {
    const t = 0.36 + r() * 0.52, d = (i % 2 ? 1 : -1) * (r() < 0.85 ? 1 : -1), L = (1 - t) * H * 0.42 + 0.9 + r() * 1.3, a = 0.55 + r() * 0.6, bx = px(t), by = t * H, ex = bx + d * Math.sin(a) * L, ey = by + Math.cos(a) * L * 0.8, bw = pw(t) * 0.55;
    S(p, bx, by, ex, ey, bw, mul(pal.bark, 0.9), 0.6, -d * L * 0.12, 0.6);
    if (r() < 0.6) { const sx = bx + (ex - bx) * 0.55, sy = by + (ey - by) * 0.55 - L * 0.06, fx = sx + d * (0.5 + r() * 0.9), fy = sy + 0.5 + r() * 0.9; S(p, sx, sy, fx, fy, bw * 0.5, mul(pal.bark, 0.8), 0.6, d * 0.08, 0.5); caps.push([fx, fy, 0.5 + r() * 0.2]); }
    if (r() < 0.7) B(p, bx + d * bw, by + bw * 0.4, 0.7 + r() * 0.6, 0.4, 0, mul(pal.leaf, 1 + r() * 0.6), 7, 1, 1, 0.4, 0.2);
    if (r() < 0.55 * lush + 0.2) vine(p, r, bx + (ex - bx) * (0.3 + r() * 0.5), by + (ey - by) * 0.5 - 0.1, 1 + r() * 3.2 * (0.5 + lush * 0.5), pal, r() < 0.7);
    caps.push([ex, ey, 0.62 + r() * 0.3]);
  }
  trunk(p, r, pts, pal, 0.55);
  for (let i = 1; i < n - 2; i++) if (r() < 0.4) { const d = r() < 0.5 ? -1 : 1, [x, y, w] = pts[i], cw = 0.5 + r() * 0.5; B(p, x + d * w * 0.5, y + 0.3, cw, 0.3, 0, mix(pal.cap, pal.g, 0.08), 8, 1, 1, 0.5); S(p, x + d * w * 0.5 - cw * 0.4, y + 0.29, x + d * w * 0.5 + cw * 0.4, y + 0.29, 0.035, mul(pal.g, 1.1), 0, 0, 0, 0.8, 2, 0, 0.7); }
  for (const [tx, ty, k] of caps) {
    const cw = (2.5 + r() * 2.8) * k * (0.72 + lush * 0.38), ch = cw * (0.2 + r() * 0.1), tilt = (r() - 0.5) * 0.24;
    B(p, tx, ty - 0.14, cw * 0.9, ch * 1.0, 0, mul(pal.g, 0.55), 1, 0.5, 2, 0, 0.1);                               // light under the cap
    B(p, tx, ty - 0.02, cw, ch * 2, tilt, pal.cap, 8, 1, 1, 0.9, 0.1);
    B(p, tx - cw * 0.14, ty + ch * 0.5, cw * 0.55, ch * 0.7, tilt, mul(pal.leaf2, 0.9), 7, 0.85, 1, 0.5, 0.1);     // moss on the crown
    S(p, tx - cw * 0.44, ty - 0.03, tx + cw * 0.44, ty - 0.03 + tilt * cw * 0.4, 0.05, mul(pal.g, 1.25), 0, -cw * 0.02, 0, 0.75, 2, 0.1, 0.5);   // gill line
    for (let j = 0, m = Math.round((3 + r() * 5) * k); j < m; j++) thread(p, r, tx + (r() - 0.5) * cw * 0.82, ty - 0.03, 0.25 + r() * 1.5 * (0.5 + lush * 0.5), r() < 0.08 ? pal.g2 : pal.g, k);
    if (r() < 0.5) for (let j = 0; j < 3; j++) B(p, tx + (r() - 0.5) * cw * 0.6, ty + ch * (0.3 + r() * 0.5), 0.07, 0.05, 0, mul(pal.g, 1.2), 1, 0.8, 2, 0, 0.1, 0, 0, 0.8);
    lit(p, tx, ty - 0.6, pal.g, 0.42 * k + 0.16); p.top = Math.max(p.top, ty + ch);
  }
}
// the lantern stalk of the violet thicket: slender stems from one root mass, whorls of blades, a lantern in a husk
function lanternTree(p, r, lush, pal) {
  const stems = 2 + Math.floor(r() * 3), H = p.H = (6 + r() * 7.5) * (0.65 + lush * 0.45), w0 = 0.16 + H * 0.014; p.flex = 0.34 + H * 0.03; p.hp = 2.5 + H * 0.4; p.hw = 0.3 + stems * 0.08; p.yieldK = H / 10;
  for (let i = 0; i < 5; i++) { const d = i % 2 ? 1 : -1, L = 0.5 + r() * 1.2; S(p, d * 0.1, 0.3, d * L, -0.15, w0 * 0.7, mul(pal.bark, 0.9), 0.7, -d * 0.25, 0.5); }
  for (let i = 0; i < 4; i++) { const a = (i / 3 - 0.5) * 2.4 + (r() - 0.5) * 0.3, L = 0.7 + r() * 0.9; B(p, Math.sin(a) * L * 0.5, 0.1 + Math.cos(a) * L * 0.4, L, L * 0.3, Math.PI / 2 - a, mul(pal.leaf2, 0.7 + r() * 0.5), 12, 1, 1, 0.5, 0.4, 0.15, Math.sin(a) * 0.12); }
  for (let s = 0; s < stems; s++) {
    const hs = H * (0.55 + r() * 0.45), out = (s - (stems - 1) / 2) * (0.7 + r() * 0.5), ph = r() * 6.28, n = 8, pts = [];
    const px = t => out * (1 - Math.pow(1 - t, 2.2)) * (hs / 6) + Math.sin(t * 5 + ph) * 0.14 * t, pw = t => w0 * (1 - 0.66 * t);
    for (let i = 0; i <= n; i++) { const t = i / n; pts.push([px(t), t * hs, pw(t)]); }
    trunk(p, r, pts, pal, 0.3);
    for (let i = 2; i < n; i++) if (r() < 0.62) {           // a whorl of drooping blades
      const [x, y] = pts[i], m = 3 + Math.floor(r() * 3); for (let j = 0; j < m; j++) { const d = j % 2 ? 1 : -1, L = (0.7 + r() * 1.1) * (1.15 - i / n * 0.5), a = 0.2 + r() * 0.5; B(p, x + d * L * 0.48, y - L * 0.5 * Math.sin(a) * 0.4, L, L * 0.17, d > 0 ? -a : Math.PI + a, mul(pal.leaf2, 0.6 + r() * 0.7), 12, 1, 1, 0.55, 0.5, 0.25, d * L * 0.1); }
      if (r() < 0.3) { const d = r() < 0.5 ? -1 : 1, L = 0.5 + r() * 0.6; S(p, x, y, x + d * L, y + L * 0.5, 0.045, mul(pal.bark, 1.1), 0.3, -d * 0.12); glow(p, x + d * L, y + L * 0.5 + 0.1, 0.14 + r() * 0.08, r() < 0.15 ? pal.g2 : pal.g, 0.8, 0.2); }
    }
    const [tx, ty] = pts[n], bs = 0.42 + r() * 0.5;
    for (let j = 0; j < 5; j++) { const d = j % 2 ? 1 : -1, L = 1 + r() * 1.5; S(p, tx, ty - 0.1, tx + d * L * 0.7, ty - 0.2 - L * 0.55, 0.06, mul(pal.leaf, 1.2), 0.6, d * L * 0.16, 0.3, 1, 1, 0.5); if (r() < 0.5) B(p, tx + d * L * 0.7, ty - 0.24 - L * 0.55, 0.08, 0.1, 0, mul(pal.g, 1.8), 1, 1, 2, 0, 0.5, 0, 0, 1.4); }
    glow(p, tx, ty + bs * 0.55, bs * 0.62, pal.g, 1, 0.12);
    for (const d of [-1, 1]) B(p, tx + d * bs * 0.36, ty + bs * 0.42, bs * 1.5, bs * 0.5, Math.PI / 2 - d * 0.32, mul(pal.bark, 1.25), 12, 1, 1, 0.8, 0.12, 0.1, -d * bs * 0.16);          // the husk cups the bulb
    B(p, tx, ty + 0.02, bs * 0.9, bs * 0.4, 0, mul(pal.bark, 0.9), 8, 1, 1, 0.5, 0.12);
    lit(p, tx, ty + bs * 0.5, pal.g, 0.7); p.top = Math.max(p.top, ty + bs * 1.3);
  }
}
// the weeper of the acid marsh: prop roots, a leaning trunk, wide boughs, leaf masses and curtains of beaded vines
function weeperTree(p, r, lush, pal) {
  const H = p.H = (6.5 + r() * 7) * (0.65 + lush * 0.45), w0 = 0.3 + H * 0.03, lean = (r() - 0.5) * 1.3, ph = r() * 6.28, n = 7, pts = []; p.flex = 0.2 + H * 0.026; p.hp = 3 + H * 0.5; p.hw = w0 * 0.9; p.yieldK = H / 10;
  const px = t => lean * t * t * H * 0.16 + Math.sin(t * 3 + ph) * 0.3 * t, pw = t => w0 * (1 - 0.6 * t) + w0 * 0.5 * Math.exp(-t * 10);
  for (let i = 0; i <= n; i++) { const t = i / n * 0.72; pts.push([px(t), t * H, pw(t)]); }
  for (let i = 0, m = 5 + Math.floor(r() * 3); i < m; i++) { const d = i % 2 ? 1 : -1, y0 = 0.9 + r() * 2.2, ex = d * (0.9 + r() * 2.6); S(p, px(y0 / H), y0, ex, -0.25, w0 * (0.2 + r() * 0.16), mul(pal.bark, 0.75 + r() * 0.4), 0.4, d * (0.3 + r() * 0.45), 0.5); }
  trunk(p, r, pts, pal, 0.35);
  const [cx0, cy0] = pts[n], nb = 3 + Math.floor(r() * 3), ends = [];
  for (let i = 0; i < nb; i++) { const a = (i / (nb - 1) - 0.5) * 2.6 + (r() - 0.5) * 0.3, L = (2 + r() * 2.6) * (0.7 + lush * 0.4), ex = cx0 + Math.sin(a) * L, ey = cy0 + Math.cos(a) * L * 0.55 + 0.4; S(p, cx0, cy0 - 0.2, ex, ey, pw(0.72) * 0.6, mul(pal.bark, 0.9), 0.7, Math.sin(a) * L * 0.13, 0.6); ends.push([ex, ey, L]);
    ends.push([cx0 + (ex - cx0) * 0.55, cy0 + (ey - cy0) * 0.55 + L * 0.08, L * 0.7]); }
  for (const [ex, ey, L] of ends) {
    for (let j = 0, m = 2 + Math.floor(r() * 2); j < m; j++) { const cw = (1.5 + r() * 1.7) * (0.75 + lush * 0.35); B(p, ex + (r() - 0.5) * L * 0.5, ey + (r() - 0.25) * 0.8, cw, cw * (0.5 + r() * 0.2), (r() - 0.5) * 0.5, mul(j ? pal.leaf2 : pal.leaf, 0.7 + r() * 0.7), 7, 1, 1, 0.7, 0.25); }
    for (let j = 0, m = Math.round(2 + r() * 3 * (0.5 + lush)); j < m; j++) vine(p, r, ex + (r() - 0.5) * L * 0.7, ey - 0.1 + (r() - 0.5) * 0.3, 1.2 + r() * (2.4 + lush * 2.4), pal, r() < 0.75);
    if (r() < 0.35) { const vx = ex + (r() - 0.5) * 0.8, vl = 0.5 + r(); S(p, vx, ey - 0.1, vx, ey - vl, 0.035, mul(pal.leaf, 1.3)); glow(p, vx, ey - vl - 0.16, 0.16, r() < 0.2 ? pal.g2 : pal.g, 0.8, 0.5); }
    lit(p, ex, ey - 1.2, pal.g, 0.16); p.top = Math.max(p.top, ey + 0.8);
  }
  lit(p, cx0, cy0 - 1, pal.g, 0.22);
}
function small(p, r, lush, pal) {
  const t = p.type, g = r() < 0.07 ? pal.g2 : pal.g, k = 0.7 + lush * 0.5;
  if (t === 'grass') { const n = 4 + Math.floor(r() * 6); p.H = 0.6; p.flex = 0.14; p.hw = 0.2;
    for (let i = 0; i < n; i++) { const L = (0.16 + r() * 0.5) * k, a = (r() - 0.5) * 1.2, x0 = (i - n / 2) * 0.05; S(p, x0, -0.04, x0 + Math.sin(a) * L, Math.cos(a) * L, 0.03 + r() * 0.015, mul(r() < 0.5 ? pal.leaf : pal.leaf2, 0.8 + r() * 0.9), 0.9, (r() - 0.5) * L * 0.4, 0.4, 1, 1, 0.35); }
    if (r() < 0.22) B(p, (r() - 0.5) * 0.2, 0.25 + r() * 0.2, 0.05, 0.05, 0, mul(g, 1.7), 1, 0.9, 2, 0, 0.5, 0, 0, 1 + r() * 2);
  } else if (t === 'fern') { const n = 5 + Math.floor(r() * 5), L0 = (0.7 + r() * 1.1) * k; p.H = L0; p.flex = 0.28; p.top = L0 * 0.8; p.hw = 0.4;
    for (let i = 0; i < n; i++) { const a = (i / (n - 1) - 0.5) * 2.5 + (r() - 0.5) * 0.2, L = L0 * (0.7 + r() * 0.4), mx = Math.sin(a) * L * 0.5, my = Math.cos(a) * L * 0.42 + 0.05, c = mul(i % 2 ? pal.leaf : pal.leaf2, 0.7 + r() * 0.7);
      B(p, mx, my, L, L * 0.2, Math.PI / 2 - a, c, 12, 1, 1, 0.6, 0.45, 0.3, Math.sin(a) * L * 0.2); S(p, 0, 0, mx * 1.7, my * 1.5 - Math.abs(Math.sin(a)) * L * 0.14, 0.022, mul(c, 1.9), 0.8, Math.sin(a) * L * 0.12, 0, 0.8, 1, 0.45);
      if (i % 3 === 0) B(p, mx * 1.9, my * 1.55 - Math.abs(Math.sin(a)) * L * 0.2, 0.055, 0.055, 0, mul(g, 1.5), 1, 0.9, 2, 0, 0.5, 0, 0, 1.2); }
    lit(p, 0, L0 * 0.5, g, 0.1);
  } else if (t === 'paddle') { const n = 3 + Math.floor(r() * 3); p.H = 1; p.flex = 0.2; p.hw = 0.4;
    for (let i = 0; i < n; i++) { const a = (i / Math.max(1, n - 1) - 0.5) * 1.7 + (r() - 0.5) * 0.3, L = (0.5 + r() * 0.75) * k, sx = Math.sin(a) * 0.25, sy = Math.cos(a) * 0.25, mx = sx + Math.sin(a) * L * 0.5, my = sy + Math.cos(a) * L * 0.5;
      S(p, 0, 0, sx, sy, 0.035, mul(pal.leaf, 1.3)); B(p, mx, my, L, L * (0.42 + r() * 0.16), Math.PI / 2 - a, mul(pal.leaf2, 0.6 + r() * 0.6), 12, 1, 1, 0.7, 0.3, -0.1, Math.sin(a) * L * 0.08); S(p, sx, sy, sx + Math.sin(a) * L * 0.85, sy + Math.cos(a) * L * 0.85, 0.02, mul(g, 0.7), 0.6, 0, 0, 0.7, 2, 0.3, 0.5); p.top = Math.max(p.top, my + L * 0.5); }
  } else if (t === 'bulb') { const L = (0.5 + r() * 1.2) * k, bx = (r() - 0.5) * 0.4; p.H = L; p.flex = 0.24; p.top = L + 0.2; p.hw = 0.3;
    S(p, 0, 0, bx, L, 0.05, mul(pal.leaf, 1.3), 0.4, (r() - 0.5) * 0.2, 0.3); for (const d of [-1, 1]) B(p, d * 0.2, 0.14, 0.5, 0.14, d > 0 ? 0.5 : 2.64, mul(pal.leaf2, 0.9), 12, 1, 1, 0.4, 0.3, 0.2, d * 0.04);
    glow(p, bx, L + 0.06, 0.17 + r() * 0.07, g, 1, 0.25); for (const d of [-1, 1]) B(p, bx + d * 0.1, L - 0.02, 0.3, 0.1, Math.PI / 2 - d * 0.5, mul(pal.bark, 1.3), 12, 1, 1, 0.5, 0.25); lit(p, bx, L, g, 0.42);
  } else if (t === 'fungi') { const n = 2 + Math.floor(r() * 4); p.H = 0.6; p.flex = 0.05; p.hw = 0.35;
    for (let i = 0; i < n; i++) { const fx = (i - (n - 1) / 2) * 0.22 + (r() - 0.5) * 0.1, L = 0.14 + r() * 0.5, cw = 0.2 + r() * 0.26, tx = fx + (r() - 0.5) * 0.1; S(p, fx, -0.03, tx, L, 0.06, mix(pal.cap, g, 0.12), 0.4, (r() - 0.5) * 0.06);
      B(p, tx, L - 0.03, cw * 1.25, 0.07, 0, mul(g, 1.9), 1, 0.9, 2); B(p, tx, L - 0.01, cw, cw * 0.95, 0, mix(pal.cap, g, 0.08), 8, 1, 1, 0.8); if (r() < 0.5) B(p, tx - cw * 0.15, L + cw * 0.2, 0.04, 0.03, 0, mul(g, 1.3), 1, 0.8, 2); p.top = Math.max(p.top, L + cw * 0.5); }
    B(p, 0, 0.3, 1.4, 1.0, 0, mul(g, 0.2), 1, 0.5, 2); lit(p, 0, 0.4, g, 0.5);
  } else if (t === 'reed') { const n = 3 + Math.floor(r() * 4); p.H = 2; p.flex = 0.42; p.hw = 0.25;
    for (let i = 0; i < n; i++) { const L = (0.9 + r() * 1.5) * k, x0 = (i - n / 2) * 0.09, tx = x0 + (r() - 0.5) * 0.5; S(p, x0, -0.04, tx, L, 0.035, mul(pal.leaf2, 0.7 + r() * 0.5), 0.6, (r() - 0.5) * 0.3, 0.4, 1, 1, 0.3); S(p, tx, L, tx + (tx - x0) * 0.12, L + 0.16, 0.05, mul(g, 1.5), 0, 0, 0, 0.9, 2, 0.4, 0.8 + r()); p.top = Math.max(p.top, L + 0.2); }
    lit(p, 0, 1.4, g, 0.16);
  } else if (t === 'flower') { const L = (0.35 + r() * 0.6) * k, tx = (r() - 0.5) * 0.3, c = r() < 0.5 ? pal.g2 : pal.g; p.H = L; p.flex = 0.3; p.top = L + 0.2; p.hw = 0.25;
    S(p, 0, 0, tx, L, 0.03, mul(pal.leaf, 1.4), 0.3, (r() - 0.5) * 0.15); B(p, 0.12, 0.1, 0.34, 0.1, 0.4, pal.leaf2, 12, 1, 1, 0.3);
    for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283 + 0.3; B(p, tx + Math.cos(a) * 0.1, L + Math.sin(a) * 0.1, 0.2, 0.07, a, mul(c, 0.5), 12, 0.9, 2, 0, 0.3); } B(p, tx, L, 0.07, 0.07, 0, [1.6, 1.3, 1.1], 1, 1, 2, 0, 0.3, 0, 0, 1.5); B(p, tx, L, 0.7, 0.7, 0, mul(c, 0.22), 1, 0.6, 2, 0, 0.3); lit(p, tx, L, c, 0.2);
  } else if (t === 'root') { const L = (0.9 + r() * 1.7) * k, d = r() < 0.5 ? -1 : 1, hh = 0.25 + r() * 0.45; p.H = 0.6; p.flex = 0; p.hw = L * 0.4; p.top = hh;
    S(p, -L / 2, -0.12, L / 2, -0.12 + (r() - 0.5) * 0.1, 0.09 + r() * 0.07, mul(pal.bark, 0.9 + r() * 0.3), 0.35, d > 0 ? hh : hh * 0.8, 0.6); if (r() < 0.6) B(p, (r() - 0.5) * L * 0.4, hh * 0.9, 0.5 + r() * 0.4, 0.2, 0, mul(pal.leaf, 1.2), 7, 1, 1, 0.4);
    if (r() < 0.4) B(p, (r() - 0.5) * L * 0.5, hh * 0.9 + 0.08, 0.05, 0.05, 0, mul(g, 1.4), 1, 0.9, 2, 0, 0, 0, 0, 1.3);
  } else if (t === 'moss') { p.H = 0.3; p.flex = 0; p.hw = 0.4; for (let i = 0; i < 3; i++) B(p, (i - 1) * 0.3 + (r() - 0.5) * 0.1, 0.02 + r() * 0.05, 0.5 + r() * 0.35, 0.2 + r() * 0.1, 0, mul(i % 2 ? pal.leaf : pal.leaf2, 0.7 + r() * 0.6), 7, 1, 1, 0.5);
    for (let i = 0; i < 2; i++) if (r() < 0.6) B(p, (r() - 0.5) * 0.7, 0.1 + r() * 0.06, 0.04, 0.04, 0, mul(g, 1.5), 1, 0.9, 2, 0, 0, 0, 0, 0.7 + r() * 2);
  } else if (t === 'vine') { const L = (0.6 + r() * 2.8) * (0.5 + lush * 0.6); p.H = L; p.flex = 0.34; p.hw = 0.3; vine(p, r, 0, 0.05, L, pal, true); lit(p, 0, -L * 0.7, pal.g, 0.13); }
  else if (t === 'threads') { const n = 4 + Math.floor(r() * 6); p.H = 1.4; p.flex = 0.3; p.hw = 0.4; for (let i = 0; i < n; i++) thread(p, r, (i - n / 2) * 0.11 + (r() - 0.5) * 0.05, 0.03, 0.2 + r() * 1.3, g, 0.8); lit(p, 0, -0.6, g, 0.2); }
  else if (t === 'pod') { p.H = 0.8; p.flex = 0.16; p.hw = 0.35; S(p, 0, 0.04, 0, -0.26, 0.045, mul(pal.leaf, 1.2)); glow(p, 0, -0.5, 0.22, C.violet, 0.9, 0.3); for (const d of [-1, 1]) B(p, d * 0.12, -0.36, 0.42, 0.13, -Math.PI / 2 + d * 0.38, mul(pal.bark, 1.2), 12, 1, 1, 0.5, 0.3); lit(p, 0, -0.5, C.violet, 0.5); }
  else if (t === 'shelf') { const d = p.side || 1, n = 2 + Math.floor(r() * 3); p.H = 1; p.flex = 0; p.hw = 0.35; for (let i = 0; i < n; i++) { const yy = i * 0.3, w = 0.36 + r() * 0.42; B(p, d * w * 0.3, yy - 0.035, w * 1.15, 0.08, 0, mul(g, 1.4), 1, 0.8, 2); B(p, d * w * 0.3, yy, w, 0.28, 0, mix(pal.bark, g, 0.14), 8, 1, 1, 0.7); } lit(p, d * 0.3, 0.3, g, 0.24); }
}
export const TREES = [capTree, lanternTree, weeperTree];
// build one plant. opts: { anchor: -1 for a plant that hangs, side }
export function genPlant(type, bi, r, lush, opts) {
  const p = { type, bi, prims: [], lights: [], H: 1, flex: 0.3, hw: 0.3, top: 0, anchor: 1, hp: 1, yieldK: 1 }, pal = PAL[bi]; if (opts) Object.assign(p, opts);
  if (type === 'tree') TREES[bi](p, r, lush, pal); else small(p, r, lush, pal);
  const H = Math.max(1, p.H), an = p.anchor, sw = y => { const t = Math.max(0, y * an) / H; return t * Math.sqrt(t) * p.flex; };
  for (const q of p.prims) { q[12] = sw(q[2]); q[13] = q[0] === 0 ? sw(q[4]) : q[12]; }
  if (an < 0) p.top = 0;
  return p;
}
// draw a plant with its root at (ox, oy) in the batch's units, scaled by sc. bend = the wind's displacement factor.
// tint = null in the play plane (lit by the light map), or { k, fog: [r, g, b], f, e, lod } for a parallax layer:
// albedo * k mixed toward the fog colour by f, emitters scaled by e, primitives under lod units skipped.
// fall = angle of a felled tree around its root.
export function drawPlant(b, p, ox, oy, sc, bend, time, ph, tint, fall = 0) {
  const P = p.prims, fl = Math.sin(time * 5.3 + ph) * 0.5 + Math.sin(time * 8.9 + ph * 1.7) * 0.5, gust = 0.25 + Math.min(1.6, Math.abs(bend)) * 0.75, pulse = 0.85 + 0.15 * Math.sin(time * 0.9 + ph);
  let ca = 1, sa = 0; if (fall) { ca = Math.cos(fall); sa = Math.sin(fall); }
  const lod = tint ? tint.lod / sc : 0, col = [0, 0, 0];
  for (let i = 0; i < P.length; i++) {
    const q = P[i], f18 = q[18], fx = f18 ? f18 * fl * 0.035 * gust * (1 + (i % 3) * 0.4) : 0; let mode = q[11], a = q[9];
    if (tint) {
      if (q[0] === 0 ? (q[5] < lod && Math.abs(q[3] - q[1]) + Math.abs(q[4] - q[2]) < lod * 6) : (q[3] < lod * 1.5 && q[4] < lod * 1.5)) continue;
      if (mode === 2) { const e = tint.e; col[0] = q[6] * e; col[1] = q[7] * e; col[2] = q[8] * e; }
      else { const k = tint.k * (1 - tint.f), f = tint.f, fg = tint.fog; col[0] = q[6] * k + fg[0] * f; col[1] = q[7] * k + fg[1] * f; col[2] = q[8] * k + fg[2] * f; mode = 0; }
    } else { col[0] = q[6]; col[1] = q[7]; col[2] = q[8]; }
    if (mode === 2) a *= q[17] ? 0.55 + 0.45 * Math.sin(time * q[17] * 1.3 + ph + i * 1.7) : pulse;
    let x1 = q[1] + q[12] * bend + fx, y1 = q[2] - Math.abs(q[12] * bend) * 0.18;
    if (fall) { const dx = x1, dy = y1; x1 = dx * ca + dy * sa; y1 = -dx * sa + dy * ca; }
    if (q[0] === 0) {
      let x2 = q[3] + q[13] * bend + fx * 1.6, y2 = q[4] - Math.abs(q[13] * bend) * 0.18; if (fall) { const dx = x2, dy = y2; x2 = dx * ca + dy * sa; y2 = -dx * sa + dy * ca; }
      b.seg(ox + x1 * sc, oy + y1 * sc, ox + x2 * sc, oy + y2 * sc, q[5] * sc, col, a, q[10], mode, i + ph, q[14], q[15] * sc, q[16]);
    } else b.add(ox + x1 * sc, oy + y1 * sc, q[3] * sc, q[4] * sc, q[5] - fall + (f18 ? fl * 0.05 * f18 * gust : 0) - q[12] * bend * 0.25, col, a, q[10], mode, i + ph, q[14], q[15] * sc, q[16]);
  }
}

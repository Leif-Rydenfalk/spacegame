// the living world: layered alien forest generated per chunk from the seed and anchored to whatever ground is there.
// Giant bioluminescent trees with swaying canopies and roots into the terrain, lantern stalks, weeping vine trees,
// fronds, grass, fungal shelves, cave fungi, hanging vines and pods, and drifting spores. Everything is drawn through
// the instanced sprite batch, throws light into the light field, and can be cut for organic material.
import { hash, rng, rand, noise2 } from '../core.js';
import { world, CELL, CH, TS, M } from './world.js';
import { biome, lushness } from './gen.js';
import { light } from './light.js';
import { S, C, mul, mix } from './state.js';
const blocks = new Map(); let active = [];
export const flora = { dead: new Set(), count: 0, gains: null, clear: null };       // clear = [x0, x1]: a scenario's building site, kept free of trees
const GLOW = [C.cyan, C.violet, C.acid], BARK = [[0.03, 0.045, 0.05], [0.045, 0.03, 0.055], [0.04, 0.045, 0.025]], LEAF = [[0.02, 0.07, 0.065], [0.05, 0.025, 0.08], [0.035, 0.07, 0.02]];
const YIELD = { tree: { biomass: 30, fibre: 6, resin: 2 }, frond: { biomass: 1.6, fibre: 0.8 }, bulb: { biomass: 0.6, lumen: 0.15 }, grass: { fibre: 0.12 }, fungi: { biomass: 0.9 }, vine: { fibre: 0.5 }, pod: { resin: 0.6, biomass: 0.4 }, shelf: { biomass: 0.5 } };
// a plant: prims = flat rows [kind(0 seg,1 blob), x1, y1, x2|w, y2|h, w|rot, r, g, b, a, shape, mode, sway1, sway2]
function plant(id, type, x, y, bi, front) { return { id, type, x, y, bi, front, prims: [], lights: [], hp: 1, top: y, hw: 0.3, ph: hash(Math.floor(x * 7), Math.floor(y * 7), 91) * 6.28, fall: 0, anchor: 1 }; }
const seg = (p, x1, y1, x2, y2, w, c, a = 1, mode = 1, shape = 2) => { const H = Math.max(1, p.H || 1); p.prims.push([0, x1, y1, x2, y2, w, c[0], c[1], c[2], a, shape, mode, sw(p, y1, H), sw(p, y2, H)]); };
const blob = (p, x, y, w, h, rot, c, a = 1, mode = 1, shape = 7) => { const H = Math.max(1, p.H || 1), s = sw(p, y, H); p.prims.push([1, x, y, w, h, rot, c[0], c[1], c[2], a, shape, mode, s, s]); };
const sw = (p, y, H) => { const t = Math.max(0, (y - p.y) * p.anchor) / H; return t * Math.sqrt(t) * (p.flex || 0.3); };
const lit = (p, x, y, c, k) => p.lights.push(x, y, c[0] * k, c[1] * k, c[2] * k);

function tree(p, r, lush) {
  const bi = p.bi, g = GLOW[bi], bark = BARK[bi], leaf = LEAF[bi], H = p.H = (bi === 1 ? 6 : 7) + r() * (bi === 0 ? 9 : 7) * (0.6 + lush * 0.5), w0 = 0.3 + H * 0.028;
  p.flex = 0.25 + H * 0.03; p.hp = 3 + H * 0.5; p.hw = w0 * 0.9; p.yieldK = H / 10;
  for (let i = 0; i < 4; i++) { const d = (i % 2 ? 1 : -1) * (0.5 + r() * 1.2), dy = -(0.6 + r() * 1.5); seg(p, p.x + d * 0.15, p.y + 0.25, p.x + d * 0.7, p.y + dy * 0.4, w0 * 0.55, bark); seg(p, p.x + d * 0.7, p.y + dy * 0.4, p.x + d * 1.3, p.y + dy, w0 * 0.25, mul(bark, 0.8)); }
  const stems = bi === 1 ? 2 + Math.floor(r() * 2) : 1;
  for (let s = 0; s < stems; s++) {
    let x = p.x + (s - (stems - 1) / 2) * 0.25, y = p.y - 0.1, bend = (r() - 0.5) * 0.4 + (s - (stems - 1) / 2) * 0.3; const n = 6, hs = H * (stems > 1 ? 0.7 + r() * 0.3 : 1), tips = [];
    for (let i = 0; i < n; i++) {
      const t = i / n, nx = x + bend * hs / n + Math.sin(t * 5 + p.ph) * 0.14, ny = y + hs / n, w = w0 * (1 - t * 0.68) / (stems > 1 ? 1.5 : 1);
      seg(p, x, y, nx, ny, w, mul(bark, 1 - 0.25 * (i % 2)));
      if (i % 2 === 1 && r() < 0.8) seg(p, x + w * 0.2, y + 0.1, x + w * 0.2, y + 0.5 + r() * 0.7, 0.035, mul(g, 0.5), 0.8, 2);                  // sap veins
      if (bi !== 1 && i >= 2 && i < n - 1 && r() < 0.75) { const d = r() < 0.5 ? -1 : 1, bl = 1 + r() * (bi === 2 ? 3 : 1.8), bx = nx + d * bl, by = ny + bl * (bi === 2 ? 0.25 : 0.5); seg(p, nx, ny, bx, by, w * 0.45, bark); tips.push([bx, by, 0.55 + r() * 0.3]); }
      if (i > 0 && i < n - 1 && r() < 0.35) { const d = r() < 0.5 ? -1 : 1; blob(p, x + d * w * 0.8, y + 0.2, 0.5 + r() * 0.3, 0.3, 0, mix(bark, g, 0.12), 1, 1, 8); blob(p, x + d * w * 0.8, y + 0.16, 0.5, 0.12, 0, g, 0.5, 2, 1); }
      x = nx; y = ny;
    }
    tips.push([x, y, 1]); p.top = Math.max(p.top, y);
    for (const [tx, ty, k] of tips) {
      if (bi === 0) {            // broad cap with a lit underside and hanging threads
        const cw = (2.6 + r() * 2.6) * k * (0.7 + lush * 0.4), chh = cw * 0.32;
        blob(p, tx, ty - 0.05, cw * 0.9, chh * 0.5, 0, mul(g, 0.9), 0.55, 2, 1); blob(p, tx, ty, cw, chh * 2, 0, mix(leaf, bark, 0.3), 1, 1, 8); blob(p, tx - cw * 0.12, ty + chh * 0.55, cw * 0.5, chh * 0.6, 0, mul(leaf, 1.6), 0.8, 1, 7);
        for (let j = 0; j < 5 * k; j++) { const vx = tx + (r() - 0.5) * cw * 0.85, vl = 0.3 + r() * 1.5; seg(p, vx, ty, vx + (r() - 0.5) * 0.1, ty - vl, 0.03, mul(g, 0.35), 0.9, 2); blob(p, vx, ty - vl, 0.09, 0.09, 0, mul(g, 2.2), 1, 2, 1); }
        lit(p, tx, ty - 0.5, g, 0.5 * k + 0.2);
      } else if (bi === 1) {     // lantern bulbs in a husk, drooping fronds below
        const bs = 0.5 + r() * 0.5;
        for (let j = 0; j < 5; j++) { const a = -0.3 - j * 0.55 + r() * 0.3, fl = 1 + r() * 1.4; seg(p, tx, ty - 0.2, tx + Math.cos(a) * fl * (j % 2 ? 1 : -1), ty - 0.2 + Math.sin(a) * fl, 0.07, leaf); }
        blob(p, tx, ty + bs * 0.4, bs * 2.6, bs * 2.6, 0, mul(g, 0.5), 0.6, 2, 1); blob(p, tx, ty + bs * 0.4, bs, bs * 1.25, 0, mul(g, 1.4), 0.95, 2, 2); blob(p, tx, ty + bs * 0.5, bs * 0.4, bs * 0.5, 0, [1.4, 0.9, 3], 1, 2, 1); blob(p, tx, ty + bs * 0.05, bs * 1.1, bs * 0.5, 0, bark, 1, 1, 8);
        lit(p, tx, ty + bs * 0.4, g, 0.75);
      } else {                   // weeping crown: leaf masses and curtains of beaded vines
        const cw = (1.8 + r() * 1.6) * k;
        for (let j = 0; j < 3; j++) blob(p, tx + (r() - 0.5) * cw, ty + (r() - 0.3) * 0.7, cw * (0.6 + r() * 0.5), cw * 0.42, (r() - 0.5) * 0.5, mul(leaf, 0.8 + r() * 0.7), 1, 1, 7);
        for (let j = 0; j < 7 * k; j++) { const vx = tx + (r() - 0.5) * cw * 1.2, vl = 1 + r() * (2.5 + lush * 2); let yy = ty - 0.1; for (let q = 0; q < 3; q++) { seg(p, vx + Math.sin(q + j) * 0.05, yy, vx + Math.sin(q + 1 + j) * 0.05, yy - vl / 3, 0.035, mul(leaf, 1.3), 1, 1); yy -= vl / 3; } blob(p, vx, yy, 0.1, 0.1, 0, mul(g, 1.8), 1, 2, 1); }
        lit(p, tx, ty - 1, g, 0.3 * k + 0.1);
      }
    }
  }
}
function small(p, r, lush) {
  const bi = p.bi, g = GLOW[bi], leaf = LEAF[bi], t = p.type, up = p.anchor;
  if (t === 'frond') { const n = 5 + Math.floor(r() * 5), L = (0.7 + r() * 1.3) * (0.7 + lush * 0.5); p.H = L; p.flex = 0.25; p.top = p.y + L; for (let i = 0; i < n; i++) { const a = (i / (n - 1) - 0.5) * 2.2, mx = p.x + Math.sin(a) * L * 0.45, my = p.y + Math.cos(a) * L * 0.6, ex = p.x + Math.sin(a) * L * 0.95, ey = p.y + Math.cos(a) * L * 0.72 - Math.abs(Math.sin(a)) * L * 0.25, c = mul(leaf, 0.9 + (i % 3) * 0.35); seg(p, p.x, p.y, mx, my, 0.07, c); seg(p, mx, my, ex, ey, 0.045, c); if (i % 2 === 0) blob(p, ex, ey, 0.06, 0.06, 0, mul(g, 1.5), 0.9, 2, 1); } lit(p, p.x, p.y + L * 0.6, g, 0.12); }
  else if (t === 'bulb') { const L = 0.5 + r() * 1.1; p.H = L; p.flex = 0.2; p.top = p.y + L; const bx = p.x + (r() - 0.5) * 0.3; seg(p, p.x, p.y, bx, p.y + L, 0.05, mul(leaf, 1.2)); blob(p, bx, p.y + L, 0.85, 0.85, 0, mul(g, 0.45), 0.6, 2, 1); blob(p, bx, p.y + L, 0.24, 0.3, 0, mul(g, 1.8), 1, 2, 2); seg(p, p.x, p.y, p.x + 0.3, p.y + 0.25, 0.05, leaf); seg(p, p.x, p.y, p.x - 0.28, p.y + 0.2, 0.05, leaf); lit(p, bx, p.y + L, g, 0.45); }
  else if (t === 'grass') { const n = 3 + Math.floor(r() * 4); p.H = 0.5; p.flex = 0.12; for (let i = 0; i < n; i++) { const L = 0.15 + r() * 0.42 * (0.6 + lush * 0.6), a = (r() - 0.5) * 1.1; seg(p, p.x + (i - n / 2) * 0.05, p.y - 0.03, p.x + (i - n / 2) * 0.05 + Math.sin(a) * L, p.y + Math.cos(a) * L, 0.028, mul(leaf, 1 + r())); } if (r() < 0.25) blob(p, p.x, p.y + 0.3, 0.05, 0.05, 0, mul(g, 1.6), 0.9, 2, 1); }
  else if (t === 'fungi') { const n = 2 + Math.floor(r() * 3); p.H = 0.6; p.flex = 0.05; for (let i = 0; i < n; i++) { const fx = p.x + (i - (n - 1) / 2) * 0.24 + (r() - 0.5) * 0.1, L = 0.18 + r() * 0.45, cw = 0.2 + r() * 0.22; seg(p, fx, p.y - 0.02, fx + (r() - 0.5) * 0.06, p.y + L, 0.045, mul(g, 0.14)); blob(p, fx, p.y + L - 0.02, cw * 1.3, 0.07, 0, mul(g, 1.9), 0.9, 2, 1); blob(p, fx, p.y + L, cw, cw * 0.9, 0, mix(leaf, g, 0.1), 1, 1, 8); } blob(p, p.x, p.y + 0.3, 1.3, 0.9, 0, mul(g, 0.25), 0.5, 2, 1); lit(p, p.x, p.y + 0.4, g, 0.5); }
  else if (t === 'vine') { const L = 0.6 + r() * 2.6 * (0.5 + lush * 0.6), n = Math.max(2, Math.ceil(L / 0.5)); p.H = L; p.flex = 0.3; let x = p.x, y = p.y + 0.04; for (let i = 0; i < n; i++) { const nx = p.x + Math.sin(i * 1.3 + p.ph) * 0.09, ny = y - L / n; seg(p, x, y, nx, ny, 0.04, mul(leaf, 1.2)); if (i % 2) blob(p, nx, ny, 0.09, 0.09, 0, mul(g, 1.5), 0.95, 2, 1); x = nx; y = ny; } p.top = p.y; lit(p, p.x, p.y - L * 0.7, g, 0.14); }
  else if (t === 'pod') { p.H = 0.8; p.flex = 0.15; seg(p, p.x, p.y + 0.03, p.x, p.y - 0.25, 0.04, leaf); blob(p, p.x, p.y - 0.5, 1.2, 1.2, 0, mul(C.violet, 0.4), 0.6, 2, 1); blob(p, p.x, p.y - 0.5, 0.36, 0.5, 0, mul(C.violet, 0.9), 0.95, 2, 2); blob(p, p.x, p.y - 0.52, 0.14, 0.2, 0, [1.4, 0.9, 3], 1, 2, 1); lit(p, p.x, p.y - 0.5, C.violet, 0.5); }
  else if (t === 'shelf') { const d = p.side || 1, n = 2 + Math.floor(r() * 3); p.H = 1; p.flex = 0; for (let i = 0; i < n; i++) { const yy = p.y + i * 0.3, w = 0.35 + r() * 0.4; blob(p, p.x + d * w * 0.3, yy - 0.03, w * 1.2, 0.08, 0, mul(g, 1.4), 0.8, 2, 1); blob(p, p.x + d * w * 0.3, yy, w, 0.26, 0, mix(BARK[bi], g, 0.14), 1, 1, 8); } lit(p, p.x + d * 0.3, p.y + 0.3, g, 0.25); }
  p.hw = t === 'grass' ? 0.2 : 0.35;
}
const natural = k => k >= M.SOIL && k <= M.LUMEN, grows = k => natural(k) || k === M.XENO || k === M.CONCRETE;
function build(cx, cy) {
  const out = [], X0 = cx * CH * CELL, Y0 = cy * CH * CELL, sI = cx * CH, sJ = cy * CH;
  for (let c = 0; c < 32; c++) {
    const i = sI + c * 2 + 1, x = i * CELL, lush = lushness(x), bi = biome(x); let prev = world.sample(i, sJ + CH) >= 128;
    for (let j = CH - 1; j >= 0; j--) {
      const iy = sJ + j, sol = world.sample(i, iy) >= 128;
      if (sol !== prev) {
        const y = sol ? (iy + 1) * CELL - 0.06 : (iy + 0.6) * CELL, k = world.sampleM(i, iy + (sol ? 0 : 1)) & 127, cave = (world.sampleM(i, iy + (sol ? 2 : -2)) & 128) !== 0, h1 = hash(i, iy, 80), h2 = hash(i, iy, 81), id = i + ',' + iy;
        if (grows(k) && !flora.dead.has(id) && lush > 0.02) {
          const dens = natural(k) ? lush : lush * 0.45; let type = null, front = h2 < 0.3;
          if (sol && !cave) { type = c % 8 === Math.floor(hash(cx, cy, 82) * 8) % 8 && natural(k) && h1 < 0.3 + dens * 0.45 ? 'tree' : h1 < 0.1 * dens ? 'bulb' : h1 < 0.3 * dens ? 'frond' : h1 < 0.3 * dens + 0.5 ? 'grass' : null; if (type === 'tree') front = h2 < 0.14; }
          else if (sol) type = h1 < 0.1 * dens ? 'fungi' : h1 < 0.14 * dens ? 'bulb' : h1 < 0.2 * dens ? 'frond' : h1 < 0.5 * dens ? 'grass' : null;
          else type = h1 < 0.22 * dens ? 'vine' : h1 < 0.26 * dens && natural(k) ? 'pod' : null;
          if (type === 'tree' && (world.dens(x, y + 2.5) > 0 || world.dens(x, y + 5) > 0)) type = 'frond';
          if (flora.clear && x > flora.clear[0] && x < flora.clear[1] && (type === 'tree' || type === 'frond' || type === 'bulb')) type = 'grass';
          if (type) { const p = plant(id, type, x + (h2 - 0.5) * 0.15, y, bi, front), r = rng(Math.floor(h1 * 1e9) ^ (i * 7919)); if (!sol) p.anchor = -1; if (type === 'tree') tree(p, r, lush); else small(p, r, lush); out.push(p); }
        }
      }
      prev = sol;
    }
  }
  return out;
}
let scanT = 0;
export function stepFlora(dt) {
  const cam = S.cam, hw = 14 / S.zoom + 8, x0 = Math.floor((cam.x - hw) / 8), x1 = Math.floor((cam.x + hw) / 8), y0 = Math.floor((cam.y - 26) / 8), y1 = Math.floor((cam.y + 11) / 8);
  active = [];
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) { const k = cx * 4096 + cy; let b = blocks.get(k); if (!b) { b = build(cx, cy); blocks.set(k, b); } for (const p of b) active.push(p); }
  if (blocks.size > 220) for (const k of blocks.keys()) { const cx = Math.round(k / 4096); if (Math.abs(cx - (x0 + x1) / 2) > 8) blocks.delete(k); if (blocks.size < 160) break; }
  flora.count = active.length;
  // falling and uprooted plants
  scanT -= dt; const scan = scanT <= 0; if (scan) scanT = 0.4;
  for (const p of active) {
    if (p.fall > 0) { p.fall += dt * (0.6 + p.fall * 1.6); if (p.fall >= 1.5) kill(p, true); continue; }
    if (scan && !p.gone && world.dens(p.x, p.y - 0.3 * p.anchor) <= 0 && world.dens(p.x, p.y - 0.12 * p.anchor) <= 0) { if (p.type === 'tree') p.fall = 0.01; else kill(p, false); }
  }
  // drifting spores
  if (active.length && Math.random() < dt * 14) { const p = active[Math.floor(Math.random() * active.length)]; if (p.lights.length && !p.gone && Math.abs(p.x - cam.x) < 16) S.parts.spawn({ x: p.lights[0] + rand(-0.6, 0.6), y: p.lights[1] + rand(-0.4, 0.4), vx: rand(-0.25, 0.25), vy: rand(0.02, 0.3), life: rand(4, 9), size: rand(0.03, 0.06), c: mul(GLOW[p.bi], 1.6), grav: -0.004, drag: 0.4 }); }
}
function kill(p, give) {
  if (p.gone) return; p.gone = true; flora.dead.add(p.id);
  const y = YIELD[p.type], k = p.yieldK || 1; if (give && y) for (const id in y) { const n = y[id] * k * (0.8 + hash(p.x * 9 | 0, 3, 84) * 0.4); S.add(id, n); if (flora.gains) flora.gains(id, n); }
  const g = GLOW[p.bi]; for (let i = 0; i < (p.type === 'tree' ? 40 : 6); i++) S.parts.spawn({ x: p.x + rand(-0.5, 0.5) + (p.type === 'tree' ? rand(-2, 2) : 0), y: p.y + rand(0, Math.max(0.3, (p.top - p.y) * (p.type === 'tree' ? 0.3 : 1))), vx: rand(-1.5, 1.5), vy: rand(0, 2.5), life: rand(1, 3.5), size: rand(0.04, 0.09), c: mul(g, 2), c2: mul(g, 0.3), col: 1, bounce: 0.1 });
}
// the laser, bullets and creatures damage plants along their spine; returns true when something was hit
export function floraHit(x, y, dmg, r = 0.3) {
  let hit = false;
  for (const p of active) {
    if (p.gone || p.fall > 0 || Math.abs(x - p.x) > 3) continue;
    const top = p.anchor > 0 ? p.top : p.y - (p.H || 0.5), y0 = Math.min(p.y, top), y1 = Math.max(p.y, top);
    if (y < y0 - r || y > y1 + r || Math.abs(x - p.x) > p.hw + r + (p.type === 'tree' ? 0.25 : 0)) continue;
    p.hp -= dmg; hit = true; p.shake = 0.3; if (p.hp <= 0) { if (p.type === 'tree') { p.fall = 0.01; p.dir = x < p.x ? 1 : -1; } else kill(p, true); }
  }
  return hit;
}
export function drawFlora(b, time, front) {
  const cam = S.cam, hw = 14 / S.zoom + 9, gust = 0.6 + 0.8 * noise2(time * 0.13, cam.x * 0.02, 5);
  for (const p of active) {
    if (p.gone || p.front !== front || Math.abs(p.x - cam.x) > hw) continue;
    const s = Math.sin(time * 1.1 + p.ph + p.x * 0.21) * gust + Math.sin(time * 2.7 + p.ph * 2) * 0.25 + (p.shake > 0 ? Math.sin(time * 40) * p.shake : 0), P = p.prims; if (p.shake > 0) p.shake -= 0.016;
    let ca = 1, sa = 0; if (p.fall > 0) { const a = Math.min(1.5, p.fall) * (p.dir || 1); ca = Math.cos(a); sa = Math.sin(a); }
    for (let i = 0; i < P.length; i++) {
      const q = P[i]; let x1 = q[1] + q[12] * s, y1 = q[2], col = [q[6], q[7], q[8]];
      if (p.fall > 0) { const dx = x1 - p.x, dy = y1 - p.y; x1 = p.x + dx * ca + dy * sa; y1 = p.y - dx * sa + dy * ca; }
      if (q[0] === 0) { let x2 = q[3] + q[13] * s, y2 = q[4]; if (p.fall > 0) { const dx = x2 - p.x, dy = y2 - p.y; x2 = p.x + dx * ca + dy * sa; y2 = p.y - dx * sa + dy * ca; } b.seg(x1, y1, x2, y2, q[5], col, q[9], q[10], q[11], i); }
      else b.add(x1, y1, q[3], q[4], q[5] + (p.fall > 0 ? -Math.min(1.5, p.fall) * (p.dir || 1) : 0), col, q[9] * (q[11] === 2 ? 0.8 + 0.2 * Math.sin(time * 0.9 + p.ph) : 1), q[10], q[11], i + p.ph);
    }
    if (!front || p.type !== 'grass') { const L = p.lights, k = p.fall > 0 ? 0.3 : 0.85 + 0.15 * Math.sin(time * 0.9 + p.ph); for (let i = 0; i < L.length; i += 5) light.emit(L[i] / TS, L[i + 1] / TS, L[i + 2] * k, L[i + 3] * k, L[i + 4] * k); }
  }
}
export function resetFlora() { blocks.clear(); active = []; }

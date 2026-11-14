// mining mechanics (round 6 B0, docs/MINING.md 1-8 and R3): joints and fragments, kerfs that free blocks, openings
// that are checked for their span, supports that are planned by themselves, and roofs that come down.
//   rock      what is freed from the ground leaves it as real bodies. It breaks along the joints first: the freed
//             region is cut by the joint planes of its rock (basalt columns 0.35-0.9 m apart, obsidian shards) and
//             every piece is a body with exactly the mass of the samples it was. Rock from a place nobody has scanned
//             is "rubble" and carries its true composition hidden; scanned rock comes out as what it is (geology.js).
//   kerf      the laser in kerf mode cuts a slot two centimetres wide along its ray, a few centimetres a pulse
//             (physics.js). The slot is too thin for the density field, so it is kept as cut links between samples.
//             When slots and open faces close a loop, the rock inside is no longer held: it is freed as blocks.
//   spans     every opening somebody dug is watched. Its unsupported span against the safe span of its rock (strength,
//             joints, and the overburden on it) is the stability factor. Under the safe factor the AI plans supports
//             (bolts for a little over, steel sets for more): ghosts that jump the queue. Over the limit the roof
//             warns (dust, cracking), and after a time that shrinks with how far over it is, it falls as bodies.
import { G, events, noise2, clamp, rand } from '../core.js';
import { audio } from '../audio.js';
import { inv } from '../items.js';
import { world, CELL, SLAB, TS, M, MAT, cov, surfaceH } from './world.js';
import { S, C, mul } from './state.js';
import { env } from './env.js';
import { matter } from './matter.js';
import { light } from './light.js';
import { composition, sortOut, levelAt } from './geology.js';
import { kerfPerPulse } from './physics.js';

const KG = CELL * CELL * SLAB, KERF_MAX = 3.2, MAXN = 1500;
export const MINE = { kerfs: [], cuts: new Set(), cur: null, spans: new Map(), supports: [], watch: [], tick: 0, warn: null, collapses: 0, freed: 0, addGhost: null, pending: () => false, auto: true };
const HARD = { [M.BASALT]: 1, [M.OBSIDIAN]: 1, [M.IRON]: 1, [M.COPPER]: 1, [M.LUMEN]: 1 };
// what kg of material mat cut out at (x, y) is: [[item, amount, q]]. Hard rock from unscanned ground is rubble.
export function rockLumps(mat, kg, x, y) {
  const q = composition(mat, x, y);
  if (HARD[mat] && levelAt(x, y) < 1) return [['rubble', kg, { ...q, ox: +x.toFixed(1), oy: +y.toFixed(1) }]];
  if (mat === M.CONCRETE) return [['basalt', kg, null]];
  if (mat === M.SOIL) return [['soil', kg, null]];
  return sortOut(q, kg).map(([id, n]) => [id, n, null]);
}
export function spawnRock(mat, kg, x, y, vx = 0, vy = 0, temp = 0) { const out = []; for (const [id, n, q] of rockLumps(mat, kg, x, y)) { if (q) inv.nextQ = q; const c = matter.spawn(id, n, x, y, vx, vy, temp); if (c) out.push(c); } return out; }
// the joint spacing of a rock (m): what size it breaks into
export function jointSpacing(mat, x, y) { const n = noise2(x / 5, y / 5, 631); return mat === M.OBSIDIAN ? 0.2 + 0.1 * n : mat === M.SOIL ? 0.3 : mat === M.IRON ? 0.45 + 0.2 * n : 0.35 + 0.55 * n; }
const sk = (i, j) => (i + 32768) * 65536 + (j + 32768), lk = (i, j, d) => sk(i, j) * 2 + d;
// free a set of samples [[i, j]]: they leave the field and come back as bodies, split along the joints. Returns kg.
export function freeRegion(cells, vx = 0, vy = 0, temp = 0) {
  const groups = new Map(), set = new Set(); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, total = 0;
  for (const [i, j] of cells) {
    const b = world.sample(i, j), mm = world.sampleM(i, j) & 127; if (b <= 112 || mm >= M.XENO && mm !== M.CONCRETE && mm !== M.STEEL) continue; const kg = cov(b) * KG * MAT[mm].rho, x = i * CELL, y = j * CELL, js = jointSpacing(mm, x, y), key = mm + ':' + Math.floor(x / js + 0.37) + ':' + Math.floor(y / (js * 1.3));
    let g = groups.get(key); if (!g) groups.set(key, g = { mat: mm, kg: 0, sx: 0, sy: 0 }); g.kg += kg; g.sx += x * kg; g.sy += y * kg; total += kg; set.add(sk(i, j)); MINE.cuts.delete(lk(i, j, 0)); MINE.cuts.delete(lk(i, j, 1)); MINE.cuts.delete(lk(i - 1, j, 0)); MINE.cuts.delete(lk(i, j - 1, 1));
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (!set.size) return 0;
  world.shape(x0, y0, x1, y1, (x, y) => set.has(sk(Math.round(x / CELL), Math.round(y / CELL))) ? -0.5 : 0.5, -1);
  for (const g of groups.values()) if (g.kg > 1e-6) spawnRock(g.mat, g.kg, g.sx / g.kg, g.sy / g.kg, vx + rand(-0.3, 0.3), vy, temp);
  MINE.freed += total; return total;
}
const segX = (ax, ay, bx, by, cx, cy, dx, dy) => { const d = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx); if (Math.abs(d) < 1e-12) return false; const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / d, u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / d; return t >= 0 && t <= 1 && u >= 0 && u <= 1; };
// mark every sample link a slot from (x0, y0) to (x1, y1) crosses
export function cutLinks(x0, y0, x1, y1) {
  const i0 = Math.floor(Math.min(x0, x1) / CELL) - 1, i1 = Math.ceil(Math.max(x0, x1) / CELL) + 1, j0 = Math.floor(Math.min(y0, y1) / CELL) - 1, j1 = Math.ceil(Math.max(y0, y1) / CELL) + 1;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const x = i * CELL, y = j * CELL; if (segX(x0, y0, x1, y1, x, y, x + CELL, y)) MINE.cuts.add(lk(i, j, 0)); if (segX(x0, y0, x1, y1, x, y, x, y + CELL)) MINE.cuts.add(lk(i, j, 1)); }
}
const solid = (i, j) => world.sample(i, j) > 128;
// the rock connected to sample (i, j) through links that are not cut: its samples, or null when it is the world
function flood(i, j) {
  const seen = new Set([sk(i, j)]), out = [[i, j]];
  for (let q = 0; q < out.length; q++) {
    if (out.length > MAXN) return null; const [a, b] = out[q];
    for (const [c, d, key] of [[a + 1, b, lk(a, b, 0)], [a - 1, b, lk(a - 1, b, 0)], [a, b + 1, lk(a, b, 1)], [a, b - 1, lk(a, b - 1, 1)]]) { if (MINE.cuts.has(key) || seen.has(sk(c, d)) || !solid(c, d)) continue; seen.add(sk(c, d)); out.push([c, d]); }
  }
  return out;
}
// is anything held only by the slot k? Then it falls out. Returns kg freed.
export function tryFree(k) {
  const nx = -k.dy, ny = k.dx, tried = new Set(); let kg = 0;
  for (let t = 0; t <= k.len; t += CELL) for (const sd of [-1, 1]) {
    const i = Math.round((k.x0 + k.dx * t + nx * sd * CELL * 0.75) / CELL), j = Math.round((k.y0 + k.dy * t + ny * sd * CELL * 0.75) / CELL), key = sk(i, j); if (tried.has(key) || !solid(i, j)) continue;
    const reg = flood(i, j); if (!reg) { for (let u = 0; u <= k.len; u += CELL) tried.add(sk(Math.round((k.x0 + k.dx * u + nx * sd * CELL * 0.75) / CELL), Math.round((k.y0 + k.dy * u + ny * sd * CELL * 0.75) / CELL))); continue; }       // this side is the world: no need to ask again along it
    for (const [a, b] of reg) tried.add(sk(a, b)); kg += freeRegion(reg, nx * sd * 0.4, 0.2, 0.25);
  }
  if (kg > 0) { events.emit('blockFreed', { kg, x: k.x0, y: k.y0 }); audio.play('thud'); env.noise(k.x0, k.y0, 16); G.shake += Math.min(0.12, kg * 0.002); }
  return kg;
}
// one pulse in kerf mode, entering the rock at (ex, ey) along (dx, dy). Returns { adv m, freed kg }.
export function kerfPulse(ex, ey, dx, dy, mat, frac = 1) {
  const adv = kerfPerPulse(mat, frac); let k = MINE.cur;
  // the same slot goes on while the beam still enters by its mouth: within a hand's width of its line, within a few degrees
  const off = k ? Math.abs((ex - k.x0) * k.dy - (ey - k.y0) * k.dx) : 9, along = k ? (ex - k.x0) * k.dx + (ey - k.y0) * k.dy : 9;
  if (!k || off > 0.13 || Math.abs(along) > 0.35 || Math.abs(k.dx * dy - k.dy * dx) > 0.1 || k.dx * dx + k.dy * dy < 0) { k = MINE.cur = { x0: ex, y0: ey, dx, dy, len: 0, t: G.time }; MINE.kerfs.push(k); if (MINE.kerfs.length > 240) MINE.kerfs.shift(); }
  if (k.len >= KERF_MAX) { k.t = G.time; return { adv: 0, freed: 0, k, max: true }; }       // as deep as the beam stays focused: this slot goes no further
  const a = Math.max(0, k.len - 0.02); k.len = Math.min(KERF_MAX, k.len + adv); k.t = G.time;
  cutLinks(k.x0 + k.dx * a, k.y0 + k.dy * a, k.x0 + k.dx * k.len, k.y0 + k.dy * k.len);
  return { adv, freed: tryFree(k), k };
}
// ---- openings, supports, collapse -----------------------------------------------------------------------------------------
export const SUPPORT = { 'steel set': 1, 'rock bolt': 1 };
const SAFE0 = { [M.SOIL]: 1.3, [M.BASALT]: 4.0, [M.OBSIDIAN]: 4.6, [M.IRON]: 3.6, [M.COPPER]: 3.4, [M.LUMEN]: 3.0, [M.HIVE]: 2.2, [M.PLATE]: 9, [M.CONCRETE]: 8, [M.STEEL]: 14, [M.XENO]: 30 };
// pure: the span (m) this rock holds unsupported under this much overburden; bolts raise it by half
export const safeSpan = (mat, depth, bolted) => (SAFE0[mat] || 4) * (bolted ? 1.5 : 1) / (1 + Math.max(0, depth) / 60);
// pure: seconds an opening this far over its limit stands before it falls
export const collapseTime = (span, safe) => clamp(90 * Math.pow(safe / span, 4), 4, 90);
// pure: the supports a span needs: [] when it is inside the safe factor (1.25), a bolt when it is a little over, sets when more
export function planSupports(span, safe, soft) {
  if (span <= safe * 0.8) return []; if (!soft && span <= safe * 1.5 * 0.8) return [{ kind: 'rock bolt', at: 0.5 }];
  const n = Math.max(1, Math.ceil(span / (safe * 0.7)) - 1), out = []; for (let i = 1; i <= n; i++) out.push({ kind: 'steel set', at: i / (n + 1) }); return out;
}
const setAt = (x, y) => MINE.supports.some(s => s.kind === 'steel set' && Math.abs(s.x - x) < 0.2 && y >= s.y0 - 0.3 && y <= s.y1 + 0.5);
export function addSupport(kind, x, y0, y1) { const s = { kind, x: +x.toFixed(2), y0: +y0.toFixed(2), y1: +y1.toFixed(2) }; MINE.supports.push(s); events.emit('supportBuilt', kind); return s; }
// the opening over the air point (x, y): its roof, its unsupported span, the rock that spans it. Null under open sky.
export function spanAt(x, y) {
  let yr = null; for (let d = 0; d < 7; d += CELL) if (world.dens(x, y + d) > 0) { yr = y + d; break; } if (yr === null) return null;
  // the overburden: the rock that really lies on the roof (a mound has less on it than the map's surface says, a drift more)
  let depth = 0; while (depth < 40 && world.dens(x, yr + 0.1 + depth) > 0) depth += depth < 3 ? 0.25 : 2; const ys = yr - 0.22; if (world.dens(x, ys) > 0) return null;
  let xl = x, xr = x; while (x - xl < 12 && world.dens(xl - CELL, ys) < 0 && !setAt(xl - CELL, ys)) xl -= CELL; while (xr - x < 12 && world.dens(xr + CELL, ys) < 0 && !setAt(xr + CELL, ys)) xr += CELL;
  // an opening that reaches the open sky at one end is a cut bank, not a roof: its span is what hangs over
  const mat = world.matAt(x, yr + 0.2), bolted = MINE.supports.some(s => s.kind === 'rock bolt' && s.x > xl - 0.3 && s.x < xr + 0.3 && Math.abs(s.y1 - yr) < 1.3), fl = world.groundY((xl + xr) / 2, ys, 0, 6);
  return { xl, xr, yr, span: xr - xl + CELL, mat, depth, safe: safeSpan(mat, depth, bolted), floor: fl === null ? yr - 2 : fl, bolted };
}
// the roof over a span comes down: a dome of it, as bodies
export function collapse(st) {
  const mid = (st.xl + st.xr) / 2, half = st.span / 2, h = clamp(st.span * 0.32, 0.4, 1.5), cells = [];
  for (let i = Math.round((st.xl + 0.1) / CELL); i <= Math.round((st.xr - 0.1) / CELL); i++) { const u = (i * CELL - mid) / half, top = st.yr + h * (1 - u * u); for (let j = Math.round(st.yr / CELL) - 1; j * CELL <= top; j++) if (solid(i, j)) cells.push([i, j]); }
  const kg = freeRegion(cells, 0, -0.6, 0); MINE.collapses++; MINE.spans.delete(st.key);
  events.emit('collapse', { x: mid, y: st.yr, kg, span: st.span }); audio.play('groan'); audio.play('thud'); env.noise(mid, st.yr, 60); if (Math.abs(mid - S.P.x) < 30) G.shake += 0.3;
  for (let i = 0; i < 26; i++) S.parts.spawn({ x: st.xl + Math.random() * st.span, y: st.yr - Math.random() * 0.4, vx: rand(-1.5, 1.5), vy: rand(-2, 0.5), life: rand(1, 3), size: rand(0.25, 0.6), grow: 2, c: [0.13, 0.12, 0.12], mode: 1, a: 0.4, grav: 0.02, drag: 1.2 });
  MINE.watch.push({ x: mid, y: st.yr - 0.5, t: G.time }); return kg;
}
// a dig happened here (world.js tells us): the opening is watched from now on
world.onEdit2 = (x0, y0, x1, y1) => { if (world.lastSign >= 0 || !MINE.auto) return; const x = (x0 + x1) / 2, y = (y0 + y1) / 2; for (const w of MINE.watch) if (Math.abs(w.x - x) < 1.2 && Math.abs(w.y - y) < 1.2) { w.t = G.time; return; } MINE.watch.push({ x, y, t: G.time }); if (MINE.watch.length > 48) MINE.watch.shift(); };
export function stepMine(dt) {
  for (const k of MINE.kerfs) if (k === MINE.cur && G.time - k.t > 1.5) MINE.cur = null;
  MINE.tick -= dt; if (MINE.tick > 0) return; MINE.tick = 0.5; const P = S.P, seen = new Set(); MINE.warn = null;
  for (let wi = MINE.watch.length - 1; wi >= 0; wi--) {
    const w = MINE.watch[wi]; if (G.time - w.t > 900) { MINE.watch.splice(wi, 1); continue; }
    let ay = null; for (const d of [0, 0.4, -0.4, 0.9, -0.9]) if (world.dens(w.x, w.y + d) < -0.05) { ay = w.y + d; break; } if (ay === null) continue;
    const s = spanAt(w.x, ay); if (!s || s.depth < 0.12) continue; const key = Math.round(s.xl * 2) + ':' + Math.round(s.yr * 2); if (seen.has(key)) continue; seen.add(key);
    let st = MINE.spans.get(key); if (!st) MINE.spans.set(key, st = { t: 0 }); Object.assign(st, s, { key, live: G.time });
    const f = s.safe / s.span;
    // the plan: under the safe factor, supports are ghosts that jump the queue
    if (f < 1.25 && MINE.addGhost && !st.planned && s.span < 11.5) { st.planned = true; for (const q of planSupports(s.span, s.safe, s.mat === M.SOIL)) { const x = s.xl + s.span * q.at; if (q.kind === 'steel set') { const fy = world.groundY(x, s.yr - 0.3, 0, 6); if (fy !== null) MINE.addGhost('steel set', x, fy, s.yr); } else MINE.addGhost('rock bolt', x, s.yr - 0.5, s.yr); } }
    if (f < 1) {
      st.t += 0.5; const T = collapseTime(s.span, s.safe), near = Math.abs((s.xl + s.xr) / 2 - P.x) < s.span / 2 + 9 && Math.abs(s.yr - P.y) < 9;
      if (near && (!MINE.warn || f < MINE.warn.f)) MINE.warn = { span: s.span, safe: s.safe, f, left: Math.max(0, T - st.t) };
      if (near) { for (let i = 0; i < 3; i++) S.parts.spawn({ x: s.xl + Math.random() * s.span, y: s.yr - 0.05, vx: rand(-0.2, 0.2), vy: rand(-1.2, -0.2), life: rand(0.5, 1.4), size: rand(0.02, 0.05), c: [0.2, 0.19, 0.18], mode: 1, col: 1, bounce: 0.1 }); if (Math.random() < 0.25 + 0.6 * st.t / T) audio.play('tink'); }
      if (st.t >= T) collapse(st);
    } else st.t = Math.max(0, st.t - 0.25);
  }
  for (const [k, st] of MINE.spans) if (G.time - st.live > 5) MINE.spans.delete(k);
}
export function drawMine(b, time) {
  const cam = S.cam;
  for (const k of MINE.kerfs) {       // a slot: a hot line while it is fresh, a black hairline after
    if (Math.abs(k.x0 - cam.x) > 30 || k.len < 0.02) continue; const age = G.time - k.t, x1 = k.x0 + k.dx * k.len, y1 = k.y0 + k.dy * k.len, mx = (k.x0 + x1) / 2, my = (k.y0 + y1) / 2; if (world.dens(mx, my) < -0.05) continue;
    b.seg(k.x0, k.y0, x1, y1, 0.035, [0.003, 0.003, 0.004], 0.95, 0, 1); if (age < 6) { const h = 1 - age / 6; b.seg(k.x0, k.y0, x1, y1, 0.05, [3.2 * h, 0.9 * h * h, 0.1 * h], h, 0, 2); if (age < 2) light.emit(x1 / TS, y1 / TS, 0.9 * h, 0.3 * h, 0.05); }
  }
  for (const s of MINE.supports) {
    if (Math.abs(s.x - cam.x) > 30) continue;
    if (s.kind === 'steel set') { b.add(s.x, (s.y0 + s.y1) / 2, 0.1, s.y1 - s.y0, 0, mul(C.steel, 0.9), 1, 0, 1, 3, 0, 0, 0.5); b.add(s.x, s.y1 - 0.05, 0.7, 0.1, 0, mul(C.steel, 1.1), 1, 0, 1, 4, 0, 0, 0.5); b.add(s.x, s.y0 + 0.03, 0.3, 0.06, 0, mul(C.steel, 0.7), 1, 0, 1); b.seg(s.x - 0.3, s.y1 - 0.1, s.x - 0.05, s.y1 - 0.4, 0.04, mul(C.steel, 0.7), 1, 0, 1); b.seg(s.x + 0.3, s.y1 - 0.1, s.x + 0.05, s.y1 - 0.4, 0.04, mul(C.steel, 0.7), 1, 0, 1); }
    else { b.add(s.x, s.y1 - 0.02, 0.16, 0.035, 0, mul(C.steel, 1.2), 1, 0, 1); b.seg(s.x, s.y1, s.x, s.y1 + 0.5, 0.025, mul(C.steel, 0.5), 0.8, 0, 1); for (const d of [-0.5, 0.5]) { b.add(s.x + d, s.y1 - 0.02, 0.12, 0.03, 0, mul(C.steel, 1.0), 1, 0, 1); b.seg(s.x - 0.5, s.y1 - 0.03, s.x + 0.5, s.y1 - 0.03, 0.012, mul(C.steel, 0.6), 0.7, 0, 1); } }
  }
  if (S.mode === 'blueprint' || S.alt) for (const st of MINE.spans.values()) {      // the safe span of each watched opening
    const f = st.safe / st.span, col = f < 1 ? C.red : f < 1.25 ? C.amber : C.cyan; b.seg(st.xl, st.yr - 0.12, st.xr, st.yr - 0.12, 0.02, mul(col, 1.2), 0.6, 0, 2); const m = (st.xl + st.xr) / 2; b.seg(m - st.safe / 2, st.yr - 0.2, m + st.safe / 2, st.yr - 0.2, 0.012, mul(C.cyan, 0.9), 0.5, 0, 2);
  }
}
export function dumpMine() { const f = v => +v.toFixed(3); return { k: MINE.kerfs.filter(k => k.len > 0.03).slice(-120).map(k => [f(k.x0), f(k.y0), f(k.dx), f(k.dy), f(k.len)]), s: MINE.supports.map(s => [s.kind, s.x, s.y0, s.y1]), w: MINE.watch.map(w => [f(w.x), f(w.y)]), n: [MINE.collapses, f(MINE.freed)] }; }
export function loadMine(o) {
  MINE.kerfs = []; MINE.cuts = new Set(); MINE.cur = null; MINE.spans = new Map(); MINE.supports = []; MINE.watch = []; MINE.warn = null; MINE.collapses = 0; MINE.freed = 0; MINE.auto = true; if (!o) return;
  for (const q of o.k || []) { const k = { x0: q[0], y0: q[1], dx: q[2], dy: q[3], len: q[4], t: -99 }; MINE.kerfs.push(k); cutLinks(k.x0, k.y0, k.x0 + k.dx * k.len, k.y0 + k.dy * k.len); }
  for (const q of o.s || []) MINE.supports.push({ kind: q[0], x: q[1], y0: q[2], y1: q[3] }); for (const q of o.w || []) MINE.watch.push({ x: q[0], y: q[1], t: G.time }); if (o.n) { MINE.collapses = o.n[0]; MINE.freed = o.n[1]; }
}

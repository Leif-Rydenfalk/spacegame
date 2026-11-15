// spoil (round 7, docs/ROUND7.md 1.7): what the AI does with the rock nobody wants. Before any of it is heaped it is
// used, in this order:
//   pad       a machine planned where the ground does not carry it gets a pad of spoil under its foot first
//   berm      a bank of rubble on each side of the base, the side the hive is on first. It does not stop an animal; it
//             slows whatever has to climb it to a third and puts it on a crest in the open (creatures.js)
//   backfill  a shaft whose rig was taken away is an open hole in the base: it is filled again
// and the rest goes to the spoil heap, a stockpile the AI sites away from the base (pickSpoilSite), on the back layer
// like every stockpile, so you walk past it and not through it (matter.js, collide.js).
// A fill is terrain: what the robots tip into it becomes ground, kilogram for kilogram (fillPut returns what it did
// not take; what a row of samples took more than was tipped is owed and paid by the next load).
import { G, events } from '../core.js';
import { ITEMS } from '../items.js';
import { world, TS, M, MAT, SLAB, surfaceH } from './world.js';
import { S, C, mul } from './state.js';
import { F } from './factory.js';
import { K, SHIP } from './kit.js';
import { hive } from './hive.js';

export const SPOIL = ['basalt', 'soil', 'slag'];
const MATOF = { basalt: M.BASALT, soil: M.SOIL, slag: M.BASALT };
export const FILL = { list: [], nextId: 1, tick: 0, on: true, berms: {}, used: 0 };
export const BERM = { h: 2.2, w: 4.4, off: 9, minKg: 60 };
// the height a fill wants at x (m above its base), by its kind
const want = (f, x) => f.kind === 'berm' ? f.h * Math.pow(Math.max(0, 1 - Math.abs(x - f.x) / (f.w / 2)), 0.75) : x >= f.x - f.w / 2 && x <= f.x + f.w / 2 ? f.h : 0;
// kg of basalt a fill of this shape takes, about (the real figure is what the ground takes)
export const fillKg = f => (f.kind === 'berm' ? f.w * f.h * 0.57 : f.w * f.h) * SLAB * MAT[M.BASALT].rho;
export function addFill(kind, x, y0, w, h, extra = {}) { const f = { id: FILL.nextId++, kind, x: +x.toFixed(2), y0: +y0.toFixed(2), w: +w.toFixed(2), h: +h.toFixed(2), lvl: 0, put: 0, debt: 0, done: false, auto: true, ...extra }; f.need = +fillKg(f).toFixed(1); FILL.list.push(f); events.emit('fillPlanned', kind); return f; }
export const fillOf = id => FILL.list.find(f => f.id === id);
// kg the open fills still want: while that is more than nothing, loose spoil is kept for them and not carried off to the heap
export const fillWant = () => { let s = 0; for (const f of FILL.list) if (!f.done) s += Math.max(f.debt, f.need - f.put); return s; };
// tip n of an item into a fill: it rises row by row from its base. Returns what was not taken (the fill is full).
export function fillPut(f, item, n) {
  const mat = MATOF[item]; if (!mat || f.done) return n; let kg = n * ITEMS[item].m; const pay = Math.min(kg, f.debt); f.debt -= pay; kg -= pay; f.put += pay;
  const P = S.P, x0 = f.x - f.w / 2, x1 = f.x + f.w / 2;
  while (kg > 0.05 && f.lvl < f.h) {
    if (!P.dead && P.x > x0 - 0.5 && P.x < x1 + 0.5 && P.y > f.y0 - 1 && P.y < f.y0 + f.h + 0.5) break;      // nobody is buried in a pad: it waits until you have stepped off
    const top = Math.min(f.h, f.lvl + 0.125), acc = {}, yl = f.y0 + f.lvl, yt = f.y0 + top;
    world.shape(x0, yl - 0.2, x1, yt, (x, y) => Math.max(y - (f.y0 + Math.min(top, want(f, x))), f.y0 - 0.6 - y, x0 - x, x - x1), 1, mat, 0, acc);
    let added = 0; for (const k in acc) added -= acc[k]; added = Math.max(0, added); f.lvl = top;
    if (added > kg) { f.debt += added - kg; f.put += kg; kg = 0; } else { kg -= added; f.put += added; }
  }
  if (f.lvl >= f.h && f.debt < 0.05 && !f.done) { f.done = true; FILL.used += f.put; events.emit('fillDone', { kind: f.kind, kg: f.put, x: f.x }); S.say(f.kind === 'berm' ? `a berm stands ${f.x < SHIP.x ? 'west' : 'east'} of the base: ${f.put.toFixed(0)} kg of spoil` : f.kind === 'pad' ? 'ground pad laid: the machine can stand' : `shaft backfilled: ${f.put.toFixed(0)} kg of spoil`, 4); }
  return kg / ITEMS[item].m;
}
// what a fill still wants, for the carrying jobs: [[fill, item, amount, priority class, slot]]
export function fillJobs() {
  const out = [], st = S.spoilStock || {};
  for (const f of FILL.list) {
    if (f.done) continue; const left = Math.max(f.debt, f.need - f.put) + 2; if (left < 0.5) continue;
    const k = SPOIL.find(q => (st[q] || 0) > 3); if (!k) continue;
    const gy = world.groundY(f.x, f.y0 + f.h + 2, 0, 12); f.sx = f.x; f.sy = (gy === null ? f.y0 + f.lvl : gy) + 1.1;
    for (let slot = 0; slot < (f.kind === 'berm' ? 3 : 2) && slot * 15 < left; slot++) out.push([f, k, Math.min(left, 60) / ITEMS[k].m, f.kind === 'pad' ? 1 : 3, slot]);
  }
  return out;
}
// pure: where the spoil heap goes. c = [{ x, d (m from the base's edge), rough (m of relief), built (m to the nearest
// thing that stands or is planned), hive (m to an awake hive) }]. The nearest level place that is clear of the base
// and not on the hive's side when the other side will do; null when none is fit.
export function pickSpoilSite(c) {
  let best = null, bs = 1e9;
  for (const q of c) { if (q.d < 30 || q.built < 14 || q.rough > 1.6 || q.hive < 30) continue; const sc = q.d + q.rough * 12 + (q.hive < 90 ? 25 : 0); if (sc < bs) { bs = sc; best = q; } }
  return best ? best.x : null;
}
const relief = (x, w) => { let lo = 1e9, hi = -1e9; for (let d = -w; d <= w; d += 1) { const h = world.groundY(x + d, surfaceH(x + d) + 8, 0, 30); if (h === null) return 9; lo = Math.min(lo, h); hi = Math.max(hi, h); } return hi - lo; };
// the base's reach along the ground: the wreck and every machine that is not a line
export function baseSpan() { let x0 = S.crash ? SHIP.x - 6 : 1e9, x1 = S.crash ? SHIP.x + 6 : -1e9, n = 0; for (const m of F.machines) { if (m.kind === 'belt' || m.kind === 'antenna' || m.kind === 'camera' || m.kind === 'radar' || m.kind === 'power pole') continue; const a = m.x * TS, b = (m.x + m.w) * TS; if (Math.abs(a - SHIP.x) > 120) continue; x0 = Math.min(x0, a); x1 = Math.max(x1, b); n++; } return { x0, x1, n }; }
const builtNear = (x, ghosts) => { let d = S.crash ? Math.max(0, Math.abs(x - SHIP.x) - 6) : 1e9; for (const m of F.machines) d = Math.min(d, Math.abs((m.x + m.w / 2) * TS - x)); for (const g of ghosts || []) d = Math.min(d, Math.abs((g.x + 0.5) * TS - x)); return d; };
export function spoilSiteX(ghosts) {
  const b = baseSpan(), hn = hive.near, c = [];
  for (let d = 32; d <= 84; d += 4) for (const sd of [-1, 1]) { const x = sd < 0 ? b.x0 - d : b.x1 + d; c.push({ x, d, rough: relief(x, 3), built: builtNear(x, ghosts), hive: hn && hn.a > 6 ? Math.abs(hn.x - x) : 1e9 }); }
  const x = pickSpoilSite(c); return x === null ? (S.crash ? SHIP.x - 40 : b.x0 - 40) : x;
}
// the AI looks at what spoil there is and what could use it (a few times a minute)
export function stepSpoil(dt, ctx) {
  FILL.tick -= dt; if (FILL.tick > 0) return; FILL.tick = 3; S.spoilStock = ctx.stock || {};
  for (let i = FILL.list.length - 1; i >= 0; i--) { const f = FILL.list[i]; if (f.kind === 'pad' && f.done) { const g = ctx.ghosts.find(q => q.id === f.ghost); if (g) g.padOk = true; }
    if (f.done && f.kind !== 'berm') FILL.list.splice(i, 1); else if (f.kind === 'pad' && !f.done && !ctx.ghosts.some(g => g.id === f.ghost)) FILL.list.splice(i, 1); }
  if (!FILL.on) return;
  // pads: a planned machine whose ground does not carry it
  for (const g of ctx.ghosts) if (g.pad && !g.padId) { const f = addFill('pad', (g.x + g.pad.w / 2) * TS, g.pad.y0, g.pad.w * TS, g.y * TS - g.pad.y0, { ghost: g.id }); g.padId = f.id; }
  // berms: once there is a base to guard and spoil to build with: the hive's side first, then the other
  const b = baseSpan(), have = SPOIL.reduce((a, k) => a + (S.spoilStock[k] || 0), 0);
  if (b.n >= 2 && have >= BERM.minKg) {
    const hn = hive.near, first = hn && hn.x < (b.x0 + b.x1) / 2 ? -1 : 1;
    for (const sd of [first, -first]) { const key = sd < 0 ? 'w' : 'e'; if (FILL.list.some(f => f.kind === 'berm' && f.side === key)) continue; if (FILL.list.some(f => f.kind === 'berm' && !f.done)) break;
      let x = null; for (let d = BERM.off; d <= BERM.off + 12 && x === null; d += 2) { const q = sd < 0 ? b.x0 - d : b.x1 + d; if (relief(q, 2) < 1.2 && builtNear(q, ctx.ghosts) > 5) x = q; }
      if (x === null) continue; const gy = world.groundY(x, surfaceH(x) + 8, 0, 30); if (gy === null) continue;
      let lo = gy; for (let d = -BERM.w / 2; d <= BERM.w / 2; d += 0.5) { const h = world.groundY(x + d, gy + 6, 0, 12); if (h !== null) lo = Math.min(lo, h); }
      const f = addFill('berm', x, lo - 0.1, BERM.w, BERM.h + (gy - lo) + 0.1, { side: key }); if (ctx.log) ctx.log(`spoil: a berm ${sd < 0 ? 'west' : 'east'} of the base, ${f.need.toFixed(0)} kg of rubble${hn && (hn.x < x) === (sd < 0) ? ': the hive is that way' : ''}`); break; }
  }
}
// a shaft whose rig is gone: fill it again
export function backfillShaft(cx, y0, depth, width = 1) { if (depth < 1) return null; const f = addFill('backfill', cx, y0 - depth, width + 0.1, depth); return f; }
export function drawFills(b, time) {
  for (const f of FILL.list) { if (f.done) continue; const n = Math.max(4, Math.round(f.w * 3)), pulse = 0.5 + 0.3 * Math.sin(time * 3 + f.id);
    for (let i = 0; i < n; i++) { const x0 = f.x - f.w / 2 + f.w * i / n, x1 = f.x - f.w / 2 + f.w * (i + 1) / n; b.seg(x0, f.y0 + want(f, x0), x1, f.y0 + want(f, x1), 0.022, [0.9, 0.55, 0.12], 0.7 * pulse, 0, 2); }
    b.add(f.x, f.y0 + f.lvl, f.w, 0.02, 0, [0.9, 0.55, 0.12], 0.35, 0, 2); }
}
export function dumpFills() { return { l: FILL.list.map(f => [f.id, f.kind, f.x, f.y0, f.w, f.h, +f.lvl.toFixed(3), +f.put.toFixed(3), +f.debt.toFixed(3), f.done ? 1 : 0, f.side || f.ghost || 0]), n: FILL.nextId, on: FILL.on ? 1 : 0, used: +FILL.used.toFixed(2) }; }
export function loadFills(o) { FILL.list = ((o && o.l) || []).map(q => { const f = { id: q[0], kind: q[1], x: q[2], y0: q[3], w: q[4], h: q[5], lvl: q[6], put: q[7], debt: q[8], done: !!q[9], auto: true }; if (f.kind === 'berm') f.side = q[10]; else if (f.kind === 'pad') f.ghost = q[10]; f.need = +fillKg(f).toFixed(1); return f; }); FILL.nextId = (o && o.n) || 1; FILL.on = o ? !!o.on : true; FILL.used = (o && o.used) || 0; FILL.tick = 0; }

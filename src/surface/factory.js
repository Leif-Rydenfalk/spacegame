// factory: machines on a 0.5 m placement grid, visibly working on continuous amounts. miner -> belt -> furnace ->
// belt -> assembler -> belt -> launch pad, where the rocket grows part by part. Each machine does a few things fast;
// the suit printer does everything slowly. Running machines make noise and pollution, and the hive hears both.
import { G, events, rand } from '../core.js';
import { audio } from '../audio.js';
import { world, TS, M, MAT } from './world.js';
import { light } from './light.js';
import { S, C, mul } from './state.js';
import { env } from './env.js';
import { ITEMS, RECIPE, RECIPES, SHOP, makeInv, inv, mixQ, toolCan, effRecipe } from '../items.js';
import { platAt } from './layers.js';

// sink(cell x, row, item, n) -> what was not taken, or null when nothing takes items there (the ship hold's intake)
export const F = { machines: [], items: [], cells: new Map(), pad: null, printer: null, sink: null, onPlace: null, onRemove: null, stepExtra: null, drawExtra: null, rock: null, spill: null };
export const ROCKET_PARTS = 12;
// w, h in cells; takes = what it accepts; noise = audible radius while running; poll = pollution per second
export const DEFS = {
  belt: { w: 1, h: 1, hp: 40 },
  miner: { w: 2, h: 2, hp: 160, noise: 30, poll: 0.25 },
  furnace: { w: 2, h: 2, hp: 220, takes: ['iron ore', 'lean ore', 'copper ore', 'basalt', 'biomass', 'swarf', 'log'], noise: 20, poll: 0.9 },
  assembler: { w: 3, h: 2, hp: 200, noise: 24, poll: 0.2 },
  chest: { w: 2, h: 2, hp: 120 },
  antenna: { w: 1, h: 4, hp: 80 },
  hub: { w: 2, h: 2, hp: 180, takes: ['drone'] },
  'bio-printer': { w: 2, h: 3, hp: 200 },
  pad: { w: 7, h: 1, hp: 500, takes: ['part'] },
};
export const LUMP = 2;                        // kg per lump on a belt
const key = (x, y) => (x + 32768) * 65536 + (y + 32768);
export const machineAt = (gx, gy) => F.cells.get(key(gx, gy));
// round 7: a belt has a direction: 1 east, -1 west, 2 up, -2 down (the last two are bucket lifts). It stands on the
// ground, on a deck, or on trestle legs when there is ground within six metres under it.
export const DIRV = { 1: [1, 0], [-1]: [-1, 0], 2: [0, 1], [-2]: [0, -1] }, TRESTLE = 6;
export const isBelt = m => !!m && m.kind === 'belt';
// the machine classes that run batches of one recipe: the assembly cell and the shop tools
export const isBatch = k => k === 'assembler' || !!SHOP[k];
export const recipeOf = m => { const r = RECIPE[m.recipe]; return !r ? null : m.kind === 'assembler' ? r : SHOP[m.kind] && toolCan(m.kind, r) ? effRecipe(m.kind, r) : null; };
export const BATCH0 = { assembler: 'part', 'cnc mill': 'chest', 'metal printer': 'camera', 'polymer printer': 'air filter', 'solder bench': 'pcb' };
// the two ports of a machine: the cells beside its foot, at floor level. A belt that leads away from one takes what the
// machine makes; a belt that leads into one feeds it. [cell x, row, the direction that leads away]
export const portsOf = m => [[m.x - 1, m.y, -1], [m.x + m.w, m.y, 1]];
// does a belt lead away from this machine?
export const hasOutBelt = m => portsOf(m).some(([cx, cy, away]) => { const b = F.cells.get(key(cx, cy)); return isBelt(b) && b.dir !== -away; });
export function canPlace(kind, gx, gy) {
  const d = DEFS[kind]; let sup = 0;
  if (kind === 'belt') { if (F.cells.has(key(gx, gy)) || world.dens((gx + 0.5) * TS, (gy + 0.5) * TS) > 0.2) return false; return world.solidAt((gx + 0.5) * TS, gy * TS - 0.3) || platAt(gx, gy - 1) || world.groundY((gx + 0.5) * TS, gy * TS + 0.25, 0, TRESTLE) !== null; }
  for (let i = 0; i < d.w; i++) { if (world.solidAt((gx + i + 0.5) * TS, gy * TS - 0.3) || platAt(gx + i, gy - 1)) sup++; for (let j = 0; j < d.h; j++) { if (F.cells.has(key(gx + i, gy + j))) return false; if (world.dens((gx + i + 0.5) * TS, (gy + j + 0.5) * TS) > (j === 0 ? 0.2 : 0.05)) return false; } }
  return sup >= Math.ceil(d.w * 0.6);
}
export function place(kind, gx, gy, dir = 1, quiet) {
  const d = DEFS[kind], m = { kind, x: gx, y: gy, w: d.w, h: d.h, dir, inp: {}, out: {}, t: 0, on: false, n: 0, hp: d.hp, seed: Math.random() * 100, nt: Math.random() };
  for (let i = 0; i < d.w; i++) for (let j = 0; j < d.h; j++) F.cells.set(key(gx + i, gy + j), m);
  // it stands in the open: the rock in its cells is cleared and a plate foundation is laid under it (not when it stands on a deck)
  let deck = false; for (let i = 0; i < d.w; i++) if (platAt(gx + i, gy - 1) && !world.solidAt((gx + i + 0.5) * TS, gy * TS - 0.3)) deck = true;
  // a belt off the ground stands on trestle legs: nothing is cleared or laid under it
  const air = kind === 'belt' && !deck && !world.solidAt((gx + 0.5) * TS, gy * TS - 0.3); if (air) { const g = world.groundY((gx + 0.5) * TS, gy * TS + 0.25, 0, TRESTLE + 0.5); m.leg = g === null ? 0 : +(gy * TS - g).toFixed(2); }
  world.box(gx * TS + 0.02, gy * TS, (gx + d.w) * TS - 0.02, (gy + d.h) * TS, -1); if (!deck && !air) world.box(gx * TS, gy * TS - 0.3, (gx + d.w) * TS, gy * TS - 0.02, 1, M.PLATE);
  if (kind === 'chest') m.inv = makeInv(24); if (isBatch(kind)) m.recipe = BATCH0[kind]; if (kind === 'miner') m.depth = 0.5; if (kind === 'hub') m.drones = 0;
  if (kind === 'pad') F.pad = m; if (kind === 'bio-printer') { F.printer = m; if (!quiet) events.emit('printerBuilt'); } if (F.onPlace) F.onPlace(m);
  F.machines.push(m); if (!quiet) { audio.play('place'); events.emit('built', kind); } return m;
}
export function removeMachine(m) {
  const i = F.machines.indexOf(m); if (i < 0) return; F.machines.splice(i, 1);
  for (let a = 0; a < m.w; a++) for (let b = 0; b < m.h; b++) F.cells.delete(key(m.x + a, m.y + b));
  if (F.onRemove) F.onRemove(m); if (F.pad === m) F.pad = null; if (F.printer === m) F.printer = F.machines.find(q => q.kind === 'bio-printer') || null; if (S.open === m) S.open = null;
}
export const accepts = (m, id) => {
  if (m.kind === 'chest') return true; if (isBatch(m.kind)) { const r = recipeOf(m); return !!r && id in r.in && (m.inp[id] || 0) < r.in[id] * 4 + 1; }
  if (m.kind === 'furnace' && id === 'iron') return m.powderT > G.time && (m.inp.iron || 0) < 12;       // bar goes into a furnace only while it is asked for powder
  const d = DEFS[m.kind]; return !!(d.takes && d.takes.includes(id)) && (m.inp[id] || 0) < 40 && !(m.kind === 'pad' && m.n >= ROCKET_PARTS);
};
const wants = (m, id) => m.kind === 'chest' || (isBatch(m.kind) ? !!recipeOf(m) && id in recipeOf(m).in : !!(DEFS[m.kind].takes && DEFS[m.kind].takes.includes(id)));
// put n of id into a machine; returns what it did not take
export function give(m, id, n) {
  if (!accepts(m, id)) return n;
  if (m.kind === 'chest') return inv.add(m.inv, id, n);
  if (m.kind === 'pad') { const k = Math.min(n, ROCKET_PARTS - m.n); m.n += k; if (k > 0) audio.play('place'); return n - k; }
  if (m.kind === 'hub') { m.drones += n; events.emit('dronesDocked', m); return 0; }
  m.inp[id] = (m.inp[id] || 0) + n; return 0;
}
const push = (m, id, n) => { m.out[id] = (m.out[id] || 0) + n; };
const outTotal = m => { let s = 0; for (const k in m.out) s += m.out[k] * ITEMS[k].m; return s; };
// E: the nearest machine. The finished pad is boarded; everything else opens its window.
export function nearest(range = 3.2) {
  const P = S.P; let best = null, bd = range;
  for (const m of F.machines) { if (m.kind === 'belt' || m.kind === 'antenna') continue; const d = Math.hypot((m.x + m.w / 2) * TS - P.x, (m.y + m.h / 2) * TS - P.y - 0.9); if (d < bd) { bd = d; best = m; } }
  return best;
}
// quick transfer: everything the machine takes goes in, everything it made comes out
export function quickTransfer(m) {
  if (m.kind === 'chest') return;
  for (const s of S.inv.slots) if (s && accepts(m, s.id)) { const want = isBatch(m.kind) ? recipeOf(m).in[s.id] * 4 - (m.inp[s.id] || 0) : m.kind === 'pad' ? ROCKET_PARTS - m.n : 40 - (m.inp[s.id] || 0), k = Math.min(s.n, Math.max(0, want)); if (k > 0) { const left = give(m, s.id, k); inv.take(S.inv, s.id, k - left); } }
  for (const k in m.out) { const left = S.add(k, m.out[k]); S.gain(k, m.out[k] - left); if (left > 1e-6) m.out[k] = left; else delete m.out[k]; }
  audio.play('click');
}
S.wreck = (x, y, dmg) => {
  for (const m of F.machines) if (Math.abs((m.x + m.w / 2) * TS - x) < m.w * TS / 2 + 1.2 && Math.abs((m.y + m.h / 2) * TS - y) < m.h * TS / 2 + 1.5) {
    m.hp -= dmg; m.hurt = 0.2; if (Math.random() < 0.1) S.parts.spawn({ x: (m.x + m.w / 2) * TS, y: (m.y + m.h / 2) * TS, vx: rand(-3, 3), vy: rand(1, 4), life: rand(0.2, 0.6), size: 0.04, c: [4, 2, 0.6], col: 1 });
    if (m.hp <= 0) { removeMachine(m); events.emit('machineLost', m.kind); S.say(m.kind + ' destroyed by the hive', 4); audio.play('groan'); } return;
  }
};
export function stepFactory(dt) {
  for (const m of F.machines) {
    const d = DEFS[m.kind], pw = m.pw === undefined ? 1 : m.pw; if (m.hurt > 0) m.hurt -= dt;      // pw = the share of its power the grid gives it (auto.js)
    if (m.kind === 'miner') {       // bores down under itself; the ore the bit removes is what comes out, to the gram
      m.on = outTotal(m) < 30 && m.depth < 9 && pw > 0.05;
      if (m.on) { m.t += dt * pw; if (m.t >= 0.25) { m.t = 0; const acc = {}, hx = (m.x + 1) * TS, hy = m.y * TS - m.depth; world.dig(hx, hy, 0.42, 0.06, acc, q => q >= M.XENO); let got = 0; for (const k in acc) { if (acc[k] > 0 && +k >= M.BASALT && +k <= M.LUMEN && F.rock) { for (const [id, kg, q] of F.rock(+k, acc[k], hx, hy)) { push(m, id, kg); if (q) m.q = mixQ(m.q, (m.out[id] || 0) - kg, q, kg); if (+k >= M.IRON) m.oreId = id; } got += acc[k]; } } if (got < 0.02) m.depth += 0.08; m.ore = got > 0.02; } }
    } else if (m.kind === 'furnace') {   // continuous smelting; biomass in the firebox makes it 2.5 times faster
      // rich ore first, then lean ore, then copper ore, then any rock by electrolysis (which also gives oxygen and silicon)
      let r = null; for (const q of RECIPES) if (q.by === 'furnace' && (m.inp[Object.keys(q.in)[0]] || 0) > 0.01) { r = q; break; } m.on = !!r && outTotal(m) < 60 && pw > 0.05;
      if (m.on) { if (!m.lit) { m.lit = true; events.emit('furnaceLit'); } const ore = Object.keys(r.in)[0], main = Object.keys(r.out)[0], fk = m.inp.log > 0.001 ? 'log' : 'biomass', fuel = m.inp[fk] > 0.001, kg = Math.min(dt / r.t * (fuel ? 2.5 : 1) * pw, m.inp[ore] / r.in[ore]); m.inp[ore] -= kg * r.in[ore]; if (fuel) m.inp[fk] = Math.max(0, m.inp[fk] - kg * 0.06); for (const k in r.out) push(m, k, kg * r.out[k] / r.out[main]); m.fuel = fuel; m.rec = r.id; }
    } else if (isBatch(m.kind)) {  // batches of its one recipe (a shop tool runs it its own way: toolRecipe)
      const r = recipeOf(m);
      if (!m.busy && r && outTotal(m) < 60) { let ok = true; for (const k in r.in) if ((m.inp[k] || 0) < r.in[k] - 1e-9) ok = false; if (ok) { for (const k in r.in) m.inp[k] -= r.in[k]; m.busy = true; m.t = 0; } }
      m.on = !!m.busy && pw > 0.05 && !!r; if (m.busy && !r) m.busy = false; if (m.busy) { m.t += dt * pw; if (m.t >= r.t) { m.busy = false; for (const k in r.out) push(m, k, r.out[k]); } }
    } else if (m.kind === 'hub') m.on = m.drones > 0 || (m.out.n | 0) > 0;
    else if (F.stepExtra) F.stepExtra(m, dt, pw);
    if (m.on && d.noise) { m.nt -= dt; if (m.nt <= 0) { m.nt = 0.6; env.noise((m.x + m.w / 2) * TS, (m.y + 1) * TS, d.noise); env.pollute((m.x + 1) * TS, m.y * TS, d.poll * 0.6 * (m.kind === 'furnace' && !m.fuel ? 0.3 : 1)); } }
    // the loader at a port: lumps onto a belt that leads away from either side of the foot, one at a time
    if (m.kind !== 'belt' && m.kind !== 'chest') for (const id in m.out) {
      const u = ITEMS[id].u, lump = u === 'ea' ? 1 : u === 'rd' ? Math.min(30, m.out[id]) : LUMP; if (m.out[id] < lump - 1e-9 && !(u !== 'ea' && !m.on && m.out[id] > 0.05)) continue;
      for (const [cx, cy, away] of portsOf(m)) { const b = F.cells.get(key(cx, cy)); if (isBelt(b) && b.dir !== -away) { const ix = cx + 0.5 - (Math.abs(b.dir) === 1 ? b.dir * 0.45 : 0), iy = cy + (Math.abs(b.dir) === 1 ? 0.3 : b.dir > 0 ? 0.05 : 0.95); if (F.items.some(it => Math.abs(it.x - ix) < 0.55 && Math.abs(it.y - iy) < 0.55)) continue; const n = Math.min(lump, m.out[id]); m.out[id] -= n; if (m.out[id] < 1e-9) delete m.out[id]; F.items.push({ id, n, x: ix, y: iy }); m.ldT = 0.25; break; } }
      break;
    }
    if (m.ldT > 0) m.ldT -= dt; if (m.kind !== 'belt') m.backed = outTotal(m) > 24;       // a belt that does not take it away fast enough: the robots help
  }
  // what rides the belts. An item is on the cell it is in and moves the way that cell's belt runs: 1.5 m/s on full power
  // (a fast belt twice that), behind whatever is ahead of it. At the end of the line it goes into what stands there, or
  // waits; off a belt that was taken away it falls to the ground. Nothing on a belt is ever lost.
  for (let i = F.items.length - 1; i >= 0; i--) {
    const it = F.items[i], cx = Math.floor(it.x), cy = Math.floor(it.y), b = F.cells.get(key(cx, cy));
    if (!isBelt(b)) { if (F.spill) F.spill(it.id, it.n, (it.x) * TS, (it.y + 0.3) * TS); F.items.splice(i, 1); continue; }
    const [dx, dy] = DIRV[b.dir] || DIRV[1], v = 3 * dt * (b.pw === undefined ? 1 : b.pw) * (b.fast ? 2 : 1), k = Math.min(1, dt * 12);
    if (dx) it.y += (cy + 0.3 - it.y) * k; else it.x += (cx + 0.5 - it.x) * k;       // onto this belt's own line
    const nx = it.x + dx * v, ny = it.y + dy * v;
    let blocked = false; for (const o of F.items) { if (o === it) continue; const ax = (o.x - it.x) * dx + (o.y - it.y) * dy, lat = Math.abs((o.x - it.x) * dy) + Math.abs((o.y - it.y) * dx); if (ax > 0 && ax < 0.5 + v && lat < 0.45) { blocked = true; break; } } if (blocked) continue;
    if (Math.floor(nx) !== cx || Math.floor(ny) !== cy) {
      const tx = Math.floor(nx), ty = Math.floor(ny), n = F.cells.get(key(tx, ty));
      if (!n && F.sink && dx) { const left = F.sink(tx, ty, it.id, it.n); if (left !== null) { it.n = left; if (it.n < 1e-9) { F.items.splice(i, 1); events.emit('firstAutomation'); } continue; } }
      if (!isBelt(n)) { if (n && accepts(n, it.id)) { const q0 = it.n; it.n = give(n, it.id, it.n); if (it.n < q0) { n.ldT = 0.25; b.ldT = 0.25; } if (it.n < 1e-9) { F.items.splice(i, 1); events.emit('firstAutomation'); } } else if (n && !wants(n, it.id)) { if (F.spill) F.spill(it.id, it.n, (cx + 0.5 + dx * 0.4) * TS, (cy + 1.2) * TS); F.items.splice(i, 1); } continue; }
      if (n.dir === -b.dir) continue;       // head on: it waits
    }
    it.x = nx; it.y = ny;
  }
}
// rocket silhouette: width (m) of each stacked section, bottom to top; the pad shows the first n
export const ROCKET_W = [1.0, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.25, 0.85, 0.4], SEC_H = 0.95;
export function drawRocket(b, x, y, n, mode = 1) {
  for (let i = 0; i < n; i++) { const w = ROCKET_W[i], yy = y + i * SEC_H + SEC_H / 2; b.add(x, yy, w, SEC_H - 0.04, 0, i === 0 ? C.dark : mul(C.hull, i % 4 === 1 ? 0.8 : 1), 1, 0, mode, i + 3); if (i === 9) b.add(x, yy, 0.5, 0.3, 0, mul(C.amber, 0.9), 1, 2, 2); }
}
// one machine, also used for blueprint ghosts (a = alpha, ghost = true draws it as a hologram)
export function drawMachine(b, m, time, a = 1, ghost = false) {
  const x = m.x * TS, y = m.y * TS, w = m.w * TS, h = m.h * TS, cx = x + w / 2, md = ghost ? 2 : 1, tint = c => ghost ? [c[0] * 0.25 + 0.02, c[1] * 0.5 + 0.1, c[2] * 0.6 + 0.16] : m.hurt > 0 ? [c[0] * 3, c[1], c[1]] : c, on = m.on && !ghost, tk = (time * 3) % 1;
  const A = (X, Y, W, H, rot, c, al = 1, shape = 0, mode = md, seed = 0) => b.add(X, Y, W, H, rot, mode === 2 && !ghost ? c : tint(c), al * a, shape, mode, seed);
  if (m.kind === 'belt') {
    const vert = Math.abs(m.dir) === 2, sg = m.dir > 0 ? 1 : -1, sp = (m.fast ? 2 : 1) * (m.pw === undefined ? 1 : m.pw), ph = (time * 1.5 * sp) % 1, col = m.fast ? mul(C.amber, 0.5) : C.dark, arrow = ghost ? C.amber : m.fast ? mul(C.amber, 1.6) : mul(C.steel, 1.5), cy = y + h / 2;
    if (!vert) {
      A(cx, y + 0.07, w, 0.14, 0, col, 1, 0, md, m.x); A(cx, y + 0.02, 0.08, 0.3, 0, mul(C.dark, 0.7));
      // chevrons that run the way the belt runs: its direction is never a guess
      for (let i = 0; i < 2; i++) { const u = ghost ? 0.25 + i * 0.5 : (ph + i * 0.5) % 1, ax = x + (sg > 0 ? u : 1 - u) * w; for (const d of [-1, 1]) b.seg(ax + sg * 0.05, y + 0.155, ax - sg * 0.03, y + 0.155 + d * 0.045, 0.016, arrow, a * (ghost ? 1 : 0.9), 0, ghost ? 2 : 1); }
      if (m.leg > 0.3 && !ghost) { for (const d of [-0.16, 0.16]) b.seg(cx + d, y, cx + d * 1.6, y - m.leg, 0.03, mul(C.steel, 0.5), 1, 0, 1); b.seg(cx - 0.2, y - Math.min(m.leg, 0.5), cx + 0.2, y - Math.min(m.leg, 0.5) * 0.4, 0.016, mul(C.steel, 0.4), 1, 0, 1); }
    } else {      // a bucket lift: two rails, buckets that climb or sink
      for (const d of [-0.17, 0.17]) A(cx + d, cy, 0.035, h, 0, col, 1, 0, md, m.x + d);
      for (let i = 0; i < 2; i++) { const u = ghost ? 0.25 + i * 0.5 : (ph + i * 0.5) % 1, by = y + (sg > 0 ? u : 1 - u) * h; A(cx, by, 0.26, 0.05, 0, mul(C.steel, 0.9)); for (const d of [-1, 1]) b.seg(cx, by + sg * 0.07, cx + d * 0.06, by - sg * 0.01, 0.016, arrow, a, 0, ghost ? 2 : 1); }
    }
    if (!ghost) {      // a loader where the line meets a machine: a hood over the port and an arm that swings when something passes
      const dv = DIRV[m.dir]; for (const sd of [1, -1]) { const n = F.cells.get(key(m.x + dv[0] * sd, m.y + dv[1] * sd)); if (!n || n.kind === 'belt' || vert) continue; const ex = cx + dv[0] * sd * 0.2, sw = m.ldT > 0 || n.ldT > 0 ? Math.sin(time * 26) * 0.5 : 0; b.add(ex, y + 0.3, 0.2, 0.2, 0, mul(C.steel, 0.75), 1, 0, 1, 7); b.seg(ex, y + 0.38, ex + dv[0] * sd * (0.2 + sw * 0.08), y + 0.2 + Math.abs(sw) * 0.06, 0.03, mul(C.amber, 0.9), 1, 0, 1); b.add(ex, y + 0.42, 0.045, 0.045, 0, mul(sd > 0 ? C.acid : C.amber, 2.2), 1, 1, 2); }
    }
  } else if (m.kind === 'furnace') {
    const fl = on ? 0.75 + 0.25 * Math.sin(time * 13 + m.seed) * Math.sin(time * 7.3) : 0.04;
    A(cx, y + h / 2, w, h, 0, [0.085, 0.07, 0.068], 1, 0, md, 1); A(cx + 0.28, y + h + 0.3, 0.26, 0.62, 0, [0.07, 0.06, 0.06], 1, 0, md, 2); A(cx, y + h - 0.05, w + 0.08, 0.1, 0, C.dark);
    if (!ghost) { b.add(cx - 0.12, y + 0.32, 0.5, 0.34, 0, mul([1, 0.3, 0.06], 4 * fl), 1, 2, 2); b.add(cx - 0.12, y + 0.3, 1.5, 1.1, 0, mul([1, 0.3, 0.06], 0.7 * fl), 1, 1, 2); }
    if (on) { light.emit(m.x + 0.5, m.y + 0.6, 2.4 * fl, 0.8 * fl, 0.2 * fl); if (Math.random() < (m.fuel ? 0.5 : 0.15)) S.parts.spawn({ x: cx + 0.28, y: y + h + 0.6, vx: rand(-0.2, 0.3), vy: rand(0.6, 1.3), life: rand(2, 5), size: rand(0.2, 0.4), grow: 3, c: m.fuel ? [0.06, 0.055, 0.05] : [0.1, 0.09, 0.09], mode: 1, a: m.fuel ? 0.45 : 0.3, grav: -0.02, drag: 0.4 }); if (Math.random() < 0.08) S.parts.spawn({ x: cx + 0.28, y: y + h + 0.6, vx: rand(-0.8, 0.8), vy: rand(1, 3), life: rand(0.5, 1.4), size: 0.035, c: [4, 1.5, 0.3], grav: 0.2 }); }
  } else if (m.kind === 'miner') {
    const vib = on ? Math.sin(time * 60) * 0.012 : 0;
    b.seg(x + 0.06, y, cx, y + h + 0.5, 0.07, tint(C.steel), a, 0, md); b.seg(x + w - 0.06, y, cx, y + h + 0.5, 0.07, tint(C.steel), a, 0, md); A(cx, y + h * 0.72, 0.5, 0.34, 0, mul(C.steel, 0.7), 1, 0, md, 4);
    A(cx + vib, y + 0.3 - (m.depth || 0) / 2, 0.1, 0.75 + (m.depth || 0), 0, C.dark, 1, 0, md, 5); if (!ghost) b.add(cx, y + h + 0.5, 0.07, 0.07, 0, mul(C.amber, on ? 3 : 0.4), 1, 1, 2);
    if (on && Math.random() < 0.3) S.parts.spawn({ x: cx, y: y + 0.05, vx: rand(-2, 2), vy: rand(0.5, 3), life: rand(0.2, 0.5), size: 0.03, c: [3, 1.5, 0.4], col: 1 });
  } else if (m.kind === 'assembler') {
    A(cx, y + h / 2, w, h, 0, mul(C.steel, 0.55), 1, 0, md, 6); A(cx, y + h * 0.56, w * 0.62, h * 0.34, 0, [0.012, 0.014, 0.018]); A(cx, y + h + 0.04, w * 0.9, 0.08, 0, C.dark);
    const ax = cx + Math.sin(time * 2.2 + m.seed) * w * 0.22 * (on ? 1 : 0.1); b.seg(ax, y + h * 0.7, ax, y + h * 0.48, 0.05, tint(C.steel), a, 0, md);
    if (on && Math.sin(time * 9 + m.seed) > 0.6) { b.add(ax, y + h * 0.46, 0.5, 0.5, 0, [2.5, 4, 5], 0.9, 1, 2); light.emit(m.x + 1.5, m.y + 1, 0.5, 0.8, 1.0); }
    if (!ghost) b.add(x + 0.14, y + h - 0.14, 0.06, 0.06, 0, mul(on ? C.amber : C.hot, 2.5), 1, 1, 2);
  } else if (m.kind === 'pad') {
    A(cx, y + 0.12, w, 0.24, 0, mul(C.steel, 0.6), 1, 0, md, 7); const gx = x + 0.3, gh = 11;
    A(gx, y + gh / 2, 0.12, gh, 0, mul(C.steel, 0.7), 1, 0, md, 8); A(gx + 0.5, y + gh / 2, 0.08, gh, 0, mul(C.steel, 0.5), 1, 0, md, 9);
    for (let i = 0; i < 11; i++) b.seg(gx, y + i, gx + 0.5, y + i + 1, 0.035, tint(mul(C.steel, 0.5)), a, 0, md);
    if (!ghost) { for (let i = 0; i < 3; i++) { const ly = y + 2.5 + i * 3.8; b.add(gx + 0.25, ly, 0.09, 0.09, 0, mul(C.amber, 3), 1, 1, 2); b.add(gx + 0.25, ly, 0.9, 0.9, 0, mul(C.amber, 0.25), 1, 1, 2); light.emit(m.x + 1, ly / TS, 0.45, 0.22, 0.05); }
      drawRocket(b, cx + 0.3, y + 0.24, m.n); if (m.n < ROCKET_PARTS && m.n > 0) b.seg(gx + 0.5, y + m.n * SEC_H + 0.6, cx - 0.4, y + m.n * SEC_H + 0.4, 0.05, C.steel, 1, 0, 1); }
  } else if (m.kind === 'bio-printer') {
    const p = 0.7 + 0.3 * Math.sin(time * 1.5); A(cx, y + 0.15, w, 0.3, 0, mul(C.steel, 0.6), 1, 0, md, 2); A(cx, y + h - 0.1, w, 0.2, 0, mul(C.steel, 0.6), 1, 0, md, 3);
    b.add(cx, y + h / 2, w * 0.6, h - 0.5, 0, mul(C.cyan, 0.12 * p), a, 0, 2); if (!ghost) { b.add(cx, y + h / 2, 0.16, h - 0.7, 0, mul(C.cyan, 0.9 * p), 0.8, 1, 2); light.emit(m.x + 1, m.y + 1.5, 0.02 * p, 0.5 * p, 0.36 * p); }
  } else if (m.kind === 'antenna') {     // the network: a mast, two cross-arms, a dish that turns to listen, a light that says it is up
    const p = 0.5 + 0.5 * Math.sin(time * 2.2 + m.seed), top = y + h + 0.5;
    A(cx, y + 0.12, 0.42, 0.24, 0, mul(C.steel, 0.6), 1, 0, md, 2); b.seg(cx, y + 0.2, cx, top, 0.06, tint(C.steel), a, 0, md); for (const d of [-1, 1]) b.seg(cx, y + 1.1, cx + d * 0.4, y + 0.02, 0.018, tint(mul(C.steel, 0.6)), a, 0, md);
    for (let i = 0; i < 2; i++) b.seg(cx - 0.26 + i * 0.06, y + 1.5 + i * 0.5, cx + 0.26 - i * 0.06, y + 1.5 + i * 0.5, 0.03, tint(C.steel), a, 0, md);
    A(cx + 0.14 * Math.sin(time * 0.4 + m.seed), top - 0.25, 0.3, 0.22, 0.5 * Math.sin(time * 0.4 + m.seed), mul(C.hull, 0.5), 1, 8, md, 3);
    if (!ghost) { b.add(cx, top + 0.04, 0.07, 0.07, 0, mul(C.cyan, 1.5 + 2 * p), 1, 1, 2); b.add(cx, top, 1.4, 1.4, 0, mul(C.cyan, 0.16 * p), 1, 1, 2); light.emit(m.x + 0.5, top / TS, 0.02, 0.3 * p, 0.24 * p); }
  } else if (m.kind === 'chest') {
    A(cx, y + h * 0.4, w, h * 0.8, 0, mul(C.steel, 0.5), 1, 0, md, 3); A(cx, y + h * 0.8, w + 0.06, 0.1, 0, C.dark); A(cx, y + h * 0.45, 0.14, 0.1, 0, mul(C.steel, 1.4)); for (const s of [-1, 1]) A(cx + s * w * 0.36, y + h * 0.4, 0.05, h * 0.8, 0, C.dark);
    if (!ghost) b.add(cx, y + h * 0.62, 0.05, 0.05, 0, mul(C.amber, 1.6), 1, 1, 2);
  } else if (m.kind === 'hub') {
    const p = 0.6 + 0.4 * Math.sin(time * 3 + m.seed); A(cx, y + 0.2, w, 0.4, 0, mul(C.steel, 0.6), 1, 0, md, 5); A(cx, y + 0.6, w * 0.5, 0.5, 0, C.dark, 1, 0, md, 2); A(cx - w * 0.36, y + 0.75, 0.07, 1.1, 0, mul(C.steel, 0.8)); A(cx + w * 0.36, y + 0.75, 0.07, 1.1, 0, mul(C.steel, 0.8)); A(cx, y + 1.3, w * 0.86, 0.06, 0, C.steel);
    if (!ghost) { b.add(cx, y + 0.92, 0.3, 0.1, 0, mul(C.cyan, 1.5 * p), 1, 2, 2); b.add(cx, y + 1.36, 0.06, 0.06, 0, mul(C.amber, 2.5), 1, 1, 2); light.emit(m.x + 1, m.y + 2, 0.02, 0.25 * p, 0.2 * p); for (let i = 0; i < Math.min(m.drones | 0, 4); i++) b.add(x + 0.2 + i * 0.2, y + 1.42, 0.14, 0.08, 0, mul(C.hull, 0.7), 1, 0, 1, i); }
  }
  else if (F.drawExtra) F.drawExtra(b, m, time, a, ghost, A, md);
  if (!ghost && m.kind !== 'belt') { let i = 0; for (const id in m.out) { if (i < 4 && m.out[id] > 0.05) b.add(x + w - 0.14 - i * 0.2, y + h + 0.1, 0.16, 0.12, 0, ITEMS[id].c || C.steel, 1, 0, 1, i); i++; } }
}
export function drawFactory(b, time) {
  for (const m of F.machines) drawMachine(b, m, time);
  for (const it of F.items) { const c = ITEMS[it.id].c || C.steel, s = ITEMS[it.id].u === 'ea' ? 1.25 : 0.7 + 0.3 * Math.min(1, it.n / LUMP); b.add(it.x * TS, it.y * TS + 0.1, 0.22 * s, 0.17 * s, 0, c, 1, 0, 1, it.x | 0); b.add(it.x * TS, it.y * TS + 0.16, 0.14 * s, 0.03, 0, mul(c, 1.8), 0.6, 0, 1); }
}
// the scenario: the whole line placed and running, the pad half built
export function buildScenario() {
  const y = 0; world.box(-13, 0, 9, 13, -1); world.box(-13, -1.2, 9, 0, 1, M.BASALT); world.box(-11.9, -4, -10.6, -0.4, -1); world.box(-11.9, -4, -10.6, -0.4, 1, M.IRON);
  place('miner', -23, y, 1, true); for (let x = -21; x <= -17; x++) place('belt', x, y, 1, true);
  const fu = place('furnace', -16, y, 1, true); for (let x = -14; x <= -10; x++) place('belt', x, y, 1, true);
  const as = place('assembler', -9, y, 1, true); for (let x = -6; x <= -2; x++) place('belt', x, y, 1, true);
  const pad = place('pad', -1, y, 1, true); pad.n = 6; fu.inp['iron ore'] = 30; fu.inp.biomass = 4; as.inp.iron = 30; place('bio-printer', 9, y, 1, true);
  const ch = place('chest', 13, y, 1, true); inv.add(ch.inv, 'iron', 120); inv.add(ch.inv, 'copper', 40); inv.add(ch.inv, 'biomass', 30);
}
export function dumpFactory() { return { m: F.machines.map(m => ({ k: m.kind, x: m.x, y: m.y, d: m.dir, i: m.inp, o: m.out, t: +m.t.toFixed(3), n: m.n, hp: m.hp, r: m.recipe, dp: m.depth, dr: m.drones, b: m.busy ? 1 : 0, inv: m.inv ? inv.dump(m.inv) : undefined, dc: m.decon ? 1 : undefined, a: m.auto ? 1 : undefined, f: m.fast ? 1 : undefined, lg: m.leg || undefined, up: m.up || undefined, bin: m.bin ? 1 : undefined, x6: m.kind === 'shaft rig' ? { tg: m.target, hd: m.head, hs: m.hoist ? 1 : 0, br: m.branches, paid: m.paid, mk: m.muck || {} } : undefined, q: m.q ? [m.q.fe, m.q.cu, m.q.lm, m.q.host] : undefined, qi: m.qIn ? [m.qIn.fe, m.qIn.cu, m.qIn.lm, m.qIn.host, m.qIn.ox, m.qIn.oy] : undefined })), it: F.items.map(i => [i.id, i.n, +i.x.toFixed(3), +i.y.toFixed(3)]) }; }
export function loadFactory(o) {
  F.machines.length = 0; F.items.length = 0; F.cells.clear(); F.pad = F.printer = null; if (!o) return;
  for (const q of o.m) { const d = DEFS[q.k]; if (!d) continue; for (const src of [q.i, q.o]) for (const k in src || {}) if (!ITEMS[k]) delete src[k]; const m = { kind: q.k, x: q.x, y: q.y, w: d.w, h: d.h, dir: q.d, inp: q.i || {}, out: q.o || {}, t: q.t || 0, on: false, n: q.n || 0, hp: q.hp, seed: (q.x * 7.3 + q.y * 3.1) % 100, nt: 0.3, recipe: q.r, depth: q.dp, drones: q.dr, busy: !!q.b, decon: !!q.dc, auto: !!q.a }; if (q.f) m.fast = true; if (q.lg) m.leg = q.lg; if (q.up) m.up = q.up; if (m.kind === 'belt' && !DIRV[m.dir]) m.dir = 1; if (isBatch(m.kind) && !recipeOf(m)) m.recipe = BATCH0[m.kind];
    if (q.inv) m.inv = inv.load(makeInv(24), q.inv); for (let i = 0; i < d.w; i++) for (let j = 0; j < d.h; j++) F.cells.set(key(q.x + i, q.y + j), m); if (q.k === 'pad') F.pad = m; if (q.k === 'bio-printer') F.printer = m; if (q.x6) { m.target = q.x6.tg; m.head = q.x6.hd; m.hoist = !!q.x6.hs; m.branches = q.x6.br || []; m.paid = q.x6.paid || 0; m.muck = { ...(q.x6.mk || {}) }; for (const k in m.muck) if (!ITEMS[k]) delete m.muck[k]; } if (q.q) m.q = { fe: q.q[0], cu: q.q[1], lm: q.q[2], host: q.q[3] }; if (q.qi) m.qIn = { fe: q.qi[0], cu: q.qi[1], lm: q.qi[2], host: q.qi[3], ox: q.qi[4], oy: q.qi[5] }; F.machines.push(m); }
  for (const [id, n, x, y] of o.it) if (ITEMS[id]) F.items.push({ id, n, x, y: Number.isInteger(y) ? y + 0.3 : y });
}
export { RECIPES };

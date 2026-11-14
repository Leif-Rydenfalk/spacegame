// factory: machines on a 0.5 m placement grid, visibly working on continuous amounts. miner -> belt -> furnace ->
// belt -> assembler -> belt -> launch pad, where the rocket grows part by part. Each machine does a few things fast;
// the suit printer does everything slowly. Running machines make noise and pollution, and the hive hears both.
import { G, events, rand } from '../core.js';
import { audio } from '../audio.js';
import { world, TS, M, MAT } from './world.js';
import { light } from './light.js';
import { S, C, mul } from './state.js';
import { env } from './env.js';
import { ITEMS, RECIPE, RECIPES, makeInv, inv } from '../items.js';

// sink(cell x, row, item, n) -> what was not taken, or null when nothing takes items there (the ship hold's intake)
export const F = { machines: [], items: [], cells: new Map(), pad: null, printer: null, sink: null };
export const ROCKET_PARTS = 12;
// w, h in cells; takes = what it accepts; noise = audible radius while running; poll = pollution per second
export const DEFS = {
  belt: { w: 1, h: 1, hp: 40 },
  miner: { w: 2, h: 2, hp: 160, noise: 30, poll: 0.25 },
  furnace: { w: 2, h: 2, hp: 220, takes: ['iron ore', 'copper ore', 'biomass'], noise: 20, poll: 0.9 },
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
export function canPlace(kind, gx, gy) {
  const d = DEFS[kind]; let sup = 0;
  for (let i = 0; i < d.w; i++) { if (world.solidAt((gx + i + 0.5) * TS, gy * TS - 0.3)) sup++; for (let j = 0; j < d.h; j++) { if (F.cells.has(key(gx + i, gy + j))) return false; if (world.dens((gx + i + 0.5) * TS, (gy + j + 0.5) * TS) > (j === 0 ? 0.2 : 0.05)) return false; } }
  return sup >= Math.ceil(d.w * 0.6);
}
export function place(kind, gx, gy, dir = 1, quiet) {
  const d = DEFS[kind], m = { kind, x: gx, y: gy, w: d.w, h: d.h, dir, inp: {}, out: {}, t: 0, on: false, n: 0, hp: d.hp, seed: Math.random() * 100, nt: Math.random() };
  for (let i = 0; i < d.w; i++) for (let j = 0; j < d.h; j++) F.cells.set(key(gx + i, gy + j), m);
  world.box(gx * TS + 0.02, gy * TS, (gx + d.w) * TS - 0.02, (gy + d.h) * TS, -1); world.box(gx * TS, gy * TS - 0.3, (gx + d.w) * TS, gy * TS - 0.02, 1, M.PLATE);
  if (kind === 'chest') m.inv = makeInv(24); if (kind === 'assembler') m.recipe = 'part'; if (kind === 'miner') m.depth = 0.5; if (kind === 'hub') m.drones = 0;
  if (kind === 'pad') F.pad = m; if (kind === 'bio-printer') { F.printer = m; if (!quiet) events.emit('printerBuilt'); }
  F.machines.push(m); if (!quiet) { audio.play('place'); events.emit('built', kind); } return m;
}
export function removeMachine(m) {
  const i = F.machines.indexOf(m); if (i < 0) return; F.machines.splice(i, 1);
  for (let a = 0; a < m.w; a++) for (let b = 0; b < m.h; b++) F.cells.delete(key(m.x + a, m.y + b));
  if (F.pad === m) F.pad = null; if (F.printer === m) F.printer = F.machines.find(q => q.kind === 'bio-printer') || null; if (S.open === m) S.open = null;
}
export const accepts = (m, id) => {
  if (m.kind === 'chest') return true; if (m.kind === 'assembler') return RECIPE[m.recipe] && id in RECIPE[m.recipe].in && (m.inp[id] || 0) < RECIPE[m.recipe].in[id] * 4 + 1;
  const d = DEFS[m.kind]; return !!(d.takes && d.takes.includes(id)) && (m.inp[id] || 0) < 40 && !(m.kind === 'pad' && m.n >= ROCKET_PARTS);
};
const wants = (m, id) => m.kind === 'chest' || (m.kind === 'assembler' ? !!RECIPE[m.recipe] && id in RECIPE[m.recipe].in : !!(DEFS[m.kind].takes && DEFS[m.kind].takes.includes(id)));
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
  for (const s of S.inv.slots) if (s && accepts(m, s.id)) { const want = m.kind === 'assembler' ? RECIPE[m.recipe].in[s.id] * 4 - (m.inp[s.id] || 0) : m.kind === 'pad' ? ROCKET_PARTS - m.n : 40 - (m.inp[s.id] || 0), k = Math.min(s.n, Math.max(0, want)); if (k > 0) { const left = give(m, s.id, k); inv.take(S.inv, s.id, k - left); } }
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
      if (m.on) { m.t += dt * pw; if (m.t >= 0.25) { m.t = 0; const acc = {}, hx = (m.x + 1) * TS, hy = m.y * TS - m.depth; world.dig(hx, hy, 0.42, 0.06, acc, q => q >= M.XENO); let got = 0; for (const k in acc) { if (acc[k] > 0 && +k >= M.IRON && +k <= M.LUMEN) { push(m, MAT[k].item, acc[k]); got += acc[k]; m.oreId = MAT[k].item; } } if (got < 0.02) m.depth += 0.08; m.ore = got > 0.02; } }
    } else if (m.kind === 'furnace') {   // continuous smelting; biomass in the firebox makes it 2.5 times faster
      const r = m.inp['iron ore'] > 0.01 ? RECIPE.iron : m.inp['copper ore'] > 0.01 ? RECIPE.copper : null; m.on = !!r && outTotal(m) < 40 && pw > 0.05;
      if (m.on) { if (!m.lit) { m.lit = true; events.emit('furnaceLit'); } const ore = Object.keys(r.in)[0], fuel = m.inp.biomass > 0.001, kg = Math.min(dt / r.t * (fuel ? 2.5 : 1) * pw, m.inp[ore] / r.in[ore]); m.inp[ore] -= kg * r.in[ore]; if (fuel) m.inp.biomass = Math.max(0, m.inp.biomass - kg * 0.06); push(m, r.id, kg); m.fuel = fuel; }
    } else if (m.kind === 'assembler') {  // batches of its one recipe
      const r = RECIPE[m.recipe];
      if (!m.busy && r && outTotal(m) < 60) { let ok = true; for (const k in r.in) if ((m.inp[k] || 0) < r.in[k] - 1e-9) ok = false; if (ok) { for (const k in r.in) m.inp[k] -= r.in[k]; m.busy = true; m.t = 0; } }
      m.on = !!m.busy && pw > 0.05; if (m.busy) { m.t += dt * pw; if (m.t >= r.t) { m.busy = false; for (const k in r.out) push(m, k, r.out[k]); } }
    } else if (m.kind === 'hub') m.on = m.drones > 0 || (m.out.n | 0) > 0;
    if (m.on && d.noise) { m.nt -= dt; if (m.nt <= 0) { m.nt = 0.6; env.noise((m.x + m.w / 2) * TS, (m.y + 1) * TS, d.noise); env.pollute((m.x + 1) * TS, m.y * TS, d.poll * 0.6 * (m.kind === 'furnace' && !m.fuel ? 0.3 : 1)); } }
    if (m.kind !== 'belt' && m.kind !== 'chest') for (const id in m.out) {          // lumps onto a belt that leads away from either side
      const u = ITEMS[id].u, lump = u === 'ea' ? 1 : u === 'rd' ? Math.min(30, m.out[id]) : LUMP; if (m.out[id] < lump - 1e-9 && !(u !== 'ea' && !m.on && m.out[id] > 0.05)) continue;
      for (const [cx, dir] of [[m.x + m.w, 1], [m.x - 1, -1]]) { const b = F.cells.get(key(cx, m.y)); if (b && b.kind === 'belt' && b.dir === dir && !F.items.some(it => it.y === m.y && Math.abs(it.x - (cx + 0.5)) < 0.55)) { const n = Math.min(lump, m.out[id]); m.out[id] -= n; if (m.out[id] < 1e-9) delete m.out[id]; F.items.push({ id, n, x: cx + 0.5 - dir * 0.45, y: m.y }); break; } }
      break;
    }
  }
  for (let i = F.items.length - 1; i >= 0; i--) {
    const it = F.items[i], b = F.cells.get(key(Math.floor(it.x), it.y)); if (!b || b.kind !== 'belt') { F.items.splice(i, 1); continue; }
    const nx = it.x + b.dir * 3 * dt * (b.pw === undefined ? 1 : b.pw);                // 1.5 m/s on full power
    if (F.items.some(o => o !== it && o.y === it.y && (o.x - it.x) * b.dir > 0 && (o.x - nx) * b.dir < 0.5)) continue;
    if (Math.floor(nx) !== Math.floor(it.x)) {
      const n = F.cells.get(key(Math.floor(nx), it.y));
      if (!n && F.sink) { const left = F.sink(Math.floor(nx), it.y, it.id, it.n); if (left !== null) { it.n = left; if (it.n < 1e-9) { F.items.splice(i, 1); events.emit('firstAutomation'); } continue; } }
      if (!n || n.kind !== 'belt') { if (n && accepts(n, it.id)) { it.n = give(n, it.id, it.n); if (it.n < 1e-9) { F.items.splice(i, 1); events.emit('firstAutomation'); } } else if (n && !wants(n, it.id)) F.items.splice(i, 1); continue; }
    }
    it.x = nx;
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
    A(cx, y + 0.07, w, 0.14, 0, C.dark, 1, 0, md, m.x); if (!ghost) for (let i = 0; i < 2; i++) { const u = (tk * 0.5 + i * 0.5) % 1; A(x + (m.dir > 0 ? u : 1 - u) * w, y + 0.15, 0.05, 0.03, 0, mul(C.steel, 1.3)); }
    A(cx, y + 0.02, 0.08, 0.3, 0, mul(C.dark, 0.7)); if (ghost) A(cx + m.dir * 0.1, y + 0.25, 0.2, 0.04, 0, C.amber, 1, 0, 2);
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
  if (!ghost && m.kind !== 'belt') { let i = 0; for (const id in m.out) { if (i < 4 && m.out[id] > 0.05) b.add(x + w - 0.14 - i * 0.2, y + h + 0.1, 0.16, 0.12, 0, ITEMS[id].c || C.steel, 1, 0, 1, i); i++; } }
}
export function drawFactory(b, time) {
  for (const m of F.machines) drawMachine(b, m, time);
  for (const it of F.items) { const c = ITEMS[it.id].c || C.steel, s = ITEMS[it.id].u === 'ea' ? 1.25 : 0.7 + 0.3 * Math.min(1, it.n / LUMP); b.add(it.x * TS, it.y * TS + 0.25, 0.22 * s, 0.17 * s, 0, c, 1, 0, 1, it.x | 0); }
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
export function dumpFactory() { return { m: F.machines.map(m => ({ k: m.kind, x: m.x, y: m.y, d: m.dir, i: m.inp, o: m.out, t: +m.t.toFixed(3), n: m.n, hp: m.hp, r: m.recipe, dp: m.depth, dr: m.drones, b: m.busy ? 1 : 0, inv: m.inv ? inv.dump(m.inv) : undefined, dc: m.decon ? 1 : undefined, a: m.auto ? 1 : undefined })), it: F.items.map(i => [i.id, i.n, +i.x.toFixed(3), i.y]) }; }
export function loadFactory(o) {
  F.machines.length = 0; F.items.length = 0; F.cells.clear(); F.pad = F.printer = null; if (!o) return;
  for (const q of o.m) { const d = DEFS[q.k], m = { kind: q.k, x: q.x, y: q.y, w: d.w, h: d.h, dir: q.d, inp: q.i || {}, out: q.o || {}, t: q.t || 0, on: false, n: q.n || 0, hp: q.hp, seed: (q.x * 7.3 + q.y * 3.1) % 100, nt: 0.3, recipe: q.r, depth: q.dp, drones: q.dr, busy: !!q.b, decon: !!q.dc, auto: !!q.a };
    if (q.inv) m.inv = inv.load(makeInv(24), q.inv); for (let i = 0; i < d.w; i++) for (let j = 0; j < d.h; j++) F.cells.set(key(q.x + i, q.y + j), m); if (q.k === 'pad') F.pad = m; if (q.k === 'bio-printer') F.printer = m; F.machines.push(m); }
  for (const [id, n, x, y] of o.it) F.items.push({ id, n, x, y });
}
export { RECIPES };

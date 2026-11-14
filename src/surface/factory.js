// factory: machines placed in the world and visibly working. drill -> conveyor -> furnace -> conveyor -> assembler
// -> conveyor -> launch pad, where the rocket grows part by part. The bio-printer is the respawn point.
import { G, events, rand } from '../core.js';
import { audio } from '../audio.js';
import { world, TS, WALL, isSolid, DROP } from './world.js';
import { light } from './light.js';
import { S, C, mul } from './state.js';

export const F = { machines: [], items: [], cells: new Map(), pad: null, printer: null };
export const ROCKET_PARTS = 12;
export const DEFS = {
  plate: { cost: { iron: 1 } },
  furnace: { w: 2, h: 2, cost: { basalt: 8 }, takes: ['iron ore', 'copper ore'] },
  drill: { w: 2, h: 2, cost: { iron: 4 } },
  'belt >': { w: 1, h: 1, cost: { iron: 1 }, dir: 1 }, 'belt <': { w: 1, h: 1, cost: { iron: 1 }, dir: -1 },
  assembler: { w: 3, h: 2, cost: { iron: 6, copper: 2 }, takes: ['iron'] },
  pad: { w: 7, h: 1, cost: { iron: 10 }, takes: ['part'] },
  'bio-printer': { w: 2, h: 3, cost: { iron: 8, copper: 4, lumen: 6 } },
};
export const BUILD = Object.keys(DEFS);
const key = (x, y) => (x + 32768) * 65536 + (y + 32768);
export function canPlace(kind, tx, ty) {
  const d = DEFS[kind]; if (kind === 'plate') return !isSolid(world.get(tx, ty));
  for (let i = 0; i < d.w; i++) { if (!world.solid(tx + i, ty - 1)) return false; for (let j = 0; j < d.h; j++) if (world.solid(tx + i, ty + j) || F.cells.has(key(tx + i, ty + j))) return false; }
  return true;
}
export function place(kind, tx, ty) {
  const d = DEFS[kind], belt = kind.startsWith('belt');
  const m = { kind: belt ? 'belt' : kind, x: tx, y: ty, w: d.w, h: d.h, dir: d.dir || 1, inp: {}, out: [], t: 0, on: false, n: 0, seed: Math.random() * 100 };
  for (let i = 0; i < d.w; i++) for (let j = 0; j < d.h; j++) { F.cells.set(key(tx + i, ty + j), m); world.set(tx + i, ty + j, world.get(tx + i, ty + j) & WALL); }
  if (kind === 'drill') { for (let i = 0; i < 2 && !m.ore; i++) for (let j = 1; j < 4 && !m.ore; j++) { const k = world.get(tx + i, ty - j) & 31; if (k >= 5 && k <= 7) m.ore = DROP[k]; } }
  if (kind === 'pad') F.pad = m; if (kind === 'bio-printer') { F.printer = m; events.emit('printerBuilt'); }
  F.machines.push(m); return m;
}
export function tryPlace(kind, tx, ty) {
  const d = DEFS[kind]; if (!S.has(d.cost) || !canPlace(kind, tx, ty)) { audio.play('click'); return; }
  S.pay(d.cost); audio.play('place');
  if (kind === 'plate') world.set(tx, ty, 13 | (world.get(tx, ty) & WALL)); else place(kind, tx, ty);
}
const accepts = (m, kind) => { const d = DEFS[m.kind]; return d && d.takes && d.takes.includes(kind) && (m.inp[kind] || 0) < 8; };
function give(m, kind) { m.inp[kind] = (m.inp[kind] || 0) + 1; if (m.kind === 'pad') { m.n = Math.min(ROCKET_PARTS, m.n + 1); m.inp = {}; audio.play('place'); } }
// E: put what the machine takes, take what it made; the finished pad is boarded instead
export function interact() {
  const P = S.P; let best = null, bd = 3.2;
  for (const m of F.machines) { if (m.kind === 'belt') continue; const d = Math.hypot((m.x + m.w / 2) * TS - P.x, (m.y + m.h / 2) * TS - P.y - 0.9); if (d < bd) { bd = d; best = m; } }
  if (!best) return null;
  if (best.kind === 'pad' && best.n >= ROCKET_PARTS) return 'board';
  const d = DEFS[best.kind];
  if (d.takes) for (const k of d.takes) while ((S.inv[k] || 0) > 0 && (best.inp[k] || 0) < 20 && !(best.kind === 'pad' && best.n >= ROCKET_PARTS)) { S.add(k, -1); give(best, k); }
  for (const o of best.out) S.add(o); best.out.length = 0; audio.play('click'); return null;
}
export function stepFactory(dt) {
  for (const m of F.machines) {
    if (m.kind === 'drill') { m.on = !!m.ore && m.out.length < 4; if (m.on) { m.t += dt; if (m.t >= 3) { m.t = 0; m.out.push(m.ore); } } }
    else if (m.kind === 'furnace') {
      const ore = m.inp['iron ore'] ? 'iron ore' : m.inp['copper ore'] ? 'copper ore' : null; m.on = !!ore && m.out.length < 6;
      if (m.on) { if (!m.lit) { m.lit = true; events.emit('furnaceLit'); } m.t += dt; if (m.t >= 5) { m.t = 0; m.inp[ore]--; m.out.push(ore === 'iron ore' ? 'iron' : 'copper'); } }
    } else if (m.kind === 'assembler') { m.on = (m.inp.iron || 0) >= 2 && m.out.length < 4; if (m.on) { m.t += dt; if (m.t >= 4) { m.t = 0; m.inp.iron -= 2; m.out.push('part'); } } }
    if (m.out.length && m.kind !== 'belt') {       // push onto a belt that leads away from either side
      for (const [cx, dir] of [[m.x + m.w, 1], [m.x - 1, -1]]) { const b = F.cells.get(key(cx, m.y)); if (b && b.kind === 'belt' && b.dir === dir && !F.items.some(it => it.y === m.y && Math.abs(it.x - (cx + 0.5)) < 0.55)) { F.items.push({ kind: m.out.shift(), x: cx + 0.5 - dir * 0.45, y: m.y }); break; } }
    }
  }
  for (let i = F.items.length - 1; i >= 0; i--) {
    const it = F.items[i], b = F.cells.get(key(Math.floor(it.x), it.y)); if (!b || b.kind !== 'belt') { F.items.splice(i, 1); continue; }
    let nx = it.x + b.dir * 3 * dt;                                                 // 1.5 m/s
    if (F.items.some(o => o !== it && o.y === it.y && (o.x - it.x) * b.dir > 0 && (o.x - nx) * b.dir < 0.5)) continue;
    if (Math.floor(nx) !== Math.floor(it.x)) {
      const n = F.cells.get(key(Math.floor(nx), it.y));
      if (!n || n.kind !== 'belt') { if (n && accepts(n, it.kind)) { give(n, it.kind); F.items.splice(i, 1); events.emit('firstAutomation'); } continue; }
    }
    it.x = nx;
  }
}
const ITEMC = { 'iron ore': [0.3, 0.12, 0.06], 'copper ore': [0.1, 0.3, 0.2], iron: [0.42, 0.45, 0.48], copper: [0.6, 0.3, 0.1], part: [0.55, 0.6, 0.64], lumen: [0.1, 0.8, 1] };
// rocket silhouette: width (m) of each stacked section, bottom to top; the pad shows the first n
export const ROCKET_W = [1.0, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.25, 0.85, 0.4], SEC_H = 0.95;
export function drawRocket(b, x, y, n, mode = 1) {
  for (let i = 0; i < n; i++) { const w = ROCKET_W[i], yy = y + i * SEC_H + SEC_H / 2; b.add(x, yy, w, SEC_H - 0.04, 0, i === 0 ? C.dark : mul(C.hull, i % 4 === 1 ? 0.8 : 1), 1, 0, mode, i + 3); if (i === 9) b.add(x, yy, 0.5, 0.3, 0, mul(C.amber, 0.9), 1, 2, 2); }
}
export function drawFactory(b, time) {
  const tk = (time * 3) % 1;
  for (const m of F.machines) {
    const x = m.x * TS, y = m.y * TS, w = m.w * TS, h = m.h * TS, cx = x + w / 2;
    if (m.kind === 'belt') {
      b.add(cx, y + 0.07, w, 0.14, 0, C.dark, 1, 0, 1, m.x); for (let i = 0; i < 2; i++) { const u = (tk * 0.5 + i * 0.5) % 1; b.add(x + (m.dir > 0 ? u : 1 - u) * w, y + 0.15, 0.05, 0.03, 0, mul(C.steel, 1.3), 1, 0, 1); }
      b.add(cx, y + 0.02, 0.08, 0.3, 0, mul(C.dark, 0.7), 1, 0, 1);
    } else if (m.kind === 'furnace') {
      const fl = m.on ? 0.75 + 0.25 * Math.sin(time * 13 + m.seed) * Math.sin(time * 7.3) : 0.04;
      b.add(cx, y + h / 2, w, h, 0, [0.085, 0.07, 0.068], 1, 0, 1, 1); b.add(cx + 0.28, y + h + 0.3, 0.26, 0.62, 0, [0.07, 0.06, 0.06], 1, 0, 1, 2); b.add(cx, y + h - 0.05, w + 0.08, 0.1, 0, C.dark, 1, 0, 1);
      b.add(cx - 0.12, y + 0.32, 0.5, 0.34, 0, mul([1, 0.3, 0.06], 4 * fl), 1, 2, 2); b.add(cx - 0.12, y + 0.3, 1.5, 1.1, 0, mul([1, 0.3, 0.06], 0.7 * fl), 1, 1, 2);
      if (m.on) { light.emit(m.x + 0.5, m.y + 0.6, 2.4 * fl, 0.8 * fl, 0.2 * fl); if (Math.random() < 0.25) S.parts.spawn({ x: cx + 0.28, y: y + h + 0.6, vx: rand(-0.2, 0.3), vy: rand(0.6, 1.3), life: rand(2, 4), size: rand(0.2, 0.4), grow: 2.5, c: [0.1, 0.09, 0.09], mode: 1, a: 0.3, grav: -0.02, drag: 0.4 }); if (Math.random() < 0.08) S.parts.spawn({ x: cx + 0.28, y: y + h + 0.6, vx: rand(-0.8, 0.8), vy: rand(1, 3), life: rand(0.5, 1.4), size: 0.035, c: [4, 1.5, 0.3], grav: 0.2 }); }
    } else if (m.kind === 'drill') {
      const vib = m.on ? Math.sin(time * 60) * 0.012 : 0;
      b.seg(x + 0.06, y, cx, y + h + 0.5, 0.07, C.steel, 1, 0, 1); b.seg(x + w - 0.06, y, cx, y + h + 0.5, 0.07, C.steel, 1, 0, 1); b.add(cx, y + h * 0.72, 0.5, 0.34, 0, mul(C.steel, 0.7), 1, 0, 1, 4);
      b.add(cx + vib, y + 0.3, 0.12, 0.75, 0, C.dark, 1, 0, 1, 5); b.add(cx, y + h + 0.5, 0.07, 0.07, 0, mul(C.amber, m.on ? 3 : 0.4), 1, 1, 2);
      if (m.on && Math.random() < 0.3) S.parts.spawn({ x: cx, y: y + 0.05, vx: rand(-2, 2), vy: rand(0.5, 3), life: rand(0.2, 0.5), size: 0.03, c: [3, 1.5, 0.4], col: 1 });
    } else if (m.kind === 'assembler') {
      b.add(cx, y + h / 2, w, h, 0, mul(C.steel, 0.55), 1, 0, 1, 6); b.add(cx, y + h * 0.56, w * 0.62, h * 0.34, 0, [0.012, 0.014, 0.018], 1, 0, 1); b.add(cx, y + h + 0.04, w * 0.9, 0.08, 0, C.dark, 1, 0, 1);
      const ax = cx + Math.sin(time * 2.2 + m.seed) * w * 0.22 * (m.on ? 1 : 0.1); b.seg(ax, y + h * 0.7, ax, y + h * 0.48, 0.05, C.steel, 1, 0, 1);
      if (m.on && Math.sin(time * 9 + m.seed) > 0.6) { b.add(ax, y + h * 0.46, 0.5, 0.5, 0, [2.5, 4, 5], 0.9, 1, 2); light.emit(m.x + 1.5, m.y + 1, 0.5, 0.8, 1.0); }
      b.add(x + 0.14, y + h - 0.14, 0.06, 0.06, 0, mul(m.on ? C.amber : C.hot, 2.5), 1, 1, 2);
    } else if (m.kind === 'pad') {
      b.add(cx, y + 0.12, w, 0.24, 0, mul(C.steel, 0.6), 1, 0, 1, 7); const gx = x + 0.3, gh = 11;
      b.add(gx, y + gh / 2, 0.12, gh, 0, mul(C.steel, 0.7), 1, 0, 1, 8); b.add(gx + 0.5, y + gh / 2, 0.08, gh, 0, mul(C.steel, 0.5), 1, 0, 1, 9);
      for (let i = 0; i < 11; i++) b.seg(gx, y + i, gx + 0.5, y + i + 1, 0.035, mul(C.steel, 0.5), 1, 0, 1);
      for (let i = 0; i < 3; i++) { const ly = y + 2.5 + i * 3.8; b.add(gx + 0.25, ly, 0.09, 0.09, 0, mul(C.amber, 3), 1, 1, 2); b.add(gx + 0.25, ly, 0.9, 0.9, 0, mul(C.amber, 0.25), 1, 1, 2); light.emit(m.x + 1, ly / TS, 0.45, 0.22, 0.05); }
      drawRocket(b, cx + 0.3, y + 0.24, m.n); if (m.n < ROCKET_PARTS && m.n > 0) b.seg(gx + 0.5, y + m.n * SEC_H + 0.6, cx - 0.4, y + m.n * SEC_H + 0.4, 0.05, C.steel, 1, 0, 1);
    } else if (m.kind === 'bio-printer') {
      const p = 0.7 + 0.3 * Math.sin(time * 1.5); b.add(cx, y + 0.15, w, 0.3, 0, mul(C.steel, 0.6), 1, 0, 1, 2); b.add(cx, y + h - 0.1, w, 0.2, 0, mul(C.steel, 0.6), 1, 0, 1, 3);
      b.add(cx, y + h / 2, w * 0.6, h - 0.5, 0, mul(C.cyan, 0.12 * p), 1, 0, 2); b.add(cx, y + h / 2, 0.16, h - 0.7, 0, mul(C.cyan, 0.9 * p), 0.8, 1, 2); light.emit(m.x + 1, m.y + 1.5, 0.02 * p, 0.5 * p, 0.36 * p);
    }
    for (let i = 0; i < Math.min(m.out.length, 4) && m.kind !== 'belt'; i++) b.add(x + w - 0.14 - i * 0.2, y + h + 0.1, 0.16, 0.12, 0, ITEMC[m.out[i]] || C.steel, 1, 0, 1, i);
  }
  for (const it of F.items) b.add(it.x * TS, it.y * TS + 0.25, 0.22, 0.17, 0, ITEMC[it.kind] || C.steel, 1, 0, 1, it.x | 0);
}
// the scenario: the whole line placed and running, the pad half built
export function buildScenario() {
  const y = 1; for (let x = -24; x <= 16; x++) for (let j = 1; j < 26; j++) if ((world.get(x, j) & 31) > 0) world.set(x, j, 0);
  for (let i = -23; i <= -22; i++) for (let j = 0; j >= -2; j--) world.set(i, j, 5 | WALL);
  place('drill', -23, y); for (let x = -21; x <= -17; x++) place('belt >', x, y);
  const fu = place('furnace', -16, y); for (let x = -14; x <= -10; x++) place('belt >', x, y);
  const as = place('assembler', -9, y); for (let x = -6; x <= -2; x++) place('belt >', x, y);
  const pad = place('pad', -1, y); pad.n = 6; fu.inp['iron ore'] = 5; as.inp.iron = 3; place('bio-printer', 9, y);
  Object.assign(S.inv, { iron: 12, copper: 6, basalt: 10, part: 6 });
}

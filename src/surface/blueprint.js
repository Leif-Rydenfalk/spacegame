// blueprint mode (B): place ghost buildings with rotation and cost, queue them, cancel them, mark machines for
// deconstruction (X) and designate terrain to clear (T, drag). Robots work the queue; within arm's reach the suit
// builds by hand, slowly.
import { G, input, events, rand } from '../core.js';
import { audio } from '../audio.js';
import { world, TS, M, MAT, SLAB } from './world.js';
import { light } from './light.js';
import { S, C, mul } from './state.js';
import { env } from './env.js';
import { inv, ITEMS } from '../items.js';
import { F, DEFS, canPlace, place, removeMachine, machineAt, drawMachine } from './factory.js';

export const WALL_KG = +(MAT[M.PLATE].rho * SLAB * TS * TS).toFixed(3);       // iron in one 0.5 m wall block
export const BUILD = ['belt', 'miner', 'furnace', 'assembler', 'chest', 'hub', 'bio-printer', 'pad', 'wall'];
export const BUILD_T = { belt: 0.6, wall: 0.5, miner: 3, furnace: 3, assembler: 4, chest: 2, hub: 4, 'bio-printer': 6, pad: 8 };
export const costOf = k => k === 'wall' ? { iron: WALL_KG } : { [k]: 1 };
export const BP = { ghosts: [], clears: [], sel: 0, rot: 1, tool: 'place', drag: null, hand: null, nextId: 1 };
const foot = k => k === 'wall' ? { w: 1, h: 1 } : DEFS[k];
const overlaps = (k, gx, gy) => { const d = foot(k); return BP.ghosts.some(g => { const e = foot(g.kind); return gx < g.x + e.w && gx + d.w > g.x && gy < g.y + e.h && gy + d.h > g.y; }); };
// a spot is supported by ground, by a machine, or by a queued ghost below it
export function canGhost(k, gx, gy) {
  if (overlaps(k, gx, gy)) return false;
  if (k === 'wall') return !machineAt(gx, gy) && world.dens((gx + 0.5) * TS, (gy + 0.5) * TS) < 0.1;
  return canPlace(k, gx, gy);
}
export function addGhost(kind, x, y, dir = 1) { const g = { id: BP.nextId++, kind, x, y, dir, prog: 0, claim: null, have: false }; BP.ghosts.push(g); return g; }
export function finishGhost(g) {
  const i = BP.ghosts.indexOf(g); if (i >= 0) BP.ghosts.splice(i, 1);
  if (g.kind === 'wall') world.box(g.x * TS, g.y * TS, (g.x + 1) * TS, (g.y + 1) * TS, 1, M.PLATE); else place(g.kind, g.x, g.y, g.dir);
  events.emit('blueprintBuilt', g.kind);
}
export function cancelGhost(g) { const i = BP.ghosts.indexOf(g); if (i >= 0) BP.ghosts.splice(i, 1); if (g.have) { const c = costOf(g.kind); for (const k in c) S.add(k, c[k]); } g.dead = true; }
// taking a machine apart gives its kit back, and whatever was in it
export function dismantle(m, into) {
  removeMachine(m); inv.add(into, m.kind, 1); for (const src of [m.inp, m.out]) for (const k in src) if (src[k] > 0 && ITEMS[k]) inv.add(into, k, src[k]);
  if (m.inv) for (const s of m.inv.slots) if (s) inv.add(into, s.id, s.n); if (m.drones) inv.add(into, 'drone', m.drones); audio.play('click');
}
export function stepBlueprint(dt) {
  const P = S.P, gx = Math.floor(S.mouse.x / TS), gy = Math.floor(S.mouse.y / TS);
  if (input.hit('b') && !S.uiOpen) { S.mode = S.mode === 'blueprint' ? 'build' : 'blueprint'; BP.tool = 'place'; BP.drag = null; audio.play('click'); events.emit('blueprintMode'); }
  if (S.mode === 'blueprint' && !S.uiOpen) {
    for (let i = 0; i < BUILD.length; i++) if (input.hit(String(i + 1))) { BP.sel = i; BP.tool = 'place'; }
    if (input.wheel) { BP.sel = (BP.sel + (input.wheel > 0 ? 1 : BUILD.length - 1)) % BUILD.length; BP.tool = 'place'; }
    if (input.hit('r')) { BP.rot = -BP.rot; audio.play('click'); }
    if (input.hit('x')) BP.tool = BP.tool === 'decon' ? 'place' : 'decon';
    if (input.hit('t')) BP.tool = BP.tool === 'clear' ? 'place' : 'clear';
    const k = BUILD[BP.sel], d = foot(k), ox = gx - Math.floor((d.w - 1) / 2);
    if (BP.tool === 'place') { if ((input.clicked[0] || (input.down[0] && (k === 'belt' || k === 'wall'))) && canGhost(k, ox, gy)) { addGhost(k, ox, gy, BP.rot); audio.play('click'); } }
    else if (BP.tool === 'decon') { const m = machineAt(gx, gy); if (input.clicked[0] && m) { m.decon = !m.decon; audio.play('click'); } }
    else if (BP.tool === 'clear') {
      if (input.clicked[0]) BP.drag = { x: gx, y: gy };
      if (BP.drag && !input.down[0]) { const x0 = Math.min(BP.drag.x, gx), y0 = Math.min(BP.drag.y, gy), x1 = Math.max(BP.drag.x, gx) + 1, y1 = Math.max(BP.drag.y, gy) + 1; if ((x1 - x0) * (y1 - y0) <= 400) BP.clears.push({ id: BP.nextId++, x0: x0 * TS, y0: y0 * TS, x1: x1 * TS, y1: y1 * TS, claim: null, cur: 0 }); else S.say('area too large'); BP.drag = null; audio.play('click'); }
    }
    if (input.clicked[2]) {       // cancel whatever is under the cursor
      const g = BP.ghosts.find(q => { const e = foot(q.kind); return gx >= q.x && gx < q.x + e.w && gy >= q.y && gy < q.y + e.h; }); if (g) cancelGhost(g);
      const ci = BP.clears.findIndex(c => S.mouse.x >= c.x0 && S.mouse.x < c.x1 && S.mouse.y >= c.y0 && S.mouse.y < c.y1); if (ci >= 0) { BP.clears[ci].dead = true; BP.clears.splice(ci, 1); }
      const m = machineAt(gx, gy); if (m && m.decon) m.decon = false;
    }
  }
  // the suit builds the nearest unclaimed ghost in reach by hand, and takes apart marked machines in reach
  BP.hand = null; if (P.dead) return;
  let best = null, bd = 4.2;
  for (const g of BP.ghosts) { if (g.claim) continue; const e = foot(g.kind), d = Math.hypot((g.x + e.w / 2) * TS - P.x, (g.y + e.h / 2) * TS - P.y - 0.9); if (d < bd && (g.have || S.has(costOf(g.kind)))) { bd = d; best = g; } }
  if (best) {
    if (!best.have) { S.pay(costOf(best.kind)); best.have = true; }
    best.prog += dt / (BUILD_T[best.kind] * 2.5); BP.hand = best; weld((best.x + foot(best.kind).w / 2) * TS, (best.y + 0.5) * TS, dt);
    if (best.prog >= 1) finishGhost(best);
  } else for (const m of F.machines) if (m.decon && !m.claim && Math.hypot((m.x + m.w / 2) * TS - P.x, (m.y + m.h / 2) * TS - P.y - 0.9) < 4.2) { m.dp = (m.dp || 0) + dt / 2.5; BP.hand = m; weld((m.x + m.w / 2) * TS, (m.y + 0.5) * TS, dt); if (m.dp >= 1) dismantle(m, S.inv); break; }
}
export function weld(x, y, dt) {
  if (Math.random() < dt * 30) S.parts.spawn({ x: x + rand(-0.3, 0.3), y: y + rand(-0.2, 0.4), vx: rand(-3, 3), vy: rand(0, 4), life: rand(0.15, 0.5), size: rand(0.02, 0.05), c: [2.5, 4, 5], c2: [0.3, 0.6, 1], col: 1, bounce: 0.4 });
  if (Math.random() < dt * 20) S.lights.push({ x: x / TS, y: y / TS, c: [0.5, 0.9, 1.2], t: 0.05 });
  if (Math.random() < dt * 2) env.noise(x, y, 12);
}
export function drawBlueprint(b, time) {
  const pulse = 0.55 + 0.25 * Math.sin(time * 4);
  for (const g of BP.ghosts) {
    const e = foot(g.kind), x = g.x * TS, y = g.y * TS, w = e.w * TS, h = e.h * TS;
    if (g.kind === 'wall') b.add(x + w / 2, y + h / 2, w - 0.04, h - 0.04, 0, [0.05, 0.25, 0.3], 0.5 + g.prog * 0.5, 0, 2, g.x);
    else drawMachine(b, { kind: g.kind, x: g.x, y: g.y, w: e.w, h: e.h, dir: g.dir, out: {}, n: 0, seed: 0 }, time, 0.45 + g.prog * 0.5, true);
    if (g.prog > 0) { b.add(x + w / 2, y + h * g.prog, w, 0.04, 0, [1, 2.2, 2.6], 0.9, 0, 2); b.add(x + w / 2, y + h * g.prog, w + 0.6, 0.5, 0, [0.2, 0.6, 0.8], 0.5, 1, 2); light.emit(g.x + e.w / 2, g.y + 1, 0.1, 0.35, 0.45); }
  }
  for (const m of F.machines) if (m.decon) { const x = m.x * TS, y = m.y * TS, w = m.w * TS, h = m.h * TS; b.seg(x, y, x + w, y + h, 0.04, mul(C.red, 2), pulse, 0, 2); b.seg(x, y + h, x + w, y, 0.04, mul(C.red, 2), pulse, 0, 2); }
  for (const c of BP.clears) { const w = c.x1 - c.x0, h = c.y1 - c.y0; b.add(c.x0 + w / 2, c.y0 + h / 2, w, h, 0, [0.3, 0.12, 0.02], 0.08 * pulse, 0, 2); for (const [ax, ay, bx, by] of [[c.x0, c.y0, c.x1, c.y0], [c.x1, c.y0, c.x1, c.y1], [c.x1, c.y1, c.x0, c.y1], [c.x0, c.y1, c.x0, c.y0]]) b.seg(ax, ay, bx, by, 0.03, mul(C.amber, 1.5), 0.8, 0, 2); }
  if (S.mode === 'blueprint' && !S.uiOpen) {
    const gx = Math.floor(S.mouse.x / TS), gy = Math.floor(S.mouse.y / TS);
    if (BP.tool === 'place') { const k = BUILD[BP.sel], d = foot(k), ox = gx - Math.floor((d.w - 1) / 2), ok = canGhost(k, ox, gy);
      if (k === 'wall') b.add((ox + 0.5) * TS, (gy + 0.5) * TS, TS, TS, 0, ok ? [0.1, 0.5, 0.6] : [0.6, 0.05, 0.03], 0.6, 0, 2);
      else { drawMachine(b, { kind: k, x: ox, y: gy, w: d.w, h: d.h, dir: BP.rot, out: {}, n: 0, seed: 0 }, time, ok ? 0.7 : 0.25, true); if (!ok) b.add((ox + d.w / 2) * TS, (gy + d.h / 2) * TS, d.w * TS, d.h * TS, 0, [0.5, 0.03, 0.02], 0.35, 0, 2); } }
    else if (BP.tool === 'clear' && BP.drag) { const x0 = Math.min(BP.drag.x, gx) * TS, y0 = Math.min(BP.drag.y, gy) * TS, x1 = (Math.max(BP.drag.x, gx) + 1) * TS, y1 = (Math.max(BP.drag.y, gy) + 1) * TS; b.add((x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, y1 - y0, 0, [0.4, 0.16, 0.02], 0.35, 0, 2); }
  }
}
export function dumpBP() { return { g: BP.ghosts.map(g => [g.kind, g.x, g.y, g.dir, +g.prog.toFixed(3), g.have ? 1 : 0]), c: BP.clears.map(c => [c.x0, c.y0, c.x1, c.y1]) }; }
export function loadBP(o) { BP.ghosts.length = 0; BP.clears.length = 0; if (!o) return; for (const [k, x, y, d, p, h] of o.g) { const g = addGhost(k, x, y, d); g.prog = p; g.have = !!h; } for (const [x0, y0, x1, y1] of o.c) BP.clears.push({ id: BP.nextId++, x0, y0, x1, y1, claim: null, cur: 0 }); }

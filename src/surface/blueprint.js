// placing things, the way Factorio does it. One inventory: a furnace is an item you craft (the arm, slowly) or the
// base makes, it lies in a slot, and with that slot selected the left button puts it down and the item is gone.
// Tab is blueprint mode, for planning: the same items, the same cursor, the same keys, but what you do not hold goes
// down as a ghost, clearly a drawing and not a machine, and every ghost is an order the ship AI has made, carried and
// built (auto.js, robots.js). What you do hold is still placed for real. The right button takes back: a ghost is
// cancelled, a machine is marked to be taken apart (the suit does it within reach, robots anywhere), a deck is lifted.
// Q is the pipette: it puts what is under the cursor on the cursor, or clears the cursor. R turns a belt round. In
// blueprint mode T drags a rectangle of ground for the robots to cut out.
import { G, input, events, rand } from '../core.js';
import { audio } from '../audio.js';
import { world, TS, M, MAT, SLAB } from './world.js';
import { light } from './light.js';
import { S, C, mul } from './state.js';
import { env } from './env.js';
import { inv, ITEMS, RECIPE } from '../items.js';
import { F, DEFS, canPlace, place, removeMachine, machineAt, drawMachine } from './factory.js';
import { platAt, addPlat, removePlat, canPlat, drawDeck } from './layers.js';

export const WALL_KG = +(MAT[M.PLATE].rho * SLAB * TS * TS).toFixed(3);       // iron in one 0.5 m wall block
export const BUILD = ['belt', 'miner', 'furnace', 'assembler', 'chest', 'hub', 'antenna', 'platform', 'wall', 'bio-printer', 'pad'];
export const BUILD_T = { belt: 0.6, wall: 0.5, platform: 0.4, miner: 3, furnace: 3, assembler: 4, chest: 2, hub: 4, 'bio-printer': 6, pad: 8, antenna: 2 };
export const REACH = 8;                       // metres the hands place at
export const costOf = k => k === 'wall' ? { iron: WALL_KG } : { [k]: 1 };
export const BP = { ghosts: [], clears: [], rot: 1, drag: null, hand: null, nextId: 1 };
export const foot = k => k === 'wall' || k === 'platform' ? { w: 1, h: 1 } : DEFS[k];
// what you may plan with: only what you could craft or have made by now (every input of its recipe has been in your
// hands or in the base's stores), or what you hold
export const unlocked = k => S.count(k) >= 1 || (k === 'wall' ? S.known.has('iron') : !!RECIPE[k] && Object.keys(RECIPE[k].in).every(q => S.known.has(q)));
export const plannable = () => BUILD.filter(unlocked);
// what is on the cursor: the plan picked in blueprint mode, else the placeable item in the selected slot
export function cursorKind() { if (S.mode === 'combat') return null; if (S.mode === 'blueprint' && S.plan) return S.plan; const s = S.inv.slots[S.P.slot]; return s && ITEMS[s.id].build ? s.id : null; }
const ghostAt = (gx, gy) => BP.ghosts.find(q => { const e = foot(q.kind); return gx >= q.x && gx < q.x + e.w && gy >= q.y && gy < q.y + e.h; });
// anything the right button would act on at a cell
export const thingAt = (gx, gy) => ghostAt(gx, gy) || machineAt(gx, gy) || (platAt(gx, gy) ? 'deck' : null);
const overlaps = (k, gx, gy, but) => { const d = foot(k); return BP.ghosts.some(g => { if (g === but) return false; const e = foot(g.kind); return gx < g.x + e.w && gx + d.w > g.x && gy < g.y + e.h && gy + d.h > g.y; }); };
// a spot is supported by ground, by a deck, or (a deck) by a queued deck beside it
export function canGhost(k, gx, gy, but) {
  if (overlaps(k, gx, gy, but)) return false;
  if (k === 'wall') return !machineAt(gx, gy) && world.dens((gx + 0.5) * TS, (gy + 0.5) * TS) < 0.1;
  if (k === 'platform') return !machineAt(gx, gy) && canPlat(gx, gy, (x, y) => BP.ghosts.some(g => g.kind === 'platform' && g.x === x && g.y === y));
  return canPlace(k, gx, gy);
}
export function addGhost(kind, x, y, dir = 1) { const g = { id: BP.nextId++, kind, x, y, dir, prog: 0, claim: null, have: false }; BP.ghosts.push(g); return g; }
// the thing itself goes into the world
export function placeReal(kind, x, y, dir = 1, quiet) {
  if (kind === 'wall') { world.box(x * TS, y * TS, (x + 1) * TS, (y + 1) * TS, 1, M.PLATE); return null; }
  if (kind === 'platform') { addPlat(x, y); if (!quiet) audio.play('place'); return null; }
  return place(kind, x, y, dir, quiet);
}
export function finishGhost(g) {
  const i = BP.ghosts.indexOf(g); if (i >= 0) BP.ghosts.splice(i, 1);
  const m = placeReal(g.kind, g.x, g.y, g.dir); if (m && g.auto) m.auto = true;
  events.emit('blueprintBuilt', g.kind);
}
export function cancelGhost(g) { const i = BP.ghosts.indexOf(g); if (i >= 0) BP.ghosts.splice(i, 1); if (g.have) { const c = costOf(g.kind); for (const k in c) { const left = S.add(k, c[k]); if (left > 1e-6 && S.drop) S.drop(k, left); } } g.dead = true; }
// taking a machine apart gives its kit back, and whatever was in it
export function dismantle(m, into) {
  removeMachine(m); inv.add(into, m.kind, 1); for (const src of [m.inp, m.out]) for (const k in src) if (src[k] > 0 && ITEMS[k]) inv.add(into, k, src[k]);
  if (m.inv) for (const s of m.inv.slots) if (s) inv.add(into, s.id, s.n); if (m.drones) inv.add(into, 'drone', m.drones); audio.play('click');
}
// the left button with kind k on the cursor, at cell (x, y). Returns 'placed', 'ghost' or null.
export function tryPlace(k, x, y, say = true) {
  const P = S.P, e = foot(k), bp = S.mode === 'blueprint', cost = costOf(k), same = BP.ghosts.find(g => g.kind === k && g.x === x && g.y === y);
  const near = Math.hypot((x + e.w / 2) * TS - P.x, (y + e.h / 2) * TS - P.y - 0.9) < REACH, have = S.has(cost) || (same && same.have);
  if (have && near && !P.dead && canGhost(k, x, y, same)) {
    if (same) { if (!same.have) S.pay(cost); same.dead = true; BP.ghosts.splice(BP.ghosts.indexOf(same), 1); } else S.pay(cost);       // over its own ghost: the ghost is built
    placeReal(k, x, y, BP.rot); events.emit('placed', k); if (k === 'wall') audio.play('place'); return 'placed';
  }
  if (bp && !same && canGhost(k, x, y)) { addGhost(k, x, y, BP.rot); audio.play('click'); events.emit('ghostPlaced', k); return 'ghost'; }
  if (say && !same) S.say(!bp && !have ? `no ${k} in the inventory: craft one (e) or plan it (tab)` : !bp && !near ? 'too far to place by hand: tab plans it for the robots' : `no room for a ${k} there`, 2);
  return null;
}
export function setBlueprint(on) { S.mode = on ? 'blueprint' : 'build'; S.plan = null; S.tool = null; BP.drag = null; audio.play('click'); events.emit('blueprintMode'); }
export function stepBlueprint(dt) {
  const P = S.P, gx = Math.floor(S.mouse.x / TS), gy = Math.floor(S.mouse.y / TS), bp = S.mode === 'blueprint';
  if ((input.hit('Tab') || input.hit('b')) && !S.uiOpen) setBlueprint(!bp);
  if (S.mode !== 'combat' && !S.uiOpen && !P.dead) {
    if (input.hit('r')) { BP.rot = -BP.rot; audio.play('click'); }
    if (input.hit('t') && bp) { S.tool = S.tool === 'clear' ? null : 'clear'; BP.drag = null; }
    if (input.hit('q')) {       // the pipette
      const t = thingAt(gx, gy), k = t === 'deck' ? 'platform' : t ? t.kind : null, i = k ? S.inv.slots.findIndex(q => q && q.id === k) : -1; S.tool = null;
      if (!k) { S.plan = null; if (cursorKind()) P.slot = -1; }
      else if (i >= 0 && k !== 'wall') { if (i >= 9) { const j = P.slot >= 0 ? P.slot : 0, a = S.inv.slots[j]; S.inv.slots[j] = S.inv.slots[i]; S.inv.slots[i] = a; P.slot = j; } else P.slot = i; S.plan = null; if (t.dir) BP.rot = t.dir; }
      else if (bp) { S.plan = k; if (t.dir) BP.rot = t.dir; }
      else S.say(`no ${k} in the inventory: craft one (e) or plan it (tab)`, 2);
      audio.play('click');
    }
    const k = cursorKind();
    if (S.tool === 'clear' && bp) {
      if (input.clicked[0]) BP.drag = { x: gx, y: gy };
      if (BP.drag && !input.down[0]) { const x0 = Math.min(BP.drag.x, gx), y0 = Math.min(BP.drag.y, gy), x1 = Math.max(BP.drag.x, gx) + 1, y1 = Math.max(BP.drag.y, gy) + 1; if ((x1 - x0) * (y1 - y0) <= 400) BP.clears.push({ id: BP.nextId++, x0: x0 * TS, y0: y0 * TS, x1: x1 * TS, y1: y1 * TS, claim: null, cur: 0 }); else S.say('area too large'); BP.drag = null; audio.play('click'); }
    } else if (k) {
      const d = foot(k), ox = gx - Math.floor((d.w - 1) / 2), run = k === 'belt' || k === 'wall' || k === 'platform';
      if (input.clicked[0]) tryPlace(k, ox, gy, true); else if (input.down[0] && run) tryPlace(k, ox, gy, false);
    } else if (input.clicked[0]) { const m = machineAt(gx, gy); if (m && m.kind !== 'belt' && m.kind !== 'antenna' && Math.hypot((m.x + m.w / 2) * TS - P.x, (m.y + m.h / 2) * TS - P.y - 0.9) < REACH) events.emit('openMachine', m); }      // an empty hand opens what it clicks
    if (input.clicked[2]) {       // take back whatever is under the cursor
      const g = ghostAt(gx, gy); if (g) cancelGhost(g);
      const ci = BP.clears.findIndex(c => S.mouse.x >= c.x0 && S.mouse.x < c.x1 && S.mouse.y >= c.y0 && S.mouse.y < c.y1); if (ci >= 0) { BP.clears[ci].dead = true; BP.clears.splice(ci, 1); }
      const m = !g && machineAt(gx, gy); if (m) { m.decon = !m.decon; m.dp = 0; audio.play('click'); }
      if (!g && !m && platAt(gx, gy)) { if (Math.hypot((gx + 0.5) * TS - P.x, (gy + 1) * TS - P.y - 0.9) < REACH) { removePlat(gx, gy); const left = S.add('platform', 1); if (left > 0) S.drop('platform', left); audio.play('click'); } else S.say('too far to lift that deck', 2); }
    }
  }
  // the suit builds the nearest unclaimed ghost in reach by hand when it holds the item, and takes apart marked machines in reach
  BP.hand = null; if (P.dead) return;
  let best = null, bd = 4.2;
  for (const g of BP.ghosts) { if (g.claim || g.held) continue; const e = foot(g.kind), d = Math.hypot((g.x + e.w / 2) * TS - P.x, (g.y + e.h / 2) * TS - P.y - 0.9); if (d < bd && (g.have || S.has(costOf(g.kind)))) { bd = d; best = g; } }
  if (best) {
    if (!best.have) { S.pay(costOf(best.kind)); best.have = true; }
    best.prog += dt / (BUILD_T[best.kind] * 2.5); BP.hand = best; weld((best.x + foot(best.kind).w / 2) * TS, (best.y + 0.5) * TS, dt);
    if (best.prog >= 1) finishGhost(best);
  } else for (const m of F.machines) if (m.decon && !m.claim && Math.hypot((m.x + m.w / 2) * TS - P.x, (m.y + m.h / 2) * TS - P.y - 0.9) < 4.2) { m.dp = (m.dp || 0) + dt / 2.5; BP.hand = m; weld((m.x + m.w / 2) * TS, (m.y + 0.5) * TS, dt); if (m.dp >= 1) { dismantle(m, S.inv); events.emit('mined', m.kind); } break; }
}
export function weld(x, y, dt) {
  if (Math.random() < dt * 30) S.parts.spawn({ x: x + rand(-0.3, 0.3), y: y + rand(-0.2, 0.4), vx: rand(-3, 3), vy: rand(0, 4), life: rand(0.15, 0.5), size: rand(0.02, 0.05), c: [2.5, 4, 5], c2: [0.3, 0.6, 1], col: 1, bounce: 0.4 });
  if (Math.random() < dt * 20) S.lights.push({ x: x / TS, y: y / TS, c: [0.5, 0.9, 1.2], t: 0.05 });
  if (Math.random() < dt * 2) env.noise(x, y, 12);
}
// a ghost is a drawing: the machine as a blue hologram inside a dashed frame with corner marks, so nobody takes it
// for the thing itself
const GH = [0.12, 0.75, 1.0];
function frame(b, x, y, w, h, col, a, time) {
  const n = Math.max(2, Math.round((w + h) * 2.5)), ph = (time * 0.6) % 1;
  for (const [ax, ay, bx, by] of [[x, y, x + w, y], [x + w, y, x + w, y + h], [x + w, y + h, x, y + h], [x, y + h, x, y]]) { const l = Math.hypot(bx - ax, by - ay), m = Math.max(1, Math.round(l * 5)); for (let i = 0; i < m; i++) { const u0 = (i + ph * 0) / m, u1 = (i + 0.55) / m; b.seg(ax + (bx - ax) * u0, ay + (by - ay) * u0, ax + (bx - ax) * u1, ay + (by - ay) * u1, 0.022, col, a, 0, 2); } }
  for (const [cx, cy] of [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]) b.add(cx, cy, 0.09, 0.09, 0.785, col, a, 0, 2);
}
function drawGhost(b, kind, gx, gy, dir, time, a, prog = 0) {
  const e = foot(kind), x = gx * TS, y = gy * TS, w = e.w * TS, h = e.h * TS;
  if (kind === 'wall') b.add(x + w / 2, y + h / 2, w - 0.04, h - 0.04, 0, [0.05, 0.25, 0.3], a * (0.6 + prog * 0.4), 0, 2, gx);
  else if (kind === 'platform') drawDeck(b, gx, gy, a, true);
  else drawMachine(b, { kind, x: gx, y: gy, w: e.w, h: e.h, dir, out: {}, n: 0, seed: 0 }, time, a * (0.5 + prog * 0.5), true);
  b.add(x + w / 2, y + h / 2, w, h, 0, [0.01, 0.07, 0.11], a * 0.5, 0, 2); frame(b, x, y, w, h, GH, a * 0.8, time);
}
export function drawBlueprint(b, time) {
  const pulse = 0.55 + 0.25 * Math.sin(time * 4), P = S.P;
  for (const g of BP.ghosts) {
    const e = foot(g.kind), x = g.x * TS, y = g.y * TS, w = e.w * TS, h = e.h * TS; drawGhost(b, g.kind, g.x, g.y, g.dir, time, 0.8 + 0.2 * pulse, g.prog);
    if (g.have) b.add(x + w - 0.1, y + h - 0.1, 0.1, 0.1, 0, mul(C.amber, 2), 0.9, 1, 2);       // the kit is on site
    if (g.prog > 0) { b.add(x + w / 2, y + h * g.prog, w, 0.04, 0, [1, 2.2, 2.6], 0.9, 0, 2); b.add(x + w / 2, y + h * g.prog, w + 0.6, 0.5, 0, [0.2, 0.6, 0.8], 0.5, 1, 2); light.emit(g.x + e.w / 2, g.y + 1, 0.1, 0.35, 0.45); }
  }
  for (const m of F.machines) if (m.decon) { const x = m.x * TS, y = m.y * TS, w = m.w * TS, h = m.h * TS; b.seg(x, y, x + w, y + h, 0.04, mul(C.red, 2), pulse, 0, 2); b.seg(x, y + h, x + w, y, 0.04, mul(C.red, 2), pulse, 0, 2); }
  for (const c of BP.clears) { const w = c.x1 - c.x0, h = c.y1 - c.y0; b.add(c.x0 + w / 2, c.y0 + h / 2, w, h, 0, [0.3, 0.12, 0.02], 0.08 * pulse, 0, 2); for (const [ax, ay, bx, by] of [[c.x0, c.y0, c.x1, c.y0], [c.x1, c.y0, c.x1, c.y1], [c.x1, c.y1, c.x0, c.y1], [c.x0, c.y1, c.x0, c.y0]]) b.seg(ax, ay, bx, by, 0.03, mul(C.amber, 1.5), 0.8, 0, 2); }
  if (S.mode === 'combat' || S.uiOpen || P.dead) return;
  const gx = Math.floor(S.mouse.x / TS), gy = Math.floor(S.mouse.y / TS), k = cursorKind(), bp = S.mode === 'blueprint';
  if (S.tool === 'clear' && bp) { if (BP.drag) { const x0 = Math.min(BP.drag.x, gx) * TS, y0 = Math.min(BP.drag.y, gy) * TS, x1 = (Math.max(BP.drag.x, gx) + 1) * TS, y1 = (Math.max(BP.drag.y, gy) + 1) * TS; b.add((x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, y1 - y0, 0, [0.4, 0.16, 0.02], 0.35, 0, 2); } return; }
  if (!k) return;
  // the cursor: the thing itself when the click would put it down for real, a ghost when it would plan it, red when neither
  const d = foot(k), ox = gx - Math.floor((d.w - 1) / 2), w = d.w * TS, h = d.h * TS, same = BP.ghosts.find(g => g.kind === k && g.x === ox && g.y === gy), ok = canGhost(k, ox, gy, same);
  const real = ok && (S.has(costOf(k)) || (same && same.have)) && Math.hypot((ox + d.w / 2) * TS - P.x, (gy + d.h / 2) * TS - P.y - 0.9) < REACH;
  if (real) { if (k === 'wall') b.add((ox + 0.5) * TS, (gy + 0.5) * TS, TS, TS, 0, mul(C.steel, 0.8), 0.8, 0, 1); else if (k === 'platform') drawDeck(b, ox, gy, 0.8, false); else drawMachine(b, { kind: k, x: ox, y: gy, w: d.w, h: d.h, dir: BP.rot, out: {}, n: 0, seed: 0, inp: {} }, time, 0.8, false);
    for (const [ax, ay, bx, by] of [[0, 0, w, 0], [w, 0, w, h], [w, h, 0, h], [0, h, 0, 0]]) b.seg(ox * TS + ax, gy * TS + ay, ox * TS + bx, gy * TS + by, 0.02, [0.3, 1.4, 0.5], 0.7, 0, 2); }
  else if (ok && bp) drawGhost(b, k, ox, gy, BP.rot, time, 0.9);
  else { drawGhost(b, k, ox, gy, BP.rot, time, 0.3); b.add((ox + d.w / 2) * TS, (gy + d.h / 2) * TS, w, h, 0, [0.6, 0.04, 0.02], 0.4, 0, 2); }
}
export function dumpBP() { return { g: BP.ghosts.map(g => [g.kind, g.x, g.y, g.dir, +g.prog.toFixed(3), g.have ? 1 : 0, g.key ?? null, g.auto ? 1 : 0]), c: BP.clears.map(c => [c.x0, c.y0, c.x1, c.y1]) }; }
export function loadBP(o) { BP.ghosts.length = 0; BP.clears.length = 0; BP.drag = null; if (!o) return; for (const [k, x, y, d, p, h, key, au] of o.g) { const g = addGhost(k, x, y, d); g.prog = p; g.have = !!h; if (key !== null && key !== undefined) g.key = key; if (au) g.auto = true; } for (const [x0, y0, x1, y1] of o.c) BP.clears.push({ id: BP.nextId++, x0, y0, x1, y1, claim: null, cur: 0 }); }

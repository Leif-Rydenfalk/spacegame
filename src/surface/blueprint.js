// placing things, the way Factorio does it. One inventory: a furnace is an item you craft (the arm, slowly) or the
// base makes, it lies in a slot, and with that slot selected the left button puts it down and the item is gone.
// Tab is blueprint mode, for planning: the same items, the same cursor, the same keys, but what you do not hold goes
// down as a ghost, clearly a drawing and not a machine, and every ghost is an order the AI has made, carried and
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
import { F, DEFS, DIRV, canPlace, place, removeMachine, machineAt, drawMachine, portsOf, isBatch } from './factory.js';
import { PL, platAt, addPlat, removePlat, canPlat, drawDeck } from './layers.js';
import { buildTime } from './physics.js';
import { MINE, SUPPORT, addSupport } from './mine.js';
import { EXO } from './suit.js';
import { markTrees, treesIn } from './flora.js';

export const WALL_KG = +(MAT[M.PLATE].rho * SLAB * TS * TS).toFixed(3);       // iron in one 0.5 m wall block
export const BUILD = ['belt', 'fast belt', 'miner', 'furnace', 'assembler', 'assay station', 'shaft rig', 'cnc mill', 'metal printer', 'polymer printer', 'solder bench', 'chest', 'hub', 'antenna', 'power pole', 'camera', 'radar', 'platform', 'stairs', 'wall', 'pump', 'air filter', 'controller', 'seat', 'table', 'bunk', 'bio-printer', 'pad'];
// seconds to put a kit together: its mass, the energy bolting and welding takes, the watts of the tool (physics.js).
// A drone's welder is 2 kW; the suit's arm 1 kW; bare hands 300 W.
export const buildT = (k, toolW = 2000) => buildTime(k === 'wall' ? WALL_KG : ITEMS[k] ? ITEMS[k].m : 5, toolW);
// round 6 Q: nothing you cannot reach yet is shown. A thing with a stage (the bio-printer, the launch pad) appears in
// the menus only when the base has reached that stage of automation (next.js sets S.stage); dev scenarios set S.dev.
export const staged = k => !(ITEMS[k] && ITEMS[k].stage) || S.dev || (S.stage || 1) >= ITEMS[k].stage;
export const REACH = 8;                       // metres the hands place at
export const costOf = k => k === 'wall' ? { iron: WALL_KG } : { [k]: 1 };
export const BP = { ghosts: [], clears: [], dmarks: [], rot: 1, drag: null, hand: null, nextId: 1, shaft: null, shaft2: null, depth: 0, belt: null, box: null, flip: 1, rm: null };
export const isBeltKind = k => k === 'belt' || k === 'fast belt';
const real = k => k === 'fast belt' ? 'belt' : k;
export const foot = k => k === 'wall' || k === 'platform' || SUPPORT[k] ? { w: 1, h: 1 } : DEFS[real(k)];
// what you may plan with: only what you could craft or have made by now (every input of its recipe has been in your
// hands or in the base's stores), or what you hold
export const unlocked = k => S.count(k) >= 1 || (staged(k) && (k === 'wall' ? S.known.has('iron') : RECIPE[k] ? Object.keys(RECIPE[k].in).every(q => S.known.has(q)) : S.known.has(k)));
export const plannable = () => BUILD.filter(unlocked);
// what is on the cursor: the plan picked in blueprint mode, else the placeable item in the selected slot
export function cursorKind() { if (S.mode === 'combat') return null; if (S.mode === 'blueprint' && S.plan) return S.plan; const s = S.inv.slots[S.P.slot]; return s && ITEMS[s.id].build ? s.id : null; }
// round 7: the planners are items. The one in the selected slot is the tool on the cursor: a blueprint (drag an area to
// copy it, click to paste it), a book of blueprints, the deconstruction planner, the upgrade planner
export function toolSlot() { if (S.mode === 'combat' || S.plan) return null; const s = S.inv.slots[S.P.slot]; return s && ITEMS[s.id].plan ? s : null; }
export const pageOf = s => { if (!s) return null; const d = s.d || {}; return ITEMS[s.id].plan === 'book' ? (d.pages || [])[d.sel || 0] || null : ITEMS[s.id].plan === 'copy' ? d.bp || null : null; };
const ghostAt = (gx, gy) => BP.ghosts.find(q => { const e = foot(q.kind); return gx >= q.x && gx < q.x + e.w && gy >= q.y && gy < q.y + e.h; });
// anything the right button would act on at a cell
export const thingAt = (gx, gy) => ghostAt(gx, gy) || machineAt(gx, gy) || (platAt(gx, gy) ? 'deck' : null);
const overlaps = (k, gx, gy, but) => { const d = foot(k); return BP.ghosts.some(g => { if (g === but || g.over) return false; const e = foot(g.kind); return gx < g.x + e.w && gx + d.w > g.x && gy < g.y + e.h && gy + d.h > g.y; }); };
// round 7: a machine planned where the ground does not carry it: when the cells are free and there is ground within
// 1.8 m under every column, the frame may stand there and the AI lays a pad of spoil under it first (spoil.js).
// Returns { w, y0 } (cells wide, the lowest ground under the foot) or null.
export function padFor(k, gx, gy) {
  const d = DEFS[k]; if (!d || k === 'belt' || canPlace(k, gx, gy)) return null; let y0 = 1e9;
  for (let i = 0; i < d.w; i++) { for (let j = 0; j < d.h; j++) if (machineAt(gx + i, gy + j) || world.dens((gx + i + 0.5) * TS, (gy + j + 0.5) * TS) > (j === 0 ? 0.2 : 0.05)) return null; const g = world.groundY((gx + i + 0.5) * TS, gy * TS + 0.25, 0, 2.05); if (g === null) return null; y0 = Math.min(y0, g); }
  return y0 > gy * TS - 0.08 ? null : { w: d.w, y0: +y0.toFixed(2) };
}
// a spot is supported by ground, by a deck, or (a deck) by a queued deck beside it
export function canGhost(k, gx, gy, but) {
  if (overlaps(k, gx, gy, but)) return false; if (SUPPORT[k]) return true;
  if (k === 'wall') return !machineAt(gx, gy) && world.dens((gx + 0.5) * TS, (gy + 0.5) * TS) < 0.1;
  if (k === 'platform') return !machineAt(gx, gy) && canPlat(gx, gy, (x, y) => BP.ghosts.some(g => g.kind === 'platform' && g.x === x && g.y === y));
  return canPlace(real(k), gx, gy) || !!padFor(k, gx, gy);
}
export function addGhost(kind, x, y, dir = 1) { const g = { id: BP.nextId++, kind, x, y, dir, prog: 0, claim: null, have: false }; BP.ghosts.push(g); return g; }
// the thing itself goes into the world. cond = the condition its kit was in (a machine that was taken down and put up
// again is as worn as it was)
export function placeReal(kind, x, y, dir = 1, quiet, cond = 1) {
  if (kind === 'wall') { world.box(x * TS, y * TS, (x + 1) * TS, (y + 1) * TS, 1, M.PLATE); return null; }
  if (kind === 'platform') { addPlat(x, y); if (!quiet) audio.play('place'); return null; }
  const m = place(real(kind), x, y, dir, quiet); if (kind === 'fast belt') m.fast = true; if (cond < 0.999) m.hp = Math.max(1, DEFS[m.kind].hp * cond); return m;
}
// the mine plans its own supports: a ghost that jumps the queue (auto.js ranks it first), built like any other
MINE.addGhost = (kind, x, y0, y1) => { const gx = Math.floor(x / TS), gy = Math.floor((kind === 'steel set' ? y0 : y1 - 0.5) / TS); if (BP.ghosts.some(g => g.kind === kind && Math.abs(g.x - gx) < 2 && Math.abs(g.y - gy) < 4) || MINE.supports.some(q => q.kind === kind && Math.abs(q.x - x) < 0.8 && Math.abs(q.y1 - y1) < 1.5)) return null; const g = addGhost(kind, gx, gy); g.support = true; g.auto = true; g.sx = +x.toFixed(2); g.y0 = +y0.toFixed(2); g.y1 = +y1.toFixed(2); events.emit('supportPlanned', kind); return g; };
export function finishGhost(g) {
  const i = BP.ghosts.indexOf(g); if (i >= 0) BP.ghosts.splice(i, 1);
  if (SUPPORT[g.kind]) { addSupport(g.kind, g.sx === undefined ? (g.x + 0.5) * TS : g.sx, g.y0 === undefined ? g.y * TS : g.y0, g.y1 === undefined ? (g.y + 3) * TS : g.y1); events.emit('blueprintBuilt', g.kind); return; }
  if (g.over) {       // an upgrade: the belt that stands there becomes the fast one, and the old belt comes back as the item it is
    const old = machineAt(g.x, g.y); if (old && old.kind === 'belt' && !old.fast) { old.fast = true; inv.nextC = old.hp / DEFS.belt.hp; if (S.loose) S.loose('belt', 1, (g.x + 0.5) * TS, (g.y + 1) * TS); events.emit('upgraded', g.kind); } else if (S.loose) S.loose(g.kind, 1, (g.x + 0.5) * TS, (g.y + 1) * TS);
    events.emit('blueprintBuilt', g.kind); return; }
  const m = placeReal(g.kind, g.x, g.y, g.dir, false, g.cond === undefined ? 1 : g.cond); if (m && g.auto) m.auto = true; if (m && g.depth) m.target = g.depth; if (m && g.recipe && isBatch(m.kind) && RECIPE[g.recipe]) m.recipe = g.recipe;
  events.emit('blueprintBuilt', g.kind);
}
export function cancelGhost(g) { const i = BP.ghosts.indexOf(g); if (i >= 0) BP.ghosts.splice(i, 1); if (g.have) { const c = costOf(g.kind); for (const k in c) { if (g.cond !== undefined) inv.nextC = g.cond; const left = S.add(k, c[k]); if (left > 1e-6 && S.drop) S.drop(k, left); } } g.dead = true; }
// taking a machine apart gives its kit back, in the condition the machine was in, and whatever was in it
export function dismantle(m, into) {
  removeMachine(m); inv.nextC = Math.max(0.05, Math.min(1, m.hp / DEFS[m.kind].hp)); const left = inv.add(into, m.fast ? 'fast belt' : m.kind, 1); inv.nextC = null; if (left > 1e-9 && S.loose) { inv.nextC = Math.max(0.05, Math.min(1, m.hp / DEFS[m.kind].hp)); S.loose(m.fast ? 'fast belt' : m.kind, 1, (m.x + m.w / 2) * TS, (m.y + 1) * TS); }
  for (const src of [m.inp, m.out, m.muck]) for (const k in src || {}) if (src[k] > 0 && ITEMS[k]) { const l2 = inv.add(into, k, src[k]); if (l2 > 1e-9 && S.loose) S.loose(k, l2, (m.x + m.w / 2) * TS, (m.y + 1) * TS); }
  if (m.inv) for (const s of m.inv.slots) if (s) { const l2 = inv.add(into, s.id, s.n); if (l2 > 1e-9 && S.loose) S.loose(s.id, l2, (m.x + m.w / 2) * TS, (m.y + 1) * TS); } if (m.drones) inv.add(into, 'drone', m.drones); audio.play('click'); events.emit('dismantled', { kind: m.kind, cond: m.hp / DEFS[m.kind].hp });
}
// a marked deck comes up as the item it is
export function liftDeck(d, into) { const i = BP.dmarks.indexOf(d); if (i >= 0) BP.dmarks.splice(i, 1); d.dead = true; if (!removePlat(d.x, d.y)) return; const left = inv.add(into, 'platform', 1); if (left > 1e-9 && S.loose) S.loose('platform', 1, (d.x + 0.5) * TS, (d.y + 1) * TS); events.emit('dismantled', { kind: 'platform', cond: 1 }); }
// the left button with kind k on the cursor, at cell (x, y). Returns 'placed', 'ghost' or null.
export function tryPlace(k, x, y, say = true, dir = BP.rot) {
  const P = S.P, e = foot(k), bp = S.mode === 'blueprint', cost = costOf(k), same = BP.ghosts.find(g => g.kind === k && g.x === x && g.y === y);
  const near = Math.hypot((x + e.w / 2) * TS - P.x, (y + e.h / 2) * TS - P.y - 0.9) < REACH, have = S.has(cost) || (same && same.have), pad = !!DEFS[k] && k !== 'belt' && !canPlace(k, x, y);
  if (have && near && !P.dead && !pad && canGhost(k, x, y, same)) {
    let cond = same && same.cond !== undefined ? same.cond : 1; if (same) { if (!same.have) { S.pay(cost); cond = inv.lastC; } same.dead = true; BP.ghosts.splice(BP.ghosts.indexOf(same), 1); } else { S.pay(cost); cond = k === 'wall' ? 1 : inv.lastC; }       // over its own ghost: the ghost is built
    placeReal(k, x, y, dir, false, cond); events.emit('placed', k); if (k === 'wall') audio.play('place'); return 'placed';
  }
  // round 6 M: what is in reach is yours to place. Not in the hand but in a store a robot can reach in time: the frame
  // goes down and the robots bring the thing and build it. Blueprint mode plans also what does not exist yet.
  const inReach = !bp && !have && !same && S.reach && S.reach(k) >= (k === 'wall' ? WALL_KG : 1);
  if ((bp || inReach) && !same && canGhost(k, x, y)) { const g = addGhost(k, x, y, dir); if (BP.depth) g.depth = BP.depth; if (pad) { const pd = padFor(k, x, y); if (pd) g.pad = pd; } audio.play('click'); events.emit('ghostPlaced', k); if (inReach) { events.emit('placedFromStock', k); if (say) S.say(`${k}: in reach, not in your hands. the robots bring it and build it`, 2.5); } else if (g.pad && say) S.say(`${k}: the ground does not carry it there. the ai lays a pad of spoil under it first`, 3); return 'ghost'; }
  if (say && !same) S.say(!bp && !have ? `no ${k} in reach: craft one (e) or plan it (tab)` : !bp && !near ? 'too far to place by hand: tab plans it for the robots' : pad && !bp ? `the ground does not carry a ${k} there: tab plans it and the ai lays a pad first` : `no room for a ${k} there`, 2);
  return null;
}
// ---- round 7: belts are laid as a path ------------------------------------------------------------------------------------
// the port a press or a release near a machine snaps to: its cell and the direction that leads away. A press on the
// machine itself, or within a cell of a port, is that port.
export function snapPort(gx, gy) {
  let best = null, bd = 9;
  for (const m of F.machines) { if (m.kind === 'belt' || m.kind === 'antenna' || m.kind === 'power pole' || gy < m.y - 1 || gy > m.y + m.h) continue; for (const [px, py, away] of portsOf(m)) { const on = gx >= m.x && gx < m.x + m.w && gy >= m.y && gy < m.y + m.h && (away > 0 ? gx >= m.x + m.w / 2 : gx < m.x + m.w / 2), d = on ? 0.5 : Math.abs(gx - px) + Math.abs(gy - py) * 1.5; if (d <= 1.5 && d < bd) { bd = d; best = { x: px, y: py, dir: away, m }; } } }
  return best;
}
// the cells of a belt from a to b: along the row first, then a lift up or down. [[x, y, dir]]. A single cell keeps
// the direction it was given.
export function beltPath(a, bx, by) {
  const out = [], sx = Math.sign(bx - a.x), sy = Math.sign(by - a.y); if (!sx && !sy) return [[a.x, a.y, a.dir || BP.rot]];
  if (sx) for (let x = a.x; x !== bx; x += sx) out.push([x, a.y, sx]);
  if (sy) { for (let y = a.y; y !== by; y += sy) out.push([bx, y, 2 * sy]); out.push([bx, by, 2 * sy]); } else out.push([bx, a.y, sx]);
  return out;
}
// ---- round 7: the planners --------------------------------------------------------------------------------------------------
// copy what stands and what is planned in a box of cells into a blueprint: { w, h, ents: [[kind, dx, dy, dir, recipe]] }
export function copyArea(x0, y0, x1, y1) {
  const ents = [], seen = new Set(); let ax = 1e9, ay = 1e9, bx = -1e9, by = -1e9;
  const put = (kind, x, y, dir, rec) => { const e = foot(kind); ents.push([kind, x, y, dir || 1, rec || 0]); ax = Math.min(ax, x); ay = Math.min(ay, y); bx = Math.max(bx, x + e.w); by = Math.max(by, y + e.h); };
  for (const m of F.machines) if (!seen.has(m) && m.x >= x0 && m.x < x1 && m.y >= y0 && m.y < y1) { seen.add(m); put(m.fast ? 'fast belt' : m.kind, m.x, m.y, m.dir, isBatch(m.kind) ? m.recipe : 0); }
  for (const g of BP.ghosts) if (!g.support && !g.over && g.x >= x0 && g.x < x1 && g.y >= y0 && g.y < y1) put(g.kind, g.x, g.y, g.dir, g.recipe);
  for (const [px, py] of PL.cells.values()) if (px >= x0 && px < x1 && py >= y0 && py < y1 && !(machineAt(px, py) && machineAt(px, py).kind === 'stairs')) put('platform', px, py, 1);
  if (!ents.length) return null; for (const e of ents) { e[1] -= ax; e[2] -= ay; }
  return { w: bx - ax, h: by - ay, ents };
}
// where an entity of a blueprint lands with the cursor at (gx, gy): the cursor is the middle of its bottom edge
const landed = (bp, e, gx, gy, flip) => { const fw = foot(e[0]).w, ox = gx - Math.floor(bp.w / 2); return [flip < 0 ? ox + bp.w - e[1] - fw : ox + e[1], gy + e[2], Math.abs(e[3]) === 1 ? e[3] * flip : e[3]]; };
// paste: every entity that has room becomes a ghost, an order like any other. Returns [placed, of].
export function pasteBlueprint(bp, gx, gy, flip = 1) {
  let n = 0; const order = bp.ents.slice().sort((a, b) => a[2] - b[2]);      // from the bottom up, so a deck can hang on the one under it
  for (const e of order) { const [x, y, dir] = landed(bp, e, gx, gy, flip); if (!foot(e[0]) || BP.ghosts.some(g => g.kind === e[0] && g.x === x && g.y === y) || !canGhost(e[0], x, y)) continue; const g = addGhost(e[0], x, y, dir); if (e[4]) g.recipe = e[4]; const pd = padFor(e[0], x, y); if (pd) g.pad = pd; n++; }
  if (n) { audio.play('click'); events.emit('pasted', { n, of: bp.ents.length }); } return [n, bp.ents.length];
}
// the deconstruction planner over a box: machines are marked, decks are marked, ghosts are cancelled, trees are marked
// for felling. off = take the marks away again. Returns what it touched.
export function deconArea(x0, y0, x1, y1, off = false) {
  const out = { machines: 0, decks: 0, ghosts: 0, trees: 0 }, seen = new Set();
  for (const m of F.machines) if (!seen.has(m) && m.x < x1 && m.x + m.w > x0 && m.y < y1 && m.y + m.h > y0) { seen.add(m); if (m.decon !== !off) { m.decon = !off; m.dp = 0; out.machines++; } }
  for (const [px, py] of [...PL.cells.values()]) if (px >= x0 && px < x1 && py >= y0 && py < y1 && !(machineAt(px, py) && machineAt(px, py).kind === 'stairs')) { const i = BP.dmarks.findIndex(d => d.x === px && d.y === py); if (off) { if (i >= 0) { BP.dmarks[i].dead = true; BP.dmarks.splice(i, 1); out.decks++; } } else if (i < 0) { BP.dmarks.push({ kind: 'platform', x: px, y: py, w: 1, h: 1, decon: true, deck: true, dp: 0, claim: null }); out.decks++; } }
  if (!off) for (const g of BP.ghosts.slice()) if (!g.support && g.x < x1 && g.x + foot(g.kind).w > x0 && g.y < y1 && g.y + foot(g.kind).h > y0) { cancelGhost(g); out.ghosts++; }
  out.trees = markTrees(x0 * TS, y0 * TS, x1 * TS, y1 * TS, !off);
  events.emit('deconMarked', out); return out;
}
// the upgrade planner over a box: every belt gets a fast belt planned over it (the old one comes back as an item); a shaft
// rig gets the modules it does not have yet ordered
export function upgradeArea(x0, y0, x1, y1) {
  let n = 0; for (const m of F.machines) { if (!(m.x < x1 && m.x + m.w > x0 && m.y < y1 && m.y + m.h > y0)) continue;
    if (m.kind === 'belt' && !m.fast && !BP.ghosts.some(g => g.over && g.x === m.x && g.y === m.y)) { const g = addGhost('fast belt', m.x, m.y, m.dir); g.over = true; n++; }
    else if (m.kind === 'shaft rig' && !m.upMods && (m.head !== 'rotary' || !m.hoist)) { m.upMods = true; n++; } }
  events.emit('upgradeMarked', n); return n;
}
export function setBlueprint(on) { S.mode = on ? 'blueprint' : 'build'; S.plan = null; S.tool = null; BP.drag = null; audio.play('click'); events.emit('blueprintMode'); }
const boxOf = (a, gx, gy) => [Math.min(a.x, gx), Math.min(a.y, gy), Math.max(a.x, gx) + 1, Math.max(a.y, gy) + 1];
const ROT = { 1: 2, 2: -1, [-1]: -2, [-2]: 1 };
// the nearest thing the AI proposes (auto.js: a belt it would lay, shown only in blueprint mode, never laid by itself)
export const proposalNear = (gx, gy) => { let best = null, bd = 14; for (const p of S.proposals || []) for (const c of p.cells) { const d = Math.abs(c[0] - gx) + Math.abs(c[1] - gy); if (d < bd) { bd = d; best = p; } } return best || (S.proposals || [])[0] || null; };
export function acceptProposal(p) { let n = 0; for (const [x, y, dir] of p.cells) if (!machineAt(x, y) && !BP.ghosts.some(g => g.x === x && g.y === y) && canGhost('belt', x, y)) { const g = addGhost('belt', x, y, dir); g.ai = true; n++; } p.taken = true; S.proposals = (S.proposals || []).filter(q => q !== p); events.emit('proposalAccepted', { key: p.key, n }); return n; }
export function stepBlueprint(dt) {
  const P = S.P, gx = Math.floor(S.mouse.x / TS), gy = Math.floor(S.mouse.y / TS), bp = S.mode === 'blueprint';
  if ((input.hit('Tab') || input.hit('b')) && !S.uiOpen) setBlueprint(!bp);
  if (S.mode !== 'combat' && !S.uiOpen && !P.dead) {
    const tool = toolSlot(), k = tool ? null : cursorKind(), shift = input.key('Shift'), page = pageOf(tool);
    if (input.hit('r')) {       // a belt turns through its four directions; a blueprint is mirrored; a book turns its page with shift
      if (tool && ITEMS[tool.id].plan === 'book' && shift) { const d = tool.d || (tool.d = {}), n = (d.pages || []).length; if (n) { d.sel = ((d.sel || 0) + 1) % n; S.say(`blueprint book: page ${d.sel + 1} of ${n}`, 2); } }
      else if (tool && page) BP.flip = -BP.flip; else if (isBeltKind(k)) BP.rot = ROT[BP.rot] || 1; else BP.rot = BP.rot > 0 ? -1 : 1;
      audio.play('click'); }
    if (input.hit('t') && bp) { S.tool = S.tool === 'clear' ? null : 'clear'; BP.drag = null; }
    if (input.hit('y') && bp) { const pr = proposalNear(gx, gy); if (pr) { const n = acceptProposal(pr); S.say(`the ai's belt is planned: ${n} cells. the robots lay it`, 3); audio.play('click'); } }
    if (input.hit('q')) {       // the pipette
      const t = thingAt(gx, gy), k2 = t === 'deck' ? 'platform' : t ? (t.fast ? 'fast belt' : t.kind) : null, i = k2 ? S.inv.slots.findIndex(q => q && q.id === k2) : -1; S.tool = null;
      if (!k2) { S.plan = null; if (cursorKind() || toolSlot()) P.slot = -1; }
      else if (i >= 0 && k2 !== 'wall') { if (i >= 9) { const j = P.slot >= 0 ? P.slot : 0, a = S.inv.slots[j]; S.inv.slots[j] = S.inv.slots[i]; S.inv.slots[i] = a; P.slot = j; } else P.slot = i; S.plan = null; if (t.dir) BP.rot = t.dir; }
      else if (bp) { S.plan = k2; if (t.dir) BP.rot = t.dir; }
      else S.say(`no ${k2} in the inventory: craft one (e) or plan it (tab)`, 2);
      audio.play('click');
    }
    if (S.tool === 'clear' && bp) {
      if (input.clicked[0]) BP.drag = { x: gx, y: gy };
      if (BP.drag && !input.down[0]) { const x0 = Math.min(BP.drag.x, gx), y0 = Math.min(BP.drag.y, gy), x1 = Math.max(BP.drag.x, gx) + 1, y1 = Math.max(BP.drag.y, gy) + 1; if ((x1 - x0) * (y1 - y0) <= 400) BP.clears.push({ id: BP.nextId++, x0: x0 * TS, y0: y0 * TS, x1: x1 * TS, y1: y1 * TS, claim: null, cur: 0 }); else S.say('area too large'); BP.drag = null; audio.play('click'); }
    } else if (tool) {      // a planner on the cursor: a box is dragged; a blueprint that holds something is pasted with a click
      const kind = ITEMS[tool.id].plan, paste = page && !shift && (kind === 'copy' || kind === 'book');
      if (paste) { if (input.clicked[0]) { const [n, of] = pasteBlueprint(page, gx, gy, BP.flip); S.say(n ? `blueprint: ${n} of ${of} planned` : 'blueprint: no room for any of it here', 2.5); } BP.box = null; }
      else {
        if (input.clicked[0]) BP.box = { x: gx, y: gy, kind, off: shift && kind === 'decon' };
        if (BP.box && !input.down[0]) { const [x0, y0, x1, y1] = boxOf(BP.box, gx, gy), d = tool.d || (tool.d = {});
          if ((x1 - x0) * (y1 - y0) > 3600) S.say('area too large', 2);
          else if (kind === 'copy' || kind === 'book') { const c = copyArea(x0, y0, x1, y1); if (!c) S.say('nothing there to copy', 2); else { if (kind === 'copy') d.bp = c; else { (d.pages || (d.pages = [])).push(c); d.sel = d.pages.length - 1; } BP.flip = 1; S.say(`${kind === 'book' ? 'blueprint book, page ' + d.pages.length : 'blueprint'}: ${c.ents.length} thing${c.ents.length === 1 ? '' : 's'} copied. click pastes it; shift+drag copies again`, 3.5); events.emit('copied', c.ents.length); } }
          else if (kind === 'decon') { const r = deconArea(x0, y0, x1, y1, BP.box.off), n = r.machines + r.decks + r.ghosts + r.trees; S.say(n ? `${BP.box.off ? 'unmarked' : 'to take down'}: ${[[r.machines, 'machine'], [r.decks, 'deck'], [r.ghosts, 'plan'], [r.trees, 'tree']].filter(q => q[0]).map(q => q[0] + ' ' + q[1] + (q[0] > 1 ? 's' : '')).join(', ')}${BP.box.off ? '' : '. the robots do it and bring the parts to stock'}` : 'nothing there to take down', 3.5); }
          else if (kind === 'upgrade') { const n = upgradeArea(x0, y0, x1, y1); S.say(n ? `upgrade planned for ${n} thing${n === 1 ? '' : 's'}: fast belts over the belts, the modules a rig lacks` : 'nothing there has an upgrade', 3); }
          BP.box = null; audio.play('click'); }
      }
    } else if (isBeltKind(k)) {      // a belt is laid as a path: press (a port of a machine catches the press), drag, let go
      if (input.clicked[0]) { const sp = snapPort(gx, gy); BP.belt = sp ? { x: sp.x, y: sp.y, dir: sp.dir, snap: true } : { x: gx, y: gy, dir: 0 }; }
      if (BP.belt) { const sp = snapPort(gx, gy), ex = sp && sp.y === BP.belt.y && !(sp.x === BP.belt.x && BP.belt.snap) ? sp.x : gx, ey = sp && sp.y === BP.belt.y ? sp.y : gy; BP.belt.path = beltPath(BP.belt, ex, ey);
        if (!input.down[0]) { let n = 0, gh = 0; for (const [x, y, d] of BP.belt.path) { const r = tryPlace(k, x, y, BP.belt.path.length === 1, d); if (r === 'placed') n++; else if (r === 'ghost') gh++; } if (BP.belt.path.length > 1) { S.say(n + gh ? `belt: ${n ? n + ' laid' : ''}${n && gh ? ', ' : ''}${gh ? gh + ' planned' : ''}${n + gh < BP.belt.path.length ? ', ' + (BP.belt.path.length - n - gh) + ' had no room or no belt' : ''}` : (S.count(k) < 1 && !bp ? `no ${k} left: craft more (e) or plan the line (tab)` : 'no room for the line there'), 2.5); events.emit('beltPath', { n, gh, of: BP.belt.path.length }); } BP.belt = null; } }
    } else if (k) {
      const d = foot(k), ox = gx - Math.floor((d.w - 1) / 2), run = k === 'wall' || k === 'platform';
      if (k === 'shaft rig') {      // one action: press at the collar, drag down to the depth you want, let go (docs/ROUND6.md I)
        if (input.clicked[0]) BP.shaft = { x: ox, y: gy, my: S.mouse.y }; else if (BP.shaft && input.down[0]) BP.shaft.depth = Math.max(0, Math.round((BP.shaft.my - S.mouse.y) * 2) / 2);
        else if (BP.shaft) { BP.depth = Math.max(3, BP.shaft.depth || 0); const r = tryPlace(k, BP.shaft.x, BP.shaft.y, true); if (r === 'placed') { const m = machineAt(BP.shaft.x, BP.shaft.y); if (m) m.target = BP.depth; } BP.depth = 0; BP.shaft = null; }
      } else if (input.clicked[0]) tryPlace(k, ox, gy, true); else if (input.down[0] && run) tryPlace(k, ox, gy, false);
    } else if (bp && input.clicked[0] && machineAt(gx, gy) && machineAt(gx, gy).kind === 'shaft rig') BP.shaft2 = { m: machineAt(gx, gy), my: S.mouse.y, mx: S.mouse.x };      // drag from a rig that stands: deeper, or a branch sideways at that depth
    else if (input.clicked[0]) { const m = machineAt(gx, gy); if (m && m.kind !== 'belt' && m.kind !== 'antenna' && Math.hypot((m.x + m.w / 2) * TS - P.x, (m.y + m.h / 2) * TS - P.y - 0.9) < REACH) events.emit('openMachine', m); }      // an empty hand opens what it clicks
    if (!isBeltKind(k)) BP.belt = null; if (!tool) BP.box = null;
    if (BP.shaft2 && !input.down[0]) { const q = BP.shaft2, m = q.m, dy = q.my - S.mouse.y, dx = S.mouse.x - q.mx; if (Math.abs(dx) > 1.5 && Math.abs(dx) > Math.abs(dy)) { const top = m.y * TS, dep = Math.max(1.5, Math.round((top - S.mouse.y) * 2) / 2); (m.branches || (m.branches = [])).push({ depth: Math.min(dep, m.target || dep), dir: Math.sign(dx), len: Math.round(Math.abs(dx)), done: 0 }); S.say(`branch: ${Math.round(Math.abs(dx))} m ${dx > 0 ? 'east' : 'west'} at ${Math.min(dep, m.target || dep).toFixed(1)} m`, 3); events.emit('shaftBranch'); } else if (dy > 1) { m.target = Math.max(m.target || 0, Math.round((m.y * TS - S.mouse.y) * 2) / 2); S.say(`shaft: down to ${m.target.toFixed(1)} m`, 3); events.emit('shaftExtended'); } BP.shaft2 = null; }
    if (input.clicked[2]) {       // take back whatever is under the cursor
      const g = ghostAt(gx, gy); if (g) cancelGhost(g);
      const ci = BP.clears.findIndex(c => S.mouse.x >= c.x0 && S.mouse.x < c.x1 && S.mouse.y >= c.y0 && S.mouse.y < c.y1); if (ci >= 0) { BP.clears[ci].dead = true; BP.clears.splice(ci, 1); }
      const m = !g && machineAt(gx, gy); if (m) { m.decon = !m.decon; m.dp = 0; audio.play('click'); }
      const dm = BP.dmarks.findIndex(d => d.x === gx && d.y === gy); if (dm >= 0) { BP.dmarks[dm].dead = true; BP.dmarks.splice(dm, 1); }
      else if (!g && !m && platAt(gx, gy)) { if (Math.hypot((gx + 0.5) * TS - P.x, (gy + 1) * TS - P.y - 0.9) < REACH) { removePlat(gx, gy); const left = S.add('platform', 1); if (left > 0) S.drop('platform', left); audio.play('click'); } else S.say('too far to lift that deck', 2); }
      BP.rm = m ? { m, t: 0 } : null;
    }
    // round 7: the right button held on one machine takes that machine down now: by your own hands within reach (it goes
    // into the suit as the kit it is, as worn as it was); out of reach it stays marked and the robots come for it
    if (BP.rm && input.down[2] && F.machines.includes(BP.rm.m) && machineAt(gx, gy) === BP.rm.m) {
      const m = BP.rm.m, near = Math.hypot((m.x + m.w / 2) * TS - P.x, (m.y + m.h / 2) * TS - P.y - 0.9) < REACH; BP.rm.t += dt; m.decon = true; m.byHand = near ? G.time + 0.5 : 0;       // your hands are on it: no robot is sent for it
      if (BP.rm.t > 0.35 && near) { m.dp = (m.dp || 0) + dt / Math.max(0.6, buildT(m.kind, EXO.on ? 1000 : 300) * 0.5); BP.hand = m; BP.rm.held = true; weld((m.x + m.w / 2) * TS, (m.y + 0.5) * TS, dt); if (m.dp >= 1) { const kind = m.kind; dismantle(m, S.inv); S.gain(m.fast ? 'fast belt' : kind, 1); events.emit('mined', kind); events.emit('removedByHand', kind); BP.rm = null; } }
      else if (BP.rm.t > 0.35 && !near && !BP.rm.said) { BP.rm.said = true; S.say(`the ${m.kind} is out of reach: it is marked, the robots take it down`, 2.5); }
    } else if (BP.rm && !input.down[2]) BP.rm = null;
  } else { BP.belt = null; BP.box = null; BP.rm = null; }
  // the suit builds the nearest unclaimed ghost in reach by hand when it holds the item, and takes apart marked machines in reach
  if (!(BP.rm && BP.rm.held)) BP.hand = null; if (P.dead) return; if (BP.rm && BP.rm.held) return;
  let best = null, bd = 4.2;
  for (const g of BP.ghosts) { if (g.claim || g.held || g.over || (g.pad && !g.padOk) || (!EXO.on && ITEMS[g.kind] && ITEMS[g.kind].m > 25)) continue; const e = foot(g.kind), d = Math.hypot((g.x + e.w / 2) * TS - P.x, (g.y + e.h / 2) * TS - P.y - 0.9); if (d < bd && (g.have || S.has(costOf(g.kind)))) { bd = d; best = g; } }
  if (best) {
    if (!best.have) { S.pay(costOf(best.kind)); best.have = true; if (best.kind !== 'wall' && inv.lastC < 0.999) best.cond = inv.lastC; }
    best.prog += dt / buildT(best.kind, EXO.on ? 1000 : 300); BP.hand = best; weld((best.x + foot(best.kind).w / 2) * TS, (best.y + 0.5) * TS, dt);
    if (best.prog >= 1) finishGhost(best);
  } else { let did = false;
    for (const m of F.machines) if (m.decon && !m.claim && Math.hypot((m.x + m.w / 2) * TS - P.x, (m.y + m.h / 2) * TS - P.y - 0.9) < 4.2) { m.dp = (m.dp || 0) + dt / 2.5; BP.hand = m; weld((m.x + m.w / 2) * TS, (m.y + 0.5) * TS, dt); if (m.dp >= 1) { dismantle(m, S.inv); events.emit('mined', m.kind); } did = true; break; }
    if (!did) for (const d of BP.dmarks) if (!d.claim && Math.hypot((d.x + 0.5) * TS - P.x, (d.y + 1) * TS - P.y - 0.9) < 4.2) { d.dp = (d.dp || 0) + dt / 1.2; BP.hand = d; if (d.dp >= 1) liftDeck(d, S.inv); break; } }
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
  if (SUPPORT[kind]) { b.add(x + w / 2, y + h / 2, 0.12, h, 0, [0.3, 0.9, 0.2], a, 0, 2); return; }
  if (kind === 'wall') b.add(x + w / 2, y + h / 2, w - 0.04, h - 0.04, 0, [0.05, 0.25, 0.3], a * (0.6 + prog * 0.4), 0, 2, gx);
  else if (kind === 'platform') drawDeck(b, gx, gy, a, true);
  else drawMachine(b, { kind: real(kind), fast: kind === 'fast belt', x: gx, y: gy, w: e.w, h: e.h, dir, out: {}, n: 0, seed: 0 }, time, a * (0.5 + prog * 0.5), true);
  b.add(x + w / 2, y + h / 2, w, h, 0, [0.01, 0.07, 0.11], a * 0.5, 0, 2); frame(b, x, y, w, h, GH, a * 0.8, time);
}
const rect = (b, x0, y0, x1, y1, col, a, fillA = 0.1) => { b.add((x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, y1 - y0, 0, col, fillA, 0, 2); for (const [ax, ay, bx, by] of [[x0, y0, x1, y0], [x1, y0, x1, y1], [x1, y1, x0, y1], [x0, y1, x0, y0]]) b.seg(ax, ay, bx, by, 0.03, col, a, 0, 2); };
const TOOLC = { copy: [0.2, 0.8, 1.6], book: [0.2, 0.8, 1.6], decon: [1.8, 0.2, 0.1], upgrade: [0.3, 1.6, 0.4] };
export function drawBlueprint(b, time) {
  const pulse = 0.55 + 0.25 * Math.sin(time * 4), P = S.P;
  for (const g of BP.ghosts) {
    const e = foot(g.kind), x = g.x * TS, y = g.y * TS, w = e.w * TS, h = e.h * TS;
    if (g.support) { const sx = g.sx, col = [0.5, 1.6, 0.3]; if (g.kind === 'steel set') { b.add(sx, (g.y0 + g.y1) / 2, 0.1, g.y1 - g.y0, 0, col, 0.35 + 0.2 * pulse + g.prog * 0.4, 0, 2); b.add(sx, g.y1 - 0.05, 0.7, 0.08, 0, col, 0.5 * pulse + g.prog * 0.4, 0, 2); } else { b.add(sx, g.y1 - 0.03, 1.0, 0.04, 0, col, 0.4 + 0.3 * pulse, 0, 2); b.seg(sx, g.y1, sx, g.y1 + 0.5, 0.03, col, 0.5, 0, 2); } if (g.have) b.add(sx + 0.2, g.y1 - 0.2, 0.1, 0.1, 0, mul(C.amber, 2), 0.9, 1, 2); continue; }
    if (g.over) { b.add(x + w / 2, y + 0.3, w, 0.04, 0, TOOLC.upgrade, 0.7 * pulse + 0.2, 0, 2); for (const d of [-1, 1]) b.seg(x + w / 2, y + 0.5, x + w / 2 + d * 0.1, y + 0.4, 0.025, TOOLC.upgrade, 0.9, 0, 2); if (g.have) b.add(x + w - 0.1, y + 0.4, 0.08, 0.08, 0, mul(C.amber, 2), 0.9, 1, 2); continue; }
    drawGhost(b, g.kind, g.x, g.y, g.dir, time, 0.8 + 0.2 * pulse, g.prog);
    if (g.depth) { b.add(x + w / 2, y - g.depth / 2, 1.0, g.depth, 0, [0.02, 0.12, 0.2], 0.3, 0, 2); for (let d2 = 1; d2 <= g.depth; d2++) b.add(x + w / 2, y - d2, 1.1, 0.02, 0, GH, 0.5, 0, 2); }
    if (g.have) b.add(x + w - 0.1, y + h - 0.1, 0.1, 0.1, 0, mul(C.amber, 2), 0.9, 1, 2);       // the kit is on site
    if (g.prog > 0) { b.add(x + w / 2, y + h * g.prog, w, 0.04, 0, [1, 2.2, 2.6], 0.9, 0, 2); b.add(x + w / 2, y + h * g.prog, w + 0.6, 0.5, 0, [0.2, 0.6, 0.8], 0.5, 1, 2); light.emit(g.x + e.w / 2, g.y + 1, 0.1, 0.35, 0.45); }
  }
  for (const m of F.machines) if (m.decon) { const x = m.x * TS, y = m.y * TS, w = m.w * TS, h = m.h * TS; b.seg(x, y, x + w, y + h, 0.04, mul(C.red, 2), pulse, 0, 2); b.seg(x, y + h, x + w, y, 0.04, mul(C.red, 2), pulse, 0, 2); if (m.dp > 0) b.add(x + w / 2, y + h + 0.12, w * Math.min(1, m.dp), 0.04, 0, mul(C.red, 2.5), 0.9, 0, 2); }
  for (const d of BP.dmarks) { const x = d.x * TS, y = (d.y + 1) * TS; b.seg(x, y - 0.16, x + TS, y + 0.06, 0.03, mul(C.red, 2), pulse, 0, 2); b.seg(x, y + 0.06, x + TS, y - 0.16, 0.03, mul(C.red, 2), pulse, 0, 2); }
  for (const m of F.machines) if (m.upMods) b.add((m.x + m.w / 2) * TS, (m.y + m.h) * TS + 0.25, 0.14, 0.14, 0.785, TOOLC.upgrade, pulse, 0, 2);
  for (const c of BP.clears) { const w = c.x1 - c.x0, h = c.y1 - c.y0; b.add(c.x0 + w / 2, c.y0 + h / 2, w, h, 0, [0.3, 0.12, 0.02], 0.08 * pulse, 0, 2); for (const [ax, ay, bx, by] of [[c.x0, c.y0, c.x1, c.y0], [c.x1, c.y0, c.x1, c.y1], [c.x1, c.y1, c.x0, c.y1], [c.x0, c.y1, c.x0, c.y0]]) b.seg(ax, ay, bx, by, 0.03, mul(C.amber, 1.5), 0.8, 0, 2); }
  if (S.mode === 'combat' || S.uiOpen || P.dead) return;
  const gx = Math.floor(S.mouse.x / TS), gy = Math.floor(S.mouse.y / TS), tool = toolSlot(), k = tool ? null : cursorKind(), bp = S.mode === 'blueprint';
  // what the AI proposes, in blueprint mode only: a dotted amber line, never a thing that stands until you take it (y)
  if (bp) for (const p of S.proposals || []) { for (const [x, y, dir] of p.cells) { const cx = (x + 0.5) * TS, cy = y * TS + 0.16, sg = dir > 0 ? 1 : -1; b.add(cx, cy, TS * 0.5, 0.03, 0, mul(C.amber, 1.4), 0.5 + 0.3 * pulse, 0, 2); for (const d of [-1, 1]) b.seg(cx + sg * 0.1, cy, cx + sg * 0.02, cy + d * 0.07, 0.02, mul(C.amber, 1.6), 0.8, 0, 2); } const c0 = p.cells[0]; b.add((c0[0] + 0.5) * TS, c0[1] * TS + 0.5, 0.12, 0.12, 0.785, mul(C.amber, 2), pulse, 0, 2); }
  if (S.tool === 'clear' && bp) { if (BP.drag) { const x0 = Math.min(BP.drag.x, gx) * TS, y0 = Math.min(BP.drag.y, gy) * TS, x1 = (Math.max(BP.drag.x, gx) + 1) * TS, y1 = (Math.max(BP.drag.y, gy) + 1) * TS; b.add((x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, y1 - y0, 0, [0.4, 0.16, 0.02], 0.35, 0, 2); } return; }
  if (BP.shaft && BP.shaft.depth) { const sx = (BP.shaft.x + 1) * TS, sy = BP.shaft.y * TS, dep = Math.max(3, BP.shaft.depth); b.add(sx, sy - dep / 2, 1.0, dep, 0, [0.02, 0.14, 0.22], 0.4, 0, 2); for (let d2 = 1; d2 <= dep; d2++) b.add(sx, sy - d2, 1.15, 0.025, 0, GH, 0.7, 0, 2); }
  if (tool) {       // a planner: the box being dragged, or the blueprint it holds, at the cursor
    const kind = ITEMS[tool.id].plan, page = pageOf(tool), col = TOOLC[kind];
    if (BP.box) { const [x0, y0, x1, y1] = boxOf(BP.box, gx, gy); rect(b, x0 * TS, y0 * TS, x1 * TS, y1 * TS, BP.box.off ? [0.6, 0.6, 0.6] : col, 0.9, 0.12 + 0.05 * pulse); }
    else if (page && !input.key('Shift')) { for (const e of page.ents) { const [x, y, dir] = landed(page, e, gx, gy, BP.flip), ok = canGhost(e[0], x, y); drawGhost(b, e[0], x, y, dir, time, ok ? 0.8 : 0.3); if (!ok) { const f = foot(e[0]); b.add((x + f.w / 2) * TS, (y + f.h / 2) * TS, f.w * TS, f.h * TS, 0, [0.6, 0.04, 0.02], 0.35, 0, 2); } } }
    else { b.seg((gx + 0.5) * TS - 0.2, (gy + 0.5) * TS, (gx + 0.5) * TS + 0.2, (gy + 0.5) * TS, 0.02, col, 0.9, 0, 2); b.seg((gx + 0.5) * TS, (gy + 0.5) * TS - 0.2, (gx + 0.5) * TS, (gy + 0.5) * TS + 0.2, 0.02, col, 0.9, 0, 2); rect(b, gx * TS, gy * TS, (gx + 1) * TS, (gy + 1) * TS, col, 0.5, 0.05); }
    if (kind === 'decon') for (const t of treesIn(S.cam.x - 30, S.cam.x + 30)) if (t.mark) { b.seg(t.x - 0.3, t.y + 0.2, t.x + 0.3, t.y + 1.0, 0.04, mul(C.red, 2), pulse, 0, 2); b.seg(t.x - 0.3, t.y + 1.0, t.x + 0.3, t.y + 0.2, 0.04, mul(C.red, 2), pulse, 0, 2); }
    return; }
  if (!k) return;
  if (isBeltKind(k)) {       // a belt on the cursor: the ports of every machine in view, and the path as it would be laid
    for (const m of F.machines) { if (m.kind === 'belt' || m.kind === 'antenna' || m.kind === 'power pole' || Math.abs(m.x * TS - S.cam.x) > 26) continue; for (const [px, py, away] of portsOf(m)) { const cx = (px + 0.5) * TS - away * 0.12, cy = py * TS + 0.2; for (const d of [-1, 1]) b.seg(cx + away * 0.12, cy, cx - away * 0.04, cy + d * 0.1, 0.022, [0.3, 1.5, 0.5], 0.5 + 0.4 * pulse, 0, 2); } }
    const sp = BP.belt ? null : snapPort(gx, gy), path = BP.belt && BP.belt.path ? BP.belt.path : [[sp ? sp.x : gx, sp ? sp.y : gy, sp ? sp.dir : BP.rot]]; let left = S.count(k);
    for (const [x, y, dir] of path) { const same = BP.ghosts.find(g => g.kind === k && g.x === x && g.y === y), ok = canGhost(k, x, y, same), near = Math.hypot((x + 0.5) * TS - P.x, (y + 0.5) * TS - P.y - 0.9) < REACH, isReal = ok && near && left >= 1; if (isReal) left--;
      if (isReal) { drawMachine(b, { kind: 'belt', fast: k === 'fast belt', x, y, w: 1, h: 1, dir, out: {}, n: 0, seed: 0, inp: {} }, time, 0.85, true); rect(b, x * TS, y * TS, (x + 1) * TS, (y + 1) * TS, [0.3, 1.4, 0.5], 0.6, 0.03); }
      else if (ok && (bp || (S.reach && S.reach(k) >= 1))) drawGhost(b, k, x, y, dir, time, 0.9);
      else { drawGhost(b, k, x, y, dir, time, 0.3); b.add((x + 0.5) * TS, (y + 0.5) * TS, TS, TS, 0, [0.6, 0.04, 0.02], 0.4, 0, 2); } }
    if (sp) rect(b, sp.x * TS - 0.04, sp.y * TS - 0.04, (sp.x + 1) * TS + 0.04, (sp.y + 1) * TS + 0.04, [0.3, 1.5, 0.5], 0.9, 0);
    return; }
  // the cursor: the thing itself when the click would put it down for real, a ghost when it would plan it, red when neither
  const d = foot(k), ox = gx - Math.floor((d.w - 1) / 2), w = d.w * TS, h = d.h * TS, same = BP.ghosts.find(g => g.kind === k && g.x === ox && g.y === gy), ok = canGhost(k, ox, gy, same), pad = ok && !!DEFS[k] && !canPlace(k, ox, gy);
  const isReal = ok && !pad && (S.has(costOf(k)) || (same && same.have)) && Math.hypot((ox + d.w / 2) * TS - P.x, (gy + d.h / 2) * TS - P.y - 0.9) < REACH;
  if (isReal) { if (k === 'wall') b.add((ox + 0.5) * TS, (gy + 0.5) * TS, TS, TS, 0, mul(C.steel, 0.8), 0.8, 0, 1); else if (k === 'platform') drawDeck(b, ox, gy, 0.8, false); else drawMachine(b, { kind: k, x: ox, y: gy, w: d.w, h: d.h, dir: BP.rot, out: {}, n: 0, seed: 0, inp: {} }, time, 0.8, false);
    for (const [ax, ay, bx, by] of [[0, 0, w, 0], [w, 0, w, h], [w, h, 0, h], [0, h, 0, 0]]) b.seg(ox * TS + ax, gy * TS + ay, ox * TS + bx, gy * TS + by, 0.02, [0.3, 1.4, 0.5], 0.7, 0, 2); }
  else if (ok && bp) { drawGhost(b, k, ox, gy, BP.rot, time, 0.9); if (pad) { const pd = padFor(k, ox, gy); if (pd) b.add((ox + d.w / 2) * TS, (pd.y0 + gy * TS) / 2, w, gy * TS - pd.y0, 0, [0.9, 0.55, 0.12], 0.3, 0, 2); } }
  else { drawGhost(b, k, ox, gy, BP.rot, time, 0.3); b.add((ox + d.w / 2) * TS, (gy + d.h / 2) * TS, w, h, 0, [0.6, 0.04, 0.02], 0.4, 0, 2); }
}
export function dumpBP() { return { g: BP.ghosts.map(g => { const o = [g.kind, g.x, g.y, g.dir, +g.prog.toFixed(3), g.have ? 1 : 0, g.key ?? null, g.auto ? 1 : 0, g.support ? [g.sx, g.y0, g.y1] : g.depth ? g.depth : 0]; if (g.over || g.pad || g.recipe || g.cond !== undefined || g.padOk) o.push({ ...(g.over ? { o: 1 } : {}), ...(g.pad ? { p: [g.pad.w, g.pad.y0] } : {}), ...(g.padOk ? { k: 1 } : {}), ...(g.recipe ? { r: g.recipe } : {}), ...(g.cond !== undefined ? { c: +g.cond.toFixed(3) } : {}) }); return o; }), c: BP.clears.map(c => [c.x0, c.y0, c.x1, c.y1, c.auto ? 1 : 0]), d: BP.dmarks.map(d => [d.x, d.y]) }; }
export function loadBP(o) { BP.ghosts.length = 0; BP.clears.length = 0; BP.dmarks.length = 0; BP.drag = null; BP.belt = null; BP.box = null; BP.rm = null; BP.flip = 1; if (!o) return; for (const [k, x, y, d, p, h, key, au, ex, x7] of o.g) { if (!foot(k)) continue; const g = addGhost(k, x, y, d); g.prog = p; g.have = !!h; if (key !== null && key !== undefined) g.key = key; if (au) g.auto = true; if (Array.isArray(ex)) { g.support = true; [g.sx, g.y0, g.y1] = ex; } else if (ex) g.depth = ex; if (x7) { if (x7.o) g.over = true; if (x7.p) g.pad = { w: x7.p[0], y0: x7.p[1] }; if (x7.k) g.padOk = true; if (x7.r) g.recipe = x7.r; if (x7.c !== undefined) g.cond = x7.c; } } for (const [x0, y0, x1, y1, au] of o.c) BP.clears.push({ id: BP.nextId++, x0, y0, x1, y1, claim: null, cur: 0, auto: !!au }); for (const [x, y] of o.d || []) BP.dmarks.push({ kind: 'platform', x, y, w: 1, h: 1, decon: true, deck: true, dp: 0, claim: null }); }

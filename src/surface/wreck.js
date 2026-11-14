// the wreck as a real ship: a frame, volumes inside it, and the parts that fill them (round 6 K, docs/SHIPS.md).
// The frame is the structure (keel, ribs, skin plates). A volume is a stretch of the hull with a use: engine bay,
// hold, tank, reactor bay, life support, crew room, computer bay, cockpit. fill() lays the components of each use out
// inside its volume; that list is the ship. Every part has a mass, a condition from the crash, and can be salvaged
// (cut and unbolted: time from its mass); it comes out as the item it is when it survived well enough, as scrap by
// its composition when it did not. Every part can be repaired with material and time; the ship as a whole cannot fly
// again: the keel is broken and the repair bill is more than a new hull.
// The interior is a layer behind the hull. You step in through the torn tail (S or F at the opening), the outer hull
// is cut away, and what you see is drawn from the part list: salvage a part and it is gone from the room.
// The forward section behind the bulkhead is sealed and has its own atmosphere, held by the pump, the filters and the
// controller: take those out and the air goes bad.
import { G, events, hash, clamp, rand } from '../core.js';
import { audio } from '../audio.js';
import { ITEMS, inv } from '../items.js';
import { TS } from './world.js';
import { light } from './light.js';
import { S, C, mul } from './state.js';
import { EXO, BOOT, NEEDS, suitOn, suitStats } from './suit.js';

export const HULL = { x: -9, y: 0.25, tilt: -0.13, x0: -4.15, x1: 3.5, floor: 0.0, ceil: 2.1, door: -4.15, bulkhead: 0.1, keel: 0.12 };
// the frame: ribs at these stations along the keel, and the skin plates between them (top side)
export const FRAME = { ribs: [-4.1, -3.2, -1.9, -1.2, 0.1, 1.0, 2.2, 3.0, 3.5], material: 'steel', sectionKg: 38, keelBroken: true };
export const VOLUMES = [
  { id: 'engine', name: 'engine bay', use: 'engine bay', x0: -4.15, x1: -3.2, damage: 0.85 },
  { id: 'hold', name: 'hold', use: 'cargo', x0: -3.2, x1: -1.9, damage: 0.35 },
  { id: 'tank', name: 'tank', use: 'tank', x0: -1.9, x1: -1.2, damage: 0.3 },
  { id: 'reactor', name: 'reactor bay', use: 'reactor bay', x0: -1.2, x1: 0.1, damage: 0.3 },
  { id: 'life', name: 'life support', use: 'life support', x0: 0.1, x1: 1.0, damage: 0.15, sealed: true },
  { id: 'crew', name: 'crew room', use: 'crew room', x0: 1.0, x1: 2.2, damage: 0.15, sealed: true },
  { id: 'core', name: 'computer bay', use: 'computer', x0: 2.2, x1: 3.0, damage: 0.2, sealed: true },
  { id: 'cockpit', name: 'cockpit', use: 'cockpit', x0: 3.0, x1: 3.5, damage: 0.5, sealed: true },
];
// what a use is filled with: [name, kg, w, h, where (0 floor, 1 wall, 2 ceiling), item it is, n of it, scrap { iron, copper } fractions, use]
const FILL = {
  'engine bay': [['combustion chamber', 46, 0.55, 0.6, 0, null, 0, { iron: 0.8, copper: 0.1 }], ['turbopump', 22, 0.3, 0.3, 1, 'turbopump', 1, { iron: 0.7, copper: 0.2 }], ['turbopump', 22, 0.3, 0.3, 2, 'turbopump', 1, { iron: 0.7, copper: 0.2 }], ['feed lines', 7, 0.5, 0.08, 2, null, 0, { copper: 0.8 }]],
  cargo: [['fabricator', 60, 0.42, 0.9, 0, null, 0, { iron: 0.6, copper: 0.2 }, 'fab'], ['suit locker', 16, 0.34, 1.5, 0, null, 0, { iron: 0.9 }, 'locker'], ['hold racks', 30, 0.5, 1.1, 0, null, 0, { iron: 0.9 }, 'hold']],
  tank: [['water tank', 14, 0.5, 1.2, 0, null, 0, { iron: 0.8 }, 'tank'], ['wiring loom', 4, 0.6, 0.06, 2, 'wiring loom', 1, { copper: 0.7 }]],
  'reactor bay': [['power bus', 9, 0.16, 0.9, 1, 'wiring loom', 2, { copper: 0.8 }], ['coolant pump', 9, 0.26, 0.26, 0, 'pump', 1, { iron: 0.6, copper: 0.3 }], ['wiring loom', 4, 0.8, 0.06, 2, 'wiring loom', 1, { copper: 0.7 }]],
  'life support': [['air pump', 9, 0.3, 0.34, 0, 'pump', 1, { iron: 0.6, copper: 0.3 }, 'air'], ['air filter', 2, 0.14, 0.3, 1, 'air filter', 1, { iron: 0.5 }], ['air filter', 2, 0.14, 0.3, 1, 'air filter', 1, { iron: 0.5 }], ['controller', 1.5, 0.16, 0.12, 1, 'controller', 1, { copper: 0.5 }]],
  'crew room': [['bunk', 14, 0.86, 0.3, 0, 'bunk', 1, { iron: 0.8 }, 'sleep'], ['toilet', 8, 0.24, 0.4, 0, null, 0, { iron: 0.7 }, 'toilet'], ['table', 9, 0.4, 0.5, 0, 'table', 1, { iron: 0.9 }], ['seat', 7, 0.24, 0.5, 0, 'seat', 1, { iron: 0.8 }]],
  computer: [['computer core', 11, 0.36, 1.0, 0, null, 0, { iron: 0.4, copper: 0.3 }, 'core'], ['data rack', 3, 0.2, 0.5, 1, 'ssd', 2, { copper: 0.4 }], ['antenna feed', 4, 0.5, 0.06, 2, 'wiring loom', 1, { copper: 0.7 }]],
  cockpit: [['console', 5, 0.3, 0.3, 0, 'pcb', 2, { copper: 0.4, iron: 0.3 }], ['pilot seat', 7, 0.24, 0.55, 0, 'seat', 1, { iron: 0.8 }], ['hull cameras', 1.6, 0.14, 0.1, 2, 'camera', 2, { copper: 0.4 }]],
};
export const WRECK = { parts: [], inside: false, lit: 0, atm: { p: 1, o2: 0.21, ok: true }, near: null, cut: 0, marked: new Set(), step: 0 };
// pure: the components of one volume, laid out along it. seed makes the crash damage.
export function fill(v, vi, seed = 7) {
  const list = FILL[v.use] || [], out = [], w = v.x1 - v.x0; let fx = v.x0 + 0.08, wx = v.x0 + 0.1, cx = v.x0 + 0.1;
  list.forEach((q, i) => {
    const [name, kg, pw, ph, where, item, n, scrap, use] = q, cond = clamp(1 - v.damage * (0.55 + 0.9 * hash(vi * 31 + i, seed, 501)), 0.03, 1); let lx, ly;
    if (where === 0) { lx = Math.min(fx + pw / 2, v.x1 - pw / 2 - 0.04); fx += pw + (w - list.filter(e => e[4] === 0).reduce((a, e) => a + e[2], 0) - 0.16) / Math.max(1, list.filter(e => e[4] === 0).length - 1); ly = HULL.keel + ph / 2; }
    else if (where === 1) { lx = Math.min(wx + pw / 2, v.x1 - pw / 2); wx += pw + 0.12; ly = 1.25; }
    else { lx = Math.min(cx + pw / 2, v.x1 - pw / 2); cx += pw + 0.1; ly = HULL.ceil - 0.14 - ph / 2; }
    out.push({ name, vol: v.id, lx: +lx.toFixed(3), ly: +ly.toFixed(3), w: pw, h: ph, kg, cond: +cond.toFixed(3), item: item || null, n: n || 0, scrap: scrap || {}, use: use || null, gone: false });
  });
  return out;
}
export function wreckReset(seed = G.seed) {
  WRECK.parts = []; VOLUMES.forEach((v, vi) => { for (const p of fill(v, vi, seed)) { p.id = WRECK.parts.length; WRECK.parts.push(p); } });
  // the skin: plates along the top between the ribs
  for (let i = 0; i < FRAME.ribs.length - 1; i++) { const a = FRAME.ribs[i], b = FRAME.ribs[i + 1]; WRECK.parts.push({ id: WRECK.parts.length, name: 'hull plate', vol: 'skin', lx: (a + b) / 2, ly: HULL.ceil + 0.03, w: b - a - 0.04, h: 0.07, kg: 15, cond: +clamp(1 - (0.2 + 0.7 * hash(i, seed, 502)) * (i < 2 ? 1 : 0.5), 0.05, 1).toFixed(3), item: 'hull plate', n: 1, scrap: { iron: 0.9 }, use: null, gone: false }); }
  WRECK.inside = false; WRECK.lit = 0; WRECK.atm = { p: 1, o2: 0.21, ok: true }; WRECK.marked = new Set(); WRECK.cut = 0;
}
const ct = Math.cos(HULL.tilt), st = Math.sin(HULL.tilt);
export const toWorld = (lx, ly) => [HULL.x + lx * ct - ly * st, HULL.y + lx * st + ly * ct];
export const toLocal = (x, y) => { const dx = x - HULL.x, dy = y - HULL.y; return [dx * ct + dy * st, -dx * st + dy * ct]; };
export const partPos = p => toWorld(p.lx, p.ly);
export const partNamed = (name, live = true) => WRECK.parts.find(p => p.name === name && (!live || !p.gone));
export const volumeAt = lx => VOLUMES.find(v => lx >= v.x0 && lx < v.x1) || null;
// seconds to cut and unbolt a part: mass, and whether the suit's hands do it
export const salvageTime = (kg, suited) => (1.5 + kg * 0.35) * (suited ? 1 : 3);
// pure: what a part comes out as: [[item, amount]]
export function salvageYield(p) {
  if (p.item && p.cond >= 0.4) return [[p.item, p.n]];
  const out = []; for (const k in p.scrap) out.push([k, +(p.kg * p.scrap[k] * (0.5 + 0.4 * p.cond)).toFixed(2)]); return out;
}
// what it costs to make a part whole again: kg of iron, seconds
export const repairCost = p => ({ iron: +(p.kg * (1 - p.cond) * 0.6).toFixed(1), t: Math.round(4 + p.kg * (1 - p.cond) * 1.5) });
// the whole ship: what repair would cost against a new hull. The keel is broken, so it never flies either way.
export function repairBill() { let kg = FRAME.ribs.length * FRAME.sectionKg * 2.5 + 900, hull = 0; for (const p of WRECK.parts) { kg += p.gone ? p.kg * 1.6 : repairCost(p).iron * 1.8; hull += p.kg; } return { repair: Math.round(kg), fresh: Math.round(hull * 1.05 + FRAME.ribs.length * FRAME.sectionKg), parts: WRECK.parts.length, gone: WRECK.parts.filter(p => p.gone).length }; }
// is the air round the body breathable? Inside the sealed section while its life support stands.
export function breathable(P = S.P) { if (!S.crash || !WRECK.inside) return false; const lx = toLocal(P.x, P.y)[0]; return lx > HULL.bulkhead && WRECK.atm.ok && WRECK.atm.o2 > 0.17; }
const atBay = P => S.kitInBay && Math.abs(P.x - (HULL.x - 0.5)) < 0.8;
export const atDoor = (P = S.P) => S.crash && Math.abs(P.x - toWorld(HULL.door, 0)[0]) < 1.0 && P.y < 1.2 && P.y > -0.6;
export function enterWreck(on) { WRECK.inside = on; S.inside = on ? 'wreck' : null; audio.play('click'); events.emit(on ? 'wreckEntered' : 'wreckLeft'); }
function take(p, to) {
  p.gone = true; WRECK.marked.delete(p.id); const [x, y] = partPos(p);
  for (const [k, n] of salvageYield(p)) { const left = to === S.inv ? S.add(k, n) : inv.add(to, k, n); if (to === S.inv) S.gain(k, n - left); if (left > 1e-6 && S.loose) S.loose(k, left, x, y); }
  audio.play('place'); events.emit('salvaged', p.name);
}
export const salvagePart = (p, to = S.inv) => { if (!p.gone) take(p, to); };
// the nearest part the hands can reach from where the body stands inside
export function partNear(P = S.P) {
  if (!WRECK.inside) return null; const lx = toLocal(P.x, P.y + 0.9)[0]; let best = null, bd = 0.75;
  for (const p of WRECK.parts) { if (p.gone || p.vol === 'skin') continue; const d = Math.abs(p.lx - lx) - (p.use ? 0.2 : 0); if (d < bd) { bd = d; best = p; } }
  return best;
}
const act = (kind, T, x, y, done) => { S.P.act = { kind, t: 0, T, x, y, done }; audio.play('click'); };
// F (shift = salvage a part that has a use; r = repair). Returns true when the wreck took the key.
export function wreckUse(shift, repair) {
  const P = S.P; if (!S.crash || P.act) return false;
  if (!WRECK.inside) { if (atDoor()) { enterWreck(true); return true; } return false; }
  if (atBay(P)) return false;       // the reactor in its bay is the kit's (kit.js)
  const p = partNear(), suited = EXO.on; if (!p) { if (atDoor()) { enterWreck(false); return true; } return false; }
  const [x, y] = partPos(p);
  if (repair) { const c = repairCost(p); if (p.cond > 0.97) S.say(`the ${p.name} is whole`, 2); else if (!S.has({ iron: c.iron })) S.say(`repairing the ${p.name} takes ${c.iron} kg of iron`, 2.5); else act(`repair the ${p.name}`, c.t, x, y, () => { S.pay({ iron: c.iron }); p.cond = 1; events.emit('repaired', p.name); audio.play('place'); }); return true; }
  if (p.use && !shift) {
    if (p.use === 'locker') { if (!EXO.on && EXO.cond > 0) act('put on the exosuit', 3.2, x, y, () => { suitOn(); }); else S.say(EXO.on ? 'the locker is empty: the suit is on you' : 'the suit is broken: it needs parts', 2); return true; }
    if (p.use === 'hold') { events.emit('openHold'); return true; }
    if (p.use === 'sleep') { if (NEEDS.sleep > 0.8) S.say('not tired', 1.5); else act('lie down', 1.4, x, y, () => { NEEDS.asleep = 600; events.emit('slept'); }); return true; }
    if (p.use === 'toilet') { act('use the toilet', 2.5, x, y, () => { NEEDS.toilet = 0; events.emit('toilet'); }); return true; }
    if (p.use === 'tank') { act('drink, and fill the suit', 1.6, x, y, () => { NEEDS.water = 1; if (EXO.on) EXO.water = suitStats().packL; events.emit('drank'); }); return true; }
    if (p.use === 'air') { S.say(`air pump: ${WRECK.atm.ok ? 'holding ' + (WRECK.atm.o2 * 100).toFixed(0) + ' % oxygen in the forward section' : 'not holding'}. shift+f takes it out`, 3); return true; }
    if (p.use === 'core') { S.say('the computer core: the ai runs here. it stays', 2.5); return true; }
    if (p.use === 'fab') { S.say('the fabricator: the ship\'s matter compiler. it makes what the queue asks for from the hold', 3); return true; }
    return false;
  }
  if (p.use === 'core' || p.use === 'hold' || p.use === 'fab' || p.use === 'locker') { S.say(`the ${p.name} stays in the ship`, 2); return true; }
  if (!suited && p.kg > 25) { S.say(`${p.kg} kg: not without the exosuit`, 2.5); return true; }
  act(`salvage the ${p.name}`, salvageTime(p.kg, suited), x, y, () => take(p, S.inv)); return true;
}
export function wreckHint() {
  const P = S.P; if (!S.crash || atBay(P)) return '';
  if (!WRECK.inside) return atDoor() ? 's or f  step inside the wreck' : '';
  const p = partNear(); if (!p) return atDoor() ? 'w or f  step out' : '';
  const c = `${p.kg} kg, condition ${(p.cond * 100).toFixed(0)} %`;
  if (p.use === 'locker') return EXO.on ? '' : 'f  put on the exosuit';
  if (p.use === 'hold') return 'f  open the hold';
  if (p.use === 'sleep') return `f  sleep   shift+f  salvage the bunk (${c})`;
  if (p.use === 'toilet') return 'f  use the toilet';
  if (p.use === 'tank') return 'f  drink, and fill the suit\'s water';
  if (p.use === 'air') return `air pump (${c})   f  status   shift+f  take it out`;
  if (p.use === 'core') return 'the computer core: the ai runs on this';
  if (p.use === 'fab') return 'the fabricator: the ship\'s own matter compiler';
  const y = salvageYield(p).map(([k, n]) => `${k} ${ITEMS[k].u === 'ea' ? 'x' + n : n + ' kg'}`).join(', ');
  return `f  salvage the ${p.name} (${c}): ${y}, ${salvageTime(p.kg, EXO.on).toFixed(0)} s${p.cond < 0.97 ? '   r  repair' : ''}`;
}
export function stepWreck(dt) {
  if (!S.crash) { WRECK.inside = false; S.inside = null; return; }
  const P = S.P, A = WRECK.atm;
  // the sealed section keeps its air while the pump, a filter and the controller stand; without them it goes bad
  const ok = !!partNamed('air pump') && !!partNamed('air filter') && !!partNamed('controller'); A.ok = ok;
  A.o2 = clamp(A.o2 + (ok ? 0.004 : -0.0012) * dt, 0.02, 0.21); A.p = clamp(A.p + (ok ? 0.01 : -0.002) * dt, 0.3, 1);
  if (WRECK.inside) {
    // the hull's ends are walls; the torn tail is the door; the ceiling is low
    const [lx] = toLocal(P.x, P.y), xN = toWorld(HULL.x1 - 0.35, 0)[0], xD = toWorld(HULL.door - 0.5, 0)[0];
    if (P.x > xN) { P.x = xN; if (P.vx > 0) P.vx = 0; }
    if (P.x < xD || P.dead) enterWreck(false);
    const top = toWorld(lx, HULL.ceil)[1] - 1.82; if (P.y > top) { P.y = top; if (P.vy > 0) P.vy = 0; }
  }
  WRECK.cut += ((WRECK.inside ? 1 : 0) - WRECK.cut) * Math.min(1, dt * 5);
  WRECK.lit += ((BOOT.done || BOOT.t > 3 ? 1 : 0) - WRECK.lit) * Math.min(1, dt * 1.5);
  WRECK.near = partNear();
}
// the room behind the hull: the frame, the bulkhead, and every part that is still there. T = local to world.
export function drawInterior(b, time, a) {
  const t = HULL.tilt, lit = WRECK.lit, R = (lx, ly, w, h, col, al = 1, shape = 0, mode = 1, sd = 0, rot = 0) => { const q = toWorld(lx, ly); b.add(q[0], q[1], w, h, t + rot, col, al * a, shape, mode, sd, 0, 0, 0.3); };
  R((HULL.x0 + HULL.x1) / 2, 1.08, HULL.x1 - HULL.x0, 2.1, [0.012, 0.014, 0.017], 1, 0, 1, 3);                     // the inner skin, far side
  for (let i = 0; i < 16; i++) R(HULL.x0 + 0.25 + i * 0.48, 1.1, 0.02, 2.0, mul(C.steel, 0.16), 1, 0, 1, i);         // stringers
  R((HULL.x0 + HULL.x1) / 2, HULL.keel - 0.04, HULL.x1 - HULL.x0, 0.1, mul(C.steel, 0.5), 1, 0, 1, 4);              // the deck
  { const q = toWorld(-2.55, HULL.keel - 0.02); b.add(q[0], q[1], 0.5, 0.16, t + 0.5, [0.004, 0.004, 0.005], a, 0, 1); }   // where the keel broke
  for (const v of VOLUMES) {      // each volume: a faint floor mark in its use colour, its ceiling lamp
    const cx = (v.x0 + v.x1) / 2, on = lit * (v.sealed ? 1 : 0.55);
    R(cx, HULL.ceil - 0.05, 0.3, 0.04, mul(C.warm, 0.25 + 2.2 * on), 1, 0, 2);
    if (a > 0.3) { const q = toWorld(cx, 1.2); light.emit(q[0] / TS, q[1] / TS, 0.3 + 0.55 * on, 0.16 + 0.6 * on, 0.06 + 0.52 * on); }       // the emergency strip before the lights
  }
  for (const r of FRAME.ribs) { R(r, 1.08, 0.07, 2.1, mul(C.steel, 0.55), 1, 0, 1, 5); R(r, HULL.ceil - 0.02, 0.2, 0.06, mul(C.steel, 0.5), 1, 0, 1, 6); }   // ribs
  // the bulkhead and its door: the sealed section begins here
  R(HULL.bulkhead, 1.6, 0.1, 1.0, mul(C.hull, 0.3), 1, 0, 1, 7); R(HULL.bulkhead, 2.0, 0.16, 0.05, mul(WRECK.atm.ok ? C.cyan : C.red, 1.5 + Math.sin(time * 3)), 1, 0, 2);
  for (const p of WRECK.parts) {
    if (p.gone) { if (p.vol !== 'skin') R(p.lx, HULL.keel + 0.02, p.w, 0.025, mul(C.steel, 0.2), 0.8, 0, 1); continue; }       // the bolt marks where it stood
    const k = 0.35 + 0.65 * p.cond, near = WRECK.near === p, mk = WRECK.marked.has(p.id), sd = p.id * 3 + 1, col = n => mul(n, k);
    if (p.vol === 'skin') continue;
    if (p.name === 'bunk') { R(p.lx, p.ly, p.w, 0.1, col(mul(C.steel, 0.8)), 1, 0, 1, sd); R(p.lx, p.ly + 0.09, p.w - 0.08, 0.09, [0.05, 0.055, 0.06], 1, 2, 1, sd); R(p.lx - p.w / 2 + 0.08, p.ly - 0.12, 0.05, 0.2, col(C.steel), 1, 0, 1); R(p.lx + p.w / 2 - 0.08, p.ly - 0.12, 0.05, 0.2, col(C.steel), 1, 0, 1); }
    else if (p.name === 'suit locker') { R(p.lx, p.ly, p.w, p.h, col(mul(C.steel, 0.55)), 1, 0, 1, sd); R(p.lx, p.ly, p.w - 0.06, p.h - 0.08, [0.012, 0.013, 0.016], 1, 0, 1);
      if (!EXO.on) { R(p.lx, p.ly + 0.28, 0.2, 0.42, mul(C.suit, 1.5), 1, 2, 1, 2); R(p.lx, p.ly + 0.6, 0.16, 0.16, mul(C.suit, 1.8), 1, 2, 1, 3); R(p.lx - 0.04, p.ly - 0.25, 0.07, 0.6, mul(C.suit, 1.3), 1, 2, 1); R(p.lx + 0.05, p.ly - 0.25, 0.07, 0.6, mul(C.suit, 1.3), 1, 2, 1); R(p.lx + 0.02, p.ly + 0.61, 0.07, 0.035, mul(C.amber, 1.2 + Math.sin(time * 2.2)), 1, 0, 2); } }
    else if (p.name === 'computer core') { R(p.lx, p.ly, p.w, p.h, col(mul(C.dark, 1.4)), 1, 0, 1, sd); for (let i = 0; i < 6; i++) R(p.lx - 0.1 + (i % 2) * 0.2, p.ly - 0.34 + Math.floor(i / 2) * 0.3, 0.12, 0.03, mul(i % 3 ? C.cyan : C.amber, lit * (1 + Math.sin(time * (3 + i) + i))), 1, 0, 2); }
    else if (p.name === 'water tank') { R(p.lx, p.ly, p.w, p.h, col(mul(C.hull, 0.3)), 1, 2, 1, sd); R(p.lx, p.ly - 0.3, p.w + 0.03, 0.04, col(mul(C.steel, 0.8)), 1, 0, 1); R(p.lx, p.ly + 0.3, p.w + 0.03, 0.04, col(mul(C.steel, 0.8)), 1, 0, 1); }
    else if (p.name === 'fabricator') { R(p.lx, p.ly, p.w, p.h, col(mul(C.steel, 0.5)), 1, 0, 1, sd); R(p.lx, p.ly + 0.12, p.w - 0.1, 0.3, [0.008, 0.01, 0.012], 1, 0, 1); R(p.lx, p.ly + 0.12, p.w - 0.16, 0.03, mul(C.amber, 0.3 + lit * (S.fabOn ? 3 + Math.sin(time * 30) : 0.6)), 1, 0, 2); }
    else if (p.name === 'hold racks') { for (let i = 0; i < 3; i++) R(p.lx, HULL.keel + 0.2 + i * 0.36, p.w, 0.04, col(mul(C.steel, 0.7)), 1, 0, 1, sd + i); for (let i = 0; i < 4; i++) R(p.lx - 0.14 + (i % 2) * 0.26, HULL.keel + 0.34 + Math.floor(i / 2) * 0.36, 0.2, 0.2, mul(C.concrete, 0.6 + 0.3 * hash(i, 4, 503)), 1, 0, 1, i); }
    else if (p.name === 'toilet') { R(p.lx, p.ly - 0.06, p.w, 0.26, col(mul(C.hull, 0.4)), 1, 2, 1, sd); R(p.lx - 0.08, p.ly + 0.12, 0.07, 0.24, col(mul(C.hull, 0.35)), 1, 0, 1); }
    else if (p.name === 'table') { R(p.lx, p.ly + p.h / 2 - 0.03, p.w, 0.05, col(mul(C.steel, 0.9)), 1, 0, 1, sd); R(p.lx, p.ly - 0.04, 0.05, p.h - 0.08, col(mul(C.steel, 0.6)), 1, 0, 1); }
    else if (p.name === 'seat' || p.name === 'pilot seat') { R(p.lx, p.ly - 0.08, p.w, 0.07, col(mul(C.steel, 0.8)), 1, 2, 1, sd); R(p.lx - 0.09, p.ly + 0.1, 0.06, 0.34, col(mul(C.steel, 0.7)), 1, 2, 1); R(p.lx, p.ly - 0.2, 0.05, 0.2, col(mul(C.steel, 0.5)), 1, 0, 1); }
    else if (p.name.endsWith('pump') || p.name === 'turbopump') { R(p.lx, p.ly, p.w, p.h, col(mul(C.steel, 0.7)), 1, 2, 1, sd); R(p.lx, p.ly, p.w * 0.5, p.h * 0.5, col(C.dark), 1, 1, 1); R(p.lx + p.w * 0.5, p.ly, 0.16, 0.06, col(mul(C.brass, 0.6)), 1, 0, 1); if (p.use === 'air') R(p.lx, p.ly + p.h / 2 + 0.03, 0.05, 0.03, mul(WRECK.atm.ok ? C.acid : C.red, 2), 1, 0, 2); }
    else if (p.name === 'combustion chamber') { R(p.lx, p.ly, p.w, p.h, col(mul(C.dark, 1.3)), 1, 2, 1, sd); R(p.lx - 0.2, p.ly, 0.16, p.h * 0.7, col(mul(C.brass, 0.35)), 1, 0, 1, sd, 0.2); R(p.lx, p.ly + 0.1, p.w * 0.6, 0.03, [0.3, 0.07, 0.01], 0.6, 0, 2); }
    else R(p.lx, p.ly, p.w, p.h, col(p.scrap.copper > 0.5 ? mul(C.brass, 0.45) : mul(C.steel, 0.65)), 1, p.h < 0.1 ? 2 : 0, 1, sd);
    if (p.cond < 0.4) R(p.lx + p.w * 0.2, p.ly, p.w * 0.5, 0.03, [0.004, 0.004, 0.005], 0.9, 0, 1, sd, 0.7);                 // a crack through what the crash broke
    if (mk) R(p.lx, p.ly + p.h / 2 + 0.09, 0.07, 0.07, mul(C.amber, 2), 1, 1, 2);
    if (near && a > 0.5) { R(p.lx, p.ly + p.h / 2 + 0.03, p.w + 0.06, 0.012, mul(C.amber, 1.6), 0.8, 0, 2); R(p.lx, p.ly - p.h / 2 - 0.03, p.w + 0.06, 0.012, mul(C.amber, 1.6), 0.8, 0, 2); }
  }
}
// the plates of the skin that are still on, drawn over the hull's top edge (kit.js draws the rest of the outside)
export function drawSkin(b, time, a) { for (const p of WRECK.parts) if (p.vol === 'skin' && p.gone) { const q = toWorld(p.lx, p.ly - 0.1); b.add(q[0], q[1], p.w, 0.34, HULL.tilt, [0.006, 0.007, 0.009], a, 0, 1, p.id); } }
export function dumpWreck() { return { parts: WRECK.parts.map(p => [p.gone ? 1 : 0, p.cond]), inside: WRECK.inside ? 1 : 0, o2: +WRECK.atm.o2.toFixed(4), marked: [...WRECK.marked] }; }
export function loadWreck(o, seed) {
  wreckReset(seed); if (!o) return; if (!(o.parts || []).length) WRECK.parts = [];
  (o.parts || []).forEach((q, i) => { const p = WRECK.parts[i]; if (p) { p.gone = !!q[0]; p.cond = q[1]; } }); WRECK.inside = !!o.inside; S.inside = WRECK.inside ? 'wreck' : null; WRECK.atm.o2 = o.o2 === undefined ? 0.21 : o.o2; WRECK.marked = new Set(o.marked || []); WRECK.cut = WRECK.inside ? 1 : 0; WRECK.lit = BOOT.done ? 1 : 0;
}

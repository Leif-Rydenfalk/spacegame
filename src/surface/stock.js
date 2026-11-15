// stock: stockpile zones and the ledger (round 6 J and M).
// A zone is a stretch of ground with a filter, a priority and a limit, like a RimWorld stockpile. The AI makes the
// ones it needs by itself (a rubble yard for rock nobody has assayed, an ore bin, a rock pile for spoil) and sizes
// them; you can change the filter, the priority and the limit of any of them, add your own, or remove one. Everything
// loose gets hauled into the zone that takes it (supply.js makes the jobs). What lies in a zone is real: bodies on
// the ground, each one counted.
// The ledger is every stack the network owns, with the place it is in: on you, in the hold, in a chest, in a
// machine's output, in a zone, loose on the ground, in a robot's net. It is exact (the tests add it up), it is what
// the queue plans from, and with a time to reach you on every line it is your inventory: what a robot can bring
// within the reach time is "in reach", and you place and craft from it as if you held it.
import { ITEMS, inv } from '../items.js';
import { world, TS } from './world.js';
import { S } from './state.js';
import { F } from './factory.js';
import { matter } from './matter.js';
import { K, SHIP, isLinked } from './kit.js';
import { droneSpeed } from './physics.js';
import { spoilSiteX } from './spoil.js';

export const STOCK = { zones: [], nextId: 1, reachS: 60, auto: true };
// the zones the AI opens when something first needs one: [name, what it takes, where (m from the wreck), width, limit kg]
// round 7: every stockpile is on the back layer (what lies in one is drawn behind you and does not stand in your way),
// and spoil has a heap of its own that the AI sites away from the base (spoil.js spoilSiteX): where = null.
export const AUTO_ZONES = [['ore bin', ['iron ore', 'lean ore', 'copper ore', 'lumen'], -16.2, 3, 1200], ['rubble yard', ['rubble'], -20.2, 3.4, 2500], ['spoil heap', ['basalt', 'soil', 'slag'], null, 7, 12000], ['stores', ['silicon', 'swarf', 'metal powder', 'polymer'], -23.6, 2.2, 800], ['organics', ['biomass', 'fibre', 'chitin', 'resin', 'ichor', 'log'], -29.6, 3, 1500]];
export function addZone(name, filter, x, w, limit, auto = false) { const z = { id: STOCK.nextId++, name, filter: filter.slice(), x0: +(x - w / 2).toFixed(2), x1: +(x + w / 2).toFixed(2), pri: 1, limit, auto }; STOCK.zones.push(z); return z; }
export const zoneKg = z => { let s = 0; for (const c of matter.list) if (c.zone === z.id) s += c.kg; return s; };
// the zone that takes this item: the highest priority one with room. make = let the AI open its own when none does.
export function zoneFor(item, make = true) {
  let best = null; for (const z of STOCK.zones) if (z.filter.includes(item) && (!best || z.pri > best.pri) && zoneKg(z) < z.limit) best = z;
  if (!best && make && STOCK.auto && S.crash) { const a = AUTO_ZONES.find(q => q[1].includes(item)); if (a && !STOCK.zones.some(z => z.name === a[0])) { best = addZone(a[0], a[1], a[2] === null ? spoilSiteX(STOCK.ghosts ? STOCK.ghosts() : []) : SHIP.x + a[2] + 9, a[3], a[4], true); if (STOCK.onOpen) STOCK.onOpen(best); } }
  return best;
}
export const inZone = c => { if (!c.zone) return false; const z = STOCK.zones.find(q => q.id === c.zone); return !!z && z.limit > 0 && z.filter.includes(c.id); };       // a zone with no limit left is being emptied
// a zone is gone: what lay in it is loose again, and back in the front layer
export function removeZone(id) { const k = STOCK.zones.findIndex(q => q.id === id); if (k < 0) return; STOCK.zones.splice(k, 1); for (const c of matter.list) if (c.zone === id) { c.zone = 0; c.back = false; c.asleep = false; } }
// where in a zone the next load is set down: spread along it
export function zoneSpot(z) { const x = z.x0 + 0.4 + Math.random() * Math.max(0.2, z.x1 - z.x0 - 0.8), g = world.groundY(x, 12, 0, 40); return [x, (g === null ? 0 : g) + 1.3]; }
// seconds for a robot to bring kg from (x, y) to you: the flight both ways at the speed that load allows, and the handling
export function etaTo(x, y, kg, P = S.P) { const d = Math.hypot(x - P.x, y - P.y - 1), v = droneSpeed(Math.min(kg, 15)) || 2; return d / 9 + d / v + 4; }
// every stack the network owns: [{ item, n, kg, where, x, y, eta, hand }]
export function ledger() {
  const out = [], P = S.P, put = (item, n, where, x, y, hand) => { if (!(n > 1e-9)) return; const e = out.find(q => q.item === item && q.where === where); if (e) { e.n += n; e.kg += n * ITEMS[item].m; return; } const kg = n * ITEMS[item].m; out.push({ item, n, kg, where, x, y, eta: hand ? 0 : etaTo(x, y, Math.min(kg, 15)), hand: !!hand }); };
  for (const s of S.inv.slots) if (s) put(s.id, s.n, 'on you', P.x, P.y, true);
  if (S.crash) for (const s of K.hold.slots) if (s) put(s.id, s.n, 'hold', SHIP.hatch[0], SHIP.hatch[1]);
  let ci = 0; for (const m of F.machines) { const x = (m.x + m.w / 2) * TS, y = (m.y + m.h) * TS; if (m.kind === 'chest') { ci++; for (const s of m.inv.slots) if (s) put(s.id, s.n, 'chest ' + ci, x, y); } else for (const k in m.out) put(k, m.out[k], m.kind + ' out', x, y); }
  for (const c of matter.list) { if (c.gone || c.dumped) continue; const z = c.zone && STOCK.zones.find(q => q.id === c.zone); if (z) put(c.id, c.n, z.name, (z.x0 + z.x1) / 2, c.y); else if (isLinked(c.x, c.y)) put(c.id, c.n, 'loose', c.x, c.y); }
  return out;
}
// how much of an item is within reach (seconds), and the nearest stack of it
export function reachable(item, L = ledger(), robots = 1) { let n = 0, best = null; for (const e of L) if (e.item === item && (e.hand || (robots && e.eta <= STOCK.reachS))) { n += e.n; if (!best || e.eta < best.eta) best = e; } return { n, best }; }
export function dumpStock() { return { z: STOCK.zones.map(z => [z.id, z.name, z.filter, z.x0, z.x1, z.pri, z.limit, z.auto ? 1 : 0]), n: STOCK.nextId, r: STOCK.reachS }; }
export function loadStock(o) { STOCK.zones = ((o && o.z) || []).map(q => ({ id: q[0], name: q[1], filter: q[2].slice(), x0: q[3], x1: q[4], pri: q[5], limit: q[6], auto: !!q[7] })); STOCK.nextId = (o && o.n) || 1; STOCK.reachS = (o && o.r) || 60; STOCK.auto = true; }
export function drawZones(b, time, C, mul) {
  for (const z of STOCK.zones) { const g = world.groundY((z.x0 + z.x1) / 2, 12, 0, 40) || 0, g0 = world.groundY(z.x0, 12, 0, 40) ?? g, g1 = world.groundY(z.x1, 12, 0, 40) ?? g;
    // a stockpile is marked as a place behind the path: low posts, a dim rail between them, a lamp
    for (const [x, gy] of [[z.x0, g0], [z.x1, g1]]) { b.add(x, gy + 0.3, 0.04, 0.6, 0, mul(C.steel, 0.45), 1, 0, 1); b.add(x, gy + 0.62, 0.07, 0.04, 0, mul(z.limit > 0 ? C.amber : C.steel, 0.8), 0.9, 0, 2); }
    b.seg(z.x0, g0 + 0.5, z.x1, g1 + 0.5, 0.014, mul(C.steel, 0.35), 0.8, 0, 1); }
}

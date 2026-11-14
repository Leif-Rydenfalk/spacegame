// demand and supply: the core loop. The ship AI keeps target levels of what you use (iron, power cells, oxygen
// cells). When stock falls under a target, that is demand. For each demand it picks the best producer that stands:
// the machine that specialises in the recipe when there is one, the slow universal arm (the suit's matter compiler)
// when there is not. It queues the work there and sends the ship's robots to carry the inputs to it and the outputs
// back to the hold. Loose matter the laser leaves behind is part of the same graph: robots haul ore to whoever needs
// it, the rest to the hold, and spoil to the heap. Planning is pure (planDemand, bestProducer) and tested.
import { G, events } from '../core.js';
import { RECIPES, RECIPE, ITEMS, inv, printerQueue } from '../items.js';
import { world, TS } from './world.js';
import { S } from './state.js';
import { F, give, accepts } from './factory.js';
import { AUTO, planAll, buildNeeds, sinkFor, onBelt } from './auto.js';
import { matter } from './matter.js';
import { K, SHIP, isLinked } from './kit.js';

export const TARGETS0 = { iron: 30, 'power cell': 2, 'o2 cell': 2 };
export const SPOIL = { soil: 60, basalt: 160 }, DUMP = [SHIP.x - 9.5, 1.2];     // how much spoil the hold keeps; the rest goes to the heap
// the wreck's fabricator: the ship's own matter compiler, three times slower than the machine that specialises in a
// recipe (the arm is eight times slower). It works straight from the hold and puts what it makes back into it.
export const FAB = { slow: 3, w: 2000 };
export const SUP = { targets: { ...TARGETS0 }, orders: [], tick: 0, on: true, note: '', crawlers: 0 };
// the editor: set a stock target (0 or less removes it). Steps are 1 for things, 5 kg for bulk.
export const targetStep = id => ITEMS[id].u === 'ea' ? 1 : ITEMS[id].u === 'rd' ? 30 : 5;
export function setTarget(id, n) { if (!ITEMS[id]) return; if (n > 1e-9) SUP.targets[id] = +Math.min(n, 9999).toFixed(3); else delete SUP.targets[id]; SUP.tick = 0; }
// the producer for a recipe: its own machine if one stands, else the suit
export function bestProducer(recipe, kinds) { return kinds.has(recipe.by) ? recipe.by : 'suit'; }
// pure: stock, targets, pending = { item: amount }; kinds = Set of machine kinds that stand.
// Returns [{ item, need, recipe, producer, batches, inputs: { item: amount } }] for everything under its target.
export function planDemand(stock, targets, pending, kinds) {
  const out = [];
  for (const item in targets) {
    const need = targets[item] - (stock[item] || 0) - (pending[item] || 0); if (need <= 1e-9) continue;
    const r = RECIPES.find(q => item in q.out); if (!r) continue; const batches = Math.ceil(need / r.out[item] - 1e-9), inputs = {};
    for (const k in r.in) inputs[k] = r.in[k] * batches;
    out.push({ item, need, recipe: r.id, producer: bestProducer(r, kinds), batches, inputs });
  }
  return out;
}
// everything the network can count: the suit, the hold, chests, and what machines have finished
export function countStock() {
  const st = {}, add = I => { for (const s of I.slots) if (s) st[s.id] = (st[s.id] || 0) + s.n; };
  add(S.inv); if (S.crash) add(K.hold); for (const m of F.machines) { if (m.inv) add(m.inv); for (const k in m.out) st[k] = (st[k] || 0) + m.out[k]; }
  return st;
}
// what is already on its way: the arm's queue, ore in a furnace, a batch in an assembler, inputs waiting in a machine
export function countPending() {
  const p = {}, add = (k, n) => { p[k] = (p[k] || 0) + n; };
  for (const j of S.printer.q) { const r = RECIPE[j.r]; for (const k in r.out) add(k, r.out[k]); }
  if (K.fab) { const r = RECIPE[K.fab.r]; for (const k in r.out) add(k, r.out[k]); }
  for (const m of F.machines) {
    if (m.kind === 'furnace') { if (m.inp['iron ore'] > 0) add('iron', m.inp['iron ore'] / RECIPE.iron.in['iron ore']); if (m.inp['copper ore'] > 0) add('copper', m.inp['copper ore'] / RECIPE.copper.in['copper ore']); }
    else if (m.kind === 'assembler' && RECIPE[m.recipe]) { const r = RECIPE[m.recipe]; let n = m.busy ? 1 : 0, b = 1e9; for (const k in r.in) b = Math.min(b, Math.floor((m.inp[k] || 0) / r.in[k] + 1e-9)); n += b === 1e9 ? 0 : b; for (const k in r.out) add(k, r.out[k] * n); }
  }
  return p;
}
const mpos = m => [(m.x + m.w / 2) * TS, (m.y + m.h) * TS + 0.5];
// where an amount of an item can be fetched from, nearest to (x, y): a loose body first, then the hold, then a chest
function sourceOf(item, x, y, taken) {
  let best = null, bd = 1e9;
  for (const c of matter.list) if (c.id === item && !c.claim && !c.dumped && c.temp < 0.7 && !(c.skip > G.time) && !taken.has(c) && isLinked(c.x, c.y)) { const op = open(c); if (!op && !SUP.crawlers) continue; const d = Math.hypot(c.x - x, c.y - y) + (op ? 0 : 6); if (d < bd) { bd = d; best = { t: 'chunk', c, x: c.x, y: c.y + 0.5, n: c.n, ground: !op }; } }
  if (best) return best;
  if (S.crash && inv.count(K.hold, item) > 1e-6) return { t: 'inv', inv: K.hold, x: SHIP.hatch[0], y: SHIP.hatch[1] + 0.8, n: inv.count(K.hold, item) };
  for (const m of F.machines) if (m.kind === 'chest' && inv.count(m.inv, item) > 1e-6) return { t: 'inv', inv: m.inv, x: mpos(m)[0], y: mpos(m)[1], n: inv.count(m.inv, item) };
  return null;
}
// can a robot get a line on it? There has to be open air over it.
const open = c => world.dist(c.x, c.y + c.r + 0.6) > 0.35 && !world.ray(c.x, c.y + c.r + 0.05, 0, 1, 1.5);
// the open carrying jobs, most useful first. robotsBusy = jobs robots already have, so nothing is ordered twice.
export function carryJobs(busy) {
  const jobs = [], taken = new Set(), has = key => busy.has(key) || jobs.some(j => j.key === key), P = S.P;
  const push = (src, dst, item, n, key, pri) => { if (!src || has(key)) return; if (src.t === 'chunk') taken.add(src.c); jobs.push({ kind: 'carry', src, dst, item, n: Math.min(n, src.n), key, pri, x: src.x, y: src.y, ground: !!src.ground }); };
  for (const o of SUP.orders) {
    if (o.producer === 'suit') { if (!o.missing || P.dead || !isLinked(P.x, P.y + 1)) continue; for (const k in o.missing) push(sourceOf(k, P.x, P.y, taken), { t: 'player' }, k, o.missing[k], 'player:' + k, 0); continue; }
    const m = o.machine; if (!m) continue; const [mx, my] = mpos(m), r = RECIPE[o.recipe];
    for (const k in r.in) { const want = Math.min(o.inputs[k], r.in[k] * (m.kind === 'furnace' ? 20 : 3)) - (m.inp[k] || 0); if (want > r.in[k] * 0.5) push(sourceOf(k, mx, my, taken), { t: 'mach', m, x: mx, y: my }, k, want, 'in:' + F.machines.indexOf(m) + ':' + k, 1); }
  }
  if (S.crash) {
    for (const m of F.machines) if (m.kind === 'furnace' || m.kind === 'assembler' || m.kind === 'miner') for (const k in m.out) if (m.out[k] >= (ITEMS[k].u === 'ea' ? 1 : m.on ? 6 : 0.5)) { if (onBelt(m)) continue; const [mx, my] = mpos(m), sk = sinkFor(m, k), direct = sk && accepts(sk, k);      // straight to whoever consumes it, else to the hold; a finished belt needs no robot
      if (isLinked(mx, my)) push({ t: 'out', m, x: mx, y: my, n: m.out[k] }, direct ? { t: 'mach', m: sk, x: mpos(sk)[0], y: mpos(sk)[1] } : { t: 'inv', inv: K.hold, x: SHIP.hatch[0], y: SHIP.hatch[1] + 0.8 }, k, m.out[k], 'out:' + F.machines.indexOf(m) + ':' + k, 2); }
    // loose matter: ore and organics to the hold; spoil to the hold while it wants some, then to the heap
    const spoilHave = {}; for (const k in SPOIL) spoilHave[k] = inv.count(K.hold, k);
    for (const c of matter.list) {
      if (c.claim || c.dumped || c.temp > 0.7 || c.skip > G.time || taken.has(c) || jobs.length > 24 || !isLinked(c.x, c.y)) continue; const ground = !open(c); if (ground && !SUP.crawlers) { c.skip = G.time + 6; continue; } const key = 'loose:' + c.uid; if (has(key)) continue;
      const spoil = c.id in SPOIL, toHold = !spoil || spoilHave[c.id] < SPOIL[c.id]; if (spoil && toHold) spoilHave[c.id] += c.n;
      jobs.push({ kind: 'carry', src: { t: 'chunk', c, x: c.x, y: c.y + 0.5, n: c.n }, dst: toHold ? { t: 'inv', inv: K.hold, x: SHIP.hatch[0], y: SHIP.hatch[1] + 0.8 } : { t: 'dump', x: DUMP[0], y: DUMP[1] }, item: c.id, n: c.n, key, pri: spoil ? 4 : 3, x: c.x, y: c.y + 0.5, ground });
    }
  }
  return jobs.sort((a, b) => a.pri - b.pri);
}
export function stepSupply(dt) {
  SUP.tick -= dt; if (SUP.tick > 0) return; SUP.tick = 1;
  if (K.fab && S.crash) { K.fab.left -= 1; if (K.fab.left <= 0) { const r = RECIPE[K.fab.r]; for (const k in r.out) { const left = inv.add(K.hold, k, r.out[k]); if (left > 1e-9) matter.spawn(k, left, SHIP.hatch[0], SHIP.hatch[1] + 0.6); } events.emit('fabDone', K.fab.r); K.fab = null; } }
  if (!SUP.on) { SUP.orders = []; return; }
  // the queue's kits first, then the stock targets; inputs of every order become demand in turn (auto.js planAll)
  const kinds = new Set(F.machines.map(m => m.kind)); if (S.crash) kinds.add('ship'); const stock = SUP.stock = countStock(), plan = planAll(stock, SUP.targets, buildNeeds(), SUP.pending = countPending(), kinds), orders = SUP.orders = plan.orders, P = S.P, used = new Set(), held = {};
  AUTO.status = plan.status; AUTO.short = SUP.short = plan.short; AUTO.orderOf = item => orders.find(o => o.item === item);
  for (const o of orders) {
    const r = RECIPE[o.recipe]; o.missing = null; o.machine = null;
    // an order that waits for something nobody has takes no producer and keeps nothing back: the ones behind it go on
    const dead = Object.keys(r.in).filter(k => plan.short[k] > 1e-9 && (stock[k] || 0) < r.in[k] - 1e-9 && !RECIPE[k]);
    if (dead.length && o.producer !== 'suit') { o.note = `waits for ${dead.join(', ')}: none loose or stored`; continue; }
    if (o.producer === 'ship') {       // the wreck's fabricator: one job at a time, in the order of the plan, from what the hold has
      if (K.fab) { o.note = K.fab.r === o.recipe ? `ship fabricator: ${Math.ceil(K.fab.left)} s` : 'ship fabricator is on an earlier order'; if (K.fab.r !== o.recipe) for (const k in r.in) held[k] = (held[k] || 0) + r.in[k]; continue; }
      // what an earlier order still waits for is kept for it: a later, cheaper order does not eat the iron first
      const lack = Object.keys(r.in).filter(k => inv.count(K.hold, k) < r.in[k] - 1e-9), kept = Object.keys(r.in).filter(k => held[k] && inv.count(K.hold, k) - held[k] < r.in[k] - 1e-9);
      if (!lack.length && !kept.length && inv.pay(K.hold, r.in)) { K.fab = { r: r.id, left: r.t * FAB.slow, total: r.t * FAB.slow }; o.note = `ship fabricator: ${Math.ceil(K.fab.left)} s`; events.emit('aiQueued', o.item); }
      else if (lack.length && !P.dead && isLinked(P.x, P.y + 1) && S.has(r.in) && S.printer.q.filter(j => j.r === o.recipe).length < Math.min(o.batches, 2) && S.printer.q.length < 6 && printerQueue(S.printer, S.inv, o.recipe, 1)) { o.note = 'queued on the arm: the suit holds the ' + Object.keys(r.in).join(', '); events.emit('aiQueued', o.item); }      // every means: the hold has none, the suit does
      else { for (const k in r.in) held[k] = (held[k] || 0) + r.in[k]; o.note = lack.length ? 'ship fabricator waits for ' + lack.join(', ') + ' in the hold' : 'waits: the ' + kept.join(', ') + ' in the hold is kept for an earlier order'; }
      continue;
    }
    if (o.producer === 'suit') {       // the arm: queue it when the suit holds the inputs, else say what is missing so a robot brings it
      if (P.dead || !isLinked(P.x, P.y + 1)) { o.note = 'no link to the suit'; continue; }
      const queued = S.printer.q.filter(j => j.r === o.recipe).length;
      if (queued < Math.min(o.batches, 2) && S.printer.q.length < 6) { if (printerQueue(S.printer, S.inv, o.recipe, 1)) { o.note = 'queued on the arm'; events.emit('aiQueued', o.item); } else { o.missing = {}; for (const k in r.in) { const lack = r.in[k] * Math.min(o.batches, 2) - S.count(k); if (lack > 1e-6) o.missing[k] = lack; } o.note = 'arm waits for ' + Object.keys(o.missing).join(', '); } }
      else o.note = 'printing on the arm';
    } else {
      let best = null, bd = 1e9; for (const m of F.machines) if (m.kind === o.producer && !used.has(m) && (m.kind !== 'assembler' || m.recipe === o.recipe || !m.busy)) { const d = Math.abs((m.x + m.w / 2) * TS - SHIP.x) + (m.recipe === o.recipe ? 0 : 50); if (d < bd) { bd = d; best = m; } }
      if (!best) { o.note = 'every ' + o.producer + ' is on an earlier order'; continue; } if (best.kind === 'assembler') used.add(best);
      if (best.kind === 'assembler' && best.recipe !== o.recipe && !best.busy) { for (const k in best.inp) if (best.inp[k] > 1e-6) matter.spawn(k, best.inp[k], (best.x + 1) * TS, (best.y + 2.5) * TS); best.inp = {}; best.recipe = o.recipe; }
      o.machine = best; o.note = best.pw !== undefined && best.pw < 0.05 ? o.producer + ' has no power' : best.on ? o.producer + ' running' + (best.pw < 0.999 ? ' at ' + (best.pw * 100).toFixed(0) + '% power' : '') : o.producer + ' waits for ' + Object.keys(r.in).filter(k => (best.inp[k] || 0) < r.in[k]).join(', ');
    }
  }
}
export function dumpSupply() { return { t: { ...SUP.targets }, on: SUP.on ? 1 : 0, fab: K.fab ? [K.fab.r, K.fab.left, K.fab.total] : 0 }; }
export { planAll };
export function loadSupply(o) { SUP.targets = { ...(o ? o.t : TARGETS0) }; SUP.on = o ? !!o.on : true; SUP.orders = []; SUP.tick = 0; K.fab = o && o.fab ? { r: o.fab[0], left: o.fab[1], total: o.fab[2] } : null; }
export { give };

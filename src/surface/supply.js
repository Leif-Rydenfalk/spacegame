// demand and supply: the core loop. The AI keeps target levels of what you use (iron, power cells, oxygen
// cells). When stock falls under a target, that is demand. For each demand it picks the best producer that stands:
// the machine that specialises in the recipe when there is one, the slow universal arm (the suit's matter compiler)
// when there is not. It queues the work there and sends the ship's robots to carry the inputs to it and the outputs
// back to the hold. Loose matter the laser leaves behind is part of the same graph: robots haul ore to whoever needs
// it, the rest to the hold, and spoil to the heap. Planning is pure (planDemand, bestProducer) and tested.
import { G, events } from '../core.js';
import { RECIPES, RECIPE, ITEMS, inv, printerQueue, recipeFor, SUIT_SLOW } from '../items.js';
import { STOCK, zoneFor, zoneSpot, inZone, ledger } from './stock.js';
import { EXO } from './suit.js';
import { cutoff } from './geology.js';
import { world, TS } from './world.js';
import { S } from './state.js';
import { F, give, accepts } from './factory.js';
import { AUTO, planAll, buildNeeds, sinkFor, onBelt } from './auto.js';
import { matter } from './matter.js';
import { K, SHIP, isLinked } from './kit.js';

export const TARGETS0 = { iron: 20, water: 10 };
export const SPOIL = { soil: 60, basalt: 160 }, DUMP = [SHIP.x - 9.5, 1.2];     // how much spoil the hold keeps; the rest goes to the heap
// the wreck's fabricator: the ship's own matter compiler, three times slower than the machine that specialises in a
// recipe (the arm is eight times slower). It works straight from the hold and puts what it makes back into it.
export const FAB = { slow: 3, w: 2000 };
export const SUP = { targets: { ...TARGETS0 }, orders: [], tick: 0, on: true, note: '', crawlers: 0, wanted: [], nextWant: 1, cut: 0.2 };
// round 6 J: queue anything. An order for an item you cannot make right now is still an order: it goes to the one
// queue, whoever can make it bids for it (the arm, the wreck's fabricator, a machine), what it needs becomes demand
// down to raw rock, and when it exists a robot brings it to you. to: 'player' | 'stock'.
export function orderItem(item, n = 1, to = 'player') { if (!ITEMS[item]) return null; const e = SUP.wanted.find(q => q.item === item && q.to === to); if (e) { e.n += n; SUP.tick = 0; return e; } const w = { id: SUP.nextWant++, item, n, to, have0: to === 'player' ? S.count(item) : 0 }; SUP.wanted.push(w); SUP.tick = 0; events.emit('ordered', item); return w; }
export function cancelWant(id) { const i = SUP.wanted.findIndex(q => q.id === id); if (i >= 0) SUP.wanted.splice(i, 1); SUP.tick = 0; }
// who makes a batch soonest: every producer that stands bids its time. Returns { who, s, bids: [[who, s]] }
export function bidProducers(r, kinds) {
  const bids = [], P = S.P;
  // a machine of the kind: its batch time, longer while it is busy and while the grid starves it. The wreck's fabricator and
  // the arm are matter compilers: they make anything, three and eight times slower, after what they already have queued.
  let n = 0, q = 0, pw = 1; for (const m of F.machines) if (m.kind === r.by) { n++; q += m.busy ? 1 : 0; pw = Math.min(pw, m.pw === undefined ? 1 : Math.max(0.03, m.pw)); } if (n) bids.push([r.by, r.t * (1 + q / n) / pw]);
  const cell = r.by === 'furnace' && r.e;       // molten-oxide electrolysis needs the furnace itself: no compiler does it
  if (kinds.has('ship') && !cell) bids.push(['ship', r.t * FAB.slow + (K.fab ? K.fab.left : 0)]);
  if (EXO.on && !P.dead && !cell) bids.push(['suit', r.t * SUIT_SLOW * (P.armW ? 5000 / P.armW : 1) + S.printer.q.reduce((a, j) => a + j.left, 0) + (S.has(r.in) ? 0 : 25)]);       // what the arm does not hold has to be flown to it first
  if (!bids.length) bids.push([cell ? r.by : 'suit', 1e6]);
  bids.sort((a, b) => a[1] - b[1]); return { who: bids[0][0], s: bids[0][1], bids };
}
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
  const st = {}; SUP.ledger = ledger(); for (const e of SUP.ledger) st[e.item] = (st[e.item] || 0) + e.n;
  for (const k in st) if (st[k] > 1e-6) S.known.add(k);      // what the base has seen is what it can show recipes for
  return st;
}
// what is already on its way: the arm's queue, ore in a furnace, a batch in an assembler, inputs waiting in a machine
export function countPending() {
  const p = {}, add = (k, n) => { p[k] = (p[k] || 0) + n; };
  for (const j of S.printer.q) { const r = RECIPE[j.r]; for (const k in r.out) add(k, r.out[k]); }
  if (K.fab) { const r = RECIPE[K.fab.r]; for (const k in r.out) add(k, r.out[k]); }
  for (const m of F.machines) {
    if (m.kind === 'furnace') { for (const r of RECIPES) if (r.by === 'furnace') { const k = Object.keys(r.in)[0]; if (m.inp[k] > 0) add(Object.keys(r.out)[0], m.inp[k] / r.in[k]); } }
    else if (m.kind === 'assay station') { if (m.inp.rubble > 0) add('basalt', m.inp.rubble * 0.5); }
    else if (m.kind === 'assembler' && RECIPE[m.recipe]) { const r = RECIPE[m.recipe]; let n = m.busy ? 1 : 0, b = 1e9; for (const k in r.in) b = Math.min(b, Math.floor((m.inp[k] || 0) / r.in[k] + 1e-9)); n += b === 1e9 ? 0 : b; for (const k in r.out) add(k, r.out[k] * n); }
  }
  return p;
}
const mpos = m => [(m.x + m.w / 2) * TS, (m.y + m.h) * TS + 0.5];
// where an amount of an item can be fetched from, nearest to (x, y): a loose body first, then the hold, then a chest
function sourceOf(item, x, y, taken) {
  let best = null, bd = 1e9;
  for (const c of matter.list) if (c.id === item && !c.claim && !c.dumped && c.temp < 0.7 && !(c.skip > G.time && !c.zone) && !taken.has(c) && isLinked(c.x, c.y)) { const op = open(c), nd = c.noDrone > G.time; if (nd && !SUP.crawlers) continue; const d = Math.hypot(c.x - x, c.y - y) + (op ? 0 : 6); if (d < bd) { bd = d; best = { t: 'chunk', c, x: c.x, y: c.y + 0.5, n: c.n, ground: !op, noDrone: nd }; } }
  if (best) return best;
  if (S.crash && inv.count(K.hold, item) > 1e-6) return { t: 'inv', inv: K.hold, x: SHIP.hatch[0], y: SHIP.hatch[1] + 0.8, n: inv.count(K.hold, item) };
  for (const m of F.machines) if (m.kind === 'chest' && inv.count(m.inv, item) > 1e-6) return { t: 'inv', inv: m.inv, x: mpos(m)[0], y: mpos(m)[1], n: inv.count(m.inv, item) };
  return null;
}
// is there open air over it? What lies under a ledge is the ground hauler's first; a drone goes in for it when it finds
// a way through the air (nav.js), and when it finds none the piece is marked noDrone for a while.
const open = c => world.dist(c.x, c.y + c.r + 0.6) > 0.35 && !world.ray(c.x, c.y + c.r + 0.05, 0, 1, 1.5);
// the open carrying jobs, most useful first. robotsBusy = jobs robots already have, so nothing is ordered twice.
// kg-or-units of an item the ship hold can still take: its free slots and the unfilled part of its stacks of it
export function holdRoom(id) { const d = ITEMS[id]; let r = 0; for (const s of K.hold.slots) r += !s ? d.cap : s.id === id ? Math.max(0, d.cap - s.n) : 0; return r; }
export function carryJobs(busy) {
  const jobs = [], taken = new Set(), has = key => busy.has(key) || jobs.some(j => j.key === key), P = S.P;
  const push = (src, dst, item, n, key, pri) => { if (!src || has(key)) return; if (src.t === 'chunk') taken.add(src.c); jobs.push({ kind: 'carry', src, dst, item, n: Math.min(n, src.n), key, pri, x: src.x, y: src.y, ground: !!src.ground, noDrone: !!src.noDrone }); };
  // what you ordered and what now exists somewhere: it is brought to you
  for (const w of SUP.wanted) { if (w.to !== 'player' || P.dead || !isLinked(P.x, P.y + 1)) continue; const lack = w.n - Math.max(0, S.count(w.item) - w.have0); if (lack > 1e-6) { const src = sourceOf(w.item, P.x, P.y, taken) || outOf(w.item); if (src) push(src, { t: 'player' }, w.item, lack, 'want:' + w.id, 0); } }
  // the suit's cooling water, kept filled
  if (EXO.on && !P.dead && isLinked(P.x, P.y + 1) && P.st && P.st.packL > 0 && EXO.water + S.count('water') < P.st.packL * 0.4) push(sourceOf('water', P.x, P.y, taken), { t: 'player' }, 'water', P.st.packL, 'player:water', 0);
  for (const o of SUP.orders) {
    if (o.producer === 'suit') { if (!o.missing || P.dead || !isLinked(P.x, P.y + 1)) continue; for (const k in o.missing) push(sourceOf(k, P.x, P.y, taken), { t: 'player' }, k, o.missing[k], 'player:' + k, 0); continue; }
    // the fabricator works from the hold: what an order of its needs and the hold lacks is brought to the hold from wherever it lies
    if (o.producer === 'ship' && S.crash) { const r = RECIPE[o.recipe]; for (const k in r.in) { const lack = Math.min(o.inputs[k], r.in[k] * 2) - inv.count(K.hold, k); if (lack > 1e-6 && holdRoom(k) >= lack) { const src = sourceOf(k, SHIP.hatch[0], SHIP.hatch[1], taken); if (src && src.inv !== K.hold) push(src, { t: 'inv', inv: K.hold, x: SHIP.hatch[0], y: SHIP.hatch[1] + 0.8 }, k, lack, 'fab:' + k, 1); } } continue; }
    const m = o.machine; if (!m) continue; const [mx, my] = mpos(m), r = RECIPE[o.recipe];
    for (const k in r.in) { const want = Math.min(o.inputs[k], r.in[k] * (m.kind === 'furnace' ? 6 : 3)) - (m.inp[k] || 0); if (want > r.in[k] * 0.5) push(sourceOf(k, mx, my, taken), { t: 'mach', m, x: mx, y: my }, k, want, 'in:' + F.machines.indexOf(m) + ':' + k, 1); }
  }
  // what a machine asks for by itself (the shaft rig's rods and casing, the assay station's rubble)
  for (const m of F.machines) if (m.wants) { const [mx, my] = mpos(m); if (!isLinked(mx, my)) continue; for (const k in m.wants) if (m.wants[k] > 1e-6) push(sourceOf(k, mx, my, taken), { t: 'mach', m, x: mx, y: my }, k, m.wants[k], 'in:' + F.machines.indexOf(m) + ':' + k, 1); }
  if (S.crash || F.machines.some(m => m.kind === 'chest')) {
    // the hold is finite: nothing is carried to it that it has no room for. Bulk goes to its stockpile zone instead.
    const room = {}, fits = (id, n) => { if (!S.crash) return false; if (room[id] === undefined) room[id] = holdRoom(id); if (room[id] < Math.min(n, ITEMS[id].u === 'ea' ? 1 : 2)) return false; room[id] -= n; return true; }; SUP.full = false;
    const bulk = id => ITEMS[id].cat === 'raw', holdDst = () => ({ t: 'inv', inv: K.hold, x: SHIP.hatch[0], y: SHIP.hatch[1] + 0.8 }), zoneDst = id => { const z = zoneFor(id); if (!z) return null; const [x, y] = zoneSpot(z); return { t: 'zone', z, x, y }; };
    for (const m of F.machines) if (m.kind === 'furnace' || m.kind === 'assembler' || m.kind === 'miner' || m.kind === 'assay station' || m.kind === 'shaft rig' || m.kind === 'pump') for (const k in m.out) if (m.out[k] >= (ITEMS[k].u === 'ea' ? 1 : m.on ? 6 : 0.5)) { if (onBelt(m)) continue; const [mx, my] = mpos(m), sk = sinkFor(m, k), direct = sk && accepts(sk, k);      // straight to whoever consumes it, else to stock; a finished belt needs no robot
      if (!isLinked(mx, my)) continue; const dst = direct ? { t: 'mach', m: sk, x: mpos(sk)[0], y: mpos(sk)[1] } : bulk(k) ? zoneDst(k) || (fits(k, m.out[k]) ? holdDst() : null) : fits(k, m.out[k]) ? holdDst() : null; if (!dst) { SUP.full = true; continue; }
      push({ t: 'out', m, x: mx, y: my, n: m.out[k] }, dst, k, m.out[k], 'out:' + F.machines.indexOf(m) + ':' + k, 2); }
    // loose matter is tidied: rubble to the assay station when one stands, everything raw into its zone, things into the hold
    const assay = F.machines.filter(m => m.kind === 'assay station');
    for (const c of matter.list) {
      if (c.claim || c.dumped || c.temp > 0.7 || c.skip > G.time || taken.has(c) || jobs.length > 28 || !isLinked(c.x, c.y)) continue; const ground = !open(c), noDrone = c.noDrone > G.time; if (noDrone && !SUP.crawlers) continue; const key = 'loose:' + c.uid; if (has(key)) continue;
      let dst = null, pri = 3;
      if (c.id === 'rubble' && assay.length) { const m = assay.find(q => (q.inp.rubble || 0) < 60); if (m) { dst = { t: 'mach', m, x: mpos(m)[0], y: mpos(m)[1] }; pri = 1; } }
      if (!dst) { if (inZone(c)) continue; if (bulk(c.id)) { dst = zoneDst(c.id); pri = c.id === 'basalt' || c.id === 'soil' || c.id === 'slag' ? 4 : 3; } if (!dst) { if (!fits(c.id, c.n)) { SUP.full = true; continue; } dst = holdDst(); } }
      jobs.push({ kind: 'carry', src: { t: 'chunk', c, x: c.x, y: c.y + 0.5, n: c.n }, dst, item: c.id, n: c.n, key, pri, x: c.x, y: c.y + 0.5, ground, noDrone });
    }
  }
  return jobs.sort((a, b) => a.pri - b.pri);
}
// a machine's finished output of an item, as a source
function outOf(item) { for (const m of F.machines) if ((m.out[item] || 0) > 1e-6) return { t: 'out', m, x: mpos(m)[0], y: mpos(m)[1], n: m.out[item] }; return null; }
export function stepSupply(dt) {
  SUP.tick -= dt; if (SUP.tick > 0) return; SUP.tick = 1;
  if (K.fab && S.crash) { K.fab.left -= 1; if (K.fab.left <= 0) { const r = RECIPE[K.fab.r]; for (const k in r.out) { const left = inv.add(K.hold, k, r.out[k]); if (left > 1e-9) matter.spawn(k, left, SHIP.hatch[0], SHIP.hatch[1] + 0.6); } events.emit('fabDone', K.fab.r); K.fab = null; S.fabOn = false; } }
  if (!SUP.on) { SUP.orders = []; return; }
  // the queue's kits first, then the stock targets; inputs of every order become demand in turn (auto.js planAll)
  const kinds = new Set(F.machines.map(m => m.kind)); if (S.crash) kinds.add('ship'); kinds.pick = r => bidProducers(r, kinds); const stock = SUP.stock = countStock();
  // an order is done when you hold what you asked for (or stock has it, for a stock order)
  for (let i = SUP.wanted.length - 1; i >= 0; i--) { const w = SUP.wanted[i]; if ((w.to === 'player' ? S.count(w.item) - w.have0 : stock[w.item] || 0) >= w.n - 1e-6) { SUP.wanted.splice(i, 1); events.emit('orderDone', w.item); } }
  // the live cut-off grade: how poor a rock is still worth moving, from how far it is hauled and how short the iron is
  SUP.cut = cutoff(30, SUP.targets.iron ? 1 - Math.min(1, (stock.iron || 0) / SUP.targets.iron) : 0.2);
  const wants = SUP.wanted.map(w => ({ id: 'w' + w.id, item: w.item, n: w.n + (w.to === 'player' ? w.have0 : 0) })), plan = planAll(stock, SUP.targets, buildNeeds().concat(wants), SUP.pending = countPending(), kinds), orders = SUP.orders = plan.orders, P = S.P, used = new Set(), held = {};
  AUTO.status = plan.status; AUTO.short = SUP.short = plan.short; AUTO.orderOf = item => orders.find(o => o.item === item);
  for (const o of orders) {
    const r = RECIPE[o.recipe]; o.missing = null; o.machine = null;
    // an order that waits for something nobody has takes no producer and keeps nothing back: the ones behind it go on
    const dead = Object.keys(r.in).filter(k => plan.short[k] > 1e-9 && (stock[k] || 0) < r.in[k] - 1e-9 && !RECIPE[k]);
    if (dead.length && o.producer !== 'suit') { o.note = `waits for ${dead.join(', ')}: none loose or stored`; continue; }
    if (o.bids) o.bidNote = o.bids.slice(0, 3).map(([w, t]) => `${w === 'ship' ? 'fabricator' : w === 'suit' ? 'arm' : w} ${t > 9e5 ? 'cannot' : t.toFixed(0) + ' s'}`).join(', ');
    if (o.producer === 'ship') {       // the wreck's fabricator: one job at a time, in the order of the plan, from what the hold has
      if (K.fab) { o.note = K.fab.r === o.recipe ? `fabricator: ${Math.ceil(K.fab.left)} s` : 'fabricator is on an earlier order'; if (K.fab.r !== o.recipe) for (const k in r.in) held[k] = (held[k] || 0) + r.in[k]; continue; }
      // what an earlier order still waits for is kept for it: a later, cheaper order does not eat the iron first
      const lack = Object.keys(r.in).filter(k => inv.count(K.hold, k) < r.in[k] - 1e-9), kept = Object.keys(r.in).filter(k => held[k] && inv.count(K.hold, k) - held[k] < r.in[k] - 1e-9);
      if (!lack.length && !kept.length && inv.pay(K.hold, r.in)) { K.fab = { r: r.id, left: r.t * FAB.slow, total: r.t * FAB.slow }; S.fabOn = true; o.note = `fabricator: ${Math.ceil(K.fab.left)} s`; events.emit('aiQueued', o.item); }
      else if (o.why === 'build' && lack.length && !P.dead && isLinked(P.x, P.y + 1) && S.has(r.in) && S.printer.q.filter(j => j.r === o.recipe).length < Math.min(o.batches, 2) && S.printer.q.length < 6 && printerQueue(S.printer, S.inv, o.recipe, 1)) { o.note = 'queued on the arm: the suit holds the ' + Object.keys(r.in).join(', '); events.emit('aiQueued', o.item); }      // every means: the hold has none, the suit does
      else { for (const k in r.in) held[k] = (held[k] || 0) + r.in[k]; o.note = lack.length ? 'fabricator waits for ' + lack.join(', ') + ' in the hold' : 'waits: the ' + kept.join(', ') + ' in the hold is kept for an earlier order'; }
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
export function dumpSupply() { return { t: { ...SUP.targets }, on: SUP.on ? 1 : 0, fab: K.fab ? [K.fab.r, K.fab.left, K.fab.total] : 0, w: SUP.wanted.map(w => [w.id, w.item, w.n, w.to, w.have0]), nw: SUP.nextWant }; }
export { planAll };
export function loadSupply(o) { SUP.targets = { ...(o ? o.t : TARGETS0) }; SUP.on = o ? !!o.on : true; SUP.orders = []; SUP.tick = 0; SUP.wanted = ((o && o.w) || []).filter(q => ITEMS[q[1]]).map(q => ({ id: q[0], item: q[1], n: q[2], to: q[3], have0: q[4] })); SUP.nextWant = (o && o.nw) || 1; for (const k in SUP.targets) if (!ITEMS[k]) delete SUP.targets[k]; K.fab = o && o.fab && RECIPE[o.fab[0]] ? { r: o.fab[0], left: o.fab[1], total: o.fab[2] } : null; }
export { give };

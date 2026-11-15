// demand and supply: the core loop. The AI keeps target levels of what you use (iron, water). When stock falls under a
// target, that is demand. For each demand it picks the best producer that stands: the machine that specialises in the
// recipe when there is one; else the conventional machine-shop gear in the wreck's hold, if it can make the thing at
// all (round 7: a CNC mill and lathe, a metal powder printer, a polymer printer, a solder bench, each with its own
// feedstock and limits); and only when nothing conventional can, the arm: the one matter compiler there is, slow,
// imperfect and not replaceable. It queues the work there and sends the ship's robots to carry the inputs to it and
// the outputs back to the hold. Loose matter the laser leaves behind is part of the same graph: robots haul ore to
// whoever needs it, the rest to its stockpile. Planning is pure (planDemand, bestProducer, producersOf) and tested.
import { G, events } from '../core.js';
import { RECIPES, RECIPE, ITEMS, SHOP, MACH_W, inv, printerQueue, recipeFor, SUIT_SLOW, producersOf, effRecipe, toolOf, yieldOf } from '../items.js';
import { STOCK, zoneFor, zoneSpot, inZone, ledger } from './stock.js';
import { EXO } from './suit.js';
import { cutoff } from './geology.js';
import { world, TS } from './world.js';
import { S } from './state.js';
import { F, give, accepts, isBatch, recipeOf } from './factory.js';
import { AUTO, planAll, buildNeeds, sinkFor, onBelt } from './auto.js';
import { matter } from './matter.js';
import { K, SHIP, isLinked } from './kit.js';
import { WRECK } from './wreck.js';
import { FILL, SPOIL as SPOILK, fillJobs, fillWant, stepSpoil } from './spoil.js';
import { BP } from './blueprint.js';
import { LOG } from './market.js';

export const TARGETS0 = { iron: 20, water: 10 };
export const SPOIL = { soil: 60, basalt: 160 }, DUMP = [SHIP.x - 9.5, 1.2];     // how much spoil the hold keeps; the rest goes to the heap
// the ship has no matter compiler (they are rare and dear even on Earth: the one on your arm is the only one here). What
// its hold has is a small machine shop. Each tool is a part of the wreck (salvage it and it is a machine you can stand
// anywhere); in the wreck it runs on the auxiliary bus (4 kW between them), works from the hold and puts what it makes
// back there, one job at a time, as fast as its condition allows.
export const AUX_SHOP_W = 4000;
export const SUP = { targets: { ...TARGETS0 }, orders: [], tick: 0, on: true, note: '', crawlers: 0, wanted: [], nextWant: 1, cut: 0.2, shop: {}, armHeld: 0, armNeed: [] };
export const shopPart = tool => WRECK.parts.find(p => p.use === 'shop' && p.item === tool && !p.gone) || null;
export const shopOk = tool => { const p = S.crash && shopPart(tool); return !!p && p.cond >= 0.4; };
// how fast a tool in the wreck runs: its condition, and its share of the auxiliary bus when the tools together want more
// than it gives (the reactor in its bay feeds them all)
export function shopSpeed(tool) { const p = shopPart(tool); if (!p) return 0; let w = 0; for (const t in SUP.shop) if (SUP.shop[t]) w += MACH_W[t]; if (!SUP.shop[tool]) w += MACH_W[tool]; return (0.5 + 0.5 * p.cond) * (K.reactor.state === 'ship' ? 1 : Math.min(1, AUX_SHOP_W / Math.max(1, w))); }
// seconds the arm needs for one batch, after what it already has queued
export const armTime = r => { const P = S.P; return r.t * SUIT_SLOW * (P.armW ? 5000 / P.armW : 1) / Math.max(0.2, EXO.arm === undefined ? 1 : EXO.arm) / yieldOf(r, (S.printer.runs || {})[r.id] || 0); };
export const armEta = () => S.printer.q.reduce((a, j) => a + j.left, 0) * (S.P.armW ? 5000 / S.P.armW : 1);
// round 6 J: queue anything. An order for an item you cannot make right now is still an order: it goes to the one
// queue, whoever can make it bids for it (the arm, the wreck's fabricator, a machine), what it needs becomes demand
// down to raw rock, and when it exists a robot brings it to you. to: 'player' | 'stock'.
export function orderItem(item, n = 1, to = 'player') { if (!ITEMS[item]) return null; const e = SUP.wanted.find(q => q.item === item && q.to === to); if (e) { e.n += n; SUP.tick = 0; return e; } const w = { id: SUP.nextWant++, item, n, to, have0: to === 'player' ? S.count(item) : 0 }; SUP.wanted.push(w); SUP.tick = 0; events.emit('ordered', item); return w; }
export function cancelWant(id) { const i = SUP.wanted.findIndex(q => q.id === id); if (i >= 0) SUP.wanted.splice(i, 1); SUP.tick = 0; }
// who makes a batch: every conventional producer that can make it bids its time, and the soonest wins. The arm does
// not bid against them: it is given only what nothing else can make (and says how long it would have taken, so the
// window can show what was kept off it). Returns { who, s, bids: [[who, s]], arm: s the arm would take }
export function bidProducers(r, kinds) {
  const bids = [], P = S.P, cell = r.by === 'furnace' && r.e, armOk = EXO.on && !P.dead && (EXO.arm === undefined || EXO.arm > 0.15);
  for (const who of producersOf(r, kinds)) {
    const er = effRecipe(who, r), tool = toolOf(who);
    if (who.startsWith('shop:')) { const j = SUP.shop[tool], v = shopSpeed(tool); bids.push([who, er.t / Math.max(0.05, v) + (j ? j.left / Math.max(0.05, v) : 0)]); continue; }
    // a machine of the kind: its batch time, longer while it is busy and while the grid starves it
    let n = 0, q = 0, pw = 1; for (const m of F.machines) if (m.kind === who) { n++; q += m.busy ? 1 : 0; pw = Math.min(pw, m.pw === undefined ? 1 : Math.max(0.03, m.pw)); } if (n) bids.push([who, er.t * (1 + q / n) / pw]);
  }
  const arm = armOk && !cell ? armTime(r) + armEta() + (S.has(r.in) ? 0 : 25) : 1e6;       // what the arm does not hold has to be flown to it first
  if (!bids.length) bids.push([cell ? r.by : 'suit', cell ? 1e6 : arm]);
  bids.sort((a, b) => a[1] - b[1]); return { who: bids[0][0], s: bids[0][1], bids, arm };
}
export const whoName = w => w === 'suit' ? 'arm' : w && w.startsWith('shop:') ? w.slice(5) : w;
// the editor: set a stock target (0 or less removes it). Steps are 1 for things, 5 kg for bulk.
export const targetStep = id => ITEMS[id].u === 'ea' ? 1 : ITEMS[id].u === 'rd' ? 30 : 5;
export function setTarget(id, n) { if (!ITEMS[id]) return; if (n > 1e-9) SUP.targets[id] = +Math.min(n, 9999).toFixed(3); else delete SUP.targets[id]; SUP.tick = 0; }
// the producer for a recipe: its own machine if one stands, else a shop tool that can make it, else the arm
export function bestProducer(recipe, kinds) { return producersOf(recipe, kinds)[0] || 'suit'; }
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
  for (const t in SUP.shop) { const j = SUP.shop[t]; if (j) for (const k in j.out) add(k, j.out[k]); }
  for (const m of F.machines) {
    if (m.kind === 'furnace') { for (const r of RECIPES) if (r.by === 'furnace') { const k = Object.keys(r.in)[0]; if (m.inp[k] > 0) add(Object.keys(r.out)[0], m.inp[k] / r.in[k]); } }
    else if (m.kind === 'assay station') { if (m.inp.rubble > 0) add('basalt', m.inp.rubble * 0.5); }
    else if (isBatch(m.kind) && recipeOf(m)) { const r = recipeOf(m); let n = m.busy ? 1 : 0, b = 1e9; for (const k in r.in) b = Math.min(b, Math.floor((m.inp[k] || 0) / r.in[k] + 1e-9)); n += b === 1e9 ? 0 : b; for (const k in r.out) add(k, r.out[k] * n); }
  }
  return p;
}
const mpos = m => [(m.x + m.w / 2) * TS, (m.y + m.h) * TS + 0.5];
// where an amount of an item can be fetched from, nearest to (x, y): a loose body first, then the hold, then a chest
function sourceOf(item, x, y, taken, looseOnly) {
  let best = null, bd = 1e9;
  for (const c of matter.list) if (c.id === item && !c.claim && !c.dumped && c.temp < 0.7 && !(c.skip > G.time && !c.zone) && !taken.has(c) && isLinked(c.x, c.y)) { const op = open(c), nd = c.noDrone > G.time; if (nd && !SUP.crawlers) continue; const d = Math.hypot(c.x - x, c.y - y) + (op ? 0 : 6); if (d < bd) { bd = d; best = { t: 'chunk', c, x: c.x, y: c.y + 0.5, n: c.n, ground: !op, noDrone: nd }; } }
  if (best || looseOnly) return best;
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
  // what the arm printed on the network's order is fetched from you and put in the hold, where the shop tools work from
  if (S.armOut && !P.dead && isLinked(P.x, P.y + 1)) for (const k in S.armOut) { const n = Math.min(S.armOut[k], S.count(k)); if (n < 1e-6) { delete S.armOut[k]; continue; } if (S.crash && holdRoom(k) >= Math.min(n, 1)) push({ t: 'inv', inv: S.inv, player: true, x: P.x, y: P.y + 1, n }, { t: 'inv', inv: K.hold, x: SHIP.hatch[0], y: SHIP.hatch[1] + 0.8 }, k, n, 'armout:' + k, 1); }
  // the suit's cooling water, kept filled
  if (EXO.on && !P.dead && isLinked(P.x, P.y + 1) && P.st && P.st.packL > 0 && EXO.water + S.count('water') < P.st.packL * 0.4) push(sourceOf('water', P.x, P.y, taken), { t: 'player' }, 'water', P.st.packL, 'player:water', 0);
  for (const o of SUP.orders) {
    // what the arm waits for is brought to you: by as many robots as the amount is loads (one job an item kept two of three robots idle beside it)
    if (o.producer === 'suit') { if (!o.missing || P.dead || !isLinked(P.x, P.y + 1)) continue; for (const k in o.missing) { const m = ITEMS[k].m, load = ITEMS[k].u === 'ea' ? 1 : 15 / m; let left = o.missing[k]; const keyOf = slot => 'player:' + k + (slot ? ':' + slot : ''); for (let slot = 0; slot < 3; slot++) if (has(keyOf(slot))) left -= load;       /* what is already on its way */ for (let slot = 0; slot < 3 && left > 1e-6; slot++) { if (has(keyOf(slot))) continue; const src = sourceOf(k, P.x, P.y, taken); if (!src) break; const n = Math.min(left, load, src.n); push(src, { t: 'player' }, k, n, keyOf(slot), 0); left -= n; } } continue; }
    // the fabricator works from the hold: what an order of its needs and the hold lacks is brought to the hold from wherever it lies
    if (o.producer.startsWith('shop:')) { if (!S.crash) continue; const r = { in: o.rin }; for (const k in r.in) { const lack = Math.min(o.inputs[k], r.in[k] * 2) - inv.count(K.hold, k); if (lack > 1e-6 && holdRoom(k) >= lack) { const src = sourceOf(k, SHIP.hatch[0], SHIP.hatch[1], taken); if (src && src.inv !== K.hold) push(src, { t: 'inv', inv: K.hold, x: SHIP.hatch[0], y: SHIP.hatch[1] + 0.8 }, k, lack, 'fab:' + k, 1); } } continue; }
    const m = o.machine; if (!m) continue; const [mx, my] = mpos(m), r = { in: o.rin || RECIPE[o.recipe].in };
    for (const k in r.in) { const want = Math.min(o.inputs[k], r.in[k] * (m.kind === 'furnace' ? 6 : 3)) - (m.inp[k] || 0); if (want > r.in[k] * 0.5 || (want > 1e-6 && (m.inp[k] || 0) < r.in[k] - 1e-9)) push(sourceOf(k, mx, my, taken), { t: 'mach', m, x: mx, y: my }, k, want, 'in:' + F.machines.indexOf(m) + ':' + k, 1); }       // topped up in half batches, but a batch that is short is always made whole
  }
  // what a machine asks for by itself (the shaft rig's rods and casing, the assay station's rubble)
  for (const m of F.machines) if (m.wants) { const [mx, my] = mpos(m); if (!isLinked(mx, my)) continue; for (const k in m.wants) if (m.wants[k] > 1e-6) push(sourceOf(k, mx, my, taken), { t: 'mach', m, x: mx, y: my }, k, m.wants[k], 'in:' + F.machines.indexOf(m) + ':' + k, 1); }
  // spoil is used before it is heaped: ground pads, the berm, backfill (spoil.js)
  for (const [f, k, n, pri, slot] of fillJobs()) { const src = sourceOf(k, f.x, f.y0, taken, true); if (src) push(src, { t: 'fill', f, x: f.sx, y: f.sy }, k, n, 'fill:' + f.id + ':' + slot, pri); }
  if (S.crash || F.machines.some(m => m.kind === 'chest')) {
    // the hold is finite: nothing is carried to it that it has no room for. Bulk goes to its stockpile zone instead.
    const room = {}, fits = (id, n) => { if (!S.crash) return false; if (room[id] === undefined) room[id] = holdRoom(id); if (room[id] < Math.min(n, ITEMS[id].u === 'ea' ? 1 : 2)) return false; room[id] -= n; return true; }; SUP.full = false;
    const bulk = id => ITEMS[id].cat === 'raw', holdDst = () => ({ t: 'inv', inv: K.hold, x: SHIP.hatch[0], y: SHIP.hatch[1] + 0.8 }), zoneDst = id => { const z = zoneFor(id); if (!z) return null; const [x, y] = zoneSpot(z); return { t: 'zone', z, x, y }; };
    for (const m of F.machines) if (m.kind === 'furnace' || isBatch(m.kind) || m.kind === 'miner' || m.kind === 'assay station' || m.kind === 'shaft rig' || m.kind === 'pump') for (const k in m.out) if (m.out[k] >= (ITEMS[k].u === 'ea' ? 1 : m.on ? 6 : 0.5)) { if (onBelt(m)) continue; const [mx, my] = mpos(m), sk = sinkFor(m, k), direct = sk && accepts(sk, k);      // straight to whoever consumes it, else to stock; a finished belt needs no robot
      if (!isLinked(mx, my)) continue; const dst = direct ? { t: 'mach', m: sk, x: mpos(sk)[0], y: mpos(sk)[1] } : bulk(k) ? zoneDst(k) || (fits(k, m.out[k]) ? holdDst() : null) : fits(k, m.out[k]) ? holdDst() : null; if (!dst) { SUP.full = true; continue; }
      push({ t: 'out', m, x: mx, y: my, n: m.out[k] }, dst, k, m.out[k], 'out:' + F.machines.indexOf(m) + ':' + k, 2); }
    // loose matter is tidied: rubble to the assay station when one stands, everything raw into its zone, things into the hold
    const assay = F.machines.filter(m => m.kind === 'assay station');
    let keepSpoil = fillWant() * 1.15; const lat = {}, late = (w, c) => { const e = lat[w] || (lat[w] = { why: w, n: 0, kg: 0, timer: /set aside/.test(w) }); e.n++; e.kg += c.kg; };
    for (const c of matter.list) {
      if (c.claim || c.dumped || taken.has(c)) continue; const inz = inZone(c); if (inz && !(c.id === 'rubble' && assay.length)) continue;
      if (c.temp > 0.7) { late('too hot to lift yet', c); continue; } if (c.skip > G.time) { late('set aside after a trip that failed', c); continue; } if (!isLinked(c.x, c.y)) { late('outside the network', c); continue; } if (jobs.length > 40) { late('behind 40 jobs that are open already', c); continue; }
      const ground = !open(c), noDrone = c.noDrone > G.time; if (noDrone && !SUP.crawlers) { late('no way through the air, and no hauler', c); continue; } const key = 'loose:' + c.uid; if (has(key)) continue;
      let dst = null, pri = 3;
      if (c.id === 'rubble' && assay.length) { const m = assay.find(q => (q.inp.rubble || 0) < 60); if (m) { dst = { t: 'mach', m, x: mpos(m)[0], y: mpos(m)[1] }; pri = 1; } }
      if (!dst && !inz && keepSpoil > 0 && SPOILK.includes(c.id)) { keepSpoil -= c.kg; late('kept for the berm, the pad or the backfill that is being laid', c); continue; }
      if (!dst) { if (inz) continue; if (bulk(c.id)) { dst = zoneDst(c.id); pri = c.id === 'basalt' || c.id === 'soil' || c.id === 'slag' ? 4 : 3; } if (!dst) { if (!fits(c.id, c.n)) { SUP.full = true; late('no room: the hold is full and no stockpile takes it', c); continue; } dst = holdDst(); } }
      jobs.push({ kind: 'carry', src: { t: 'chunk', c, x: c.x, y: c.y + 0.5, n: c.n }, dst, item: c.id, n: c.n, key, pri, x: c.x, y: c.y + 0.5, ground, noDrone });
    }
    SUP.latent = Object.values(lat);
  } else SUP.latent = [];
  return jobs.sort((a, b) => a.pri - b.pri);
}
// a machine's finished output of an item, as a source
function outOf(item) { for (const m of F.machines) if ((m.out[item] || 0) > 1e-6) return { t: 'out', m, x: mpos(m)[0], y: mpos(m)[1], n: m.out[item] }; return null; }
export function stepSupply(dt) {
  SUP.tick -= dt; if (SUP.tick > 0) return; SUP.tick = 1;
  // the shop tools in the wreck work: a second of each job, at the speed its condition and the bus allow
  for (const tool in SUP.shop) { const j = SUP.shop[tool]; if (!j) continue; if (!shopOk(tool)) { j.stall = 'the tool is gone or broken'; continue; } j.left -= shopSpeed(tool);
    if (j.left <= 0) { for (const k in j.out) { const left = inv.add(K.hold, k, j.out[k]); if (left > 1e-9) matter.spawn(k, left, SHIP.hatch[0], SHIP.hatch[1] + 0.6); } events.emit('shopDone', { tool, r: j.r }); SUP.shop[tool] = null; } }
  S.shopOn = {}; for (const t in SUP.shop) if (SUP.shop[t] && shopOk(t)) S.shopOn[t] = 1;
  if (!SUP.on) { SUP.orders = []; return; }
  // the queue's kits first, then the stock targets; inputs of every order become demand in turn (auto.js planAll)
  const kinds = new Set(F.machines.map(m => m.kind)); for (const tool in SHOP) if (shopOk(tool)) kinds.add('shop:' + tool); kinds.pick = r => bidProducers(r, kinds); const stock = SUP.stock = countStock();
  // an order is done when you hold what you asked for (or stock has it, for a stock order)
  for (let i = SUP.wanted.length - 1; i >= 0; i--) { const w = SUP.wanted[i]; if ((w.to === 'player' ? S.count(w.item) - w.have0 : stock[w.item] || 0) >= w.n - 1e-6) { SUP.wanted.splice(i, 1); events.emit('orderDone', w.item); } }
  // the live cut-off grade: how poor a rock is still worth moving, from how far it is hauled and how short the iron is
  SUP.cut = cutoff(30, SUP.targets.iron ? 1 - Math.min(1, (stock.iron || 0) / SUP.targets.iron) : 0.2);
  const wants = SUP.wanted.map(w => ({ id: 'w' + w.id, item: w.item, n: w.n + (w.to === 'player' ? w.have0 : 0) })), plan = planAll(stock, SUP.targets, buildNeeds().concat(wants), SUP.pending = countPending(), kinds), orders = SUP.orders = plan.orders, P = S.P, used = new Set(), held = {};
  AUTO.status = plan.status; AUTO.short = SUP.short = plan.short; AUTO.orderOf = item => orders.find(o => o.item === item);
  // what is on its way counts when an order is asked whether it can go on: in a robot's net, in a kit it carries, already in
  // a machine's input. (Without it an order whose rock was in the air looked starved, lost its machine to the next order,
  // and the machine threw its inputs out: the same 15 kg went round for minutes.)
  const transit = {}; for (const r of SUP.carriers || []) { for (const q of r.cargo.slots) if (q) transit[q.id] = (transit[q.id] || 0) + q.n; for (const k in r.carry || {}) transit[k] = (transit[k] || 0) + r.carry[k]; } for (const m of F.machines) for (const k in m.inp) if (m.inp[k] > 1e-9) transit[k] = (transit[k] || 0) + m.inp[k];
  const keeps = m => isBatch(m.kind) && Object.values(m.inp).some(v => v > 1e-6) && orders.some(q => q.recipe === m.recipe);       // a machine that holds inputs for an order that still stands is not handed to another
  let kept = 0; const armNeed = [], feeds = new Set(); for (const o of orders) if (o.producer !== 'suit') for (const k in o.inputs) feeds.add(k);
  const armQ = o => { if (!printerQueue(S.printer, S.inv, o.recipe, 1)) return false; S.printer.q[S.printer.q.length - 1].ai = o.why === 'stock' || feeds.has(o.item) ? 'stock' : o.why; return true; };
  for (const o of orders) {
    const r = RECIPE[o.recipe], rin = o.rin || r.in; o.missing = null; o.machine = null;
    // an order that waits for something nobody has takes no producer and keeps nothing back: the ones behind it go on
    const dead = Object.keys(rin).filter(k => plan.short[k] > 1e-9 && (stock[k] || 0) + (transit[k] || 0) < rin[k] - 1e-9 && !RECIPE[k]);
    if (o.bids) o.bidNote = o.bids.slice(0, 3).map(([w, t]) => `${whoName(w)} ${t > 9e5 ? 'cannot' : t.toFixed(0) + ' s'}`).join(', ') + (o.producer !== 'suit' && o.arm < 9e5 ? `; the arm is kept off it (${o.arm.toFixed(0)} s)` : '');
    if (o.producer !== 'suit') kept++;
    if (dead.length && (o.producer !== 'suit' || !S.has(rin))) { o.note = `waits for ${dead.join(', ')}: none loose or stored`; if (o.producer === 'suit') armNeed.push({ item: o.item, recipe: o.recipe, n: o.batches, why: o.why, by: r.by }); continue; }       // nothing is carried to a job that cannot start
    if (o.producer.startsWith('shop:')) {       // a tool in the wreck: one job at a time, in the order of the plan, from what the hold has
      const tool = toolOf(o.producer), er = effRecipe(o.producer, r), job = SUP.shop[tool];
      if (job) { o.note = job.r === o.recipe ? `${tool}: ${Math.ceil(job.left / Math.max(0.05, shopSpeed(tool)))} s` : `the ${tool} is on an earlier order`; if (job.r !== o.recipe) for (const k in er.in) held[k] = (held[k] || 0) + er.in[k]; continue; }
      // what an earlier order still waits for is kept for it: a later, cheaper order does not eat the iron first
      const lack = Object.keys(er.in).filter(k => inv.count(K.hold, k) < er.in[k] - 1e-9), keptBack = Object.keys(er.in).filter(k => held[k] && inv.count(K.hold, k) - held[k] < er.in[k] - 1e-9);
      if (!lack.length && !keptBack.length && inv.pay(K.hold, er.in)) { SUP.shop[tool] = { r: r.id, left: er.t, total: er.t, out: { ...er.out } }; S.shopOn[tool] = 1; o.note = `${tool}: ${Math.ceil(er.t / Math.max(0.05, shopSpeed(tool)))} s`; events.emit('aiQueued', o.item); }
      // the one exception to keeping the arm free: something you planned, the stock the tool needs is nowhere but in your own hands, and the arm can make it from there
      else if (o.why === 'build' && lack.length && lack.every(k => (stock[k] || 0) - S.count(k) < er.in[k] - 1e-9) && !P.dead && isLinked(P.x, P.y + 1) && S.has(r.in) && S.printer.q.filter(j => j.r === o.recipe).length < Math.min(o.batches, 2) && S.printer.q.length < 6 && printerQueue(S.printer, S.inv, o.recipe, 1)) { o.note = 'queued on the arm: only the suit holds the ' + Object.keys(r.in).join(', '); events.emit('aiQueued', o.item); }
      else { for (const k in er.in) held[k] = (held[k] || 0) + er.in[k]; o.note = lack.length ? `${tool} waits for ${lack.join(', ')} in the hold` : 'waits: the ' + keptBack.join(', ') + ' in the hold is kept for an earlier order'; }
      continue;
    }
    if (o.producer === 'suit') {       // the arm: only what nothing else can make. Queue it when the suit holds the inputs, else say what is missing so a robot brings it
      armNeed.push({ item: o.item, recipe: o.recipe, n: o.batches, why: o.why, by: r.by });
      if (P.dead || !isLinked(P.x, P.y + 1)) { o.note = 'no link to the suit'; continue; }
      if (EXO.arm !== undefined && EXO.arm <= 0.15) { o.note = 'the arm\'s matter compiler is down: nothing else here can make this'; continue; }
      // the arm is not a smelter: 77 s of the only compiler for a kilogram of iron is the worst use of it. Metal waits for a
      // furnace, and a furnace is the first thing the arm prints (40 kg of basalt)
      if (r.by === 'furnace') { o.note = 'waits for a furnace: the arm is not a smelter (a furnace is 40 kg of basalt: plan one)'; armNeed.pop(); continue; }
      const queued = S.printer.q.filter(j => j.r === o.recipe).length;
      if (queued < Math.min(o.batches, 2) && S.printer.q.length < 6) { if (armQ(o)) { o.note = 'queued on the arm: nothing else here can make it'; events.emit('aiQueued', o.item); } else { o.missing = {}; for (const k in r.in) { const lack = r.in[k] * Math.min(o.batches, 2) - S.count(k); if (lack > 1e-6) o.missing[k] = lack; } o.note = 'the arm waits for ' + Object.keys(o.missing).join(', ') + ': nothing else here can make it'; } }
      else o.note = 'printing on the arm';
    } else {
      let best = null, bd = 1e9; for (const m of F.machines) if (m.kind === o.producer && !used.has(m) && (!isBatch(m.kind) || m.recipe === o.recipe || (!m.busy && !keeps(m)))) { const d = Math.abs((m.x + m.w / 2) * TS - SHIP.x) + (m.recipe === o.recipe ? 0 : 50); if (d < bd) { bd = d; best = m; } }
      if (!best) { o.note = 'every ' + o.producer + ' is on an earlier order'; continue; } if (isBatch(best.kind)) used.add(best);
      if (isBatch(best.kind) && best.recipe !== o.recipe && !best.busy) { for (const k in best.inp) if (best.inp[k] > 1e-6) matter.spawn(k, best.inp[k], (best.x + 1) * TS, (best.y + 2.5) * TS); best.inp = {}; best.recipe = o.recipe; }
      if (best.kind === 'furnace' && o.recipe === 'metal powder') best.powderT = G.time + 4;       // bar goes into a furnace only while powder is asked of it
      o.machine = best; o.note = best.pw !== undefined && best.pw < 0.05 ? o.producer + ' has no power' : best.on ? o.producer + ' running' + (best.pw < 0.999 ? ' at ' + (best.pw * 100).toFixed(0) + '% power' : '') : o.producer + ' waits for ' + Object.keys(rin).filter(k => (best.inp[k] || 0) < rin[k]).join(', ');
    }
  }
  SUP.armHeld = kept; SUP.armNeed = armNeed;
  // spoil: what lies loose or heaped and is not spoken for by an order is the AI's to build with (spoil.js)
  const sp = {}; for (const c of matter.list) if (SPOILK.includes(c.id) && !c.dumped && !c.claim && c.temp < 0.7) sp[c.id] = (sp[c.id] || 0) + c.n; for (const o of orders) for (const k in o.inputs) if (sp[k]) sp[k] = Math.max(0, sp[k] - o.inputs[k]);
  stepSpoil(1, { stock: sp, ghosts: BP.ghosts, log: t => LOG.say(t, G.time) });
}
export function dumpSupply() { const shop = {}; for (const t in SUP.shop) if (SUP.shop[t]) { const j = SUP.shop[t]; shop[t] = [j.r, +j.left.toFixed(2), j.total, j.out]; } return { t: { ...SUP.targets }, on: SUP.on ? 1 : 0, shop, w: SUP.wanted.map(w => [w.id, w.item, w.n, w.to, w.have0]), nw: SUP.nextWant }; }
export { planAll };
export function loadSupply(o) {
  SUP.targets = { ...(o ? o.t : TARGETS0) }; SUP.on = o ? !!o.on : true; SUP.orders = []; SUP.tick = 0; SUP.wanted = ((o && o.w) || []).filter(q => ITEMS[q[1]]).map(q => ({ id: q[0], item: q[1], n: q[2], to: q[3], have0: q[4] })); SUP.nextWant = (o && o.nw) || 1; for (const k in SUP.targets) if (!ITEMS[k]) delete SUP.targets[k];
  SUP.shop = {}; SUP.armHeld = 0; SUP.armNeed = []; for (const t in (o && o.shop) || {}) { const q = o.shop[t]; if (SHOP[t] && RECIPE[q[0]]) SUP.shop[t] = { r: q[0], left: q[1], total: q[2], out: q[3] }; }
  // a version 6 game had a "fabricator" (a matter compiler the ship never had): the job it was on is undone, and what
  // it had taken goes back into the hold
  if (o && o.refund && RECIPE[o.refund]) { const r = RECIPE[o.refund]; for (const k in r.in) { const left = inv.add(K.hold, k, r.in[k]); if (left > 1e-9) matter.spawn(k, left, SHIP.hatch[0], SHIP.hatch[1] + 0.6); } }
  K.fab = null;
}
export { give };

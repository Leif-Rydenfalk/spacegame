// the ship AI as a planner. The player places things; this decides how they get built and how everything moves.
//   queue    every ghost is an order. Priority is what helps the base expand first (network and robots, then mining,
//            smelting, assembly, storage, belts, the rest), then the order the player placed them; the player can move
//            any order up or down by hand (the AI window, J).
//   demand   planAll: orders in priority, then the stock targets, are met from stock; what is missing is ordered from
//            the best producer that stands, and that producer's inputs become demand in turn, down to raw matter. What
//            no recipe makes and nobody holds is the bottleneck, and it is named.
//   routes   every steady flow between two fixed points (a machine's output to whoever consumes it, or to the hold) is
//            weighed: robots (travel time there and back at loaded speed, 60 kg a trip, watt-hours per kilogram) against
//            a belt the AI lays itself (cells to build, iron, watts per cell, whether the ground between is level and
//            free, whether a hive is awake beside it). chooseRoute is pure and tested; the reason is kept and shown.
//   power    machines draw from the base grid: the wreck's auxiliary bus, and the reactor when it is in its bay or set
//            down (or carried) within reach of the grid. Loads are served in the same priority; a starved machine slows.
import { events } from '../core.js';
import { RECIPES, RECIPE, ITEMS, massOf } from '../items.js';
import { TS } from './world.js';
import { S, C, mul } from './state.js';
import { F, DEFS, canPlace, machineAt, LUMP } from './factory.js';
import { BP, addGhost, costOf } from './blueprint.js';
import { K, SHIP, reactorPos, isLinked } from './kit.js';
import { powerBudget, REACTOR_W } from './power.js';
import { hive } from './hive.js';
import { creatures } from './creatures.js';

export const RANK = { antenna: 0, hub: 0, miner: 1, furnace: 2, assembler: 3, chest: 4, belt: 5, platform: 5, 'bio-printer': 6, pad: 7, wall: 8 };
export const WATT = { belt: 40, miner: 3000, furnace: 1500, assembler: 2000, hub: 300, antenna: 60, 'bio-printer': 500, pad: 200, chest: 0 };
export const AUX_W = 4000, GRID_R = 26, BELT_MAX = 44;      // the wreck's own bus; how far a grid node reaches; the longest belt the AI will lay
export const BOT = { cargo: 60, vEmpty: 8, vFull: 4.4, handle: 4, flyW: 70 };   // the numbers the route model uses for a drone
export const PORT = { x: Math.floor((SHIP.x + 3.5) / TS), y: 0 };                 // the hold's intake: a belt that ends here feeds the ship hold
export const AUTO = { routes: [], power: { supply: 0, demand: 0, used: 0, note: '' }, status: {}, short: {}, tick: 0, on: true, laid: 0 };

// ---- the queue -----------------------------------------------------------------------------------------------------
export const queueKey = g => g.key !== undefined && g.key !== null ? g.key : (RANK[g.kind] ?? 9) * 100000 + g.id;
// pure: the ghosts in the order they will be served
export function queueOrder(ghosts) { return ghosts.slice().sort((a, b) => queueKey(a) - queueKey(b)); }
// the player's override: move an order one place up (-1) or down (+1), or to the front (-2)
export function bump(g, dir) {
  const q = queueOrder(BP.ghosts), i = q.indexOf(g); if (i < 0) return;
  if (dir === -2) { if (i > 0) g.key = queueKey(q[0]) - 1; return; }
  const j = i + dir; if (j < 0 || j >= q.length) return;
  const far = q[j + dir], a = queueKey(q[j]), b = far ? queueKey(far) : a + dir * 2; g.key = (a + b) / 2;
}

// ---- demand --------------------------------------------------------------------------------------------------------
// the producer for a recipe: its own machine if one stands; else the wreck's fabricator, which works straight from the
// hold ('ship' is in kinds while the wreck is there); else the arm on the suit
const producerOf = (r, kinds) => kinds.has(r.by) ? r.by : kinds.has('ship') ? 'ship' : 'suit';
// pure. stock, targets, pending = { item: amount }; builds = [{ id, item, n }] in queue order; kinds = Set of machine
// kinds that stand. Returns { orders: [{ item, need, recipe, producer, batches, inputs, pri, why }] in priority order,
// short: { raw item: amount nobody has }, status: { build id: 'stock' | 'make' | 'short:<item>' } }
export function planAll(stock, targets, builds, pending, kinds) {
  const avail = { ...stock }, real = { ...stock }, orders = new Map(), short = {}, status = {}; for (const k in pending) avail[k] = (avail[k] || 0) + pending[k];
  const want = (item, n, pri, why, depth) => {
    const have = Math.min(Math.max(avail[item] || 0, 0), n); avail[item] = (avail[item] || 0) - have; const need = n - have; if (need <= 1e-9) return null;
    const r = RECIPES.find(q => item in q.out);
    if (!r || depth > 4) { short[item] = (short[item] || 0) + need; return item; }
    const batches = Math.ceil(need / r.out[item] - 1e-9); avail[item] += batches * r.out[item] - need;
    let o = orders.get(item); if (!o) orders.set(item, o = { item, need: 0, recipe: r.id, producer: producerOf(r, kinds), batches: 0, inputs: {}, pri, why });
    o.need += need; o.batches += batches; let block = null;
    for (const k in r.in) { const q = r.in[k] * batches; o.inputs[k] = (o.inputs[k] || 0) + q; const b = want(k, q, pri, why, depth + 1); if (b && !block) block = b; }
    return block;
  };
  builds.forEach((b, i) => { const inStock = (real[b.item] || 0) >= b.n - 1e-9, blk = want(b.item, b.n, i, 'build', 0); if (inStock) real[b.item] -= b.n; status[b.id] = inStock ? 'stock' : blk ? 'short:' + blk : 'make'; });
  let i = builds.length; for (const item in targets) want(item, targets[item], i++, 'stock', 0);
  return { orders: [...orders.values()], short, status };
}
// what the queue asks for, in order: one kit per ghost that has none yet (a wall is plain iron)
export function buildNeeds() { return queueOrder(BP.ghosts).filter(g => !g.have && !(g.claim && g.claim.carry)).map(g => { const c = costOf(g.kind), item = Object.keys(c)[0]; return { id: g.id, item, n: c[item] }; }); }

// ---- routes --------------------------------------------------------------------------------------------------------
// pure: one flow, robots or a belt. q = { dist m, rise m, rate kg/s, robots n, blocked cells, danger 0..1, powerFree W }
// Returns { mode: 'belt' | 'robot' | 'none', why, cells, iron, trip s, robotRate kg/s, beltRate kg/s, whKg }
export function chooseRoute(q) {
  const dist = Math.max(0.5, q.dist), cells = Math.ceil(dist / TS), iron = +(cells * RECIPE.belt.in.iron / RECIPE.belt.out.belt).toFixed(2), trip = dist / BOT.vFull + dist / BOT.vEmpty + BOT.handle;
  const robotRate = (q.robots || 0) * BOT.cargo / trip, beltRate = 1.5 / (TS * 0.5) * LUMP, whKg = BOT.flyW * 1.6 * trip / 3600 / BOT.cargo, share = robotRate > 0 ? q.rate / robotRate : Infinity;
  const out = (mode, why) => ({ mode, why, cells, iron, trip, robotRate, beltRate, whKg });
  if (!(q.rate > 0.005)) return out('none', 'nothing flows yet');
  const say = `${q.rate.toFixed(2)} kg/s over ${dist.toFixed(0)} m`;
  if (q.rise > 0.3) return out('robot', `robots: the ends are ${q.rise.toFixed(1)} m apart in height, a belt runs level`);
  if (q.blocked > 0) return out('robot', `robots: ${q.blocked} of ${cells} cells on the line are rock or taken`);
  if (dist > BELT_MAX) return out('robot', `robots: ${dist.toFixed(0)} m is ${cells} belts and ${iron} kg of iron, too much line for ${q.rate.toFixed(2)} kg/s`);
  if (q.danger > 0.5) return out('robot', 'robots: a hive is awake beside the line and would tear a belt up');
  if (q.powerFree !== undefined && q.powerFree < cells * WATT.belt) return out('robot', `robots: the grid has no ${(cells * WATT.belt / 1000).toFixed(1)} kw to spare for a belt`);
  if (!(q.robots > 0)) return out('belt', `belt: no robot is free; ${say}`);
  if (share > 0.3) return out('belt', `belt: ${say} would take ${(Math.min(share, 9.99) * 100).toFixed(0)}% of the robots (${trip.toFixed(0)} s a trip)`);
  if (dist <= 10 && q.rate > 0.12) return out('belt', `belt: ${cells} cells is cheaper than flying ${say} for good`);
  return out('robot', `robots: ${say} is ${(share * 100).toFixed(0)}% of what they carry (${trip.toFixed(0)} s a trip); a belt of ${cells} cells is not worth it`);
}
const mid = m => [(m.x + m.w / 2) * TS, (m.y + m.h / 2) * TS];
// what a machine makes per second when it runs (kg/s)
export function rateOf(m) {
  const pw = m.pw === undefined ? 1 : m.pw;
  if (m.kind === 'miner') return (m.ore ? 0.55 : 0.05) * pw;
  if (m.kind === 'furnace') return (m.fuel ? 2.5 : 1) / RECIPE.iron.t * pw * (m.on || (m.inp['iron ore'] || 0) + (m.inp['copper ore'] || 0) > 0.5 ? 1 : 0.4);
  if (m.kind === 'assembler' && RECIPE[m.recipe]) return massOf(RECIPE[m.recipe].out) / RECIPE[m.recipe].t * pw * (m.on ? 1 : 0.3);
  return 0;
}
const makes = m => m.kind === 'miner' ? Object.keys(m.out).filter(k => m.out[k] > 0.01).concat(m.oreId ? [m.oreId] : []) : m.kind === 'furnace' ? ((m.inp['copper ore'] || 0) > (m.inp['iron ore'] || 0) ? ['copper'] : ['iron']) : m.kind === 'assembler' && RECIPE[m.recipe] ? Object.keys(RECIPE[m.recipe].out) : [];
const takes = (m, id) => m.kind === 'assembler' ? !!RECIPE[m.recipe] && id in RECIPE[m.recipe].in : m.kind === 'pad' ? id === 'part' : m.kind === 'furnace' ? id === 'iron ore' || id === 'copper ore' : false;
// who a machine's output should go to: the nearest machine that consumes it, else the ship hold
export function sinkFor(m, id) {
  let best = null, bd = 1e9; const [x, y] = mid(m);
  for (const q of F.machines) if (q !== m && takes(q, id)) { const [qx, qy] = mid(q), d = Math.hypot(qx - x, qy - y); if (d < bd) { bd = d; best = q; } }
  return best;
}
// the cells a belt from a to b would stand on: from a's edge to b's edge along a's row
function lineCells(a, bx0, bx1, by) {
  const dir = bx0 >= a.x + a.w ? 1 : bx1 <= a.x ? -1 : 0; if (!dir) return null; const cells = [];
  if (dir > 0) for (let x = a.x + a.w; x < bx0; x++) cells.push(x); else for (let x = a.x - 1; x >= bx1; x--) cells.push(x);
  return { dir, cells, y: a.y, rise: Math.abs(by - a.y) * TS };
}
const routeKey = (m, dst) => `${m.x},${m.y}>${dst ? dst.x + ',' + dst.y : 'hold'}`;
const sticky = new Map();        // a route that got its belt keeps it while both ends stand
function planRoutes(nBots, powerFree) {
  const out = [], hn = hive.near, hunted = creatures.some(c => c.agg);
  for (const m of F.machines) {
    if (m.kind !== 'miner' && m.kind !== 'furnace' && m.kind !== 'assembler') continue;
    const ids = makes(m); if (!ids.length) continue; const id = ids[0], dst = sinkFor(m, id); if (!dst && !S.crash) continue;
    const bx0 = dst ? dst.x : PORT.x, bx1 = dst ? dst.x + dst.w : PORT.x + 1, by = dst ? dst.y : PORT.y, L = lineCells(m, bx0, bx1, by), [mx, my] = mid(m), tx = dst ? mid(dst)[0] : SHIP.hatch[0], ty = dst ? mid(dst)[1] : SHIP.hatch[1], key = routeKey(m, dst);
    let blocked = 0, missing = 0; if (L) for (const cx of L.cells) { const at = machineAt(cx, L.y), gh = BP.ghosts.find(g => g.kind === 'belt' && g.x === cx && g.y === L.y); if (at && at.kind === 'belt' && at.dir === L.dir) continue; if (gh) { missing++; continue; } if (at || !canPlace('belt', cx, L.y)) blocked++; else missing++; }
    const dist = L ? Math.max(TS, L.cells.length * TS) : Math.hypot(tx - mx, ty - my), danger = hn && hn.a > 24 && Math.abs(hn.x - (mx + tx) / 2) < 70 ? 1 : hunted ? 0.3 : 0;
    const q = { dist, rise: L ? L.rise : 99, rate: rateOf(m), robots: nBots, blocked, danger, powerFree };
    let c = chooseRoute(q); if (!L && c.mode === 'belt') c = { ...c, mode: 'robot', why: 'robots: the two stand over each other, a belt needs a line between them' };
    if (sticky.has(key) && c.mode !== 'none' && L && !blocked) c = { ...c, mode: 'belt', why: sticky.get(key) };
    if (c.mode === 'belt') { sticky.set(key, c.why.startsWith('belt') ? c.why : sticky.get(key)); if (missing && AUTO.on) for (const cx of L.cells) if (!machineAt(cx, L.y) && !BP.ghosts.some(g => g.x === cx && g.y === L.y) && canPlace('belt', cx, L.y)) { const g = addGhost('belt', cx, L.y, L.dir); g.auto = true; AUTO.laid++; events.emit('aiBelt', key); } }
    out.push({ key, src: m, dst, item: id, x0: mx, y0: my, x1: tx, y1: ty, ...c, rate: q.rate, dist, done: c.mode === 'belt' && !missing, missing });
  }
  for (const k of [...sticky.keys()]) if (!out.some(r => r.key === k)) sticky.delete(k);
  return out;
}
// is this machine's output on a finished belt? Then robots leave it alone.
export const onBelt = m => AUTO.routes.some(r => r.src === m && r.done);

// ---- power ---------------------------------------------------------------------------------------------------------
function planPower() {
  const nodes = [], P = S.P, rs = K.reactor.state, [rx, ry] = reactorPos(); let supply = 0, note = '';
  if (S.crash) { nodes.push([SHIP.x, SHIP.y + 1]); supply += AUX_W; }
  // the grid grows from the wreck through every machine within reach of a node that is already on it
  const on = new Set(); let grew = true; const near = (x, y) => nodes.some(n => Math.hypot(n[0] - x, n[1] - y) < GRID_R);
  const grow = () => { grew = true; while (grew) { grew = false; for (const m of F.machines) if (!on.has(m)) { const [x, y] = mid(m); if (near(x, y)) { on.add(m); if (m.kind !== 'belt') nodes.push([x, y]); grew = true; } } } };
  grow();
  const rOn = rs === 'ship' ? S.crash : nodes.length ? near(rx, ry) : true;
  if (rOn) { if (!nodes.length || rs !== 'ship') { nodes.push([rx, ry]); grow(); } supply += Math.max(0, REACTOR_W - (K.pw.used || 0)); note = rs === 'ship' ? 'reactor in its bay' : rs === 'carried' ? 'reactor on your back, in reach' : 'reactor set down'; }
  else note = S.crash ? 'wreck auxiliary bus only: the reactor is out of reach' : 'no source';
  const loads = F.machines.filter(m => WATT[m.kind] > 0).sort((a, b) => (RANK[a.kind] ?? 9) - (RANK[b.kind] ?? 9)).map((m, i) => ({ id: i, m, w: WATT[m.kind] * (m.kind === 'belt' || m.kind === 'antenna' || m.kind === 'hub' || m.on || m.starved ? 1 : 0.05), from: on.has(m) ? ['grid'] : [] }));
  const b = powerBudget([{ id: 'grid', w: supply }], loads);
  for (const l of loads) { const f = b.served[l.id]; l.m.pw = f >= 0.999 ? 1 : f; l.m.starved = f < 0.999 && (l.m.on || l.m.starved) ? 1 : 0; l.m.grid = on.has(l.m); }
  AUTO.power = { supply, demand: b.demand, used: b.used, note, off: loads.filter(l => !on.has(l.m) && l.m.kind !== 'belt').length };
  return supply - b.used;
}

export function stepAuto(dt, nBots) {
  AUTO.tick -= dt; if (AUTO.tick > 0) return; AUTO.tick = 1;
  const free = planPower(); AUTO.routes = planRoutes(nBots, free);
}
// one line per queued order: where it stands and why
export function queueView(robots) {
  const q = queueOrder(BP.ghosts), out = []; let ahead = 0;
  for (const g of q) {
    const st = AUTO.status[g.id], r = g.claim, item = Object.keys(costOf(g.kind))[0]; let why;
    if (r && r.state === 'work') why = `robot ${r.id} is building it  ${(g.prog * 100).toFixed(0)}%`;
    else if (BP.hand === g) why = `the suit is building it  ${(g.prog * 100).toFixed(0)}%`;
    else if (r) why = `robot ${r.id} is bringing the ${g.kind === 'wall' ? 'iron' : 'kit'}`;
    else if (g.held) why = 'waits: the iron goes to the orders ahead of it first';
    else if (g.have) why = robots.length ? 'kit on site: waits for a free robot' : 'kit on site: stand by it and the suit builds';
    else if (st === 'stock') why = robots.length ? (isLinked((g.x + 0.5) * TS, (g.y + 1) * TS) ? `${item} in stock: waits for a free robot` : 'outside the network: no robot takes orders here') : `${item} in stock: stand by it and the suit builds`;
    else if (st && st.startsWith('short:')) { const k = st.slice(6); why = `waits for ${k}: ${(AUTO.short[k] || 0).toFixed(ITEMS[k] && ITEMS[k].u === 'ea' ? 0 : 1)} ${ITEMS[k] && ITEMS[k].u === 'ea' ? '' : 'kg '}short, none loose or stored${k.endsWith('ore') || k === 'basalt' || k === 'lumen' ? ' (cut some, or place a miner)' : ''}`; }
    else { const o = AUTO.orderOf && AUTO.orderOf(item), pj = S.printer.q.find(j => j.r === item); why = K.fab && K.fab.r === item ? `ship fabricator is making the kit: ${Math.ceil(K.fab.left)} s` : pj ? `the arm is printing the kit: ${Math.ceil(pj.left)} s` : o ? (g.kind === 'wall' ? 'iron: ' : '') + (o.note || 'ordered') : g.kind === 'wall' ? 'iron is on its way' : 'the kit is being made'; }
    out.push({ g, n: ++ahead, kind: g.kind, why, auto: !!g.auto, manual: g.key !== undefined && g.key !== null });
  }
  return out;
}
// flows drawn in the world: a robot route is a line of moving marks from source to sink; the hold's intake stands by the nose
export function drawAuto(b, time) {
  if (S.crash) { const x = (PORT.x + 0.5) * TS, y = PORT.y * TS; b.add(x, y + 0.2, 0.46, 0.4, 0, mul(C.steel, 0.5), 1, 0, 1, 3); b.add(x, y + 0.42, 0.56, 0.06, 0, C.dark, 1, 0, 1, 4); b.add(x, y + 0.3, 0.05, 0.05, 0, mul(C.amber, 2), 1, 1, 2); }
  for (const r of AUTO.routes) {
    if (r.mode !== 'robot' || r.rate < 0.01) continue; const dx = r.x1 - r.x0, dy = r.y1 - r.y0, d = Math.hypot(dx, dy), n = Math.max(2, Math.floor(d / 1.2)), lift = Math.min(3, 1 + d * 0.08);
    for (let i = 0; i < n; i++) { const t = ((i + time * 0.6) % n) / n, x = r.x0 + dx * t, y = r.y0 + dy * t + Math.sin(t * Math.PI) * lift + 1; b.add(x, y, 0.09, 0.09, 0, mul(C.amber, 1.4), 0.5 * Math.sin(t * Math.PI), 1, 2); }
  }
}
export function dumpAuto() { return { on: AUTO.on ? 1 : 0, st: [...sticky] }; }
export function loadAuto(o) { AUTO.on = o ? !!o.on : true; sticky.clear(); for (const [k, v] of (o && o.st) || []) sticky.set(k, v); AUTO.routes = []; AUTO.status = {}; AUTO.short = {}; AUTO.tick = 0; }

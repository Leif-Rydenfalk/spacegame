// robots: the ship's own and the ones a hub launches. Small drones with momentum, rotor glow and nav lights, and the
// six-legged ground hauler. They work only where the network reaches; they live at a hub (or the wreck), which is also
// their charger; charge is counted in Wh.
//
// One state machine, every state with one way on and one way out when it fails:
//   idle     hover at the dock, charge, wait for a job                         charge   below 12 %: home, charge to 95 %
//   build queue (blueprint.js ghosts, marked machines, marked ground), in queue order:
//     fetch  to the store that holds the item (reserved for this robot), take it      -> go    (the store is short: idle)
//     go     to the site                                                               -> work
//     work   weld the ghost up / take the machine apart / cut the ground              -> idle, or haul with what came out
//   carrying (supply.js gives the jobs: loose matter to the hold, inputs to machines, outputs back, spoil to the heap):
//     cfetch to the source; a loose piece is winched up on a line                     -> cgo   (cannot see it: skip it, idle)
//     cgo    to whoever asked for it, set it down there                               -> idle
//   haul     unload what is still on board into a store; what does not fit is set down beside it
// Round 5 made that reliable rather than new: a path through the air round rock (nav.js); a check every 1.5 s that
// the robot got nearer, a new plan when it did not, and after four of those, three searches with no way, or 75 s on one
// leg, the job is given up and its target left alone for a while; what a robot is going to fetch stays reserved for
// it; the hauler jets home when it has lost its footing; and intentOf(r) says in one line what each robot is doing.
import { G, events, rand, clamp, lerp } from '../core.js';
import { audio } from '../audio.js';
import { world, TS, M, MAT, GRAV, SLAB } from './world.js';
import { light } from './light.js';
import { heatAt } from './terrain.js';
import { S, C, mul } from './state.js';
import { env } from './env.js';
import { inv, makeInv, massOf } from '../items.js';
import { F, DEFS, give } from './factory.js';
import { matter } from './matter.js';
import { K, SHIP, isLinked } from './kit.js';
import { carryJobs, SUP } from './supply.js';
import { queueOrder, stepAuto, AUTO } from './auto.js';
import { ITEMS } from '../items.js';
import { BP, buildT, costOf, finishGhost, dismantle, liftDeck, weld, foot } from './blueprint.js';
import { fillPut } from './spoil.js';
import { flora, treeJobs, treeSaw } from './flora.js';
import { findPath, lineFree } from './nav.js';
import { groundPath } from './gnav.js';
import { auction, batch, whyNot, VALUE, LOG } from './market.js';
import { DRONE, HAULER, droneSpeed, haulerSpeed, dronesFor, kerfWoodJ } from './physics.js';
import { MINE, rockLumps } from './mine.js';
import { creatures } from './creatures.js';
import { WRECK, partPos, salvageTime, salvagePart } from './wreck.js';
import { zoneSpot, zoneFor } from './stock.js';

export const robots = []; SUP.carriers = robots;
// round 6: real numbers (physics.js). A drone is 8 kg and lifts 15; it flies at 9 m/s empty and about 3 m/s full, and
// hovering costs 110 W for every kilogram in the air. The hauler is 35 kg, carries 60 and walks at 1.6 m/s.
export const ROBOT = { wh: 250, workW: 2000, chargeW: 12000, acc: 16, vmax: DRONE.vmax, cargo: DRONE.lift };
export const CRAWLER = { wh: 400, moveW: 60, v: HAULER.v, cargo: HAULER.cargo };
const cap = r => r.kind === 'crawler' ? CRAWLER.cargo : ROBOT.cargo, whOf = r => r.kind === 'crawler' ? CRAWLER.wh : ROBOT.wh;
const name = r => (r.kind === 'crawler' ? 'hauler ' : 'drone ') + r.id;
const flyW = kg => 110 * (DRONE.kg + kg);
// the wreck is a dock and a charger for the ship's robots, like a hub
export const SHIPHUB = { ship: true, x: SHIP.dock[0] / TS - 1, y: SHIP.dock[1] / TS - 3.4, w: 2, h: 2 };
const center = j => j.kind === 'clear' ? [(j.ref.x0 + j.ref.x1) / 2, (j.ref.y0 + j.ref.y1) / 2] : j.kind === 'build' ? [(j.ref.x + j.w / 2) * TS, (j.ref.y + 0.5) * TS] : [(j.ref.x + j.ref.w / 2) * TS, (j.ref.y + j.ref.h / 2) * TS];
// open jobs from the queue, in queue order
export function listJobs() {
  const out = [];
  // a wall is plain iron: it waits while an order ahead of it still needs its kit made, so it does not eat the iron first
  const q = queueOrder(BP.ghosts), kitAhead = q.findIndex(g => !g.have && g.kind !== 'wall' && !(g.claim && g.claim.carry) && !(AUTO.status[g.id] || '').startsWith('short:'));
  q.forEach((g, i) => { if (g.kind === 'wall' && !g.have && kitAhead >= 0 && kitAhead < i) { g.held = true; return; } g.held = false; if (g.pad && !g.padOk) return;       /* its ground pad is not laid yet: spoil.js */ if (!g.claim && !(g.skipT > G.time)) out.push({ kind: 'build', ref: g, cost: g.have ? null : costOf(g.kind), w: foot(g.kind).w, pri: i }); });      // the queue's order is the order of service
  for (const m of F.machines) if (m.decon && !m.claim && !(m.skipT > G.time) && !(m.byHand > G.time)) out.push({ kind: 'decon', ref: m });
  for (const d of BP.dmarks) if (!d.claim) out.push({ kind: 'decon', ref: d });       // decks marked by the deconstruction planner
  for (const c of BP.clears) if (!c.claim && !(c.skipT > G.time)) out.push({ kind: 'clear', ref: c });
  for (const j of out) { const p = center(j); j.x = p[0]; j.y = p[1]; }
  return out;
}
// where material can come from: the player's suit and every chest
export function sources() { const P = S.P, out = P.dead ? [] : [{ inv: S.inv, x: P.x, y: P.y + 1, player: true }]; if (S.crash) out.push({ inv: K.hold, x: SHIP.hatch[0], y: SHIP.hatch[1] + 0.3 }); for (const m of F.machines) if (m.kind === 'chest') out.push({ inv: m.inv, x: (m.x + 1) * TS, y: (m.y + 1.4) * TS }); return out; }
// pure: give every idle robot the open job that is first in the queue (pri, when the jobs carry one) and, among
// equals, nearest, and whose material exists somewhere; a job goes to one robot only.
// Material promised to an earlier job is not promised twice. Returns [{ robot, job, src }].
// (round 5's rule, kept for the tests that pin it; the game itself assigns through the market below)
export function assignJobs(bots, jobs, srcs) {
  const out = [], taken = new Set(), promised = new Map(), avail = (s, k) => inv.count(s.inv, k) - (promised.get(s.inv) && promised.get(s.inv)[k] || 0);
  for (const r of bots) if (r.state === 'fetch' && r.src && r.job && r.job.cost) { const p = promised.get(r.src.inv) || {}; for (const k in r.job.cost) p[k] = (p[k] || 0) + r.job.cost[k]; promised.set(r.src.inv, p); }
  for (const r of bots) {
    if (r.job || r.state !== 'idle' || r.wh < whOf(r) * 0.2 || r.kind === 'crawler') continue;
    let best = null, bs = null, bd = 1e9;
    for (const j of jobs) {
      if (taken.has(j)) continue; let src = null;
      if (j.cost) { let sd = 1e9; for (const s of srcs) { let ok = true; for (const k in j.cost) if (avail(s, k) < j.cost[k] - 1e-9) ok = false; const d = Math.hypot(s.x - r.x, s.y - r.y) + Math.hypot(s.x - j.x, s.y - j.y); if (ok && d < sd) { sd = d; src = s; } } if (!src) continue; }
      const d = Math.hypot(j.x - r.x, j.y - r.y) + (j.pri || 0) * 1e4; if (d < bd) { bd = d; best = j; bs = src; }
    }
    if (best) { taken.add(best); if (bs) { const p = promised.get(bs.inv) || {}; for (const k in best.cost) p[k] = (p[k] || 0) + best.cost[k]; promised.set(bs.inv, p); } out.push({ robot: r, job: best, src: bs }); }
  }
  return out;
}
export function spawnRobot(hub, kind = 'drone') { const r = { kind, id: robots.length + 1, x: (hub.x + 1) * TS, y: (hub.y + 3) * TS, vx: rand(-1, 1), vy: 2, wh: kind === 'crawler' ? CRAWLER.wh : ROBOT.wh, state: 'idle', job: null, src: null, hub, cargo: makeInv(4), carry: null, t: 0, seed: Math.random() * 100, stuck: 0, tx: 0, ty: 0, sw: 0, sv: 0, na: 1.57, vy: 0 }; robots.push(r); events.emit('firstRobot'); return r; }
// the AI releases the wreck's robots when it comes up (the suit's interface boots it: index.js)
export function wakeShipRobots(n = 2) { if (K.awake) return; K.awake = true; for (let i = 0; i < n; i++) { const r = spawnRobot(SHIPHUB); r.x += i * 0.8 - 0.4; } { const r = spawnRobot(SHIPHUB, 'crawler'); r.x += 2.6; r.y -= 1.5; } events.emit('robotsAwake'); S.say('ai: network up. robots released', 4); LOG.say('network up: two drones and the hauler released', G.time); }
events.on('dronesDocked', hub => { while (hub.drones > 0) { hub.drones--; spawnRobot(hub); } audio.play('place'); });
const nv = [0, 0], kerfOf = kerfWoodJ;
// ---- the market: every job priced, every robot bidding (market.js) ---------------------------------------------------------
const FAILS = new Map(), FAILN = new Map(), REACH = new Map();
export const MARKET = { jobs: 0, blocked: [], last: 0, retries: 0, gaveUp: 0 };
const describe = j => j.kind === 'tree' ? (j.sub === 'fell' ? 'fell the marked tree' : 'cut the felled trunk into logs') + ' at ' + where(j.x) : j.kind === 'carry' ? `${j.item}${j.dst && j.dst.t === 'fill' ? ' for the ' + j.dst.f.kind : ''}${j.src && j.src.t === 'chunk' ? ' at ' + where(j.x) : ''}` : j.kind === 'build' ? `build ${j.ref.kind}` : j.kind === 'rescue' ? `lift ${name(j.ref)}` : j.kind === 'salvage' ? `salvage ${j.ref.name}` : j.kind === 'decon' ? `take the ${j.ref.kind} apart` : j.kind === 'repair' ? `repair the ${j.ref.kind}` : j.auto ? 'mine the scanned rock' : 'cut the marked ground';
const where = x => { const d = x - S.P.x; return `${Math.abs(d).toFixed(0)} m ${d < 0 ? 'w' : 'e'}`; };
// every open job with its key, its value and the mass it moves
export function openJobs() {
  const out = [], promised = new Map(), srcs = sources(), avail = (s, k) => inv.count(s.inv, k) - (promised.get(s.inv) && promised.get(s.inv)[k] || 0), busy = new Set();
  for (const r of robots) { if (r.job && r.job.kind === 'carry') busy.add(r.job.key); if (r.state === 'fetch' && r.src && r.job && r.job.cost) { const p = promised.get(r.src.inv) || {}; for (const k in r.job.cost) p[k] = (p[k] || 0) + r.job.cost[k]; promised.set(r.src.inv, p); } }
  for (const j of listJobs()) {
    if (j.kind === 'build') {
      j.key = 'b' + j.ref.id; j.value = (j.ref.support ? VALUE.support : VALUE.build) - (j.pri || 0) * 4; j.kg = j.cost ? massOf(j.cost) : 0; j.team = true;
      if (j.cost) {       // the kit must exist somewhere, and what is promised to an earlier job is not promised twice
        let src = null, sd = 1e9; for (const s of srcs) { let ok = true; for (const k in j.cost) if (avail(s, k) < j.cost[k] - 1e-9) ok = false; const d = Math.hypot(s.x - j.x, s.y - j.y); if (ok && d < sd) { sd = d; src = s; } }
        if (!src) continue; j.src = src; j.d2 = sd; const p = promised.get(src.inv) || {}; for (const k in j.cost) p[k] = (p[k] || 0) + j.cost[k]; promised.set(src.inv, p);
      }
    } else if (j.kind === 'decon') { j.key = 'd' + j.ref.x + ',' + j.ref.y; j.value = VALUE.build - 60; j.who = 'drone'; }
    else { j.key = 'c' + j.ref.id; j.auto = !!j.ref.auto; j.value = j.auto ? VALUE.mine : VALUE.clear; j.who = 'drone'; }
    out.push(j);
  }
  for (const j of carryJobs(busy)) { const m = ITEMS[j.item].m, whole = ITEMS[j.item].u === 'ea'; j.value = [VALUE.order, VALUE.feed, VALUE.output, VALUE.tidy, VALUE.spoil][j.pri] || VALUE.tidy; j.kg = whole ? m : Math.min(j.n * m, ROBOT.cargo); j.team = whole; out.push(j); }
  // a hauler that cannot move is everybody's job: drones lift it
  for (const r of robots) if (r.kind === 'crawler' && r.needRescue && !r.lifted && !robots.some(q => q.job && q.job.kind === 'rescue' && q.job.ref === r)) out.push({ kind: 'rescue', key: 'r' + r.id, ref: r, x: r.x, y: r.y, value: VALUE.rescue, kg: HAULER.kg + inv.mass(r.cargo), cap: DRONE.hover, team: true, who: 'drone' });
  // the parts of the wreck you marked
  if (S.crash) for (const id of WRECK.marked) { const p = WRECK.parts[id]; if (!p || p.gone || robots.some(q => q.job && q.job.kind === 'salvage' && q.job.ref === p)) continue; const [x, y] = partPos(p); out.push({ kind: 'salvage', key: 's' + id, ref: p, x, y, value: VALUE.salvage, kg: 0, who: 'drone' }); }
  // trees: a marked one is felled; one that lies is cut into logs (flora.js)
  for (const t of treeJobs()) if (!robots.some(q => q.job && q.job.kind === 'tree' && q.job.ref === t.rec)) out.push({ kind: 'tree', sub: t.kind, key: 't' + t.id + t.kind, ref: t.rec, x: t.x, y: t.y, value: VALUE.tree, kg: 0, who: 'drone' });
  // a machine the hive has bitten is mended
  for (const m of F.machines) if (m.hp < DEFS[m.kind].hp * 0.7 && !m.decon && !robots.some(q => q.job && q.job.kind === 'repair' && q.job.ref === m)) out.push({ kind: 'repair', key: 'm' + m.x + ',' + m.y, ref: m, x: (m.x + m.w / 2) * TS, y: (m.y + m.h / 2) * TS, value: VALUE.repair, kg: 0, who: 'drone' });
  return out;
}
const payload = r => inv.mass(r.cargo) + (r.carry ? massOf(r.carry) : 0) + (r.lifting ? HAULER.kg + inv.mass(r.lifting.cargo) : 0), teamN = r => 1 + (r.team ? r.team.length : 0);
const CTX = {
  cap, speed: (b, kg, n) => b.kind === 'crawler' ? haulerSpeed(kg) : droneSpeed(kg, n), power: (b, kg) => b.kind === 'crawler' ? CRAWLER.moveW + 3 * kg : flyW(kg),
  fit(b, j) {
    const f = FAILS.get(j.key + ':' + b.kind); if (f && f.until > G.time) return f.why; const r = b.r;
    if (!isLinked(j.x, j.y) && j.kind !== 'rescue') return 'no link: outside the network';
    if (b.kind === 'crawler') { if (j.kind === 'build' && (!j.cost || j.ref.support)) return 'needs a drone'; if (j.kind === 'carry' && j.dst.t === 'player' && Math.hypot(S.P.x - r.x, S.P.y - r.y) > 45) return 'too far for the hauler'; if (j.kind === 'carry' && j.src.t !== 'chunk' && j.src.t !== 'out' && Math.hypot(j.x - r.x, j.y - r.y) > 40) return 'too far for the hauler'; }
    else if (j.noDrone) return 'no way through the air';
    return null;
  },
  // can it get there? A drone needs a way through the air to a point over the thing; the hauler a way along the ground.
  reach(b, j) {
    const k = b.id + ':' + j.key, c = REACH.get(k); if (c && c.until > G.time) return c.why; const r = b.r; let why = null;
    if (b.kind === 'crawler') { if (!groundPath(r.x, r.y, j.x, j.y)) why = 'no way on the ground'; }
    else { const ty = j.y + (j.kind === 'carry' ? 0.8 : j.kind === 'clear' ? (j.ref.y1 - j.y) + 0.8 : 1.4); if (world.dens(j.x, ty) > 0.05 && world.dens(j.x, ty + 0.5) > 0.05) why = 'no way through the air'; else if (!lineFree(r.x, r.y, j.x, ty) && !findPath(r.x, r.y, j.x, ty)) why = 'no way through the air'; }
    REACH.set(k, { until: G.time + (why ? 12 : 4), why }); if (why) FAILS.set(j.key + ':' + b.kind, { until: G.time + 12, why }); if (REACH.size > 400) REACH.clear();
    return why;
  },
  // something hunting beside the site: the robots wait for cover; an opening about to come down: only the supports go in
  danger(j) { let d = 0; for (const c of creatures) if (c.agg && c.hp > 0 && Math.hypot(c.x - j.x, c.y - j.y) < 5) { d = K.laser.state === 'turret' && K.laser.link && Math.hypot(K.laser.x - j.x, K.laser.y - j.y) < 17 ? 0.3 : 1; break; } if (d < 1 && !(j.ref && j.ref.support)) for (const st of MINE.spans.values()) if (st.safe / st.span < 1 && j.x > st.xl && j.x < st.xr && Math.abs(j.y - st.yr) < 3) d = Math.max(d, 0.7); return d; },
};
function plan() {
  const bots = robots.map(r => ({ id: r.id, kind: r.kind, x: r.x, y: r.y, wh: r.wh, whMax: whOf(r), free: !r.job && r.state === 'idle' && !r.recall && !r.lifted && !r.needRescue && !r.lead && inv.mass(r.cargo) < 0.01 && r.wh > whOf(r) * 0.15, r }));
  for (const r of robots) if (!r.job && r.state === 'idle' && !r.recall && !r.needRescue && !r.lifted && r.wh < whOf(r) * 0.2 && inv.mass(r.cargo) < 0.01) r.state = 'charge';       // too low to be given anything: it charges instead of hanging about
  const jobs = openJobs(); MARKET.jobs = jobs.length; for (const r of robots) r.holdFor = null; if (!jobs.length) { MARKET.blocked = []; audit(bots, jobs, new Set()); return; }
  const { assign, fails, holds } = auction(bots, jobs, CTX);
  for (const h of holds) for (const b of [h.bot].concat(h.helpers)) b.r.holdFor = h.job;       // waiting for the rest of a team: that is a job, and it says so
  for (const a of assign) {
    const r = a.bot.r, j = a.job; r.job = j; r.t = 0; r.gp = null; r.team = a.helpers.map(h => h.r); for (const h of r.team) { h.lead = r; h.state = 'assist'; }
    if (j.kind === 'build') { r.src = j.src || null; j.ref.claim = r; r.state = j.src ? 'fetch' : 'go'; }
    else if (j.kind === 'decon' || j.kind === 'clear') { j.ref.claim = r; r.state = 'go'; r.src = null; }
    else if (j.kind === 'carry') { if (j.src.t === 'chunk') { j.src.c.claim = r;       // batching: more of the same going the same way, near the first, rides on the same trip
        const room = cap(r), others = jobs.filter(o => o.kind === 'carry' && o !== j && o.src.t === 'chunk' && !o.src.c.claim && !fails.some(f => f.job === o && /no way|no link/.test(f.why))).map(o => ({ o, x: o.x, y: o.y, kg: o.src.c.kg, item: o.item, dst: o.dst.t + (o.dst.z ? o.dst.z.id : o.dst.m ? F.machines.indexOf(o.dst.m) : '') }));
        j.more = batch({ x: j.x, y: j.y, kg: Math.min(j.src.c.kg, room), item: j.item, dst: j.dst.t + (j.dst.z ? j.dst.z.id : j.dst.m ? F.machines.indexOf(j.dst.m) : '') }, others, room).map(q => q.o.src.c); for (const c of j.more) c.claim = r; if (j.more.length) events.emit('batched', { id: r.id, stops: j.more.length + 1 }); }
      r.state = 'cfetch'; }
    else { r.state = j.kind; }       // rescue, salvage, repair
    if (j.kind === 'rescue') { LOG.say(`${name(j.ref)} stuck at ${where(j.ref.x)}: ${[r].concat(r.team).map(q => q.id).join('+')} lifting it`, G.time); events.emit('rescueStarted', { hauler: j.ref.id, drones: [r.id].concat(r.team.map(q => q.id)) }); }
  }
  // what nobody could take, and why: shown, and tried again another way when the reason passes
  MARKET.blocked = fails.filter(f => f.why !== 'every robot is busy').slice(0, 8).map(f => ({ key: f.job.key, text: `${describe(f.job)}: ${f.why}` }));
  for (const f of fails) if (f.why !== 'every robot is busy' && f.job.said !== f.why) { f.job.said = f.why; if (!SAID.has(f.job.key + f.why)) { SAID.add(f.job.key + f.why); LOG.say(`${describe(f.job)}: ${f.why}`, G.time); if (SAID.size > 300) SAID.clear(); } }
  audit(bots, jobs, new Set(assign.map(a => a.job)));
  // a free robot that is low goes to charge before the next long trip instead of failing half way
  for (const b of bots) if (b.free && !b.r.job && b.r.state === 'idle' && b.wh < b.whMax * 0.5 && fails.some(f => /no power/.test(f.why))) b.r.state = 'charge';
}
const SAID = new Set();
// ---- the idle audit (round 7: "the robots are still idle mostly even if we have things to do") --------------------------------
// Twice a second, after the market: every robot that is idle, against every job that is still open, with the reason
// that robot does not take that job. A robot that is idle while a job it could take stays open is counted (doable);
// so is one that is idle while the only thing holding a piece of work back is a retry timer (timer). Both should
// read zero; the J window shows the table, tools/play.mjs records it for twenty minutes of play.
export const AUDIT = { samples: 0, idleSamples: 0, doable: 0, timer: 0, open: 0, idle: 0, rows: [], latent: [], worst: [], reasons: {} };
const TIMER = /set aside|tried again|no progress|took too long|was gone/;       // ("cannot see it" and "no way" are findings about the world, kept for a while; these are only waits)
function audit(bots, jobs, taken) {
  const A = AUDIT, open = jobs.filter(j => !taken.has(j)), idle = bots.filter(b => b.r.state === 'idle' && !b.r.job && !b.r.holdFor && !b.r.lifted && !b.r.needRescue && !b.r.recall && !b.r.lead), rows = []; let doable = 0, timer = 0;
  A.samples++; A.open = open.length; A.idle = idle.length;
  for (const b of idle) {
    const why = {}; let can = null, tm = null;
    for (const j of open) { const w = whyNot({ ...b, free: true }, j, CTX); if (w === null) { if (!can) can = j; } else { why[w] = (why[w] || 0) + 1; if (TIMER.test(w) && !tm) tm = [j, w]; } }
    if (can) doable++; else if (tm) timer++;
    for (const w in why) A.reasons[w] = (A.reasons[w] || 0) + why[w];
    rows.push({ id: b.id, kind: b.kind, wh: Math.round(b.wh / b.whMax * 100), can: can ? describe(can) : null, timer: tm ? `${describe(tm[0])}: ${tm[1]}` : null, why: Object.entries(why).sort((a, c) => c[1] - a[1]).slice(0, 4) });
  }
  if (idle.length && (SUP.latent || []).some(l => l.timer) && !doable && !timer) timer++;       // work that only a retry timer keeps from being a job counts against an idle robot too
  if (idle.length && open.length) A.idleSamples++; A.doable += doable; A.timer += timer; A.rows = rows; A.latent = SUP.latent || [];
  if (doable || timer) { const rw = rows.find(q => q.can || q.timer) || { kind: idle[0].kind, id: idle[0].id, timer: (SUP.latent.find(l => l.timer) || {}).why }; A.worst.push({ t: +G.time.toFixed(1), robot: (rw.kind === 'crawler' ? 'hauler ' : 'drone ') + rw.id, job: rw.can || rw.timer, kind: rw.can ? 'doable' : 'timer' }); if (A.worst.length > 40) A.worst.shift(); events.emit('idleDoable', A.worst[A.worst.length - 1]); }
}
export function resetAudit() { Object.assign(AUDIT, { samples: 0, idleSamples: 0, doable: 0, timer: 0, open: 0, idle: 0, rows: [], latent: [], worst: [], reasons: {} }); }
// where a drone hangs to cut the spot (px, py): the nearest air within its tool's reach that has a line to it. Over it when
// the sky is open; beside it, in what is already cut, when the spot is under a roof (a drift is cut from its mouth inward)
function standoff(px, py, c) {
  let best = null, bd = 1e9; for (const [dx, dy] of [[0, 1.6], [0, 2.2], [-1.4, 0.3], [1.4, 0.3], [-2.2, 0.2], [2.2, 0.2], [-1.2, 1.2], [1.2, 1.2], [-2.8, 0.6], [2.8, 0.6], [0, -1.4]]) { const x = px + dx, y = py + dy; if (world.dens(x, y) > -0.22) continue; const d = Math.hypot(dx, dy), h = world.ray(x, y, -dx / d, -dy / d, d); if (h && h.d < d - 0.75) continue; const sc = d + (dy > 1 ? 0 : 0.5); if (sc < bd) { bd = sc; best = [x, y]; } }
  return best || [px, Math.min(c.y1 + 0.9, py + 2.2)];
}
// ---- moving --------------------------------------------------------------------------------------------------------------
// the ground hauler walks a path that was searched for on the rock as it is (gnav.js), holding the surface with its
// legs. Off the rock it falls. No way, or no progress along the way it had, is reported to the job logic (r.noWay,
// r.stuck): it never pushes at a wall.
function crawl(r, tx, ty, dt, stop) {
  const dx = tx - r.x, dy = ty - r.y, d = Math.hypot(dx, dy), kg = inv.mass(r.cargo), v = haulerSpeed(kg), near = Math.abs(dx) < stop + 0.5 && Math.abs(dy) < 3.6;
  if (r.wh <= 0) { r.vx = 0; return near; }
  if (r.gx === undefined || Math.abs(tx - r.gx) + Math.abs(ty - r.gy) > 1.5) { r.gp = null; r.pd = undefined; r.pt = 0; r.stuck = 0; r.noWay = 0; r.replans = 0; } r.gx = tx; r.gy = ty;       // a new goal
  if (world.dist(r.x, r.y) > 0.6) { r.vy -= GRAV * dt; r.y += r.vy * dt; r.vx = 0; r.na = lerp(r.na, 1.57, 0.1); r.gp = null; if (world.dist(r.x, r.y) < -0.1) { r.y += 0.3; r.vy = 0; } return near; }
  r.vy = 0; if (near) { r.vx = 0; r.stuck = 0; return true; }
  if (!r.gp) { r.gpT = (r.gpT || 0) - dt; if (r.gpT > 0) return false; r.gp = groundPath(r.x, r.y, tx, ty); r.gi = 0; r.gpT = 1.2; if (!r.gp) { r.noWay = (r.noWay || 0) + 1; return false; } r.noWay = 0; }
  while (r.gi < r.gp.length - 1 && Math.hypot(r.gp[r.gi][0] - r.x, r.gp[r.gi][1] - r.y) < 0.3) r.gi++;
  const w = r.gp[r.gi], wx = w[0] - r.x, wy = w[1] - r.y, wd = Math.hypot(wx, wy) || 1, st = Math.min(v * dt, wd);
  r.x += wx / wd * st; r.y += wy / wd * st; r.vx = wx / wd * v; r.ls0 = wx >= 0 ? 1 : -1; r.wh = Math.max(0, r.wh - (CRAWLER.moveW + 3 * kg) * dt / 3600);
  // the legs keep the hull between a hand and half a metre off the rock; inside that band the way that was searched is followed as it is
  const ds = world.dist(r.x, r.y), e = ds < 0.12 ? ds - 0.12 : ds > 0.45 ? Math.min(0.25, ds - 0.45) : 0; world.normal(r.x, r.y, nv); r.x -= nv[0] * e; r.y -= nv[1] * e;
  let da = Math.atan2(nv[1], nv[0]) - r.na; while (da > Math.PI) da -= 6.2832; while (da < -Math.PI) da += 6.2832; r.na += da * Math.min(1, dt * 10); r.walk = (r.walk || 0) + st;
  if (r.gi >= r.gp.length - 1 && wd < 0.3) { r.gp = null; r.gpT = 0; if (d > stop + 1.2) r.stuck += 2; }       // the end of the way and still not there
  r.pt = (r.pt || 0) + dt; if (r.pt > 2) { if (r.pd !== undefined && d > r.pd - 0.4) { r.stuck += r.pt; r.gp = null; r.gpT = 0; r.replans = (r.replans || 0) + 1; } else r.stuck = Math.max(0, r.stuck - 1); r.pt = 0; r.pd = d; }
  return false;
}
// a drone's flight to (tx, ty): straight when the line is free, else along a path through the air (nav.js). The rock
// pushes it off before it touches, and it is never left inside. Its speed is what its thrust leaves it with the load
// it has (and the drones that share it). Every second and a half it checks that it got nearer; when it did not, it
// plans again, and r.stuck counts the times in a row.
function fly(r, tx, ty, dt, stop = 0.5) {
  if (r.kind === 'crawler' && !r.recall) return crawl(r, tx, ty, dt, stop);
  const dx = tx - r.x, dy = ty - r.y, d = Math.hypot(dx, dy), moved = r.pgx === undefined || Math.hypot(r.pgx - tx, r.pgy - ty) > 1.2;
  if (r.gx0 === undefined || Math.hypot(tx - r.gx0, ty - r.gy0) > 2.5) { r.stuck = 0; r.noWay = 0; r.pd = undefined; r.pt = 0; r.gx0 = tx; r.gy0 = ty; r.nt = 0; }      // a new goal
  // a target in rock or hard against it cannot be reached to the centimetre: beside it is there
  const near = -world.dens(tx, ty); if (near < 0.45) stop += Math.min(0.9, 0.5 - Math.min(near, 0.5) + 0.3);
  r.nt = (r.nt || 0) - dt; let gx = tx, gy = ty;
  if (d <= 1.2) r.path = null;
  else if (r.nt <= 0 || (moved && r.path)) {
    r.nt = 0.35 + (r.id % 5) * 0.03;
    if (lineFree(r.x, r.y, tx, ty)) { r.path = null; r.noWay = 0; }
    else if (!r.path || moved || r.replan) { r.path = findPath(r.x, r.y, tx, ty); r.pi = 0; r.pgx = tx; r.pgy = ty; r.replan = false; r.noWay = r.path ? 0 : (r.noWay || 0) + 1; if (r.noWay >= 3) r.nt = 2.5; }       // no way three times: look again now and then, not every moment
    if (r.path) for (let k = Math.min(r.pi + 8, r.path.length - 1); k > r.pi; k--) if (lineFree(r.x, r.y, r.path[k][0], r.path[k][1])) { r.pi = k; break; }       // cut the corners that can be cut
  }
  if (r.path) { while (r.pi < r.path.length - 1 && Math.hypot(r.path[r.pi][0] - r.x, r.path[r.pi][1] - r.y) < 0.55) r.pi++; gx = r.path[r.pi][0]; gy = r.path[r.pi][1]; r.block = 1; }
  const kg = r.kind === 'crawler' ? 0 : payload(r), vm = r.kind === 'crawler' ? 4 : Math.max(0.8, droneSpeed(kg, teamN(r)));
  const ex = gx - r.x, ey = gy - r.y, ed = Math.hypot(ex, ey) || 1, want = Math.min(vm, Math.max(d * 2.2, r.path ? 2.2 : 0)), ax = clamp((ex / ed * want - r.vx) * 6, -ROBOT.acc, ROBOT.acc), ay = clamp((ey / ed * want - r.vy) * 6, -ROBOT.acc, ROBOT.acc);
  r.vx += ax * dt; r.vy += ay * dt;
  const ds = -world.dens(r.x, r.y);
  const soft = r.path ? 0.24 : 0.4, hard = r.path ? 0.09 : 0.16;
  if (ds < soft) { if (world.normal(r.x, r.y, nv) < 0.05) { nv[0] = 0; nv[1] = 1; } const k = (soft - ds) * 55; r.vx += nv[0] * k * dt; r.vy += nv[1] * k * dt; if (ds < hard) { const p = Math.min(hard - ds, 0.08); r.x += nv[0] * p; r.y += nv[1] * p; const vn = r.vx * nv[0] + r.vy * nv[1]; if (vn < 0) { r.vx -= nv[0] * vn; r.vy -= nv[1] * vn; } } }
  r.sv += ((-ax * 0.03 - r.sw) * 30 - r.sv * 2.5) * dt; r.sw += r.sv * dt;
  r.x += r.vx * dt; r.y += r.vy * dt; r.wh = Math.max(0, r.wh - flyW(kg / teamN(r)) * dt / 3600);
  r.pt = (r.pt || 0) + dt; if (r.pt > 1.5) { if (r.pd !== undefined && d > r.pd - 0.35 && d > stop + 0.3) { r.stuck = (r.stuck || 0) + 1; r.replan = true; r.nt = 0; } else r.stuck = 0; r.pt = 0; r.pd = d; }
  r.tx = tx; r.ty = ty;
  return d < stop;
}
function drop(r, into) { for (let i = 0; i < r.cargo.slots.length; i++) { const s = r.cargo.slots[i]; if (s) { if (s.q) inv.nextQ = s.q; if (s.c !== undefined) inv.nextC = s.c; const left = inv.add(into, s.id, s.n); inv.nextC = null; if (into === S.inv) S.gain(s.id, s.n - left); r.cargo.slots[i] = left > 1e-9 ? { ...s, n: left } : null; } } }
// what a robot still holds is put on the ground where it is, marked as set aside so it is not carried in a circle
function setDown(r, zone) { for (let i = 0; i < r.cargo.slots.length; i++) { const s = r.cargo.slots[i]; if (s && s.n > 1e-9) { if (s.q) inv.nextQ = s.q; if (s.c !== undefined) inv.nextC = s.c; const c = matter.spawn(s.id, s.n, r.x + rand(-0.2, 0.2), r.y - (r.kind === 'crawler' ? -0.4 : 0.4), 0, 0); inv.nextC = null; if (c) { if (zone) { c.zone = zone.id; c.back = true; } else c.skip = G.time + 12; } } r.cargo.slots[i] = null; } }
const disband = r => { if (r.team) for (const h of r.team) if (h.lead === r) { h.lead = null; if (h.state === 'assist') h.state = 'idle'; } r.team = null; if (r.lifting) { r.lifting.lifted = null; r.lifting = null; } };
const release = r => { disband(r); if (r.job && r.job.kind === 'tree') { r.job = null; return; } if (r.job && r.job.kind === 'carry') { if (r.job.src.t === 'chunk') r.job.src.c.claim = null; for (const c of r.job.more || []) if (c.claim === r) c.claim = null; r.job = null; return; } if (r.job && (r.job.kind === 'build' || r.job.kind === 'decon' || r.job.kind === 'clear')) { r.job.ref.claim = null; if (r.carry) { for (const k in r.carry) { inv.nextC = r.carryC === undefined ? null : r.carryC; const left = S.crash ? inv.add(K.hold, k, r.carry[k]) : r.carry[k]; inv.nextC = null; if (left > 1e-9) { inv.nextC = r.carryC === undefined ? null : r.carryC; matter.spawn(k, left, r.x, r.y - 0.4, 0, 0); } } r.carry = null; } } r.job = null; r.src = null; };
// a job did not work from here. It is not dropped in silence and nobody "gives up": the reason is kept against this
// kind of robot for a while, said in the log, and the job goes back to the market, where another robot, the other
// kind of robot, or the same one by another way bids for it. Only when every way has failed several times is the job
// set aside (and that is counted, shown, and looked at again later).
function fail(r, why) {
  const j = r.job; if (!j) return; const key = j.key, n = (FAILN.get(key) || 0) + 1; FAILN.set(key, n); if (FAILN.size > 300) FAILN.clear();
  FAILS.set(key + ':' + r.kind, { until: G.time + (/no way/.test(why) ? 40 : 12), why }); if (FAILS.size > 400) for (const [k, v] of FAILS) if (v.until < G.time) FAILS.delete(k);
  const info = { id: r.id, kind: r.kind, state: r.state, job: describe(j), at: [+r.x.toFixed(1), +r.y.toFixed(1)], to: [+(r.tx || j.x || 0).toFixed(1), +(r.ty || j.y || 0).toFixed(1)], why, n };
  const otherKind = robots.some(q => q.kind !== r.kind), next = n >= 4 ? 'set aside for a minute' : otherKind && /no way/.test(why) ? (r.kind === 'crawler' ? 'a drone tries' : 'the hauler tries') : 'tried again another way';
  LOG.say(`${name(r)}: ${why} to ${describe(j)}; ${next}`, G.time); MARKET.retries++; events.emit('robotRetry', { ...info, next });
  if (n >= 4) { MARKET.gaveUp++; events.emit('robotGaveUp', info); for (const k of ['drone', 'crawler']) FAILS.set(key + ':' + k, { until: G.time + 60, why: why + ' (set aside)' }); FAILN.delete(key); }
  release(r); if (r.kind === 'crawler') { setDown(r); r.fails = (r.fails || 0) + 1; if (r.fails >= 2 && !/no way/.test(why)) r.stuck = 99; }       // twice running it could not do what it set out to: it is the hauler that is stuck, not the jobs
  r.state = inv.mass(r.cargo) > 0.01 ? 'haul' : 'idle'; if (r.kind !== 'crawler' || r.stuck < 99) r.stuck = 0; r.noWay = 0; r.gp = null;
}
// one line that says what a robot is doing and for what
export function intentOf(r) {
  const j = r.job, kg = inv.mass(r.cargo), to = d => d.t === 'mach' ? 'the ' + d.m.kind : d.t === 'inv' ? (d.inv === K.hold ? 'the hold' : 'the chest') : d.t === 'zone' ? 'the ' + d.z.name : d.t === 'fill' ? 'the ' + d.f.kind : d.t === 'dump' ? 'the spoil heap' : 'you';
  if (r.lifted) return `lifted by drone ${r.lifted.id}`;
  if (r.needRescue) return r.wh <= 0 ? 'out of power: waits for a lift' : 'stuck: waits for the drones to lift it';
  if (r.recall) return 'lost its footing: jetting back to the wreck';
  if (r.state === 'assist') return r.lead ? `sharing the load with drone ${r.lead.id}` : 'idle';
  if (r.holdFor && !j) return `waits for another drone to share ${describe(r.holdFor)}`;
  if (r.lost) return 'shut in: no way out';
  if (r.state === 'charge') return 'charging';
  if (r.state === 'haul') return `unloading ${kg.toFixed(0)} kg`;
  if (!j) return r.state === 'idle' ? (r.wh < whOf(r) * 0.9 ? 'docked, charging' : MARKET.jobs ? 'docked: ' + (MARKET.blocked[0] ? MARKET.blocked[0].text : 'no job it can take') : 'docked: nothing to do') : r.state;
  if (j.kind === 'carry') return r.state === 'cfetch' ? `fetching ${j.item} for ${to(j.dst)}${j.more && j.more.length ? ' (+' + j.more.length + ' on the way)' : ''}` : `carrying ${kg.toFixed(0)} kg ${j.item} to ${to(j.dst)}`;
  if (j.kind === 'build') return r.state === 'fetch' ? `fetching the ${j.ref.kind === 'wall' ? 'iron' : j.ref.kind} to build` : r.state === 'go' ? `${r.carry ? 'carrying the ' + (j.ref.kind === 'wall' ? 'iron' : j.ref.kind) : 'going'} to the site` : `building the ${j.ref.kind} ${(j.ref.prog * 100).toFixed(0)}%`;
  if (j.kind === 'decon') return `taking the ${j.ref.deck ? 'deck up' : j.ref.kind + ' apart'}`;
  if (j.kind === 'tree') return j.sub === 'fell' ? `felling the tree: the kerf is ${Math.min(99, 100 * j.ref.k / Math.max(1, j.need || 1)).toFixed(0)} % through` : `cutting the trunk into logs: ${j.ref.sec} cut`;
  if (j.kind === 'rescue') return r.lifting ? `carrying ${name(j.ref)} home` : `going to lift ${name(j.ref)}`;
  if (j.kind === 'salvage') return `salvaging the ${j.ref.name}`;
  if (j.kind === 'repair') return `repairing the ${j.ref.kind}`;
  return j.auto ? 'mining the scanned rock' : 'cutting the marked ground';
}
let assignT = 0;
export function stepRobots(dt) {
  assignT -= dt; SUP.crawlers = 0; let drones = 0; for (const r of robots) if (r.kind === 'crawler') SUP.crawlers++; else drones++; stepAuto(dt, drones);
  if (assignT <= 0 && robots.length) { assignT = 0.5; plan(); }
  for (const r of robots) {
    const j = r.job, hub = (r.hub && r.hub.ship && S.crash) || F.machines.includes(r.hub) ? r.hub : (r.hub = F.machines.find(m => m.kind === 'hub') || (S.crash && K.awake ? SHIPHUB : null)), hx = hub ? (hub.x + 1) * TS : S.P.x, hy = hub ? (hub.y + 3.4) * TS + Math.sin(r.seed + r.id) * 0.3 + (r.id % 3) * 0.5 : S.P.y + 3, W = whOf(r), cr = r.kind === 'crawler';
    r.working = false; r.block = 0; if (r.state !== r.st0) { r.st0 = r.state; r.stT = 0; if (!cr) { r.stuck = 0; r.noWay = 0; } } r.stT = (r.stT || 0) + dt;
    if (r.lifted) { const l = r.lifted; r.x = l.x; r.y = l.y - 0.75; r.vx = l.vx; r.vy = 0; r.na = lerp(r.na, 1.57, 0.15); continue; }       // in the drones' lines
    // a job whose thing is gone is let go
    if (j && j.kind === 'carry') { if ((j.src.t === 'chunk' && j.src.c.gone && r.state === 'cfetch' && !(j.more && j.more.length)) || (j.dst.t === 'mach' && !F.machines.includes(j.dst.m))) { release(r); r.state = inv.mass(r.cargo) > 0.01 ? 'haul' : 'idle'; } }
    else if (j && (j.kind === 'build' || j.kind === 'decon' || j.kind === 'clear') && (j.ref.dead || (j.kind === 'build' && !BP.ghosts.includes(j.ref)) || (j.kind === 'decon' && (j.ref.deck ? !BP.dmarks.includes(j.ref) : !F.machines.includes(j.ref) || !j.ref.decon)) || (j.kind === 'clear' && !BP.clears.includes(j.ref)))) { release(r); r.state = 'idle'; }
    else if (j && j.kind === 'rescue' && (!robots.includes(j.ref) || (!j.ref.needRescue && !r.lifting))) { release(r); r.state = 'idle'; }
    else if (j && j.kind === 'salvage' && j.ref.gone) { release(r); r.state = 'idle'; }
    else if (j && j.kind === 'tree' && (!flora.cut.has(j.ref.id) || (j.sub === 'fell' ? j.ref.st !== 0 || !j.ref.mark : j.ref.st !== 2))) { release(r); r.state = 'idle'; }
    else if (j && j.kind === 'repair' && !F.machines.includes(j.ref)) { release(r); r.state = 'idle'; }
    // no way, or no progress: the job goes back to the market with the reason (fail), never dropped in silence
    if (r.job && !cr && (r.stuck >= 4 || r.noWay >= 3) && r.state !== 'work') fail(r, r.noWay >= 3 ? 'no way through the air' : 'no progress');
    if (r.job && r.stT > (cr ? 110 : 90) && (r.state === 'cfetch' || r.state === 'cgo' || r.state === 'fetch' || r.state === 'go')) fail(r, 'the trip took too long');
    if (cr && !r.recall && !r.needRescue) {
      // the hauler: no way on the ground to its job is a reason for the market (a drone tries); no way home, no progress
      // on the way it had, or an empty battery, is a call for a lift
      if (r.job && r.noWay >= 2) fail(r, 'no way on the ground');
      else if (r.stuck > 9 || r.wh <= 0 || (!r.job && r.noWay >= 3 && Math.hypot(r.x - hx, r.y - hy) > 6)) {
        const why = r.wh <= 0 ? 'out of power' : r.stuck > 9 ? 'no progress on the ground' : 'no way home on the ground'; if (r.job) fail(r, why); setDown(r); r.state = 'idle'; r.stuck = 0; r.noWay = 0; r.gp = null;
        if (drones > 0) { r.needRescue = true; events.emit('haulerStuck', { id: r.id, why, at: [+r.x.toFixed(1), +r.y.toFixed(1)] }); LOG.say(`${name(r)}: ${why} at ${where(r.x)}; set its load down and called for a lift`, G.time); }
        else { r.recall = true; r.path = null; r.pgx = undefined; r.gx0 = undefined; events.emit('haulerRecalled', r.id); }
      }
    }
    if (r.needRescue) { r.vx = 0; if (world.dist(r.x, r.y) > 0.6) { r.vy -= GRAV * dt; r.y += r.vy * dt; } else r.vy = 0; continue; }
    if (r.recall) { const gy = world.groundY(hx, hy, 0.5, 12); r.wh = Math.max(0, r.wh - 120 * dt / 3600); r.na = lerp(r.na, 1.57, 0.1); if (fly(r, hx + 1.5, (gy ?? hy - 3) + 0.6, dt, 0.9) || r.noWay >= 6 || !hub) { r.recall = false; r.vx = r.vy = 0; r.stuck = 0; r.noWay = 0; r.gx = undefined; } continue; }
    r.lost = !cr && !r.job && r.noWay >= 3;      // shut in: no way home either. It waits where it is and says so
    if (r.wh < W * 0.12 && r.state !== 'charge' && r.state !== 'assist' && !r.lifting) { if (r.job) { LOG.say(`${name(r)}: low on charge; ${describe(r.job)} goes back to the market`, G.time); release(r); } r.state = 'charge'; }
    if (r.state === 'idle') { const gy = cr ? world.groundY(hx + 2.2, hy, 0.5, 12) : null, at = fly(r, cr ? hx + 2.2 : hx + Math.cos(r.seed + r.id * 2.1) * 1.2, cr ? (gy ?? hy - 3) + 0.3 : hy, dt, cr ? 1.2 : 0.3); if (hub && Math.hypot(r.x - hx, r.y - hy) < (cr ? 6 : 2.5)) r.wh = Math.min(W, r.wh + ROBOT.chargeW * dt / 3600); if (at && !cr) r.wh = Math.min(W, r.wh + flyW(0) * dt / 3600); if (inv.mass(r.cargo) > 0.01) r.state = 'haul'; }       // docked: landed, no power spent
    else if (r.state === 'charge') { if (fly(r, hx, hy - 1.2, dt, 0.6) || !hub) { r.wh = Math.min(W, r.wh + (ROBOT.chargeW + flyW(0)) * dt / 3600 * (hub ? 1 : 0.05)); if (r.wh >= W * 0.95) r.state = 'idle'; } }
    else if (r.state === 'assist') { const l = r.lead; if (!l || !robots.includes(l) || !l.job) { r.lead = null; r.state = 'idle'; } else { const i = l.team.indexOf(r); fly(r, l.x + (i % 2 ? -0.7 : 0.7) * (1 + (i >> 1)), l.y + 0.05, dt, 0.15); } }
    else if (r.state === 'fetch') {
      const s = r.src; if (s.player) { s.x = S.P.x; s.y = S.P.y + 1.2; }
      if (fly(r, s.x, s.y + 0.6, dt, 0.9)) { if (inv.pay(s.inv, r.job.cost)) { r.carry = r.job.cost; r.carryC = Object.keys(r.job.cost)[0] === 'iron' ? 1 : inv.lastC; r.job.ref.have = false; r.state = 'go'; audio.play('click'); events.emit('robotFetched', Object.keys(r.job.cost)[0]); } else { LOG.say(`${name(r)}: the ${Object.keys(r.job.cost)[0]} was gone from the store; ${describe(r.job)} goes back to the market`, G.time); release(r); r.state = 'idle'; } }
    } else if (r.state === 'go') {
      const top = j.kind === 'clear' ? j.ref.y1 + 0.8 : j.y + 1.6;
      if (fly(r, j.x, top, dt, cr ? 1.6 : 1.0)) { if (r.carry) { j.ref.have = true; if (r.carryC !== undefined && r.carryC < 0.999) j.ref.cond = r.carryC; r.carry = null; } if (cr) { j.ref.claim = null; r.job = null; r.state = 'idle'; LOG.say(`${name(r)} set the ${j.ref.kind} kit down at the site: a drone builds it`, G.time); } else r.state = 'work'; }
    } else if (r.state === 'work') {
      r.working = true; r.wh = Math.max(0, r.wh - ROBOT.workW * dt / 3600); r.wx = j.x; r.wy = j.y;
      if (j.kind === 'build') { fly(r, j.x + Math.sin(r.t * 1.3) * 0.6, j.y + 1.6, dt, 0.2); r.t += dt; j.ref.prog += dt / buildT(j.ref.kind, ROBOT.workW * teamN(r)); weld(j.x, j.y, dt); if (j.ref.prog >= 1) { finishGhost(j.ref); disband(r); r.job = null; r.state = 'idle'; events.emit('robotBuilt'); } }
      else if (j.kind === 'decon' && j.ref.deck) { fly(r, j.x, j.y + 1.4, dt, 0.2); j.ref.dp = (j.ref.dp || 0) + dt / 1.5; weld(j.x, j.y, dt); if (j.ref.dp >= 1) { liftDeck(j.ref, r.cargo); r.job = null; r.state = 'haul'; events.emit('robotDecon', 'platform'); } }
      else if (j.kind === 'decon') { fly(r, j.x, j.y + 1.4, dt, 0.2); j.ref.dp = (j.ref.dp || 0) + dt / Math.max(1.5, buildT(j.ref.kind, ROBOT.workW) * 0.6); weld(j.x, j.y, dt); if (j.ref.dp >= 1) { const big = makeInv(12), dk = j.ref.kind; dismantle(j.ref, big); events.emit('robotDecon', dk); for (const s of big.slots) if (s) { const room = Math.max(0, cap(r) - inv.mass(r.cargo)) / ITEMS[s.id].m, k = ITEMS[s.id].u === 'ea' ? (ITEMS[s.id].m <= cap(r) ? Math.min(s.n, Math.max(1, Math.floor(room))) : 0) : Math.min(s.n, room); if (k > 0) { if (s.c !== undefined) inv.nextC = s.c; inv.add(r.cargo, s.id, k); inv.nextC = null; } if (s.n - k > 1e-9) { if (s.c !== undefined) inv.nextC = s.c; matter.spawn(s.id, s.n - k, j.x, j.y + 0.6, rand(-0.5, 0.5), 0.5); inv.nextC = null; } } r.job = null; r.state = 'haul'; } }
      else {       // cut marked ground: kerf and wedge, 50 MJ a cubic metre (docs/MINING.md 3), so the tool's watts set the rate; what comes out is what the rock is
        const c = j.ref, w = c.x1 - c.x0, cols = Math.max(1, Math.round(w / 0.4)), rows = Math.max(1, Math.round((c.y1 - c.y0) / 0.4)), n = cols * rows, i = Math.floor(c.cur), row = Math.floor(i / cols), col = row % 2 ? cols - 1 - i % cols : i % cols;
        const px = c.x0 + (col + 0.5) * w / cols, py = c.y1 - (row + 0.5) * (c.y1 - c.y0) / rows; r.wx = px; r.wy = py; if (!r.so || r.soI !== i) { r.so = standoff(px, py, c); r.soI = i; } fly(r, r.so[0], r.so[1], dt, 0.3);
        const acc = {}; r.cutDebt = Math.min(0.02, (r.cutDebt || 0) + (Math.hypot(r.x - px, r.y - py) < 3.4 ? ROBOT.workW * dt / ((world.matAt(px, py) === M.SOIL ? 20e6 : 50e6) * SLAB) : 0)); let ch = 0;
        if (r.cutDebt > 0.0012) { world.rawRate = true; ch = world.shape(Math.max(c.x0, px - 0.45), Math.max(c.y0, py - 0.45), Math.min(c.x1, px + 0.45), Math.min(c.y1, py + 0.45), (x, y) => Math.max(c.x0 - x, x - c.x1, c.y0 - y, y - c.y1, Math.hypot(x - px, y - py) - 0.42), -1, 0, Math.max(0.004, r.cutDebt / 0.8), acc, q => q >= M.XENO); world.rawRate = false; }
        for (const k in acc) if (acc[k] > 0) { r.cutDebt -= acc[k] / (MAT[k].rho * SLAB); if (MAT[k].item) for (const [id, kg, q] of rockLumps(+k, acc[k], px, py)) { if (q) inv.nextQ = q; const left = inv.add(r.cargo, id, kg, Math.max(0, cap(r) + 3 - inv.mass(r.cargo))); if (left > 1e-9) { if (q) inv.nextQ = q; matter.spawn(id, left, px, py + 0.3, rand(-0.5, 0.5), 0.5); } } }
        if (ch) { heatAt(px, py, 0.3, dt * 1.5); if (Math.random() < dt * 30) S.parts.spawn({ x: px, y: py, vx: rand(-4, 4), vy: rand(0, 6), life: rand(0.2, 0.6), size: 0.035, c: [5, 2.6, 0.8], c2: [0.9, 0.12, 0.02], col: 1, bounce: 0.4 }); if (Math.random() < dt * 2) env.noise(px, py, 14); }
        else if (world.dens(px, py) < 0.02 || r.cutDebt >= 0.019) c.cur += dt * 14;       // nothing left under the tool (or nothing it can cut): on to the next spot
        if (c.cur >= n) { const k = BP.clears.indexOf(c); if (k >= 0) BP.clears.splice(k, 1); r.job = null; r.state = 'haul'; events.emit('robotCleared'); }
        else if (inv.mass(r.cargo) >= cap(r)) { c.claim = null; r.job = null; r.state = 'haul'; }
      }
    } else if (r.state === 'cfetch') {  // carrying, first leg: to the source, and load what the net holds
      const s = j.src, ch = s.t === 'chunk'; if (s.player) { s.x = S.P.x; s.y = S.P.y + 1.0; } if (ch) { if (s.c.gone && j.more && j.more.length) { const nb = j.more.shift(); j.src = { t: 'chunk', c: nb, x: nb.x, y: nb.y, n: nb.n }; continue; } s.x = s.c.x; s.y = s.c.y; }
      // a chunk is winched up on a line from wherever the robot can see it (a cut is often too narrow to fly into)
      const at = fly(r, s.x, s.y + (ch ? 1.3 : 0.25), dt, 0.8), dC = Math.hypot(s.x - r.x, s.y - r.y), see = cr ? (ch ? dC < 1.9 : at || dC < 2.2) : ch ? dC < 3.2 && (dC < 0.8 || !world.ray(r.x, r.y - 0.15, (s.x - r.x) / dC, (s.y - r.y + 0.15) / dC, Math.max(0.05, dC - s.c.r - 0.4))) : at;
      if (!see) { r.winch = 0; if (cr ? r.stuck > 5 : dC < 4 || r.stuck > 2) r.t += dt; if (r.t > 3.5) fail(r, cr ? 'cannot get beside it' : 'cannot see it from the air'); }
      else if (ch && (r.winch = (r.winch || 0) + dt) < (cr ? 0.5 : 0.7)) { r.wx = s.x; r.wy = s.y; }
      else { r.winch = 0;
        const room = Math.max(0, cap(r) * (r.team && r.team.length ? teamN(r) : 1) - inv.mass(r.cargo)) / ITEMS[j.item].m, want = Math.min(j.n, ITEMS[j.item].u === 'ea' ? Math.max(1, Math.floor(room + 1e-6)) : room); let got = 0;
        if (s.t === 'chunk') { got = matter.take(s.c, Math.min(want, s.c.n)); s.c.claim = null; } else if (s.t === 'inv') { got = inv.take(s.inv, j.item, want); if (s.player && S.armOut && S.armOut[j.item]) S.armOut[j.item] = Math.max(0, S.armOut[j.item] - got); } else { got = Math.min(want, s.m.out[j.item] || 0); if (got > 0) { s.m.out[j.item] -= got; if (s.m.out[j.item] < 1e-9) delete s.m.out[j.item]; if (j.item === 'rubble' && s.m.q) inv.nextQ = s.m.q; } }
        if (got > 1e-9) { if (ITEMS[j.item].u === 'ea' && s.t !== 'out') inv.nextC = inv.lastC; inv.add(r.cargo, j.item, got); inv.nextC = null; j.got = (j.got || 0) + got; r.state = 'cgo'; r.t = 0; r.stT = 0; audio.play('click'); events.emit('robotLoaded', j.item);
          // the trip was planned with more stops (batching): the next one, while there is room; else whatever of the same lies close by
          if (ch && inv.mass(r.cargo) < cap(r) * 0.8) { let nb = null; while (j.more && j.more.length && !nb) { const c = j.more.shift(); if (!c.gone) nb = c; } if (!nb) { let nd = cr ? 5 : 3.5; for (const c of matter.list) if (c.id === j.item && !c.claim && !c.gone && !c.dumped && c.zone === s.c.zone && c.temp < 0.7 && !(j.dst.t === 'zone' && c.zone === j.dst.z.id)) { const d2 = Math.hypot(c.x - r.x, c.y - r.y); if (d2 < nd) { nd = d2; nb = c; } } } if (nb) { nb.claim = r; j.src = { t: 'chunk', c: nb, x: nb.x, y: nb.y, n: nb.n }; j.n = nb.n; r.state = 'cfetch'; } }
          if (r.state === 'cgo') for (const c of j.more || []) if (c.claim === r) c.claim = null;
        } else { r.job = null; r.state = inv.mass(r.cargo) > 0.01 ? 'cgo' : 'idle'; if (r.state === 'cgo') r.job = j; else disband(r); }
      }
    } else if (r.state === 'cgo') {     // second leg: to whoever asked for it, and set it down there
      const d = j.dst, P = S.P; if (d.t === 'player') { d.x = P.x; d.y = P.y + 1.3; }
      if (fly(r, d.x, d.y + (d.t === 'dump' || d.t === 'zone' ? 0.6 : 0.4), dt, cr ? 1.5 : 0.9)) {
        for (let i = 0; i < r.cargo.slots.length; i++) { const s = r.cargo.slots[i]; if (!s) continue; let left = s.n; if (s.q) inv.nextQ = s.q; if (s.c !== undefined) inv.nextC = s.c;
          if (d.t === 'fill') left = fillPut(d.f, s.id, s.n); else
          if (d.t === 'mach') { left = give(d.m, s.id, s.n); if (s.q && left < s.n) d.m.qIn = s.q; } else if (d.t === 'inv') left = inv.add(d.inv, s.id, s.n); else if (d.t === 'player') { left = S.add(s.id, s.n); S.gain(s.id, s.n - left); }
          inv.nextQ = null; inv.nextC = null; if (left > 1e-9 && d.t === 'mach') { r.cargo.slots[i] = { ...s, n: left }; continue; }       /* a machine that will not take it: it goes back to a store, not onto the ground */
          if (left > 1e-9) { if (s.q) inv.nextQ = s.q; if (s.c !== undefined) inv.nextC = s.c; const c = matter.spawn(s.id, left, r.x + rand(-0.3, 0.3), r.y - 0.5, rand(-0.5, 0.5), 0); inv.nextC = null; if (c && d.t === 'zone') { c.zone = d.z.id; c.back = true; } else if (c && d.t === 'dump') c.dumped = true; else if (c) c.skip = G.time + (d.t === 'fill' ? 4 : 20); }
          r.cargo.slots[i] = null; }
        r.fails = 0; events.emit('robotDelivered', { item: j.item, n: j.got, to: d.t, by: r.kind }); if (d.t === 'mach') events.emit('robotFed', d.m.kind); disband(r); r.job = null; r.state = inv.mass(r.cargo) > 0.01 ? 'haul' : 'idle'; audio.play('place');
      }
    } else if (r.state === 'rescue') {  // lift a hauler that cannot move: go to it, hook on with the team, carry it to the dock
      const h = j.ref;
      if (!r.lifting) { if (fly(r, h.x, h.y + 0.8, dt, 0.5) && (r.team || []).every(q => Math.hypot(q.x - h.x, q.y - h.y) < 2.2)) { r.t += dt; r.winch = r.t; r.wx = h.x; r.wy = h.y; if (r.t > 0.8) { r.lifting = h; h.lifted = r; r.winch = 0; audio.play('click'); } } }
      else { const gy = world.groundY(hx + 2.2, hy, 0.5, 12) ?? hy - 3; if (fly(r, hx + 2.2, gy + 1.15, dt, 0.5)) { h.lifted = null; r.lifting = null; h.needRescue = false; h.x = r.x; h.y = gy + 0.3; h.vy = 0; h.stuck = 0; h.noWay = 0; h.gp = null; h.gx = undefined; h.state = 'idle'; h.rescued = (h.rescued || 0) + 1; events.emit('haulerRescued', { id: h.id, by: [r.id].concat((r.team || []).map(q => q.id)) }); LOG.say(`${name(h)} set down at the dock by ${[r].concat(r.team || []).map(q => q.id).join('+')}`, G.time); disband(r); r.job = null; r.state = 'idle'; audio.play('place'); } }
    } else if (r.state === 'salvage') { // a part of the wreck you marked: cut it out, bring what it is worth
      const p = j.ref, [px, py] = partPos(p);
      if (fly(r, px, py + 0.5, dt, 0.7)) { r.working = true; r.wx = px; r.wy = py; r.t += dt; r.wh = Math.max(0, r.wh - ROBOT.workW * dt / 3600); if (r.t >= salvageTime(p.kg, true)) { salvagePart(p, r.cargo); r.job = null; r.state = 'haul'; events.emit('robotSalvaged', p.name); } }
    } else if (r.state === 'tree') {    // a tree: the saw through the trunk (it falls away from the drone), or through the trunk that lies, one log a cut
      const c = j.ref, side = c.st === 0 ? (r.x < c.x ? -1 : 1) : 0, tx = c.st === 0 ? c.x + side * 1.3 : j.x, ty = c.st === 0 ? c.y + 1.5 : j.y + 1.3;
      if (fly(r, tx, ty, dt, 0.6)) { r.working = true; r.wx = c.st === 0 ? c.x : j.x; r.wy = c.st === 0 ? c.y + 0.55 : j.y; r.wh = Math.max(0, r.wh - ROBOT.workW * dt / 3600); j.need = c.st === 0 ? kerfOf(c.d) : 0; const res = treeSaw(c, dt, r.x); if (Math.random() < dt * 3) env.noise(r.wx, r.wy, 26);
        if (Math.random() < dt * 20) S.parts.spawn({ x: r.wx, y: r.wy, vx: rand(-2, 2), vy: rand(0.5, 3), life: rand(0.3, 0.8), size: rand(0.02, 0.04), c: [0.6, 0.45, 0.25], mode: 1, col: 1, bounce: 0.2 });
        if (res === 'felled' || res === 'done') { r.job = null; r.state = 'idle'; events.emit(res === 'felled' ? 'robotFelled' : 'robotBucked', c.id); if (res === 'felled') { r.vy += 3; r.vx -= (c.dir || 1) * 3; } } else if (res === 'log') { const nx = treeJobs().find(q => q.id === c.id); if (nx) { j.x = nx.x; j.y = nx.y; } } }
    } else if (r.state === 'repair') {
      const m = j.ref; if (fly(r, j.x, j.y + 1.2, dt, 0.6)) { r.working = true; r.wx = j.x; r.wy = j.y; r.wh = Math.max(0, r.wh - ROBOT.workW * dt / 3600); m.hp = Math.min(DEFS[m.kind].hp, m.hp + dt * 12); weld(j.x, j.y, dt); if (m.hp >= DEFS[m.kind].hp) { r.job = null; r.state = 'idle'; events.emit('robotRepaired', m.kind); } }
    } else if (r.state === 'haul') {    // bring what it holds to a store; raw rock to its zone
      const s0 = r.cargo.slots.find(q => q), z = s0 && ITEMS[s0.id].cat === 'raw' ? null : undefined; let best = null, bd = 1e9; const all = sources(), stores = all.filter(q => !q.player);
      if (z === null) { const zz = zoneFor(s0.id); if (zz) { if (!r.hz || r.hz.z !== zz) { const [zx, zy] = zoneSpot(zz); r.hz = { z: zz, x: zx, y: zy }; } if (fly(r, r.hz.x, r.hz.y, dt, cr ? 1.5 : 0.9)) { setDown(r, zz); r.hz = null; r.state = 'idle'; } continue; } }
      for (const s of stores.length ? stores : all) { const d = Math.hypot(s.x - r.x, s.y - r.y); if (d < bd) { bd = d; best = s; } }      // to a store; into your hands only when there is no store at all
      if (!best) r.state = 'idle'; else if (fly(r, best.x, best.y + 0.7, dt, cr ? 1.6 : 1.0)) { drop(r, best.inv); setDown(r); r.state = 'idle'; }
    }
  }
}
export function drawRobots(b, time) {
  for (const r of robots) {
    if (r.kind === 'crawler') { drawCrawler(b, r, time); continue; }
    const tilt = clamp(-r.vx * 0.06, -0.5, 0.5), c = Math.cos(tilt), s = Math.sin(tilt), low = r.wh < ROBOT.wh * 0.2, docked = r.state === 'idle' && !r.job && Math.abs(r.vx) + Math.abs(r.vy) < 0.3, bl = Math.sin(time * 6 + r.seed) > 0.6 ? 1 : 0.15;
    b.add(r.x, r.y, 0.34, 0.16, tilt, mul(C.hull, 0.55), 1, 2, 1, r.id); b.add(r.x, r.y - 0.07, 0.16, 0.12, tilt, C.dark, 1, 0, 1, 2);
    for (const d of [-1, 1]) { const rx = r.x + d * 0.24 * c, ry = r.y + d * 0.24 * s + 0.03; b.seg(r.x, r.y, rx, ry, 0.035, C.steel, 1, 0, 1); b.add(rx, ry + 0.03, 0.26, 0.035, tilt, [0.5, 0.6, 0.7], docked ? 0.08 : 0.35, 0, 2); if (!docked) b.add(rx, ry - 0.1, 0.16, 0.3, 0, [0.4, 0.9, 1.4], 0.35, 1, 2); }
    b.add(r.x - 0.17 * c, r.y - 0.17 * s, 0.045, 0.045, 0, mul(C.red, 3 * bl), 1, 1, 2); b.add(r.x + 0.17 * c, r.y + 0.17 * s, 0.045, 0.045, 0, mul(low ? C.amber : C.acid, 3 * (low ? bl : 1)), 1, 1, 2);
    b.add(r.x, r.y - 0.1, 0.07, 0.07, 0, mul(C.warm, 2.2), 1, 1, 2); light.emit(r.x / TS, (r.y - 0.4) / TS, 0.3, 0.27, 0.22);
    const kg = inv.mass(r.cargo);
    if (r.carry || kg > 0.01) {      // the load hangs in a net under it and swings behind the motion
      const L = 0.42 + Math.min(0.2, kg * 0.003), lx = r.x + Math.sin(r.sw) * L, ly = r.y - 0.08 - Math.cos(r.sw) * L, s0 = r.cargo.slots.find(q => q), col = s0 ? (ITEMS[s0.id].c || C.steel) : C.steel, rr = 0.14 + Math.min(0.24, Math.sqrt(kg) * 0.03);
      for (const d of [-1, 1]) b.seg(r.x + d * 0.08, r.y - 0.06, lx + d * rr * 0.7, ly + rr * 0.3, 0.014, C.steel, 1, 0, 1);
      if (r.carry || !s0 || ITEMS[s0.id].u === 'ea') b.add(lx, ly, 0.26, 0.2, r.sw, mul(C.steel, 0.9), 1, 0, 1, 7); else for (let i = 0; i < (kg > 25 ? 3 : 2); i++) b.add(lx + (i - 1) * rr * 0.6, ly - (i % 2) * rr * 0.3, rr * 1.5, rr * 1.3, r.seed + i, mul(col, 0.55 + i * 0.1), 1, 13, 1, r.seed + i * 3, 0, 0, 0.5);
      b.seg(lx - rr, ly + rr * 0.2, lx + rr, ly + rr * 0.2, 0.012, mul(C.steel, 0.7), 1, 0, 1, 0, 0, -rr * 0.9);
    }
    if (r.winch > 0 && (r.state === 'cfetch' || r.state === 'rescue')) { b.seg(r.x, r.y - 0.1, r.wx, r.wy, 0.016, mul(C.steel, 1.2), 1, 0, 1); b.add(r.wx, r.wy, 0.12, 0.12, 0, mul(C.amber, 1.5), 0.8, 1, 2); }
    if (r.lifting) { const h = r.lifting; for (const q of [r].concat(r.team || [])) b.seg(q.x, q.y - 0.08, h.x + (q.x - r.x) * 0.3, h.y + 0.12, 0.018, mul(C.steel, 1.2), 1, 0, 1); }       // the lines the hauler hangs in
    // where it is going: a row of small marks to its target, so what it does is never a guess
    if (r.job && r.state !== 'work' && r.tx !== undefined) { const dx = r.tx - r.x, dy = r.ty - r.y, d = Math.hypot(dx, dy), n = Math.min(24, Math.floor(d / 0.7)), col = r.state === 'cfetch' || r.state === 'fetch' ? C.amber : C.cyan; for (let i = 1; i <= n; i++) { const u = (i - (time * 1.5) % 1) / (n + 1); if (u > 0.02) b.add(r.x + dx * u, r.y + dy * u, 0.05, 0.05, 0, mul(col, 1.2), 0.35, 1, 2); } if (d > 1) b.add(r.tx, r.ty, 0.22, 0.22, 0, mul(col, 1.1), 0.5, 4, 2); }
    if (r.working) { const fl = 0.7 + 0.3 * Math.sin(time * 60 + r.seed); b.seg(r.x, r.y - 0.1, r.wx, r.wy, 0.03, [1.2, 3, 4], fl, 2, 2); b.seg(r.x, r.y - 0.1, r.wx, r.wy, 0.14, [0.1, 0.5, 0.7], 0.35, 2, 2); b.add(r.wx, r.wy, 0.6, 0.6, 0, [1, 2.4, 3], fl, 1, 2); light.emit(r.wx / TS, r.wy / TS, 0.3, 0.8, 1.0); }
  }
}
// the ground hauler: a low dark hull that lies along the rock it holds, six short legs that step, a bed with the load
// in it, one amber lamp. It reads as a machine that belongs on the ground.
function drawCrawler(b, r, time) {
  const nx = Math.cos(r.na), ny = Math.sin(r.na), tx = ny, ty = -nx, rot = Math.atan2(ty, tx), kg = inv.mass(r.cargo), mv = Math.abs(r.vx) > 0.2 ? 1 : 0, w = r.walk || 0, cx = r.x + nx * 0.08, cy = r.y + ny * 0.08;
  for (let i = 0; i < 3; i++) for (const sd of [-1, 1]) { const o = (i - 1) * 0.26, ph = w * 5 + i * 2.1 + (sd > 0 ? 3.14 : 0), st = Math.sin(ph) * 0.09 * mv, lift = Math.max(0, Math.cos(ph)) * 0.07 * mv, hx = cx + tx * o, hy = cy + ty * o, kx = hx + tx * (st * 0.5 + sd * 0.05) + nx * 0.1, ky = hy + ty * (st * 0.5 + sd * 0.05) + ny * 0.1, fx = hx + tx * (st + sd * 0.1) - nx * (0.3 - lift), fy = hy + ty * (st + sd * 0.1) - ny * (0.3 - lift);
    b.seg(hx, hy, kx, ky, 0.045, mul(C.steel, sd > 0 ? 0.8 : 0.5), 1, 2, 1); b.seg(kx, ky, fx, fy, 0.035, mul(C.steel, sd > 0 ? 0.7 : 0.45), 1, 2, 1, 0, 0.5); }
  b.add(cx, cy, 0.86, 0.2, rot, mul(C.hull, 0.4), 1, 2, 1, r.id, 0.15, 0, 0.5); b.add(cx - tx * 0.05 + nx * 0.1, cy - ty * 0.05 + ny * 0.1, 0.6, 0.1, rot, C.dark, 1, 0, 1, 3);
  const dir = (r.ls0 || 1), hx = cx + tx * dir * 0.4, hy = cy + ty * dir * 0.4; b.add(hx, hy, 0.16, 0.14, rot, mul(C.steel, 0.9), 1, 2, 1, 5); b.add(hx + tx * dir * 0.07, hy + ty * dir * 0.07, 0.05, 0.05, 0, mul(C.amber, 3), 1, 1, 2); b.add(hx + tx * dir * 0.5, hy + ty * dir * 0.5, 1.1, 0.8, 0, mul(C.amber, 0.12), 1, 1, 2);
  light.emit((r.x + tx * dir * 0.8) / TS, (r.y + ny * 0.3) / TS, 0.34, 0.22, 0.1);
  if (kg > 0.05) { const s0 = r.cargo.slots.find(q => q), col = s0 ? (ITEMS[s0.id].c || C.steel) : C.steel, n = kg > 90 ? 4 : kg > 40 ? 3 : 2; for (let i = 0; i < n; i++) { const o = (i - (n - 1) / 2) * 0.17, rr = 0.15 + Math.min(0.1, kg * 0.0006) + (i % 2) * 0.03; b.add(cx + tx * o + nx * (0.2 + (i % 2) * 0.05), cy + ty * o + ny * (0.2 + (i % 2) * 0.05), rr * 1.5, rr * 1.25, r.seed + i, mul(col, 0.5 + i * 0.08), 1, 13, 1, r.seed + i * 3, 0, 0, 0.5); } }
  if (r.winch > 0 && r.state === 'cfetch') { b.seg(cx, cy, r.wx, r.wy, 0.02, mul(C.steel, 1.2), 1, 0, 1); b.add(r.wx, r.wy, 0.12, 0.12, 0, mul(C.amber, 1.5), 0.8, 1, 2); }
  if (r.recall) { for (const d of [-0.3, 0.3]) { b.add(cx + tx * d, cy + ty * d - 0.22, 0.14, 0.4, 0, [0.4, 0.9, 1.4], 0.5, 1, 2); } light.emit(r.x / TS, (r.y - 0.4) / TS, 0.2, 0.4, 0.6); }
  if (r.wh < CRAWLER.wh * 0.2 && Math.sin(time * 6 + r.seed) > 0.4) b.add(cx - tx * dir * 0.4, cy - ty * dir * 0.4, 0.05, 0.05, 0, mul(C.red, 3), 1, 1, 2);
}
// a kit in flight is saved as cargo, so nothing a robot holds is lost by a reload
export function dumpRobots() { return robots.map(r => { const c = inv.load(makeInv(8), inv.dump(r.cargo)); if (r.carry) for (const k in r.carry) { if (r.carryC !== undefined && r.carryC < 0.999) inv.nextC = r.carryC; inv.add(c, k, r.carry[k]); inv.nextC = null; } return { k: r.kind === 'crawler' ? 1 : undefined, x: +r.x.toFixed(2), y: +r.y.toFixed(2), wh: +r.wh.toFixed(3), hub: r.hub && r.hub.ship ? -2 : F.machines.indexOf(r.hub), cargo: inv.dump(c).filter(Boolean), nr: r.needRescue ? 1 : undefined }; }); }
export function loadRobots(a) { robots.length = 0; for (const q of a || []) { const r = { kind: q.k ? 'crawler' : 'drone', na: 1.57, id: robots.length + 1, x: q.x, y: q.y, vx: 0, vy: 0, wh: q.wh, state: 'idle', job: null, src: null, hub: q.hub === -2 ? SHIPHUB : F.machines[q.hub] || null, cargo: makeInv(4), carry: null, t: 0, seed: robots.length * 1.7, stuck: 0, sw: 0, sv: 0 }; r.wh = Math.min(r.wh, r.kind === 'crawler' ? CRAWLER.wh : ROBOT.wh); if (q.nr) r.needRescue = true; for (const c of q.cargo) { if (!ITEMS[c[0]]) continue; if (Array.isArray(c[2])) inv.nextQ = { fe: c[2][0], cu: c[2][1], lm: c[2][2], host: c[2][3] }; else if (c[2] && c[2].c !== undefined) inv.nextC = c[2].c; inv.add(r.cargo, c[0], c[1]); inv.nextC = null; } if (q.cargo.length) r.state = 'haul'; robots.push(r); } FAILS.clear(); FAILN.clear(); REACH.clear(); MARKET.blocked = []; }

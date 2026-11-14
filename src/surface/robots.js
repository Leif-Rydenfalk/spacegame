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
import { world, TS, M, MAT, GRAV } from './world.js';
import { light } from './light.js';
import { heatAt } from './terrain.js';
import { S, C, mul } from './state.js';
import { env } from './env.js';
import { inv, makeInv } from '../items.js';
import { F, DEFS, give } from './factory.js';
import { matter } from './matter.js';
import { K, SHIP, isLinked } from './kit.js';
import { carryJobs, SUP } from './supply.js';
import { queueOrder, stepAuto, AUTO } from './auto.js';
import { ITEMS } from '../items.js';
import { BP, BUILD_T, costOf, finishGhost, dismantle, weld, foot } from './blueprint.js';
import { findPath, lineFree } from './nav.js';

export const robots = [];
export const ROBOT = { wh: 40, flyW: 70, workW: 260, chargeW: 2400, acc: 16, vmax: 8, cargo: 60 };
// the ground hauler: six legs that hold on to rock, so it walks the surface it is on, down into a cut, along a wall
// and under an overhang where no drone can drop a line. Slower, and it carries two and a half times as much.
export const CRAWLER = { wh: 90, moveW: 40, v: 2.9, cargo: 150 };
const cap = r => r.kind === 'crawler' ? CRAWLER.cargo : ROBOT.cargo, whOf = r => r.kind === 'crawler' ? CRAWLER.wh : ROBOT.wh;
// the wreck is a dock and a charger for the ship's robots, like a hub
export const SHIPHUB = { ship: true, x: SHIP.dock[0] / TS - 1, y: SHIP.dock[1] / TS - 3.4, w: 2, h: 2 };
const center = j => j.kind === 'clear' ? [(j.ref.x0 + j.ref.x1) / 2, (j.ref.y0 + j.ref.y1) / 2] : j.kind === 'build' ? [(j.ref.x + j.w / 2) * TS, (j.ref.y + 0.5) * TS] : [(j.ref.x + j.ref.w / 2) * TS, (j.ref.y + j.ref.h / 2) * TS];
// open jobs from the queue, in queue order
export function listJobs() {
  const out = [];
  // a wall is plain iron: it waits while an order ahead of it still needs its kit made, so it does not eat the iron first
  const q = queueOrder(BP.ghosts), kitAhead = q.findIndex(g => !g.have && g.kind !== 'wall' && !(g.claim && g.claim.carry) && !(AUTO.status[g.id] || '').startsWith('short:'));
  q.forEach((g, i) => { if (g.kind === 'wall' && !g.have && kitAhead >= 0 && kitAhead < i) { g.held = true; return; } g.held = false; if (!g.claim && !(g.skipT > G.time)) out.push({ kind: 'build', ref: g, cost: g.have ? null : costOf(g.kind), w: foot(g.kind).w, pri: i }); });      // the queue's order is the order of service
  for (const m of F.machines) if (m.decon && !m.claim && !(m.skipT > G.time)) out.push({ kind: 'decon', ref: m });
  for (const c of BP.clears) if (!c.claim && !(c.skipT > G.time)) out.push({ kind: 'clear', ref: c });
  for (const j of out) { const p = center(j); j.x = p[0]; j.y = p[1]; }
  return out;
}
// where material can come from: the player's suit and every chest
export function sources() { const P = S.P, out = P.dead ? [] : [{ inv: S.inv, x: P.x, y: P.y + 1, player: true }]; if (S.crash) out.push({ inv: K.hold, x: SHIP.hatch[0], y: SHIP.hatch[1] + 0.3 }); for (const m of F.machines) if (m.kind === 'chest') out.push({ inv: m.inv, x: (m.x + 1) * TS, y: (m.y + 1.4) * TS }); return out; }
// pure: give every idle robot the open job that is first in the queue (pri, when the jobs carry one) and, among
// equals, nearest, and whose material exists somewhere; a job goes to one robot only.
// Material promised to an earlier job is not promised twice. Returns [{ robot, job, src }].
export function assignJobs(bots, jobs, srcs) {
  const out = [], taken = new Set(), promised = new Map(), avail = (s, k) => inv.count(s.inv, k) - (promised.get(s.inv) && promised.get(s.inv)[k] || 0);
  // what a robot is already on its way to fetch stays promised to it: two robots never go for the same kit
  for (const r of bots) if (r.state === 'fetch' && r.src && r.job && r.job.cost) { const p = promised.get(r.src.inv) || {}; for (const k in r.job.cost) p[k] = (p[k] || 0) + r.job.cost[k]; promised.set(r.src.inv, p); }
  for (const r of bots) {
    if (r.job || r.state !== 'idle' || r.wh < ROBOT.wh * 0.2 || r.kind === 'crawler') continue;
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
// the ship AI wakes the wreck's robots when the network is up
export function wakeShipRobots(n = 2) { if (K.awake) return; K.awake = true; for (let i = 0; i < n; i++) { const r = spawnRobot(SHIPHUB); r.x += i * 0.8 - 0.4; } { const r = spawnRobot(SHIPHUB, 'crawler'); r.x += 2.6; r.y -= 1.5; } events.emit('robotsAwake'); S.say('ship ai: network up. robots released', 4); }
events.on('dronesDocked', hub => { while (hub.drones > 0) { hub.drones--; spawnRobot(hub); } audio.play('place'); });
const nv = [0, 0];
// the ground hauler's walk: along the surface it stands on, toward the target; when it makes no way it keeps one
// direction round whatever is in the way. Off the rock it falls. It has arrived when it is beside the target.
function crawl(r, tx, ty, dt, stop) {
  const dx = tx - r.x, dy = ty - r.y, d = Math.hypot(dx, dy), heavy = inv.mass(r.cargo) / CRAWLER.cargo, v = CRAWLER.v * (1 - 0.4 * Math.min(1, heavy)), near = Math.abs(dx) < stop + 0.5 && Math.abs(dy) < 3.6;
  r.wh = Math.max(0, r.wh - CRAWLER.moveW * (1 + heavy) * dt / 3600);
  if (r.gx === undefined || Math.abs(tx - r.gx) + Math.abs(ty - r.gy) > 1.5) { r.lock = 0; r.pd = undefined; r.pt = 0; r.stuck = 0; } r.gx = tx; r.gy = ty;       // a new goal: forget the way round the last obstacle
  if (world.dist(r.x, r.y) > 0.46) { r.vy -= GRAV * dt; r.y += r.vy * dt; r.x += clamp(dx, -1, 1) * 0.4 * dt; r.vx = 0; r.na = lerp(r.na, 1.57, 0.1); if (world.dist(r.x, r.y) < -0.1) { r.y += 0.3; r.vy = 0; } return near; }
  r.vy = 0; if (near) { r.vx = 0; r.stuck = 0; return true; }
  world.normal(r.x, r.y, nv); let s = nv[1] * dx - nv[0] * dy >= 0 ? 1 : -1; if (r.lock > 0) { r.lock -= dt; s = r.ls; }
  const tX = nv[1] * s, tY = -nv[0] * s; r.x += tX * v * dt; r.y += tY * v * dt; r.vx = tX * v; r.ls0 = s;
  const e = clamp(world.dist(r.x, r.y) - 0.24, -0.25, 0.25); world.normal(r.x, r.y, nv); r.x -= nv[0] * e; r.y -= nv[1] * e;
  let da = Math.atan2(nv[1], nv[0]) - r.na; while (da > Math.PI) da -= 6.2832; while (da < -Math.PI) da += 6.2832; r.na += da * Math.min(1, dt * 10); r.walk = (r.walk || 0) + v * dt;
  r.pt = (r.pt || 0) + dt; if (r.pt > 1.6) { if (r.pd !== undefined && d > r.pd - 0.5) { r.stuck += r.pt; if (!(r.lock > 0)) { r.lock = 5 + Math.random() * 3; r.ls = r.flip ? -s : s; r.flip = !r.flip; } } else r.stuck = Math.max(0, r.stuck - 1); r.pt = 0; r.pd = d; }
  return false;
}
// a drone's flight to (tx, ty): straight when the line is free, else along a path through the air (nav.js). The rock
// pushes it off before it touches, and it is never left inside. Every second and a half it checks that it got nearer;
// when it did not, it plans again, and r.stuck counts the times in a row: the job logic gives up on a target after four.
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
  const ex = gx - r.x, ey = gy - r.y, ed = Math.hypot(ex, ey) || 1, heavy = inv.mass(r.cargo) / ROBOT.cargo, want = Math.min(ROBOT.vmax * (1 - 0.45 * Math.min(1, heavy)), Math.max(d * 2.2, r.path ? 2.2 : 0)), ax = clamp((ex / ed * want - r.vx) * 6, -ROBOT.acc, ROBOT.acc), ay = clamp((ey / ed * want - r.vy) * 6, -ROBOT.acc, ROBOT.acc);
  r.vx += ax * dt; r.vy += ay * dt;
  const ds = -world.dens(r.x, r.y);
  // the rock pushes it off before it touches. On a planned path it is allowed closer (the path was checked for room),
  // so a narrow place the planner found can also be flown
  const soft = r.path ? 0.24 : 0.4, hard = r.path ? 0.09 : 0.16;
  if (ds < soft) { if (world.normal(r.x, r.y, nv) < 0.05) { nv[0] = 0; nv[1] = 1; } const k = (soft - ds) * 55; r.vx += nv[0] * k * dt; r.vy += nv[1] * k * dt; if (ds < hard) { const p = Math.min(hard - ds, 0.08); r.x += nv[0] * p; r.y += nv[1] * p; const vn = r.vx * nv[0] + r.vy * nv[1]; if (vn < 0) { r.vx -= nv[0] * vn; r.vy -= nv[1] * vn; } } }
  r.sv += ((-ax * 0.03 - r.sw) * 30 - r.sv * 2.5) * dt; r.sw += r.sv * dt;
  r.x += r.vx * dt; r.y += r.vy * dt; r.wh = Math.max(0, r.wh - ROBOT.flyW * (1 + heavy * 0.6) * dt / 3600);
  r.pt = (r.pt || 0) + dt; if (r.pt > 1.5) { if (r.pd !== undefined && d > r.pd - 0.35 && d > stop + 0.3) { r.stuck = (r.stuck || 0) + 1; r.replan = true; r.nt = 0; } else r.stuck = 0; r.pt = 0; r.pd = d; }
  r.tx = tx; r.ty = ty;
  return d < stop;
}
function drop(r, into) { for (let i = 0; i < r.cargo.slots.length; i++) { const s = r.cargo.slots[i]; if (s) { const left = inv.add(into, s.id, s.n); if (into === S.inv) S.gain(s.id, s.n - left); r.cargo.slots[i] = left > 1e-9 ? { id: s.id, n: left } : null; } } }
// what a robot still holds is put on the ground where it is, marked as set aside so it is not carried in a circle
function setDown(r) { for (let i = 0; i < r.cargo.slots.length; i++) { const s = r.cargo.slots[i]; if (s && s.n > 1e-9) { const c = matter.spawn(s.id, s.n, r.x + rand(-0.2, 0.2), r.y - (r.kind === 'crawler' ? -0.4 : 0.4), 0, 0); if (c) c.skip = G.time + 90; } r.cargo.slots[i] = null; } }
const release = r => { if (r.job && r.job.kind === 'carry') { if (r.job.src.t === 'chunk') r.job.src.c.claim = null; r.job = null; return; } if (r.job) { r.job.ref.claim = null; if (r.carry) { for (const k in r.carry) S.add(k, r.carry[k]); r.carry = null; } } r.job = null; r.src = null; };
// the job cannot be done from here (no way through, or no progress four times running): let go of it, leave its
// target alone for a while so another robot or the hauler can try, and go home
function giveUp(r) {
  const j = r.job; if (j && j.kind === 'carry' && j.src.t === 'chunk') { j.src.c.skip = G.time + 40; if (r.noWay >= 3) j.src.c.noDrone = G.time + 240; }       // no way through the air: it is the hauler's for a while else if (j && j.kind === 'build') j.ref.skipT = G.time + 25; else if (j && j.ref) j.ref.skipT = G.time + 25;
  events.emit('robotGaveUp', { id: r.id, state: r.state, job: j ? j.kind + (j.item ? ' ' + j.item : j.ref && j.ref.kind ? ' ' + j.ref.kind : '') : '', at: [+r.x.toFixed(1), +r.y.toFixed(1)], to: [+(r.tx || 0).toFixed(1), +(r.ty || 0).toFixed(1)], why: r.noWay >= 3 ? 'no way' : 'no progress' });
  release(r); r.state = inv.mass(r.cargo) > 0.01 ? 'haul' : 'idle'; r.stuck = 0; r.noWay = 0; r.gave = (r.gave || 0) + 1;
}
// one line that says what a robot is doing and for what
export function intentOf(r) {
  const j = r.job, kg = inv.mass(r.cargo), to = d => d.t === 'mach' ? d.m.kind : d.t === 'inv' ? (d.inv === K.hold ? 'hold' : 'chest') : d.t === 'dump' ? 'spoil heap' : 'you';
  if (r.recall) return 'lost its footing: jetting back to the wreck';
  if (r.lost) return 'shut in: no way out';
  if (r.state === 'charge') return 'charging';
  if (r.state === 'haul') return `unloading ${kg.toFixed(0)} kg`;
  if (!j) return r.state === 'idle' ? (r.wh < whOf(r) * 0.9 ? 'docked, charging' : 'docked') : r.state;
  if (j.kind === 'carry') return r.state === 'cfetch' ? `fetching ${j.item} for the ${to(j.dst)}` : `carrying ${kg.toFixed(0)} kg ${j.item} to the ${to(j.dst)}`;
  if (j.kind === 'build') return r.state === 'fetch' ? `fetching the ${j.ref.kind === 'wall' ? 'iron' : j.ref.kind} to build` : r.state === 'go' ? `${r.carry ? 'carrying the ' + (j.ref.kind === 'wall' ? 'iron' : j.ref.kind) : 'going'} to the site` : `building the ${j.ref.kind} ${(j.ref.prog * 100).toFixed(0)}%`;
  if (j.kind === 'decon') return `taking the ${j.ref.kind} apart`;
  return 'cutting the marked ground';
}
let assignT = 0;
export function stepRobots(dt) {
  assignT -= dt; SUP.crawlers = 0; let drones = 0; for (const r of robots) if (r.kind === 'crawler') SUP.crawlers++; else drones++; stepAuto(dt, drones);
  if (assignT <= 0 && robots.length) { assignT = 0.5; for (const a of assignJobs(robots, listJobs(), sources())) { const r = a.robot; r.job = a.job; r.src = a.src; a.job.ref.claim = r; r.state = a.src ? 'fetch' : 'go'; r.t = 0; }
    // carrying: every idle robot in the network takes the most useful open job that is nearest to it
    const busy = new Set(); for (const r of robots) if (r.job && r.job.kind === 'carry') busy.add(r.job.key);
    const idle = robots.filter(r => !r.job && r.state === 'idle' && r.wh > whOf(r) * 0.25 && inv.mass(r.cargo) < 0.01).sort((a, b) => (a.kind === 'crawler' ? 0 : 1) - (b.kind === 'crawler' ? 0 : 1));
    if (idle.length) { const jobs = carryJobs(busy); for (const r of idle) { const cr = r.kind === 'crawler'; let best = -1, bs = 1e9; for (let i = 0; i < jobs.length; i++) { const j = jobs[i]; if (j.noDrone && !cr) continue; if (cr && (j.dst.t === 'player' || (j.src.t !== 'chunk' && Math.hypot(j.x - r.x, j.y - r.y) > 30))) continue;       // what a drone found no way to is the ground hauler's; what lies under a ledge is the hauler's first; it does not chase the player
        const sc = j.pri * 40 + Math.hypot(j.x - r.x, j.y - r.y) * (cr ? 2 : 1) - (cr && j.ground ? 400 : 0) + (!cr && j.ground ? 25 : 0) - (cr && j.src.t === 'chunk' && j.n > 40 ? 60 : 0); if (sc < bs) { bs = sc; best = i; } } if (best < 0) continue; const j = jobs.splice(best, 1)[0]; r.job = j; if (j.src.t === 'chunk') j.src.c.claim = r; r.state = 'cfetch'; r.t = 0; } } }
  for (const r of robots) {
    const j = r.job, hub = (r.hub && r.hub.ship && S.crash) || F.machines.includes(r.hub) ? r.hub : (r.hub = F.machines.find(m => m.kind === 'hub') || (S.crash && K.awake ? SHIPHUB : null)), hx = hub ? (hub.x + 1) * TS : S.P.x, hy = hub ? (hub.y + 3.4) * TS + Math.sin(r.seed + r.id) * 0.3 + (r.id % 3) * 0.5 : S.P.y + 3, W = whOf(r);
    r.working = false; r.block = 0; if (r.state !== r.st0) { r.st0 = r.state; r.stT = 0; if (r.kind !== 'crawler') { r.stuck = 0; r.noWay = 0; } } r.stT = (r.stT || 0) + dt;
    // no leg of a job takes this long: whatever the reason, it is given up (the last net under the others)
    if (r.job && r.stT > (r.kind === 'crawler' ? 55 : 75) && (r.state === 'cfetch' || r.state === 'cgo' || r.state === 'fetch' || r.state === 'go')) { const cr = r.kind === 'crawler'; giveUp(r); if (cr) { setDown(r); r.state = 'idle'; r.fails = (r.fails || 0) + 1; } }
    if (j && j.kind === 'carry') { if ((j.src.t === 'chunk' && j.src.c.gone && r.state === 'cfetch') || (j.dst.t === 'mach' && !F.machines.includes(j.dst.m))) { release(r); r.state = inv.mass(r.cargo) > 0.01 ? 'haul' : 'idle'; } }
    else if (j && (j.ref.dead || (j.kind === 'build' && !BP.ghosts.includes(j.ref)) || (j.kind === 'decon' && (!F.machines.includes(j.ref) || !j.ref.decon)) || (j.kind === 'clear' && !BP.clears.includes(j.ref)))) { release(r); r.state = 'idle'; }
    if (r.kind !== 'crawler' && j && r.job && (r.stuck >= 4 || r.noWay >= 3)) giveUp(r);
    // the hauler walks round things for a long time before it gives in; then it sets its load down where it is and goes home
    if (r.kind === 'crawler' && !r.recall && r.stuck > 26) { if (r.job) giveUp(r); setDown(r); r.state = 'idle'; r.stuck = 0; r.fails = (r.fails || 0) + 2; }
    // a hauler that has failed twice running, or cannot walk home, has lost its footing somewhere (a cave, a pit): it folds
    // its legs and jets back to the wreck on its lift thrusters, the way a drone flies, and starts again from there
    if (r.kind === 'crawler' && !r.recall && (r.fails || 0) >= 2 && !r.job) { r.recall = true; r.state = 'idle'; r.fails = 0; r.path = null; r.pgx = undefined; r.gx0 = undefined; events.emit('haulerRecalled', r.id); }
    if (r.recall) { const gy = world.groundY(hx, hy, 0.5, 12); r.wh = Math.max(0, r.wh - 120 * dt / 3600); r.na = lerp(r.na, 1.57, 0.1); if (fly(r, hx + 1.5, (gy ?? hy - 3) + 0.6, dt, 0.9) || r.noWay >= 6 || !hub) { r.recall = false; r.vx = r.vy = 0; r.stuck = 0; r.noWay = 0; r.gx = undefined; } continue; }
    r.lost = r.kind !== 'crawler' && !r.job && r.noWay >= 3;      // shut in: no way home either. It waits where it is and says so
    if (r.wh < W * 0.12 && r.state !== 'charge') { release(r); r.state = 'charge'; }
    if (r.state === 'idle') { fly(r, hx + Math.cos(r.seed + r.id * 2.1) * 1.2, hy, dt, 0.3); if (hub && Math.hypot(r.x - hx, r.y - hy) < (r.kind === 'crawler' ? 5 : 2.5)) r.wh = Math.min(W, r.wh + ROBOT.chargeW * dt / 3600); if (inv.mass(r.cargo) > 0.01) r.state = 'haul'; }
    else if (r.state === 'charge') { if (fly(r, hx, hy - 1.2, dt, 0.6) || !hub) { r.wh = Math.min(W, r.wh + ROBOT.chargeW * dt / 3600 * (hub ? 1 : 0.05)); if (r.wh >= W * 0.95) r.state = 'idle'; } }
    else if (r.state === 'fetch') {
      const s = r.src; if (s.player) { s.x = S.P.x; s.y = S.P.y + 1.2; }
      if (fly(r, s.x, s.y + 0.6, dt, 0.9)) { if (inv.pay(s.inv, r.job.cost)) { r.carry = r.job.cost; r.job.ref.have = false; r.state = 'go'; audio.play('click'); } else { release(r); r.state = 'idle'; } }
    } else if (r.state === 'go') {
      const top = j.kind === 'clear' ? j.ref.y1 + 0.8 : j.y + 1.6;
      if (fly(r, j.x, top, dt, 1.0)) { r.state = 'work'; if (r.carry) { j.ref.have = true; r.carry = null; } }
    } else if (r.state === 'work') {
      r.working = true; r.wh = Math.max(0, r.wh - ROBOT.workW * dt / 3600); r.wx = j.x; r.wy = j.y;
      if (j.kind === 'build') { fly(r, j.x + Math.sin(r.t * 1.3) * 0.6, j.y + 1.6, dt, 0.2); r.t += dt; j.ref.prog += dt / BUILD_T[j.ref.kind]; weld(j.x, j.y, dt); if (j.ref.prog >= 1) { finishGhost(j.ref); r.job = null; r.state = 'idle'; events.emit('robotBuilt'); } }
      else if (j.kind === 'decon') { fly(r, j.x, j.y + 1.4, dt, 0.2); j.ref.dp = (j.ref.dp || 0) + dt / 2; weld(j.x, j.y, dt); if (j.ref.dp >= 1) { dismantle(j.ref, r.cargo); r.job = null; r.state = 'haul'; } }
      else {       // clear terrain: sweep the rectangle from the top with a cutting beam; what it cuts goes into the hold
        const c = j.ref, w = c.x1 - c.x0, cols = Math.max(1, Math.round(w / 0.4)), rows = Math.max(1, Math.round((c.y1 - c.y0) / 0.4)), n = cols * rows, i = Math.floor(c.cur), row = Math.floor(i / cols), col = row % 2 ? cols - 1 - i % cols : i % cols;
        const px = c.x0 + (col + 0.5) * w / cols, py = c.y1 - (row + 0.5) * (c.y1 - c.y0) / rows; r.wx = px; r.wy = py; fly(r, px, Math.min(c.y1 + 0.9, py + 2.2), dt, 0.3);
        const acc = {}, ch = world.shape(Math.max(c.x0, px - 0.45), Math.max(c.y0, py - 0.45), Math.min(c.x1, px + 0.45), Math.min(c.y1, py + 0.45), (x, y) => Math.max(c.x0 - x, x - c.x1, c.y0 - y, y - c.y1, Math.hypot(x - px, y - py) - 0.42), -1, 0, dt * 3.2, acc, q => q >= M.XENO);
        for (const k in acc) if (acc[k] > 0 && MAT[k].item) inv.add(r.cargo, MAT[k].item, acc[k] * MAT[k].keep);
        if (ch) { heatAt(px, py, 0.4, dt * 3); if (Math.random() < dt * 40) S.parts.spawn({ x: px, y: py, vx: rand(-4, 4), vy: rand(0, 6), life: rand(0.2, 0.6), size: 0.035, c: [5, 2.6, 0.8], c2: [0.9, 0.12, 0.02], col: 1, bounce: 0.4 }); if (Math.random() < dt * 3) env.noise(px, py, 22); } else c.cur += dt * 14;
        c.cur += dt * 1.3;
        if (c.cur >= n) { const k = BP.clears.indexOf(c); if (k >= 0) BP.clears.splice(k, 1); r.job = null; r.state = 'haul'; events.emit('robotCleared'); }
        else if (inv.mass(r.cargo) > ROBOT.cargo) { c.claim = null; r.job = null; r.state = 'haul'; }
      }
    } else if (r.state === 'cfetch') {  // carrying, first leg: to the source, and load what the net holds
      const s = j.src, ch = s.t === 'chunk'; if (ch) { s.x = s.c.x; s.y = s.c.y; }
      // a chunk is winched up on a line from wherever the robot can see it (a cut is often too narrow to fly into)
      const at = fly(r, s.x, s.y + (ch ? 1.3 : 0.25), dt, 0.8), dC = Math.hypot(s.x - r.x, s.y - r.y), see = r.kind === 'crawler' ? (ch ? dC < 1.7 : at) : ch ? dC < 3.2 && (dC < 0.8 || !world.ray(r.x, r.y - 0.15, (s.x - r.x) / dC, (s.y - r.y + 0.15) / dC, Math.max(0.05, dC - s.c.r - 0.4))) : at;
      if (!see) { r.winch = 0; if (r.kind === 'crawler' ? r.stuck > 14 : dC < 4 || r.stuck > 2) r.t += dt; if (r.t > 3.5) { r.stuck = 0; if (ch) s.c.skip = G.time + 40; release(r); r.state = 'idle'; if (r.kind === 'crawler') r.fails = (r.fails || 0) + 1; } }
      else if (ch && (r.winch = (r.winch || 0) + dt) < (r.kind === 'crawler' ? 0.5 : 0.7)) { r.wx = s.x; r.wy = s.y; }
      else { r.winch = 0;
        const room = Math.max(0, cap(r) - inv.mass(r.cargo)) / ITEMS[j.item].m, want = Math.min(j.n, room); let got = 0;
        if (s.t === 'chunk') { got = matter.take(s.c, Math.min(want, s.c.n)); s.c.claim = null; } else if (s.t === 'inv') got = inv.take(s.inv, j.item, want); else { got = Math.min(want, s.m.out[j.item] || 0); if (got > 0) { s.m.out[j.item] -= got; if (s.m.out[j.item] < 1e-9) delete s.m.out[j.item]; } }
        if (got > 1e-9) { inv.add(r.cargo, j.item, got); j.got = (j.got || 0) + got; r.state = 'cgo'; r.t = 0; r.stT = 0; audio.play('click'); events.emit('robotLoaded', j.item);
          // a robot fills up: the next piece of the same stuff close by goes on too
          if (ch && inv.mass(r.cargo) < cap(r) * 0.7) { let nb = null, nd = r.kind === 'crawler' ? 5 : 3.5; for (const c of matter.list) if (c.id === j.item && !c.claim && !c.gone && !c.dumped && c.temp < 0.7) { const d2 = Math.hypot(c.x - r.x, c.y - r.y); if (d2 < nd) { nd = d2; nb = c; } } if (nb) { nb.claim = r; j.src = { t: 'chunk', c: nb, x: nb.x, y: nb.y, n: nb.n }; j.n = nb.n; r.state = 'cfetch'; } }
        } else { r.job = null; r.state = inv.mass(r.cargo) > 0.01 ? 'cgo' : 'idle'; if (r.state === 'cgo') r.job = j; }
      }
    } else if (r.state === 'cgo') {     // second leg: to whoever asked for it, and set it down there
      const d = j.dst, P = S.P; if (d.t === 'player') { d.x = P.x; d.y = P.y + 1.3; }
      if (fly(r, d.x, d.y + (d.t === 'dump' ? 1.2 : 0.4), dt, 0.9)) {
        for (let i = 0; i < r.cargo.slots.length; i++) { const s = r.cargo.slots[i]; if (!s) continue; let left = s.n;
          if (d.t === 'mach') left = give(d.m, s.id, s.n); else if (d.t === 'inv') left = inv.add(d.inv, s.id, s.n); else if (d.t === 'player') { left = S.add(s.id, s.n); S.gain(s.id, s.n - left); }
          if (left > 1e-9) { const c = matter.spawn(s.id, left, r.x + rand(-0.2, 0.2), r.y - 0.5, rand(-0.5, 0.5), 0); if (c && d.t === 'dump') c.dumped = true; else if (c) c.skip = G.time + 90; }
          r.cargo.slots[i] = null; }
        r.fails = 0; events.emit('robotDelivered', { item: j.item, n: j.got, to: d.t }); if (d.t === 'mach') events.emit('robotFed', d.m.kind); r.job = null; r.state = 'idle'; audio.play('place');
      }
    } else if (r.state === 'haul') {    // bring the hold to the nearest chest, else to the player
      let best = null, bd = 1e9; const all = sources(), stores = all.filter(q => !q.player); for (const s of stores.length ? stores : all) { const d = Math.hypot(s.x - r.x, s.y - r.y); if (d < bd) { bd = d; best = s; } }      // to a store; into your hands only when there is no store at all
      if (!best) r.state = 'idle'; else if (fly(r, best.x, best.y + 0.7, dt, 1.0)) { drop(r, best.inv); setDown(r); r.state = 'idle'; }
    }
  }
}
export function drawRobots(b, time) {
  for (const r of robots) {
    if (r.kind === 'crawler') { drawCrawler(b, r, time); continue; }
    const tilt = clamp(-r.vx * 0.06, -0.5, 0.5), c = Math.cos(tilt), s = Math.sin(tilt), low = r.wh < ROBOT.wh * 0.2, bl = Math.sin(time * 6 + r.seed) > 0.6 ? 1 : 0.15;
    b.add(r.x, r.y, 0.34, 0.16, tilt, mul(C.hull, 0.55), 1, 2, 1, r.id); b.add(r.x, r.y - 0.07, 0.16, 0.12, tilt, C.dark, 1, 0, 1, 2);
    for (const d of [-1, 1]) { const rx = r.x + d * 0.24 * c, ry = r.y + d * 0.24 * s + 0.03; b.seg(r.x, r.y, rx, ry, 0.035, C.steel, 1, 0, 1); b.add(rx, ry + 0.03, 0.26, 0.035, tilt, [0.5, 0.6, 0.7], 0.35, 0, 2); b.add(rx, ry - 0.1, 0.16, 0.3, 0, [0.4, 0.9, 1.4], 0.35, 1, 2); }
    b.add(r.x - 0.17 * c, r.y - 0.17 * s, 0.045, 0.045, 0, mul(C.red, 3 * bl), 1, 1, 2); b.add(r.x + 0.17 * c, r.y + 0.17 * s, 0.045, 0.045, 0, mul(low ? C.amber : C.acid, 3 * (low ? bl : 1)), 1, 1, 2);
    b.add(r.x, r.y - 0.1, 0.07, 0.07, 0, mul(C.warm, 2.2), 1, 1, 2); light.emit(r.x / TS, (r.y - 0.4) / TS, 0.3, 0.27, 0.22);
    const kg = inv.mass(r.cargo);
    if (r.carry || kg > 0.01) {      // the load hangs in a net under it and swings behind the motion
      const L = 0.42 + Math.min(0.2, kg * 0.003), lx = r.x + Math.sin(r.sw) * L, ly = r.y - 0.08 - Math.cos(r.sw) * L, s0 = r.cargo.slots.find(q => q), col = s0 ? (ITEMS[s0.id].c || C.steel) : C.steel, rr = 0.14 + Math.min(0.24, Math.sqrt(kg) * 0.03);
      for (const d of [-1, 1]) b.seg(r.x + d * 0.08, r.y - 0.06, lx + d * rr * 0.7, ly + rr * 0.3, 0.014, C.steel, 1, 0, 1);
      if (r.carry || !s0 || ITEMS[s0.id].u === 'ea') b.add(lx, ly, 0.26, 0.2, r.sw, mul(C.steel, 0.9), 1, 0, 1, 7); else for (let i = 0; i < (kg > 25 ? 3 : 2); i++) b.add(lx + (i - 1) * rr * 0.6, ly - (i % 2) * rr * 0.3, rr * 1.5, rr * 1.3, r.seed + i, mul(col, 0.55 + i * 0.1), 1, 13, 1, r.seed + i * 3, 0, 0, 0.5);
      b.seg(lx - rr, ly + rr * 0.2, lx + rr, ly + rr * 0.2, 0.012, mul(C.steel, 0.7), 1, 0, 1, 0, 0, -rr * 0.9);
    }
    if (r.winch > 0 && r.state === 'cfetch') { b.seg(r.x, r.y - 0.1, r.wx, r.wy, 0.016, mul(C.steel, 1.2), 1, 0, 1); b.add(r.wx, r.wy, 0.12, 0.12, 0, mul(C.amber, 1.5), 0.8, 1, 2); }
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
export function dumpRobots() { return robots.map(r => { const c = inv.load(makeInv(8), inv.dump(r.cargo)); if (r.carry) for (const k in r.carry) inv.add(c, k, r.carry[k]); return { k: r.kind === 'crawler' ? 1 : undefined, x: +r.x.toFixed(2), y: +r.y.toFixed(2), wh: +r.wh.toFixed(3), hub: r.hub && r.hub.ship ? -2 : F.machines.indexOf(r.hub), cargo: inv.dump(c).filter(Boolean) }; }); }
export function loadRobots(a) { robots.length = 0; for (const q of a || []) { const r = { kind: q.k ? 'crawler' : 'drone', na: 1.57, id: robots.length + 1, x: q.x, y: q.y, vx: 0, vy: 0, wh: q.wh, state: 'idle', job: null, src: null, hub: q.hub === -2 ? SHIPHUB : F.machines[q.hub] || null, cargo: makeInv(4), carry: null, t: 0, seed: robots.length * 1.7, stuck: 0, sw: 0, sv: 0 }; for (const c of q.cargo) inv.add(r.cargo, c[0], c[1]); if (q.cargo.length) r.state = 'haul'; robots.push(r); } }

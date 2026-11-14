// robots: the ship's own and the ones a hub launches. Small drones with momentum, rotor glow and nav lights. They
// carry: loose matter to the hold, inputs to machines, outputs back, spoil to the heap (supply.js gives the jobs), with
// the load slung under them in a net, slower the heavier it is. They work only where the network reaches. And they build: They take jobs from the blueprint queue,
// fetch the material from the player or a chest, fly it to the site, build with a visible weld, take marked machines
// apart, and cut designated terrain. They live in a hub, which is also their charger. Charge is counted in Wh.
import { G, events, rand, clamp } from '../core.js';
import { audio } from '../audio.js';
import { world, TS, M, MAT } from './world.js';
import { light } from './light.js';
import { heatAt } from './terrain.js';
import { S, C, mul } from './state.js';
import { env } from './env.js';
import { inv, makeInv } from '../items.js';
import { F, DEFS, give } from './factory.js';
import { matter } from './matter.js';
import { K, SHIP, isLinked } from './kit.js';
import { carryJobs } from './supply.js';
import { ITEMS } from '../items.js';
import { BP, BUILD_T, costOf, finishGhost, dismantle, weld } from './blueprint.js';

export const robots = [];
export const ROBOT = { wh: 40, flyW: 70, workW: 260, chargeW: 2400, acc: 16, vmax: 8, cargo: 60 };
// the wreck is a dock and a charger for the ship's robots, like a hub
export const SHIPHUB = { ship: true, x: SHIP.dock[0] / TS - 1, y: SHIP.dock[1] / TS - 3.4, w: 2, h: 2 };
const center = j => j.kind === 'clear' ? [(j.ref.x0 + j.ref.x1) / 2, (j.ref.y0 + j.ref.y1) / 2] : j.kind === 'build' ? [(j.ref.x + (j.ref.kind === 'wall' ? 0.5 : j.w / 2)) * TS, (j.ref.y + 0.5) * TS] : [(j.ref.x + j.ref.w / 2) * TS, (j.ref.y + j.ref.h / 2) * TS];
// open jobs from the queue, in queue order
export function listJobs() {
  const out = [];
  for (const g of BP.ghosts) if (!g.claim) out.push({ kind: 'build', ref: g, cost: g.have ? null : costOf(g.kind), w: g.kind === 'wall' ? 1 : DEFS[g.kind].w });
  for (const m of F.machines) if (m.decon && !m.claim) out.push({ kind: 'decon', ref: m });
  for (const c of BP.clears) if (!c.claim) out.push({ kind: 'clear', ref: c });
  for (const j of out) { const p = center(j); j.x = p[0]; j.y = p[1]; }
  return out;
}
// where material can come from: the player's suit and every chest
export function sources() { const P = S.P, out = P.dead ? [] : [{ inv: S.inv, x: P.x, y: P.y + 1, player: true }]; if (S.crash) out.push({ inv: K.hold, x: SHIP.hatch[0], y: SHIP.hatch[1] + 0.3 }); for (const m of F.machines) if (m.kind === 'chest') out.push({ inv: m.inv, x: (m.x + 1) * TS, y: (m.y + 1.4) * TS }); return out; }
// pure: give every idle robot the nearest open job whose material exists somewhere; a job goes to one robot only.
// Material promised to an earlier job is not promised twice. Returns [{ robot, job, src }].
export function assignJobs(bots, jobs, srcs) {
  const out = [], taken = new Set(), promised = new Map(), avail = (s, k) => inv.count(s.inv, k) - (promised.get(s) && promised.get(s)[k] || 0);
  for (const r of bots) {
    if (r.job || r.state !== 'idle' || r.wh < ROBOT.wh * 0.2) continue;
    let best = null, bs = null, bd = 1e9;
    for (const j of jobs) {
      if (taken.has(j)) continue; let src = null;
      if (j.cost) { let sd = 1e9; for (const s of srcs) { let ok = true; for (const k in j.cost) if (avail(s, k) < j.cost[k] - 1e-9) ok = false; const d = Math.hypot(s.x - r.x, s.y - r.y) + Math.hypot(s.x - j.x, s.y - j.y); if (ok && d < sd) { sd = d; src = s; } } if (!src) continue; }
      const d = Math.hypot(j.x - r.x, j.y - r.y); if (d < bd) { bd = d; best = j; bs = src; }
    }
    if (best) { taken.add(best); if (bs) { const p = promised.get(bs) || {}; for (const k in best.cost) p[k] = (p[k] || 0) + best.cost[k]; promised.set(bs, p); } out.push({ robot: r, job: best, src: bs }); }
  }
  return out;
}
export function spawnRobot(hub) { const r = { id: robots.length + 1, x: (hub.x + 1) * TS, y: (hub.y + 3) * TS, vx: rand(-1, 1), vy: 2, wh: ROBOT.wh, state: 'idle', job: null, src: null, hub, cargo: makeInv(4), carry: null, t: 0, seed: Math.random() * 100, stuck: 0, tx: 0, ty: 0, sw: 0, sv: 0 }; robots.push(r); events.emit('firstRobot'); return r; }
// the ship AI wakes the wreck's robots when the network is up
export function wakeShipRobots(n = 2) { if (K.awake) return; K.awake = true; for (let i = 0; i < n; i++) { const r = spawnRobot(SHIPHUB); r.x += i * 0.8 - 0.4; } events.emit('robotsAwake'); S.say('ship ai: network up. robots released', 4); }
events.on('dronesDocked', hub => { while (hub.drones > 0) { hub.drones--; spawnRobot(hub); } audio.play('place'); });
const nv = [0, 0];
function fly(r, tx, ty, dt, stop = 0.5) {
  // go over the ground when the straight line is blocked
  let gx = tx, gy = ty; const dx = tx - r.x, dy = ty - r.y, d = Math.hypot(dx, dy);
  if (d > 2 && r.stuck < 5) { const hit = world.ray(r.x, r.y, dx / d, dy / d, Math.min(d, 9)); if (hit && hit.d < d - 0.8) { gy = Math.max(r.y, ty) + 5; gx = r.x + Math.sign(dx) * Math.min(Math.abs(dx), 3); r.block = 1; } }
  const ex = gx - r.x, ey = gy - r.y, ed = Math.hypot(ex, ey) || 1, heavy = inv.mass(r.cargo) / ROBOT.cargo, want = Math.min(ROBOT.vmax * (1 - 0.45 * Math.min(1, heavy)), ed * 2.2), ax = clamp((ex / ed * want - r.vx) * 6, -ROBOT.acc, ROBOT.acc), ay = clamp((ey / ed * want - r.vy) * 6, -ROBOT.acc, ROBOT.acc);
  r.vx += ax * dt; r.vy += ay * dt;
  const ds = world.dist(r.x, r.y);
  if (r.stuck < 5) { if (ds < 0.7) { world.normal(r.x, r.y, nv); const k = (0.7 - ds) * 40; r.vx += nv[0] * k * dt; r.vy += nv[1] * k * dt; if (ds < 0.25) { r.x += nv[0] * (0.25 - ds); r.y += nv[1] * (0.25 - ds); const vn = r.vx * nv[0] + r.vy * nv[1]; if (vn < 0) { r.vx -= nv[0] * vn; r.vy -= nv[1] * vn; } } } }
  r.sv += ((-ax * 0.03 - r.sw) * 30 - r.sv * 2.5) * dt; r.sw += r.sv * dt;
  r.x += r.vx * dt; r.y += r.vy * dt; r.wh = Math.max(0, r.wh - ROBOT.flyW * (1 + heavy * 0.6) * dt / 3600);
  r.stuck = d > stop + 0.5 && Math.hypot(r.vx, r.vy) < 0.6 ? r.stuck + dt : d < stop + 0.5 ? 0 : Math.max(0, r.stuck - dt * 0.2);
  return d < stop;
}
function drop(r, into) { for (let i = 0; i < r.cargo.slots.length; i++) { const s = r.cargo.slots[i]; if (s) { const left = inv.add(into, s.id, s.n); if (into === S.inv) S.gain(s.id, s.n - left); r.cargo.slots[i] = left > 1e-9 ? { id: s.id, n: left } : null; } } }
const release = r => { if (r.job && r.job.kind === 'carry') { if (r.job.src.t === 'chunk') r.job.src.c.claim = null; r.job = null; return; } if (r.job) { r.job.ref.claim = null; if (r.carry) { for (const k in r.carry) S.add(k, r.carry[k]); r.carry = null; } } r.job = null; r.src = null; };
let assignT = 0;
export function stepRobots(dt) {
  assignT -= dt;
  if (assignT <= 0 && robots.length) { assignT = 0.5; for (const a of assignJobs(robots, listJobs(), sources())) { const r = a.robot; r.job = a.job; r.src = a.src; a.job.ref.claim = r; r.state = a.src ? 'fetch' : 'go'; r.t = 0; }
    // carrying: every idle robot in the network takes the most useful open job that is nearest to it
    const busy = new Set(); for (const r of robots) if (r.job && r.job.kind === 'carry') busy.add(r.job.key);
    const idle = robots.filter(r => !r.job && r.state === 'idle' && r.wh > ROBOT.wh * 0.25 && inv.mass(r.cargo) < 0.01);
    if (idle.length) { const jobs = carryJobs(busy); for (const r of idle) { let best = -1, bs = 1e9; for (let i = 0; i < jobs.length; i++) { const j = jobs[i], sc = j.pri * 40 + Math.hypot(j.x - r.x, j.y - r.y); if (sc < bs) { bs = sc; best = i; } } if (best < 0) break; const j = jobs.splice(best, 1)[0]; r.job = j; if (j.src.t === 'chunk') j.src.c.claim = r; r.state = 'cfetch'; r.t = 0; } } }
  for (const r of robots) {
    const j = r.job, hub = (r.hub && r.hub.ship && S.crash) || F.machines.includes(r.hub) ? r.hub : (r.hub = F.machines.find(m => m.kind === 'hub') || (S.crash && K.awake ? SHIPHUB : null)), hx = hub ? (hub.x + 1) * TS : S.P.x, hy = hub ? (hub.y + 3.4) * TS + Math.sin(r.seed + r.id) * 0.3 + (r.id % 3) * 0.5 : S.P.y + 3;
    r.working = false; r.block = 0;
    if (j && j.kind === 'carry') { if ((j.src.t === 'chunk' && j.src.c.gone && r.state === 'cfetch') || (j.dst.t === 'mach' && !F.machines.includes(j.dst.m))) { release(r); r.state = inv.mass(r.cargo) > 0.01 ? 'haul' : 'idle'; } }
    else if (j && (j.ref.dead || (j.kind === 'build' && !BP.ghosts.includes(j.ref)) || (j.kind === 'decon' && (!F.machines.includes(j.ref) || !j.ref.decon)) || (j.kind === 'clear' && !BP.clears.includes(j.ref)))) { release(r); r.state = 'idle'; }
    if (r.wh < ROBOT.wh * 0.12 && r.state !== 'charge') { release(r); r.state = 'charge'; }
    if (r.state === 'idle') { fly(r, hx + Math.cos(r.seed + r.id * 2.1) * 1.2, hy, dt, 0.3); if (hub && Math.hypot(r.x - hx, r.y - hy) < 2.5) r.wh = Math.min(ROBOT.wh, r.wh + ROBOT.chargeW * dt / 3600); if (inv.mass(r.cargo) > 0.01) r.state = 'haul'; }
    else if (r.state === 'charge') { if (fly(r, hx, hy - 1.2, dt, 0.6) || !hub) { r.wh = Math.min(ROBOT.wh, r.wh + ROBOT.chargeW * dt / 3600 * (hub ? 1 : 0.05)); if (r.wh >= ROBOT.wh * 0.95) r.state = 'idle'; } }
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
      const at = fly(r, s.x, s.y + (ch ? 1.3 : 0.25), dt, 0.8), dC = Math.hypot(s.x - r.x, s.y - r.y), see = ch ? dC < 3.2 && (dC < 0.8 || !world.ray(r.x, r.y - 0.15, (s.x - r.x) / dC, (s.y - r.y + 0.15) / dC, Math.max(0.05, dC - s.c.r - 0.4))) : at;
      if (!see) { r.winch = 0; if (dC < 4 || r.stuck > 2) r.t += dt; if (r.t > 3.5) { if (ch) s.c.skip = G.time + 40; release(r); r.state = 'idle'; } }
      else if (ch && (r.winch = (r.winch || 0) + dt) < 0.7) { r.wx = s.x; r.wy = s.y; }
      else { r.winch = 0;
        const room = ROBOT.cargo / ITEMS[j.item].m, want = Math.min(j.n, room); let got = 0;
        if (s.t === 'chunk') { got = matter.take(s.c, Math.min(want, s.c.n)); s.c.claim = null; } else if (s.t === 'inv') got = inv.take(s.inv, j.item, want); else { got = Math.min(want, s.m.out[j.item] || 0); if (got > 0) { s.m.out[j.item] -= got; if (s.m.out[j.item] < 1e-9) delete s.m.out[j.item]; } }
        if (got > 1e-9) { inv.add(r.cargo, j.item, got); j.got = got; r.state = 'cgo'; r.t = 0; audio.play('click'); events.emit('robotLoaded', j.item); } else { r.job = null; r.state = 'idle'; }
      }
    } else if (r.state === 'cgo') {     // second leg: to whoever asked for it, and set it down there
      const d = j.dst, P = S.P; if (d.t === 'player') { d.x = P.x; d.y = P.y + 1.3; }
      if (fly(r, d.x, d.y + (d.t === 'dump' ? 1.2 : 0.4), dt, 0.9)) {
        for (let i = 0; i < r.cargo.slots.length; i++) { const s = r.cargo.slots[i]; if (!s) continue; let left = s.n;
          if (d.t === 'mach') left = give(d.m, s.id, s.n); else if (d.t === 'inv') left = inv.add(d.inv, s.id, s.n); else if (d.t === 'player') { left = S.add(s.id, s.n); S.gain(s.id, s.n - left); }
          if (left > 1e-9) { const c = matter.spawn(s.id, left, r.x + rand(-0.2, 0.2), r.y - 0.5, rand(-0.5, 0.5), 0); if (c && d.t === 'dump') c.dumped = true; }
          r.cargo.slots[i] = null; }
        events.emit('robotDelivered', { item: j.item, n: j.got, to: d.t }); if (d.t === 'mach') events.emit('robotFed', d.m.kind); r.job = null; r.state = 'idle'; audio.play('place');
      }
    } else if (r.state === 'haul') {    // bring the hold to the nearest chest, else to the player
      let best = null, bd = 1e9; for (const s of sources()) { const d = Math.hypot(s.x - r.x, s.y - r.y) * (s.player ? 3 : 1); if (d < bd) { bd = d; best = s; } }
      if (!best) r.state = 'idle'; else if (fly(r, best.x, best.y + 0.7, dt, 1.0)) { drop(r, best.inv); r.cargo.slots.fill(null); r.state = 'idle'; }
    }
  }
}
export function drawRobots(b, time) {
  for (const r of robots) {
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
    if (r.working) { const fl = 0.7 + 0.3 * Math.sin(time * 60 + r.seed); b.seg(r.x, r.y - 0.1, r.wx, r.wy, 0.03, [1.2, 3, 4], fl, 2, 2); b.seg(r.x, r.y - 0.1, r.wx, r.wy, 0.14, [0.1, 0.5, 0.7], 0.35, 2, 2); b.add(r.wx, r.wy, 0.6, 0.6, 0, [1, 2.4, 3], fl, 1, 2); light.emit(r.wx / TS, r.wy / TS, 0.3, 0.8, 1.0); }
  }
}
// a kit in flight is saved as cargo, so nothing a robot holds is lost by a reload
export function dumpRobots() { return robots.map(r => { const c = inv.load(makeInv(8), inv.dump(r.cargo)); if (r.carry) for (const k in r.carry) inv.add(c, k, r.carry[k]); return { x: +r.x.toFixed(2), y: +r.y.toFixed(2), wh: +r.wh.toFixed(3), hub: r.hub && r.hub.ship ? -2 : F.machines.indexOf(r.hub), cargo: inv.dump(c).filter(Boolean) }; }); }
export function loadRobots(a) { robots.length = 0; for (const q of a || []) { const r = { id: robots.length + 1, x: q.x, y: q.y, vx: 0, vy: 0, wh: q.wh, state: 'idle', job: null, src: null, hub: q.hub === -2 ? SHIPHUB : F.machines[q.hub] || null, cargo: makeInv(4), carry: null, t: 0, seed: robots.length * 1.7, stuck: 0, sw: 0, sv: 0 }; for (const c of q.cargo) inv.add(r.cargo, c[0], c[1]); if (q.cargo.length) r.state = 'haul'; robots.push(r); } }

// the starting kit, and the systems it stands on. There is no rifle and no shotgun: there is the wreck, and what can be
// pulled out of it. The ship's weapon comes off its hardpoint as a handheld laser (it melts ore and it is the only
// weapon); it needs the ship's reactor, which comes out of its bay and is carried on the back, 140 kg of it, or set
// down and reached by cable. The laser can stand on its own legs as a turret and take orders from a computer over the
// network: the AI by default, as far as an antenna reaches. Every watt and every link here is counted (power.js).
import { G, input, events, rand, clamp, lerp, angDiff, hash } from '../core.js';
import { audio } from '../audio.js';
import { inv, makeInv, mixQ } from '../items.js';
import { world, TS, GRAV, M, MAT, SLAB } from './world.js';
import { light } from './light.js';
import { heat } from './heat.js';
import { S, C, mul } from './state.js';
import { env } from './env.js';
import { creatures, hurtPulse, KIND } from './creatures.js';
import { floraHit, floraBlast } from './flora.js';
import { matter } from './matter.js';
import { F } from './factory.js';
import { powerBudget, linked, REACTOR_W, LASER_W, REACTOR_BACK, SUIT_BUS_W, CHARGE_W, CABLE, MIN_FRAC, REACTOR_KG, LASER_KG, ANT_RANGE, SHIP_LINK, TURRET_RANGE } from './power.js';
import { LASERP, SINK_J, PULSE_BEAM_J, PULSE_HEAT_J, PULSE_IN_J, coolSink, pulseArea, ROCKP } from './physics.js';
import { kerfPulse, rockLumps } from './mine.js';
import { EXO, BOOT, suitStats } from './suit.js';
import { WRECK, drawInterior, drawSkin } from './wreck.js';

export const SHIP = { x: -9, y: 0.25, bay: [-9.5, 1.0], mount: [-6.6, 1.95], hatch: [-11.6, 0.9], mast: [-12.2, 3.9], dock: [-8.6, 2.5] };
export const LASER = { range: 12, r: 0.3, len: 1.3 };
// keep = the fraction of what the beam cuts that is left as loose rock; the rest is vapour and smoke
export const KEEP = { [M.SOIL]: 0.75, [M.BASALT]: 0.8, [M.OBSIDIAN]: 0.8, [M.IRON]: 1, [M.COPPER]: 1, [M.LUMEN]: 1, [M.PLATE]: 0.9, [M.HIVE]: 0.6, [M.XENO]: 0.3, [M.CONCRETE]: 0.6, [M.STEEL]: 0.6 };
export const K = {
  reactor: { state: 'carried', x: 0, y: 0, vy: 0, load: 0 },                 // 'ship' | 'carried' | 'ground'
  // sinkJ = heat in the laser's own sink; optics 1..0 = what overheating has left of them; mode 'spall' | 'kerf'
  laser: { state: 'held', x: 0, y: 0, ang: 0, heat: 0, vent: 0, beam: null, link: null, frac: 0, firing: false, target: null, scan: 0, sinkJ: 0, optics: 1, mode: 'spall', pulseT: 0, pulses: 0, debt: 0, loop: false, over: false, flashT: 0 },   // 'ship' | 'held' | 'turret'
  hold: makeInv(24), pw: { supply: 0, demand: 0, used: 0, served: {} }, net: { player: null, antennas: [] }, pend: {}, pendQ: {}, cable: [], cable2: [], awake: false, hint: '',
};
K.hold.title = 'ship hold';
const nv = [0, 0];
const HOLDWIN = { kind: 'hold', title: 'ship hold', inv: K.hold };      // the hold as a window: the same grid as a chest
export const hasLaser = () => K.laser.state === 'held', hasReactor = () => K.reactor.state === 'carried';
export const kitKg = () => (hasReactor() ? REACTOR_KG : 0) + (hasLaser() ? LASER_KG : 0);
// where the reactor is, and where its cable port is
export function reactorPos() { const P = S.P, r = K.reactor; return r.state === 'ship' ? [SHIP.bay[0], SHIP.bay[1]] : r.state === 'carried' ? [P.x - P.face * 0.3, P.y + 1.15] : [r.x, r.y + 0.4]; }
export function laserPos() { const P = S.P, l = K.laser; return l.state === 'ship' ? [SHIP.mount[0], SHIP.mount[1]] : l.state === 'held' ? [P.x, P.y + 1.3] : [l.x, l.y + 0.95]; }
// the ship's own mast reaches a long way once the AI is up on the wreck's core (the suit's interface brought it up)
export function antennas() { const out = [{ x: SHIP.mast[0], y: SHIP.mast[1], range: S.crash && BOOT.done ? SHIP_LINK : 0, ship: true }]; for (const m of F.machines) { if (m.kind === 'antenna') out.push({ x: (m.x + 0.5) * TS, y: (m.y + 4) * TS, range: ANT_RANGE }); else if (m.kind === 'hub') out.push({ x: (m.x + 1) * TS, y: (m.y + 3) * TS, range: 45 }); } return out; }
const blocked = (ax, ay, bx, by) => { const d = Math.hypot(bx - ax, by - ay); if (d < 0.5) return false; const h = world.ray(ax, ay, (bx - ax) / d, (by - ay) / d, d - 0.6); return !!h; };
export const isLinked = (x, y) => linked(x, y, K.net.antennas, blocked);
export function kitReset(mode) {            // mode: 'wreck' = everything still in the ship, 'carried' = on you
  const w = mode === 'wreck'; K.reactor.state = w ? 'ship' : 'carried'; K.laser.state = w ? 'ship' : 'held'; K.laser.heat = K.laser.vent = 0; K.laser.beam = null; K.laser.sinkJ = 0; K.laser.optics = 1; K.laser.mode = 'spall'; K.laser.debt = 0; K.laser.pulses = 0; K.pendQ = {}; K.pend = {}; K.cable.length = 0; K.cable2.length = 0; K.awake = false; K.hold.slots.fill(null);
}
// a timed action: the body is busy, a hand reaches for (x, y), and when the time is up it happens
function act(kind, T, x, y, done) { S.P.act = { kind, t: 0, T, x, y, done }; audio.play('click'); }
// F at the wreck or at a piece of the kit. Returns true when something was done.
export function kitUse() {
  const P = S.P; if (P.act) return true; const near = (q, r = 2.2) => Math.hypot(q[0] - P.x, q[1] - P.y - 0.9) < r;
  if (S.crash && !WRECK.inside && K.laser.state === 'ship' && near(SHIP.mount, 2.6)) { if (!EXO.on) { S.say(`the ship laser is ${LASER_KG} kg on a hardpoint over your head: not without the exosuit`, 3); return true; } act('unbolt the ship laser', 1.8, SHIP.mount[0], SHIP.mount[1], () => { K.laser.state = 'held'; events.emit('laserTaken'); audio.play('place'); }); return true; }
  if (S.crash && K.reactor.state === 'ship' && near(SHIP.bay)) { if (!EXO.on) { S.say(`the reactor is ${REACTOR_KG} kg: nobody lifts that without the exosuit`, 3); return true; } act('pull the reactor', 2.6, SHIP.bay[0], SHIP.bay[1], () => { K.reactor.state = 'carried'; events.emit('reactorPulled'); audio.play('groan'); G.shake += 0.1; }); return true; }
  if (S.crash && !WRECK.inside && near(SHIP.hatch, 2)) { S.open = HOLDWIN; S.uiOpen = true; return true; }
  return false;
}
export function kitHint() {
  const P = S.P, near = (q, r = 2.2) => Math.hypot(q[0] - P.x, q[1] - P.y - 0.9) < r, l = K.laser, r = K.reactor;
  if (P.act) return `${P.act.kind}  ${(P.act.t / P.act.T * 100).toFixed(0)}%`;
  if (S.crash && !WRECK.inside && l.state === 'ship' && near(SHIP.mount, 2.6)) return EXO.on ? 'f  unbolt the ship laser from its hardpoint' : `the ship laser (${LASER_KG} kg): needs the exosuit`;
  if (S.crash && r.state === 'ship' && near(SHIP.bay)) return EXO.on ? `f  pull the reactor out of its bay (${REACTOR_KG} kg)` : `the reactor: ${REACTOR_KG} kg. you cannot move it without the exosuit`;
  if (S.crash && !WRECK.inside && near(SHIP.hatch, 2)) return 'f  open the hold';
  if (r.state === 'ground' && Math.hypot(r.x - P.x, r.y - P.y) < 1.8) return 'x  lift the reactor';
  if (l.state === 'turret' && Math.hypot(l.x - P.x, l.y - P.y) < 1.8) return 'g  take the laser off its legs';
  return '';
}
// X sets the reactor down or lifts it; G stands the laser on its legs or takes it back
function keys() {
  const P = S.P, l = K.laser, r = K.reactor; if (P.act || P.dead || S.uiOpen) return;
  if (input.hit('k') && l.state !== 'ship') { l.mode = l.mode === 'kerf' ? 'spall' : 'kerf'; S.say(l.mode === 'kerf' ? 'laser: kerf. a slot two centimetres wide along the beam; what it cuts loose falls out as blocks' : 'laser: spall. pulses chip the face away', 3); audio.play('click'); }
  if (input.hit('x')) {
    if (r.state === 'carried') act('set the reactor down', 0.9, P.x + P.face * 0.6, P.y + 0.3, () => { r.state = 'ground'; r.x = P.x + P.face * 0.75; r.y = P.y + 0.4; r.vy = 0; events.emit('reactorDown'); audio.play('thud'); });
    else if (r.state === 'ground' && Math.hypot(r.x - P.x, r.y - P.y) < 1.8) act('lift the reactor', 1.6, r.x, r.y + 0.5, () => { r.state = 'carried'; audio.play('groan'); });
    else if (r.state === 'ground') S.say('the reactor is ' + Math.hypot(r.x - P.x, r.y - P.y).toFixed(0) + ' m away', 2);
  }
  if (input.hit('g') && l.optics < 0.6 && l.state === 'held' && S.count('part') >= 1 && !input.key('Shift')) { act('refit the laser optics', 6, P.x + P.face * 0.5, P.y + 1.2, () => { if (S.pay({ part: 1 })) { l.optics = 1; l.wrecked = false; events.emit('laserRepaired'); audio.play('place'); } }); return; }
  if (input.hit('g')) {
    if (l.state === 'held' && P.ground) act('stand the laser on its legs', 1.1, P.x + P.face * 0.9, P.y + 0.6, () => { l.state = 'turret'; l.x = P.x + P.face * 1.0; l.y = world.groundY(l.x, P.y + 1, 0.6, 4) ?? P.y; l.ang = P.face > 0 ? 0.1 : Math.PI - 0.1; l.target = null; K.cable2.length = 0; events.emit('turretDeployed'); audio.play('place'); });
    else if (l.state === 'turret' && Math.hypot(l.x - P.x, l.y - P.y) < 1.8) act('take the laser', 1.0, l.x, l.y + 0.9, () => { l.state = 'held'; l.beam = null; audio.play('place'); });
  }
}
// one pulse, for the hand and for the turret: 30 kJ of beam in 50 ms, 45 kJ of heat left in the sink (physics.js).
// frac = the share of its power it got; own = the hand fired it. What it does to rock is set by energy: in spall mode
// it chips the face (so many cm2 per pulse for this rock); in kerf mode it drives a 2 cm slot along the ray and
// whatever the slots cut loose falls out as blocks (mine.js). What it does to a body is ablation (creatures.js).
export function firePulse(mx, my, ang, frac, own) {
  const l = K.laser, dx = Math.cos(ang), dy = Math.sin(ang);
  if (frac < MIN_FRAC) {                     // starved: a thread of light that cuts nothing
    const len = 0.6 + Math.random() * 0.5; l.beam = { x1: mx, y1: my, x2: mx + dx * len, y2: my + dy * len, hit: false, weak: true, ang, life: 0.08 }; for (let i = 0; i < 2; i++) S.parts.spawn({ x: mx, y: my, vx: dx * rand(1, 4) + rand(-1, 1), vy: dy * rand(1, 4) + rand(-1, 1), life: rand(0.1, 0.3), size: 0.03, c: [3, 1.2, 0.3], grav: 0.3 }); return l.beam;
  }
  const hit = world.ray(mx, my, dx, dy, LASER.range); let len = hit ? hit.d : LASER.range, E = PULSE_BEAM_J * l.optics, stopped = false;
  l.sinkJ += PULSE_HEAT_J; l.pulses++; S.stats.shots = (S.stats.shots || 0) + 1; l.flashT = 0.09;
  const burnt = new Set();                    // the pulse drills each body it crosses once; a small one does not stop it
  for (let t = 0.25; t < len && !stopped; t += 0.12) { const px = mx + dx * t, py = my + dy * t; if ((Math.round(t * 100) % 36) === 1) floraHit(px, py, 0.9, 0.2); for (const c of creatures) { if (burnt.has(c)) continue; const r = hurtPulse(c, px, py, E, dx, dy); if (r) { burnt.add(c); E -= r.used; if (E < PULSE_BEAM_J * 0.12) { len = t; stopped = true; break; } } } }
  const ex = mx + dx * len, ey = my + dy * len;
  l.beam = { x1: mx, y1: my, x2: ex, y2: ey, hit: !!hit && !stopped, ang, life: 0.085 };
  env.noise(ex, ey, 30, own); G.shake = Math.max(G.shake, 0.03); S.glare = 1; S.scare = Math.max(S.scare || 0, 0.9);
  for (let t = 0; t < len; t += 2.5) light.emit((mx + dx * t) / TS, (my + dy * t) / TS, 1.0, 0.4, 0.09);
  if (!hit || stopped) return l.beam;
  const k0 = hit.mat, share = E / PULSE_BEAM_J; world.normal(ex, ey, nv); const nx = nv[0] - dx * 0.5, ny = nv[1] - dy * 0.5; let total = 0;
  if (l.mode === 'kerf' && ROCKP[k0] && !ROCKP[k0].steam && k0 !== M.HIVE) { const r = kerfPulse(ex, ey, dx, dy, k0, share); l.kerf = r.k; total = r.freed; if (r.freed > 0) S.stats.dug += r.freed; heat.add(ex + dx * r.k.len, ey + dy * r.k.len, 0.3, 0.2); }
  else {
    // spall: the pulse owes the face an area; the field is coarse, so the debt is paid as the samples allow and what
    // was really removed is taken off it. Over time the rate is the energy's, to the gram.
    l.debt = Math.min(l.debt + pulseArea(k0, share), 0.4); const acc = {}; if (l.debt > 0) { world.rawRate = true; world.dig(ex + dx * 0.12, ey + dy * 0.12, LASER.r, Math.max(0.004, l.debt / (LASER.r * 0.9)), acc); world.rawRate = false; }
    for (const k in acc) {                     // what the pulse broke off: chips at the face, the fines as dust
      const kg = acc[k]; if (kg <= 0) continue; const m = MAT[k], keep = kg * (KEEP[k] ?? 0.7); total += kg; l.debt -= kg / (m.rho * SLAB); S.stats.vapor += kg - keep; if (!m.item) { S.stats.vapor += keep; continue; }
      for (const [id, n, q] of rockLumps(+k, keep, ex, ey)) { K.pend[id] = (K.pend[id] || 0) + n; if (q) K.pendQ[id] = mixQ(K.pendQ[id], K.pend[id] - n, q, n); }
    }
    const size = K.pendSize || (K.pendSize = rand(1.2, 4.5));
    for (const id in K.pend) if (K.pend[id] >= size) { if (K.pendQ[id]) inv.nextQ = K.pendQ[id]; matter.spawn(id, K.pend[id], ex + nv[0] * 0.3 + rand(-0.15, 0.15), ey + nv[1] * 0.3 + rand(-0.1, 0.15), nx * rand(1.5, 5) + rand(-1.5, 1.5), ny * rand(1.5, 5) + rand(0.5, 3), 0.9); K.pend[id] = 0; delete K.pendQ[id]; K.pendSize = 0; }
    S.stats.dug += total; heat.add(ex + dx * 0.25, ey + dy * 0.25, 0.7, 0.35);
  }
  env.pollute(ex, ey, total * 0.002); light.emit(ex / TS, ey / TS, 4.2, 1.9, 0.55); floraBlast(ex, ey, 2.6, 4);
  const rc = k0 === M.SOIL ? [0.14, 0.1, 0.09] : k0 === M.HIVE ? [0.2, 0.06, 0.08] : [0.11, 0.12, 0.14];
  for (let i = 0; i < 14; i++) S.parts.spawn({ x: ex, y: ey, vx: nx * rand(2, 14) + rand(-5, 5), vy: ny * rand(2, 14) + rand(-3, 8), life: rand(0.15, 0.9), size: rand(0.022, 0.055), c: [5, 2.6, 0.8], c2: [0.9, 0.12, 0.02], col: 1, bounce: 0.5 });
  for (let i = 0; i < 3; i++) S.parts.spawn({ x: ex, y: ey, vx: nx * rand(2, 8) + rand(-2, 2), vy: ny * rand(2, 8) + rand(0, 4), life: rand(0.8, 2.2), size: rand(0.04, 0.1), asp: rand(0.6, 1.6), c: rc, mode: 1, shape: 13, col: 1, bounce: 0.35, spin: rand(-14, 14), fade: 0 });      // grit
  if (Math.random() < 0.6) S.parts.spawn({ x: ex + rand(-0.25, 0.25), y: ey + rand(-0.2, 0.25), vx: nx * rand(0.3, 1.6) + rand(-0.5, 0.5), vy: rand(0.6, 2.1), life: rand(1.6, 4.2), size: rand(0.3, 0.6), grow: 3.2, c: [0.12, 0.11, 0.11], mode: 1, a: 0.34, grav: -0.035, drag: 0.8 });      // dust and smoke
  return l.beam;
}
// the old name, for the tests that fire for a stretch of time: as many pulses as fit in dt at the laser's rate
export function fireBeam(mx, my, ang, dt, frac, own) { const l = K.laser; l.pulseT -= dt; let b = l.beam; while (l.pulseT <= 0) { l.pulseT += 1 / LASERP.hz; b = firePulse(mx, my, ang, frac, own); } return b; }
// flush what is still pending in the cut as crumbs, so no gram is held back when the beam stops
export function flushPend(x, y) { for (const id in K.pend) if (K.pend[id] > 1e-6) { if (K.pendQ[id]) inv.nextQ = K.pendQ[id]; delete K.pendQ[id]; matter.spawn(id, K.pend[id], x + rand(-0.2, 0.2), y + rand(0, 0.2), rand(-1, 1), rand(0.5, 2), 1); K.pend[id] = 0; } K.pendSize = 0; }
// a hanging cable between two points: a verlet chain that sags, swings and lies on the ground
function rope(nodes, ax, ay, bx, by, n, slack, dt) {
  if (nodes.length !== n) { nodes.length = 0; for (let i = 0; i < n; i++) { const t = i / (n - 1); nodes.push({ x: lerp(ax, bx, t), y: lerp(ay, by, t), px: lerp(ax, bx, t), py: lerp(ay, by, t) }); } }
  const L = Math.max(0.2, Math.hypot(bx - ax, by - ay) * slack) / (n - 1);
  for (let i = 1; i < n - 1; i++) { const p = nodes[i], vx = (p.x - p.px) * 0.985, vy = (p.y - p.py) * 0.985; p.px = p.x; p.py = p.y; p.x += vx; p.y += vy - GRAV * dt * dt; }
  for (let it = 0; it < 4; it++) { nodes[0].x = ax; nodes[0].y = ay; nodes[n - 1].x = bx; nodes[n - 1].y = by;
    for (let i = 0; i < n - 1; i++) { const a = nodes[i], b = nodes[i + 1], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-4, k = (d - L) / d * 0.5; if (i > 0) { a.x += dx * k; a.y += dy * k; } if (i < n - 2) { b.x -= dx * k; b.y -= dy * k; } } }
  for (let i = 1; i < n - 1; i += 1) { const p = nodes[i], d = world.dist(p.x, p.y); if (d < 0.04) { world.normal(p.x, p.y, nv); p.x += nv[0] * (0.04 - d); p.y += nv[1] * (0.04 - d); p.px = lerp(p.px, p.x, 0.5); p.py = lerp(p.py, p.y, 0.5); } }
}
export function stepKit(dt) {
  const P = S.P, l = K.laser, r = K.reactor; S.kitInBay = S.crash && r.state === 'ship';
  keys();
  if (P.act) { P.act.t += dt; if (P.dead) P.act = null; else if (P.act.t >= P.act.T) { const a = P.act; P.act = null; a.done(); } }
  // the reactor on the ground is a body
  if (r.state === 'ground') { r.vy -= GRAV * dt; r.y += r.vy * dt; const g = world.groundY(r.x, r.y + 0.5, 0.4, 3); if (g !== null && r.y <= g) { if (r.vy < -3) { audio.play('thud'); G.shake += 0.05; } r.y = g; r.vy = 0; } if (heat.at(r.x, r.y - 0.1) > 0.3) r.y += dt * 0.2; }
  // network
  K.net.antennas = antennas(); K.net.player = isLinked(P.x, P.y + 1);
  // power: who can the reactor reach, and who is asking
  const [rx, ry] = reactorPos(), [lx, ly] = laserPos(), reach = (x, y) => Math.hypot(x - rx, y - ry) <= CABLE, lReach = r.state === 'carried' ? (l.state === 'held' || reach(lx, ly)) : reach(lx, ly), pReach = r.state === 'carried' || reach(P.x, P.y + 1);
  l.reach = lReach;
  // heat: the sink sheds a few kilowatts to the air by itself; a coolant line does the rest where there is one (the
  // hardpoint on the wreck, or the cable to a reactor that stands on its fins); the suit's water pack boils off above
  // 60 %. Nothing else: full is full, and a pulse fired past it costs the optics.
  l.loop = l.state === 'ship' || (lReach && r.state !== 'carried'); const pack = l.state === 'held' ? suitStats().packL : 0;
  if (pack > 0 && EXO.water < pack - 0.5 && S.count('water') > 0.01) EXO.water += inv.take(S.inv, 'water', Math.min(pack - EXO.water, S.count('water')));
  { const [j, w] = coolSink(l.sinkJ, l.state === 'held' ? Math.min(EXO.water, pack) : 0, dt, l.loop); if (l.state === 'held' && pack > 0 && w < EXO.water - 1e-9) { EXO.water = w; if (Math.random() < dt * 30) { const [mx, my] = muzzle(0.5); S.parts.spawn({ x: mx, y: my, vx: rand(-0.6, 0.6), vy: rand(0.8, 2.4), life: rand(0.5, 1.3), size: rand(0.12, 0.28), grow: 2.4, c: [0.5, 0.52, 0.55], mode: 1, a: 0.3, grav: -0.06, drag: 1.4 }); } } l.sinkJ = j; }
  l.heat = l.sinkJ / SINK_J; l.vent = l.heat >= 0.97 ? 0.2 : 0; l.flashT -= dt; if (l.beam && (l.beam.life -= dt) <= 0) l.beam = null;
  // the turret: a computer aims it. The AI is the controller, and it takes the most dangerous thing first; no link, no orders.
  l.link = l.state === 'turret' ? isLinked(l.x, l.y + 1) : null; let want = false;
  if (l.state === 'turret') {
    l.scan -= dt; if (l.scan <= 0) { l.scan = 0.25; let best = null, bs = 0; if (l.link) for (const c of creatures) { if (!c.agg || c.hp <= 0) continue; const d = Math.hypot(c.x - l.x, c.y - l.y - 0.95); if (d > TURRET_RANGE || blocked(l.x, l.y + 0.95, c.x, c.y)) continue; const th = threatOf(c) / (2 + d); if (th > bs) { bs = th; best = c; } } l.target = best; }
    const t = l.target; if (t && t.hp > 0 && l.link) { const ta = Math.atan2(t.y - (l.y + 0.95), t.x - l.x), d = angDiff(ta, l.ang); l.ang += clamp(d, -2.4 * dt, 2.4 * dt); want = Math.abs(d) < 0.07; }
    else if (l.link) l.ang += Math.sin(G.time * 0.5) * 0.2 * dt;      // idle sweep: it is looking
  } else if (l.state === 'held') want = !!P.wantFire && !P.act && !P.dead;
  // the reactor: all of its 2 MW on its fins or in its bay; on your back it throttles for heat. A pulse takes 75 kJ, so
  // the reactor's power is what sets how often one can be fired (10 a second at most: the pulse itself is 50 ms).
  const rW = REACTOR_W * (r.state === 'carried' ? REACTOR_BACK : 1), charge = pReach && EXO.on && P.bat.wh < P.bat.cap - 1, loads = [];
  l.over = !!P.override && l.state === 'held'; const room = l.sinkJ + PULSE_HEAT_J <= SINK_J || l.over, hz = Math.min(LASERP.hz, rW / PULSE_IN_J);
  if (want && room) loads.push({ id: 'laser', w: PULSE_IN_J * hz, from: [lReach ? 'reactor' : '', l.state === 'held' ? 'suit' : ''] });
  if (charge) loads.push({ id: 'charge', w: CHARGE_W, from: ['reactor'] });
  K.pw = powerBudget([{ id: 'reactor', w: rW }, { id: 'suit', w: EXO.on && P.bat.wh > 1 ? SUIT_BUS_W : 0 }], loads); K.pw.cap = rW;
  if (charge) { P.bat.wh = Math.min(P.bat.cap, P.bat.wh + CHARGE_W * (K.pw.served.charge || 0) * dt / 3600 * 20); P.charging = (K.pw.served.charge || 0) > 0.5; }
  r.load = lerp(r.load, clamp((rW - (K.pw.left.reactor ?? rW)) / rW, 0, 1), Math.min(1, dt * 6));
  l.firing = false; l.frac = want && room ? K.pw.served.laser : lReach ? 1 : SUIT_BUS_W / LASER_W; l.wait = want && !room; l.hz = hz;
  if (l.pulseT > 0) l.pulseT -= dt;
  if (want && room) {
    l.firing = true; const a = l.state === 'held' ? P.wa : l.ang;
    if (l.state === 'held' && l.frac < MIN_FRAC) { P.bat.wh = Math.max(0, P.bat.wh - SUIT_BUS_W * dt / 3600); if (S.msgT <= 0) S.say(`not enough power: the suit bus gives ${(SUIT_BUS_W / 1000).toFixed(1)} kw and a pulse is 75 kj. the laser needs the reactor`, 2.5); }
    if (l.pulseT <= 0) { l.pulseT = 1 / hz; const [mx, my] = muzzle(); firePulse(mx, my, a, l.frac, l.state === 'held');
      if (l.sinkJ > SINK_J) { l.optics = Math.max(0.05, l.optics - 0.012 * (l.sinkJ / SINK_J)); if (S.msgT <= 0) S.say(`the sink is past its limit: the optics are burning (${(l.optics * 100).toFixed(0)} % left)`, 2); events.emit('laserDamaged', l.optics); if (l.optics < 0.2 && !l.wrecked) { l.wrecked = true; S.say('the laser is wrecked: it needs parts', 5); } }
      if (l.state === 'held' && l.frac >= MIN_FRAC) P.exert = Math.min(1, P.exert + 0.004); }       // light has no kick worth the name: 30 kJ of it is a ten-thousandth of a newton second
  } else if (l.wait && own(l) && S.msgT <= 0) S.say(`the laser's sink is full (${pack > 0 && EXO.water > 0.01 ? 'the water is boiling off' : 'no cooling but the air'}): a pulse every ${(PULSE_HEAT_J / (LASERP.passiveW + (l.loop ? LASERP.loopW : 0))).toFixed(0)} s. set the reactor down in cable reach for its coolant line`, 2.5);
  if (!want && l.wasWant) { const B = l.lastHit; if (B) flushPend(B[0], B[1]); } if (l.beam && l.beam.hit) l.lastHit = [l.beam.x2, l.beam.y2]; l.wasWant = want;
  audio.loop('drill', l.firing && l.frac >= MIN_FRAC ? 0.3 : l.firing ? 0.06 : 0, 420 + l.heat * 520); audio.loop('hum', r.state === 'ship' && !S.crash ? 0 : 0.05 + r.load * 0.25, 52 + r.load * 30);
  if (l.heat > 0.8 && l.state !== 'ship' && Math.random() < dt * 14) { const [mx, my] = muzzle(0.8); S.parts.spawn({ x: mx, y: my, vx: rand(-1, 1), vy: rand(0.5, 2), life: rand(0.5, 1.2), size: rand(0.1, 0.25), grow: 2, c: [0.3, 0.3, 0.32], mode: 1, a: 0.3, grav: -0.05, drag: 1.5 }); }
  // cables
  if (r.state !== 'ship' || S.crash) {
    if (l.state === 'held' && lReach) { const [bx, by] = rearPort(); rope(K.cable, rx, ry, bx, by, r.state === 'carried' ? 8 : 16, r.state === 'carried' ? 1.5 : 1.12, dt); } else K.cable.length = 0;
    if (l.state === 'turret' && lReach) rope(K.cable2, rx, ry, l.x - Math.cos(l.ang) * 0.3, l.y + 0.9, 16, 1.12, dt); else K.cable2.length = 0;
  }
  if (S.glare > 0) S.glare = Math.max(0, S.glare - dt * 4);
}
const own = l => l.state === 'held';
// how dangerous a creature is to you and the base, for whoever picks targets: what it bites with, how near it is, whether it has drawn blood
export const threatOf = c => { const k = KIND[c.type], P = S.P, d = Math.hypot(c.x - P.x, c.y - P.y - 0.9); return ((k.bite || k.kick || 2) + (c.state === 'charge' ? 6 : 0) + (S.attacker === c ? 12 : 0)) * (c.agg ? 1 : 0.2) * (10 / (4 + d)); };
export function muzzle(len = LASER.len * 0.78) { const P = S.P, l = K.laser; if (l.state === 'held') return [P.gx + Math.cos(P.wa) * len, P.gy + Math.sin(P.wa) * len]; return [l.x + Math.cos(l.ang) * len, l.y + 0.95 + Math.sin(l.ang) * len]; }
const rearPort = () => { const P = S.P; return [P.gx - Math.cos(P.wa) * 0.34, P.gy - Math.sin(P.wa) * 0.34]; };

// ---- drawing ---------------------------------------------------------------------------------------------------------
export function drawReactor(b, x, y, rot, time, load, lit = true) {
  const c = Math.cos(rot), s = Math.sin(rot), T = (ox, oy) => [x + ox * c - oy * s, y + ox * s + oy * c], p = 0.7 + 0.3 * Math.sin(time * (3 + load * 9)), core = [0.15 + load * 1.2, 0.9 + load * 0.6, 1.3 + load * 0.5];
  let q = T(0, 0); b.add(q[0], q[1], 0.5, 0.74, rot, mul(C.dark, 1.5), 1, 2, 1, 3, 0, 0, 0.5);                                                       // pressure vessel
  for (const oy of [-0.3, 0.3]) { q = T(0, oy); b.add(q[0], q[1], 0.56, 0.1, rot, mul(C.steel, 0.9), 1, 0, 1, 4); }                                    // end rings
  for (const ox of [-0.2, -0.07, 0.07, 0.2]) { q = T(ox, 0); b.add(q[0], q[1], 0.035, 0.46, rot, mul(C.steel, 0.5), 1, 0, 1, 5); }                     // cooling ribs
  q = T(0, 0); b.add(q[0], q[1], 0.3, 0.2, rot, mul(core, 0.9 * p), 1, 2, 2); b.add(q[0], q[1], 0.12, 0.1, rot, mul(core, 2.6 * p), 1, 2, 2);          // the core behind its window
  if (lit) { b.add(q[0], q[1], 1.5 + load, 1.5 + load, 0, mul(core, 0.14 * p), 1, 1, 2); light.emit(q[0] / TS, q[1] / TS, core[0] * 0.25 * p, core[1] * 0.3 * p, core[2] * 0.3 * p); }
  q = T(0, 0.42); b.add(q[0], q[1], 0.34, 0.05, rot, mul(C.steel, 1.2), 1, 2, 1); q = T(-0.27, 0.12); b.add(q[0], q[1], 0.05, 0.05, 0, mul(C.amber, 2.2), 1, 1, 2);       // handle, status light
}
// the ship laser: capacitor housing, a long barrel in a sleeve of cooling fins, the emitter. (x, y) = the grip.
export function drawLaser(b, x, y, ang, time, heatV, firing) {
  const c = Math.cos(ang), s = Math.sin(ang), up = c >= 0 ? 1 : -1, T = (ox, oy) => [x + ox * c - oy * up * s, y + ox * s + oy * up * c];
  let q = T(-0.14, 0.02); b.add(q[0], q[1], 0.56, 0.32, ang, mul(C.steel, 0.6), 1, 0, 1, 2, 0, 0, 0.5);                           // capacitor housing
  q = T(-0.14, 0.2); b.add(q[0], q[1], 0.4, 0.07, ang, mul(C.hull, 0.5), 1, 0, 1, 3); q = T(-0.4, 0.0); b.add(q[0], q[1], 0.12, 0.24, ang, C.dark, 1, 0, 1, 1); q = T(-0.14, 0.31); b.seg(q[0] - c * 0.16, q[1] - s * 0.16, q[0] + c * 0.16, q[1] + s * 0.16, 0.045, mul(C.steel, 0.9), 1, 2, 1);   // top plate, butt, carry handle
  for (let i = 0; i < 3; i++) { q = T(-0.3 + i * 0.13, 0.02); b.add(q[0], q[1], 0.035, 0.36, ang, mul(C.amber, 0.2 + (firing ? 1.2 + Math.sin(time * 40 + i * 2) * 0.6 : 0.1)), 1, 0, firing ? 2 : 1); }      // capacitor rings
  q = T(0.55, 0.02); b.add(q[0], q[1], 0.9, 0.15, ang, mul(C.dark, 1.2), 1, 0, 1, 5, 0, 0, 0.4); q = T(0.55, -0.08); b.add(q[0], q[1], 0.84, 0.05, ang, mul(C.steel, 0.45), 1, 0, 1, 8);                       // barrel and its coolant line
  q = T(0.22, -0.13); b.add(q[0], q[1], 0.34, 0.08, ang, mul(C.steel, 0.5), 1, 0, 1, 6); q = T(0.1, -0.21); b.add(q[0], q[1], 0.08, 0.18, ang + up * 0.25, C.dark, 1, 2, 1);          // rail, fore grip
  for (let i = 0; i < 6; i++) { q = T(0.32 + i * 0.095, 0.02); b.add(q[0], q[1], 0.04, 0.3 - i * 0.018, ang, [0.1 + heatV * 3.2, 0.1 + heatV * 0.75, 0.11], 1, 0, heatV > 0.18 ? 2 : 1); }   // fins that glow with heat
  q = T(1.0, 0.02); b.add(q[0], q[1], 0.12, 0.22, ang, mul(C.steel, 0.9), 1, 0, 1, 7); q = T(1.07, 0.02); b.add(q[0], q[1], 0.16, 0.16, 0, mul(C.amber, firing ? 7 : 0.7), 1, 1, 2);
  if (heatV > 0.3) { q = T(0.55, 0.02); b.add(q[0], q[1], 1.2, 0.7, ang, [0.8, 0.2, 0.03], heatV * 0.35, 1, 2); light.emit(q[0] / TS, q[1] / TS, 0.5 * heatV, 0.12 * heatV, 0.02); }
}
function drawCable(b, nodes) { for (let i = 0; i < nodes.length - 1; i++) b.seg(nodes[i].x, nodes[i].y, nodes[i + 1].x, nodes[i + 1].y, 0.045, i % 3 === 1 ? mul(C.amber, 0.12) : [0.02, 0.022, 0.026], 1, 2, 1, i, 0, 0, 0.5); }
export function drawBeam(b, B, time) {
  const fl = 0.8 + 0.2 * Math.sin(time * 70) * Math.sin(time * 31), len = Math.hypot(B.x2 - B.x1, B.y2 - B.y1), ca = Math.cos(B.ang), sa = Math.sin(B.ang);
  if (B.weak) { b.seg(B.x1, B.y1, B.x2, B.y2, 0.05, [2.5, 1.0, 0.2], 0.5 * fl, 2, 2); b.add(B.x1, B.y1, 0.4, 0.4, 0, [2, 0.8, 0.2], 0.5 * fl, 1, 2); light.emit(B.x1 / TS, B.y1 / TS, 0.3, 0.12, 0.03); return; }
  b.seg(B.x1, B.y1, B.x2, B.y2, 0.7, [1.0, 0.26, 0.035], 0.26 * fl, 2, 2); b.seg(B.x1, B.y1, B.x2, B.y2, 0.22, [2.6, 0.9, 0.15], 0.75, 2, 2); b.seg(B.x1, B.y1, B.x2, B.y2, 0.07, [8, 5.6, 2.8], fl, 2, 2);
  for (let i = 0; i < 5; i++) { const t = ((time * 9 + i / 5) % 1) * len; b.add(B.x1 + ca * t, B.y1 + sa * t, 0.5, 0.16, B.ang, [4, 2, 0.6], 0.6, 1, 2); }
  b.add(B.x1, B.y1, 1.0, 1.0, 0, [3, 1.4, 0.4], 0.8, 1, 2);
  if (B.hit) { b.add(B.x2, B.y2, 4.2, 4.2, 0, [1.6, 0.5, 0.08], 0.5 * fl, 1, 2); b.add(B.x2, B.y2, 1.3, 1.3, 0, [7, 4, 1.4], fl, 1, 2); b.add(B.x2, B.y2, 3.0, 0.12, time * 3, [5, 3, 1], 0.7, 1, 2); b.add(B.x2, B.y2, 2.5, 0.1, -time * 2.3 + 1, [5, 3, 1], 0.6, 1, 2); }
}
// the transport that brought the prisoners down: a broken hull with what is left in it
export function drawWreck(b, time) {
  const x = SHIP.x, y = SHIP.y, t = -0.13, fl = Math.sin(time * 23) * Math.sin(time * 3.1) > 0.2 ? 1 : 0.15, hull = mul(C.hull, 0.6), c = Math.cos(t), s = Math.sin(t), T = (ox, oy) => [x + ox * c - oy * s, y + ox * s + oy * c];
  // inside, the outer hull is cut away: its plates are drawn as a ghost of themselves and the room behind them shows (wreck.js)
  const cut = WRECK.cut, oa = 1 - cut * 0.93; if (cut > 0.02) drawInterior(b, time, Math.min(1, cut * 1.4));
  const R = (ox, oy, w, h, col, sd = 0, rot = 0, shape = 0) => { if (oa < 0.1) return; const q = T(ox, oy); b.add(q[0], q[1], w, h, t + rot, col, oa, shape, 1, sd, 0, 0, 0.35); };
  const E = (ox, oy, w, h, col, al = 1) => { const q = T(ox, oy); b.add(q[0], q[1], w, h, t, col, al, 0, 2); };
  R(-4.7, 1.25, 1.7, 0.85, mul(C.dark, 1.0), 1, 0.25, 2); R(-5.45, 1.42, 0.5, 1.05, mul(C.steel, 0.32), 2, 0.25); { const q = T(-5.0, 1.3); b.add(q[0], q[1], 0.5, 0.5, 0, [0.5, 0.12, 0.02], 0.25 + 0.15 * Math.sin(time * 1.7), 1, 2); }   // engine bell, torn off its mount, still warm
  if (Math.random() < 0.06) { const q = T(-5.3, 1.9); S.parts.spawn({ x: q[0], y: q[1], vx: rand(-0.1, 0.25), vy: rand(0.3, 0.7), life: rand(3, 6), size: rand(0.25, 0.45), grow: 3, c: [0.07, 0.07, 0.075], mode: 1, a: 0.22, grav: -0.02, drag: 0.5 }); }
  { const q = T(-3.2, 2.6); b.seg(q[0] + 0.9, q[1] - 0.45, q[0] - 1.5, q[1] + 0.9, 0.5, mul(hull, 0.2), 1, 2, 1, 4, 0.75, 0, 0.6); }                 // what is left of a fin
  R(-0.3, 0.72, 7.7, 1.5, mul(hull, 0.2), 3); R(-0.6, 1.72, 6.7, 0.82, mul(hull, 0.27), 4); R(2.85, 1.48, 2.3, 1.12, mul(hull, 0.24), 5, -0.2);     // lower hull, upper hull, nose
  R(-0.6, 2.14, 6.7, 0.035, mul(hull, 0.75), 1); R(-0.3, 1.46, 7.7, 0.03, mul(hull, 0.1), 2); R(-0.3, 0.02, 7.5, 0.16, mul(C.dark, 0.9), 6);       // the lit top edge, the belt line, the heat shield
  for (let i = 0; i < 11; i++) R(-3.7 + i * 0.68, 0.14, 0.6, 0.2, mul(C.dark, 0.55 + 0.5 * hash(i, 3, 400)), i);                                    // heat-shield tiles, some gone
  R(3.35, 1.72, 1.15, 0.42, [0.01, 0.017, 0.022], 6, -0.2); { const q = T(3.3, 1.8); b.add(q[0], q[1], 0.7, 0.04, t - 0.2, mul(C.cyan, 0.14), 1, 0, 2); b.add(q[0] + 0.3, q[1] - 0.12, 0.12, 0.03, t - 0.2, mul(C.amber, 0.4 * fl), 1, 0, 2); }   // cockpit glass, one display still alive
  for (let i = 0; i < 8; i++) R(-3.6 + i * 0.9, 1.3, 0.025, 1.6 - (i % 3) * 0.3, mul(hull, 0.07), i);                                               // panel seams
  for (let i = 0; i < 6; i++) R(-3.1 + i * 1.07 + hash(i, 1, 401) * 0.3, 0.9 + hash(i, 2, 401) * 0.9, 0.5 + hash(i, 3, 401) * 0.9, 0.14 + hash(i, 4, 401) * 0.3, mul(hull, 0.12 + 0.1 * hash(i, 5, 401)), i + 20);   // scorched and replaced plates
  for (let i = 0; i < 5; i++) R(-0.5 + i * 0.13, 0.52, 0.07, 0.16, i % 2 ? [0.3, 0.14, 0.02] : [0.02, 0.02, 0.02], i, 0.5);                         // hazard marks by the bay
  for (let i = 0; i < 4; i++) { const q = T(-4.3 - i * 0.14, 0.4 + i * 0.5); b.seg(q[0], q[1], q[0] - 0.7 + i * 0.12, q[1] + 0.25 - i * 0.2, 0.06, mul(C.steel, 0.5), 1, 2, 1, i, 0.6, 0.1, 0.5); }   // ribs where the tail tore away
  R(-4.25, 1.1, 0.5, 1.5, [0.006, 0.007, 0.009], 2); E(-4.2, 0.9, 0.3, 0.3, [0.5, 0.2, 0.05], Math.sin(time * 9) > 0.7 ? 0.5 : 0.06);                // the open tail, and something in there still shorting
  R(1.7, 0.1, 0.16, 1.0, mul(C.steel, 0.5), 7, 0.5); R(-2.7, 0.0, 0.16, 0.9, mul(C.steel, 0.5), 8, -0.4); R(-1.2, 2.24, 1.7, 0.1, mul(hull, 0.3), 9, 0.07); R(1.2, 2.2, 0.9, 0.08, mul(hull, 0.26), 10, -0.25);          // struts, lifted plates
  drawSkin(b, time, oa);
  // the hold hatch
  { const q = SHIP.hatch; b.add(q[0], q[1], 0.9, 1.0, t, [0.014, 0.016, 0.02], 1, 0, 1); b.add(q[0] + 0.52, q[1] + 0.2, 0.06, 0.06, 0, mul(C.acid, 1.6), 1, 1, 2); b.add(q[0], q[1] + 0.56, 1.0, 0.07, t, mul(C.steel, 0.8), 1, 0, 1); }
  // the reactor bay: the reactor in its cradle, or the empty cradle and the cable that fed the ship
  { const q = SHIP.bay; b.add(q[0], q[1], 1.1, 1.15, t, [0.008, 0.01, 0.013], 1, 0, 1); for (const d of [-1, 1]) b.add(q[0] + d * 0.5, q[1], 0.08, 1.15, t, mul(C.steel, 0.6), 1, 0, 1, d);
    if (K.reactor.state === 'ship') drawReactor(b, q[0], q[1], t, time, 0.12);
    else { b.seg(q[0] - 0.3, q[1] + 0.4, q[0] + 0.1, q[1] - 0.45, 0.04, [0.02, 0.022, 0.026], 1, 2, 1, 1, 0, 0.12); b.add(q[0], q[1] - 0.3, 0.6, 0.08, t, mul(C.steel, 0.5), 1, 0, 1); if (Math.sin(time * 1.7) > 0.96) { b.add(q[0] + 0.1, q[1] - 0.45, 0.3, 0.3, 0, [2, 3, 4], 0.9, 1, 2); light.emit(q[0] / TS, q[1] / TS, 0.2, 0.4, 0.6); } } }
  // the hardpoint and the ship's weapon on it
  { const q = SHIP.mount; b.add(q[0], q[1] - 0.14, 0.5, 0.16, t, mul(C.steel, 0.7), 1, 0, 1, 2); b.add(q[0], q[1] - 0.04, 0.16, 0.2, t, C.dark, 1, 0, 1); if (K.laser.state === 'ship') drawLaser(b, q[0] - 0.1, q[1] + 0.08, t + 0.06, time, 0, false); }
  // the mast: the ship's own short-range link
  { const q = T(-2.9, 2.1), m = SHIP.mast; b.seg(q[0], q[1], m[0], m[1], 0.07, C.steel, 1, 0, 1); b.seg(m[0] - 0.3, m[1] - 0.35, m[0] + 0.25, m[1] - 0.25, 0.04, C.steel, 1, 0, 1);
    b.add(m[0], m[1], 0.1, 0.1, 0, mul(C.amber, 4 * fl), 1, 1, 2); b.add(m[0], m[1], 1.2, 1.2, 0, mul(C.amber, 0.3 * fl), 1, 1, 2); light.emit(m[0] / TS, m[1] / TS, 0.9 * fl, 0.42 * fl, 0.08 * fl); }
  // emergency strip along the hull
  for (let i = 0; i < 5; i++) { const q = T(-2.6 + i * 1.1, 0.95), k = 0.5 + 0.5 * Math.sin(time * 2 - i * 0.8); b.add(q[0], q[1], 0.16, 0.03, t, mul(C.amber, 0.5 + k), oa, 0, 2); }
  { const q = T(0.2, 1.0); light.emit(q[0] / TS, q[1] / TS, 0.22, 0.11, 0.03); }
}
export function drawKit(b, time) {
  const l = K.laser, r = K.reactor;
  if (r.state === 'ground') drawReactor(b, r.x, r.y + 0.4, 0, time, r.load);
  if (K.cable.length) drawCable(b, K.cable); if (K.cable2.length) drawCable(b, K.cable2);
  if (l.state === 'turret') {
    const x = l.x, y = l.y, link = !!l.link, ok = link && l.reach;
    for (const d of [-1, 0.2, 1]) b.seg(x, y + 0.8, x + d * 0.55, y - 0.02, 0.055, mul(C.steel, 0.8), 1, 2, 1, d + 2, 0.3, 0, 0.5);      // legs
    b.add(x, y + 0.84, 0.22, 0.16, 0, C.dark, 1, 0, 1); drawLaser(b, x - Math.cos(l.ang) * 0.1, y + 0.95 - Math.sin(l.ang) * 0.1, l.ang, time, l.heat, l.firing);
    b.add(x - 0.1, y + 1.16, 0.12, 0.1, 0, mul(C.steel, 0.9), 1, 0, 1); b.seg(x - 0.1, y + 1.2, x - 0.16, y + 1.5, 0.02, C.steel, 1, 0, 1);                     // the control box and its whip antenna
    b.add(x - 0.16, y + 1.5, 0.06, 0.06, 0, mul(ok ? C.cyan : link ? C.amber : C.red, 2.5 * (ok ? 1 : 0.5 + 0.5 * Math.sin(time * 8))), 1, 1, 2);
    if (l.target && ok) { const tg = l.target; b.seg(x, y + 0.95, tg.x, tg.y, 0.012, mul(C.red, 1.2), 0.25, 0, 2); }
  }
}
export function drawKitBeam(b, time) { if (K.laser.beam) drawBeam(b, K.laser.beam, time); }
export function dumpKit() { const l = K.laser, r = K.reactor, f = v => +v.toFixed(3), pend = {}; for (const k in K.pend) if (K.pend[k] > 1e-6) pend[k] = +K.pend[k].toFixed(5); return { r: [r.state, f(r.x), f(r.y)], l: [l.state, f(l.x), f(l.y), f(l.ang), f(l.heat), f(l.optics), l.mode === 'kerf' ? 1 : 0], hold: inv.dump(K.hold), pend, awake: K.awake ? 1 : 0 }; }
export function loadKit(o) {
  kitReset('carried'); if (!o) return; const l = K.laser, r = K.reactor;
  [r.state, r.x, r.y] = o.r; [l.state, l.x, l.y, l.ang, l.heat] = o.l; l.sinkJ = Math.min(1.2, l.heat || 0) * SINK_J; l.optics = o.l[5] === undefined ? 1 : o.l[5]; l.mode = o.l[6] ? 'kerf' : 'spall'; inv.load(K.hold, o.hold); K.hold.title = 'ship hold'; K.pend = { ...o.pend }; K.awake = !!o.awake;
}

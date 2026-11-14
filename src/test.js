// in-page property tests (?test=1). Prints "tests ok N" or the failures.
import { rng, TAU } from './core.js';
import { elFromState, stateFromEl, energy, hohmannTime, G0 } from './space/orbit.js';
import { makeShip, BP, stepShip, split, recalc, islands, growHive } from './space/ship.js';
import { leadTime } from './space/combat.js';
import { genSector } from './space/belt.js';
import { propagate } from './surface/light.js';
import { world, M, MAT, CELL } from './surface/world.js';
import { G } from './core.js';
import { S } from './surface/state.js';
import { P, stepPlayer, fire, WEAPON } from './surface/player.js';
import { ITEMS, makeInv, inv, printerQueue, printerStep, printerCancel, RECIPE, SUIT_SLOW, PRINT_W } from './items.js';
import { assignJobs, robots, stepRobots, wakeShipRobots, ROBOT } from './surface/robots.js';
import { matter } from './surface/matter.js';
import { heat } from './surface/heat.js';
import { K, SHIP, fireBeam, flushPend, stepKit, kitReset } from './surface/kit.js';
import { powerBudget, linked, mobility, REACTOR_W, LASER_W, SUIT_BUS_W, CHARGE_W, MIN_FRAC, REACTOR_KG, LASER_KG } from './surface/power.js';
import { planDemand, bestProducer, stepSupply, SUP, TARGETS0 } from './surface/supply.js';
import { KIND, stance, PLAYER_SIZE } from './surface/creatures.js';
import { GRAV } from './surface/gen.js';
import { place, stepFactory, F } from './surface/factory.js';
import { addGhost } from './surface/blueprint.js';
import { save, memAdapter } from './save.js';
import { env } from './surface/env.js';
import { waveOf, waveEvery } from './surface/hive.js';
import { genRuin } from './surface/ruins-gen.js';
import { slotStruct, resetStructs } from './surface/structures.js';

export async function runTests() {
  const fails = []; let n = 0; const ok = (name, cond, info = '') => { n++; if (!cond) { fails.push(name + ' ' + info); console.log('FAIL ' + name + ' ' + info); } };
  const r = rng(12345), mu = 2.35e14;
  // 1 Kepler round-trip, elliptic and hyperbolic, both directions
  let worst = 0;
  for (let i = 0; i < 400; i++) { const rr = 6e6 + r() * 4e7, th = r() * TAU, vc = Math.sqrt(mu / rr), sp = vc * (0.3 + r() * 1.6), va = th + (r() < 0.5 ? 1 : -1) * (0.2 + r() * 2.7), s0 = [rr * Math.cos(th), rr * Math.sin(th), sp * Math.cos(va), sp * Math.sin(va)];
    const el = elFromState(s0[0], s0[1], s0[2], s0[3], mu, 100), s1 = stateFromEl(el, 100), dt = 500 + r() * 5000, s2 = stateFromEl(el, 100 + dt), el2 = elFromState(s2[0], s2[1], s2[2], s2[3], mu, 100 + dt), s3 = stateFromEl(el2, 100);
    worst = Math.max(worst, Math.hypot(s1[0] - s0[0], s1[1] - s0[1]) / rr, Math.hypot(s3[0] - s0[0], s3[1] - s0[1]) / rr, Math.hypot(s3[2] - s0[2], s3[3] - s0[3]) / sp); }
  ok('kepler round-trip', worst < 1e-7, 'worst ' + worst.toExponential(2));
  // 2 energy conserved along the conic within 1e-9
  worst = 0;
  for (let i = 0; i < 200; i++) { const rr = 6e6 + r() * 2e7, sp = Math.sqrt(mu / rr) * (0.5 + r() * 1.2), el = elFromState(rr, 0, sp * 0.3, sp * 0.954, mu, 0), e0 = energy(rr, 0, sp * 0.3, sp * 0.954, mu);
    for (let k = 1; k < 8; k++) { const s = stateFromEl(el, k * 700); worst = Math.max(worst, Math.abs(energy(s[0], s[1], s[2], s[3], mu) / e0 - 1)); } }
  ok('energy along conic', worst < 1e-9, 'worst ' + worst.toExponential(2));
  // 3 Hohmann transfer time matches pi sqrt(a^3/mu)
  { const r1 = 5.42e6, r2 = 4.2e7, a = (r1 + r2) / 2, vp = Math.sqrt(mu * (2 / r1 - 1 / a)), el = elFromState(r1, 0, 0, vp, mu, 0), s = stateFromEl(el, hohmannTime(r1, r2, mu)); ok('hohmann time', Math.abs(Math.hypot(s[0], s[1]) / r2 - 1) < 1e-9 && Math.abs(s[1]) / r2 < 1e-6, String(Math.hypot(s[0], s[1]) / r2)); }
  // 4 Tsiolkovsky: integrate a full burn in free space and compare with Isp g0 ln(m0/m1)
  { const s = makeShip(BP.rocket, { sas: false }); s.p = [1e12, 0]; const m0 = s.m, want = s.dv; s.throttle = 1; let k = 0; while (s.fuel > 1e-6 && k++ < 200000) stepShip(s, 1 / 120, 0, 0); recalc(s);
    const got = Math.hypot(s.v[0], s.v[1]), exact = s.isp * G0 * Math.log(m0 / s.m); ok('tsiolkovsky', Math.abs(got / exact - 1) < 2e-3 && Math.abs(want / exact - 1) < 1e-9, `got ${got.toFixed(1)} exact ${exact.toFixed(1)}`); }
  // 5 connectivity split: cut the rocket in the middle, mass is conserved and the halves are what the graph says
  { const s = makeShip(BP.rocket), m0 = s.m, cut = s.parts.find(p => p.gx === -1); s.parts.splice(s.parts.indexOf(cut), 1); const mc = cut.m; recalc(s); const made = split(s);
    ok('split count', made.length === 1 && made[0].parts.length === 3 && s.parts.length === 7, `${made.length} ${made[0] && made[0].parts.length} ${s.parts.length}`); ok('split mass', Math.abs(s.m + made[0].m + mc - m0) < 1e-6);
    ok('islands', islands(makeShip(BP.scout).parts, null).length === 1 && islands(makeShip(growHive(30, rng(3))).parts, null).length === 1); }
  // 6 light propagation is mirror-symmetric around an emitter in open air
  { const W = 41, H = 31, L = new Float32Array(W * H), A = new Float32Array(W * H).fill(0.905); L[15 * W + 20] = 1; propagate(L, A, W, H); let d = 0, mono = true;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { d = Math.max(d, Math.abs(L[j * W + i] - L[j * W + (W - 1 - i)]), Math.abs(L[j * W + i] - L[(H - 1 - j) * W + i])); } for (let i = 21; i < W; i++) if (L[15 * W + i] > L[15 * W + i - 1]) mono = false;
    ok('light symmetry', d < 1e-6 && mono, 'max diff ' + d); }
  // 7 determinism: the same seed gives the same density field, the same structures and the same belt sector
  { const pts = []; for (let i = 0; i < 300; i++) pts.push([Math.floor(r() * 4000 - 2000), Math.floor(r() * 600 - 500)]); const A = pts.map(q => world.sample(q[0], q[1]) * 256 + world.sampleM(q[0], q[1])), n1 = slotStruct(1).stamps.length, m1 = slotStruct(-2).props.length;
    world.reset(); resetStructs(); const same = pts.every((q, i) => world.sample(q[0], q[1]) * 256 + world.sampleM(q[0], q[1]) === A[i]) && slotStruct(1).stamps.length === n1 && slotStruct(-2).props.length === m1; const a = genSector(7, 11), b = genSector(7, 11);
    ok('determinism', same && a.length === b.length && a.every((q, i) => q.R === b[i].R && q.el.a === b[i].el.a && q.r[17] === b[i].r[17])); }
  // 8 lead solution really intercepts
  { let w = 0; for (let i = 0; i < 200; i++) { const rx = r() * 4000 - 2000, ry = r() * 4000 - 2000, vx = r() * 400 - 200, vy = r() * 400 - 200, t = leadTime(rx, ry, vx, vy, 1100); w = Math.max(w, t === null ? 1 : Math.abs(Math.hypot(rx + vx * t, ry + vy * t) - 1100 * t)); } ok('lead intercept', w < 1e-6, String(w)); }
  const d0 = save.collect();        // the untouched state; put back at the end
  // 9 terrain brush conserves material: what a dig removes is what it reports, per material, and a fill likewise
  { const x = 60, y = -14, box = [x - 3, y - 3, x + 3, y + 3]; world.box(x - 4, y - 4, x + 16, y + 4, 1, M.BASALT); const m0 = world.mass(...box), acc = {}; world.dig(x, y, 1.2, 0, acc); const m1 = world.mass(...box); let worst = 0, tot = 0;
    for (const k of new Set([...Object.keys(m0), ...Object.keys(m1), ...Object.keys(acc)])) { worst = Math.max(worst, Math.abs((m0[k] || 0) - (m1[k] || 0) - (acc[k] || 0))); tot += acc[k] || 0; }
    ok('brush dig conserves', worst < 1e-9 && tot > 100, `worst ${worst.toExponential(2)} dug ${tot.toFixed(1)} kg`);
    const acc2 = {}; world.fill(x, y, 0.8, M.PLATE, 0, acc2); const m2 = world.mass(...box); worst = 0; for (const k of new Set([...Object.keys(m1), ...Object.keys(m2), ...Object.keys(acc2)])) worst = Math.max(worst, Math.abs((m1[k] || 0) - (m2[k] || 0) - (acc2[k] || 0)));
    ok('brush fill conserves', worst < 1e-9 && acc2[M.PLATE] < -50, `worst ${worst.toExponential(2)} placed ${(-acc2[M.PLATE] || 0).toFixed(1)} kg`);
    // the edge of a dug circle is a circle: the surface lies within a third of a cell of the radius in every direction
    world.dig(x + 12, y, 1.5, 0); let e = 0; for (let a = 0; a < 16; a++) { const h = world.ray(x + 12, y, Math.cos(a * 0.3927), Math.sin(a * 0.3927), 3); e = Math.max(e, h ? Math.abs(h.d - 1.5) : 9); } ok('brush edge is round', e < CELL * 0.4, 'max radius error ' + e.toFixed(4) + ' m'); }
  // 10 SDF collision: the body comes to rest on the surface of the field, not inside it and not above it
  { world.box(-4, 0, 4, 6, -1); world.box(-4, -2, 4, 0, 1, M.BASALT); P.x = 0.3; P.y = 2.5; P.vx = P.vy = 0; P.dead = 0; P.hp = 100; for (let i = 0; i < 360; i++) stepPlayer(1 / 120);
    ok('sdf collision rest', P.ground && Math.abs(P.y) < 0.04 && world.dist(P.x, P.y + 0.3) > 0.26, `y ${P.y.toFixed(4)} ground ${P.ground}`);
    world.box(2, 0, 3, 3, 1, M.BASALT); P.vx = 9; for (let i = 0; i < 240; i++) { P.vx = 9; stepPlayer(1 / 120); } ok('sdf collision wall', P.x < 1.75 && P.x > 1.4 && world.dist(P.x, P.y + 0.9) > 0.25, `x ${P.x.toFixed(3)}`); }
  // 11 inventory stacking: stacks fill to the slot limit, spill into the next slot, and report what does not fit
  { const I = makeInv(3); ok('stack add', inv.add(I, 'iron', 250) === 0 && I.slots[0].n === 200 && I.slots[1].n === 50); inv.add(I, 'iron', 10); ok('stack merge', I.slots[1].n === 60 && !I.slots[2]);
    const left = inv.add(I, 'part', 10); ok('stack overflow', left === 2 && I.slots[2].n === 8, 'left ' + left); ok('stack take', inv.take(I, 'iron', 205) === 205 && Math.abs(inv.count(I, 'iron') - 55) < 1e-9 && inv.take(I, 'copper', 3) === 0);
    ok('stack mass', Math.abs(inv.mass(I) - (55 + 8 * 30)) < 1e-9 && inv.has(I, { iron: 55, part: 8 }) && !inv.has(I, { iron: 55.01 })); }
  // 12 float amounts and ammunition conserve mass: fractions add up, every round fired leaves the magazine
  { const I = makeInv(6); inv.add(I, 'iron ore', 12.345); inv.add(I, 'iron ore', 0.655); let t = 0; for (let i = 0; i < 30; i++) t += inv.take(I, 'iron ore', 0.1); ok('float amounts', Math.abs(inv.count(I, 'iron ore') - 10) < 1e-9 && Math.abs(t - 3) < 1e-9);
    inv.add(S.inv, 'rifle rounds', 100); P.mag.rifle = 30; const before = inv.count(S.inv, 'rifle rounds') + P.mag.rifle, n0 = S.bullets.length; for (let i = 0; i < 7; i++) fire('rifle'); const fired = S.bullets.length - n0;
    const got = inv.take(S.inv, 'rifle rounds', WEAPON.rifle.mag - P.mag.rifle); P.mag.rifle += got; ok('ammo count', fired === 7 && P.mag.rifle === 30 && inv.count(S.inv, 'rifle rounds') + P.mag.rifle + fired === before && Math.abs(inv.mass(S.inv) - 93 * ITEMS['rifle rounds'].m) < 1e-9, `fired ${fired} reserve ${inv.count(S.inv, 'rifle rounds')}`); S.bullets.length = n0;
    const fu = place('furnace', 0, 0, 1, true); fu.inp['iron ore'] = 16; for (let i = 0; i < 120 * 40; i++) stepFactory(1 / 120); ok('furnace mass', Math.abs((fu.out.iron || 0) - (16 - (fu.inp['iron ore'] || 0)) / RECIPE.iron.in['iron ore']) < 1e-6 && fu.out.iron > 9.9, `iron ${fu.out.iron}`); }
  // 13 suit printer queue: pays on queueing, takes SUIT_SLOW times the machine time, draws the battery, refunds on cancel
  { const I = makeInv(6), pr = { q: [] }, bat = { wh: 100 }; inv.add(I, 'iron', 20); ok('printer queue', printerQueue(pr, I, 'miner', 1) === 1 && Math.abs(inv.count(I, 'iron') - 6) < 1e-9 && printerQueue(pr, I, 'miner', 1) === 0 && pr.q.length === 1);
    let done = 0, steps = 0; while (pr.q.length && steps < 1e5) { if (printerStep(pr, I, 0.1, bat) === 'miner') done++; steps++; } const T = RECIPE.miner.t * SUIT_SLOW;
    ok('printer time and power', done === 1 && inv.count(I, 'miner') === 1 && Math.abs(steps * 0.1 - T) < 0.11 && Math.abs(100 - bat.wh - PRINT_W * steps * 0.1 / 3600) < 1e-9, `steps ${steps} wh ${bat.wh}`);
    inv.add(I, 'iron', 3); printerQueue(pr, I, 'belt', 1); const flat = { wh: 0 }; printerStep(pr, I, 1, flat); printerCancel(pr, I, 0); ok('printer cancel and stall', pr.q.length === 0 && Math.abs(inv.count(I, 'iron') - 9) < 1e-9); }
  // 14 robot job assignment: nearest job first, one robot per job, and material is not promised twice
  { const bots = [{ state: 'idle', wh: 40, x: 0, y: 0 }, { state: 'idle', wh: 40, x: 20, y: 0 }, { state: 'idle', wh: 2, x: 5, y: 0 }], chest = makeInv(4); inv.add(chest, 'furnace', 1);
    const jobs = [{ x: 18, y: 0, cost: { furnace: 1 } }, { x: 3, y: 0, cost: { furnace: 1 } }, { x: 22, y: 0, cost: null }, { x: 1, y: 0, cost: { assembler: 1 } }], as = assignJobs(bots, jobs, [{ inv: chest, x: 2, y: 0 }]);
    ok('robot assignment', as.length === 2 && as[0].robot === bots[0] && as[0].job === jobs[1] && as[1].robot === bots[1] && as[1].job === jobs[2] && new Set(as.map(q => q.job)).size === 2, JSON.stringify(as.map(q => [bots.indexOf(q.robot), jobs.indexOf(q.job)]))); }
  // 15 noise and pollution: sound is heard up to its level, pollution spreads without being created; waves grow with alert
  { env.load(null); env.noise(100, 0, 40, false); const h1 = env.heard(130, 0), h2 = env.heard(150, 0); env.pollute(0, 0, 100); const t0 = env.total(); for (let i = 0; i < 40; i++) env.step(1); const t1 = env.total();
    ok('noise and pollution', h1 && Math.abs(h1.v - 10) < 1e-9 && !h2 && t1 < t0 && t1 > t0 * 0.9 && env.pollAt(9, 0) > 0, `${t0} ${t1}`); env.load(null);
    const rr = rng(5); ok('waves grow with alert', waveOf(5, rr).length < waveOf(50, rr).length && waveOf(50, rr).length < waveOf(95, rr).length + 3 && waveEvery(90) < waveEvery(10) && waveOf(95, rr).some(t => t === 'brute' || t === 'burrower' || t === 'flier' || t === 'spitter')); }
  // 16 ruins grammar: deterministic, and every standing solid tapers upward (the first rule of the style)
  { const a = genRuin('t', 500, 42), b = genRuin('t', 500, 42), caps = a.stamps.filter(q => q.op > 0 && q.t === 'c' && q.r1 !== undefined);
    ok('ruins grammar', JSON.stringify(a.stamps) === JSON.stringify(b.stamps) && caps.length >= 4 && caps.every(q => q.r1 <= q.r && q.y1 > q.y0) && a.props.some(q => q.t === 'xterm') && a.props.some(q => q.t === 'cache')); }
  // 17 save round-trip: collect -> store -> wreck the state -> load -> collect gives the identical state hash
  { save.apply({ version: 3, data: d0 }); matter.spawn('basalt', 12.5, 20, 3); K.reactor.state = 'ground'; K.reactor.x = 7; K.reactor.y = 0.5; K.laser.state = 'turret'; K.laser.x = 9; inv.add(K.hold, 'iron', 3.5); SUP.targets.iron = 44; world.dig(30, -3, 1.4, 0); world.fill(31, 2, 0.6, M.PLATE, 0); S.add('iron', 37.25); S.add('rifle rounds', 77); S.add('furnace', 1); P.x = 12.5; P.y = 3.25; P.bat.wh = 321.5; P.mag.rifle = 11;
    const ch = place('chest', 40, 6, 1, true); inv.add(ch.inv, 'copper', 12.5); const fu = place('furnace', 44, 6, 1, true); fu.inp['iron ore'] = 7.5; fu.out.iron = 1.25; addGhost('assembler', 50, 6); S.printer.q.push({ r: 'belt', left: 9.5, total: 16 }); env.pollute(10, 0, 12.5); S.stats.kills.scout = 3;
    const mem = memAdapter(), keep = save.adapter; save.use(mem); const b1 = save.blob(); await mem.save('t', b1);
    world.dig(30, -3, 3, 0); S.inv.slots.fill(null); F.machines.length = 0; P.x = -99; env.load(null); matter.list.length = 0; kitReset('carried'); SUP.targets.iron = 1;
    const b2 = await save.read('t'); save.apply(b2); const h2 = save.hash(save.collect()); save.use(keep);
    ok('save round-trip', b1.hash === h2 && b2.hash === b1.hash && Object.keys(b1.data.parts.surface.terrain).length > 0 && S.count('iron') === 37.25 && F.machines.length === 2 && Math.abs(matter.total() - 12.5) < 1e-6 && K.reactor.state === 'ground' && K.laser.state === 'turret' && inv.count(K.hold, 'iron') === 3.5 && SUP.targets.iron === 44, `${b1.hash} ${h2}`);
    // a round 2 save (version 2: a laser drill item, no kit) loads: the kit is on the body, the drill item is gone
    const old = JSON.parse(JSON.stringify(b1)); old.version = 2; const so = old.data.parts.surface; delete so.kit; delete so.matter; delete so.supply; so.inv[30] = ['laser drill', 1]; so.p.heat = 0.25; save.apply(old);
    ok('save migration 2 to 3', K.reactor.state === 'carried' && K.laser.state === 'held' && S.count('laser drill') === 0 && matter.list.length === 0 && S.count('iron') === 37.25 && SUP.targets.iron === TARGETS0.iron); }
  // 18 mass is conserved when the laser digs and when a robot hauls: every kilogram the beam takes out of the field is
  //    loose rock, rock still falling out of the cut, or vapour; a chunk carried to the hold arrives whole
  { save.apply({ version: 3, data: d0 }); S.crash = true; kitReset('carried'); matter.list.length = 0; const x = 80, y = -20, box = [x - 6, y - 6, x + 6, y + 6]; world.box(x - 5, y - 5, x + 5, y + 5, 1, M.BASALT); world.box(x - 5, y - 0.5, x + 5, y + 5, -1); world.box(x + 1, y - 4, x + 3, y - 0.6, -1); world.box(x + 1, y - 4, x + 3, y - 0.6, 1, M.IRON);
    const m0 = world.mass(...box), dug0 = S.stats.dug, vap0 = S.stats.vapor; let sum0 = 0; for (const k in m0) sum0 += m0[k];
    for (let i = 0; i < 240; i++) fireBeam(x - 2 + i * 0.012, y + 2, -Math.PI / 2 + 0.3, 1 / 120, 1, false);
    const m1 = world.mass(...box); let sum1 = 0; for (const k in m1) sum1 += m1[k]; let pend = 0; for (const k in K.pend) pend += K.pend[k];
    const dug = S.stats.dug - dug0, vap = S.stats.vapor - vap0, loose = matter.total(); flushPend(x, y + 1);
    ok('digging conserves mass', dug > 200 && Math.abs(sum0 - sum1 - dug) < 1e-6 && Math.abs(dug - vap - loose - pend) < 1e-6 && Math.abs(matter.total() - loose - pend) < 1e-9 && matter.total('iron ore') > 1, `dug ${dug.toFixed(2)} = vapour ${vap.toFixed(2)} + loose ${loose.toFixed(2)} + in the cut ${pend.toFixed(2)}`);
    const weak = matter.total(), d1 = S.stats.dug; fireBeam(x, y + 2, -Math.PI / 2, 1 / 120, SUIT_BUS_W / LASER_W, false); ok('a starved laser cuts nothing', S.stats.dug === d1 && matter.total() === weak && K.laser.beam.weak === true);
    // hauling: one ship robot, the network up, 23.7 kg of ore on the ground 9 m from the hold
    matter.list.length = 0; robots.length = 0; world.box(-16, 0, 16, 9, -1); world.box(-16, -2, 16, 0, 1, M.BASALT); place('antenna', 4, 0, 1, true); K.awake = false; wakeShipRobots(1); P.x = 30; P.y = 0.1; P.dead = 0; SUP.on = true; SUP.orders = []; K.hold.slots.fill(null);
    const ore = matter.spawn('iron ore', 23.7, -2.5, 0.4); ore.asleep = true; stepKit(1 / 60); let worst = 0, steps = 0;
    while (inv.count(K.hold, 'iron ore') < 23.7 - 1e-6 && steps++ < 60 * 90) { stepRobots(1 / 60); matter.step(1 / 60); worst = Math.max(worst, Math.abs(matter.total('iron ore') + inv.count(robots[0].cargo, 'iron ore') + inv.count(K.hold, 'iron ore') - 23.7)); }
    ok('hauling conserves mass', Math.abs(inv.count(K.hold, 'iron ore') - 23.7) < 1e-6 && worst < 1e-6 && matter.total('iron ore') < 1e-9 && inv.mass(robots[0].cargo) < 1e-9, `hold ${inv.count(K.hold, 'iron ore')} after ${(steps / 60).toFixed(1)} s, worst drift ${worst.toExponential(1)}`);
    robots.length = 0; }
  // 19 power budget with and without the reactor; the load on the body; the reach of the network
  { const src = [{ id: 'reactor', w: REACTOR_W }, { id: 'suit', w: SUIT_BUS_W }], withR = powerBudget(src, [{ id: 'laser', w: LASER_W, from: ['reactor', 'suit'] }, { id: 'charge', w: CHARGE_W, from: ['reactor'] }]), noR = powerBudget(src, [{ id: 'laser', w: LASER_W, from: ['', 'suit'] }]), two = powerBudget(src, [{ id: 'a', w: LASER_W, from: ['reactor'] }, { id: 'b', w: LASER_W, from: ['reactor'] }]);
    ok('power with the reactor', withR.served.laser === 1 && withR.served.charge === 1 && withR.used === LASER_W + CHARGE_W && withR.left.reactor === REACTOR_W - LASER_W - CHARGE_W);
    ok('power without the reactor', Math.abs(noR.served.laser - SUIT_BUS_W / LASER_W) < 1e-12 && noR.served.laser < MIN_FRAC && noR.left.reactor === REACTOR_W && noR.used === SUIT_BUS_W);
    ok('power is not created', two.served.a === 1 && Math.abs(two.served.b - (REACTOR_W - LASER_W) / LASER_W) < 1e-12 && two.used === REACTOR_W);
    // the same through the running kit: laser in hand, reactor still in the wreck 40 m away, then on the back
    S.crash = true; kitReset('carried'); K.reactor.state = 'ship'; P.x = SHIP.bay[0] + 40; P.y = 0.1; P.gx = P.x; P.gy = 1.3; P.wa = -1.2; P.dead = 0; P.act = null; P.bat.wh = 300; P.wantFire = true; const d0b = S.stats.dug; for (let i = 0; i < 30; i++) { P.wantFire = true; stepKit(1 / 120); } const f0 = K.laser.frac, dugNo = S.stats.dug - d0b;
    K.reactor.state = 'carried'; world.box(P.x - 3, -3, P.x + 3, 0, 1, M.BASALT); for (let i = 0; i < 30; i++) { P.wantFire = true; stepKit(1 / 120); } const f1 = K.laser.frac; P.wantFire = false; stepKit(1 / 120);
    ok('laser needs the reactor', f0 < MIN_FRAC && dugNo === 0 && f1 === 1 && S.stats.dug - d0b > 1, `frac ${f0.toFixed(3)} then ${f1}, dug ${(S.stats.dug - d0b).toFixed(1)} kg`);
    const free = mobility(0), heavy = mobility(REACTOR_KG + LASER_KG); ok('the reactor is a burden', free.jet > GRAV && heavy.jet < GRAV && heavy.speed < free.speed * 0.8 && heavy.jump < free.jump * 0.7 && heavy.acc < free.acc, `jet ${heavy.jet.toFixed(1)} of ${GRAV} m/s2, pace ${(heavy.speed / free.speed * 100).toFixed(0)}%`);
    const ant = [{ x: 0, y: 4, range: 70 }], wall = () => true; ok('network range', !!linked(60, 0, ant) && !linked(80, 0, ant) && !linked(60, 0, ant, wall) && !!linked(30, 0, ant, wall) && !linked(5, 0, [])); }
  // 20 stock targets: demand goes to the best producer that stands: the arm first, the furnace once there is one
  { const none = new Set(), fur = new Set(['furnace']), a = planDemand({ iron: 10 }, { iron: 30 }, {}, none), b = planDemand({ iron: 10 }, { iron: 30 }, {}, fur), c = planDemand({ iron: 10 }, { iron: 30 }, { iron: 12 }, fur), d = planDemand({ iron: 30, 'power cell': 1 }, { iron: 30, 'power cell': 2 }, {}, fur);
    ok('demand picks the arm first', a.length === 1 && a[0].producer === 'suit' && a[0].batches === 20 && Math.abs(a[0].inputs['iron ore'] - 32) < 1e-9 && bestProducer(RECIPE.iron, none) === 'suit');
    ok('demand picks the machine once built', b[0].producer === 'furnace' && c[0].batches === 8 && d.length === 1 && d[0].item === 'power cell' && d[0].producer === 'suit' && planDemand({ iron: 30 }, { iron: 30 }, {}, fur).length === 0 && bestProducer(RECIPE['power cell'], new Set(['assembler'])) === 'assembler');
    // through the running AI: ore in the suit and a link: the arm gets the job; a furnace stands: the furnace gets it
    save.apply({ version: 3, data: d0 }); S.crash = true; kitReset('carried'); F.machines.length = 0; F.cells.clear(); matter.list.length = 0; robots.length = 0; S.inv.slots.fill(null); S.printer.q.length = 0; K.hold.slots.fill(null); P.x = SHIP.x + 3; P.y = 0.1; P.dead = 0; SUP.on = true; SUP.targets = { iron: 30 }; inv.add(S.inv, 'iron ore', 20);
    stepKit(1 / 60); SUP.tick = 0; stepSupply(1); const q1 = S.printer.q.map(j => j.r).join(), o1 = SUP.orders[0] && SUP.orders[0].producer;
    S.printer.q.length = 0; const fu = place('furnace', -30, 0, 1, true); SUP.tick = 0; stepSupply(1); const o2 = SUP.orders[0];
    ok('the AI queues the right producer', q1 === 'iron' && o1 === 'suit' && o2.producer === 'furnace' && o2.machine === fu && S.printer.q.length === 0, `${q1} ${o1} then ${o2 && o2.producer}`); SUP.targets = { ...TARGETS0 }; }
  // 21 wary or predator: nothing is hostile by default; what is bigger than you and eats meat hunts you
  { const far = { dist: 40, hurt: false, cornered: false, noise: 0, order: null, hp: 1 }, at = (d, o) => ({ ...far, dist: d, ...o }), st = KIND.strider, sk = KIND.stalker, sc = KIND.scout;
    ok('the herd is wary', stance(st, far) === 'ignore' && stance(st, at(12)) === 'watch' && stance(st, at(6)) === 'flee' && stance(st, at(30, { noise: 20 })) === 'flee' && stance(st, at(1.5, { hurt: true })) === 'defend' && stance(st, at(9, { hurt: true })) === 'flee' && stance(st, at(1.5, { cornered: true })) === 'defend' && stance(KIND.calf, at(1, { hurt: true })) === 'flee');
    ok('the predator hunts', sk.size > PLAYER_SIZE && stance(sk, far) === 'hunt' && stance(sk, at(3)) === 'hunt' && stance(sk, at(3, { hp: 0.2 })) === 'flee' && stance(KIND.grazer, at(3)) !== 'hunt');
    ok('the hive answers, it does not start', stance(sc, at(10)) === 'watch' && stance(sc, at(3)) === 'flee' && stance(sc, at(10, { order: 'probe' })) === 'probe' && stance(sc, at(10, { order: 'attack' })) === 'attack' && stance(sc, at(10, { hurt: true })) === 'attack');
    let only = true; for (const k in KIND) { const q = KIND[k], s0 = stance(q, at(4)); if ((s0 === 'hunt') !== (q.diet === 'prey' && q.size > PLAYER_SIZE) || s0 === 'attack') only = false; } ok('only a larger meat eater hunts unprovoked', only); }
  // 22 heat: what the laser leaves cools, spreads, and never grows
  { heat.clear(); heat.add(100, 5, 0.8, 1.5); const t0 = heat.total(), n0 = heat.cells.size; let mono = true, prev = t0, grew = false; for (let i = 0; i < 90; i++) { heat.step(1 / 30 + 1e-9); const t = heat.total(); if (t > prev + 1e-9) mono = false; prev = t; if (i === 5) grew = heat.cells.size > n0; }
    ok('heat cools and spreads', t0 > 5 && mono && prev < t0 * 0.75 && prev > 0 && heat.at(100, 5) > 0 && heat.at(100, 5) < 1.5 && grew, `${t0.toFixed(1)} -> ${prev.toFixed(1)}`); heat.clear(); }
  save.apply({ version: 3, data: d0 }); S.crash = undefined;
  const msg = fails.length ? `tests FAIL ${fails.length}/${n}: ${fails.join('; ')}` : `tests ok ${n}`;
  console.log(msg); window.__tests = msg;
  const d = document.createElement('div'); d.style.cssText = 'position:fixed;left:24px;bottom:184px;font:11px ui-monospace,monospace;color:#9fb3bf;letter-spacing:.08em;text-transform:uppercase'; d.textContent = msg; document.body.appendChild(d);
}

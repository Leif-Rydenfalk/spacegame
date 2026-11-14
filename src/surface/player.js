// the player: a physics body on the density field (three circles that the field pushes out), and on top of it a body
// that moves like a person. The legs are not an animation: each foot is planted in the world and steps when the hip
// has left it behind, onto the ground that is really there; the pelvis hangs as high as the planted legs allow, on a
// spring; the torso leans into acceleration and against a heavy pack; breath follows exertion; a hard landing or a bad
// foothold makes it stumble; a hand reaches for what it works on. The weapon is heavy: it swings after the aim, late.
// Carrying the reactor (140 kg) changes all of it. Suit: battery, oxygen, jet propellant, the arm's matter compiler.
import { G, input, events, clamp, rand, lerp, angDiff, TAU } from '../core.js';
import { audio } from '../audio.js';
import { world, TS, GRAV, M, MAT, surfaceH } from './world.js';
import { LAVA_Y } from './gen.js';
import { light } from './light.js';
import { heat } from './heat.js';
import { heatAt } from './terrain.js';
import { S, C, mul } from './state.js';
import { env } from './env.js';
import { ITEMS, RECIPE, inv, printerStep, CARRY } from '../items.js';
import { creatures, hurtCreature, ik2 } from './creatures.js';
import { floraHit, floraBlast } from './flora.js';
import { F } from './factory.js';
import { matter } from './matter.js';
import { mobility, REACTOR_KG } from './power.js';
import { deckUnder, deckStep } from './layers.js';
import { cursorKind, thingAt } from './blueprint.js';
import { K, kitKg, hasLaser, hasReactor, drawReactor, drawLaser } from './kit.js';

export const SUIT = { bat: 600, o2: 1.2, prop: 2.0, lampW: 15, rtgW: 40, o2Rate: 0.0012, jetRate: 0.18, gather: 28, reach: 1.7 };
export const WEAPON = {
  rifle: { ammo: 'rifle rounds', mag: 30, cool: 0.105, v0: 820, n: 1, spread: 0.006, dmg: 22, kick: 0.55, rec: 0.016, reload: 1.6, noise: 75, len: 1.05 },
  shotgun: { ammo: 'shells', mag: 6, cool: 0.85, v0: 400, n: 9, spread: 0.07, dmg: 9, kick: 3.2, rec: 0.1, reload: 2.2, noise: 90, len: 0.9 },
};
const foot = () => ({ x: 0, y: 0, t: -1, sx: 0, sy: 0, tx: 0, ty: 0, air: true });
export const P = { x: 0, y: 0, vx: 0, vy: 0, ground: false, face: 1, hp: 100, bat: { wh: SUIT.bat, cap: SUIT.bat }, o2: SUIT.o2, prop: SUIT.prop, slot: 0, aim: 0, mag: { rifle: 30, shotgun: 6 }, reload: 0, cool: 0, dead: 0, shots: 0, flashT: 0, air: 0,
  hurtT: 0, recoil: 0, bloom: 0, ads: 0, hitT: 0, weapon: null, charging: false, wa: 0, wv: 0, gx: 0, gy: 1.3, act: null, wantFire: false, exert: 0, stumble: 0, load: 0, reach: null, gatherT: 0,
  rig: { f: [foot(), foot()], py: 0.88, pv: 0, lean: 0, lv: 0, lvx: 0, ax: 0, breath: 0, sdir: 1, head: 0 } };
const R = 0.3, nv = [0, 0], HIP0 = 0.88, THIGH = 0.46, SHIN = 0.46;
export function spawnAt(x) { P.x = x; P.y = (world.groundY(x, surfaceH(x) + 6, 0, 30) || surfaceH(x)) + 0.05; P.vx = P.vy = 0; P.hp = 100; P.dead = 0; P.prop = SUIT.prop; P.o2 = SUIT.o2; P.bat.wh = Math.max(P.bat.wh, 200); P.act = null; P.stumble = 0; for (const f of P.rig.f) f.air = true; safe.x = P.x; safe.y = P.y; safe.ok = bodyDepth() < 0.03; }
export function hurt(d, kx = 0, ky = 0) {
  if (P.dead) return; P.hp -= d; P.vx += kx; P.vy += ky; S.flash = Math.min(1, S.flash + d / 30); G.shake += d * 0.012; P.hurtT = 0.5; audio.play('hit'); if (d > 4) stumble(0.35 + d * 0.01, Math.sign(kx) || -P.face);
  if (P.dead) return;
  if (P.hp <= 0) { P.dead = 3; S.corpse = { x: P.x, y: P.y, inv: inv.dump(S.inv) }; S.inv.slots.fill(null); S.printer.q.length = 0; P.act = null; events.emit('died'); }
}
function stumble(t, dir) { if (P.stumble > 0.1) return; P.stumble = t; P.rig.sdir = dir || Math.sign(P.vx) || P.face; P.rig.pv -= 1.6; P.rig.lv += P.rig.sdir * 2.2; P.vx *= 0.55; P.exert = Math.min(1, P.exert + 0.2); }
// The body against the ground. It is a capsule 0.6 m wide and 1.8 m tall, felt at eighteen points on its outline: five
// under the feet, ten up the sides, three over the head. A point that is inside rock is pushed out along the field's
// gradient there, deepest first. Only the sign of the field and its slope at the surface are used, never a distance
// read far from it, so worked ground (cut, filled, built on) holds exactly like untouched ground. The move is cut into
// steps of at most 8 cm, so no speed carries the body through a floor; and if it ever ends up deep in rock all the
// same (ground placed on top of it), it goes back to the last place where it was free.
const OUT = [[0, 0, 0], [-0.15, 0.04, 0], [0.15, 0.04, 0], [-0.26, 0.15, 0], [0.26, 0.15, 0], [-0.3, 0.32, 1], [0.3, 0.32, 1], [-0.3, 0.6, 1], [0.3, 0.6, 1], [-0.3, 0.9, 1], [0.3, 0.9, 1], [-0.3, 1.2, 1], [0.3, 1.2, 1], [-0.3, 1.5, 1], [0.3, 1.5, 1], [-0.21, 1.71, 2], [0.21, 1.71, 2], [0, 1.8, 2]];
const safe = { x: 0, y: 0, ok: false }, brace = [0, 0, 0], still = { x: 0, y: 0, t: 0 };
// how deep the deepest outline point is in rock (m, 0 when the body is free)
export function bodyDepth(x = P.x, y = P.y) { let w = 0; for (const o of OUT) { const v = world.dens(x + o[0], y + o[1]); if (v > w) w = v; } return w; }
const air = (x, y) => world.dens(x, y) < 0;
// is the thing in the way low enough to step onto? The body, half a metre higher and a little further on, must be free.
const canStep = dir => air(P.x + dir * 0.25, P.y + 0.58) && air(P.x + dir * 0.5, P.y + 0.85) && air(P.x + dir * 0.25, P.y + 1.4) && air(P.x, P.y + 2.3);
// returns true when the feet rest on walkable ground. walk = the direction the legs push in (-1, 0, 1)
function resolve(walk) {
  let ground = false, hold = 0;
  for (let it = 0; it < 5; it++) {
    let worst = 0, wi = -1; for (let i = 0; i < OUT.length; i++) { const v = world.dens(P.x + OUT[i][0], P.y + OUT[i][1]); if (v > worst) { worst = v; wi = i; } }
    if (wi < 0) break; const o = OUT[wi], px = P.x + o[0], py = P.y + o[1], depth = Math.min(worst, 0.15) + 0.0005;
    if (world.normal(px, py, nv) < 0.05) { nv[0] = o[2] === 1 ? -Math.sign(o[0]) : 0; nv[1] = o[2] === 0 ? 1 : o[2] === 2 ? -1 : 0; }
    if (o[1] < 0.35 && nv[1] > 0.7) { P.y += depth / nv[1]; if (P.vy < 0) P.vy = 0; ground = true; }                                   // walkable under a foot (or under the hip, caught on a rim): straight up, so standing on a slope does not creep
    else if (o[1] < 0.4 && walk && -Math.sign(nv[0]) === walk && Math.abs(nv[0]) > 0.3 && nv[1] > -0.3 && P.vy < 1 && canStep(walk)) { P.y += Math.min(depth + 0.02, 0.07); if (P.vy < 0) P.vy = 0; ground = true; }      // a low step or a steep bank the legs can take
    else { P.x += nv[0] * depth; P.y += nv[1] * depth; const vn = P.vx * nv[0] + P.vy * nv[1]; if (vn < 0) { P.vx -= nv[0] * vn; P.vy -= nv[1] * vn; } hold |= o[1] < 0.65 && nv[1] > 0.3 ? 4 : nv[0] > 0.3 ? 1 : nv[0] < -0.3 ? 2 : 0; }
  }
  // braced: a foot on a steep hold, or rock against both sides, and the body has come to a stop. That is a place to
  // push off from, so a body wedged in a narrow cut can jump and climb instead of hanging there for good.
  // (the two sides seldom touch in the same step, so each hold is remembered for a fifth of a second)
  if (hold & 1) brace[0] = 0.2; if (hold & 2) brace[1] = 0.2; if (hold & 4) brace[2] = 0.2;
  if (!ground && (brace[2] > 0 || (brace[0] > 0 && brace[1] > 0)) && P.vx * P.vx + P.vy * P.vy < 0.4) ground = true;
  return ground;
}
// one frame of motion: short steps, the ground, the decks. Returns true when the feet are on something.
function moveBody(dt, walk, drop) {
  const n = Math.max(1, Math.ceil(Math.hypot(P.vx, P.vy) * dt / 0.08)), h = dt / n; let g = false; P.onDeck = false; brace[0] -= dt; brace[1] -= dt; brace[2] -= dt;
  for (let i = 0; i < n; i++) {
    const y0 = P.y; P.x += P.vx * h; P.y += P.vy * h; g = resolve(walk) || g;
    if (P.vy <= 0 && !drop) { const dk = deckUnder(P.x, y0, P.y); if (dk !== null) { P.y = dk; P.vy = 0; g = true; P.onDeck = true; } }
    if (walk && !drop && P.vy <= 0.5) { const up = deckStep(P.x, P.y, walk); if (up !== null && bodyDepth(P.x + walk * 0.1, up + 0.02) < 0.03) { P.y = up; P.x += walk * 0.02; P.vy = 0; g = true; P.onDeck = true; } }      // onto a deck that is a low step up
    const dp = bodyDepth();
    if (dp < 0.03) { safe.x = P.x; safe.y = P.y; safe.ok = true; }
    else if (dp > 0.2) { if (safe.ok && Math.hypot(safe.x - P.x, safe.y - P.y) < 2.5) { P.x = safe.x; P.y = safe.y; } else P.y += 0.12; P.vx = P.vy = 0; break; }      // never left inside rock
  }
  // standing is not the same as touching in this very step: resting on the ground the body is pushed a hair clear of it
  // and takes a step or two to sink back. Walkable rock within 3 cm under a foot point is ground.
  if (!g && P.vy <= 0.2 && P.vy > -1.5) for (let i = 0; i < 7 && !g; i++) { const px = P.x + OUT[i][0], py = P.y + OUT[i][1] - 0.03; if (world.dens(px, py) > 0 && world.normal(px, py, nv) > 0.05 && nv[1] > 0.7) g = true; }
  return g;
}
// the ground a foot can stand on near (x, y): rock, or the deck the body is on
function footY(x, y) { const gy = world.groundY(x, y, 0.3, 1.6); if (P.onDeck) { const dk = deckUnder(x, P.y + 0.3, P.y - 0.3, 0.02); if (dk !== null && (gy === null || dk > gy)) return dk; } return gy; }
const gunMuzzle = (l = 0.95) => [P.gx + Math.cos(P.aim) * l, P.gy + Math.sin(P.aim) * l];
const heldWeapon = () => { const s = S.inv.slots[P.slot]; if (s && ITEMS[s.id].weapon) return s.id; const i = S.inv.slots.findIndex((q, j) => j < 9 && q && ITEMS[q.id].weapon); if (i >= 0) { P.slot = i; return S.inv.slots[i].id; } return null; };
export function setMode(m) { S.mode = S.mode === m ? 'build' : m; S.plan = null; S.tool = null; audio.play('click'); if (S.mode === 'combat' && !heldWeapon() && !hasLaser()) S.say('unarmed: the ship laser is the only weapon'); }
S.drop = (id, n) => matter.spawn(id, n, P.x + P.face * 0.45, P.y + 1.0, P.face * 1.3 + P.vx, 1.2);

export function stepPlayer(dt) {
  S.flash = Math.max(0, S.flash - dt * 1.5); P.hurtT = Math.max(0, P.hurtT - dt); P.flashT -= dt; P.cool -= dt; P.hitT -= dt; S.msgT -= dt; P.stumble = Math.max(0, P.stumble - dt);
  for (let i = S.gains.length - 1; i >= 0; i--) if ((S.gains[i].t -= dt) <= 0) S.gains.splice(i, 1);
  P.wantFire = false; P.reach = null;
  if (P.dead > 0) { P.dead -= dt; audio.loop('engine', 0); if (P.dead <= 0) { const pr = F.printer; if (pr) { P.x = (pr.x + pr.w / 2) * TS + 1.4; P.y = pr.y * TS + 0.1; P.vx = P.vy = 0; P.hp = 100; P.dead = 0; P.o2 = SUIT.o2; P.prop = SUIT.prop; P.bat.wh = SUIT.bat; } else spawnAt(0); if (K.laser.state === 'held' || K.reactor.state === 'carried') { /* the kit stays where the body fell: go and get it */ if (K.reactor.state === 'carried' && S.corpse) { K.reactor.state = 'ground'; K.reactor.x = S.corpse.x; K.reactor.y = S.corpse.y + 0.3; K.reactor.vy = 0; } if (K.laser.state === 'held' && S.corpse) { K.laser.state = 'turret'; K.laser.x = S.corpse.x + 0.8; K.laser.y = S.corpse.y; K.laser.ang = 0.2; } } } return; }
  const ui = S.uiOpen, busy = !!P.act, combat = S.mode === 'combat', ads = combat && input.down[2] && !ui;
  P.ads += ((ads ? 1 : 0) - P.ads) * Math.min(1, dt * 9);
  const load = P.load = inv.mass(S.inv) + kitKg(), mob = P.mob = mobility(load), sprint = input.key('Shift') && !ads;
  const ax = ui || busy ? 0 : (input.key('d') ? 1 : 0) - (input.key('a') ? 1 : 0), max = (sprint ? mob.sprint : mob.speed) * (1 - 0.45 * P.ads) * (P.stumble > 0 ? 0.4 : 1), acc = P.ground ? mob.acc : 6;
  if (ax) { if (P.vx * ax < max) P.vx = clamp(P.vx + ax * acc * dt, -Math.max(max, Math.abs(P.vx)), Math.max(max, Math.abs(P.vx))); }
  if (P.ground && (!ax || P.vx * ax < 0 || Math.abs(P.vx) > max)) P.vx -= Math.sign(P.vx) * Math.min(Math.abs(P.vx), (16 - 5 * mob.k) * dt);
  P.air = P.ground ? 0 : P.air + dt;
  const up = !ui && !busy && (input.key('w') || input.key(' '));
  let jumped = false; if (up && P.ground && P.stumble <= 0) { P.vy = mob.jump; P.ground = false; jumped = true; P.exert = Math.min(1, P.exert + 0.08 + mob.k * 0.15); P.rig.pv += 1.2; }
  let jet = false;
  if (!ui && !busy && input.key(' ') && !P.ground && P.air > 0.22 && P.prop > 0) { jet = true; P.vy += mob.jet * dt; P.prop = Math.max(0, P.prop - SUIT.jetRate * dt); env.noise(P.x, P.y, 22); }
  if (P.ground && P.prop < SUIT.prop && P.bat.wh > 1) { const k = Math.min(SUIT.prop - P.prop, 0.45 * dt); P.prop += k; P.bat.wh -= k * 1.5; }      // intake compressor: 1.5 Wh per kg
  if (jet) {
    for (let i = 0; i < 2; i++) S.parts.spawn({ x: P.x - P.face * 0.22, y: P.y + 0.85, vx: P.vx + rand(-1, 1), vy: P.vy - rand(7, 12), life: rand(0.12, 0.3), size: rand(0.08, 0.2), c: [3, 1.6, 0.6], c2: [0.8, 0.1, 0.02], grav: 0 });
    light.emit(P.x / TS, P.y / TS + 1, 0.9, 0.45, 0.15); if (Math.random() < dt * 20) floraBlast(P.x, P.y - 1, 2.5, 0.6);
  }
  audio.loop('engine', jet ? 0.35 : 0, 240);
  P.vy -= GRAV * dt; P.vy = Math.max(P.vy, -60);
  const was = P.ground, vy0 = P.vy, drop = !ui && input.key('s'); let g = moveBody(dt, ax, drop);
  // walking down a slope the feet keep the ground: a short look under them, in the rock itself (decks are passed above)
  if (!g && was && !jumped && P.vy <= 0.5 && !drop) { for (let d = 0.03; d <= 0.24; d += 0.03) if (world.dens(P.x, P.y - d) > 0) { world.normal(P.x, P.y - d, nv); if (nv[1] > 0.7) { P.y -= d - 0.03; P.vy = Math.min(P.vy, 0); g = resolve(0) || true; } break; } }
  // and the last word: a body that gravity has not moved for a quarter of a second is held up by something, whatever
  // shape it is. That is standing, so there is no place the body can come to rest and not be able to jump from.
  if (Math.abs(P.x - still.x) + Math.abs(P.y - still.y) > 0.012) { still.x = P.x; still.y = P.y; still.t = 0; } else still.t += dt;
  if (!g && still.t > 0.25 && P.vy <= 0.2 && !drop) g = true;
  if (g && !was) { const imp = -vy0; if (imp > 3) { audio.play('thud'); dust(P.x, P.y, 4 + imp); env.noise(P.x, P.y, 8 + imp + mob.k * 8); P.rig.pv -= imp * (0.45 + mob.k * 0.5); floraBlast(P.x, P.y, 2, imp * 0.5); } if (imp > 5.2 - 1.8 * mob.k) stumble(0.25 + (imp - 4) * 0.05 + mob.k * 0.3); if (imp > 11 - 3 * mob.k) hurt((imp - 11 + 3 * mob.k) * (imp - 11 + 3 * mob.k) * 1.8); }
  P.ground = g;
  if (P.y < LAVA_Y + 0.3 && !world.solidAt(P.x, P.y + 0.5)) hurt(60 * dt);
  if (g && heat.at(P.x, P.y - 0.1) > 0.75) hurt(22 * dt);                              // molten ground
  P.exert = clamp(P.exert + dt * ((sprint && ax ? 0.14 : 0) + (ax ? mob.k * 0.1 : 0) - 0.07), 0, 1);
  P.bloom = Math.max(0, P.bloom - dt * 0.09); P.recoil *= Math.exp(-dt * 9);
  P.aim = Math.atan2(S.mouse.y - (P.y + 1.36), S.mouse.x - P.x) + P.recoil * (Math.cos(P.aim) >= 0 ? 1 : -1); P.face = Math.cos(P.aim) >= 0 ? 1 : -1;
  // suit: oxygen, battery, cells, the arm's matter compiler
  P.o2 = Math.max(0, P.o2 - SUIT.o2Rate * (1 + P.exert * 0.6) * dt); if (P.o2 <= 0) hurt(4 * dt);
  P.bat.wh = Math.min(P.bat.cap, P.bat.wh + SUIT.rtgW * dt / 3600); if (light.lamp.on) P.bat.wh = Math.max(0, P.bat.wh - SUIT.lampW * dt / 3600);
  if (P.o2 < 0.12 && inv.take(S.inv, 'o2 cell', 1) > 0) { P.o2 = SUIT.o2; S.say('o2 cell used'); events.emit('used', 'o2 cell'); }
  if (P.bat.wh < 25 && inv.take(S.inv, 'power cell', 1) > 0) { P.bat.wh = Math.min(P.bat.cap, P.bat.wh + 400); S.say('power cell used'); events.emit('used', 'power cell'); }
  P.charging = false; for (const m of F.machines) if ((m.kind === 'hub' || m.kind === 'bio-printer') && Math.hypot((m.x + m.w / 2) * TS - P.x, m.y * TS - P.y) < 4) P.charging = true;
  if (P.charging) { P.bat.wh = Math.min(P.bat.cap, P.bat.wh + 3000 * dt / 3600 * 20); P.o2 = Math.min(SUIT.o2, P.o2 + 0.05 * dt); }
  const done = printerStep(S.printer, S.inv, dt, P.bat, CARRY - inv.mass(S.inv) + 200);
  if (done) { S.gain(done, 0.0001); audio.play('place'); events.emit('suitPrinted'); if (ITEMS[done].build) events.emit('firstMachinePrinted'); if (S.printer.over) { for (const k in S.printer.over) S.drop(k, S.printer.over[k]); S.printer.over = null; } }
  // hotbar
  if (!ui) { for (let i = 0; i < 9; i++) if (input.hit(String(i + 1))) { P.slot = i; S.plan = null; } if (input.wheel) { P.slot = (P.slot + (input.wheel > 0 ? 1 : 8)) % 9; S.plan = null; } }
  if (input.hit('l') && !ui) light.lamp.on = !light.lamp.on;
  if (input.hit('c') && !ui) setMode('combat');
  // hands: the laser (kit.js fires it), placing terrain, gathering loose matter, dropping what is held
  const wn = combat ? heldWeapon() : null; P.weapon = wn;
  // the hands. With something placeable on the cursor the left button places it (blueprint.js); with nothing on it the
  // left button is the ship laser. The right button lays the selected soil, basalt or plate as ground, unless it is over
  // something it would remove instead. Z drops the selected stack.
  const cur = combat ? null : cursorKind(), gx = Math.floor(S.mouse.x / TS), gy = Math.floor(S.mouse.y / TS);
  if (!ui && !busy && input.down[0] && hasLaser() && !cur && !S.tool && (!combat || !wn)) P.wantFire = true;
  if (!ui && !busy && !combat) {
    const sl = S.inv.slots[P.slot], pm = sl && ITEMS[sl.id].place;
    if (input.down[2] && pm && !S.plan && !thingAt(gx, gy) && Math.hypot(S.mouse.x - P.x, S.mouse.y - P.y - 0.9) < 6) placeMat(sl, pm, dt);
    if (input.hit('z') && sl) { const d = ITEMS[sl.id], n = d.u === 'ea' ? 1 : d.u === 'rd' ? Math.min(sl.n, 30) : Math.min(sl.n, 15 / d.m); S.drop(sl.id, inv.take(S.inv, sl.id, n)); audio.play('thud'); events.emit('dropped'); }
  }
  if (!ui && !busy && input.key('v')) gather(dt); else P.gatherT = 0;
  if (!ui && combat) {
    const wp = wn && WEAPON[wn];
    if (wp) {
      if (P.reload > 0) { P.reload -= dt; if (P.reload <= 0) { const got = inv.take(S.inv, wp.ammo, wp.mag - P.mag[wn]); P.mag[wn] += Math.round(got); } }
      else if ((input.hit('r') && P.mag[wn] < wp.mag) || (input.down[0] && P.mag[wn] <= 0)) { if (S.count(wp.ammo) >= 1) { P.reload = wp.reload; audio.play('click'); } else if (input.clicked[0] || input.hit('r')) { S.say('no ' + wp.ammo); audio.play('click'); } }
      else if (input.down[0] && P.cool <= 0 && P.mag[wn] > 0) fire(wn);
    }
  } else P.reload = 0;
  // corpse recovery
  if (S.corpse && Math.hypot(S.corpse.x - P.x, S.corpse.y - P.y) < 1.2) { for (const s of S.corpse.inv) if (s) { const left = S.add(s[0], s[1]); if (left > 1e-6) S.drop(s[0], left); } S.corpse = null; audio.play('click'); }
  P.printing = S.printer.q.length > 0 && P.ground && Math.abs(P.vx) < 0.5 && !P.wantFire && !K.laser.firing && !P.act && !P.reach && !(combat && wn) && !S.printer.stall;     // the arm is at work: the weapon hangs in the other hand
  stepRig(dt, mob, ax);
  const hx = P.x + Math.sin(P.rig.lean) * 0.8, hy = P.y + P.rig.py + 0.78;
  light.lamp.x = hx / TS + Math.cos(P.aim) * 0.5; light.lamp.y = hy / TS + Math.sin(P.aim) * 0.5; light.lamp.ang = P.aim; light.lamp.k = (P.hurtT > 0 ? (Math.random() < 0.5 ? 0.2 : 1) : 1) * (P.bat.wh > 0 ? 1 : 0.15);
}
// hold V: the hands take loose matter within reach into the suit, as fast as hands can, as much as the suit carries
function gather(dt) {
  const c = matter.near(P.x + P.face * 0.3, P.y + 0.5, SUIT.reach, q => !q.claim); if (!c) { P.gatherT = 0; return; }
  P.reach = { x: c.x, y: c.y }; if (c.temp > 0.7) { if (S.msgT <= 0) S.say('too hot to carry yet', 1.2); return; }
  const d = ITEMS[c.id]; P.gatherT += dt; let n = d.u === 'ea' ? (P.gatherT > 0.45 ? 1 : 0) : Math.min(c.n, SUIT.gather * dt / d.m); if (!n) return; if (d.u === 'ea') P.gatherT = 0;
  const left = S.add(c.id, n), got = n - left; if (got > 1e-9) { matter.take(c, got); S.gain(c.id, got); P.exert = Math.min(1, P.exert + dt * 0.15); if (Math.random() < dt * 6) audio.play('step'); events.emit('gathered', c.id); } else if (S.msgT <= 0) S.say('the suit carries no more', 1.5);
}
// the body: feet that step on real ground, a sprung pelvis, a torso that leans, a heavy weapon that follows late
function stepRig(dt, mob, ax) {
  const g = P.rig, sp = Math.abs(P.vx), mv = sp > 0.3 ? Math.sign(P.vx) : 0, k = mob.k, F2 = g.f;
  const stride = (0.36 + 0.075 * sp) * (1 - 0.22 * k), T = clamp(0.34 - 0.017 * sp, 0.17, 0.34) * (1 + 0.35 * k);
  for (let i = 0; i < 2; i++) {
    const f = F2[i], o = F2[1 - i];
    if (!P.ground) { const tx = P.x - P.vx * 0.035 + (i ? 0.12 : -0.1) * P.face, ty = P.y + 0.1 + (i ? 0.07 : 0) + clamp(-P.vy * 0.012, -0.08, 0.2), q = Math.min(1, dt * 16); f.x += (tx - f.x) * q; f.y += (ty - f.y) * q; f.t = -1; f.air = true; continue; }
    if (f.air) { f.air = false; f.x = P.x + (i ? 0.14 : -0.12) * P.face; f.y = footY(f.x, P.y + 0.7) ?? P.y; f.t = -1; }
    if (f.t >= 0) {
      f.t += dt / T; const u = Math.min(1, f.t), e = u * u * (3 - 2 * u); f.tx += P.vx * dt * 0.45;
      f.x = lerp(f.sx, f.tx, e); f.y = lerp(f.sy, f.ty, e) + Math.sin(u * Math.PI) * (0.09 + 0.035 * sp) * (1 - 0.4 * k);
      if (u >= 1) { f.t = -1; f.y = footY(f.x, P.y + 0.7) ?? f.ty; if (sp > 0.5) { audio.play('step'); env.noise(P.x, P.y, (sp > 7 ? 9 : 5) + k * 6); if (k > 0.4) G.shake = Math.max(G.shake, 0.012); if (Math.random() < 0.3 + k * 0.5) dust(f.x, f.y, 1); } }
    } else {
      const home = P.x + (i ? 0.14 : -0.12) * P.face, lag = (P.x - f.x) * mv, far = Math.hypot(f.x - P.x, f.y - (P.y + HIP0)) > 0.93;
      if ((mv ? lag > stride * 0.5 : Math.abs(f.x - home) > 0.11 && sp < 0.3) || far) {
        if (o.t < 0 || far) { f.t = 0; f.sx = f.x; f.sy = f.y; f.tx = mv ? P.x + mv * stride * 0.5 + P.vx * T * 0.8 : home; f.ty = footY(f.tx, P.y + 0.7) ?? P.y;
          if (mv && sp > 4.2 - k && Math.abs(f.ty - P.y) > 0.4 && Math.random() < 0.35 + k * 0.4) stumble(0.3 + k * 0.25, mv); }
      }
    }
  }
  // the pelvis hangs as high as the planted legs allow, on a spring that the load makes softer
  let hip = HIP0 - k * 0.035 - (P.stumble > 0 ? 0.16 * Math.min(1, P.stumble * 4) : 0) - (P.act ? 0.1 : 0) - (P.reach ? 0.2 : 0);
  if (P.ground) for (const f of F2) if (f.t < 0) { const dx = f.x - P.x; hip = Math.min(hip, f.y - P.y + Math.sqrt(Math.max(0.25, 0.9 * 0.9 - dx * dx))); }
  g.pv += ((hip - g.py) * 170 / (1 + k * 0.9) - g.pv * 21) * dt; g.py = clamp(g.py + g.pv * dt, 0.52, 0.93);
  const accx = (P.vx - g.lvx) / dt; g.lvx = P.vx; g.ax = lerp(g.ax, clamp(accx, -40, 40), Math.min(1, dt * 9));
  const leanT = clamp(P.vx * 0.024 + g.ax * 0.007, -0.34, 0.34) + (hasReactor() ? 0.13 * P.face : 0) + (P.stumble > 0 ? g.sdir * 0.45 * Math.min(1, P.stumble * 5) : 0) + (P.act ? clamp((P.act.x - P.x) * 0.25, -0.3, 0.3) : P.reach ? clamp((P.reach.x - P.x) * 0.3, -0.35, 0.35) : 0);
  g.lv += ((leanT - g.lean) * 75 - g.lv * 13) * dt; g.lean = clamp(g.lean + g.lv * dt, -0.7, 0.7);
  g.breath += dt * (1.5 + P.exert * 4.5); g.head = lerp(g.head, clamp(Math.sin(P.aim), -0.6, 0.6), Math.min(1, dt * 8));
  // the weapon swings after the aim: a heavy thing on two arms
  const heavy = hasLaser(), rest = P.act || P.stumble > 0.15 || P.reach || P.printing ? (P.face > 0 ? -0.95 : Math.PI + 0.95) : P.aim, d = angDiff(rest, P.wa), ks = heavy ? 85 : 240, kd = heavy ? 15 : 26;
  P.wv += (d * ks - P.wv * kd) * dt; P.wa += P.wv * dt;
  const shx = P.x + Math.sin(g.lean) * 0.52, shy = P.y + g.py + Math.cos(g.lean) * 0.52;
  P.gx = shx + Math.cos(P.wa) * 0.26 - P.recoil * 2 * Math.cos(P.wa); P.gy = shy - 0.15 + Math.sin(P.wa) * 0.22 + Math.sin(g.breath) * 0.006;
}
// RMB with soil, basalt or plate in the selected slot: a smooth brush that spends exactly what it adds
function placeMat(sl, mat, dt) {
  const x = S.mouse.x, y = S.mouse.y; if (Math.abs(x - P.x) < 0.75 && y > P.y - 0.4 && y < P.y + 2.2) return;
  const rho = MAT[mat].rho * 0.02, r = Math.min(0.34, Math.sqrt(sl.n / (Math.PI * rho * 1.35))); if (r < 0.08) return;
  const acc = {}; world.fill(x, y, r, mat, dt * 2.2, acc); P.reach = { x, y };
  for (const k in acc) { if (acc[k] < 0) inv.take(S.inv, sl.id, -acc[k]); else if (MAT[k].item) { const left = S.add(MAT[k].item, acc[k]); if (left > 1e-6) S.drop(MAT[k].item, left); } }
  if (Math.random() < dt * 20) dust(x, y, 1);
}
function dust(x, y, n) { for (let i = 0; i < n; i++) S.parts.spawn({ x: x + rand(-0.3, 0.3), y: y + rand(0, 0.15), vx: rand(-1.6, 1.6), vy: rand(0.1, 1.4), life: rand(0.6, 1.6), size: rand(0.12, 0.3), grow: 1.5, c: [0.16, 0.15, 0.16], mode: 1, a: 0.35, grav: 0.05, drag: 2 }); }
export function fire(kind) {
  const wp = WEAPON[kind], [mx, my] = gunMuzzle(wp.len), sp = (wp.spread + P.bloom) * (1 - 0.6 * P.ads) * (P.ground ? 1 : 1.8);
  P.mag[kind]--; P.cool = wp.cool; P.shots++; S.stats.shots++; P.flashT = 0.045;
  for (let i = 0; i < wp.n; i++) { const a = P.aim + rand(-sp, sp); S.bullets.push({ x: mx, y: my, vx: Math.cos(a) * wp.v0 * rand(0.97, 1.03) + P.vx, vy: Math.sin(a) * wp.v0 + P.vy, life: 2.2, tr: kind === 'rifle' ? P.shots % 3 === 0 : i % 3 === 0, dmg: wp.dmg, px: mx, py: my }); }
  P.vx -= Math.cos(P.aim) * wp.kick; P.vy -= Math.sin(P.aim) * wp.kick * 0.6; G.shake += kind === 'rifle' ? 0.05 : 0.2; P.recoil += wp.rec * (1 - 0.4 * P.ads); P.bloom = Math.min(0.05, P.bloom + wp.rec * 0.35);
  env.noise(P.x, P.y + 1, wp.noise);
  S.parts.spawn({ x: P.x, y: P.y + 1.4, vx: P.vx - P.face * rand(1.5, 3), vy: rand(2.5, 4.5), life: 20, fade: 0, size: 0.05, asp: 2.6, c: kind === 'rifle' ? C.brass : [0.4, 0.1, 0.08], mode: 1, shape: 0, col: 1, bounce: 0.45, spin: rand(-30, 30), hit: () => audio.play('tink') });
  for (let i = 0; i < 5; i++) S.parts.spawn({ x: mx, y: my, vx: Math.cos(P.aim) * rand(4, 30) + rand(-3, 3), vy: Math.sin(P.aim) * rand(4, 30) + rand(-3, 3), life: rand(0.04, 0.12), size: rand(0.03, 0.08), c: [4, 2.6, 1], grav: 0 });
  S.parts.spawn({ x: mx, y: my, vx: P.vx, vy: 0.6, life: 1.4, size: 0.25, grow: 3, c: [0.2, 0.2, 0.2], mode: 1, a: 0.25, grav: -0.03, drag: 1.5 });
  audio.play(kind === 'rifle' ? 'shot' : 'shotgun');
}
export function stepBullets(dt) {
  const B = S.bullets; let w = 0;
  for (let i = 0; i < B.length; i++) {
    const b = B[i]; b.life -= dt; if (b.life <= 0) continue;
    const sp = Math.hypot(b.vx, b.vy), dr = 0.0006 * sp; b.vx -= b.vx * dr * dt; b.vy -= (b.vy * dr + GRAV * (b.g || 1)) * dt;   // quadratic drag, gravity
    b.px = b.x; b.py = b.y;
    const n = Math.max(1, Math.ceil(sp * dt / 0.15)), sx = b.vx * dt / n, sy = b.vy * dt / n; let dead = false;
    for (let s = 0; s < n && !dead; s++) {
      b.x += sx; b.y += sy;
      if (world.solidAt(b.x, b.y)) {
        dead = true; const k = world.matAt(b.x, b.y), ix = b.x - sx, iy = b.y - sy, soft = k === M.SOIL || k === M.HIVE;
        if (b.acid) { world.dig(b.x, b.y, 0.3, 0, undefined, q => q === M.XENO || q === M.STEEL); for (let j = 0; j < 8; j++) S.parts.spawn({ x: ix, y: iy, vx: rand(-3, 3), vy: rand(0, 4), life: rand(0.4, 1.4), size: rand(0.04, 0.09), c: mul(C.acid, 2.5), c2: mul(C.acid, 0.3), col: 1, bounce: 0.1 }); continue; }
        for (let j = 0; j < (soft ? 3 : 9); j++) S.parts.spawn({ x: ix, y: iy, vx: -b.vx * rand(0.004, 0.02) + rand(-5, 5), vy: -b.vy * rand(0.004, 0.02) + rand(-3, 7), life: rand(0.15, 0.7), size: rand(0.025, 0.06), c: [4, 2.2, 0.7], c2: [0.7, 0.1, 0.02], col: 1, bounce: 0.5 });
        dust(ix, iy, soft ? 5 : 2); S.lights.push({ x: b.x / TS, y: b.y / TS, c: [0.9, 0.5, 0.2], t: 0.05 }); audio.play('tink'); env.noise(b.x, b.y, 14);
        world.dig(b.x, b.y, soft ? 0.16 : 0.09, 0, undefined, q => q >= M.XENO);          // every round leaves a crater
        heatAt(b.x, b.y, 0.2, 0.5);
      } else if (b.acid) { if (!S.P.dead && Math.abs(b.x - S.P.x) < 0.35 && b.y > S.P.y && b.y < S.P.y + 1.8) { dead = true; S.hurt(b.dmg, b.vx * 0.05, 1); } }
      else { for (const c of creatures) if (hurtCreature(c, b.x, b.y, b.dmg, b.vx, b.vy)) { dead = true; P.hitT = 0.12; break; } if (!dead && s % 3 === 0) floraHit(b.x, b.y, 0.25, 0.05); }
    }
    if (!dead) B[w++] = b;
  }
  B.length = w;
}
export function drawPlayer(b, time) {
  for (const bl of S.bullets) { const dx = bl.x - bl.px, dy = bl.y - bl.py, l = Math.hypot(dx, dy) || 1, len = Math.min(l, bl.tr ? 7 : 1.6);
    if (bl.acid) { b.add(bl.x, bl.y, 0.22, 0.22, 0, mul(C.acid, 2.4), 1, 1, 2); b.add(bl.x, bl.y, 0.7, 0.7, 0, mul(C.acid, 0.5), 0.6, 1, 2); light.emit(bl.x / TS, bl.y / TS, 0.2, 0.6, 0.03); }
    else b.seg(bl.x, bl.y, bl.x - dx / l * len, bl.y - dy / l * len, bl.tr ? 0.045 : 0.03, bl.tr ? [5, 2.6, 0.8] : [1.2, 0.9, 0.5], bl.tr ? 1 : 0.5, 2, 2); }
  if (S.corpse) { b.add(S.corpse.x, S.corpse.y + 0.14, 1.5, 0.3, 0.05, C.suit, 1, 2, 1); b.add(S.corpse.x + 0.5, S.corpse.y + 0.2, 0.3, 0.3, 0, mul(C.amber, 1.5 + Math.sin(time * 4)), 0.8, 1, 2); }
  if (P.dead > 0) return;
  const g = P.rig, f = P.face, lean = g.lean, sl = Math.sin(lean), cl = Math.cos(lean), suit = C.suit, br = Math.sin(g.breath), hot = P.hurtT > 0 ? 1.6 : 1;
  const stf = g.f[0].t >= 0 ? g.f[1] : g.f[1].t >= 0 ? g.f[0] : null, hipX = P.x + sl * 0.04 + (stf && P.ground ? clamp((stf.x - P.x) * 0.14, -0.06, 0.06) : 0), hipY = P.y + g.py,      // the weight goes over the standing foot
        chX = hipX + sl * 0.52, chY = hipY + cl * 0.52 + br * 0.008, hdX = chX + Math.sin(lean * 0.6) * 0.3 + f * 0.02, hdY = chY + Math.cos(lean * 0.6) * 0.28, mvd = Math.abs(P.vx) > 0.3 ? Math.sign(P.vx) : f;
  const leg = (i, shade) => { const f0 = g.f[i], fdx = f0.x - hipX, fdy = f0.y + 0.07 - hipY + 0.04, fd = Math.hypot(fdx, fdy), fk = fd > 0.9 ? 0.9 / fd : 1, ft = { x: hipX + fdx * fk, y: hipY - 0.04 + fdy * fk - 0.07, t: f0.t }, ax = ft.x - mvd * 0.03, ay = ft.y + 0.07, kn = ik2(hipX, hipY - 0.04, ax, ay, THIGH, SHIN, mvd), c = mul(suit, shade * hot), sw = ft.t >= 0 ? Math.sin(Math.min(1, ft.t) * Math.PI) : 0;
    b.seg(hipX, hipY - 0.04, kn[0], kn[1], 0.21, c, 1, 2, 1, i, 0.2, 0, 0.5); b.seg(kn[0], kn[1], ax, ay, 0.17, c, 1, 2, 1, i + 2, 0.22, 0, 0.5); b.add(kn[0] + mvd * 0.03, kn[1], 0.15, 0.13, 0, mul(C.steel, shade * 0.9), 1, 2, 1);        // thigh, shin, knee plate
    b.add(ft.x + mvd * 0.06, ft.y + 0.055, 0.32, 0.13, -mvd * sw * 0.5 + (P.ground ? 0 : -mvd * 0.3), mul(C.dark, 1.3 * shade), 1, 2, 1, 0, 0, 0, 0.4); };
  const arm = (sx, sy, hx, hy, shade, metal, bend) => { let dx = hx - sx, dy = hy - sy; const d = Math.hypot(dx, dy); if (d > 0.62) { hx = sx + dx / d * 0.62; hy = sy + dy / d * 0.62; } const e = ik2(sx, sy, hx, hy, 0.32, 0.32, bend), c = metal ? mul(C.steel, 1.1 * shade) : mul(suit, shade * hot);
    b.seg(sx, sy, e[0], e[1], 0.14, c, 1, 2, 1, 5, 0.15, 0, 0.5); b.seg(e[0], e[1], hx, hy, 0.115, c, 1, 2, 1, 6, 0.15, 0, 0.5); b.add(hx, hy, 0.1, 0.1, 0, mul(C.dark, 1.6), 1, 2, 1); if (metal) { b.add(e[0], e[1], 0.1, 0.1, 0, C.dark, 1, 2, 1); b.add(lerp(e[0], hx, 0.7), lerp(e[1], hy, 0.7), 0.05, 0.05, 0, mul(C.cyan, S.printer.q.length ? 2.5 + Math.sin(time * 11) : 0.7), 1, 1, 2); } return [hx, hy]; };
  const item = hasLaser() ? 'laser' : S.mode === 'combat' && P.weapon ? P.weapon : null, ca = Math.cos(P.wa), sa = Math.sin(P.wa), shX = chX - f * 0.02, shY = chY - 0.02;
  const far = g.f[0].t >= 0 || (g.f[1].t < 0 && (g.f[0].x - P.x) * f < (g.f[1].x - P.x) * f) ? 0 : 1;     // draw the trailing leg first
  leg(far, 0.58);
  // far arm: the suit's own arm on the rear grip, or swinging against the stride
  const swing = clamp((g.f[1].x - g.f[0].x) * 0.55, -0.3, 0.3), printing = !!P.printing, pj = S.printer.q[0];
  if (item) arm(shX + f * 0.05, shY, P.gx - ca * 0.05, P.gy - sa * 0.05, 0.6, false, -f);
  else arm(shX + f * 0.04, shY, shX + f * 0.04 + swing, shY - 0.56 + Math.abs(swing) * 0.12, 0.6, false, -f);
  // back: the reactor on its frame, or the life-support pack
  if (hasReactor()) { const bx = chX - f * 0.36 - sl * 0.1, by = chY - 0.16 + br * 0.006; b.seg(chX - f * 0.1, chY + 0.12, bx, by + 0.3, 0.05, C.dark, 1, 2, 1); b.seg(hipX - f * 0.1, hipY + 0.05, bx, by - 0.3, 0.05, C.dark, 1, 2, 1); drawReactor(b, bx, by, lean - f * 0.06, time, K.reactor.load); }
  else { b.add(chX - f * 0.24, chY - 0.12, 0.24, 0.5, lean, mul(C.steel, 0.8), 1, 0, 1, 3, 0, 0, 0.4); b.add(chX - f * 0.3, chY + 0.04, 0.05, 0.05, 0, mul(C.amber, 2.5), 1, 1, 2); }
  b.seg(hipX, hipY, chX, chY, 0.37 + br * 0.012, mul(suit, hot), 1, 2, 1, 1, 0, 0, 0.55);                               // torso
  b.add(lerp(hipX, chX, 0.2), lerp(hipY, chY, 0.2), 0.36, 0.1, lean, mul(C.dark, 1.4), 1, 2, 1);                        // belt
  b.add(chX + f * 0.1, chY - 0.02, 0.17, 0.26, lean, mul(C.steel, 0.62), 1, 0, 1, 2);                                    // chest unit
  if (hasReactor()) b.seg(chX + f * 0.12, chY + 0.16, chX - f * 0.14, chY - 0.3, 0.05, C.dark, 1, 2, 1);                // strap
  leg(1 - far, 1);
  b.add(hdX, hdY + 0.06, 0.35, 0.37, lean * 0.4, mul(suit, 1.25 * hot), 1, 2, 1, 0, 0, 0, 0.7);                          // helmet
  b.add(hdX - f * 0.06, hdY - 0.1, 0.3, 0.09, lean * 0.4, mul(C.dark, 1.5), 1, 2, 1);                                    // collar ring
  b.add(hdX + f * 0.1 + Math.cos(P.aim) * 0.012, hdY + 0.07 + g.head * 0.03, 0.16, 0.14, g.head * 0.3 * f, mul(S.mode === 'combat' ? C.red : C.amber, 0.5), 1, 2, 2);   // visor
  if (light.lamp.on) b.add(hdX + f * 0.14, hdY + 0.2, 0.07, 0.07, 0, mul(C.warm, 3 * light.lamp.k), 1, 1, 2);
  // what the hands hold
  if (item === 'laser') drawLaser(b, P.gx, P.gy, P.wa, time, K.laser.heat, K.laser.firing && K.laser.frac >= 0.6);
  else if (item) { const gl = item === 'rifle' ? 1.05 : 0.9; b.add(P.gx + ca * gl * 0.4, P.gy + sa * gl * 0.4, gl, item === 'shotgun' ? 0.1 : 0.085, P.wa, C.dark, 1, 0, 1, 5); b.add(P.gx + ca * 0.08, P.gy - 0.06 + sa * 0.08, 0.3, 0.13, P.wa, mul(C.steel, 0.7), 1, 0, 1, 2); }
  // near arm: the prosthetic one, bare metal, with the matter compiler in its wrist
  let hand;
  if (P.act) hand = arm(shX, shY, P.act.x, P.act.y + Math.sin(time * 14) * 0.03, 1, true, f);
  else if (P.reach) hand = arm(shX, shY, P.reach.x, P.reach.y + 0.08, 1, true, f);
  else if (printing) hand = arm(shX, shY, shX + f * 0.44, shY - 0.26 + Math.sin(time * 3) * 0.02, 1, true, f);
  else if (item) hand = arm(shX, shY, P.gx + ca * 0.4 - sa * 0.02 * f, P.gy + sa * 0.4 - 0.07, 1, true, f);
  else hand = arm(shX, shY, shX - swing, shY - 0.56 + Math.abs(swing) * 0.12, 1, true, f);
  // the compiler at work: the part grows in the air in front of the hand, line by line
  if (printing && pj) { const pr = 1 - pj.left / pj.total, ox = hand[0] + f * 0.42, oy = hand[1] - 0.12, sz = 0.42, c = ITEMS[Object.keys(RECIPE[pj.r].out)[0]].c || C.steel, fl = 0.7 + 0.3 * Math.sin(time * 50);
    b.add(ox, oy - sz / 2 + sz * pr / 2, sz, sz * pr, 0, mul(c, 0.7), 1, 0, 1, 4); b.add(ox, oy - sz / 2 + sz * pr, sz + 0.06, 0.025, 0, [1, 3, 3.4], fl, 0, 2); b.add(ox, oy, sz * 2.4, sz * 2.4, 0, mul(C.cyan, 0.12), 0.8, 1, 2); for (const [ax, ay, bx, by] of [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]]) b.seg(ox + ax * sz / 2, oy + ay * sz / 2, ox + bx * sz / 2, oy + by * sz / 2, 0.008, [0.3, 1.4, 1.5], 0.35, 0, 2);     // the frame of what is not there yet
    for (const d of [-1, 1]) b.seg(hand[0], hand[1], ox + d * sz * 0.5, oy - sz / 2 + sz * pr, 0.012, [0.5, 2.2, 2.4], 0.5 * fl, 0, 2); b.add(ox, oy - sz / 2 + sz * pr, 0.5, 0.3, 0, mul(C.cyan, 0.5), 0.6 * fl, 1, 2); light.emit(ox / TS, oy / TS, 0.05, 0.4 * fl, 0.4 * fl);
    if (Math.random() < 0.25) S.parts.spawn({ x: ox + rand(-sz / 2, sz / 2), y: oy - sz / 2 + sz * pr, vx: rand(-0.6, 0.6), vy: rand(0.2, 1.2), life: rand(0.2, 0.5), size: 0.022, c: [1, 3, 3.4], grav: 0.2 }); }
  if (P.flashT > 0) { const [mx, my] = gunMuzzle(); b.add(mx + ca * 0.25, my + sa * 0.25, 1.5, 0.55, P.wa, [6, 4, 1.6], 1, 1, 2); b.add(mx, my, 1.1, 1.1, 0, [3, 1.8, 0.6], 0.8, 1, 2); light.emit(mx / TS, my / TS, 3.2, 2.2, 1.0); }
}

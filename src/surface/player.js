// player body on the density field, the suit (battery, oxygen, jet propellant, printer), the laser drill, and the
// weapons of combat mode. Every round, watt-hour and kilogram is counted.
import { G, input, events, clamp, rand, TAU } from '../core.js';
import { audio } from '../audio.js';
import { world, TS, GRAV, M, MAT, surfaceH } from './world.js';
import { LAVA_Y } from './gen.js';
import { light } from './light.js';
import { heatAt } from './terrain.js';
import { S, C, mul } from './state.js';
import { env } from './env.js';
import { ITEMS, inv, printerStep, CARRY } from '../items.js';
import { creatures, hurtCreature, ik2 } from './creatures.js';
import { floraHit } from './flora.js';
import { F } from './factory.js';

export const SUIT = { bat: 600, o2: 1.2, prop: 2.0, laserW: 4500, lampW: 15, rtgW: 40, o2Rate: 0.0012, jetRate: 0.18 };
export const WEAPON = {
  rifle: { ammo: 'rifle rounds', mag: 30, cool: 0.105, v0: 820, n: 1, spread: 0.006, dmg: 22, kick: 0.55, rec: 0.016, reload: 1.6, noise: 75, len: 1.05 },
  shotgun: { ammo: 'shells', mag: 6, cool: 0.85, v0: 400, n: 9, spread: 0.07, dmg: 9, kick: 3.2, rec: 0.1, reload: 2.2, noise: 90, len: 0.9 },
};
export const P = { x: 0, y: 0, vx: 0, vy: 0, ground: false, face: 1, hp: 100, bat: { wh: SUIT.bat, cap: SUIT.bat }, o2: SUIT.o2, prop: SUIT.prop, slot: 0, walk: 0, aim: 0, mag: { rifle: 30, shotgun: 6 }, reload: 0, cool: 0, dead: 0, shots: 0, flashT: 0, air: 0,
  hurtT: 0, stepD: 0, heat: 0, vent: 0, beam: null, recoil: 0, bloom: 0, ads: 0, hitT: 0, weapon: 'rifle', charging: false };
const R = 0.3, CY = [0.3, 0.9, 1.5], nv = [0, 0];
export function spawnAt(x) { P.x = x; P.y = (world.groundY(x, surfaceH(x) + 6, 0, 30) || surfaceH(x)) + 0.05; P.vx = P.vy = 0; P.hp = 100; P.dead = 0; P.prop = SUIT.prop; P.o2 = SUIT.o2; P.bat.wh = Math.max(P.bat.wh, 200); }
export function hurt(d, kx = 0, ky = 0) {
  if (P.dead) return; P.hp -= d; P.vx += kx; P.vy += ky; S.flash = Math.min(1, S.flash + d / 30); G.shake += d * 0.012; P.hurtT = 0.5; audio.play('hit');
  if (P.hp <= 0) { P.dead = 3; S.corpse = { x: P.x, y: P.y, inv: inv.dump(S.inv) }; S.inv.slots.fill(null); S.printer.q.length = 0; events.emit('died'); }
}
// push the three body circles out of the field; returns true when the feet rest on walkable ground
function resolve() {
  let ground = false;
  for (let it = 0; it < 2; it++) for (let c = 0; c < 3; c++) {
    const cy = P.y + CY[c], d = world.dist(P.x, cy); if (d >= R) continue;
    world.normal(P.x, cy, nv); const push = R - d;
    if (c === 0 && nv[1] > 0.8) { P.y += push / nv[1]; if (P.vy < 0) P.vy = 0; ground = true; }
    else if (c === 0 && nv[1] > 0.15 && Math.abs(nv[0]) > 0.2) {
      // steep ground or the foot of a wall: step up when the obstacle is low, else it is a wall (never a ramp upward)
      const dir = -Math.sign(nv[0]);
      if (world.dist(P.x + dir * 0.25, P.y + 0.55 + R) > R * 0.9) { P.y += Math.min(push * 1.5 + 0.01, 0.07); if (P.vy < 0) P.vy = 0; ground = true; }
      else { P.x += Math.sign(nv[0]) * push / Math.max(Math.abs(nv[0]), 0.5); if (P.vx * nv[0] < 0) P.vx = 0; if (nv[1] > 0.45) ground = true; }
    }
    else { P.x += nv[0] * push; P.y += nv[1] * push; const vn = P.vx * nv[0] + P.vy * nv[1]; if (vn < 0) { P.vx -= nv[0] * vn; P.vy -= nv[1] * vn; } }
  }
  return ground;
}
const muzzle = (l = 0.95) => { const sx = P.x, sy = P.y + 1.36; return [sx + Math.cos(P.aim) * l, sy + Math.sin(P.aim) * l]; };
const heldWeapon = () => { const s = S.inv.slots[P.slot]; if (s && ITEMS[s.id].weapon) return s.id; const i = S.inv.slots.findIndex((q, j) => j < 9 && q && ITEMS[q.id].weapon); if (i >= 0) { P.slot = i; return S.inv.slots[i].id; } return null; };
export function setMode(m) { S.mode = S.mode === m ? 'build' : m; audio.play('click'); if (S.mode === 'combat' && !heldWeapon()) S.say('no weapon in the hotbar'); }

export function stepPlayer(dt) {
  S.flash = Math.max(0, S.flash - dt * 1.5); P.hurtT = Math.max(0, P.hurtT - dt); P.flashT -= dt; P.cool -= dt; P.hitT -= dt; S.msgT -= dt;
  for (let i = S.gains.length - 1; i >= 0; i--) if ((S.gains[i].t -= dt) <= 0) S.gains.splice(i, 1);
  P.beam = null;
  if (P.dead > 0) { P.dead -= dt; audio.loop('drill', 0); audio.loop('engine', 0); if (P.dead <= 0) { const pr = F.printer; if (pr) { P.x = (pr.x + pr.w / 2) * TS + 1.4; P.y = pr.y * TS + 0.1; P.vx = P.vy = 0; P.hp = 100; P.dead = 0; P.o2 = SUIT.o2; P.prop = SUIT.prop; P.bat.wh = SUIT.bat; } else spawnAt(0); if (!S.count('laser drill')) S.add('laser drill', 1); } return; }
  const ui = S.uiOpen, combat = S.mode === 'combat', ads = combat && input.down[2] && !ui;
  P.ads += ((ads ? 1 : 0) - P.ads) * Math.min(1, dt * 9);
  const load = inv.mass(S.inv), enc = 1 - 0.35 * clamp((load - 300) / (CARRY - 300), 0, 1);
  const ax = ui ? 0 : (input.key('d') ? 1 : 0) - (input.key('a') ? 1 : 0), max = (input.key('Shift') && !ads ? 8.5 : 6.5) * enc * (1 - 0.45 * P.ads), acc = P.ground ? 24 : 6;
  if (ax) { if (P.vx * ax < max) P.vx = clamp(P.vx + ax * acc * dt, -Math.max(max, Math.abs(P.vx)), Math.max(max, Math.abs(P.vx))); }
  if (P.ground && (!ax || P.vx * ax < 0 || Math.abs(P.vx) > max)) P.vx -= Math.sign(P.vx) * Math.min(Math.abs(P.vx), 16 * dt);
  P.air = P.ground ? 0 : P.air + dt;
  const up = !ui && (input.key('w') || input.key(' '));
  let jumped = false; if (up && P.ground) { P.vy = 4.6; P.ground = false; jumped = true; }
  let jet = false;
  if (!ui && input.key(' ') && !P.ground && P.air > 0.22 && P.prop > 0) { jet = true; P.vy += 14 * dt; P.prop = Math.max(0, P.prop - SUIT.jetRate * dt); env.noise(P.x, P.y, 22); }
  if (P.ground && P.prop < SUIT.prop && P.bat.wh > 1) { const k = Math.min(SUIT.prop - P.prop, 0.45 * dt); P.prop += k; P.bat.wh -= k * 1.5; }      // intake compressor: 1.5 Wh per kg
  if (jet) {
    for (let i = 0; i < 2; i++) S.parts.spawn({ x: P.x - P.face * 0.22, y: P.y + 0.85, vx: P.vx + rand(-1, 1), vy: P.vy - rand(7, 12), life: rand(0.12, 0.3), size: rand(0.08, 0.2), c: [3, 1.6, 0.6], c2: [0.8, 0.1, 0.02], grav: 0 });
    light.emit(P.x / TS, P.y / TS + 1, 0.9, 0.45, 0.15);
  }
  audio.loop('engine', jet ? 0.35 : 0, 240);
  P.vy -= GRAV * dt; P.vy = Math.max(P.vy, -60);
  const was = P.ground, vy0 = P.vy, n = Math.max(1, Math.ceil(Math.max(Math.abs(P.vx), Math.abs(P.vy)) * dt / 0.1)); let g = false;
  for (let i = 0; i < n; i++) { P.x += P.vx * dt / n; P.y += P.vy * dt / n; g = resolve() || g; }
  if (!g && was && !jumped && P.vy <= 0.5) { const d = world.dist(P.x, P.y + R); if (d < R + 0.2) { world.normal(P.x, P.y + R, nv); if (nv[1] > 0.8) { P.y -= (d - R); P.vy = Math.min(P.vy, 0); g = true; } } }
  if (g && !was) { const imp = -vy0; if (imp > 3) { audio.play('thud'); dust(P.x, P.y, 4 + imp); env.noise(P.x, P.y, 8 + imp); } if (imp > 11) hurt((imp - 11) * (imp - 11) * 1.8); }
  P.ground = g;
  if (P.y < LAVA_Y + 0.3 && !world.solidAt(P.x, P.y + 0.5)) hurt(60 * dt);
  if (P.ground && Math.abs(P.vx) > 0.5) { P.walk += Math.abs(P.vx) * dt * 2.6; P.stepD += Math.abs(P.vx) * dt; if (P.stepD > 1.3) { P.stepD = 0; audio.play('step'); env.noise(P.x, P.y, Math.abs(P.vx) > 7 ? 9 : 5); } }
  P.bloom = Math.max(0, P.bloom - dt * 0.09); P.recoil *= Math.exp(-dt * 9);
  P.aim = Math.atan2(S.mouse.y - (P.y + 1.36), S.mouse.x - P.x) + P.recoil * (Math.cos(P.aim) >= 0 ? 1 : -1); P.face = Math.cos(P.aim) >= 0 ? 1 : -1;
  // suit: oxygen, battery, cells, printer
  P.o2 = Math.max(0, P.o2 - SUIT.o2Rate * dt); if (P.o2 <= 0) hurt(4 * dt);
  P.bat.wh = Math.min(P.bat.cap, P.bat.wh + SUIT.rtgW * dt / 3600); if (light.lamp.on) P.bat.wh = Math.max(0, P.bat.wh - SUIT.lampW * dt / 3600);
  if (P.o2 < 0.12 && inv.take(S.inv, 'o2 cell', 1) > 0) { P.o2 = SUIT.o2; S.say('o2 cell used'); }
  if (P.bat.wh < 25 && inv.take(S.inv, 'power cell', 1) > 0) { P.bat.wh = Math.min(P.bat.cap, P.bat.wh + 400); S.say('power cell used'); }
  P.charging = false; for (const m of F.machines) if ((m.kind === 'hub' || m.kind === 'bio-printer') && Math.hypot((m.x + m.w / 2) * TS - P.x, m.y * TS - P.y) < 4) P.charging = true;
  if (S.crash && Math.hypot(P.x + 9, P.y) < 6) P.charging = true;                                 // the wreck still has a reactor
  if (P.charging) { P.bat.wh = Math.min(P.bat.cap, P.bat.wh + 3000 * dt / 3600 * 20); P.o2 = Math.min(SUIT.o2, P.o2 + 0.05 * dt); }
  const done = printerStep(S.printer, S.inv, dt, P.bat); if (done) { S.gain(done, 0.0001); audio.play('place'); events.emit('suitPrinted'); if (ITEMS[done].build) events.emit('firstMachinePrinted'); }
  // hotbar
  if (!ui && S.mode !== 'blueprint') { for (let i = 0; i < 9; i++) if (input.hit(String(i + 1))) P.slot = i; if (input.wheel) P.slot = (P.slot + (input.wheel > 0 ? 1 : 8)) % 9; }
  if (input.hit('f')) light.lamp.on = !light.lamp.on;
  if (input.hit('c') && !ui) setMode('combat');
  // tools
  P.heat = Math.max(0, P.heat - dt * (P.vent > 0 ? 0.5 : 0.3)); if (P.vent > 0) { P.vent -= dt; if (Math.random() < dt * 40) { const [mx, my] = muzzle(0.8); S.parts.spawn({ x: mx, y: my, vx: rand(-1, 1), vy: rand(0.5, 2), life: rand(0.5, 1.2), size: rand(0.1, 0.25), grow: 2, c: [0.3, 0.3, 0.32], mode: 1, a: 0.3, grav: -0.05, drag: 1.5 }); } }
  let drilling = false;
  if (!ui && S.mode === 'build') {
    if (input.down[0] && S.count('laser drill') > 0 && P.vent <= 0 && P.bat.wh > 0.5) { laser(dt); drilling = true; }
    const sl = S.inv.slots[P.slot], pm = sl && ITEMS[sl.id].place;
    if (input.down[2] && pm && Math.hypot(S.mouse.x - P.x, S.mouse.y - P.y - 0.9) < 6) placeMat(sl, pm, dt);
  }
  P.drilling = drilling; audio.loop('drill', drilling ? 0.4 : 0, 520 + P.heat * 500);
  if (!ui && combat) {
    const wn = heldWeapon(), wp = wn && WEAPON[wn]; P.weapon = wn;
    if (wp) {
      if (P.reload > 0) { P.reload -= dt; if (P.reload <= 0) { const got = inv.take(S.inv, wp.ammo, wp.mag - P.mag[wn]); P.mag[wn] += Math.round(got); } }
      else if ((input.hit('r') && P.mag[wn] < wp.mag) || (input.down[0] && P.mag[wn] <= 0)) { if (S.count(wp.ammo) >= 1) { P.reload = wp.reload; audio.play('click'); } else if (input.clicked[0] || input.hit('r')) { S.say('no ' + wp.ammo); audio.play('click'); } }
      else if (input.down[0] && P.cool <= 0 && P.mag[wn] > 0) fire(wn);
    }
  } else P.reload = 0;
  // corpse recovery
  if (S.corpse && Math.hypot(S.corpse.x - P.x, S.corpse.y - P.y) < 1.2) { for (const s of S.corpse.inv) if (s) S.add(s[0], s[1]); S.corpse = null; audio.play('click'); }
  light.lamp.x = P.x / TS + Math.cos(P.aim) * 0.6; light.lamp.y = (P.y + 1.55) / TS + Math.sin(P.aim) * 0.6; light.lamp.ang = P.aim; light.lamp.k = (P.hurtT > 0 ? (Math.random() < 0.5 ? 0.2 : 1) : 1) * (P.bat.wh > 0 ? 1 : 0.15);
}
// the laser drill: a heavy beam that carves the field where it lands
const LASER = { range: 11, r: 0.52, rate: 3.4 };
function laser(dt) {
  const [mx, my] = muzzle(1.0), dx = Math.cos(P.aim), dy = Math.sin(P.aim), hit = world.ray(mx, my, dx, dy, LASER.range), len = hit ? hit.d : LASER.range, ex = mx + dx * len, ey = my + dy * len;
  P.beam = { x1: mx, y1: my, x2: ex, y2: ey, hit: !!hit };
  P.bat.wh = Math.max(0, P.bat.wh - SUIT.laserW * dt / 3600); P.heat += dt * 0.47; if (P.heat >= 1) { P.vent = 2.4; audio.play('groan'); S.say('drill overheated: venting'); }
  env.noise(ex, ey, 42); G.shake = Math.max(G.shake, 0.035); P.vx -= dx * dt * 1.2;
  for (let t = 0.3; t < len; t += 0.4) { const px = mx + dx * t, py = my + dy * t; floraHit(px, py, dt * 14, 0.2); for (const c of creatures) hurtCreature(c, px, py, 240 * dt, dx * 40, dy * 40, true); }
  for (let t = 0; t < len; t += 3) light.emit((mx + dx * t) / TS, (my + dy * t) / TS, 0.9, 0.36, 0.08);
  if (!hit) return;
  const acc = {}; world.dig(ex + dx * 0.3, ey + dy * 0.3, LASER.r, LASER.rate * dt, acc);
  let total = 0, k0 = hit.mat;
  for (const k in acc) { const kg = acc[k]; if (kg <= 0) continue; const m = MAT[k], keep = kg * m.keep; total += kg; S.stats.vapor += kg - keep + (m.item ? S.give(m.item, keep) : keep); }
  S.stats.dug += total; heatAt(ex, ey, 0.8, dt * 5); env.pollute(ex, ey, total * 0.002);
  light.emit(ex / TS, ey / TS, 3.6, 1.7, 0.5);
  world.normal(ex, ey, nv); const nx = nv[0] - dx * 0.5, ny = nv[1] - dy * 0.5, rc = k0 === M.SOIL ? [0.14, 0.1, 0.09] : k0 === M.HIVE ? [0.2, 0.06, 0.08] : [0.11, 0.12, 0.14];
  for (let i = 0, q = Math.floor(dt * 170 + Math.random()); i < q; i++) { S.parts.spawn({ x: ex, y: ey, vx: nx * rand(2, 13) + rand(-5, 5), vy: ny * rand(2, 13) + rand(-3, 7), life: rand(0.15, 0.8), size: rand(0.025, 0.06), c: [5, 2.6, 0.8], c2: [0.9, 0.12, 0.02], col: 1, bounce: 0.5 }); }
  if (Math.random() < dt * 40) S.parts.spawn({ x: ex, y: ey, vx: nx * rand(1, 4) + rand(-1, 1), vy: ny * rand(1, 4) + rand(0, 3), life: rand(0.8, 2), size: rand(0.06, 0.11), c: [4, 1.4, 0.2], c2: [0.25, 0.02, 0.01], col: 1, bounce: 0.05 });           // molten droplets
  if (Math.random() < dt * 45) S.parts.spawn({ x: ex, y: ey, vx: nx * rand(2, 8) + rand(-2, 2), vy: ny * rand(2, 8) + rand(0, 4), life: rand(0.8, 2.2), size: rand(0.05, 0.14), asp: rand(0.6, 1.6), c: rc, mode: 1, shape: 0, col: 1, bounce: 0.35, spin: rand(-14, 14), fade: 0 });   // debris
  if (Math.random() < dt * 30) S.parts.spawn({ x: ex + rand(-0.2, 0.2), y: ey + rand(-0.2, 0.2), vx: nx * rand(0.3, 1.5) + rand(-0.4, 0.4), vy: rand(0.5, 1.8), life: rand(1.2, 3), size: rand(0.25, 0.5), grow: 2.6, c: [0.13, 0.12, 0.12], mode: 1, a: 0.3, grav: -0.03, drag: 0.9 });   // smoke
}
// RMB with soil, basalt or plate in the selected slot: a smooth brush that spends exactly what it adds
function placeMat(sl, mat, dt) {
  const x = S.mouse.x, y = S.mouse.y; if (Math.abs(x - P.x) < 0.75 && y > P.y - 0.4 && y < P.y + 2.2) return;
  const rho = MAT[mat].rho * 0.02, r = Math.min(0.34, Math.sqrt(sl.n / (Math.PI * rho * 1.35))); if (r < 0.08) return;
  const acc = {}; world.fill(x, y, r, mat, dt * 2.2, acc);
  for (const k in acc) { if (acc[k] < 0) inv.take(S.inv, sl.id, -acc[k]); else if (MAT[k].item) S.add(MAT[k].item, acc[k]); }
  if (Math.random() < dt * 20) dust(x, y, 1);
}
function dust(x, y, n) { for (let i = 0; i < n; i++) S.parts.spawn({ x: x + rand(-0.3, 0.3), y: y + rand(0, 0.15), vx: rand(-1.6, 1.6), vy: rand(0.1, 1.4), life: rand(0.6, 1.6), size: rand(0.12, 0.3), grow: 1.5, c: [0.16, 0.15, 0.16], mode: 1, a: 0.35, grav: 0.05, drag: 2 }); }
export function fire(kind) {
  const wp = WEAPON[kind], [mx, my] = muzzle(wp.len), sp = (wp.spread + P.bloom) * (1 - 0.6 * P.ads) * (P.ground ? 1 : 1.8);
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
  const f = P.face, hipX = P.x, hipY = P.y + 0.86, sw = P.ground ? Math.min(1, Math.abs(P.vx) / 4) : 0.3, lean = clamp(P.vx * 0.012, -0.12, 0.12);
  for (let i = 0; i < 2; i++) {     // legs, far one first and darker
    const ph = P.walk + i * Math.PI, fx = P.x + Math.sin(ph) * 0.34 * sw * Math.sign(P.vx || f), fy = P.y + 0.04 + Math.max(0, Math.cos(ph)) * 0.2 * sw + (P.ground ? 0 : 0.12);
    const [kx, ky] = ik2(hipX, hipY, fx, fy, 0.45, 0.45, f), c = i ? C.suit : mul(C.suit, 0.6);
    b.seg(hipX, hipY, kx, ky, 0.19, c, 1, 2, 1); b.seg(kx, ky, fx, fy, 0.16, c, 1, 2, 1); b.add(fx + f * 0.07, fy, 0.3, 0.12, 0, C.dark, 1, 2, 1);
  }
  const shX = hipX + lean * 4, shY = P.y + 1.4, combat = S.mode === 'combat', item = combat ? P.weapon : S.mode === 'build' ? 'drill' : null;
  b.add(hipX - f * 0.24 + lean * 2, P.y + 1.12, 0.26, 0.52, lean, mul(C.steel, 0.8), 1, 0, 1, 3);            // pack: battery, printer
  if (S.printer.q.length) b.add(hipX - f * 0.24, P.y + 1.2, 0.07, 0.07, 0, mul(C.cyan, 2 + Math.sin(time * 9)), 1, 1, 2);
  b.seg(hipX, hipY, shX, shY, 0.36, C.suit, 1, 2, 1);
  b.add(shX + f * 0.02, P.y + 1.63, 0.34, 0.36, 0, mul(C.suit, 1.2), 1, 2, 1);                               // helmet
  b.add(shX + f * 0.1, P.y + 1.64, 0.15, 0.13, 0, mul(combat ? C.red : C.amber, 0.5), 1, 2, 2);              // visor
  b.add(hipX - f * 0.3, P.y + 1.28, 0.05, 0.05, 0, mul(C.amber, 2.5), 1, 1, 2);
  const ca = Math.cos(P.aim), sa = Math.sin(P.aim), gl = item === 'rifle' ? 1.05 : item === 'shotgun' ? 0.9 : 0.95;
  const gx = shX + ca * 0.5, gy = shY - 0.04 + sa * 0.5;
  if (item === 'drill') {          // heavy tool: body, cooling fins that glow with heat, emitter
    b.add(shX + ca * 0.45, shY - 0.05 + sa * 0.45, 0.8, 0.24, P.aim, C.dark, 1, 0, 1, 5); b.add(shX + ca * 0.2, shY - 0.14 + sa * 0.2, 0.34, 0.2, P.aim, mul(C.steel, 0.8), 1, 0, 1, 2);
    for (let i = 0; i < 3; i++) b.add(shX + ca * (0.5 + i * 0.1), shY - 0.05 + sa * (0.5 + i * 0.1), 0.04, 0.3, P.aim, [0.12 + P.heat * 3, 0.12 + P.heat * 0.7, 0.13], 1, 0, P.heat > 0.2 ? 2 : 1);
    b.add(shX + ca * 0.92, shY - 0.05 + sa * 0.92, 0.16, 0.16, 0, mul(C.amber, P.drilling ? 6 : 0.8), 1, 1, 2);
  } else if (item) { b.add(shX + ca * gl * 0.5, shY - 0.04 + sa * gl * 0.5, gl, item === 'shotgun' ? 0.1 : 0.085, P.aim, C.dark, 1, 0, 1, 5); b.add(shX + ca * 0.18, shY - 0.1 + sa * 0.18, 0.3, 0.13, P.aim, mul(C.steel, 0.7), 1, 0, 1, 2); }
  const [ex, ey] = ik2(shX, shY, gx, gy, 0.32, 0.32, -f); b.seg(shX, shY, ex, ey, 0.13, C.suit, 1, 2, 1); b.seg(ex, ey, gx, gy, 0.12, C.suit, 1, 2, 1);
  const B = P.beam;
  if (B) {
    const fl = 0.8 + 0.2 * Math.sin(time * 70) * Math.sin(time * 31), len = Math.hypot(B.x2 - B.x1, B.y2 - B.y1);
    b.seg(B.x1, B.y1, B.x2, B.y2, 0.55, [1.0, 0.28, 0.04], 0.3 * fl, 2, 2); b.seg(B.x1, B.y1, B.x2, B.y2, 0.2, [2.6, 0.9, 0.15], 0.75, 2, 2); b.seg(B.x1, B.y1, B.x2, B.y2, 0.07, [7, 5, 2.6], fl, 2, 2);
    for (let i = 0; i < 4; i++) { const t = ((time * 9 + i / 4) % 1) * len; b.add(B.x1 + ca * t, B.y1 + sa * t, 0.5, 0.16, P.aim, [4, 2, 0.6], 0.6, 1, 2); }
    b.add(B.x1, B.y1, 0.9, 0.9, 0, [3, 1.4, 0.4], 0.8, 1, 2);
    if (B.hit) { b.add(B.x2, B.y2, 3.4, 3.4, 0, [1.6, 0.5, 0.08], 0.5 * fl, 1, 2); b.add(B.x2, B.y2, 1.2, 1.2, 0, [6, 3.4, 1.2], fl, 1, 2); b.add(B.x2, B.y2, 2.6, 0.12, time * 3, [5, 3, 1], 0.7, 1, 2); b.add(B.x2, B.y2, 2.2, 0.1, -time * 2.3 + 1, [5, 3, 1], 0.6, 1, 2); }
  }
  if (P.flashT > 0) { const [mx, my] = muzzle(); b.add(mx + ca * 0.25, my + sa * 0.25, 1.5, 0.55, P.aim, [6, 4, 1.6], 1, 1, 2); b.add(mx, my, 1.1, 1.1, 0, [3, 1.8, 0.6], 0.8, 1, 2); light.emit(mx / TS, my / TS, 3.2, 2.2, 1.0); }
}

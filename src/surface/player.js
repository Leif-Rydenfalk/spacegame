// player body, hand drill, rifle and shotgun ballistics, casings, impacts.
import { G, input, events, clamp, rand, TAU } from '../core.js';
import { audio } from '../audio.js';
import { world, TS, GRAV, T, WALL, HARD, DROP, isSolid, surfaceH } from './world.js';
import { light } from './light.js';
import { S, C, mul } from './state.js';
import { creatures, hurtCreature, ik2 } from './creatures.js';
import { F, tryPlace, BUILD } from './factory.js';

export const P = { x: 0, y: 0, vx: 0, vy: 0, ground: false, face: 1, hp: 100, fuel: 11, slot: 1, walk: 0, aim: 0, mag: { rifle: 30, shotgun: 6 }, reload: 0, cool: 0, dead: 0, shots: 0, flashT: 0, air: 0, build: 0, hurtT: 0, stepD: 0 };
export const SLOTS = ['drill', 'rifle', 'shotgun', 'build'];
const W = 0.3, H = 1.8, E = 1e-4;
export function spawnAt(tx) { P.x = (tx + 0.5) * TS; P.y = (surfaceH(tx) + 1) * TS; P.vx = P.vy = 0; P.hp = 100; P.dead = 0; P.fuel = 11; }
function hits(x, y) {
  const x0 = Math.floor((x - W) / TS), x1 = Math.floor((x + W - E) / TS), y0 = Math.floor(y / TS), y1 = Math.floor((y + H - E) / TS);
  for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) if (world.solid(i, j)) return true; return false;
}
export function hurt(d, kx = 0, ky = 0) {
  if (P.dead) return; P.hp -= d; P.vx += kx; P.vy += ky; S.flash = Math.min(1, S.flash + d / 30); G.shake += d * 0.012; P.hurtT = 0.5; audio.play('hit');
  if (P.hp <= 0) { P.dead = 3; S.corpse = { x: P.x, y: P.y, inv: S.inv }; S.inv = {}; events.emit('died'); }
}
const muzzle = () => { const sx = P.x, sy = P.y + 1.36; return [sx + Math.cos(P.aim) * 0.95, sy + Math.sin(P.aim) * 0.95]; };

export function stepPlayer(dt) {
  S.flash = Math.max(0, S.flash - dt * 1.5); P.hurtT = Math.max(0, P.hurtT - dt); P.flashT -= dt; P.cool -= dt;
  if (P.dead > 0) { P.dead -= dt; if (P.dead <= 0) { const pr = F.printer; if (pr) { P.x = (pr.x + 1) * TS + 1.2; P.y = pr.y * TS; P.vx = P.vy = 0; P.hp = 100; P.dead = 0; } else spawnAt(0); } return; }
  const ax = (input.key('d') ? 1 : 0) - (input.key('a') ? 1 : 0), max = input.key('Shift') ? 8.5 : 6.5, acc = P.ground ? 24 : 6;
  if (ax) { if (P.vx * ax < max) P.vx = clamp(P.vx + ax * acc * dt, -Math.max(max, Math.abs(P.vx)), Math.max(max, Math.abs(P.vx))); }
  if (P.ground && (!ax || P.vx * ax < 0 || Math.abs(P.vx) > max)) P.vx -= Math.sign(P.vx) * Math.min(Math.abs(P.vx), 16 * dt);
  P.air = P.ground ? 0 : P.air + dt;
  const up = input.key('w') || input.key(' ');
  if (up && P.ground) { P.vy = 4.6; P.ground = false; }
  let jet = false;
  if (input.key(' ') && !P.ground && P.air > 0.22 && P.fuel > 0) { jet = true; P.vy += 14 * dt; P.fuel -= dt; }
  if (P.ground) P.fuel = Math.min(11, P.fuel + dt * 2.5);
  if (jet) {
    for (let i = 0; i < 2; i++) S.parts.spawn({ x: P.x - P.face * 0.22, y: P.y + 0.85, vx: P.vx + rand(-1, 1), vy: P.vy - rand(7, 12), life: rand(0.12, 0.3), size: rand(0.08, 0.2), c: [3, 1.6, 0.6], c2: [0.8, 0.1, 0.02], grav: 0 });
    light.emit(P.x / TS, P.y / TS + 1, 0.9, 0.45, 0.15);
  }
  audio.loop('engine', jet ? 0.35 : 0, 240);
  P.vy -= GRAV * dt; P.vy = Math.max(P.vy, -60);
  const nx = P.x + P.vx * dt;
  if (hits(nx, P.y)) { if (P.ground && !hits(nx, P.y + TS + 0.02)) { P.y = Math.floor((P.y + TS + 0.02) / TS) * TS; P.x = nx; P.vx *= 0.82; } else P.vx = 0; } else P.x = nx;
  const ny = P.y + P.vy * dt;
  if (hits(P.x, ny)) {
    if (P.vy < 0) { const imp = -P.vy; P.y = (Math.floor(ny / TS) + 1) * TS; if (!P.ground && imp > 3) { audio.play('thud'); dust(P.x, P.y, 4 + imp); } P.ground = true; if (imp > 11) hurt((imp - 11) * (imp - 11) * 1.8); }
    P.vy = 0;
  } else { P.y = ny; P.ground = P.vy <= 0 && hits(P.x, P.y - 0.03); }
  if (P.ground && Math.abs(P.vx) > 0.5) { P.walk += Math.abs(P.vx) * dt * 2.6; P.stepD += Math.abs(P.vx) * dt; if (P.stepD > 1.3) { P.stepD = 0; audio.play('step'); } }
  P.aim = Math.atan2(S.mouse.y - (P.y + 1.36), S.mouse.x - P.x); P.face = Math.cos(P.aim) >= 0 ? 1 : -1;
  // slots
  for (let i = 0; i < 4; i++) if (input.hit(String(i + 1))) P.slot = i;
  if (input.wheel) P.slot = (P.slot + (input.wheel > 0 ? 1 : 3)) % 4;
  if (input.hit('b')) { P.slot = 3; P.build = (P.build + 1) % BUILD.length; audio.play('click'); }
  if (input.hit('f')) light.lamp.on = !light.lamp.on;
  const item = SLOTS[P.slot]; S.crack = null;
  const mtx = Math.floor(S.mouse.x / TS), mty = Math.floor(S.mouse.y / TS), reach = Math.hypot(S.mouse.x - P.x, S.mouse.y - P.y - 1) < 4.2;
  if (item === 'drill') {
    const id = world.get(mtx, mty), k = id & 31;
    if (input.down[0] && reach && k && HARD[k]) {
      if (!P.dr || P.dr.x !== mtx || P.dr.y !== mty) P.dr = { x: mtx, y: mty, p: 0 };
      P.dr.p += dt / (HARD[k] * 1.1); S.crack = P.dr; P.drilling = true;
      if (Math.random() < 0.5) S.parts.spawn({ x: S.mouse.x, y: S.mouse.y, vx: rand(-3, 3), vy: rand(0, 4), life: rand(0.2, 0.6), size: rand(0.03, 0.07), c: [2.5, 1.2, 0.3], c2: [0.6, 0.1, 0.02], col: 1 });
      if (Math.random() < 0.25) S.parts.spawn({ x: S.mouse.x, y: S.mouse.y, vx: rand(-1.5, 1.5), vy: rand(0, 2), life: rand(0.5, 1.2), size: rand(0.05, 0.1), c: [0.12, 0.12, 0.13], mode: 1, shape: 0, col: 1, spin: rand(-9, 9) });
      light.emit(mtx, mty, 0.5, 0.25, 0.06);
      if (P.dr.p >= 1) { world.set(mtx, mty, id & WALL); if (DROP[k]) S.add(DROP[k]); P.dr = null; dust(S.mouse.x, S.mouse.y, 8); }
    } else { P.drilling = false; if (!input.down[0]) P.dr = null; }
    audio.loop('drill', P.drilling ? 0.25 : 0);
  } else { audio.loop('drill', 0); P.drilling = false; }
  if (item === 'rifle' || item === 'shotgun') {
    if (P.reload > 0) { P.reload -= dt; if (P.reload <= 0) P.mag[item] = item === 'rifle' ? 30 : 6; }
    else if (input.hit('r') || (input.down[0] && P.mag[item] <= 0)) { P.reload = item === 'rifle' ? 1.6 : 2.2; audio.play('click'); }
    else if (input.down[0] && P.cool <= 0 && P.mag[item] > 0) fire(item);
  }
  if (item === 'build' && input.clicked[2] && reach) tryPlace(BUILD[P.build], mtx, mty, P.face);
  // corpse recovery
  if (S.corpse && Math.hypot(S.corpse.x - P.x, S.corpse.y - P.y) < 1.2) { for (const k in S.corpse.inv) S.add(k, S.corpse.inv[k]); S.corpse = null; audio.play('click'); }
  light.lamp.x = P.x / TS + Math.cos(P.aim) * 0.6; light.lamp.y = (P.y + 1.55) / TS + Math.sin(P.aim) * 0.6; light.lamp.ang = P.aim; light.lamp.k = P.hurtT > 0 ? (Math.random() < 0.5 ? 0.2 : 1) : 1;
}
function dust(x, y, n) { for (let i = 0; i < n; i++) S.parts.spawn({ x: x + rand(-0.3, 0.3), y: y + rand(0, 0.15), vx: rand(-1.6, 1.6), vy: rand(0.1, 1.4), life: rand(0.6, 1.6), size: rand(0.12, 0.3), grow: 1.5, c: [0.16, 0.15, 0.16], mode: 1, a: 0.35, grav: 0.05, drag: 2 }); }
export function fire(kind) {
  const [mx, my] = muzzle(), n = kind === 'rifle' ? 1 : 9, sp = kind === 'rifle' ? 0.006 : 0.07, v0 = kind === 'rifle' ? 820 : 400;
  P.mag[kind]--; P.cool = kind === 'rifle' ? 0.105 : 0.85; P.shots++; P.flashT = 0.045;
  for (let i = 0; i < n; i++) { const a = P.aim + rand(-sp, sp); S.bullets.push({ x: mx, y: my, vx: Math.cos(a) * v0 * rand(0.97, 1.03) + P.vx, vy: Math.sin(a) * v0 + P.vy, life: 2.2, tr: kind === 'rifle' ? P.shots % 3 === 0 : i % 3 === 0, dmg: kind === 'rifle' ? 22 : 9, px: mx, py: my }); }
  const k = kind === 'rifle' ? 0.55 : 3.2; P.vx -= Math.cos(P.aim) * k; P.vy -= Math.sin(P.aim) * k * 0.6; G.shake += kind === 'rifle' ? 0.05 : 0.2;
  S.parts.spawn({ x: P.x, y: P.y + 1.4, vx: P.vx - P.face * rand(1.5, 3), vy: rand(2.5, 4.5), life: 20, fade: 0, size: 0.05, asp: 2.6, c: C.brass, mode: 1, shape: 0, col: 1, bounce: 0.45, spin: rand(-30, 30), hit: () => audio.play('tink') });
  for (let i = 0; i < 5; i++) S.parts.spawn({ x: mx, y: my, vx: Math.cos(P.aim) * rand(4, 30) + rand(-3, 3), vy: Math.sin(P.aim) * rand(4, 30) + rand(-3, 3), life: rand(0.04, 0.12), size: rand(0.03, 0.08), c: [4, 2.6, 1], grav: 0 });
  S.parts.spawn({ x: mx, y: my, vx: P.vx, vy: 0.6, life: 1.4, size: 0.25, grow: 3, c: [0.2, 0.2, 0.2], mode: 1, a: 0.25, grav: -0.03, drag: 1.5 });
  audio.play(kind === 'rifle' ? 'shot' : 'shotgun');
}
const chips = new Map();
export function stepBullets(dt) {
  const B = S.bullets; let w = 0;
  for (let i = 0; i < B.length; i++) {
    const b = B[i]; b.life -= dt; if (b.life <= 0) continue;
    const sp = Math.hypot(b.vx, b.vy), dr = 0.0006 * sp; b.vx -= b.vx * dr * dt; b.vy -= (b.vy * dr + GRAV) * dt;   // quadratic drag, gravity
    b.px = b.x; b.py = b.y;
    const n = Math.max(1, Math.ceil(sp * dt / 0.2)), sx = b.vx * dt / n, sy = b.vy * dt / n; let dead = false;
    for (let s = 0; s < n && !dead; s++) {
      b.x += sx; b.y += sy; const tx = Math.floor(b.x / TS), ty = Math.floor(b.y / TS), id = world.get(tx, ty);
      if (isSolid(id)) {
        dead = true; const k = id & 31, ix = b.x - sx, iy = b.y - sy, soft = k === T.SOIL || k === T.MOSS;
        for (let j = 0; j < (soft ? 3 : 9); j++) S.parts.spawn({ x: ix, y: iy, vx: -b.vx * rand(0.004, 0.02) + rand(-5, 5), vy: -b.vy * rand(0.004, 0.02) + rand(-3, 7), life: rand(0.15, 0.7), size: rand(0.025, 0.06), c: [4, 2.2, 0.7], c2: [0.7, 0.1, 0.02], col: 1, bounce: 0.5 });
        dust(ix, iy, soft ? 5 : 2); S.lights.push({ x: tx, y: ty, c: [0.9, 0.5, 0.2], t: 0.05 }); S.decals.push({ x: ix + sx * 0.6, y: iy + sy * 0.6, t: 20, r: rand(0.09, 0.16) }); audio.play('tink');
        if (soft) { const key = tx + ',' + ty, c = (chips.get(key) || 0) + 1; if (c >= 4) { world.set(tx, ty, id & WALL); chips.delete(key); dust(ix, iy, 6); } else chips.set(key, c); }
      } else for (const c of creatures) if (hurtCreature(c, b.x, b.y, b.dmg, b.vx, b.vy)) { dead = true; break; }
    }
    if (!dead) B[w++] = b;
  }
  B.length = w;
  for (let i = S.decals.length - 1; i >= 0; i--) if ((S.decals[i].t -= dt) <= 0) S.decals.splice(i, 1);
}
export function drawPlayer(b, time) {
  for (const d of S.decals) b.add(d.x, d.y, d.r * 2.4, d.r * 2.4, 0, [0, 0, 0], 0.75 * Math.min(1, d.t / 3), 1, 0);
  for (const bl of S.bullets) { const dx = bl.x - bl.px, dy = bl.y - bl.py, l = Math.hypot(dx, dy) || 1, len = Math.min(l, bl.tr ? 7 : 1.6); b.seg(bl.x, bl.y, bl.x - dx / l * len, bl.y - dy / l * len, bl.tr ? 0.045 : 0.03, bl.tr ? [5, 2.6, 0.8] : [1.2, 0.9, 0.5], bl.tr ? 1 : 0.5, 2, 2); }
  if (S.corpse) { b.add(S.corpse.x, S.corpse.y + 0.14, 1.5, 0.3, 0.05, C.suit, 1, 2, 1); b.add(S.corpse.x + 0.5, S.corpse.y + 0.2, 0.3, 0.3, 0, mul(C.amber, 1.5 + Math.sin(time * 4)), 0.8, 1, 2); }
  if (P.dead > 0) return;
  const f = P.face, hipX = P.x, hipY = P.y + 0.86, sw = P.ground ? Math.min(1, Math.abs(P.vx) / 4) : 0.3, lean = clamp(P.vx * 0.012, -0.12, 0.12);
  for (let i = 0; i < 2; i++) {     // legs, far one first and darker
    const ph = P.walk + i * Math.PI, fx = P.x + Math.sin(ph) * 0.34 * sw * Math.sign(P.vx || f), fy = P.y + 0.04 + Math.max(0, Math.cos(ph)) * 0.2 * sw + (P.ground ? 0 : 0.12);
    const [kx, ky] = ik2(hipX, hipY, fx, fy, 0.45, 0.45, f), c = i ? C.suit : mul(C.suit, 0.6);
    b.seg(hipX, hipY, kx, ky, 0.19, c, 1, 2, 1); b.seg(kx, ky, fx, fy, 0.16, c, 1, 2, 1); b.add(fx + f * 0.07, fy, 0.3, 0.12, 0, C.dark, 1, 2, 1);
  }
  const shX = hipX + lean * 4, shY = P.y + 1.4;
  b.add(hipX - f * 0.24 + lean * 2, P.y + 1.12, 0.26, 0.52, lean, mul(C.steel, 0.8), 1, 0, 1, 3);            // pack
  b.seg(hipX, hipY, shX, shY, 0.36, C.suit, 1, 2, 1);
  b.add(shX + f * 0.02, P.y + 1.63, 0.34, 0.36, 0, mul(C.suit, 1.2), 1, 2, 1);                               // helmet
  b.add(shX + f * 0.1, P.y + 1.64, 0.15, 0.13, 0, mul(C.amber, 0.5), 1, 2, 2);                               // visor
  b.add(hipX - f * 0.3, P.y + 1.28, 0.05, 0.05, 0, mul(C.amber, 2.5), 1, 1, 2);
  const ca = Math.cos(P.aim), sa = Math.sin(P.aim), item = SLOTS[P.slot], gl = item === 'rifle' ? 1.05 : item === 'shotgun' ? 0.9 : 0.6;
  const gx = shX + ca * 0.5, gy = shY - 0.04 + sa * 0.5;
  if (item !== 'build') { b.add(shX + ca * gl * 0.5, shY - 0.04 + sa * gl * 0.5, gl, item === 'drill' ? 0.16 : 0.085, P.aim, C.dark, 1, 0, 1, 5); b.add(shX + ca * 0.18, shY - 0.1 + sa * 0.18, 0.3, 0.13, P.aim, mul(C.steel, 0.7), 1, 0, 1, 2); }
  if (item === 'drill') b.add(shX + ca * 0.62, shY - 0.04 + sa * 0.62, 0.1, 0.1, 0, mul(C.amber, P.drilling ? 4 : 1), 1, 1, 2);
  const [ex, ey] = ik2(shX, shY, gx, gy, 0.32, 0.32, -f); b.seg(shX, shY, ex, ey, 0.13, C.suit, 1, 2, 1); b.seg(ex, ey, gx, gy, 0.12, C.suit, 1, 2, 1);
  if (P.drilling && S.crack) b.seg(shX + ca * 0.62, shY - 0.04 + sa * 0.62, S.mouse.x, S.mouse.y, 0.035, [3, 1.3, 0.25], 0.8, 2, 2);
  if (P.flashT > 0) { const [mx, my] = muzzle(); b.add(mx + ca * 0.25, my + sa * 0.25, 1.5, 0.55, P.aim, [6, 4, 1.6], 1, 1, 2); b.add(mx, my, 1.1, 1.1, 0, [3, 1.8, 0.6], 0.8, 1, 2); light.emit(mx / TS, my / TS, 3.2, 2.2, 1.0); }
}

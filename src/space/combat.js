// space combat: 30 mm shells that inherit the ship's velocity, the lead solution, part damage, explosions, break-up,
// and the hive: grown ships that obey the same physics, flock, spit slow plasma and bleed light.
import { events, rand, rng, TAU, G } from '../core.js';
import { audio } from '../audio.js';
import { bodies } from './orbit.js';
import { Sp, K, mul } from './state.js';
import { PARTS, CELL, makeShip, growHive, recalc, split, partWorld, partAtPoint, partAt } from './ship.js';
import { flyTo, radiusAt } from './belt.js';

export const SHELL_V = 1100, GLOB_V = 240;
// smallest positive t with |r + v t| = s t; null when there is no intercept
export function leadTime(rx, ry, vx, vy, s) {
  const a = vx * vx + vy * vy - s * s, b = 2 * (rx * vx + ry * vy), c = rx * rx + ry * ry;
  if (Math.abs(a) < 1e-9) return b < 0 ? -c / b : null;
  const d = b * b - 4 * a * c; if (d < 0) return null; const q = Math.sqrt(d), t1 = (-b - q) / (2 * a), t2 = (-b + q) / (2 * a), t = Math.min(t1 > 0 ? t1 : Infinity, t2 > 0 ? t2 : Infinity);
  return t === Infinity ? null : t;
}
export function leadPoint(from, to, speed) { const rx = to.p[0] - from.p[0], ry = to.p[1] - from.p[1], vx = to.v[0] - from.v[0], vy = to.v[1] - from.v[1], t = leadTime(rx, ry, vx, vy, speed); return t === null ? null : [to.p[0] + vx * t, to.p[1] + vy * t, t]; }
const w = [0, 0];
export function fireCannon(s) {
  if (s.fireT > 0) return; const guns = s.parts.filter(p => p.type === 'cannon'); if (!guns.length) return;
  s.fireT = 0.15; s.gun = ((s.gun || 0) + 1) % guns.length; partWorld(s, guns[s.gun], w); const a = s.aim + rand(-0.004, 0.004), dx = Math.cos(a), dy = Math.sin(a);
  Sp.shells.push({ x: w[0] + dx * 2.4, y: w[1] + dy * 2.4, vx: s.v[0] + dx * SHELL_V, vy: s.v[1] + dy * SHELL_V, life: 7, owner: s, kind: 'shell', dmg: 34, body: s.body });
  for (let i = 0; i < 4; i++) Sp.parts.spawn({ x: w[0] + dx * 2.6, y: w[1] + dy * 2.6, vx: s.v[0] + dx * rand(20, 120) + rand(-15, 15), vy: s.v[1] + dy * rand(20, 120) + rand(-15, 15), life: rand(0.05, 0.16), size: rand(0.3, 0.8), c: [5, 3.2, 1.2], grav: 0 });
  Sp.parts.spawn({ x: w[0] + dx * 2.6, y: w[1] + dy * 2.6, vx: s.v[0], vy: s.v[1], life: 0.07, size: 7, c: [3, 1.8, 0.7], grav: 0 });
  const imp = 0.45 * SHELL_V / s.m; s.v[0] -= dx * imp; s.v[1] -= dy * imp;
  if (s === Sp.me) { audio.play('cannon'); G.shake += 0.04; }
}
export function boom(x, y, vx, vy, size, org) {
  const col = org ? mul(K.ichor, 3) : [5, 2.6, 0.8], c2 = org ? mul(K.ichor, 0.4) : [0.8, 0.1, 0.02];
  for (let i = 0; i < 26 * size; i++) { const a = rand(TAU), sp = rand(4, 70) * size; Sp.parts.spawn({ x, y, vx: vx + Math.cos(a) * sp, vy: vy + Math.sin(a) * sp, life: rand(0.4, 2.4), size: rand(0.12, 0.45), c: col, c2, grav: 0 }); }
  for (let i = 0; i < 7 * size; i++) { const a = rand(TAU), sp = rand(2, 16); Sp.parts.spawn({ x, y, vx: vx + Math.cos(a) * sp, vy: vy + Math.sin(a) * sp, life: rand(3, 9), size: rand(0.3, 0.9), asp: rand(1, 3), c: org ? mul(K.flesh, 2) : mul(K.hull, 0.8), shape: org ? 5 : 3, mode: 0, spin: rand(-5, 5), grav: 0 }); }
  for (let i = 0; i < 5 * size; i++) { const a = rand(TAU), sp = rand(1, 7); Sp.parts.spawn({ x, y, vx: vx + Math.cos(a) * sp, vy: vy + Math.sin(a) * sp, life: rand(2, 5), size: rand(2, 5) * size, grow: 2.5, c: org ? [0.03, 0.09, 0.02] : [0.07, 0.06, 0.055], a: 0.45, grav: 0 }); }
  Sp.parts.spawn({ x, y, vx, vy, life: 0.22, size: 34 * size, c: org ? mul(K.ichor, 2) : [4, 2.6, 1.2], grav: 0 });                       // the flash that lights nearby hulls
  Sp.parts.spawn({ x, y, vx, vy, life: 0.55, size: 6 * size, grow: 7, c: org ? mul(K.ichor, 1.2) : [1.6, 1.2, 0.8], shape: 4, a: 0.7, grav: 0 });   // shock ring
}
export function damage(s, p, dmg, x, y, vx = 0, vy = 0) {
  if (!s.parts.includes(p)) return; const org = PARTS[p.type].org; p.hp -= dmg; if (org) s.bleed = 5;
  for (let i = 0; i < 7; i++) Sp.parts.spawn({ x, y, vx: s.v[0] - vx * rand(0.01, 0.06) + rand(-18, 18), vy: s.v[1] - vy * rand(0.01, 0.06) + rand(-18, 18), life: rand(0.2, 1.3), size: rand(0.12, 0.35), c: org ? mul(K.ichor, 3) : [5, 2.6, 0.8], c2: org ? mul(K.ichor, 0.5) : [0.8, 0.1, 0.02], grav: 0 });
  if (s === Sp.me) { audio.play('groan'); G.shake += 0.15; Sp.flash = Math.min(1, (Sp.flash || 0) + 0.4); }
  if (p.hp > 0) return;
  const tank = p.type === 'tank' && p.fuel > 0.2, core = p === s.core; partWorld(s, p, w); const ex = w[0], ey = w[1];
  s.parts.splice(s.parts.indexOf(p), 1); boom(ex, ey, s.v[0], s.v[1], tank ? 1.8 : core ? 1.5 : 1, org); if (s === Sp.me || tank) audio.play('groan');
  if (tank) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = partAt(s, p.gx + dx, p.gy + dy); if (n && s.parts.includes(n)) { n.hp -= 75; if (n.hp <= 0) { recalc(s); damage(s, n, 1, ex, ey); } } }
  if (!s.parts.length) { s.dead = true; s.m = 0; return; }
  recalc(s); const made = split(s); for (const d of made) Sp.ships.push(d);
  if (core) { s.dead = true; if (s === Sp.me) events.emit('shipLost'); if (s.org) { Sp.kills = (Sp.kills || 0) + 1; Sp.say('hive ship broken'); } }
}
export function spawnHive(n, x, y, vx, vy, seed) { const s = makeShip(growHive(n, rng(seed)), { owner: 'hive', name: 'hive', org: true, body: Sp.depot ? Sp.depot.body : 0, sas: true, fireT: rand(1, 3) }); s.p = [x, y]; s.v = [vx, vy]; s.amax = n > 40 ? 2.2 : n > 20 ? 3.2 : 4.5; Sp.ships.push(s); return s; }
export function stepCombat(dt) {
  const ships = Sp.ships, hives = ships.filter(s => s.org && !s.dead && !s.debris && s.core), me = Sp.me, D = Sp.depot;
  const old = Sp.shells.length;   // shells fired inside this step already sit at the new time: they are not advanced again
  for (const s of ships) { if (s.fireT > 0) s.fireT -= dt; if (s.bleed > 0 && s.m) { s.bleed -= dt; if (Math.random() < 0.3) Sp.parts.spawn({ x: s.p[0] + rand(-s.rad, s.rad) * 0.5, y: s.p[1] + rand(-s.rad, s.rad) * 0.5, vx: s.v[0] + rand(-3, 3), vy: s.v[1] + rand(-3, 3), life: rand(2, 6), size: rand(0.25, 0.6), c: mul(K.ichor, 2), c2: mul(K.ichor, 0.3), grav: 0 }); } }
  // hive: close to a standoff ring, strafe, keep apart, spit plasma at the lead point
  for (const h of hives) {
    let tg = null, bd = Infinity; for (const c of [me, D]) if (c && !c.dead && c.m) { const d = Math.hypot(c.p[0] - h.p[0], c.p[1] - h.p[1]); if (d < bd) { bd = d; tg = c; } }
    if (!tg) { h.ext = null; h.vis = 0; continue; }
    if (!Sp.sighted && bd < 6000) { Sp.sighted = true; events.emit('hiveSighted'); }
    const dx = tg.p[0] - h.p[0], dy = tg.p[1] - h.p[1], q = Math.atan2(dy, dx) + Math.PI + (h.seed % 2 > 1 ? 0.5 : -0.5); let tx = tg.p[0] + Math.cos(q) * 170, ty = tg.p[1] + Math.sin(q) * 170;
    for (const o of hives) if (o !== h) { const ox = h.p[0] - o.p[0], oy = h.p[1] - o.p[1], d = Math.hypot(ox, oy) || 1; if (d < 150) { tx += ox / d * (150 - d) * 2; ty += oy / d * (150 - d) * 2; } }
    flyTo(h, tx, ty, tg.v[0], tg.v[1], 70, h.amax); h.thr = h.vis; h.hold = Math.atan2(dy, dx); h.aim = h.hold;
    if (bd < 1900 && h.fireT <= 0) { const gl = h.parts.filter(p => p.type === 'gland'); if (gl.length) { h.fireT = 3.6 / gl.length + rand(0.3); const g = gl[Math.floor(rand(gl.length))]; partWorld(h, g, w); const lp = leadPoint({ p: w, v: h.v }, tg, GLOB_V);
      if (lp) { const a = Math.atan2(lp[1] - w[1], lp[0] - w[0]) + rand(-0.03, 0.03); Sp.shells.push({ x: w[0], y: w[1], vx: h.v[0] + Math.cos(a) * GLOB_V, vy: h.v[1] + Math.sin(a) * GLOB_V, life: 11, owner: h, kind: 'glob', dmg: 26, body: h.body }); } } }
  }
  // turrets that aim themselves: the depot's, and the player's when ?auto=1
  for (const s of [D, Sp.auto ? me : null]) if (s && !s.dead && s.m) { let tg = null, bd = 2600; for (const h of hives) { const d = Math.hypot(h.p[0] - s.p[0], h.p[1] - s.p[1]); if (d < bd) { bd = d; tg = h; } } if (tg) { const lp = leadPoint(s, tg, SHELL_V); if (lp) { s.aim = Math.atan2(lp[1] - s.p[1], lp[0] - s.p[0]); fireCannon(s); } if (s === me) Sp.target = tg; } }
  // shells and globs: gravity, then a swept test against every ship's part grid
  const S = Sp.shells; let n = 0;
  for (let i = 0; i < S.length; i++) {
    const sh = S[i]; sh.life -= dt; if (sh.life <= 0) continue; if (i >= old) { S[n++] = sh; continue; } const mu = bodies[sh.body].mu, r = Math.hypot(sh.x, sh.y), g = -mu / (r * r * r); sh.vx += g * sh.x * dt; sh.vy += g * sh.y * dt;
    let dead = false; const sub = sh.kind === 'shell' ? 6 : 2;
    for (let k = 0; k < sub && !dead; k++) {
      sh.x += sh.vx * dt / sub; sh.y += sh.vy * dt / sub;
      for (const s of ships) { if (s === sh.owner || !s.m || s.body !== sh.body || s.owner === sh.owner.owner) continue;   /* demo 1: no friendly fire */ const p = partAtPoint(s, sh.x, sh.y); if (p) { damage(s, p, sh.dmg, sh.x, sh.y, sh.vx - s.v[0], sh.vy - s.v[1]); dead = true; break; } }
      if (!dead) for (const a of Sp.asteroids) { const lx = sh.x - a.p[0], ly = sh.y - a.p[1]; if (Math.abs(lx) < a.R * 1.4 && Math.abs(ly) < a.R * 1.4 && lx * lx + ly * ly < Math.pow(radiusAt(a, lx, ly), 2)) { dead = true; for (let j = 0; j < 6; j++) Sp.parts.spawn({ x: sh.x, y: sh.y, vx: a.v[0] + rand(-25, 25), vy: a.v[1] + rand(-25, 25), life: rand(0.2, 0.9), size: 0.25, c: [4, 2, 0.6], c2: [0.8, 0.1, 0.02], grav: 0 }); break; } }
    }
    if (!dead) S[n++] = sh;
  }
  S.length = n;
  for (let i = ships.length - 1; i >= 0; i--) if ((ships[i].dead && ships[i] !== me && ships[i] !== D) || (ships[i].debris && !ships[i].m)) ships.splice(i, 1);
  if (Sp.kills === 1 && !Sp.wave2 && D) { Sp.wave2 = true; const a = rand(TAU); spawnHive(12, D.p[0] + Math.cos(a) * 2600, D.p[1] + Math.sin(a) * 2600, D.v[0] - Math.cos(a) * 40, D.v[1] - Math.sin(a) * 40, 77); }
}
export function drawShells(b, rvx, rvy, time) {
  for (const sh of Sp.shells) {
    if (sh.kind === 'shell') { const vx = sh.vx - rvx, vy = sh.vy - rvy, l = Math.hypot(vx, vy) || 1, len = Math.max(9, 4 / b.k); b.seg(sh.x, sh.y, sh.x - vx / l * len, sh.y - vy / l * len, Math.max(0.3, 1.3 / b.k), [2.4, 1.4, 0.5], 1, 2, 2); }
    else { const p = 0.8 + 0.2 * Math.sin(time * 30 + sh.life * 9), s = Math.max(3.4, 5 / b.k); b.add(sh.x, sh.y, s, s, 0, [5 * p, 1.6 * p, 0.2], 1, 1, 2); b.add(sh.x, sh.y, s * 4.5, s * 4.5, 0, [1.4, 0.35, 0.05], 0.5, 1, 2); }
  }
}

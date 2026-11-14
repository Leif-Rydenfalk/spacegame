// ships: a grid of parts with mass. Mass, centre of mass, inertia, thrust torque, delta-v, RCS selection by torque sign,
// fuel drain per tank, and break-apart by connectivity from the core.
import { G, clamp, rand, angDiff } from '../core.js';
import { bodies, G0, ATMO, HOME, elFromState, stateFromEl } from './orbit.js';
import { Sp, K, mul } from './state.js';

export const CELL = 2;      // metres per grid cell
export const PARTS = {
  cockpit: { m: 1.2, hp: 120, wheel: 25e3, label: 'cockpit (core)' },
  hull: { m: 0.6, hp: 170, label: 'hull block' },
  tank: { m: 0.4, fuel: 3.0, hp: 70, label: 'fuel tank 3.0 t' },
  engine: { m: 1.0, thrust: 60e3, isp: 320, hp: 80, label: 'main engine 60 kN, Isp 320 s' },
  ltr: { m: 1.6, thrust: 420e3, isp: 900, hp: 90, label: 'lumen thermal engine 420 kN, Isp 900 s' },
  rcs: { m: 0.15, thrust: 2.5e3, isp: 220, hp: 40, label: 'RCS block 4 x 2.5 kN' },
  reactor: { m: 1.5, hp: 90, wheel: 45e3, label: 'reactor + reaction wheel' },
  cargo: { m: 0.5, hp: 80, cap: 40, label: 'cargo bay, collector 30 m' },
  laser: { m: 0.6, hp: 60, label: 'mining laser' },
  cannon: { m: 0.8, hp: 70, label: 'autocannon 30 mm' },
  dronebay: { m: 1.0, hp: 80, label: 'drone bay' },
  // hive tissue: same physics, grown not built
  heart: { m: 1.4, hp: 380, org: 1, wheel: 60e3 }, flesh: { m: 0.7, hp: 150, org: 1 }, gland: { m: 0.8, hp: 90, org: 1 }, sac: { m: 0.6, hp: 80, org: 1, thrust: 30e3, isp: 400, fuel: 9 },
};
export const BUILDABLE = ['hull', 'tank', 'engine', 'ltr', 'rcs', 'reactor', 'cargo', 'laser', 'cannon', 'dronebay'];
export const BP = {
  scout: [['engine', -2, 0], ['rcs', -2, 1], ['rcs', -2, -1], ['reactor', -1, 0], ['tank', -1, 1], ['tank', -1, -1], ['cargo', 0, 0], ['hull', 0, 1], ['hull', 0, -1], ['cockpit', 1, 0], ['cannon', 1, 1], ['laser', 1, -1]],
  rocket: [['ltr', -4, 0], ['tank', -3, 0], ['tank', -2, 0], ['tank', -1, 0], ['tank', 0, 0], ['tank', 1, 0], ['reactor', 2, 0], ['cargo', 3, 0], ['rcs', 3, 1], ['rcs', 3, -1], ['cockpit', 4, 0]],
  drone: [['engine', -1, 0], ['cockpit', 0, 0], ['cargo', 1, 0]],
  depot: [['reactor', 0, 0], ['cockpit', 1, 0], ['hull', -1, 0], ['hull', 0, 1], ['hull', 0, -1], ['cargo', -2, 0], ['cargo', -3, 0], ['cargo', -2, 1], ['cargo', -2, -1], ['hull', 2, 0], ['dronebay', 3, 0], ['dronebay', 3, 1], ['dronebay', 3, -1], ['hull', 0, 2], ['hull', 0, -2], ['cannon', 0, 3], ['cannon', 0, -3], ['tank', 1, 1], ['tank', 1, -1], ['hull', -1, 1], ['hull', -1, -1], ['rcs', -4, 0], ['rcs', 4, 0]],
};
const key = (x, y) => (x + 500) * 1000 + y + 500;
let nextId = 1;
export function makeShip(bp, o = {}) {
  const s = { id: nextId++, owner: G.playerId, name: 'ship', parts: bp.map(([type, gx, gy]) => ({ type, gx, gy, hp: PARTS[type].hp, fuel: PARTS[type].fuel || 0 })), body: 0, p: [0, 0], v: [0, 0], ang: 0, angVel: 0, throttle: 0,
    cmd: { tx: 0, ty: 0, rot: 0 }, sas: true, hold: null, aim: 0, el: null, com: [0, 0], ore: 0, fireT: 0, rcsOn: 0, bleed: 0, seed: Math.random() * 100, ...o };
  s.com = null; recalc(s); return s;
}
export function recalc(s) {
  let m = 0, cx = 0, cy = 0, fuel = 0, cap = 0, F = 0, mdot = 0, wheel = 0, cargo = 0; s.map = new Map(); s.core = null;
  for (const p of s.parts) { const d = PARTS[p.type], pm = (d.m + p.fuel) * 1000; p.m = pm; m += pm; cx += pm * p.gx * CELL; cy += pm * p.gy * CELL; fuel += p.fuel; cap += d.fuel || 0; s.map.set(key(p.gx, p.gy), p);
    if (d.thrust && p.type !== 'rcs') { F += d.thrust; mdot += d.thrust / (d.isp * G0); } wheel += d.wheel || 0; cargo += d.cap || 0; if (p.type === 'cockpit' || p.type === 'heart') s.core = p; }
  if (!m) { s.m = 0; return; }
  cx /= m; cy /= m; let I = 0, imb = 0, rad = 0;
  for (const p of s.parts) { const dx = p.gx * CELL - cx, dy = p.gy * CELL - cy; I += p.m * (dx * dx + dy * dy + CELL * CELL / 6); rad = Math.max(rad, Math.hypot(dx, dy) + CELL); const d = PARTS[p.type]; if (d.thrust && p.type !== 'rcs') imb += -dy * d.thrust; }
  if (s.com) { const c = Math.cos(s.ang), sn = Math.sin(s.ang), ox = cx - s.com[0], oy = cy - s.com[1]; s.p[0] += c * ox - sn * oy; s.p[1] += sn * ox + c * oy; }   // parts stay where they are when the CoM moves
  s.m = m; s.com = [cx, cy]; s.I = I; s.fuel = fuel; s.fuelCap = cap; s.thrust = F; s.mdot = mdot; s.wheel = wheel; s.imb = imb; s.rad = rad; s.cargoCap = cargo;
  s.isp = mdot ? F / (mdot * G0) : 0; s.dv = fuel > 0 && mdot ? s.isp * G0 * Math.log(m / (m - fuel * 1000)) : 0;
}
export const partWorld = (s, p, out) => { const c = Math.cos(s.ang), sn = Math.sin(s.ang), lx = p.gx * CELL - s.com[0], ly = p.gy * CELL - s.com[1]; out[0] = s.p[0] + c * lx - sn * ly; out[1] = s.p[1] + sn * lx + c * ly; return out; };
const NOZ = [[1, 0], [-1, 0], [0, 1], [0, -1]], tmp = [0, 0, 0, 0];
// one physics step. extF = extra world force [fx, fy] (drone and hive autopilots use it), mu override for tests
export function stepShip(s, dt, t, mu = bodies[s.body].mu) {
  if (!s.m) return;
  let Fx = 0, Fy = 0, Tq = 0, burn = 0; const cm = s.cmd;
  let rot = cm.rot;
  if (s.hold !== null) rot = clamp(angDiff(s.hold, s.ang) * 3.2 - s.angVel * 5, -1, 1); else if (!rot && s.sas) rot = clamp(-s.angVel * 6, -1, 1);
  if (s.throttle > 0 && s.fuel > 0) for (const p of s.parts) { const d = PARTS[p.type]; if (d.thrust && p.type !== 'rcs') { const F = d.thrust * s.throttle; Fx += F; Tq += -(p.gy * CELL - s.com[1]) * F; burn += F / (d.isp * G0); } }
  s.rcsOn = 0;
  if (s.fuel > 0 && (cm.tx || cm.ty || Math.abs(rot) > 0.02)) for (const p of s.parts) if (p.type === 'rcs') {
    const d = PARTS.rcs, rx = p.gx * CELL - s.com[0], ry = p.gy * CELL - s.com[1]; p.fire = 0;
    for (let i = 0; i < 4; i++) { const nx = NOZ[i][0], ny = NOZ[i][1], tq = (rx * ny - ry * nx) * d.thrust; let lv = 0;
      if (rot * tq > 0 && Math.abs(tq) > 800) lv = Math.abs(rot); if (cm.tx * nx + cm.ty * ny > 0) lv = 1;
      if (lv > 0.02) { Fx += nx * d.thrust * lv; Fy += ny * d.thrust * lv; Tq += tq * lv; burn += d.thrust * lv / (d.isp * G0); p.fire |= 1 << i; s.rcsOn = Math.max(s.rcsOn, lv); } }
  }
  Tq += rot * s.wheel;
  const c = Math.cos(s.ang), sn = Math.sin(s.ang); let ax = (c * Fx - sn * Fy) / s.m, ay = (sn * Fx + c * Fy) / s.m;
  if (s.ext) { ax += s.ext[0] / s.m; ay += s.ext[1] / s.m; }
  const p = s.p, v = s.v;
  if (s.body === HOME) { const alt = Math.hypot(p[0], p[1]) - bodies[HOME].R; if (alt < ATMO.top) { const sp = Math.hypot(v[0], v[1]), k = 0.5 * ATMO.rho0 * Math.exp(-alt / ATMO.H) * sp * 3.2 / s.m; ax -= v[0] * k; ay -= v[1] * k; s.q = k * s.m * sp; } else s.q = 0; }
  let r = Math.hypot(p[0], p[1]), g = -mu / (r * r * r); const a0x = ax + g * p[0], a0y = ay + g * p[1];
  p[0] += v[0] * dt + 0.5 * a0x * dt * dt; p[1] += v[1] * dt + 0.5 * a0y * dt * dt;
  r = Math.hypot(p[0], p[1]); g = -mu / (r * r * r);
  v[0] += 0.5 * (a0x + ax + g * p[0]) * dt; v[1] += 0.5 * (a0y + ay + g * p[1]) * dt;
  s.angVel += Tq / s.I * dt; s.ang += s.angVel * dt; s.el = null; s.acc = Math.hypot(ax, ay);
  if (burn > 0) {   // tanks empty evenly; the mass and the centre of mass follow
    let need = burn * dt / 1000; const tanks = s.parts.filter(q => q.fuel > 0);
    for (const q of tanks) { const take = Math.min(q.fuel, need / tanks.length); q.fuel -= take; s.fuel -= take; s.m -= take * 1000; }
    if ((s.rc = (s.rc || 0) + 1) % 40 === 0 || s.fuel <= 1e-6) recalc(s);
  }
}
export function railShip(s, dt, t) { if (!s.el) s.el = elFromState(s.p[0], s.p[1], s.v[0], s.v[1], bodies[s.body].mu, t - dt); stateFromEl(s.el, t, tmp); s.p[0] = tmp[0]; s.p[1] = tmp[1]; s.v[0] = tmp[2]; s.v[1] = tmp[3]; s.ang += s.angVel * dt; }
// connectivity: everything not reachable from the core becomes its own free rigid body with v + omega x r
export function islands(parts, start) {
  const map = new Map(parts.map(p => [key(p.gx, p.gy), p])), seen = new Set(), out = [];
  const flood = p0 => { const isl = [p0], q = [p0]; seen.add(p0); while (q.length) { const p = q.pop(); for (const [dx, dy] of NOZ) { const n = map.get(key(p.gx + dx, p.gy + dy)); if (n && !seen.has(n)) { seen.add(n); isl.push(n); q.push(n); } } } return isl; };
  if (start) out.push(flood(start));
  for (const p of parts) if (!seen.has(p)) out.push(flood(p));
  return out;
}
export function split(s) {
  const isl = islands(s.parts, s.core && s.parts.includes(s.core) ? s.core : null), made = [];
  const keep = s.core && s.parts.includes(s.core) ? isl.shift() : [];
  const w = [0, 0];
  for (const parts of isl) {
    const d = makeShip([], { owner: s.owner, name: s.name + ' wreck', debris: true, body: s.body, ang: s.ang, angVel: s.angVel + rand(-0.4, 0.4), org: s.org, bleed: s.org ? 6 : 0 });
    partWorld(s, parts[0], w); d.parts = parts; d.com = [parts[0].gx * CELL, parts[0].gy * CELL]; d.p = [w[0], w[1]]; recalc(d);
    const rx = d.p[0] - s.p[0], ry = d.p[1] - s.p[1], k = rand(0.5, 2.5) / (Math.hypot(rx, ry) + 1);
    d.v = [s.v[0] - s.angVel * ry + rx * k, s.v[1] + s.angVel * rx + ry * k]; made.push(d);
  }
  s.parts = keep; if (!keep.length) { s.dead = true; s.m = 0; } else recalc(s);
  return made;
}
// asymmetric growth from a seed cell
export function growHive(n, rnd) {
  const cells = [['heart', 0, 0]], has = new Set(['0,0']);
  while (cells.length < n) { const c = cells[Math.floor(rnd() * rnd() * cells.length)], d = NOZ[Math.floor(rnd() * 4)], x = c[1] + d[0], y = c[2] + d[1] + (rnd() < 0.15 ? 1 : 0); if (has.has(x + ',' + y) || !has.has((x - d[0]) + ',' + (y - d[1])) && !has.has(x + ',' + (y - 1))) continue; has.add(x + ',' + y); cells.push(['flesh', x, y]); }
  const minX = Math.min(...cells.map(c => c[1])), maxX = Math.max(...cells.map(c => c[1]));
  for (const c of cells) { if (c[0] !== 'flesh') continue; if (c[1] === minX || (c[1] === minX + 1 && rnd() < 0.4)) c[0] = 'sac'; else if (c[1] >= maxX - 1 && rnd() < 0.6) c[0] = 'gland'; }
  if (!cells.some(c => c[0] === 'gland')) cells[cells.length - 1][0] = 'gland'; if (!cells.some(c => c[0] === 'sac')) cells[1][0] = 'sac';
  return cells;
}
// draw at absolute position (ax, ay); the batch origin is the camera
export function drawShip(b, s, ax, ay, time) {
  const c = Math.cos(s.ang), sn = Math.sin(s.ang), px = b.k * CELL, th = s.throttle > 0 && s.fuel > 0 ? s.throttle : 0;
  if (px < 1.6) { b.add(ax, ay, 5 / b.k, 5 / b.k, 0, s.org ? mul(K.ichor, 1.2) : s.debris ? mul(K.hull, 0.5) : mul(K.warm, 1.6), 1, 1, 2); if (th > 0) b.add(ax, ay, 14 / b.k, 14 / b.k, 0, [0.5, 0.8, 1.5], 0.6, 1, 2); return; }
  for (const p of s.parts) {
    const d = PARTS[p.type], lx = p.gx * CELL - s.com[0], ly = p.gy * CELL - s.com[1], x = ax + c * lx - sn * ly, y = ay + sn * lx + c * ly, sd = p.gx * 7 + p.gy * 13 + 1, dmg = 0.45 + 0.55 * p.hp / d.hp;
    const at = (ox, oy, w, h, col, a = 1, shape = 3, mode = 0, rot = 0) => b.add(x + c * ox - sn * oy, y + sn * ox + c * oy, w, h, s.ang + rot, col, a, shape, mode, sd);
    if (d.org) {
      const pul = 0.6 + 0.4 * Math.sin(time * 1.6 + sd); at(0, 0, CELL * 1.5, CELL * 1.5, mul(K.flesh, dmg), 1, 5);
      if (p.type === 'heart') { at(0, 0, 1.2, 1.2, mul(K.violet, 2.5 * pul), 1, 1, 2); at(0, 0, 5, 5, mul(K.violet, 0.3 * pul), 1, 1, 2); }
      else if (p.type === 'gland') { at(0.5, 0, 0.9, 0.9, mul([1, 0.35, 0.05], 2.5 * pul), 1, 1, 2); }
      else if (p.type === 'sac') { at(-0.6, 0, 1.0, 1.0, mul(K.ichor, 0.8), 0.9, 5); if (s.thr > 0.05) at(-2.2 - s.thr * 3, 0, 3 + s.thr * 7, 2.0, mul(K.violet, 2.2), s.thr, 6, 2, Math.PI); }
      else at((sd % 3) * 0.3 - 0.3, (sd % 5) * 0.2 - 0.4, 0.3, 0.3, mul(K.ichor, 1.6 * pul), 1, 1, 2);
      continue;
    }
    const base = mul(K.hull, dmg * (p.type === 'tank' ? 1.08 : p.type === 'reactor' ? 0.6 : p.type === 'cargo' ? 0.75 : 0.9));
    if (p.type === 'engine' || p.type === 'ltr') {
      at(0.25, 0, CELL * 0.75, CELL * 0.84, mul(K.steel, dmg)); at(-0.6, 0, 0.8, CELL * 0.66, K.dark);
      if (th > 0) { const lt = p.type === 'ltr', len = (lt ? 16 : 7) * (0.5 + 0.5 * th) * (0.9 + 0.2 * Math.random()), col = lt ? [0.7, 1.8, 3.2] : [3, 1.7, 0.7];
        at(-1 - len / 2, 0, len, lt ? 3 : 2, col, th, 6, 2, Math.PI); at(-1 - len * 0.2, 0, len * 0.4, lt ? 1.2 : 0.8, [4, 4, 4], th, 6, 2, Math.PI); at(-1.2, 0, 6, 6, col, 0.35 * th, 1, 2); }
    } else if (p.type === 'rcs') {
      at(0, 0, 0.9, 0.9, mul(K.steel, dmg));
      if (p.fire && s.rcsOn) for (let i = 0; i < 4; i++) if (p.fire & (1 << i)) at(-NOZ[i][0] * 1.3, -NOZ[i][1] * 1.3, 2.0, 0.7, [1.6, 1.8, 2.2], 0.8 * s.rcsOn, 6, 2, Math.atan2(-NOZ[i][1], -NOZ[i][0]));
    } else {
      at(0, 0, CELL * 0.97, CELL * 0.97, base);
      if (p.type === 'tank') { at(0, 0.55, CELL * 0.97, 0.12, mul(K.dark, 1.5)); at(0, -0.55, CELL * 0.97, 0.12, mul(K.dark, 1.5)); }
      else if (p.type === 'cockpit') { at(0.45, 0, 0.5, 0.9, mul(K.amber, 1.3), 1, 2, 2); at(0.45, 0, 2.2, 2.2, mul(K.amber, 0.25), 1, 1, 2); }
      else if (p.type === 'reactor') { for (let i = -1; i <= 1; i++) at(i * 0.5, 0, 0.14, 1.3, mul(K.cyan, 1.1), 1, 0, 2); }
      else if (p.type === 'cargo') { at(0, 0, CELL * 0.7, CELL * 0.7, K.dark); at(0, 0, 0.08, CELL * 0.7, mul(K.steel, 0.8)); }
      else if (p.type === 'dronebay') { at(0, 0, CELL * 0.6, CELL * 0.6, [0.01, 0.012, 0.016]); at(0.7, 0.7, 0.14, 0.14, mul(K.amber, 3), 1, 1, 2); }
      else if (p.type === 'cannon' || p.type === 'laser') {
        const ra = s.aim - s.ang; at(0, 0, 1.3, 1.3, mul(K.steel, 0.9), 1, 5);
        if (p.type === 'cannon') at(Math.cos(ra) * 0.9, Math.sin(ra) * 0.9, 1.9, 0.26, K.dark, 1, 3, 0, ra); else { at(Math.cos(ra) * 0.5, Math.sin(ra) * 0.5, 1.0, 0.4, K.dark, 1, 3, 0, ra); at(Math.cos(ra) * 1.0, Math.sin(ra) * 1.0, 0.3, 0.3, mul(K.cyan, s.lasing ? 6 : 1.2), 1, 1, 2); }
      }
    }
  }
}
export const partAt = (s, gx, gy) => s.map.get(key(gx, gy));
// which part of ship s is at body-frame point (x, y)? null when none
export function partAtPoint(s, x, y) { const dx = x - s.p[0], dy = y - s.p[1]; if (dx * dx + dy * dy > s.rad * s.rad) return null; const c = Math.cos(s.ang), sn = Math.sin(s.ang); return s.map.get(key(Math.round((c * dx + sn * dy + s.com[0]) / CELL), Math.round((-sn * dx + c * dy + s.com[1]) / CELL))) || null; }

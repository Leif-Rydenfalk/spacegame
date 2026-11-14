// orbital mechanics: Kepler elements <-> state vectors (elliptic and hyperbolic), the star system at real scale,
// patched-conic sphere-of-influence switching. Positions are double-precision metres; 2-D, so an orbit also has a direction.
import { STORY } from '../story.js';
import { angDiff, TAU } from '../core.js';
export const AU = 1.495978707e11, G0 = 9.80665, MU_STAR = 1.32712440018e20;

export function elFromState(rx, ry, vx, vy, mu, t) {
  const r = Math.hypot(rx, ry), v2 = vx * vx + vy * vy, h = rx * vy - ry * vx, dir = h >= 0 ? 1 : -1, rv = rx * vx + ry * vy;
  const ex = ((v2 - mu / r) * rx - rv * vx) / mu, ey = ((v2 - mu / r) * ry - rv * vy) / mu, e = Math.hypot(ex, ey), a = 1 / (2 / r - v2 / mu);
  const w = e > 1e-11 ? Math.atan2(ey, ex) : Math.atan2(ry, rx), nu = dir * angDiff(Math.atan2(ry, rx), w);
  let M, n;
  if (e < 1) { const E = 2 * Math.atan2(Math.sqrt(1 - e) * Math.sin(nu / 2), Math.sqrt(1 + e) * Math.cos(nu / 2)); M = E - e * Math.sin(E); n = Math.sqrt(mu / (a * a * a)); }
  else { const H = 2 * Math.atanh(Math.sqrt((e - 1) / (e + 1)) * Math.tan(nu / 2)); M = e * Math.sinh(H) - H; n = Math.sqrt(mu / (-a * a * a)); }
  return { a, e, w, dir, n, M0: M, t0: t, mu };
}
export function trueAnomaly(el, t) {
  const e = el.e; let M = el.M0 + el.n * (t - el.t0);
  if (e < 1) {
    M = M % TAU; if (M > Math.PI) M -= TAU; if (M < -Math.PI) M += TAU;
    let E = e < 0.8 ? M + e * Math.sin(M) : Math.PI * Math.sign(M || 1);
    for (let i = 0; i < 30; i++) { const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E)); E -= d; if (Math.abs(d) < 1e-14) break; }
    return 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  }
  let H = Math.asinh(M / e);
  for (let i = 0; i < 50; i++) { const d = (e * Math.sinh(H) - H - M) / (e * Math.cosh(H) - 1); H -= d; if (Math.abs(d) < 1e-14) break; }
  return 2 * Math.atan(Math.sqrt((e + 1) / (e - 1)) * Math.tanh(H / 2));
}
// position and velocity at true anomaly nu, written into out[0..3]
export function stateAtNu(el, nu, out) {
  const p = el.a * (1 - el.e * el.e), r = p / (1 + el.e * Math.cos(nu)), th = el.w + el.dir * nu, c = Math.cos(th), s = Math.sin(th), k = Math.sqrt(el.mu / p);
  const vr = k * el.e * Math.sin(nu), vt = k * (1 + el.e * Math.cos(nu)) * el.dir;
  out[0] = r * c; out[1] = r * s; out[2] = vr * c - vt * s; out[3] = vr * s + vt * c; return out;
}
export const stateFromEl = (el, t, out = [0, 0, 0, 0]) => stateAtNu(el, trueAnomaly(el, t), out);
export const period = el => el.e < 1 ? TAU / el.n : Infinity;
export const apo = el => el.e < 1 ? el.a * (1 + el.e) : Infinity;
export const peri = el => el.a * (1 - el.e);
export const energy = (rx, ry, vx, vy, mu) => (vx * vx + vy * vy) / 2 - mu / Math.hypot(rx, ry);
// time from now until true anomaly nu is next reached (elliptic)
export function timeToNu(el, t, nu) { const E = 2 * Math.atan2(Math.sqrt(1 - el.e) * Math.sin(nu / 2), Math.sqrt(1 + el.e) * Math.cos(nu / 2)); let dM = (E - el.e * Math.sin(E)) - (el.M0 + el.n * (t - el.t0)); dM = ((dM % TAU) + TAU) % TAU; return dM / el.n; }
export const hohmannTime = (r1, r2, mu) => Math.PI * Math.sqrt(Math.pow((r1 + r2) / 2, 3) / mu);

// ---- the system: a neighbouring star, seven planets, the home moon around the ringed giant, a belt at 2.1-3.3 AU ----
const N = STORY.system;
export const bodies = [];
function body(name, parent, mu, R, aAU, e, w, M0, col, o = {}) {
  const b = { id: bodies.length, name, parent, mu, R, col, atmo: 0, ring: 0, kind: 'planet', ...o };
  if (parent >= 0) { const pm = bodies[parent].mu, a = aAU * AU; b.el = { a, e, w, dir: 1, n: Math.sqrt(pm / (a * a * a)), M0, t0: 0, mu: pm }; b.soi = a * Math.pow(mu / pm, 0.4); } else b.soi = Infinity;
  bodies.push(b); return b.id;
}
export const STAR = body(N.starName, -1, MU_STAR, 6.957e8, 0, 0, 0, 0, [1.0, 0.88, 0.72], { kind: 'star' });
body(N.planets[0], STAR, 2.2e13, 2.4e6, 0.4, 0.09, 1.2, 0.5, [0.3, 0.26, 0.24]);
body(N.planets[1], STAR, 3.2e14, 6.0e6, 0.72, 0.01, 0.3, 2.9, [0.42, 0.36, 0.26], { atmo: 9e4 });
export const GIANT = body(N.planets[2], STAR, 1.2e17, 5.5e7, 1.1, 0.03, 2.0, 4.1, [0.2, 0.16, 0.26], { atmo: 1.5e6, ring: 1, kind: 'gas' });
body(N.planets[3], STAR, 4.3e13, 3.4e6, 1.6, 0.07, 5.0, 1.0, [0.34, 0.2, 0.16], { atmo: 4e4 });
body(N.planets[4], STAR, 9.0e16, 6.2e7, 5.4, 0.05, 0.2, 3.3, [0.36, 0.3, 0.24], { atmo: 1.5e6, kind: 'gas' });
body(N.planets[5], STAR, 2.4e16, 4.0e7, 11, 0.04, 4.0, 5.5, [0.16, 0.26, 0.3], { atmo: 1e6, kind: 'gas' });
body(N.planets[6], STAR, 6.8e15, 2.4e7, 30, 0.01, 1.0, 0.7, [0.1, 0.16, 0.3], { atmo: 8e5, kind: 'gas' });
// home: g = 8.7 m/s^2 at R = 5,200 km, a moon of the giant. Atmosphere scale height 7 km, gone by 70 km.
export const HOME = body(N.homeName, GIANT, 8.7 * 5.2e6 * 5.2e6, 5.2e6, 4.2e8 / AU, 0.004, 0.4, 1.3, [0.05, 0.075, 0.085], { atmo: 7e4, kind: 'home' });
body(N.moonName, GIANT, 3.0e12, 1.1e6, 9.5e8 / AU, 0.02, 3.0, 0.2, [0.2, 0.2, 0.21], { kind: 'moon' });
export const ATMO = { rho0: 1.1, H: 7000, top: 70000 };

const tmp = [0, 0, 0, 0];
// absolute (star-centred) position and velocity of a body at time t
export function bodyState(i, t, out = [0, 0, 0, 0]) {
  out[0] = out[1] = out[2] = out[3] = 0;
  for (let b = bodies[i]; b.parent >= 0; b = bodies[b.parent]) { stateFromEl(b.el, t, tmp); out[0] += tmp[0]; out[1] += tmp[1]; out[2] += tmp[2]; out[3] += tmp[3]; }
  return out;
}
// patched conics: move an object { body, p, v } into the sphere of influence it is actually in. Returns true on a switch.
export function patch(o, t) {
  const b = bodies[o.body], r = Math.hypot(o.p[0], o.p[1]);
  if (b.parent >= 0 && r > b.soi) { stateFromEl(b.el, t, tmp); o.p[0] += tmp[0]; o.p[1] += tmp[1]; o.v[0] += tmp[2]; o.v[1] += tmp[3]; o.body = b.parent; o.el = null; return true; }
  for (const c of bodies) if (c.parent === o.body) { stateFromEl(c.el, t, tmp); const dx = o.p[0] - tmp[0], dy = o.p[1] - tmp[1]; if (dx * dx + dy * dy < c.soi * c.soi) { o.p[0] = dx; o.p[1] = dy; o.v[0] -= tmp[2]; o.v[1] -= tmp[3]; o.body = c.id; o.el = null; return true; } }
  return false;
}
// absolute position of an object in a body's frame
export function absPos(o, t, out = [0, 0, 0, 0]) { bodyState(o.body, t, out); out[0] += o.p[0]; out[1] += o.p[1]; out[2] += o.v[0]; out[3] += o.v[1]; return out; }

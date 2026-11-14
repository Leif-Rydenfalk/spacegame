// in-page property tests (?test=1). Prints "tests ok N" or the failures.
import { rng, TAU } from './core.js';
import { elFromState, stateFromEl, energy, hohmannTime, G0 } from './space/orbit.js';
import { makeShip, BP, stepShip, split, recalc, islands, growHive } from './space/ship.js';
import { leadTime } from './space/combat.js';
import { genSector } from './space/belt.js';
import { propagate } from './surface/light.js';
import { world } from './surface/world.js';

export function runTests() {
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
  // 7 determinism: the same seed gives the same tiles and the same belt sector
  { let same = true; for (let i = 0; i < 300; i++) { const x = Math.floor(r() * 4000 - 2000), y = Math.floor(r() * 200 - 150); if (world.get(x, y) !== world.get(x, y)) same = false; } const a = genSector(7, 11), b = genSector(7, 11);
    ok('determinism', same && a.length === b.length && a.every((q, i) => q.R === b[i].R && q.el.a === b[i].el.a && q.r[17] === b[i].r[17])); }
  // 8 lead solution really intercepts
  { let w = 0; for (let i = 0; i < 200; i++) { const rx = r() * 4000 - 2000, ry = r() * 4000 - 2000, vx = r() * 400 - 200, vy = r() * 400 - 200, t = leadTime(rx, ry, vx, vy, 1100); w = Math.max(w, t === null ? 1 : Math.abs(Math.hypot(rx + vx * t, ry + vy * t) - 1100 * t)); } ok('lead intercept', w < 1e-6, String(w)); }
  const msg = fails.length ? `tests FAIL ${fails.length}/${n}: ${fails.join('; ')}` : `tests ok ${n}`;
  console.log(msg); window.__tests = msg;
  const d = document.createElement('div'); d.style.cssText = 'position:fixed;left:24px;bottom:84px;font:11px ui-monospace,monospace;color:#9fb3bf;letter-spacing:.08em;text-transform:uppercase'; d.textContent = msg; document.body.appendChild(d);
}

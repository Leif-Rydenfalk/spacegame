// loose matter: everything that lies in the world. What the laser cuts out of the ground falls as rock with mass;
// what a cut plant or a dead animal leaves, what you drop, what a robot sets down: all of it is one kind of thing, a
// body of some item and amount that lies there until somebody carries it away. Nothing here is created or lost:
// spawn() and take() are the only doors, and the tests add the masses up.
//
// Round 5: the bodies are rigid convex polygons (a box with four chamfered corners, so the renderer draws exactly the
// shape the solver moves), with mass and moment of inertia. One solver for all of them:
//   contacts   every vertex and side midpoint against the density field (distance and gradient), and polygon against
//              polygon by separating axes with a clipped two-point manifold; a 1.6 m grid is the broad phase
//   solve      sequential impulses, 8 iterations: normal impulse with restitution above 1.2 m/s, Coulomb friction, a
//              capped penetration bias with slop, speculative margin against the ground so nothing tunnels
//   rest       angular damping in contact; a body that has been slow for 0.4 s sleeps and costs nothing; it wakes when
//              the ground under it is edited, when what it leans on is taken, or when something hits it
//   fracture   a hard enough blow splits a rock across its long axis into two or three smaller rocks whose amounts
//              add up to the parent's exactly
// The field is polar (x along the ground, y up), so gravity is -y here and radial on the planet.
import { rand, hash } from '../core.js';
import { ITEMS, inv } from '../items.js';
import { world, GRAV, SLAB, TS } from './world.js';
import { light } from './light.js';
import { heat } from './heat.js';
import { S, C, mul } from './state.js';
const RHO = { rubble: 2900, 'lean ore': 3600, slag: 2800, silicon: 2300, soil: 1500, basalt: 2900, 'iron ore': 5000, 'copper ore': 4200, lumen: 2100, iron: 7800, copper: 8900, biomass: 600, fibre: 400, chitin: 1200, 'xeno shard': 3400 }, nv = [0, 0];
const ORG = { biomass: 1, fibre: 1, resin: 1, ichor: 1, chitin: 1 };
export const ROCK = { fric: 0.65, rest: 0.18, slop: 0.012, iters: 8, vmax: 40, sleepV: 0.15, sleepT: 0.4, minPiece: 1.5, fracV: 5.5 };
export const kgOf = (id, n) => n * ITEMS[id].m;
const areaOf = (id, kg) => Math.max(0.012, Math.min(1.3, kg / ((RHO[id] || 1500) * SLAB)));
const whole = id => ITEMS[id].u === 'ea' || ITEMS[id].u === 'rd';
// can a blow break it? Rock and ore can; a kit, a cell, a lump of biomass cannot
export const brittle = c => !whole(c.id) && !ORG[c.id] && c.kg >= ROCK.minPiece * 2;
// the speed change that breaks a rock of this mass: big rocks break from a two metre fall, small ones hardly ever
export const fracSpeed = kg => ROCK.fracV + 30 / kg;
// fit the body's box to its area, keeping its aspect and cuts; fills the local vertices, the radius and the inertia
function fit(c) {
  const A = areaOf(c.id, c.kg), k = c.cut, a = c.asp, q = (k[0] * k[0] + k[1] * k[1] + k[2] * k[2] + k[3] * k[3]) / 2;
  const s = Math.sqrt(A / (a >= 1 ? 4 * a - q : 4 / a - q)), hw = c.hw = a >= 1 ? s * a : s, hh = c.hh = a >= 1 ? s : s / a, m = Math.min(hw, hh), v = c.lv, c0 = k[0] * m, c1 = k[1] * m, c2 = k[2] * m, c3 = k[3] * m;
  v[0] = hw; v[1] = hh - c0; v[2] = hw - c0; v[3] = hh; v[4] = -hw + c1; v[5] = hh; v[6] = -hw; v[7] = hh - c1; v[8] = -hw; v[9] = -hh + c2; v[10] = -hw + c2; v[11] = -hh; v[12] = hw - c3; v[13] = -hh; v[14] = hw; v[15] = -hh + c3;
  c.r = Math.sqrt(A / Math.PI); c.br = Math.hypot(hw, hh); c.m = Math.max(c.kg, 1); c.im = 1 / c.m; c.ii = 1 / (c.m * (hw * hw + hh * hh) / 3); c.stamp = -1;
}
// world vertices and edge normals, once per step per body that needs them
let stamp = 0;
function pose(c) {
  if (c.stamp === stamp) return; c.stamp = stamp; const cs = Math.cos(c.rot), sn = Math.sin(c.rot), l = c.lv, w = c.wv, n = c.wn;
  for (let i = 0; i < 16; i += 2) { w[i] = c.x + l[i] * cs - l[i + 1] * sn; w[i + 1] = c.y + l[i] * sn + l[i + 1] * cs; }
  for (let i = 0; i < 16; i += 2) { const j = (i + 2) & 15, ex = w[j] - w[i], ey = w[j + 1] - w[i + 1], d = Math.hypot(ex, ey) || 1; n[i] = ey / d; n[i + 1] = -ex / d; }
}
// the edge of A that B is least behind: [separation, edge index * 2]
const sepOut = [0, 0];
function maxSep(A, B) {
  const av = A.wv, an = A.wn, bv = B.wv; let best = -1e9, bi = 0;
  for (let i = 0; i < 16; i += 2) { const nx = an[i], ny = an[i + 1], px = av[i], py = av[i + 1]; let mn = 1e9; for (let j = 0; j < 16; j += 2) { const d = (bv[j] - px) * nx + (bv[j + 1] - py) * ny; if (d < mn) mn = d; } if (mn > best) { best = mn; bi = i; if (best > 0) break; } }
  sepOut[0] = best; sepOut[1] = bi;
}
const pool = []; let nc = 0;
function contact(a, b, px, py, nx, ny, pen) {
  const k = pool[nc] || (pool[nc] = {}); nc++; k.a = a; k.b = b; k.px = px; k.py = py; k.nx = nx; k.ny = ny; k.pen = pen; k.jn = 0; k.jt = 0; return k;
}
// polygon against polygon: reference face, incident edge, clip. The normal points from the first body to the second.
function polyPoly(A, B) {
  maxSep(A, B); const sa = sepOut[0], ia = sepOut[1]; if (sa > 0) return; maxSep(B, A); const sb = sepOut[0], ib = sepOut[1]; if (sb > 0) return;
  let R = A, I = B, ri = ia; if (sb > sa + 0.004) { R = B; I = A; ri = ib; }
  const rv = R.wv, nx = R.wn[ri], ny = R.wn[ri + 1], r2 = (ri + 2) & 15, v1x = rv[ri], v1y = rv[ri + 1], v2x = rv[r2], v2y = rv[r2 + 1];
  let ii = 0, md = 1e9; for (let j = 0; j < 16; j += 2) { const d = I.wn[j] * nx + I.wn[j + 1] * ny; if (d < md) { md = d; ii = j; } }
  const i2 = (ii + 2) & 15; let ax = I.wv[ii], ay = I.wv[ii + 1], bx = I.wv[i2], by = I.wv[i2 + 1];
  const tx = -ny, ty = nx, lo = v1x * tx + v1y * ty, hi = v2x * tx + v2y * ty;      // the face runs from v1 to v2 along the tangent
  let da = ax * tx + ay * ty, db = bx * tx + by * ty;
  if (da < lo && db < lo || da > hi && db > hi) return;
  if (da < lo) { const u = (lo - da) / (db - da); ax += (bx - ax) * u; ay += (by - ay) * u; da = lo; } else if (da > hi) { const u = (hi - da) / (db - da); ax += (bx - ax) * u; ay += (by - ay) * u; da = hi; }
  if (db < lo) { const u = (lo - db) / (da - db); bx += (ax - bx) * u; by += (ay - by) * u; } else if (db > hi) { const u = (hi - db) / (da - db); bx += (ax - bx) * u; by += (ay - by) * u; }
  const s1 = (ax - v1x) * nx + (ay - v1y) * ny, s2 = (bx - v1x) * nx + (by - v1y) * ny;
  if (s1 <= 0.004) contact(R, I, ax - nx * s1 * 0.5, ay - ny * s1 * 0.5, nx, ny, -s1);
  if (s2 <= 0.004 && Math.abs(ax - bx) + Math.abs(ay - by) > 0.01) contact(R, I, bx - nx * s2 * 0.5, by - ny * s2 * 0.5, nx, ny, -s2);
}
// a body against the ground: every vertex and the midpoints of the four long sides
function polyGround(c) {
  const dc = world.dist(c.x, c.y); if (dc > c.br + 0.15) return; pose(c); const w = c.wv;
  for (let i = 0; i < 24; i += 2) {
    let px, py; if (i < 16) { px = w[i]; py = w[i + 1]; } else { const e = (i - 16) * 2 + 2, f = (e + 2) & 15; if (Math.abs(w[e] - w[f]) + Math.abs(w[e + 1] - w[f + 1]) < 0.24) continue; px = (w[e] + w[f]) / 2; py = (w[e + 1] + w[f + 1]) / 2; }
    const d = world.dist(px, py); if (d > 0.03) continue;
    if (world.normal(px, py, nv) < 0.05) { const dx = c.x - px, dy = c.y - py, l = Math.hypot(dx, dy) || 1; nv[0] = dx / l; nv[1] = dy / l; if (dc < -0.3) { nv[0] = 0; nv[1] = 1; } }      // deep inside, where the field is flat: out toward the body's own centre, or up
    // a corner that has come out of the far side of a thin shelf would be pushed further through: a contact only ever
    // pushes a point back toward the body's own centre
    if (d < -0.02 && (c.x - px) * nv[0] + (c.y - py) * nv[1] < -0.25 * Math.hypot(c.x - px, c.y - py)) continue;
    contact(null, c, px, py, nv[0], nv[1], -d); if (-d > c.deep) { c.deep = -d; c.dnx = nv[0]; c.dny = nv[1]; }
  }
  // a ridge thinner than the gap between two corners can reach in between them: the centre is felt too
  if (dc < 0) { if (world.normal(c.x, c.y, nv) < 0.05) { nv[0] = 0; nv[1] = 1; } contact(null, c, c.x, c.y, nv[0], nv[1], -dc); if (-dc > 0.04) { c.deep = Math.max(c.deep, -dc, 0.07); c.dnx = nv[0]; c.dny = nv[1]; } }       // a centre well inside rock is "sunk" whatever the corners say, and its way out is the way out
}
const gridKey = (i, j) => (i + 32768) * 65536 + j + 32768, GC = 1.6;
function shapeNew(c, seed) { const h = i => hash(seed, i, 911); c.asp = whole(c.id) ? 1.25 : 0.62 + h(1) * 1.3; c.cut = whole(c.id) ? [0.14, 0.14, 0.14, 0.14] : [0.18 + h(2) * 0.5, 0.18 + h(3) * 0.5, 0.18 + h(4) * 0.5, 0.18 + h(5) * 0.5]; }
export const matter = {
  list: [], made: 0, taken: 0, nextId: 1, awake: 0, contacts: 0, breaks: 0,
  // n in the item's own unit; returns the body
  spawn(id, n, x, y, vx = 0, vy = 0, temp = 0) {
    if (!(n > 1e-9) || !ITEMS[id]) return null; const kg = kgOf(id, n), uid = this.nextId++;
    for (let i = 0; i < 3; i++) { const d = world.dens(x, y); if (d <= 0) break; if (world.normal(x, y, nv) < 0.05) { nv[0] = 0; nv[1] = 1; } x += nv[0] * (d + 0.06); y += nv[1] * (d + 0.06); }      // nothing is born inside the ground
    const c = { uid, id, n, kg, x, y, vx, vy, av: rand(-3, 3), rot: (hash(uid, 3, 913) - 0.5) * 3, temp, rest: 0, asleep: false, seed: hash(uid, 7, 912) * 100, claim: null, dumped: false, lv: new Float64Array(16), wv: new Float64Array(16), wn: new Float64Array(16), touch: 0, hit: 0, deep: 0, ax: x, ay: y, ar: 0, still: 0 };
    if (id === 'rubble') { c.q = { ...(inv.nextQ || inv.lastQ || { fe: 0.09, cu: 0.00006, lm: 0, host: 2 }) }; inv.nextQ = null; }       // rock nobody has assayed carries what it really is (geology.js)
    shapeNew(c, uid); fit(c); this.list.push(c); this.made += kg; return c;
  },
  // take up to n out of a body; returns the amount taken. The body is removed when it is empty.
  take(c, n) { const k = Math.min(n, c.n); if (c.q) inv.lastQ = c.q; c.n -= k; c.kg = kgOf(c.id, c.n); this.taken += kgOf(c.id, k); if (c.n <= 1e-9) { const i = this.list.indexOf(c); if (i >= 0) this.list.splice(i, 1); c.gone = true; } else fit(c); this.wake(c.x, c.y, c.br + 1); return k; },
  // what rested on something that is gone has to fall
  wake(x, y, r) { for (const o of this.list) if (o.asleep && Math.abs(o.x - x) < r + o.br && Math.abs(o.y - y) < r + o.br) { o.asleep = false; o.rest = 0; o.casc = 1; } },
  wakeBox(x0, y0, x1, y1) { for (const o of this.list) if (o.asleep && o.x > x0 - o.br - 0.3 && o.x < x1 + o.br + 0.3 && o.y > y0 - o.br - 0.3 && o.y < y1 + o.br + 0.3) { o.asleep = false; o.rest = 0; o.casc = 1; } },
  total(id) { let s = 0; for (const c of this.list) if (!id || c.id === id) s += c.kg; return s; },
  // the nearest body within r of a point that passes the filter
  near(x, y, r, ok) { let best = null, bd = r; for (const c of this.list) { const d = Math.hypot(c.x - x, c.y - y); if (d < bd && (!ok || ok(c))) { bd = d; best = c; } } return best; },
  // split a rock into k pieces across its long axis. The amounts add up to the parent's exactly. Returns the pieces.
  fracture(c, k = 2) {
    if (c.gone || !brittle(c)) return []; k = Math.max(2, Math.min(k, Math.floor(c.kg / ROCK.minPiece))); if (k < 2) return [];
    const along = c.hw >= c.hh, L = along ? c.hw : c.hh, T = along ? c.hh : c.hw, cs = Math.cos(c.rot), sn = Math.sin(c.rot), ax = along ? cs : -sn, ay = along ? sn : cs, out = [], cuts = [0];
    for (let i = 1; i < k; i++) cuts.push((i + (hash(c.uid, i, 921) - 0.5) * 0.36) / k); cuts.push(1);
    let left = c.n; const i0 = this.list.indexOf(c); if (i0 >= 0) this.list.splice(i0, 1); c.gone = true; this.made -= c.kg;
    for (let i = 0; i < k; i++) {
      const f = cuts[i + 1] - cuts[i], n = i === k - 1 ? left : c.n * f, mid = ((cuts[i] + cuts[i + 1]) - 1) * L; left -= n;
      if (c.q) inv.nextQ = c.q; const p = this.spawn(c.id, n, c.x + ax * mid, c.y + ay * mid, 0, 0, c.temp); if (!p) continue; p.zone = c.zone;
      // each piece keeps the parent's outer corners and gets fresh ones where the break ran
      const pl = f * L, h = j => 0.12 + hash(p.uid, j, 922) * 0.3, o = c.cut, sc = v => Math.min(0.7, v * Math.min(L, T) / Math.min(pl, T));
      p.asp = along ? pl / T : T / pl; p.cut = along ? [i === k - 1 ? sc(o[0]) : h(0), i === 0 ? sc(o[1]) : h(1), i === 0 ? sc(o[2]) : h(2), i === k - 1 ? sc(o[3]) : h(3)] : [i === k - 1 ? sc(o[0]) : h(0), i === k - 1 ? sc(o[1]) : h(1), i === 0 ? sc(o[2]) : h(2), i === 0 ? sc(o[3]) : h(3)];
      p.rot = c.rot; fit(p); const rx = p.x - c.x, ry = p.y - c.y, push = (i - (k - 1) / 2) * 0.9;
      p.vx = c.vx - c.av * ry + ax * push + rand(-0.2, 0.2); p.vy = c.vy + c.av * rx + ay * push + rand(0, 0.3); p.av = c.av + rand(-1.5, 1.5); p.dumped = c.dumped; p.hit = 0; p.cool = 0.25; out.push(p);
    }
    this.breaks++; if (S.crack) S.crack(c, out); return out;
  },
  // fast bodies are stepped in shorter steps, so nothing moves more than 0.12 m between two looks at the ground
  step(dt) { let v = 0; for (const c of this.list) if (!c.asleep) { const s = Math.abs(c.vx) + Math.abs(c.vy); if (s > v) v = s; } const n = Math.max(1, Math.min(4, Math.ceil(v * dt / 0.12))); for (let i = 0; i < n; i++) this.sub(dt / n); },
  sub(dt) {
    const L = this.list, R = ROCK; let awake = 0; stamp++; nc = 0;
    for (const c of L) {
      if (c.temp > 0) c.temp = Math.max(0, c.temp - dt * (0.12 + c.temp * 0.3)); if (c.cool > 0) c.cool -= dt;
      if (c.chk) { c.chk = 0; pose(c); let sup = false; for (let i = 0; i < 16 && !sup; i += 2) if (world.dist(c.wv[i], c.wv[i + 1]) < 0.06) sup = true; if (!sup) c.asleep = false; }      // loaded from a save: does the ground still hold it?
      if (c.asleep) continue; awake++;
      if (c.casc) { c.casc = 0; if (c.wasRest) this.wake(c.x, c.y, 0.12); } c.wasRest = 0;      // it lost its support: what leaned on it has to look again
      c.vy -= GRAV * dt; const sp = Math.hypot(c.vx, c.vy); if (sp > R.vmax) { c.vx *= R.vmax / sp; c.vy *= R.vmax / sp; } if (c.av > 30) c.av = 30; else if (c.av < -30) c.av = -30;
      c.wasDeep = c.deep > 0.06; c.touch = 0; c.hit = 0; c.deep = 0; c.stamp = -1;
      if (c.y < -400) { c.asleep = true; c.vx = c.vy = c.av = 0; }
    }
    this.awake = awake;
    const pressure = L.length > 260 && (S.frameN || 0) % 30 === 0;
    if (!awake && !pressure) { this.contacts = 0; return; }
    // broad phase: every body into a coarse grid; pairs with at least one awake body go to the narrow phase
    const grid = new Map();
    for (const c of L) { const i0 = Math.floor((c.x - c.br) / GC), i1 = Math.floor((c.x + c.br) / GC), j0 = Math.floor((c.y - c.br) / GC), j1 = Math.floor((c.y + c.br) / GC); for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const k = gridKey(i, j), g = grid.get(k); if (g) g.push(c); else grid.set(k, [c]); } }
    for (const [key, cell] of grid) {
      if (cell.length < 2) continue; const ci = Math.floor(key / 65536) - 32768, cj = (key % 65536) - 32768;
      for (let a = 0; a < cell.length; a++) for (let b = a + 1; b < cell.length; b++) {
        const A = cell[a], B = cell[b]; if (A.gone || B.gone) continue; const dx = B.x - A.x, dy = B.y - A.y, rr = A.br + B.br; if (dx * dx + dy * dy > rr * rr) continue;
        // a pair that shares several cells is handled in the one that holds the corner of its overlap
        if (Math.floor(Math.max(A.x - A.br, B.x - B.br) / GC) !== ci || Math.floor(Math.max(A.y - A.br, B.y - B.br) / GC) !== cj) continue;
        if (A.asleep && B.asleep) {       // only when there are very many: resting gravel of one kind becomes one heap
          if (pressure && A.id === B.id && !whole(A.id) && !A.claim && !B.claim && A.dumped === B.dumped && A.kg + B.kg <= 80 && dx * dx + dy * dy < (A.r + B.r) * (A.r + B.r) * 0.8) { const K = A.kg >= B.kg ? A : B, O = K === A ? B : A; K.y = Math.max(K.y, O.y); K.x = (K.x * K.kg + O.x * O.kg) / (K.kg + O.kg); K.n += O.n; K.kg += O.kg; K.temp = Math.max(K.temp, O.temp); fit(K); O.gone = true; K.asleep = false; K.rest = 0; }
          continue;
        }
        pose(A); pose(B); const n0 = nc; polyPoly(A, B);
        if (nc > n0 && (A.asleep || B.asleep)) {      // what is hit wakes; so does what lies on a body that is still sunk in the ground, so the two can sort themselves out
          const Z = A.asleep ? A : B, W = A.asleep ? B : A, k = pool[n0], rvn = (W.vx - Z.vx) * k.nx + (W.vy - Z.vy) * k.ny;
          if (Math.abs(rvn) > 0.7 || W.vx * W.vx + W.vy * W.vy > 1.2 || W.wasDeep) { Z.asleep = false; Z.rest = 0; Z.touch = 0; Z.hit = 0; awake++; }
        }
      }
    }
    for (const c of L) if (!c.asleep && !c.gone) polyGround(c);
    this.contacts = nc;
    // prepare
    for (let i = 0; i < nc; i++) {
      const k = pool[i], a = k.a, b = k.b, ima = a && !a.asleep ? a.im : 0, iia = a && !a.asleep ? a.ii : 0, imb = b.asleep ? 0 : b.im, iib = b.asleep ? 0 : b.ii;
      const rax = a ? k.px - a.x : 0, ray = a ? k.py - a.y : 0, rbx = k.px - b.x, rby = k.py - b.y, tx = -k.ny, ty = k.nx;
      const can = rax * k.ny - ray * k.nx, cbn = rbx * k.ny - rby * k.nx, cat = rax * ty - ray * tx, cbt = rbx * ty - rby * tx;
      k.rax = rax; k.ray = ray; k.rbx = rbx; k.rby = rby; k.ima = ima; k.iia = iia; k.imb = imb; k.iib = iib;
      const dn = ima + imb + iia * can * can + iib * cbn * cbn, dtg = ima + imb + iia * cat * cat + iib * cbt * cbt; k.kn = dn > 0 ? 1 / dn : 0; k.kt = dtg > 0 ? 1 / dtg : 0;
      const vax = a ? a.vx - a.av * ray : 0, vay = a ? a.vy + a.av * rax : 0, vn = (b.vx - b.av * rby - vax) * k.nx + (b.vy + b.av * rbx - vay) * k.ny;
      // the target speed along the normal: bounce off a hard hit, or, while still apart, close no more than the gap. Overlap is taken out of the positions below, not out of the speeds, so a resting pile gains no energy
      k.bias = k.pen < 0 ? k.pen / dt : vn < -1.2 ? -R.rest * vn : 0;
      if (a) a.touch++; b.touch++;
    }
    for (let it = 0; it < R.iters; it++) for (let i = 0; i < nc; i++) {
      const k = pool[i], a = k.a, b = k.b, nx = k.nx, ny = k.ny, tx = -ny, ty = nx;
      let rvx = b.vx - b.av * k.rby - (a ? a.vx - a.av * k.ray : 0), rvy = b.vy + b.av * k.rbx - (a ? a.vy + a.av * k.rax : 0);
      let j = (k.bias - (rvx * nx + rvy * ny)) * k.kn; const j0 = k.jn; k.jn = Math.max(0, j0 + j); j = k.jn - j0;
      if (j) { const ix = nx * j, iy = ny * j; if (k.imb) { b.vx += ix * k.imb; b.vy += iy * k.imb; b.av += (k.rbx * iy - k.rby * ix) * k.iib; } if (k.ima) { a.vx -= ix * k.ima; a.vy -= iy * k.ima; a.av -= (k.rax * iy - k.ray * ix) * k.iia; } }
      rvx = b.vx - b.av * k.rby - (a ? a.vx - a.av * k.ray : 0); rvy = b.vy + b.av * k.rbx - (a ? a.vy + a.av * k.rax : 0);
      let jt = -(rvx * tx + rvy * ty) * k.kt; const mx = R.fric * k.jn, t0 = k.jt; k.jt = Math.max(-mx, Math.min(mx, t0 + jt)); jt = k.jt - t0;
      if (jt) { const ix = tx * jt, iy = ty * jt; if (k.imb) { b.vx += ix * k.imb; b.vy += iy * k.imb; b.av += (k.rbx * iy - k.rby * ix) * k.iib; } if (k.ima) { a.vx -= ix * k.ima; a.vy -= iy * k.ima; a.av -= (k.rax * iy - k.ray * ix) * k.iia; } }
    }
    // the hardest blow each body took, as a change of speed: that is what breaks rock
    for (let i = 0; i < nc; i++) { const k = pool[i]; if (k.jn <= 0) continue; if (k.a && k.ima) { const h = k.jn * k.ima; if (h > k.a.hit) k.a.hit = h; } if (k.imb) { const h = k.jn * k.imb; if (h > k.b.hit) k.b.hit = h; } }
    let broke = null;
    for (const c of L) {
      if (c.asleep || c.gone) continue;
      if (c.touch) { c.av *= 1 - Math.min(1, dt * 2.2); c.vx *= 1 - dt * 0.4; if (c.hit > 3 && c.kg > 4 && S.thud) S.thud(c, c.hit); }
      else { c.av *= 1 - dt * 0.25; c.vx *= 1 - dt * 0.05; }
      c.x += c.vx * dt; c.y += c.vy * dt; c.rot += c.av * dt;
      if (Math.abs(c.x - c.ax) + Math.abs(c.y - c.ay) > 0.03 || Math.abs(c.rot - c.ar) > 0.08 || !c.touch) { c.ax = c.x; c.ay = c.y; c.ar = c.rot; c.still = 0; } else c.still += dt;      // wedged and going nowhere is at rest too
      if (c.hit > fracSpeed(c.kg) && !(c.cool > 0) && brittle(c)) (broke || (broke = [])).push(c);
      const e = c.vx * c.vx + c.vy * c.vy + c.av * c.av * c.r * c.r;
      // nothing goes to sleep sunk in the ground: it is pushed out first, harder after three quarters of a second; what is
      // still held after six (shut in on every side) is left where it is
      if (c.deep > 0.06) { c.deepT = (c.deepT || 0) + dt; if (c.deepT < 6) { c.rest = 0; if (c.deepT > 0.75) { c.x += c.dnx * Math.min(c.deep, 0.04); c.y += c.dny * Math.min(c.deep, 0.04); } } } else c.deepT = 0;
      if (c.still > 1) c.rest = R.sleepT + 1; if (c.touch && (e < R.sleepV * R.sleepV || c.still > 1)) { c.rest += dt; if (c.rest > R.sleepT) { c.asleep = true; c.wasRest = 1; c.vx = c.vy = c.av = 0; } } else c.rest = 0;
    }
    // overlap out of the positions: a fifth of what is over the slop, a few centimetres a step at most
    for (let i = 0; i < nc; i++) { const k = pool[i]; if (k.pen <= R.slop || !k.kn) continue; const a = k.a, b = k.b, P = (a ? Math.min(0.03, 0.2 * (k.pen - R.slop)) : Math.min(0.05, 0.35 * (k.pen - R.slop))) * k.kn, ix = k.nx * P, iy = k.ny * P;
      if (k.imb && !b.asleep) { b.x += ix * k.imb; b.y += iy * k.imb; b.rot += (k.rbx * iy - k.rby * ix) * k.iib; } if (k.ima && !a.asleep) { a.x -= ix * k.ima; a.y -= iy * k.ima; a.rot -= (k.rax * iy - k.ray * ix) * k.iia; } }
    if (broke) for (const c of broke) this.fracture(c, c.hit > fracSpeed(c.kg) * 1.7 ? 3 : 2);
    for (let i = L.length - 1; i >= 0; i--) if (L[i].gone) L.splice(i, 1);
  },
  draw(b, time) {
    const cam = S.cam;
    for (const c of this.list) {
      if (Math.abs(c.x - cam.x) > 24 * Math.min(S.zo, 4) || Math.abs(c.y - cam.y) > 14 * Math.min(S.zo, 4)) continue;
      const d = ITEMS[c.id], col = d.c || C.steel, org = ORG[c.id], w = c.hw * 2, h = c.hh * 2;
      if (whole(c.id)) { b.poly(c.x, c.y, w, h, c.rot, mul(C.steel, 0.7), 1, 1, c.seed, c.cut); b.add(c.x, c.y, Math.min(w, h) * 0.4, Math.min(w, h) * 0.4, c.rot, mul(col, 1.2), 1, 0, 2, 1); continue; }
      b.poly(c.x, c.y, w, h, c.rot, mul(col, (org ? 0.24 : 0.46) * (0.85 + 0.3 * hash(c.uid, 1, 5))), 1, 1, c.seed, c.cut);
      if (c.temp > 0.06 && !org) b.poly(c.x, c.y, w, h, c.rot, [1.5 * c.temp, 0.3 * c.temp * c.temp, 0.02 * c.temp], Math.min(0.8, c.temp), 2, c.seed, c.cut);
      if (c.temp > 0.15) { b.add(c.x, c.y, c.r * 4, c.r * 4, 0, [1.2, 0.28, 0.03], Math.min(0.35, c.temp * 0.3), 1, 2); light.emit(c.x / TS, c.y / TS, 1.2 * c.temp, 0.3 * c.temp, 0.04 * c.temp); }
      if (c.id === 'lumen') { b.add(c.x, c.y, c.r * 4, c.r * 4, 0, mul(C.cyan, 0.3), 0.6, 1, 2); light.emit(c.x / TS, c.y / TS, 0.03, 0.3, 0.26); }
    }
  },
  // a body is saved with its pose and its shape, so a pile comes back as the pile it was
  dump() { const f = v => +v.toFixed(3); return this.list.map(c => { const o = [c.id, +c.n.toFixed(5), f(c.x), f(c.y), c.dumped ? 1 : 0, f(c.rot), f(c.asp), c.cut.map(f)]; if (c.q || c.zone) o.push(c.q ? [+c.q.fe.toFixed(4), +c.q.cu.toFixed(5), +c.q.lm.toFixed(5), c.q.host, c.q.ox === undefined ? null : f(c.q.ox), c.q.oy === undefined ? null : f(c.q.oy)] : 0, c.zone || 0); return o; }); },
  load(a) {
    this.list.length = 0; this.made = this.taken = 0; this.nextId = 1;
    for (const q of a || []) { if (!ITEMS[q[0]]) continue; if (q[8]) inv.nextQ = { fe: q[8][0], cu: q[8][1], lm: q[8][2], host: q[8][3], ...(q[8][4] === null || q[8][4] === undefined ? {} : { ox: q[8][4], oy: q[8][5] }) }; const c = this.spawn(q[0], q[1], q[2], q[3]); if (!c) continue; c.dumped = !!q[4]; if (q[9]) c.zone = q[9]; c.av = 0; if (q[7]) { c.rot = q[5]; c.asp = q[6]; c.cut = q[7].slice(); } else c.rot = 0; fit(c); c.asleep = true; c.wasRest = 1; c.chk = 1; }      // a version 4 body had no shape: it gets one from its place in the list
  },
};
world.onEdit = (x0, y0, x1, y1) => { if (matter.list.length) matter.wakeBox(x0, y0, x1, y1); if (world.onEdit2) world.onEdit2(x0, y0, x1, y1); };
// hot loose rock warms the ground it lies on a little, so a fresh spoil heap glows
export function matterHeat(dt) { for (const c of matter.list) if (c.temp > 0.5 && Math.random() < dt * 2) heat.add(c.x, c.y - c.r, 0.35, 0.05); }

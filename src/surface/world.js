// surface world: a fine dynamic density field (0.125 m samples, 64x64 chunks, one density byte and one material byte
// per sample), generated on demand as a pure function of (x, y, seed) and then edited with smooth brushes.
// density byte 128 is the surface; one metre of signed distance is 254 steps, saturating at +-0.5 m.
import { noise2, clamp } from '../core.js';
import { CELL, CH, TS, GRAV, SLAB, WALL, M, MAT, CIRC, surfaceH, natD, oreIron, oreCopper, oreLumen, stampSD, stampBox, canonX } from './gen.js';
import { planet } from './planet.js';
import { structsIn } from './structures.js';
export { CELL, CH, TS, GRAV, SLAB, WALL, M, MAT, surfaceH };
const N = CH * CH, LN = CH / 2 + 1, KG = CELL * CELL * SLAB;      // KG * rho = kg in one full sample
const chunks = new Map(); let lastKey = NaN, last = null;
const Ld = new Float32Array(LN * LN), Li = new Float32Array(LN * LN), Lc = new Float32Array(LN * LN), Ll = new Float32Array(LN * LN), Lh = new Float32Array(LN), F = new Float32Array(N);
// the field closes on itself: chunk columns are counted modulo the circumference (504 of them)
const NCX = CIRC / (CH * CELL), wrapC = cx => ((cx % NCX) + NCX) % NCX;
const ckey = (cx, cy) => (cx + 32768) * 65536 + (cy + 32768);
export const cov = b => b <= 112 ? 0 : b >= 144 ? 1 : (b - 112) / 32;      // antialiased coverage of one sample

function genChunk(cx, cy) {
  // X0 is the chunk's place in the current chart (structures are asked for there); XC is its canonical place (noise)
  const d = new Uint8Array(N), m = new Uint8Array(N), X0 = planet.fix(cx * CH * CELL), XC = canonX(X0), Y0 = cy * CH * CELL, W = CH * CELL;
  let hmax = -1e9; for (let i = 0; i < LN; i++) { const h = Lh[i] = surfaceH(X0 + i * 0.25); if (h > hmax) hmax = h; }
  const sts = structsIn(X0 - 1, X0 + W + 1).filter(s => s.y1 > Y0 - 1 && s.y0 < Y0 + W + 1);
  if (Y0 > hmax + 1.5 && !sts.length) return { d, m, mod: false };
  if (Y0 > hmax + 1.5) F.fill(-1);
  else {
    for (let j = 0, o = 0; j < LN; j++) for (let i = 0; i < LN; i++, o++) {
      const x = X0 + i * 0.25, y = Y0 + j * 0.25, v = Ld[o] = natD(x, y, Lh[i]);
      if (v > -0.7) { Li[o] = oreIron(x, y); Lc[o] = oreCopper(x, y); Ll[o] = oreLumen(x, y); } else Li[o] = Lc[o] = Ll[o] = 0;
    }
    for (let i = 0; i < CH; i++) {
      const x = XC + i * CELL, li = i >> 1, fx = (i & 1) * 0.5, h = Lh[li] + (Lh[li + 1] - Lh[li]) * fx, soil = 1.6 + noise2(x / 2.5, 0, 3) * 1.6, obs = -45 + noise2(x / 15, 0, 4) * 7;
      for (let j = 0; j < CH; j++) {
        const y = Y0 + j * CELL, lj = j >> 1, fy = (j & 1) * 0.5, o = lj * LN + li, q = j * CH + i, depth = h - y;
        const bl = (A) => { const a = A[o], b = A[o + 1], c = A[o + LN], e = A[o + LN + 1]; return a + (b - a) * fx + (c - a) * fy + (a - b - c + e) * fx * fy; };
        let v = bl(Ld);
        if (v > -0.7) {
          if (v < 0.5 && v > -0.5) v += (noise2(x * 3.1, y * 3.1, 77) - 0.5) * 0.11 * Math.min(1, Math.abs(x) / 6 + (depth > 1 ? 1 : 0));
          let k = M.BASALT;
          if (depth < soil) k = M.SOIL; else if (depth < 40 && bl(Li) > 0.7) k = M.IRON; else if (depth > 6 && bl(Lc) > 0.72) k = M.COPPER; else if (depth > 3.5 && bl(Ll) > 0.73) k = M.LUMEN; else if (y < obs) k = M.OBSIDIAN;
          m[q] = k | (depth > 0.45 ? WALL : 0);
        }
        F[q] = v;
      }
    }
  }
  for (const st of sts) for (const s of st.stamps) {
    const b = s.bb || (s.bb = stampBox(s)), i0 = Math.max(0, Math.floor((b[0] - 0.6 - X0) / CELL)), i1 = Math.min(CH - 1, Math.ceil((b[2] + 0.6 - X0) / CELL)), j0 = Math.max(0, Math.floor((b[1] - 0.6 - Y0) / CELL)), j1 = Math.min(CH - 1, Math.ceil((b[3] + 0.6 - Y0) / CELL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const q = j * CH + i, sd = stampSD(s, X0 + i * CELL, Y0 + j * CELL);
      if (s.op > 0) { if (-sd > F[q]) F[q] = -sd; if (sd < 0.3) m[q] = s.mat | (s.wall ? WALL : m[q] & WALL); }
      else { if (sd < F[q]) F[q] = sd; if (sd < 0.06) m[q] = (s.mat || (m[q] & 127) || M.BASALT) | (s.wall === undefined ? m[q] & WALL : s.wall ? WALL : 0); }
    }
  }
  for (let q = 0; q < N; q++) d[q] = clamp(Math.round(128 + F[q] * 254), 0, 255);
  return { d, m, mod: false };
}
function chunk(cx, cy) {
  if (cx < 0 || cx >= NCX) cx = wrapC(cx);
  const key = ckey(cx, cy); if (key === lastKey) return last;
  let c = chunks.get(key);
  if (!c) {
    c = genChunk(cx, cy); chunks.set(key, c);
    if (chunks.size > 700) for (const [k, v] of chunks) { if (!v.mod && v !== c) { chunks.delete(k); if (chunks.size <= 520) break; } }
  }
  lastKey = key; last = c; return c;
}
const gd = (ix, iy) => chunk(ix >> 6, iy >> 6).d[((iy & 63) << 6) | (ix & 63)];
const gm = (ix, iy) => chunk(ix >> 6, iy >> 6).m[((iy & 63) << 6) | (ix & 63)];
const circle = (cx, cy, r) => (x, y) => Math.hypot(x - cx, y - cy) - r;
const NO = {};
// After an edit the field near it is made a distance field again. A brush only writes the samples it covers, so
// without this the air a step away from a filled floor still says "half a metre from anything" and the rock beside a
// cut still says "deep inside": everything that asks the field how far the ground is (the player, robots, the
// hauler's feet, falling rock) got a wrong answer on ground that had been worked. The samples that carry the surface
// (within half a sample of it, or next to a change of sign) are kept exactly as they are, so the iso-line and the
// mass in every sample do not change; the others get the chamfer distance to them, out to the half metre the byte holds.
let RW = new Float32Array(0), RB = new Uint8Array(0), RF = new Uint8Array(0);
const W1 = CELL * 254, W2 = W1 * Math.SQRT2;
function redist(i0, j0, i1, j1) {
  const B = 5, x0 = i0 - B, y0 = j0 - B, W = i1 - i0 + 1 + 2 * B, H = j1 - j0 + 1 + 2 * B, n = W * H; if (n > RW.length) { RW = new Float32Array(n); RB = new Uint8Array(n); RF = new Uint8Array(n); }
  for (let j = 0, q = 0; j < H; j++) for (let i = 0; i < W; i++, q++) RB[q] = gd(x0 + i, y0 + j);
  for (let j = 0, q = 0; j < H; j++) for (let i = 0; i < W; i++, q++) {
    const b = RB[q], s = b > 128; let fix = i === 0 || j === 0 || i === W - 1 || j === H - 1 || (b > 112 && b < 144);
    if (!fix) fix = (RB[q - 1] > 128) !== s || (RB[q + 1] > 128) !== s || (RB[q - W] > 128) !== s || (RB[q + W] > 128) !== s;
    RF[q] = fix ? 1 : 0; RW[q] = fix ? Math.abs(b - 128) : 1e9;
  }
  const relax = (q, o, w) => { const v = (RB[o] > 128) === (RB[q] > 128) ? RW[o] + w : Math.max(4, w - RW[o]); if (v < RW[q]) RW[q] = v; };
  for (let pass = 0; pass < 2; pass++) {
    for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) { const q = j * W + i; if (RF[q]) continue; relax(q, q - 1, W1); relax(q, q - W, W1); relax(q, q - W - 1, W2); relax(q, q - W + 1, W2); }
    for (let j = H - 2; j > 0; j--) for (let i = W - 2; i > 0; i--) { const q = j * W + i; if (RF[q]) continue; relax(q, q + 1, W1); relax(q, q + W, W1); relax(q, q + W + 1, W2); relax(q, q + W - 1, W2); }
  }
  for (let j = 1, q = W + 1; j < H - 1; j++, q += 2) for (let i = 1; i < W - 1; i++, q++) {
    if (RF[q]) continue; const b = RB[q], v = Math.min(127, Math.round(RW[q])), nb = b > 128 ? Math.max(144, 128 + v) : Math.min(112, 128 - v); if (nb === b) continue;
    const ix = x0 + i, iy = y0 + j, c = chunk(ix >> 6, iy >> 6); c.d[((iy & 63) << 6) | (ix & 63)] = nb; c.mod = true;
  }
}

export const world = {
  chunks, rev: 0, backWall: false, rawRate: false, lastSign: 0,       // rawRate: the caller's rate is metres, whatever the rock (the laser's energy sets it)
  reset() { chunks.clear(); lastKey = NaN; last = null; this.rev++; },
  // signed density in metres at a point, bilinear; positive inside rock
  dens(x, y) {
    const fx = x / CELL, fy = y / CELL, ix = Math.floor(fx), iy = Math.floor(fy), u = fx - ix, v = fy - iy;
    const a = gd(ix, iy), b = gd(ix + 1, iy), c = gd(ix, iy + 1), e = gd(ix + 1, iy + 1);
    return (a + (b - a) * u + (c - a) * v + (a - b - c + e) * u * v - 128) / 254;
  },
  solidAt(x, y) { return this.dens(x, y) > 0; },
  matAt(x, y) { return gm(Math.round(x / CELL), Math.round(y / CELL)) & 127; },
  wallAt(x, y) { return (gm(Math.round(x / CELL), Math.round(y / CELL)) & WALL) !== 0; },
  // outward unit normal (toward air) into out, returns the gradient length
  normal(x, y, out) {
    const e = CELL, gx = this.dens(x + e, y) - this.dens(x - e, y), gy = this.dens(x, y + e) - this.dens(x, y - e), l = Math.hypot(gx, gy);
    if (l < 1e-5) { out[0] = 0; out[1] = 1; return 0; } out[0] = -gx / l; out[1] = -gy / l; return l / (2 * e);
  },
  // distance to the surface in metres, positive in air; the field is a true distance near the surface
  dist(x, y) { return -this.dens(x, y); },
  // march a ray through the field; returns { d, x, y, mat } at the surface or null
  ray(x, y, dx, dy, max) {
    let t = 0;
    for (let i = 0; i < 400 && t < max; i++) {
      const px = x + dx * t, py = y + dy * t, v = this.dens(px, py);
      if (v > 0) { let a = Math.max(0, t - 0.2), b = t; for (let k = 0; k < 5; k++) { const mid = (a + b) / 2; if (this.dens(x + dx * mid, y + dy * mid) > 0) b = mid; else a = mid; } return { d: b, x: x + dx * b, y: y + dy * b, mat: this.matAt(x + dx * (b + 0.08), y + dy * (b + 0.08)) }; }
      t += clamp(-v * 0.8, 0.05, 0.4);
    }
    return null;
  },
  // the ground under x: start at y + up (must be air), look down at most `down` metres; returns the surface y or null
  groundY(x, y, up = 1.6, down = 16) {
    let py = y + up; if (this.dens(x, py) > 0) return null;
    for (let t = 0; t < down;) { const v = this.dens(x, py); if (v > 0) { let a = py, b = py + 0.25; for (let k = 0; k < 5; k++) { const mid = (a + b) / 2; if (this.dens(x, mid) > 0) a = mid; else b = mid; } return a; } const st = clamp(-v * 0.9, 0.06, 0.4); py -= st; t += st; }
    return null;
  },
  // apply an SDF shape: sign -1 digs, +1 adds material `mat`. rate (m) limits the change of this call, scaled by the
  // material hardness when digging. deny(matId) protects materials. acc[matId] gets kg removed (+) or added (-).
  shape(x0, y0, x1, y1, sdf, sign, mat = M.PLATE, rate = 0, acc = NO, deny = null) {
    const i0 = Math.floor(x0 / CELL) - 1, i1 = Math.ceil(x1 / CELL) + 1, j0 = Math.floor(y0 / CELL) - 1, j1 = Math.ceil(y1 / CELL) + 1; let changed = 0;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const c = chunk(i >> 6, j >> 6), q = ((j & 63) << 6) | (i & 63), old = c.d[q], mm = c.m[q] & 127, sd = sdf(i * CELL, j * CELL); let nv;
      if (sign < 0) { const tg = 128 + sd * 254; if (tg >= old || (deny && deny(mm))) continue; nv = rate ? Math.max(tg, old - rate * 254 / (this.rawRate ? 1 : MAT[mm].hard)) : tg; }
      else { const tg = 128 - sd * 254; if (tg <= old) continue; nv = rate ? Math.min(tg, old + rate * 254) : tg; }
      nv = clamp(Math.round(nv), 0, 255); if (nv === old) continue;
      const c0 = cov(old), c1 = cov(nv);
      if (sign > 0 && c0 < 0.5 && mm !== mat) { if (acc !== NO) { acc[mm] = (acc[mm] || 0) + c0 * KG * MAT[mm].rho; acc[mat] = (acc[mat] || 0) - c1 * KG * MAT[mat].rho; } c.m[q] = mat | (c.m[q] & WALL); }
      else if (acc !== NO && c0 !== c1) acc[mm] = (acc[mm] || 0) + (c0 - c1) * KG * MAT[mm].rho;
      if (sign > 0 && this.backWall && nv > 128) c.m[q] |= WALL;       // rock laid down as part of the world has the back wall behind it, like the rock that was always there
      c.d[q] = nv; c.mod = true; changed++;
    }
    this.lastSign = sign; if (changed) { redist(i0, j0, i1, j1); this.rev++; if (this.onEdit) this.onEdit(x0, y0, x1, y1); } return changed;
  },
  dig(x, y, r, rate, acc, deny) { return this.shape(x - r, y - r, x + r, y + r, circle(x, y, r), -1, 0, rate, acc, deny); },
  fill(x, y, r, mat, rate, acc) { return this.shape(x - r, y - r, x + r, y + r, circle(x, y, r), 1, mat, rate, acc); },
  box(x0, y0, x1, y1, sign, mat, acc) { const s = { t: 'b', x0, y0, x1, y1 }; return this.shape(x0, y0, x1, y1, (x, y) => stampSD(s, x, y), sign, mat, 0, acc); },
  // kg of every material inside a rectangle of samples (tests, and the robots' terrain jobs)
  mass(x0, y0, x1, y1, out = {}) {
    const i0 = Math.floor(x0 / CELL) - 1, i1 = Math.ceil(x1 / CELL) + 1, j0 = Math.floor(y0 / CELL) - 1, j1 = Math.ceil(y1 / CELL) + 1;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const b = gd(i, j); if (b > 112) { const mm = gm(i, j) & 127; out[mm] = (out[mm] || 0) + cov(b) * KG * MAT[mm].rho; } }
    return out;
  },
  // copy a window of samples (origin in sample indices) into two byte arrays, row by row
  window(ox, oy, w, h, dOut, mOut) {
    for (let cy = oy >> 6; cy <= (oy + h - 1) >> 6; cy++) for (let cx = ox >> 6; cx <= (ox + w - 1) >> 6; cx++) {
      const c = chunk(cx, cy), bx = cx << 6, by = cy << 6, i0 = Math.max(ox, bx), i1 = Math.min(ox + w, bx + CH), j0 = Math.max(oy, by), j1 = Math.min(oy + h, by + CH);
      for (let j = j0; j < j1; j++) { const s = ((j - by) << 6) + (i0 - bx), t = (j - oy) * w + (i0 - ox); dOut.set(c.d.subarray(s, s + i1 - i0), t); mOut.set(c.m.subarray(s, s + i1 - i0), t); }
    }
  },
  sample(ix, iy) { return gd(ix, iy); }, sampleM(ix, iy) { return gm(ix, iy); },
  // edited chunks only, run-length encoded
  saveDiff() { const out = {}; for (const [k, c] of chunks) if (c.mod) out[k] = [rle(c.d), rle(c.m)]; return out; },
  // keys from a flat (round 3) world are folded onto the circle
  loadDiff(o) { this.reset(); for (const k in o) { const cx = Math.floor(+k / 65536) - 32768, cy = (+k % 65536) - 32768; chunks.set(ckey(wrapC(cx), cy), { d: unrle(o[k][0]), m: unrle(o[k][1]), mod: true }); } },
};
function rle(a) { const out = []; for (let i = 0; i < a.length;) { const v = a[i]; let n = 1; while (n < 255 && i + n < a.length && a[i + n] === v) n++; out.push(n, v); i += n; } let s = ''; for (let i = 0; i < out.length; i += 8192) s += String.fromCharCode.apply(null, out.slice(i, i + 8192)); return btoa(s); }
function unrle(b64) { const s = atob(b64), a = new Uint8Array(N); let o = 0; for (let i = 0; i < s.length; i += 2) { const n = s.charCodeAt(i), v = s.charCodeAt(i + 1); a.fill(v, o, o + n); o += n; } return a; }

// loose matter: everything that lies in the world. What the laser cuts out of the ground falls as chunks with mass;
// what a cut plant or a dead animal leaves, what you drop, what a robot sets down: all of it is one kind of thing, a
// body of some item and amount that lies there until somebody carries it away. Chunks are circles on the density
// field with friction and rest; resting chunks of the same stuff merge into heaps. Nothing here is created or lost:
// spawn() and take() are the only doors, and the tests add the masses up.
import { rand, hash } from '../core.js';
import { ITEMS } from '../items.js';
import { world, GRAV, SLAB, TS } from './world.js';
import { light } from './light.js';
import { heat } from './heat.js';
import { S, C, mul } from './state.js';
const RHO = { soil: 1500, basalt: 2900, 'iron ore': 5000, 'copper ore': 4200, lumen: 2100, iron: 7800, copper: 8900, biomass: 600, fibre: 400, chitin: 1200, 'xeno shard': 3400 }, nv = [0, 0];
const ORG = { biomass: 1, fibre: 1, resin: 1, ichor: 1, chitin: 1 };
export const kgOf = (id, n) => n * ITEMS[id].m;
const radius = (id, kg) => Math.max(0.07, Math.min(0.62, Math.sqrt(kg / ((RHO[id] || 1500) * SLAB) / Math.PI) * 1.05));
export const matter = {
  list: [], made: 0, taken: 0, nextId: 1,
  // n in the item's own unit; returns the body
  spawn(id, n, x, y, vx = 0, vy = 0, temp = 0) {
    if (!(n > 1e-9) || !ITEMS[id]) return null; const kg = kgOf(id, n);
    const c = { uid: this.nextId++, id, n, kg, x, y, vx, vy, r: radius(id, kg), rot: Math.random() * 6.28, spin: rand(-6, 6), temp, rest: 0, asleep: false, seed: Math.random() * 100, claim: null, dumped: false };
    this.list.push(c); this.made += kg; return c;
  },
  // take up to n out of a body; returns the amount taken. The body is removed when it is empty.
  take(c, n) { const k = Math.min(n, c.n); c.n -= k; c.kg = kgOf(c.id, c.n); this.taken += kgOf(c.id, k); if (c.n <= 1e-9) { const i = this.list.indexOf(c); if (i >= 0) this.list.splice(i, 1); c.gone = true; } else c.r = radius(c.id, c.kg); this.wake(c.x, c.y, 1.3); return k; },
  // what rested on something that is gone has to fall
  wake(x, y, r) { for (const o of this.list) if (o.asleep && Math.abs(o.x - x) < r && Math.abs(o.y - y) < r) { o.asleep = false; o.rest = 0; } },
  total(id) { let s = 0; for (const c of this.list) if (!id || c.id === id) s += c.kg; return s; },
  // the nearest body within r of a point that passes the filter
  near(x, y, r, ok) { let best = null, bd = r; for (const c of this.list) { const d = Math.hypot(c.x - x, c.y - y); if (d < bd && (!ok || ok(c))) { bd = d; best = c; } } return best; },
  step(dt) {
    const L = this.list, grid = new Map();
    for (const c of L) {
      if (c.temp > 0) c.temp = Math.max(0, c.temp - dt * (0.12 + c.temp * 0.3));
      if (c.asleep) { if ((c.wake = (c.wake || 0) - dt) < 0) { c.wake = 0.6 + (c.uid % 7) * 0.05; if (world.dist(c.x, c.y - c.r * 0.5) > c.r * 0.5 + 0.12) c.asleep = false; else if (world.dist(c.x, c.y) < c.r * 0.2) { world.normal(c.x, c.y, nv); c.x += nv[0] * 0.1; c.y += nv[1] * 0.1; c.asleep = false; } } }
      if (c.asleep) { const k = (Math.floor(c.x * 2) + 32768) * 65536 + Math.floor(c.y * 2) + 32768; (grid.get(k) || (grid.set(k, []), grid.get(k))).push(c); continue; }
      c.vy -= GRAV * dt; const n = Math.max(1, Math.ceil(Math.hypot(c.vx, c.vy) * dt / 0.08));
      for (let s = 0; s < n; s++) {
        c.x += c.vx * dt / n; c.y += c.vy * dt / n; const d = world.dist(c.x, c.y);
        if (d < c.r) {
          world.normal(c.x, c.y, nv); const push = c.r - d; c.x += nv[0] * push; c.y += nv[1] * push;
          const vn = c.vx * nv[0] + c.vy * nv[1]; if (vn < 0) { const e = vn < -2 ? 0.28 : 0, tx = -nv[1], ty = nv[0], vt = (c.vx * tx + c.vy * ty) * (1 - Math.min(1, dt / n * 9)); c.vx = tx * vt - nv[0] * vn * e; c.vy = ty * vt - nv[1] * vn * e; c.spin = -vt / c.r * 0.7; if (vn < -3 && c.kg > 4) S.thud && S.thud(c, -vn); }
        }
      }
      c.rot += c.spin * dt; c.spin *= 1 - Math.min(1, dt * 1.5);
      if (c.vx * c.vx + c.vy * c.vy < 0.03) { c.rest += dt; if (c.rest > 0.5) { c.asleep = true; c.vx = c.vy = c.spin = 0; c.wake = 0.6; } } else c.rest = 0;
      if (c.y < -400) c.asleep = true;
      const k = (Math.floor(c.x * 2) + 32768) * 65536 + Math.floor(c.y * 2) + 32768; (grid.get(k) || (grid.set(k, []), grid.get(k))).push(c);
    }
    // bodies push each other apart so they pile; resting bodies of the same stuff merge into heaps
    const heapMax = L.length > 420 ? 400 : L.length > 260 ? 160 : 70;
    for (const c of L) {
      if (c.asleep && !(c.uid % 16 === (S.frameN || 0) % 16)) continue;
      const gx = Math.floor(c.x * 2), gy = Math.floor(c.y * 2);
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const cell = grid.get((gx + i + 32768) * 65536 + gy + j + 32768); if (!cell) continue;
        for (const o of cell) {
          if (o === c || o.gone || c.gone) continue; const dx = c.x - o.x, dy = c.y - o.y, d = Math.hypot(dx, dy) || 0.001, min = (c.r + o.r) * 0.82; if (d >= min) continue;
          if (c.asleep && o.asleep) { if (c.id === o.id && c.kg + o.kg <= heapMax && ITEMS[c.id].u !== 'ea' && !c.claim && !o.claim && c.dumped === o.dumped && c.uid < o.uid) { c.x = (c.x * c.kg + o.x * o.kg) / (c.kg + o.kg); c.y = Math.max(c.y, o.y); c.n += o.n; c.kg += o.kg; c.temp = Math.max(c.temp, o.temp); c.r = radius(c.id, c.kg); o.gone = true; c.asleep = false; c.rest = 0.3; this.wake(c.x, c.y, 1.2); } continue; }
          if (c.asleep) continue; const mc = o.asleep ? 1 : o.kg / (c.kg + o.kg), nx = dx / d, ny = dy / d, push = (min - d) * mc * 0.8, vn = c.vx * nx + c.vy * ny;      // out of the overlap, and no speed into it: a pile settles
          c.x += nx * push; c.y += ny * push; if (vn < 0) { c.vx -= nx * vn; c.vy -= ny * vn; c.vx *= 0.96; }
        } }
    }
    for (let i = L.length - 1; i >= 0; i--) if (L[i].gone) L.splice(i, 1);
  },
  draw(b, time) {
    const cam = S.cam;
    for (const c of this.list) {
      if (Math.abs(c.x - cam.x) > 24 * Math.min(S.zo, 4) || Math.abs(c.y - cam.y) > 14 * Math.min(S.zo, 4)) continue;
      const d = ITEMS[c.id], col = d.c || C.steel, org = ORG[c.id];
      if (d.u === 'ea' || d.u === 'rd') { b.add(c.x, c.y, c.r * 1.7, c.r * 1.4, c.rot, mul(C.steel, 0.7), 1, 0, 1, c.seed); b.add(c.x, c.y, c.r * 0.5, c.r * 0.4, c.rot, mul(col, 1.2), 1, 0, 2, 1); b.add(c.x, c.y + c.r * 0.5, c.r * 1.7, 0.03, c.rot, mul(C.hull, 0.6), 1, 0, 1); continue; }
      const n = c.kg > 45 ? 5 : c.kg > 18 ? 3 : 1, dark = org ? 0.22 : 0.42;
      for (let i = 0; i < n; i++) { const a = c.seed + i * 2.4, o = i ? c.r * 0.55 : 0, rr = (i ? 0.62 : n > 1 ? 0.78 : 1) * c.r * 2, x = c.x + Math.cos(a) * o, y = c.y + Math.abs(Math.sin(a)) * o * 0.5 - (n > 1 ? c.r * 0.2 : 0);
        b.add(x, y, rr * (org ? 1.25 : 1.12), rr, c.rot + i * 1.3, mul(col, dark * (0.8 + 0.4 * hash(i, c.uid, 5))), 1, org ? 7 : 13, 1, c.seed + i * 3.1, 0, 0, 0.55);
        if (c.temp > 0.06 && !org) b.add(x, y, rr * 1.05, rr * 0.95, c.rot + i * 1.3, [1.5 * c.temp, 0.3 * c.temp * c.temp, 0.02 * c.temp], Math.min(0.8, c.temp), 13, 2, c.seed + i * 3.1); }
      if (c.temp > 0.15) { b.add(c.x, c.y, c.r * 4, c.r * 4, 0, [1.2, 0.28, 0.03], Math.min(0.35, c.temp * 0.3), 1, 2); light.emit(c.x / TS, c.y / TS, 1.2 * c.temp, 0.3 * c.temp, 0.04 * c.temp); }
      if (c.id === 'lumen') { b.add(c.x, c.y, c.r * 4, c.r * 4, 0, mul(C.cyan, 0.3), 0.6, 1, 2); light.emit(c.x / TS, c.y / TS, 0.03, 0.3, 0.26); }
    }
  },
  dump() { return this.list.map(c => [c.id, +c.n.toFixed(5), +c.x.toFixed(2), +c.y.toFixed(2), c.dumped ? 1 : 0]); },
  load(a) { this.list.length = 0; this.made = this.taken = 0; for (const q of a || []) { const c = this.spawn(q[0], q[1], q[2], q[3]); if (c) { c.asleep = true; c.dumped = !!q[4]; } } },
};
// hot loose rock warms the ground it lies on a little, so a fresh spoil heap glows
export function matterHeat(dt) { for (const c of matter.list) if (c.temp > 0.5 && Math.random() < dt * 2) heat.add(c.x, c.y - c.r, 0.35, 0.05); }

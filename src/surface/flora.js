// the living world in the play plane: plants generated per chunk from the seed and anchored to whatever ground is
// there (flora-gen.js holds the species). Every plant is a damped spring driven by the travelling wind; it bends away
// from whatever pushes through it (the player, creatures), shakes when hit, scorches on hot ground, and when it is cut
// its matter falls to the ground as loose material. It throws light into the light field.
import { hash, rng, rand, clamp } from '../core.js';
import { world, CELL, CH, TS, M } from './world.js';
import { biome, lushness } from './gen.js';
import { light } from './light.js';
import { heat } from './heat.js';
import { S, mul } from './state.js';
import { genPlant, drawPlant, wind, PAL } from './flora-gen.js';
const blocks = new Map(); let active = [];
// clear = [x0, x1]: a scenario's building site, kept free of trees. drop(id, n, x, y) puts cut matter into the world.
// pushers = [{ x, y, vx, r, h }] bodies that bend plants this frame.
export const flora = { dead: new Set(), count: 0, drop: null, clear: null, pushers: [], blast: null, get active() { return active; } };
const YIELD = { tree: { biomass: 30, fibre: 6, resin: 2 }, fern: { biomass: 1.6, fibre: 0.8 }, paddle: { biomass: 1.2, fibre: 0.5 }, bulb: { biomass: 0.6, lumen: 0.15 }, reed: { fibre: 0.9 }, fungi: { biomass: 0.9 }, vine: { fibre: 0.5 }, pod: { resin: 0.6, biomass: 0.4 }, shelf: { biomass: 0.5 } };
const natural = k => k >= M.SOIL && k <= M.LUMEN, grows = k => natural(k) || k === M.XENO || k === M.CONCRETE;
const pick = (h, table) => { let a = 0; for (let i = 0; i < table.length; i += 2) { a += table[i + 1]; if (h < a) return table[i]; } return null; };
function build(cx, cy) {
  const out = [], sI = cx * CH, sJ = cy * CH;
  for (let c = 0; c < 32; c++) {
    const i = sI + c * 2 + 1, x = i * CELL, lush = lushness(x), bi = biome(x); let prev = world.sample(i, sJ + CH) >= 128;
    for (let j = CH - 1; j >= 0; j--) {
      const iy = sJ + j, sol = world.sample(i, iy) >= 128;
      if (sol !== prev) {
        const y = sol ? (iy + 1) * CELL - 0.06 : (iy + 0.6) * CELL, k = world.sampleM(i, iy + (sol ? 0 : 1)) & 127, cave = (world.sampleM(i, iy + (sol ? 2 : -2)) & 128) !== 0, h1 = hash(i, iy, 80), h2 = hash(i, iy, 81), id = i + ',' + iy;
        if (grows(k) && !flora.dead.has(id) && lush > 0.02) {
          const d = natural(k) ? lush : lush * 0.45; let type = null, front = h2 < 0.1;
          if (sol && !cave) {
            if (c % 8 === Math.floor(hash(cx, cy, 82) * 8) % 8 && natural(k) && h1 < 0.3 + d * 0.45) { type = 'tree'; front = h2 < 0.07; }
            else type = pick(h1, ['bulb', 0.06 * d, 'fern', 0.2 * d, 'paddle', 0.1 * d, 'reed', bi === 2 ? 0.1 * d : 0.03 * d, 'flower', 0.035 * d, 'fungi', bi === 0 ? 0.08 * d : 0.03 * d, 'root', 0.05 * d, 'moss', 0.1, 'grass', 0.42]);
          } else if (sol) type = pick(h1, ['fungi', 0.14 * d, 'bulb', 0.05 * d, 'fern', 0.08 * d, 'moss', 0.14 * d, 'root', 0.04 * d, 'grass', 0.3 * d]);
          else type = pick(h1, ['vine', 0.2 * d, 'threads', 0.12 * d, 'pod', natural(k) ? 0.04 * d : 0]);
          if (type === 'tree' && (world.dens(x, y + 2.5) > 0 || world.dens(x, y + 5) > 0)) type = 'fern';
          if (type === 'grass' || type === 'moss' || type === 'reed') front = h2 < 0.45;
          if (flora.clear && x > flora.clear[0] && x < flora.clear[1] && type !== 'grass' && type !== 'moss' && !(!sol)) type = 'grass';
          if (type) { const gen = genPlant(type, bi, rng(Math.floor(h1 * 1e9) ^ (i * 7919)), lush, sol ? null : { anchor: -1 });
            out.push({ id, type, x: x + (h2 - 0.5) * 0.15, y, bi, front, gen, anchor: gen.anchor, hp: gen.hp, top: y + gen.top, hw: gen.hw, H: gen.H, ph: hash(i, iy, 91) * 6.28, fall: 0, b: 0, bv: 0, shake: 0 }); }
        }
      }
      prev = sol;
    }
  }
  return out;
}
let scanT = 0;
export function stepFlora(dt) {
  const cam = S.cam, hw = 14 / S.zoom + 8, x0 = Math.floor((cam.x - hw) / 8), x1 = Math.floor((cam.x + hw) / 8), y0 = Math.floor((cam.y - 26) / 8), y1 = Math.floor((cam.y + 11) / 8);
  active = [];
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) { const k = cx * 4096 + cy; let b = blocks.get(k); if (!b) { b = build(cx, cy); blocks.set(k, b); } for (const p of b) active.push(p); }
  if (blocks.size > 220) for (const k of blocks.keys()) { const cx = Math.round(k / 4096); if (Math.abs(cx - (x0 + x1) / 2) > 8) blocks.delete(k); if (blocks.size < 160) break; }
  flora.count = active.length;
  // falling, uprooted and scorched plants
  scanT -= dt; const scan = scanT <= 0; if (scan) scanT = 0.4;
  for (const p of active) {
    if (p.gone) continue;
    if (p.fall > 0) { p.fall += dt * (0.6 + p.fall * 1.6); if (p.fall >= 1.5) kill(p, true); continue; }
    if (!scan) continue;
    if (world.dens(p.x, p.y - 0.3 * p.anchor) <= 0 && world.dens(p.x, p.y - 0.12 * p.anchor) <= 0) { if (p.type === 'tree') p.fall = 0.01; else kill(p, false); }
    else if (p.type !== 'tree' && heat.at(p.x, p.y - 0.1 * p.anchor) > 0.42) burn(p);
  }
}
function burn(p) {
  if (p.gone) return; p.gone = true; flora.dead.add(p.id);
  for (let i = 0; i < 7; i++) S.parts.spawn({ x: p.x + rand(-0.3, 0.3), y: p.y + rand(0, Math.max(0.2, (p.top - p.y) * p.anchor)) * p.anchor, vx: rand(-0.6, 0.6), vy: rand(0.4, 2.2), life: rand(0.6, 2.2), size: rand(0.03, 0.07), c: [3.5, 1.3, 0.2], c2: [0.4, 0.03, 0.01], grav: -0.08, drag: 0.8 });
  S.parts.spawn({ x: p.x, y: p.y + 0.3, vx: rand(-0.2, 0.2), vy: rand(0.4, 0.9), life: rand(1.5, 3), size: rand(0.3, 0.5), grow: 2.4, c: [0.1, 0.095, 0.09], mode: 1, a: 0.28, grav: -0.03, drag: 0.8 });
}
function kill(p, give) {
  if (p.gone) return; p.gone = true; flora.dead.add(p.id);
  const y = YIELD[p.type], k = p.gen.yieldK || 1, tree = p.type === 'tree', dir = p.dir || 1;
  if (give && y && flora.drop) for (const id in y) { const n = y[id] * k * (0.8 + hash(p.x * 9 | 0, 3, 84) * 0.4), parts = tree ? 4 : 1; for (let i = 0; i < parts; i++) flora.drop(id, n / parts, p.x + (tree ? dir * (1 + i * p.H * 0.2) : rand(-0.2, 0.2)), p.y + 0.4 + rand(0, 0.4)); }
  const g = PAL[p.bi].g; for (let i = 0; i < (tree ? 46 : 6); i++) S.parts.spawn({ x: p.x + rand(-0.5, 0.5) + (tree ? dir * rand(0, p.H) : 0), y: p.y + rand(0, Math.max(0.3, (p.top - p.y) * (tree ? 0.12 : 1))), vx: rand(-1.5, 1.5), vy: rand(0, 2.5), life: rand(1, 3.5), size: rand(0.04, 0.09), c: mul(g, 2), c2: mul(g, 0.3), col: 1, bounce: 0.1 });
}
// the laser, bullets and creatures damage plants along their spine; returns true when something was hit
export function floraHit(x, y, dmg, r = 0.3) {
  let hit = false;
  for (const p of active) {
    if (p.gone || p.fall > 0 || Math.abs(x - p.x) > 3) continue;
    const top = p.anchor > 0 ? p.top : p.y - (p.H || 0.5), y0 = Math.min(p.y, top), y1 = Math.max(p.y, top);
    if (y < y0 - r || y > y1 + r || Math.abs(x - p.x) > p.hw + r + (p.type === 'tree' ? 0.25 : 0)) continue;
    p.hp -= dmg; hit = true; p.shake = 0.3; p.bv += (p.x - x > 0 ? 1 : -1) * 3; if (p.hp <= 0) { if (p.type === 'tree') { p.fall = 0.01; p.dir = x < p.x ? 1 : -1; S.shakeBy && S.shakeBy(0.12); } else kill(p, true); }
  }
  return hit;
}
// a pressure wave (the laser's impact, a landing, a falling tree): plants lean away from it
export function floraBlast(x, y, r, k) { for (const p of active) { const dx = p.x - x, dy = p.y - y; if (Math.abs(dx) < r && Math.abs(dy) < r + p.H) p.bv += (dx >= 0 ? 1 : -1) * k * (1 - Math.abs(dx) / r) / (1 + p.H * 0.25); } }
let lastT = 0;
export function drawFlora(b, time, front) {
  const cam = S.cam, hw = 14 / S.zoom + 9, dt = front ? 0 : clamp(time - lastT, 0, 0.05); if (!front) lastT = time;
  for (const p of active) {
    if (p.gone || Math.abs(p.x - cam.x) > hw) continue;
    if (dt) {     // the spring: wind pulls, the stem pulls back, pushers shove
      const tree = p.type === 'tree', k = tree ? 5 : 16, w = wind(p.x, time) * (tree ? 1 : 1.25) + Math.sin(time * 2.3 + p.ph) * 0.12;
      p.bv += ((w - p.b) * k - p.bv * (tree ? 1.6 : 3.4)) * dt;
      if (!tree) for (const q of flora.pushers) { const dx = p.x - q.x; if (Math.abs(dx) < q.r + p.hw && (p.anchor > 0 ? q.y < p.top + 0.3 && q.y + q.h > p.y - 0.2 : q.y + q.h > p.y - p.H && q.y < p.y)) p.bv += ((dx >= 0 ? 1 : -1) * (3 + Math.abs(q.vx) * 1.6) + q.vx * 1.2) * dt * 14; }
      p.b = clamp(p.b + p.bv * dt, -4, 4); if (p.shake > 0) p.shake -= dt;
    }
    if (p.front !== front) continue;
    const s = p.b + (p.shake > 0 ? Math.sin(time * 40) * p.shake : 0);
    drawPlant(b, p.gen, p.x, p.y, 1, s, time, p.ph, null, p.fall > 0 ? Math.min(1.5, p.fall) * (p.dir || 1) : 0);
    if (!front || p.type !== 'grass') { const L = p.gen.lights, k = p.fall > 0 ? 0.3 : 0.85 + 0.15 * Math.sin(time * 0.9 + p.ph); for (let i = 0; i < L.length; i += 5) light.emit((p.x + L[i]) / TS, (p.y + L[i + 1]) / TS, L[i + 2] * k, L[i + 3] * k, L[i + 4] * k); }
  }
}
export function resetFlora() { blocks.clear(); active = []; }

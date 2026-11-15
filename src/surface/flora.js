// the living world in the play plane: plants generated per chunk from the seed and anchored to whatever ground is
// there (flora-gen.js holds the species). Every plant is a damped spring driven by the travelling wind; it bends away
// from whatever pushes through it (the player, creatures), shakes when hit, scorches on hot ground, and when it is cut
// its matter falls to the ground as loose material. It throws light into the light field.
import { G, events, hash, rng, rand, clamp } from '../core.js';
import { audio } from '../audio.js';
import { env } from './env.js';
import { WOOD, kerfWoodJ, pulsesToFell, sawTime, logsOf, fallAcc, PULSE_BEAM_J, LASERP } from './physics.js';
import { GRAV } from './gen.js';
import { world, CELL, CH, TS, M } from './world.js';
import { biome, lushness, CIRC } from './gen.js';
import { light } from './light.js';
import { heat } from './heat.js';
import { S, mul } from './state.js';
import { genPlant, drawPlant, wind, PAL } from './flora-gen.js';
const blocks = new Map(); let active = [];
// clear = [x0, x1]: a scenario's building site, kept free of trees. drop(id, n, x, y) puts cut matter into the world.
// pushers = [{ x, y, vx, r, h }] bodies that bend plants this frame.
export const flora = { dead: new Set(), cut: new Map(), count: 0, drop: null, clear: null, pushers: [], blast: null, hurt: null, note: null, felled: 0, logs: 0, get active() { return active; } };
const YIELD = { tree: { biomass: 8, fibre: 6, resin: 2 }, fern: { biomass: 1.6, fibre: 0.8 }, paddle: { biomass: 1.2, fibre: 0.5 }, bulb: { biomass: 0.6, lumen: 0.15 }, reed: { fibre: 0.9 }, fungi: { biomass: 0.9 }, vine: { fibre: 0.5 }, pod: { resin: 0.6, biomass: 0.4 }, shelf: { biomass: 0.5 } };
const natural = k => k >= M.SOIL && k <= M.LUMEN, grows = k => natural(k) || k === M.XENO || k === M.CONCRETE;
const pick = (h, table) => { let a = 0; for (let i = 0; i < table.length; i += 2) { a += table[i + 1]; if (h < a) return table[i]; } return null; };
function build(cx, cy) {
  // wi is the sample column counted round the planet, so the same plants stand at x and at x + CIRC
  const out = [], sI = cx * CH, sJ = cy * CH, NI = CIRC / CELL, wcx = ((cx % (NI / CH)) + NI / CH) % (NI / CH);
  for (let c = 0; c < 32; c++) {
    const i = sI + c * 2 + 1, wi = ((i % NI) + NI) % NI, x = i * CELL, lush = lushness(x), bi = biome(x); let prev = world.sample(i, sJ + CH) >= 128;
    for (let j = CH - 1; j >= 0; j--) {
      const iy = sJ + j, sol = world.sample(i, iy) >= 128;
      if (sol !== prev) {
        const y = sol ? (iy + 1) * CELL - 0.06 : (iy + 0.6) * CELL, k = world.sampleM(i, iy + (sol ? 0 : 1)) & 127, cave = (world.sampleM(i, iy + (sol ? 2 : -2)) & 128) !== 0, h1 = hash(wi, iy, 80), h2 = hash(wi, iy, 81), id = wi + ',' + iy;
        if (grows(k) && !flora.dead.has(id) && lush > 0.02) {
          const d = natural(k) ? lush : lush * 0.45; let type = null, front = h2 < 0.1;
          if (sol && !cave) {
            if (c % 8 === Math.floor(hash(wcx, cy, 82) * 8) % 8 && natural(k) && h1 < 0.3 + d * 0.45) { type = 'tree'; front = h2 < 0.07; }
            else type = pick(h1, ['bulb', 0.06 * d, 'fern', 0.2 * d, 'paddle', 0.1 * d, 'reed', bi === 2 ? 0.1 * d : 0.03 * d, 'flower', 0.035 * d, 'fungi', bi === 0 ? 0.08 * d : 0.03 * d, 'root', 0.05 * d, 'moss', 0.1, 'grass', 0.42]);
          } else if (sol) type = pick(h1, ['fungi', 0.14 * d, 'bulb', 0.05 * d, 'fern', 0.08 * d, 'moss', 0.14 * d, 'root', 0.04 * d, 'grass', 0.3 * d]);
          else type = pick(h1, ['vine', 0.2 * d, 'threads', 0.12 * d, 'pod', natural(k) ? 0.04 * d : 0]);
          if (type === 'tree' && (world.dens(x, y + 2.5) > 0 || world.dens(x, y + 5) > 0)) type = 'fern';
          if (type === 'grass' || type === 'moss' || type === 'reed') front = h2 < 0.45;
          if (flora.clear && x > flora.clear[0] && x < flora.clear[1] && type !== 'grass' && type !== 'moss' && !(!sol)) type = 'grass';
          if (type) { const gen = genPlant(type, bi, rng(Math.floor(h1 * 1e9) ^ (wi * 7919)), lush, sol ? null : { anchor: -1 });
            out.push({ id, type, x: x + (h2 - 0.5) * 0.15, y, bi, front, gen, anchor: gen.anchor, hp: gen.hp, top: y + gen.top, hw: gen.hw, H: gen.H, ph: hash(wi, iy, 91) * 6.28, fall: 0, b: 0, bv: 0, shake: 0 }); }
        }
      }
      prev = sol;
    }
  }
  return out;
}
let scanT = 0;
export function stepFlora(dt) {
  const cam = S.cam, zo = Math.min(S.zo, 3.4), hw = (14 / S.zoom + 8) * zo, x0 = Math.floor((cam.x - hw) / 8), x1 = Math.floor((cam.x + hw) / 8), y0 = Math.floor((cam.y - 26 - 8 * (zo - 1)) / 8), y1 = Math.floor((cam.y + 11 + 8 * (zo - 1)) / 8);
  if (S.zo > 12) { active = []; flora.count = 0; return; }
  active = [];
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) { const k = cx * 4096 + cy; let b = blocks.get(k); if (!b) { b = build(cx, cy); blocks.set(k, b); } for (const p of b) active.push(p); }
  if (blocks.size > 420) for (const k of blocks.keys()) { const cx = Math.round(k / 4096); if (Math.abs(cx - (x0 + x1) / 2) > 8 * zo) blocks.delete(k); if (blocks.size < 300) break; }
  flora.count = active.length;
  // falling, uprooted and scorched plants
  scanT -= dt; const scan = scanT <= 0; if (scan) scanT = 0.4; stepTrees(dt); if (flora.note && (flora.note.t -= dt) <= 0) flora.note = null;
  for (const p of active) {
    if (p.gone) continue;
    if (p.type === 'tree') { const c = flora.cut.get(p.id); if (c && c.st) continue; }
    if (!scan) continue;
    if (world.dens(p.x, p.y - 0.3 * p.anchor) <= 0 && world.dens(p.x, p.y - 0.12 * p.anchor) <= 0) { if (p.type === 'tree') fell(recOf(p), hash(p.x * 7 | 0, 2, 85) < 0.5 ? -1 : 1); else kill(p, false); }
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
// ---- round 7: trees are hard to cut ------------------------------------------------------------------------------------
// A tree is felled, not deleted: a kerf through the trunk (the laser's pulses, each one charring more than it cuts, or
// a drone's saw), then the trunk falls as a rod about its foot under gravity until it meets the ground, and lies there;
// then it is cut into logs, one cross-cut each. What a tree is while that goes on is a record (flora.cut), kept apart
// from the plant that draws it, so the work goes on out of sight and is saved.
//   rec = { id, x, y, H, d, k (J into the kerf), st (0 standing, 1 falling, 2 down), dir, ang, w, sec (logs cut),
//           sj (J into the next cross-cut), mark (to be felled), hot }
const recOf = p => { let c = flora.cut.get(p.id); if (!c) { c = { id: p.id, x: +p.x.toFixed(2), y: +p.y.toFixed(2), H: +p.H.toFixed(2), d: +(p.gen.d || 0.5).toFixed(3), yk: p.gen.yieldK || 1, k: 0, st: 0, dir: 1, ang: 0, w: 0, sec: 0, sj: 0, mark: false, hot: 0 }; flora.cut.set(p.id, c); } return c; };
export const treeRec = id => flora.cut.get(id) || null;
// the standing or lying trees among the plants in view between two x
export function treesIn(x0, x1) { const out = []; for (const p of active) if (p.type === 'tree' && !p.gone && p.x >= x0 && p.x <= x1) { const c = flora.cut.get(p.id); out.push({ id: p.id, x: p.x, y: p.y, H: p.H, d: p.gen.d || 0.5, mark: !!(c && c.mark), st: c ? c.st : 0, k: c ? c.k : 0, p }); } return out; }
// the deconstruction planner over trees: mark (or unmark) every standing tree whose foot is in the box. Returns how many.
export function markTrees(x0, y0, x1, y1, on = true) { let n = 0; for (const p of active) { if (p.type !== 'tree' || p.gone || p.x < x0 || p.x > x1 || p.y < y0 - 1.5 || p.y > y1 + 0.5) continue; const c = recOf(p); if (c.st === 0 && c.mark !== on) { c.mark = on; n++; } } return n; }
function fell(c, dir) { if (c.st) return; c.st = 1; c.dir = dir || 1; c.ang = 0.04; c.w = 0.12; c.mark = false; flora.felled++; events.emit('treeFalling', { id: c.id, d: c.d, H: c.H }); audio.play('groan'); if (S.shakeBy) S.shakeBy(0.1); }
// the point at fraction u along the trunk of a record (0 the foot, 1 the top)
const along = (c, u) => [c.x + Math.sin(c.ang) * c.dir * c.H * u, c.y + 0.3 + Math.cos(c.ang) * c.H * u];
// joules into the kerf of a standing tree, or into the next cross-cut of one that is down. Returns what happened.
export function treeCut(c, J, fromX) {
  c.hot = 0.6;
  if (c.st === 0) { c.k += J; if (c.k >= kerfWoodJ(c.d)) { fell(c, fromX === undefined ? 1 : c.x >= fromX ? 1 : -1); return 'felled'; } return 'kerf'; }
  if (c.st === 2) { const L = logsOf(c.H, c.d); if (c.sec >= L.n) return 'done'; c.sj += J; if (c.sj >= kerfWoodJ(L.d(c.sec))) { c.sj = 0; log(c, L); return c.sec >= L.n ? 'done' : 'log'; } return 'cut'; }
  return 'falling';
}
// one log comes off the butt end: a body of exactly its wood. The last one takes the tree with it.
function log(c, L) {
  const i = c.sec, [x, y] = along(c, (i + 0.5) / L.n * WOOD.trunk); if (flora.drop) flora.drop('log', L.kg(i), x, y + 0.3); c.sec++; flora.logs++; events.emit('logCut', { id: c.id, kg: L.kg(i), i });
  if (c.sec >= L.n) { const p = active.find(q => q.id === c.id); if (flora.drop) flora.drop('resin', YIELD.tree.resin * c.yk, x, y + 0.3); if (p) { p.gone = true; } flora.dead.add(c.id); flora.cut.delete(c.id); events.emit('treeDone', c.id); }
}
// a saw works by feed, not by joules: dt seconds of a drone's chain on the cut that is next
export function treeSaw(c, dt, fromX) { const d = c.st === 2 ? logsOf(c.H, c.d).d(c.sec) : c.d; return treeCut(c, kerfWoodJ(d) * dt / sawTime(d), fromX); }
// what there is to do to trees, for the robots: [{ id, kind: 'fell' | 'buck', x, y }]
export function treeJobs() { const out = []; for (const c of flora.cut.values()) { if (c.st === 0 && c.mark) out.push({ id: c.id, kind: 'fell', x: c.x, y: c.y + 0.5, rec: c }); else if (c.st === 2) { const [x, y] = along(c, (c.sec + 0.5) / logsOf(c.H, c.d).n * WOOD.trunk); out.push({ id: c.id, kind: 'buck', x, y: y + 0.2, rec: c }); } } return out; }
export function stepTrees(dt) {
  for (const c of flora.cut.values()) {
    if (c.hot > 0) c.hot -= dt;
    if (c.st !== 1) continue;
    c.w += fallAcc(c.H, c.ang, GRAV) * dt; c.ang += c.w * dt;
    // it has landed when the trunk meets the ground somewhere along its length (or hangs past the horizontal over an edge)
    let hit = c.ang > Math.PI / 2 + 0.7; for (const u of [0.45, 0.7, 0.95]) { const [x, y] = along(c, u); if (world.dens(x, y - 0.25) > 0) hit = true; }
    // what stands under it while it comes down is struck by the part of the trunk that reaches it
    if (flora.hurt && c.ang > 0.5) flora.hurt(c, along(c, 0), along(c, 1));
    if (hit) { c.st = 2; const v = c.w * c.H, E = 0.5 * (c.d * c.H * 0.6 * 0.02 * WOOD.rho) * v * v / 3; c.w = 0; events.emit('treeDown', { id: c.id, v, E, at: along(c, 0.6) }); audio.play('thud'); const [tx, ty] = along(c, 0.6); env.noise(tx, ty, 40); if (S.shakeBy) S.shakeBy(Math.min(0.4, 0.08 + v * 0.02)); floraBlast(tx, ty, 6, 6);
      // the crown breaks up where it lands: its leaves and small wood are loose matter there
      if (flora.drop) { const [cx, cy] = along(c, 0.85); for (const id of ['biomass', 'fibre']) for (let i = 0; i < 2; i++) flora.drop(id, YIELD.tree[id] * c.yk / 2, cx + rand(-1, 1), cy + 0.6 + rand(0, 0.5)); }
      for (let i = 0; i < 40; i++) { const [px, py] = along(c, 0.5 + Math.random() * 0.5); S.parts.spawn({ x: px + rand(-0.6, 0.6), y: py + rand(0, 0.8), vx: rand(-2.5, 2.5), vy: rand(0.5, 4), life: rand(1, 3.5), size: rand(0.04, 0.09), c: [0.2, 0.9, 0.5], c2: [0.03, 0.1, 0.06], col: 1, bounce: 0.1 }); } }
  }
}
// is (x, y) on a trunk (standing, below its boughs; or lying, anywhere along it)?
function onTrunk(p, x, y, pad) {
  const c = flora.cut.get(p.id), d = p.gen.d || 0.5;
  if (!c || c.st === 0) return Math.abs(x - p.x) <= d / 2 + pad && y >= p.y + 0.15 - pad && y <= p.y + Math.min(2.6, p.H * 0.35) + pad;
  if (c.st === 2) { const [ax, ay] = along(c, 0), [bx, by] = along(c, WOOD.trunk), ex = bx - ax, ey = by - ay, u = clamp(((x - ax) * ex + (y - ay) * ey) / (ex * ex + ey * ey), 0, 1); return Math.hypot(x - ax - ex * u, y - ay - ey * u) <= d / 2 + pad + 0.04; }
  return false;
}
// the tree the cursor is on, if any. You walk past a tree and you shoot past one: the forest is deep, and the plane you
// work in is one slice of it. The beam meets a trunk only when the trunk is what you aim at.
export function floraAim(x, y) { for (const p of active) if (p.type === 'tree' && !p.gone && Math.abs(x - p.x) < p.H + 1 && onTrunk(p, x, y, 0.2)) return p; return null; }
// the laser's pulse against the trunk that is aimed at, at (x, y): E joules arrive from the side fromX. Returns the
// record when the wood took the pulse (the beam ends there).
export function floraBeam(x, y, E, fromX, only) {
  for (const p of only ? [only] : active) {
    if (p.type !== 'tree' || p.gone || Math.abs(x - p.x) > p.H + 1) continue; const c = flora.cut.get(p.id), d = p.gen.d || 0.5;
    if (!c || c.st === 0) { if (Math.abs(x - p.x) > d / 2 + 0.06 || y < p.y + 0.15 || y > p.y + Math.min(2.6, p.H * 0.35)) continue; }
    else if (c.st === 2) { const [ax, ay] = along(c, 0), [bx, by] = along(c, WOOD.trunk), ex = bx - ax, ey = by - ay, u = clamp(((x - ax) * ex + (y - ay) * ey) / (ex * ex + ey * ey), 0, 1); if (Math.hypot(x - ax - ex * u, y - ay - ey * u) > d / 2 + 0.1) continue; }
    else continue;
    const rec = recOf(p), r = treeCut(rec, E * LASERP.absorb, fromX), need = rec.st === 2 ? kerfWoodJ(logsOf(rec.H, rec.d).d(Math.min(rec.sec, logsOf(rec.H, rec.d).n - 1))) : kerfWoodJ(rec.d), have = rec.st === 2 ? rec.sj : rec.k;
    p.shake = 0.15; p.bv += (p.x - x > 0 ? 1 : -1) * 0.6;
    flora.note = { t: 2.5, text: r === 'felled' ? `the trunk is through: ${rec.d.toFixed(2)} m of wood, it falls ${rec.dir > 0 ? 'east' : 'west'}` : r === 'log' || r === 'done' ? `a log is cut${r === 'done' ? ': the trunk is all logs' : ''}` : `${rec.st === 2 ? 'cross-cut' : 'trunk'} ${rec.d.toFixed(2)} m: the beam chars more than it cuts. kerf ${(100 * have / need).toFixed(0)} %, about ${Math.max(1, Math.ceil((need - have) / (PULSE_BEAM_J * LASERP.absorb)))} pulses to go` };
    // char, embers and smoke where it burns
    for (let i = 0; i < 3; i++) S.parts.spawn({ x: x + rand(-0.05, 0.05), y: y + rand(-0.05, 0.05), vx: rand(-1.5, 1.5) - Math.sign(p.x - (fromX === undefined ? x : fromX)) * 1.5, vy: rand(0.5, 3), life: rand(0.3, 0.9), size: rand(0.02, 0.05), c: [4, 1.6, 0.3], c2: [0.5, 0.05, 0.01], grav: 0.2 });
    S.parts.spawn({ x, y: y + 0.1, vx: rand(-0.3, 0.3), vy: rand(0.6, 1.4), life: rand(1.2, 2.6), size: rand(0.18, 0.32), grow: 2.2, c: [0.07, 0.065, 0.06], mode: 1, a: 0.35, grav: -0.03, drag: 0.8 });
    return rec;
  }
  return null;
}
// bullets, claws and the beam's scorch damage small plants along their spine; a tree shrugs them off. Returns true when something was hit
export function floraHit(x, y, dmg, r = 0.3) {
  let hit = false;
  for (const p of active) {
    if (p.gone || p.type === 'tree' || Math.abs(x - p.x) > 3) continue;
    const top = p.anchor > 0 ? p.top : p.y - (p.H || 0.5), y0 = Math.min(p.y, top), y1 = Math.max(p.y, top);
    if (y < y0 - r || y > y1 + r || Math.abs(x - p.x) > p.hw + r) continue;
    p.hp -= dmg; hit = true; p.shake = 0.3; p.bv += (p.x - x > 0 ? 1 : -1) * 3; if (p.hp <= 0) kill(p, true);
  }
  return hit;
}
// a pressure wave (the laser's impact, a landing, a falling tree): plants lean away from it
export function floraBlast(x, y, r, k) { for (const p of active) { const dx = p.x - x, dy = p.y - y; if (Math.abs(dx) < r && Math.abs(dy) < r + p.H) p.bv += (dx >= 0 ? 1 : -1) * k * (1 - Math.abs(dx) / r) / (1 + p.H * 0.25); } }
let lastT = 0;
export function drawFlora(b, time, front) {
  const cam = S.cam, hw = (14 / S.zoom + 9) * Math.min(S.zo, 3.4), dt = front ? 0 : clamp(time - lastT, 0, 0.05); if (!front) lastT = time;
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
    const tc = p.type === 'tree' ? flora.cut.get(p.id) : null;
    drawPlant(b, p.gen, p.x, p.y, 1, tc && tc.st ? 0 : s, time, p.ph, null, tc && tc.st ? tc.ang * tc.dir : 0);
    if (tc && !front) {       // the kerf: a charred slot that grows across the trunk, glowing while it is worked; the cuts along a trunk that lies
      const d = tc.d, hot = Math.max(0, tc.hot);
      if (tc.st === 0 && tc.k > 0) { const f = Math.min(1, tc.k / kerfWoodJ(d)), ky = p.y + 0.55; b.add(p.x - d / 2 + d * f / 2, ky, d * f, 0.05, 0, [0.004, 0.004, 0.004], 1, 0, 1); b.add(p.x - d / 2 + d * f / 2, ky, d * f + 0.1, 0.16, 0, [0.012, 0.01, 0.008], 0.7, 1, 1); if (hot > 0) { b.add(p.x - d / 2 + d * f, ky, 0.14, 0.1, 0, [3 * hot, 1.0 * hot, 0.15 * hot], 1, 1, 2); light.emit(p.x / TS, ky / TS, 1.2 * hot, 0.4 * hot, 0.06 * hot); } }
      if (tc.st === 0 && tc.mark) { b.seg(p.x - d / 2 - 0.12, p.y + 0.35, p.x + d / 2 + 0.12, p.y + 0.75, 0.035, [2, 0.12, 0.08], 0.8, 0, 2); b.seg(p.x - d / 2 - 0.12, p.y + 0.75, p.x + d / 2 + 0.12, p.y + 0.35, 0.035, [2, 0.12, 0.08], 0.8, 0, 2); }
      if (tc.st === 2) { const L = logsOf(tc.H, tc.d); for (let i = 0; i <= Math.min(tc.sec, L.n - 1); i++) { const done = i < tc.sec, f = done ? 1 : Math.min(1, tc.sj / kerfWoodJ(L.d(i))); if (f <= 0) continue; const [x, y] = along(tc, (i + 1) / L.n * WOOD.trunk); b.add(x, y, L.d(i) * f + 0.04, 0.05, -tc.ang * tc.dir, [0.004, 0.004, 0.004], 1, 0, 1); if (!done && hot > 0) b.add(x, y, 0.16, 0.16, 0, [3 * hot, 1.0 * hot, 0.15 * hot], 1, 1, 2); } }
    }
    if (!front || p.type !== 'grass') { const L = p.gen.lights, k = tc && tc.st ? 0.25 : 0.85 + 0.15 * Math.sin(time * 0.9 + p.ph); for (let i = 0; i < L.length; i += 5) light.emit((p.x + L[i]) / TS, (p.y + L[i + 1]) / TS, L[i + 2] * k, L[i + 3] * k, L[i + 4] * k); }
  }
}
export function resetFlora() { blocks.clear(); active = []; }
export function dumpTrees() { const f = v => +v.toFixed(3); return [...flora.cut.values()].filter(c => c.k > 0 || c.st || c.mark || c.sec).map(c => [c.id, c.x, c.y, c.H, c.d, f(c.yk), Math.round(c.k), c.st, c.dir, f(c.ang), f(c.w), c.sec, Math.round(c.sj), c.mark ? 1 : 0]); }
export function loadTrees(a) { flora.cut.clear(); flora.felled = 0; flora.logs = 0; flora.note = null; for (const q of a || []) flora.cut.set(q[0], { id: q[0], x: q[1], y: q[2], H: q[3], d: q[4], yk: q[5], k: q[6], st: q[7], dir: q[8], ang: q[9], w: q[10], sec: q[11], sj: q[12], mark: !!q[13], hot: 0 }); }

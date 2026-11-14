// what you know (round 6 J, N, docs/SCIENCE.md 3, 5, V3): sensors, the scan, data, and the fog over everything else.
//   sensors   you only see what a sensor sees. Your eyes and lamp: line of sight. The suit's scanner: a few metres,
//             through rock, when you hold H on a spot. The wreck's hull cameras and any camera you place: real vision
//             in their reach, line of sight. Radar: blobs for whatever moves, no identity. What nothing sees is not
//             drawn: an animal out of sight is a last-known ghost that fades, or a blob, or nothing.
//   the scan  hold H: a sweep over the spot, a ring that fills (the scanner's time), then the ground there is known:
//             its grade within the scanner's error (geology.js), what is in it (the finds the drones may mine by
//             themselves), and whether the plant or animal under it can be eaten. It costs power, and it costs data.
//   data      a physical thing: a hyperspectral scan is 1.5 GB a square metre, a camera streams 2.5 MB/s into a
//             buffer. It is stored on SSDs (4 TB each: two in the wreck's data rack, more when you make or salvage
//             them and put them in a store). Full is full: the scanner stops until there is room.
//   knowledge the planet starts unknown. The map shows the slice you have seen. g and the radius are estimates with a
//             range that narrows as the AI measures: g from the first real fall it times, the radius from walking a
//             baseline, both better with a radar up.
import { G, events, clamp, hash } from '../core.js';
import { audio } from '../audio.js';
import { inv } from '../items.js';
import { world, TS, GRAV } from './world.js';
import { canonX, RAD, CIRC } from './gen.js';
import { light } from './light.js';
import { S, C, mul } from './state.js';
import { F } from './factory.js';
import { creatures, KIND } from './creatures.js';
import { K, SHIP } from './kit.js';
import { BOOT, EXO, NEEDS, suitStats } from './suit.js';
import { partNamed } from './wreck.js';
import { GEO, mark, composition, classOf, estimate, measure, fmtEst } from './geology.js';
import { flora } from './flora.js';

export const SENSE = { eye: 15, eyeDark: 7, cam: 18, hull: 20, radar: 46, stale: 9, scanW: 220, gbPerM2: 1.5, camGB: 0.0025, ssdGB: 4000 };
export const FOG = { on: true, usedGB: 0, capGB: 8000, x0: 0, x1: 0, scan: null, know: { g: 0, r: 0, fall: 0, base: 0 }, finds: new Map(), tick: 0, cams: 0, radars: 0, full: false, last: null };
const los = (ax, ay, bx, by) => { const d = Math.hypot(bx - ax, by - ay); if (d < 0.6) return true; return !world.ray(ax, ay, (bx - ax) / d, (by - ay) / d, d - 0.5); };
// every sensor that sees: [{ x, y, r, kind }]
export function sensors() {
  const P = S.P, out = []; if (!P.dead) out.push({ x: P.x, y: P.y + 1.6, r: light.lamp.on || WRECKLIT() ? SENSE.eye : SENSE.eyeDark, kind: 'eye' });
  if (S.crash && BOOT.done && partNamed('hull cameras')) out.push({ x: SHIP.x, y: SHIP.y + 2.6, r: SENSE.hull, kind: 'camera' });
  for (const m of F.machines) if (m.kind === 'camera' && (m.pw === undefined || m.pw > 0.2)) out.push({ x: (m.x + 0.5) * TS, y: (m.y + 1.9) * TS, r: SENSE.cam, kind: 'camera' });
  if (K.laser.state === 'turret' && K.laser.link) out.push({ x: K.laser.x, y: K.laser.y + 1.2, r: 17, kind: 'camera' });
  return out;
}
const WRECKLIT = () => S.inside === 'wreck';
export const radars = () => F.machines.filter(m => m.kind === 'radar' && (m.pw === undefined || m.pw > 0.2)).map(m => ({ x: (m.x + 0.5) * TS, y: (m.y + 1.6) * TS, r: SENSE.radar }));
// pure: does a sensor see the point (given a line-of-sight test)?
export const seenBy = (s, x, y, sight) => Math.hypot(s.x - x, s.y - y) <= s.r && sight(s.x, s.y, x, y);
export function storageCap() { let n = partNamed('data rack') ? 2 : 0; if (S.crash) n += inv.count(K.hold, 'ssd'); for (const m of F.machines) if (m.kind === 'chest') n += inv.count(m.inv, 'ssd'); return n * SENSE.ssdGB; }
// the estimates the HUD shows: g and the radius, each with the range the measurements so far leave
export function knownG() { const lv = FOG.know.g, rel = lv >= 2 ? 0.005 : lv === 1 ? 0.05 : 0.2; return measure(GRAV, rel, 11 + lv); }
export function knownR() { const lv = FOG.know.r; return lv ? measure(RAD, lv >= 2 ? 0.05 : 0.3, 21 + lv) : null; }
export const knownSlice = () => [FOG.x0, FOG.x1];
const BIO = ['cyan', 'violet', 'acid'];
function plantAt(x, y, r) { let best = null, bd = r + 0.8; for (const p of flora.active || []) { if (p.type === 'grass' || p.type === 'moss') continue; const d = Math.hypot(p.x - x, (p.y + p.top) / 2 - y); if (d < bd) { bd = d; best = p; } } return best ? { species: `${BIO[best.bi] || ''} ${best.type}`.trim(), n: best.type.length * 31 + best.type.charCodeAt(0), bi: best.bi } : null; }
// the scan is finished at (x, y): the ground is known, what is in it is on the list, the thing under it is in the book
export function scanDone(x, y, r, err) {
  const cells = mark(x, y, r, 1); GEO.scans++; let found = 0;
  for (let j = -Math.ceil(r); j <= Math.ceil(r); j++) for (let i = -Math.ceil(r); i <= Math.ceil(r); i++) { if (i * i + j * j > r * r) continue; const cx = Math.floor(x + i) + 0.5, cy = Math.floor(y + j) + 0.5; if (world.dens(cx, cy) < 0.15) continue; const mat = world.matAt(cx, cy), q = composition(mat, cx, cy), item = classOf(q), key = Math.floor(canonX(cx)) + ':' + Math.floor(cy); if (!FOG.finds.has(key)) { FOG.finds.set(key, { x: cx, y: cy, item, mat, fe: q.fe }); found++; } }
  FOG.usedGB += Math.max(cells, 4) * SENSE.gbPerM2;
  // a living thing under the scan: the animal's mass within a range; the plant's species, and whether it can be eaten
  let what = null; for (const c of creatures) if (Math.hypot(c.x - x, c.y - y) < r + 0.5) { const k = KIND[c.type], lv = (c.scanned = (c.scanned || 0) + 1), e = measure(k.kg || 5, lv >= 2 ? 0.05 : 0.3, c.type.length * 7 + lv); FOG.bank = FOG.bank || {}; FOG.bank[c.type] = Math.max(FOG.bank[c.type] || 0, lv); what = `${c.type}: ${fmtEst(e, ' kg', 1)}${k.chitin ? ', chitin ' + (k.chitin * 1000).toFixed(0) + ' mm' : ''}`; FOG.usedGB += 0.5; break; }
  if (!what) { const f = plantAt(x, y, r); if (f) { const key = f.species, ok = hash(f.n, f.bi, 641) > 0.45; NEEDS.edible[key] = ok; if (ok) S.known.add('edible'); what = `${key}: ${ok ? 'edible' : 'toxic'}`; events.emit('edibleKnown', { key, ok }); } }
  const mat = world.dens(x, y) > 0 ? world.matAt(x, y) : world.matAt(x, y - 0.6), e = estimate(mat, x, y, 1, err);
  FOG.last = { x, y, r, t: G.time, cells, found, what, fe: e }; events.emit('scanned', { x, y, cells, found, fe: e.v, lo: e.lo, hi: e.hi, what }); audio.play('click');
  S.say(what || `scan: iron ${fmtEst({ v: e.v * 100, rel: e.rel }, ' %', 1)}${e.cu > 0.003 ? '   copper ' + (e.cu * 100).toFixed(1) + ' %' : ''}${e.lm > 0.0005 ? '   lumen ' + (e.lm * 100).toFixed(2) + ' %' : ''}   ${cells} m2, ${(Math.max(cells, 4) * SENSE.gbPerM2).toFixed(0)} gb`, 4.5);
  return FOG.last;
}
// hold H: the suit's scanner on the spot under the cursor (within its arm's reach of sensors: 9 m)
export function stepScan(dt, hold) {
  const P = S.P, st = P.st || suitStats(), x = S.mouse.x, y = S.mouse.y;
  if (!hold || P.dead || !st.on || !st.scanR) { FOG.scan = null; if (hold && !st.on && S.msgT <= 0) S.say('the scanner is in the suit', 2); return; }
  if (Math.hypot(x - P.x, y - P.y - 1.2) > 9) { FOG.scan = null; if (S.msgT <= 0) S.say('too far to scan: within 9 m', 1.5); return; }
  FOG.capGB = storageCap(); if (FOG.usedGB + 6 > FOG.capGB) { FOG.scan = null; FOG.full = true; if (S.msgT <= 0) S.say(`storage full: ${(FOG.usedGB / 1000).toFixed(1)} of ${(FOG.capGB / 1000).toFixed(1)} tb. the scanner needs room: more ssds in a store`, 3); return; } FOG.full = false;
  if (P.bat.wh < 2) { FOG.scan = null; if (S.msgT <= 0) S.say('no power for the scanner', 2); return; }
  let s = FOG.scan; if (!s || Math.hypot(s.x - x, s.y - y) > 0.8) s = FOG.scan = { x, y, t: 0, T: st.scanT, r: st.scanR };
  s.t += dt; P.bat.wh = Math.max(0, P.bat.wh - SENSE.scanW * dt / 3600); P.reach = { x: s.x, y: s.y };
  if (s.t >= s.T) { scanDone(s.x, s.y, s.r, st.err); FOG.scan = { x: s.x, y: s.y, t: 0, T: s.T, r: s.r, again: true }; }
}
export function stepFog(dt) {
  const P = S.P; FOG.tick -= dt; if (FOG.tick > 0) return; FOG.tick = 0.2;
  const ss = sensors(), rr = radars(); FOG.cams = ss.length - 1; FOG.radars = rr.length;
  for (const c of creatures) {
    let seen = false; for (const s of ss) if (seenBy(s, c.x, c.y, los)) { seen = true; break; }
    if (seen) { c.seenT = G.time; c.gx = c.x; c.gy = c.y; } else if (rr.some(r => Math.hypot(r.x - c.x, r.y - c.y) < r.r) && Math.hypot(c.vx || 0, c.vy || 0) > 0.3) c.blipT = G.time;
    else if (c.agg && Math.hypot(c.x - P.x, c.y - P.y) < 9) c.blipT = G.time;       // you hear what hunts you close by
  }
  // the slice of the planet you have seen: what your sensors have covered, widened as you go
  const cx = canonX(P.x); if (!FOG.x1 && !FOG.x0) { FOG.x0 = cx - 30; FOG.x1 = cx + 30; } const w = 34 + (rr.length ? 30 : 0); if (cx - w < FOG.x0 && FOG.x0 - (cx - w) < CIRC / 2) FOG.x0 = cx - w; if (cx + w > FOG.x1 && cx + w - FOG.x1 < CIRC / 2) FOG.x1 = cx + w; for (const s of ss) { const sx = canonX(s.x); if (sx - s.r < FOG.x0 && Math.abs(sx - cx) < 400) FOG.x0 = sx - s.r; if (sx + s.r > FOG.x1 && Math.abs(sx - cx) < 400) FOG.x1 = sx + s.r; }
  // data: every camera streams into its buffer until the buffer is its share (3 GB each)
  FOG.capGB = storageCap(); const camShare = FOG.cams * 3; if ((FOG.camGB || 0) < camShare) { const k = Math.min(camShare - (FOG.camGB || 0), FOG.cams * SENSE.camGB * 0.2); FOG.camGB = (FOG.camGB || 0) + k; FOG.usedGB += k; }
  // what the AI has measured by now: g from a fall it timed, better with the pendulum of the cable when the reactor
  // hangs set down a minute; the radius from a baseline walked (200 m), better with a radar up
  if (EXO.on && BOOT.done) { if (!P.ground && P.vy < -4) FOG.know.fall += 0.2; if (FOG.know.g < 1 && FOG.know.fall > 0.4) { FOG.know.g = 1; events.emit('measured', 'g'); S.say(`ai: timed your fall. g is ${fmtEst(knownG(), ' m/s2', 2)}`, 4); } if (FOG.know.g === 1 && K.reactor.state === 'ground' && K.cable.length) { FOG.know.base2 = (FOG.know.base2 || 0) + 0.2; if (FOG.know.base2 > 60) { FOG.know.g = 2; events.emit('measured', 'g2'); S.say(`ai: the cable swings like a pendulum. g is ${fmtEst(knownG(), ' m/s2', 3)}`, 4); } }
    if (FOG.know.r < 1 && FOG.x1 - FOG.x0 > 260) { FOG.know.r = 1; events.emit('measured', 'radius'); S.say(`ai: the horizon over a ${(FOG.x1 - FOG.x0).toFixed(0)} m baseline: the radius is ${fmtEst(knownR(), ' m', 0)}`, 5); } if (FOG.know.r === 1 && rr.length) { FOG.know.r = 2; events.emit('measured', 'radius2'); } }
}
// is this creature drawn as itself? (seen within the last moment)
export const visible = c => !FOG.on || G.time - (c.seenT === undefined ? -99 : c.seenT) < 0.45;
export function drawFog(b, time) {
  if (FOG.on) for (const c of creatures) {
    if (visible(c)) continue; const age = G.time - (c.seenT === undefined ? -99 : c.seenT), k = KIND[c.type];
    if (age < SENSE.stale) { const a = 0.5 * (1 - age / SENSE.stale), s = 0.3 + k.thick * 0.5; for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { b.seg(c.gx + dx * s, c.gy + dy * s, c.gx + dx * s * 0.6, c.gy + dy * s, 0.015, mul(C.amber, 1.2), a, 0, 2); b.seg(c.gx + dx * s, c.gy + dy * s, c.gx + dx * s, c.gy + dy * s * 0.6, 0.015, mul(C.amber, 1.2), a, 0, 2); } }       // last known: a ghost that fades
    else if (G.time - (c.blipT || -99) < 1.2) b.add(c.x, c.y, 0.5, 0.5, 0, mul(C.amber, 0.5), 0.35 + 0.2 * Math.sin(time * 6 + c.seed), 1, 2);       // a blob: something moves there
  }
  const s = FOG.scan;
  if (s && !s.again || s && s.t > 0) {      // the sweep and the ring
    const u = clamp(s.t / s.T, 0, 1), n = 40; for (let i = 0; i < n; i++) { const a0 = i / n * 6.2832, on = i / n <= u; b.add(s.x + Math.cos(a0) * s.r, s.y + Math.sin(a0) * s.r, 0.1, 0.03, a0 + 1.57, mul(C.cyan, on ? 2.4 : 0.5), on ? 0.9 : 0.35, 0, 2); }
    const sw = (time * 1.6) % 1, sy = s.y - s.r + sw * 2 * s.r, hw = Math.sqrt(Math.max(0, s.r * s.r - (sy - s.y) * (sy - s.y))); b.add(s.x, sy, hw * 2, 0.03, 0, mul(C.cyan, 2), 0.6, 0, 2); b.add(s.x, sy, hw * 2, 0.4, 0, mul(C.cyan, 0.3), 0.25, 0, 2);
    const P = S.P; b.seg(P.gx, P.gy, s.x, s.y, 0.012, mul(C.cyan, 1.4), 0.4, 0, 2); light.emit(s.x / TS, s.y / TS, 0.05, 0.5, 0.45);
  }
  const L = FOG.last; if (L && G.time - L.t < 2.5) { const a = 1 - (G.time - L.t) / 2.5; b.add(L.x, L.y, L.r * 2, L.r * 2, 0, mul(C.cyan, 0.25), a * 0.35, 1, 2); }
  // what the scanner has found, while you plan or hold alt: a mark on every square metre of something worth cutting
  if (S.mode === 'blueprint' || S.alt) for (const f of FOG.finds.values()) { if (Math.abs(f.x - S.cam.x) > 26 || f.item === 'basalt' || f.item === 'soil') continue; b.add(f.x, f.y, 0.16, 0.16, 0.785, f.item === 'iron ore' ? [1.6, 0.5, 0.2] : f.item === 'lean ore' ? [0.9, 0.4, 0.25] : f.item === 'copper ore' ? [0.2, 1.3, 0.8] : [0.2, 1.2, 1.6], 0.75, 0, 2); }
}
export function dumpFog() { const f = v => +v.toFixed(2); return { gb: f(FOG.usedGB), cam: f(FOG.camGB || 0), x: [f(FOG.x0), f(FOG.x1)], k: [FOG.know.g, FOG.know.r], f: [...FOG.finds.values()].map(q => [q.x, q.y, q.item, q.mat, q.fe]), bank: FOG.bank || {} }; }
export function loadFog(o) { FOG.scan = null; FOG.last = null; FOG.finds = new Map(); FOG.know = { g: 0, r: 0, fall: 0, base: 0 }; FOG.usedGB = 0; FOG.camGB = 0; FOG.x0 = FOG.x1 = 0; FOG.bank = {}; FOG.on = true; if (!o) return; FOG.usedGB = o.gb; FOG.camGB = o.cam || 0; [FOG.x0, FOG.x1] = o.x; [FOG.know.g, FOG.know.r] = o.k; for (const q of o.f || []) FOG.finds.set(Math.floor(canonX(q[0])) + ':' + Math.floor(q[1]), { x: q[0], y: q[1], item: q[2], mat: q[3], fe: q[4] }); FOG.bank = { ...(o.bank || {}) }; }

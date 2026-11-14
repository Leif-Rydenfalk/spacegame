// round 6: the machines and things that are new, on the factory's grid and through its hooks.
//   assay station   crushes and assays rubble (20 kWh a tonne): what comes out is what the rock is, sorted, and the place
//                   the sample came from is known to +-1 % from then on (geology.js)
//   shaft rig       a small head over a hole. You set its depth (drag down when you place it; drag again to go deeper,
//                   drag sideways from it to branch at a level). It pays as it goes: a drill rod and a length of
//                   casing for every metre actually sunk, brought by the robots. Modules on the same rig: a rotary
//                   head (five times the pulse head's rate), a hoist line (the muck comes up in a skip instead of
//                   lying at the bottom). The power it needs grows with the string it turns.
//   pump, air filter, controller   the life support that came out of the wreck: together and powered they take oxygen
//                   out of the air (it is there: the plants are green; it is just not breathable) and your mask fills
//   camera, radar   sensors (fog.js); power pole: a node of the grid (net.js); seat, table, bunk, stairs: furniture
import { G, events, rand, clamp } from '../core.js';
import { audio } from '../audio.js';
import { ITEMS, mixQ, inv } from '../items.js';
import { world, TS, M, MAT, SLAB } from './world.js';
import { light } from './light.js';
import { S, C, mul } from './state.js';
import { env } from './env.js';
import { F, DEFS } from './factory.js';
import { addPlat, removePlat } from './layers.js';
import { matter } from './matter.js';
import { sortOut, mark, GEO } from './geology.js';
import { rockLumps, spawnRock } from './mine.js';
import { HOIST_V } from './physics.js';
import { NEEDS } from './suit.js';

Object.assign(DEFS, {
  'assay station': { w: 2, h: 2, hp: 160, takes: ['rubble'], noise: 26, poll: 0.15 },
  'shaft rig': { w: 2, h: 2, hp: 200, takes: ['drill rod', 'casing', 'hoist line', 'rotary head'], noise: 34, poll: 0.2 },
  'power pole': { w: 1, h: 4, hp: 60 }, camera: { w: 1, h: 2, hp: 30 }, radar: { w: 1, h: 2, hp: 60 },
  pump: { w: 1, h: 1, hp: 60, noise: 8, poll: 0 }, 'air filter': { w: 1, h: 1, hp: 30 }, controller: { w: 1, h: 1, hp: 30 },
  seat: { w: 1, h: 1, hp: 40 }, table: { w: 1, h: 1, hp: 40 }, bunk: { w: 2, h: 1, hp: 60 }, stairs: { w: 1, h: 1, hp: 60 },
});
export const RIG = { pulseW: 30000, pulseE: 0.75e9, rotaryE: 0.15e9, width: 1.0, free: 2, skip: 40, drift: 1.8 };
F.rock = rockLumps;
F.onPlace = m => { if (m.kind === 'shaft rig') { m.depth = 0; m.target = m.target || 4; m.head = 'pulse'; m.hoist = false; m.branches = []; m.paid = RIG.free; m.hoistT = 0; m.muck = {}; } if (m.kind === 'stairs') addPlat(m.x, m.y); };
F.onRemove = m => { if (m.kind === 'stairs') removePlat(m.x, m.y); };
const out = (m, id, n) => { m.out[id] = (m.out[id] || 0) + n; };
// metres the rig may still sink with the rods and casing it has been given
export const rigNeeds = m => { const want = Math.max(0, Math.ceil((m.target || 0) + (m.branches || []).reduce((a, b) => a + b.len, 0) - m.paid - 1e-6)), have = Math.min(m.inp['drill rod'] || 0, m.inp.casing || 0); return { rods: Math.max(0, Math.min(want, 4) - (m.inp['drill rod'] || 0)), casing: Math.max(0, Math.min(want, 4) - (m.inp.casing || 0)), want, have }; };
F.stepExtra = (m, dt, pw) => {
  const cx = (m.x + m.w / 2) * TS, y0 = m.y * TS;
  if (m.kind === 'assay station') {       // 6 kW of crusher: 72 kJ a kg
    const have = m.inp.rubble || 0; m.on = have > 0.01 && pw > 0.05 && Object.values(m.out).reduce((a, b) => a + b, 0) < 80;
    if (m.on) { const kg = Math.min(have, 6000 * pw * dt / 72e3), q = m.qIn || { fe: 0.09, cu: 0.00006, lm: 0, host: M.BASALT }; m.inp.rubble -= kg; for (const [id, n] of sortOut(q, kg)) out(m, id, n); m.done = (m.done || 0) + kg;
      if (m.done > 2 && q.ox !== undefined && !m.marked) { m.marked = true; const n = mark(q.ox, q.oy, 3, 2); GEO.assays++; events.emit('assayed', { x: q.ox, y: q.oy, fe: q.fe, cells: n }); S.say(`assay: the sample is ${(q.fe * 100).toFixed(1)} % iron${q.cu > 0.003 ? ', ' + (q.cu * 100).toFixed(2) + ' % copper' : ''}${q.lm > 0.0005 ? ', ' + (q.lm * 100).toFixed(2) + ' % lumen' : ''}: the ground it came from is known to 1 % now`, 5); }
      if (m.inp.rubble < 0.01) { m.marked = false; m.done = 0; } }
  } else if (m.kind === 'shaft rig') {
    // modules that arrived are fitted
    if ((m.inp['rotary head'] || 0) >= 1 && m.head !== 'rotary') { m.inp['rotary head'] -= 1; m.head = 'rotary'; events.emit('rigModule', 'rotary head'); S.say('shaft rig: rotary head fitted', 3); }
    if ((m.inp['hoist line'] || 0) >= 1 && !m.hoist) { m.inp['hoist line'] -= 1; m.hoist = true; events.emit('rigModule', 'hoist line'); S.say('shaft rig: hoist line fitted. the muck comes up in the skip', 3); }
    const nd = rigNeeds(m), br = (m.branches || []).find(b => b.done < b.len && m.depth >= b.depth - 0.05), sinking = m.depth < (m.target || 0) - 1e-3, work = sinking || !!br;
    m.wants = { 'drill rod': nd.rods, casing: nd.casing };
    // the string's mass and the rock's torque set the power it needs: more string, more of its 30 kW goes to turning it
    const len = m.depth + (m.branches || []).reduce((a, b) => a + b.done, 0), eff = 1 / (1 + len * 0.02), E = m.head === 'rotary' ? RIG.rotaryE : RIG.pulseE, rate = RIG.pulseW * pw * eff / (E * SLAB);       // m2 of face per second
    const paidFor = m.paid - len; m.wait = '';
    if (work && paidFor <= 0.02) { if (nd.have >= 1) { m.inp['drill rod'] -= 1; m.inp.casing -= 1; m.paid += 1; } else m.wait = `waits for ${(m.inp['drill rod'] || 0) < 1 ? 'a drill rod' : 'casing'}: one of each for the next metre`; }
    m.on = work && pw > 0.05 && !m.wait && Object.values(m.muck).reduce((a, b) => a + b, 0) < 120;
    if (m.on) {
      const adv = Math.min(rate / (sinking ? RIG.width : RIG.drift) * dt, m.paid - len, 0.05), acc = {}; let fx, fy;
      if (sinking) { fx = cx; fy = y0 - m.depth - adv; world.box(cx - RIG.width / 2, fy, cx + RIG.width / 2, y0 - 0.02, -1, 0, acc); m.depth += adv; }
      else { const bx = cx + br.dir * (RIG.width / 2 + br.done + adv), by = y0 - br.depth; fx = bx; fy = by + RIG.drift / 2; world.box(Math.min(cx, bx), by, Math.max(cx, bx), by + RIG.drift, -1, 0, acc); br.done += adv; }
      for (const k in acc) if (acc[k] > 0 && MAT[k].item) for (const [id, kg, q] of rockLumps(+k, acc[k], fx, fy)) { m.muck[id] = (m.muck[id] || 0) + kg; if (q) m.q = mixQ(m.q, (m.muck[id] || 0) - kg, q, kg); }
      if (Math.random() < dt * 4) env.noise(fx, fy, m.head === 'rotary' ? 30 : 18);
    }
    // the muck: with a hoist a skip of 40 kg rides up at 2.5 m/s and tips at the collar; without one it lies at the bottom
    const mk = Object.keys(m.muck).find(k => m.muck[k] > 0.01);
    if (mk && m.hoist) { m.hoistT -= dt; if (m.hoistT <= 0) { const n = Math.min(RIG.skip, m.muck[mk]); m.muck[mk] -= n; out(m, mk, n); m.hoistT = 2 * Math.max(1, m.depth) / HOIST_V + 6; m.trips = (m.trips || 0) + 1; events.emit('skip', { kg: n, depth: m.depth }); } }
    else if (mk && m.muck[mk] > 12) { const n = m.muck[mk]; m.muck[mk] = 0; if (mk === 'rubble' && m.q) inv.nextQ = m.q; matter.spawn(mk, n, cx + rand(-0.2, 0.2), y0 - m.depth + 0.4, 0, 0); }
    if (!work && !m.told && m.depth > 0.5) { m.told = true; events.emit('shaftDone', { depth: m.depth }); } if (work) m.told = false;
  } else if (m.kind === 'pump') {         // with a filter and a controller within 2 m and power: oxygen out of the air, 0.6 g a second
    const near = k => F.machines.some(q => q.kind === k && Math.abs(q.x - m.x) <= 4 && Math.abs(q.y - m.y) <= 3); m.ready = near('air filter') && near('controller'); m.on = m.ready && pw > 0.2 && (m.out.oxygen || 0) < 12;
    if (m.on) out(m, 'oxygen', 0.0006 * dt * pw);
    const P = S.P; if (m.ready && pw > 0.2 && Math.hypot(cx - P.x, y0 - P.y) < 3.5) P.pumpNear = 2;
  } else if (m.kind === 'bunk') { m.on = false; }
};
// F at a placed bunk: sleep there
export function thingUse(m) { if (m.kind === 'bunk') { if (NEEDS.sleep > 0.8) S.say('not tired', 1.5); else { NEEDS.asleep = 600; events.emit('slept'); } return true; } if (m.kind === 'seat' || m.kind === 'table' || m.kind === 'camera' || m.kind === 'radar' || m.kind === 'power pole' || m.kind === 'air filter' || m.kind === 'controller' || m.kind === 'stairs') return true; return false; }
F.drawExtra = (b, m, time, a, ghost, A, md) => {
  const x = m.x * TS, y = m.y * TS, w = m.w * TS, h = m.h * TS, cx = x + w / 2, on = m.on && !ghost;
  if (m.kind === 'assay station') {
    A(cx, y + 0.3, w, 0.6, 0, mul(C.steel, 0.55), 1, 0, md, 3); A(cx - 0.2, y + 0.78, 0.5, 0.4, 0, C.dark, 1, 0, md, 4); A(cx - 0.2, y + 1.0, 0.62, 0.07, 0, mul(C.steel, 0.9)); A(cx + 0.28, y + 0.72, 0.3, 0.26, 0, mul(C.hull, 0.35), 1, 0, md, 5);
    if (!ghost) { b.add(cx + 0.28, y + 0.74, 0.2, 0.12, 0, mul(C.cyan, on ? 1.6 + Math.sin(time * 9) * 0.5 : 0.3), 1, 0, 2); if (on && Math.random() < 0.2) S.parts.spawn({ x: cx - 0.2, y: y + 1.0, vx: rand(-0.6, 0.6), vy: rand(0.4, 1.4), life: rand(0.4, 1), size: rand(0.08, 0.16), grow: 2, c: [0.14, 0.13, 0.13], mode: 1, a: 0.3, grav: 0.02, drag: 2 }); }
  } else if (m.kind === 'shaft rig') {
    // the headframe: two legs, a crown, the sheave; the string down the hole; the casing rings; the skip
    for (const d of [-1, 1]) A(cx + d * 0.42, y + 0.55, 0.07, 1.1, d * -0.12, mul(C.steel, 0.8), 1, 0, md, d + 2); A(cx, y + 1.08, 0.7, 0.08, 0, mul(C.steel, 1.0)); A(cx, y + 0.98, 0.2, 0.2, time * (on ? 4 : 0), mul(C.steel, 0.6), 1, 1, md); A(cx - 0.3, y + 0.16, 0.34, 0.32, 0, C.dark, 1, 0, md, 5);
    if (ghost) return; const dep = m.depth || 0;
    b.seg(cx, y + 0.98, cx, y - dep + 0.25, 0.03, mul(C.steel, 0.9), 1, 0, 1); b.add(cx, y - dep + 0.16, m.head === 'rotary' ? 0.5 : 0.24, 0.22, on ? time * 9 : 0, m.head === 'rotary' ? mul(C.steel, 1.1) : mul(C.amber, on ? 3 + Math.sin(time * 40) : 0.6), 1, m.head === 'rotary' ? 4 : 0, m.head === 'rotary' ? 1 : 2);
    for (let d = 0.5; d < dep; d += 1) for (const s of [-1, 1]) b.add(cx + s * (RIG.width / 2 + 0.02), y - d, 0.05, 0.9, 0, mul(C.steel, 0.5), 1, 0, 1, d);       // casing
    for (const br of m.branches || []) if (br.done > 0.1) b.add(cx + br.dir * (RIG.width / 2 + br.done / 2), y - br.depth + RIG.drift, br.done, 0.05, 0, mul(C.steel, 0.5), 1, 0, 1);
    if (m.hoist && dep > 0.5) { const T = 2 * Math.max(1, dep) / HOIST_V + 6, u = clamp(1 - (m.hoistT || 0) / T, 0, 1), sy = y - dep * (u < 0.5 ? 1 - u * 2 : 0) + 0.3; b.seg(cx + 0.22, y + 0.98, cx + 0.22, sy, 0.012, mul(C.steel, 1.2), 1, 0, 1); b.add(cx + 0.22, sy - 0.12, 0.24, 0.26, 0, mul(C.hull, 0.4), 1, 0, 1, 7); }
    b.add(cx - 0.3, y + 0.2, 0.06, 0.06, 0, mul(m.wait ? C.amber : on ? C.acid : C.steel, 2), 1, 1, 2); if (on) light.emit(cx / TS, (y - dep) / TS, 0.5, 0.3, 0.1);
  } else if (m.kind === 'power pole') { A(cx, y + h / 2, 0.08, h, 0, mul(C.steel, 0.8), 1, 0, md, 2); A(cx, y + h - 0.2, 0.6, 0.06, 0, mul(C.steel, 0.9)); for (const d of [-0.26, 0.26]) A(cx + d, y + h - 0.12, 0.06, 0.1, 0, mul(C.hull, 0.5)); }
  else if (m.kind === 'camera') { A(cx, y + h / 2 - 0.1, 0.05, h - 0.2, 0, mul(C.steel, 0.8)); A(cx, y + h - 0.12, 0.26, 0.14, Math.sin(time * 0.6 + m.seed) * 0.5, C.dark, 1, 2, md, 3); if (!ghost) b.add(cx + Math.sin(time * 0.6 + m.seed) * 0.08, y + h - 0.12, 0.05, 0.05, 0, mul(C.red, 2.2), 1, 1, 2); }
  else if (m.kind === 'radar') { A(cx, y + 0.35, 0.07, 0.7, 0, mul(C.steel, 0.8)); A(cx, y + 0.8, 0.5, 0.12, Math.sin(time * 1.4 + m.seed) * 0.9, mul(C.hull, 0.45), 1, 2, md, 3); if (!ghost) b.add(cx, y + 0.86, 0.05, 0.05, 0, mul(C.cyan, 2), 1, 1, 2); }
  else if (m.kind === 'pump') { A(cx, y + 0.2, 0.42, 0.36, 0, mul(C.steel, 0.7), 1, 2, md, 3); A(cx, y + 0.2, 0.2, 0.2, on ? time * 12 : 0, C.dark, 1, 1, md); A(cx + 0.2, y + 0.3, 0.16, 0.06, 0, mul(C.brass, 0.6)); if (!ghost) b.add(cx, y + 0.42, 0.05, 0.04, 0, mul(m.ready ? C.acid : C.amber, 2), 1, 0, 2); }
  else if (m.kind === 'air filter') { A(cx, y + 0.22, 0.26, 0.42, 0, mul(C.hull, 0.35), 1, 0, md, 3); for (let i = 0; i < 4; i++) A(cx, y + 0.08 + i * 0.09, 0.22, 0.02, 0, C.dark); }
  else if (m.kind === 'controller') { A(cx, y + 0.16, 0.3, 0.3, 0, mul(C.steel, 0.6), 1, 0, md, 3); if (!ghost) b.add(cx, y + 0.2, 0.16, 0.08, 0, mul(C.cyan, 1.2 + Math.sin(time * 5 + m.seed)), 1, 0, 2); }
  else if (m.kind === 'seat') { A(cx, y + 0.22, 0.34, 0.06, 0, mul(C.steel, 0.8), 1, 2, md); A(cx - 0.14, y + 0.38, 0.06, 0.34, 0, mul(C.steel, 0.7), 1, 2, md); A(cx, y + 0.1, 0.05, 0.2, 0, mul(C.steel, 0.5)); }
  else if (m.kind === 'table') { A(cx, y + 0.42, 0.5, 0.05, 0, mul(C.steel, 0.9)); A(cx, y + 0.2, 0.05, 0.4, 0, mul(C.steel, 0.6)); }
  else if (m.kind === 'bunk') { A(cx, y + 0.2, w, 0.1, 0, mul(C.steel, 0.8), 1, 0, md, 3); A(cx, y + 0.29, w - 0.08, 0.09, 0, [0.05, 0.055, 0.06], 1, 2, md); for (const d of [-1, 1]) A(cx + d * (w / 2 - 0.06), y + 0.08, 0.05, 0.16, 0, C.steel); }
  else if (m.kind === 'stairs') { for (let i = 0; i < 3; i++) A(x + 0.08 + i * 0.16, y + 0.08 + i * 0.16, 0.18, 0.05, 0, mul(C.steel, 0.9), 1, 0, md, i); A(cx, y + 0.47, w, 0.05, 0, mul(C.steel, 1.0)); }
};

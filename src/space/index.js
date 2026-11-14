// Act 2, space: real-scale system, one continuous log zoom, ships on patched conics, launch, mining, combat, hangar.
import { G, input, events, clamp, rand, TAU, angDiff } from '../core.js';
import { R, Batch } from '../render.js';
import { audio } from '../audio.js';
import { txt, line, bar, bracket, fmt, AMBER, RED, INK } from '../hud.js';
import { bodies, bodyState, patch, elFromState, stateAtNu, trueAnomaly, apo, peri, period, timeToNu, HOME, STAR, GIANT, ATMO, G0 } from './orbit.js';
import { Sp, K, mul } from './state.js';
import { PARTS, BUILDABLE, BP, CELL, makeShip, recalc, stepShip, railShip, drawShip, islands, partAt, partWorld } from './ship.js';
import { initView, updateView, orbitLine, endLines, V } from './view.js';
import { belt, updateBelt, stepBelt, drawBelt, fireLaser, genSector, spawnDrone, touch } from './belt.js';
import { stepCombat, drawShells, fireCannon, spawnHive, leadPoint, boom, SHELL_V } from './combat.js';

const WARPS = [1, 2, 4, 10, 100, 1000, 10000, 100000], st = [0, 0, 0, 0], bs = [0, 0, 0, 0], w2 = [0, 0];
let warpI = 0, lock = 0, showPred = true, autoZoom = false, mapI = 0, mapSave = 1, sel = 'hull', deadT = 0, launched = false, bd = [], foot = 0, focusI = 0;
const meAbs = out => { bodyState(Sp.me.body, Sp.t, out); out[0] += Sp.me.p[0]; out[1] += Sp.me.p[1]; return out; };

function setupOrbit() {
  const b = bodies[HOME], me = Sp.me = makeShip(BP.scout, { name: 'scout', body: HOME }); bodyState(HOME, 0, bs);
  const rp = b.R + 220e3, ra = b.R + 640e3, a = (rp + ra) / 2, th = Math.atan2(-bs[1], -bs[0]) + 1.9, vp = Math.sqrt(b.mu * (2 / rp - 1 / a));
  me.p = [Math.cos(th) * rp, Math.sin(th) * rp]; me.v = [-Math.sin(th) * vp, Math.cos(th) * vp]; me.ang = th + Math.PI / 2; Sp.ships.push(me); Sp.cam.scale = 30000;
}
function setupLaunch(mid) {
  const b = bodies[HOME], me = Sp.me = makeShip(BP.rocket, { name: 'rocket', body: HOME }); bodyState(HOME, Sp.t, bs);
  const th = Math.atan2(-bs[1], -bs[0]) - 1.63; foot = me.com[0] + 4 * CELL + 1.8;
  me.p = [Math.cos(th) * (b.R + foot), Math.sin(th) * (b.R + foot)]; me.v = [0, 0]; me.ang = th; me.hold = th; me.landed = true; Sp.ships.push(me);
  Sp.cam.scale = 0.16; autoZoom = true; launched = true; lock = 0; Sp.pilot = null; events.emit('launch'); Sp.say('z full throttle   p ascent autopilot   a/d steer   . time x2 x4');
  if (mid) { Sp.pilot = 'ascent'; for (let i = 0; i < 120 * 400 && Math.hypot(me.p[0], me.p[1]) - b.R < 40e3; i++) space.step(1 / 120); }
}
function setupBelt(scn) {
  const sec = genSector(10, 3); let a0 = sec.reduce((m, a) => a.R > m.R ? a : m, sec[0]); st[0] = 0;
  stateAtNu(a0.el, trueAnomaly(a0.el, 0), st); updateBelt(st[0], st[1], 0);
  const a = Sp.asteroids.find(q => q.id === a0.id); if (a.R < 190) { const k = 210 / a.R; for (let j = 0; j < a.r.length; j++) a.r[j] *= k; a.R = 210; } touch(a);
  const pf = a.platform = { a, j: 40, ore: 30, x: a.p[0], y: a.p[1], ang: 0 }, out = Math.atan2(a.p[1], a.p[0]) + 2.2;
  const D = Sp.depot = makeShip(BP.depot, { name: 'depot', station: true, body: STAR, ore: 4, metal: scn === 'mining' ? 9 : 0, platform: pf });
  D.p = [a.p[0] + Math.cos(out) * (a.R + 620), a.p[1] + Math.sin(out) * (a.R + 620)]; D.v = [a.v[0], a.v[1]]; D.ang = out + 1.2; D.angVel = 0.01; D.sas = false; Sp.ships.push(D); events.emit('depotBuilt');
  stepBelt(0.001); const d1 = spawnDrone(D, pf), d2 = spawnDrone(D, pf); d2.p = [(pf.x + D.p[0]) / 2 + 30, (pf.y + D.p[1]) / 2]; d2.drone.state = 'back'; d2.drone.load = 8; d1.p[0] += 40;
  const me = Sp.me = makeShip(BP.scout, { name: 'scout', body: STAR }); Sp.ships.push(me);
  if (scn === 'mining') { const q = a.ang + 0.35, r = a.r[Math.round(0.35 / TAU * 128)] + 62; me.p = [a.p[0] + Math.cos(q) * r, a.p[1] + Math.sin(q) * r]; me.v = [a.v[0], a.v[1]]; me.ang = q + Math.PI * 0.62; me.aim = q + Math.PI; Sp.cam.scale = 0.15; Sp.mineAt = a; }
  else { me.p = [D.p[0] + Math.cos(out) * 70, D.p[1] + Math.sin(out) * 70]; me.v = [D.v[0], D.v[1]]; me.ang = out; Sp.cam.scale = 0.3;
    for (const [n, q, d, sd] of [[28, out + 0.9, 430, 5], [56, out - 0.5, 560, 9]]) spawnHive(n, D.p[0] + Math.cos(q) * d, D.p[1] + Math.sin(q) * d, D.v[0] - Math.cos(q) * 20, D.v[1] - Math.sin(q) * 20, sd); }
}
function crash(s) { const off = [s.p[0], s.p[1]]; for (const p of s.parts) { partWorld(s, p, w2); boom(w2[0], w2[1], 0, 0, 1.2, false); } s.parts = []; s.m = 0; s.dead = true; if (s === Sp.me) events.emit('shipLost'); s.p = off; }
function autopilot(me, dt) {
  const b = bodies[HOME], r = Math.hypot(me.p[0], me.p[1]), alt = r - b.R, up = Math.atan2(me.p[1], me.p[0]), el = elFromState(me.p[0], me.p[1], me.v[0], me.v[1], b.mu, Sp.t), ap = apo(el) - b.R, pe = peri(el) - b.R;
  if (pe > 200e3 || me.fuel <= 0) { me.throttle = 0; lock = 0; Sp.pilot = null; me.hold = null; Sp.say(me.fuel > 0 ? 'ascent autopilot off: orbit' : 'out of fuel'); return; }
  if (ap < 232e3 && !me.coast) { me.hold = up + Math.pow(clamp((alt - 700) / 50e3, 0, 1), 0.55) * 1.5; me.throttle = 1; }
  else { me.coast = true; const ra = el.a * (1 + el.e), dv = Math.sqrt(b.mu / ra) - Math.sqrt(Math.max(0, b.mu * (2 / ra - 1 / el.a))), bt = dv * me.m / me.thrust, tAp = timeToNu(el, Sp.t, Math.PI), near = tAp < bt * 0.5 + 1 || tAp > period(el) - bt;
    me.hold = near ? up + Math.PI / 2 : Math.atan2(me.v[1], me.v[0]); me.throttle = near && Math.abs(angDiff(me.hold, me.ang)) < 0.2 ? 1 : 0; if (ap < 200e3 && alt < ATMO.top) me.coast = false; }
}
function hangarInput() {
  const me = Sp.me, k = 1 / 0.03;
  if (input.clicked[0] && input.mx < 300) { const i = Math.floor((input.my - 128) / 22); if (i >= 0 && i < BUILDABLE.length) { sel = BUILDABLE[i]; audio.play('click'); } return; }
  const gx = Math.round(((input.mx - G.w / 2) / k + me.com[0]) / CELL), gy = Math.round((-(input.my - G.h / 2) / k + me.com[1]) / CELL), at = partAt(me, gx, gy);
  if (input.clicked[0] && !at && (partAt(me, gx + 1, gy) || partAt(me, gx - 1, gy) || partAt(me, gx, gy + 1) || partAt(me, gx, gy - 1))) { me.parts.push({ type: sel, gx, gy, hp: PARTS[sel].hp, fuel: PARTS[sel].fuel || 0 }); recalc(me); audio.play('place'); }
  if (input.clicked[2] && at && at !== me.core) { const rest = me.parts.filter(p => p !== at); if (islands(rest, me.core).length === 1) { me.parts = rest; recalc(me); audio.play('click'); } else Sp.say('that part holds others on: remove them first'); }
}
export { Sp };
export const space = {
  init() { initView(R.scenes.space); belt.scene = R.scenes.space; Sp.batch = new Batch(R.scenes.space, 20000, 10); },
  start(scn, data) {
    Sp.auto = G.auto;
    if (data && data.launch) setupLaunch(false); else if (scn === 'launch') setupLaunch(true); else if (scn === 'mining' || scn === 'combat') setupBelt(scn); else { setupOrbit(); if (scn === 'builder') Sp.hangar = true; }
  },
  enter(data) { if (data && data.launch) { deadT = 0; setupLaunch(false); } },
  step(dt) {
    const me = Sp.me; Sp.msgT -= dt; Sp.flash = Math.max(0, (Sp.flash || 0) - dt * 1.5); G.shake = Math.max(0, G.shake - dt * (0.6 + G.shake * 6));
    if (input.hit('b') && me && !me.dead) { Sp.hangar = !Sp.hangar; audio.play('click'); }
    if (Sp.hangar) { hangarInput(); return; }
    if (input.wheel) { Sp.cam.scale = clamp(Sp.cam.scale * Math.exp(input.wheel * 0.0017), 0.01, 1e10); autoZoom = false; mapI = 0; }
    if (input.hit('m')) { if (mapI === 0) mapSave = Sp.cam.scale; mapI = (mapI + 1) % 3; Sp.cam.scale = mapI === 0 ? mapSave : mapI === 1 ? 1.4e6 : 1e10; autoZoom = false; }
    if (input.hit('n')) showPred = !showPred;
    if (input.hit('.')) warpI = Math.min(WARPS.length - 1, warpI + 1); if (input.hit(',')) warpI = Math.max(0, warpI - 1);
    if (input.hit('Tab')) focusI = (focusI + 1) % 3;
    const hostiles = Sp.ships.filter(s => s.org && !s.dead && !s.debris);
    if (input.hit('t')) { const i = hostiles.indexOf(Sp.target); Sp.target = hostiles.length ? hostiles[(i + 1) % hostiles.length] : Sp.depot; }
    if (Sp.target && (Sp.target.dead || !Sp.target.m)) Sp.target = null;
    if (me && !me.dead) {
      bodyState(me.body, Sp.t, bs); const mwx = Sp.cam.x + (input.mx - G.w / 2) * Sp.cam.scale - bs[0], mwy = Sp.cam.y - (input.my - G.h / 2) * Sp.cam.scale - bs[1];
      if (input.hit('p')) { Sp.pilot = Sp.pilot ? null : me.body === HOME ? 'ascent' : null; me.coast = false; if (!Sp.pilot) { me.hold = null; lock = 0; } audio.play('click'); }
      if (input.hit('z')) lock = 1; if (input.hit('x')) lock = 0;
      if (Sp.pilot) autopilot(me, dt); else { me.throttle = input.key('w') ? 1 : lock; me.cmd.rot = (input.key('a') ? 1 : 0) - (input.key('d') ? 1 : 0); if (me.cmd.rot) me.hold = null; }
      me.cmd.tx = input.key('s') ? -1 : 0; me.cmd.ty = (input.key('q') ? 1 : 0) - (input.key('e') ? 1 : 0);
      if (!(Sp.auto && hostiles.length)) me.aim = Math.atan2(mwy - me.p[1], mwx - me.p[0]);
      if (input.down[0]) fireCannon(me);
      me.lasing = false; me.beam = null; const lz = me.parts.find(p => p.type === 'laser');
      if (lz && (input.down[2] || (Sp.auto && Sp.mineAt))) { if (Sp.auto && Sp.mineAt) me.aim = Math.atan2(Sp.mineAt.p[1] - me.p[1], Sp.mineAt.p[0] - me.p[0]) + Math.sin(Sp.t * 0.5) * 0.12; partWorld(me, lz, w2); fireLaser(me, w2[0] + Math.cos(me.aim), w2[1] + Math.sin(me.aim), me.aim, dt); }
      if (me.throttle > 0 || hostiles.some(h => Math.hypot(h.p[0] - me.p[0], h.p[1] - me.p[1]) < 5000) || Sp.shells.length) warpI = Math.min(warpI, 2);
      audio.loop('engine', me.throttle > 0 && me.fuel > 0 ? 0.3 : 0, 90); audio.loop('rcs', me.rcsOn ? 0.05 : 0);
    } else if (me && me.dead) { deadT += dt; if (deadT > 4) { deadT = -1e9; G.switchAct('surface', { died: true }); } return; }
    const warp = Sp.warp = WARPS[warpI], sub = warp <= 4 ? warp : 1, dtw = warp <= 4 ? dt : dt * warp;
    for (let k = 0; k < sub; k++) {
      Sp.t += dtw;
      for (const s of Sp.ships) {
        if (!s.m) continue;
        if (warp > 4) railShip(s, dtw, Sp.t); else stepShip(s, dtw, Sp.t);
        patch(s, Sp.t);
        const b = bodies[s.body], r = Math.hypot(s.p[0], s.p[1]), ft = s === me ? foot || s.rad : 2;
        if (r < b.R + ft) {                                   // ground: rest, lift off, or break
          const nx = s.p[0] / r, ny = s.p[1] / r, vn = s.v[0] * nx + s.v[1] * ny, sp = Math.hypot(s.v[0], s.v[1]);
          if (sp > 14 || s.debris) { if (s.debris) { s.m = 0; s.dead = true; } else crash(s); }
          else { s.p[0] = nx * (b.R + ft); s.p[1] = ny * (b.R + ft); const lift = Math.max(0, vn); s.v[0] = nx * lift; s.v[1] = ny * lift; s.angVel = 0; s.landed = lift === 0; }
        } else s.landed = false;
      }
      if (warp <= 4) { if (me && me.body === STAR) { updateBelt(me.p[0], me.p[1], Sp.t); stepBelt(dtw); } stepCombat(dtw); }
      if (me && me.m) { const r = Math.hypot(me.p[0], me.p[1]), g = -bodies[me.body].mu / (r * r * r); Sp.parts.step(dtw, g * me.p[0], g * me.p[1]); } else Sp.parts.step(dtw, 0, 0);
    }
    if (me && me.m) {     // exhaust: sparks in vacuum, a lit trail in air
      if (me.throttle > 0 && me.fuel > 0) { const c = Math.cos(me.ang), s = Math.sin(me.ang), eng = me.parts.find(p => p.type === 'ltr' || p.type === 'engine'); partWorld(me, eng, w2); const air = me.body === HOME && Math.hypot(me.p[0], me.p[1]) - bodies[HOME].R < 55e3;
        for (let i = 0; i < 2; i++) Sp.parts.spawn({ x: w2[0] - c * 2, y: w2[1] - s * 2, vx: me.v[0] - c * rand(60, 160) + rand(-9, 9), vy: me.v[1] - s * rand(60, 160) + rand(-9, 9), life: rand(0.15, 0.5), size: rand(0.5, 1.4), c: [2, 2.6, 4], c2: [0.6, 0.2, 0.05], grav: 0 });
        if (air && Math.random() < 0.5) Sp.parts.spawn({ x: w2[0] - c * 6, y: w2[1] - s * 6, vx: me.v[0] * 0.02 + rand(-4, 4), vy: me.v[1] * 0.02 + rand(-4, 4), life: rand(25, 45), size: rand(8, 16), grow: 14, c: [0.5, 0.42, 0.36], c2: [0.05, 0.05, 0.06], a: 0.5, grav: 0, drag: 0.5, trail: 1 }); }
      if (launched && me.body === HOME && !me.orbitSaid) { const el = elFromState(me.p[0], me.p[1], me.v[0], me.v[1], bodies[HOME].mu, Sp.t); if (el.e < 1 && peri(el) - bodies[HOME].R > ATMO.top) { me.orbitSaid = true; events.emit('orbit'); } }
      if (autoZoom && me.body === HOME) { const alt = Math.hypot(me.p[0], me.p[1]) - bodies[HOME].R; Sp.cam.scale += (clamp(alt / 420, 0.16, 3000) - Sp.cam.scale) * Math.min(1, dt * 1.5); }
    }
  },
  draw(time) {
    const me = Sp.me, cam = Sp.cam, b = Sp.batch, D = Sp.depot;
    if (Sp.hangar) { updateView(1e15, 1e15, 1e6, Sp.t, time, 0.5); endLines(); for (const a of Sp.asteroids) if (a.mesh) a.mesh.visible = false; b.begin(0, 0, 1 / 0.03); b.u.uSun.value.set(0.5, 0.86); const sa = me.ang, th = me.throttle; me.ang = 0; me.throttle = 0; drawShip(b, me, me.p[0], me.p[1], time); me.ang = sa; me.throttle = th; b.ox = me.p[0]; b.oy = me.p[1];
      // drawShip used absolute coordinates; shift the origin so the centre of mass sits mid-screen
      for (let i = 0; i < b.n; i++) { b.A[i * 4] -= me.p[0] * b.k; b.A[i * 4 + 1] -= me.p[1] * b.k; } b.end(); return 0; }
    const f = focusI === 1 && Sp.target ? Sp.target : focusI === 2 && D ? D : me; bodyState(f.body, Sp.t, bs); const sh = G.shake * cam.scale * 30;
    cam.x = bs[0] + f.p[0] + (Math.random() - 0.5) * sh; cam.y = bs[1] + f.p[1] + (Math.random() - 0.5) * sh;
    const cx = cam.x, cy = cam.y, sc = cam.scale; bd = updateView(cx, cy, sc, Sp.t, time, 1);
    const sl = Math.hypot(cx, cy) || 1, sun = [-cx / sl, -cy / sl]; b.u.uSun.value.set(sun[0], sun[1]);
    V.lineN = 0;
    for (const o of bodies) if (o.parent >= 0) { const big = bodies[o.parent].kind === 'star', al = big ? clamp((Math.log10(sc) - 4.6) / 1.5, 0, 1) : clamp((Math.log10(sc) - 3.6) / 1.2, 0, 1) * clamp((9 - Math.log10(sc)) / 1.5, 0, 1); if (al > 0.01) { const pp = bd[o.parent]; orbitLine(o.el, pp[3], pp[4], cx, cy, sc, trueAnomaly(o.el, Sp.t), o.id === HOME ? [0.1, 0.5, 0.45] : [0.2, 0.26, 0.32], al * 0.8); } }
    Sp.mark = null;
    if (me && me.m && showPred && !me.landed) for (const s of [me, Sp.target && !Sp.target.debris && sc > 50 ? Sp.target : null]) if (s && s.m) {
      const pb = bd[s.body], bo = bodies[s.body], el = elFromState(s.p[0], s.p[1], s.v[0], s.v[1], bo.mu, Sp.t), nu = trueAnomaly(el, Sp.t), pp = el.a * (1 - el.e * el.e); let nuMax = Math.PI, exit = false;
      if (bo.parent >= 0 && (el.e >= 1 || apo(el) > bo.soi)) { nuMax = Math.acos(clamp((pp / bo.soi - 1) / el.e, -1, 1)); exit = true; }
      orbitLine(el, pb[3], pb[4], cx, cy, sc, clamp(nu, -nuMax, nuMax), s === me ? [1.0, 0.5, 0.12] : [0.3, 0.9, 0.2], s === me ? (sc < 20 ? 0.3 : 0.9) : 0.5, nuMax);
      if (s === me) { Sp.mark = { el, ox: pb[3], oy: pb[4], exit: exit ? nuMax : null, R: bo.R };
        if (exit) { stateAtNu(el, nuMax, st); const par = bodies[bo.parent], q = bodyState(s.body, Sp.t, [0, 0, 0, 0]), pq = bd[bo.parent]; const e2 = elFromState(q[0] - pq[3] + st[0], q[1] - pq[4] + st[1], st[2] + (q[2] - bodyState(bo.parent, Sp.t, [0, 0, 0, 0])[2]), st[3] + (q[3] - bodyState(bo.parent, Sp.t, [0, 0, 0, 0])[3]), par.mu, Sp.t); orbitLine(e2, pq[3], pq[4], cx, cy, sc, trueAnomaly(e2, Sp.t), [0.6, 0.25, 0.9], 0.6, e2.e < 1 ? Math.PI : 2); } }
    }
    endLines();
    b.begin(cx, cy, 1 / sc);
    bd.forEach((p, i) => { if (p[2] < 1.5) { const s = bodies[i].kind === 'star' ? 9 : 3.5, c = bodies[i].kind === 'star' ? mul(K.warm, 3) : mul(bodies[i].col, 6); b.px(p[0], p[1], s, s, 0, c, 1, 1, 2); b.px(p[0], p[1], s * 4, s * 4, 0, c, 0.25, 1, 2); } });
    drawBelt(b, cx, cy, sc, time, sun);
    const fb = me ? bodyState(me.body, Sp.t, [0, 0, 0, 0]) : [0, 0, 0, 0];
    b.ox = cx - fb[0]; b.oy = cy - fb[1];
    for (const p of Sp.parts.list) if (p.trail) p.mode = 2;
    if (me && me.beam) { const x1 = me.beam[0] + me.p[0], y1 = me.beam[1] + me.p[1], x2 = me.beam[2] + me.p[0], y2 = me.beam[3] + me.p[1], fl = 0.8 + 0.2 * Math.sin(time * 50); b.seg(x1, y1, x2, y2, Math.max(0.5, 2.2 * sc), [0.5 * fl, 3.2 * fl, 3.8 * fl], 1, 2, 2); b.seg(x1, y1, x2, y2, Math.max(2, 7 * sc), [0.05, 0.5, 0.6], 0.5, 2, 2); b.add(x2, y2, 16, 16, 0, [3, 2.2, 1.2], fl, 1, 2); b.add(x2, y2, 60, 60, 0, [1.4, 0.5, 0.1], 0.35, 1, 2); }
    for (const s of Sp.ships) { if (!s.m) continue; let ox = 0, oy = 0; if (s.body !== (me ? me.body : 0)) { bodyState(s.body, Sp.t, st); ox = st[0] - fb[0]; oy = st[1] - fb[1]; } if (s.vis !== undefined && s.ext) { const t0 = s.throttle; s.throttle = s.vis > 0.12 ? s.vis : 0; drawShip(b, s, s.p[0] + ox, s.p[1] + oy, time); s.throttle = t0; } else drawShip(b, s, s.p[0] + ox, s.p[1] + oy, time); }
    drawShells(b, me ? me.v[0] : 0, me ? me.v[1] : 0, time); Sp.parts.draw(b, 1.3);
    b.end(); G.exposure += (1 - G.exposure) * 0.1;
    return Sp.flash || 0;
  },
  hud(c) {
    const me = Sp.me, w = G.w, h = G.h, sc = Sp.cam.scale, cx = Sp.cam.x, cy = Sp.cam.y, X = x => w / 2 + x, Y = y => h / 2 - y;
    if (Sp.msgT > 0) txt(c, Sp.msg, w / 2, 84, { align: 'center', col: AMBER, a: Math.min(0.85, Sp.msgT) });
    if (Sp.hangar) { hangarHud(c); return; }
    bd.forEach((p, i) => { if (Math.abs(p[0]) < w / 2 && Math.abs(p[1]) < h / 2 && (p[2] > 4 || sc > 3e4) && (bodies[bodies[i].parent >= 0 ? bodies[i].parent : 0].kind === 'star' || sc < 3e8 || i === 0)) txt(c, bodies[i].name, X(p[0]) + Math.min(p[2], 300) * 0.72 + 8, Y(p[1]) - Math.min(p[2], 300) * 0.72 - 6, { a: 0.45 }); });
    txt(c, `T+ ${fmt.t(Sp.t)}`, w / 2, 24, { align: 'center' }); txt(c, `warp x${Sp.warp}`, w / 2, 40, { align: 'center', col: Sp.warp > 1 ? AMBER : INK, a: Sp.warp > 1 ? 0.9 : 0.4 });
    // scale bar
    const e = Math.pow(10, Math.floor(Math.log10(sc * 160))), bw = e / sc; line(c, w - 28 - bw, h - 30, w - 28, h - 30, 0.6); line(c, w - 28 - bw, h - 34, w - 28 - bw, h - 26, 0.6); line(c, w - 28, h - 34, w - 28, h - 26, 0.6); txt(c, fmt.m(e), w - 28, h - 40, { align: 'right' }); txt(c, `${sc < 10 ? sc.toFixed(2) : sc.toExponential(1)} m/px`, w - 28, h - 12, { align: 'right', a: 0.35 });
    if (!me) return;
    if (me.dead) { txt(c, 'ship lost. the wreck stays yours.', w / 2, h / 2, { align: 'center', size: 14, col: RED, a: 0.9 }); return; }
    const bo = bodies[me.body], r = Math.hypot(me.p[0], me.p[1]), sp = Math.hypot(me.v[0], me.v[1]), el = elFromState(me.p[0], me.p[1], me.v[0], me.v[1], bo.mu, Sp.t);
    const rows = [['ref', bo.name], ['alt', fmt.m(r - bo.R)], ['vel', fmt.v(sp)], ['ap', el.e < 1 ? fmt.m(apo(el) - bo.R) : 'escape'], ['pe', fmt.m(peri(el) - bo.R)], ['period', el.e < 1 ? fmt.t(period(el)) : '-'], ['ecc', el.e.toFixed(4)], ['', ''],
      ['mass', (me.m / 1000).toFixed(2) + ' t'], ['dv left', fmt.v(me.dv)], ['thrust', (me.thrust * me.throttle / 1000).toFixed(0) + ' kN'], ['accel', (me.acc || 0).toFixed(2) + ' m/s2'], ['spin', (me.angVel * 57.3).toFixed(1) + ' deg/s'], ['cargo', `${me.ore | 0}/${me.cargoCap} ore`]];
    rows.forEach(([k, v], i) => { txt(c, k, 28, 96 + i * 15, { a: 0.35 }); txt(c, v, 96, 96 + i * 15, { a: 0.7 }); });
    bar(c, 28, h - 58, 150, me.fuelCap ? me.fuel / me.fuelCap : 0, `fuel ${me.fuel.toFixed(2)} t`, AMBER); bar(c, 28, h - 34, 150, me.throttle, `throttle ${Math.round(me.throttle * 100)}%${Sp.pilot ? '  autopilot: ' + Sp.pilot : ''}`);
    if (me.q > 500) txt(c, `drag ${(me.q / 1000).toFixed(0)} kN`, 28, h - 84, { col: AMBER, a: 0.8 });
    const mx = X((bs[0] + me.p[0] - cx) / sc), my = Y((bs[1] + me.p[1] - cy) / sc); if (me.rad / sc < 9) bracket(c, mx, my, 9, INK, 0.7);
    // Ap, Pe and SOI exit markers on the predicted conic
    const M = Sp.mark; if (M) { const mk = (nu, lab, val) => { stateAtNu(M.el, nu, st); const x = X((M.ox + st[0] - cx) / sc), y = Y((M.oy + st[1] - cy) / sc); if (x < 0 || y < 0 || x > w || y > h) return; c.strokeStyle = `rgba(${AMBER},0.9)`; c.lineWidth = 1; c.beginPath(); c.moveTo(x, y - 5.5); c.lineTo(x + 5.5, y); c.lineTo(x, y + 5.5); c.lineTo(x - 5.5, y); c.closePath(); c.stroke(); txt(c, `${lab} ${val}`, x + 10, y + 3, { col: AMBER, a: 0.85 }); };
      mk(0, 'pe', fmt.m(peri(M.el) - M.R)); if (M.el.e < 1 && M.exit === null) mk(Math.PI, 'ap', fmt.m(apo(M.el) - M.R)); if (M.exit !== null) mk(M.exit, 'soi exit', ''); }
    // ships: brackets, ownership, target data and the lead point
    let fy = 96; txt(c, 'fleet (owner ' + G.playerId + ')', w - 28, 78, { align: 'right', a: 0.35 });
    for (const s of Sp.ships) {
      if (!s.m) continue; bodyState(s.body, Sp.t, st); const x = X((st[0] + s.p[0] - cx) / sc), y = Y((st[1] + s.p[1] - cy) / sc), on = x > 0 && y > 0 && x < w && y < h, d = Math.hypot(s.p[0] - me.p[0], s.p[1] - me.p[1]);
      if (s.owner === G.playerId && !s.debris && fy < 260) { txt(c, `${s.name}${s.drone ? ' ' + s.id + ' ' + s.drone.state + ' ' + (s.drone.load | 0) : s.station ? ` ore ${s.ore.toFixed(0)} metal ${s.metal.toFixed(0)}` : ''}  ${s === me ? '' : fmt.m(d)}`, w - 28, fy, { align: 'right', a: 0.6 }); fy += 15; }
      if (s.drone && on && s.drone.tx !== undefined && sc > 0.6) { c.setLineDash([2, 5]); line(c, x, y, X((s.drone.tx - cx) / sc), Y((s.drone.ty - cy) / sc), 0.3); c.setLineDash([]); }
      if (!on || s === me) continue;
      if (s.org && !s.debris) { const rr = Math.max(10, s.rad / sc + 4); bracket(c, x, y, rr, s === Sp.target ? RED : AMBER, s === Sp.target ? 0.9 : 0.5);
        if (s === Sp.target) { txt(c, `hive  ${fmt.m(d)}  ${fmt.v(Math.hypot(s.v[0] - me.v[0], s.v[1] - me.v[1]))}`, x + rr + 8, y + 3, { col: RED, a: 0.8 }); const lp = leadPoint(me, s, SHELL_V); if (lp) { const lx = X((st[0] + lp[0] - cx) / sc), ly = Y((st[1] + lp[1] - cy) / sc); c.strokeStyle = `rgba(${RED},0.9)`; c.beginPath(); c.arc(lx, ly, 5, 0, TAU); c.stroke(); line(c, lx - 9, ly, lx - 5, ly, 0.9, RED); line(c, lx + 5, ly, lx + 9, ly, 0.9, RED); txt(c, `lead ${lp[2].toFixed(1)} s`, lx + 12, ly + 18, { col: RED, a: 0.7 }); } } }
      else if (s.rad / sc < 9 && !s.debris) { bracket(c, x, y, 8, INK, 0.45); if (s.station) txt(c, 'depot', x + 13, y + 3, { a: 0.5 }); }
    }
    txt(c, 'w thrust  z/x lock/cut  a/d rotate  q/e strafe  s retro  lmb cannon  rmb laser  wheel zoom  m map  , . warp  t target  tab focus  b hangar  p autopilot', w / 2, h - 14, { align: 'center', a: 0.28 });
    const ax = input.mx, ay = input.my; line(c, ax - 9, ay, ax - 3, ay, 0.7); line(c, ax + 3, ay, ax + 9, ay, 0.7); line(c, ax, ay - 9, ax, ay - 3, 0.7); line(c, ax, ay + 3, ax, ay + 9, 0.7);
  },
};
function hangarHud(c) {
  const me = Sp.me, w = G.w, h = G.h, k = 1 / 0.03, cs = CELL * k, X = lx => w / 2 + (lx - me.com[0]) * k, Y = ly => h / 2 - (ly - me.com[1]) * k;
  txt(c, 'hangar', 28, 78, { size: 12, a: 0.8 }); txt(c, 'lmb place   rmb remove   b close', 28, 96, { a: 0.4 });
  BUILDABLE.forEach((t, i) => txt(c, `${t === sel ? '> ' : '  '}${PARTS[t].label}  ${PARTS[t].m + (PARTS[t].fuel || 0)} t`, 28, 142 + i * 22, t === sel ? { col: AMBER, a: 0.95 } : { a: 0.55 }));
  for (let i = -7; i <= 6; i++) { line(c, X((i + 0.5) * CELL), Y(-6.5 * CELL), X((i + 0.5) * CELL), Y(6.5 * CELL), 0.07); line(c, X(-6.5 * CELL), Y((i + 0.5) * CELL), X(6.5 * CELL), Y((i + 0.5) * CELL), 0.07); }
  const gx = Math.round(((input.mx - w / 2) / k + me.com[0]) / CELL), gy = Math.round((-(input.my - h / 2) / k + me.com[1]) / CELL); if (input.mx > 300) { c.strokeStyle = `rgba(${AMBER},0.6)`; c.strokeRect(Math.round(X(gx * CELL) - cs / 2) + 0.5, Math.round(Y(gy * CELL) - cs / 2) + 0.5, cs, cs); }
  // centre of mass, thrust lines and what they do to the ship
  c.strokeStyle = `rgba(${AMBER},0.9)`; c.beginPath(); c.arc(w / 2, h / 2, 7, 0, TAU); c.stroke(); line(c, w / 2 - 12, h / 2, w / 2 + 12, h / 2, 0.9, AMBER); line(c, w / 2, h / 2 - 12, w / 2, h / 2 + 12, 0.9, AMBER); txt(c, 'com', w / 2 + 12, h / 2 - 10, { col: AMBER, a: 0.8 });
  let rcsT = 0; for (const p of me.parts) { const d = PARTS[p.type]; if (d.thrust && p.type !== 'rcs') { const y = Y(p.gy * CELL), x = X(p.gx * CELL - 1); line(c, x, y, x - 30 - d.thrust / 6000, y, 0.8, AMBER); txt(c, `${(d.thrust / 1000).toFixed(0)} kN  arm ${(p.gy * CELL - me.com[1]).toFixed(2)} m  torque ${(-(p.gy * CELL - me.com[1]) * d.thrust / 1000).toFixed(1)} kNm`, x - 36 - d.thrust / 6000, y + 3, { align: 'right', a: 0.6 }); }
    if (p.type === 'rcs') rcsT += (Math.abs(p.gx * CELL - me.com[0]) + Math.abs(p.gy * CELL - me.com[1])) * d.thrust; }
  const dry = me.m - me.fuel * 1000, bal = Math.abs(me.imb) > me.thrust * 0.02 && me.thrust > 0;
  const rows = [['parts', me.parts.length], ['mass', (me.m / 1000).toFixed(2) + ' t  (dry ' + (dry / 1000).toFixed(2) + ' t)'], ['centre of mass', `${me.com[0].toFixed(2)}, ${me.com[1].toFixed(2)} m`], ['moment of inertia', (me.I / 1000).toFixed(1) + ' t m2'],
    ['main thrust', (me.thrust / 1000).toFixed(0) + ' kN'], ['acceleration', (me.thrust / me.m).toFixed(2) + ' m/s2'], ['engine imbalance', (me.imb / 1000).toFixed(1) + ' kNm' + (bal ? '  spins under thrust' : '')], ['spin-up at full thrust', (me.imb / me.I * 57.3).toFixed(2) + ' deg/s2'],
    ['delta-v', fmt.v(me.dv) + '  = Isp g0 ln(m0/m1)'], ['isp', me.isp.toFixed(0) + ' s'], ['burn time', me.mdot ? (me.fuel * 1000 / me.mdot).toFixed(0) + ' s' : '-'], ['rcs torque', (rcsT / 1000).toFixed(1) + ' kNm'], ['wheel torque', (me.wheel / 1000).toFixed(0) + ' kNm'], ['cargo', me.cargoCap + ' ore']];
  rows.forEach(([a, v], i) => { txt(c, a, w - 470, 142 + i * 20, { a: 0.4 }); txt(c, v, w - 290, 142 + i * 20, { a: 0.75, col: i === 6 && bal ? AMBER : INK }); });
}

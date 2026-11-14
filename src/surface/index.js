// Act 1, the surface: wires world, light, player, creatures and factory into one act.
import { G, input, events, lerp } from '../core.js';
import { R, Batch } from '../render.js';
import { audio } from '../audio.js';
import { txt, line, bar, AMBER, RED, INK } from '../hud.js';
import { world, TS, GRAV } from './world.js';
import { light, initLight, computeLight, LW, LH } from './light.js';
import { initTiles, updateTiles } from './tiles.js';
import { S, C, mul } from './state.js';
import { P, SLOTS, spawnAt, stepPlayer, stepBullets, drawPlayer, hurt } from './player.js';
import { creatures, stepCreatures, drawCreatures, spawnCreature } from './creatures.js';
import { F, DEFS, BUILD, ROCKET_PARTS, canPlace, interact, stepFactory, drawFactory, buildScenario } from './factory.js';

let wreck = false, near = null;
export const surface = {
  init() {
    initLight(); initTiles(R.scenes.surface); S.batch = new Batch(R.scenes.surface, 12000, 10); S.batch.u.uLight.value = light.lightTex; S.P = P; S.hurt = hurt;
  },
  start(scenario) {
    input.mx = G.w / 2 + 260; input.my = G.h / 2 + 46;
    if (scenario === 'factory') { S.calm = 150; buildScenario(); spawnAt(-12); spawnCreature('grazer', 9, 1.2); }
    else { spawnAt(0); wreck = true; Object.assign(S.inv, { basalt: 8, iron: 3 }); spawnCreature('stalker', 13, 1.2).state = 'stalk'; spawnCreature('jelly', -9, 4.5); }
    S.cam.x = P.x; S.cam.y = P.y + 2.2; events.emit('landed');
  },
  enter(d) { if (d && d.died) { P.hp = 0; P.dead = 0.01; events.emit('died'); } },
  step(dt) {
    light.emitters.length = 0;
    S.ppm = G.h / 15; S.mouse.x = S.cam.x + (input.mx - G.w / 2) / S.ppm; S.mouse.y = S.cam.y - (input.my - G.h / 2) / S.ppm;
    stepPlayer(dt); stepBullets(dt); stepCreatures(dt); stepFactory(dt);
    S.parts.step(dt, 0, -GRAV, (x, y) => world.solidAt(x, y));
    for (let i = S.lights.length - 1; i >= 0; i--) if ((S.lights[i].t -= dt) <= 0) S.lights.splice(i, 1);
    const k = Math.min(1, dt * 5); S.cam.x = lerp(S.cam.x, P.x + (input.mx - G.w / 2) / S.ppm * 0.22, k); S.cam.y = lerp(S.cam.y, P.y + 1.6 + (G.h / 2 - input.my) / S.ppm * 0.22, k);
    if (input.hit('e') && !P.dead && interact() === 'board') { F.pad.n = 0; G.switchAct('space', { launch: true }); }
    G.shake = Math.max(0, G.shake - dt * (0.6 + G.shake * 6));
  },
  draw(time) {
    const b = S.batch, sh = G.shake * 0.5, cx = S.cam.x + (Math.random() - 0.5) * sh, cy = S.cam.y + (Math.random() - 0.5) * sh, ppm = S.ppm;
    b.begin(cx, cy, ppm);
    if (wreck) drawWreck(b, time);
    drawFactory(b, time); drawCreatures(b, time); drawPlayer(b, time); S.parts.draw(b, 1.2);
    for (const l of S.lights) light.emit(l.x, l.y, l.c[0], l.c[1], l.c[2]);
    b.end();
    computeLight(cx / TS, cy / TS, time); updateTiles(cx / TS, cy / TS, ppm * TS, time, S.crack);
    b.u.uLR.value.set((light.ox * TS - cx) * ppm, (light.oy * TS - cy) * ppm, 1 / (LW * TS * ppm), 1 / (LH * TS * ppm));
    audio.loop('wind', 0.1 + 0.05 * Math.sin(time * 0.3), 260 + 120 * Math.sin(time * 0.17));
    return S.flash;
  },
  hud(c) {
    const w = G.w, h = G.h, item = SLOTS[P.slot];
    bar(c, 28, h - 58, 150, P.hp / 100, 'body ' + Math.max(0, P.hp | 0), P.hp < 35 ? RED : INK); bar(c, 28, h - 34, 150, P.fuel / 11, 'jet ' + P.fuel.toFixed(1) + ' s', AMBER);
    let x = w / 2 - 250;
    SLOTS.forEach((s, i) => { const lab = `${i + 1} ${s === 'build' ? 'build: ' + BUILD[P.build] : s}${s === 'rifle' || s === 'shotgun' ? ' ' + (P.reload > 0 && item === s ? '--' : P.mag[s]) : ''}`; txt(c, lab, x, h - 28, i === P.slot ? { col: AMBER, a: 0.9 } : {}); x += lab.length * 7.4 + 26; });
    if (item === 'build') { const d = DEFS[BUILD[P.build]]; txt(c, 'cost ' + Object.entries(d.cost).map(([k, n]) => `${k} ${n}`).join('  ') + '   b next   rmb place', w / 2 - 250, h - 44, { a: S.has(d.cost) ? 0.6 : 0.35 });
      const tx = Math.floor(S.mouse.x / TS), ty = Math.floor(S.mouse.y / TS), ok = canPlace(BUILD[P.build], tx, ty) && S.has(d.cost), px = (tx * TS - S.cam.x) * S.ppm + w / 2, py = h / 2 - ((ty + (d.h || 1)) * TS - S.cam.y) * S.ppm;
      c.strokeStyle = `rgba(${ok ? AMBER : RED},0.6)`; c.lineWidth = 1; c.strokeRect(Math.round(px) + 0.5, Math.round(py) + 0.5, (d.w || 1) * TS * S.ppm, (d.h || 1) * TS * S.ppm); }
    Object.entries(S.inv).forEach(([k, n], i) => txt(c, `${k} ${n}`, w - 28, 96 + i * 15, { align: 'right' }));
    txt(c, 'inventory', w - 28, 78, { align: 'right', a: 0.35 });
    // altitude tape and compass strip
    const alt = P.y; line(c, 28, h / 2 - 90, 28, h / 2 + 90, 0.25);
    for (let i = -4; i <= 4; i++) { const v = Math.round(alt / 5) * 5 + i * 5, yy = h / 2 - (v - alt) * 4; if (Math.abs(yy - h / 2) < 90) { line(c, 28, yy, 34, yy, 0.3); txt(c, v, 40, yy + 3, { a: 0.35 }); } }
    txt(c, `alt ${alt.toFixed(1)} m`, 46, h / 2 - 100); line(c, 22, h / 2, 34, h / 2, 0.8, AMBER);
    line(c, w / 2 - 160, 30, w / 2 + 160, 30, 0.25);
    for (let i = -8; i <= 8; i++) { const v = Math.round(P.x / 10) * 10 + i * 10, xx = w / 2 + (v - P.x) * 2; if (Math.abs(xx - w / 2) < 160) { line(c, xx, 30, xx, v % 50 === 0 ? 38 : 34, 0.3); if (v % 50 === 0) txt(c, v, xx, 50, { align: 'center', a: 0.35 }); } }
    line(c, w / 2, 24, w / 2, 36, 0.8, AMBER); txt(c, `x ${P.x.toFixed(0)} m   v ${Math.hypot(P.vx, P.vy).toFixed(1)} m/s   g ${GRAV} m/s2   night`, w / 2, 20, { align: 'center', a: 0.45 });
    if (F.pad) txt(c, F.pad.n >= ROCKET_PARTS ? 'rocket ready: e at the pad to board' : `rocket ${F.pad.n}/${ROCKET_PARTS} parts`, w - 28, h - 28, { align: 'right', col: AMBER, a: 0.8 });
    txt(c, F.printer ? 'bio-printer online: body respawns there' : 'no bio-printer: death restarts at the crash site', w - 28, h - 44, { align: 'right', a: 0.4 });
    if (P.dead > 0) txt(c, 'signal lost', w / 2, h / 2, { align: 'center', size: 14, col: RED, a: 0.9 });
    if (item !== 'build') { const mx = input.mx, my = input.my; line(c, mx - 9, my, mx - 3, my, 0.7); line(c, mx + 3, my, mx + 9, my, 0.7); line(c, mx, my - 9, mx, my - 3, 0.7); line(c, mx, my + 3, mx, my + 9, 0.7); }
  },
};
function drawWreck(b, time) {            // the transport that brought the prisoners down
  const x = -9, y = 0.5, fl = Math.sin(time * 23) * Math.sin(time * 3.1) > 0.2 ? 1 : 0.15;
  b.add(x, y + 0.9, 5.2, 1.9, -0.14, mul(C.hull, 0.5), 1, 0, 1, 3); b.add(x - 1.2, y + 1.7, 2.4, 1.0, -0.2, mul(C.hull, 0.4), 1, 0, 1, 4); b.add(x + 2.9, y + 0.35, 1.5, 0.8, 0.5, mul(C.steel, 0.5), 1, 0, 1, 5);
  b.add(x + 1.2, y + 0.9, 1.0, 0.5, -0.14, [0.01, 0.012, 0.016], 1, 0, 1); b.seg(x - 2.6, y + 1.9, x - 3.6, y + 3.4, 0.07, C.steel, 1, 0, 1);
  b.add(x - 3.6, y + 3.4, 0.1, 0.1, 0, mul(C.amber, 4 * fl), 1, 1, 2); b.add(x - 3.6, y + 3.4, 1.2, 1.2, 0, mul(C.amber, 0.3 * fl), 1, 1, 2); light.emit((x - 3.6) / TS, (y + 3.4) / TS, 0.9 * fl, 0.42 * fl, 0.08 * fl);
}

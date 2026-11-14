// Act 1, the surface: wires the density world, light, flora, player, creatures, factory, blueprints, robots, sites
// and the hivemind into one act, draws the HUD, and registers the act with the save module.
import { G, input, events, lerp, clamp, rand } from '../core.js';
import { R, Batch } from '../render.js';
import { audio } from '../audio.js';
import { txt, line, bar, bracket, AMBER, RED, INK } from '../hud.js';
import { drawIcon } from '../icons.js';
import { inv, fmtAmt, ITEMS } from '../items.js';
import { save } from '../save.js';
import { ui } from '../ui.js';
import { STORY } from '../story.js';
import { world, TS, GRAV, M, surfaceH } from './world.js';
import { biome } from './gen.js';
import { light, initLight, computeLight, LW, LH } from './light.js';
import { initTerrain, updateTerrain, stepHeat, view } from './terrain.js';
import { S, C, mul } from './state.js';
import { env } from './env.js';
import { P, SUIT, WEAPON, spawnAt, stepPlayer, stepBullets, drawPlayer, hurt } from './player.js';
import { creatures, stepCreatures, drawCreatures, spawnCreature, KIND } from './creatures.js';
import { F, ROCKET_PARTS, nearest, stepFactory, drawFactory, buildScenario, place, dumpFactory, loadFactory } from './factory.js';
import { BP, BUILD, stepBlueprint, drawBlueprint, addGhost, dumpBP, loadBP } from './blueprint.js';
import { robots, stepRobots, drawRobots, spawnRobot, dumpRobots, loadRobots, ROBOT } from './robots.js';
import { flora, stepFlora, drawFlora, resetFlora } from './flora.js';
import { sites, stepSites, drawSites, siteUse, siteDamage, dumpSites, loadSites } from './sites.js';
import { hive, stepHive, dumpHive, loadHive, sendWave } from './hive.js';
import { structsIn, slotStruct, resetStructs } from './structures.js';

let near = null, auto = null, horizon = 0;
const BIOME = ['fungal forest', 'violet thicket', 'acid marsh'];
flora.gains = (id, n) => S.gain(id, n);
function kit() { for (const [k, n] of [['laser drill', 1], ['rifle', 1], ['shotgun', 1], ['rifle rounds', 120], ['shells', 18], ['iron', 24], ['copper', 6], ['basalt', 30], ['o2 cell', 1], ['power cell', 1]]) S.add(k, n); }
const flatten = (x0, x1) => { world.box(x0, 0, x1, 14, -1); world.box(x0, -1.5, x1, 0, 1, M.BASALT); };
export const surface = {
  init() {
    initLight(); initTerrain(R.scenes.surface); S.batch = new Batch(R.scenes.surface, 40000, 10); S.batch.u.uLight.value = light.lightTex; S.P = P; S.hurt = hurt; ui.init();
    save.register('surface', { dump: dumpSurface, load: loadSurface });
  },
  start(scenario) {
    input.mx = G.w / 2 + 260; input.my = G.h / 2 + 46; S.crash = true; kit();
    if (scenario === 'factory') { S.calm = 150; S.crash = false; hive.quiet = true; flora.clear = [-14, 10]; buildScenario(); spawnAt(-6); S.add('part', 6); S.add('biomass', 12); spawnCreature('grazer', 9, 1.2); }
    else if (scenario === 'blueprint') {     // a hub, three drones, a chest of kits, and a queue for them
      S.crash = false; hive.quiet = true; flora.clear = [-18, 18]; flatten(-16, 16); spawnAt(3); const hub = place('hub', -1, 0, 1, true), ch = place('chest', -6, 0, 1, true);
      for (const [k, n] of [['furnace', 1], ['assembler', 1], ['miner', 1], ['belt', 12], ['iron', 150], ['chest', 1]]) inv.add(ch.inv, k, n);
      for (let i = 0; i < 3; i++) spawnRobot(hub);
      addGhost('miner', 8, 0); for (let x = 10; x <= 13; x++) addGhost('belt', x, 0); addGhost('furnace', 14, 0); for (let x = 16; x <= 19; x++) addGhost('belt', x, 0); addGhost('assembler', 20, 0);
      for (let j = 0; j < 4; j++) addGhost('wall', 25, j); for (let i = 26; i < 29; i++) addGhost('wall', i, 3);
      world.box(-13, 0, -9, 2.5, 1, M.BASALT); BP.clears.push({ id: BP.nextId++, x0: -13, y0: 0, x1: -9, y1: 2.5, claim: null, cur: 0 });
      S.mode = 'blueprint'; BP.sel = 4; input.mx = G.w / 2 + 120; input.my = G.h / 2 - 140;
    } else if (scenario === 'combat') {      // combat mode with the hive on you
      spawnAt(0); S.mode = 'combat'; hive.quiet = true; S.add('rifle rounds', 300);
      for (const [t, x, y] of [['scout', 9, 1.2], ['scout', 13, 1.2], ['swarmer', 7, 1], ['swarmer', 8, 1], ['swarmer', 11, 1], ['swarmer', -8, 1], ['brute', 16, 2], ['spitter', -11, 1.2], ['flier', 6, 6], ['flier', -5, 7]]) spawnCreature(t, x, y, { x: 0, y: 1 }).state = 'charge';
      auto = dt => { let b = null, bd = 1e9; for (const c of creatures) { const d = Math.hypot(c.x - P.x, c.y - P.y); if (d < bd && KIND[c.type].hostile) { bd = d; b = c; } } if (b) { input.mx = G.w / 2 + (b.x - S.cam.x) * S.ppm; input.my = G.h / 2 - (b.y - S.cam.y) * S.ppm; } input.down[0] = !!b && G.auto; input.down[2] = G.auto; if (G.auto) { P.hp = Math.max(P.hp, 55); S.flash = Math.min(S.flash, 0.3); } };
    } else if (scenario === 'drill') {       // the laser at work
      spawnAt(-22); hive.quiet = true; auto = () => { input.mx = G.w / 2 + 250 + Math.sin(G.time * 0.9) * 40; input.my = G.h / 2 + 150 + Math.sin(G.time * 1.3) * 50; input.down[0] = G.auto || input.down[0]; };
    } else if (scenario === 'forest') { spawnAt(54); hive.quiet = true; }
    else if (scenario === 'ruins') { const st = slotStruct(-2); spawnAt(st.mouth[0] - 3); hive.quiet = true; }
    else if (scenario === 'base') { const st = slotStruct(2); spawnAt(st.door[0] + (st.door[0] < st.x ? -4 : 4)); hive.quiet = true; }
    else if (scenario === 'hive') { const st = slotStruct(1); spawnAt(st.mouth[0] - 7); hive.alert[st.id] = 30; hive.timer[st.id] = 3; S.add('rifle rounds', 200); S.mode = 'combat'; input.mx = G.w / 2 + 300; }
    else if (scenario === 'inventory') { spawnAt(0); hive.quiet = true; for (const [k, n] of [['iron ore', 46.3], ['copper ore', 18.75], ['lumen', 3.2], ['biomass', 22.4], ['fibre', 6.1], ['resin', 2.5], ['chitin', 4], ['ichor', 1.2], ['furnace', 1], ['belt', 8], ['drone', 2], ['part', 3], ['xeno shard', 5.5]]) S.add(k, n); S.printer.q.push({ r: 'miner', left: 30, total: 48 }, { r: 'belt', left: 16, total: 16 }); ui.toggle(true); }
    else { spawnAt(0); spawnCreature('scout', 13, 1.2).state = 'stalk'; spawnCreature('jelly', -9, 4.5); }
    S.cam.x = P.x; S.cam.y = P.y + 2.2; events.emit('landed');
  },
  enter(d) { if (d && d.died) { P.hp = 0; P.dead = 0.01; events.emit('died'); } },
  step(dt) {
    light.emitters.length = 0;
    S.zoom = lerp(S.zoom, 1 + 0.32 * P.ads, Math.min(1, dt * 8)); S.ppm = G.h / 15 * S.zoom; S.mouse.x = S.cam.x + (input.mx - G.w / 2) / S.ppm; S.mouse.y = S.cam.y - (input.my - G.h / 2) / S.ppm;
    if (auto) auto(dt);
    if (input.hit('i') || input.hit('Tab')) ui.toggle();
    if (input.hit('Escape') && ui.open) ui.toggle(false);
    if (input.hit('e') && !P.dead) {
      if (ui.open) ui.toggle(false);
      else if (!siteUse()) { const m = nearest(); if (m && m.kind === 'pad' && m.n >= ROCKET_PARTS) { m.n = 0; G.switchAct('space', { launch: true }); } else if (m) ui.openMachine(m); }
    }
    env.step(dt); stepPlayer(dt); stepBlueprint(dt); stepRobots(dt); stepBullets(dt); stepCreatures(dt); stepFactory(dt); stepSites(dt); stepHive(dt); stepFlora(dt); stepHeat(dt);
    if (P.beam && P.beam.hit) siteDamage(P.beam.x2, P.beam.y2, 150 * dt);
    S.parts.step(dt, 0, -GRAV, (x, y) => world.solidAt(x, y));
    for (let i = S.lights.length - 1; i >= 0; i--) if ((S.lights[i].t -= dt) <= 0) S.lights.splice(i, 1);
    const k = Math.min(1, dt * 5), look = 0.22 + 0.25 * P.ads; S.cam.x = lerp(S.cam.x, P.x + (input.mx - G.w / 2) / S.ppm * look, k); S.cam.y = lerp(S.cam.y, P.y + 1.6 + (G.h / 2 - input.my) / S.ppm * look, k);
    near = ui.open ? null : sites.near ? null : nearest();
    G.shake = Math.max(0, G.shake - dt * (0.6 + G.shake * 6));
  },
  draw(time) {
    const b = S.batch, sh = G.shake * 0.5, cx = S.cam.x + (Math.random() - 0.5) * sh, cy = S.cam.y + (Math.random() - 0.5) * sh, ppm = S.ppm;
    b.begin(cx, cy, ppm);
    drawFlora(b, time, false); drawSites(b, time);
    if (S.crash) drawWreck(b, time);
    drawFactory(b, time); drawBlueprint(b, time); drawCreatures(b, time); drawPlayer(b, time); drawRobots(b, time); S.parts.draw(b, 1.2); drawFlora(b, time, true);
    for (const l of S.lights) light.emit(l.x, l.y, l.c[0], l.c[1], l.c[2]);
    b.end();
    horizon = lerp(horizon, surfaceH(cx), 0.05);
    computeLight(cx / TS, cy / TS, time); updateTerrain(cx, cy, ppm, time, horizon);
    b.u.uLR.value.set((light.ox * TS - cx) * ppm, (light.oy * TS - cy) * ppm, 1 / (LW * TS * ppm), 1 / (LH * TS * ppm));
    audio.loop('wind', 0.1 + 0.05 * Math.sin(time * 0.3), 260 + 120 * Math.sin(time * 0.17));
    return S.flash;
  },
  hud(c) {
    const w = G.w, h = G.h, combat = S.mode === 'combat', bp = S.mode === 'blueprint';
    ui.update(true);
    // suit: body, battery, oxygen, propellant, drill heat. Every bar is a counted amount.
    const bx = 28; let by = h - 130;
    bar(c, bx, by, 150, P.hp / 100, 'body ' + Math.max(0, P.hp | 0), P.hp < 35 ? RED : INK); by += 24;
    bar(c, bx, by, 150, P.bat.wh / P.bat.cap, `battery ${P.bat.wh.toFixed(0)} wh${P.charging ? '  charging' : ''}`, P.bat.wh < 60 ? RED : AMBER); by += 24;
    bar(c, bx, by, 150, P.o2 / SUIT.o2, `oxygen ${P.o2.toFixed(2)} kg  ${(P.o2 / SUIT.o2Rate / 60).toFixed(0)} min`, P.o2 < 0.15 ? RED : INK); by += 24;
    bar(c, bx, by, 150, P.prop / SUIT.prop, `jet ${P.prop.toFixed(2)} kg`, AMBER); by += 24;
    bar(c, bx, by, 150, P.heat, P.vent > 0 ? 'drill venting' : `drill heat ${(P.heat * 100).toFixed(0)}%`, P.heat > 0.75 || P.vent > 0 ? RED : INK);
    // the world hears you: noise, local pollution, the nearest hive
    const nz = env.mine, pol = env.pollAt(P.x, P.y), hn = hive.near; let ry = 96;
    txt(c, 'signature', w - 28, 78, { align: 'right', a: 0.35 });
    txt(c, `noise ${nz.toFixed(0)} m`, w - 28, ry, { align: 'right', col: nz > 50 ? RED : nz > 25 ? AMBER : INK, a: 0.7 }); line(c, w - 180, ry + 5, w - 28, ry + 5, 0.15); line(c, w - 28 - Math.min(152, nz * 1.6), ry + 5, w - 28, ry + 5, 0.8, nz > 50 ? RED : AMBER); ry += 20;
    txt(c, `pollution ${pol.toFixed(1)} ug/m3`, w - 28, ry, { align: 'right', col: pol > 60 ? RED : pol > 20 ? AMBER : INK, a: 0.7 }); line(c, w - 180, ry + 5, w - 28, ry + 5, 0.15); line(c, w - 28 - Math.min(152, pol * 1.5), ry + 5, w - 28, ry + 5, 0.8, pol > 60 ? RED : AMBER); ry += 20;
    if (hn) { txt(c, `hive ${hn.d.toFixed(0)} m ${hn.x < P.x ? 'west' : 'east'}   alert ${hn.a.toFixed(0)}%`, w - 28, ry, { align: 'right', col: hn.a > 50 ? RED : hn.a > 15 ? AMBER : INK, a: 0.7 }); ry += 15; }
    txt(c, `hivemind spread ${(hive.spread * 100).toFixed(1)}%   contacts ${creatures.filter(q => KIND[q.type].hostile).length}`, w - 28, ry, { align: 'right', a: 0.4 }); ry += 24;
    if (robots.length) { txt(c, `builder drones ${robots.length}   queue ${BP.ghosts.length + BP.clears.length}`, w - 28, ry, { align: 'right', a: 0.6 }); ry += 15; for (const r of robots.slice(0, 6)) { txt(c, `drone ${r.id}  ${r.state}  ${(r.wh / ROBOT.wh * 100).toFixed(0)}%`, w - 28, ry, { align: 'right', a: 0.4 }); ry += 13; } ry += 8; }
    if (S.printer.q.length) { const j = S.printer.q[0]; txt(c, `suit printer: ${j.r}  ${Math.ceil(j.left)} s${S.printer.q.length > 1 ? '  +' + (S.printer.q.length - 1) : ''}`, w - 28, ry, { align: 'right', col: AMBER, a: 0.7 }); ry += 18; }
    S.gains.forEach((g, i) => { drawIcon(c, g.id, w - 52, ry + i * 24 - 4, 22); txt(c, `+ ${fmtAmt(g.id, g.n) || 'x1'} ${g.id}`, w - 58, ry + i * 24 + 10, { align: 'right', a: Math.min(0.85, g.t) }); });
    // altitude tape and compass strip
    const alt = P.y; line(c, 28, h / 2 - 90, 28, h / 2 + 90, 0.25);
    for (let i = -4; i <= 4; i++) { const v = Math.round(alt / 5) * 5 + i * 5, yy = h / 2 - (v - alt) * 4; if (Math.abs(yy - h / 2) < 90) { line(c, 28, yy, 34, yy, 0.3); txt(c, v, 40, yy + 3, { a: 0.35 }); } }
    txt(c, `alt ${alt.toFixed(1)} m`, 46, h / 2 - 100); line(c, 22, h / 2, 34, h / 2, 0.8, AMBER);
    line(c, w / 2 - 160, 30, w / 2 + 160, 30, 0.25);
    for (let i = -8; i <= 8; i++) { const v = Math.round(P.x / 10) * 10 + i * 10, xx = w / 2 + (v - P.x) * 2; if (Math.abs(xx - w / 2) < 160) { line(c, xx, 30, xx, v % 50 === 0 ? 38 : 34, 0.3); if (v % 50 === 0) txt(c, v, xx, 50, { align: 'center', a: 0.35 }); } }
    line(c, w / 2, 24, w / 2, 36, 0.8, AMBER); txt(c, `x ${P.x.toFixed(0)} m   v ${Math.hypot(P.vx, P.vy).toFixed(1)} m/s   g ${GRAV} m/s2   ${sites.inside ? STORY.sites[sites.inside.kind === 'base' && sites.inside.research ? 'lab' : sites.inside.kind] : BIOME[biome(P.x)]}`, w / 2, 20, { align: 'center', a: 0.45 });
    if (S.msgT > 0) txt(c, S.msg, w / 2, 84, { align: 'center', col: AMBER, a: Math.min(0.85, S.msgT) });
    if (F.pad) txt(c, F.pad.n >= ROCKET_PARTS ? 'rocket ready: e at the pad to board' : `rocket ${F.pad.n}/${ROCKET_PARTS} parts`, 28, h - 168, { col: AMBER, a: 0.8 });
    txt(c, F.printer ? 'bio-printer online: body respawns there' : 'no bio-printer: death restarts at the crash site', 28, h - 152, { a: 0.4 });
    txt(c, `${combat ? 'combat' : bp ? 'blueprint' : 'build'} mode`, w / 2, h - 80, { align: 'center', col: combat ? RED : AMBER, a: bp ? 0 : 0.8 });
    txt(c, combat ? 'lmb fire   rmb aim   r reload   1-9 weapon   c build mode' : bp ? '' : 'lmb laser drill   rmb place selected   i inventory + suit printer   b blueprint   c combat   e use   f lamp', w / 2, h - 6, { align: 'center', a: 0.28 });
    const hint = sites.hint || (near ? `e  ${near.kind === 'pad' && near.n >= ROCKET_PARTS ? 'board the rocket' : 'open ' + near.kind}` : '');
    if (hint && !ui.open) txt(c, hint, w / 2, h / 2 + 120, { align: 'center', col: AMBER, a: 0.75 });
    if (BP.hand) { const g = BP.hand; txt(c, g.decon ? `taking apart ${g.kind}` : `building ${g.kind} by hand ${(g.prog * 100).toFixed(0)}%`, w / 2, h / 2 + 138, { align: 'center', a: 0.6 }); }
    if (P.dead > 0) txt(c, 'signal lost', w / 2, h / 2, { align: 'center', size: 14, col: RED, a: 0.9 });
    if (save.slot) txt(c, save.status, 28, 20, { a: performance.now() - save.last < 2500 ? 0.5 : 0 });
    if (ui.open) return;
    const mx = input.mx, my = input.my;
    if (combat) {      // reticle that opens with spread, ammunition counted to the round, contacts
      const wn = P.weapon, wp = wn && WEAPON[wn];
      if (wp) {
        const sp = ((wp.spread + P.bloom) * (1 - 0.6 * P.ads) * (P.ground ? 1 : 1.8)) * Math.hypot(S.mouse.x - P.x, S.mouse.y - P.y - 1.36) * S.ppm + 5, col = P.hitT > 0 ? RED : INK;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) line(c, mx + dx * sp, my + dy * sp, mx + dx * (sp + 7), my + dy * (sp + 7), 0.85, col); c.fillStyle = `rgba(${col},0.9)`; c.fillRect(mx - 0.5, my - 0.5, 1.5, 1.5);
        if (P.hitT > 0) for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) line(c, mx + dx * 5, my + dy * 5, mx + dx * 10, my + dy * 10, 0.9, RED);
        const res = S.count(wp.ammo), x0 = w / 2 + 290;
        drawIcon(c, wn, x0, h - 76, 40); txt(c, P.reload > 0 ? 'reloading' : String(P.mag[wn]).padStart(2, '0'), x0 + 50, h - 46, { size: 22, col: P.mag[wn] <= wp.mag * 0.2 ? RED : INK, a: 0.9 }); txt(c, `/ ${Math.round(res)} ${wp.ammo}`, x0 + 50, h - 30, { a: 0.6 }); txt(c, `${(res * ITEMS[wp.ammo].m).toFixed(2)} kg carried`, x0 + 50, h - 18, { a: 0.35 });
        for (let i = 0; i < wp.mag; i++) { c.fillStyle = `rgba(${i < P.mag[wn] ? INK : '60,70,78'},${i < P.mag[wn] ? 0.7 : 0.4})`; c.fillRect(x0 + 50 + i * (wp.mag > 10 ? 4 : 12), h - 70, wp.mag > 10 ? 2 : 8, 8); }
        if (P.reload > 0) { line(c, mx - 14, my + 22, mx + 14, my + 22, 0.25); line(c, mx - 14, my + 22, mx - 14 + 28 * (1 - P.reload / wp.reload), my + 22, 0.9, AMBER); }
      } else txt(c, 'no weapon in the hotbar', mx, my + 30, { align: 'center', col: RED, a: 0.8 });
      for (const q of creatures) { if (!KIND[q.type].hostile) continue; const sx = w / 2 + (q.x - S.cam.x) * S.ppm, sy = h / 2 - (q.y - S.cam.y) * S.ppm; if (sx > 0 && sx < w && sy > 0 && sy < h) { bracket(c, sx, sy, 14 + KIND[q.type].thick * 14, RED, 0.45); txt(c, `${q.type} ${Math.max(0, q.hp).toFixed(0)}`, sx + 20 + KIND[q.type].thick * 14, sy - 12, { col: RED, a: 0.5 }); } else { const a = Math.atan2(q.y - P.y, q.x - P.x); line(c, w / 2 + Math.cos(a) * 150, h / 2 - Math.sin(a) * 150, w / 2 + Math.cos(a) * 164, h / 2 - Math.sin(a) * 164, 0.8, RED); } }
    } else if (!bp) { line(c, mx - 9, my, mx - 3, my, 0.7); line(c, mx + 3, my, mx + 9, my, 0.7); line(c, mx, my - 9, mx, my - 3, 0.7); line(c, mx, my + 3, mx, my + 9, 0.7); }
    else { line(c, mx - 6, my, mx + 6, my, 0.5, AMBER); line(c, mx, my - 6, mx, my + 6, 0.5, AMBER); for (const g of BP.ghosts) if (!g.have && !S.has({ [g.kind === 'wall' ? 'iron' : g.kind]: g.kind === 'wall' ? 3 : 1 }) && !robots.length) { const sx = w / 2 + ((g.x + 0.5) * TS - S.cam.x) * S.ppm, sy = h / 2 - ((g.y + 1.5) * TS - S.cam.y) * S.ppm; txt(c, 'missing ' + (g.kind === 'wall' ? 'iron' : g.kind), sx, sy - 14, { align: 'center', col: RED, a: 0.55 }); } }
  },
  hide() { ui.update(false); },
};
function drawWreck(b, time) {            // the transport that brought the prisoners down
  const x = -9, y = 0.25, fl = Math.sin(time * 23) * Math.sin(time * 3.1) > 0.2 ? 1 : 0.15;
  b.add(x, y + 0.9, 5.2, 1.9, -0.14, mul(C.hull, 0.5), 1, 0, 1, 3); b.add(x - 1.2, y + 1.7, 2.4, 1.0, -0.2, mul(C.hull, 0.4), 1, 0, 1, 4); b.add(x + 2.9, y + 0.35, 1.5, 0.8, 0.5, mul(C.steel, 0.5), 1, 0, 1, 5);
  b.add(x + 1.2, y + 0.9, 1.0, 0.5, -0.14, [0.01, 0.012, 0.016], 1, 0, 1); b.seg(x - 2.6, y + 1.9, x - 3.6, y + 3.4, 0.07, C.steel, 1, 0, 1);
  b.add(x - 3.6, y + 3.4, 0.1, 0.1, 0, mul(C.amber, 4 * fl), 1, 1, 2); b.add(x - 3.6, y + 3.4, 1.2, 1.2, 0, mul(C.amber, 0.3 * fl), 1, 1, 2); light.emit((x - 3.6) / TS, (y + 3.4) / TS, 0.9 * fl, 0.42 * fl, 0.08 * fl);
}
const r3 = v => +v.toFixed(3);
function dumpSurface() {
  return { p: { x: r3(P.x), y: r3(P.y), vx: r3(P.vx), vy: r3(P.vy), hp: r3(P.hp), wh: r3(P.bat.wh), o2: +P.o2.toFixed(5), prop: r3(P.prop), slot: P.slot, mag: { ...P.mag }, heat: r3(P.heat), lamp: light.lamp.on ? 1 : 0 },
    inv: inv.dump(S.inv), printer: S.printer.q.map(j => [j.r, r3(j.left), j.total]), corpse: S.corpse, mode: S.mode, crash: S.crash ? 1 : 0, calm: r3(S.calm), stats: { ...S.stats, kills: { ...S.stats.kills }, dug: r3(S.stats.dug), vapor: r3(S.stats.vapor) },
    terrain: world.saveDiff(), flora: [...flora.dead].sort(), factory: dumpFactory(), bp: dumpBP(), robots: dumpRobots(), sites: dumpSites(), hive: dumpHive(), env: env.dump() };
}
function loadSurface(o) {
  resetStructs(); world.loadDiff(o.terrain); resetFlora(); flora.dead = new Set(o.flora); creatures.length = 0; S.bullets.length = 0; S.parts.list.length = 0; view.hot.length = 0; auto = null;
  const p = o.p; Object.assign(P, { x: p.x, y: p.y, vx: p.vx, vy: p.vy, hp: p.hp, o2: p.o2, prop: p.prop, slot: p.slot, heat: p.heat, dead: 0, ground: false, vent: 0, reload: 0 }); P.bat.wh = p.wh; P.mag = { ...p.mag }; light.lamp.on = !!p.lamp;
  inv.load(S.inv, o.inv); S.printer.q = o.printer.map(([r, left, total]) => ({ r, left, total })); S.corpse = o.corpse; S.mode = o.mode; S.crash = !!o.crash; S.calm = o.calm; S.stats = { ...o.stats, kills: { ...o.stats.kills } }; S.open = null; S.uiOpen = false; S.gains.length = 0;
  loadFactory(o.factory); loadBP(o.bp); loadRobots(o.robots); loadSites(o.sites); loadHive(o.hive); env.load(o.env);
  S.cam.x = P.x; S.cam.y = P.y + 2.2;
}
// hooks for tools: time of each draw stage in ms, and the live state
surface.profile = n => { const b = S.batch, t = {}, T = (k, f) => { const t0 = performance.now(); for (let i = 0; i < n; i++) f(i); t[k] = +((performance.now() - t0) / n).toFixed(2); };
  T('floraBack', i => { b.begin(S.cam.x, S.cam.y, S.ppm); drawFlora(b, i * 0.016, false); t.sprites = b.n; }); T('floraFront', i => { b.begin(S.cam.x, S.cam.y, S.ppm); drawFlora(b, i * 0.016, true); }); T('sites', i => drawSites(b, i)); T('parts', () => S.parts.draw(b, 1.2)); T('end', () => b.end());
  T('light', i => computeLight(S.cam.x / TS, S.cam.y / TS, i)); T('terrain', i => updateTerrain(S.cam.x, S.cam.y, S.ppm, i, 0)); T('window', () => { world.rev++; updateTerrain(S.cam.x, S.cam.y, S.ppm, 0, 0); }); return t; };
surface.debug = { S, P, F, BP, robots, creatures, hive, env, flora, world, sites, siteUse, spawnCreature, hurt, slotStruct, structsIn };

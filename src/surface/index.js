// Act 1, the surface: wires the density world, light, heat, the layered forest, the player and the kit (ship laser,
// reactor, network), loose matter, creatures, the factory, blueprints, robots, the demand and supply AI, sites and the
// hivemind into one act, draws the HUD, and registers the act with the save module.
import { G, input, events, lerp, clamp, rand, hash } from '../core.js';
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
import { creatures, stepCreatures, drawCreatures, spawnCreature, spawnHerd, KIND, stance } from './creatures.js';
import { F, ROCKET_PARTS, nearest, stepFactory, drawFactory, buildScenario, place, dumpFactory, loadFactory } from './factory.js';
import { BP, BUILD, stepBlueprint, drawBlueprint, addGhost, dumpBP, loadBP } from './blueprint.js';
import { robots, stepRobots, drawRobots, spawnRobot, wakeShipRobots, dumpRobots, loadRobots, ROBOT } from './robots.js';
import { flora, stepFlora, drawFlora, resetFlora } from './flora.js';
import { sites, stepSites, drawSites, siteUse, siteDamage, dumpSites, loadSites } from './sites.js';
import { hive, stepHive, dumpHive, loadHive, sendWave } from './hive.js';
import { structsIn, slotStruct, resetStructs } from './structures.js';
import { backdrop, initBackdrop, drawBackdrop } from './backdrop.js';
import { heat } from './heat.js';
import { matter, matterHeat } from './matter.js';
import { K, SHIP, kitReset, kitUse, kitHint, stepKit, drawKit, drawKitBeam, drawWreck, reactorPos, dumpKit, loadKit } from './kit.js';
import { mobility, REACTOR_W, LASER_W, SUIT_BUS_W, CABLE, SHIP_LINK } from './power.js';
import { SUP, stepSupply, dumpSupply, loadSupply } from './supply.js';
import { stepLife, drawLife } from './life.js';

let near = null, auto = null, horizon = 0, thudT = 0;
const BIOME = ['fungal forest', 'violet thicket', 'acid marsh'], DIR = { t: 0, pred: 0 };
flora.drop = (id, n, x, y) => matter.spawn(id, n, x, y, rand(-0.8, 0.8), rand(0.5, 2));
S.shakeBy = v => { G.shake += v; };
S.loose = (id, n, x, y) => matter.spawn(id, n, x, y, rand(-1, 1), rand(1, 3));       // what a kill or a broken thing leaves lies in the world
S.thud = (c, v) => { if (thudT > 0 || Math.abs(c.x - P.x) > 16) return; thudT = 0.09; audio.play(c.kg > 20 ? 'thud' : 'tink'); env.noise(c.x, c.y, 6 + Math.min(14, c.kg * 0.3)); };
events.on('built', kind => { if (kind === 'antenna' && S.crash) wakeShipRobots(); });
function give(list, into = S.inv) { for (const [k, n] of list) inv.add(into, k, n); }
const baseKit = () => give([['iron', 24], ['copper', 6], ['basalt', 30], ['o2 cell', 1], ['power cell', 1]]);
const guns = () => give([['rifle', 1], ['shotgun', 1], ['rifle rounds', 120], ['shells', 18]]);
const flatten = (x0, x1) => { world.box(x0, 0, x1, 14, -1); world.box(x0, -1.5, x1, 0, 1, M.BASALT); };
// the ground the slice is played on: an outcrop of basalt with a seam of iron ore in it, east of the wreck
function sliceGround() {
  const seam = (x, y) => Math.hypot((x - 14.2) / 1.7, (y - 0.5) / 1.15) * 1.15 - 1.15, rock = (x, y) => Math.hypot((x - 13.6) / 2.9, (y - 0.7) / 2.4) * 2.4 - 2.4 + Math.sin(x * 2.3 + y) * 0.16, low = (x, y) => Math.hypot((x - 9.2) / 1.2, (y + 0.05) / 0.6) * 0.6 - 0.6;
  world.shape(12, -1.2, 16.4, 2, seam, -1); world.shape(12, -1.2, 16.4, 2, seam, 1, M.IRON); world.shape(10, -2, 17.2, 3.6, rock, 1, M.BASALT); world.shape(7.6, -1, 10.8, 0.8, low, 1, M.BASALT);
}
function antennaUp(gx = 4) { const m = place('antenna', gx, 0, 1, true); return m; }
// what the slice asks for next: one quiet line, not a quest log
function objective() {
  const has = k => F.machines.some(m => m.kind === k);
  if (K.laser.state === 'ship') return 'the ship laser is still on its hardpoint, above the nose';
  if (K.reactor.state === 'ship') return 'the laser needs the reactor: pull it out of its bay';
  if (S.stats.dug < 120) return 'cut into the outcrop east of the wreck (lmb)';
  if (!has('antenna')) return 'the antenna frame stands by the wreck: stay near it and the suit builds it';
  if (!has('furnace')) return S.printer.q.some(j => j.r === 'furnace') ? 'the arm is printing the furnace, atom by atom' : S.count('furnace') ? 'place the furnace (b)' : S.count('basalt') >= 40 ? 'print a furnace on the arm (i)' : 'gather 40 kg of basalt by hand (v) for a furnace';
  if ((SUP.stock && SUP.stock.iron || 0) < SUP.targets.iron) return 'the ship ai runs it now: robots carry ore in and iron out';
  return 'the line runs without hands';
}
export const surface = {
  init() {
    initLight(); initTerrain(R.scenes.surface); S.batch = new Batch(R.scenes.surface, 46000, 10); S.batch.u.uLight.value = light.lightTex; S.batch.u.uSun.value.set(0.5, 0.86); S.batch.u.uRim.value.set(0.55, 0.8, 0.9);
    initBackdrop(R.scenes.surface); view.u.uBack.value = backdrop.rt.texture; S.P = P; S.hurt = hurt; ui.init();
    save.register('surface', { dump: dumpSurface, load: loadSurface });
  },
  start(scenario) {
    input.mx = G.w / 2 + 260; input.my = G.h / 2 + 46; S.crash = true; S.slice = false; kitReset('carried'); DIR.t = 0; DIR.pred = 0;
    if (scenario === 'factory') { S.calm = 150; S.crash = false; hive.quiet = true; flora.clear = [-14, 10]; baseKit(); buildScenario(); spawnAt(-6); S.add('part', 6); S.add('biomass', 12); spawnCreature('grazer', 9, 1.2); }
    else if (scenario === 'blueprint') {     // a hub, three drones, a chest of kits, and a queue for them
      S.crash = false; hive.quiet = true; flora.clear = [-18, 18]; baseKit(); flatten(-16, 16); spawnAt(3); const hub = place('hub', -1, 0, 1, true), ch = place('chest', -6, 0, 1, true);
      for (const [k, n] of [['furnace', 1], ['assembler', 1], ['miner', 1], ['belt', 12], ['iron', 150], ['chest', 1]]) inv.add(ch.inv, k, n);
      for (let i = 0; i < 3; i++) spawnRobot(hub);
      addGhost('miner', 8, 0); for (let x = 10; x <= 13; x++) addGhost('belt', x, 0); addGhost('furnace', 14, 0); for (let x = 16; x <= 19; x++) addGhost('belt', x, 0); addGhost('assembler', 20, 0);
      for (let j = 0; j < 4; j++) addGhost('wall', 25, j); for (let i = 26; i < 29; i++) addGhost('wall', i, 3);
      world.box(-13, 0, -9, 2.5, 1, M.BASALT); BP.clears.push({ id: BP.nextId++, x0: -13, y0: 0, x1: -9, y1: 2.5, claim: null, cur: 0 });
      S.mode = 'blueprint'; BP.sel = 4; input.mx = G.w / 2 + 120; input.my = G.h / 2 - 140; SUP.on = false;
    } else if (scenario === 'combat') {      // the hive's answer: an attack wave, and the round 2 guns to meet it (a dev scenario)
      spawnAt(0); S.mode = 'combat'; hive.quiet = true; baseKit(); guns(); S.add('rifle rounds', 300); K.laser.state = 'ship'; K.reactor.state = 'ship';
      for (const [t, x, y] of [['scout', 9, 1.2], ['scout', 13, 1.2], ['swarmer', 7, 1], ['swarmer', 8, 1], ['swarmer', 11, 1], ['swarmer', -8, 1], ['brute', 16, 2], ['spitter', -11, 1.2], ['flier', 6, 6], ['flier', -5, 7]]) { const c = spawnCreature(t, x, y, { x: 0, y: 1 }); c.state = 'charge'; c.order = 'attack'; }
      auto = dt => { let b = null, bd = 1e9; for (const c of creatures) { const d = Math.hypot(c.x - P.x, c.y - P.y); if (d < bd && c.agg) { bd = d; b = c; } } if (b) { input.mx = G.w / 2 + (b.x - S.cam.x) * S.ppm; input.my = G.h / 2 - (b.y - S.cam.y) * S.ppm; } input.down[0] = !!b && G.auto; input.down[2] = G.auto; if (G.auto) { P.hp = Math.max(P.hp, 55); S.flash = Math.min(S.flash, 0.3); } };
    } else if (scenario === 'oldkit') { spawnAt(0); hive.quiet = true; baseKit(); guns(); K.laser.state = 'ship'; K.reactor.state = 'ship'; S.crash = true; }   // the round 2 kit, for the interface test
    else if (scenario === 'drill') {         // the ship laser at work on a hillside, the reactor on the back
      spawnAt(-22); hive.quiet = true; auto = () => { input.mx = G.w / 2 + 250 + Math.sin(G.time * 0.9) * 40; input.my = G.h / 2 + 150 + Math.sin(G.time * 1.3) * 50; input.down[0] = G.auto || input.down[0]; };
    } else if (scenario === 'forest') { spawnAt(54); hive.quiet = true; baseKit(); }
    else if (scenario === 'reactor') {       // the walk with 178 kg on the body
      spawnAt(30); hive.quiet = true; auto = () => { input.mx = G.w / 2 + 300; input.my = G.h / 2 + 30; if (G.auto) { input.keys.add('d'); if (G.time % 6 > 5.2) input.keys.delete('d'); } };
    } else if (scenario === 'turret') {      // the laser on its legs, the reactor set down beside it, the ship AI at the trigger
      spawnAt(1.5); hive.quiet = true; antennaUp(); K.awake = true; K.reactor.state = 'ground'; K.reactor.x = 5.6; K.reactor.y = 0.4; K.laser.state = 'turret'; K.laser.x = 7.6; K.laser.y = 0; K.laser.ang = 0.1;
      const c = spawnCreature('stalker', 27, 1.2); c.state = 'charge'; c.dir = -1; input.mx = G.w / 2 + 200; input.my = G.h / 2;
      auto = () => { if (G.auto) P.hp = Math.max(P.hp, 60); };
    } else if (scenario === 'herd') {        // a herd that has seen you and has not yet decided
      spawnAt(37.5); hive.quiet = true; spawnHerd(51.6, 5); input.mx = G.w / 2 + 700; input.my = G.h / 2 + 90;
    } else if (scenario === 'predator') {    // bigger than you, and it eats things your size
      spawnAt(44); hive.quiet = true; const g = world.groundY(59, surfaceH(59) + 6, 0, 20) || 0, c = spawnCreature('stalker', 59, g + 1); c.dir = -1; c.state = 'stalk'; input.mx = G.w / 2 + 330; input.my = G.h / 2 + 10;
      auto = () => { if (G.auto) { P.hp = Math.max(P.hp, 60); S.flash = Math.min(S.flash, 0.2); } };
    } else if (scenario === 'supply') {      // demand and supply: a furnace, the arm, loose ore, and the ship's robots carrying between them
      S.slice = true; sliceGround(); spawnAt(4); antennaUp(); wakeShipRobots(); place('furnace', -2, 0, 1, true); give([['iron', 6], ['copper', 6]], K.hold); give([['basalt', 44], ['iron ore', 8], ['o2 cell', 1], ['power cell', 1]]);
      for (let i = 0; i < 9; i++) matter.spawn('iron ore', 6 + (i % 3) * 3, 8 + i * 0.5, 0.6 + (i % 2) * 0.3); for (let i = 0; i < 6; i++) matter.spawn('basalt', 9 + i, 7.5 + i * 0.7, 1.2); S.stats.dug = 400; hive.quiet = true; input.mx = G.w / 2 + 160; input.my = G.h / 2 + 60;
    } else if (scenario === 'ruins') { const st = slotStruct(-2); spawnAt(st.mouth[0] - 3); hive.quiet = true; baseKit(); }
    else if (scenario === 'base') { const st = slotStruct(2); spawnAt(st.door[0] + (st.door[0] < st.x ? -4 : 4)); hive.quiet = true; baseKit(); }
    else if (scenario === 'hive') { const st = slotStruct(1); spawnAt(st.mouth[0] - 7); hive.alert[st.id] = 30; hive.timer[st.id] = 3; baseKit(); guns(); S.add('rifle rounds', 200); S.mode = 'combat'; input.mx = G.w / 2 + 300; }
    else if (scenario === 'inventory') { spawnAt(0); hive.quiet = true; baseKit(); SUP.on = false; for (const [k, n] of [['iron ore', 46.3], ['copper ore', 18.75], ['lumen', 3.2], ['biomass', 22.4], ['fibre', 6.1], ['resin', 2.5], ['chitin', 4], ['ichor', 1.2], ['furnace', 1], ['belt', 8], ['drone', 2], ['part', 3], ['xeno shard', 5.5]]) S.add(k, n); S.printer.q.push({ r: 'miner', left: 30, total: 48 }, { r: 'belt', left: 16, total: 16 }); ui.toggle(true); }
    else {
      // the slice, and the default start: awake beside the wreck with nothing in your hands. The weapon is on the ship,
      // the reactor is in it, the antenna is a frame waiting to be built, the forest is watching.
      S.slice = true; kitReset('wreck'); sliceGround(); spawnAt(-4.5); give([['o2 cell', 1], ['power cell', 1]]); give([['iron', 14], ['copper', 6], ['o2 cell', 1]], K.hold);
      addGhost('antenna', 4, 0).have = true; spawnHerd(27, 5); spawnCreature('jelly', -14, 5.5); input.mx = G.w / 2 + 200; input.my = G.h / 2 + 20;
      if (G.auto) {            // the demonstration: take the laser, pull the reactor, walk to the outcrop and cut it
        let st = 0; auto = () => { const t = DIR.t; input.keys.delete('d'); input.keys.delete('a'); input.down[0] = false;
          if (st === 0) { if (P.x < SHIP.mount[0] + 1.6) input.keys.add('d'); else if (P.x > SHIP.mount[0] + 2.2) input.keys.add('a'); else if (!P.act) { if (K.laser.state === 'ship') kitUse(); else st = 1; } }
          else if (st === 1) { if (P.x > SHIP.bay[0] + 1.6) input.keys.add('a'); else if (!P.act) { if (K.reactor.state === 'ship') kitUse(); else st = 2; } }
          else if (st === 2) { if (P.x < 5.2) input.keys.add('d'); else st = 3; input.mx = G.w / 2 + 280; input.my = G.h / 2 + 40; }
          else { input.mx = G.w / 2 + 300 + Math.sin(t * 0.8) * 60; input.my = G.h / 2 + 30 + Math.sin(t * 1.1) * 70; input.down[0] = true; } };
      }
    }
    S.cam.x = P.x; S.cam.y = P.y + 2.2; horizon = surfaceH(P.x); P.wa = P.aim = 0; events.emit('landed');
  },
  enter(d) { if (d && d.died) { P.hp = 0; P.dead = 0.01; events.emit('died'); } },
  step(dt) {
    light.emitters.length = 0; S.frameN = (S.frameN || 0) + 1; thudT -= dt;
    S.zoom = lerp(S.zoom, 1 + 0.32 * P.ads, Math.min(1, dt * 8)); S.ppm = G.h / 15 * S.zoom; S.mouse.x = S.cam.x + (input.mx - G.w / 2) / S.ppm; S.mouse.y = S.cam.y - (input.my - G.h / 2) / S.ppm;
    if (auto) auto(dt);
    if (input.hit('i') || input.hit('Tab')) ui.toggle();
    if (input.hit('Escape') && ui.open) ui.toggle(false);
    if (input.hit('e') && !P.dead) {
      if (ui.open) ui.toggle(false);
      else if (!kitUse() && !siteUse()) { const m = nearest(); if (m && m.kind === 'pad' && m.n >= ROCKET_PARTS) { m.n = 0; G.switchAct('space', { launch: true }); } else if (m && m.kind !== 'antenna') ui.openMachine(m); }
    }
    env.step(dt); stepPlayer(dt); stepKit(dt); stepBlueprint(dt); stepRobots(dt); stepSupply(dt); stepBullets(dt); stepCreatures(dt); stepFactory(dt); stepSites(dt); stepHive(dt); stepFlora(dt); stepHeat(dt); matter.step(dt); matterHeat(dt); stepLife(dt);
    const B = K.laser.beam; if (B && B.hit) siteDamage(B.x2, B.y2, 150 * dt);
    S.parts.step(dt, 0, -GRAV, (x, y) => world.solidAt(x, y));
    for (let i = S.lights.length - 1; i >= 0; i--) if ((S.lights[i].t -= dt) <= 0) S.lights.splice(i, 1);
    if (S.scare > 0) { backdrop.scare = Math.max(backdrop.scare, S.scare); S.scare = Math.max(0, S.scare - dt * 0.8); }
    if (S.crash && !K.awake && F.machines.some(m => m.kind === 'antenna')) wakeShipRobots();
    if (S.slice) { DIR.t += dt;       // the one scripted thing in the slice: somewhere out there, something bigger than you notices
      if (!DIR.pred && K.reactor.state !== 'ship' && (Math.abs(P.x) > 36 || DIR.t > 330)) { DIR.pred = 1; const x = P.x + (P.x >= 0 ? 1 : -1) * 30, g = world.groundY(x, surfaceH(x) + 6, 0, 20); if (g !== null) spawnCreature('stalker', x, g + 1); } }
    const k = Math.min(1, dt * 5), look = 0.22 + 0.25 * P.ads; S.cam.x = lerp(S.cam.x, P.x + (input.mx - G.w / 2) / S.ppm * look, k); S.cam.y = lerp(S.cam.y, P.y + 1.6 + (G.h / 2 - input.my) / S.ppm * look, k);
    near = ui.open ? null : sites.near ? null : nearest();
    G.shake = Math.max(0, G.shake - dt * (0.6 + G.shake * 6));
  },
  draw(time) {
    const b = S.batch, sh = G.shake * 0.5, cx = S.cam.x + (Math.random() - 0.5) * sh, cy = S.cam.y + (Math.random() - 0.5) * sh, ppm = S.ppm;
    b.begin(cx, cy, ppm); b.u.uTime.value = time;
    flora.pushers.length = 0; if (!P.dead) flora.pushers.push({ x: P.x, y: P.y, vx: P.vx, r: 0.35, h: 1.7 }); for (const c of creatures) if (c.nodes.length && !KIND[c.type].fly) flora.pushers.push({ x: c.x, y: c.y - 1.2, vx: c.vx, r: 0.3 + KIND[c.type].thick * 0.5, h: 1.6 });
    // shafts of planet-light in the play plane
    for (let c = Math.floor((cx - 22) / 19); c <= Math.floor((cx + 22) / 19); c++) { const r = hash(c, 7, 230); if (r > 0.55) continue; const x = (c + 0.5 + (hash(c, 7, 231) - 0.5) * 0.8) * 19, top = Math.max(horizon, cy - 4) + 12, len = 13 + r * 8, a = -1.92 + (r - 0.3) * 0.12, br = 0.5 + 0.5 * Math.sin(time * 0.13 + r * 40), f = backdrop.fog;
      b.add(x + Math.cos(a) * len * 0.5, top + Math.sin(a) * len * 0.5, len, 1.2 + hash(c, 7, 232) * 2.2, a, [(0.02 + f[0]) * 1.2, (0.03 + f[1]) * 1.2, (0.034 + f[2]) * 1.2], 0.5 + 0.5 * br, 10, 2, c * 3.3); }
    drawFlora(b, time, false); drawSites(b, time);
    if (S.crash) drawWreck(b, time);
    drawFactory(b, time); drawBlueprint(b, time); matter.draw(b, time); drawCreatures(b, time); drawKit(b, time); drawPlayer(b, time); drawRobots(b, time); drawLife(b, time); S.parts.draw(b, 1.2); drawKitBeam(b, time); drawFlora(b, time, true);
    for (const l of S.lights) light.emit(l.x, l.y, l.c[0], l.c[1], l.c[2]);
    b.end();
    horizon = lerp(horizon, surfaceH(cx), 0.05); backdrop.glare = Math.max(backdrop.glare, S.glare || 0);
    drawBackdrop(cx, cy, ppm, time, horizon); view.u.uFog.value.set(backdrop.fog[0], backdrop.fog[1], backdrop.fog[2]);
    computeLight(cx / TS, cy / TS, time); updateTerrain(cx, cy, ppm, time, horizon);
    b.u.uLR.value.set((light.ox * TS - cx) * ppm, (light.oy * TS - cy) * ppm, 1 / (LW * TS * ppm), 1 / (LH * TS * ppm));
    audio.loop('wind', 0.1 + 0.05 * Math.sin(time * 0.3), 260 + 120 * Math.sin(time * 0.17));
    return S.flash;
  },
  hud(c) {
    const w = G.w, h = G.h, combat = S.mode === 'combat', bp = S.mode === 'blueprint';
    ui.update(true);
    // suit: body, battery, oxygen, propellant, drill heat. Every bar is a counted amount.
    const bx = 28, L = K.laser, RX = K.reactor, mob = P.mob || mobility(0); let by = h - 154;
    bar(c, bx, by, 150, P.hp / 100, 'body ' + Math.max(0, P.hp | 0), P.hp < 35 ? RED : INK); by += 24;
    bar(c, bx, by, 150, P.bat.wh / P.bat.cap, `battery ${P.bat.wh.toFixed(0)} wh${P.charging ? '  charging' : ''}`, P.bat.wh < 60 ? RED : AMBER); by += 24;
    bar(c, bx, by, 150, P.o2 / SUIT.o2, `oxygen ${P.o2.toFixed(2)} kg  ${(P.o2 / SUIT.o2Rate / 60).toFixed(0)} min`, P.o2 < 0.15 ? RED : INK); by += 24;
    bar(c, bx, by, 150, P.prop / SUIT.prop, `jet ${P.prop.toFixed(2)} kg`, AMBER); by += 24;
    bar(c, bx, by, 150, P.load / 300, `load ${P.load.toFixed(0)} kg   pace ${(mob.speed / 6.5 * 100).toFixed(0)}%   jump ${(mob.jump / 4.6 * 100).toFixed(0)}%   jet ${mob.jet > GRAV ? 'lifts' : 'brakes only'}`, P.load > 250 ? AMBER : INK); by += 24;
    if (L.state === 'held' || L.state === 'turret') bar(c, bx, by, 150, L.heat, L.vent > 0 ? 'laser venting' : `laser heat ${(L.heat * 100).toFixed(0)}%${L.state === 'turret' ? '   on its legs' : ''}`, L.heat > 0.75 || L.vent > 0 ? RED : INK);
    else txt(c, 'unarmed: the ship laser is on its hardpoint', bx, by - 5, { col: AMBER, a: 0.7 });
    // the world hears you: noise, local pollution, the nearest hive
    const nz = env.mine, pol = env.pollAt(P.x, P.y), hn = hive.near; let ry = 96;
    txt(c, 'signature', w - 28, 78, { align: 'right', a: 0.35 });
    txt(c, `noise ${nz.toFixed(0)} m`, w - 28, ry, { align: 'right', col: nz > 50 ? RED : nz > 25 ? AMBER : INK, a: 0.7 }); line(c, w - 180, ry + 5, w - 28, ry + 5, 0.15); line(c, w - 28 - Math.min(152, nz * 1.6), ry + 5, w - 28, ry + 5, 0.8, nz > 50 ? RED : AMBER); ry += 20;
    txt(c, `pollution ${pol.toFixed(1)} ug/m3`, w - 28, ry, { align: 'right', col: pol > 60 ? RED : pol > 20 ? AMBER : INK, a: 0.7 }); line(c, w - 180, ry + 5, w - 28, ry + 5, 0.15); line(c, w - 28 - Math.min(152, pol * 1.5), ry + 5, w - 28, ry + 5, 0.8, pol > 60 ? RED : AMBER); ry += 20;
    if (hn) { txt(c, `hive ${hn.d.toFixed(0)} m ${hn.x < P.x ? 'west' : 'east'}   ${hn.a < 6 ? 'asleep' : hn.a < 24 ? 'stirring' : 'awake'} ${hn.a.toFixed(0)}%`, w - 28, ry, { align: 'right', col: hn.a > 50 ? RED : hn.a > 6 ? AMBER : INK, a: 0.7 }); ry += 15; }
    txt(c, `hivemind spread ${(hive.spread * 100).toFixed(1)}%   hunting you ${creatures.filter(q => q.agg).length}   wary ${creatures.filter(q => !q.agg).length}`, w - 28, ry, { align: 'right', a: 0.4 }); ry += 24;
    // power and network: every watt and every link is a counted thing
    { const used = K.pw.used || 0, lf = L.frac, rs = RX.state, [rx, ry2] = reactorPos(), rd = Math.hypot(rx - P.x, ry2 - P.y - 1);
      txt(c, 'power', w - 28, ry, { align: 'right', a: 0.35 }); ry += 16;
      txt(c, `reactor ${rs === 'ship' ? 'in the wreck' : rs === 'carried' ? 'on your back' : 'set down ' + rd.toFixed(0) + ' m'}   ${(Math.max(0, used - (L.firing && lf < 0.6 ? used : 0)) / 1000).toFixed(1)} / ${REACTOR_W / 1000} kw`, w - 28, ry, { align: 'right', col: AMBER, a: 0.7 }); line(c, w - 180, ry + 5, w - 28, ry + 5, 0.15); line(c, w - 28 - 152 * RX.load, ry + 5, w - 28, ry + 5, 0.8, AMBER); ry += 20;
      if (L.state !== 'ship') { txt(c, L.reach ? `laser on the reactor cable   ${LASER_W / 1000} kw` : `laser out of cable reach (${CABLE} m): ${(SUIT_BUS_W / 1000).toFixed(1)} of ${LASER_W / 1000} kw`, w - 28, ry, { align: 'right', col: L.reach ? INK : RED, a: 0.65 }); ry += 15; }
      const np = K.net.player, ant = K.net.antennas.filter(q => !q.ship && q.range).length;
      txt(c, `network ${np ? (np.ship ? 'ship link ' + SHIP_LINK + ' m' : 'antenna ' + np.range + ' m') : 'no link'}   computers: ship ai${ant ? '   antennas ' + ant : ''}`, w - 28, ry, { align: 'right', col: np ? INK : RED, a: 0.65 }); ry += 15;
      if (L.state === 'turret') { txt(c, `turret: ${!L.link ? 'no link, no orders' : !L.reach ? 'linked, no power' : L.target ? 'ship ai firing on ' + L.target.type : 'ship ai watching'}`, w - 28, ry, { align: 'right', col: L.link && L.reach ? AMBER : RED, a: 0.7 }); ry += 15; }
      ry += 9; }
    // demand and supply: what the ship AI keeps in stock, and who it has making it
    if (SUP.on && SUP.stock) { txt(c, 'ship ai: stock targets', w - 28, ry, { align: 'right', a: 0.35 }); ry += 16;
      for (const k in SUP.targets) { const have = SUP.stock[k] || 0, tg = SUP.targets[k], o = SUP.orders.find(q => q.item === k), u = ITEMS[k].u === 'ea' ? '' : ' kg';
        drawIcon(c, k, w - 46, ry - 12, 18); txt(c, `${k} ${ITEMS[k].u === 'ea' ? Math.round(have) : have.toFixed(1)} / ${tg}${u}`, w - 52, ry, { align: 'right', col: have >= tg - 1e-6 ? INK : AMBER, a: 0.7 }); line(c, w - 180, ry + 5, w - 52, ry + 5, 0.15); line(c, w - 52 - 128 * Math.min(1, have / tg), ry + 5, w - 52, ry + 5, 0.7, have >= tg - 1e-6 ? INK : AMBER); ry += 15;
        if (o) { txt(c, `> ${o.producer === 'suit' ? 'arm (matter compiler)' : o.producer}: ${o.note || ''}`, w - 52, ry, { align: 'right', a: 0.45 }); ry += 15; } ry += 3; }
      ry += 6; }
    if (robots.length) { txt(c, `robots ${robots.length}   build queue ${BP.ghosts.length + BP.clears.length}   loose ${matter.total().toFixed(0)} kg`, w - 28, ry, { align: 'right', a: 0.6 }); ry += 15; for (const r of robots.slice(0, 6)) { const j = r.job, kg = inv.mass(r.cargo); txt(c, `robot ${r.id}  ${j && j.kind === 'carry' ? (r.state === 'cfetch' ? 'to ' : 'carrying ') + j.item + ' > ' + (j.dst.t === 'mach' ? j.dst.m.kind : j.dst.t === 'inv' ? 'hold' : j.dst.t === 'dump' ? 'spoil heap' : 'you') : r.state}${kg > 0.05 ? '  ' + kg.toFixed(0) + ' kg' : ''}  ${(r.wh / ROBOT.wh * 100).toFixed(0)}%`, w - 28, ry, { align: 'right', a: 0.4 }); ry += 13; } ry += 8; }
    if (S.printer.q.length) { const j = S.printer.q[0]; txt(c, `the arm is printing: ${j.r}  ${Math.ceil(j.left)} s${S.printer.q.length > 1 ? '  +' + (S.printer.q.length - 1) : ''}`, w - 28, ry, { align: 'right', col: AMBER, a: 0.7 }); ry += 18; }
    S.gains.forEach((g, i) => { drawIcon(c, g.id, w - 52, ry + i * 24 - 4, 22); txt(c, `+ ${fmtAmt(g.id, g.n) || 'x1'} ${g.id}`, w - 58, ry + i * 24 + 10, { align: 'right', a: Math.min(0.85, g.t) }); });
    // altitude tape and compass strip
    const alt = P.y; line(c, 28, h / 2 - 90, 28, h / 2 + 90, 0.25);
    for (let i = -4; i <= 4; i++) { const v = Math.round(alt / 5) * 5 + i * 5, yy = h / 2 - (v - alt) * 4; if (Math.abs(yy - h / 2) < 90) { line(c, 28, yy, 34, yy, 0.3); txt(c, v, 40, yy + 3, { a: 0.35 }); } }
    txt(c, `alt ${alt.toFixed(1)} m`, 46, h / 2 - 100); line(c, 22, h / 2, 34, h / 2, 0.8, AMBER);
    line(c, w / 2 - 160, 30, w / 2 + 160, 30, 0.25);
    for (let i = -8; i <= 8; i++) { const v = Math.round(P.x / 10) * 10 + i * 10, xx = w / 2 + (v - P.x) * 2; if (Math.abs(xx - w / 2) < 160) { line(c, xx, 30, xx, v % 50 === 0 ? 38 : 34, 0.3); if (v % 50 === 0) txt(c, v, xx, 50, { align: 'center', a: 0.35 }); } }
    line(c, w / 2, 24, w / 2, 36, 0.8, AMBER); txt(c, `x ${P.x.toFixed(0)} m   v ${Math.hypot(P.vx, P.vy).toFixed(1)} m/s   g ${GRAV} m/s2   ${sites.inside ? STORY.sites[sites.inside.kind === 'base' && sites.inside.research ? 'lab' : sites.inside.kind] : BIOME[biome(P.x)]}`, w / 2, 20, { align: 'center', a: 0.45 });
    if (S.msgT > 0) txt(c, S.msg, w / 2, 84, { align: 'center', col: AMBER, a: Math.min(0.85, S.msgT) });
    if (F.pad) txt(c, F.pad.n >= ROCKET_PARTS ? 'rocket ready: e at the pad to board' : `rocket ${F.pad.n}/${ROCKET_PARTS} parts`, 28, h - 208, { col: AMBER, a: 0.8 });
    txt(c, F.printer ? 'bio-printer online: body respawns there' : 'no bio-printer: death restarts at the crash site', 28, h - 192, { a: 0.4 });
    if (S.slice) { const o = objective(); txt(c, '> ' + o, 28, 40, { col: AMBER, a: 0.6 }); }
    txt(c, `${combat ? 'combat' : bp ? 'blueprint' : 'build'} mode`, w / 2, h - 80, { align: 'center', col: combat ? RED : AMBER, a: bp ? 0 : 0.8 });
    txt(c, combat ? 'lmb fire   rmb aim   r reload   1-9 weapon   c build mode' : bp ? '' : 'lmb ship laser   rmb place selected   v gather   x drop   q reactor   g laser legs   i inventory + arm   b blueprint   e use   f lamp', w / 2, h - 6, { align: 'center', a: 0.28 });
    const hint = kitHint() || sites.hint || (near ? `e  ${near.kind === 'pad' && near.n >= ROCKET_PARTS ? 'board the rocket' : 'open ' + near.kind}` : '');
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
      } else if (L.state !== 'held') txt(c, 'unarmed', mx, my + 30, { align: 'center', col: RED, a: 0.8 }); else { line(c, mx - 9, my, mx - 3, my, 0.7, RED); line(c, mx + 3, my, mx + 9, my, 0.7, RED); line(c, mx, my - 9, mx, my - 3, 0.7, RED); line(c, mx, my + 3, mx, my + 9, 0.7, RED); }
      for (const q of creatures) { if (!q.agg) continue; const sx = w / 2 + (q.x - S.cam.x) * S.ppm, sy = h / 2 - (q.y - S.cam.y) * S.ppm; if (sx > 0 && sx < w && sy > 0 && sy < h) { bracket(c, sx, sy, 14 + KIND[q.type].thick * 14, RED, 0.45); txt(c, `${q.type} ${Math.max(0, q.hp).toFixed(0)}`, sx + 20 + KIND[q.type].thick * 14, sy - 12, { col: RED, a: 0.5 }); } else { const a = Math.atan2(q.y - P.y, q.x - P.x); line(c, w / 2 + Math.cos(a) * 150, h / 2 - Math.sin(a) * 150, w / 2 + Math.cos(a) * 164, h / 2 - Math.sin(a) * 164, 0.8, RED); } }
    } else if (!bp) { line(c, mx - 9, my, mx - 3, my, 0.7); line(c, mx + 3, my, mx + 9, my, 0.7); line(c, mx, my - 9, mx, my - 3, 0.7); line(c, mx, my + 3, mx, my + 9, 0.7); }
    else { line(c, mx - 6, my, mx + 6, my, 0.5, AMBER); line(c, mx, my - 6, mx, my + 6, 0.5, AMBER); for (const g of BP.ghosts) if (!g.have && !S.has({ [g.kind === 'wall' ? 'iron' : g.kind]: g.kind === 'wall' ? 3 : 1 }) && !robots.length) { const sx = w / 2 + ((g.x + 0.5) * TS - S.cam.x) * S.ppm, sy = h / 2 - ((g.y + 1.5) * TS - S.cam.y) * S.ppm; txt(c, 'missing ' + (g.kind === 'wall' ? 'iron' : g.kind), sx, sy - 14, { align: 'center', col: RED, a: 0.55 }); } }
  },
  hide() { ui.update(false); },
};
const r3 = v => +v.toFixed(3);
function dumpSurface() {
  return { p: { x: r3(P.x), y: r3(P.y), vx: r3(P.vx), vy: r3(P.vy), hp: r3(P.hp), wh: r3(P.bat.wh), o2: +P.o2.toFixed(5), prop: r3(P.prop), slot: P.slot, mag: { ...P.mag }, lamp: light.lamp.on ? 1 : 0 },
    inv: inv.dump(S.inv), printer: S.printer.q.map(j => [j.r, r3(j.left), j.total]), corpse: S.corpse, mode: S.mode, crash: S.crash ? 1 : 0, slice: S.slice ? [r3(DIR.t), DIR.pred] : 0, calm: r3(S.calm), stats: { ...S.stats, kills: { ...S.stats.kills }, dug: r3(S.stats.dug), vapor: r3(S.stats.vapor) },
    terrain: world.saveDiff(), flora: [...flora.dead].sort(), factory: dumpFactory(), bp: dumpBP(), robots: dumpRobots(), sites: dumpSites(), hive: dumpHive(), env: env.dump(), kit: dumpKit(), matter: matter.dump(), supply: dumpSupply() };
}
function loadSurface(o) {
  resetStructs(); world.loadDiff(o.terrain); resetFlora(); flora.dead = new Set(o.flora); creatures.length = 0; S.bullets.length = 0; S.parts.list.length = 0; heat.clear(); auto = null;
  const p = o.p; Object.assign(P, { x: p.x, y: p.y, vx: p.vx, vy: p.vy, hp: p.hp, o2: p.o2, prop: p.prop, slot: p.slot, dead: 0, ground: false, reload: 0, act: null, stumble: 0 }); P.bat.wh = p.wh; P.mag = { ...p.mag }; light.lamp.on = !!p.lamp; for (const f of P.rig.f) f.air = true;
  inv.load(S.inv, o.inv); S.printer.q = o.printer.map(([r, left, total]) => ({ r, left, total })); S.corpse = o.corpse; S.mode = o.mode; S.crash = !!o.crash; S.slice = !!o.slice; DIR.t = o.slice ? o.slice[0] : 0; DIR.pred = o.slice ? o.slice[1] : 0; S.calm = o.calm; S.stats = { ...o.stats, kills: { ...o.stats.kills } }; S.open = null; S.uiOpen = false; S.gains.length = 0;
  loadFactory(o.factory); loadBP(o.bp); loadKit(o.kit); loadRobots(o.robots); loadSites(o.sites); loadHive(o.hive); env.load(o.env); matter.load(o.matter); loadSupply(o.supply);
  S.cam.x = P.x; S.cam.y = P.y + 2.2; horizon = surfaceH(P.x);
}
// hooks for tools: time of each draw stage in ms, and the live state
surface.profile = n => { const b = S.batch, t = {}, T = (k, f) => { const t0 = performance.now(); for (let i = 0; i < n; i++) f(i); t[k] = +((performance.now() - t0) / n).toFixed(2); };
  T('floraBack', i => { b.begin(S.cam.x, S.cam.y, S.ppm); drawFlora(b, i * 0.016, false); t.sprites = b.n; }); T('floraFront', i => { b.begin(S.cam.x, S.cam.y, S.ppm); drawFlora(b, i * 0.016, true); }); T('backdrop', i => { drawBackdrop(S.cam.x, S.cam.y, S.ppm, i * 0.016, 0); t.backSprites = backdrop.batch.n; }); T('sites', i => drawSites(b, i)); T('parts', () => S.parts.draw(b, 1.2)); T('end', () => b.end());
  T('light', i => computeLight(S.cam.x / TS, S.cam.y / TS, i)); T('terrain', i => updateTerrain(S.cam.x, S.cam.y, S.ppm, i, 0)); T('window', () => { world.rev++; updateTerrain(S.cam.x, S.cam.y, S.ppm, 0, 0); }); return t; };
surface.debug = { S, P, F, BP, K, SUP, robots, creatures, hive, env, flora, world, sites, matter, heat, backdrop, siteUse, kitUse, spawnCreature, spawnHerd, hurt, slotStruct, structsIn, stance, KIND };

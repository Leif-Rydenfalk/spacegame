// Act 1, the surface: wires the density world, light, heat, the layered forest, the player and the kit (ship laser,
// reactor, network), loose matter, creatures, the factory, blueprints, robots, the demand and supply AI, sites and the
// hivemind into one act, draws the HUD, and registers the act with the save module.
import { G, input, events, lerp, clamp, rand, hash } from '../core.js';
import { R, Batch } from '../render.js';
import { audio } from '../audio.js';
import { txt, line, bar, bracket, AMBER, RED, INK } from '../hud.js';
import { drawIcon } from '../icons.js';
import { inv, fmtAmt, ITEMS, RECIPES } from '../items.js';
import { inv as inv2 } from '../items.js';
import { save } from '../save.js';
import { ui } from '../ui.js';
import { STORY } from '../story.js';
import { world, TS, GRAV, M, surfaceH } from './world.js';
import { biome, homeDist, CIRC, RAD } from './gen.js';
import { planet } from './planet.js';
import { light, initLight, computeLight, LW, LH } from './light.js';
import { initTerrain, updateTerrain, stepHeat, view, profileTex } from './terrain.js';
import { S, C, mul, canSee } from './state.js';
import { env } from './env.js';
import { P, SUIT, WEAPON, spawnAt, stepPlayer, stepBullets, drawPlayer, hurt, bodyDepth } from './player.js';
import { creatures, stepCreatures, drawCreatures, spawnCreature, spawnHerd, KIND, stance } from './creatures.js';
import { F, ROCKET_PARTS, nearest, stepFactory, drawFactory, buildScenario, place, dumpFactory, loadFactory } from './factory.js';
import { BP, stepBlueprint, drawBlueprint, addGhost, dumpBP, loadBP, cursorKind, tryPlace, plannable, unlocked, setBlueprint, toolSlot, pageOf, copyArea, pasteBlueprint, deconArea, upgradeArea, beltPath, snapPort, placeReal, acceptProposal, padFor, dismantle } from './blueprint.js';
import { PL, addPlat, platAt, drawPlats, dumpPlats, loadPlats, shiftPlats } from './layers.js';
import { robots, stepRobots, drawRobots, spawnRobot, wakeShipRobots, dumpRobots, loadRobots, ROBOT, intentOf, AUDIT, resetAudit } from './robots.js';
import { flora, stepFlora, drawFlora, resetFlora, treesIn, markTrees, treeRec, treeCut, treeSaw, treeJobs, dumpTrees, loadTrees } from './flora.js';
import { sites, stepSites, drawSites, siteUse, siteDamage, dumpSites, loadSites } from './sites.js';
import { hive, stepHive, dumpHive, loadHive, sendWave } from './hive.js';
import { structsIn, slotStruct, resetStructs } from './structures.js';
import { backdrop, initBackdrop, drawBackdrop } from './backdrop.js';
import { heat } from './heat.js';
import { matter, matterHeat } from './matter.js';
import { K, SHIP, kitReset, kitUse, kitHint, stepKit, drawKit, drawKitBeam, drawWreck, reactorPos, dumpKit, loadKit, isLinked, firePulse } from './kit.js';
import { mobility, REACTOR_W, LASER_W, SUIT_BUS_W, CABLE, SHIP_LINK } from './power.js';
import { SUP, stepSupply, dumpSupply, loadSupply, holdRoom, shopOk, shopSpeed, armEta, bidProducers, whoName } from './supply.js';
import { FILL, BERM, addFill, fillPut, drawFills, dumpFills, loadFills, backfillShaft, pickSpoilSite, spoilSiteX, baseSpan } from './spoil.js';
import { RIG, binKg } from './things.js';
import { RECIPE, SHOP, toolRecipe, toolCan, producersOf, yieldOf } from '../items.js';
import { kerfWoodJ, pulsesToFell, sawTime, logsOf, WOOD } from './physics.js';
import { stepLife, drawLife } from './life.js';
import { AUTO, PORT, queueView, drawAuto, dumpAuto, loadAuto } from './auto.js';
import { EXO, BOOT, BOOT_LINES, NEEDS, MASK, DAY, suitStats, resetSuit, dumpSuit, loadSuit, needWorst, repairSuit } from './suit.js';
import { WRECK, HULL, wreckReset, wreckUse, wreckHint, stepWreck, toWorld, partNamed, repairBill, atDoor, enterWreck, dumpWreck, loadWreck } from './wreck.js';
import { MINE, stepMine, drawMine, dumpMine, loadMine, spawnRock, spanAt, addSupport } from './mine.js';
import { GEO, dumpGeo, loadGeo, levelAt, estimate, fmtEst, composition, mark } from './geology.js';
import { FOG, stepFog, stepScan, drawFog, visible, knownG, knownR, storageCap, dumpFog, loadFog, scanDone } from './fog.js';
import { STOCK, drawZones, zoneKg, reachable, ledger, addZone, zoneFor, dumpStock, loadStock, removeZone } from './stock.js';
import { NET, drawNet } from './net.js';
import { stepCollide, HIT, impact, STEP } from './collide.js';
import { nextSteps, STAGES } from './next.js';
import { MARKET } from './robots.js';
import { LOG } from './market.js';
import { thingUse } from './things.js';
import { SINK_J, PULSE_HEAT_J, LASERP, pulseArea, kerfPerPulse } from './physics.js';
import { orderItem } from './supply.js';
import { M as MATS } from './gen.js';

let near = null, auto = null, horizon = 0, thudT = 0, shiftT = 0;
const ZMAX = 104, sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }, scr = [0, 0];
// where a world point is on the screen, through the camera that looks along local down
const toScr = (x, y) => planet.toScreen(S.cam, S.ppm, G.w, G.h, x, y, scr);
S.toScr = toScr;
// the planet's chart moved: everything this act holds a position for is re-expressed in it (planet.js)
planet.onShift((fx, fg) => {
  const d = fx(P.x) - P.x;
  if (d) { P.x += d; S.cam.x += d; S.mouse.x += d; for (const f of P.rig.f) for (const k of ['x', 'tx', 'sx', 'px']) if (typeof f[k] === 'number') f[k] += d; for (const p of S.parts.list) p.x = fx(p.x); for (const l of S.lights) l.x = fg(l.x); for (const b of S.bullets) b.x = fx(b.x); heat.clear(); resetFlora(); if (S.corpse && typeof S.corpse.x === 'number') S.corpse.x = fx(S.corpse.x); }
  for (const c of creatures) { const e = fx(c.x) - c.x; if (!e) continue; c.x += e; for (const n of c.nodes) n.x += e; for (const l of c.legs || []) { l.fx += e; if (l.t >= 0) { l.sx += e; l.tx += e; } } if (c.goal) c.goal.x = fx(c.goal.x); if (c.home) c.home.x = fx(c.home.x); }
  for (const r of robots) { const e = fx(r.x) - r.x; r.x += e; if (e && r.path) r.path = null; }
  for (const c of matter.list) c.x = fx(c.x);
  for (const q of [K.reactor, K.laser]) if (q.state === 'ground' || q.state === 'turret') q.x = fx(q.x); for (const n of K.cable.concat(K.cable2)) { const e = fx(n.x) - n.x; n.x += e; n.px += e; }
  let moved = false; for (const m of F.machines) { const g = fg(m.x); if (g !== m.x) { m.x = g; moved = true; } } for (const it of F.items) it.x = fg(it.x);
  if (moved) { F.cells.clear(); for (const m of F.machines) for (let i = 0; i < m.w; i++) for (let j = 0; j < m.h; j++) F.cells.set((m.x + i + 32768) * 65536 + (m.y + j + 32768), m); }
  shiftPlats(fg); for (const g of BP.ghosts) g.x = fg(g.x); for (const c of BP.clears) { const e = fx(c.x0) - c.x0; c.x0 += e; c.x1 += e; }
  for (const e of env.events) e.x = fx(e.x);
});
const BIOME = ['fungal forest', 'violet thicket', 'acid marsh'], DIR = { t: 0, pred: 0 };
flora.drop = (id, n, x, y) => matter.spawn(id, n, x, y, rand(-0.8, 0.8), rand(0.5, 2));
S.shakeBy = v => { G.shake += v; };
F.spill = (id, n, x, y) => { matter.spawn(id, n, x, y, rand(-0.4, 0.4), 0.6); };      // what falls off a belt lies on the ground: nothing on a belt is lost
F.onShaftGone = m => { const f = backfillShaft((m.x + m.w / 2) * TS, m.y * TS, m.depth || 0, RIG.width); if (f) LOG.say(`the shaft at ${((m.x + 1) * TS).toFixed(0)} m is open and its rig is gone: it is backfilled with spoil, ${f.need.toFixed(0)} kg`, G.time); };
STOCK.ghosts = () => BP.ghosts; STOCK.onOpen = z => { if (z.name === 'spoil heap') LOG.say(`spoil heap sited ${Math.abs(z.x0 + 3.5 - SHIP.x).toFixed(0)} m ${z.x0 < SHIP.x ? 'west' : 'east'} of the wreck: level ground, clear of the base`, G.time); };
// a falling trunk strikes what is under it, by the speed of the part of it that reaches the body (collide.js impact)
flora.hurt = (c, a, b) => { const ex = b[0] - a[0], ey = b[1] - a[1], L2 = ex * ex + ey * ey, hitAt = (x, y) => { const u = clamp(((x - a[0]) * ex + (y - a[1]) * ey) / L2, 0, 1); return Math.hypot(x - a[0] - ex * u, y - a[1] - ey * u) < 0.7 ? u : -1; };
  if (!P.dead && !(c.hitP > G.time)) { const u = hitAt(P.x, P.y + 1); if (u > 0.15) { const h = impact(c.d * c.H * 0.02 * WOOD.rho * 0.5, c.w * c.H * u); if (h.dmg > 0) { c.hitP = G.time + 3; hurt(h.dmg, c.dir * 2, 0); events.emit('treeHit', { dmg: h.dmg }); } } }
  for (const q of creatures) { if (q.hp <= 0 || q.treeT > G.time) continue; const u = hitAt(q.x, q.y); if (u > 0.15 && c.w * c.H * u > STEP.hurtV) { q.treeT = G.time + 3; q.hp -= impact(20, c.w * c.H * u).dmg; q.hurtT = 3; } } };
F.sink = (cx, y, id, n) => S.crash && cx === PORT.x && y === PORT.y ? inv.add(K.hold, id, n) : null;      // a belt that ends at the wreck's intake feeds the ship hold
S.loose = (id, n, x, y) => matter.spawn(id, n, x, y, rand(-1, 1), rand(1, 3));       // what a kill or a broken thing leaves lies in the world
S.thud = (c, v) => { if (thudT > 0 || Math.abs(c.x - P.x) > 16) return; thudT = 0.09; audio.play(c.kg > 20 ? 'thud' : 'tink'); env.noise(c.x, c.y, 6 + Math.min(14, c.kg * 0.3)); };
events.on('openHold', () => { S.open = { kind: 'hold', title: 'hold', inv: K.hold }; S.uiOpen = true; });
S.visible = visible; S.reach = k => { const r = reachable(k, SUP.ledger || ledger(), robots.length); return r.n - S.count(k); };
events.on('openMachine', m => { if (!ui.open) ui.openMachine(m); });
// rock that breaks: dust, grit, a crack you hear
S.crack = (c, parts) => { if (Math.abs(c.x - P.x) > 30) return; for (let i = 0; i < 6; i++) S.parts.spawn({ x: c.x + rand(-c.r, c.r), y: c.y + rand(-c.r, c.r), vx: c.vx * 0.3 + rand(-2.5, 2.5), vy: c.vy * 0.3 + rand(-0.5, 3), life: rand(0.3, 0.9), size: rand(0.03, 0.07), c: mul(ITEMS[c.id].c || C.steel, 0.5), mode: 1, shape: 0, col: 1, bounce: 0.3 }); for (let i = 0; i < 3; i++) S.parts.spawn({ x: c.x, y: c.y, vx: rand(-1, 1), vy: rand(0, 1), life: rand(0.6, 1.4), size: rand(0.2, 0.4), grow: 1.5, c: [0.16, 0.15, 0.16], mode: 1, a: 0.3, grav: 0.03, drag: 2 }); if (thudT <= 0) { thudT = 0.07; audio.play('tink'); env.noise(c.x, c.y, 14); } };
function give(list, into = S.inv) { for (const [k, n] of list) inv.add(into, k, n); }
const baseKit = () => give([['iron', 24], ['copper', 6], ['basalt', 30], ['o2 cell', 1], ['power cell', 1]]);
// the wreck's hold as it lies after the crash: metal, water, food, a spare cell, and what the machine shop was stocked
// with: a little powder and polymer, a spare controller and two spare boards (round 7: nothing here makes a chip but the arm)
const holdKit = () => give([['iron', 14], ['copper', 6], ['o2 cell', 1], ['water', 40], ['ration', 6], ['metal powder', 4], ['polymer', 5], ['controller', 1], ['pcb', 2]], K.hold);
// the planners are data: the AI hands them over when it comes up (one of each; a new empty blueprint is free in the inventory window)
export const PLANNERS = ['blueprint', 'blueprint book', 'deconstruction planner', 'upgrade planner'];
export function grantPlanners() { for (const k of PLANNERS) if (S.count(k) < 1 && !(S.crash && inv.count(K.hold, k) >= 1)) { const free = S.inv.slots.findIndex((q, i) => !q && i >= 9); if (free >= 0) { S.inv.slots[free] = { id: k, n: 1 }; S.known.add(k); } } }
const guns = () => give([['rifle', 1], ['shotgun', 1], ['rifle rounds', 120], ['shells', 18]]);
const flatten = (x0, x1) => { world.box(x0, 0, x1, 14, -1); world.box(x0, -1.5, x1, 0, 1, M.BASALT); };
// the ground the slice is played on: an outcrop of basalt with a seam of iron ore in it, east of the wreck
function sliceGround() {
  const seam = (x, y) => Math.hypot((x - 14.2) / 1.7, (y - 0.5) / 1.15) * 1.15 - 1.15, rock = (x, y) => Math.hypot((x - 13.6) / 2.9, (y - 0.7) / 2.4) * 2.4 - 2.4 + Math.sin(x * 2.3 + y) * 0.16, low = (x, y) => Math.hypot((x - 9.2) / 1.2, (y + 0.05) / 0.6) * 0.6 - 0.6;
  world.shape(12, -1.2, 16.4, 2, seam, -1); world.shape(12, -1.2, 16.4, 2, seam, 1, M.IRON); world.shape(10, -2, 17.2, 3.6, rock, 1, M.BASALT); world.shape(7.6, -1, 10.8, 0.8, low, 1, M.BASALT);
}
function antennaUp(gx = 4) { const m = place('antenna', gx, 0, 1, true); return m; }
// ---- round 6 scenarios: one for each thing the round delivers (tools/check.mjs opens every one) ---------------------------
const aimAt = (x, y) => { toScr(x, y); input.mx = scr[0]; input.my = scr[1]; };
const base6 = (x, robotsOn = true) => { S.slice = true; sliceGround(); spawnAt(x); if (robotsOn) wakeShipRobots(); hive.quiet = true; S.stats.dug = 400; S.stage = 3; holdKit(); give([['o2 cell', 1], ['power cell', 1]]); light.lamp.on = true; mark(13.6, 0.8, 5, 1); };
// ---- round 7 scenarios: one for each fix (docs/ROUND7.md section 1, and section 7) -----------------------------------------
const flat7 = (x0, x1) => { flatten(x0, x1); flora.clear = [x0, x1]; };
const ROUND7 = {
  // 1 loose rock: a pile across the way, and the body sprints at it: up, over and down the other side, unhurt
  rockwalk() { base6(-2, false); flat7(-6, 26); spawnAt(0); kitReset('wreck'); const rk = [[22, 3.2], [9, 3.9], [30, 4.4], [14, 4.9], [26, 5.3], [7, 5.9], [38, 6.4], [18, 6.9], [11, 7.4], [28, 7.9], [45, 9.6], [16, 10.2]]; for (const [kg, x] of rk) matter.spawn('basalt', kg, x, 0.6 + (x % 1) * 0.8); for (const [kg, x] of [[16, 4.4], [12, 5.6], [20, 6.6]]) matter.spawn('basalt', kg, x, 1.5);
    S.rock0 = { hp: 100, x: 0 }; return () => { input.keys.delete('d'); input.keys.delete('Shift'); if (G.auto && G.time > 2.5 && !S.rock0.done) { input.keys.add('d'); input.keys.add('Shift'); if (P.x > 13.5) { S.rock0.over = true; } if (S.rock0.over) { input.keys.delete('d'); input.keys.add('a'); if (P.x < 6.6) S.rock0.done = true; } } if (S.rock0.done) input.keys.delete('a'); aimAt(P.x + 4, P.y + 1.4); }; },
  // 2 the idle audit: work of every kind, three robots, and the window that says who is idle and why
  idleaudit() { base6(4); place('furnace', -2, 0, 1, true); give([['basalt', 60], ['iron', 30], ['copper', 8], ['chest', 1], ['controller', 1]], K.hold); for (let i = 0; i < 10; i++) matter.spawn('iron ore', 3 + (i % 3) * 2, 8 + i * 0.45, 0.6 + (i % 2) * 0.3); for (let i = 0; i < 6; i++) spawnRock(MATS.BASALT, 5 + i, 6.2 + i * 0.6, 1.2);
    matter.spawn('basalt', 70, 20, 0.8); const hot = matter.spawn('basalt', 9, 22, 0.8); hot.temp = 6; addGhost('chest', 21, 0); addGhost('assembler', 16, 0); SUP.targets = { iron: 20 }; ui.toggleAI(true); },
  // 3 deconstruction: a worn furnace, a chest with iron in it, a line of belt and two decks, all inside one drag of the planner
  decon() { base6(3); flat7(6, 30); const f = place('furnace', 16, 0, 1, true); f.hp = 132; const ch = place('chest', 20, 0, 1, true); inv.add(ch.inv, 'iron', 12); for (let x = 10; x < 15; x++) place('belt', x, 0, 1, true); addPlat(24, 1); addPlat(25, 1); addPlat(24, 0); addPlat(25, 0); grantPlanners(); const i = S.inv.slots.findIndex(q => q && q.id === 'deconstruction planner'); S.inv.slots[2] = S.inv.slots[i]; S.inv.slots[i] = null; P.slot = 2; SUP.targets = {}; P.x = -1; aimAt(10, 1.4); S.decon0 = deconArea(9, 0, 27, 4); return () => aimAt(10, 1.4); },
  // 4 belts like Factorio: a line dragged from the furnace's port, along the ground, up a lift and along a deck into the assembler's port; lumps riding it
  belts() { base6(2); flat7(2, 34); world.box(18.5, 0, 30, 2, 1, MATS.BASALT); K.reactor.state = 'ground'; K.reactor.x = 4; K.reactor.y = 0.4; const fu = place('furnace', 12, 0, 1, true); fu.inp['iron ore'] = 80; fu.out.iron = 320; const as = place('assembler', 44, 4, 1, true); as.recipe = 'part';
    for (const [x, y, d] of beltPath({ x: 14, y: 0, dir: 1 }, 36, 3)) placeReal('belt', x, y, d, true); for (const [x, y, d] of beltPath({ x: 36, y: 4, dir: 1 }, 43, 4)) placeReal(x > 39 ? 'fast belt' : 'belt', x, y, d, true);
    S.add('belt', 12); P.slot = S.inv.slots.findIndex(q => q && q.id === 'belt'); SUP.targets = {}; SUP.on = false; P.x = 13; aimAt(15.2, 3.2); },
  // 4b the AI proposes, it does not lay: a furnace and an assembler on level ground; in blueprint mode the line it would lay is drawn, and waits for y
  propose() { S.slice = true; spawnAt(10.6); antennaUp(-3); wakeShipRobots(); hive.quiet = true; S.stats.dug = 400; S.stage = 3; give([['belt', 8], ['iron', 30], ['copper', 6]], K.hold); give([['o2 cell', 1], ['power cell', 1]]); light.lamp.on = true;
    const f1 = place('furnace', 2, 0, 1, true), as = place('assembler', 14, 0, 1, true); f1.inp['iron ore'] = 70; as.recipe = 'part'; SUP.targets = { iron: 20, part: 6 }; S.mode = 'blueprint'; aimAt(4, 1.2); },
  // 5 the planners are items: a blueprint that holds a small line, pasted once and on the cursor again; the book, the two planners in their slots
  planners() { base6(3); flat7(4, 40); place('chest', 12, 0, 1, true); place('furnace', 15, 0, 1, true); for (let x = 17; x < 20; x++) place('belt', x, 0, 1, true); const as = place('assembler', 20, 0, 1, true); as.recipe = 'chest'; grantPlanners(); give([['iron', 80], ['basalt', 60], ['copper', 12], ['belt', 8], ['controller', 2]], K.hold);
    const put = (k, slot) => { const i = S.inv.slots.findIndex(q => q && q.id === k); const a = S.inv.slots[slot]; S.inv.slots[slot] = S.inv.slots[i]; S.inv.slots[i] = a; return S.inv.slots[slot]; }, bp = put('blueprint', 0), bk = put('blueprint book', 1); put('deconstruction planner', 2); put('upgrade planner', 3);
    bp.d = { bp: copyArea(12, 0, 23, 3) }; bk.d = { pages: [copyArea(15, 0, 20, 3), copyArea(12, 0, 14, 3)], sel: 0 }; pasteBlueprint(bp.d.bp, 31, 0); S.up0 = upgradeArea(17, 0, 20, 1); P.slot = 0; SUP.targets = {}; P.x = 22; aimAt(28, 0.3); return () => aimAt(28.2, 0.3); },
  // 6 the shaft rig hoists everything: the bucket on its rope, the collar bin filling, a drone taking from it, nothing lying at the face
  collar() { base6(1); const m = place('shaft rig', 12, 0, 1, true); m.target = 6; m.head = 'rotary'; m.inp['drill rod'] = 6; m.inp.casing = 6; m.paid = 2; give([['drill rod', 8], ['casing', 8], ['iron', 30]], K.hold); K.reactor.state = 'ship'; SUP.targets = {}; P.x = 9; aimAt(12.4, -1.5); },
  // 7 spoil: the heap far from the base on the back layer, a berm going up on the hive's side, a pad under a machine planned on a slope
  spoil() { base6(2); flat7(-2, 30); world.box(10.9, -1.2, 12.1, 0, -1, 0); place('furnace', 8, 0, 1, true); place('chest', 12, 0, 1, true); place('assay station', 16, 0, 1, true); give([['iron', 40], ['chest', 2], ['basalt', 40]], K.hold); for (let i = 0; i < 26; i++) matter.spawn(i % 5 === 4 ? 'soil' : 'basalt', 16 + (i % 4) * 5, 3 + (i % 13) * 0.9, 0.8 + (i % 3) * 0.5);
    S.mode = 'blueprint'; S.plan = 'chest'; tryPlace('chest', 22, 0, false); S.plan = null; S.mode = 'build'; SUP.targets = {}; P.x = 14; aimAt(22, 2); return () => aimAt(P.x + 8, 2.4); },
  // 7b the same later, from the other side: the body walks past the heap, in front of it
  heap() { base6(2); flat7(-70, 30); place('furnace', 8, 0, 1, true); place('chest', 12, 0, 1, true); const z = addZone('spoil heap', ['basalt', 'soil', 'slag'], -52, 7, 12000, true); for (let i = 0; i < 34; i++) { const c = matter.spawn(i % 5 === 4 ? 'soil' : 'basalt', 14 + (i % 4) * 7, -55 + (i % 9) * 0.75, 0.8 + Math.floor(i / 9) * 0.6); c.zone = z.id; c.back = true; }
    matter.spawn('basalt', 30, -49.6, 0.8); SUP.targets = {}; SUP.on = false; spawnAt(-58); S.heap0 = { hp: 100 }; return () => { input.keys.delete('d'); if (G.auto && P.x < -49.2) input.keys.add('d'); aimAt(P.x + 3, P.y + 1.5); }; },
  // 8 a tree against the laser: the trunk charring, the kerf a part of the way through, the count of pulses still to go
  trees() { base6(30, false); kitReset('carried'); let t0 = null, st = 0; return () => { if (!t0) { const ts = treesIn(P.x - 40, P.x + 60).filter(q => q.st === 0 && q.d < 0.62).sort((a, b) => Math.abs(a.x - P.x - 6) - Math.abs(b.x - P.x - 6)); if (!ts.length) return; t0 = ts[0]; spawnAt(t0.x - 3.2); K.reactor.state = 'ground'; K.reactor.x = t0.x - 4.4; K.reactor.y = world.groundY(t0.x - 4.4, P.y + 3, 0, 8) + 0.4; S.tree0 = t0.id; }
      const c = treeRec(t0.id), ty = t0.y + 0.6; if (c && c.st === 2) { const L = logsOf(c.H, c.d), u = (c.sec + 0.5) / L.n * WOOD.trunk; aimAt(c.x + Math.sin(c.ang) * c.dir * c.H * u, c.y + 0.3 + Math.cos(c.ang) * c.H * u); } else aimAt(t0.x, ty); input.down[0] = G.auto && (!c || c.st !== 1); }; },
  // 8b felling as a job: two trees marked with the deconstruction planner; the drones saw them, they fall, and are cut into logs
  felling() { base6(30); let done = false; SUP.targets = {}; return () => { if (done) { aimAt(P.x + 5, P.y + 3); return; } const ts = treesIn(P.x - 30, P.x + 40).filter(q => q.st === 0).sort((a, b) => Math.abs(a.x - P.x - 8) - Math.abs(b.x - P.x - 8)); if (ts.length < 1) return; done = true; const t0 = ts[0]; spawnAt(t0.x - 7); for (const t of ts.slice(0, 2)) markTrees(t.x - 0.2, t.y - 1, t.x + 0.2, t.y + 1, true); S.tree0 = t0.id; }; },
  // the tools by real input (tools/ui-flow.mjs): belts in slot 5, the four planners in slots 1 to 4, a worn furnace to work on, level ground
  tools7() { base6(10, false); flat7(2, 34); const f = place('furnace', 26, 0, 1, true); f.hp = 110; grantPlanners(); PLANNERS.forEach((k, i) => { const j = S.inv.slots.findIndex(q => q && q.id === k), a = S.inv.slots[i]; S.inv.slots[i] = S.inv.slots[j]; S.inv.slots[j] = a; }); S.inv.slots[4] = { id: 'belt', n: 12 }; S.known.add('belt'); SUP.on = false; SUP.targets = {}; P.slot = 8; P.x = 10; aimAt(12, 2); },
  // section 7: the ship has no matter compiler. A chest goes to the mill in the wreck, a camera to the powder printer, a board to the bench; the chip is the arm's
  shop() { base6(4); give([['iron', 40], ['copper', 10], ['basalt', 30], ['silicon', 2]], K.hold); for (const [k, n] of [['iron', 3], ['copper', 2], ['silicon', 1], ['basalt', 44]]) S.add(k, n); addGhost('chest', 16, 0); addGhost('furnace', 12, 0); orderItem('camera', 1, 'stock'); orderItem('pcb', 3, 'stock'); orderItem('cpu', 2, 'stock'); SUP.targets = { iron: 10 }; K.reactor.state = 'carried'; ui.toggleAI(true); },
};
const ROUND6 = {
  // the new start played by itself: out of the bunk, aft to the locker, the suit on, the boot
  suitup() { S.slice = true; S.dev = false; kitReset('wreck'); sliceGround(); resetSuit(false); holdKit(); const bp = toWorld(partNamed('bunk').lx + 0.1, 0); spawnAt(bp[0]); enterWreck(true); P.o2 = MASK.bare; light.lamp.on = false; hive.quiet = true; const lx = toWorld(partNamed('suit locker').lx, 0)[0];
    return () => { input.keys.delete('a'); if (!G.auto || EXO.on) return; if (P.x > lx + 0.35) input.keys.add('a'); else if (!P.act) wreckUse(false); }; },
  // the inside of the wreck, suited, the AI up: the rooms, the parts, one of them under the hands
  interior() { base6(-4.5, false); kitReset('wreck'); holdKit(); spawnAt(toWorld(partNamed('table').lx - 0.5, 0)[0]); enterWreck(true); WRECK.lit = 1; WRECK.cut = 1; partNamed('turbopump').gone = true; S.zoom = 1.75; input.mx = G.w / 2 + 120; input.my = G.h / 2 - 20; },
  // a kerf through the shoulder of the outcrop: the slot goes in, comes out, and the cap it cut off falls as blocks
  kerf() { base6(9.4, false); kitReset('carried'); K.reactor.state = 'ground'; K.reactor.x = 8.2; K.reactor.y = 0.4; K.laser.mode = 'kerf'; aimAt(12.6, 3.1); return () => { aimAt(12.6, 3.1); input.down[0] = G.auto && MINE.freed < 1; }; },
  // pulses into the ground with the reactor on the back: the sink fills, the HUD counts the pulses that are left
  heat() { base6(6, false); kitReset('carried'); aimAt(8.5, -0.4); return () => { aimAt(8.5 + Math.sin(G.time) * 0.6, -0.4); input.down[0] = G.auto; }; },
  // fists: no laser, combat mode, the first workers of a hive that has found you
  fists() { base6(2, false); kitReset('wreck'); S.mode = 'combat'; for (const [t, x] of [['swarmer', 5.2], ['swarmer', 6.4], ['scout', 8], ['swarmer', -2.5], ['soldier', 10]]) { const c = spawnCreature(t, x, 1, { x: 0, y: 1 }); c.state = 'charge'; c.order = 'attack'; }
    let t = 0; return dt => { if (!G.auto) return; let b = null, bd = 1e9; for (const c of creatures) { const d = Math.hypot(c.x - P.x, c.y - P.y - 1); if (d < bd && c.agg) { bd = d; b = c; } } if (b) aimAt(b.x, b.y); t -= dt; if (t <= 0 && b && bd < 1.6) { input.clicked[0] = true; t = 0.5; } P.hp = Math.max(P.hp, 55); S.flash = Math.min(S.flash, 0.3); }; },
  // the body defends itself: nobody touches the mouse, something bites, and it turns, fires, steps back
  defend() { base6(3, false); kitReset('carried'); for (const [t, x] of [['swarmer', 9], ['swarmer', 10.2], ['scout', 12], ['swarmer', -5], ['swarmer', 11.5], ['soldier', 14]]) { const c = spawnCreature(t, x, 1, { x: 0, y: 1 }); c.state = 'charge'; c.order = 'attack'; } input.mx = G.w / 2 - 300; input.my = G.h / 2 - 200; return () => { P.hp = Math.max(P.hp, 45); S.flash = Math.min(S.flash, 0.3); }; },
  // numbers are the threat: a wave of small bodies against the turret, its sink and you
  swarm() { base6(1.5, false); kitReset('carried'); K.reactor.state = 'ground'; K.reactor.x = 5.6; K.reactor.y = 0.4; K.laser.state = 'turret'; K.laser.x = 7.6; K.laser.y = 0; K.laser.ang = 0.1; S.mode = 'combat'; BOOT.done = true;
    for (let i = 0; i < 34; i++) { const c = spawnCreature(i % 7 === 3 ? 'scout' : i % 11 === 5 ? 'soldier' : 'swarmer', 15 + i * 0.75 + (i % 3) * 0.3, 1.2 + (i % 2) * 0.4, { x: 0, y: 1 }); c.state = 'charge'; c.order = 'attack'; } return () => { P.hp = Math.max(P.hp, 60); S.flash = Math.min(S.flash, 0.3); }; },
  // the task market: jobs of every class at once, batches, a kit that takes two drones, and the window that says why
  market() { base6(4); place('furnace', -2, 0, 1, true); give([['basalt', 60], ['iron', 30], ['copper', 8], ['chest', 1]], K.hold); for (let i = 0; i < 10; i++) matter.spawn('iron ore', 3 + (i % 3) * 2, 8 + i * 0.45, 0.6 + (i % 2) * 0.3); for (let i = 0; i < 8; i++) spawnRock(MATS.BASALT, 5 + i, 6.2 + i * 0.6, 1.2);
    addGhost('assembler', 16, 0); addGhost('chest', 21, 0); SUP.targets = { iron: 20 }; ui.toggleAI(true); },
  // a hauler on a ledge with no way down: it calls, the two drones hook on and carry it home
  rescue() { base6(4); world.box(15, 5, 18, 5.5, 1, MATS.BASALT); const h = robots.find(r => r.kind === 'crawler'); h.x = 16.5; h.y = 5.75; h.na = 1.57; SUP.on = false; aimAt(14, 4); },
  // stockpiles: the AI opens a zone for each class of loose stuff and the robots tidy everything into them
  stockpile() { base6(-13); for (let i = 0; i < 9; i++) matter.spawn(i % 3 === 0 ? 'iron ore' : i % 3 === 1 ? 'basalt' : 'lean ore', 6 + i, -4 - i * 0.6, 0.8); for (let i = 0; i < 5; i++) { inv2.nextQ = { fe: 0.11, cu: 0.0001, lm: 0, host: 2, ox: 30, oy: -3 }; matter.spawn('rubble', 8, 2 + i * 0.7, 0.8); } SUP.targets = {}; aimAt(-20, 2); },
  // in reach: the whole network as your inventory, each stack with its place and its time
  reach() { base6(3); const ch = place('chest', 10, 0, 1, true); for (const [k, n] of [['iron', 40], ['furnace', 1], ['belt', 8], ['rock bolt', 6]]) inv.add(ch.inv, k, n); give([['basalt', 50], ['assembler', 1], ['part', 2]], K.hold); for (const [k, n] of [['iron', 6], ['platform', 4]]) S.add(k, n); for (let i = 0; i < 4; i++) matter.spawn('iron ore', 7, 14 + i * 0.6, 1); stepSupply(1); ui.toggle(true); },
  // scan and assay: the ring of a scan on rock, the finds marked, the station sorting rubble into what it is
  assay() { base6(8.6); const m = place('assay station', 3, 0, 1, true); m.inp.rubble = 30; m.qIn = { ...composition(MATS.IRON, 14.2, 0.5), ox: 14.2, oy: 0.5 }; for (let i = 0; i < 4; i++) { inv2.nextQ = { ...composition(MATS.BASALT, 12, 1), ox: 12, oy: 1 }; matter.spawn('rubble', 9, 6 + i * 0.5, 0.8); } scanDone(13.2, 0.9, 2.6, 0.3); S.mode = 'blueprint'; aimAt(12.4, 1.2); return () => { aimAt(12.4, 1.2); input.keys.add('h'); }; },
  // the shaft rig: placed with a depth, paying a rod and a casing a metre, its hoist bringing the muck up
  shaft() { base6(1); const m = place('shaft rig', 12, 0, 1, true); m.target = 7; m.inp['drill rod'] = 3; m.inp.casing = 3; m.inp['hoist line'] = 1; m.inp['rotary head'] = 1; give([['drill rod', 8], ['casing', 8], ['iron', 30]], K.hold); K.reactor.state = 'ship'; SUP.targets = {}; P.x = 9; aimAt(12, -3); },
  // supports: a drift dug wider than its rock holds; the AI plans steel sets, the queue puts them first, the drones set them
  supports() { base6(1); flatten(18, 34); world.box(18, -7, 36, 0, -1, 0); world.box(18, -7, 36, 0, 1, MATS.BASALT); world.box(21, -3.4, 23.4, -1.5, -1, 0); world.box(19.6, -3.4, 21, 0.2, -1, 0); give([['steel set', 4], ['rock bolt', 8]], K.hold); MINE.watch.push({ x: 22.4, y: -2.4, t: 0 }); spawnAt(18.6); SUP.targets = {}; aimAt(24, -2); },
  // collapse: the same drift with nothing to hold it and nobody to help: dust, cracking, and then the roof
  collapse() { base6(1, false); flatten(18, 36); world.box(18, -7, 36, 0, -1, 0); world.box(18, -7, 36, 0, 1, MATS.BASALT); world.box(21, -3.6, 29.2, -1.7, -1, 0); world.box(19.6, -3.6, 21, 0.2, -1, 0); MINE.watch.push({ x: 25, y: -2.6, t: 0 }); spawnAt(18.4); P.x = 20.3; P.y = -3.5; aimAt(25, -2.4); return () => { P.hp = Math.max(P.hp, 30); }; },
  // wires, links, ranges: the grid as cable, the radio links, and every reach drawn (Alt)
  wires() { base6(6); K.reactor.state = 'ground'; K.reactor.x = -1; K.reactor.y = 0.4; K.laser.state = 'turret'; K.laser.x = 24; K.laser.y = 0; const f1 = place('furnace', 3, 0, 1, true); f1.inp['iron ore'] = 30; place('assembler', 22, 0, 1, true); place('power pole', 14, 0, 1, true); place('camera', 30, 0, 1, true); place('radar', 34, 0, 1, true); place('antenna', 40, 0, 1, true); for (let i = 0; i < 5; i++) matter.spawn('iron ore', 8, 19 + i * 0.5, 1); return () => { input.keys.add('Alt'); }; },
  // needs: the body's four needs on the HUD, the life support that came out of the wreck standing outside, furniture
  needs() { base6(8); Object.assign(NEEDS, { food: 0.22, water: 0.31, sleep: 0.18, toilet: 0.86 }); for (const [k, x] of [['pump', 20], ['air filter', 22], ['controller', 23], ['bunk', 26], ['table', 30], ['seat', 32], ['stairs', 35]]) place(k, x, 0, 1, true); K.reactor.state = 'ground'; K.reactor.x = 6; K.reactor.y = 0.4; P.o2 = 0.4; aimAt(13, 1.5); },
  // fog of war: one animal in sight, one that walked behind the outcrop (a ghost where it was last seen), one on the radar
  fog() { base6(6, false); place('radar', 0, 0, 1, true); K.reactor.state = 'ground'; K.reactor.x = -2; K.reactor.y = 0.4; spawnCreature('jelly', 9.6, 3.2); const b = spawnCreature('strider', 9.5, 1.6); b.seenT = G.time - 1; b.gx = 9.5; b.gy = 1.6; b.x = 19; b.nodes.forEach(n => { n.x += 9.5; }); const c2 = spawnCreature('grazer', 30, 1.2); c2.vx = 1; aimAt(12, 2); },
  // rock on decks, and a body against rock: a deck with a pile on it, a block you stand on
  deckrock() { base6(-3, false); flatten(-14, 14); world.box(2, -3, 6, 0.2, -1, 0); for (let gx = 4; gx < 12; gx++) addPlat(gx, -1); for (let i = 0; i < 10; i++) matter.spawn('basalt', 6 + i * 2, 2.6 + (i % 5) * 0.6, 2 + i * 0.5); matter.spawn('basalt', 70, -1.2, 0.6); P.x = -1.2; P.y = 1.4; aimAt(4, 1); },
  // what is known: the planet from far out, dark but for the slice the sensors have covered
  knowledge() { base6(-4.5, false); S.dev = false; FOG.x0 = -100; FOG.x1 = 120; S.zo = S.zoT = ZMAX; },
};
// the boot: the suit's interface core links to you, the one AI comes up on the wreck's core, and the HUD arrives line
// by line; at 4.3 s the robots are released and lift off, the lights in the wreck come on, the lamp is yours
function stepBoot(dt) {
  if (BOOT.t < 0 || BOOT.done) return; const t0 = BOOT.t; BOOT.t += dt;
  for (let i = 0; i < BOOT_LINES.length; i++) if (t0 < BOOT_LINES[i][0] && BOOT.t >= BOOT_LINES[i][0]) { BOOT.shown = i + 1; audio.play('click'); events.emit('bootLine', i); }
  if (t0 < 4.3 && BOOT.t >= 4.3) { if (S.crash) wakeShipRobots(); light.lamp.on = true; }
  if (BOOT.t >= 6.2) { BOOT.done = true; S.stage = Math.max(S.stage || 1, 2); if (S.crash) for (const q of K.hold.slots) if (q) S.known.add(q.id); P.bat.wh = Math.max(P.bat.wh, 300); P.o2 = Math.max(P.o2, MASK.suit * 0.8); P.prop = 2; grantPlanners(); events.emit('booted'); LOG.say('ai online: one system, and you are part of it', G.time); }
}
const up = t => BOOT.done || BOOT.t > t;
export const surface = {
  init() {
    initLight(); initTerrain(R.scenes.surface); S.batch = new Batch(R.scenes.surface, 46000, 10); S.batch.u.uLight.value = light.lightTex; S.batch.u.uSun.value.set(0.5, 0.86); S.batch.u.uRim.value.set(0.55, 0.8, 0.9);
    initBackdrop(R.scenes.surface); view.u.uBack.value = backdrop.rt.texture; S.P = P; S.hurt = hurt; ui.init();
    save.register('surface', { dump: dumpSurface, load: loadSurface });
  },
  start(scenario) {
    world.backWall = true; try { this.begin(scenario); } finally { world.backWall = false; }
  },
  begin(scenario) {
    planet.reset(); loadAuto(null); resetSuit(true); wreckReset(); loadMine(null); loadGeo(null); loadFog(null); loadStock(null); S.stage = 1; S.dev = !!scenario; S.inside = null; S.attacker = null; S.defend = 'always'; G.warp = 1; LOG.lines.length = 0; SUP.wanted = []; EXO.water = 0;
    K.fab = null; SUP.shop = {}; SUP.latent = []; loadFills(null); loadTrees(null); resetAudit(); BP.dmarks.length = 0; BP.belt = null; BP.box = null; S.printer.made = {}; S.printer.runs = {}; S.printer.n = 0; S.printer.bad = 0; EXO.arm = 1; flora.clear = null; HIT.hits = 0; HIT.climbs = 0; S.proposals = []; S.plan = null; S.tool = null; S.mode = 'build'; S.known = new Set(); PL.cells.clear(); S.zo = S.zoT = 1; input.mx = G.w / 2 + 260; input.my = G.h / 2 + 46; S.crash = true; S.slice = false; kitReset('carried'); DIR.t = 0; DIR.pred = 0;
    if (scenario === 'factory') { S.calm = 150; S.crash = false; hive.quiet = true; flora.clear = [-14, 10]; baseKit(); buildScenario(); spawnAt(-6); K.reactor.state = 'ground'; K.reactor.x = -8; K.reactor.y = 0.4; S.add('part', 6); S.add('biomass', 12); spawnCreature('grazer', 9, 1.2); }
    else if (scenario === 'blueprint') {     // a hub, three drones, a chest of kits, and a queue for them
      S.crash = false; hive.quiet = true; flora.clear = [-18, 18]; baseKit(); flatten(-16, 16); spawnAt(3); const hub = place('hub', -1, 0, 1, true), ch = place('chest', -6, 0, 1, true);
      for (const [k, n] of [['furnace', 1], ['assembler', 1], ['miner', 1], ['belt', 12], ['iron', 150], ['chest', 1]]) inv.add(ch.inv, k, n);
      for (let i = 0; i < 3; i++) spawnRobot(hub);
      addGhost('miner', 8, 0); for (let x = 10; x <= 13; x++) addGhost('belt', x, 0); addGhost('furnace', 14, 0); for (let x = 16; x <= 19; x++) addGhost('belt', x, 0); addGhost('assembler', 20, 0);
      for (let j = 0; j < 4; j++) addGhost('wall', 25, j); for (let i = 26; i < 29; i++) addGhost('wall', i, 3);
      world.box(-13, 0, -9, 2.5, 1, M.BASALT); BP.clears.push({ id: BP.nextId++, x0: -13, y0: 0, x1: -9, y1: 2.5, claim: null, cur: 0 });
      S.mode = 'blueprint'; S.plan = 'chest'; input.mx = G.w / 2 + 120; input.my = G.h / 2 - 140; SUP.on = false;
    } else if (scenario === 'combat') {      // the hive's answer: an attack wave, and the round 2 guns to meet it (a dev scenario)
      spawnAt(0); S.mode = 'combat'; hive.quiet = true; baseKit(); guns(); S.add('rifle rounds', 300); K.laser.state = 'ship'; K.reactor.state = 'ship';
      for (const [t, x, y] of [['scout', 9, 1.2], ['scout', 13, 1.2], ['swarmer', 7, 1], ['swarmer', 8, 1], ['swarmer', 11, 1], ['swarmer', -8, 1], ['brute', 16, 2], ['spitter', -11, 1.2], ['flier', 6, 6], ['flier', -5, 7]]) { const c = spawnCreature(t, x, y, { x: 0, y: 1 }); c.state = 'charge'; c.order = 'attack'; }
      auto = dt => { let b = null, bd = 1e9; for (const c of creatures) { const d = Math.hypot(c.x - P.x, c.y - P.y); if (d < bd && c.agg) { bd = d; b = c; } } if (b) { toScr(b.x, b.y); input.mx = scr[0]; input.my = scr[1]; } input.down[0] = !!b && G.auto; input.down[2] = G.auto; if (G.auto) { P.hp = Math.max(P.hp, 55); S.flash = Math.min(S.flash, 0.3); } };
    } else if (scenario === 'oldkit') { spawnAt(0); hive.quiet = true; baseKit(); guns(); K.laser.state = 'ship'; K.reactor.state = 'ship'; S.crash = true; }   // the round 2 kit, for the interface test
    else if (scenario === 'drill') {         // the ship laser at work on a hillside, the reactor on the back
      spawnAt(-22); hive.quiet = true; auto = () => { input.mx = G.w / 2 + 250 + Math.sin(G.time * 0.9) * 40; input.my = G.h / 2 + 150 + Math.sin(G.time * 1.3) * 50; input.down[0] = G.auto || input.down[0]; };
    } else if (scenario === 'forest') { spawnAt(54); hive.quiet = true; baseKit(); }
    else if (scenario === 'reactor') {       // the walk with 178 kg on the body
      spawnAt(30); hive.quiet = true; auto = () => { input.mx = G.w / 2 + 300; input.my = G.h / 2 + 30; if (G.auto) { input.keys.add('d'); if (G.time % 6 > 5.2) input.keys.delete('d'); } };
    } else if (scenario === 'turret') {      // the laser on its legs, the reactor set down beside it, the AI at the trigger
      spawnAt(1.5); hive.quiet = true; antennaUp(); K.awake = true; K.reactor.state = 'ground'; K.reactor.x = 5.6; K.reactor.y = 0.4; K.laser.state = 'turret'; K.laser.x = 7.6; K.laser.y = 0; K.laser.ang = 0.1;
      const c = spawnCreature('stalker', 27, 1.2); c.state = 'charge'; c.dir = -1; input.mx = G.w / 2 + 200; input.my = G.h / 2;
      auto = () => { if (G.auto) P.hp = Math.max(P.hp, 60); };
    } else if (scenario === 'herd') {        // a herd that has seen you and has not yet decided
      spawnAt(37.5); hive.quiet = true; spawnHerd(51.6, 5); input.mx = G.w / 2 + 700; input.my = G.h / 2 + 90;
    } else if (scenario === 'predator') {    // bigger than you, and it eats things your size
      spawnAt(44); hive.quiet = true; const g = world.groundY(59, surfaceH(59) + 6, 0, 20) || 0, c = spawnCreature('stalker', 59, g + 1); c.dir = -1; c.state = 'stalk'; input.mx = G.w / 2 + 330; input.my = G.h / 2 + 10;
      auto = () => { if (G.auto) { P.hp = Math.max(P.hp, 60); S.flash = Math.min(S.flash, 0.2); } };
    } else if (scenario === 'supply' || scenario === 'targets') {      // demand and supply: a furnace, the arm, loose ore, and the ship's robots carrying between them
      S.slice = true; sliceGround(); spawnAt(4); antennaUp(); wakeShipRobots(); place('furnace', -2, 0, 1, true); give([['iron', 9], ['copper', 6]], K.hold); give([['basalt', 44], ['iron ore', 8], ['o2 cell', 1], ['power cell', 1]]);
      for (let i = 0; i < 9; i++) matter.spawn('iron ore', 6 + (i % 3) * 3, 8 + i * 0.5, 0.6 + (i % 2) * 0.3); for (let i = 0; i < 6; i++) matter.spawn('basalt', 9 + i, 7.5 + i * 0.7, 1.2); S.stats.dug = 400; hive.quiet = true; input.mx = G.w / 2 + 160; input.my = G.h / 2 + 60; if (scenario === 'targets') ui.toggleAI(true);       // 'targets': the same, with the stock-target editor open
    } else if (scenario === 'ruins') { const st = slotStruct(-2); spawnAt(st.mouth[0] - 3); hive.quiet = true; baseKit(); }
    else if (scenario === 'base') { const st = slotStruct(2); spawnAt(st.door[0] + (st.door[0] < st.x ? -4 : 4)); hive.quiet = true; baseKit(); }
    else if (scenario === 'hive') { const st = slotStruct(1); spawnAt(st.mouth[0] - 7); hive.alert[st.id] = 30; hive.timer[st.id] = 3; baseKit(); guns(); S.add('rifle rounds', 200); S.mode = 'combat'; input.mx = G.w / 2 + 300; }
    else if (scenario === 'inventory') { spawnAt(0); hive.quiet = true; baseKit(); SUP.on = false; for (const [k, n] of [['iron ore', 46.3], ['copper ore', 18.75], ['lumen', 3.2], ['biomass', 22.4], ['fibre', 6.1], ['resin', 2.5], ['chitin', 4], ['ichor', 1.2], ['furnace', 1], ['belt', 8], ['drone', 2], ['part', 3], ['xeno shard', 5.5]]) S.add(k, n); S.printer.q.push({ r: 'miner', left: 30, total: 48 }, { r: 'belt', left: 16, total: 16 }); ui.toggle(true); }
    else if (scenario === 'autobuild' || scenario === 'queue') {
      // place and it gets built: four frames set down with no kit anywhere. The AI orders the kits, the arm prints
      // them from what the robots bring it, the robots build in the queue's order. 'queue' opens the AI window on it.
      S.slice = true; sliceGround(); spawnAt(1); antennaUp(-4); wakeShipRobots(); hive.quiet = true; S.stats.dug = 400; give([['basalt', 70], ['iron', 46], ['copper', 14], ['iron ore', 30], ['controller', 2]], K.hold); give([['o2 cell', 1], ['power cell', 1]]);
      for (let i = 0; i < 7; i++) matter.spawn('iron ore', 7 + (i % 3) * 3, 8.2 + i * 0.5, 0.7 + (i % 2) * 0.3);
      addGhost('assembler', 9, 0); addGhost('chest', 14, 0); addGhost('furnace', 5, 0); addGhost('hub', -8, 0); for (let j = 0; j < 3; j++) addGhost('wall', 18, j);
      input.mx = G.w / 2 + 220; input.my = G.h / 2 + 40; if (scenario === 'queue') ui.toggleAI(true);
    } else if (scenario === 'conveyor') {    // a furnace and an assembler five metres apart on level ground: the AI lays the belt. A second furnace far off across the wreck: robots.
      S.slice = true; spawnAt(10.6); antennaUp(-3); wakeShipRobots(); hive.quiet = true; S.stats.dug = 400; give([['belt', 8], ['iron', 30], ['copper', 6]], K.hold); give([['o2 cell', 1], ['power cell', 1]]);
      const f1 = place('furnace', 2, 0, 1, true), as = place('assembler', 14, 0, 1, true), f2 = place('furnace', -44, Math.round(surfaceH(-21.5) / TS), 1, true); f1.inp['iron ore'] = 70; f2.inp['iron ore'] = 30; as.recipe = 'part'; SUP.targets = { iron: 20, part: 6 };
      input.mx = G.w / 2 - 260; input.my = G.h / 2 + 30;
    } else if (scenario === 'overhang') {    // ore under a ledge: no drone can drop a line on it. The ground hauler walks in.
      S.slice = true; spawnAt(-0.5); antennaUp(-5); wakeShipRobots(); hive.quiet = true; S.stats.dug = 400; give([['o2 cell', 1], ['power cell', 1]]);
      world.shape(2.6, 1.2, 8.2, 2.5, (x, y) => Math.max(Math.abs(x - 5.4) - 2.6, Math.abs(y - 1.85 - Math.sin(x * 1.7) * 0.12) - 0.42) + Math.sin(x * 3.1 + y * 2) * 0.06, 1, M.BASALT); world.shape(7, -0.2, 8.6, 2, (x, y) => Math.max(Math.abs(x - 7.8) - 0.5 - (1.4 - y) * 0.12, y - 1.9), 1, M.BASALT);
      for (let i = 0; i < 5; i++) matter.spawn('iron ore', 9 + i * 2, 3.6 + i * 0.7, 0.45); matter.spawn('iron ore', 12, 10.5, 0.5); input.mx = G.w / 2 + 240; input.my = G.h / 2 + 60;
    }
    else if (scenario === 'fall') {          // round 5: forty metres up over a shaft with two decks in it and a rock floor: nothing is passed through
      hive.quiet = true; baseKit(); flatten(-14, 14); world.box(1, -9, 3.5, 0.5, -1, 0); world.box(1, -12, 3.5, -9, 1, M.BASALT); for (const gy of [-5, -11]) for (let gx = 2; gx < 7; gx++) addPlat(gx, gy);
      spawnAt(-3); P.x = 2.25; P.y = 7; K.reactor.state = 'ship'; K.laser.state = 'ship'; S.crash = false; input.mx = G.w / 2 + 200; input.my = G.h / 2 + 100;
    } else if (scenario === 'layers') {      // round 5: decks in a cut shaft, and the back wall behind everything that was dug
      hive.quiet = true; baseKit(); S.add('platform', 12); spawnAt(-2); S.crash = false; kitReset('carried');
      const y0 = Math.round(P.y / TS); world.box(0.5, P.y - 9, 4, P.y + 0.6, -1, 0); world.dig(6.5, P.y - 3, 2.4, 0); world.dig(9, P.y - 6, 2, 0); world.box(4, P.y - 3.6, 7, P.y - 2.2, -1, 0);
      for (const j of [-1, -7, -13]) for (let gx = 1; gx < 8; gx++) addPlat(gx, y0 + j); P.x = 2.2; P.y = (y0 - 6) * TS; input.mx = G.w / 2 + 250; input.my = G.h / 2 + 30;
    } else if (scenario === 'rocks') {       // round 5: a hundred and twenty rocks let go over a hollow: they fall, break, pile up and lie still
      hive.quiet = true; baseKit(); flatten(-14, 16); world.shape(2, -2.5, 12, 0.5, (x, y) => Math.hypot((x - 7) / 4.2, (y - 0.4) / 2.4) * 2.4 - 2.4, -1); spawnAt(-3); S.crash = false; kitReset('carried');
      for (let i = 0; i < 120; i++) matter.spawn(i % 5 === 0 ? 'iron ore' : 'basalt', 3 + hash(i, 1, 77) * 34, 4 + hash(i, 2, 77) * 6, 3 + i * 0.22, (hash(i, 3, 77) - 0.5) * 2, 0); S.rocks0 = matter.list.reduce((a, c) => a + c.n, 0); input.mx = G.w / 2 + 420; input.my = G.h / 2 + 60;
    } else if (scenario === 'place') {       // round 5: a furnace crafted into the inventory, selected, on the cursor
      S.slice = true; sliceGround(); spawnAt(1); antennaUp(-4); hive.quiet = true; S.stats.dug = 400; give([['iron', 14], ['copper', 6], ['o2 cell', 1]], K.hold); for (const [k, n] of [['furnace', 1], ['belt', 6], ['basalt', 44], ['iron', 12], ['platform', 4]]) S.add(k, n);
      P.slot = 0; input.mx = G.w / 2 + 190; input.my = G.h / 2 + 62;
    } else if (scenario === 'plan') {        // round 5: blueprint mode: a chest you hold is placed, an assembler you do not hold is a ghost the AI builds
      S.slice = true; sliceGround(); spawnAt(1); antennaUp(-4); wakeShipRobots(); hive.quiet = true; S.stats.dug = 400; give([['iron', 60], ['copper', 14], ['basalt', 50]], K.hold); for (const [k, n] of [['chest', 1], ['iron', 6], ['o2 cell', 1]]) S.add(k, n);
      S.mode = 'blueprint'; S.plan = 'assembler'; addGhost('furnace', 5, 0); for (let x = 12; x < 16; x++) addGhost('belt', x, 0); input.mx = G.w / 2 + 420; input.my = G.h / 2 + 62;
    }
    else if (ROUND6[scenario]) auto = ROUND6[scenario]() || null;
    else if (ROUND7[scenario]) auto = ROUND7[scenario]() || null;
    else if (scenario === 'planet') { spawnAt(-4.5); hive.quiet = true; baseKit(); S.zo = S.zoT = ZMAX; }                 // the whole planet: the disc, the limb, the molten core
    else if (scenario === 'horizon') { spawnAt(60); hive.quiet = true; baseKit(); S.zo = S.zoT = 13; }                     // far enough out that the ground is a curve
    else if (scenario === 'far90') {         // a quarter of the way round and walking on: the camera has turned with the ground
      spawnAt(CIRC * 0.262); hive.quiet = true; baseKit(); auto = () => { input.mx = G.w / 2 + 300; input.my = G.h / 2 + 20; if (G.auto) input.keys.add('d'); };
    } else if (scenario === 'seam') {        // walking west across the place where the two charts meet
      spawnAt(-CIRC / 4 + 407); hive.quiet = true; baseKit(); auto = () => { input.mx = G.w / 2 - 300; input.my = G.h / 2 + 20; if (G.auto) input.keys.add('a'); };
    } else if (scenario === 'antipode') {    // the far side: the hive's main base, under a sky the giant never rises in
      const st = structsIn(CIRC / 2 - 5, CIRC / 2 + 5).find(q => q.main); spawnAt(st.mouth[0] - 9); baseKit(); hive.alert[st.id] = 20; hive.timer[st.id] = 40; input.mx = G.w / 2 + 300; input.my = G.h / 2 + 30;
    }
    else {
      // the slice, and the default start: awake beside the wreck with nothing in your hands. The weapon is on the ship,
      // the reactor is in it, the antenna is a frame waiting to be built, the forest is watching.
      // round 6 N: you wake inside the wreck, in the bunk, without the suit: a slow, weak human. The suit is in its
      // locker in the hold, aft. Nothing answers you until it is on: no HUD, no robots, no light but the emergency strip.
      S.slice = true; S.dev = scenario === 'slice'; kitReset('wreck'); sliceGround(); resetSuit(false); holdKit(); const bunk = partNamed('bunk'), bp = toWorld(bunk.lx + 0.1, 0); spawnAt(bp[0]); enterWreck(true); P.o2 = MASK.bare; light.lamp.on = false;
      if (scenario === 'slice') { resetSuit(true); enterWreck(false); spawnAt(-4.5); wakeShipRobots(); S.stage = 2; give([['o2 cell', 1], ['power cell', 1]]); mark(13.6, 0.8, 4, 1); light.lamp.on = true; }       // the dev version: suited, booted, beside the wreck
      else P.act = { kind: 'waking', t: 0, T: 2.2, x: P.x, y: P.y + 0.6, done() { S.say('you are awake. the air in here holds; outside it does not', 5); events.emit('woke'); } };
      spawnHerd(27, 5); spawnCreature('jelly', -14, 5.5); input.mx = G.w / 2 + 200; input.my = G.h / 2 + 20;
      if (G.auto) {            // the demonstration: take the laser, pull the reactor, walk to the outcrop and cut it
        let st = 0; auto = () => { const t = DIR.t; input.keys.delete('d'); input.keys.delete('a'); input.down[0] = false;
          if (st === 0) { if (P.x < SHIP.mount[0] + 1.6) input.keys.add('d'); else if (P.x > SHIP.mount[0] + 2.2) input.keys.add('a'); else if (!P.act) { if (K.laser.state === 'ship') kitUse(); else st = 1; } }
          else if (st === 1) { if (P.x > SHIP.bay[0] + 1.6) input.keys.add('a'); else if (!P.act) { if (K.reactor.state === 'ship') kitUse(); else st = 2; } }
          else if (st === 2) { if (P.x < 5.2) input.keys.add('d'); else st = 3; input.mx = G.w / 2 + 280; input.my = G.h / 2 + 40; }
          else { input.mx = G.w / 2 + 300 + Math.sin(t * 0.8) * 60; input.my = G.h / 2 + 30 + Math.sin(t * 1.1) * 70; input.down[0] = true; } };
      }
    }
    if (BOOT.done) grantPlanners();
    for (const s of S.inv.slots) if (s) S.known.add(s.id); if (BOOT.done) for (const s of K.hold.slots) if (s) S.known.add(s.id);
    P.x = planet.update(P.x, true); S.cam.x = P.x; S.cam.y = P.y + 2.2; horizon = surfaceH(P.x); P.wa = P.aim = 0; events.emit('landed');
  },
  enter(d) { if (d && d.died) { P.hp = 0; P.dead = 0.01; events.emit('died'); } },
  step(dt) {
    light.emitters.length = 0; S.frameN = (S.frameN || 0) + 1; thudT -= dt;
    S.zoom = lerp(S.zoom, 1 + 0.32 * P.ads + (WRECK.inside ? 0.75 : 0), Math.min(1, dt * (WRECK.inside ? 2.5 : 8))); // zoom: - and = step out and in, m goes to the whole planet and back; the view is continuous from the body to the disc
    if (!ui.open) { if (input.hit('m')) S.zoT = S.zoT > 1.5 ? 1 : ZMAX; if (input.key('-')) S.zoT = Math.min(ZMAX, S.zoT * (1 + dt * 1.8)); if (input.key('=')) S.zoT = Math.max(1, S.zoT / (1 + dt * 1.8)); }
    S.zo = Math.exp(lerp(Math.log(S.zo), Math.log(S.zoT), Math.min(1, dt * 3.2))); if (Math.abs(S.zo - S.zoT) < 0.002) S.zo = S.zoT; S.far = sstep(3, 6, S.zo); S.lod = sstep(6, 11, S.zo);
    S.ppm = G.h / 15 * S.zoom / S.zo; planet.fromScreen(S.cam, S.ppm, G.w, G.h, input.mx, input.my, scr); S.mouse.x = scr[0]; S.mouse.y = scr[1];
    shiftT -= dt; { const f = shiftT <= 0; if (f) shiftT = 2; planet.update(P.x, f); }
    if (auto) auto(dt);
    S.alt = input.key('Alt'); G.sleepWarp = NEEDS.asleep > 0; stepBoot(dt); if (!ui.open && input.hit('n')) { S.defend = S.defend === 'always' ? 'combat' : S.defend === 'combat' ? 'off' : 'always'; S.say('self-defence: ' + (S.defend === 'always' ? 'always' : S.defend === 'combat' ? 'in combat mode only' : 'off'), 2.5); }
    // E is the inventory and the crafting menu (and closes any window). F is the hand on the world: the kit, a site, a
    // machine, the rocket. Tab is blueprint mode (blueprint.js).
    if (input.hit('e') || input.hit('i')) ui.toggle();
    if (input.hit('j') && BOOT.done) ui.toggleAI();
    if (input.hit('Escape') && ui.open) ui.toggle(false);
    if (input.hit('f') && !P.dead) {
      if (ui.open) ui.toggle(false);
      else if (!wreckUse(input.key('Shift')) && !kitUse() && !siteUse()) { const m = nearest(); if (m && thingUse(m)) { /* furniture and sensors have no window */ } else if (m && m.kind === 'pad' && m.n >= ROCKET_PARTS) { m.n = 0; G.switchAct('space', { launch: true, lon: planet.lon((m.x + m.w / 2) * TS) * Math.PI / 180 }); } else if (m && m.kind !== 'antenna') ui.openMachine(m); }
    }
    if (!ui.open && !P.dead && !P.act && S.crash) {       // the door: S steps in behind the hull, W steps out (the layer behind the play plane)
      if (!WRECK.inside && atDoor() && input.hit('s')) enterWreck(true); else if (WRECK.inside && atDoor() && input.hit('w')) { enterWreck(false); P.noJump = true; }
      if (WRECK.inside && input.hit('r')) wreckUse(false, true); }
    if (P.pumpNear > 0) P.pumpNear -= dt; stepWreck(dt); stepScan(dt, !ui.open && input.key('h'));
    env.step(dt); stepPlayer(dt); stepKit(dt); stepBlueprint(dt); stepRobots(dt); stepSupply(dt); stepBullets(dt); stepCreatures(dt); stepFactory(dt); stepSites(dt); stepHive(dt); stepFlora(dt); stepHeat(dt); matter.step(dt); stepCollide(dt); matterHeat(dt); stepLife(dt); stepMine(dt); stepFog(dt);
    const B = K.laser.beam; if (B && B.hit) siteDamage(B.x2, B.y2, 150 * dt);
    S.parts.step(dt, 0, -GRAV, (x, y) => world.solidAt(x, y));
    for (let i = S.lights.length - 1; i >= 0; i--) if ((S.lights[i].t -= dt) <= 0) S.lights.splice(i, 1);
    if (S.scare > 0) { backdrop.scare = Math.max(backdrop.scare, S.scare); S.scare = Math.max(0, S.scare - dt * 0.8); }
    if (S.slice) { DIR.t += dt;       // the one scripted thing in the slice: somewhere out there, something bigger than you notices
      if (!DIR.pred && K.reactor.state !== 'ship' && (homeDist(P.x) > 60 || (DIR.t > 900 && (S.stage || 1) >= 3))) { DIR.pred = 1; const x = P.x + (P.x >= 0 ? 1 : -1) * 30, g = world.groundY(x, surfaceH(x) + 6, 0, 20); if (g !== null) spawnCreature('stalker', x, g + 1); } }
    // the camera follows the body and looks along its down; far out it settles on the planet's centre
    const k = Math.min(1, dt * 5), look = (0.22 + 0.25 * P.ads) / (S.zo * S.zo), zt = sstep(Math.log(16), Math.log(80), Math.log(S.zo));
    S.cam.x = lerp(S.cam.x, P.x + (input.mx - G.w / 2) / S.ppm * look, k); S.cam.y = lerp(S.cam.y, lerp(P.y + 1.6 + (G.h / 2 - input.my) / S.ppm * look, -RAD, zt), zt > 0 ? 1 : k);
    near = ui.open ? null : sites.near ? null : nearest();
    G.shake = Math.max(0, G.shake - dt * (0.6 + G.shake * 6));
  },
  draw(time) {
    const b = S.batch, sh = G.shake * 0.5, cx = S.cam.x + (Math.random() - 0.5) * sh, cy = S.cam.y + (Math.random() - 0.5) * sh, ppm = S.ppm;
    b.begin(cx, cy, ppm); b.u.uTime.value = time; b.u.uBend.value.set(RAD * ppm, cy * ppm); b.u.uFade.value = 1 - sstep(7, 12, S.zo);
    // the two layers in front of the play plane fade when the camera goes below the ground: down a shaft you see the shaft
    for (const f of backdrop.fore) { f.u.uBend.value.set(RAD * ppm, cy * ppm); f.u.uFade.value = (1 - sstep(1.6, 3, S.zo)) * (1 - sstep(0.3, 2.2, horizon - cy)) * (1 - WRECK.cut); }
    flora.pushers.length = 0; if (!P.dead) flora.pushers.push({ x: P.x, y: P.y, vx: P.vx, r: 0.35, h: 1.7 }); for (const c of creatures) if (c.nodes.length && !KIND[c.type].fly) flora.pushers.push({ x: c.x, y: c.y - 1.2, vx: c.vx, r: 0.3 + KIND[c.type].thick * 0.5, h: 1.6 });
    // shafts of planet-light in the play plane
    for (let c = Math.floor((cx - 22 * Math.min(S.zo, 3)) / 19); c <= Math.floor((cx + 22 * Math.min(S.zo, 3)) / 19); c++) { const r = hash(c, 7, 230); if (r > 0.55) continue; const x = (c + 0.5 + (hash(c, 7, 231) - 0.5) * 0.8) * 19, top = Math.max(horizon, cy - 4) + 12, len = 13 + r * 8, a = -1.92 + (r - 0.3) * 0.12, br = 0.5 + 0.5 * Math.sin(time * 0.13 + r * 40), f = backdrop.fog;
      b.add(x + Math.cos(a) * len * 0.5, top + Math.sin(a) * len * 0.5, len, 1.2 + hash(c, 7, 232) * 2.2, a, [(0.02 + f[0]) * 1.2, (0.03 + f[1]) * 1.2, (0.034 + f[2]) * 1.2], 0.5 + 0.5 * br, 10, 2, c * 3.3); }
    drawFlora(b, time, false); drawSites(b, time);
    if (S.crash) drawWreck(b, time);
    drawZones(b, time, C, mul); matter.draw(b, time, true); drawFills(b, time); drawPlats(b, S.cam, S.zo); drawNet(b, time); drawFactory(b, time); drawMine(b, time); drawBlueprint(b, time); drawAuto(b, time); matter.draw(b, time, false); drawFog(b, time); drawCreatures(b, time); drawKit(b, time); drawPlayer(b, time); drawRobots(b, time); drawLife(b, time); S.parts.draw(b, 1.2); drawKitBeam(b, time); if (WRECK.cut < 0.5) drawFlora(b, time, true);
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
    const bx = 28, L = K.laser, RX = K.reactor, mob = P.mob || mobility(0), st = P.st || suitStats(); let by = h - 178;
    const o2min = P.o2 / (MASK.perDay / DAY) / 60, steps = nextSteps(), hintL = wreckHint() || kitHint() || sites.hint || (near ? `f  ${near.kind === 'pad' && near.n >= ROCKET_PARTS ? 'board the rocket' : near.kind === 'bunk' ? 'sleep' : 'open ' + near.kind}` : '');
    const drawNext = () => { let y = 40; txt(c, st.on && BOOT.done ? `next   stage ${S.stage}: ${STAGES[S.stage] || ''}` : 'next', 28, y, { a: 0.35 }); y += 16; for (const q of steps) { txt(c, '> ' + q.do, 28, y, { col: AMBER, a: 0.65 }); y += 14; txt(c, '  ' + q.why, 28, y, { a: 0.4 }); y += 17; } return y; };
    // round 7: the arm's queue, where it is always seen: it is the one matter compiler, what is on it and when it is done
    const drawArm = y0 => { const q = S.printer.q, armW = P.armW || 5000, cond = EXO.arm === undefined ? 1 : EXO.arm; let y = y0 + 10, t = 0;
      line(c, 28, y - 12, 300, y - 12, q.length ? 0.5 : 0.15, AMBER); txt(c, `arm   the only matter compiler${cond < 0.99 ? '   ' + (cond * 100).toFixed(0) + ' %' : ''}   ${q.length ? q.length + ' queued, done in ' + Math.ceil(armEta()) + ' s' : 'idle'}`, 28, y, { col: AMBER, a: q.length ? 0.85 : 0.4 }); y += 16;
      for (const j of q.slice(0, 3)) { t += j.left * 5000 / armW; drawIcon(c, Object.keys(RECIPE[j.r].out)[0], 28, y - 12, 16); txt(c, `${j.r}   ${Math.ceil(t)} s${j.ai ? '' : '   by hand'}${S.printer.stall ? '   ' + S.printer.stall : ''}`, 50, y, { a: 0.65 }); y += 16; }
      if (q.length > 3) { txt(c, `+ ${q.length - 3} more`, 50, y, { a: 0.4 }); y += 14; }
      for (const o of (SUP.armNeed || []).filter(o2 => !q.some(j => j.r === o2.recipe)).slice(0, 2)) { txt(c, `waits for the arm: ${o.item} x${o.n}`, 28, y, { a: 0.5 }); y += 14; }
      for (const t2 in SUP.shop) { const j = SUP.shop[t2]; if (!j) continue; txt(c, `${t2}: ${j.r}   ${Math.ceil(j.left / Math.max(0.05, shopSpeed(t2)))} s`, 28, y, { a: 0.5 }); y += 14; } };
    if (G.warp !== 1 || NEEDS.asleep > 0) txt(c, NEEDS.asleep > 0 ? 'asleep: time runs' : G.warp === 0 ? 'paused (p)' : `time ${G.warp}x   , slower   . faster`, w / 2, 66, { align: 'center', col: AMBER, a: 0.7 });
    if (!st.on) {       // no suit: no instruments. What a person knows without them: the breath in the mask, the weight in the arms
      drawNext(); txt(c, `no suit: no instruments, no link`, bx, h - 96, { col: AMBER, a: 0.6 }); bar(c, bx, h - 66, 150, P.o2 / MASK.bare, P.inAir ? 'mask off: the air in here holds' : `mask ${P.o2.toFixed(2)} kg of oxygen   about ${o2min.toFixed(0)} min`, P.o2 < 0.05 ? RED : INK);
      bar(c, bx, h - 42, 150, P.load / 25, P.load < 1 ? 'hands empty' : `carrying ${P.load.toFixed(0)} kg${P.load > 25 ? ': too much, you can hardly walk' : P.load > 15 ? ': heavy' : ''}`, P.load > 25 ? RED : INK); bar(c, bx, h - 18, 150, P.hp / 100, P.hp > 70 ? 'unhurt' : P.hp > 35 ? 'hurt' : 'badly hurt', P.hp < 35 ? RED : INK);
      if (S.msgT > 0) txt(c, S.msg, w / 2, 84, { align: 'center', col: AMBER, a: Math.min(0.85, S.msgT) }); if (hintL && !ui.open) txt(c, hintL, w / 2, h / 2 + 120, { align: 'center', col: AMBER, a: 0.75 });
      if (S.mode === 'combat') txt(c, 'fists up: lmb punch   c lowers them', w / 2, h - 80, { align: 'center', col: RED, a: 0.8 });
      txt(c, 'a d walk   w jump   f use   s step in / w step out at the door   v pick up   c fists', w / 2, h - 6, { align: 'center', a: 0.28 }); if (P.dead > 0) txt(c, 'dead', w / 2, h / 2, { align: 'center', size: 14, col: RED, a: 0.9 }); return;
    }
    if (!BOOT.done) { let y = h / 2 - 70; for (let i = 0; i < BOOT.shown; i++) { txt(c, BOOT_LINES[i][1], w / 2 - 190, y, { col: i === BOOT.shown - 1 ? AMBER : INK, a: i === BOOT.shown - 1 ? 0.9 : 0.5 }); y += 17; } }
    // suit: body, battery, oxygen, propellant, the laser's sink. Every bar is a counted amount.
    if (!up(0.3)) return;
    bar(c, bx, by, 150, P.hp / 100, 'body ' + Math.max(0, P.hp | 0), P.hp < 35 ? RED : INK); by += 24;
    bar(c, bx, by, 150, P.bat.wh / P.bat.cap, `battery ${P.bat.wh.toFixed(0)} wh${P.charging ? '  charging' : ''}`, P.bat.wh < 60 ? RED : AMBER); by += 24;
    bar(c, bx, by, 150, P.o2 / st.o2, `oxygen ${P.o2.toFixed(2)} kg  ${o2min.toFixed(0)} min${P.inAir ? '   in the wreck\'s air' : P.pumpNear > 0 ? '   filling at the pump' : ''}`, P.o2 < 0.15 ? RED : INK); by += 24;
    { const N = NEEDS, wst = needWorst(); bar(c, bx, by, 150, Math.min(N.food, N.water, N.sleep, 1 - N.toilet), `food ${(N.food * 100).toFixed(0)}  water ${(N.water * 100).toFixed(0)}  sleep ${(N.sleep * 100).toFixed(0)}  toilet ${(N.toilet * 100).toFixed(0)}%${wst ? '   ' + wst : ''}`, wst ? AMBER : INK); by += 24; }
    bar(c, bx, by, 150, P.prop / Math.max(0.01, st.prop), `jet ${P.prop.toFixed(2)} kg`, AMBER); by += 24;
    bar(c, bx, by, 150, P.load / st.body.str, `load ${P.load.toFixed(0)} kg   pace ${(mob.speed / 6.5 * 100).toFixed(0)}%   jump ${(mob.jump / 4.6 * 100).toFixed(0)}%   jet ${mob.jet > GRAV ? 'lifts' : 'brakes only'}   suit ${(EXO.cond * 100).toFixed(0)}%`, P.load > st.body.str * 0.83 ? AMBER : INK); by += 24;
    if (L.state === 'held' || L.state === 'turret') { const left = Math.max(0, Math.floor((SINK_J - L.sinkJ) / PULSE_HEAT_J)), wl = L.state === 'held' && st.packL > 0 ? `   water ${EXO.water.toFixed(1)} l` : '';
      bar(c, bx, by, 150, Math.min(1, L.heat), `laser sink ${(L.heat * 100).toFixed(0)}%   ${left} pulses left${wl}   ${L.loop ? 'coolant line' : 'air only'}   ${L.mode}${L.optics < 0.99 ? '   optics ' + (L.optics * 100).toFixed(0) + '%' : ''}${L.state === 'turret' ? '   on its legs' : ''}`, L.heat > 0.75 ? RED : INK); }
    else txt(c, 'unarmed: the ship laser is on its hardpoint. fists in combat mode (c)', bx, by - 5, { col: AMBER, a: 0.7 });
    if (!up(3.5)) { if (S.msgT > 0) txt(c, S.msg, w / 2, 84, { align: 'center', col: AMBER, a: Math.min(0.85, S.msgT) }); return; }
    // the world hears you: noise, local pollution, the nearest hive
    const nz = env.mine, pol = env.pollAt(P.x, P.y), hn = hive.near; let ry = 96;
    txt(c, 'signature', w - 28, 78, { align: 'right', a: 0.35 });
    txt(c, `noise ${nz.toFixed(0)} m`, w - 28, ry, { align: 'right', col: nz > 50 ? RED : nz > 25 ? AMBER : INK, a: 0.7 }); line(c, w - 180, ry + 5, w - 28, ry + 5, 0.15); line(c, w - 28 - Math.min(152, nz * 1.6), ry + 5, w - 28, ry + 5, 0.8, nz > 50 ? RED : AMBER); ry += 20;
    txt(c, `pollution ${pol.toFixed(1)} ug/m3`, w - 28, ry, { align: 'right', col: pol > 60 ? RED : pol > 20 ? AMBER : INK, a: 0.7 }); line(c, w - 180, ry + 5, w - 28, ry + 5, 0.15); line(c, w - 28 - Math.min(152, pol * 1.5), ry + 5, w - 28, ry + 5, 0.8, pol > 60 ? RED : AMBER); ry += 20;
    if (hn) { txt(c, `hive ${hn.d.toFixed(0)} m ${planet.dx(P.x, hn.x) < 0 ? 'west' : 'east'}   ${hn.a < 6 ? 'asleep' : hn.a < 24 ? 'stirring' : 'awake'} ${hn.a.toFixed(0)}%`, w - 28, ry, { align: 'right', col: hn.a > 50 ? RED : hn.a > 6 ? AMBER : INK, a: 0.7 }); ry += 15; }
    txt(c, `hivemind spread ${(hive.spread * 100).toFixed(1)}%   hunting you ${creatures.filter(q => q.agg && visible(q)).length} seen   wary ${creatures.filter(q => !q.agg && visible(q)).length}   level ${hive.level}`, w - 28, ry, { align: 'right', a: 0.4 }); ry += 24;
    // power and network: every watt and every link is a counted thing
    { const used = K.pw.used || 0, lf = L.frac, rs = RX.state, [rx, ry2] = reactorPos(), rd = Math.hypot(rx - P.x, ry2 - P.y - 1);
      txt(c, 'power', w - 28, ry, { align: 'right', a: 0.35 }); ry += 16;
      txt(c, `reactor ${rs === 'ship' ? 'in the wreck' : rs === 'carried' ? 'on your back: throttled for heat' : 'set down ' + rd.toFixed(0) + ' m, on its fins'}   ${(Math.max(0, used - (L.firing && lf < 0.6 ? used : 0)) / 1000).toFixed(0)} / ${((K.pw.cap || REACTOR_W) / 1000).toFixed(0)} kw`, w - 28, ry, { align: 'right', col: AMBER, a: 0.7 }); line(c, w - 180, ry + 5, w - 28, ry + 5, 0.15); line(c, w - 28 - 152 * RX.load, ry + 5, w - 28, ry + 5, 0.8, AMBER); ry += 20;
      if (L.state !== 'ship') { txt(c, L.reach ? `laser on the cable   ${LASER_W / 1000} kw a pulse, ${(L.hz || 10).toFixed(0)} a second   ${L.mode === 'kerf' ? 'kerf ' + (kerfPerPulse(MATS.BASALT) * 100).toFixed(0) + ' cm of slot' : 'spall ' + (pulseArea(MATS.BASALT) * 1e4).toFixed(0) + ' cm2 of basalt'} each` : `laser out of cable reach (${CABLE} m): ${(SUIT_BUS_W / 1000).toFixed(1)} of ${LASER_W / 1000} kw`, w - 28, ry, { align: 'right', col: L.reach ? INK : RED, a: 0.65 }); ry += 15; }
      const np = K.net.player, ant = K.net.antennas.filter(q => !q.ship && q.range).length;
      txt(c, `network ${np ? (np.ship ? 'ship mast ' + SHIP_LINK + ' m' : 'relay ' + np.range + ' m') : 'no link'}   ai: one system${ant ? '   relays ' + ant : ''}   links ${NET.signals}`, w - 28, ry, { align: 'right', col: np ? INK : RED, a: 0.65 }); ry += 15;
      { const cap = FOG.capGB, g0 = knownG(), r0 = knownR(); txt(c, `data ${(FOG.usedGB / 1000).toFixed(2)} / ${(cap / 1000).toFixed(1)} tb   sensors ${FOG.cams} cam ${FOG.radars} radar   scans ${GEO.scans}  assays ${GEO.assays}`, w - 28, ry, { align: 'right', col: FOG.full ? RED : INK, a: 0.55 }); ry += 15;
        txt(c, `known: g ${fmtEst(g0, '', g0.rel < 0.01 ? 3 : 1)} m/s2   radius ${r0 ? fmtEst(r0, ' m', 0) : '?'}   self-defence ${S.defend || 'always'} (n)`, w - 28, ry, { align: 'right', a: 0.45 }); ry += 15; }
      if (L.state === 'turret') { txt(c, `turret: ${!L.link ? 'no link, no orders' : !L.reach ? 'linked, no power' : L.target ? 'ai firing on ' + L.target.type : 'ai watching'}`, w - 28, ry, { align: 'right', col: L.link && L.reach ? AMBER : RED, a: 0.7 }); ry += 15; }
      ry += 9; }
    // demand and supply: what the AI keeps in stock, and who it has making it
    if (SUP.on && SUP.stock) { txt(c, `ai: stock targets   cut-off iron ${(SUP.cut * 100).toFixed(0)} %`, w - 28, ry, { align: 'right', a: 0.35 }); ry += 16;
      for (const k in SUP.targets) { const have = SUP.stock[k] || 0, tg = SUP.targets[k], o = SUP.orders.find(q => q.item === k), u = ITEMS[k].u === 'ea' ? '' : ' kg';
        drawIcon(c, k, w - 46, ry - 12, 18); txt(c, `${k} ${ITEMS[k].u === 'ea' ? Math.round(have) : have.toFixed(1)} / ${tg}${u}`, w - 52, ry, { align: 'right', col: have >= tg - 1e-6 ? INK : AMBER, a: 0.7 }); line(c, w - 180, ry + 5, w - 52, ry + 5, 0.15); line(c, w - 52 - 128 * Math.min(1, have / tg), ry + 5, w - 52, ry + 5, 0.7, have >= tg - 1e-6 ? INK : AMBER); ry += 15;
        if (o) { txt(c, `> ${o.note || ''}`, w - 52, ry, { align: 'right', a: 0.45 }); ry += 15; } ry += 3; }
      ry += 6; }
    // the queue, the grid and the flows: what the AI is doing about what you placed, and why (j opens the window)
    { const qv = queueView(robots), pw = AUTO.power;
      if (qv.length) { txt(c, `build queue ${qv.length}   j: reorder`, w - 28, ry, { align: 'right', a: 0.35 }); ry += 15; for (const q of qv.slice(0, 4)) { txt(c, `${q.n} ${q.kind}${q.auto ? ' (ai)' : ''}: ${q.why.length > 62 ? q.why.slice(0, 60) + '..' : q.why}`, w - 28, ry, { align: 'right', col: /waits for|outside/.test(q.why) ? AMBER : INK, a: 0.6 }); ry += 13; } if (qv.length > 4) { txt(c, `+ ${qv.length - 4} more`, w - 28, ry, { align: 'right', a: 0.35 }); ry += 13; } ry += 6; }
      if (F.machines.length > 1 || pw.demand > 100) { txt(c, `base grid ${(pw.used / 1000).toFixed(1)} / ${(pw.supply / 1000).toFixed(0)} kw   wire loss ${((pw.loss || 0) / 1000).toFixed(2)} kw   ${pw.note}`, w - 28, ry, { align: 'right', col: pw.demand > pw.supply + 1 ? AMBER : INK, a: 0.6 }); ry += 15; }
      for (const r of AUTO.routes.slice(0, 3)) { txt(c, `${r.src.kind} > ${r.dst ? r.dst.kind : 'hold'}  ${r.item} ${r.rate.toFixed(2)} kg/s  ${r.mode === 'belt' ? (r.done ? 'belt' : 'belt, ' + r.missing + ' cells to build') : r.mode === 'robot' ? 'robots' : 'idle'}`, w - 28, ry, { align: 'right', a: 0.45 }); ry += 13; } }
    if (robots.length) { txt(c, `robots ${robots.length}   open jobs ${AUDIT.open}   idle ${AUDIT.idle}   idle beside doable work ${AUDIT.doable + AUDIT.timer}   loose ${matter.total().toFixed(0)} kg${BP.clears.length ? '   terrain jobs ' + BP.clears.length : ''}`, w - 28, ry, { align: 'right', col: AUDIT.rows.some(q => q.can || q.timer) ? AMBER : INK, a: 0.6 }); ry += 15; for (const r of robots.slice(0, 4)) { txt(c, `${r.kind === 'crawler' ? 'hauler' : 'drone'} ${r.id}  ${intentOf(r)}  ${(r.wh / (r.kind === 'crawler' ? 400 : ROBOT.wh) * 100).toFixed(0)}%`, w - 28, ry, { align: 'right', a: 0.45 }); ry += 13; } ry += 8;
      if (S.zo < 2.2 && !ui.open) for (const r of robots) { if (!r.job && r.state !== 'haul') continue; toScr(r.x, r.y + 0.5); if (scr[0] > 60 && scr[0] < w - 440 && scr[1] > 60 && scr[1] < h - 160) txt(c, intentOf(r), scr[0], scr[1], { align: 'center', a: 0.5 }); } }
    if (MARKET.blocked.length) { txt(c, `waits: ${MARKET.blocked[0].text}${MARKET.blocked.length > 1 ? '   +' + (MARKET.blocked.length - 1) : ''}`, w - 28, ry, { align: 'right', col: AMBER, a: 0.55 }); ry += 15; }
    { const ll = LOG.lines[LOG.lines.length - 1]; if (ll && G.time - ll.at < 9) { txt(c, 'ai: ' + (ll.t.length > 86 ? ll.t.slice(0, 84) + '..' : ll.t), w - 28, ry, { align: 'right', a: 0.5 * Math.min(1, 9 - (G.time - ll.at)) }); ry += 15; } }
    if (STOCK.zones.length) { txt(c, STOCK.zones.map(z => `${z.name} ${zoneKg(z).toFixed(0)} kg`).join('   '), w - 28, ry, { align: 'right', a: 0.42 }); ry += 15; }
    if (SUP.wanted.length) { txt(c, 'ordered: ' + SUP.wanted.map(q => `${q.item} x${q.n}`).join(', '), w - 28, ry, { align: 'right', col: AMBER, a: 0.55 }); ry += 15; }
    if (SUP.full && robots.length) { txt(c, 'the hold is full: what does not fit stays where it lies', w - 28, ry, { align: 'right', col: AMBER, a: 0.6 }); ry += 15; }
    if (FILL.list.some(f => !f.done)) { txt(c, 'spoil: ' + FILL.list.filter(f => !f.done).map(f => `${f.kind} ${(100 * f.lvl / f.h).toFixed(0)} %`).join('   '), w - 28, ry, { align: 'right', a: 0.5 }); ry += 15; }
    if ((S.proposals || []).length) { txt(c, `the ai proposes a belt (${S.proposals[0].cells.length} cells): tab shows it, y plans it`, w - 28, ry, { align: 'right', col: AMBER, a: 0.55 }); ry += 15; }
    S.gains.forEach((g, i) => { drawIcon(c, g.id, w - 52, ry + i * 24 - 4, 22); txt(c, `+ ${fmtAmt(g.id, g.n) || 'x1'} ${g.id}`, w - 58, ry + i * 24 + 10, { align: 'right', a: Math.min(0.85, g.t) }); });
    // altitude tape and compass strip
    const alt = P.y; line(c, 28, h / 2 - 90, 28, h / 2 + 90, 0.25);
    for (let i = -4; i <= 4; i++) { const v = Math.round(alt / 5) * 5 + i * 5, yy = h / 2 - (v - alt) * 4; if (Math.abs(yy - h / 2) < 90) { line(c, 28, yy, 34, yy, 0.3); txt(c, v, 40, yy + 3, { a: 0.35 }); } }
    txt(c, `alt ${alt.toFixed(1)} m`, 46, h / 2 - 100); line(c, 22, h / 2, 34, h / 2, 0.8, AMBER);
    // longitude strip (degrees east of the crash site), and the planet with you on top of it: the camera's up is your up
    const lon = planet.lon(P.x), wl = v => ((v + 180) % 360 + 360) % 360 - 180; line(c, w / 2 - 160, 30, w / 2 + 160, 30, 0.25);
    for (let i = -8; i <= 8; i++) { const v = Math.round(lon / 2) * 2 + i * 2, xx = w / 2 + (v - lon) * 10; if (Math.abs(xx - w / 2) < 160) { line(c, xx, 30, xx, v % 10 === 0 ? 38 : 34, 0.3); if (v % 10 === 0) txt(c, Math.abs(wl(v)) + (wl(v) < 0 ? ' w' : wl(v) > 0 ? ' e' : ''), xx, 50, { align: 'center', a: 0.35 }); } }
    line(c, w / 2, 24, w / 2, 36, 0.8, AMBER); txt(c, `lon ${Math.abs(lon).toFixed(1)} ${lon < 0 ? 'w' : 'e'}   v ${Math.hypot(P.vx, P.vy).toFixed(1)} m/s   g ${fmtEst(knownG(), '', 1)} m/s2   ${S.inside === 'wreck' ? 'inside the wreck' : sites.inside ? STORY.sites[sites.inside.kind === 'base' && sites.inside.research ? 'lab' : sites.inside.kind] : BIOME[biome(P.x)]}`, w / 2, 20, { align: 'center', a: 0.45 });
    { const px = w / 2 + 196, py = 31, pr = 13, mk = (deg, len, col, al) => { const a = (deg - lon) * Math.PI / 180; line(c, px + Math.sin(a) * pr, py - Math.cos(a) * pr, px + Math.sin(a) * (pr + len), py - Math.cos(a) * (pr + len), al, col); };
      c.strokeStyle = `rgba(${INK},0.3)`; c.lineWidth = 1; c.beginPath(); c.arc(px, py, pr, 0, 6.2832); c.stroke(); mk(0, 4, INK, 0.7); mk(180, 4, RED, 0.7); mk(lon, 5, AMBER, 0.9); }
    if (S.zo > 5) {      // far out: what the ship knows, marked on the planet itself
      const al = sstep(5, 9, S.zo), mark = (x, y, label, col, k = 1) => { toScr(x, y + 8); if (scr[0] < -40 || scr[0] > w + 40 || scr[1] < -40 || scr[1] > h + 40) return; const u = planet.up(x - S.cam.x), ex = scr[0] + u[0] * 26 * k, ey = scr[1] - u[1] * 26 * k; line(c, scr[0], scr[1], ex, ey, 0.6 * al, col); txt(c, label, ex + u[0] * 8, ey - u[1] * 8 + 3, { align: u[0] > 0.3 ? 'left' : u[0] < -0.3 ? 'right' : 'center', col, a: 0.75 * al }); };
      // round 6: the planet is unknown. Only the slice your sensors have covered is shown; the rest is dark
      { const o = [0, 0]; planet.toScreen(S.cam, S.ppm, w, h, S.cam.x, -RAD, o); const pcx = o[0], pcy = o[1], rr = (RAD + 70) * S.ppm, ang = x => { planet.toScreen(S.cam, S.ppm, w, h, planet.fix(x), 0, o); return Math.atan2(o[1] - pcy, o[0] - pcx); }, a0 = ang(FOG.x1), a1 = ang(FOG.x0); let d = a1 - a0; while (d <= 0) d += 6.2832; if (!S.dev && FOG.x1 - FOG.x0 < CIRC - 2 && rr > 20) { c.fillStyle = `rgba(2,3,5,${0.93 * al})`; c.beginPath(); c.moveTo(pcx, pcy); c.arc(pcx, pcy, rr, a0, a0 + d, false); c.closePath(); c.fill(); if (S.zo > 30) txt(c, `unknown: ${((1 - (FOG.x1 - FOG.x0) / CIRC) * 100).toFixed(0)} % of the way round has not been seen`, w / 2, h - 118, { align: 'center', a: 0.45 * al }); } }
      mark(P.x, P.y, 'you', AMBER, 1.5); if (S.crash) mark(SHIP.x, 2, 'wreck', INK);
      const seen = {}; for (const m of F.machines) { const k = Math.round(m.x * TS / 60); if (m.kind !== 'belt' && !seen[k] && homeDist(m.x * TS) > 40) { seen[k] = 1; mark(m.x * TS, m.y * TS, 'outpost', INK, 0.8); } }
      if (S.dev || FOG.x1 - FOG.x0 > CIRC - 2) mark(planet.fix(CIRC / 2), surfaceH(CIRC / 2), 'hive: the main base', RED, 1.2);
      if (S.zo > 40) txt(c, `radius ${knownR() ? fmtEst(knownR(), ' m', 0) : '?'}   g ${fmtEst(knownG(), '', 1)} m/s2   - = zoom   m back to the body`, w / 2, h - 100, { align: 'center', a: 0.4 });
    }
    if (S.msgT > 0) txt(c, S.msg, w / 2, 84, { align: 'center', col: AMBER, a: Math.min(0.85, S.msgT) });
    if (F.pad) txt(c, F.pad.n >= ROCKET_PARTS ? 'rocket ready: f at the pad to board' : `rocket ${F.pad.n}/${ROCKET_PARTS} parts`, 28, h - 232, { col: AMBER, a: 0.8 });
    if (F.printer) txt(c, 'bio-printer online: body respawns there', 28, h - 216, { a: 0.4 });
    if (up(5.2)) drawArm(drawNext());
    if (flora.note) txt(c, flora.note.text, w / 2, 120, { align: 'center', col: AMBER, a: Math.min(0.85, flora.note.t) });
    if (MINE.warn) txt(c, `unsupported span ${MINE.warn.span.toFixed(1)} m, safe ${MINE.warn.safe.toFixed(1)} m: about ${MINE.warn.left.toFixed(0)} s`, w / 2, 102, { align: 'center', col: RED, a: 0.9 });
    if (combat) txt(c, 'combat mode', w / 2, h - 80, { align: 'center', col: RED, a: 0.8 });
    txt(c, combat ? 'lmb fire, or punch with an empty hand   rmb aim   r reload   1-9 weapon   n self-defence   c leaves combat' : 'e inventory   tab blueprint   lmb place / laser   k kerf   h scan   rmb take back (hold: take down)   q pipette   r turn   f use   v gather   x reactor   g legs   j ai   alt ranges   m planet   p , . time', w / 2, h - 6, { align: 'center', a: 0.28 });
    const hint = hintL;
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
      } else if (L.state !== 'held' || L.wait) { txt(c, 'fists', mx, my + 30, { align: 'center', col: RED, a: 0.8 }); line(c, mx - 5, my - 5, mx + 5, my + 5, 0.7, RED); line(c, mx - 5, my + 5, mx + 5, my - 5, 0.7, RED); } else { line(c, mx - 9, my, mx - 3, my, 0.7, RED); line(c, mx + 3, my, mx + 9, my, 0.7, RED); line(c, mx, my - 9, mx, my - 3, 0.7, RED); line(c, mx, my + 3, mx, my + 9, 0.7, RED); }
      for (const q of creatures) { if (!q.agg || !visible(q)) continue; toScr(q.x, q.y); const sx = scr[0], sy = scr[1]; if (sx > 0 && sx < w && sy > 0 && sy < h) { bracket(c, sx, sy, 14 + KIND[q.type].thick * 14, RED, 0.45); txt(c, `${q.type} ${(KIND[q.type].kg || 0) < 10 ? (KIND[q.type].kg || 0).toFixed(1) : (KIND[q.type].kg).toFixed(0)} kg`, sx + 20 + KIND[q.type].thick * 14, sy - 12, { col: RED, a: 0.5 }); } else { const a = Math.atan2(q.y - P.y, q.x - P.x); line(c, w / 2 + Math.cos(a) * 150, h / 2 - Math.sin(a) * 150, w / 2 + Math.cos(a) * 164, h / 2 - Math.sin(a) * 164, 0.8, RED); } }
    } else if (!bp) { line(c, mx - 9, my, mx - 3, my, 0.7); line(c, mx + 3, my, mx + 9, my, 0.7); line(c, mx, my - 9, mx, my - 3, 0.7); line(c, mx, my + 3, mx, my + 9, 0.7); }
    else { line(c, mx - 6, my, mx + 6, my, 0.5, AMBER); line(c, mx, my - 6, mx, my + 6, 0.5, AMBER); for (const g of BP.ghosts) if (!g.have && !S.has({ [g.kind === 'wall' ? 'iron' : g.kind]: g.kind === 'wall' ? 3 : 1 }) && !robots.length) { toScr((g.x + 0.5) * TS, (g.y + 1.5) * TS); const sx = scr[0], sy = scr[1]; txt(c, 'missing ' + (g.kind === 'wall' ? 'iron' : g.kind), sx, sy - 14, { align: 'center', col: RED, a: 0.55 }); } }
  },
  hide() { ui.update(false); },
};
const r3 = v => +v.toFixed(3);
function dumpSurface() {
  return { p: { x: r3(P.x), y: r3(P.y), vx: r3(P.vx), vy: r3(P.vy), hp: r3(P.hp), wh: r3(P.bat.wh), o2: +P.o2.toFixed(5), prop: r3(P.prop), slot: P.slot, mag: { ...P.mag }, lamp: light.lamp.on ? 1 : 0 },
    inv: inv.dump(S.inv), known: [...S.known].sort(), plats: dumpPlats(), printer: S.printer.q.map(j => [j.r, r3(j.left), j.total]), corpse: S.corpse, mode: S.mode, crash: S.crash ? 1 : 0, slice: S.slice ? [r3(DIR.t), DIR.pred] : 0, calm: r3(S.calm), stats: { ...S.stats, kills: { ...S.stats.kills }, dug: r3(S.stats.dug), vapor: r3(S.stats.vapor) },
    terrain: world.saveDiff(), flora: [...flora.dead].sort(), factory: dumpFactory(), bp: dumpBP(), robots: dumpRobots(), sites: dumpSites(), hive: dumpHive(), env: env.dump(), kit: dumpKit(), matter: matter.dump(), supply: dumpSupply(), auto: dumpAuto(), suit: dumpSuit(), wreck: dumpWreck(), mine: dumpMine(), geo: dumpGeo(), fog: dumpFog(), stock: dumpStock(), fills: dumpFills(), trees: dumpTrees(), arm: { made: { ...(S.printer.made || {}) }, runs: { ...(S.printer.runs || {}) }, n: S.printer.n || 0, bad: S.printer.bad || 0 }, stage: S.stage || 1, dev: S.dev ? 1 : 0, defend: S.defend || 'always' };
}
function loadSurface(o) {
  planet.reset(); resetStructs(); view.u.uProf.value.dispose(); view.u.uProf.value = profileTex(); S.zo = S.zoT = 1; world.loadDiff(o.terrain); resetFlora(); flora.dead = new Set(o.flora); creatures.length = 0; S.bullets.length = 0; S.parts.list.length = 0; heat.clear(); auto = null;
  const p = o.p; Object.assign(P, { x: p.x, y: p.y, vx: p.vx, vy: p.vy, hp: p.hp, o2: p.o2, prop: p.prop, slot: p.slot, dead: 0, ground: false, reload: 0, act: null, stumble: 0 }); P.bat.wh = p.wh; P.mag = { ...p.mag }; light.lamp.on = !!p.lamp; for (const f of P.rig.f) f.air = true;
  inv.load(S.inv, o.inv); S.known = new Set(o.known || []); for (const q of S.inv.slots) if (q) S.known.add(q.id); loadPlats(o.plats); S.plan = null; S.tool = null; S.printer.q = o.printer.map(([r, left, total]) => ({ r, left, total })); S.corpse = o.corpse; S.mode = o.mode; S.crash = !!o.crash; S.slice = !!o.slice; DIR.t = o.slice ? o.slice[0] : 0; DIR.pred = o.slice ? o.slice[1] : 0; S.calm = o.calm; S.stats = { ...o.stats, kills: { ...o.stats.kills } }; S.open = null; S.uiOpen = false; S.gains.length = 0;
  loadSuit(o.suit); loadWreck(o.wreck, G.seed); loadMine(o.mine); loadGeo(o.geo); loadFog(o.fog); loadStock(o.stock); S.stage = o.stage || 2; S.dev = !!o.dev; S.defend = o.defend || 'always'; S.attacker = null; LOG.lines.length = 0;
  loadFills(o.fills); loadTrees(o.trees); resetAudit(); S.printer.made = { ...((o.arm && o.arm.made) || {}) }; S.printer.runs = { ...((o.arm && o.arm.runs) || {}) }; S.printer.n = (o.arm && o.arm.n) || 0; S.printer.bad = (o.arm && o.arm.bad) || 0; S.proposals = [];
  loadFactory(o.factory); loadBP(o.bp); loadKit(o.kit); loadRobots(o.robots); loadSites(o.sites); loadHive(o.hive); env.load(o.env); matter.load(o.matter); loadSupply(o.supply); loadAuto(o.auto); if (o.v7grant && BOOT.done) grantPlanners();
  P.x = planet.update(P.x, true); S.cam.x = P.x; S.cam.y = P.y + 2.2; horizon = surfaceH(P.x);
}
// hooks for tools: time of each draw stage in ms, and the live state
surface.profile = n => { const b = S.batch, t = {}, T = (k, f) => { const t0 = performance.now(); for (let i = 0; i < n; i++) f(i); t[k] = +((performance.now() - t0) / n).toFixed(2); };
  T('floraBack', i => { b.begin(S.cam.x, S.cam.y, S.ppm); drawFlora(b, i * 0.016, false); t.sprites = b.n; }); T('floraFront', i => { b.begin(S.cam.x, S.cam.y, S.ppm); drawFlora(b, i * 0.016, true); }); T('backdrop', i => { drawBackdrop(S.cam.x, S.cam.y, S.ppm, i * 0.016, 0); t.backSprites = backdrop.batch.n; }); T('sites', i => drawSites(b, i)); T('parts', () => S.parts.draw(b, 1.2)); T('end', () => b.end());
  T('light', i => computeLight(S.cam.x / TS, S.cam.y / TS, i)); T('terrain', i => updateTerrain(S.cam.x, S.cam.y, S.ppm, i, 0)); T('window', () => { world.rev++; updateTerrain(S.cam.x, S.cam.y, S.ppm, 0, 0); }); return t; };
surface.debug = { AUDIT, resetAudit, FILL, BERM, addFill, fillPut, pickSpoilSite, spoilSiteX, baseSpan, RIG, binKg, RECIPE, SHOP, toolRecipe, toolCan, producersOf, yieldOf, kerfWoodJ, pulsesToFell, sawTime, logsOf, WOOD, treesIn, markTrees, treeRec, treeCut, treeSaw, treeJobs, copyArea, pasteBlueprint, deconArea, upgradeArea, beltPath, snapPort, placeReal, acceptProposal, padFor, toolSlot, pageOf, grantPlanners, PLANNERS, shopOk, shopSpeed, armEta, impact, STEP, removeZone, dismantle, firePulse, stepSupply, EXO, BOOT, NEEDS, WRECK, HULL, MINE, GEO, FOG, STOCK, NET, MARKET, LOG, HIT, nextSteps, suitStats, partNamed, toWorld, repairBill, ledger, reachable, zoneKg, zoneFor, addZone, levelAt, estimate, composition, knownG, knownR, spanAt, addSupport, spawnRock, scanDone, orderItem, repairSuit, mark, wakeShipRobots, light, G, events, SHIP, RECIPES, canSee, isLinked, holdRoom, intentOf, PL, addPlat, platAt, cursorKind, tryPlace, plannable, unlocked, setBlueprint, bodyDepth, ui, input, TS, ITEMS, planet, AUTO, queueView, inv, S, P, F, BP, K, SUP, robots, creatures, hive, env, flora, world, sites, matter, heat, backdrop, siteUse, kitUse, spawnCreature, spawnHerd, hurt, slotStruct, structsIn, stance, KIND };

// progression (round 6 Q): the stage of automation you are in, and the one to three things that take you out of it.
// Stages are the spine: 1 suitless survival; 2 the suit online, robots working, hand mining and scanning; 3 the first
// machines, the assay station, drones mining what was scanned; 4 lines and stockpiles, the queue doing most of the
// work; 5 shafts, heavy machinery and defence at scale (round 7 on). Nothing from a later stage is shown before its
// stage (blueprint.js staged). The "next" panel is not a quest log: it is derived from what is short right now.
import { S } from './state.js';
import { F } from './factory.js';
import { BP } from './blueprint.js';
import { K } from './kit.js';
import { EXO, BOOT, needWorst } from './suit.js';
import { SUP, shopPart } from './supply.js';
import { RECIPE, SHOP, toolCan, SUIT_SLOW } from '../items.js';
import { AUTO } from './auto.js';
import { robots, MARKET } from './robots.js';
import { GEO, estimate, fmtEst } from './geology.js';
import { FOG } from './fog.js';
import { STOCK } from './stock.js';
import { MINE } from './mine.js';
import { WRECK } from './wreck.js';
import { world, M } from './world.js';

export const STAGES = ['', 'suitless', 'suit online: hand mining and scanning', 'first machines: assay, drones mine what is scanned', 'lines and stockpiles: the queue does the work', 'shafts, heavy machinery, defence'];
const has = k => F.machines.some(m => m.kind === k), ghost = k => BP.ghosts.some(g => g.kind === k);
// pure in the facts it is given: f = { suit, boot, furnace, assay, zones, ironOk, assembler, routes, rig }
export function stageOf(f) { if (!f.suit) return 1; if (!f.furnace && !f.assay) return 2; if (!(f.assay && f.zones && f.ironOk)) return 3; if (!f.rig) return 4; return 5; }
export function facts() { const st = SUP.stock || {}; return { suit: EXO.on, boot: BOOT.done, furnace: has('furnace'), assay: has('assay station'), zones: STOCK.zones.length > 0, ironOk: (st.iron || 0) >= (SUP.targets.iron || 1) * 0.6 && has('furnace'), assembler: has('assembler'), routes: AUTO.routes.length, rig: has('shaft rig') }; }
// round 7: the arm is the one matter compiler there is, so the first thing to build is whatever takes work off it. What
// it has printed more than once, and what the queue has on it now, is looked at: the machine class that makes that
// (or the shop tool in the wreck that would, if it were mended) is the suggestion; for a chip there is none yet, and it
// says so. Returns { do, why } or null. made = { recipe: prints }, need = [{ recipe, n }] (pure in what it is given).
export function armAdvice(made = S.printer.made || {}, need = SUP.armNeed || [], stands = has, planned = ghost, part = shopPart) {
  const tally = {}; for (const id in made) if (made[id] >= 2) tally[id] = made[id]; for (const q of need) tally[q.recipe] = (tally[q.recipe] || 0) + q.n;
  let best = null, bs = 0, chips = 0;
  for (const id in tally) { const r = RECIPE[id]; if (!r || r.by === 'arm') continue; if (r.by === 'chip line') { chips += tally[id]; continue; } if (stands(r.by)) continue; const sc = tally[id] * r.t * SUIT_SLOW; if (sc > bs) { bs = sc; best = [id, r, tally[id]]; } }
  if (best) { const [id, r, n] = best, tool = Object.keys(SHOP).find(t => toolCan(t, r)), p = tool && part(tool);
    if (p && p.cond < 0.4) return { do: `repair the ${tool} in the wreck (r beside it)`, why: `the arm has ${n} x ${id} on it: the ${tool} makes that, and it is broken` };
    if (planned(r.by)) return null;
    return { do: `${r.by === 'assembler' ? 'an assembler' : 'a ' + r.by}: plan one (tab)`, why: `the arm has ${n} x ${id} on it (${(r.t * SUIT_SLOW).toFixed(0)} s each): it is the only matter compiler, and a ${r.by} makes that without it` }; }
  if (chips >= 2) return { do: 'keep the arm for chips: queue nothing else on it by hand', why: `${chips} chips printed or waiting. only the arm makes a chip until a chip line exists, and none can be built yet` };
  return null;
}
// the things to do now, most useful first: [{ do, why }]
export function nextSteps() {
  const f = facts(), st = S.stage = Math.max(S.stage || 1, stageOf(f)), out = [], add = (d, w) => { if (out.length < 3) out.push({ do: d, why: w }); }, sh = AUTO.short || {}, P = S.P;
  const nd = needWorst(); if (nd && st > 1) add(nd === 'tired' ? 'sleep: the bunk in the wreck' : nd === 'needs the toilet' ? 'the toilet is in the crew room of the wreck' : nd === 'hungry' ? 'eat: rations are in the hold' : 'drink: the tank in the wreck', `you are ${nd}`);
  if (MINE.warn) add(`get out from under it, or let the supports come: span ${MINE.warn.span.toFixed(1)} m, safe ${MINE.warn.safe.toFixed(1)} m`, `the roof holds about ${MINE.warn.left.toFixed(0)} s`);
  if (st === 1) { add(WRECK.inside ? 'find the exosuit: the locker in the hold, aft past the reactor bay' : 'the exosuit is in the wreck: go in by the torn tail', 'without it you carry 25 kg, there is no light, and nothing answers you'); return out; }
  if (!BOOT.done) { add('wait: the ai is coming up', 'the suit linked your interface to the wreck\'s core'); return out; }
  if (K.laser.state === 'ship') add('unbolt the ship laser from its hardpoint, above the nose (f)', 'it is the only thing here that cuts rock');
  if (K.reactor.state === 'ship' && K.laser.state !== 'ship') add('pull the reactor out of its bay (f)', 'a pulse is 75 kj: the laser runs on nothing else');
  if (!GEO.scans) { const x = 13.6, y = 1, e = estimate(world.matAt(x, y) || M.BASALT, x, y, 0); add('scan the outcrop east of the wreck: hold h on the rock', `nobody knows what it is: iron ${fmtEst({ v: e.v * 100, rel: e.rel }, ' %', 0)} at a guess. the drones mine only what is scanned`); }
  else if (st === 2 && !ghost('furnace') && !S.count('furnace')) add((SUP.stock && SUP.stock.basalt || 0) >= 40 ? 'craft a furnace (e) and put it down, or plan one (tab)' : 'cut blocks out of the scanned rock: k for the kerf, two slots that meet and the block falls', 'a furnace is 40 kg of basalt: iron is what everything else is made of');
  if (st === 2 && K.laser.state === 'held' && K.reactor.state === 'carried' && K.laser.heat > 0.6) add('set the reactor down (x) within cable reach', 'on its fins it gives 2 mw and its coolant line keeps the laser firing');
  if (st >= 2 && st <= 3 && !has('assay station') && !ghost('assay station') && (SUP.stock && SUP.stock.rubble || 0) > 5) add('assay station: plan one (tab)', 'rubble from unscanned ground is useless until it is assayed; with it the drones can use what the miner brings up');
  if (st === 3) {
    if (!has('assay station') && !ghost('assay station')) add('assay station: plan one (tab)', 'it sorts what is mined and tells the ai the grade to 1 %');
    const raw = Object.keys(sh).find(k => sh[k] > 0.5 && (k.endsWith('ore') || k === 'basalt')); if (raw && ![...FOG.finds.values()].some(q => q.item === raw)) add(`scan for ${raw}: hold h on rock that has not been scanned`, `${sh[raw].toFixed(0)} kg short, and the drones mine only what the scanner has seen`);
    const fu = F.machines.filter(m => m.kind === 'furnace'); if (fu.length && fu.every(m => m.on) && (SUP.stock && SUP.stock.iron || 0) < (SUP.targets.iron || 0) * 0.5) add('a second furnace', 'iron is your bottleneck: every furnace is running and stock is under half the target');
    if (AUTO.power.demand > AUTO.power.supply + 1) add('bring the reactor to the grid: its bay, or set down by the machines', `the grid wants ${(AUTO.power.demand / 1000).toFixed(0)} kw and has ${(AUTO.power.supply / 1000).toFixed(0)}`);
  }
  if (st === 4) { if (!has('assembler') && !ghost('assembler')) add('assembler: plan one (tab)', 'parts, belts and kits without waiting for the arm'); add('a shaft: tab, pick the shaft rig, press at the collar and drag down to the depth', 'the grade is better below, and you pay rod and casing only for the metres it sinks'); }
  if (st >= 2) { const ad = armAdvice(); if (ad) add(ad.do, ad.why); }
  if (MARKET.blocked.length && out.length < 3) add('see j: ' + MARKET.blocked[0].text, 'a job no robot can take as things stand');
  if (!out.length) add('the line runs without hands', 'the ai keeps the targets; raise one (j) or plan something new');
  return out;
}

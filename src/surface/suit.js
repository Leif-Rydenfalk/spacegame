// the exosuit, the body under it, and the body's needs (round 6: N, P and docs/SCIENCE.md 6, V4).
// There is one suit. It lies in a locker in the wreck's hold when the game starts; you wake without it, a slow, weak
// human, and have to find it and put it on. It is a persistent, modular object with an identity, a condition and a
// history: slots that hold parts, and every stat of the body in it (what it carries, how fast it runs, how high it
// jumps, the jet, the battery, what the scanner reaches, how hard the glove hits, what the plates stop) comes from the
// parts in the slots and their condition. It is never replaced; parts are swapped. Take it off or break it and you are
// the weak human again. Putting it on links its interface core to you and the one AI comes up (the boot sequence).
// The body's needs run on the planet's day (36 minutes): oxygen from the mask's tank, food, water, sleep, the toilet.
import { G, events, clamp } from '../core.js';
import { ITEMS, inv } from '../items.js';
import { S } from './state.js';
import { BODY_SUIT, BODY_BARE } from './power.js';

export const DAY = 2160;                       // seconds in a day here; the needs below are per day
export const SUITPARTS = {
  'frame mk1': { slot: 'frame', kg: 30, str: 300 },
  'actuators mk1': { slot: 'actuators', k: 1, speed: 6.5, sprint: 8.5, jump: 4.6, glove: 2.4 },
  'actuators mk2': { slot: 'actuators', k: 1.5, speed: 7.2, sprint: 9.4, jump: 5.1, glove: 3.4 },
  'cell 600 wh': { slot: 'cell', wh: 600 }, 'cell 1.2 kwh': { slot: 'cell', wh: 1200 },
  'cooling mk1': { slot: 'cooling', packL: 0 }, 'cooling pack': { slot: 'cooling', packL: 5 },
  'scanner mk1': { slot: 'sensors', scanR: 2.6, scanT: 1.4, err: 0.3 }, 'scanner mk2': { slot: 'sensors', scanR: 4.5, scanT: 0.8, err: 0.18 },
  'interface core mk1': { slot: 'core', robots: 6 },
  'armour plate': { slot: 'armour', armour: 0.4 },
  'jet mk1': { slot: 'jet', jet: 14, prop: 2 },
  'laser adapter': { slot: 'mount' },
};
export const SLOTS = ['frame', 'actuators', 'cell', 'cooling', 'sensors', 'core', 'armour', 'jet', 'mount'];
const SLOTS0 = { frame: 'frame mk1', actuators: 'actuators mk1', cell: 'cell 600 wh', cooling: 'cooling mk1', sensors: 'scanner mk1', core: 'interface core mk1', armour: null, jet: 'jet mk1', mount: 'laser adapter' };
export const EXO = { id: 'exo-0001', on: false, cond: 1, slots: { ...SLOTS0 }, wear: {}, pinned: false, history: [], water: 0 };
export const BOOT = { t: -1, done: false, shown: 0 };           // t < 0: never booted; the HUD comes up line by line
export const BOOT_LINES = [
  [0.3, 'exosuit exo-0001: frame closed. actuators answering'], [1.1, 'brain interface: handshake'], [1.9, 'ai: core online in the wreck (2 cpu, 8 tb)'],
  [2.7, 'antenna: the ship mast reaches 1500 m'], [3.5, 'sensors: hull cameras, suit scanner'], [4.3, 'robots: two drones and the hauler released'], [5.2, 'ai: one system. it works for you'],
];
export const NEEDS = { food: 0.8, water: 0.75, sleep: 0.85, toilet: 0.25, asleep: 0, edible: {} };
export const NEED_RATE = { food: 1 / 1.6, water: 1 / 1.0, sleep: 1 / 1.1, toilet: 1 / 0.6 };       // per day: empty (or full) in that many days
export const MASK = { bare: 0.25, suit: 1.2, perDay: 0.84 };     // kg of oxygen in the tank; what a person breathes in a day
// the condition of the part in a slot (1 = new)
const wearOf = s => EXO.wear[s] === undefined ? 1 : EXO.wear[s];
// what the body can do right now. Pure in (EXO, on): the tests set the slots and read this.
export function suitStats(x = EXO) {
  if (!x.on || x.cond <= 0) return { on: false, body: BODY_BARE, wh: 0, packL: 0, scanR: 0, scanT: 3, err: 0.6, robots: 0, armour: 0, glove: 1, prop: 0, o2: MASK.bare, carry: 60 };
  const p = k => SUITPARTS[x.slots[k]] || {}, a = p('actuators'), wa = x.wear.actuators === undefined ? 1 : x.wear.actuators, k = (a.k || 0.4) * (0.35 + 0.65 * wa) * (0.5 + 0.5 * x.cond);
  const body = { kg: BODY_SUIT.kg, str: (p('frame').str || 120) * k, speed: (a.speed || 4) * (0.6 + 0.4 * wa), sprint: (a.sprint || 5) * (0.6 + 0.4 * wa), jump: (a.jump || 3) * (0.7 + 0.3 * wa), jet: p('jet').jet || 0, slow: BODY_SUIT.slow };
  return { on: true, body, wh: p('cell').wh || 200, packL: p('cooling').packL || 0, scanR: p('sensors').scanR || 0, scanT: p('sensors').scanT || 3, err: p('sensors').err || 0.5, robots: p('core').robots || 0, armour: p('armour').armour || 0, glove: (a.glove || 1) * (0.5 + 0.5 * wa), prop: p('jet').prop || 0, o2: MASK.suit, carry: 600 };
}
// put a part from the inventory into its slot; the one that was there comes back. Returns the slot or null.
export function installPart(id, I = S.inv) {
  const d = SUITPARTS[id]; if (!d || !EXO.on || inv.count(I, id) < 1) return null; inv.take(I, id, 1);
  const old = EXO.slots[d.slot]; EXO.slots[d.slot] = id; EXO.wear[d.slot] = 1; if (old && ITEMS[old]) inv.add(I, old, 1);
  EXO.history.push([Math.round(G.time), 'installed ' + id]); if (d.slot === 'cooling') EXO.water = Math.min(EXO.water, d.packL || 0); events.emit('suitUpgraded', id); return d.slot;
}
// a hit on the suit: the plates take their share, the frame and the actuators wear. Returns what reaches the body.
export function suitHit(d) {
  if (!EXO.on) return d * 2.2;                 // easily hurt
  const st = suitStats(), through = d * (1 - st.armour);
  EXO.cond = Math.max(0, EXO.cond - d * 0.0012); EXO.wear.actuators = Math.max(0.05, wearOf('actuators') - d * 0.0018);
  // round 7: the matter compiler is in the forearm, and it is the only one there is. A hard blow can reach it: it prints
  // slower as it is damaged, and under 15 % not at all. Nothing in the wreck replaces it; a repair mends it part of the way.
  if (d > 12) { const a0 = EXO.arm === undefined ? 1 : EXO.arm; EXO.arm = Math.max(0, a0 - (d - 12) * 0.004); if (a0 - EXO.arm > 0.03 || (a0 > 0.15 && EXO.arm <= 0.15)) { EXO.history.push([Math.round(G.time), `matter compiler hit: ${(EXO.arm * 100).toFixed(0)} %`]); events.emit('armDamaged', { arm: EXO.arm }); S.say(EXO.arm <= 0.15 ? 'the matter compiler in the arm is down. it is the only one: nothing here can replace it. repair the suit' : `the matter compiler took the blow: it runs at ${(EXO.arm * 100).toFixed(0)} %. there is no other`, 6); } }
  if (EXO.cond <= 0) { EXO.on = false; EXO.history.push([Math.round(G.time), 'frame failed']); events.emit('suitBroke'); S.say('the exosuit has failed: you are on your own legs', 5); }
  return through;
}
export function repairSuit(k = 1) { if (EXO.arm !== undefined && EXO.arm < 0.9) EXO.arm = Math.min(0.9, EXO.arm + 0.2 * k); EXO.cond = Math.min(1, EXO.cond + 0.25 * k); EXO.wear.actuators = Math.min(1, wearOf('actuators') + 0.3 * k); EXO.history.push([Math.round(G.time), 'repaired']); }
export function suitOn() { EXO.on = true; EXO.history.push([Math.round(G.time), 'put on']); if (BOOT.t < 0) BOOT.t = 0; events.emit('suitOn'); }
// the needs, one step. ctx: { exert 0..1, inAir: breathable air round you, o2 kg in the tank, dt }. Returns { o2: kg
// breathed from the tank, hurt: damage per second, slow: speed factor }
export function stepNeeds(dt, ctx) {
  const N = NEEDS, k = dt / DAY, ex = 1 + (ctx.exert || 0) * 0.6;
  if (N.asleep > 0) { N.sleep = Math.min(1, N.sleep + k * 6); N.asleep -= dt; if (N.sleep >= 0.999 || N.asleep <= 0) { N.asleep = 0; events.emit('woke'); } }
  else N.sleep = Math.max(0, N.sleep - k * NEED_RATE.sleep);
  N.food = Math.max(0, N.food - k * NEED_RATE.food * ex); N.water = Math.max(0, N.water - k * NEED_RATE.water * ex); N.toilet = Math.min(1, N.toilet + k * NEED_RATE.toilet);
  const hurt = (N.food <= 0 ? 0.25 : 0) + (N.water <= 0 ? 0.6 : 0), slow = (N.food < 0.12 ? 0.85 : 1) * (N.sleep < 0.1 ? 0.8 : 1) * (N.toilet > 0.97 ? 0.9 : 1);
  return { o2: ctx.inAir ? 0 : MASK.perDay * k * ex, hurt, slow };
}
export const needWorst = () => { const N = NEEDS, l = [['hungry', N.food], ['thirsty', N.water], ['tired', N.sleep], ['needs the toilet', 1 - N.toilet]].sort((a, b) => a[1] - b[1])[0]; return l[1] < 0.25 ? l[0] : ''; };
// is a plant or an animal safe to eat? Unknown until it has been scanned; then it is true or false for the species.
export const edibleOf = key => NEEDS.edible[key];
export function resetSuit(on) { EXO.arm = 1; EXO.on = !!on; EXO.cond = 1; EXO.slots = { ...SLOTS0 }; EXO.wear = {}; EXO.history = []; EXO.water = 0; EXO.pinned = false; BOOT.t = on ? 99 : -1; BOOT.done = !!on; BOOT.shown = on ? BOOT_LINES.length : 0; Object.assign(NEEDS, { food: 0.8, water: 0.75, sleep: 0.85, toilet: 0.25, asleep: 0, edible: {} }); }
export function dumpSuit() { const f = v => +v.toFixed(4); return { on: EXO.on ? 1 : 0, id: EXO.id, cond: f(EXO.cond), slots: { ...EXO.slots }, wear: Object.fromEntries(Object.entries(EXO.wear).map(([k, v]) => [k, f(v)])), pin: EXO.pinned ? 1 : 0, hist: EXO.history.slice(-24), water: f(EXO.water), boot: BOOT.done ? 1 : 0, arm: f(EXO.arm === undefined ? 1 : EXO.arm), needs: [f(NEEDS.food), f(NEEDS.water), f(NEEDS.sleep), f(NEEDS.toilet)], edible: { ...NEEDS.edible } }; }
export function loadSuit(o) {
  resetSuit(true); if (!o) return;
  EXO.on = !!o.on; EXO.id = o.id || EXO.id; EXO.cond = o.cond; EXO.slots = { ...SLOTS0, ...o.slots }; EXO.wear = { ...o.wear }; EXO.pinned = !!o.pin; EXO.history = (o.hist || []).slice(); EXO.water = o.water || 0; EXO.arm = o.arm === undefined ? 1 : o.arm;
  BOOT.done = !!o.boot; BOOT.t = o.boot ? 99 : -1; BOOT.shown = o.boot ? BOOT_LINES.length : 0; [NEEDS.food, NEEDS.water, NEEDS.sleep, NEEDS.toilet] = o.needs || [0.8, 0.75, 0.85, 0.25]; NEEDS.edible = { ...(o.edible || {}) }; NEEDS.asleep = 0;
}

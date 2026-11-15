// items, inventories, recipes and the suit printer. Quantities are continuous: bulk in kg, fluids in L, discrete things
// in "ea" (each has a mass), ammunition in "rd" (every round is counted). A slot is limited by mass or volume (cap).
// Pure data and functions: no DOM, no world, so the tests can drive it directly.
export const ITEMS = {
  soil: { u: 'kg', cap: 120, c: [0.14, 0.1, 0.08], place: 1, cat: 'raw' }, basalt: { u: 'kg', cap: 160, c: [0.1, 0.11, 0.13], place: 2, cat: 'raw' },
  // round 6: rock nobody has assayed. A stack of it carries its true composition (q, hidden); the assay station sorts it
  rubble: { u: 'kg', cap: 160, c: [0.12, 0.115, 0.12], cat: 'raw' }, 'lean ore': { u: 'kg', cap: 160, c: [0.2, 0.12, 0.09], cat: 'raw' },
  'iron ore': { u: 'kg', cap: 160, c: [0.3, 0.12, 0.06], cat: 'raw' }, 'copper ore': { u: 'kg', cap: 160, c: [0.1, 0.3, 0.2], cat: 'raw' }, lumen: { u: 'kg', cap: 60, c: [0.1, 0.8, 1], cat: 'raw' },
  biomass: { u: 'kg', cap: 80, c: [0.05, 0.3, 0.2], cat: 'raw' }, fibre: { u: 'kg', cap: 60, c: [0.22, 0.26, 0.12], cat: 'raw' }, resin: { u: 'L', m: 1.1, cap: 40, c: [0.6, 0.35, 0.05], cat: 'raw' },
  chitin: { u: 'kg', cap: 80, c: [0.09, 0.08, 0.11], cat: 'alien' }, ichor: { u: 'L', m: 1.05, cap: 40, c: [0.34, 1, 0.05], cat: 'alien' }, 'xeno shard': { u: 'kg', cap: 60, c: [0.5, 0.7, 1], cat: 'alien' },
  water: { u: 'L', m: 1, cap: 60, c: [0.25, 0.45, 0.6], cat: 'consumables' }, oxygen: { u: 'kg', cap: 20, c: [0.5, 0.7, 0.8], cat: 'consumables' }, ration: { u: 'ea', m: 0.6, cap: 12, c: [0.5, 0.4, 0.2], cat: 'consumables' },
  slag: { u: 'kg', cap: 160, c: [0.08, 0.07, 0.07], cat: 'raw' }, silicon: { u: 'kg', cap: 100, c: [0.3, 0.32, 0.36], cat: 'intermediate' },
  iron: { u: 'kg', cap: 200, c: [0.42, 0.45, 0.48], place: 7, cat: 'intermediate' }, copper: { u: 'kg', cap: 200, c: [0.6, 0.3, 0.1], cat: 'intermediate' },
  part: { u: 'ea', m: 12, cap: 8, c: [0.55, 0.6, 0.64], cat: 'parts' }, 'xeno core': { u: 'ea', m: 3, cap: 4, c: [0.6, 0.8, 1], cat: 'alien' },
  'rifle rounds': { u: 'rd', m: 0.012, cap: 600, c: [0.6, 0.42, 0.14], cat: 'weapons' }, shells: { u: 'rd', m: 0.045, cap: 120, c: [0.5, 0.15, 0.1], cat: 'weapons' },
  'o2 cell': { u: 'ea', m: 1.4, cap: 6, c: [0.5, 0.7, 0.8], cat: 'consumables' }, 'power cell': { u: 'ea', m: 2.2, cap: 6, c: [1, 0.6, 0.1], cat: 'consumables' },
  'laser drill': { u: 'ea', m: 7, cap: 1, tool: 1, cat: 'tools' }, antenna: { u: 'ea', m: 12, cap: 2, build: 1, cat: 'logistics' }, rifle: { u: 'ea', m: 4.5, cap: 1, weapon: 1, cat: 'weapons' }, shotgun: { u: 'ea', m: 4, cap: 1, weapon: 1, cat: 'weapons' },
  // a kit weighs what went into it (round 6: mass everywhere)
  furnace: { u: 'ea', m: 40, cap: 2, build: 1, cat: 'machines' }, miner: { u: 'ea', m: 14, cap: 2, build: 1, cat: 'machines' }, belt: { u: 'ea', m: 0.75, cap: 40, build: 1, cat: 'logistics' }, assembler: { u: 'ea', m: 28, cap: 2, build: 1, cat: 'machines' },
  chest: { u: 'ea', m: 6, cap: 4, build: 1, cat: 'logistics' }, pad: { u: 'ea', m: 40, cap: 1, build: 1, cat: 'machines', stage: 7 }, 'bio-printer': { u: 'ea', m: 55, cap: 1, build: 1, cat: 'machines', stage: 5 }, hub: { u: 'ea', m: 28, cap: 2, build: 1, cat: 'logistics' }, drone: { u: 'ea', m: 8.5, cap: 8, cat: 'logistics' },
  platform: { u: 'ea', m: 0.5, cap: 40, build: 1, c: [0.4, 0.44, 0.48], cat: 'logistics' },
  // round 6: the assay station, the shaft rig and what it grows by the metre, supports, sensors, wire, what comes out of the wreck
  'assay station': { u: 'ea', m: 22, cap: 2, build: 1, cat: 'machines' }, 'shaft rig': { u: 'ea', m: 18, cap: 2, build: 1, cat: 'machines' },
  'drill rod': { u: 'ea', m: 3, cap: 40, cat: 'parts' }, casing: { u: 'ea', m: 4, cap: 40, cat: 'parts' }, 'hoist line': { u: 'ea', m: 9, cap: 4, cat: 'parts' }, 'rotary head': { u: 'ea', m: 11, cap: 2, cat: 'parts' },
  'rock bolt': { u: 'ea', m: 1.5, cap: 60, cat: 'parts' }, 'steel set': { u: 'ea', m: 12, cap: 12, cat: 'parts' },
  camera: { u: 'ea', m: 0.8, cap: 8, build: 1, cat: 'logistics' }, radar: { u: 'ea', m: 6, cap: 2, build: 1, cat: 'logistics' }, 'power pole': { u: 'ea', m: 5, cap: 12, build: 1, cat: 'logistics' },
  pump: { u: 'ea', m: 9, cap: 2, build: 1, cat: 'machines' }, 'air filter': { u: 'ea', m: 2, cap: 4, build: 1, cat: 'machines' }, controller: { u: 'ea', m: 1.5, cap: 4, build: 1, cat: 'parts' },
  seat: { u: 'ea', m: 7, cap: 2, build: 1, cat: 'machines' }, table: { u: 'ea', m: 9, cap: 2, build: 1, cat: 'machines' }, bunk: { u: 'ea', m: 14, cap: 1, build: 1, cat: 'machines' }, stairs: { u: 'ea', m: 6, cap: 8, build: 1, cat: 'logistics' },
  cpu: { u: 'ea', m: 0.2, cap: 16, cat: 'parts' }, pcb: { u: 'ea', m: 0.3, cap: 16, cat: 'parts' }, ssd: { u: 'ea', m: 0.05, cap: 32, cat: 'parts' }, 'wiring loom': { u: 'ea', m: 4, cap: 8, cat: 'parts' }, turbopump: { u: 'ea', m: 22, cap: 2, cat: 'parts' }, 'hull plate': { u: 'ea', m: 15, cap: 8, cat: 'parts' },
  // the exosuit's own parts: installed, they change what the body can do (suit.js)
  'actuators mk2': { u: 'ea', m: 9, cap: 2, cat: 'tools', suit: 'actuators' }, 'armour plate': { u: 'ea', m: 8, cap: 4, cat: 'tools', suit: 'armour' }, 'cooling pack': { u: 'ea', m: 3, cap: 2, cat: 'tools', suit: 'cooling' },
  'scanner mk2': { u: 'ea', m: 1.5, cap: 2, cat: 'tools', suit: 'sensors' }, 'cell 1.2 kwh': { u: 'ea', m: 4, cap: 2, cat: 'tools', suit: 'cell' },
  // round 7: the ship's machine shop (conventional gear: each a salvageable machine with its own feedstock), what it eats and
  // leaves, logs, the fast belt, and the planners (data slates: a blueprint, a book of them, the two planners). A planner's
  // slot carries its data (slot.d); a machine kit's slot its condition (slot.c).
  'cnc mill': { u: 'ea', m: 60, cap: 1, build: 1, cat: 'machines' }, 'metal printer': { u: 'ea', m: 45, cap: 1, build: 1, cat: 'machines' }, 'polymer printer': { u: 'ea', m: 18, cap: 1, build: 1, cat: 'machines' }, 'solder bench': { u: 'ea', m: 12, cap: 1, build: 1, cat: 'machines' },
  'metal powder': { u: 'kg', cap: 40, c: [0.3, 0.31, 0.33], cat: 'intermediate' }, polymer: { u: 'kg', cap: 40, c: [0.5, 0.42, 0.2], cat: 'intermediate' }, swarf: { u: 'kg', cap: 80, c: [0.34, 0.36, 0.4], cat: 'intermediate' }, log: { u: 'kg', cap: 120, c: [0.24, 0.16, 0.1], cat: 'raw' },
  'fast belt': { u: 'ea', m: 0.9, cap: 40, build: 1, cat: 'logistics' },
  blueprint: { u: 'ea', m: 0.05, cap: 1, cat: 'tools', plan: 'copy' }, 'blueprint book': { u: 'ea', m: 0.1, cap: 1, cat: 'tools', plan: 'book' }, 'deconstruction planner': { u: 'ea', m: 0.05, cap: 1, cat: 'tools', plan: 'decon' }, 'upgrade planner': { u: 'ea', m: 0.05, cap: 1, cat: 'tools', plan: 'upgrade' },
  'actuators mk1': { u: 'ea', m: 7, cap: 2, cat: 'tools', suit: 'actuators' }, 'cooling mk1': { u: 'ea', m: 1, cap: 2, cat: 'tools', suit: 'cooling' }, 'scanner mk1': { u: 'ea', m: 1.2, cap: 2, cat: 'tools', suit: 'sensors' }, 'cell 600 wh': { u: 'ea', m: 2.5, cap: 2, cat: 'tools', suit: 'cell' },
};
for (const k in ITEMS) { const d = ITEMS[k]; d.id = k; if (d.m === undefined) d.m = 1; }
export const CATS = ['raw', 'intermediate', 'parts', 'machines', 'logistics', 'defence', 'weapons', 'tools', 'consumables', 'alien'];
export const CARRY = 600;                    // kg the suit frame carries
export const EPS = 1e-7;
export function fmtAmt(id, n) { const u = ITEMS[id] ? ITEMS[id].u : 'kg'; return u === 'ea' ? (n > 1 ? 'x' + Math.round(n) : '') : u === 'rd' ? Math.round(n) + ' rd' : (n < 10 ? n.toFixed(2) : n < 100 ? n.toFixed(1) : n.toFixed(0)) + ' ' + u; }
export const fmtCost = c => Object.entries(c).map(([k, n]) => `${k} ${fmtAmt(k, n) || 'x1'}`).join(', ');

// weighted mean of two compositions { fe, cu, lm, host }
export const mixQ = (a, na, b, nb) => !a ? { ...b } : { fe: (a.fe * na + b.fe * nb) / (na + nb), cu: (a.cu * na + b.cu * nb) / (na + nb), lm: (a.lm * na + b.lm * nb) / (na + nb), host: nb > na ? b.host : a.host, ...(nb > na ? (b.ox === undefined ? {} : { ox: b.ox, oy: b.oy }) : (a.ox === undefined ? {} : { ox: a.ox, oy: a.oy })) };
export const makeInv = n => ({ slots: new Array(n).fill(null) });
export const inv = {
  count(I, id) { let n = 0; for (const s of I.slots) if (s && s.id === id) n += s.n; return n; },
  mass(I) { let m = 0; for (const s of I.slots) if (s) m += s.n * ITEMS[s.id].m; return m; },
  // add up to n; returns what did not fit. limit = kg the container may still take (Infinity for chests)
  add(I, id, n, limit = Infinity) {
    const d = ITEMS[id]; if (!d || !(n > 0)) return 0; n = Math.min(n, Math.max(0, limit) / d.m); let left = n; const q = id === 'rubble' ? (this.nextQ || this.lastQ || null) : null; this.nextQ = null;
    const cnd = d.u === 'ea' && this.nextC !== null && this.nextC < 0.999 ? this.nextC : null; this.nextC = null;      // a kit that was taken down keeps the condition of the machine it was
    for (let pass = 0; pass < 2 && left > EPS; pass++) for (let i = 0; i < I.slots.length && left > EPS; i++) {
      const s = I.slots[i];
      if (pass === 0 ? s && s.id === id && s.n < d.cap : !s) { const k = Math.min(left, d.cap - (s ? s.n : 0)); if (s) { if (q) s.q = mixQ(s.q, s.n, q, k); if (cnd !== null || s.c !== undefined) s.c = ((s.c === undefined ? 1 : s.c) * s.n + (cnd === null ? 1 : cnd) * k) / (s.n + k); s.n += k; } else { I.slots[i] = { id, n: k }; if (q) I.slots[i].q = { ...q }; if (cnd !== null) I.slots[i].c = cnd; } left -= k; }
    }
    return left > EPS ? left : 0;
  },
  // take up to n; returns what was taken
  take(I, id, n) {
    let need = n;
    for (let i = I.slots.length - 1; i >= 0 && need > EPS; i--) { const s = I.slots[i]; if (s && s.id === id) { const k = Math.min(need, s.n); if (s.q) this.lastQ = s.q; this.lastC = s.c === undefined ? 1 : s.c; s.n -= k; need -= k; if (s.n <= EPS) I.slots[i] = null; } }
    return n - Math.max(0, need);
  },
  has(I, cost) { for (const k in cost) if (this.count(I, k) < cost[k] - EPS) return false; return true; },
  pay(I, cost) { if (!this.has(I, cost)) return false; for (const k in cost) this.take(I, k, cost[k]); return true; },
  dump(I) { return I.slots.map(s => s ? (s.d || s.c !== undefined ? [s.id, +s.n.toFixed(6), { ...(s.c !== undefined ? { c: +s.c.toFixed(3) } : {}), ...(s.d ? { d: JSON.parse(JSON.stringify(s.d)) } : {}) }] : s.q ? [s.id, +s.n.toFixed(6), [+s.q.fe.toFixed(4), +s.q.cu.toFixed(5), +s.q.lm.toFixed(5), s.q.host, s.q.ox === undefined ? null : +s.q.ox.toFixed(1), s.q.oy === undefined ? null : +s.q.oy.toFixed(1)]] : [s.id, +s.n.toFixed(6)]) : 0); },
  load(I, a) { I.slots = a.map(s => s && ITEMS[s[0]] ? (s[2] && !Array.isArray(s[2]) ? { id: s[0], n: s[1], ...(s[2].c !== undefined ? { c: s[2].c } : {}), ...(s[2].d ? { d: JSON.parse(JSON.stringify(s[2].d)) } : {}) } : s[2] ? { id: s[0], n: s[1], q: { fe: s[2][0], cu: s[2][1], lm: s[2][2], host: s[2][3], ...(s[2][4] === null || s[2][4] === undefined ? {} : { ox: s[2][4], oy: s[2][5] }) } } : { id: s[0], n: s[1] }) : null); return I; },
  // the composition of the rubble that was last taken, and the one the next add of rubble gets (geology.js)
  lastQ: null, nextQ: null,
  // the condition (0..1) of the kit that was last taken, and the one the next add of a kit gets
  lastC: 1, nextC: null,
};

// t = machine seconds for one batch. by = the machine that specialises in it. The suit printer can print all of them,
// SUIT_SLOW times slower: print the first machines by hand, then let the machines do it.
export const SUIT_SLOW = 8;
// round 6: a batch takes the energy its mass needs at the power of the machine that makes it (physics.js): an arc
// furnace 1.44 MJ/kg of metal at 150 kW, the assembly cell 12 kJ/kg at 40 kW. The arm has 5 kW: eight times slower.
// Ore is rock with a high concentration: iron comes out of anything, and what it costs is the rock you have to move.
// A recipe with `e` names its own energy per kg of product (molten-oxide electrolysis: 4.5 kWh/kg of iron).
// round 7 (docs/ROUND7.md 7): there is one matter compiler, the arm. Everything else is conventional and limited:
//   by    the machine class that makes it: furnace, assembler, or one of the shop tools, or 'chip line' (no such machine
//         can be built yet: chips are the arm's) or 'arm' (only the compiler takes raw matter apart)
//   cls   what the ship's machine-shop gear can make of it while no machine of its class stands:
//         'plate' the CNC mill and lathe, from bar and plate (iron and copper here are stock metal), a fifth lost as swarf,
//                 nothing over 15 kg; 'fine' the metal powder printer, from powder, nothing over 3 kg, slowly;
//         'poly' the polymer printer, from polymer; 'elec' the solder and rework bench, from chips it cannot make
// What no conventional producer can make goes to the arm: the first chips, seed machines too big for the shop.
export const MACH_W = { furnace: 150000, assembler: 40000, 'assay station': 6000, 'cnc mill': 3000, 'metal printer': 2000, 'polymer printer': 300, 'solder bench': 200, 'chip line': 40000, arm: 40000 };
// the shop tools: watts, the heaviest single thing each makes (kg), seconds per kg of product on the game's clock (the
// 36-minute day is 40 to 1: a powder-bed printer lays about 0.8 kg an hour, a mill roughs out a kilogram in a few
// minutes), and what the mill loses as swarf
export const SHOP = { 'cnc mill': { cls: 'plate', kgMax: 15, sKg: 6, swarf: 0.2 }, 'metal printer': { cls: 'fine', kgMax: 3, sKg: 110 }, 'polymer printer': { cls: 'poly', kgMax: 5, sKg: 120 }, 'solder bench': { cls: 'elec', kgMax: 6, sKg: 60 } };
const R0 = [
  { id: 'iron', out: { iron: 1 }, in: { 'iron ore': 2.15 }, by: 'furnace' },                                     // 55 % Fe, 85 % recovered
  { id: 'iron, lean', out: { iron: 1, slag: 3.1 }, in: { 'lean ore': 4.2 }, by: 'furnace' },                        // 30 % Fe, 80 % recovered
  { id: 'iron, any rock', out: { iron: 1, oxygen: 4, silicon: 3, slag: 4.5 }, in: { basalt: 12.5 }, by: 'furnace', e: 16.2e6 },   // 8 % Fe by electrolysis; oxygen and silicon come with it
  { id: 'iron, swarf', out: { iron: 1 }, in: { swarf: 1.04 }, by: 'furnace' },                                     // the mill's chips are remelted: nothing is waste
  { id: 'copper', out: { copper: 1, slag: 36 }, in: { 'copper ore': 38 }, by: 'furnace', e: 5.4e6 },             // 3 % Cu, 88 % recovered
  { id: 'metal powder', out: { 'metal powder': 1 }, in: { iron: 1.05 }, by: 'furnace', e: 2.2e6 },                 // melted and gas-atomised
  { id: 'part', out: { part: 1 }, in: { iron: 12 }, by: 'assembler', cls: 'plate' },
  { id: 'rifle rounds', out: { 'rifle rounds': 30 }, in: { iron: 0.3, copper: 0.1 }, by: 'assembler', cls: 'plate' },
  { id: 'shells', out: { shells: 8 }, in: { iron: 0.25, copper: 0.15 }, by: 'assembler', cls: 'plate' },
  { id: 'o2 cell', out: { 'o2 cell': 1 }, in: { oxygen: 1, iron: 0.4 }, by: 'assembler' },
  { id: 'power cell', out: { 'power cell': 1 }, in: { lumen: 1.5, copper: 0.5 }, by: 'assembler' },
  { id: 'ration', out: { ration: 2 }, in: { biomass: 1, water: 0.4 }, by: 'assembler', needs: 'edible' },
  { id: 'polymer', out: { polymer: 1 }, in: { resin: 0.8, fibre: 0.25 }, by: 'assembler' },                        // resin cooked and compounded with fibre into pellets
  { id: 'belt', out: { belt: 4 }, in: { iron: 3 }, by: 'assembler', cls: 'plate' },
  { id: 'fast belt', out: { 'fast belt': 4 }, in: { iron: 3, copper: 0.6 }, by: 'assembler', cls: 'plate' },
  { id: 'chest', out: { chest: 1 }, in: { iron: 6 }, by: 'assembler', cls: 'plate' },
  { id: 'platform', out: { platform: 4 }, in: { iron: 2 }, by: 'assembler', cls: 'plate' },
  { id: 'stairs', out: { stairs: 1 }, in: { iron: 6 }, by: 'assembler', cls: 'plate' },
  { id: 'furnace', out: { furnace: 1 }, in: { basalt: 40 }, by: 'assembler' },
  { id: 'rock bolt', out: { 'rock bolt': 4 }, in: { iron: 6 }, by: 'assembler', cls: 'plate' },
  { id: 'steel set', out: { 'steel set': 1 }, in: { iron: 12 }, by: 'assembler', cls: 'plate' },
  { id: 'assay station', out: { 'assay station': 1 }, in: { iron: 17, copper: 3.5, controller: 1 }, by: 'assembler' },
  { id: 'shaft rig', out: { 'shaft rig': 1 }, in: { iron: 16, copper: 2 }, by: 'assembler' },
  { id: 'drill rod', out: { 'drill rod': 2 }, in: { iron: 6 }, by: 'assembler', cls: 'plate' },
  { id: 'casing', out: { casing: 2 }, in: { iron: 8 }, by: 'assembler', cls: 'plate' },
  { id: 'hoist line', out: { 'hoist line': 1 }, in: { iron: 7, copper: 2 }, by: 'assembler' },
  { id: 'rotary head', out: { 'rotary head': 1 }, in: { iron: 11 }, by: 'assembler', cls: 'plate' },
  { id: 'miner', out: { miner: 1 }, in: { iron: 14 }, by: 'assembler' },
  { id: 'assembler', out: { assembler: 1 }, in: { iron: 21, copper: 5.5, controller: 1 }, by: 'assembler' },
  { id: 'power pole', out: { 'power pole': 1 }, in: { iron: 4, copper: 1 }, by: 'assembler', cls: 'plate' },
  { id: 'camera', out: { camera: 1 }, in: { iron: 0.5, copper: 0.3 }, by: 'assembler', cls: 'fine' },
  { id: 'radar', out: { radar: 1 }, in: { iron: 3.8, copper: 1.9, pcb: 1 }, by: 'assembler' },
  { id: 'hub', out: { hub: 1 }, in: { iron: 17, copper: 7.5, lumen: 2, controller: 1 }, by: 'assembler' },
  { id: 'drone', out: { drone: 1 }, in: { iron: 4.8, copper: 2.9, lumen: 0.5, pcb: 1 }, by: 'assembler' },
  { id: 'antenna', out: { antenna: 1 }, in: { iron: 8, copper: 4 }, by: 'assembler', cls: 'plate' },
  { id: 'armour plate', out: { 'armour plate': 1 }, in: { iron: 8 }, by: 'assembler', cls: 'plate' },
  { id: 'cooling pack', out: { 'cooling pack': 1 }, in: { iron: 2, copper: 1 }, by: 'assembler', cls: 'fine' },
  { id: 'actuators mk2', out: { 'actuators mk2': 1 }, in: { iron: 6, copper: 3 }, by: 'assembler' },
  { id: 'scanner mk2', out: { 'scanner mk2': 1 }, in: { copper: 1.2, lumen: 0.3 }, by: 'assembler', cls: 'fine' },
  { id: 'cell 1.2 kwh', out: { 'cell 1.2 kwh': 1 }, in: { copper: 2, lumen: 2 }, by: 'assembler' },
  { id: 'bio-printer', out: { 'bio-printer': 1 }, in: { iron: 25, copper: 12, lumen: 8, biomass: 10 }, by: 'assembler' },
  { id: 'pad', out: { pad: 1 }, in: { iron: 40 }, by: 'assembler' },
  { id: 'rifle', out: { rifle: 1 }, in: { iron: 4, copper: 0.5 }, by: 'assembler', cls: 'plate' },
  { id: 'shotgun', out: { shotgun: 1 }, in: { iron: 3.5, fibre: 0.5 }, by: 'assembler' },
  // round 7: electronics are assembled, not made: a board is chips soldered to copper on a polymer carrier; a controller
  // is a board in a housing. The chips themselves need a chip line, which nobody here can build: until one exists every
  // chip is the arm's work, atom by atom (6 MJ/kg, and not every print is good: yieldOf).
  { id: 'air filter', out: { 'air filter': 1 }, in: { polymer: 1.2, fibre: 0.8 }, by: 'polymer printer', cls: 'poly' },
  { id: 'wiring loom', out: { 'wiring loom': 1 }, in: { copper: 3, polymer: 1 }, by: 'solder bench', cls: 'elec' },
  { id: 'pcb', out: { pcb: 1 }, in: { cpu: 1, copper: 0.06, polymer: 0.04 }, by: 'solder bench', cls: 'elec' },
  { id: 'controller', out: { controller: 1 }, in: { pcb: 1, iron: 0.8, copper: 0.4 }, by: 'solder bench', cls: 'elec' },
  { id: 'cpu', out: { cpu: 1 }, in: { silicon: 0.05, copper: 0.1, iron: 0.05 }, by: 'chip line', cls: 'chip', e: 6e6 },
  { id: 'ssd', out: { ssd: 1 }, in: { silicon: 0.03, copper: 0.02 }, by: 'chip line', cls: 'chip', e: 6e6 },
  { id: 'silicon', out: { silicon: 1, slag: 3 }, in: { basalt: 4 }, by: 'arm' },                                  // the compiler takes rock apart: only it can
];
export const massOf = c => { let m = 0; for (const k in c) m += c[k] * ITEMS[k].m; return m; };
// machine seconds for one batch: the mass of the main product, the energy per kg, the machine's watts
for (const r of R0) { const main = Object.keys(r.out)[0], kg = r.out[main] * ITEMS[main].m; r.t = +Math.max(0.5, SHOP[r.by] ? kg * SHOP[r.by].sKg : kg * (r.e || (r.by === 'furnace' ? 1.44e6 : 12000)) / MACH_W[r.by]).toFixed(2); }
export const RECIPES = R0;
export const RECIPE = Object.fromEntries(RECIPES.map(r => [r.id, r]));
// the recipe to use for an item: the first one whose inputs somebody has (iron from rich ore, else lean ore, else any
// rock), else the first. have(item) -> amount in stock or loose.
export function recipeFor(item, have) { let first = null; for (const r of RECIPES) if (Object.keys(r.out)[0] === item) { if (!first) first = r; if (have && Object.keys(r.in).every(k => have(k) > 1e-6)) return r; } return first; }

// ---- round 7: the machine shop (pure) --------------------------------------------------------------------------------
const METAL = { iron: 1, copper: 1 };
export const unitKg = r => { const k = Object.keys(r.out)[0]; return ITEMS[k].m; };
// can a shop tool make this recipe at all? (its class, and nothing heavier than its envelope)
export const toolCan = (tool, r) => { const t = SHOP[tool]; return !!t && !!r && (r.by === tool || r.cls === t.cls) && unitKg(r) <= t.kgMax + 1e-9; };
// the recipe as that tool runs it: what it really takes, what it really gives, how long. The mill takes a fifth more
// stock and gives it back as swarf; the printer takes powder in place of bar; the bench and the polymer printer take
// the recipe as written. Mass in is mass out.
export function toolRecipe(tool, r) {
  const t = SHOP[tool]; if (!t || !r) return r; const main = Object.keys(r.out)[0], kg = r.out[main] * ITEMS[main].m, inp = {}, out = { ...r.out };
  if (tool === 'cnc mill') { let sw = 0; for (const k in r.in) { if (METAL[k]) { inp[k] = +(r.in[k] * (1 + t.swarf)).toFixed(6); sw += r.in[k] * t.swarf; } else inp[k] = r.in[k]; } if (sw > 0) out.swarf = +sw.toFixed(6); }
  else if (tool === 'metal printer') { let pw = 0; for (const k in r.in) { if (METAL[k]) pw += r.in[k]; else inp[k] = r.in[k]; } if (pw > 0) inp['metal powder'] = +pw.toFixed(6); }
  else Object.assign(inp, r.in);
  return { id: r.id, in: inp, out, t: +Math.max(2, kg * t.sKg).toFixed(2), by: tool };
}
// pure: who can make a recipe, given the machine kinds that stand ('shop:<tool>' = that tool in the wreck). Conventional
// producers first; the arm only when there is none (kinds.arm says whether there is an arm at all).
export function producersOf(r, kinds) {
  const out = []; if (kinds.has(r.by) && r.by !== 'arm' && r.by !== 'chip line') out.push(r.by);
  for (const tool in SHOP) if (toolCan(tool, r)) { if (kinds.has(tool) && !out.includes(tool)) out.push(tool); if (kinds.has('shop:' + tool)) out.push('shop:' + tool); }
  return out;
}
export const toolOf = who => who && who.startsWith('shop:') ? who.slice(5) : SHOP[who] ? who : null;
// the recipe as a producer runs it
export const effRecipe = (who, r) => { const tool = toolOf(who); return tool && r.by !== tool ? toolRecipe(tool, r) : tool ? { ...toolRecipe(tool, r), in: r.in, out: r.out } : r; };
// the arm's prints are not all good (docs/SCIENCE.md V2): a chip is right 7 times in 10 at first, more often with every
// run of that recipe (process maturity), never always. Anything coarser than a chip comes out right.
export const yieldOf = (r, runs = 0) => r && r.cls === 'chip' ? Math.min(0.95, 0.7 + 0.03 * runs) : 1;
const hsh = n => { let h = (n * 374761393 + 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// the suit printer: a queue of batches. Inputs are taken when a batch is queued and given back if it is cancelled.
export const PRINT_W = 180;                  // watts while printing
export function printerQueue(pr, I, rid, n = 1) { const r = RECIPE[rid]; let k = 0; for (; k < n; k++) { if (!r || pr.q.length >= 12 || !inv.pay(I, r.in)) break; pr.q.push({ r: rid, left: r.t * SUIT_SLOW, total: r.t * SUIT_SLOW }); } return k; }
export function printerCancel(pr, I, i) { const j = pr.q[i]; if (!j) return; pr.q.splice(i, 1); const r = RECIPE[j.r]; for (const k in r.in) inv.add(I, k, r.in[k]); }
// advance by dt with the battery (an object with .wh); returns the recipe id that finished, if any
export function printerStep(pr, I, dt, bat, limit = Infinity) {
  const j = pr.q[0]; if (!j) return null; const wh = PRINT_W * dt / 3600; if (bat.wh < wh) { pr.stall = 'no power'; return null; }
  pr.stall = ''; bat.wh -= wh; j.left -= dt; if (j.left > 0) return null; pr.lastJob = j;
  const r = RECIPE[j.r]; pr.over = null; pr.runs = pr.runs || {}; pr.made = pr.made || {}; pr.n = (pr.n || 0) + 1; pr.failed = null;
  // a bad print: the matter is not lost (it goes back in as feed), the time is
  if (hsh(pr.n) > yieldOf(r, pr.runs[j.r] || 0)) { pr.runs[j.r] = (pr.runs[j.r] || 0) + 1; pr.failed = j.r; pr.bad = (pr.bad || 0) + 1; for (const k in r.in) { const left = inv.add(I, k, r.in[k], limit); if (left > 0) (pr.over || (pr.over = {}))[k] = left; } pr.q.shift(); return null; }
  pr.runs[j.r] = (pr.runs[j.r] || 0) + 1; pr.made[j.r] = (pr.made[j.r] || 0) + 1;
  for (const k in r.out) { const left = inv.add(I, k, r.out[k], limit); if (left > 0) (pr.over || (pr.over = {}))[k] = left; }      // what does not fit is handed to the caller, who drops it at the feet
  pr.q.shift(); return j.r;
}

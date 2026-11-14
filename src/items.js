// items, inventories, recipes and the suit printer. Quantities are continuous: bulk in kg, fluids in L, discrete things
// in "ea" (each has a mass), ammunition in "rd" (every round is counted). A slot is limited by mass or volume (cap).
// Pure data and functions: no DOM, no world, so the tests can drive it directly.
export const ITEMS = {
  soil: { u: 'kg', cap: 120, c: [0.14, 0.1, 0.08], place: 1 }, basalt: { u: 'kg', cap: 160, c: [0.1, 0.11, 0.13], place: 2 },
  'iron ore': { u: 'kg', cap: 160, c: [0.3, 0.12, 0.06] }, 'copper ore': { u: 'kg', cap: 160, c: [0.1, 0.3, 0.2] }, lumen: { u: 'kg', cap: 60, c: [0.1, 0.8, 1] },
  biomass: { u: 'kg', cap: 80, c: [0.05, 0.3, 0.2] }, fibre: { u: 'kg', cap: 60, c: [0.22, 0.26, 0.12] }, resin: { u: 'L', m: 1.1, cap: 40, c: [0.6, 0.35, 0.05] },
  chitin: { u: 'kg', cap: 80, c: [0.09, 0.08, 0.11] }, ichor: { u: 'L', m: 1.05, cap: 40, c: [0.34, 1, 0.05] }, 'xeno shard': { u: 'kg', cap: 60, c: [0.5, 0.7, 1] },
  iron: { u: 'kg', cap: 200, c: [0.42, 0.45, 0.48], place: 7 }, copper: { u: 'kg', cap: 200, c: [0.6, 0.3, 0.1] },
  part: { u: 'ea', m: 30, cap: 8, c: [0.55, 0.6, 0.64] }, 'xeno core': { u: 'ea', m: 3, cap: 4, c: [0.6, 0.8, 1] },
  'rifle rounds': { u: 'rd', m: 0.012, cap: 600, c: [0.6, 0.42, 0.14] }, shells: { u: 'rd', m: 0.045, cap: 120, c: [0.5, 0.15, 0.1] },
  'o2 cell': { u: 'ea', m: 1.4, cap: 6, c: [0.5, 0.7, 0.8] }, 'power cell': { u: 'ea', m: 2.2, cap: 6, c: [1, 0.6, 0.1] },
  'laser drill': { u: 'ea', m: 7, cap: 1, tool: 1 }, antenna: { u: 'ea', m: 18, cap: 2, build: 1 }, rifle: { u: 'ea', m: 4.1, cap: 1, weapon: 1 }, shotgun: { u: 'ea', m: 3.6, cap: 1, weapon: 1 },
  furnace: { u: 'ea', m: 70, cap: 2, build: 1 }, miner: { u: 'ea', m: 45, cap: 2, build: 1 }, belt: { u: 'ea', m: 3, cap: 40, build: 1 }, assembler: { u: 'ea', m: 80, cap: 2, build: 1 },
  chest: { u: 'ea', m: 12, cap: 4, build: 1 }, pad: { u: 'ea', m: 120, cap: 1, build: 1 }, 'bio-printer': { u: 'ea', m: 90, cap: 1, build: 1 }, hub: { u: 'ea', m: 55, cap: 2, build: 1 }, drone: { u: 'ea', m: 8, cap: 8 },
};
for (const k in ITEMS) { const d = ITEMS[k]; d.id = k; if (d.m === undefined) d.m = 1; }
export const CARRY = 600;                    // kg the suit frame carries
export const EPS = 1e-7;
export function fmtAmt(id, n) { const u = ITEMS[id] ? ITEMS[id].u : 'kg'; return u === 'ea' ? (n > 1 ? 'x' + Math.round(n) : '') : u === 'rd' ? Math.round(n) + ' rd' : (n < 10 ? n.toFixed(2) : n < 100 ? n.toFixed(1) : n.toFixed(0)) + ' ' + u; }
export const fmtCost = c => Object.entries(c).map(([k, n]) => `${k} ${fmtAmt(k, n) || 'x1'}`).join(', ');

export const makeInv = n => ({ slots: new Array(n).fill(null) });
export const inv = {
  count(I, id) { let n = 0; for (const s of I.slots) if (s && s.id === id) n += s.n; return n; },
  mass(I) { let m = 0; for (const s of I.slots) if (s) m += s.n * ITEMS[s.id].m; return m; },
  // add up to n; returns what did not fit. limit = kg the container may still take (Infinity for chests)
  add(I, id, n, limit = Infinity) {
    const d = ITEMS[id]; if (!d || !(n > 0)) return 0; n = Math.min(n, Math.max(0, limit) / d.m); let left = n;
    for (let pass = 0; pass < 2 && left > EPS; pass++) for (let i = 0; i < I.slots.length && left > EPS; i++) {
      const s = I.slots[i];
      if (pass === 0 ? s && s.id === id && s.n < d.cap : !s) { const k = Math.min(left, d.cap - (s ? s.n : 0)); if (s) s.n += k; else I.slots[i] = { id, n: k }; left -= k; }
    }
    return left > EPS ? left : 0;
  },
  // take up to n; returns what was taken
  take(I, id, n) {
    let need = n;
    for (let i = I.slots.length - 1; i >= 0 && need > EPS; i--) { const s = I.slots[i]; if (s && s.id === id) { const k = Math.min(need, s.n); s.n -= k; need -= k; if (s.n <= EPS) I.slots[i] = null; } }
    return n - Math.max(0, need);
  },
  has(I, cost) { for (const k in cost) if (this.count(I, k) < cost[k] - EPS) return false; return true; },
  pay(I, cost) { if (!this.has(I, cost)) return false; for (const k in cost) this.take(I, k, cost[k]); return true; },
  dump(I) { return I.slots.map(s => s ? [s.id, +s.n.toFixed(6)] : 0); },
  load(I, a) { I.slots = a.map(s => s ? { id: s[0], n: s[1] } : null); return I; },
};

// t = machine seconds for one batch. by = the machine that specialises in it. The suit printer can print all of them,
// SUIT_SLOW times slower: print the first machines by hand, then let the machines do it.
export const SUIT_SLOW = 8;
export const RECIPES = [
  { id: 'iron', out: { iron: 1 }, in: { 'iron ore': 1.6 }, t: 1.6, by: 'furnace' },
  { id: 'copper', out: { copper: 1 }, in: { 'copper ore': 1.8 }, t: 2, by: 'furnace' },
  { id: 'part', out: { part: 1 }, in: { iron: 12 }, t: 4, by: 'assembler' },
  { id: 'rifle rounds', out: { 'rifle rounds': 30 }, in: { iron: 0.3, copper: 0.1 }, t: 2.5, by: 'assembler' },
  { id: 'shells', out: { shells: 8 }, in: { iron: 0.25, copper: 0.15 }, t: 2.5, by: 'assembler' },
  { id: 'o2 cell', out: { 'o2 cell': 1 }, in: { biomass: 2, iron: 0.4 }, t: 3, by: 'assembler' },
  { id: 'power cell', out: { 'power cell': 1 }, in: { lumen: 1.5, copper: 0.5 }, t: 4, by: 'assembler' },
  { id: 'belt', out: { belt: 4 }, in: { iron: 3 }, t: 2, by: 'assembler' },
  { id: 'chest', out: { chest: 1 }, in: { iron: 6 }, t: 3, by: 'assembler' },
  { id: 'furnace', out: { furnace: 1 }, in: { basalt: 40 }, t: 6, by: 'assembler' },
  { id: 'miner', out: { miner: 1 }, in: { iron: 14 }, t: 6, by: 'assembler' },
  { id: 'assembler', out: { assembler: 1 }, in: { iron: 22, copper: 6 }, t: 9, by: 'assembler' },
  { id: 'hub', out: { hub: 1 }, in: { iron: 18, copper: 8, lumen: 2 }, t: 9, by: 'assembler' },
  { id: 'drone', out: { drone: 1 }, in: { iron: 5, copper: 3, lumen: 0.5 }, t: 6, by: 'assembler' },
  { id: 'antenna', out: { antenna: 1 }, in: { iron: 8, copper: 4 }, t: 5, by: 'assembler' },
  { id: 'bio-printer', out: { 'bio-printer': 1 }, in: { iron: 25, copper: 12, lumen: 8, biomass: 10 }, t: 15, by: 'assembler' },
  { id: 'pad', out: { pad: 1 }, in: { iron: 40 }, t: 12, by: 'assembler' },
  { id: 'rifle', out: { rifle: 1 }, in: { iron: 4, copper: 0.5 }, t: 8, by: 'assembler' },
  { id: 'shotgun', out: { shotgun: 1 }, in: { iron: 3.5, fibre: 0.5 }, t: 8, by: 'assembler' },
];
export const RECIPE = Object.fromEntries(RECIPES.map(r => [r.id, r]));
export const massOf = c => { let m = 0; for (const k in c) m += c[k] * ITEMS[k].m; return m; };

// the suit printer: a queue of batches. Inputs are taken when a batch is queued and given back if it is cancelled.
export const PRINT_W = 180;                  // watts while printing
export function printerQueue(pr, I, rid, n = 1) { const r = RECIPE[rid]; let k = 0; for (; k < n; k++) { if (!r || pr.q.length >= 12 || !inv.pay(I, r.in)) break; pr.q.push({ r: rid, left: r.t * SUIT_SLOW, total: r.t * SUIT_SLOW }); } return k; }
export function printerCancel(pr, I, i) { const j = pr.q[i]; if (!j) return; pr.q.splice(i, 1); const r = RECIPE[j.r]; for (const k in r.in) inv.add(I, k, r.in[k]); }
// advance by dt with the battery (an object with .wh); returns the recipe id that finished, if any
export function printerStep(pr, I, dt, bat, limit = Infinity) {
  const j = pr.q[0]; if (!j) return null; const wh = PRINT_W * dt / 3600; if (bat.wh < wh) { pr.stall = 'no power'; return null; }
  pr.stall = ''; bat.wh -= wh; j.left -= dt; if (j.left > 0) return null;
  const r = RECIPE[j.r]; pr.over = null; for (const k in r.out) { const left = inv.add(I, k, r.out[k], limit); if (left > 0) (pr.over || (pr.over = {}))[k] = left; }      // what does not fit is handed to the caller, who drops it at the feet
  pr.q.shift(); return j.r;
}

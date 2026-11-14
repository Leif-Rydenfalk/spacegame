// shared surface state (one module so the surface units never import each other in a cycle)
import { Particles } from '../render.js';
import { makeInv, inv, CARRY, ITEMS } from '../items.js';
export const S = {
  batch: null, parts: new Particles(7000), cam: { x: 0, y: 2 }, ppm: 60, zoom: 1, zo: 1, zoT: 1, far: 0, lod: 0, mouse: { x: 0, y: 0 },
  inv: makeInv(36), printer: { q: [], stall: '' }, bullets: [], decals: [], lights: [], P: null, calm: 0, corpse: null, flash: 0,
  mode: 'build', uiOpen: false, msg: '', msgT: 0, stats: { kills: {}, dug: 0, vapor: 0, shots: 0 }, open: null,
  // amounts are floats; add returns what did not fit (slot space or the suit's carry limit)
  add(k, n = 1) { return inv.add(this.inv, k, n, CARRY - inv.mass(this.inv) + (ITEMS[k].u === 'ea' ? 1e9 : 0)); },
  count(k) { return inv.count(this.inv, k); },
  has(cost) { return inv.has(this.inv, cost); },
  pay(cost) { return inv.pay(this.inv, cost); },
  gains: [], gain(id, n) { if (!(n > 0)) return; const g = this.gains.find(q => q.id === id); if (g) { g.n += n; g.t = 3; } else this.gains.push({ id, n, t: 3 }); },
  give(k, n) { const left = this.add(k, n); this.gain(k, n - left); if (left > 1e-6 && this.msgT <= 0) this.say('suit is full: ' + k + ' left behind', 2); return left; },
  say(m, t = 3) { this.msg = m; this.msgT = t; },
};
export const C = {   // linear colours
  suit: [0.2, 0.21, 0.22], dark: [0.07, 0.075, 0.085], steel: [0.2, 0.22, 0.24], hull: [0.55, 0.6, 0.64], amber: [1.0, 0.45, 0.07], cyan: [0.03, 0.9, 0.63],
  violet: [0.3, 0.09, 1.0], acid: [0.34, 1.0, 0.05], hot: [1.0, 0.11, 0.04], brass: [0.6, 0.42, 0.14], chitin: [0.055, 0.05, 0.065], warm: [1.0, 0.9, 0.74],
  flesh: [0.2, 0.07, 0.09], xeno: [0.5, 0.75, 1.0], red: [1.0, 0.06, 0.04], concrete: [0.17, 0.172, 0.175], bark: [0.035, 0.045, 0.05],
};
export const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
export const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// shared surface state (one module so the surface units never import each other in a cycle)
import { Particles } from '../render.js';
export const S = {
  batch: null, parts: new Particles(5000), cam: { x: 0, y: 2 }, ppm: 60, mouse: { x: 0, y: 0 },
  inv: {}, bullets: [], decals: [], lights: [], P: null, calm: 0, corpse: null, flash: 0, crack: null,
  add(k, n = 1) { this.inv[k] = (this.inv[k] || 0) + n; if (this.inv[k] <= 0) delete this.inv[k]; },
  has(cost) { for (const k in cost) if ((this.inv[k] || 0) < cost[k]) return false; return true; },
  pay(cost) { for (const k in cost) this.add(k, -cost[k]); },
};
export const C = {   // linear colours
  suit: [0.2, 0.21, 0.22], dark: [0.07, 0.075, 0.085], steel: [0.2, 0.22, 0.24], hull: [0.55, 0.6, 0.64], amber: [1.0, 0.45, 0.07], cyan: [0.03, 0.9, 0.63],
  violet: [0.3, 0.09, 1.0], acid: [0.34, 1.0, 0.05], hot: [1.0, 0.11, 0.04], brass: [0.6, 0.42, 0.14], chitin: [0.055, 0.05, 0.065], warm: [1.0, 0.9, 0.74],
};
export const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

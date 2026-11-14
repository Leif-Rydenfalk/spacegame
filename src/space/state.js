// shared space state
import { Particles } from '../render.js';
export const Sp = {
  t: 0, warp: 1, ships: [], me: null, depot: null, target: null, batch: null, parts: new Particles(6000), shells: [], chunks: [], asteroids: [],
  cam: { x: 0, y: 0, scale: 0.5, focus: null, px: 0, py: 0 }, map: false, hangar: false, auto: false, pilot: null, msg: '', msgT: 0, g: [0, 0], frame: { body: 0 },
  say(m) { this.msg = m; this.msgT = 4; },
};
export const K = {   // linear colours
  hull: [0.6, 0.64, 0.68], dark: [0.09, 0.1, 0.11], steel: [0.25, 0.27, 0.3], amber: [1.0, 0.45, 0.07], cyan: [0.03, 0.9, 0.63], warm: [1.0, 0.88, 0.72],
  flesh: [0.2, 0.09, 0.13], ichor: [0.34, 1.0, 0.05], violet: [0.3, 0.09, 1.0], hot: [1.0, 0.11, 0.04],
};
export const mul = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

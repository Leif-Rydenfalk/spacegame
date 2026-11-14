// the planet: charts, Cartesian maps and the camera's curved view. The simulation runs in polar coordinates (gen.js):
// x along the datum circle, y altitude, gravity -y, which is radial. x is periodic, so the world needs a seam
// somewhere; it is kept away from the player. There are two charts, half a turn apart: chart 0 holds x in
// [-CIRC/4, 3CIRC/4), chart 1 holds [-3CIRC/4, CIRC/4). The half of the planet around the crash site has the same
// coordinates in both, so home never moves; the far half is re-expressed (x +- CIRC) when the player comes within
// 400 m of the current seam. Every module that holds positions registers a shifter; fix(x) is idempotent.
import { CIRC, RAD, GRAV } from './gen.js';
export { CIRC, RAD };
const HYST = 400;
export const planet = {
  chart: 0, lo: -CIRC / 4, shifters: [], shifts: 0,
  fix(x) { return x - CIRC * Math.floor((x - this.lo) / CIRC); },
  fixG(gx) { return gx - CIRC * 2 * Math.floor((gx - this.lo * 2) / (CIRC * 2)); },      // 0.5 m grid units
  onShift(f) { this.shifters.push(f); },
  // choose the chart for a player at px and re-express everything in it. Returns the player's x in the chart.
  update(px, force) {
    const c = this.chart, lo = this.lo, hi = lo + CIRC; let x = this.fix(px);
    if (x < lo + HYST || x > hi - HYST) { this.chart = 1 - c; this.lo = this.chart ? -CIRC * 3 / 4 : -CIRC / 4; x = this.fix(x); }
    if (this.chart !== c || force || x !== px) { this.shifts++; for (const f of this.shifters) f(v => this.fix(v), v => this.fixG(v)); }
    return x;
  },
  reset() { this.chart = 0; this.lo = -CIRC / 4; },
  // the signed distance from a to b along the ground, the short way round
  dx(a, b) { let d = (b - a) % CIRC; if (d > CIRC / 2) d -= CIRC; else if (d < -CIRC / 2) d += CIRC; return d; },
  // longitude in degrees east of the crash site, -180..180
  lon(x) { return this.dx(0, x) / RAD * 180 / Math.PI; },
  // polar -> Cartesian, origin at the planet's centre, the crash site on the +Y axis, east clockwise
  toCart(x, y, out = [0, 0]) { const a = x / RAD, r = RAD + y; out[0] = r * Math.sin(a); out[1] = r * Math.cos(a); return out; },
  fromCart(X, Y, out = [0, 0]) { out[0] = Math.atan2(X, Y) * RAD; out[1] = Math.hypot(X, Y) - RAD; return out; },
  // local up as a Cartesian unit vector, and the gravity vector there (m/s2): it points at the centre
  up(x, out = [0, 0]) { const a = x / RAD; out[0] = Math.sin(a); out[1] = Math.cos(a); return out; },
  gravity(x, y, out = [0, 0]) { const a = x / RAD; out[0] = -GRAV * Math.sin(a); out[1] = -GRAV * Math.cos(a); return out; },
  // a velocity (along the ground, up) at x as a Cartesian vector: what the launch hands to the orbital act
  velCart(x, vx, vy, out = [0, 0]) { const a = x / RAD, c = Math.cos(a), s = Math.sin(a); out[0] = vx * c + vy * s; out[1] = -vx * s + vy * c; return out; },
  // the camera looks along local down: cam = { x, y } in polar metres, ppm pixels per metre, (w, h) the screen.
  // A world point lands where its true position is, in a frame turned so that the camera's up is the screen's up.
  toScreen(cam, ppm, w, h, x, y, out = [0, 0]) { const a = (x - cam.x) / RAD, r = RAD + y; out[0] = w / 2 + r * Math.sin(a) * ppm; out[1] = h / 2 - (r * Math.cos(a) - RAD - cam.y) * ppm; return out; },
  fromScreen(cam, ppm, w, h, sx, sy, out = [0, 0]) { const px = (sx - w / 2) / ppm, py = (h / 2 - sy) / ppm + RAD + cam.y; out[0] = cam.x + Math.atan2(px, py) * RAD; out[1] = Math.hypot(px, py) - RAD; return out; },
};

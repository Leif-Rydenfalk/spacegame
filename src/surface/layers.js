// layers in front of the rock: platforms. A platform is a deck of grating at the top of one 0.5 m cell. It is passable:
// you land on it when you come down onto it, you jump up through it from below, and holding S (down) lets you drop
// through it. So one shaft can have many floors and you choose where to stand. Machines can stand on a deck. Loose rock
// falls through the grating. (The layer behind the rock, the back wall, is a bit in the terrain's material byte:
// world.js WALL. It stays when the rock in front of it is cut away, so a dug cave shows rock behind it and never sky.)
import { TS, world } from './world.js';
import { C, mul } from './state.js';
const key = (x, y) => (x + 32768) * 65536 + (y + 32768);
export const PL = { cells: new Map() };
export const platAt = (gx, gy) => PL.cells.has(key(gx, gy));
export function addPlat(gx, gy) { PL.cells.set(key(gx, gy), [gx, gy]); }
export function removePlat(gx, gy) { return PL.cells.delete(key(gx, gy)); }
// a deck needs something to hang on: rock or another deck beside it, or rock, a deck or a post under it
export function canPlat(gx, gy, extra) {
  if (platAt(gx, gy) || world.dens((gx + 0.5) * TS, (gy + 0.9) * TS) > 0) return false;
  const held = (x, y) => platAt(x, y) || world.dens((x + 0.5) * TS, (y + 0.9) * TS) > 0 || (extra && extra(x, y));
  return held(gx - 1, gy) || held(gx + 1, gy) || held(gx, gy - 1) || world.dens((gx + 0.5) * TS, gy * TS + 0.05) > 0;
}
// the deck a body comes down onto: feet at x, moving from y0 down to y1. Returns the deck's height or null.
export function deckUnder(x, y0, y1, half = 0.2) {
  if (!PL.cells.size) return null; let best = null;
  for (let gy = Math.floor(y0 / TS) - 1; gy >= Math.floor(y1 / TS) - 1; gy--) { const top = (gy + 1) * TS; if (top > y0 + 1e-6 || top < y1) continue; if (platAt(Math.floor((x - half) / TS), gy) || platAt(Math.floor((x + half) / TS), gy) || platAt(Math.floor(x / TS), gy)) { best = top; break; } }
  return best;
}
// walking into a deck that lies a little higher than the feet (a deck laid over a cut whose rim has sagged): the
// height to step up to, or null
export function deckStep(x, y, dir) {
  if (!PL.cells.size) return null; const gy = Math.floor(y / TS + 1e-6), top = (gy + 1) * TS; if (top - y > 0.42 || top - y < 0.005) return null;
  return platAt(Math.floor((x + dir * 0.3) / TS), gy) || platAt(Math.floor((x + dir * 0.1) / TS), gy) ? top : null;
}
export function drawPlats(b, cam, zo, ghost) {
  for (const [gx, gy] of PL.cells.values()) {
    const x = (gx + 0.5) * TS, y = (gy + 1) * TS; if (Math.abs(x - cam.x) > 26 * Math.min(zo, 4) || Math.abs(y - cam.y) > 15 * Math.min(zo, 4)) continue;
    drawDeck(b, gx, gy, 1, false);
  }
}
export function drawDeck(b, gx, gy, a, ghost) {
  const x = (gx + 0.5) * TS, y = (gy + 1) * TS, md = ghost ? 2 : 1, col = ghost ? [0.06, 0.3, 0.38] : mul(C.steel, 0.9);
  b.add(x, y - 0.035, TS + 0.01, 0.07, 0, col, a, 0, md, gx); b.add(x, y - 0.1, TS - 0.08, 0.03, 0, ghost ? col : mul(C.dark, 1.2), a, 0, md, gx + 3);
  if (!ghost) { for (const d of [-0.17, 0, 0.17]) b.add(x + d, y - 0.07, 0.025, 0.07, 0, C.dark, a, 0, 1); b.add(x, y - 0.004, TS, 0.012, 0, mul(C.hull, 0.8), a * 0.8, 0, 1); }
}
export function dumpPlats() { return [...PL.cells.values()].map(q => [q[0], q[1]]); }
export function loadPlats(a) { PL.cells.clear(); for (const q of a || []) addPlat(q[0], q[1]); }
export function shiftPlats(fg) { const all = [...PL.cells.values()]; PL.cells.clear(); for (const q of all) addPlat(fg(q[0]), q[1]); }

// where the alien ruins, the hives and the human facilities stand: one slot every 72 m, a pure function of the seed.
// The slots go round the planet: 56 of them. The hive's main base is on the antipode of the crash site.
import { hash } from '../core.js';
import { CIRC } from './gen.js';
import { genRuin } from './ruins-gen.js';
import { genHive } from './hive-gen.js';
import { genBase } from './base-gen.js';
const SLOT = 72, NS = CIRC / SLOT, cache = new Map();
const FORCED = { 1: 'hive', '-2': 'ruin', 2: 'base', '-3': 'lab', 3: 'ruin', '-4': 'hive', 27: 'main' };      // what the first hours need to be near; and the far side
const EMPTY = new Set([0, -1, -14, 41, 13, 14, 28, 26]);         // the crash site, the two chart seams, and room around the main hive
export const canonSlot = s => s - NS * Math.floor((s + 14) / NS);                  // -14 .. 41
export const MAIN_X = CIRC / 2;
// s is a slot index in chart coordinates: the same structure comes back for s and s + 56, one circumference apart
export function slotStruct(s) {
  if (cache.has(s)) return cache.get(s);
  const c = canonSlot(s), off = (s - c) * SLOT, r = hash(c, 2, 70); let kind = FORCED[c];
  const ax = (kind === 'main' ? MAIN_X : c * SLOT + 36 + (hash(c, 1, 70) - 0.5) * 20) + off;
  if (!kind) kind = EMPTY.has(c) ? null : r < 0.3 ? 'ruin' : r < 0.56 ? 'hive' : r < 0.72 ? 'base' : r < 0.84 ? 'lab' : null;
  const seed = Math.floor(hash(c, 3, 70) * 1e9), main = kind === 'main', id = (main ? 'hive' : kind) + ':' + c;
  const st = kind === 'ruin' ? genRuin(id, ax, seed) : kind === 'hive' || main ? genHive(id, ax, seed, main) : kind ? genBase(id, ax, seed, kind === 'lab') : null;
  if (st) { st.slot = c; st.main = main; st.props.forEach((p, i) => { p.i = i; p.site = st; }); }
  cache.set(s, st); return st;
}
export function structsIn(x0, x1) { const out = []; for (let s = Math.floor((x0 - 60) / SLOT); s <= Math.floor((x1 + 60) / SLOT); s++) { const st = slotStruct(s); if (st && st.x1 > x0 && st.x0 < x1) out.push(st); } return out; }
export function resetStructs() { cache.clear(); }
export const slotOf = x => Math.floor(x / SLOT);

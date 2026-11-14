// where the alien ruins, the hives and the human facilities stand: one slot every 72 m, a pure function of the seed.
import { hash } from '../core.js';
import { genRuin } from './ruins-gen.js';
import { genHive } from './hive-gen.js';
import { genBase } from './base-gen.js';
const SLOT = 72, cache = new Map();
const FORCED = { 1: 'hive', '-2': 'ruin', 2: 'base', '-3': 'lab', 3: 'ruin', '-4': 'hive' };      // what the first hours need to be near
export function slotStruct(s) {
  if (cache.has(s)) return cache.get(s);
  const ax = s * SLOT + 36 + (hash(s, 1, 70) - 0.5) * 20, r = hash(s, 2, 70); let kind = FORCED[s];
  if (!kind) kind = s === 0 || s === -1 ? null : r < 0.3 ? 'ruin' : r < 0.56 ? 'hive' : r < 0.72 ? 'base' : r < 0.84 ? 'lab' : null;
  const seed = Math.floor(hash(s, 3, 70) * 1e9), id = kind + ':' + s;
  const st = kind === 'ruin' ? genRuin(id, ax, seed) : kind === 'hive' ? genHive(id, ax, seed) : kind ? genBase(id, ax, seed, kind === 'lab') : null;
  if (st) { st.slot = s; st.props.forEach((p, i) => { p.i = i; p.site = st; }); }
  cache.set(s, st); return st;
}
export function structsIn(x0, x1) { const out = []; for (let s = Math.floor((x0 - 60) / SLOT); s <= Math.floor((x1 + 60) / SLOT); s++) { const st = slotStruct(s); if (st && st.x1 > x0 && st.x0 < x1) out.push(st); } return out; }
export function resetStructs() { cache.clear(); }
export const slotOf = x => Math.floor(x / SLOT);

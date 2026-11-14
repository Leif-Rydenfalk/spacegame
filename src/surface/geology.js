// geology: ore is rock with a high concentration (round 6 G, docs/MINING.md R1-R2, docs/SCIENCE.md V3).
// There are no ore materials. A material id names the host rock; every point of it has a composition, weight
// fractions that come from the host's baseline plus the ore-forming processes of the generation: a laterite crust in
// the soil, magmatic bands in the basalt (and a halo round them), hydrothermal veins with a porphyry halo, lumen
// veins. The numbers are the real ranges. Everything is a source of everything; what it costs is the rock you move.
// Nothing here is known for free. Every figure the player sees is an estimate with a range: wide at a glance, +-30 %
// (relative) from the suit's scanner, +-1 % once a sample has gone through the assay station. The simulation runs on
// the true value; the AI plans on the estimate. Pure functions and one map of what has been measured where.
import { hash, clamp } from '../core.js';
import { M, canonX, oreIron, oreCopper, oreLumen } from './gen.js';
import { noise2 } from '../core.js';

const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
// crustal baselines by host (weight fraction of iron; the rest of the table is for the databank)
export const HOSTS = {
  [M.SOIL]: { name: 'soil', fe: 0.045, si: 0.3, al: 0.07 }, [M.BASALT]: { name: 'basalt', fe: 0.09, si: 0.23, al: 0.08, mg: 0.04, ca: 0.07, ti: 0.01 },
  [M.OBSIDIAN]: { name: 'felsic glass', fe: 0.022, si: 0.32, al: 0.07, k: 0.03 }, [M.IRON]: { name: 'magnetite band', fe: 0.42, ti: 0.08 }, [M.COPPER]: { name: 'sulfide vein', fe: 0.07, cu: 0.02, s: 0.03 },
  [M.LUMEN]: { name: 'lumen vein', fe: 0.05, lm: 0.012 }, [M.PLATE]: { name: 'plate', fe: 0.97 }, [M.HIVE]: { name: 'hive tissue', fe: 0.001 }, [M.XENO]: { name: 'xeno stone', fe: 0.0 }, [M.CONCRETE]: { name: 'concrete', fe: 0.03 }, [M.STEEL]: { name: 'steel', fe: 0.98 },
};
// pure: the true composition of material mat at (x, y): { fe, cu, lm, host }
export function composition(mat, x, y) {
  const c = canonX(x), n = noise2(c / 3.3, y / 3.3, 611), h = HOSTS[mat] || HOSTS[M.BASALT]; let fe = h.fe, cu = 60e-6, lm = 0;
  if (mat === M.SOIL) { const lat = ss(0.58, 0.74, noise2(c / 31, y / 9, 612)); fe = 0.03 + 0.03 * n + lat * (0.17 + 0.2 * n); }                          // 3-6 %, laterite 20-40 %
  else if (mat === M.BASALT) { const band = oreIron(x, y), vein = oreCopper(x, y); fe = 0.08 + 0.02 * n + ss(0.56, 0.7, band) * 0.2; cu = 60e-6 + ss(0.6, 0.72, vein) * (0.003 + 0.007 * n); }   // 8-10 %; a halo round the bands; porphyry 0.3-1 %
  else if (mat === M.IRON) fe = 0.30 + 0.25 * ss(0.7, 0.82, oreIron(x, y)) + 0.1 * n;                                                                    // 30-65 %
  else if (mat === M.COPPER) { cu = 0.005 + 0.035 * ss(0.72, 0.84, oreCopper(x, y)) + 0.01 * n; fe = 0.06 + 0.02 * n; }                                  // 0.5-5 %
  else if (mat === M.LUMEN) { lm = 0.001 + 0.022 * ss(0.73, 0.85, oreLumen(x, y)) + 0.007 * n; fe = 0.05; }                                              // 0.1-3 %
  else if (mat === M.OBSIDIAN) fe = 0.015 + 0.015 * n;
  return { fe: +fe.toFixed(4), cu: +cu.toFixed(5), lm: +lm.toFixed(5), host: mat };
}
// what a lot of rock of this composition is sorted into: [[item, kg]]. Bands by iron grade; a vein rock is its ore;
// lumen crystal is picked out of its rock and the rest is gangue.
export function sortOut(q, kg) {
  if (q.host === M.PLATE || q.host === M.STEEL) return [['iron', kg * 0.9]];
  if (q.host === M.HIVE) return [['biomass', kg]];
  if (q.host === M.XENO) return [['xeno shard', kg]];
  if (q.fe >= 0.45) return [['iron ore', kg]];
  if (q.fe >= 0.2) return [['lean ore', kg]];
  if (q.cu >= 0.012) return [['copper ore', kg]];       // a vein; the porphyry halo round it (0.3-1 %) is still host rock
  if (q.lm >= 0.001) { const c = kg * q.lm * 0.7; return [['lumen', c], ['basalt', kg - c]]; }
  return [[q.host === M.SOIL ? 'soil' : 'basalt', kg]];
}
export const classOf = q => sortOut(q, 1)[0][0];
// ---- what is known ------------------------------------------------------------------------------------------------------
// cells of 1 m; level 1 = scanned (the held scanner), 2 = assayed (a sample from here went through the station)
export const GEO = { known: new Map(), scans: 0, assays: 0 };
const gk = (x, y) => (Math.floor(canonX(x)) + 8192) * 16384 + Math.floor(y) + 8192;
export const levelAt = (x, y) => GEO.known.get(gk(x, y)) || 0;
export function mark(x, y, r, level) { let n = 0; for (let j = -Math.ceil(r); j <= Math.ceil(r); j++) for (let i = -Math.ceil(r); i <= Math.ceil(r); i++) { if (i * i + j * j > r * r + 1) continue; const k = gk(x + i, y + j), o = GEO.known.get(k) || 0; if (level > o) { GEO.known.set(k, level); if (!o) n++; } } return n; }
// the relative half-range of an estimate at a level of knowledge; err = the scanner's own (suit.js)
export const relErr = (level, err = 0.3) => level >= 2 ? 0.01 : level === 1 ? err : 0.75;
// pure: the estimate of the iron grade at a point. { v, lo, hi, rel, level }. The error is a fixed property of the
// place and the instrument, not a dice roll: asking twice gives the same answer, and it always holds the true value.
export function estimate(mat, x, y, level, err = 0.3) {
  const q = composition(mat, x, y), rel = relErr(level, err), base = (HOSTS[mat] || HOSTS[M.BASALT]).fe, n = (hash(Math.floor(canonX(x) * 2), Math.floor(y * 2), 613) - 0.5) * 1.4;
  if (level === 0) { const lo = Math.min(base * (1 - rel), q.fe), hi = Math.max(base * (1 + rel), q.fe); return { v: base, lo, hi, rel, level, cu: (HOSTS[mat] || {}).cu || 0, lm: (HOSTS[mat] || {}).lm || 0 }; }
  const v = q.fe * (1 + n * rel);       // n in [-0.8, 0.8]: the true value is inside v +- rel * v
  return { v, lo: v * (1 - rel), hi: v * (1 + rel), rel, level, cu: q.cu * (1 + n * rel), lm: q.lm * (1 + n * rel) };
}
// an estimate of any quantity: the same rule for g, a creature's mass, a reserve. key makes the error repeatable.
export function measure(truth, rel, key = 0) { const n = (hash(key, 7, 614) - 0.5) * 1.4, v = truth * (1 + n * rel); return { v, lo: v * (1 - rel), hi: v * (1 + rel), rel }; }
export const fmtEst = (e, unit = '', digits = 1) => e.rel <= 0.0005 ? `${e.v.toFixed(digits + 2)}${unit}` : `${e.v.toFixed(digits)} ± ${(e.v * e.rel).toFixed(digits)}${unit}`;
// ---- the cut-off grade, live -----------------------------------------------------------------------------------------------
// A block is worth mining when its metal pays for moving it. Handling costs energy per kg of rock (haul it this far,
// crush and grind it: 20 kWh/t); reducing costs energy per kg of metal. urgency (0..1, how far under target) is what
// the metal is worth. Returns the lowest iron fraction worth taking.
export function cutoff(haulM, urgency) {
  const handle = 72e3 + haulM * 9 * 2.2, value = 0.6e6 * (0.35 + 2.4 * clamp(urgency, 0, 1));     // J per kg rock; J-equivalent per kg metal
  return clamp(handle / (value * 0.85), 0.02, 0.6);
}
export function dumpGeo() { return { k: [...GEO.known], s: GEO.scans, a: GEO.assays }; }
export function loadGeo(o) { GEO.known = new Map((o && o.k) || []); GEO.scans = o ? o.s : 0; GEO.assays = o ? o.a : 0; }

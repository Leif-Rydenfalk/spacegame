// procedural human facilities of the prison research colony: fortified outposts and research stations, sealed after
// the hivemind's attacks. Blast doors, one breached wall with hive growth, dead sentries and turrets, terminals,
// audio-log slots and supply caches. Whether a facility still has power is world state (sites.js), not generation.
import { rng } from '../core.js';
import { M, surfaceH } from './gen.js';
export function genBase(id, ax, seed, research) {
  const r = rng(seed), g = Math.round(surfaceH(ax) * 2) / 2, C = M.CONCRETE, S = M.STEEL, H = M.HIVE, st = [], props = [];
  const add = (mat, x0, y0, x1, y1, rr = 0.06) => st.push({ op: 1, mat, t: 'b', x0, y0, x1, y1, r: rr });
  const cut = (x0, y0, x1, y1, wall = true, mat = C) => st.push({ op: -1, mat, wall, t: 'b', x0, y0, x1, y1, r: 0.03 });
  const mods = research ? 4 : 2 + Math.floor(r() * 2), mw = 6, w = mods * mw, x0 = Math.round(ax - w / 2), xe = x0 + w, hh = 3.2, wl = 0.5, flip = r() < 0.5;
  // level the site: embankment and apron below, clear air above
  add(M.BASALT, x0 - 9, g - 9, xe + 9, g - 0.8, 0.4); add(C, x0 - 8.5, g - 1.1, xe + 8.5, g, 0.1);
  st.push({ op: -1, mat: 0, wall: false, t: 'b', x0: x0 - 8.5, y0: g, x1: xe + 8.5, y1: g + 11, r: 0 });
  // basement under one module
  const bm = research || r() < 0.6 ? 1 : -1, bx = x0 + Math.max(0, bm) * mw;
  if (bm >= 0) add(C, bx - 0.3, g - 5.2, bx + mw + 0.3, g - 0.6, 0.1);
  // modules: concrete shell, steel roof, lit interior
  for (let i = 0; i < mods; i++) {
    const a = x0 + i * mw; add(C, a, g, a + mw, g + hh + 0.35); add(S, a - 0.15, g + hh, a + mw + 0.15, g + hh + 0.5, 0.04);
    cut(a + wl, g, a + mw - wl, g + hh);
    props.push({ t: 'elight', x: a + mw / 2, y: g + hh - 0.22 });
  }
  for (let i = 1; i < mods; i++) cut(x0 + i * mw - wl - 0.05, g, x0 + i * mw + wl + 0.05, g + 2.3);
  if (bm >= 0) { cut(bx + wl, g - 4.6, bx + mw - wl, g - 1.4); cut(bx + mw - 2.1, g - 1.5, bx + mw - 0.9, g + 0.1); props.push({ t: 'cache', x: bx + 1.4, y: g - 4.6, loot: research ? 'lab' : 'armory' }, { t: 'terminal', x: bx + 2.8, y: g - 4.6, n: 2 }, { t: 'elight', x: bx + mw / 2, y: g - 1.6 }); }
  // sealed blast door on one end, breach on the other
  const dx = flip ? xe - wl : x0, bxr = flip ? x0 : xe, sd = flip ? 1 : -1;
  cut(dx - 0.05, g, dx + wl + 0.05, g + 2.4); add(S, dx + 0.08, g, dx + wl - 0.08, g + 2.4, 0.02); props.push({ t: 'door', x: dx + wl / 2, y: g, h: 2.4 });
  st.push({ op: -1, mat: C, t: 'e', x: bxr, y: g + 1.3, rx: 1.3 + r() * 0.5, ry: 1.7 }, { op: -1, mat: C, t: 'e', x: bxr - sd * 0.8, y: g + 2.6, rx: 0.9, ry: 0.8 });
  st.push({ op: 1, mat: H, t: 'e', x: bxr - sd * 2.4, y: g + 0.1, rx: 1.9, ry: 0.55 }, { op: 1, mat: H, t: 'e', x: bxr + sd * 1.6, y: g + hh - 0.1, rx: 1.3, ry: 0.5 }, { op: 1, mat: H, t: 'c', x0: bxr - sd * 0.9, y0: g + hh + 0.4, x1: bxr - sd * 4, y1: g + hh + 0.9, r: 0.45, r1: 0.15 }, { op: 1, mat: H, t: 'e', x: bxr - sd * 5, y: g - 0.1, rx: 1.4, ry: 0.5 });
  props.push({ t: 'breach', x: bxr, y: g + 1.2 });
  // watchtower with a dead turret, perimeter wall, mast
  const tx = dx + wl / 2 + sd * 5.5;
  add(S, tx - 0.22, g, tx + 0.22, g + 7); add(S, tx - 1.6, g + 7, tx + 1.6, g + 7.3); add(S, tx - 1.6, g + 7.3, tx - 1.45, g + 8.2, 0.02); add(S, tx + 1.45, g + 7.3, tx + 1.6, g + 8.2, 0.02);
  props.push({ t: 'turret', x: tx, y: g + 7.3 }, { t: 'turret', x: dx + wl / 2 + sd * 1.7, y: g }, { t: 'mast', x: x0 + mw * 0.5, y: g + hh + 0.5 });
  const px = bxr - sd * 7; add(C, px - 0.3, g, px + 0.3, g + 2.6); st.push({ op: -1, mat: C, t: 'e', x: px, y: g + 2.3, rx: 0.9, ry: 1.1 });
  // what was left behind
  props.push({ t: 'terminal', x: x0 + mw * 0.5 + 1.2, y: g, n: 0 }, { t: 'audiolog', x: x0 + mw * 1.5 - 1.5, y: g, n: 0 }, { t: 'cache', x: x0 + mw * 0.5 - 1.3, y: g, loot: 'supply' }, { t: 'sign', x: dx + wl / 2 + sd * 0.9, y: g + 2.9, research });
  if (mods > 2) props.push({ t: 'terminal', x: x0 + mw * 2.5, y: g, n: 1 }, { t: 'audiolog', x: x0 + mw * 2.5 + 1.6, y: g, n: 1 });
  if (research) for (let i = 0; i < 3; i++) props.push({ t: 'tank', x: x0 + mw * 3 + 1.3 + i * 1.5, y: g, k: i });
  const ns = 2 + Math.floor(r() * 3); for (let i = 0; i < ns; i++) props.push({ t: 'sentry', x: x0 - 6 + r() * (w + 12), y: g, f: r() < 0.5 ? -1 : 1 });
  return { id, kind: 'base', research: !!research, x: ax, x0: x0 - 9, x1: xe + 9, y0: g - 9, y1: g + 12, g, stamps: st, props, breach: [bxr, g + 1.2], door: [dx + wl / 2, g] };
}

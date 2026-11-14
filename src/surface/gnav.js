// the ground hauler's path-finding (round 6 O): a real search over the rock as it is now, not a rule of thumb.
// The hauler's six legs hold on to rock, so where it can be is the thin shell of air along every surface: down into a
// cut, up a wall, under an overhang. The search is A* over that shell on a 0.25 m grid, eight neighbours, the field
// read live, so a path found after a dig is a path through the dig. Hanging under a roof and climbing cost more than
// walking a floor. It returns the way as points, or null when there is none (and that is a reason, not a silence).
import { world } from './world.js';

const G = 0.25, nv = [0, 0];
// can the hauler be at this point? Air, with rock close enough for its feet
const shell = (x, y) => { const d = -world.dens(x, y); return d > 0.07 && d < 0.5; };
const key = (i, j) => (i + 32768) * 65536 + (j + 32768);
function nearestShell(x, y, r = 1.75) {
  let best = null, bd = 1e9; const i0 = Math.round(x / G), j0 = Math.round(y / G), n = Math.ceil(r / G);
  for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) { const d = i * i + j * j; if (d < bd && shell((i0 + i) * G, (j0 + j) * G)) { bd = d; best = [i0 + i, j0 + j]; } }
  return best;
}
// from (ax, ay) to beside (bx, by). Returns [[x, y], ...] or null. stats (optional) gets { nodes }.
export function groundPath(ax, ay, bx, by, maxNodes = 16000, stats) {
  const s = nearestShell(ax, ay), g = nearestShell(bx, by, 2.25); if (!s || !g) return null;
  const open = [], gS = new Map(), from = new Map(), closed = new Set(), h = (i, j) => Math.hypot(i - g[0], j - g[1]);
  const push = (f, i, j) => { open.push([f, i, j]); let c = open.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (open[p][0] <= open[c][0]) break; [open[p], open[c]] = [open[c], open[p]]; c = p; } };
  const pop = () => { const top = open[0], last = open.pop(); if (open.length) { open[0] = last; let c = 0; for (;;) { const l = c * 2 + 1, r = l + 1; let m = c; if (l < open.length && open[l][0] < open[m][0]) m = l; if (r < open.length && open[r][0] < open[m][0]) m = r; if (m === c) break; [open[m], open[c]] = [open[c], open[m]]; c = m; } } return top; };
  gS.set(key(s[0], s[1]), 0); push(h(s[0], s[1]), s[0], s[1]); let nodes = 0;
  while (open.length) {
    const [, i, j] = pop(), k = key(i, j); if (closed.has(k)) continue; closed.add(k); if (++nodes > maxNodes) break;
    if (Math.abs(i - g[0]) <= 1 && Math.abs(j - g[1]) <= 1) {
      const out = []; let c = k; for (;;) { out.push([(Math.floor(c / 65536) - 32768) * G, ((c % 65536) - 32768) * G]); const p = from.get(c); if (p === undefined) break; c = p; }
      out.reverse(); if (stats) stats.nodes = nodes; return out;
    }
    const g0 = gS.get(k);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue; const a = i + di, b = j + dj, nk = key(a, b); if (closed.has(nk)) continue; const x = a * G, y = b * G; if (!shell(x, y)) continue;
      // a floor is cheap; a wall costs half again, a roof twice: it takes the easy way when there is one
      world.normal(x, y, nv); const steep = nv[1] > 0.5 ? 1 : nv[1] > -0.3 ? 1.5 : 2, c = g0 + Math.hypot(di, dj) * steep; if (c >= (gS.get(nk) ?? 1e9)) continue;
      gS.set(nk, c); from.set(nk, k); push(c + h(a, b), a, b);
    }
  }
  if (stats) stats.nodes = nodes; return null;
}
// metres along a path
export const pathLen = p => { let d = 0; for (let i = 1; i < p.length; i++) d += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return d; };

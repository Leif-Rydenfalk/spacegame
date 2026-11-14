// procedural hives: chambers and tunnels grown under the surface, lined with hive tissue, one winding throat to the
// open air. Egg sacs sit on the chamber floors; the heart sits in the core chamber.
import { rng } from '../core.js';
import { M, surfaceH } from './gen.js';
// main = the hivemind's seat on the far side of the planet: deeper, wider, twice the chambers, three throats' worth of tissue
export function genHive(id, ax, seed, main) {
  const r = rng(seed), g = surfaceH(ax), H = M.HIVE, lin = [], cut = [], props = [];
  const K = main ? 1.7 : 1, cy = g - (20 + r() * 8) * (main ? 1.5 : 1), ch = [{ x: ax, y: cy, rx: (5 + r() * 1.5) * K, ry: 3.2 * K }], n = main ? 10 : 4 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) { const a = (i / n) * 6.283 + r(), d = (9 + r() * 5) * (main ? 1.3 + (i % 2) * 0.75 : 1); ch.push({ x: ax + Math.cos(a) * d * 1.4, y: cy + Math.sin(a) * d * 0.7, rx: (2.6 + r() * 2) * (main ? 1.3 : 1), ry: (1.8 + r() * 1.2) * (main ? 1.3 : 1) }); }
  let top = ch[0]; for (const c of ch) if (c.y > top.y) top = c;
  const mx = ax + (r() - 0.5) * 26, gm = surfaceH(mx), pts = [[top.x, top.y], [top.x + (mx - top.x) * 0.3 + (r() - 0.5) * 7, top.y + (gm - top.y) * 0.4], [mx + (r() - 0.5) * 6, top.y + (gm - top.y) * 0.75], [mx, gm + 0.9]];
  for (const c of ch) { lin.push({ op: 1, mat: H, t: 'e', x: c.x, y: c.y, rx: c.rx + 1.2, ry: c.ry + 1.2 }); cut.push({ op: -1, mat: H, wall: true, t: 'e', x: c.x, y: c.y, rx: c.rx, ry: c.ry }); }
  for (let i = 1; i < ch.length; i++) { lin.push({ op: 1, mat: H, t: 'c', x0: ch[0].x, y0: ch[0].y, x1: ch[i].x, y1: ch[i].y, r: 1.9 }); cut.push({ op: -1, mat: H, wall: true, t: 'c', x0: ch[0].x, y0: ch[0].y - 0.6, x1: ch[i].x, y1: ch[i].y - 0.3, r: 1.05 }); }
  for (let i = 0; i < 3; i++) { lin.push({ op: 1, mat: H, t: 'c', x0: pts[i][0], y0: pts[i][1], x1: pts[i + 1][0], y1: pts[i + 1][1] - (i === 2 ? 1.2 : 0), r: 2.0 }); cut.push({ op: -1, mat: H, wall: i < 2 ? true : undefined, t: 'c', x0: pts[i][0], y0: pts[i][1], x1: pts[i + 1][0], y1: pts[i + 1][1], r: 1.15 }); }
  lin.push({ op: 1, mat: H, t: 'e', x: mx - 2.2, y: gm + 0.2, rx: 1.7, ry: 1.3 }, { op: 1, mat: H, t: 'e', x: mx + 2.3, y: gm + 0.1, rx: 1.9, ry: 1.1 });
  props.push({ t: 'mouth', x: mx, y: gm + 0.4 }, { t: 'heart', x: ax, y: cy + 0.4 });
  for (const c of ch) { const k = 2 + Math.floor(r() * 4); for (let i = 0; i < k; i++) { const dx = (r() - 0.5) * 1.5, u = Math.max(-0.92, Math.min(0.92, dx)); props.push({ t: 'egg', x: c.x + u * c.rx, y: c.y - c.ry * Math.sqrt(1 - u * u) + 0.05, s: 0.7 + r() * 0.6 }); } }
  let x0 = mx - 5, x1 = mx + 5, y0 = cy; for (const c of ch) { x0 = Math.min(x0, c.x - c.rx - 2); x1 = Math.max(x1, c.x + c.rx + 2); y0 = Math.min(y0, c.y - c.ry - 2); }
  if (main) for (const sg of [-1, 1]) for (let i = 0; i < 3; i++) { const x = mx + sg * (5 + i * 4.2 + r() * 2); lin.push({ op: 1, mat: H, t: "e", x, y: surfaceH(x) - 0.2, rx: 1.7 - i * 0.3 + r() * 0.6, ry: 0.9 - i * 0.2 + r() * 0.3 }); }      // a field of low tissue mounds around the mouth
  return { id, kind: 'hive', x: ax, x0, x1, y0, y1: Math.max(g, gm) + 4, stamps: lin.concat(cut), props, mouth: [mx, gm + 0.6], core: [ax, cy], chambers: ch };
}

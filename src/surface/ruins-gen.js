// procedural alien ruins: a seeded grammar that writes density stamps (solid xeno stone, carved halls) and props.
//   Site  -> Shell Hall Shaft Arch Vault Field
//   Hall  -> Bay{3|5}            Bay   -> Pillar Glyph, under a corbelled ceiling
//   Field -> (Monolith Spire Monolith){1|2}
// The style has five rules, and every production obeys them: every solid tapers upward; nothing ends square;
// openings are corbelled or lancet, never a rectangle; elements come in threes; and the whole site has sunk and
// tilted, so one lean angle is shared by everything that stands above ground. All sizes are multiples of U.
import { rng } from '../core.js';
import { M, surfaceH } from './gen.js';
const X = M.XENO, U = 0.75;
export function genRuin(id, ax, seed) {
  const r = rng(seed), g = surfaceH(ax), st = [], props = [], lean = (r() - 0.5) * 0.24;
  const add = s => st.push({ op: 1, mat: X, ...s }), cut = s => st.push({ op: -1, mat: X, wall: true, ...s });
  const bays = r() < 0.5 ? 3 : 5, bw = U * 5, w = bays * bw, hh = U * 4, B = Math.round((g - 3 - r() * 3.5) / U) * U, x0 = ax - w / 2;
  const side = r() < 0.5 ? -1 : 1, sx = side < 0 ? x0 + 0.4 : x0 + w - 0.4, ex = sx + side * (4 + r() * 4), gy = surfaceH(ex), ah = U * 6;
  const vx = side < 0 ? x0 + w - bw / 2 : x0 + bw / 2, vy = B - U * 6;
  let xa = Math.min(x0 - U * 2, ex - 4), xb = Math.max(x0 + w + U * 2, ex + 4);
  // solids first: field, shell, shaft lining, arch legs, vault shell
  const n = 3 + 3 * Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const mx = ax + (i - (n - 1) / 2) * (U * 6 + r() * 2) + (r() - 0.5) * 2, mg = surfaceH(mx), spire = i % 3 === 1, h = spire ? U * (14 + Math.floor(r() * 8)) : U * (5 + Math.floor(r() * 5)), sunk = 1 + r() * 2.5, hw = U * (0.8 + r() * 0.6);
    if (Math.abs(mx - ex) < 3.2) continue;
    if (spire) { add({ t: 'c', x0: mx, y0: mg - sunk - 2, x1: mx + lean * h, y1: mg + h - sunk, r: 0.62, r1: 0.1 }); for (let k = 1; k <= 3; k++) { const t = k / 4; add({ t: 'e', x: mx + lean * h * t, y: mg + (h - sunk) * t - sunk * (1 - t), rx: 0.95 - t * 0.45, ry: 0.2 }); } }
    else { add({ t: 'c', x0: mx - hw / 2, y0: mg - sunk - 1.5, x1: mx - hw / 4 + lean * h, y1: mg + h - sunk, r: 0.5, r1: 0.26 }); add({ t: 'c', x0: mx + hw / 2, y0: mg - sunk - 1.5, x1: mx + hw / 4 + lean * h, y1: mg + h - sunk, r: 0.5, r1: 0.26 }); }
    props.push({ t: 'glyph', x: mx + lean * h * 0.6, y: mg + (h - sunk) * 0.6, k: i % 5 }); xa = Math.min(xa, mx - 3); xb = Math.max(xb, mx + 3 + Math.abs(lean) * h);
  }
  add({ t: 'b', x0: x0 - U * 2, y0: B - U * 1.5, x1: x0 + w + U * 2, y1: B + hh + U * 3, r: 0.5 });
  add({ t: 'c', x0: sx, y0: B + 1.2, x1: ex, y1: gy + 0.6, r: 2.0 });
  add({ t: 'c', x0: ex - 1.9, y0: gy - 1, x1: ex - 0.3 + lean * ah, y1: gy + ah, r: 0.5, r1: 0.22 }); add({ t: 'c', x0: ex + 1.9, y0: gy - 1, x1: ex + 0.3 + lean * ah, y1: gy + ah, r: 0.5, r1: 0.22 });
  add({ t: 'b', x0: vx - U * 4, y0: vy - U * 1.5, x1: vx + U * 4, y1: B, r: 0.5 });
  // voids: hall with its corbelled ceiling, shaft, lancet under the arch, vault and its drop
  cut({ t: 'b', x0, y0: B, x1: x0 + w, y1: B + hh, r: 0.1 });
  for (let k = 1; k <= 2; k++) cut({ t: 'b', x0: x0 + k * U * 1.4, y0: B + hh - 0.1, x1: x0 + w - k * U * 1.4, y1: B + hh + k * U * 0.7 });
  cut({ t: 'c', x0: sx, y0: B + 1.2, x1: ex + side * 0.8, y1: gy + 1.6, r: 1.15 });
  cut({ t: 'c', x0: ex, y0: gy + 0.2, x1: ex + lean * 2, y1: gy + ah - 1.4, r: 1.0, r1: 0.3, wall: false, mat: 0 });
  cut({ t: 'b', x0: vx - U * 2.5, y0: vy, x1: vx + U * 2.5, y1: vy + U * 3, r: 0.4 });
  cut({ t: 'c', x0: vx - U * 1.6, y0: B + 0.3, x1: vx - U * 1.6, y1: vy + U * 2, r: 0.62 });
  // pillars stand in the finished hall
  for (let i = 1; i < bays; i++) { const px = x0 + i * bw; if (Math.abs(px - (vx - U * 1.6)) < 1) continue; add({ t: 'c', x0: px, y0: B - 0.2, x1: px, y1: B + hh + U, r: 0.34, r1: 0.2 }); props.push({ t: 'glyph', x: px, y: B + hh * 0.55, k: i % 3 }); }
  props.push({ t: 'glyph', x: ex + lean * ah, y: gy + ah - 0.2, k: 3 }, { t: 'cache', x: vx + U * 1.2, y: vy, loot: 'ruin' }, { t: 'xterm', x: vx - U * 0.2, y: vy, n: 0 }, { t: 'xterm', x: x0 + w / 2 + 0.9, y: B, n: 1 }, { t: 'glyph', x: vx, y: vy + U * 2.2, k: 4 });
  return { id, kind: 'ruin', x: ax, x0: xa, x1: xb, y0: vy - 3, y1: g + 26, stamps: st, props, hall: [x0, B, x0 + w, B + hh], mouth: [ex, gy] };
}

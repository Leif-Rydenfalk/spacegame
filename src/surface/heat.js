// heat: a cheap temperature field. Only hot cells exist (a sparse map of 0.25 m cells); each cools toward ambient,
// bleeds a little into its neighbours, and leaves a scorch value that fades over minutes. The terrain shader reads a
// window of it as a texture: glow that lingers in the rock, molten edges, a dark glassy crust afterwards. Plants scorch
// on it, bodies burn on it, loose rock stays hot from it. Not saved: it is gone in a minute anyway.
import { THREE } from '../render.js';
export const HC = 0.25, HW = 352, HH = 208;
const T = new Map(), SC = new Map(), data = new Uint8Array(HW * HH * 4), key = (i, j) => (i + 32768) * 65536 + (j + 32768);
let acc = 0, dirty = true;
export const heat = {
  tex: null, ox: 0, oy: 0, cells: T,
  init() { const t = this.tex = new THREE.DataTexture(data, HW, HH, THREE.RGBAFormat, THREE.UnsignedByteType); t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true; },
  // add v of heat (1 = glowing, 2 = white hot) in a soft disc of radius r metres
  add(x, y, r, v) {
    const i0 = Math.floor((x - r) / HC), i1 = Math.ceil((x + r) / HC), j0 = Math.floor((y - r) / HC), j1 = Math.ceil((y + r) / HC);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const d = Math.hypot((i + 0.5) * HC - x, (j + 0.5) * HC - y) / r; if (d >= 1) continue; const k = key(i, j), t = Math.min(2, (T.get(k) || 0) + v * (1 - d * d)); T.set(k, t); if (t > (SC.get(k) || 0)) SC.set(k, Math.min(1, t)); }
    dirty = true;
  },
  at(x, y) { return T.get(key(Math.floor(x / HC), Math.floor(y / HC))) || 0; },
  total() { let s = 0; for (const v of T.values()) s += v; return s; },
  clear() { T.clear(); SC.clear(); dirty = true; },
  step(dt) {
    acc += dt; if (acc < 1 / 30) return; const h = acc; acc = 0; if (!T.size && !SC.size) return; dirty = true;
    const fast = T.size > 5000 ? 3 : 1, spread = [];
    for (const [k, t] of T) {
      const n = t - h * (0.045 + t * 0.2) * fast;
      if (n <= 0.012) { T.delete(k); continue; }
      if (n > 0.2) { const g = n * Math.min(0.2, h * 0.9); spread.push(k, g * 0.25); T.set(k, n - g); } else T.set(k, n);
    }
    for (let i = 0; i < spread.length; i += 2) for (const d of [1, -1, 65536, -65536]) { const k = spread[i] + d, t = (T.get(k) || 0) + spread[i + 1]; T.set(k, t); if (t > (SC.get(k) || 0)) SC.set(k, Math.min(1, t)); }
    for (const [k, s] of SC) { const n = s - h / 140; if (n <= 0.01) SC.delete(k); else SC.set(k, n); }
  },
  // write the window around the camera into the texture
  upload(cx, cy) {
    const ox = Math.floor(cx / HC) - (HW >> 1), oy = Math.floor(cy / HC) - (HH >> 1); if (ox === this.ox && oy === this.oy && !dirty) return; this.ox = ox; this.oy = oy; dirty = false;
    data.fill(0);
    for (const [k, s] of SC) { const i = Math.floor(k / 65536) - 32768 - ox, j = (k % 65536) - 32768 - oy; if (i < 0 || j < 0 || i >= HW || j >= HH) continue; data[(j * HW + i) * 4 + 1] = s * 255; }
    for (const [k, t] of T) { const i = Math.floor(k / 65536) - 32768 - ox, j = (k % 65536) - 32768 - oy; if (i < 0 || j < 0 || i >= HW || j >= HH) continue; data[(j * HW + i) * 4] = Math.min(255, t * 127.5); }
    this.tex.needsUpdate = true;
  },
};

// navigation for the drones: A* through the air on a 0.25 m grid over the density field, so a drone goes round a hill,
// down a shaft and in under a ledge instead of pressing against the rock between it and where it wants to be. A cell
// is free when its centre is at least `clear` metres from rock. The search is bounded (a box round both ends, a cap
// on the nodes it opens); when there is no way it says so, and the caller gives the job up instead of trying forever.
import { world } from './world.js';
const SQ = Math.SQRT2, TS = 0.25;      // the search grid: fine enough for a cut the laser made (0.9 m wide)
let gS = new Float32Array(0), fS = new Float32Array(0), from = new Int32Array(0), state = new Uint8Array(0);
const freeAt = (gx, gy, clear) => world.dens((gx + 0.5) * TS, (gy + 0.5) * TS) < -clear;
// the free cell nearest to (gx, gy), within a metre and a half; null when there is none
function nearFree(gx, gy, clear) {
  if (freeAt(gx, gy, clear)) return [gx, gy]; let best = null, bd = 1e9;
  for (let j = -6; j <= 8; j++) for (let i = -6; i <= 6; i++) { const d = i * i + j * j - j * 0.5; if (d < bd && freeAt(gx + i, gy + j, clear)) { bd = d; best = [gx + i, gy + j]; } }
  return best;
}
// is the straight line from a to b free of rock, with a little room? (the field is a distance, so the march is short)
export function lineFree(ax, ay, bx, by, room = 0.18) {
  const dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy); if (d < 0.05) return true;
  for (let t = 0; t <= d;) { const v = -world.dens(ax + dx * t / d, ay + dy * t / d); if (v < room) return false; t += Math.max(0.12, v * 0.8); }
  return -world.dens(bx, by) >= room * 0.5;
}
// returns [[x, y], ...] in metres from the first step to the goal, or null when no way was found
export function findPath(ax, ay, bx, by, clear = 0.17, maxNodes = 26000) {
  const s = nearFree(Math.floor(ax / TS), Math.floor(ay / TS), 0.05), e = nearFree(Math.floor(bx / TS), Math.floor(by / TS), clear * 0.6); if (!s || !e) return null;
  const M = 40, x0 = Math.min(s[0], e[0]) - M, y0 = Math.min(s[1], e[1]) - M, W = Math.abs(s[0] - e[0]) + 2 * M + 1, H = Math.abs(s[1] - e[1]) + 2 * M + 1, n = W * H;
  if (n > gS.length) { gS = new Float32Array(n); fS = new Float32Array(n); from = new Int32Array(n); state = new Uint8Array(n); }
  state.fill(0, 0, n);          // 0 unseen, 1 open, 2 closed, 3 rock, 4 free (known)
  const si = (s[1] - y0) * W + (s[0] - x0), ei = (e[1] - y0) * W + (e[0] - x0), ex = e[0] - x0, ey = e[1] - y0, heap = [si];
  const hh = i => { const dx = Math.abs(i % W - ex), dy = Math.abs(Math.floor(i / W) - ey); return Math.max(dx, dy) + (SQ - 1) * Math.min(dx, dy); };
  const free = i => { const st = state[i]; if (st === 3) return false; if (st) return true; const ok = i === ei || freeAt(x0 + i % W, y0 + Math.floor(i / W), clear); state[i] = ok ? 4 : 3; return ok; };
  gS[si] = 0; fS[si] = hh(si); from[si] = -1; state[si] = 1; let opened = 0;
  const push = i => { heap.push(i); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (fS[heap[p]] <= fS[heap[c]]) break; const t = heap[p]; heap[p] = heap[c]; heap[c] = t; c = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let p = 0; for (;;) { let c = p * 2 + 1; if (c >= heap.length) break; if (c + 1 < heap.length && fS[heap[c + 1]] < fS[heap[c]]) c++; if (fS[heap[p]] <= fS[heap[c]]) break; const t = heap[p]; heap[p] = heap[c]; heap[c] = t; p = c; } } return top; };
  while (heap.length && opened++ < maxNodes) {
    const c = pop(); if (state[c] === 2) continue; state[c] = 2;
    if (c === ei) { const out = []; for (let i = c; i !== si && i >= 0; i = from[i]) out.push([(x0 + i % W + 0.5) * TS, (y0 + Math.floor(i / W) + 0.5) * TS]); out.reverse(); if (out.length) out[out.length - 1] = [bx, by]; else out.push([bx, by]); return out; }
    const cx = c % W, cy = Math.floor(c / W);
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      if (!i && !j) continue; const nx = cx + i, ny = cy + j; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const q = ny * W + nx; if (state[q] === 2 || !free(q)) continue;
      if (i && j && (!free(cy * W + nx) || !free(ny * W + cx))) continue;       // no cutting a corner of rock
      const g = gS[c] + (i && j ? SQ : 1); if (state[q] === 1 && g >= gS[q]) continue; gS[q] = g; fS[q] = g + hh(q) * 1.001; from[q] = c; state[q] = 1; push(q);
    }
  }
  return null;
}

// hud helpers: 1 px lines, small quiet monospace caps, numbers with units. Nothing rounded, nothing bouncing.
import { G, events } from './core.js';
import { STORY } from './story.js';
export const INK = '159,179,191', AMBER = '255,179,71', RED = '255,45,45';
export function txt(c, s, x, y, o = {}) { c.font = `${o.size || 10}px ui-monospace,Menlo,Consolas,monospace`; c.textAlign = o.align || 'left'; c.fillStyle = `rgba(${o.col || INK},${o.a === undefined ? 0.6 : o.a})`; try { c.letterSpacing = '1px'; } catch (e) { /* older engines */ } c.fillText(String(s).toUpperCase(), Math.round(x), Math.round(y)); }
export function line(c, x1, y1, x2, y2, a = 0.35, col = INK) { c.strokeStyle = `rgba(${col},${a})`; c.lineWidth = 1; c.beginPath(); c.moveTo(Math.round(x1) + 0.5, Math.round(y1) + 0.5); c.lineTo(Math.round(x2) + 0.5, Math.round(y2) + 0.5); c.stroke(); }
export function bar(c, x, y, w, v, label, col = INK) { txt(c, label, x, y - 5); c.strokeStyle = `rgba(${INK},0.3)`; c.lineWidth = 1; c.strokeRect(x + 0.5, y + 0.5, w, 4); c.fillStyle = `rgba(${col},0.7)`; c.fillRect(x + 2, y + 2, Math.max(0, (w - 3) * Math.min(1, v)), 1.5); }
export function bracket(c, x, y, r, col = INK, a = 0.7) { const s = Math.max(4, r * 0.4); c.strokeStyle = `rgba(${col},${a})`; c.lineWidth = 1; c.beginPath(); for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const px = Math.round(x + sx * r) + 0.5, py = Math.round(y + sy * r) + 0.5; c.moveTo(px - sx * s, py); c.lineTo(px, py); c.lineTo(px, py - sy * s); } c.stroke(); }
export const fmt = {
  m(v) { const a = Math.abs(v); return a >= 1.496e10 ? (v / 1.496e11).toFixed(3) + ' AU' : a >= 1e7 ? (v / 1e6).toFixed(1) + ' Mm' : a >= 1e4 ? (v / 1e3).toFixed(1) + ' km' : v.toFixed(0) + ' m'; },
  v(v) { return Math.abs(v) >= 1e4 ? (v / 1e3).toFixed(2) + ' km/s' : v.toFixed(1) + ' m/s'; },
  t(s) { s = Math.max(0, s); const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), ss = Math.floor(s % 60); return (d ? d + 'd ' : '') + String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(ss).padStart(2, '0'); },
};
// story beats: one quiet line at the bottom for 6 s, kept in a log (L)
const seen = new Set(); export const beats = { cur: null, t: 0, log: [] };
events.on('*', n => { for (const b of STORY.beats) if (b.trigger === n && !(b.once && seen.has(b.id))) { seen.add(b.id); beats.cur = b; beats.t = 6; beats.log.push(b.text); } });
export function drawBeats(c, dt, showLog) {
  if (beats.cur && beats.t > 0) { beats.t -= dt; txt(c, beats.cur.text, G.w / 2, G.h - 54, { align: 'center', size: 11, a: 0.75 * Math.min(1, beats.t, 6 - beats.t + 0.2) }); }
  if (showLog) beats.log.slice(-12).forEach((l, i) => txt(c, l, G.w / 2, 120 + i * 18, { align: 'center', a: 0.7 }));
}

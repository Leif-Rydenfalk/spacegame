// the networks you can see (round 6 L): power is wire, signal is link, and every range can be shown.
//   power    the base grid is cable: from the wreck's bus and the reactor to every node in reach, and from node to
//            node (auto.js plans it; this draws it and counts it). Each cable is sized by the AI for the current it
//            carries (4 A a square millimetre), loses I2R over its length (physics.js wireLoss), hangs in a sag, and
//            shows the current as marks that run along it. A cable that carries more than its source can give glows.
//   signal   every device that takes orders hangs on an antenna by a radio link: a thin line with packets on it while
//            it is in use, and its bandwidth falls with distance. A machine or robot with no link shows that.
//   ranges   hold Alt (or plan with Tab): the reach of every antenna, turret, camera, radar, power node and the
//            scanner in your hand is drawn as a ring, and the safe span of every watched opening (mine.js).
import { G } from '../core.js';
import { TS } from './world.js';
import { S, C, mul } from './state.js';
import { F } from './factory.js';
import { K, SHIP, reactorPos } from './kit.js';
import { AUTO, GRID_R } from './auto.js';
import { robots } from './robots.js';
import { wireLoss, linkMbit } from './physics.js';
import { TURRET_RANGE } from './power.js';
import { SENSE } from './fog.js';
import { BOOT } from './suit.js';

export const NET = { links: [], lossW: 0, signals: 0 };
// pure: the cable for a load: cross-section for 4 A/mm2 at 800 V in steps of 16 mm2, its loss, the share lost
export function cableFor(W, metres) { const I = W / 800, mm2 = Math.max(16, Math.ceil(I / 4 / 16) * 16), loss = wireLoss(W, metres, mm2); return { mm2, loss, frac: W > 0 ? loss / W : 0, amps: I }; }
const sag = (b, ax, ay, bx, by, t, col, a, time, flow, hot) => {
  const n = Math.max(3, Math.min(14, Math.round(Math.hypot(bx - ax, by - ay) / 1.2))), dip = Math.min(1.1, Math.hypot(bx - ax, by - ay) * 0.07); let px = ax, py = ay;
  for (let i = 1; i <= n; i++) { const u = i / n, x = ax + (bx - ax) * u, y = ay + (by - ay) * u - dip * 4 * u * (1 - u); b.seg(px, py, x, y, t, col, a, 0, 1); if (hot) b.seg(px, py, x, y, t * 2.4, [1.4, 0.3, 0.04], 0.45, 0, 2); px = x; py = y; }
  if (flow > 0) for (let i = 0; i < Math.min(6, n); i++) { const u = ((time * (0.25 + flow * 0.5) + i / Math.min(6, n)) % 1), x = ax + (bx - ax) * u, y = ay + (by - ay) * u - dip * 4 * u * (1 - u); b.add(x, y, 0.07, 0.07, 0, mul(C.amber, 1.6), 0.25 + 0.45 * flow, 1, 2); }
};
export function drawNet(b, time) {
  const cam = S.cam, show = Math.abs(cam.x) < 4000; NET.links = AUTO.links || []; NET.lossW = 0;
  for (const l of NET.links) { NET.lossW += l.loss || 0; if (Math.abs((l.ax + l.bx) / 2 - cam.x) > 40) continue; sag(b, l.ax, l.ay, l.bx, l.by, 0.02 + Math.min(0.05, (l.mm2 || 16) * 0.0004), [0.016, 0.018, 0.021], 1, time, Math.min(1, (l.w || 0) / 60000), l.hot); }
  // signal: robots at work and the turret, each to the antenna that carries its orders
  NET.signals = 0;
  const link = (x, y, on) => { const a = K.net.antennas.find(q => q.range && Math.hypot(q.x - x, q.y - y) <= q.range); if (!a) return null; NET.signals++; if (Math.abs(x - cam.x) > 34 || (!S.alt && S.mode !== 'blueprint' && !on)) return a; const d = Math.hypot(a.x - x, a.y - y), n = Math.min(26, Math.max(4, Math.round(d / 1.4))), mb = linkMbit(d, a.range); for (let i = 0; i <= n; i++) { const u = i / n, px = x + (a.x - x) * u, py = y + (a.y - y) * u + Math.sin(u * Math.PI) * Math.min(3, d * 0.12); if (Math.abs(px - cam.x) > 34) continue; b.add(px, py, 0.035, 0.035, 0, mul(C.cyan, 1.1), 0.16 + (mb > 50 ? 0.1 : 0), 1, 2); } if (on) { const u = (time * 1.3 + x * 0.37) % 1; b.add(x + (a.x - x) * u, y + (a.y - y) * u + Math.sin(u * Math.PI) * Math.min(3, d * 0.12), 0.09, 0.09, 0, mul(C.cyan, 2.2), 0.8, 1, 2); } return a; };
  for (const r of robots) { const a = link(r.x, r.y, !!r.job); r.nolink = !a; if (!a && Math.abs(r.x - cam.x) < 30) b.add(r.x, r.y + 0.3, 0.07, 0.07, 0, mul(C.red, 2.5), 0.5 + 0.5 * Math.sin(time * 8), 1, 2); }
  if (K.laser.state === 'turret') link(K.laser.x, K.laser.y + 1.3, !!K.laser.target);
  if (!(S.alt || S.mode === 'blueprint')) return;
  // ranges: rings, only the part of each that is on the screen
  const ring = (x, y, r, col, a = 0.5) => { const span = 32 * Math.min(S.zo, 3); if (Math.abs(x - cam.x) - r > span) return; const n = Math.min(160, Math.max(24, Math.round(r * 2.2))); for (let i = 0; i < n; i++) { const an = i / n * 6.2832 + time * 0.02, px = x + Math.cos(an) * r, py = y + Math.sin(an) * r; if (Math.abs(px - cam.x) > span || Math.abs(py - cam.y) > span * 0.6) continue; b.add(px, py, Math.min(0.5, r * 0.02 + 0.08), 0.025, an + 1.57, col, a, 0, 2); } };
  for (const a of K.net.antennas) if (a.range) ring(a.x, a.y, Math.min(a.range, 400), mul(C.cyan, 1.2), a.range > 400 ? 0.2 : 0.5);
  for (const m of F.machines) { const x = (m.x + m.w / 2) * TS, y = (m.y + m.h / 2) * TS; if (m.kind === 'camera') ring(x, y + 0.4, SENSE.cam, [1.2, 0.5, 0.5]); else if (m.kind === 'radar') ring(x, y, SENSE.radar, [1.0, 0.8, 0.2], 0.4); else if (m.kind === 'power pole' || m.kind === 'hub' || m.kind === 'furnace' || m.kind === 'assembler') ring(x, y, GRID_R, mul(C.amber, 0.9), 0.22); if (m.kind === 'hub') ring(x, y, 45, mul(C.acid, 0.8), 0.3); }
  if (K.laser.state === 'turret') ring(K.laser.x, K.laser.y + 0.95, TURRET_RANGE, mul(C.red, 1.4));
  if (S.crash) { ring(SHIP.x, SHIP.y + 1, GRID_R, mul(C.amber, 0.9), 0.22); if (BOOT.done) ring(SHIP.x, SHIP.y + 2.6, SENSE.hull, [1.2, 0.5, 0.5], 0.35); }
  const P = S.P; if (P.st && P.st.scanR) ring(S.mouse.x, S.mouse.y, P.st.scanR, mul(C.cyan, 1.6), 0.6);
}

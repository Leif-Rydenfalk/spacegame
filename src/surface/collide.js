// bodies against loose rock, and loose rock against decks (round 6: what round 5 left open).
// Loose rock is real for everything that moves. A light piece is kicked aside by whatever walks into it; a heavy one
// stops you, and you can stand on it. A rock that comes down on you hurts by its mass and its speed (that is how a
// roof kills), and a pile on top of you holds you. Animals and robots are pushed out of rock the same way. And a rock
// that falls on a deck stays on the deck.
import { G, events, clamp } from '../core.js';
import { S } from './state.js';
import { matter } from './matter.js';
import { creatures, KIND } from './creatures.js';
import { robots } from './robots.js';
import { deckUnder } from './layers.js';
import { EXO } from './suit.js';

export const HIT = { last: 0, buried: 0 };
// pure: what a rock of this mass at this closing speed does to a body: joules, and the damage they are
export function impact(kg, v) { const E = 0.5 * kg * v * v; return { E, dmg: v < 2.5 ? 0 : E / 4.5 }; }
export function stepCollide(dt) {
  const P = S.P, L = matter.list; let over = 0;
  // rock on decks: a body that crosses a deck on its way down comes to rest on it
  for (const c of L) { const bot = c.y - c.r * 0.8; if (!c.asleep && c.vy <= 0 && c.pb !== undefined) { const dk = deckUnder(c.x, c.pb + 0.02, bot, c.r * 0.6); if (dk !== null) { c.y = dk + c.r * 0.8; if (c.vy < -1.5 && S.thud) S.thud(c, -c.vy); c.vy = 0; c.vx *= 0.6; c.av *= 0.5; c.onDeck = true; c.rest = (c.rest || 0) + dt; if (c.rest > 0.4 && Math.abs(c.vx) < 0.15) { c.asleep = true; c.vx = 0; c.av = 0; } } else c.onDeck = false; } c.pb = c.y - c.r * 0.8; }
  if (!P.dead) for (const c of L) {
    const dx = c.x - P.x; if (Math.abs(dx) > 1.6 || c.y < P.y - 1.2 || c.y > P.y + 3.2) continue;
    // the body is a capsule 0.6 wide: the nearest point of its axis to the rock's centre
    const ay = clamp(c.y, P.y + 0.3, P.y + 1.5), dy = c.y - ay, d = Math.hypot(dx, dy), R = c.r * 0.85 + 0.3; if (d >= R) continue;
    const nx = d > 1e-4 ? dx / d : 0, ny = d > 1e-4 ? dy / d : 1, pen = R - d, rvx = c.vx - P.vx, rvy = c.vy - P.vy, vn = -(rvx * nx + rvy * ny);       // closing speed
    if (!c.asleep && vn > 2.5 && c.kg > 1.5) { const h = impact(c.kg, vn); if (G.time - (c.hitP || -9) > 0.4) { c.hitP = G.time; S.hurt(h.dmg, nx * -1.5, 0); HIT.last = h.dmg; events.emit('rockHit', { kg: c.kg, v: vn, dmg: h.dmg }); } }
    const body = EXO.on ? 110 : 80, light = c.kg < body * 0.22;
    if (ny > 0.35 && dy > 0.6) over++;       // it lies on you
    if (Math.abs(P.vx) + Math.abs(P.vy) < 0.4 && Math.abs(c.vx) + Math.abs(c.vy) < 0.4) continue;       /* both at rest: it lies against you, and is left to sleep */
    if (light || !c.asleep && c.kg < body) { c.x += nx * pen; c.y += ny * pen * 0.5; c.vx += nx * Math.max(0.5, Math.abs(P.vx)) * 0.6; c.asleep = false; c.rest = 0; if (ny < -0.5) { /* under the feet: it is pushed down and out */ } }
    else if (ny < -0.45) { P.y += pen * -ny; if (P.vy < 0) P.vy = 0; P.onRock = 0.15; }       // standing on a big one
    else { P.x -= nx * pen; const v = P.vx * nx; if (v > 0) P.vx -= nx * v; }
  }
  HIT.buried = over >= 2 ? HIT.buried + dt : 0; if (HIT.buried > 1 && !P.buriedSaid) { P.buriedSaid = true; S.say('buried: rock lies on you. the robots dig you out; your own hands can too (v)', 6); events.emit('buried'); } if (!over) P.buriedSaid = false;
  for (const q of creatures) { if (q.hp <= 0 || KIND[q.type].fly) continue; const k = KIND[q.type], r0 = k.thick * 0.5 + 0.1; for (const c of L) { const dx = c.x - q.x, dy = c.y - q.y; if (Math.abs(dx) > 1.5 || Math.abs(dy) > 1.5) continue; const d = Math.hypot(dx, dy), R = c.r * 0.8 + r0; if (d >= R || d < 1e-4) continue; const nx = dx / d, ny = dy / d, pen = R - d; if (c.kg < (k.kg || 5) * 0.5) { c.x += nx * pen; c.vx += nx * 1.2; c.asleep = false; c.rest = 0; } else { q.x -= nx * pen * 0.7; if (q.nodes[0]) q.nodes[0].x = q.x; if (!c.asleep && c.vy < -3 && c.kg > 2) { q.hp -= impact(c.kg, -c.vy).dmg * (k.hp / (20 * (k.kg || 5))); q.hurtT = 3; } } } }
  for (const r of robots) { if (r.lifted || r.kind === 'crawler') continue; /* the hauler's legs step over loose rock */ for (const c of L) { const dx = c.x - r.x, dy = c.y - r.y; if (Math.abs(dx) > 1.2 || Math.abs(dy) > 1.2 || c.claim === r) continue; const d = Math.hypot(dx, dy), R = c.r * 0.8 + (r.kind === 'crawler' ? 0.3 : 0.2); if (d >= R || d < 1e-4) continue; const nx = dx / d, ny = dy / d, pen = R - d; if (c.kg < 6) { c.x += nx * pen; c.vx += nx; c.asleep = false; c.rest = 0; } else { r.x -= nx * pen; r.y -= ny * pen; if (r.kind !== 'crawler') { const v = r.vx * nx + r.vy * ny; if (v > 0) { r.vx -= nx * v; r.vy -= ny * v; } } } } }
}

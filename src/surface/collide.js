// bodies against loose rock, and loose rock against decks.
// Round 7 (Leif walked into a couple of rocks and died): loose rock is solid, and it does not hurt you to touch it.
//   solid    a rock is felt as the box it fills. Small ones (under a fifth of your weight, and not at rest under
//            you) are kicked aside. Anything else you stand on, step up onto when its top is within a step of your
//            feet (0.55 m), or climb when you push into it (hands and knees: up to 1.15 m, slower), so a pile is a
//            thing you walk over. What is higher than that is a wall, and walls do not hurt either.
//   hurt     only an impact does: a rock that is itself moving (over 3 m/s) and closes on you at more than 6 m/s. The
//            damage is its energy at that closing speed (impact, pure). Resting rock, rolling rock, rock you run into
//            or kick: nothing, at any speed you can walk or sprint. That is still how a roof kills.
//   layers   what lies in a stockpile is on the back layer: you, the animals and the robots pass in front of it.
// Animals and robots are pushed out of rock the same way; a rock that falls on a deck stays on the deck.
import { G, events, clamp } from '../core.js';
import { S } from './state.js';
import { matter } from './matter.js';
import { world } from './world.js';
import { creatures, KIND } from './creatures.js';
import { robots } from './robots.js';
import { deckUnder } from './layers.js';
import { EXO } from './suit.js';
import { bodyDepth } from './player.js';

export const HIT = { last: 0, buried: 0, hits: 0, climbs: 0, touch: 0 };
export const STEP = { up: 0.55, climb: 1.15, hurtV: 6, rockV: 3, climbV: 1.6 };
// pure: what a rock of this mass at this closing speed does to a body: joules, and the damage they are. Under 6 m/s
// of closing speed nothing: that is a bump, a shove, a stubbed toe.
export function impact(kg, v) { const E = 0.5 * kg * v * v; return { E, dmg: v < STEP.hurtV ? 0 : E / 6 }; }
// the box a body fills: half extents of its rotated shape
const ext = c => { const cs = Math.abs(Math.cos(c.rot)), sn = Math.abs(Math.sin(c.rot)); return [c.hw * cs + c.hh * sn, c.hw * sn + c.hh * cs]; };
export function stepCollide(dt) {
  const P = S.P, L = matter.list; let over = 0;
  // rock on decks: a body that crosses a deck on its way down comes to rest on it
  for (const c of L) { const bot = c.y - c.r * 0.8; if (!c.asleep && c.vy <= 0 && c.pb !== undefined) { const dk = deckUnder(c.x, c.pb + 0.02, bot, c.r * 0.6); if (dk !== null) { c.y = dk + c.r * 0.8; if (c.vy < -1.5 && S.thud) S.thud(c, -c.vy); c.vy = 0; c.vx *= 0.6; c.av *= 0.5; c.onDeck = true; c.rest = (c.rest || 0) + dt; if (c.rest > 0.4 && Math.abs(c.vx) < 0.15) { c.asleep = true; c.vx = 0; c.av = 0; } } else c.onDeck = false; } c.pb = c.y - c.r * 0.8; }
  if (P.onRock > 0) P.onRock -= dt;
  if (!P.dead) {
    const body = EXO.on ? 110 : 80, walk = P.walkX || 0; let lift = 0, wallL = false, wallR = false;
    for (const c of L) {
      if (c.back || c.gone) continue; const dx = c.x - P.x; if (Math.abs(dx) > 2 || c.y < P.y - 1.6 || c.y > P.y + 3.6) continue;
      const [ex, ey] = ext(c), ox = 0.3 + ex - Math.abs(dx), top = c.y + ey, bot = c.y - ey; if (ox <= 0 || top <= P.y - 0.02 || bot >= P.y + 1.8) continue;
      // an impact: the rock is moving, and it meets the body fast
      const d = Math.hypot(dx, c.y - (P.y + 0.9)) || 1, nx = dx / d, ny = (c.y - (P.y + 0.9)) / d, vn = -((c.vx - P.vx) * nx + (c.vy - P.vy) * ny), own = Math.hypot(c.vx, c.vy);
      if (!c.asleep && own > STEP.rockV && vn > STEP.hurtV && c.kg > 1.5 && G.time - (c.hitP || -9) > 0.4) { const h = impact(c.kg, vn); c.hitP = G.time; S.hurt(h.dmg, nx * -1.5, 0); HIT.last = h.dmg; HIT.hits++; events.emit('rockHit', { kg: c.kg, v: vn, dmg: h.dmg }); c.vx *= 0.4; c.vy *= 0.4; }
      HIT.touch++; const overHead = bot > P.y + 1.2;
      if (overHead) { if (top - bot > 0.2) over++; if (!c.asleep) { c.y += Math.max(0, P.y + 1.8 - bot) * 0.5; if (c.vy < 0) c.vy *= 0.5; } continue; }       // it lies on you: it is held up, and counted
      const rise = top - P.y, light = c.kg < body * 0.07 && rise > 0.1 && !(c.asleep && Math.abs(dx) < ex);
      if (light) {       // kicked aside: it goes where the foot pushes it, and it never hurts. A body that stands still kicks nothing
        if (!(walk && Math.sign(dx) === walk) && P.vx * dx <= 0.1) continue; const s = dx >= 0 ? 1 : -1; c.x += s * Math.min(ox, 0.06); c.vx += s * Math.max(0.4, Math.abs(P.vx) * 0.5) * 0.5; if (Math.abs(c.vx) > 2.5) c.vx = 2.5 * Math.sign(c.vx); c.asleep = false; c.rest = 0; continue; }
      // it carries you: under the feet, or a step up when you are over it or walking into it
      const into = walk && Math.sign(dx) === walk, onTop = Math.abs(dx) < ex + 0.12;
      if (rise <= 0.06 || (rise <= STEP.up && (onTop || into)) || (rise <= STEP.climb && into)) { if (rise > lift) lift = rise; continue; }
      if (dx > 0) wallR = true; else wallL = true;
      P.x -= Math.sign(dx) * Math.min(ox, 0.08); if (P.vx * Math.sign(dx) > 0) P.vx = 0;
    }
    if (lift > 0) {
      // up onto it: at once for a hand's height, at climbing speed for more (and the way on is slower while you climb)
      const up = lift <= 0.1 ? lift : Math.min(lift, (lift <= STEP.up ? 4 : STEP.climbV) * dt + 0.004);
      if (bodyDepth(P.x, P.y + up) < 0.06) { P.y += up; if (P.vy < 0) { if (P.vy < -3 && !(P.onRock > 0)) P.rockImp = -P.vy; P.vy = 0; } P.onRock = 0.2; if (lift > 0.1) { P.vx *= 1 - Math.min(1, dt * (lift > STEP.up ? 9 : 3)); P.climbT = 0.2; if (lift > STEP.up) HIT.climbs += dt; } }
    }
    if (P.climbT > 0) P.climbT -= dt;
  }
  HIT.buried = over >= 2 ? HIT.buried + dt : 0; if (HIT.buried > 1 && !P.buriedSaid) { P.buriedSaid = true; S.say('buried: rock lies on you. the robots dig you out; your own hands can too (v)', 6); events.emit('buried'); } if (!over) P.buriedSaid = false;
  for (const q of creatures) { if (q.hp <= 0 || KIND[q.type].fly) continue; const k = KIND[q.type], r0 = k.thick * 0.5 + 0.1; for (const c of L) { if (c.back) continue; const dx = c.x - q.x, dy = c.y - q.y; if (Math.abs(dx) > 1.5 || Math.abs(dy) > 1.5) continue; const d = Math.hypot(dx, dy), R = c.r * 0.8 + r0; if (d >= R || d < 1e-4) continue; const nx = dx / d, ny = dy / d, pen = R - d; if (c.kg < (k.kg || 5) * 0.5) { c.x += nx * pen; c.vx += nx * 1.2; c.asleep = false; c.rest = 0; } else { q.x -= nx * pen * 0.7; if (q.nodes[0]) q.nodes[0].x = q.x; if (!c.asleep && c.vy < -STEP.hurtV && c.kg > 2) { q.hp -= impact(c.kg, -c.vy).dmg * (k.hp / (20 * (k.kg || 5))); q.hurtT = 3; } } } }
  for (const r of robots) { if (r.lifted || r.kind === 'crawler') continue; /* the hauler's legs step over loose rock */ for (const c of L) { if (c.back) continue; const dx = c.x - r.x, dy = c.y - r.y; if (Math.abs(dx) > 1.2 || Math.abs(dy) > 1.2 || c.claim === r) continue; const d = Math.hypot(dx, dy), R = c.r * 0.8 + 0.2; if (d >= R || d < 1e-4) continue; const nx = dx / d, ny = dy / d, pen = R - d; if (c.kg < 6) { c.x += nx * pen; c.vx += nx; c.asleep = false; c.rest = 0; } else { r.x -= nx * pen; r.y -= ny * pen; const v = r.vx * nx + r.vy * ny; if (v > 0) { r.vx -= nx * v; r.vy -= ny * v; } } } }
}

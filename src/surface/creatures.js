// creatures: stalker (six legs, hunts by your light), grazer (four legs, armoured), spore jelly (floats).
// Bodies are follow-the-leader chains that flow over terrain; legs are two-segment analytic IK with stepping feet.
import { events, rand, clamp, hash } from '../core.js';
import { audio } from '../audio.js';
import { world, TS, GRAV } from './world.js';
import { light } from './light.js';
import { S, C, mul } from './state.js';

export const creatures = [];
export function ik2(ax, ay, bx, by, l1, l2, s) {
  let dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy); const m = l1 + l2 - 1e-3;
  if (d > m) { dx *= m / d; dy *= m / d; d = m; } if (d < 1e-4) { d = 1e-4; dx = d; }
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  return [ax + dx / d * a - dy / d * h * s, ay + dy / d * a + dx / d * h * s];
}
const KIND = {
  stalker: { nodes: 7, gap: 0.36, legs: [1, 2, 3], l1: 0.6, l2: 0.72, clear: 0.5, thick: 0.34, speed: 2.0, run: 7.8, hp: 60, stride: 0.75, glow: C.cyan, stepT: 0.1 },
  grazer: { nodes: 5, gap: 0.5, legs: [1, 3], l1: 0.5, l2: 0.55, clear: 0.62, thick: 0.8, speed: 0.9, run: 2.6, hp: 160, stride: 0.5, glow: C.acid, stepT: 0.28 },
};
// top of the ground under x (metres), searching from y+up down; null when there is none or a wall is in the way
function groundY(x, y, up = 1.6, down = 16) { const tx = Math.floor(x / TS), ty = Math.floor((y + up) / TS); if (world.solid(tx, ty)) return null; const g = world.groundBelow(tx, ty, down); return g === null ? null : (g + 1) * TS; }
export function spawnCreature(type, x, y) {
  const c = { type, x, y, vx: 0, vy: 0, dir: Math.random() < 0.5 ? -1 : 1, hp: type === 'jelly' ? 22 : KIND[type].hp, state: 'wander', t: rand(1, 4), seed: Math.random() * 100, flash: 0, bite: 0, lit: 0, nodes: [], legs: [], seen: false };
  if (type === 'jelly') { c.tent = []; for (let i = 0; i < 5; i++) { const s = []; for (let j = 0; j < 6; j++) s.push({ x, y: y - j * 0.16, px: x, py: y - j * 0.16 }); c.tent.push(s); } }
  else {
    const k = KIND[type]; for (let i = 0; i < k.nodes; i++) c.nodes.push({ x: x - c.dir * i * k.gap, y });
    for (const n of k.legs) for (let s = 0; s < 2; s++) c.legs.push({ n, s, fx: x - c.dir * n * k.gap, fy: y - k.clear, t: -1, sx: 0, sy: 0, tx: 0, ty: 0 });
  }
  creatures.push(c); return c;
}
export function hurtCreature(c, x, y, dmg, vx, vy) {
  let hit = false;
  if (c.type === 'jelly') hit = Math.hypot(x - c.x, y - c.y) < 0.4;
  else { const k = KIND[c.type]; for (const n of c.nodes) if (Math.hypot(x - n.x, y - n.y) < k.thick * 0.6) { hit = true; break; } }
  if (!hit) return false;
  c.hp -= dmg; c.flash = 0.12; c.vx += vx * 0.002; if (c.state !== 'flee') c.state = c.type === 'stalker' ? 'charge' : 'flee'; c.t = 5;
  const g = c.type === 'jelly' ? C.violet : c.type === 'grazer' ? C.acid : C.cyan;
  for (let i = 0; i < 10; i++) S.parts.spawn({ x, y, vx: vx * rand(0.003, 0.012) + rand(-3, 3), vy: vy * rand(0.003, 0.012) + rand(-1, 5), life: rand(0.5, 2.2), size: rand(0.04, 0.09), c: mul(g, 2.5), c2: mul(g, 0.5), col: 1, bounce: 0.15 });
  audio.play('hit');
  if (c.hp <= 0) { events.emit('firstKill'); S.add(c.type === 'grazer' ? 'chitin' : 'ichor', c.type === 'grazer' ? 3 : 1); audio.play('call');
    const pts = c.type === 'jelly' ? [c] : c.nodes; for (const n of pts) for (let i = 0; i < 6; i++) S.parts.spawn({ x: n.x, y: n.y, vx: rand(-4, 4), vy: rand(0, 6), life: rand(1, 3), size: rand(0.05, 0.12), c: mul(g, 2.2), c2: mul(g, 0.3), col: 1, bounce: 0.1 }); }
  return true;
}
let spawnT = 2;
export function stepCreatures(dt) {
  const P = S.P;
  spawnT -= dt; S.calm -= dt;
  if (spawnT <= 0) {
    spawnT = 3.5;
    if (creatures.length < 5) {
      const x = P.x + (Math.random() < 0.5 ? -1 : 1) * rand(20, 32), r = Math.random();
      for (let j = 10; j > -20; j--) { const tx = Math.floor(x / TS), ty = Math.floor(P.y / TS) + j; if (!world.solid(tx, ty) && !world.solid(tx, ty + 1) && !world.solid(tx, ty + 2) && world.solid(tx, ty - 1)) { spawnCreature(S.calm > 0 ? 'grazer' : r < 0.45 ? 'stalker' : r < 0.75 ? 'grazer' : 'jelly', x, ty * TS + (r >= 0.75 ? 2.5 : 0.6)); break; } }
    }
  }
  for (let i = creatures.length - 1; i >= 0; i--) {
    const c = creatures[i], dx = P.x - c.x, dy = P.y + 0.9 - c.y, dist = Math.hypot(dx, dy);
    if (c.hp <= 0 || dist > 75) { creatures.splice(i, 1); continue; }
    c.flash -= dt; c.bite -= dt; c.t -= dt;
    if (!c.seen && dist < 16) { c.seen = true; events.emit('firstCreature'); if (c.type === 'stalker') audio.play('call'); }
    const lum = light.at(c.x / TS, c.y / TS); c.lit += ((lum > 0.6 ? 1 : 0) - c.lit) * Math.min(1, dt * 6);
    if (c.type === 'jelly') {
      const w = P.dead ? 0 : 0.5; c.vx += (dx / (dist + 1) * w + Math.sin(c.seed + c.t * 0.7) * 0.3 - c.vx * 0.8) * dt; c.vy += (dy / (dist + 1) * w + Math.sin(c.seed * 3 + c.t * 1.9) * 0.6 - c.vy * 0.8) * dt;
      if (world.solidAt(c.x + c.vx * 0.5, c.y)) c.vx = -c.vx; if (world.solidAt(c.x, c.y + c.vy * 0.5 - 0.8)) c.vy = Math.abs(c.vy) + 0.2; if (world.solidAt(c.x, c.y + 0.6)) c.vy = -Math.abs(c.vy);
      c.x += c.vx * dt; c.y += c.vy * dt;
      if (dist < 0.7 && c.bite <= 0 && !P.dead) { c.bite = 1.5; S.hurt(6, dx * 2, 1); }
      c.tent.forEach((s, ti) => { s[0].x = c.x + (ti - 2) * 0.11; s[0].y = c.y - 0.12; for (let j = 1; j < s.length; j++) { const p = s[j], vx = (p.x - p.px) * 0.96, vy = (p.y - p.py) * 0.96; p.px = p.x; p.py = p.y; p.x += vx + Math.sin(c.t * 2 + ti + j) * 0.0006; p.y += vy - 1.2 * dt * dt; const q = s[j - 1], ex = p.x - q.x, ey = p.y - q.y, l = Math.hypot(ex, ey) || 1; p.x = q.x + ex / l * 0.16; p.y = q.y + ey / l * 0.16; } });
      continue;
    }
    const k = KIND[c.type]; let want = 0;
    // behaviour
    if (c.type === 'stalker' && !P.dead) {
      const range = light.lamp.on ? 30 : 13, facing = Math.sign(dx) !== S.P.face;      // the player looks toward it
      if (c.hp < k.hp * 0.2) c.state = 'flee';
      else if (c.state === 'wander' && dist < range) { c.state = 'stalk'; }
      else if (c.state === 'stalk') { if (dist < 6.5 || (c.lit > 0.8 && c.t < -1.2)) { c.state = 'charge'; c.t = 4; audio.play('call'); } if (c.lit < 0.5) c.t = 0; if (dist > range + 8) c.state = 'wander'; }
      else if (c.state === 'charge' && c.t < 0 && dist > 12) c.state = 'stalk';
      if (c.state === 'stalk') { c.dir = Math.sign(dx) || 1; want = (facing && c.lit > 0.5) ? 0 : k.speed * 1.4; }
      if (c.state === 'charge') { c.dir = Math.sign(dx) || 1; want = k.run; }
      if (c.state === 'flee') { c.dir = -Math.sign(dx) || 1; want = k.run * 0.8; }
      if (dist < 1.2 && c.bite <= 0 && c.state === 'charge') { c.bite = 0.9; S.hurt(18, c.dir * 7 + c.vx * 0.3, 3.5); audio.play('bite'); c.vx *= -0.4; }
    } else if (c.state === 'flee') { c.dir = -Math.sign(dx) || 1; want = k.run; if (c.t < 0) c.state = 'wander'; }
    if (c.state === 'wander') { if (c.t < 0) { c.t = rand(2, 6); c.dir = Math.random() < 0.5 ? -1 : 1; c.idle = Math.random() < 0.35; } want = c.idle ? 0 : k.speed; }
    c.vx += clamp(c.dir * want - c.vx, -14 * dt, 14 * dt);
    // the head follows the ground ahead; a wall taller than it can climb turns it round
    const ahead = groundY(c.x + c.vx * 0.12 + c.dir * 0.2, c.y);
    if (ahead === null || ahead - c.y > 1.7) { c.vx = 0; if (c.state === 'wander' || c.state === 'flee') c.dir = -c.dir; }
    else { c.x += c.vx * dt; const ty = ahead + k.clear; if (c.y > ty + 0.4) { c.vy -= GRAV * dt; c.y = Math.max(ty, c.y + c.vy * dt); } else { c.vy = 0; c.y += (ty - c.y) * Math.min(1, dt * 14); } }
    const N = c.nodes; N[0].x = c.x; N[0].y = c.y + Math.sin(c.seed + c.x * 3) * 0.02;
    for (let j = 1; j < N.length; j++) {
      const n = N[j], q = N[j - 1], g = groundY(n.x, n.y); if (g !== null) n.y += (g + k.clear * (1 - j * 0.04) - n.y) * Math.min(1, dt * 10);
      const ex = n.x - q.x, ey = n.y - q.y, l = Math.hypot(ex, ey) || 1; n.x = q.x + ex / l * k.gap; n.y = q.y + ey / l * k.gap;
    }
    // feet: step when the planted foot is too far from where it should be
    const sp = Math.abs(c.vx), stepping = c.legs.filter(l => l.t >= 0).length;
    for (let li = 0; li < c.legs.length; li++) {
      const l = c.legs[li], hip = N[l.n], ix = hip.x + c.dir * k.stride * 0.35 + (l.s ? 0.12 : -0.12) + Math.sign(c.vx) * Math.min(sp * 0.06, 0.4);
      if (l.t >= 0) { l.t += dt / k.stepT; const u = Math.min(1, l.t); l.fx = l.sx + (l.tx - l.sx) * u; l.fy = l.sy + (l.ty - l.sy) * u + Math.sin(u * Math.PI) * 0.22; if (u >= 1) { l.t = -1; if (sp > 3) audio.play('step'); } }
      else if ((Math.abs(l.fx - ix) > k.stride || Math.hypot(l.fx - hip.x, l.fy - hip.y) > (k.l1 + k.l2) * 0.98) && stepping < c.legs.length / 2) {
        const tx = ix + Math.sign(c.vx || c.dir) * k.stride * 0.55, g = groundY(tx, hip.y, 0.6, 8);
        l.t = 0; l.sx = l.fx; l.sy = l.fy; l.tx = tx; l.ty = g === null ? hip.y - k.clear : g;
      }
    }
  }
}
export function drawCreatures(b, time) {
  for (const c of creatures) {
    const fl = c.flash > 0 ? 3 : 1;
    if (c.type === 'jelly') {
      const p = 0.6 + 0.4 * Math.sin(time * 2 + c.seed);
      for (const s of c.tent) for (let j = 1; j < s.length; j++) b.seg(s[j - 1].x, s[j - 1].y, s[j].x, s[j].y, 0.035, mul(C.violet, 0.9 * p * (1 - j * 0.12)), 0.8, 2, 2);
      b.add(c.x, c.y, 1.6, 1.6, 0, mul(C.violet, 0.35 * p * fl), 1, 1, 2); b.add(c.x, c.y + 0.05, 0.62, 0.42, 0, mul(C.violet, 0.9 * p * fl), 0.9, 2, 2); b.add(c.x, c.y + 0.1, 0.25, 0.16, 0, [1.6, 1.0, 3], p, 1, 2);
      light.emit(c.x / TS, c.y / TS, 0.2 * p, 0.07 * p, 0.7 * p); continue;
    }
    const k = KIND[c.type], N = c.nodes, body = mul(C.chitin, c.type === 'grazer' ? 1.5 : 1);
    for (const l of c.legs) {                      // legs behind the body for the far side
      const hip = N[l.n], k1 = ik2(hip.x, hip.y, l.fx, l.fy, k.l1, k.l2, 1), k2 = ik2(hip.x, hip.y, l.fx, l.fy, k.l1, k.l2, -1), kn = k1[1] > k2[1] ? k1 : k2, col = mul(body, l.s ? 1 : 0.55);
      b.seg(hip.x, hip.y, kn[0], kn[1], 0.085, col, 1, 2, 1); b.seg(kn[0], kn[1], l.fx, l.fy, 0.055, col, 1, 2, 1);
    }
    for (let j = N.length - 1; j >= 1; j--) { const th = k.thick * (c.type === 'grazer' ? 1 - Math.abs(j - 2) * 0.16 : 1 - j / N.length * 0.75); b.seg(N[j].x, N[j].y, N[j - 1].x, N[j - 1].y, th, body, 1, 2, 1, j); }
    const pl = 0.5 + 0.5 * Math.sin(time * 1.3 + c.seed);
    for (let j = 1; j < N.length; j += c.type === 'grazer' ? 1 : 2) b.add(N[j].x, N[j].y + k.thick * 0.12, 0.09, 0.09, 0, mul(k.glow, (0.5 + pl) * fl), 0.9, 1, 2);
    if (c.type === 'grazer') for (let j = 1; j < N.length - 1; j++) b.seg(N[j].x - 0.2, N[j].y + k.thick * 0.42, N[j].x + 0.2, N[j].y + k.thick * 0.42, 0.14, mul(body, 1.7), 1, 2, 1, j + 9);
    // eyes catch the headlamp
    const e = (c.type === 'stalker' ? 0.25 : 0.1) + c.lit * 2.4; for (let s = 0; s < 2; s++) b.add(N[0].x + c.dir * (0.1 - s * 0.09), N[0].y + 0.07 + s * 0.02, 0.06, 0.06, 0, [e * 1.0, e * 0.85, e * 0.45], 1, 1, 2);
    if (c.lit > 0.5 && c.type === 'stalker') b.add(N[0].x + c.dir * 0.06, N[0].y + 0.08, 0.5, 0.5, 0, [0.5, 0.4, 0.2], c.lit * 0.5, 1, 2);
  }
}

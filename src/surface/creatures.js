// creatures: six hive species with distinct bodies and roles, and two harmless natives.
//   scout     six legs, fast, hunts by light and sound, its call wakes the hive
//   swarmer   small, quick, weak, comes in numbers
//   brute     armoured, slow, wrecks machines and hits hard
//   spitter   keeps its distance and lobs acid that eats the ground
//   burrower  a legless worm that swims through rock and leaves a tunnel behind
//   flier     wings, circles above and dives
//   grazer, jelly: natives that only want to be left alone
// Walkers are follow-the-leader chains over the density field with two-segment analytic IK legs and stepping feet.
import { G, events, rand, clamp } from '../core.js';
import { audio } from '../audio.js';
import { world, TS, GRAV, M } from './world.js';
import { light } from './light.js';
import { S, C, mul } from './state.js';
import { env } from './env.js';

export const creatures = [];
export function ik2(ax, ay, bx, by, l1, l2, s) {
  let dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy); const m = l1 + l2 - 1e-3;
  if (d > m) { dx *= m / d; dy *= m / d; d = m; } if (d < 1e-4) { d = 1e-4; dx = d; }
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  return [ax + dx / d * a - dy / d * h * s, ay + dy / d * a + dx / d * h * s];
}
export const KIND = {
  scout: { nodes: 7, gap: 0.36, legs: [1, 2, 3], l1: 0.6, l2: 0.72, clear: 0.5, thick: 0.34, speed: 2.0, run: 7.8, hp: 60, stride: 0.75, glow: C.cyan, stepT: 0.1, bite: 18, sense: 30, hostile: 1, drop: ['ichor', 0.6] },
  swarmer: { nodes: 4, gap: 0.2, legs: [1, 2], l1: 0.3, l2: 0.36, clear: 0.26, thick: 0.2, speed: 2.6, run: 9.5, hp: 16, stride: 0.4, glow: C.acid, stepT: 0.06, bite: 6, sense: 22, hostile: 1, drop: ['chitin', 0.4] },
  brute: { nodes: 6, gap: 0.62, legs: [1, 2, 4], l1: 0.85, l2: 0.95, clear: 0.95, thick: 1.15, speed: 1.1, run: 4.6, hp: 520, stride: 0.8, glow: C.hot, stepT: 0.3, bite: 38, sense: 20, hostile: 1, armour: 0.45, drop: ['chitin', 9] },
  spitter: { nodes: 5, gap: 0.34, legs: [1, 3], l1: 0.55, l2: 0.6, clear: 0.6, thick: 0.42, speed: 1.6, run: 4.2, hp: 70, stride: 0.6, glow: C.acid, stepT: 0.16, bite: 8, sense: 28, hostile: 1, drop: ['ichor', 1.5] },
  grazer: { nodes: 5, gap: 0.5, legs: [1, 3], l1: 0.5, l2: 0.55, clear: 0.62, thick: 0.8, speed: 0.9, run: 2.6, hp: 160, stride: 0.5, glow: C.acid, stepT: 0.28, drop: ['chitin', 3] },
  burrower: { worm: 1, nodes: 11, gap: 0.42, thick: 0.6, speed: 2.4, run: 4.2, hp: 190, glow: C.hot, bite: 26, sense: 40, hostile: 1, drop: ['chitin', 4] },
  flier: { fly: 1, nodes: 4, gap: 0.24, thick: 0.22, speed: 4, run: 9, hp: 30, glow: C.violet, bite: 10, sense: 34, hostile: 1, drop: ['ichor', 0.3] },
  jelly: { fly: 1, hp: 22, glow: C.violet, drop: ['ichor', 0.4] },
};
const groundY = (x, y, up = 1.6, down = 16) => world.groundY(x, y, up, down);
export function spawnCreature(type, x, y, goal) {
  const k = KIND[type], c = { type, x, y, vx: 0, vy: 0, dir: Math.random() < 0.5 ? -1 : 1, hp: k.hp, state: 'wander', t: rand(1, 4), seed: Math.random() * 100, flash: 0, bite: 0, lit: 0, nodes: [], legs: [], seen: false, goal: goal || null, stuck: 0, cd: rand(1, 3) };
  if (type === 'jelly') { c.tent = []; for (let i = 0; i < 5; i++) { const s = []; for (let j = 0; j < 6; j++) s.push({ x, y: y - j * 0.16, px: x, py: y - j * 0.16 }); c.tent.push(s); } }
  else {
    for (let i = 0; i < k.nodes; i++) c.nodes.push({ x: x - c.dir * i * k.gap, y });
    if (k.legs) for (const n of k.legs) for (let s = 0; s < 2; s++) c.legs.push({ n, s, fx: x - c.dir * n * k.gap, fy: y - k.clear, t: -1, sx: 0, sy: 0, tx: 0, ty: 0 });
  }
  creatures.push(c); return c;
}
export function hurtCreature(c, x, y, dmg, vx, vy, beam) {
  let hit = false; const k = KIND[c.type];
  if (c.type === 'jelly') hit = Math.hypot(x - c.x, y - c.y) < 0.4;
  else for (const n of c.nodes) if (Math.hypot(x - n.x, y - n.y) < k.thick * 0.6 + 0.05) { hit = true; break; }
  if (!hit || c.hp <= 0) return false;
  c.hp -= dmg * (1 - (k.armour || 0)); c.flash = 0.12; if (!beam) c.vx += vx * 0.002 / (1 + k.thick * 2);
  if (k.hostile) { if (c.state !== 'flee') c.state = 'charge'; } else c.state = 'flee'; c.t = 5;
  const g = k.glow;
  if (!beam || Math.random() < 0.2) for (let i = 0; i < (beam ? 2 : 10); i++) S.parts.spawn({ x, y, vx: vx * rand(0.003, 0.012) + rand(-3, 3), vy: vy * rand(0.003, 0.012) + rand(-1, 5), life: rand(0.5, 2.2), size: rand(0.04, 0.09), c: mul(g, 2.5), c2: mul(g, 0.5), col: 1, bounce: 0.15 });
  if (!beam) audio.play('hit');
  if (c.hp <= 0) {
    events.emit('firstKill'); events.emit('kill', c.type); S.stats.kills[c.type] = (S.stats.kills[c.type] || 0) + 1; if (k.drop) S.give(k.drop[0], k.drop[1]); audio.play('call'); env.noise(c.x, c.y, 30, false);
    const pts = c.type === 'jelly' ? [c] : c.nodes; for (const n of pts) for (let i = 0; i < 6; i++) S.parts.spawn({ x: n.x, y: n.y, vx: rand(-4, 4), vy: rand(0, 6), life: rand(1, 3), size: rand(0.05, 0.12), c: mul(g, 2.2), c2: mul(g, 0.3), col: 1, bounce: 0.1 });
  }
  return true;
}
// what a hostile is going for: the player when it senses them, else the loudest thing it hears, else its orders
function targetOf(c, k, P, dist) {
  const lampSees = light.lamp.on && c.lit > 0.4;
  if (!P.dead && (dist < (lampSees ? k.sense : k.sense * 0.45) || c.state === 'charge' && dist < k.sense * 1.3)) return P;
  const h = env.heard(c.x, c.y, 1.3); if (h) { c.goal = { x: h.x, y: h.y }; return c.goal; }
  return c.goal;
}
export function stepCreatures(dt) {
  const P = S.P;
  for (let i = creatures.length - 1; i >= 0; i--) {
    const c = creatures[i], k = KIND[c.type], dx = P.x - c.x, dy = P.y + 0.9 - c.y, dist = Math.hypot(dx, dy);
    if (c.hp <= 0 || dist > 110) { creatures.splice(i, 1); continue; }
    c.flash -= dt; c.bite -= dt; c.t -= dt; c.cd -= dt;
    if (!c.seen && dist < 16) { c.seen = true; events.emit('firstCreature'); events.emit('seen:' + c.type); if (k.hostile) { audio.play('call'); if (c.type === 'scout') env.noise(c.x, c.y, 45, false); } }
    const lum = light.at(c.x / TS, c.y / TS); c.lit += ((lum > 0.6 ? 1 : 0) - c.lit) * Math.min(1, dt * 6);
    if (c.type === 'jelly') {
      const w = P.dead ? 0 : 0.5; c.vx += (dx / (dist + 1) * w + Math.sin(c.seed + c.t * 0.7) * 0.3 - c.vx * 0.8) * dt; c.vy += (dy / (dist + 1) * w + Math.sin(c.seed * 3 + c.t * 1.9) * 0.6 - c.vy * 0.8) * dt;
      if (world.solidAt(c.x + c.vx * 0.5, c.y)) c.vx = -c.vx; if (world.solidAt(c.x, c.y + c.vy * 0.5 - 0.8)) c.vy = Math.abs(c.vy) + 0.2; if (world.solidAt(c.x, c.y + 0.6)) c.vy = -Math.abs(c.vy);
      c.x += c.vx * dt; c.y += c.vy * dt;
      if (dist < 0.7 && c.bite <= 0 && !P.dead) { c.bite = 1.5; S.hurt(6, dx * 2, 1); }
      c.tent.forEach((s, ti) => { s[0].x = c.x + (ti - 2) * 0.11; s[0].y = c.y - 0.12; for (let j = 1; j < s.length; j++) { const p = s[j], vx = (p.x - p.px) * 0.96, vy = (p.y - p.py) * 0.96; p.px = p.x; p.py = p.y; p.x += vx + Math.sin(c.t * 2 + ti + j) * 0.0006; p.y += vy - 1.2 * dt * dt; const q = s[j - 1], ex = p.x - q.x, ey = p.y - q.y, l = Math.hypot(ex, ey) || 1; p.x = q.x + ex / l * 0.16; p.y = q.y + ey / l * 0.16; } });
      continue;
    }
    const tg = k.hostile ? targetOf(c, k, P, dist) : null, isP = tg === P, tx = tg ? (isP ? P.x : tg.x) : c.x, ty = tg ? (isP ? P.y + 0.9 : tg.y) : c.y, tdx = tx - c.x, tdy = ty - c.y, td = Math.hypot(tdx, tdy);
    const N = c.nodes;
    if (k.worm || k.fly) {
      // free movers steer in two dimensions; the worm ignores rock and digs, the flier avoids it
      let wx = 0, wy = 0, sp = k.speed;
      if (tg) { const lead = k.fly && isP && td > 5 ? 3.5 + Math.sin(c.seed + c.t) * 1.5 : 0; wx = tdx / (td + 0.01); wy = (tdy + lead) / (td + 0.01); sp = isP || k.worm ? k.run : k.speed; if (k.fly && isP && td < 5 && c.cd < 0) { wy = tdy / (td + 0.01); sp = k.run * 1.3; } }
      else { wx = Math.cos(c.seed + c.t * 0.4); wy = Math.sin(c.seed * 2 + c.t * 0.3) * 0.5; }
      if (k.fly) { const g = groundY(c.x, c.y, 0, 6); if (g !== null && c.y - g < 2.2 && !(isP && td < 5)) wy += 1.2; if (world.solidAt(c.x + wx * 1.2, c.y + wy * 1.2)) { wy += 1; wx *= -0.3; } }
      c.vx += (wx * sp - c.vx) * Math.min(1, dt * (k.fly ? 2.2 : 1.6)); c.vy += (wy * sp - c.vy) * Math.min(1, dt * (k.fly ? 2.2 : 1.6));
      if (k.fly && world.solidAt(c.x + c.vx * dt * 3, c.y + c.vy * dt * 3)) { c.vx *= -0.5; c.vy = Math.abs(c.vy) * 0.5 + 1; }
      c.x += c.vx * dt; c.y += c.vy * dt; c.dir = c.vx >= 0 ? 1 : -1;
      if (k.worm) {
        const inRock = world.solidAt(c.x, c.y);
        if (inRock) { world.dig(c.x, c.y, 0.55, dt * 4, undefined, q => q === M.XENO || q === M.STEEL); if (Math.random() < dt * 30) S.parts.spawn({ x: c.x + rand(-0.4, 0.4), y: c.y + rand(-0.4, 0.4), vx: rand(-2, 2), vy: rand(0, 3), life: rand(0.5, 1.4), size: rand(0.05, 0.12), c: [0.12, 0.1, 0.1], mode: 1, shape: 0, col: 1, spin: rand(-9, 9), fade: 0 }); if (Math.random() < dt * 2) { env.noise(c.x, c.y, 16, false); } }
        else if (!tg || ty < c.y) c.vy -= GRAV * dt * 0.7;
        if (dist < 9 && inRock) G_shake(0.02);
      }
      N[0].x = c.x; N[0].y = c.y;
      for (let j = 1; j < N.length; j++) { const n = N[j], q = N[j - 1], ex = n.x - q.x, ey = n.y - q.y + (k.fly ? 0 : 0), l = Math.hypot(ex, ey) || 1; n.x = q.x + ex / l * k.gap; n.y = q.y + ey / l * k.gap; }
      if (isP && dist < (k.worm ? 1.1 : 0.8) && c.bite <= 0) { c.bite = k.worm ? 1.2 : 0.8; c.cd = 2.5; S.hurt(k.bite, Math.sign(dx) * -3 + c.vx * 0.4, 2.5); audio.play('bite'); if (k.fly) { c.vy = 6; c.vx *= -0.6; } }
      continue;
    }
    let want = 0;
    if (k.hostile) {
      if (c.hp < k.hp * 0.15 && c.type !== 'swarmer' && c.type !== 'brute') c.state = 'flee';
      else if (tg) { if (c.state === 'wander') { c.state = isP ? 'stalk' : 'seek'; c.t = 0; } if (c.state === 'seek' && isP) c.state = 'stalk'; if (c.state === 'stalk' && !isP) c.state = 'seek'; }
      else if (c.state !== 'flee' && c.state !== 'wander') { c.state = 'wander'; c.t = 0; }
      const facing = Math.sign(dx) !== P.face;
      if (c.state === 'stalk') {
        c.dir = Math.sign(tdx) || 1;
        if (c.type === 'scout') { want = (facing && c.lit > 0.5) ? 0 : k.speed * 1.4; if (dist < 6.5 || (c.lit > 0.8 && c.t < -1.2)) { c.state = 'charge'; c.t = 4; audio.play('call'); env.noise(c.x, c.y, 40, false); } if (c.lit < 0.5) c.t = 0; }
        else if (c.type === 'spitter') { want = dist > 13 ? k.run : dist < 7 ? -k.run * 0.8 : 0; if (dist < 16 && c.cd < 0 && !P.dead) { c.cd = 2.6; spit(c, P); } }
        else { c.state = 'charge'; c.t = 6; }
      }
      if (c.state === 'seek') { c.dir = Math.sign(tdx) || 1; want = td < 1.5 ? 0 : k.run * 0.7; if (td < 2.5) { c.goal = null; wreck(c, k, dt); } }
      if (c.state === 'charge') { c.dir = Math.sign(dx) || 1; want = k.run; if (c.t < 0 && dist > 14) c.state = 'stalk'; if (c.type === 'spitter' && dist > 5) c.state = 'stalk'; }
      if (c.state === 'flee') { c.dir = -Math.sign(dx) || 1; want = k.run * 0.8; }
      if (dist < 0.9 + k.thick * 0.7 && c.bite <= 0 && c.state === 'charge' && !P.dead) { c.bite = c.type === 'swarmer' ? 0.55 : 0.9; S.hurt(k.bite, c.dir * (3 + k.thick * 6) + c.vx * 0.3, 3.5); audio.play('bite'); c.vx *= -0.4; }
    } else if (c.state === 'flee') { c.dir = -Math.sign(dx) || 1; want = k.run; if (c.t < 0) c.state = 'wander'; }
    if (c.state === 'wander') { if (c.t < 0) { c.t = rand(2, 6); c.dir = Math.random() < 0.5 ? -1 : 1; c.idle = Math.random() < 0.35; } want = c.idle ? 0 : k.speed; }
    if (want < 0) { want = -want; c.back = true; } else c.back = false;
    const mv = c.back ? -c.dir : c.dir;
    c.vx += clamp(mv * want - c.vx, -14 * dt, 14 * dt);
    // the head follows the ground ahead; a wall taller than it can climb turns it round, or it climbs
    const ahead = groundY(c.x + c.vx * 0.12 + mv * 0.2, c.y, 1.4 + k.clear);
    if (ahead === null || ahead - c.y > 1.9) {
      c.stuck += dt; c.vx = 0;
      if (c.state === 'wander' || c.state === 'flee') c.dir = -c.dir;
      else if (c.stuck > 0.5) { const up = groundY(c.x + mv * 0.9, c.y + 3.2, 0, 3.4); if (up !== null) { c.x += mv * dt * 3; c.y += (up + k.clear - c.y) * Math.min(1, dt * 3); } else if (c.type === 'brute') world.dig(c.x + mv * 1.1, c.y + 0.3, 0.9, dt * 2.5, undefined, q => q === M.XENO || q === M.STEEL); else if (c.stuck > 3) { c.goal = null; c.state = 'wander'; c.t = 3; c.dir = -c.dir; c.stuck = 0; } }
    } else { c.stuck = 0; c.x += c.vx * dt; const gy = ahead + k.clear; if (c.y > gy + 0.4) { c.vy -= GRAV * dt; c.y = Math.max(gy, c.y + c.vy * dt); } else { c.vy = 0; c.y += (gy - c.y) * Math.min(1, dt * 14); } }
    N[0].x = c.x; N[0].y = c.y + Math.sin(c.seed + c.x * 3) * 0.02;
    for (let j = 1; j < N.length; j++) {
      const n = N[j], q = N[j - 1], g = groundY(n.x, n.y, 1.2 + k.clear); if (g !== null) n.y += (g + k.clear * (1 - j * 0.04) - n.y) * Math.min(1, dt * 10);
      const ex = n.x - q.x, ey = n.y - q.y, l = Math.hypot(ex, ey) || 1; n.x = q.x + ex / l * k.gap; n.y = q.y + ey / l * k.gap;
    }
    // feet: step when the planted foot is too far from where it should be
    const sp = Math.abs(c.vx); let stepping = 0; for (const l of c.legs) if (l.t >= 0) stepping++;
    for (let li = 0; li < c.legs.length; li++) {
      const l = c.legs[li], hip = N[l.n], ix = hip.x + c.dir * k.stride * 0.35 + (l.s ? 0.12 : -0.12) + Math.sign(c.vx) * Math.min(sp * 0.06, 0.4);
      if (l.t >= 0) { l.t += dt / k.stepT; const u = Math.min(1, l.t); l.fx = l.sx + (l.tx - l.sx) * u; l.fy = l.sy + (l.ty - l.sy) * u + Math.sin(u * Math.PI) * 0.22; if (u >= 1) { l.t = -1; if (sp > 3 && c.type !== 'swarmer') audio.play('step'); if (c.type === 'brute' && Math.hypot(dx, dy) < 18) G_shake(0.03); } }
      else if ((Math.abs(l.fx - ix) > k.stride || Math.hypot(l.fx - hip.x, l.fy - hip.y) > (k.l1 + k.l2) * 0.98) && stepping < c.legs.length / 2) {
        const fx = ix + Math.sign(c.vx || c.dir) * k.stride * 0.55, g = groundY(fx, hip.y, 0.6, 8);
        l.t = 0; l.sx = l.fx; l.sy = l.fy; l.tx = fx; l.ty = g === null ? hip.y - k.clear : g; stepping++;
      }
    }
  }
}
const G_shake = v => { G.shake = Math.max(G.shake, v); };
function spit(c, P) {
  const x = c.nodes[0].x, y = c.nodes[0].y + 0.2, dx = P.x - x, dy = P.y + 1 - y, v = 13, t = Math.max(0.4, Math.hypot(dx, dy) / v);
  S.bullets.push({ x, y, px: x, py: y, vx: dx / t, vy: dy / t + GRAV * 0.5 * t * 0.5, life: 4, dmg: 12, acid: true, g: 0.5 }); audio.play('bite');
}
// a hostile that reached the noise it came for takes it out on whatever machine is there
function wreck(c, k, dt) { if (S.wreck) S.wreck(c.x, c.y, (k.bite || 5) * dt * 0.8); }
export function drawCreatures(b, time) {
  for (const c of creatures) {
    const fl = c.flash > 0 ? 3 : 1, k = KIND[c.type];
    if (c.type === 'jelly') {
      const p = 0.6 + 0.4 * Math.sin(time * 2 + c.seed);
      for (const s of c.tent) for (let j = 1; j < s.length; j++) b.seg(s[j - 1].x, s[j - 1].y, s[j].x, s[j].y, 0.035, mul(C.violet, 0.9 * p * (1 - j * 0.12)), 0.8, 2, 2);
      b.add(c.x, c.y, 1.6, 1.6, 0, mul(C.violet, 0.35 * p * fl), 1, 1, 2); b.add(c.x, c.y + 0.05, 0.62, 0.42, 0, mul(C.violet, 0.9 * p * fl), 0.9, 2, 2); b.add(c.x, c.y + 0.1, 0.25, 0.16, 0, [1.6, 1.0, 3], p, 1, 2);
      light.emit(c.x / TS, c.y / TS, 0.2 * p, 0.07 * p, 0.7 * p); continue;
    }
    const N = c.nodes, heavy = c.type === 'grazer' || c.type === 'brute', body = mul(C.chitin, heavy ? 1.5 : c.type === 'spitter' ? 1.25 : 1), pl = 0.5 + 0.5 * Math.sin(time * 1.3 + c.seed);
    if (k.worm) {
      for (let j = N.length - 1; j >= 1; j--) { const th = k.thick * (1 - Math.abs(j - 3) / N.length * 0.9); b.seg(N[j].x, N[j].y, N[j - 1].x, N[j - 1].y, th, mul(C.flesh, j % 2 ? 0.8 : 0.55), 1, 2, 1, j); if (j % 2) b.add(N[j].x, N[j].y, th * 0.5, th * 0.5, 0, mul(k.glow, (0.6 + pl) * fl), 0.8, 1, 2); }
      const a = Math.atan2(c.vy, c.vx); for (let s = -1; s <= 1; s += 2) b.seg(N[0].x, N[0].y, N[0].x + Math.cos(a + s * (0.5 + 0.2 * Math.sin(time * 9))) * 0.5, N[0].y + Math.sin(a + s * (0.5 + 0.2 * Math.sin(time * 9))) * 0.5, 0.09, mul(C.chitin, 2), 1, 2, 1);
      b.add(N[0].x, N[0].y, 0.9, 0.9, 0, mul(k.glow, 0.5 * fl), 0.6, 1, 2); light.emit(N[0].x / TS, N[0].y / TS, 0.5, 0.08, 0.03); continue;
    }
    if (k.fly) {
      const fp = Math.sin(time * 22 + c.seed), a = Math.atan2(c.vy, c.vx);
      for (let s = -1; s <= 1; s += 2) { const wx = N[1].x - Math.sin(a) * s * 0.1, wy = N[1].y + Math.cos(a) * s * 0.1, ex = wx - Math.cos(a) * 0.25 - Math.sin(a) * s * 0.75 * (0.4 + 0.6 * Math.abs(fp)), ey = wy + 0.55 * fp + Math.cos(a) * s * 0.2; b.seg(wx, wy, ex, ey, 0.05, mul(C.chitin, 1.6), 1, 2, 1); b.seg(wx, wy, (wx + ex) / 2, (wy + ey) / 2 - 0.1, 0.3, mul(C.violet, 0.12), 0.5, 2, 2); }
      for (let j = N.length - 1; j >= 1; j--) b.seg(N[j].x, N[j].y, N[j - 1].x, N[j - 1].y, k.thick * (1 - j * 0.2), body, 1, 2, 1, j);
      b.add(N[0].x, N[0].y, 0.07, 0.07, 0, mul(k.glow, 3 * fl), 1, 1, 2); b.add(N[2].x, N[2].y, 0.5, 0.5, 0, mul(k.glow, 0.3 * (0.5 + pl)), 0.7, 1, 2); continue;
    }
    for (const l of c.legs) {                      // legs behind the body for the far side
      const hip = N[l.n], k1 = ik2(hip.x, hip.y, l.fx, l.fy, k.l1, k.l2, 1), k2 = ik2(hip.x, hip.y, l.fx, l.fy, k.l1, k.l2, -1), kn = k1[1] > k2[1] ? k1 : k2, col = mul(body, l.s ? 1 : 0.55), lw = heavy ? 0.16 : c.type === 'swarmer' ? 0.05 : 0.085;
      b.seg(hip.x, hip.y, kn[0], kn[1], lw, col, 1, 2, 1); b.seg(kn[0], kn[1], l.fx, l.fy, lw * 0.65, col, 1, 2, 1);
    }
    for (let j = N.length - 1; j >= 1; j--) { const th = k.thick * (heavy ? 1 - Math.abs(j - 2) * 0.16 : c.type === 'spitter' ? (j === 3 ? 1.5 : 0.8) : 1 - j / N.length * 0.75); b.seg(N[j].x, N[j].y, N[j - 1].x, N[j - 1].y, th, body, 1, 2, 1, j); }
    for (let j = 1; j < N.length; j += heavy ? 1 : 2) b.add(N[j].x, N[j].y + k.thick * 0.12, 0.09 + (heavy ? 0.05 : 0), 0.09, 0, mul(k.glow, (0.5 + pl) * fl), 0.9, 1, 2);
    if (heavy) for (let j = 1; j < N.length - 1; j++) b.seg(N[j].x - k.thick * 0.25, N[j].y + k.thick * 0.42, N[j].x + k.thick * 0.25, N[j].y + k.thick * 0.42, k.thick * 0.18, mul(body, 1.7), 1, 2, 1, j + 9);
    if (c.type === 'brute') { b.seg(N[0].x, N[0].y, N[0].x + c.dir * 0.7, N[0].y + 0.35, 0.16, mul(body, 2), 1, 2, 1); b.seg(N[0].x, N[0].y - 0.2, N[0].x + c.dir * 0.75, N[0].y - 0.05, 0.14, mul(body, 2), 1, 2, 1); }
    if (c.type === 'spitter') { b.add(N[3].x, N[3].y + 0.1, 0.5, 0.5, 0, mul(C.acid, (0.5 + pl * 0.8) * fl * (c.cd < 0.6 ? 2.5 : 1)), 0.85, 2, 2); light.emit(N[3].x / TS, N[3].y / TS, 0.1, 0.3, 0.02); }
    // eyes catch the headlamp
    const e = (k.hostile ? 0.25 : 0.1) + c.lit * 2.4; for (let s = 0; s < 2; s++) b.add(N[0].x + c.dir * (0.1 - s * 0.09), N[0].y + 0.07 + s * 0.02, 0.06, 0.06, 0, [e * 1.0, e * 0.85, e * 0.45], 1, 1, 2);
    if (c.lit > 0.5 && k.hostile) b.add(N[0].x + c.dir * 0.06, N[0].y + 0.08, 0.5, 0.5, 0, [0.5, 0.4, 0.2], c.lit * 0.5, 1, 2);
  }
}

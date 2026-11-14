// creatures. Nothing here is hostile by default, and nothing is kind either. Every species has a size, a diet and a
// temper, and what it does about you follows from those (stance(), a pure function):
//   - a predator bigger than you, that eats things your size, hunts you (the stalker);
//   - everything else is wary: it watches, keeps its distance, runs from noise and from you, and fights back only when it
//     is hurt or cornered (the strider herds, the grazer, the jelly);
//   - the hive species defend the hive: they act on its orders. Without an order they are wary like the rest; a probe
//     comes to look at what made the noise and goes back to report; an attack wave is the hive's answer to being hurt.
// Six hive species with distinct bodies and roles:
//   scout     six legs, fast, hunts by light and sound, its call wakes the hive
//   swarmer   small, quick, weak, comes in numbers
//   brute     armoured, slow, wrecks machines and hits hard
//   spitter   keeps its distance and lobs acid that eats the ground
//   burrower  a legless worm that swims through rock and leaves a tunnel behind
//   flier     wings, circles above and dives
//   grazer, jelly, strider (herds, with calves), stalker (the predator): the natives
// Walkers are follow-the-leader chains over the density field with two-segment analytic IK legs and stepping feet.
import { G, events, rand, clamp } from '../core.js';
import { audio } from '../audio.js';
import { world, TS, GRAV, M } from './world.js';
import { light } from './light.js';
import { S, C, mul } from './state.js';
import { env } from './env.js';
import { matter } from './matter.js';

export const creatures = [];
export function ik2(ax, ay, bx, by, l1, l2, s) {
  let dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy); const m = l1 + l2 - 1e-3;
  if (d > m) { dx *= m / d; dy *= m / d; d = m; } if (d < 1e-4) { d = 1e-4; dx = d; }
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  return [ax + dx / d * a - dy / d * h * s, ay + dy / d * a + dx / d * h * s];
}
export const PLAYER_SIZE = 1.8;
// size m, diet: 'hive' | 'prey' (eats animals) | 'graze' | 'drift'. wary = distance at which it stops and watches,
// fleeD = distance at which it runs, nerve = metres of noise margin it stands before it runs, reach + kick = self-defence
export const KIND = {
  scout: { nodes: 7, gap: 0.36, legs: [1, 2, 3], l1: 0.6, l2: 0.72, clear: 0.5, thick: 0.34, speed: 2.0, run: 7.8, hp: 60, stride: 0.75, glow: C.cyan, stepT: 0.1, bite: 18, sense: 30, size: 1.2, diet: 'hive', stalks: 1, wary: 12, fleeD: 5, nerve: 30, drop: ['ichor', 0.6] },
  swarmer: { nodes: 4, gap: 0.2, legs: [1, 2], l1: 0.3, l2: 0.36, clear: 0.26, thick: 0.2, speed: 2.6, run: 9.5, hp: 16, stride: 0.4, glow: C.acid, stepT: 0.06, bite: 6, sense: 22, size: 0.5, diet: 'hive', wary: 8, fleeD: 5, nerve: 20, drop: ['chitin', 0.4] },
  brute: { nodes: 6, gap: 0.62, legs: [1, 2, 4], l1: 0.85, l2: 0.95, clear: 0.95, thick: 1.15, speed: 1.1, run: 4.6, hp: 520, stride: 0.8, glow: C.hot, stepT: 0.3, bite: 38, sense: 20, size: 2.8, diet: 'hive', armour: 0.45, wary: 8, fleeD: 0, nerve: 99, drop: ['chitin', 9] },
  spitter: { nodes: 5, gap: 0.34, legs: [1, 3], l1: 0.55, l2: 0.6, clear: 0.6, thick: 0.42, speed: 1.6, run: 4.2, hp: 70, stride: 0.6, glow: C.acid, stepT: 0.16, bite: 8, sense: 28, size: 1.1, diet: 'hive', wary: 14, fleeD: 7, nerve: 30, drop: ['ichor', 1.5] },
  grazer: { nodes: 5, gap: 0.5, legs: [1, 3], l1: 0.5, l2: 0.55, clear: 0.62, thick: 0.8, speed: 0.9, run: 2.6, hp: 160, stride: 0.5, glow: C.acid, stepT: 0.28, size: 1.5, diet: 'graze', wary: 9, fleeD: 4.5, nerve: 28, reach: 1.7, kick: 10, drop: ['chitin', 3] },
  strider: { nodes: 5, gap: 0.42, legs: [1, 3], l1: 0.78, l2: 0.86, clear: 1.3, thick: 0.46, speed: 0.75, run: 6.4, hp: 120, stride: 0.85, glow: C.cyan, stepT: 0.17, size: 1.7, diet: 'graze', wary: 13.5, fleeD: 7.5, nerve: 10, reach: 1.9, kick: 12, beast: 1, drop: ['biomass', 14] },
  calf: { nodes: 4, gap: 0.26, legs: [1, 2], l1: 0.46, l2: 0.52, clear: 0.78, thick: 0.28, speed: 0.9, run: 5.8, hp: 40, stride: 0.5, glow: C.cyan, stepT: 0.12, size: 0.9, diet: 'graze', wary: 15, fleeD: 9, nerve: 8, reach: 0, kick: 0, beast: 1, drop: ['biomass', 4] },
  stalker: { nodes: 8, gap: 0.5, legs: [1, 3, 5], l1: 0.85, l2: 0.95, clear: 0.92, thick: 0.72, speed: 1.5, run: 8.4, hp: 900, stride: 0.95, glow: C.hot, stepT: 0.12, bite: 32, sense: 36, size: 2.7, diet: 'prey', stalks: 1, armour: 0.3, drop: ['chitin', 12] },
  burrower: { worm: 1, nodes: 11, gap: 0.42, thick: 0.6, speed: 2.4, run: 4.2, hp: 190, glow: C.hot, bite: 26, sense: 40, size: 2.4, diet: 'hive', wary: 0, fleeD: 0, nerve: 99, drop: ['chitin', 4] },
  flier: { fly: 1, nodes: 4, gap: 0.24, thick: 0.22, speed: 4, run: 9, hp: 30, glow: C.violet, bite: 10, sense: 34, size: 0.8, diet: 'hive', wary: 0, fleeD: 0, nerve: 99, drop: ['ichor', 0.3] },
  jelly: { fly: 1, hp: 22, glow: C.violet, size: 0.6, diet: 'drift', wary: 0, fleeD: 0, nerve: 99, drop: ['ichor', 0.4] },
};
// what a creature does about the player. Pure. ctx: { dist, hurt, cornered, noise (m of margin it hears), order, hp 0..1 }
//   'hunt' a predator bigger than you   'attack' the hive's order, or a hive animal that was hurt   'probe' come and look
//   'defend' strike back in reach   'flee'   'watch' stand and stare   'ignore'
export function stance(k, ctx) {
  if (k.diet === 'hive') { if (ctx.order === 'attack') return 'attack'; if (ctx.hurt) return ctx.hp < 0.15 && k.fleeD ? 'flee' : 'attack'; if (ctx.order === 'probe') return 'probe'; }
  else if (k.diet === 'prey' && k.size > PLAYER_SIZE) return ctx.hp < 0.35 ? 'flee' : 'hunt';
  if (ctx.hurt || ctx.cornered) return k.kick && ctx.dist < k.reach ? 'defend' : 'flee';
  if (ctx.dist < k.fleeD || ctx.noise > k.nerve) return 'flee';
  if (ctx.dist < k.wary) return 'watch';
  return 'ignore';
}
const groundY = (x, y, up = 1.6, down = 16) => world.groundY(x, y, up, down);
export function spawnCreature(type, x, y, goal) {
  const k = KIND[type], c = { type, x, y, vx: 0, vy: 0, dir: Math.random() < 0.5 ? -1 : 1, hp: k.hp, state: 'wander', t: rand(1, 4), seed: Math.random() * 100, flash: 0, bite: 0, lit: 0, nodes: [], legs: [], seen: false, goal: goal || null, stuck: 0, cd: rand(1, 3), order: null, hurtT: 0, agg: false, st: 'ignore', herd: 0, up: 0, spook: -1, home: null, saw: false };
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
  c.hurtT = 9; c.t = 5; if (k.diet === 'hive') { if (c.order !== 'attack') { c.order = 'attack'; events.emit('hiveHurt', c); } if (c.state !== 'flee') c.state = 'charge'; } else if (k.diet === 'prey') { if (c.state !== 'flee') c.state = 'charge'; } else c.state = 'flee';
  const g = k.glow;
  if (!beam || Math.random() < 0.2) for (let i = 0; i < (beam ? 2 : 10); i++) S.parts.spawn({ x, y, vx: vx * rand(0.003, 0.012) + rand(-3, 3), vy: vy * rand(0.003, 0.012) + rand(-1, 5), life: rand(0.5, 2.2), size: rand(0.04, 0.09), c: mul(g, 2.5), c2: mul(g, 0.5), col: 1, bounce: 0.15 });
  if (!beam) audio.play('hit');
  if (c.hp <= 0) {
    events.emit('firstKill'); events.emit('kill', c.type); S.stats.kills[c.type] = (S.stats.kills[c.type] || 0) + 1; if (k.drop) matter.spawn(k.drop[0], k.drop[1], c.x, c.y + 0.3, rand(-1, 1), rand(1, 2.5)); audio.play('call'); env.noise(c.x, c.y, 30, false);
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
    c.flash -= dt; c.bite -= dt; c.t -= dt; c.cd -= dt; c.hurtT -= dt; c.spook -= dt;
    const hd = c.type === 'jelly' ? null : env.heard(c.x, c.y, 1), st = c.st = stance(k, { dist: P.dead ? 999 : dist, hurt: c.hurtT > 0, cornered: c.stuck > 0.35 && dist < 4.5, noise: hd ? hd.v : 0, order: c.order, hp: c.hp / k.hp });
    c.agg = st === 'attack' || st === 'hunt';
    if (!c.seen && dist < 16) { c.seen = true; events.emit('firstCreature'); events.emit('seen:' + c.type); if (c.agg) { audio.play('call'); if (c.type === 'scout') env.noise(c.x, c.y, 45, false); } }
    const lum = light.at(c.x / TS, c.y / TS); c.lit += ((lum > 0.6 ? 1 : 0) - c.lit) * Math.min(1, dt * 6);
    if (c.type === 'jelly') {
      const w = P.dead || dist > 5 ? 0 : -1.4 * (1 - dist / 5); c.vx += (dx / (dist + 1) * w + Math.sin(c.seed + c.t * 0.7) * 0.3 - c.vx * 0.8) * dt; c.vy += (dy / (dist + 1) * w + Math.sin(c.seed * 3 + c.t * 1.9) * 0.6 - c.vy * 0.8) * dt;      // it drifts, and drifts away from you
      if (world.solidAt(c.x + c.vx * 0.5, c.y)) c.vx = -c.vx; if (world.solidAt(c.x, c.y + c.vy * 0.5 - 0.8)) c.vy = Math.abs(c.vy) + 0.2; if (world.solidAt(c.x, c.y + 0.6)) c.vy = -Math.abs(c.vy);
      c.x += c.vx * dt; c.y += c.vy * dt;
      if (dist < 0.5 && c.bite <= 0 && !P.dead) { c.bite = 1.5; S.hurt(6, dx * 2, 1); }                 // touch it and it stings: that is all the defence it has
      c.tent.forEach((s, ti) => { s[0].x = c.x + (ti - 2) * 0.11; s[0].y = c.y - 0.12; for (let j = 1; j < s.length; j++) { const p = s[j], vx = (p.x - p.px) * 0.96, vy = (p.y - p.py) * 0.96; p.px = p.x; p.py = p.y; p.x += vx + Math.sin(c.t * 2 + ti + j) * 0.0006; p.y += vy - 1.2 * dt * dt; const q = s[j - 1], ex = p.x - q.x, ey = p.y - q.y, l = Math.hypot(ex, ey) || 1; p.x = q.x + ex / l * 0.16; p.y = q.y + ey / l * 0.16; } });
      continue;
    }
    const tg = c.agg ? targetOf(c, k, P, dist) : null, isP = tg === P, tx = tg ? (isP ? P.x : tg.x) : c.x, ty = tg ? (isP ? P.y + 0.9 : tg.y) : c.y, tdx = tx - c.x, tdy = ty - c.y, td = Math.hypot(tdx, tdy);
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
      if (isP && c.agg && dist < (k.worm ? 1.1 : 0.8) && c.bite <= 0) { c.bite = k.worm ? 1.2 : 0.8; c.cd = 2.5; S.hurt(k.bite, Math.sign(dx) * -3 + c.vx * 0.4, 2.5); audio.play('bite'); if (k.fly) { c.vy = 6; c.vx *= -0.6; } }
      continue;
    }
    let want = 0; c.up += ((st === 'watch' || st === 'probe' || c.state === 'flee' || c.agg ? 1 : c.idle ? 0 : 0.55) - c.up) * Math.min(1, dt * 4);
    if (st === 'probe') {              // the hive sent it to look. It comes to the noise, watches, and goes home to tell.
      const home = c.goal && c.goal.home && c.home;
      if (home) { c.dir = Math.sign(c.home.x - c.x) || 1; want = k.run * 0.6; if (Math.abs(c.home.x - c.x) < 3) { c.hp = 0; c.silent = true; events.emit('probeReturned', { site: c.home.id, saw: c.saw }); } }
      else { const gx = dist < 26 ? P.x : c.goal ? c.goal.x : c.x, d = Math.abs(gx - c.x); c.dir = Math.sign(gx - c.x) || 1;
        if (dist < 13) { c.saw = true; want = dist < 8 ? -k.speed : 0; c.dir = Math.sign(dx) || 1; c.watch = (c.watch || 0) + dt; } else want = d < 2 ? 0 : k.run * 0.55; if (d < 2 && dist >= 13) c.watch = (c.watch || 0) + dt * 2;
        if ((c.watch || 0) > 9) c.goal = { x: c.home ? c.home.x : c.x, y: c.y, home: true }; }
    } else if (c.agg) {
      if (c.hp < k.hp * 0.15 && c.type !== 'swarmer' && c.type !== 'brute') c.state = 'flee';
      else if (c.state === 'flee' && c.t < 0) c.state = 'stalk';
      else if (tg) { if (c.state === 'wander') { c.state = isP ? 'stalk' : 'seek'; c.t = 0; } if (c.state === 'seek' && isP) c.state = 'stalk'; if (c.state === 'stalk' && !isP) c.state = 'seek'; }
      else if (c.state !== 'flee' && c.state !== 'wander') { c.state = 'wander'; c.t = 0; }
      const facing = Math.sign(dx) !== P.face;
      if (c.state === 'stalk') {
        c.dir = Math.sign(tdx) || 1;
        if (k.stalks) { want = (facing && c.lit > 0.5) ? 0 : k.speed * 1.4; if (dist < (c.type === 'stalker' ? 8.5 : 6.5) || (c.lit > 0.8 && c.t < -1.2)) { c.state = 'charge'; c.t = 4; audio.play('call'); env.noise(c.x, c.y, 40, false); } if (c.lit < 0.5) c.t = 0; }
        else if (c.type === 'spitter') { want = dist > 13 ? k.run : dist < 7 ? -k.run * 0.8 : 0; if (dist < 16 && c.cd < 0 && !P.dead) { c.cd = 2.6; spit(c, P); } }
        else { c.state = 'charge'; c.t = 6; }
      }
      if (c.state === 'seek') { c.dir = Math.sign(tdx) || 1; want = td < 1.5 ? 0 : k.run * 0.7; if (td < 2.5) { c.goal = null; wreck(c, k, dt); } }
      if (c.state === 'charge') { c.dir = Math.sign(dx) || 1; want = k.run; if (c.t < 0 && dist > 14) c.state = 'stalk'; if (c.type === 'spitter' && dist > 5) c.state = 'stalk'; }
      if (c.state === 'flee') { c.dir = -Math.sign(dx) || 1; want = k.run * 0.8; }
      if (dist < 0.9 + k.thick * 0.7 && c.bite <= 0 && c.state === 'charge' && !P.dead) { c.bite = c.type === 'swarmer' ? 0.55 : 0.9; S.hurt(k.bite, c.dir * (3 + k.thick * 6) + c.vx * 0.3, 3.5); audio.play('bite'); c.vx *= -0.4; if (c.type === 'stalker') { c.state = 'flee'; c.t = 2.2; } }
    } else {                           // wary: watch, keep away, run; strike back only when hurt or cornered
      if (st === 'defend' && c.bite <= 0) { c.bite = 1.4; S.hurt(k.kick, Math.sign(dx) * 7, 3.5); audio.play('bite'); c.state = 'flee'; c.t = 4; c.stuck = 0; }
      if ((st === 'flee' || (c.spook < 0 && c.spook > -dt * 2 && c.herd)) && c.state !== 'flee') {
        c.state = 'flee'; c.t = rand(3.5, 6); c.fx = dist < 30 ? P.x : hd ? hd.x : P.x; if (c.type !== 'calf') audio.play('call');
        if (c.herd) for (const o of creatures) if (o !== c && o.herd === c.herd && o.state !== 'flee' && Math.abs(o.x - c.x) < 16) o.spook = rand(0.08, 0.5);      // the herd goes as one, a moment apart
      }
      if (c.state === 'flee') { c.dir = -Math.sign((c.fx ?? P.x) - c.x) || 1; want = k.run; if (c.t < 0 && st !== 'flee') { c.state = 'wander'; c.t = 1; } }
      else if (st === 'watch') { c.dir = Math.sign(dx) || 1; want = 0; c.state = 'wander'; c.t = Math.max(c.t, 0.5); c.idle = false; }
      else {
        c.state = 'wander'; if (c.t < 0) { c.t = rand(2, 6); c.dir = Math.random() < 0.5 ? -1 : 1; c.idle = Math.random() < (k.beast ? 0.6 : 0.35);
          if (c.herd) { let sx = 0, n = 0; for (const o of creatures) if (o.herd === c.herd) { sx += o.x; n++; } const cx = sx / n; if (Math.abs(c.x - cx) > (c.type === 'calf' ? 2.5 : 5)) { c.dir = Math.sign(cx - c.x); c.idle = false; } } }
        want = c.idle ? 0 : k.speed;
      }
    }
    if (c.agg && c.state === 'wander') { if (c.t < 0) { c.t = rand(2, 6); c.dir = Math.random() < 0.5 ? -1 : 1; c.idle = Math.random() < 0.35; } want = c.idle ? 0 : k.speed; }
    if (want < 0) { want = -want; c.back = true; } else c.back = false;
    const mv = c.back ? -c.dir : c.dir;
    c.vx += clamp(mv * want - c.vx, -14 * dt, 14 * dt);
    // the head follows the ground ahead; a wall taller than it can climb turns it round, or it climbs
    const ahead = groundY(c.x + c.vx * 0.12 + mv * 0.2, c.y, 1.4 + k.clear);
    if (ahead === null || ahead - c.y > 1.9) {
      c.stuck += dt; c.vx = 0;
      if (c.state === 'wander' || (c.state === 'flee' && !c.agg && c.stuck > 0.5 && dist > 6)) c.dir = -c.dir;
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
    if (k.beast) { drawBeast(b, c, k, time, fl); continue; }
    if (c.type === 'stalker') { drawStalker(b, c, k, time, fl); continue; }
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
    const e = (c.agg ? 0.25 : 0.1) + c.lit * 2.4; for (let s = 0; s < 2; s++) b.add(N[0].x + c.dir * (0.1 - s * 0.09), N[0].y + 0.07 + s * 0.02, 0.06, 0.06, 0, [e * 1.0, e * 0.85, e * 0.45], 1, 1, 2);
    if (c.lit > 0.5 && c.agg) b.add(N[0].x + c.dir * 0.06, N[0].y + 0.08, 0.5, 0.5, 0, [0.5, 0.4, 0.2], c.lit * 0.5, 1, 2);
  }
}

const mixn = (a, b, t) => a + (b - a) * t;
// the strider: a tall browser on four thin legs, swept horns with lit tips, a row of lights along the flank that
// brightens when it is alarmed. Its head is at the ground when it feeds and high when it watches.
function drawBeast(b, c, k, time, fl) {
  const N = c.nodes, d = c.dir, th = k.thick, body = mul(C.chitin, 1.7), dk = mul(C.chitin, 0.95), pl = 0.5 + 0.5 * Math.sin(time * 1.3 + c.seed), g = k.glow, a = N[k.legs[0]], z = N[k.legs[k.legs.length - 1]];
  for (const l of c.legs) { const hip = N[l.n], front = l.n === k.legs[0], hy = hip.y - th * 0.2, k1 = ik2(hip.x, hy, l.fx, l.fy, k.l1, k.l2, 1), k2 = ik2(hip.x, hy, l.fx, l.fy, k.l1, k.l2, -1), kn = ((k1[0] - hip.x) * d > (k2[0] - hip.x) * d) === front ? k1 : k2, col = l.s ? body : dk;
    b.seg(hip.x, hy, kn[0], kn[1], th * 0.3, col, 1, 2, 1, l.n, 0.45, 0, 0.5); b.seg(kn[0], kn[1], l.fx, l.fy, th * 0.17, col, 1, 2, 1, l.n + 3, 0.3, 0, 0.5); b.add(l.fx + d * 0.03, l.fy + 0.03, th * 0.24, 0.07, 0, dk, 1, 2, 1); }
  b.seg(z.x, z.y, a.x, a.y, th * 1.12, body, 1, 2, 1, 1, 0, th * 0.1, 0.7); b.add(a.x, a.y + th * 0.06, th * 1.3, th * 1.26, 0, body, 1, 2, 1, 2, 0, 0, 0.6); b.add(z.x, z.y + th * 0.02, th * 1.22, th * 1.2, 0, body, 1, 2, 1, 3, 0, 0, 0.6);
  const up = clamp(c.up * 1.25, 0, 1), nx = a.x + d * th * 0.45, ny = a.y + th * 0.25, hx = nx + d * (0.42 + (1 - up) * 0.3) * k.l1, hy = mixn(c.y - k.clear + 0.2, ny + k.l1 * 0.95, up) + (up < 0.3 ? Math.sin(time * 5 + c.seed) * 0.02 : 0);
  b.seg(nx, ny, hx, hy, th * 0.5, body, 1, 2, 1, 4, 0.5, -d * 0.06 * (1 - up), 0.7); b.seg(hx, hy, hx + d * th * 0.8, hy - th * 0.14, th * 0.38, body, 1, 2, 1, 5, 0.45, 0, 0.7);
  for (let s = 0; s < 2; s++) { const ex = hx - d * (0.5 + s * 0.12) * k.l1 * 0.8, ey = hy + (0.36 + s * 0.1) * k.l1 * 0.8; b.seg(hx - d * 0.02, hy + th * 0.1, ex, ey, 0.045, dk, 1, 2, 1, 6, 0.7, d * 0.08, 0.5); b.add(ex, ey, 0.06, 0.06, 0, mul(g, (1.2 + pl) * fl), 1, 1, 2); }
  const e = 0.12 + c.lit * 2.4; b.add(hx + d * th * 0.3, hy + th * 0.05, 0.055, 0.055, 0, [e, e * 0.85, e * 0.45], 1, 1, 2);
  const tl = N[N.length - 1]; b.seg(z.x - d * th * 0.4, z.y + th * 0.2, tl.x - d * th * 0.5, tl.y - th * 0.5 + Math.sin(time * 3 + c.seed) * 0.06, 0.05, dk, 1, 2, 1, 7, 0.7, -d * 0.06);
  for (let j = 0; j < 5; j++) { const t = j / 4, lx = mixn(a.x + d * th * 0.3, z.x - d * th * 0.3, t), ly = mixn(a.y, z.y, t) + th * (0.16 - 0.1 * Math.sin(t * 3.14)), k = (0.6 + pl * 0.6 + c.up * 1.3) * fl; b.add(lx, ly, 0.1, 0.07, 0, mul(g, k), 0.95, 2, 2); b.add(lx, ly, 0.34, 0.34, 0, mul(g, k * 0.2), 0.7, 1, 2); }
  b.seg(nx, ny + th * 0.1, hx - d * 0.1, hy + th * 0.1, 0.03, mul(g, (0.3 + c.up * 0.9) * fl), 0.8, 2, 2);
  if (c.up > 0.6) light.emit(a.x / TS, a.y / TS, g[0] * 0.1, g[1] * 0.1, g[2] * 0.1);
}
// the stalker: longer than you are tall, low, six legs, a ridge of spines, slits along the flank that burn when it
// charges, and eyes that catch the lamp from far away
function drawStalker(b, c, k, time, fl) {
  const N = c.nodes, d = c.dir, th = k.thick, body = mul(C.chitin, 1.15), hi = mul(C.chitin, 2.2), ch = c.state === 'charge' ? 1 : 0, pl = 0.5 + 0.5 * Math.sin(time * (1.3 + ch * 6) + c.seed), g = k.glow, prof = [0.62, 1.1, 1.0, 0.95, 0.85, 0.6, 0.36, 0.16];
  for (const l of c.legs) { const hip = N[l.n], k1 = ik2(hip.x, hip.y, l.fx, l.fy, k.l1, k.l2, 1), k2 = ik2(hip.x, hip.y, l.fx, l.fy, k.l1, k.l2, -1), kn = k1[1] > k2[1] ? k1 : k2, col = mul(body, l.s ? 1 : 0.55);
    b.seg(hip.x, hip.y, kn[0], kn[1], th * 0.27, col, 1, 2, 1, l.n, 0.35, 0, 0.6); b.seg(kn[0], kn[1], l.fx, l.fy, th * 0.17, col, 1, 2, 1, l.n + 2, 0.5, 0, 0.6); b.seg(l.fx, l.fy, l.fx + d * 0.16, l.fy + 0.02, 0.06, hi, 1, 2, 1); }
  for (let j = N.length - 1; j >= 1; j--) b.seg(N[j].x, N[j].y, N[j - 1].x, N[j - 1].y, th * prof[j] * (fl > 1 ? 1.05 : 1), body, 1, 2, 1, j, 0, 0, 0.85);
  for (let j = 1; j < 6; j++) { const y = N[j].y + th * prof[j] * 0.42; b.seg(N[j].x, y, N[j].x - d * 0.2, y + 0.32 - j * 0.035 + ch * 0.1, 0.07, hi, 1, 2, 1, j, 0.85, 0, 0.7); b.seg(N[j].x - 0.12, N[j].y - th * 0.04, N[j].x + 0.14, N[j].y - th * 0.1, 0.035, mul(g, (0.22 + pl * 0.4 + ch * 1.8) * fl), 0.9, 2, 2); }
  const hx = N[0].x, hy = N[0].y, open = 0.1 + ch * (0.28 + 0.14 * Math.sin(time * 14)) + (c.bite > 0.3 ? 0.3 : 0);
  b.seg(hx - d * 0.1, hy + 0.05, hx + d * 0.8, hy + 0.12, th * 0.6, body, 1, 2, 1, 0, 0.55, 0, 0.85); b.seg(hx, hy - 0.12, hx + d * 0.72, hy - 0.08 - open, th * 0.28, hi, 1, 2, 1, 1, 0.6, 0, 0.5);
  for (let s = 0; s < 3; s++) b.seg(hx + d * (0.3 + s * 0.14), hy - 0.06, hx + d * (0.33 + s * 0.14), hy - 0.06 - open * 0.5, 0.03, [0.3, 0.3, 0.28], 1, 2, 1);
  const e = 0.3 + c.lit * 2.6 + ch * 0.6; for (let s = 0; s < 3; s++) b.add(hx + d * (0.22 + s * 0.14), hy + 0.17 - s * 0.02, 0.055, 0.045, 0, [e, e * 0.55, e * 0.12], 1, 1, 2);
  if (c.lit > 0.4 || ch) b.add(hx + d * 0.3, hy + 0.14, 0.8, 0.5, 0, [0.6, 0.3, 0.08], 0.35 * Math.min(1, c.lit + ch * 0.5), 1, 2);
  light.emit(N[2].x / TS, N[2].y / TS, 0.14 * ch + 0.02, 0.02, 0.01);
}
// a herd of striders around x: adults and a calf or two, one herd id
let herdId = 1;
export function spawnHerd(x, n = 5) { const id = herdId++, out = []; for (let i = 0; i < n; i++) { const hx = x + (i - n / 2) * 1.7 + rand(-0.4, 0.4), g = world.groundY(hx, world.groundY(x, 40, 0, 80) + 4 || 6, 0, 12); if (g === null) continue; const type = i % 3 === 2 ? 'calf' : 'strider', c = spawnCreature(type, hx, g + KIND[type].clear); c.herd = id; c.idle = true; c.t = rand(1, 5); out.push(c); } return out; }

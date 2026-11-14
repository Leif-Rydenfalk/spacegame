// small life in the play plane, all of it wary and none of it saved: spores and motes that ride the wind, moths that
// circle the lights of the forest and scatter from the laser, and skitters, small ground animals that freeze, then
// bolt for cover when you come near. They are here so that nothing on screen is ever quite still.
import { rand, hash, clamp } from '../core.js';
import { world, TS } from './world.js';
import { biome } from './gen.js';
import { S, C, mul } from './state.js';
import { flora } from './flora.js';
import { wind, PAL } from './flora-gen.js';
const motes = [], moths = [], skit = [];
export const life = { motes, moths, skit };
function seed() {
  for (let i = 0; i < 110; i++) motes.push({ x: rand(-17, 17), y: rand(-9, 9), ph: Math.random() * 6.28, s: Math.random() < 0.12 ? rand(0.1, 0.2) : rand(0.022, 0.05), k: rand(0.5, 1.4) });
  for (let i = 0; i < 16; i++) moths.push({ x: 0, y: -99, hx: 0, hy: 0, home: 0, ph: Math.random() * 6.28, r: rand(0.5, 1.6), w: rand(1.2, 2.4), sx: 0, sy: 0 });
  for (let i = 0; i < 9; i++) skit.push({ x: 1e9, y: 0, v: 0, dir: 1, t: rand(0, 4), run: 0, ph: Math.random() * 6.28, hid: 0 });
}
export function stepLife(dt) {
  if (!motes.length) seed(); const cam = S.cam, P = S.P, t = S.lifeT = (S.lifeT || 0) + dt, scare = S.scare || 0;
  for (const m of motes) { const w = wind(cam.x + m.x, t); m.x += (w * 0.55 * m.k + Math.sin(t * 0.7 + m.ph) * 0.12) * dt; m.y += (0.05 + Math.sin(t * 0.5 + m.ph * 2) * 0.1) * m.k * dt;
    m.x -= (cam.x - (m.cx ?? cam.x)); m.y -= (cam.y - (m.cy ?? cam.y)); m.cx = cam.x; m.cy = cam.y; if (m.x > 17) m.x -= 34; else if (m.x < -17) m.x += 34; if (m.y > 9) m.y -= 18; else if (m.y < -9) m.y += 18; }
  // moths: each keeps to one light; when that light is gone or far, it finds another
  const act = flora.active;
  for (const m of moths) {
    m.home -= dt; if (m.home <= 0 || Math.abs(m.hx - cam.x) > 20) { m.home = rand(6, 16); for (let k = 0; k < 8 && act.length; k++) { const p = act[Math.floor(Math.random() * act.length)]; if (p.gen.lights.length && !p.gone && Math.abs(p.x - cam.x) < 16) { m.hx = p.x + p.gen.lights[0]; m.hy = p.y + p.gen.lights[1]; if (m.y < -90) { m.x = m.hx; m.y = m.hy; } break; } } }
    const tx = m.hx + Math.cos(t * m.w + m.ph) * m.r + Math.sin(t * 3.1 + m.ph) * 0.2, ty = m.hy + Math.sin(t * m.w * 1.3 + m.ph * 2) * m.r * 0.6;
    if (scare > 0.5) { m.sx += (Math.random() - 0.5) * 40 * dt; m.sy += rand(0, 30) * dt; } m.sx *= 1 - Math.min(1, dt * 1.2); m.sy *= 1 - Math.min(1, dt * 1.2);
    m.x += ((tx - m.x) * 2.2 + m.sx) * dt; m.y += ((ty - m.y) * 2.2 + m.sy) * dt;
  }
  // skitters
  for (const k of skit) {
    if (Math.abs(k.x - cam.x) > 22 || k.hid > 0) { k.hid -= dt; if (k.hid > 0) continue; const x = cam.x + (Math.random() < 0.5 ? -1 : 1) * rand(9, 18), g = world.groundY(x, cam.y + 5, 0, 14); if (g === null || Math.abs(x - P.x) < 7) { k.hid = 1; continue; } k.x = x; k.y = g; k.v = 0; k.run = 0; k.t = rand(1, 4); }
    const d = k.x - P.x, near = Math.abs(d) < 4.6 && Math.abs(k.y - P.y) < 3;
    if ((near || scare > 0.7) && k.run <= 0) { k.run = rand(1.2, 2.2); k.dir = Math.sign(d) || 1; k.freeze = near ? 0.18 : 0; }
    if (k.run > 0) { if (k.freeze > 0) { k.freeze -= dt; k.v = 0; } else { k.run -= dt; k.v += (k.dir * 5.5 - k.v) * Math.min(1, dt * 9); if (k.run <= 0) k.hid = Math.abs(d) < 9 ? rand(3, 8) : 0; } }
    else { k.t -= dt; if (k.t < 0) { k.t = rand(0.6, 3.5); k.dir = Math.random() < 0.5 ? -1 : 1; k.idle = Math.random() < 0.6; } k.v += ((k.idle ? 0 : k.dir * 0.7) - k.v) * Math.min(1, dt * 5); }
    const nx = k.x + k.v * dt, g = world.groundY(nx, k.y + 0.6, 0, 2.5); if (g === null || Math.abs(g - k.y) > 0.5) { k.dir = -k.dir; k.v = 0; if (k.run > 0) k.hid = rand(2, 5); } else { k.x = nx; k.y = g; }
  }
}
export function drawLife(b, time) {
  const cam = S.cam, t = S.lifeT || 0, g = PAL[biome(cam.x)].g;
  for (const m of motes) { const x = cam.x + m.x, y = cam.y + m.y; if (m.s < 0.06 && world.solidAt(x, y)) continue; const tw = 0.5 + 0.5 * Math.sin(t * (1 + m.k) + m.ph * 3); b.add(x, y, m.s, m.s, 0, mul(g, m.s > 0.06 ? 0.5 : 1.7), (m.s > 0.06 ? 0.22 : 0.9) * tw, 1, 2); }
  for (const m of moths) { if (m.y < -90) continue; const f = Math.sin(time * 34 + m.ph), dx = Math.cos(t * m.w + m.ph) > 0 ? 1 : -1;
    for (const s of [-1, 1]) b.seg(m.x, m.y, m.x - dx * 0.03 + s * 0.02, m.y + 0.07 * f * s + 0.03, 0.035, [0.1, 0.12, 0.13], 0.9, 2, 1);
    b.add(m.x, m.y, 0.035, 0.035, 0, [1.8, 1.5, 0.9], 0.9, 1, 2); b.add(m.x, m.y, 0.2, 0.2, 0, [0.5, 0.4, 0.2], 0.3, 1, 2); }
  for (const k of skit) { if (k.hid > 0 || Math.abs(k.x - cam.x) > 20) continue; const d = k.v >= 0 ? (Math.abs(k.v) < 0.05 ? k.dir : 1) : -1, ph = k.x * 16, y = k.y + 0.09, body = [0.03, 0.034, 0.04];
    for (let j = 0; j < 3; j++) { const lx = k.x + (j - 1) * 0.09 * d, sw = Math.sin(ph + j * 2.1) * 0.05 * Math.min(1, Math.abs(k.v)); b.seg(lx, y, lx + sw + 0.03 * d, k.y, 0.018, body, 1, 2, 1); }
    b.seg(k.x - d * 0.14, y, k.x + d * 0.14, y + 0.02, 0.09, body, 1, 2, 1, 1, 0.3, 0, 0.6); b.seg(k.x - d * 0.14, y, k.x - d * 0.36, y + 0.03 + Math.sin(time * 6 + k.ph) * 0.02, 0.03, body, 1, 2, 1, 2, 0.8);
    b.seg(k.x + d * 0.13, y + 0.03, k.x + d * 0.2, y + 0.14, 0.012, body, 1, 2, 1); b.add(k.x + d * 0.15, y + 0.04, 0.03, 0.03, 0, [0.9, 0.8, 0.4], 0.9, 1, 2); b.add(k.x - d * 0.03, y + 0.04, 0.035, 0.03, 0, mul(g, 1.1), 0.8, 1, 2); }
}

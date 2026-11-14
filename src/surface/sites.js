// what stands in the ruins, the hives and the human facilities: glyph lights, lore stones, terminals, audio logs,
// supply caches, emergency lights, dead sentries and turrets, egg sacs, the hive heart. Draws them, lets the player
// use them, and keeps their state (read, looted, dark, hatched), which is saved.
import { events, rand, rng, hash } from '../core.js';
import { audio } from '../audio.js';
import { TS } from './world.js';
import { light } from './light.js';
import { S, C, mul } from './state.js';
import { makeInv, inv } from '../items.js';
import { structsIn } from './structures.js';
import { lore } from '../hud.js';
import { spawnCreature } from './creatures.js';

export const sites = { st: {}, near: null, hint: '', inside: null };
const stOf = id => sites.st[id] || (sites.st[id] = { read: {}, loot: {}, hatched: {}, dark: false, dead: false, hp: 600 });
export const siteState = stOf;
const live = [];      // caches whose inventory exists in memory; written back into the site state on save
const LOOT = {
  ruin: [['xeno shard', 6, 14], ['lumen', 4, 10], ['xeno core', 1, 1]],
  supply: [['rifle rounds', 60, 150], ['shells', 12, 30], ['o2 cell', 1, 2], ['power cell', 1, 2], ['iron', 20, 50]],
  armory: [['rifle rounds', 180, 240], ['shells', 36, 60], ['power cell', 2, 3], ['iron', 30, 60], ['copper', 10, 20]],
  lab: [['lumen', 8, 14], ['copper', 20, 40], ['power cell', 2, 3], ['o2 cell', 2, 3], ['xeno core', 1, 1]],
};
function cacheInv(p) {
  const st = stOf(p.site.id); if (p.inv) return p.inv; p.inv = makeInv(12); live.push(p);
  if (st.loot[p.i]) inv.load(p.inv, st.loot[p.i]);
  else { const r = rng(Math.floor(hash(p.site.slot, p.i, 72) * 1e9)); for (const [id, a, b] of LOOT[p.loot]) { const n = a + r() * (b - a); inv.add(p.inv, id, id.includes('rounds') || id === 'shells' || a === b || id.includes('cell') ? Math.round(n) : +n.toFixed(1)); } }
  return p.inv;
}
const USE = { xterm: 'e  read the stone', terminal: 'e  read terminal', audiolog: 'e  play audio log', cache: 'e  open cache' };
export function stepSites(dt) {
  const P = S.P; sites.near = null; sites.hint = ''; sites.inside = null; let bd = 2.2;
  for (const st of structsIn(P.x - 30, P.x + 30)) {
    const s = stOf(st.id);
    if (P.x > st.x0 + 4 && P.x < st.x1 - 4 && P.y > st.y0 - 2 && P.y < st.y1) { sites.inside = st; if (!s.seen) { s.seen = true; events.emit(st.kind === 'ruin' ? 'ruinFound' : st.kind === 'hive' ? 'hiveFound' : st.research ? 'labFound' : 'baseFound', st); } }
    for (const p of st.props) {
      const d = Math.hypot(p.x - P.x, p.y + 0.6 - P.y - 0.9);
      if (USE[p.t] && d < bd) { bd = d; sites.near = p; sites.hint = USE[p.t]; }
      if (p.t === 'egg' && !s.hatched[p.i] && d < 6 && !s.dead) { s.hatched[p.i] = 1; spawnCreature('swarmer', p.x, p.y + 0.4).order = 'attack'; audio.play('bite'); events.emit('eggHatched'); for (let i = 0; i < 12; i++) S.parts.spawn({ x: p.x, y: p.y + 0.3, vx: rand(-3, 3), vy: rand(0, 5), life: rand(0.5, 1.5), size: rand(0.05, 0.1), c: mul(C.acid, 2), c2: mul(C.acid, 0.3), col: 1, bounce: 0.1 }); }
    }
  }
}
// E on the nearest prop; returns true when something was used
export function siteUse() {
  const p = sites.near; if (!p) return false; const st = stOf(p.site.id), kind = p.site.kind === 'ruin' ? 'ruin' : p.site.research ? 'lab' : 'base';
  if (p.t === 'cache') { S.open = { kind: 'cache', inv: cacheInv(p), prop: p, x: p.x / TS - 1, y: p.y / TS, w: 2, h: 2, title: p.loot === 'ruin' ? 'vault casket' : 'supply cache' }; S.uiOpen = true; audio.play('click'); if (!st.read['c' + p.i]) { st.read['c' + p.i] = 1; events.emit('cacheOpened', p.loot); } return true; }
  const key = p.t === 'audiolog' ? 'audio' : p.t === 'xterm' ? 'stone' : 'terminal';
  lore(kind, key, p.n + Math.abs(p.site.slot) * 2); st.read[p.i] = 1; audio.play('click'); events.emit(key === 'stone' ? 'stoneRead' : key === 'audio' ? 'audioLog' : 'terminalRead', p.site.id); return true;
}
// the laser reaches the heart of a hive
export function siteDamage(x, y, dmg) {
  for (const st of structsIn(x - 2, x + 2)) if (st.kind === 'hive') { const s = stOf(st.id), h = st.props[1]; if (!s.dead && Math.hypot(h.x - x, h.y - y) < 1.5) { s.hp -= dmg; s.hurt = 0.15; if (s.hp <= 0) { s.dead = true; events.emit('hiveHeartKilled', st.id); S.loose('ichor', 18, h.x, h.y); S.loose('xeno core', 1, h.x, h.y); audio.play('groan'); for (let i = 0; i < 80; i++) S.parts.spawn({ x: h.x + rand(-1, 1), y: h.y + rand(-1, 1), vx: rand(-6, 6), vy: rand(-2, 8), life: rand(1, 4), size: rand(0.05, 0.14), c: mul(C.acid, 2.4), c2: mul(C.hot, 0.4), col: 1, bounce: 0.1 }); } return true; } }
  return false;
}
export function drawSites(b, time) {
  const cam = S.cam, pl = 0.5 + 0.5 * Math.sin(time * 0.9);
  const zo = Math.min(S.zo, 4);
  for (const st of structsIn(cam.x - 24 / S.zoom * zo, cam.x + 24 / S.zoom * zo)) {
    const s = stOf(st.id), dark = s.dark, hdead = s.dead;
    for (const p of st.props) {
      if (Math.abs(p.x - cam.x) > 22 / S.zoom * zo || Math.abs(p.y - cam.y) > 16 * zo) continue;
      const x = p.x, y = p.y, ph = p.i * 1.7, read = s.read[p.i];
      if (p.t === 'glyph') { const k = 0.55 + 0.45 * Math.sin(time * 0.6 + ph), c = mul(C.xeno, 1.6 * k); b.add(x, y, 1.5, 1.5, 0, mul(C.xeno, 0.22 * k), 1, 1, 2);
        for (let i = 0; i < 4; i++) { const a = (p.k * 1.1 + i * 1.57), r1 = 0.08 + ((p.k + i) % 3) * 0.06; b.seg(x + Math.cos(a) * r1, y + Math.sin(a) * r1 + (i - 1.5) * 0.12, x + Math.cos(a + 1.2) * 0.2, y + Math.sin(a + 1.2) * 0.1 + (i - 1.5) * 0.12, 0.028, c, 1, 0, 2); }
        b.add(x, y, 0.42, 0.42, 0, c, 0.5, 4, 2); light.emit(x / TS, y / TS, 0.2 * k, 0.3 * k, 0.42 * k); }
      else if (p.t === 'xterm') { b.seg(x, y - 0.1, x, y + 0.75, 0.3, [0.07, 0.075, 0.095], 1, 2, 1, 3); b.add(x, y + 0.9, 0.4, 0.08, 0, [0.09, 0.1, 0.12], 1, 2, 1); const k = read ? 0.35 : 0.8 + 0.2 * Math.sin(time * 2 + ph);
        b.add(x, y + 1.3 + Math.sin(time * 1.1 + ph) * 0.05, 0.34, 0.34, time * 0.4, mul(C.xeno, 2 * k), 0.9, 4, 2); b.add(x, y + 1.3, 0.1, 0.1, 0, mul(C.xeno, 3 * k), 1, 1, 2); b.add(x, y + 1.3, 1.3, 1.3, 0, mul(C.xeno, 0.3 * k), 1, 1, 2); light.emit(x / TS, (y + 1.3) / TS, 0.25 * k, 0.38 * k, 0.5 * k); }
      else if (p.t === 'cache') { const alien = p.loot === 'ruin', open = s.read['c' + p.i]; b.add(x, y + 0.26, 0.95, 0.52, 0, alien ? [0.07, 0.075, 0.095] : mul(C.steel, 0.6), 1, 0, 1, 4); b.add(x, y + 0.54, 1.0, 0.08, open ? 0.12 : 0, alien ? [0.1, 0.11, 0.13] : C.dark, 1, 0, 1);
        b.add(x, y + 0.3, 0.6, 0.04, 0, alien ? mul(C.xeno, open ? 0.5 : 2) : mul(C.amber, open ? 0.4 : 2), 1, 0, 2); if (!open) light.emit(x / TS, (y + 0.5) / TS, alien ? 0.08 : 0.25, alien ? 0.12 : 0.12, alien ? 0.16 : 0.03); }
      else if (p.t === 'terminal') { const on = !dark, k = on ? (read ? 0.5 : 0.9 + 0.1 * Math.sin(time * 9 + ph)) : (Math.sin(time * 1.3 + ph) > 0.93 ? 0.5 : 0.03); b.add(x, y + 0.45, 0.5, 0.9, 0, mul(C.steel, 0.5), 1, 0, 1, 5); b.add(x, y + 1.05, 0.62, 0.42, 0, C.dark, 1, 0, 1, 2);
        b.add(x, y + 1.05, 0.5, 0.3, 0, mul(C.amber, 0.7 * k), 1, 0, 2); for (let i = 0; i < 3; i++) b.add(x - 0.08, y + 1.13 - i * 0.07, 0.26 - i * 0.05, 0.015, 0, mul(C.amber, 2 * k), 1, 0, 2); light.emit(x / TS, (y + 1.1) / TS, 0.3 * k, 0.15 * k, 0.03 * k); }
      else if (p.t === 'audiolog') { const k = read ? 0.2 : Math.sin(time * 5 + ph) > 0 ? 1 : 0.1; b.add(x, y + 0.5, 0.42, 0.06, 0, mul(C.steel, 0.6), 1, 0, 1); b.add(x, y + 0.26, 0.05, 0.5, 0, C.dark, 1, 0, 1); b.add(x, y + 0.58, 0.2, 0.1, 0, C.dark, 1, 0, 1, 3); b.add(x + 0.06, y + 0.6, 0.04, 0.04, 0, mul(C.acid, 2.5 * k), 1, 1, 2); }
      else if (p.t === 'elight') { if (!dark) { const a = time * 4 + ph, k = 0.55 + 0.45 * Math.sin(a); b.add(x, y, 0.2, 0.12, 0, mul(C.red, 3 * k), 1, 2, 2); b.add(x, y - 0.2, 2.6, 2.0, 0, mul(C.red, 0.35 * k), 1, 1, 2); b.add(x + Math.cos(a) * 0.9, y - 0.5, 1.8, 0.5, Math.cos(a) * 0.5, mul(C.red, 0.25), 0.7, 1, 2); light.emit(x / TS, (y - 0.5) / TS, 1.5 * k, 0.07 * k, 0.04 * k); } else b.add(x, y, 0.2, 0.12, 0, C.dark, 1, 2, 1); }
      else if (p.t === 'turret') { b.seg(x - 0.3, y, x, y + 0.6, 0.06, C.steel, 1, 0, 1); b.seg(x + 0.3, y, x, y + 0.6, 0.06, C.steel, 1, 0, 1); b.add(x, y + 0.72, 0.42, 0.3, 0, mul(C.steel, 0.7), 1, 0, 1, 6); b.seg(x, y + 0.72, x + 0.75, y + 0.38, 0.09, C.dark, 1, 0, 1); b.add(x - 0.1, y + 0.8, 0.04, 0.04, 0, mul(C.red, Math.sin(time * 1.7 + ph) > 0.96 ? 3 : 0.15), 1, 1, 2);
        if (Math.random() < 0.004) S.parts.spawn({ x: x + 0.2, y: y + 0.6, vx: rand(-2, 2), vy: rand(0, 3), life: rand(0.2, 0.5), size: 0.03, c: [3, 3.5, 5], col: 1 }); }
      else if (p.t === 'sentry') { b.seg(x - 0.6 * p.f, y + 0.14, x + 0.25 * p.f, y + 0.16, 0.3, mul(C.suit, 0.7), 1, 2, 1, 2); b.seg(x - 0.6 * p.f, y + 0.12, x - 1.25 * p.f, y + 0.1, 0.16, mul(C.suit, 0.55), 1, 2, 1); b.add(x + 0.52 * p.f, y + 0.17, 0.32, 0.3, 0, mul(C.suit, 0.9), 1, 2, 1); b.add(x + 0.58 * p.f, y + 0.2, 0.12, 0.1, 0, mul(C.amber, 0.12), 1, 2, 2); b.seg(x + 0.1, y + 0.3, x + 0.9 * p.f, y + 0.06, 0.06, C.dark, 1, 0, 1); }
      else if (p.t === 'door') { for (let i = 0; i < 4; i++) b.add(x, y + 0.3 + i * 0.6, 0.3, 0.12, 0.5, [0.35, 0.22, 0.02], 0.9, 0, 1, i); b.add(x, y + p.h + 0.15, 0.1, 0.1, 0, mul(C.red, dark ? 0.2 : 2.5), 1, 1, 2); }
      else if (p.t === 'breach') { for (let i = 0; i < 7; i++) { const a = i * 0.9 + ph, l = 0.8 + (i % 3) * 0.5; b.seg(x + Math.cos(a) * 0.9, y + Math.sin(a) * 1.3, x + Math.cos(a + 0.4) * (0.9 + l), y + Math.sin(a + 0.3) * (1.3 + l * 0.5), 0.12 - i * 0.008, mul(C.flesh, 0.9), 1, 2, 1, i); } b.add(x, y, 2.4, 2.4, 0, mul(C.acid, 0.12 + 0.06 * pl), 1, 1, 2); light.emit(x / TS, y / TS, 0.05, 0.16, 0.01); }
      else if (p.t === 'mast') { b.seg(x, y, x, y + 6, 0.06, C.steel, 1, 0, 1); b.seg(x - 0.5, y + 4.6, x + 0.5, y + 4.6, 0.04, C.steel, 1, 0, 1); if (!dark) { const k = Math.sin(time * 2 + ph) > 0.7 ? 1 : 0.05; b.add(x, y + 6.05, 0.1, 0.1, 0, mul(C.red, 3 * k), 1, 1, 2); b.add(x, y + 6.05, 1.2, 1.2, 0, mul(C.red, 0.3 * k), 1, 1, 2); } }
      else if (p.t === 'sign') { b.add(x, y, 1.5, 0.36, 0, [0.16, 0.13, 0.04], 1, 0, 1, 8); for (let i = 0; i < 5; i++) b.add(x - 0.5 + i * 0.25, y, 0.16, 0.05 + (i * 7 % 3) * 0.05, 0, C.dark, 1, 0, 1); }
      else if (p.t === 'tank') { const live = !dark, g = p.k === 1 ? C.acid : C.cyan, k = live ? 0.7 + 0.3 * Math.sin(time * 1.2 + ph) : 0.03; b.add(x, y + 0.1, 0.8, 0.2, 0, mul(C.steel, 0.6), 1, 0, 1); b.add(x, y + 2.0, 0.8, 0.16, 0, mul(C.steel, 0.6), 1, 0, 1); b.seg(x, y + 0.4, x, y + 1.7, 0.6, mul(g, 0.14 * k + 0.004), 0.9, 2, 2); b.seg(x + Math.sin(time + ph) * 0.03, y + 0.7, x, y + 1.4, 0.2, [0.01, 0.012, 0.014], 0.9, 2, 0); if (live) { b.add(x, y + 1.1, 1.8, 2.2, 0, mul(g, 0.14 * k), 1, 1, 2); light.emit(x / TS, (y + 1.1) / TS, g[0] * 0.4 * k, g[1] * 0.4 * k, g[2] * 0.4 * k); } }
      else if (p.t === 'egg') { if (s.hatched[p.i]) { b.add(x, y, 0.5 * p.s, 0.3 * p.s, 0, mul(C.flesh, 0.5), 1, 8, 1, p.i); continue; } const k = hdead ? 0.1 : 0.6 + 0.4 * Math.sin(time * 1.6 + ph); b.add(x, y, 0.55 * p.s, 1.3 * p.s, 0, mul(C.flesh, 0.9), 1, 8, 1, p.i); b.add(x, y + 0.28 * p.s, 0.28 * p.s, 0.4 * p.s, 0, mul(C.acid, 1.1 * k), 0.8, 2, 2); b.add(x, y + 0.3, 1.2, 1.2, 0, mul(C.acid, 0.12 * k), 1, 1, 2); if (p.i % 2 === 0) light.emit(x / TS, (y + 0.4) / TS, 0.07 * k, 0.22 * k, 0.01); }
      else if (p.t === 'mouth') { const k = hdead ? 0.1 : 0.5 + 0.3 * pl; b.add(x, y, 3.4, 2.2, 0, mul(C.acid, 0.12 * k), 1, 1, 2); for (let i = 0; i < 6; i++) { const d = i < 3 ? -1 : 1, a = 0.4 + (i % 3) * 0.35; b.seg(x + d * 1.25, y - 0.1, x + d * (1.25 - Math.cos(a) * 0.9), y + 0.3 + Math.sin(a) * 1.3 + Math.sin(time * 1.3 + i) * 0.05, 0.16 - (i % 3) * 0.03, mul(C.flesh, 1.1), 1, 2, 1, i); } light.emit(x / TS, y / TS, 0.06 * k, 0.2 * k, 0.01);
        if (!hdead && Math.random() < 0.06) S.parts.spawn({ x: x + rand(-0.8, 0.8), y, vx: rand(-0.2, 0.2), vy: rand(0.2, 0.7), life: rand(3, 7), size: rand(0.03, 0.06), c: mul(C.acid, 1.4), grav: -0.004, drag: 0.4 }); }
      else if (p.t === 'heart') { const beat = hdead ? 0 : Math.pow(Math.max(0, Math.sin(time * 2.2)), 6), k = hdead ? 0.04 : 0.6 + beat, fl = s.hurt > 0 ? 3 : 1; if (s.hurt > 0) s.hurt -= 0.016;
        for (let i = 0; i < 8; i++) { const a = i * 0.785 + 0.3; b.seg(x, y, x + Math.cos(a) * 3.2, y + Math.sin(a) * 2.2 + 0.4, 0.2, mul(C.flesh, 0.8), 1, 2, 1, i); b.seg(x, y, x + Math.cos(a) * 2.6, y + Math.sin(a) * 1.8 + 0.4, 0.05, mul(C.acid, 0.6 * k), 0.8, 2, 2); }
        b.add(x, y, 1.9 + beat * 0.15, 1.6 + beat * 0.15, 0, mul(C.flesh, 1.3 * fl), 1, 2, 1, 5); b.add(x, y, 1.1, 0.9, 0, mul(C.hot, 0.9 * k * fl), 0.85, 2, 2); b.add(x, y, 5, 4, 0, mul(C.hot, 0.16 * k), 1, 1, 2); light.emit(x / TS, y / TS, 1.1 * k, 0.2 * k, 0.05 * k); }
    }
  }
}
export function dumpSites() { const o = {}; for (const p of live) stOf(p.site.id).loot[p.i] = inv.dump(p.inv); for (const k in sites.st) { const s = sites.st[k]; o[k] = { read: s.read, loot: s.loot, hatched: s.hatched, dark: s.dark, dead: s.dead, hp: s.hp, seen: s.seen }; } return o; }
export function loadSites(o) { sites.st = {}; for (const p of live) p.inv = null; live.length = 0; for (const k in o || {}) sites.st[k] = { read: {}, loot: {}, hatched: {}, ...o[k] }; }

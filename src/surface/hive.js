// the hivemind. Hives under the ground sense pollution and noise; the more of both, the higher their alert, and the
// more and larger the waves they send, toward the loudest thing they hear. Over time, and faster in a polluted
// world, the hivemind spreads and one human facility after another goes dark. All of it is world state and is saved.
import { events, hash, rand, rng, clamp, lerp } from '../core.js';
import { audio } from '../audio.js';
import { world, M } from './world.js';
import { S } from './state.js';
import { env } from './env.js';
import { structsIn } from './structures.js';
import { creatures, spawnCreature, spawnHerd } from './creatures.js';
import { siteState } from './sites.js';

export const hive = { alert: {}, timer: {}, hurt: {}, spread: 0, waves: 0, tick: 0, fauna: 2, near: null, quiet: false, level: 0, lost: 0 };
// the hive learns: every body it loses to you counts, and at thirty, ninety and two hundred it grows a bigger caste
events.on('kill', t => { if (t === 'scout' || t === 'swarmer' || t === 'soldier' || t === 'spitter' || t === 'flier' || t === 'brute' || t === 'burrower') { hive.lost++; hive.level = hive.lost >= 200 ? 3 : hive.lost >= 90 ? 2 : hive.lost >= 30 ? 1 : 0; } });
export const PROBE_BELOW = 24;
// a probe that comes home has seen you, or it has not; a hive animal that is hurt tells the hive at once
events.on('probeReturned', q => { hive.alert[q.site] = clamp((hive.alert[q.site] || 0) + (q.saw ? 8 : 2), 0, 100); if (q.saw) events.emit('hiveKnows', q.site); });
events.on('hiveHurt', c => { const id = c.home && c.home.id; if (id) { hive.alert[id] = clamp((hive.alert[id] || 0) + 1.2, 0, 100); hive.hurt[id] = true; /* round 6: one body in a wave of thirty, not one in three */ } });
// pure: what a wave is made of at a given alert (0..100) and escalation level (0..3); r is a random source.
// Round 6 H: the bodies are small and the threat is their number. A wave is tens of workers and scouts; soldiers come
// with alert; the armoured castes (the big brute, the burrower that comes through rock) only once the hive has learnt
// that it needs them (level, which rises with every wave you break).
export function waveOf(a, r = Math.random, level = 0) {
  const n = clamp(Math.round(3 + a * 0.3 + level * 8), 3, 54), out = [];
  for (let i = 0; i < n; i++) { const q = r(); out.push(a < 15 ? (q < 0.3 ? 'scout' : 'swarmer') : a < 35 ? (q < 0.2 ? 'scout' : q < 0.9 ? 'swarmer' : 'soldier') : a < 55 ? (q < 0.12 ? 'scout' : q < 0.72 ? 'swarmer' : q < 0.84 ? 'soldier' : q < 0.93 ? 'spitter' : 'flier') : (q < 0.08 ? 'scout' : q < 0.62 ? 'swarmer' : q < 0.78 ? 'soldier' : q < 0.87 ? 'spitter' : q < 0.95 ? 'flier' : level >= 2 ? (q < 0.98 ? 'brute' : 'burrower') : 'soldier')); }
  return out;
}
export const CAP = 46;                        // bodies alive at once (the frame rate's limit, not the hive's)
export const waveEvery = a => lerp(150, 40, clamp(a / 100, 0, 1));       // seconds between waves
export function sendWave(st, a) {
  const P = S.P, [mx, my] = st.mouth, h = env.heard(mx, my, 2.2), goal = h ? { x: h.x, y: h.y } : { x: P.x, y: P.y + 1 }, list = waveOf(a, Math.random, hive.level | 0);
  // a stirring hive does not attack: it sends scouts to look at what made the noise, and they go home to tell.
  // Only an alert hive, or one that has been hurt, answers with a wave.
  const probe = a < PROBE_BELOW && !hive.hurt[st.id];
  let n = 0; for (const t of probe ? (a < 12 ? ['scout'] : ['scout', 'scout']) : list) { if (creatures.length >= CAP) break; const fly = t === 'flier', c = spawnCreature(t, mx + rand(-1.5, 1.5), my + (fly ? rand(2, 5) : t === 'burrower' ? -3 : 0.7), { ...goal }); c.order = probe ? 'probe' : 'attack'; c.home = { x: mx, y: my, id: st.id }; c.state = 'seek'; n++; }
  hive.waves++; events.emit(probe ? 'hiveProbe' : 'hiveWave', { id: st.id, n }); if (Math.abs(mx - P.x) < 60) audio.play('call'); return n;
}
function fallDark(st) {
  const s = siteState(st.id); s.dark = true; const r = rng(st.slot * 977 + 5), [bx, by] = st.breach, [dx] = st.door;
  for (let i = 0; i < 9; i++) world.fill(bx + (r() - 0.5) * 7, st.g + r() * 3.4, 0.35 + r() * 0.5, M.HIVE, 0);
  for (let i = 0; i < 4; i++) world.fill(dx + (r() - 0.5) * 3, st.g + r() * 2.6, 0.3 + r() * 0.3, M.HIVE, 0);
  events.emit('facilityDark', st.id); S.say('a facility has gone dark', 5);
}
export function stepHive(dt) {
  const P = S.P; hive.spread += dt * (1 / 2700 + Math.min(env.total(), 4000) * 4e-7);
  hive.tick += dt; if (hive.tick < 1) return; hive.tick -= 1; hive.near = null; let nd = 1e9;
  for (const st of structsIn(P.x - 260, P.x + 260)) {
    const s = siteState(st.id);
    if (st.kind === 'hive' && !s.dead) {
      const [mx, my] = st.mouth, h = env.heard(mx, my, 2.6), poll = env.pollAround(mx, my, 72), a0 = hive.alert[st.id] || 0;
      const a = hive.alert[st.id] = clamp(a0 + poll * 0.012 + (h ? 0.25 + Math.min(h.v, 80) * 0.01 : 0) - 0.07, 0, 100);
      const d = Math.abs(mx - P.x); if (d < nd) { nd = d; hive.near = { id: st.id, a, d, x: mx }; }
      hive.timer[st.id] = (hive.timer[st.id] === undefined ? 20 : hive.timer[st.id]) - 1;
      if (hive.timer[st.id] <= 0 && a > 6 && !hive.quiet) { hive.timer[st.id] = waveEvery(a); sendWave(st, a); }
    } else if (st.kind === 'base' && !s.dark && hive.spread > 0.1 + hash(st.slot, 5, 71) * 0.85) fallDark(st);
  }
  // the natives: grazers and jellies wander in from the edges while it is calm
  hive.fauna -= 1; S.calm -= 1;
  if (hive.fauna <= 0) { hive.fauna = 5; let nat = 0; for (const c of creatures) if (c.type === 'grazer' || c.type === 'jelly') nat++;
    if (nat < 4 && creatures.length < 26 && !hive.quiet) { const x = P.x + (Math.random() < 0.5 ? -1 : 1) * rand(24, 36), g = world.groundY(x, P.y + 8, 0, 26), r = Math.random(); if (g !== null && !world.solidAt(x, g + 1.5)) { if (r < 0.3 && !creatures.some(c => c.herd)) spawnHerd(x, 4 + Math.floor(Math.random() * 3)); else if (r > 0.93 && Math.abs(P.x) > 70 && !creatures.some(c => c.type === 'stalker')) spawnCreature('stalker', x, g + 1); else spawnCreature(r < 0.65 ? 'grazer' : 'jelly', x, g + (r < 0.65 ? 0.7 : 2.8)); } } }
}
export function dumpHive() { const al = {}; for (const k in hive.alert) al[k] = +hive.alert[k].toFixed(2); return { alert: al, spread: +hive.spread.toFixed(5), waves: hive.waves, lost: hive.lost }; }
export function loadHive(o) { hive.alert = { ...(o && o.alert) }; hive.timer = {}; hive.hurt = {}; hive.spread = o ? o.spread : 0; hive.waves = o ? o.waves : 0; hive.lost = (o && o.lost) || 0; hive.level = hive.lost >= 200 ? 3 : hive.lost >= 90 ? 2 : hive.lost >= 30 ? 1 : 0; }

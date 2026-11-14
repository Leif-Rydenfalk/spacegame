// boot, fixed 120 Hz step, variable render, act switching, dev menu.
import { G, input, initInput, events } from './core.js';
import { R, initRender, renderFrame } from './render.js';
import { drawBeats } from './hud.js';
import { surface } from './surface/index.js';
import { space, Sp } from './space/index.js';
import { runTests } from './test.js';

const acts = { surface, space }, DT = 1 / 120, frames = [];
let acc = 0, last = 0, showLog = false, started = { surface: false, space: false };
G.switchAct = (name, data) => { G.act = name; if (!started[name]) { started[name] = true; acts[name].start(G.scenario, data); } else if (acts[name].enter) acts[name].enter(data); };
const SCN = [['surface, crash site at night', '?act=surface'], ['surface, factory running', '?act=surface&scenario=factory&t=30'], ['launch at 40 km', '?act=space&scenario=launch'], ['space, 220 km orbit', '?act=space'], ['space, belt mining', '?act=space&scenario=mining'], ['space, combat at the depot', '?act=space&scenario=combat'], ['space, hangar', '?act=space&scenario=builder'], ['property tests', '?test=1']];
function devMenu() {
  const d = document.getElementById('dev'); if (d.style.display === 'block') { d.style.display = 'none'; return; }
  d.innerHTML = '<div>dev menu (F1)</div>' + SCN.map(([n, u]) => `<a href="${u}&seed=${G.seed}">${n}</a>`).join('') + `<div>seed <input id="seed" value="${G.seed}"></div><div>, . time warp in space &nbsp; L story log</div>`;
  d.style.display = 'block'; d.querySelector('#seed').onchange = e => { const q = new URLSearchParams(location.search); q.set('seed', e.target.value); location.search = q.toString(); };
}
function frame(now) {
  requestAnimationFrame(frame);
  const real = Math.min(0.1, (now - last) / 1000); if (last) frames.push(now - last); if (frames.length > 1200) frames.shift(); last = now; G.real += real;
  if (input.hit('F1')) devMenu(); if (input.hit('l')) showLog = !showLog;
  const act = acts[G.act];
  if (!G.paused) { acc += real; let n = 0; while (acc >= DT && n < 12) { acc -= DT; n++; G.time += DT; acts[G.act].step(DT); input.endFrame(); } if (n === 12) acc = 0; if (!n) input.wheel = input.wheel; }
  const flash = acts[G.act].draw(G.real) || 0;
  renderFrame(flash);
  const c = R.hud; c.setTransform(R.dpr, 0, 0, R.dpr, 0, 0); c.clearRect(0, 0, G.w, G.h);
  acts[G.act].hud(c); drawBeats(c, real, showLog);
  G.frame++; if (G.frame === 3) window.__ready = true;
}
window.__dev = { G, acts, Sp, step(n) { for (let i = 0; i < n; i++) { G.time += DT; acts[G.act].step(DT); input.endFrame(); } } };
window.__frameStats = () => { const f = frames.slice(5).sort((a, b) => a - b); return f.length ? { n: f.length, p50: f[f.length >> 1], p95: f[Math.floor(f.length * 0.95)], max: f[f.length - 1] } : null; };
window.addEventListener('error', e => console.error('error: ' + e.message));
window.addEventListener('unhandledrejection', e => console.error('unhandled: ' + e.reason));
function boot() {
  initRender(); initInput(document.getElementById('gl'));
  surface.init(); space.init();
  if (G.test) runTests();
  G.switchAct(G.act);
  for (let i = 0, n = Math.min(120, G.prewarm) * 120; i < n; i++) { G.time += DT; acts[G.act].step(DT); }
  requestAnimationFrame(frame);
}
boot();

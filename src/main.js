// boot, title screen, fixed 120 Hz step, variable render, act switching, saving, dev menu.
import { G, input, initInput, events } from './core.js';
import { R, initRender, renderFrame } from './render.js';
import { drawBeats, seenDump, seenLoad } from './hud.js';
import { surface } from './surface/index.js';
import { space, Sp } from './space/index.js';
import { runTests } from './test.js';
import { save } from './save.js';
import { ui } from './ui.js';

const acts = { surface, space }, DT = 1 / 120, frames = [], q = new URLSearchParams(location.search);
let acc = 0, last = 0, showLog = false, started = { surface: false, space: false };
G.switchAct = (name, data) => { const from = G.act; G.act = name; if (!started[name]) { started[name] = true; acts[name].start(G.scenario, data); } else if (acts[name].enter) acts[name].enter(data); if (from !== name) save.write(); };
save.register('story', { dump: seenDump, load: seenLoad });
const SCN = [['surface, the slice: awake at the wreck (the default start)', '?act=surface'], ['surface, the slice played by itself', '?act=surface&scenario=slice&auto=1'], ['surface, carrying the reactor', '?act=surface&scenario=reactor'], ['surface, the laser as a turret on the network', '?act=surface&scenario=turret'],
  ['surface, a wary herd', '?act=surface&scenario=herd'], ['surface, the predator', '?act=surface&scenario=predator'], ['surface, demand and supply: the arm, a furnace, robots hauling', '?act=surface&scenario=supply'], ['surface, the laser cutting a hillside', '?act=surface&scenario=drill'],
  ['surface, factory running', '?act=surface&scenario=factory&t=30'], ['surface, blueprints and builder drones', '?act=surface&scenario=blueprint'], ['surface, the hive attacks (round 2 guns)', '?act=surface&scenario=combat'], ['surface, the round 2 kit', '?act=surface&scenario=oldkit'],
  ['surface, deep forest', '?act=surface&scenario=forest'], ['surface, alien ruins', '?act=surface&scenario=ruins'], ['surface, military outpost', '?act=surface&scenario=base'], ['surface, hive mouth', '?act=surface&scenario=hive'],
  ['launch at 40 km', '?act=space&scenario=launch'], ['space, 220 km orbit', '?act=space'], ['space, belt mining', '?act=space&scenario=mining'], ['space, combat at the depot', '?act=space&scenario=combat'], ['space, hangar', '?act=space&scenario=builder'], ['property tests', '?test=1']];
function devMenu() {
  const d = document.getElementById('dev'); if (d.style.display === 'block') { d.style.display = 'none'; return; }
  d.innerHTML = '<div>dev menu (F1)</div><a href="./">title screen (continue / new game)</a>' + SCN.map(([n, u]) => `<a href="${u}&seed=${G.seed}">${n}</a>`).join('') + `<div>seed <input id="seed" value="${G.seed}"></div><div>save slot: ${save.slot || 'none (scenario runs do not save; add &slot=name)'}</div><a href="#" id="sv">save now</a><a href="#" id="ex">export save to a file</a><a href="#" id="im">import save from a file</a><input type="file" id="imf" accept="application/json" style="display:none"><div>, . time warp in space &nbsp; L story log</div>`;
  d.style.display = 'block'; d.querySelector('#seed').onchange = e => { const p = new URLSearchParams(location.search); p.set('seed', e.target.value); location.search = p.toString(); };
  d.querySelector('#sv').onclick = e => { e.preventDefault(); save.write(); }; d.querySelector('#ex').onclick = e => { e.preventDefault(); save.exportFile(); };
  d.querySelector('#im').onclick = e => { e.preventDefault(); d.querySelector('#imf').click(); };
  d.querySelector('#imf').onchange = async e => { try { await save.importFile(e.target.files[0], 'main'); save.slot = null; sessionStorage.setItem('spacegame:continue', '1'); location.href = './'; } catch (err) { d.insertAdjacentHTML('beforeend', `<div>import failed: ${err.message}</div>`); } };
}
function frame(now) {
  requestAnimationFrame(frame);
  const real = Math.min(0.1, (now - last) / 1000); if (last) frames.push(now - last); if (frames.length > 1200) frames.shift(); last = now; G.real += real;
  if (input.hit('F1')) devMenu(); if (input.hit('l')) showLog = !showLog;
  if (G.paused) input.endFrame(); else { acc += real; let n = 0; while (acc >= DT && n < 12) { acc -= DT; n++; G.time += DT; acts[G.act].step(DT); input.endFrame(); } if (n === 12) acc = 0; }
  const flash = acts[G.act].draw(G.real) || 0;
  renderFrame(flash);
  const c = R.hud; c.setTransform(R.dpr, 0, 0, R.dpr, 0, 0); c.clearRect(0, 0, G.w, G.h);
  if (G.act !== 'surface') surface.hide();
  acts[G.act].hud(c); drawBeats(c, real, showLog);
  save.tick(now);
  G.frame++; if (G.frame === 3) window.__ready = true;
}
window.__dev = { G, acts, Sp, save, R, step(n) { for (let i = 0; i < n; i++) { G.time += DT; acts[G.act].step(DT); input.endFrame(); } } };
window.__frameStats = () => { const f = frames.slice(5).sort((a, b) => a - b); return f.length ? { n: f.length, p50: f[f.length >> 1], p95: f[Math.floor(f.length * 0.95)], max: f[f.length - 1] } : null; };
window.addEventListener('error', e => console.error('error: ' + e.message));
window.addEventListener('unhandledrejection', e => console.error('unhandled: ' + (e.reason && e.reason.stack || e.reason)));
addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save.flush(); });
addEventListener('pagehide', () => save.flush());
async function boot() {
  initRender(); initInput(document.getElementById('gl'));
  // a URL that names an act, a scenario or the tests starts at once and does not touch the saved game (unless it
  // names a slot); the bare URL shows the title screen and plays in the slot "main"
  const direct = q.has('act') || q.has('scenario') || G.test, slot = q.get('slot') || (direct ? null : 'main');
  if (!direct && !q.has('seed')) G.seed = 1 + Math.floor(Math.random() * 99999);
  surface.init(); space.init();
  if (G.test) await runTests();
  let blob = slot ? await save.read(slot) : null;
  if (direct && q.get('continue') !== '1') blob = null;
  if (!blob || !direct) G.switchAct(G.act);            // a fresh world: the scenario, or the new game behind the title screen
  if (!direct) {
    G.paused = true; requestAnimationFrame(frame);
    const auto = sessionStorage.getItem('spacegame:continue') && blob; sessionStorage.removeItem('spacegame:continue');
    const choice = auto ? 'continue' : await ui.title(!!blob, blob ? `saved ${new Date(blob.savedAt).toLocaleString()} &nbsp; seed ${blob.data.seed} &nbsp; state ${blob.hash}` : '');
    if (choice === 'new') { blob = null; save.slot = slot; save.write(); }
  }
  if (blob) { const d = save.apply(blob); started.surface = true; started.space = !!d.parts.space; G.act = d.act === 'space' && d.parts.space ? 'space' : 'surface'; G.loadedHash = blob.hash; G.reloadHash = save.hash(save.collect()); }
  save.slot = slot; save.last = performance.now(); G.paused = false;
  for (let i = 0, n = Math.min(120, G.prewarm) * 120; i < n; i++) { G.time += DT; acts[G.act].step(DT); }
  if (direct) requestAnimationFrame(frame);
}
boot();

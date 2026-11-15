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
const SCN = [['surface: awake in the wreck, without the suit (the default start)', '?act=surface'], ['surface, suited and booted beside the wreck, played by itself', '?act=surface&scenario=slice&auto=1'],
  ['round 6: put on the suit, the boot', '?act=surface&scenario=suitup&auto=1'], ['round 6: kerf cut', '?act=surface&scenario=kerf&auto=1'], ['round 6: the heat sink', '?act=surface&scenario=heat&auto=1'], ['round 6: fists', '?act=surface&scenario=fists&auto=1'], ['round 6: self-defence', '?act=surface&scenario=defend'], ['round 6: a wave of small bodies', '?act=surface&scenario=swarm'],
  ['round 6: the task market', '?act=surface&scenario=market&t=20'], ['round 6: a stuck hauler lifted', '?act=surface&scenario=rescue&t=10'], ['round 6: stockpiles and the ledger', '?act=surface&scenario=stockpile&t=40'], ['round 6: in reach', '?act=surface&scenario=reach&t=6'], ['round 6: scan and assay', '?act=surface&scenario=assay&t=30'], ['round 6: the shaft rig', '?act=surface&scenario=shaft&t=60'],
  ['round 6: supports', '?act=surface&scenario=supports&t=40'], ['round 6: collapse', '?act=surface&scenario=collapse&t=8'], ['round 6: wires, links, ranges', '?act=surface&scenario=wires&t=10'], ['round 6: inside the wreck', '?act=surface&scenario=interior'], ['round 6: needs and the air pump', '?act=surface&scenario=needs&t=5'], ['round 6: fog of war', '?act=surface&scenario=fog&t=6'], ['round 6: rock on decks', '?act=surface&scenario=deckrock&t=8'], ['surface, carrying the reactor', '?act=surface&scenario=reactor'], ['surface, the laser as a turret on the network', '?act=surface&scenario=turret'],
  ['surface, a wary herd', '?act=surface&scenario=herd'], ['surface, the predator', '?act=surface&scenario=predator'], ['surface, demand and supply: the arm, a furnace, robots hauling', '?act=surface&scenario=supply'], ['surface, the laser cutting a hillside', '?act=surface&scenario=drill'],
  ['surface, factory running', '?act=surface&scenario=factory&t=30'], ['surface, blueprints and builder drones', '?act=surface&scenario=blueprint'], ['surface, the hive attacks (round 2 guns)', '?act=surface&scenario=combat'], ['surface, the round 2 kit', '?act=surface&scenario=oldkit'],
  ['surface, deep forest', '?act=surface&scenario=forest'], ['surface, alien ruins', '?act=surface&scenario=ruins'], ['surface, military outpost', '?act=surface&scenario=base'], ['surface, hive mouth', '?act=surface&scenario=hive'],
  ['round 4: the whole planet', '?act=surface&scenario=planet'], ['round 4: the horizon is a curve', '?act=surface&scenario=horizon'], ['round 4: a quarter of the way round', '?act=surface&scenario=far90'], ['round 4: across the chart seam', '?act=surface&scenario=seam'], ['round 4: the far side, the main hive', '?act=surface&scenario=antipode'],
  ['round 4: place it and it gets built', '?act=surface&scenario=autobuild'], ['round 4: the ai window', '?act=surface&scenario=queue&t=20'], ['round 4: the ai lays a conveyor', '?act=surface&scenario=conveyor&t=20'], ['round 4: the ground hauler under a ledge', '?act=surface&scenario=overhang'], ['round 4: stock targets', '?act=surface&scenario=targets&t=20'],
  ['launch at 40 km', '?act=space&scenario=launch'], ['space, 220 km orbit', '?act=space'], ['space, belt mining', '?act=space&scenario=mining'], ['space, combat at the depot', '?act=space&scenario=combat'], ['space, hangar', '?act=space&scenario=builder'], ['property tests', '?test=1']];
function devMenu() {
  const d = document.getElementById('dev'); if (d.style.display === 'block') { d.style.display = 'none'; return; }
  d.innerHTML = '<div>dev menu (F1)</div><a href="./">title screen (continue / new game)</a>' + SCN.map(([n, u]) => `<a href="${u}&seed=${G.seed}">${n}</a>`).join('') + `<div>seed <input id="seed" value="${G.seed}"></div><div>save slot: ${save.slot || 'none (scenario runs do not save; add &slot=name)'}</div><a href="#" id="sv">save now</a><a href="#" id="ex">export save to a file</a><a href="#" id="im">import save from a file</a><input type="file" id="imf" accept="application/json" style="display:none"><div>, . time warp in space &nbsp; O story log</div>`;
  d.style.display = 'block'; d.querySelector('#seed').onchange = e => { const p = new URLSearchParams(location.search); p.set('seed', e.target.value); location.search = p.toString(); };
  d.querySelector('#sv').onclick = e => { e.preventDefault(); save.write(); }; d.querySelector('#ex').onclick = e => { e.preventDefault(); save.exportFile(); };
  d.querySelector('#im').onclick = e => { e.preventDefault(); d.querySelector('#imf').click(); };
  d.querySelector('#imf').onchange = async e => { try { await save.importFile(e.target.files[0], 'main'); save.slot = null; sessionStorage.setItem('spacegame:continue', '1'); location.href = './'; } catch (err) { d.insertAdjacentHTML('beforeend', `<div>import failed: ${err.message}</div>`); } };
}
function frame(now) {
  requestAnimationFrame(frame);
  if (window.__dev.still) { last = 0; return; }       // a tool is stepping the game itself (tools/play.mjs): nothing is drawn and no time passes until it lets go
  const real = Math.min(0.1, (now - last) / 1000); if (last) frames.push(now - last); if (frames.length > 1200) frames.shift(); last = now; G.real += real;
  if (input.hit('F1')) devMenu(); if (input.hit('o')) showLog = !showLog;
  // round 6 (docs/SCIENCE.md V9): time controls on the surface. P pauses, , and . step through 1x, 3x, 10x. Asleep,
  // time runs at 20x until you wake. More steps a frame, the same 120 Hz step: the simulation stays what it is.
  if (G.act === 'surface' && !G.paused) { if (input.hit('p')) G.warp = G.warp === 0 ? 1 : 0; if (input.hit('.')) G.warp = G.warp === 0 ? 1 : G.warp === 1 ? 3 : 10; if (input.hit(',')) G.warp = G.warp >= 10 ? 3 : 1; }
  const warp = G.act !== 'surface' ? 1 : G.sleepWarp ? 20 : G.warp === undefined ? 1 : G.warp, cap = Math.max(12, Math.min(240, 12 * warp));
  if (G.paused) input.endFrame(); else if (warp === 0) { if (acts[G.act].idle) acts[G.act].idle(real); input.endFrame(); } else { acc += real * warp; let n = 0; while (acc >= DT && n < cap) { acc -= DT; n++; G.time += DT; acts[G.act].step(DT); input.endFrame(); } if (n === cap) acc = 0; }
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
  for (let i = 0, n = Math.min(420, G.prewarm) * 120; i < n; i++) { G.time += DT; acts[G.act].step(DT); }
  if (direct) requestAnimationFrame(frame);
}
boot();

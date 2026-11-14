// the DOM interface of Act 1: square-slot hotbar, inventory window with drag and drop and split stacks, the suit
// printer panel beside it, chest / cache / machine windows with the same grid, the blueprint bar, and the title
// screen. Quiet and precise: 1 px lines, small monospace caps, icons from icons.js. No game logic lives here.
import { G, events } from './core.js';
import { iconUrl } from './icons.js';
import { ITEMS, RECIPES, RECIPE, SUIT_SLOW, CARRY, EPS, inv, fmtAmt, fmtCost, printerQueue, printerCancel } from './items.js';
import { S } from './surface/state.js';
import { F, DEFS, give, accepts, quickTransfer, ROCKET_PARTS } from './surface/factory.js';
import { BP, BUILD, costOf } from './surface/blueprint.js';
import { STORY } from './story.js';

const CSS = `
#ui{position:fixed;inset:0;pointer-events:none;font:10px/1.5 ui-monospace,Menlo,Consolas,monospace;letter-spacing:.08em;text-transform:uppercase;color:rgba(159,179,191,.75);user-select:none}
#ui .bar{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);display:flex;gap:4px;pointer-events:auto}
.slot{position:relative;width:52px;height:52px;box-sizing:border-box;border:1px solid rgba(159,179,191,.22);background:rgba(2,3,5,.72) center/74% no-repeat;cursor:default}
.slot:hover{border-color:rgba(159,179,191,.55)} .slot.sel{border-color:rgba(255,179,71,.9);box-shadow:inset 0 0 0 1px rgba(255,179,71,.25)}
.slot.dim{opacity:.5} .slot.bad{border-color:rgba(255,45,45,.5)}
.slot .n{position:absolute;right:3px;bottom:1px;font-size:9px;color:rgba(214,226,233,.9);letter-spacing:0;text-shadow:0 0 3px #000,0 0 2px #000}
.slot .k{position:absolute;left:3px;top:0;font-size:8px;color:rgba(159,179,191,.45)}
.slot .pg{position:absolute;left:2px;right:2px;bottom:2px;height:2px;background:rgba(159,179,191,.15)} .slot .pg i{display:block;height:2px;background:rgba(46,242,208,.8)}
#win{position:absolute;left:50%;top:50%;transform:translate(-50%,-52%);display:none;gap:14px;pointer-events:auto;align-items:flex-start}
.pan{background:rgba(2,3,5,.9);border:1px solid rgba(159,179,191,.25);padding:12px 14px}
.pan h4{margin:0 0 8px;font:inherit;color:rgba(159,179,191,.5);display:flex;justify-content:space-between;gap:20px} .pan h4 b{font-weight:400;color:rgba(255,179,71,.85)}
.grid{display:grid;gap:4px} .g9{grid-template-columns:repeat(9,52px)} .g6{grid-template-columns:repeat(6,52px)} .g4{grid-template-columns:repeat(4,52px)}
.sep{height:8px} .row{display:flex;justify-content:space-between;gap:18px;color:rgba(159,179,191,.6)} .row b{font-weight:400;color:rgba(214,226,233,.85)}
.btn{display:inline-block;border:1px solid rgba(159,179,191,.3);padding:3px 10px;margin:8px 6px 0 0;cursor:pointer;color:rgba(159,179,191,.8)} .btn:hover{border-color:rgba(255,179,71,.8);color:rgba(255,179,71,.95)}
#tip{position:absolute;display:none;background:rgba(2,3,5,.95);border:1px solid rgba(159,179,191,.3);padding:7px 10px;white-space:pre;max-width:420px;z-index:5;color:rgba(190,205,214,.9)}
#held{position:absolute;width:52px;height:52px;display:none;background:center/74% no-repeat;z-index:6} #held .n{position:absolute;right:3px;bottom:1px;font-size:9px;color:#dfe8ee;text-shadow:0 0 3px #000}
#title{position:absolute;inset:0;display:none;background:rgba(2,3,5,.86);pointer-events:auto;flex-direction:column;align-items:center;justify-content:center;gap:10px}
#title h1{font:300 22px ui-monospace,Menlo,Consolas,monospace;letter-spacing:.5em;color:rgba(214,226,233,.9);margin:0 0 26px}
#title .btn{min-width:220px;text-align:center;padding:9px 14px;margin:0;font-size:11px} #title .sub{color:rgba(159,179,191,.4);margin-top:18px;text-align:center;line-height:1.9}
#bpinfo{position:absolute;left:50%;bottom:80px;transform:translateX(-50%);white-space:nowrap;color:rgba(159,179,191,.6)}
`;
let root, bar, win, tip, heldEl, title, bpinfo, held = null, sig = '', downAt = null, mx = 0, my = 0;
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };
const slotHtml = (s, a = '', extra = '') => `<div class="slot ${a}" ${extra} ${s ? `style="background-image:url(${iconUrl(s.id)})"` : ''}>${s ? `<span class="n">${fmtAmt(s.id, s.n)}</span>` : ''}`;
export const ui = { open: false,
  init() {
    const st = el('style'); st.textContent = CSS; document.head.appendChild(st);
    root = el('div'); root.id = 'ui'; document.body.appendChild(root);
    bar = el('div', 'bar'); win = el('div'); win.id = 'win'; tip = el('div'); tip.id = 'tip'; heldEl = el('div'); heldEl.id = 'held'; title = el('div'); title.id = 'title'; bpinfo = el('div'); bpinfo.id = 'bpinfo';
    root.append(bar, bpinfo, win, title, tip, heldEl);
    root.addEventListener('mousedown', e => { const t = e.target.closest('[data-a]'); if (!t) return; e.preventDefault(); act(t, e.button, e.shiftKey); downAt = t; events.emit('gesture'); });
    root.addEventListener('mouseup', e => { const t = e.target.closest('[data-a="slot"]'); if (t && downAt && t !== downAt && held && downAt.dataset.a === 'slot') act(t, 0, false); downAt = null; });
    root.addEventListener('contextmenu', e => e.preventDefault());
    addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; const t = e.target.closest && e.target.closest('[data-tip]'); if (t) { tip.textContent = t.dataset.tip; tip.style.display = 'block'; tip.style.left = Math.min(innerWidth - 440, mx + 16) + 'px'; tip.style.top = (my + 18) + 'px'; } else tip.style.display = 'none'; heldEl.style.left = (mx - 26) + 'px'; heldEl.style.top = (my - 26) + 'px'; });
  },
  toggle(force) { this.open = force === undefined ? !this.open : force; if (!this.open) { if (held) { const left = inv.add(S.inv, held.id, held.n); if (left > EPS) { S.drop(held.id, left); S.say(held.id + ' dropped at your feet'); } held = null; } S.open = null; } S.uiOpen = this.open; sig = ''; },
  openMachine(m) { S.open = m; this.toggle(true); },
  // called every frame while Act 1 is on screen
  update(visible) {
    root.style.display = visible ? 'block' : 'none'; if (!visible) return;
    if (S.uiOpen !== this.open) { this.open = S.uiOpen; sig = ''; }
    const P = S.P, bp = S.mode === 'blueprint', q = S.printer.q;
    const s2 = JSON.stringify([S.inv.slots, P.slot, S.mode, this.open, S.open && [S.open.kind, S.open.inv && S.open.inv.slots, S.open.inp, S.open.out, S.open.recipe, S.open.n, S.open.drones], held, bp && [BP.sel, BP.tool, BP.rot], q.map(j => [j.r, Math.round(j.left)]), this.open && Math.round(inv.mass(S.inv)), this.open && [Math.round(P.bat.wh), Math.round(P.o2 * 100), Math.round(P.prop * 10)]]);
    if (s2 === sig) return; sig = s2;
    // hotbar, or the blueprint bar
    if (bp) {
      const all = id => { let n = S.count(id); for (const m of F.machines) if (m.kind === 'chest') n += inv.count(m.inv, id); return n; };
      bar.innerHTML = BUILD.map((k, i) => { const c = costOf(k), have = Object.keys(c).every(id => all(id) >= c[id]); return `<div class="slot ${i === BP.sel && BP.tool === 'place' ? 'sel' : ''} ${have ? '' : 'dim'}" data-a="bp" data-i="${i}" data-tip="${k}\ncost  ${fmtCost(c)}\nhave  ${Object.keys(c).map(id => fmtAmt(id, all(id)) || 'x' + all(id)).join(', ')} (suit and chests)${RECIPE[k] ? '\nkit   ' + fmtCost(RECIPE[k].in) : ''}" style="background-image:url(${iconUrl(k)})"><span class="k">${i + 1}</span><span class="n">${k === 'wall' ? '' : 'x' + Math.round(all(k))}</span></div>`; }).join('')
        + `<div class="slot ${BP.tool === 'decon' ? 'sel' : ''}" data-a="tool" data-i="decon" data-tip="deconstruct (x)\nmark a machine; robots or the suit take it apart" style="background-image:url(${iconUrl('decon')})"><span class="k">x</span></div><div class="slot ${BP.tool === 'clear' ? 'sel' : ''}" data-a="tool" data-i="clear" data-tip="clear terrain (t)\ndrag a rectangle; robots cut it out" style="background-image:url(${iconUrl('clear')})"><span class="k">t</span></div>`;
      const k = BUILD[BP.sel]; bpinfo.textContent = BP.tool === 'place' ? `blueprint: ${k}   cost ${fmtCost(costOf(k))}   lmb queue   rmb cancel   r rotate ${k === 'belt' ? (BP.rot > 0 ? '>' : '<') : ''}   queued ${BP.ghosts.length}` : BP.tool === 'decon' ? 'deconstruct: lmb mark a machine   rmb unmark' : 'clear terrain: drag a rectangle   rmb cancel';
    } else {
      bar.innerHTML = S.inv.slots.slice(0, 9).map((s, i) => slotHtml(s, i === P.slot ? 'sel' : '', `data-a="slot" data-c="p" data-i="${i}" ${s ? `data-tip="${tipOf(s)}"` : ''}`) + `<span class="k">${i + 1}</span></div>`).join(''); bpinfo.textContent = '';
    }
    heldEl.style.display = held ? 'block' : 'none'; if (held) { heldEl.style.backgroundImage = `url(${iconUrl(held.id)})`; heldEl.innerHTML = `<span class="n">${fmtAmt(held.id, held.n)}</span>`; }
    win.style.display = this.open ? 'flex' : 'none'; if (!this.open) return;
    const grid = (I, c, cols, from = 0, to = I.slots.length) => `<div class="grid g${cols}">` + I.slots.slice(from, to).map((s, i) => slotHtml(s, '', `data-a="slot" data-c="${c}" data-i="${i + from}" ${s ? `data-tip="${tipOf(s)}"` : ''}`) + '</div>').join('') + '</div>';
    let h = '';
    const m = S.open;
    if (m && m.inv) h += `<div class="pan"><h4>${m.title || m.kind}<b>${inv.mass(m.inv).toFixed(0)} kg</b></h4>${grid(m.inv, 'c', m.inv.slots.length > 12 ? 6 : 4)}<span class="btn" data-a="takeall">take all</span></div>`;
    else if (m) h += machinePanel(m);
    h += `<div class="pan"><h4>suit inventory<b>${inv.mass(S.inv).toFixed(0)} / ${CARRY} kg</b></h4>${grid(S.inv, 'p', 9, 9)}<div class="sep"></div>${grid(S.inv, 'p', 9, 0, 9)}<div class="sep"></div>
      <div class="row"><span>battery</span><b>${P.bat.wh.toFixed(0)} / ${P.bat.cap} Wh</b></div><div class="row"><span>oxygen</span><b>${P.o2.toFixed(2)} kg</b></div><div class="row"><span>jet propellant</span><b>${P.prop.toFixed(1)} kg</b></div>
      <div class="row" style="margin-top:6px;color:rgba(159,179,191,.35)"><span>lmb move &nbsp; rmb split / place one &nbsp; shift quick move</span></div></div>`;
    h += `<div class="pan"><h4>the arm: matter compiler<b>${q.length ? (S.printer.stall || 'printing') : 'idle'}</b></h4><div class="grid g6">` + RECIPES.map(r => { const ok = S.has(r.in), out = Object.keys(r.out)[0]; return `<div class="slot ${ok ? '' : 'dim'}" data-a="print" data-i="${r.id}" data-tip="${recipeTip(r)}" style="background-image:url(${iconUrl(out)})"></div>`; }).join('') + '</div>'
      + `<div class="sep"></div><h4>queue<b>${q.length} / 12</b></h4><div class="grid g6" style="min-height:52px">` + q.map((j, i) => `<div class="slot" data-a="unprint" data-i="${i}" data-tip="${j.r}\n${Math.ceil(j.left)} s left\nclick to cancel: the material comes back" style="background-image:url(${iconUrl(Object.keys(RECIPE[j.r].out)[0])})"><span class="pg"><i style="width:${(100 * (1 - j.left / j.total)).toFixed(0)}%"></i></span></div>`).join('') + `</div>
      <div class="row" style="margin-top:6px;color:rgba(159,179,191,.35)"><span>prints anything, ${SUIT_SLOW}x slower than a machine &nbsp; shift x5</span></div></div>`;
    win.innerHTML = h;
  },
  // title screen: resolves with 'continue' or 'new'
  title(hasSave, info) {
    return new Promise(res => {
      root.style.display = 'block'; title.style.display = 'flex'; let armed = false;
      const draw = () => { title.innerHTML = `<h1>${STORY.title}</h1>` + (hasSave ? `<span class="btn" data-a="t-continue">continue</span>` : '') + `<span class="btn" data-a="t-new">${armed ? 'confirm: the saved game is replaced' : 'new game'}</span><div class="sub">${hasSave ? info : 'no saved game'}<br>progress is saved in this browser every 30 s &nbsp; f1 dev menu, export and import</div>`; };
      draw();
      title.onmousedown = e => { const t = e.target.closest('[data-a]'); if (!t) return; e.stopPropagation(); events.emit('gesture'); if (t.dataset.a === 't-continue') { title.style.display = 'none'; res('continue'); } else if (hasSave && !armed) { armed = true; draw(); } else { title.style.display = 'none'; res('new'); } };
    });
  },
};
const tipOf = s => { const d = ITEMS[s.id]; return `${s.id}\n${fmtAmt(s.id, s.n) || 'x1'}   ${(s.n * d.m).toFixed(d.m * s.n < 10 ? 2 : 1)} kg${d.build ? '\nplace it in blueprint mode (b)' : d.place ? '\nrmb places it as terrain' : d.weapon ? '\nc combat mode' : ''}`; };
const recipeTip = r => `${r.id}\nmakes  ${fmtCost(r.out)}\nneeds  ${Object.entries(r.in).map(([k, n]) => `${k} ${fmtAmt(k, n) || 'x1'} (have ${fmtAmt(k, S.count(k)) || 'x' + Math.round(S.count(k))})`).join('\n       ')}\nsuit   ${(r.t * SUIT_SLOW).toFixed(0)} s\n${r.by}  ${r.t} s`;
function machinePanel(m) {
  const rows = o => Object.entries(o || {}).filter(([, n]) => n > 1e-4).map(([k, n]) => `<div class="slot" data-tip="${k}" style="background-image:url(${iconUrl(k)})"><span class="n">${fmtAmt(k, n) || 'x1'}</span></div>`).join('') || '<div class="slot dim"></div>';
  let h = `<div class="pan" style="min-width:236px"><h4>${m.kind}<b>${m.on ? 'running' : 'idle'}</b></h4>`;
  if (m.kind === 'pad') h += `<div class="row"><span>rocket</span><b>${m.n} / ${ROCKET_PARTS} parts</b></div>`;
  else if (m.kind === 'hub') h += `<div class="row"><span>builder drones</span><b>dock a drone here to deploy it</b></div>`;
  else if (m.kind === 'bio-printer') h += `<div class="row"><span>respawn point</span><b>online</b></div><div class="row"><span>suit charging in range</span><b>4 m</b></div>`;
  else { h += `<div class="row"><span>in</span></div><div class="grid g4">${rows(m.inp)}</div><div class="sep"></div><div class="row"><span>out</span></div><div class="grid g4">${rows(m.out)}</div>`;
    if (m.kind === 'assembler') h += `<div class="sep"></div><div class="row"><span>recipe</span><b>${m.recipe}</b></div><div class="grid g4">` + RECIPES.filter(r => r.by === 'assembler').map(r => `<div class="slot ${r.id === m.recipe ? 'sel' : ''}" data-a="recipe" data-i="${r.id}" data-tip="${recipeTip(r)}" style="background-image:url(${iconUrl(Object.keys(r.out)[0])})"></div>`).join('') + '</div>';
    if (m.kind === 'furnace') h += `<div class="row" style="margin-top:6px"><span>biomass in the firebox: 2.5x speed, more smoke</span></div>`;
    if (m.kind === 'miner') h += `<div class="row" style="margin-top:6px"><span>bit depth</span><b>${(m.depth || 0).toFixed(1)} m</b></div>`; }
  return h + `<span class="btn" data-a="xfer">put in / take out</span><div class="row" style="margin-top:6px;color:rgba(159,179,191,.35)"><span>click here holding a stack to put it in</span></div></div>`;
}
const INV = c => c === 'p' ? S.inv : S.open && S.open.inv;
function act(t, button, shift) {
  const a = t.dataset.a, i = t.dataset.i;
  if (a === 'slot' && !ui.open) S.P.slot = +i;
  else if (a === 'slot') clickSlot(INV(t.dataset.c), +i, button, shift, t.dataset.c);
  else if (a === 'print') { if (!printerQueue(S.printer, S.inv, i, shift ? 5 : 1)) S.say(S.printer.q.length >= 12 ? 'printer queue is full' : 'missing material for ' + i, 2); }
  else if (a === 'unprint') printerCancel(S.printer, S.inv, +i);
  else if (a === 'bp') { BP.sel = +i; BP.tool = 'place'; }
  else if (a === 'tool') BP.tool = BP.tool === i ? 'place' : i;
  else if (a === 'recipe') { const m = S.open; if (m && !m.busy) { for (const k in m.inp) { S.add(k, m.inp[k]); } m.inp = {}; m.recipe = i; } else S.say('wait for the batch to finish', 2); }
  else if (a === 'xfer') { const m = S.open; if (held && m && accepts(m, held.id)) { held.n = give(m, held.id, held.n); if (held.n <= EPS) held = null; } else if (m) quickTransfer(m); }
  else if (a === 'takeall') { const I = S.open.inv; for (let k = 0; k < I.slots.length; k++) { const s = I.slots[k]; if (s) { const left = S.add(s.id, s.n); S.gain(s.id, s.n - left); I.slots[k] = left > EPS ? { id: s.id, n: left } : null; } } }
  sig = '';
}
// pick up, put down, merge, swap, split; shift moves a stack to the other container (or between hotbar and pack)
export function clickSlot(I, i, button, shift, c) {
  if (!I) return; const s = I.slots[i];
  if (shift && s && !held) {
    const other = c === 'p' ? (S.open && S.open.inv) : S.inv;
    if (other) { const left = inv.add(other, s.id, s.n); I.slots[i] = left > EPS ? { id: s.id, n: left } : null; }
    else if (S.open && accepts(S.open, s.id)) { const left = give(S.open, s.id, s.n); I.slots[i] = left > EPS ? { id: s.id, n: left } : null; }
    else { I.slots[i] = null; const range = i < 9 ? [9, 36] : [0, 9]; let put = false; for (let k = range[0]; k < range[1] && !put; k++) if (!I.slots[k]) { I.slots[k] = s; put = true; } if (!put) I.slots[i] = s; }
    return;
  }
  const whole = s && ITEMS[s.id].u !== 'kg' && ITEMS[s.id].u !== 'L';
  if (button === 0) {
    if (!held) { if (s) { held = s; I.slots[i] = null; } }
    else if (!s) { I.slots[i] = held; held = null; }
    else if (s.id === held.id) { const k = Math.min(held.n, ITEMS[s.id].cap - s.n); s.n += k; held.n -= k; if (held.n <= EPS) held = null; }
    else { I.slots[i] = held; held = s; }
  } else if (button === 2) {
    if (!held) { if (s) { const half = whole ? Math.ceil(s.n / 2) : s.n / 2; held = { id: s.id, n: half }; s.n -= half; if (s.n <= EPS) I.slots[i] = null; } }
    else if (!s || s.id === held.id) { const one = Math.min(held.n, 1, ITEMS[held.id].cap - (s ? s.n : 0)); if (one > 0) { if (s) s.n += one; else I.slots[i] = { id: held.id, n: one }; held.n -= one; if (held.n <= EPS) held = null; } }
  }
}
export const heldStack = () => held;

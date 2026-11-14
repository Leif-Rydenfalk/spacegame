// the DOM interface of Act 1: square-slot hotbar, inventory window with drag and drop and split stacks, the suit
// printer panel beside it, chest / cache / machine windows with the same grid, the blueprint bar, and the title
// screen. Quiet and precise: 1 px lines, small monospace caps, icons from icons.js. No game logic lives here.
import { G, events } from './core.js';
import { iconUrl } from './icons.js';
import { ITEMS, RECIPES, RECIPE, SUIT_SLOW, CARRY, EPS, inv, fmtAmt, fmtCost, printerQueue, printerCancel } from './items.js';
import { S, canSee } from './surface/state.js';
import { F, DEFS, give, accepts, quickTransfer, ROCKET_PARTS } from './surface/factory.js';
import { BP, costOf, cancelGhost, plannable, cursorKind, setBlueprint, staged } from './surface/blueprint.js';
import { SUP, setTarget, targetStep, orderItem, cancelWant } from './surface/supply.js';
import { STOCK, ledger, reachable, zoneKg, addZone } from './surface/stock.js';
import { EXO, SLOTS, SUITPARTS, installPart, suitStats } from './surface/suit.js';
import { MARKET } from './surface/robots.js';
import { LOG } from './surface/market.js';
import { CATS } from './items.js';
import { AUTO, queueView, bump, AUX_W } from './surface/auto.js';
import { robots, ROBOT, CRAWLER, intentOf } from './surface/robots.js';
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
#win.ai{top:50%;max-height:92vh}
.qr{display:flex;align-items:center;gap:8px;height:24px;border-top:1px solid rgba(159,179,191,.08);white-space:nowrap} .qr .qn{width:16px;color:rgba(159,179,191,.4);text-align:right}
.qr .qi{width:20px;height:20px;background:center/100% no-repeat;flex:none} .qr .qk{width:104px;color:rgba(214,226,233,.9)} .qr .qk i,.qr .qw i{font-style:normal;color:rgba(46,242,208,.7);font-size:8px}
.qr .qw{flex:1;color:rgba(159,179,191,.6);overflow:hidden;text-overflow:ellipsis;min-width:250px;max-width:430px} .qr .qw.warn{color:rgba(255,179,71,.85)} .qr .qv{width:120px;text-align:right;color:rgba(214,226,233,.85)}
.qb{width:18px;height:18px;line-height:17px;text-align:center;border:1px solid rgba(159,179,191,.25);cursor:pointer;color:rgba(159,179,191,.8);flex:none;letter-spacing:0} .qb:hover{border-color:rgba(255,179,71,.8);color:rgba(255,179,71,.95)}
.note{color:rgba(159,179,191,.38);margin-top:8px;max-width:640px;white-space:normal;line-height:1.6}
#bpinfo{position:absolute;left:50%;bottom:78px;transform:translateX(-50%);white-space:nowrap;color:rgba(159,179,191,.6)} #bpinfo b{font-weight:400;color:rgba(110,205,255,.95)}
#plan{position:absolute;left:50%;bottom:142px;transform:translateX(-50%);display:none;gap:4px;pointer-events:auto;padding:5px;border:1px dashed rgba(110,205,255,.45);background:rgba(4,14,22,.6)}
#plan .slot{width:44px;height:44px;border-color:rgba(110,205,255,.3);background-color:rgba(4,16,26,.8)} #plan .slot.sel{border-color:rgba(110,205,255,1);box-shadow:inset 0 0 0 1px rgba(110,205,255,.35)} #plan .slot.gh{filter:grayscale(1) brightness(1.2) sepia(1) hue-rotate(165deg) saturate(2.4);opacity:.85}
#ui.bp .bar .slot{border-color:rgba(110,205,255,.28)}
.slot.plan::after{content:'';position:absolute;right:2px;top:2px;width:6px;height:6px;border:1px dashed rgba(110,205,255,.9)}
`;
let root, bar, win, tip, heldEl, title, bpinfo, plan, held = null, sig = '', downAt = null, mx = 0, my = 0;
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };
const slotHtml = (s, a = '', extra = '') => `<div class="slot ${a}" ${extra} ${s ? `style="background-image:url(${iconUrl(s.id)})"` : ''}>${s ? `<span class="n">${fmtAmt(s.id, s.n)}</span>` : ''}`;
export const ui = { open: false, ai: false,
  init() {
    const st = el('style'); st.textContent = CSS; document.head.appendChild(st);
    root = el('div'); root.id = 'ui'; document.body.appendChild(root);
    bar = el('div', 'bar'); win = el('div'); win.id = 'win'; tip = el('div'); tip.id = 'tip'; heldEl = el('div'); heldEl.id = 'held'; title = el('div'); title.id = 'title'; bpinfo = el('div'); bpinfo.id = 'bpinfo'; plan = el('div'); plan.id = 'plan';
    root.append(bar, plan, bpinfo, win, title, tip, heldEl);
    root.addEventListener('mousedown', e => { const t = e.target.closest('[data-a]'); if (!t) return; e.preventDefault(); act(t, e.button, e.shiftKey); downAt = t; events.emit('gesture'); });
    root.addEventListener('mouseup', e => { const t = e.target.closest('[data-a="slot"]'); if (t && downAt && t !== downAt && held && downAt.dataset.a === 'slot') act(t, 0, false); downAt = null; });
    root.addEventListener('contextmenu', e => e.preventDefault());
    addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; const t = e.target.closest && e.target.closest('[data-tip]'); if (t) { tip.textContent = t.dataset.tip; tip.style.display = 'block'; tip.style.left = Math.min(innerWidth - 440, mx + 16) + 'px'; tip.style.top = (my + 18) + 'px'; } else tip.style.display = 'none'; heldEl.style.left = (mx - 26) + 'px'; heldEl.style.top = (my - 26) + 'px'; });
  },
  // J: the AI's window (build queue, stock targets, logistics) in place of the inventory
  toggleAI(force) { const on = force === undefined ? !(this.open && this.ai) : force; this.ai = on; S.aiOpen = on; this.toggle(on); this.ai = on; S.aiOpen = on; },
  toggle(force) { this.open = force === undefined ? !this.open : force; if (!this.open || force === undefined) { this.ai = false; S.aiOpen = false; } if (!this.open) { if (held) { const left = inv.add(S.inv, held.id, held.n); if (left > EPS) { S.drop(held.id, left); S.say(held.id + ' dropped at your feet'); } held = null; } S.open = null; } S.uiOpen = this.open; sig = ''; },
  openMachine(m) { S.open = m; this.toggle(true); },
  // called every frame while Act 1 is on screen
  update(visible) {
    root.style.display = visible ? 'block' : 'none'; if (!visible) return;
    if (S.uiOpen !== this.open) { this.open = S.uiOpen; sig = ''; }
    const P = S.P, bp = S.mode === 'blueprint', q = S.printer.q;
    const s2 = JSON.stringify([S.inv.slots, P.slot, S.mode, this.open, S.open && [S.open.kind, S.open.inv && S.open.inv.slots, S.open.inp, S.open.out, S.open.recipe, S.open.n, S.open.drones], held, S.plan, S.tool, BP.rot, BP.ghosts.length, bp && plannable(), S.known.size, q.map(j => [j.r, Math.round(j.left)]), this.open && Math.round(inv.mass(S.inv)), this.open && [Math.round(P.bat.wh), Math.round(P.o2 * 100), Math.round(P.prop * 10)], this.ai && aiSig(), EXO.on, EXO.slots, S.stage, this.open && (SUP.ledger || []).map(e => [e.item, Math.round(e.n), e.where]), SUP.wanted.length]);
    if (s2 === sig) return; sig = s2;
    // the hotbar is the same in both modes. In blueprint mode a dashed row above it lists what can be planned: the same
    // items, whether you hold them or not; what you do not hold goes down as a ghost
    root.className = bp ? 'bp' : '';
    bar.innerHTML = S.inv.slots.slice(0, 9).map((s, i) => slotHtml(s, i === P.slot && !S.plan ? 'sel' : '', `data-a="slot" data-c="p" data-i="${i}" ${s ? `data-tip="${tipOf(s)}"` : ''}`) + `<span class="k">${i + 1}</span></div>`).join('');
    const cur = S.mode === 'combat' ? null : cursorKind(), all = id => { let n = S.count(id); for (const m of F.machines) if (m.kind === 'chest') n += inv.count(m.inv, id); return n; };
    plan.style.display = bp ? 'flex' : 'none';
    if (bp) plan.innerHTML = plannable().map(k => { const c = costOf(k), n = k === 'wall' ? Math.floor(S.count('iron') / c.iron) : S.count(k); return `<div class="slot ${S.plan === k ? 'sel' : ''} ${n >= 1 ? '' : 'gh'}" data-a="plan" data-i="${k}" data-tip="${k}\n${n >= 1 ? 'you hold ' + n + ': the click places it' : 'you hold none: the click plans it, the ai has it made, carried and built'}\ncost  ${fmtCost(c)}${RECIPE[k] ? '\nmade from  ' + fmtCost(RECIPE[k].in) : ''}" style="background-image:url(${iconUrl(k)})"><span class="n">${n >= 1 ? 'x' + n : ''}</span></div>`; }).join('')
      + `<div class="slot ${S.tool === 'clear' ? 'sel' : ''}" data-a="tool" data-i="clear" data-tip="clear terrain (t)\ndrag a rectangle; robots cut it out" style="background-image:url(${iconUrl('clear')})"><span class="k">t</span></div>`;
    bpinfo.innerHTML = bp ? `<b>blueprint mode</b> &nbsp; ${S.tool === 'clear' ? 'clear terrain: drag a rectangle &nbsp; rmb cancel' : cur ? `${cur}: ${S.has(costOf(cur)) ? 'lmb place' : 'lmb plan a ghost'} &nbsp; rmb take back &nbsp; r rotate${cur === 'belt' ? (BP.rot > 0 ? ' &gt;' : ' &lt;') : ''} &nbsp; q pipette` : 'pick from the row, a slot, or q over a machine'} &nbsp; queued ${BP.ghosts.length} &nbsp; tab leaves`
      : cur ? `${cur}: lmb place &nbsp; r rotate${cur === 'belt' ? (BP.rot > 0 ? ' &gt;' : ' &lt;') : ''} &nbsp; q clear the cursor &nbsp; tab plans what you do not hold` : '';
    heldEl.style.display = held ? 'block' : 'none'; if (held) { heldEl.style.backgroundImage = `url(${iconUrl(held.id)})`; heldEl.innerHTML = `<span class="n">${fmtAmt(held.id, held.n)}</span>`; }
    win.style.display = this.open ? 'flex' : 'none'; win.className = this.ai ? 'ai' : ''; if (!this.open) return;
    if (this.ai) { win.innerHTML = aiPanels(); return; }
    const grid = (I, c, cols, from = 0, to = I.slots.length) => `<div class="grid g${cols}">` + I.slots.slice(from, to).map((s, i) => slotHtml(s, '', `data-a="slot" data-c="${c}" data-i="${i + from}" ${s ? `data-tip="${tipOf(s)}"` : ''}`) + '</div>').join('') + '</div>';
    let h = '';
    const m = S.open;
    if (m && m.inv) h += `<div class="pan"><h4>${m.title || m.kind}<b>${inv.mass(m.inv).toFixed(0)} kg</b></h4>${grid(m.inv, 'c', m.inv.slots.length > 12 ? 6 : 4)}<span class="btn" data-a="takeall">take all</span></div>`;
    else if (m) h += machinePanel(m);
    const st = suitStats(), L = SUP.ledger && SUP.ledger.length ? SUP.ledger : ledger(), nb = robots.length, inReach = id => { const r = reachable(id, L, nb); return r.n; }, canMake = r => Object.keys(r.in).every(k => inReach(k) >= r.in[k] - 1e-9);
    h += `<div class="pan"><h4>${st.on ? 'on you: the suit' : 'on you'}<b>${inv.mass(S.inv).toFixed(0)} / ${st.carry} kg</b></h4>${grid(S.inv, 'p', 9, 9)}<div class="sep"></div>${grid(S.inv, 'p', 9, 0, 9)}<div class="sep"></div>`
      + (st.on ? `<div class="row"><span>battery</span><b>${P.bat.wh.toFixed(0)} / ${P.bat.cap} Wh</b></div><div class="row"><span>oxygen</span><b>${P.o2.toFixed(2)} kg</b></div><div class="row"><span>jet propellant</span><b>${P.prop.toFixed(1)} kg</b></div>` : `<div class="row"><span>no suit: about 25 kg before you slow, 60 at most</span></div>`)
      + `<div class="row" style="margin-top:6px;color:rgba(159,179,191,.35)"><span>lmb move &nbsp; rmb split / place one &nbsp; shift quick move</span></div>`
      // in reach: everything the network holds that a robot can bring within the reach time, by category, with where it is and how long it takes
      + `<div class="sep"></div><h4>in reach: the whole network is your inventory<b>${STOCK.reachS} s</b></h4><div id="reach" style="max-height:170px;overflow:hidden">`
      + (nb ? CATS.map(cat => { const es = L.filter(e => !e.hand && ITEMS[e.item].cat === cat).sort((a, b) => a.eta - b.eta); return es.length ? `<div class="qr"><span class="qk" style="width:92px;color:rgba(159,179,191,.45)">${cat}</span><span class="qw" style="min-width:420px;max-width:520px">` + es.slice(0, 6).map(e => `<span data-tip="${e.item}\n${fmtAmt(e.item, e.n) || 'x1'}  ${e.kg.toFixed(1)} kg\n${e.where}\n${e.eta <= STOCK.reachS ? 'a robot brings it in about ' + e.eta.toFixed(0) + ' s' : 'out of reach: ' + e.eta.toFixed(0) + ' s'}" style="${e.eta > STOCK.reachS ? 'opacity:.4' : ''}">${fmtAmt(e.item, e.n) || 'x1'} ${e.item}, ${e.where}, ${e.eta.toFixed(0)} s</span>`).join(' &nbsp;·&nbsp; ') + '</span></div>' : ''; }).join('') || '<div class="qr"><span class="qw">nothing but what you carry</span></div>' : `<div class="qr"><span class="qw">${st.on ? 'no robots yet: only what you carry' : 'nothing answers you: only what you carry'}</span></div>`)
      + `</div></div>`;
    if (st.on) {       // the exosuit: one suit, its slots, what is in them; a part in the inventory that fits a slot is installed with a click
      const fit = S.inv.slots.filter(q => q && SUITPARTS[q.id]).map(q => q.id).filter((v, i, a) => a.indexOf(v) === i);
      h += `<div class="pan" style="min-width:250px"><h4>exosuit ${EXO.id}<b>${(EXO.cond * 100).toFixed(0)}%</b></h4>` + SLOTS.map(k => `<div class="row"><span>${k}</span><b>${EXO.slots[k] || 'empty'}${EXO.wear[k] !== undefined && EXO.wear[k] < 0.99 ? ' ' + (EXO.wear[k] * 100).toFixed(0) + '%' : ''}</b></div>`).join('')
        + `<div class="sep"></div><div class="row"><span>carries</span><b>${st.body.str.toFixed(0)} kg</b></div><div class="row"><span>runs / jumps</span><b>${st.body.speed.toFixed(1)} m/s &nbsp; ${st.body.jump.toFixed(1)} m/s</b></div><div class="row"><span>scanner</span><b>${st.scanR} m, ${st.scanT} s, ±${(st.err * 100).toFixed(0)}%</b></div><div class="row"><span>glove</span><b>x${st.glove.toFixed(1)}</b></div><div class="row"><span>plates stop</span><b>${(st.armour * 100).toFixed(0)}%</b></div><div class="row"><span>laser water pack</span><b>${st.packL ? EXO.water.toFixed(1) + ' / ' + st.packL + ' L' : 'none'}</b></div>`
        + (fit.length ? `<div class="sep"></div>` + fit.map(id => `<span class="btn" data-a="install" data-i="${id}" data-tip="${id}\nfits the ${SUITPARTS[id].slot} slot\nwhat is there now comes back to the inventory">install ${id}</span>`).join('') : '') + `<div class="note" style="max-width:250px">the same suit from here on: parts are swapped, the suit is never replaced.</div></div>`;
    }
    if (st.on) {
      const all = RECIPES.filter(canSee), now = all.filter(r => S.has(r.in)), reach = all.filter(r => !S.has(r.in) && nb && canMake(r)), rest = all.filter(r => !now.includes(r) && !reach.includes(r));
      const cell = (r, cls, note) => { const out = Object.keys(r.out)[0]; return `<div class="slot ${cls} ${ITEMS[out].build ? 'plan' : ''}" data-a="print" data-i="${r.id}" data-tip="${recipeTip(r)}\n${note}" style="background-image:url(${iconUrl(out)})"></div>`; };
      h += `<div class="pan"><h4>craft now: the arm<b>${q.length ? (S.printer.stall || 'printing') : 'idle'}</b></h4><div class="grid g6">` + (now.map(r => cell(r, '', 'lmb: the arm prints it')).join('') || '<div class="slot dim"></div>') + '</div>'
        + (reach.length ? `<div class="sep"></div><h4>from stock in reach<b>the robots bring it</b></h4><div class="grid g6">` + reach.map(r => cell(r, '', 'the material is in reach, not in your hands: lmb orders it. whoever makes it soonest does, and a robot brings it')).join('') + '</div>' : '')
        + (rest.length ? `<div class="sep"></div><h4>can be ordered<b>material is short</b></h4><div class="grid g6">` + rest.map(r => cell(r, 'dim', 'lmb queues it all the same: what is missing becomes demand, down to raw rock')).join('') + '</div>' : '')
        + `<div class="sep"></div><h4>queue<b>${q.length} / 12</b></h4><div class="grid g6" style="min-height:52px">` + q.map((j, i) => `<div class="slot" data-a="unprint" data-i="${i}" data-tip="${j.r}\n${Math.ceil(j.left * 5000 / Math.max(1, P.armW || 5000))} s left${(P.armW || 5000) < 5000 ? ' on the suit bus (0.4 kw): the reactor cable gives the arm 5 kw' : ''}\nclick to cancel: the material comes back" style="background-image:url(${iconUrl(Object.keys(RECIPE[j.r].out)[0])})"><span class="pg"><i style="width:${(100 * (1 - j.left / j.total)).toFixed(0)}%"></i></span></div>`).join('') + `</div>`
        + (SUP.wanted.length ? `<div class="sep"></div><h4>ordered from the network<b>${SUP.wanted.length}</b></h4><div class="grid g6">` + SUP.wanted.map(w => { const o = SUP.orders.find(x => x.item === w.item); return `<div class="slot" data-a="unwant" data-i="${w.id}" data-tip="${w.item} x${w.n}\n${o ? (o.note || 'ordered') + (o.bidNote ? '\nbids: ' + o.bidNote : '') : (SUP.stock && SUP.stock[w.item] >= 1 ? 'in stock: a robot brings it' : 'in the queue')}\nclick to cancel" style="background-image:url(${iconUrl(w.item)})"><span class="n">x${w.n}</span></div>`; }).join('') + '</div>' : '')
        + `<div class="row" style="margin-top:6px;color:rgba(159,179,191,.35)"><span>lmb craft or order &nbsp; shift x5 &nbsp; rmb plan it as a blueprint</span></div></div>`;
    } else h += `<div class="pan"><h4>craft<b>nothing</b></h4><div class="note" style="max-width:260px">the matter compiler is in the arm of the exosuit. without the suit there is nothing to make things with.</div></div>`;
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
const tipOf = s => { const d = ITEMS[s.id]; return `${s.id}\n${fmtAmt(s.id, s.n) || 'x1'}   ${(s.n * d.m).toFixed(d.m * s.n < 10 ? 2 : 1)} kg${d.build ? '\nselect its slot, then lmb places it' : d.place ? '\nrmb places it as terrain' : d.weapon ? '\nc combat mode' : ''}`; };
const recipeTip = r => `${r.id}${ITEMS[Object.keys(r.out)[0]].build ? '   (placeable)' : ''}\nmakes  ${fmtCost(r.out)}\nneeds  ${Object.entries(r.in).map(([k, n]) => `${k} ${fmtAmt(k, n) || 'x1'} (have ${fmtAmt(k, S.count(k)) || 'x' + Math.round(S.count(k))})`).join('\n       ')}\nsuit   ${(r.t * SUIT_SLOW).toFixed(0)} s\n${r.by}  ${r.t} s`;
function machinePanel(m) {
  const rows = o => Object.entries(o || {}).filter(([, n]) => n > 1e-4).map(([k, n]) => `<div class="slot" data-tip="${k}" style="background-image:url(${iconUrl(k)})"><span class="n">${fmtAmt(k, n) || 'x1'}</span></div>`).join('') || '<div class="slot dim"></div>';
  let h = `<div class="pan" style="min-width:236px"><h4>${m.kind}<b>${m.on ? 'running' : 'idle'}</b></h4>`;
  if (m.kind === 'pad') h += `<div class="row"><span>rocket</span><b>${m.n} / ${ROCKET_PARTS} parts</b></div>`;
  else if (m.kind === 'hub') h += `<div class="row"><span>builder drones</span><b>dock a drone here to deploy it</b></div>`;
  else if (m.kind === 'bio-printer') h += `<div class="row"><span>respawn point</span><b>online</b></div><div class="row"><span>suit charging in range</span><b>4 m</b></div>`;
  else { h += `<div class="row"><span>in</span></div><div class="grid g4">${rows(m.inp)}</div><div class="sep"></div><div class="row"><span>out</span></div><div class="grid g4">${rows(m.out)}</div>`;
    if (m.kind === 'assembler') h += `<div class="sep"></div><div class="row"><span>recipe</span><b>${m.recipe}</b></div><div class="grid g4">` + RECIPES.filter(r => r.by === 'assembler' && canSee(r)).map(r => `<div class="slot ${r.id === m.recipe ? 'sel' : ''}" data-a="recipe" data-i="${r.id}" data-tip="${recipeTip(r)}" style="background-image:url(${iconUrl(Object.keys(r.out)[0])})"></div>`).join('') + '</div>';
    if (m.kind === 'furnace') h += `<div class="row" style="margin-top:6px"><span>biomass in the firebox: 2.5x speed, more smoke</span></div>`;
    if (m.kind === 'miner') h += `<div class="row" style="margin-top:6px"><span>bit depth</span><b>${(m.depth || 0).toFixed(1)} m</b></div>`;
    if (m.kind === 'shaft rig') h += `<div class="sep"></div><div class="row"><span>depth</span><b>${(m.depth || 0).toFixed(1)} of ${(m.target || 0).toFixed(1)} m</b></div><div class="row"><span>paid for</span><b>${(m.paid || 0).toFixed(0)} m of rod and casing</b></div><div class="row"><span>head</span><b>${m.head === 'rotary' ? 'rotary: 150 mj/m3' : 'pulse laser: 750 mj/m3'}</b></div><div class="row"><span>hoist</span><b>${m.hoist ? 'skip, 40 kg a trip' : 'none: muck lies at the bottom'}</b></div><div class="row"><span>branches</span><b>${(m.branches || []).map(q => `${q.done.toFixed(1)}/${q.len} m at ${q.depth} m`).join(', ') || 'none'}</b></div><div class="row"><span>${m.wait || (m.on ? 'sinking' : 'at depth')}</span></div><div class="note" style="max-width:236px">tab: drag down from the rig to go deeper, sideways to branch. a rotary head or a hoist line put in here is fitted.</div>`;
    if (m.kind === 'assay station') h += `<div class="row" style="margin-top:6px"><span>crushes, assays and sorts rubble: 6 kw</span></div>`; }
  return h + `<span class="btn" data-a="xfer">put in / take out</span><div class="row" style="margin-top:6px;color:rgba(159,179,191,.35)"><span>click here holding a stack to put it in</span></div></div>`;
}
// ---- the AI's window: the queue with its reasons and its arrows, the stock targets with their editor, logistics
const fmtN = (id, n) => ITEMS[id].u === 'ea' || ITEMS[id].u === 'rd' ? String(Math.round(n)) : n.toFixed(1) + ' kg';
const aiSig = () => [MARKET.blocked.map(q => q.text), LOG.lines.length, STOCK.zones.map(z => [z.id, z.pri, z.limit, z.filter.length, Math.round(zoneKg(z) / 5)]), STOCK.reachS, SUP.orders.map(o => o.bidNote), queueView(robots).map(q => [q.g.id, q.why]), SUP.targets, Object.keys(SUP.targets).map(k => Math.round((SUP.stock && SUP.stock[k] || 0) * 2)), SUP.orders.map(o => o.note), AUTO.routes.map(r => [r.key, r.mode, r.why, Math.round(r.rate * 20), r.missing]), Math.round(AUTO.power.used / 100), Math.round(AUTO.power.supply / 100), robots.map(r => [r.state, Math.round(r.wh)])];
function aiPanels() {
  const qv = queueView(robots), st = SUP.stock || {}, pw = AUTO.power, B = (a, i, ch, tip) => `<span class="qb" data-a="${a}" data-i="${i}" data-tip="${tip}">${ch}</span>`;
  let h = `<div><div class="pan" style="min-width:660px"><h4>ai: the queue<b>${qv.length} order${qv.length === 1 ? '' : 's'}</b></h4>`
    + (qv.length ? qv.slice(0, 12).map(q => `<div class="qr"><span class="qn">${q.n}</span><span class="qi" style="background-image:url(${iconUrl(q.kind === 'wall' ? 'iron' : q.kind)})"></span><span class="qk">${q.kind}${q.auto ? ' <i>ai</i>' : ''}${q.manual ? ' <i>moved</i>' : ''}</span><span class="qw ${/waits for|outside|no power/.test(q.why) ? 'warn' : ''}">${q.why}</span>${B('q-top', q.g.id, '&#8679;', 'build this first')}${B('q-up', q.g.id, '&#8593;', 'one place earlier')}${B('q-dn', q.g.id, '&#8595;', 'one place later')}${B('q-x', q.g.id, '&#215;', 'cancel the order')}</div>`).join('') + (qv.length > 12 ? `<div class="qr"><span class="qw">and ${qv.length - 12} more</span></div>` : '')
      : '<div class="qr"><span class="qw">nothing queued. tab, then place what you do not hold: the ai orders it, has it made, carried and built</span></div>')
    + SUP.orders.slice(0, 5).map(o => `<div class="qr"><span class="qi" style="background-image:url(${iconUrl(o.item)})"></span><span class="qk">${o.item}</span><span class="qw">${o.producer === 'ship' ? 'fabricator' : o.producer === 'suit' ? 'arm' : o.producer}: ${o.note || 'ordered'}${o.bidNote ? ' <i>bids: ' + o.bidNote + '</i>' : ''}</span><span class="qv">${o.need.toFixed(o.need < 10 ? 1 : 0)} for ${o.why}</span></div>`).join('')
    + `<div class="note">order of service: what lets the base expand (network and robots, then mining, smelting, assembly, storage, belts), then the order you placed them. the arrows override it.</div></div><div class="sep"></div>`;
  h += `<div class="pan"><h4>logistics: how it moves, and why<b>base grid ${(pw.used / 1000).toFixed(1)} / ${(pw.supply / 1000).toFixed(1)} kw</b></h4><div class="qr"><span class="qk">power</span><span class="qw ${pw.demand > pw.supply + 1 ? 'warn' : ''}">${pw.note || 'no source'}${pw.demand > pw.supply + 1 ? `: ${(pw.demand / 1000).toFixed(1)} kw wanted, the last in line run slow` : ''}${pw.off ? `   ${pw.off} machine${pw.off > 1 ? 's' : ''} off the grid` : ''}</span></div>`
    + (AUTO.routes.length ? AUTO.routes.map(r => `<div class="qr"><span class="qi" style="background-image:url(${iconUrl(r.item)})"></span><span class="qk">${r.src.kind} &gt; ${r.dst ? r.dst.kind : 'hold'}</span><span class="qw">${r.why}${r.mode === 'belt' ? (r.done ? ' <i>laid</i>' : ` <i>${r.missing} cells queued</i>`) : ''}</span><span class="qv">${r.rate.toFixed(2)} kg/s ${r.dist.toFixed(0)} m</span></div>`).join('') : '<div class="qr"><span class="qw">no steady flow yet: a machine that makes something opens one</span></div>')
    + robots.map(r => { const j = r.job, kg = inv.mass(r.cargo); return `<div class="qr"><span class="qk">${r.kind === 'crawler' ? 'hauler' : 'drone'} ${r.id}</span><span class="qw">${intentOf(r)}${j && j.kind === 'carry' && j.ground ? ' <i>under an overhang</i>' : ''}${r.gave ? ` <i>gave up ${r.gave}x</i>` : ''}</span><span class="qv">${kg > 0.05 ? kg.toFixed(0) + ' / ' + (r.kind === 'crawler' ? CRAWLER.cargo : ROBOT.cargo) + ' kg  ' : ''}${(r.wh / (r.kind === 'crawler' ? CRAWLER.wh : ROBOT.wh) * 100).toFixed(0)}%</span></div>`; }).join('')
    + (MARKET.blocked.length ? MARKET.blocked.map(q => `<div class="qr"><span class="qk">waits</span><span class="qw warn">${q.text}</span></div>`).join('') : '')
    + LOG.lines.slice(-5).map(q => `<div class="qr"><span class="qk" style="color:rgba(159,179,191,.4)">log ${q.at.toFixed(0)} s</span><span class="qw" style="max-width:520px">${q.t}${q.n > 1 ? ' <i>x' + q.n + '</i>' : ''}</span></div>`).join('')
    + `<div class="note">robots against a belt: trip time there and back at loaded speed, ${ROBOT.cargo} kg a trip, against cells to build, iron, ${AUX_W / 1000} kw of bus, level ground and what is awake nearby. the ai lays the belt itself when it wins.</div></div></div>`;
  const cand = RECIPES.filter(canSee).map(r => Object.keys(r.out)[0]).concat(['basalt', 'biomass', 'iron ore', 'water']).filter((k, i, a) => a.indexOf(k) === i && !(k in SUP.targets));
  h += `<div class="pan" style="min-width:430px"><h4>stock targets<b>${SUP.on ? 'the ai keeps these in stock' : 'ai off'}</b></h4>`
    + Object.keys(SUP.targets).map(k => { const have = st[k] || 0, tg = SUP.targets[k], o = SUP.orders.find(q => q.item === k), sh = AUTO.short[k]; return `<div class="qr"><span class="qi" style="background-image:url(${iconUrl(k)})"></span><span class="qk">${k}</span><span class="qw ${have >= tg - 1e-6 ? '' : 'warn'}" style="min-width:150px">${have >= tg - 1e-6 ? 'in stock' : o ? (o.note || 'ordered') : sh ? 'nobody makes it: ' + sh.toFixed(1) + ' short' : 'coming'}</span><span class="qv">${fmtN(k, have)} / ${fmtN(k, tg)}</span>${B('tg-dec', k, '&#8722;', 'lower the target by ' + targetStep(k) + ' (shift x5)')}${B('tg-inc', k, '+', 'raise the target by ' + targetStep(k) + ' (shift x5)')}${B('tg-del', k, '&#215;', 'stop keeping it in stock')}</div>`; }).join('')
    + `<div class="sep"></div><div class="row"><span>keep in stock as well</span></div><div class="grid g6">` + cand.map(k => `<div class="slot" data-a="tg-add" data-i="${k}" data-tip="${k}\nclick: keep ${fmtN(k, targetStep(k) * (ITEMS[k].u === 'ea' ? 1 : 4))} in stock" style="background-image:url(${iconUrl(k)})"></div>`).join('') + `</div>`
    + `<div class="sep"></div><h4>stockpiles<b>the ai makes them; you change them</b></h4>` + STOCK.zones.map(z => `<div class="qr"><span class="qk">${z.name}</span><span class="qw" style="min-width:150px">${['raw'].flatMap(() => ['rubble', 'iron ore', 'lean ore', 'copper ore', 'lumen', 'basalt', 'soil', 'slag', 'biomass']).map(k => `<span data-a="zn-f" data-i="${z.id}|${k}" data-tip="${k}: ${z.filter.includes(k) ? 'taken here. click to stop' : 'not taken here. click to take it'}" style="cursor:pointer;${z.filter.includes(k) ? 'color:rgba(46,242,208,.85)' : 'opacity:.35'}">${k.split(' ')[0].slice(0, 4)}</span>`).join(' ')}</span><span class="qv">${zoneKg(z).toFixed(0)} / ${z.limit} kg &nbsp; p${z.pri}</span>${B('zn-pri', z.id, 'p', 'priority 1 to 3: the higher one fills first')}${B('zn-dn', z.id, '&#8722;', 'limit down 250 kg (shift 1000)')}${B('zn-up', z.id, '+', 'limit up 250 kg (shift 1000)')}${B('zn-del', z.id, '&#215;', 'remove the zone: what lies in it is loose again')}</div>`).join('') + `<span class="btn" data-a="zn-new">new stockpile where you stand</span><span class="btn" data-a="reach" data-i="-1">reach &#8722;15 s</span><span class="btn" data-a="reach" data-i="1">reach +15 s (${STOCK.reachS} s)</span>`
    + `<div class="note">under a target is demand. the ai orders it from the machine that makes it, or from the arm, and the inputs of that become demand too, down to raw rock. j or esc closes.</div></div>`;
  return h;
}
const INV = c => c === 'p' ? S.inv : S.open && S.open.inv;
function act(t, button, shift) {
  const a = t.dataset.a, i = t.dataset.i;
  if (a === 'slot' && !ui.open) { S.P.slot = +i; S.plan = null; }
  else if (a === 'slot') clickSlot(INV(t.dataset.c), +i, button, shift, t.dataset.c);
  else if (a === 'print' && button === 2) { const out = Object.keys(RECIPE[i].out)[0]; if (ITEMS[out].build) { ui.toggle(false); if (S.mode !== 'blueprint') setBlueprint(true); S.plan = out; } }
  // round 6 J: queue anything. With the inputs in your hands the arm prints it; without, it is an order to the network
  else if (a === 'print') { const r = RECIPE[i], out = Object.keys(r.out)[0]; if (S.has(r.in)) { if (!printerQueue(S.printer, S.inv, i, shift ? 5 : 1)) S.say('printer queue is full', 2); } else { orderItem(out, (shift ? 5 : 1) * r.out[out]); S.say(`${out} ordered: the network makes it and brings it`, 3); } }
  else if (a === 'unwant') cancelWant(+i);
  else if (a === 'install') { if (installPart(i)) S.say(i + ' installed', 2.5); }
  else if (a === 'zn-pri') { const z = STOCK.zones.find(q => q.id === +i); if (z) z.pri = z.pri >= 3 ? 1 : z.pri + 1; }
  else if (a === 'zn-up' || a === 'zn-dn') { const z = STOCK.zones.find(q => q.id === +i); if (z) z.limit = Math.max(100, z.limit + (a === 'zn-up' ? 1 : -1) * (shift ? 1000 : 250)); }
  else if (a === 'zn-del') { const k = STOCK.zones.findIndex(q => q.id === +i); if (k >= 0) STOCK.zones.splice(k, 1); }
  else if (a === 'zn-new') { addZone('stockpile ' + STOCK.nextId, ['basalt', 'soil'], S.P.x, 4, 1500); }
  else if (a === 'zn-f') { const [zid, item] = i.split('|'), z = STOCK.zones.find(q => q.id === +zid); if (z) { const k = z.filter.indexOf(item); if (k >= 0) z.filter.splice(k, 1); else z.filter.push(item); } }
  else if (a === 'reach') STOCK.reachS = Math.max(15, Math.min(600, STOCK.reachS + (+i) * 15));
  else if (a === 'unprint') printerCancel(S.printer, S.inv, +i);
  else if (a === 'plan') { S.plan = S.plan === i ? null : i; S.tool = null; }
  else if (a === 'tool') { S.tool = S.tool === i ? null : i; BP.drag = null; }
  else if (a === 'recipe') { const m = S.open; if (m && !m.busy) { for (const k in m.inp) { S.add(k, m.inp[k]); } m.inp = {}; m.recipe = i; } else S.say('wait for the batch to finish', 2); }
  else if (a === 'xfer') { const m = S.open; if (held && m && accepts(m, held.id)) { held.n = give(m, held.id, held.n); if (held.n <= EPS) held = null; } else if (m) quickTransfer(m); }
  else if (a === 'q-top' || a === 'q-up' || a === 'q-dn') { const g = BP.ghosts.find(q => q.id === +i); if (g) bump(g, a === 'q-top' ? -2 : a === 'q-up' ? -1 : 1); }
  else if (a === 'q-x') { const g = BP.ghosts.find(q => q.id === +i); if (g) cancelGhost(g); }
  else if (a === 'tg-inc' || a === 'tg-dec') setTarget(i, (SUP.targets[i] || 0) + (a === 'tg-inc' ? 1 : -1) * targetStep(i) * (shift ? 5 : 1));
  else if (a === 'tg-del') setTarget(i, 0);
  else if (a === 'tg-add') setTarget(i, targetStep(i) * (ITEMS[i].u === 'ea' ? 1 : 4));
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

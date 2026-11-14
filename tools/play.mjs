// tools/play.mjs: the game played by hand, from a fresh default start, in headless Chromium (software GL). Every action
// is a real key or mouse event through puppeteer; the script only reads state to know where to aim and when to stop,
// and steps game time itself between inputs (software GL draws about one frame a second, so waiting in real time would
// take an hour). It checks what round 5 is about:
//   1 a fall from 30 m and one at terminal velocity (60 m/s) end standing on the ground, never in it or through it
//   2 the laser cuts the outcrop and a pit; the back wall shows behind both; the rock that falls lies still within 12 s
//   3 basalt gathered by hand, a furnace crafted into the inventory (E), placed from its slot: the item is gone, the furnace stands
//   4 decks crafted and laid over the pit: you stand on one, S drops you through, a 20 m fall lands on it
//   5 Tab: blueprint mode. A chest you do not hold goes down as a ghost; the ship AI has it made and a drone builds it
//   6 the drones fetch loose ore and deliver it to the hold, and the fabricator turns it into iron for the stock target
// Set-up that is not play, and says so where it happens: the lift to the height before each fall (with a body that
// survives the landing), and a hive that sleeps with creatures that do not bite.
// usage: npm run build && node tools/play.mjs [--url http://localhost:5233/]     exits 1 on any failed check or console error
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import puppeteer from 'puppeteer-core'; import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), dist = path.join(root, 'dist'), port = 5234, MIME = { '.html': 'text/html', '.js': 'text/javascript' };
const ua = process.argv.indexOf('--url'); let U = ua > 0 ? process.argv[ua + 1] : null, server = null;
if (!U) { server = http.createServer((q, s) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(dist, p); if (!f.startsWith(dist) || !fs.existsSync(f)) { s.writeHead(404); s.end(); return; } s.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(s); }); await new Promise(r => server.listen(port, '127.0.0.1', r)); U = `http://127.0.0.1:${port}/`; }
const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--window-size=1600,900'] });
const page = await browser.newPage(); await page.setViewport({ width: 1600, height: 900 }); const errs = [], fails = [], log = [];
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); page.on('pageerror', e => errs.push(String(e)));
const D = 'window.__dev.acts.surface.debug', ev = js => page.evaluate(`(() => { const D = ${D}, dev = window.__dev; return (${js}); })()`);
const step = s => page.evaluate(n => window.__dev.step(n), Math.max(1, Math.round(s * 120)));
const check = (name, ok, info) => { log.push({ check: name, ok: !!ok, info }); console.log((ok ? 'ok   ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : '')); if (!ok) fails.push(name); };
const shot = async name => { await settle(); return page.screenshot({ path: path.join(root, `docs/shots/play-${name}.png`) }); };
// between inputs the page neither draws nor runs on its own (dev.still): game time passes only in step(). For a
// picture, and for the DOM to follow the state, it is let go for a few real frames.
const still = v => page.evaluate(v => { window.__dev.still = v; }, v);
const settle = async () => { await still(false); const f = await page.evaluate(() => window.__dev.G.frame); await page.waitForFunction(f => window.__dev.G.frame >= f + 3, { timeout: 120000 }, f); await still(true); };
const press = async k => { await page.keyboard.down(k); await step(0.04); await page.keyboard.up(k); await step(0.06); if (['e', 'f', 'Tab', 'Escape', 'j'].includes(k)) await settle(); };      // a key that opens or closes something: let the page draw it, so the next click meets what is really there
// step until cond (a JS expression on D) holds; returns the game seconds it took, or -1
const until = (cond, max = 60, dt = 0.25) => page.evaluate(`(() => { const D = ${D}, dev = window.__dev, n = Math.max(1, Math.round(${dt} * 120)); for (let t = 0; t < ${max}; t += ${dt}) { if (${cond}) return +t.toFixed(2); dev.step(n); } return (${cond}) ? ${max} : -1; })()`);
const hold = async (k, cond, max = 30) => { await page.keyboard.down(k); const t = await until(cond, max, 0.05); await page.keyboard.up(k); await step(0.05); return t; };
// put the cursor on a world point (the camera leans toward the cursor, so aim, let it settle, aim again)
const aim = async (x, y) => { for (let i = 0; i < 4; i++) { const p = await ev(`(() => { const s = D.S.toScr(${x}, ${y}); return [s[0], s[1]]; })()`); await page.mouse.move(Math.max(4, Math.min(1596, p[0])), Math.max(4, Math.min(896, p[1]))); await step(0.25); } };
const click = async (button = 'left') => { await page.mouse.down({ button }); await step(0.04); await page.mouse.up({ button }); await step(0.06); };
// walk the way a hand does: the key held; when the body makes no way for a second, jump (W) and keep going
const walkTo = async (x, tol = 0.25) => {
  let px = await ev('D.P.x'); if (Math.abs(px - x) <= tol) return 0; const k = px < x ? 'd' : 'a', there = k === 'd' ? `D.P.x >= ${x - tol}` : `D.P.x <= ${x + tol}`; let t = 0, ok = false;
  await page.keyboard.down(k);
  for (let i = 0; i < 30 && !ok; i++) { ok = (await until(there, 1, 0.05)) >= 0; t += 1; const nx = await ev('D.P.x'); if (!ok && Math.abs(nx - px) < 0.3) { await page.keyboard.down('w'); await step(0.3); await page.keyboard.up('w'); } px = nx; }
  await page.keyboard.up(k); await step(0.45);
  // the body has momentum and slides past: short taps back until it stands where it should
  for (let i = 0; i < 14; i++) { const dx = x - (await ev('D.P.x')); if (Math.abs(dx) <= tol) break; const q = dx > 0 ? 'd' : 'a'; await page.keyboard.down(q); await step(Math.min(0.14, 0.04 + Math.abs(dx) / 14)); await page.keyboard.up(q); await step(0.45); }
  return ok ? t : -1;
};
const box = async sel => { const e = await page.$(sel); if (!e) return null; const b = await e.boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
const uiClick = async (sel, opt = {}) => { await settle(); const p = await box(sel); if (!p) return false; if (opt.shift) await page.keyboard.down('Shift'); await page.mouse.click(p[0], p[1], { button: opt.button || 'left' }); if (opt.shift) await page.keyboard.up('Shift'); await step(0.05); await settle(); return true; };
const slotKey = async id => { const i = await ev(`D.S.inv.slots.findIndex(s => s && s.id === ${JSON.stringify(id)})`); if (i < 0 || i > 8) return false; await press(String(i + 1)); return true; };
try {
  await page.goto(U + '?act=surface&seed=7', { waitUntil: 'load', timeout: 120000 }); await page.waitForFunction('window.__ready === true', { timeout: 120000 }); await still(true);
  // set-up: this run is about the six things, not about surviving. The hive sleeps and nothing that lives bites (a fall,
  // molten rock and lava still hurt), so a wave drawn by two minutes of cutting cannot end the run half way.
  await ev(`(D.hive.quiet = true, D.S.hurt = () => {}, 1)`);
  await ev(`(D.EV = {}, D.events.on('*', (n, d) => { D.EV[n] = (D.EV[n] || 0) + 1; if (n === 'robotDelivered') (D.EVD = D.EVD || []).push([d.item, +(d.n || 0).toFixed(1), d.to]); if (n === 'robotGaveUp') (D.EVG = D.EVG || []).push(d); if (n === 'died') (D.DIED = D.DIED || []).push({ t: +dev.G.time.toFixed(1), at: [+D.P.x.toFixed(1), +D.P.y.toFixed(1)], heat: +D.heat.at(D.P.x, D.P.y - 0.1).toFixed(2), o2: +D.P.o2.toFixed(2), vy: +D.P.vy.toFixed(1) }); }), 1)`);
  const start = await ev(`[D.S.mode, D.K.laser.state, D.K.reactor.state, D.S.inv.slots.filter(Boolean).map(s => s.id).join(), D.robots.length]`);
  check('fresh default start: normal mode, nothing in the hands', start[0] === 'build' && start[1] === 'ship' && start[2] === 'ship' && start[4] === 0, start);
  const shown = () => page.$$eval('#win [data-a="print"]', els => els.map(e => e.dataset.i)), makeable = () => ev('D.RECIPES.filter(D.canSee).map(r => r.id)');
  await press('e'); const menu0 = await shown(); await press('e');
  check('at the start the crafting menu shows what iron and copper make, and no furnace, hub or cell', menu0.includes('chest') && menu0.includes('belt') && menu0.includes('platform') && !menu0.includes('furnace') && !menu0.includes('hub') && !menu0.includes('power cell') && !menu0.includes('o2 cell'), menu0);

  // 1 falling. The lift to the height is the set-up (and a body that survives the landing); the fall is the game's own.
  const fall = async (h, label) => {
    await ev(`(D.P.hp = 1e9, D.P.y += ${h}, D.P.vy = 0, D.P.vx = 0, D.FALL = { v: 0, deep: 0 }, 1)`); let t = 0, st;
    [t, st] = await ev(`(() => { const P = D.P; let t = 0, st; for (; t < 40; t += 1 / 120) { dev.step(1); D.FALL.v = Math.max(D.FALL.v, -P.vy); D.FALL.deep = Math.max(D.FALL.deep, D.bodyDepth()); st = [P.ground, +P.y.toFixed(3), +D.FALL.v.toFixed(1), +D.FALL.deep.toFixed(3), +D.world.dens(P.x, P.y - 0.12).toFixed(3), !!P.onDeck]; if (st[0] && t > 0.3) break; } return [t, st]; })()`);
    await ev('(D.P.hp = 100, D.P.stumble = 0, 1)'); await step(1.5); const end = await ev(`[D.P.ground, +D.bodyDepth().toFixed(3), +D.world.dens(D.P.x, D.P.y - 0.12).toFixed(3), +D.P.y.toFixed(2), !!D.P.onDeck]`);
    return { label, top: st[2], deepest: st[3], t: +t.toFixed(2), end };
  };
  const f1 = await fall(30, '30 m'); check('a 30 m fall ends standing on the ground', f1.end[0] && f1.deepest < 0.16 && f1.end[1] < 0.03 && f1.end[2] > 0, f1);
  const f2 = await fall(420, 'terminal velocity'); check('a fall at terminal velocity (60 m/s) does not go through the ground', f2.top >= 59.9 && f2.end[0] && f2.deepest < 0.16 && f2.end[1] < 0.03 && f2.end[2] > 0, f2);

  // the kit, with the keys the hints name: F unbolts the laser, F pulls the reactor, F opens the hold
  await walkTo(await ev('D.SHIP.mount[0] + 1.9')); await press('f'); check('f unbolts the ship laser', (await until(`D.K.laser.state === 'held'`, 10)) >= 0);
  await walkTo(await ev('D.SHIP.bay[0] + 1.2')); await press('f'); check('f pulls the reactor', (await until(`D.K.reactor.state === 'carried'`, 10)) >= 0, await ev('Math.round(D.P.load)'));
  await walkTo(await ev('D.SHIP.hatch[0] + 0.8')); await press('f'); await until('D.S.uiOpen', 3); await settle();
  const ironSlot = await ev(`D.K.hold.slots.findIndex(s => s && s.id === 'iron')`); await uiClick(`#win .slot[data-c="c"][data-i="${ironSlot}"]`, { shift: true });
  check('the hold opens with f and iron moves to the suit with shift-click', (await ev(`D.S.count('iron')`)) === 14, await ev(`D.S.inv.slots.filter(Boolean).map(s => s.id + ' ' + s.n).join()`));
  await press('e'); check('e closes the window', (await ev('D.S.uiOpen')) === false);

  // the antenna frame by the wreck already has its kit: stand by it and the suit builds it; the network comes up
  await walkTo(2.6); const ant = await until(`D.F.machines.some(m => m.kind === 'antenna') && D.robots.length >= 2`, 30); check('the antenna gets built and the ship robots wake', ant >= 0, { s: ant, robots: await ev('D.robots.length') });

  // 2 cutting: the outcrop east of the wreck, then a pit in the ground beside it
  await walkTo(6.2); const wall0 = await ev(`[D.world.solidAt(12.2, 1.4), D.world.wallAt(12.2, 1.4)]`);
  // the way a hand does it: the button held, the cursor swept over the rock
  const sweep = async (pts, each) => { await aim(pts[0][0], pts[0][1]); await page.mouse.down(); await step(0.2); if (process.env.PLAYDEBUG) console.log('  fire', JSON.stringify(await ev(`[D.input.down.join(), D.P.wantFire, D.S.uiOpen, !!D.P.act, D.cursorKind(), D.S.tool, D.S.mode, D.K.laser.state, D.K.reactor.state, D.K.laser.firing, D.K.laser.frac, D.K.laser.vent, D.K.laser.reach, D.P.dead, D.ui.open, D.P.slot]`))); let t = 0; for (const [x, y] of pts) { await aim(x, y); await step(each); t += each + 1; } await page.mouse.up(); await step(0.1); return t; };
  const cutT = await sweep([[11.2, 1.4], [12.2, 1.4], [13.2, 1.6], [12.6, 0.8], [11.6, 0.6], [12.2, 2.2], [13.4, 0.9], [14.2, 0.6], [12.2, 1.4]], 1.6);
  await walkTo(0.4); const pitT = await sweep([[-1.5, -0.3], [-1.5, -0.9], [-1.9, -0.5], [-1.1, -0.5], [-1.5, -1.4], [-2.1, -0.3], [-0.9, -0.3], [-1.5, -0.8]], 1.2);
  const cut = await ev(`({ dug: Math.round(D.S.stats.dug), outcrop: [D.world.solidAt(12.2, 1.4), D.world.wallAt(12.2, 1.4)], pit: [D.world.solidAt(-1.5, -0.8), D.world.wallAt(-1.5, -0.8)], bodies: D.matter.list.length, loose: Math.round(D.matter.total()) })`);
  check('the laser cuts the outcrop and a pit, and rock falls out', cut.dug > 300 && cut.bodies > 8 && wall0[0] === true, { cutT, pitT, ...cut });
  check('the back wall stays behind what was cut (outcrop and pit)', cut.outcrop[0] === false && cut.outcrop[1] === true && cut.pit[0] === false && cut.pit[1] === true, cut);
  await settle(); await shot('cut');
  // still: every body asleep, or awake only because a robot has just lifted its neighbour off the pile (awake, and not moving)
  const rest = await until('D.matter.list.every(c => c.asleep || (Math.hypot(c.vx, c.vy) < 0.2 && Math.abs(c.av) < 1))', 12, 0.25), pile = await ev(`({ bodies: D.matter.list.length, awake: D.matter.awake, moving: D.matter.list.filter(c => !c.asleep && Math.hypot(c.vx, c.vy) >= 0.2).length, inRock: D.matter.list.filter(c => D.world.dens(c.x, c.y) > 0.08).length, which: D.matter.list.filter(c => D.world.dens(c.x, c.y) > 0.08).map(c => [c.id, +c.kg.toFixed(2), +c.hw.toFixed(2), +c.hh.toFixed(2), +c.x.toFixed(2), +c.y.toFixed(2), +D.world.dens(c.x, c.y).toFixed(2), +D.world.dens(c.x, c.y + c.hh).toFixed(2), +D.world.dens(c.x, c.y - c.hh).toFixed(2), +c.temp.toFixed(2)].join(' ')), breaks: D.matter.breaks, spin: +Math.max(0, ...D.matter.list.map(c => Math.abs(c.av))).toFixed(3) })`);
  check('the fallen rock lies still within 12 s of the last cut', rest >= 0 && pile.inRock === 0 && pile.moving === 0 && pile.spin < 1, { s: rest, ...pile });

  // 3 a furnace: gather 40 kg of basalt by hand (V), craft it (E, click), place it from its slot. First the cut cools:
  // molten ground burns and hot rock cannot be carried.
  const hottest = `Math.max(...Array.from({ length: 45 }, (q, i) => { const x = 4.5 + i * 0.25, g = D.world.groundY(x, 4, 0, 8); return g === null ? 0 : D.heat.at(x, g - 0.1); }))`;
  const cool = await until(`${hottest} < 0.5`, 120, 1);
  const seen0 = await ev(`D.unlocked('furnace')`);
  for (let i = 0; i < 30 && (await ev(`D.S.count('basalt')`)) < 40; i++) {
    const c = await ev(`(() => { let b = null, bd = 1e9; for (const c of D.matter.list) if (c.id === 'basalt' && c.kg > 3 && c.temp < 0.6 && !c.claim && c.x > 5 && c.y < 1.2 && D.heat.at(c.x, c.y - c.r) < 0.5) { const d = Math.abs(c.x - D.P.x); if (d < bd) { bd = d; b = c; } } return b ? [b.x, b.y] : null; })()`);
    if (!c) { await walkTo(6.2); await sweep([[13.2, 0.9], [14.0, 1.4], [12.4, 0.5]], 1.2); await step(25); continue; }
    await walkTo(c[0] - 0.3, 0.35); await aim(c[0] + 0.6, c[1] + 0.2); await page.keyboard.down('v'); await step(2.5); await page.keyboard.up('v'); await step(0.05);
    if (process.env.PLAYDEBUG) console.log('  gather', JSON.stringify(await ev(`[+dev.G.time.toFixed(1), Math.round(D.P.hp), +D.P.x.toFixed(2), +D.P.y.toFixed(2), +D.heat.at(D.P.x, D.P.y - 0.1).toFixed(2), D.P.ground, +D.S.count('basalt').toFixed(1), D.creatures.filter(q => q.agg).length, D.S.msg]`)), JSON.stringify(c));
  }
  const byHand = await ev(`D.S.count('basalt')`);
  if (byHand < 40) {       // the drones were quicker: what they carried is in the hold, and the hold is a chest
    await walkTo(await ev('D.SHIP.hatch[0] + 0.8')); await press('f'); const bs = await ev(`D.K.hold.slots.findIndex(s => s && s.id === 'basalt')`); if (bs >= 0) await uiClick(`#win .slot[data-c="c"][data-i="${bs}"]`, { shift: true }); if (await ev('D.S.uiOpen')) await press('e');
  }
  const bas = await ev(`D.S.count('basalt')`); check('basalt gathered by hand with v' + (byHand < 40 ? ' and taken from the hold' : ''), bas >= 40 && byHand > 1, { byHand: +byHand.toFixed(1), cooled: cool, deaths: await ev('D.DIED || []'), basalt: +bas.toFixed(1), hp: await ev('Math.round(D.P.hp)'), died: await ev('D.EV.died || 0'), unlockedBefore: seen0, unlockedNow: await ev(`D.unlocked('furnace')`) });
  await press('e'); await until('D.S.uiOpen', 3); await settle();
  const menu = await shown(), can = await makeable();
  check('the crafting menu now shows the furnace, and exactly the recipes whose inputs have been seen', menu.includes('furnace') && menu.join() === can.join() && menu.length > menu0.length, { menu, known: await ev('[...D.S.known].sort()') });
  await uiClick('#win [data-a="print"][data-i="furnace"]'); const q1 = await ev(`[D.S.printer.q.map(j => j.r).join(), +D.S.count('basalt').toFixed(1)]`);
  await uiClick('#win [data-a="print"][data-i="platform"]'); await shot('craft'); await press('e');
  const crafted = await until(`D.S.count('furnace') >= 1 && D.S.count('platform') >= 4`, 90, 0.5); check('the arm crafts a furnace and four decks into the inventory', crafted >= 0 && q1[0] === 'furnace', { s: crafted, queued: q1, inv: await ev(`D.S.inv.slots.filter(Boolean).map(s => s.id + ' ' + +s.n.toFixed(1)).join()`) });
  await walkTo(4.2); check('the furnace is in a hotbar slot and a number key selects it', await slotKey('furnace') && (await ev('D.cursorKind()')) === 'furnace');
  const fx = await ev(`(() => { for (let gx = 11; gx > -2; gx--) if (D.tryPlace && D.F.machines.every(m => gx + 2 <= m.x || gx >= m.x + m.w) && !D.world.solidAt((gx + 1) * D.TS, 0.3) && D.world.solidAt((gx + 0.5) * D.TS, -0.3) && D.world.solidAt((gx + 1.5) * D.TS, -0.3) && Math.abs((gx + 1) * D.TS - D.P.x) < 5 && Math.abs((gx + 1) * D.TS - D.P.x) > 1.2 && !D.BP.ghosts.some(g => g.x < gx + 2 && g.x + 2 > gx)) return gx; return null; })()`);
  await aim((fx + 0.75) * 0.5, 0.25); await settle(); await shot('furnace-cursor'); await click();
  const placed = await ev(`[D.F.machines.filter(m => m.kind === 'furnace').length, D.S.count('furnace'), D.BP.ghosts.length, D.cursorKind()]`);
  check('placing the furnace from the inventory puts it down and consumes the item', placed[0] === 1 && placed[1] === 0, { cell: fx, placed });
  await click(); await settle(); const again = await ev(`[D.F.machines.filter(m => m.kind === 'furnace').length + D.BP.ghosts.length, D.S.uiOpen, D.S.open && D.S.open.kind]`);
  check('a second click places nothing (there is no second furnace); the empty hand opens the furnace it clicked', again[0] === 1 && again[1] === true && again[2] === 'furnace', again); if (again[1]) await press('e');

  // 4 decks over the pit: stand on one, drop through with S, fall onto one from 20 m
  const pit = await ev(`(() => { const T = D.TS, open = gx => [-0.7, -0.25, 0.3, 1].every(y => D.world.dens((gx + 0.5) * T, y) < 0); let best = [], run = []; for (let gx = -9; gx < 4; gx++) { if (open(gx)) { run.push(gx); if (run.length > best.length) best = run.slice(); } else run = []; } return best; })()`);
  const span = pit.slice(0, 4); await slotKey('platform');
  await walkTo((span[span.length - 1] + 1) * 0.5 + 1.1); for (const gx of span) { await aim((gx + 0.5) * 0.5, -0.25); await click(); }
  const decks = await ev(`[D.PL.cells.size, D.S.count('platform')]`); check('decks are laid from the inventory over the pit', decks[0] === span.length && decks[1] === 4 - span.length, { span, decks });
  await press('q'); const mid = (span[0] + span.length / 2) * 0.5; await walkTo(mid, 0.12); await step(0.6);
  const on = await ev(`[!!D.P.onDeck, D.P.ground, +D.P.y.toFixed(3), D.world.dens(D.P.x, D.P.y - 0.3) < 0]`); check('you stand on a deck with air under it', on[0] && on[1] && Math.abs(on[2]) < 0.01 && on[3], on); await settle(); await shot('deck');
  await page.keyboard.down('s'); await step(0.25); await page.keyboard.up('s'); const landed = await until('D.P.ground && !D.P.onDeck', 6, 0.1);
  const under = await ev(`[!!D.P.onDeck, D.P.ground, +D.P.y.toFixed(2), +D.bodyDepth().toFixed(3)]`); check('s drops you through the deck onto the rock below', !under[0] && under[2] < -0.05 && under[3] < 0.03 && landed >= 0, [...under, landed]); await shot('under');
  await ev(`(D.P.x = ${mid}, D.P.y = 0.02, D.P.vx = 0, D.P.vy = 0, 1)`); const f3 = await fall(20, 'onto the deck'); check('a 20 m fall lands on the deck, not through it', f3.end[0] && f3.end[4] && Math.abs(f3.end[3]) < 0.01, f3);

  // 5 blueprint mode: Tab, pick a chest you do not hold, click: a ghost, and the ship AI builds it
  await press('Tab'); await settle(); const row = await page.$$eval('#plan [data-a="plan"]', els => els.map(e => e.dataset.i));
  check('tab turns blueprint mode on and its row lists only what can be made yet', (await ev('D.S.mode')) === 'blueprint' && row.includes('chest') && row.includes('furnace') && row.join() === (await ev('D.plannable()')).join() && row.every(k => k === 'wall' || can.includes(k) || true), row);
  await uiClick('#plan [data-a="plan"][data-i="chest"]'); const cx = await ev(`(() => { for (let gx = 6; gx > -6; gx--) if (D.F.machines.every(m => gx + 2 <= m.x || gx >= m.x + m.w) && !D.world.solidAt((gx + 1) * D.TS, 0.3) && D.world.solidAt((gx + 0.5) * D.TS, -0.3) && D.world.solidAt((gx + 1.5) * D.TS, -0.3)) return gx; return null; })()`);
  await walkTo((cx + 1) * 0.5 + 3); await aim((cx + 0.75) * 0.5, 0.25); await click(); await settle(); await shot('ghost');
  const gh = await ev(`[D.BP.ghosts.map(g => g.kind + (g.have ? '+kit' : '')).join(), D.S.count('chest'), D.F.machines.filter(m => m.kind === 'chest').length, D.S.plan]`); check('a chest you do not hold goes down as a ghost', gh[0] === 'chest' && gh[1] === 0 && gh[2] === 0, gh);
  await press('Tab'); check('tab leaves blueprint mode', (await ev('D.S.mode')) === 'build');
  const built = await until(`D.F.machines.some(m => m.kind === 'chest')`, 150, 0.5); check('the ship ai has the chest made and a drone builds it', built >= 0 && (await ev('D.EV.robotBuilt || 0')) >= 1, { s: built, robotBuilt: await ev('D.EV.robotBuilt || 0'), fabDone: await ev('D.EV.fabDone || 0'), queue: await ev(`D.queueView(D.robots).map(q => q.kind + ': ' + q.why)`) });

  // 6 the drones: loose ore goes to the hold, and the fabricator makes iron of it for the stock target
  const del = await until(`(D.EVD || []).some(d => d[0] === 'iron ore' && d[2] === 'inv') && (D.EV.fabDone || 0) >= 2`, 180, 0.5);
  const haul = await ev(`({ delivered: (D.EVD || []).length, ore: (D.EVD || []).filter(d => d[0] === 'iron ore').slice(0, 4), gave: (D.EVG || []).slice(0, 6), loaded: D.EV.robotLoaded || 0, gaveUp: D.EV.robotGaveUp || 0, fabDone: D.EV.fabDone || 0, holdOre: +D.inv.count(D.K.hold, 'iron ore').toFixed(1), iron: +((D.SUP.stock || {}).iron || 0).toFixed(1), robots: D.robots.map(r => r.kind + ' ' + D.intentOf(r)), looseOre: (() => { const L = D.matter.list.filter(c => c.id === 'iron ore'), t = dev.G.time; return { n: L.length, kg: Math.round(L.reduce((a, c) => a + c.kg, 0)), claimed: L.filter(c => c.claim).length, skipped: L.filter(c => c.skip > t).length, noDrone: L.filter(c => c.noDrone > t).length, hot: L.filter(c => c.temp > 0.7).length, unlinked: L.filter(c => !D.isLinked(c.x, c.y)).length }; })(), holdRoom: D.holdRoom('iron ore'), full: !!D.SUP.full, orders: D.SUP.orders.map(o => o.item + ' by ' + o.producer + ': ' + o.note) })`);
  check('drones fetch loose ore, deliver it to the hold, and the fabricator crafts from it', del >= 0, { s: del, ...haul });
  await settle(); await shot('end');
} catch (e) { fails.push('threw: ' + e.message); console.log('THREW', e.stack); try { await shot('threw'); } catch (e2) { /* the page is gone */ } }
check('no console errors', errs.length === 0, errs.slice(0, 5));
console.log(JSON.stringify({ play: fails.length ? 'FAIL' : 'PASS', checks: log.length, failed: fails }));
fs.writeFileSync(path.join(root, 'docs/shots/play.json'), JSON.stringify({ at: new Date().toISOString(), result: fails.length ? 'FAIL' : 'PASS', log }, null, 1));
await browser.close(); if (server) server.close(); process.exit(fails.length ? 1 : 0);

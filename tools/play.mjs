// tools/play.mjs: the game played by hand, from a fresh default start, in headless Chromium (software GL). Every action
// is a real key or mouse event through puppeteer; the script only reads state to know where to aim and when to stop,
// and steps game time itself between inputs (software GL draws about one frame a second, so waiting in real time would
// take an hour). Round 6: it plays the new start, with the forest and the hive as they are (nothing is switched off):
//   1 you wake inside the wreck without the suit: no instruments, no robots, a slow body that cannot move the reactor
//   2 you find the exosuit in its locker and put it on; the boot brings the one AI up and releases the robots
//   3 the ship laser and the reactor come out of the wreck (now the suit can lift them)
//   4 the first scan (hold H): the outcrop is known within the scanner's range, and it cost data
//   5 a kerf through the outcrop (K, the reactor set down for its coolant line): the block it cuts loose falls out
//   6 the first craft from stock in reach: a furnace ordered from rock that lies loose; robots fetch it, the fabricator
//     makes it, a robot brings it, and it is placed. Not one robot gives a job up.
//   7 a mining order: a pit cut by hand, a drift marked from it (Tab, T); the drones cut it, the AI plans the support
//     itself, has a steel set made and a drone sets it
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
  await ev(`(D.EV = {}, D.EVG = [], D.EVD = [], D.events.on('*', (n, d) => { D.EV[n] = (D.EV[n] || 0) + 1; if (n === 'robotDelivered') D.EVD.push([d.item, +(d.n || 0).toFixed(1), d.to, d.by]); if (n === 'robotGaveUp') D.EVG.push(d); if (n === 'collapse') (D.EVC = D.EVC || []).push([+d.x.toFixed(1), +d.y.toFixed(1), +d.span.toFixed(1), +d.kg.toFixed(0)]); if (n === 'died') (D.DIED = D.DIED || []).push({ t: +dev.G.time.toFixed(1), at: [+D.P.x.toFixed(1), +D.P.y.toFixed(1)], hp: D.P.hp }); }), 1)`);
  const EVN = n => ev(`D.EV[${JSON.stringify(n)}] || 0`);
  // 1 awake in the wreck, without the suit
  const s0 = await ev(`({ inside: D.WRECK.inside, suit: D.EXO.on, boot: D.BOOT.done, robots: D.robots.length, laser: D.K.laser.state, reactor: D.K.reactor.state, stage: D.S.stage, quiet: !!D.hive.quiet, creatures: D.creatures.length, inv: D.S.inv.slots.filter(Boolean).length, next: D.nextSteps().map(q => q.do) })`);
  check('you wake inside the wreck without the suit: no robots, nothing in the hands, the hive and the forest as they are', s0.inside && !s0.suit && !s0.boot && s0.robots === 0 && s0.laser === 'ship' && s0.reactor === 'ship' && s0.stage === 1 && !s0.quiet && s0.creatures > 0 && s0.inv === 0 && /exosuit/.test(s0.next[0]), s0);
  await step(2.6); await shot('wake');
  await press('e'); const menu0 = await page.$$eval('#win [data-a="print"]', els => els.length), noArm = await page.$eval('#win', e => /matter compiler is in the arm/i.test(e.textContent)); await press('e');
  check('without the suit there is nothing to craft with, and no ai window', menu0 === 0 && noArm && !(await (async () => { await press('j'); const o = await ev('D.ui.open'); if (o) await press('Escape'); return o; })()), { recipes: menu0 });
  // a weak body: how fast it walks, and the reactor it cannot move
  const bayX = await ev('D.SHIP.bay[0]'); await page.keyboard.down('a'); await step(1.2); const vBare = Math.abs(await ev('D.P.vx')); await page.keyboard.up('a'); await step(0.3);
  await walkTo(bayX + 0.4, 0.4); await press('f'); await step(3); const s1 = await ev(`({ reactor: D.K.reactor.state, msg: D.S.msg, speed: D.P.mob.speed, jet: D.P.mob.jet, carry: D.S.carry })`);
  check('the bare body is slow and weak: it cannot move the 140 kg reactor', vBare > 1.5 && vBare < 3.2 && s1.reactor === 'ship' && /exosuit/.test(s1.msg) && s1.jet === 0 && s1.carry === 60, { v: +vBare.toFixed(2), ...s1 });
  // 2 the suit, and the boot
  const lockX = await ev(`D.toWorld(D.partNamed('suit locker').lx, 0)[0]`); await walkTo(lockX + 0.1, 0.3); const hint = await ev(`D.wreckHint ? '' : ''`);
  await press('f'); const tSuit = await until('D.EXO.on', 8, 0.1); await step(2.9); await shot('boot'); const mid = await ev('({ t: D.BOOT.t, shown: D.BOOT.shown, done: D.BOOT.done })');
  const tBoot = await until('D.BOOT.done', 12, 0.1); await step(1.5);
  const s2 = await ev(`({ robots: D.robots.map(r => r.kind), awake: D.K.awake, lamp: D.light.lamp.on, link: !!D.K.net.player, mast: D.K.net.antennas[0].range, stage: D.S.stage, ant: D.F.machines.length + D.BP.ghosts.length, str: D.P.st.body.str, id: D.EXO.id, known: [...D.S.known] })`);
  check('the suit is found in its locker and put on; the boot comes up line by line', tSuit >= 0 && mid.shown >= 3 && !mid.done && tBoot >= 0, { tSuit, mid, tBoot });
  check('the one ai is up: the drones and the hauler are released at once, on the ship\'s own antenna, with no antenna built', s2.robots.length === 3 && s2.robots.includes('crawler') && s2.awake && s2.link && s2.mast >= 1000 && s2.ant === 0 && s2.lamp && s2.stage === 2 && s2.str === 300, s2);
  await press('e'); const menu1 = await page.$$eval('#win [data-a="print"]', els => els.map(e => e.dataset.i)), reachTxt = await page.$eval('#reach', e => e.textContent); await shot('reach'); await press('e');
  check('the menus show what can be done now and nothing from later: no launch pad, no bio-printer; the hold is in reach', menu1.length >= 6 && !menu1.includes('pad') && !menu1.includes('bio-printer') && menu1.includes('chest') && /hold/.test(reachTxt) && /iron/.test(reachTxt), { menu: menu1, reach: reachTxt.slice(0, 160) });
  // 3 out through the torn tail, the laser, the reactor
  const doorX = await ev('D.toWorld(D.HULL.door, 0)[0]'); await walkTo(doorX + 0.3, 0.4); await press('w'); await step(0.4); const out = !(await ev('D.WRECK.inside'));
  const mountX = await ev('D.SHIP.mount[0]'); await walkTo(mountX + 1.8, 0.4); await press('f'); const tL = await until('D.K.laser.state === "held"', 6, 0.1);
  await walkTo(bayX + 1.5, 0.4); await press('f'); const tR = await until('D.K.reactor.state === "carried"', 6, 0.1); await step(0.5); const load = await ev('D.P.load');
  check('w steps out of the wreck; the suit unbolts the laser and pulls the reactor', out && tL >= 0 && tR >= 0 && load > 170, { out, tL, tR, load: +load.toFixed(0) });
  // 4 the first scan
  await walkTo(8.9, 0.4); await aim(12.3, 1.5); const gb0 = await ev('D.FOG.usedGB'), est0 = await ev('(() => { const e = D.estimate(D.world.matAt(12.3, 1.5), 12.3, 1.5, 0); return [e.lo, e.hi]; })()');
  await page.keyboard.down('h'); const tScan = await until('D.GEO.scans >= 1', 8, 0.05); await step(0.2); await shot('scan'); await aim(13.5, 2.3); const tScan2 = await until('D.GEO.scans >= 2', 8, 0.05); await page.keyboard.up('h'); await step(0.3);
  const sc = await ev('(() => { const x = 12.3, y = 1.5, m = D.world.matAt(x, y), q = D.composition(m, x, y), e = D.estimate(m, x, y, D.levelAt(x, y)); return { level: D.levelAt(x, y), truth: q.fe, lo: e.lo, hi: e.hi, gb: D.FOG.usedGB, finds: D.FOG.finds.size, cap: D.FOG.capGB }; })()');
  check('the first scan (hold h): the rock is known within the scanner\'s range, narrower than the guess, and it cost data', tScan >= 0 && tScan2 >= 0 && sc.level === 1 && sc.truth >= sc.lo && sc.truth <= sc.hi && sc.hi - sc.lo < est0[1] - est0[0] && sc.gb > gb0 + 5 && sc.finds > 4, { tScan, ...sc, guess: est0 });
  // 5 the kerf: the reactor set down (its coolant line), the laser in kerf mode, slots through the shoulder of the outcrop
  await walkTo(9.3, 0.3); await press('x'); await until('D.K.reactor.state === "ground"', 4, 0.1); await press('k'); const mode = await ev('D.K.laser.mode');
  // the way a block is quarried: an undercut from the ground into the foot of the outcrop, then up onto it (the jet lifts you
  // with the laser alone; the reactor stays down) and a second slot from the top to meet the first. What they cut off falls.
  let cuts = 0; await aim(12.5, 0.35); await step(0.6); let p0 = await ev('D.K.laser.pulses'); await page.mouse.down(); await until(`D.K.laser.pulses >= ${p0 + 40}`, 14, 0.05); await page.mouse.up(); await step(0.6); cuts++; await shot('kerf');
  await page.keyboard.down(' '); const tJet = await until('D.P.y > 4.2', 8, 0.05), dbg = await ev('[D.P.x, D.P.y, D.P.prop, D.P.ground, D.P.load, D.P.mob.jet, D.input.keys.has(" "), !!D.P.act, D.S.uiOpen, D.S.mode, [...D.input.keys]]'); console.log('JET', tJet, JSON.stringify(dbg)); await page.keyboard.down('d'); const t1 = await until('D.P.x > 10.5', 5, 0.05), d1 = await ev('[D.P.x, D.P.y, D.P.vx, D.P.vy]'); await page.keyboard.up('d'); await page.keyboard.down('a'); const t2 = await until('D.P.vx < 0.6', 2, 0.05), d2 = await ev('[D.P.x, D.P.y, D.P.vx, D.P.vy]'); await page.keyboard.up('a'); await page.keyboard.up(' '); const t3 = await until('D.P.ground', 6, 0.05), d3 = await ev('[D.P.x, D.P.y, D.P.vx, D.P.vy]'); await step(1); for (let i = 0; i < 40 && (await ev('D.P.x')) > 13.1; i++) { await page.keyboard.down('a'); await step(0.12); await page.keyboard.up('a'); await step(0.35); } await step(0.8);       // short steps along the top: it is a narrow place to stand
  const top = await ev('[D.P.x, D.P.y, D.P.ground, D.K.laser.reach]'); const f0 = await ev('D.MINE.freed');
  for (const off of [0.95, 1.25, 0.75]) { if ((await ev('D.MINE.freed')) > f0 + 15) break; await aim(top[0] - off, top[1] - 1.1); await step(0.6); p0 = await ev('D.K.laser.pulses'); await page.mouse.down(); await until(`D.MINE.freed > ${f0 + 15} || D.K.laser.pulses >= ${p0 + 42}`, 14, 0.05); await page.mouse.up(); await step(1.5); cuts++; }
  await step(4); const kf = await ev(`({ freed: D.MINE.freed, pulses: D.K.laser.pulses, kerfs: D.MINE.kerfs.length, loose: D.matter.list.filter(c => c.id === 'basalt' || c.id === 'lean ore' || c.id === 'iron ore').reduce((a, c) => a + c.kg, 0), rubble: D.matter.total('rubble'), pieces: D.matter.list.filter(c => c.kg > 3).length, heat: D.K.laser.heat, loop: D.K.laser.loop, hp: D.P.hp, ks: D.MINE.kerfs.map(k => [+k.x0.toFixed(2), +k.y0.toFixed(2), +Math.atan2(k.dy, k.dx).toFixed(2), +k.len.toFixed(2)]), at: [+D.P.x.toFixed(2), +D.P.gx.toFixed(2), +D.P.gy.toFixed(2)] })`);
  check('k switches the laser to kerf; an undercut and a slot from the top cut a block loose, and it falls out as rock that is known', mode === 'kerf' && kf.freed >= 40 && kf.loose >= 30 && kf.pieces >= 3 && top[2] && top[3], { cuts, top, ...kf }); await shot('blocks');
  if (process.env.PLAY_STOP === 'kerf') throw new Error('stopped after the kerf');
  await press('k');
  // 6 the first craft from stock in reach
  await walkTo(6.5, 0.5); await step(1.5); await press('e'); const inReach = await page.$eval('#reach', e => e.textContent), had = await page.$$eval('#win [data-a="print"][data-i="furnace"]', e => e.length); await shot('craft');
  const clicked = await uiClick('#win [data-a="print"][data-i="furnace"]'); const ordered = await ev('D.SUP.wanted.map(w => w.item)'); await press('e');
  check('the furnace can be crafted from rock that lies in reach, not in the hands: it is ordered from the network', /loose/.test(inReach) && had === 1 && clicked && ordered.includes('furnace') && (await ev('D.S.count("basalt")')) < 1, { ordered, reach: inReach.slice(0, 200) });
  const tGot = await until('D.S.count("furnace") >= 1 || D.SUP.wanted.length === 0', 420, 0.5); const got = await ev(`({ furnace: D.S.count('furnace'), fabDone: D.EV.fabDone || 0, delivered: D.EVD.slice(0, 12), toYou: D.EVD.filter(d => d[2] === 'player'), gave: D.EVG, retries: D.MARKET.retries, log: D.LOG.lines.slice(-8).map(l => l.t), orders: D.SUP.orders.map(o => [o.item, o.producer, o.note]), hp: D.P.hp })`);
  check('robots fetch the rock, the fabricator makes the furnace, a robot brings it', tGot >= 0 && got.furnace >= 1 && got.fabDone >= 1 && got.delivered.some(d => d[0] === 'basalt') && got.toYou.some(d => d[0] === 'furnace'), { s: tGot, ...got });
  check('a robot fetch with zero give-ups', got.gave.length === 0 && got.delivered.length >= 2, { gave: got.gave, retries: got.retries });
  const okSlot = await slotKey('furnace'); await aim(4.6, 0.25); await click(); await step(0.5); const placed = await ev(`({ furnace: D.F.machines.filter(m => m.kind === 'furnace').length, left: D.S.count('furnace'), msg: D.S.msg, cur: D.cursorKind(), slot: D.P.slot, mode: D.S.mode, ghosts: D.BP.ghosts.map(g => g.kind), at: [D.P.x, D.S.mouse.x, D.S.mouse.y] })`);
  check('the furnace is placed from its slot', okSlot && placed.furnace === 1 && placed.left === 0, placed); await shot('furnace');
  // 7 a mining order with supports: an access pit by hand, a drift marked from it, the drones cut it and the ai props it
  await walkTo(16.2, 0.4); const g17 = await ev('D.world.groundY(17.7, 3, 0, 8)');
  for (const dy of [-0.2, -0.8, -1.4, -2.0, -2.5]) { await aim(17.7, g17 + dy); await page.mouse.down(); await until(`!D.world.solidAt(17.7, ${g17 + dy - 0.15})`, 14, 0.05); await page.mouse.up(); await step(0.3); }
  await step(1); const pit = await ev(`[D.world.solidAt(17.7, ${g17 - 1.8}), D.world.solidAt(17.7, ${g17 - 3.6})]`);
  await press('Tab'); await press('t'); const gy1 = Math.floor((g17 - 1.1) / 0.5), gy0 = gy1 - 1;
  await aim(18.3, (gy0 + 0.5) * 0.5); await page.mouse.down(); await step(0.1); await aim(19.2, (gy1 + 0.5) * 0.5); await page.mouse.up(); await step(0.3); const ord = await ev('D.BP.clears.map(c => [c.x0, c.y0, c.x1, c.y1])'); await shot('order'); await press('Tab');
  check('a mining order: a pit cut by hand, a drift marked from it in blueprint mode', !pit[0] && pit[1] && ord.length === 1 && ord[0][2] - ord[0][0] >= 1.5, { pit, ord, collapses: await ev('D.EVC || []') });
  await walkTo(14.2, 0.5); const tSup = await until('D.MINE.supports.length >= 1', 900, 1), sup = await ev(`({ supports: D.MINE.supports.map(s => [s.kind, s.x, s.y0, s.y1]), planned: D.EV.supportPlanned || 0, built: D.EV.supportBuilt || 0, collapses: D.EVC || [], spans: [...D.MINE.spans.values()].map(s => [+s.span.toFixed(1), +s.safe.toFixed(1)]), clears: D.BP.clears.length, gave: D.EVG, cut: D.EV.robotCleared || 0, log: D.LOG.lines.slice(-8).map(l => l.t), ghosts: D.BP.ghosts.map(g => g.kind), hp: D.P.hp, robots: D.robots.map(r => D.intentOf(r)) })`);
  check('the drones cut the drift; the ai planned its support by itself, had it made, and a drone set it', tSup >= 0 && sup.supports.length >= 1 && sup.planned >= 1 && sup.built >= 1, { s: tSup, ...sup }); await aim(19.2, g17 - 1.2); await shot('supports');
  const end = await ev(`({ gave: D.EVG, retries: D.MARKET.retries, deaths: D.DIED || [], hp: D.P.hp, time: +dev.G.time.toFixed(0), stage: D.S.stage, creatures: D.creatures.length, quiet: !!D.hive.quiet, kills: D.S.stats.kills, zones: D.STOCK.zones.map(z => [z.name, +D.zoneKg(z).toFixed(0)]), suit: +D.EXO.cond.toFixed(3), hive: [D.hive.alert, D.hive.waves, D.hive.level, D.EV.hiveProbe || 0, D.EV.hiveWave || 0, D.EV.probeReturned || 0], pulses: D.K.laser.pulses })`);
  check('to the end: no robot gave a job up, nobody died, and nothing that lives was switched off', end.gave.length === 0 && end.deaths.length === 0 && !end.quiet && end.hp > 0, end);
  await settle(); await shot('end');
} catch (e) { fails.push('threw: ' + e.message); console.log('THREW', e.stack); try { await shot('threw'); } catch (e2) { /* the page is gone */ } }
check('no console errors', errs.length === 0, errs.slice(0, 5));
console.log(JSON.stringify({ play: fails.length ? 'FAIL' : 'PASS', checks: log.length, failed: fails }));
fs.writeFileSync(path.join(root, 'docs/shots/play.json'), JSON.stringify({ at: new Date().toISOString(), result: fails.length ? 'FAIL' : 'PASS', log }, null, 1));
await browser.close(); if (server) server.close(); process.exit(fails.length ? 1 : 0);

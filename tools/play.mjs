// tools/play.mjs: the game played by hand, from a fresh default start, in headless Chromium (software GL). Every action
// is a real key or mouse event through puppeteer; the script only reads state to know where to aim and when to stop,
// and steps game time itself between inputs (software GL draws about one frame a second, so waiting in real time would
// take hours). The forest and the hive are as they are (nothing is switched off). Round 7 plays twenty minutes:
//   the round 6 start: awake in the wreck without the suit, the suit, the boot, the laser and the reactor, the first scan,
//   a kerf that cuts blocks loose; then, one for each fix of docs/ROUND7.md section 1 (and section 7):
//   1 loose rock: the body walks into the blocks it cut, over them and back, and no rock hurts it
//   7s the ship has no matter compiler: the furnace is printed by the arm (the robots bring it the rock); the belts are
//     milled in the wreck's machine shop and brought
//   4 belts: a belt is laid as a dragged path from the furnace's port; the AI lays none
//   5 planners: the blueprint in its slot copies the line with a dragged box and pastes it as plans
//   3 deconstruction: a held right button takes one belt down by hand; the planner's box sends the robots for the rest
//   6 the shaft rig: printed by the arm (no machine here makes one), placed with a dragged depth; what it cuts comes up
//   8 a tree: the laser on a trunk until the kerf is through; it falls; the drones cut it into logs
//   7 spoil: the heap the AI sited away from the base, on the back layer; a berm when there is spoil for one
//   2 the idle audit, sampled twice a game second for the whole run: no robot idle beside a job it could take
// Setup that is not input, said plainly: once the furnace stands the hold is handed 70 kg of iron and 8 of copper (a
// crate, so the run fits in twenty minutes; everything made from it is ordered and made the normal way).
// usage: npm run build && node tools/play.mjs [--url http://localhost:5234/]     exits 1 on any failed check or console error
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
  for (let i = 0; i < 30 && !ok; i++) { ok = (await until(there, 1, 0.05)) >= 0; t += 1; if (!ok && typeof THREAT === 'string' && (await ev('D.T7 !== undefined')) && (await ev(THREAT))) { await page.keyboard.up(k); await fight(); await page.keyboard.down(k); } const nx = await ev('D.P.x'); if (!ok && Math.abs(nx - px) < 0.3) { await page.keyboard.down('w'); await step(0.3); await page.keyboard.up('w'); } px = nx; }
  await page.keyboard.up(k); await step(0.45);
  // the body has momentum and slides past: short taps back until it stands where it should
  for (let i = 0; i < 14; i++) { const dx = x - (await ev('D.P.x')); if (Math.abs(dx) <= tol) break; const q = dx > 0 ? 'd' : 'a'; await page.keyboard.down(q); await step(Math.min(0.14, 0.04 + Math.abs(dx) / 14)); await page.keyboard.up(q); await step(0.45); }
  return ok ? t : -1;
};
const box = async sel => { const e = await page.$(sel); if (!e) return null; const b = await e.boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
const uiClick = async (sel, opt = {}) => { await settle(); const p = await box(sel); if (!p) return false; if (opt.shift) await page.keyboard.down('Shift'); await page.mouse.click(p[0], p[1], { button: opt.button || 'left' }); if (opt.shift) await page.keyboard.up('Shift'); await step(0.05); await settle(); return true; };
// something hunts the body: a player stops what he is doing, turns the laser on it and holds the trigger. This does that
// with the mouse (the cursor on the animal, the left button down) until nothing hunts within sight, then goes on.
const THREAT = `D.creatures.some(c => c.agg && c.hp > 0 && Math.hypot(c.x - D.P.x, c.y - D.P.y - 1) < 15)`, fights = [];
const fight = async () => { const t0 = await ev('dev.G.time'), slot = await ev('D.P.slot'), st = await ev('[D.K.laser.state, !!D.K.laser.reach, D.K.reactor.state]'); let how = 'by hand';
  // the laser in the hands and the reactor set down within its cable: stand it on its legs (g) and the ai aims it, better than a hand does
  if (st[0] === 'held' && st[1] && st[2] === 'ground') { await press('g'); how = 'turret'; } else if (st[0] === 'turret') how = 'turret'; else await press('2');
  if (how === 'by hand') await page.mouse.down();
  for (let n = 0; n < 600 && (await ev(THREAT)) && !(await ev('D.P.dead > 0')); n++) { const p = await ev(`(() => { let b = null, bd = 1e9; for (const c of D.creatures) { if (!c.agg || c.hp <= 0) continue; const d = Math.hypot(c.x - D.P.x, c.y - D.P.y - 1); if (d < bd) { bd = d; b = c; } } if (!b) return null; const s = D.S.toScr(b.x + b.vx * 0.08, b.y); return [s[0], s[1]]; })()`); if (!p) break; await page.mouse.move(Math.max(4, Math.min(1596, p[0])), Math.max(4, Math.min(896, p[1]))); await step(0.1); }
  if (how === 'by hand') { await page.mouse.up(); await step(0.2); if (slot >= 0 && slot < 9) await press(String(slot + 1)); }
  fights.push({ at: +t0.toFixed(0), how, s: +((await ev('dev.G.time')) - t0).toFixed(1), hp: +(await ev('D.P.hp')).toFixed(0), dead: (await ev('D.P.dead > 0')), kills: await ev('D.S.stats.kills') }); if (await ev('D.P.dead > 0')) await until('!(D.P.dead > 0)', 6, 0.1); };
// wait for a condition as until does, but fight when something hunts
const wait = async (cond, max = 60, dt = 0.25) => { let left = max, t = 0; for (;;) { const r = await until(`(${cond}) || (${THREAT})`, left, dt); if (await ev(cond)) return t + Math.max(0, r); if (r < 0) return -1; t += r; left -= r; if (await ev(THREAT)) { await fight(); left -= 1; } if (left <= 0) return (await ev(cond)) ? t : -1; } };
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
  // ---- round 7 -------------------------------------------------------------------------------------------------------
  await ev(`(D.EVR = [], D.events.on('rockHit', d => D.EVR.push([+d.kg.toFixed(1), +d.v.toFixed(1), +d.dmg.toFixed(1)])), D.events.on('idleDoable', d => (D.EVI = D.EVI || []).push(d)), D.resetAudit(), D.T7 = dev.G.time, 1)`);
  // 1 loose rock: down off the outcrop and through what the kerf cut loose, to the far side of the pile and back, by the keys
  const rocks = await ev(`D.matter.list.filter(c => !c.back && c.kg > 3).map(c => [+c.x.toFixed(1), +c.y.toFixed(1), +c.kg.toFixed(0)])`), rx = rocks.map(q => q[0]).sort((a, b) => a - b), pile = rx.length ? [rx[0], rx[rx.length - 1]] : [10, 12], hp0 = await ev('D.P.hp');
  await walkTo(pile[0] - 1.6, 0.5); await step(1); const hpA = await ev('(D.HIT.touch = 0, D.P.hp)'); await page.keyboard.down('Shift'); await walkTo(Math.min(pile[1] + 0.6, 12.6), 0.6); await walkTo(pile[0] - 1.6, 0.6); await page.keyboard.up('Shift'); await step(0.5);
  const rw = await ev(`({ hp: D.P.hp, hits: D.EVR, touched: D.HIT.touch, climbed: +D.HIT.climbs.toFixed(2), dead: D.P.dead, x: +D.P.x.toFixed(1), n: D.matter.list.filter(c => !c.back && c.kg > 3).length })`);
  check('1 loose rock: the body walks into the blocks it cut, over them and back, and not one rock hurts it', rw.hits.length === 0 && rw.hp >= hpA - 0.01 && !rw.dead && rocks.length >= 3 && rw.touched > 0, { pile, rocks: rocks.length, hp: [hp0, hpA, rw.hp], ...rw }); await shot('rocks');
  // section 7: the furnace. It is ordered from rock that lies in reach; no machine here can make it (the ship has a machine
  // shop, not a compiler), so the robots bring the rock to you and the arm prints it
  await walkTo(6.5, 0.5); await step(1.5); await press('e'); const inReach = await page.$eval('#reach', e => e.textContent), had = await page.$$eval('#win [data-a="print"][data-i="furnace"]', e => e.length); await shot('craft');
  const clicked = await uiClick('#win [data-a="print"][data-i="furnace"]'); const ordered = await ev('D.SUP.wanted.map(w => w.item)'); await press('e');
  check('the furnace can be crafted from rock that lies in reach, not in the hands: it is ordered from the network', /loose/.test(inReach) && had === 1 && clicked && ordered.includes('furnace') && (await ev('D.S.count("basalt")')) < 1, { ordered, reach: inReach.slice(0, 200) });
  const tGot = await wait('D.S.count("furnace") >= 1', 600, 0.5); const got = await ev(`({ furnace: D.S.count('furnace'), armMade: D.S.printer.made, shop: Object.values(D.SUP.shop).filter(Boolean).map(j => j.r), delivered: D.EVD.slice(0, 12), gave: D.EVG, retries: D.MARKET.retries, log: D.LOG.lines.slice(-8).map(l => l.t), orders: D.SUP.orders.map(o => [o.item, o.producer, o.note]), hp: D.P.hp })`);
  check('7s there is no fabricator: the robots bring the rock to you and the arm, the one matter compiler, prints the furnace', tGot >= 0 && got.furnace >= 1 && (got.armMade.furnace || 0) >= 1 && got.delivered.some(d => d[0] === 'basalt' && d[2] === 'player') && !(await ev('!!D.K.fab')), { s: tGot, ...got });
  check('a robot fetch with zero give-ups', got.gave.length === 0 && got.delivered.length >= 2, { gave: got.gave, retries: got.retries });
  const okSlot = await slotKey('furnace'); await aim(4.6, 0.25); await click(); await step(0.5); const placed = await ev(`({ furnace: D.F.machines.filter(m => m.kind === 'furnace').length, left: D.S.count('furnace'), msg: D.S.msg, at: D.F.machines.filter(m => m.kind === 'furnace').map(m => [m.x, m.y]) })`);
  check('the furnace is placed from its slot', okSlot && placed.furnace === 1 && placed.left === 0, placed); await shot('furnace');
  const fu = placed.at[0] || [8, 0];
  // setup, not input: a crate of metal in the hold (see the head of this file)
  await ev(`(D.inv.add(D.K.hold, 'iron', 70), D.inv.add(D.K.hold, 'copper', 8), D.SUP.tick = 0, 1)`);
  // belts are ordered: the mill in the wreck makes them from the hold's iron, a robot brings them
  await press('e'); const bOk = await uiClick('#win [data-a="print"][data-i="belt"]'), bOk2 = await uiClick('#win [data-a="print"][data-i="belt"]'); await press('e');
  const tBelt = await wait('D.S.count("belt") >= 8', 400, 0.5), bl = await ev(`({ belts: D.S.count('belt'), swarf: +D.inv.count(D.K.hold, 'swarf').toFixed(2), arm: D.S.printer.made, armQ: D.S.printer.q.map(j => j.r), log: D.LOG.lines.slice(-4).map(l => l.t), orders: D.SUP.orders.map(o => [o.item, o.producer, o.note]) })`);
  check('7s the belts come from the mill in the wreck (bar in, a fifth lost as swarf), not from the arm', bOk && bOk2 && tBelt >= 0 && bl.belts >= 8 && bl.swarf > 1 && !(bl.arm.belt > 0), { s: tBelt, ...bl });
  // 4 a belt is a dragged path: press beside the furnace (its port catches the press), drag east along the ground, let go
  await walkTo((fu[0] + 2) * 0.5 + 2.2, 0.5); const bs = await slotKey('belt'); const y0 = fu[1] * 0.5 + 0.25, px0 = (fu[0] + 1.5) * 0.5, px1 = (fu[0] + 2 + 4) * 0.5 + 0.25;
  await aim(px0, y0); await page.mouse.down(); await step(0.1); await aim(px1, y0); await shot('belt-drag'); await page.mouse.up(); await step(0.4);
  const bp1 = await ev(`({ belts: D.F.machines.filter(m => m.kind === 'belt').map(m => [m.x, m.y, m.dir]), left: D.S.count('belt'), ghosts: D.BP.ghosts.filter(g => g.kind === 'belt').length, auto: D.F.machines.filter(m => m.auto).length, laid: D.AUTO.laid })`);
  check('4 a belt is laid as a dragged path from the furnace port, with its direction; the ai laid none', bs && bp1.belts.length >= 5 && bp1.belts.every(b => b[2] === 1 && b[1] === fu[1]) && bp1.belts.some(b => b[0] === fu[0] + 2) && bp1.auto === 0 && !bp1.laid, bp1);
  // the furnace is given rock by hand (f opens it, "put in" takes what it accepts from the suit): what it makes rides the belt
  const rockIn = await ev('D.S.count("basalt") + D.S.count("iron ore") + D.S.count("lean ore")'); let fed = 'by hand';
  if (rockIn >= 4) { await walkTo((fu[0] + 1) * 0.5 + 1.6, 0.4); await press('f'); await uiClick('#win [data-a="xfer"]'); await press('Escape'); }
  else { fed = 'the iron target raised (j)'; await press('j'); for (let i = 0; i < 4; i++) await uiClick('#win.ai [data-a="tg-inc"][data-i="iron"]', { shift: true }); await press('Escape'); }
  const tItem = await wait('D.F.items.length > 0', 300, 0.5); const it0 = await ev('D.F.items.map(i => [i.id, +i.x.toFixed(2)])'); await step(0.6); const it1 = await ev('D.F.items.map(i => [i.id, +i.x.toFixed(2)])'); await shot('belt');
  check('what the furnace makes rides the belt, visibly', tItem >= 0 && it0.length > 0, { s: tItem, fed, rockIn: +rockIn.toFixed(1), before: it0.slice(0, 3), after: it1.slice(0, 3), furnace: await ev(`D.F.machines.filter(m => m.kind === 'furnace').map(m => [m.on, m.inp, m.out])`) });
  // 5 the planners are items: bring the blueprint and the deconstruction planner onto the hotbar by hand, copy the line with a box, paste it
  const toBar = async (id, slot) => { const i = await ev(`D.S.inv.slots.findIndex(s => s && s.id === ${JSON.stringify(id)})`); if (i < 0) return false; if (i === slot) return true; await press('e'); await uiClick(`#win .slot[data-c="p"][data-i="${i}"]`); await uiClick(`#win .slot[data-c="p"][data-i="${slot}"]`); const h = await ev('!!D.ui && D.ui.open'); await press('e'); return (await ev(`D.S.inv.slots[${slot}] && D.S.inv.slots[${slot}].id`)) === id; };
  const inInv = await ev(`D.PLANNERS.map(k => D.S.count(k))`), tb1 = await toBar('blueprint', 6), tb2 = await toBar('deconstruction planner', 7);
  await press('7'); const bx0 = (fu[0] + 2) * 0.5 + 0.1, bx1 = (fu[0] + 2 + 4) * 0.5 + 0.4; await aim(bx0, y0 - 0.1); await page.mouse.down(); await step(0.1); await aim(bx1, y0 + 0.6); await page.mouse.up(); await step(0.3);
  const cp = await ev(`(() => { const s = D.S.inv.slots[6]; return { id: s && s.id, ents: s && s.d && s.d.bp ? s.d.bp.ents.map(e => e[0] + '@' + e[1] + ',' + e[2] + '>' + e[3]) : null, tool: D.toolSlot() && D.toolSlot().id }; })()`);
  // 3 deconstruction: the right button held on one belt takes it down by hand; then the blueprint is pasted over the line as
  // plans; then the planner's box cancels what is still a plan and sends the robots for everything that stands in it
  const tot = `(D.F.machines.filter(m => m.kind === 'belt').length + D.BP.ghosts.filter(g => g.kind === 'belt' && g.have).length + D.S.count('belt') + D.inv.count(D.K.hold, 'belt') + D.robots.reduce((a, r) => a + D.inv.count(r.cargo, 'belt') + (r.carry && r.carry.belt || 0), 0) + D.matter.list.filter(c => c.id === 'belt').reduce((a, c) => a + c.n, 0))`;
  const b0 = await ev(`D.S.count('belt')`), nb0 = await ev(`D.F.machines.filter(m => m.kind === 'belt').length`), all0 = await ev(tot); await press('2'); await aim((fu[0] + 2 + 3) * 0.5 + 0.25, y0); await page.mouse.down({ button: 'right' }); const tHand = await until(`D.F.machines.filter(m => m.kind === 'belt').length < ${nb0}`, 8, 0.05); await page.mouse.up({ button: 'right' }); await step(0.3);
  const hd = await ev(`({ belts: D.F.machines.filter(m => m.kind === 'belt').length, held: D.S.count('belt'), ev: D.EV.removedByHand || 0 })`);
  await press('7');
  await aim((bx0 + bx1) / 2, y0 + 2.6); await shot('blueprint'); await click(); await step(0.3); const ps = await ev(`D.BP.ghosts.map(g => [g.kind, g.x, g.y, g.dir])`);
  check('5 the planners are items in slots: the blueprint copies the line with a dragged box and pastes it as plans', inInv.every(n => n === 1) && tb1 && tb2 && cp.id === 'blueprint' && cp.ents && cp.ents.length >= 5 && cp.ents.every(e => /^belt/.test(e)) && ps.length === cp.ents.length && ps.every(g => g[0] === 'belt' && g[3] === 1 && g[2] === fu[1] + 5), { inInv, copied: cp, pasted: ps });

  await press('8'); await aim(bx0, y0 - 0.1); await page.mouse.down(); await step(0.1); await aim(bx1 + 0.3, y0 + 3.2); await shot('decon'); await page.mouse.up(); await step(0.3);
  const dm = await ev(`({ marked: D.F.machines.filter(m => m.decon).map(m => m.kind), unmarked: D.F.machines.filter(m => m.kind === 'belt' && !m.decon).length, ghosts: D.BP.ghosts.length, msg: D.S.msg })`); await press('2'); await walkTo(0.5, 0.6);
  const tDec = await wait(`D.F.machines.filter(m => m.kind === 'belt').length === 0 && D.BP.ghosts.length === 0 && D.robots.every(r => !r.job || r.job.kind !== 'decon')`, 240, 0.5), dn = await ev(`({ belts: D.F.machines.filter(m => m.kind === 'belt').length, all: ${tot}, decon: D.EV.robotDecon || 0, furnace: D.F.machines.filter(m => m.kind === 'furnace').length, gave: D.EVG.length })`);
  check('3 deconstruction: a held right button takes one belt down by hand; the planner box cancels the plans and the robots take the line down and keep the belts', tHand >= 0 && hd.belts === nb0 - 1 && hd.held === b0 + 1 && hd.ev >= 1 && dm.marked.length >= bp1.belts.length - 1 && dm.marked.every(k => k === 'belt') && dm.unmarked === 0 && dm.ghosts === 0 && ps.length > 0 && tDec >= 0 && dn.belts === 0 && dn.all === all0 && dn.decon >= 1 && dn.furnace === 1, { tHand, before: [nb0, all0], hand: hd, marks: dm, s: tDec, done: dn });
  // 6 the shaft rig: ordered; no machine here makes one, so it is the arm's; placed with a dragged depth; everything it cuts comes up
  await walkTo(3.0, 0.5); await press('e'); const rOk = await uiClick('#win [data-a="print"][data-i="shaft rig"]'); await press('e'); const tRig = await wait('D.S.count("shaft rig") >= 1', 500, 0.5);
  const rg = await ev(`({ rig: D.S.count('shaft rig'), arm: D.S.printer.made, orders: D.SUP.orders.map(o => [o.item, o.producer, o.note]), log: D.LOG.lines.slice(-4).map(l => l.t) })`);
  const gx = -1.0, gyR = await ev(`D.world.groundY(${gx}, 4, 0, 10)`), cellY = Math.round(gyR / 0.5) * 0.5; await walkTo(gx + 2.6, 0.5); const rs = await slotKey('shaft rig'); await aim(gx, cellY + 0.25); await page.mouse.down(); await step(0.1); await aim(gx, cellY - 3.8); await shot('rig-drag'); await page.mouse.up(); await step(0.5);
  const rp = await ev(`D.F.machines.filter(m => m.kind === 'shaft rig').map(m => ({ x: m.x, y: m.y, target: m.target, head: m.head, hoist: m.hoist }))`);
  check('6 the shaft rig is the arm\'s work (no machine here makes one); it is placed with a dragged depth', rOk && tRig >= 0 && (rg.arm['shaft rig'] || 0) >= 1 && rs && rp.length === 1 && rp[0].target >= 3 && !rp[0].hoist, { s: tRig, ...rg, placed: rp, ground: gyR });
  // 8 a tree: bring the reactor within cable reach of one, aim at its trunk and hold the trigger until the kerf is through
  const rX = await ev('D.K.reactor.x'); await walkTo(rX + 0.4, 0.5); await press('x'); await until('D.K.reactor.state === "carried"', 5, 0.1); await walkTo(-13.5, 0.6); await step(0.5);
  const tr = await ev(`(() => { const ts = D.treesIn(-45, -16).filter(t => t.st === 0).sort((a, b) => b.x - a.x); return ts.length ? { id: ts[0].id, x: ts[0].x, y: ts[0].y, d: ts[0].d, H: ts[0].H, need: D.pulsesToFell(ts[0].d) } : null; })()`);
  let fell = null;
  if (tr) { await walkTo(tr.x + 3.6, 0.5); await press('x'); await until('D.K.reactor.state === "ground"', 5, 0.1); await walkTo(tr.x + 2.6, 0.4); const p0t = await ev('D.K.laser.pulses'), mode0 = await ev('D.K.laser.mode');
    await aim(tr.x, tr.y + 0.7); await page.mouse.down(); await until(`D.K.laser.pulses >= ${p0t + 30}`, 30, 0.05); await shot('tree-kerf'); const mid = await ev(`(() => { const c = D.treeRec(${JSON.stringify(tr.id)}); return c ? { k: Math.round(c.k), st: c.st, note: D.flora.note && D.flora.note.text } : null; })()`);
    const tF = await until(`(D.treeRec(${JSON.stringify(tr.id)}) || { st: 9 }).st >= 1`, 240, 0.05); await page.mouse.up(); const pF = (await ev('D.K.laser.pulses')) - p0t; const tD = await until(`(D.treeRec(${JSON.stringify(tr.id)}) || { st: 9 }).st >= 2`, 30, 0.05); await step(1); await shot('tree-down');
    await press('g'); const tTur = await until('D.K.laser.state === "turret"', 4, 0.1);       // and the laser goes on its legs beside the reactor: the ai keeps watch with it from here on
    fell = { tree: tr, mode: mode0, mid, pulses: pF, tFell: tF, tDown: tD, turret: tTur >= 0, rec: await ev(`(() => { const c = D.treeRec(${JSON.stringify(tr.id)}); return c ? { st: c.st, ang: +c.ang.toFixed(2), dir: c.dir } : null; })()`), hp: await ev('D.P.hp') }; }
  check('8 a tree is hard to cut: the trunk takes about as many pulses as its kerf costs, then it falls and lies', !!fell && !!fell.mid && fell.mid.k > 0 && fell.mid.st === 0 && /chars/.test(fell.mid.note || '') && fell.tFell >= 0 && Math.abs(fell.pulses - tr.need) <= 4 && fell.pulses >= 60 && fell.tDown >= 0 && fell.rec && fell.rec.st === 2 && fell.rec.ang > 0.9, fell);
  // the trunk is cut into logs by the drones (a felled tree is a job); meanwhile the run goes on to its twentieth minute
  await walkTo((tr ? tr.x : -14) + 4.4, 0.6);       // beside the reactor, on its cable: whatever comes out of the forest meets a laser that has its power
  const tLog = await wait('D.flora.logs >= 2', 420, 0.5), lg = await ev(`({ logs: D.flora.logs, felled: D.flora.felled, bucked: D.EV.logCut || 0, loose: +D.matter.total('log').toFixed(1), stored: +D.ledger().filter(e => e.item === 'log').reduce((a, e) => a + e.n, 0).toFixed(1), robots: D.robots.map(r => D.intentOf(r)) })`);
  check('8 felling is a job: the drones cut the trunk that lies into logs', tLog >= 0 && lg.logs >= 2 && lg.stored > 3, { s: tLog, ...lg }); await shot('logs');
  // the rest of the twenty minutes: the base runs; the audit is sampled all the while
  const tEnd = await ev('D.T7 + 1200 - dev.G.time'); if (tEnd > 0) await wait('dev.G.time >= D.T7 + 1200', Math.ceil(tEnd) + 5, 0.5);
  // 6 again: what the rig cut is at the collar or gone with the robots; nothing lies at the face
  const rig = await ev(`(() => { const m = D.F.machines.find(q => q.kind === 'shaft rig'); if (!m) return null; const cx = (m.x + 1) * 0.5, y = m.y * 0.5; return { depth: +m.depth.toFixed(2), trips: m.trips || 0, hoisted: +(m.hoisted || 0).toFixed(1), bin: +D.binKg(m).toFixed(1), muck: m.muck, wait: m.wait, atFace: D.matter.list.filter(c => Math.abs(c.x - cx) < 0.8 && c.y < y - 0.4).length, skips: D.EV.skip || 0 }; })()`);
  check('6 the rig hoisted everything it cut to the collar bin: nothing lies at the face', !!rig && rig.depth > 0.6 && rig.trips >= 2 && rig.hoisted > 10 && rig.atFace === 0, rig); if (rig) { await aim(-1, -0.6); await shot('collar'); }
  // 7 spoil: the heap away from the base and on the back layer; what the ai did with the rest
  const sp = await ev(`({ zones: D.STOCK.zones.map(z => [z.name, +((z.x0 + z.x1) / 2).toFixed(0), +D.zoneKg(z).toFixed(0)]), back: D.matter.list.filter(c => c.back).length, front: D.matter.list.filter(c => !c.back).length, fills: D.FILL.list.map(f => [f.kind, f.x, +(100 * f.lvl / f.h).toFixed(0), +f.put.toFixed(0), f.done]), used: +D.FILL.used.toFixed(0), span: D.baseSpan(), ship: D.SHIP.x })`), heap = sp.zones.find(z => z[0] === 'spoil heap');
  check('7 spoil goes to a heap the ai sited away from the base, on the back layer (and into a berm when there is enough of it)', !!heap && (heap[1] < sp.span.x0 - 25 || heap[1] > sp.span.x1 + 25) && sp.back > 0, sp);
  { const berm = sp.fills.find(f => f[0] === 'berm'), to = berm ? berm[1] - 5 : heap ? heap[1] + 5 : null; if (to !== null) { await walkTo(to, 0.8); await step(1); await aim(to + (berm ? 5 : -5), 2); await shot('spoil'); } }
  // 2 the idle audit over the whole run
  const au = await ev(`({ seconds: +(dev.G.time - D.T7).toFixed(0), samples: D.AUDIT.samples, idleWhileOpen: D.AUDIT.idleSamples, doable: D.AUDIT.doable, timer: D.AUDIT.timer, worst: D.AUDIT.worst.slice(0, 8), reasons: Object.entries(D.AUDIT.reasons).sort((a, b) => b[1] - a[1]).slice(0, 10), latent: D.AUDIT.latent, gave: D.EVG.length, retries: D.MARKET.retries, delivered: D.EVD.length })`);
  check('2 twenty minutes of play: not one sample with a robot idle beside a job it could take', au.seconds >= 1200 && au.samples >= 2000 && au.doable === 0 && au.timer === 0, au);
  const end = await ev(`({ fights: ${JSON.stringify(fights.slice(0, 12))}, gave: D.EVG, retries: D.MARKET.retries, deaths: D.DIED || [], hp: D.P.hp, time: +dev.G.time.toFixed(0), stage: D.S.stage, creatures: D.creatures.length, quiet: !!D.hive.quiet, kills: D.S.stats.kills, zones: D.STOCK.zones.map(z => [z.name, +D.zoneKg(z).toFixed(0)]), suit: +D.EXO.cond.toFixed(3), arm: +D.EXO.arm.toFixed(2), armMade: D.S.printer.made, hive: [D.hive.alert, D.hive.waves, D.hive.level, D.EV.hiveProbe || 0, D.EV.hiveWave || 0, D.EV.probeReturned || 0], pulses: D.K.laser.pulses, rockHits: D.EVR })`);
  check('to the end: no robot gave a job up, nobody died, no rock hurt anybody, and nothing that lives was switched off', end.gave.length === 0 && end.deaths.length === 0 && !end.quiet && end.hp > 0 && end.rockHits.length === 0, end);
  await press('j'); await shot('audit'); await press('Escape'); await settle(); await shot('end');
} catch (e) { fails.push('threw: ' + e.message); console.log('THREW', e.stack); try { await shot('threw'); } catch (e2) { /* the page is gone */ } }
check('no console errors', errs.length === 0, errs.slice(0, 5));
console.log(JSON.stringify({ play: fails.length ? 'FAIL' : 'PASS', checks: log.length, failed: fails }));
let audit = null; try { audit = await ev(`({ seconds: +(dev.G.time - (D.T7 || 0)).toFixed(0), samples: D.AUDIT.samples, idleWhileAJobWasOpen: D.AUDIT.idleSamples, idleBesideDoableWork: D.AUDIT.doable, heldByATimerOnly: D.AUDIT.timer, worst: D.AUDIT.worst, reasons: D.AUDIT.reasons })`); } catch (e) { /* the page is gone */ }
fs.writeFileSync(path.join(root, 'docs/shots/play.json'), JSON.stringify({ at: new Date().toISOString(), result: fails.length ? 'FAIL' : 'PASS', idleAudit: audit, log }, null, 1));
await browser.close(); if (server) server.close(); process.exit(fails.length ? 1 : 0);

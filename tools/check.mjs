// tools/check.mjs: serves dist/, opens every scenario in headless Chromium (software GL), saves docs/shots/<name>.png,
// fails on any console error, runs ?test=1, and writes docs/CHECK.md.   usage: node tools/check.mjs [--only name] [--port 5231]
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), dist = path.join(root, 'dist');
const arg = n => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : null; };
const port = +(arg('port') || 5231), only = arg('only'), wait = +(arg('wait') || 4000);
const SCN = [
  ['title', ''], ['surface', '?act=surface'], ['slice', '?act=surface&scenario=slice&auto=1&t=16'], ['reactor', '?act=surface&scenario=reactor&auto=1&t=4'], ['turret', '?act=surface&scenario=turret&auto=1&t=0.9'],
  ['herd', '?act=surface&scenario=herd&t=2'], ['predator', '?act=surface&scenario=predator&auto=1&t=1.4'], ['supply', '?act=surface&scenario=supply&t=45'], ['forest', '?act=surface&scenario=forest'], ['drill', '?act=surface&scenario=drill&auto=1&t=3'], ['inventory', '?act=surface&scenario=inventory'],
  ['factory', '?act=surface&scenario=factory&t=30'], ['blueprint', '?act=surface&scenario=blueprint&t=3.5'], ['combat', '?act=surface&scenario=combat&auto=1&t=2.5'],
  ['ruins', '?act=surface&scenario=ruins'], ['base', '?act=surface&scenario=base'], ['hive', '?act=surface&scenario=hive&t=6'],
  // round 4: [name, url, a condition on the live state that must hold when the shot is taken]
  ['planet', '?act=surface&scenario=planet', 'D.S.zo > 90 && Math.abs(D.S.cam.y + 641.7) < 1'], ['horizon', '?act=surface&scenario=horizon', 'D.S.zo > 12 && D.S.zo < 14'],
  ['far90', '?act=surface&scenario=far90&auto=1&t=3', 'D.planet.lon(D.P.x) > 94 && D.P.vx > 1'], ['seam', '?act=surface&scenario=seam&auto=1&t=8', 'D.planet.chart === 1 && D.P.x < -612 && D.planet.shifts > 1'],
  ['antipode', '?act=surface&scenario=antipode&t=2', 'Math.abs(D.planet.lon(D.P.x)) > 178 && D.structsIn(2010, 2022).some(q => q.main) && D.hive.near && D.hive.near.d < 30'],
  ['autobuild', '?act=surface&scenario=autobuild&t=360', 'D.F.machines.some(m => m.kind === "furnace") && D.F.machines.some(m => m.kind === "assembler") && D.queueView(D.robots).some(q => /waits for lumen/.test(q.why)) && (D.S.printer.made.furnace || 0) >= 1 && (D.S.printer.made.assembler || 0) >= 1'],
  ['queue', '?act=surface&scenario=queue&t=20', '!!document.querySelector("#win.ai .qr [data-a=q-up]") && D.queueView(D.robots).length >= 2'],
  ['conveyor', '?act=surface&scenario=conveyor&t=120', 'D.F.machines.filter(m => m.kind === "belt").length === 0 && D.BP.ghosts.length === 0 && D.AUTO.proposals.length >= 1 && D.AUTO.routes.every(r => r.mode !== "belt") && D.AUTO.routes.some(r => r.proposed) && D.F.machines.some(m => m.kind === "assembler" && (m.inp.iron > 0 || m.busy))'],
  ['overhang', '?act=surface&scenario=overhang&t=9', 'D.robots.some(r => r.kind === "crawler" && ((r.x > 2.5 && r.x < 9 && r.state === "cfetch") || D.inv.count(r.cargo, "iron ore") > 1)) && D.MARKET.gaveUp === 0'],
  ['targets', '?act=surface&scenario=targets&t=30', 'document.querySelectorAll("#win.ai [data-a=tg-inc]").length >= 2 && document.querySelectorAll("#win.ai [data-a=tg-add]").length > 4'],
  // round 5
  ['fall', '?act=surface&scenario=fall&t=4', 'D.P.onDeck && D.P.ground && Math.abs(D.P.y + 2) < 0.01 && D.bodyDepth() < 0.03 && D.world.dens(D.P.x, D.P.y - 0.4) < 0'],
  ['layers', '?act=surface&scenario=layers&t=3', 'D.P.onDeck && D.PL.cells.size === 21 && !D.world.solidAt(6.5, D.P.y) && D.world.wallAt(6.5, D.P.y)'],
  ['rocks', '?act=surface&scenario=rocks&t=24', 'D.matter.awake === 0 && D.matter.list.length >= 120 && D.matter.breaks > 5 && D.matter.list.every(c => D.world.dens(c.x, c.y) < 0.08 && c.av === 0) && Math.abs(D.matter.list.reduce((a, c) => a + c.n, 0) - D.S.rocks0) < 1e-6 && D.S.rocks0 > 2000'],
  ['place', '?act=surface&scenario=place&t=1', 'D.cursorKind() === "furnace" && D.S.mode === "build" && D.S.count("furnace") === 1 && !document.querySelector("#plan [data-a=plan]")'],
  ['plan', '?act=surface&scenario=plan&t=200', 'D.S.mode === "blueprint" && D.S.plan === "assembler" && D.F.machines.some(m => m.kind === "furnace") && D.F.machines.filter(m => m.kind === "belt").length === 4 && document.querySelectorAll("#plan [data-a=plan]").length >= 6 && !document.querySelector("#plan [data-i=hub]")'],
  // round 6: one scenario for each thing the round delivers
  ['wake', '?act=surface&t=3', 'D.WRECK.inside && !D.EXO.on && D.robots.length === 0 && D.S.stage === 1 && D.F.machines.length === 0 && D.BP.ghosts.length === 0 && D.P.mob.jet === 0 && !D.RECIPES.some(r => D.canSee(r) && (r.id === "pad" || r.id === "bio-printer"))'],
  ['suitup', '?act=surface&scenario=suitup&auto=1&t=8', 'D.EXO.on && D.BOOT.shown >= 2 && D.WRECK.inside'],
  ['interior', '?act=surface&scenario=interior', 'D.WRECK.inside && D.WRECK.cut > 0.9 && D.EXO.on && D.WRECK.parts.filter(p => p.gone).length === 1 && D.WRECK.parts.length >= 30 && D.repairBill().repair > D.repairBill().fresh'],
  ['kerf', '?act=surface&scenario=kerf&auto=1&t=14', 'D.MINE.freed > 3 && D.MINE.kerfs.length >= 1 && D.K.laser.mode === "kerf" && D.matter.list.some(c => c.kg > 1) && D.K.laser.loop'],
  ['heat', '?act=surface&scenario=heat&auto=1&t=12', 'D.K.laser.heat > 0.9 && D.K.laser.pulses >= 46 && D.K.laser.pulses <= 60 && D.K.laser.wait && D.K.pw.cap === 600000'],
  ['fists', '?act=surface&scenario=fists&auto=1&t=6', '(D.S.stats.punches || 0) >= 3 && D.K.laser.state === "ship" && D.S.mode === "combat" && Object.keys(D.S.stats.kills).length >= 1'],
  ['defend', '?act=surface&scenario=defend&t=5', 'D.K.laser.pulses > 3 && Object.values(D.S.stats.kills).reduce((a, b) => a + b, 0) >= 1 && D.P.hp > 0 && D.S.defend === "always"'],
  ['swarm', '?act=surface&scenario=swarm&t=7', 'D.creatures.length + Object.values(D.S.stats.kills).reduce((a, b) => a + b, 0) >= 30 && D.K.laser.state === "turret" && D.K.laser.pulses > 10 && D.creatures.every(c => D.KIND[c.type].kg < 16)'],
  ['market', '?act=surface&scenario=market&t=25', '!!document.querySelector("#win.ai") && D.robots.some(r => r.job) && D.STOCK.zones.length >= 1 && D.MARKET.gaveUp === 0 && D.LOG.lines.length >= 1'],
  ['rescue', '?act=surface&scenario=rescue&t=13', 'D.robots.some(r => r.kind === "crawler" && (r.lifted || r.rescued)) && D.MARKET.gaveUp === 0'],
  ['stockpile', '?act=surface&scenario=stockpile&t=70', 'D.STOCK.zones.length >= 2 && D.STOCK.zones.some(z => D.zoneKg(z) > 10) && Math.abs(D.ledger().filter(e => e.item === "rubble").reduce((a, e) => a + e.n, 0) + D.robots.reduce((a, r) => a + D.inv.count(r.cargo, "rubble"), 0) - 40) < 1e-6'],
  ['reach', '?act=surface&scenario=reach&t=4', '!!document.querySelector("#reach") && /chest/.test(document.querySelector("#reach").textContent) && /hold/.test(document.querySelector("#reach").textContent) && document.querySelectorAll("#win [data-a=print]").length > 5 && D.reachable("furnace", D.ledger(), 1).n === 1'],
  ['assay', '?act=surface&scenario=assay&t=40', 'D.GEO.assays >= 1 && D.levelAt(14.2, 0.5) === 2 && D.FOG.finds.size > 5 && D.GEO.scans >= 1'],
  ['shaft', '?act=surface&scenario=shaft&t=110', 'D.F.machines.some(m => m.kind === "shaft rig" && m.depth > 0.9 && m.hoist && m.head === "rotary" && m.paid >= 2 && (m.trips || 0) >= 1)'],
  // round 7: one scenario for each fix of section 1, and for section 7
  ['rockwalk', '?act=surface&scenario=rockwalk&auto=1&t=14', 'D.P.hp === 100 && D.HIT.hits === 0 && D.S.rock0.over && D.S.rock0.done && D.P.y > 0.25 && D.P.onRock > 0 && D.HIT.climbs > 0 && !D.P.dead && D.matter.list.length >= 12'],
  ['idleaudit', '?act=surface&scenario=idleaudit&t=40', '!!document.querySelector("#audit") && D.AUDIT.samples > 40 && D.AUDIT.doable === 0 && D.AUDIT.timer === 0 && D.MARKET.gaveUp === 0 && D.robots.length === 3'],
  ['decon', '?act=surface&scenario=decon&t=14', 'D.S.decon0 && D.S.decon0.machines === 7 && D.S.decon0.decks === 4 && D.toolSlot() && D.toolSlot().id === "deconstruction planner" && (D.F.machines.some(m => m.decon) || D.BP.dmarks.length > 0) && D.robots.some(r => r.job && r.job.kind === "decon")'],
  ['decon-done', '?act=surface&scenario=decon&t=150', 'D.S.decon0 && D.S.decon0.machines === 7 && D.S.decon0.decks === 4 && D.F.machines.filter(m => m.x >= 9).length === 0 && D.PL.cells.size === 0 && (() => { const s = D.K.hold.slots.find(q => q && q.id === "furnace"); return !!s && Math.abs(s.c - 0.6) < 0.01; })() && D.inv.count(D.K.hold, "belt") === 5 && D.inv.count(D.K.hold, "platform") === 4 && D.inv.count(D.K.hold, "chest") === 1 && D.inv.count(D.K.hold, "iron") === 26 && D.MARKET.gaveUp === 0'],
  ['belts', '?act=surface&scenario=belts&t=40', 'D.F.items.length >= 4 && D.F.items.some(it => it.x > 36 && it.x < 37 && it.y > 0.6 && it.y < 4) && D.F.machines.some(m => m.kind === "belt" && Math.abs(m.dir) === 2) && D.F.machines.some(m => m.kind === "belt" && m.fast) && D.F.machines.some(m => m.kind === "assembler" && ((m.inp.iron || 0) > 0 || m.busy || (m.out.part || 0) > 0)) && D.cursorKind() === "belt" && D.BP.ghosts.length === 0'],
  ['propose', '?act=surface&scenario=propose&t=30', 'D.S.mode === "blueprint" && D.AUTO.proposals.length === 1 && D.AUTO.proposals[0].cells.length >= 8 && D.F.machines.filter(m => m.kind === "belt").length === 0 && D.BP.ghosts.length === 0'],
  ['planners', '?act=surface&scenario=planners&t=2', '["blueprint", "blueprint book", "deconstruction planner", "upgrade planner"].every((k, i) => D.S.inv.slots[i] && D.S.inv.slots[i].id === k) && D.S.inv.slots[0].d.bp.ents.length === 6 && D.S.inv.slots[1].d.pages.length === 2 && D.toolSlot() === D.S.inv.slots[0] && D.BP.ghosts.filter(g => !g.over).length + D.F.machines.filter(m => m.x >= 24).length >= 5 && D.S.up0 === 3'],
  ['collar', '?act=surface&scenario=collar&t=230', 'D.F.machines.some(m => m.kind === "shaft rig" && m.depth > 1.0 && !m.hoist && (m.trips || 0) >= 2 && (m.hoisted || 0) > 25) && !D.matter.list.some(c => c.y < -0.3 && Math.abs(c.x - 6.5) < 2)'],
  ['spoil', '?act=surface&scenario=spoil&t=260', 'D.STOCK.zones.some(z => z.name === "spoil heap" && Math.abs((z.x0 + z.x1) / 2 - D.SHIP.x) > 30) && D.FILL.list.some(f => f.kind === "berm" && (f.done || f.lvl > 0.5)) && D.F.machines.filter(m => m.kind === "chest").length === 2 && D.matter.list.some(c => c.back) && D.FILL.used > 20 && D.MARKET.gaveUp === 0'],
  ['heap', '?act=surface&scenario=heap&auto=1&t=6', 'D.P.x > -49.5 && D.P.hp === 100 && D.matter.list.filter(c => c.back).length >= 30 && D.HIT.hits === 0'],
  ['trees', '?act=surface&scenario=trees&auto=1&t=6', '(() => { const c = D.treeRec(D.S.tree0); return !!c && c.k > 2e5 && c.st === 0 && D.K.laser.pulses >= 30 && D.K.laser.pulses < D.pulsesToFell(c.d) && !!D.flora.note; })()'],
  ['felling', '?act=surface&scenario=felling&t=200', 'D.flora.felled >= 1 && D.flora.logs >= 1 && (D.matter.list.some(c => c.id === "log") || D.inv.count(D.K.hold, "log") > 0 || D.robots.some(r => D.inv.count(r.cargo, "log") > 0)) && D.MARKET.gaveUp === 0'],
  ['shop', '?act=surface&scenario=shop&t=12', '!!document.querySelector("#armq") && D.SUP.shop["cnc mill"] && D.SUP.shop["cnc mill"].r === "chest" && D.SUP.shop["metal printer"] && D.SUP.shop["metal printer"].r === "camera" && D.SUP.orders.some(o => o.item === "pcb" && o.producer === "shop:solder bench") && D.S.printer.q.some(j => j.r === "furnace") && D.S.printer.q.some(j => j.r === "cpu") && D.S.printer.q.every(j => j.r === "furnace" || j.r === "cpu") && !D.K.fab && D.WRECK.parts.filter(p => p.use === "shop").length === 4'],
  ['supports', '?act=surface&scenario=supports&t=60', 'D.MINE.supports.length >= 1 && D.MINE.collapses === 0'],
  ['collapse', '?act=surface&scenario=collapse&t=14', 'D.MINE.collapses >= 1 && D.matter.list.length > 8 && D.P.hp > 0'],
  ['wires', '?act=surface&scenario=wires&t=8', 'D.AUTO.links.length >= 3 && D.AUTO.power.loss > 0 && D.NET.signals >= 1 && D.S.alt'],
  ['needs', '?act=surface&scenario=needs&t=5', 'D.NEEDS.food < 0.25 && D.F.machines.some(m => m.kind === "pump" && m.ready) && D.F.machines.some(m => m.kind === "bunk") && D.P.pumpNear !== undefined'],
  ['fog', '?act=surface&scenario=fog&t=3', 'D.creatures.some(c => !D.S.visible(c)) && D.creatures.some(c => D.S.visible(c)) && D.FOG.radars === 1'],
  ['deckrock', '?act=surface&scenario=deckrock&t=8', 'D.matter.list.some(c => c.onDeck && c.asleep) && D.P.hp > 0'],
  ['knowledge', '?act=surface&scenario=knowledge', 'D.S.zo > 90 && D.FOG.x1 - D.FOG.x0 < 400 && D.knownR() === null && D.knownG().rel > 0.1'],
  ['launch', '?act=space&scenario=launch'], ['orbit', '?act=space'], ['mining', '?act=space&scenario=mining&auto=1&t=20'], ['combat-space', '?act=space&scenario=combat&auto=1&t=13'], ['builder', '?act=space&scenario=builder'],
];
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
if (!fs.existsSync(path.join(dist, 'index.html'))) { console.error('dist/ missing: run npm run build first'); process.exit(1); }
const server = http.createServer((q, s) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(dist, p); if (!f.startsWith(dist) || !fs.existsSync(f)) { s.writeHead(404); s.end(); return; } s.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(s); });
await new Promise(r => server.listen(port, '127.0.0.1', r));
const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--window-size=1600,900', '--autoplay-policy=no-user-gesture-required'] });
const rows = [], saveRows = []; let failed = false, tests = 'not run';
async function open(q) {
  const page = await browser.newPage(); await page.setViewport({ width: 1600, height: 900 }); const errors = [], logs = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); else logs.push(m.text()); }); page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${port}/${q}`, { waitUntil: 'load', timeout: 120000 });
  return { page, errors, logs };
}
try {
  fs.mkdirSync(path.join(root, 'docs/shots'), { recursive: true });
  for (const [name, q, cond] of SCN) {
    if (only && only !== name) continue;
    const { page, errors } = await open(q);
    try { await page.waitForFunction('window.__ready === true', { timeout: 120000 }); } catch (e) { errors.push('never became ready'); }
    await new Promise(r => setTimeout(r, wait));
    const st = await page.evaluate(() => window.__frameStats && window.__frameStats());
    if (cond) { let v = false; try { v = await page.evaluate(`(() => { const D = window.__dev.acts.surface.debug; return !!(${cond}); })()`); } catch (e) { errors.push('condition threw: ' + e.message); } if (!v) errors.push('condition not met: ' + cond); }
    const shot = `docs/shots/${name}.png`; await page.screenshot({ path: path.join(root, shot) }); await page.close();
    if (errors.length) failed = true;
    rows.push({ name, q, shot, errors, st }); console.log(name, errors.length ? 'ERRORS ' + errors.join(' | ') : 'ok', st ? `p50 ${st.p50.toFixed(0)} ms p95 ${st.p95.toFixed(0)} ms max ${st.max.toFixed(0)} ms` : '');
  }
  if (!only || only === 'save') {     // save -> reload -> identical state hash, through the real IndexedDB adapter, surface and space
    for (const [nm, q0] of [['surface', '?act=surface&scenario=factory&t=6&slot=check'], ['surface, the kit, loose matter, robots, stock targets', '?act=surface&scenario=supply&t=20&slot=check3'], ['surface, the build queue, the machine shop and the arm at work, the ground hauler', '?act=surface&scenario=autobuild&t=30&slot=check4'], ['space', '?act=space&scenario=mining&auto=1&t=6&slot=check2']]) {
      const { page, errors } = await open(q0); await page.waitForFunction('window.__ready === true', { timeout: 120000 });
      const h1 = await page.evaluate(async () => (await window.__dev.save.write()).hash);
      await page.goto(`http://127.0.0.1:${port}/${q0.replace(/&t=\d+/, '').replace(/scenario=\w+&/, '')}&continue=1`, { waitUntil: 'load' }); await page.waitForFunction('window.__ready === true', { timeout: 120000 });
      const r = await page.evaluate(() => [window.__dev.G.loadedHash, window.__dev.G.reloadHash, window.__dev.G.act]); await page.close();
      // leaving the page flushes one more save (pagehide), so the stored blob is the explicit one or that later one
      const okk = h1 && r[0] && r[0] === r[1] && !errors.length; if (!okk) failed = true; saveRows.push(`${nm}: explicit save ${h1}, stored blob ${r[0]}${r[0] === h1 ? '' : ' (the pagehide flush, newer)'}, state after reload ${r[1]}: ${okk ? 'identical' : 'DIFFERENT ' + errors.join(' | ')}`); console.log('save', saveRows[saveRows.length - 1]);
    }
  }
  if (!only || only === 'v4') {       // a real version 4 save (written by the round 4 build: tools/fixtures/save-v4.json) loads, plays, and saves as the current version
    const fix = fs.readFileSync(path.join(root, 'tools/fixtures/save-v4.json'), 'utf8'), b4 = JSON.parse(fix), s4 = b4.data.parts.surface;
    const { page, errors } = await open('?test=0&act=surface&scenario=none&slot=nothing'); await page.waitForFunction('window.__ready === true', { timeout: 120000 });
    await page.evaluate(f => localStorage.setItem('spacegame:v4fix', f), fix);
    await page.goto(`http://127.0.0.1:${port}/?act=surface&slot=v4fix&continue=1`, { waitUntil: 'load' }); await page.waitForFunction('window.__ready === true', { timeout: 120000 });
    const r = await page.evaluate(`(() => { const D = window.__dev.acts.surface.debug, dev = window.__dev; const at = [D.S.count('furnace') + D.BP.ghosts.filter(g => g.kind === 'furnace' && g.have).length + D.F.machines.filter(m => m.kind === 'furnace').length, D.S.count('basalt'), D.BP.ghosts.length, D.robots.length, D.matter.list.length, +(D.matter.total('iron ore') + D.inv.count(D.K.hold, 'iron ore') + D.robots.reduce((a, q) => a + D.inv.count(q.cargo, 'iron ore'), 0)).toFixed(3), D.PL.cells.size, D.S.known.has('furnace'), D.S.mode, D.matter.list.every(c => c.hw > 0 && c.cut.length === 4), D.F.machines.map(m => m.kind).join()]; dev.step(1200); return { at, after: [D.bodyDepth() < 0.03, D.P.ground, D.matter.awake, D.F.machines.length, D.robots.map(q => q.state).join()], v: dev.save.blob().version }; })()`);
    const h1 = await page.evaluate(async () => (await window.__dev.save.write()).hash);
    await page.goto(`http://127.0.0.1:${port}/?act=surface&slot=v4fix&continue=1`, { waitUntil: 'load' }); await page.waitForFunction('window.__ready === true', { timeout: 120000 });
    const r2 = await page.evaluate(() => [window.__dev.G.loadedHash, window.__dev.G.reloadHash]); await page.screenshot({ path: path.join(root, 'docs/shots/v4-save.png') }); await page.close();
    const ore4 = a => (a || []).reduce((q, c) => q + (c && c[0] === 'iron ore' ? c[1] : 0), 0), n4 = +(ore4(s4.matter) + ore4(s4.kit.hold) + s4.robots.reduce((q, r) => q + ore4(r.cargo), 0)).toFixed(3), okk = b4.version === 4 && r.at[0] === 1 && r.at[1] <= 33.5 && r.at[1] >= 29.5 && r.at[2] <= s4.bp.g.length && r.at[2] >= s4.bp.g.length - 1 && r.at[3] === s4.robots.length && r.at[4] <= s4.matter.length && r.at[5] === n4 && r.at[6] === 0 && r.at[7] === true && r.at[9] === true && r.after[0] && r.v === 7 && r2[0] && r2[0] === r2[1] && !errors.length;
    if (!okk) failed = true; saveRows.push(`a round 4 save (version ${b4.version}, hash ${b4.hash}, ${s4.matter.length} loose bodies, ${n4} kg of iron ore loose, carried and in the hold, ${s4.bp.g.length} ghosts, ${s4.robots.length} robots) migrated to version ${r.v}: the suit (its furnace went straight into the frame beside it), the queue, the robots and every kilogram of ore are there (the arm may already have taken 4 kg of your basalt for the silicon of the chip an assembler's controller needs: round 7), the loose bodies have shapes, 10 s of play, then saved and reloaded as version ${r.v} with state ${r2[1]}: ${okk ? 'ok' : 'FAILED ' + JSON.stringify(r) + ' ' + errors.join(' | ')}`); console.log('v4', saveRows[saveRows.length - 1]);
  }
  if (!only || only === 'v5') {       // a real version 5 save (written by the round 5 build, tag v0.5: tools/fixtures/save-v5.json) loads, plays, and saves as the current version
    const fix = fs.readFileSync(path.join(root, 'tools/fixtures/save-v5.json'), 'utf8'), b5 = JSON.parse(fix), s5 = b5.data.parts.surface;
    const { page, errors } = await open('?test=0&act=surface&scenario=none&slot=nothing'); await page.waitForFunction('window.__ready === true', { timeout: 120000 });
    await page.evaluate(f => localStorage.setItem('spacegame:v5fix', f), fix);
    await page.goto(`http://127.0.0.1:${port}/?act=surface&slot=v5fix&continue=1`, { waitUntil: 'load' }); await page.waitForFunction('window.__ready === true', { timeout: 120000 });
    const r = await page.evaluate(`(() => { const D = window.__dev.acts.surface.debug, dev = window.__dev, ore = () => +(D.matter.total('iron ore') + D.inv.count(D.K.hold, 'iron ore') + D.S.count('iron ore') + D.robots.reduce((a, q) => a + D.inv.count(q.cargo, 'iron ore'), 0) + D.F.machines.reduce((a, m) => a + (m.inp['iron ore'] || 0), 0)).toFixed(3); const at = [D.EXO.on, D.BOOT.done, D.suitStats().on, D.robots.length, D.F.machines.map(m => m.kind).sort().join(), ore(), D.S.count('basalt'), D.PL.cells.size, D.WRECK.parts.length, D.WRECK.parts.some(p => p.gone), D.levelAt(0, 0), D.S.stage, D.BP.ghosts.length]; dev.step(1200); return { at, after: [D.bodyDepth() < 0.03, D.P.hp > 0, D.robots.map(q => q.state).join(), D.MARKET.gaveUp], v: dev.save.blob().version }; })()`);
    const h1 = await page.evaluate(async () => (await window.__dev.save.write()).hash);
    await page.goto(`http://127.0.0.1:${port}/?act=surface&slot=v5fix&continue=1`, { waitUntil: 'load' }); await page.waitForFunction('window.__ready === true', { timeout: 120000 });
    const r2 = await page.evaluate(() => [window.__dev.G.loadedHash, window.__dev.G.reloadHash]); await page.screenshot({ path: path.join(root, 'docs/shots/v5-save.png') }); await page.close();
    const ore5 = a => (a || []).reduce((q, c) => q + (c && c[0] === 'iron ore' ? c[1] : 0), 0), n5 = +(ore5(s5.matter) + ore5(s5.kit.hold) + ore5(s5.inv) + s5.robots.reduce((q, r) => q + ore5(r.cargo), 0) + s5.factory.m.reduce((q, m) => q + ((m.i && m.i['iron ore']) || 0), 0)).toFixed(3), kinds5 = s5.factory.m.map(m => m.k).sort().join();
    const okk = b5.version === 5 && r.at[0] === true && r.at[1] === true && r.at[2] === true && r.at[3] === s5.robots.length && r.at[4] === kinds5 && Math.abs(r.at[5] - n5) < 0.002 && r.at[6] <= 21 && r.at[6] >= 17 && r.at[7] === s5.plats.length && r.at[8] >= 30 && r.at[9] === false && r.at[10] === 1 && r.at[11] >= 2 && r.after[0] && r.after[1] && r.after[3] === 0 && r.v === 7 && r2[0] && r2[0] === r2[1] && !errors.length;
    if (!okk) failed = true; saveRows.push(`a round 5 save (version ${b5.version}, hash ${b5.hash}, written by the v0.5 build: ${s5.robots.length} robots, ${kinds5}, ${n5} kg of iron ore loose, carried, in the suit, the hold and the furnace, ${s5.bp.g.length} ghosts, ${s5.plats.length} deck) migrated to version ${r.v}: you are in the exosuit with the ai up, the wreck has all its parts, the crash site counts as scanned, the robots, the machines, the deck and every kilogram of ore are there, 10 s of play with no robot giving a job up, then saved and reloaded with state ${r2[1]}: ${okk ? 'ok' : 'FAILED ' + JSON.stringify(r) + ' n5 ' + n5 + ' ' + errors.join(' | ')}`); console.log('v5', saveRows[saveRows.length - 1]);
  }
  if (!only || only === 'v6') {       // a real version 6 save (written by the round 6 build, tag v0.6, with its "fabricator" at work on a furnace: tools/fixtures/save-v6.json) loads, plays, and saves as version 7
    const fix = fs.readFileSync(path.join(root, 'tools/fixtures/save-v6.json'), 'utf8'), b6 = JSON.parse(fix), s6 = b6.data.parts.surface, cnt = (a, id) => (a || []).reduce((q, c) => q + (c && c[0] === id ? c[1] : 0), 0);
    const { page, errors } = await open('?test=0&act=surface&scenario=none&slot=nothing'); await page.waitForFunction('window.__ready === true', { timeout: 120000 });
    await page.evaluate(f => localStorage.setItem('spacegame:v6fix', f), fix);
    await page.goto(`http://127.0.0.1:${port}/?act=surface&slot=v6fix&continue=1`, { waitUntil: 'load' }); await page.waitForFunction('window.__ready === true', { timeout: 120000 });
    const r = await page.evaluate(`(() => { const D = window.__dev.acts.surface.debug, dev = window.__dev; const at = { basalt: D.inv.count(D.K.hold, 'basalt'), iron: D.inv.count(D.K.hold, 'iron'), shop: Object.values(D.SUP.shop).filter(Boolean).map(j => j.r), fab: !!D.K.fab, parts: D.WRECK.parts.length, tools: D.WRECK.parts.filter(p => p.use === 'shop' && !p.gone).map(p => p.name).sort().join(), robots: D.robots.length, ghosts: D.BP.ghosts.map(g => g.kind).sort().join(), machines: D.F.machines.map(m => m.kind).sort().join(), zones: D.STOCK.zones.map(z => [z.name, z.limit]), planners: D.PLANNERS.map(k => D.S.count(k)).join(), arm: D.EXO.arm, belt: D.S.count('belt'), plat: D.S.count('platform'), loose: D.matter.list.length }; dev.step(1800); return { at, after: { depth: D.bodyDepth() < 0.03, hp: D.P.hp > 0, gave: D.MARKET.gaveUp, doable: D.AUDIT.doable, armQ: D.S.printer.q.map(j => j.r), shop: Object.entries(D.SUP.shop).filter(q => q[1]).map(q => q[0] + ':' + q[1].r), orders: D.SUP.orders.map(o => [o.item, o.producer]), zones: D.STOCK.zones.map(z => [z.name, z.limit]) }, v: dev.save.blob().version }; })()`);
    const h1 = await page.evaluate(async () => (await window.__dev.save.write()).hash);
    await page.goto(`http://127.0.0.1:${port}/?act=surface&slot=v6fix&continue=1`, { waitUntil: 'load' }); await page.waitForFunction('window.__ready === true', { timeout: 120000 });
    const r2 = await page.evaluate(() => [window.__dev.G.loadedHash, window.__dev.G.reloadHash]); await page.screenshot({ path: path.join(root, 'docs/shots/v6-save.png') }); await page.close();
    const fab6 = s6.supply.fab, okk = b6.version === 6 && fab6 && fab6[0] === 'furnace' && Math.abs(r.at.basalt - (cnt(s6.kit.hold, 'basalt') + 40)) < 1e-6 && Math.abs(r.at.iron + (r.at.shop.includes('chest') ? 7.2 : 0) - cnt(s6.kit.hold, 'iron')) < 1e-6 && r.at.shop.every(q => q === 'chest') && !r.at.fab && r.at.parts === 37 && r.at.tools === 'cnc mill,metal printer,polymer printer,solder bench' && r.at.robots === s6.robots.length && r.at.ghosts === s6.bp.g.map(g => g[0]).sort().join() && r.at.zones.some(z => z[0] === 'old rock pile' && z[1] === 0) && r.at.planners === '1,1,1,1' && r.at.arm === 1 && r.at.belt === 6 && r.at.plat === 3 && r.after.depth && r.after.hp && r.after.gave === 0 && r.after.doable === 0 && r.v === 7 && r2[0] && r2[0] === r2[1] && !errors.length;
    if (!okk) failed = true; saveRows.push(`a round 6 save (version ${b6.version}, hash ${b6.hash}, written by the v0.6 build with its "fabricator" 16 s into a furnace: ${s6.robots.length} robots, ${s6.bp.g.length} ghosts, ${s6.stock.z.map(z => z[1]).join(' and ')}) migrated to version ${r.v}: there is no fabricator and no job of one, the 40 kg of basalt it had taken are back in the hold (${r.at.basalt} kg), the wreck has its machine shop (${r.at.tools}), the old rock pile is closed, the four planners are in the suit, the queue, the robots and what you carried are there; 15 s of play (${r.after.shop.join(', ') || 'no shop job yet'}; on the arm: ${r.after.armQ.join(', ') || 'nothing'}) with nothing given up, then saved and reloaded with state ${r2[1]}: ${okk ? 'ok' : 'FAILED ' + JSON.stringify(r) + ' ' + errors.join(' | ')}`); console.log('v6', saveRows[saveRows.length - 1]);
  }
  if (!only || only === 'test') {
    const { page, errors, logs } = await open('?test=1');
    try { await page.waitForFunction('window.__tests !== undefined', { timeout: 120000 }); } catch (e) { errors.push('tests never finished'); }
    tests = await page.evaluate(() => window.__tests) || 'none'; await page.close();
    if (!/^tests ok \d+$/.test(tests) || errors.length) { failed = true; console.log('TEST ERRORS', errors.join(' | '), logs.filter(l => /FAIL/.test(l)).join(' | ')); }
    console.log(tests);
  }
} finally { await browser.close(); server.close(); }
if (!only) {
  const md = ['# CHECK', '', `Run: ${new Date().toISOString()} by \`node tools/check.mjs\` on ${os.hostname()} (${os.arch()}, Node ${process.version}).`,
    'Browser: /usr/bin/chromium headless, software GL (`--use-angle=swiftshader`). **Frame times below are software-rendering numbers, not a GPU number**; the 16.7 ms budget must be measured on a machine with a GPU.', '',
    `Result: **${failed ? 'FAIL' : 'PASS'}**. Property tests: \`${tests}\`.`, '', 'Save round-trip (save, reload the page, compare the state hash):', ...saveRows.map(r => '- ' + r), '', '| scenario | url | shot | console errors | p50 ms | p95 ms | max ms |', '|---|---|---|---|---|---|---|',
    ...rows.map(r => `| ${r.name} | \`${r.q}\` | [${r.shot}](shots/${r.name}.png) | ${r.errors.length ? r.errors.join('; ').replace(/\|/g, '/') : '0'} | ${r.st ? r.st.p50.toFixed(0) : '-'} | ${r.st ? r.st.p95.toFixed(0) : '-'} | ${r.st ? r.st.max.toFixed(0) : '-'} |`), '',
    '## Round 7: what each new shot is proof of', '',
    'Round 7 is play fixes only: `docs/ROUND7.md` section 1 (items 1 to 8) and section 7 (one matter compiler); status of each in `docs/ROUND7-STATUS.md`. Every scenario below carries a condition on the live state; the rules themselves are pinned by ten new property tests (`?test=1`, 53 to 62: the walk through a pile of rocks that killed Leif, the idle audit, deconstruction and condition, belts as paths and the AI only proposing, the planners as items, the collar bin, spoil and the back layer, a tree by energy and by physics, the machine shop and the arm, the migration 6 to 7). `node tools/ui-flow.mjs` (F) lays a belt path, marks, unmarks, removes by a held right button, copies and pastes with a real mouse; `node tools/play.mjs` plays all eight by real input for twenty game minutes with the forest and the hive on, and writes the idle audit to `docs/shots/play.json`.', '',
    '- `rockwalk` (1): the body sprinted at a pile of fifteen rocks, went over it, came back and stands on it: full health, not one hit (condition: over and back, standing on rock, climbed, no hit).',
    '- `idleaudit` (2): the J window with the idle audit: open jobs, idle robots, and for each idle robot the reason it takes none of them; what is not a job yet and why (condition: 40 or more samples, none idle beside doable work, nothing given up).',
    '- `decon` (3): fourteen seconds after one drag of the deconstruction planner over a worn furnace, a chest, five belts and four decks: red marks, a drone taking the furnace apart. `decon-done`: all of it down and in the hold, the furnace kit at the 60 % it was worn to, the chest\'s iron with it (condition: the counts, the kit\'s condition, nothing given up).',
    '- `belts` (4): a belt laid as a path from the furnace\'s port along the ground, up a lift and along a ledge into the assembler\'s port, the last cells fast belt; lumps of iron riding it; the ports of the machines marked while a belt is on the cursor (condition: items on the line and on the lift, a lift, a fast belt, iron arrived, no plans).',
    '- `propose` (4): blueprint mode: the line the AI would lay between a furnace and an assembler, drawn as a proposal; nothing laid, nothing planned (condition: one proposal of eight or more cells, no belt, no ghost). `conveyor`: the same flow two minutes on with nobody answering: still robots, still no belt.',
    '- `planners` (5): the blueprint, the book, the deconstruction planner and the upgrade planner in slots 1 to 4; the blueprint holds six things and is on the cursor as plans; one paste is being built; three fast belts are planned over belts (condition: the four items, six entities, two pages in the book, the paste, the upgrades).',
    '- `collar` (6): a shaft rig with no hoist line: the bucket on its rope, the collar bin beside the headframe, a drone carrying from it to the spoil heap; nothing lying down the shaft (condition: over a metre sunk, two or more trips, 25 kg or more hoisted, no body at the face).',
    '- `spoil` (7): a berm going up east of the base from loose spoil (its outline, the part laid so far), robots carrying to it; the chest that was planned over a hole stands on its pad (condition: the heap sited over 30 m from the wreck, the berm laid or rising, both chests, bodies on the back layer, spoil used).',
    '- `heap` (7): the spoil heap on the back layer and the body in front of it: it walked from one side of the heap to the other (condition: past it, unhurt, thirty bodies on the back layer, no hit).',
    '- `trees` (8): the laser on a trunk: char, embers, the kerf part of the way through, the pulses still to go on the HUD (condition: joules in the kerf, thirty or more pulses fired and fewer than the trunk needs, still standing).',
    '- `felling` (8): two trees marked with the deconstruction planner: sawn by the drones, fallen along the slope, being cut into logs (condition: one or more felled, one or more logs, nothing given up).',
    '- `shop` (section 7): the J window: the arm\'s queue first (a furnace and two chips: nothing else here makes them), then the ship\'s machine shop (the mill on a chest, the powder printer on a camera, the bench waiting for a chip), then the queue (condition: those jobs on those tools, only furnace and chips on the arm, no fabricator anywhere, four shop tools in the wreck).',
    '- `v6-save` (from the save check): a save written by the round 6 build with its fabricator at work, loaded in this one.',
    '- `play-rocks`, `play-craft`, `play-furnace`, `play-belt-drag`, `play-belt`, `play-blueprint`, `play-decon`, `play-rig-drag`, `play-tree-kerf`, `play-tree-down`, `play-logs`, `play-collar`, `play-spoil`, `play-audit`, `play-end` (from `tools/play.mjs`), `tools-flow` (from `tools/ui-flow.mjs`): the same by hand.',
    '',
    '## Round 6: what each new shot is proof of', '',
    'Round 6 is in `docs/ROUND6.md` (Leif\'s words) and `docs/ROUND6-STATUS.md` (each section: done, partial, moved to round 7). Every round 6 scenario carries a condition on the live state; the numbers themselves are pinned by the property tests (`?test=1`: the dig rate from energy, the heat sink\'s pulse count, ablation and the punch, the task market, the ground path-finding and the rescue of a stuck hauler, the composition ranges and the estimate after an assay, a kerf that frees a block, support priority, collapse, the suit, the wreck, the ledger, queue-anything, wire loss, the migration 5 to 6). `node tools/play.mjs` plays the new start by real input with the forest and the hive left on.', '',
    '- `wake`: the default start: inside the wreck, in the crew room, without the suit. No instruments: a mask, the hands, the body. The hull is cut away; nothing from later is in any menu (condition: inside, no suit, no robots, stage 1, no pad or bio-printer recipe visible).',
    '- `suitup`: the same start played by itself: aft to the locker, the suit on, the boot lines coming up (condition: suit on, boot running).',
    '- `interior`: the wreck from inside, suited, lights on: frame and ribs, the volumes (engine bay, hold, tank, reactor bay, the sealed section behind the bulkhead: life support, crew room, computer bay, cockpit) and the parts that fill them; one turbopump salvaged and gone (condition: 30 or more parts, one gone, repair dearer than a new hull).',
    '- `kerf`: the laser in kerf mode, the reactor set down for its coolant line: a slot through the shoulder of the outcrop and the cap it cut off, fallen as blocks (condition: kilograms freed, bodies, the coolant line).',
    '- `heat`: pulses into the ground with the reactor on the back (600 kW): the sink full after its 48, the HUD counting (condition: 46 to 60 pulses in 12 s, the laser waiting).',
    '- `fists`: no laser: combat mode, punches at the first workers of a hive (condition: punches thrown, something killed, the laser still on the ship).',
    '- `defend`: nobody touches the mouse: the body turns, fires and steps back by itself (condition: pulses fired and a kill with no input).',
    '- `swarm`: numbers: thirty-odd small bodies against the turret and its sink (condition: thirty bodies, none over 16 kg, the turret firing).',
    '- `market`: the AI window on the task market: the queue with bids, what waits and why, the log of decisions, the stockpiles (condition: jobs taken, a zone open, nothing given up).',
    '- `rescue`: a hauler on a ledge with no way down, in the lines of the two drones (condition: lifted or already set down, nothing given up).',
    '- `stockpile`: loose rock of four kinds tidied into the zones the AI opened for them (condition: two zones, kilograms in them, the ledger still exact).',
    '- `reach`: the inventory window: what is on you, what is in reach with its place and its time, the suit and its slots, the recipes by what can be done now (condition: the chest and the hold in the list, the furnace in reach).',
    '- `assay`: a scan ring on the outcrop, the finds marked, the assay station sorting rubble (condition: an assay done, its ground at level 2).',
    '- `shaft`: the shaft rig: headframe, string, casing, rotary head, the hoist\'s skip, sunk as far as it was paid for (condition: sinking at its centimetre a second, modules fitted, a skip trip).',
    '- `supports`: a drift under its safe factor: the bolts the AI planned and had a drone set (condition: a support stands, nothing fell).',
    '- `collapse`: the same with a wider span and no help: the roof on the floor as bodies (condition: a collapse, rock down, you alive at the mouth).',
    '- `wires`: Alt held: the grid as sagging cable with its current, the radio links, the reach of every antenna, sensor, node and the turret (condition: links, a loss figure, a signal).',
    '- `needs`: the four needs low on the HUD; the pump, filter and controller out of the wreck standing in the open with furniture (condition: the pump ready).',
    '- `fog`: one animal in sight, one that went behind the rock (a ghost where it was), the radar up (condition: one seen, one not).',
    '- `deckrock`: rock that fell on a deck lying on it (condition: a body asleep on a deck).',
    '- `knowledge`: the planet from far out, dark but for the slice that has been seen; g with a range, the radius unknown (condition: under 400 m known).',
    '- `v5-save` (from the save check): a save written by the round 5 build, loaded in this one.',
    '- `play-wake`, `play-boot`, `play-reach`, `play-scan`, `play-kerf`, `play-blocks` (from `tools/play.mjs`): the round 6 start by hand.',
    '',
    '## Round 5: what each new shot is proof of', '',
    'Round 5 is a robustness round. Its proof is mostly not in pictures: it is in the property tests (`?test=1`: the field is a distance again after an edit; no tunnelling at terminal velocity onto a floor, a wall, a deck and fresh-dug ground; a rock stack comes to rest; a pile wakes when its support is taken; fracture conserves mass; a hard landing breaks rock; a robot job completes with one fetcher for one kit; a robot goes round a wall; the path search; inventory place consumes the item; blueprint mode places what you hold and plans what you do not; what cannot be made yet is not shown; a blueprint ghost gets built; save migration 4 to 5), in the version 4 save loaded above, and in `node tools/play.mjs`, which plays a fresh start with real keys and a real mouse and writes `docs/shots/play.json`. The shots:', '',
    '- `fall`: dropped from seven metres over a shaft: standing on the first deck, air under it, the back wall of the shaft behind (condition: on the deck at -2 m, not in rock).',
    '- `layers`: decks at three heights in a cut shaft and two round chambers dug beside it: every cut shows darker rock behind it, never sky (condition: on a deck, 21 deck cells, the chamber is air with the wall bit set).',
    '- `rocks`: 120 rocks (2,491 kg) let go over a hollow, 24 s later: broken where they landed hard, piled, all asleep, none in the ground, the amounts unchanged (condition: all of that).',
    '- `place`: a furnace in slot 1 on the cursor in normal mode: the thing itself, framed green where the click will put it; no plan row (condition: the cursor is the furnace, one in the inventory).',
    '- `plan`: blueprint mode two minutes on: the dashed plan row with only what can be made, an assembler ghost on the cursor, and the furnace and four belts that were ghosts, built by the drones (condition: mode, plan, the machines, no hub in the row).',
    '- `v4-save` (from the save check): the round 4 save loaded in the round 5 build.',
    '- `play-cut`, `play-craft`, `play-furnace-cursor`, `play-deck`, `play-ghost`, `play-end` (from `tools/play.mjs`): the by-hand run: the cut with the wall behind it, the crafting menu, the furnace on the cursor, standing on a deck over the pit, the chest ghost, the end state.',
    '- `place-flow` (from `tools/ui-flow.mjs`): a furnace placed from its slot, then a furnace ghost planned with Q and a click.',
    '',
    '## Round 4: what each new shot is proof of', '',
    'Every round 4 scenario also carries a condition on the live game state, evaluated when the shot is taken; a shot whose condition does not hold fails the check.', '',
    '- `planet`: the whole planet from far out: the disc, the thin limb of air, the forest as a glowing skin, the crust and the dull core, the ringed giant behind it. The camera sits on the centre (condition: zoom over 90, camera at -642 m).',
    '- `horizon`: thirteen times out: the ground is a curve, the giant stands over it.',
    '- `far90`: 95 degrees east of the crash site and walking on. The camera has turned with gravity: down is the bottom of the screen (condition: longitude over 94, moving).',
    '- `seam`: walking west across the place where the two charts of the planet meet: nothing shows (condition: the chart changed under the player).',
    '- `antipode`: the far side, 180 degrees round: the mouth of the hive\'s main base. The giant never rises here.',
    '- `autobuild`: four frames placed with no kit anywhere, five minutes on: the arm printed the furnace and the assembler (round 7: no machine in the wreck can make either), the mill made the chest, drones built them in queue order, the hub still waits for lumen and says so (condition: both machines stand, both were the arm\'s, the hub names lumen).',
    '- `queue`: the AI window (J) on the same scene: the build queue with a reason on every line and arrows to reorder it, logistics, the stock-target editor.',
    '- `conveyor`: a furnace and an assembler five metres apart on level ground (round 7: the AI no longer lays the belt by itself): robots carry the iron, the belt is a proposal, and the reason is on the HUD (condition: no belt, no ghost, a proposal, iron in the assembler).',
    '- `overhang`: ore under a ledge where no drone can drop a line: the six-legged ground hauler walks in under it (condition: the hauler is past the ledge\'s edge or loaded).',
    '- `targets`: the stock-target editor: have / target, minus, plus, remove, and the grid of things to keep in stock as well.',
    '- `ai-flow` (from `tools/ui-flow.mjs`): the same window reached with real keys, after planning a chest in blueprint mode (Tab) and raising the iron target with the + button.',
    '',
    '## Round 3: what each new shot is proof of', '',
    '- `surface`: the default start. Unarmed beside the wreck: the laser on its hardpoint, the reactor in its bay, the antenna frame, the canopy torn open over the crash site, the stock targets already counting.',
    '- `slice`: the same start played by itself for 16 s: laser unbolted, reactor pulled and carried, the outcrop cut. Heat in the rock, molten edges, loose rock with mass lying in the cut, the antenna built on the way, the robots awake, the hive stirring.',
    '- `reactor`: the body under 178 kg: the lean against the pack, the planted feet, the cable from the reactor to the laser.',
    '- `turret`: the laser on its legs, the reactor set down and cabled to it, the antenna up, the AI aiming it at a stalker.',
    '- `herd`: striders that have seen the lamp: heads up, flank lights bright, keeping their distance. Nothing attacks.',
    '- `predator`: the stalker, bigger than the player, hunting.',
    '- `supply`: stock targets in the HUD, the furnace as producer for iron, robots carrying with the load slung under them, the arm waiting for inputs for the cells.',
    '- `drill`: the beam, the heat field, the cut, the chunks.',
    '- `forest`: the layers: play plane, seven behind, two in front, fog veils between, shafts of planet-light.',
    '- `kit-flow` (from `tools/ui-flow.mjs`): the end of the real-keys run: laser as a turret, reactor on the ground.',
    '', 'The interface run (`node tools/ui-flow.mjs`) and the by-hand run (`node tools/play.mjs`) are separate commands; their JSON lines are the proof that the keys do what the README says.', ''];
  fs.writeFileSync(path.join(root, 'docs/CHECK.md'), md.join('\n'));
}
process.exit(failed ? 1 : 0);

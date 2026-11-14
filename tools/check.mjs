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
  ['autobuild', '?act=surface&scenario=autobuild&t=75', 'D.F.machines.some(m => m.kind === "furnace") && D.F.machines.some(m => m.kind === "assembler") && D.queueView(D.robots).some(q => /waits for lumen/.test(q.why))'],
  ['queue', '?act=surface&scenario=queue&t=20', '!!document.querySelector("#win.ai .qr [data-a=q-up]") && D.queueView(D.robots).length >= 2'],
  ['conveyor', '?act=surface&scenario=conveyor&t=40', 'D.F.machines.filter(m => m.kind === "belt" && m.auto).length >= 8 && D.AUTO.routes.some(r => r.mode === "belt" && r.done) && D.AUTO.routes.some(r => r.mode === "robot") && D.F.machines.some(m => m.kind === "assembler" && (m.inp.iron > 0 || m.busy))'],
  ['overhang', '?act=surface&scenario=overhang&t=4', 'D.robots.some(r => r.kind === "crawler" && r.x > 2.5 && r.x < 8 && r.state === "cfetch") && D.matter.list.some(c => c.x > 3 && c.x < 7.5)'],
  ['targets', '?act=surface&scenario=targets&t=30', 'document.querySelectorAll("#win.ai [data-a=tg-inc]").length >= 3 && document.querySelectorAll("#win.ai [data-a=tg-add]").length > 10'],
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
    for (const [nm, q0] of [['surface', '?act=surface&scenario=factory&t=6&slot=check'], ['surface, the kit, loose matter, robots, stock targets', '?act=surface&scenario=supply&t=20&slot=check3'], ['surface, the build queue, the ship fabricator, the ground hauler', '?act=surface&scenario=autobuild&t=12&slot=check4'], ['space', '?act=space&scenario=mining&auto=1&t=6&slot=check2']]) {
      const { page, errors } = await open(q0); await page.waitForFunction('window.__ready === true', { timeout: 120000 });
      const h1 = await page.evaluate(async () => (await window.__dev.save.write()).hash);
      await page.goto(`http://127.0.0.1:${port}/${q0.replace(/&t=\d+/, '').replace(/scenario=\w+&/, '')}&continue=1`, { waitUntil: 'load' }); await page.waitForFunction('window.__ready === true', { timeout: 120000 });
      const r = await page.evaluate(() => [window.__dev.G.loadedHash, window.__dev.G.reloadHash, window.__dev.G.act]); await page.close();
      // leaving the page flushes one more save (pagehide), so the stored blob is the explicit one or that later one
      const okk = h1 && r[0] && r[0] === r[1] && !errors.length; if (!okk) failed = true; saveRows.push(`${nm}: explicit save ${h1}, stored blob ${r[0]}${r[0] === h1 ? '' : ' (the pagehide flush, newer)'}, state after reload ${r[1]}: ${okk ? 'identical' : 'DIFFERENT ' + errors.join(' | ')}`); console.log('save', saveRows[saveRows.length - 1]);
    }
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
    '## Round 4: what each new shot is proof of', '',
    'Every round 4 scenario also carries a condition on the live game state, evaluated when the shot is taken; a shot whose condition does not hold fails the check.', '',
    '- `planet`: the whole planet from far out: the disc, the thin limb of air, the forest as a glowing skin, the crust and the dull core, the ringed giant behind it. The camera sits on the centre (condition: zoom over 90, camera at -642 m).',
    '- `horizon`: thirteen times out: the ground is a curve, the giant stands over it.',
    '- `far90`: 95 degrees east of the crash site and walking on. The camera has turned with gravity: down is the bottom of the screen (condition: longitude over 94, moving).',
    '- `seam`: walking west across the place where the two charts of the planet meet: nothing shows (condition: the chart changed under the player).',
    '- `antipode`: the far side, 180 degrees round: the mouth of the hive\'s main base. The giant never rises here.',
    '- `autobuild`: four frames placed with no kit anywhere, 75 s on: the ship fabricator made the kits from the hold, drones built the furnace and the assembler in queue order, the hub still waits for lumen and says so (condition: both machines stand, the hub names lumen).',
    '- `queue`: the ship AI window (J) on the same scene: the build queue with a reason on every line and arrows to reorder it, logistics, the stock-target editor.',
    '- `conveyor`: a furnace and an assembler five metres apart on level ground: the AI laid the belt itself and iron rides it; the second furnace, across the wreck, is served by robots, and the reason is on the HUD (condition: eight or more AI belts, one belt route done, one robot route, iron in the assembler).',
    '- `overhang`: ore under a ledge where no drone can drop a line: the six-legged ground hauler walks in under it (condition: the hauler is past the ledge\'s edge or loaded).',
    '- `targets`: the stock-target editor: have / target, minus, plus, remove, and the grid of things to keep in stock as well.',
    '- `ai-flow` (from `tools/ui-flow.mjs`): the same window reached with real keys, after placing a chest frame with B and raising the iron target with the + button.',
    '',
    '## Round 3: what each new shot is proof of', '',
    '- `surface`: the default start. Unarmed beside the wreck: the laser on its hardpoint, the reactor in its bay, the antenna frame, the canopy torn open over the crash site, the stock targets already counting.',
    '- `slice`: the same start played by itself for 16 s: laser unbolted, reactor pulled and carried, the outcrop cut. Heat in the rock, molten edges, loose rock with mass lying in the cut, the antenna built on the way, the robots awake, the hive stirring.',
    '- `reactor`: the body under 178 kg: the lean against the pack, the planted feet, the cable from the reactor to the laser.',
    '- `turret`: the laser on its legs, the reactor set down and cabled to it, the antenna up, the ship AI aiming it at a stalker.',
    '- `herd`: striders that have seen the lamp: heads up, flank lights bright, keeping their distance. Nothing attacks.',
    '- `predator`: the stalker, bigger than the player, hunting.',
    '- `supply`: stock targets in the HUD, the furnace as producer for iron, robots carrying with the load slung under them, the arm waiting for inputs for the cells.',
    '- `drill`: the beam, the heat field, the cut, the chunks.',
    '- `forest`: the layers: play plane, seven behind, two in front, fog veils between, shafts of planet-light.',
    '- `kit-flow` (from `tools/ui-flow.mjs`): the end of the real-keys run: laser as a turret, reactor on the ground.',
    '', 'The interface run (`node tools/ui-flow.mjs`) is a separate command; its four JSON lines are the proof that the keys do what the README says.', ''];
  fs.writeFileSync(path.join(root, 'docs/CHECK.md'), md.join('\n'));
}
process.exit(failed ? 1 : 0);

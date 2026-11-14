// tools/check.mjs: serves dist/, opens every scenario in headless Chromium (software GL), saves docs/shots/<name>.png,
// fails on any console error, runs ?test=1, and writes docs/CHECK.md.   usage: node tools/check.mjs [--only name] [--port 5200]
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), dist = path.join(root, 'dist');
const arg = n => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : null; };
const port = +(arg('port') || 5200), only = arg('only'), wait = +(arg('wait') || 4000);
const SCN = [
  ['surface', '?act=surface'], ['factory', '?act=surface&scenario=factory&t=30'], ['launch', '?act=space&scenario=launch'],
  ['orbit', '?act=space'], ['mining', '?act=space&scenario=mining&auto=1&t=20'], ['combat', '?act=space&scenario=combat&auto=1&t=13'], ['builder', '?act=space&scenario=builder'],
];
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
if (!fs.existsSync(path.join(dist, 'index.html'))) { console.error('dist/ missing: run npm run build first'); process.exit(1); }
const server = http.createServer((q, s) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(dist, p); if (!f.startsWith(dist) || !fs.existsSync(f)) { s.writeHead(404); s.end(); return; } s.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(s); });
await new Promise(r => server.listen(port, '127.0.0.1', r));
const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--window-size=1600,900', '--autoplay-policy=no-user-gesture-required'] });
const rows = []; let failed = false, tests = 'not run';
async function open(q) {
  const page = await browser.newPage(); await page.setViewport({ width: 1600, height: 900 }); const errors = [], logs = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); else logs.push(m.text()); }); page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${port}/${q}`, { waitUntil: 'load', timeout: 120000 });
  return { page, errors, logs };
}
try {
  fs.mkdirSync(path.join(root, 'docs/shots'), { recursive: true });
  for (const [name, q] of SCN) {
    if (only && only !== name) continue;
    const { page, errors } = await open(q);
    try { await page.waitForFunction('window.__ready === true', { timeout: 120000 }); } catch (e) { errors.push('never became ready'); }
    await new Promise(r => setTimeout(r, wait));
    const st = await page.evaluate(() => window.__frameStats && window.__frameStats());
    const shot = `docs/shots/${name}.png`; await page.screenshot({ path: path.join(root, shot) }); await page.close();
    if (errors.length) failed = true;
    rows.push({ name, q, shot, errors, st }); console.log(name, errors.length ? 'ERRORS ' + errors.join(' | ') : 'ok', st ? `p50 ${st.p50.toFixed(0)} ms p95 ${st.p95.toFixed(0)} ms max ${st.max.toFixed(0)} ms` : '');
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
    `Result: **${failed ? 'FAIL' : 'PASS'}**. Property tests: \`${tests}\`.`, '', '| scenario | url | shot | console errors | p50 ms | p95 ms | max ms |', '|---|---|---|---|---|---|---|',
    ...rows.map(r => `| ${r.name} | \`${r.q}\` | [${r.shot}](shots/${r.name}.png) | ${r.errors.length ? r.errors.join('; ').replace(/\|/g, '/') : '0'} | ${r.st ? r.st.p50.toFixed(0) : '-'} | ${r.st ? r.st.p95.toFixed(0) : '-'} | ${r.st ? r.st.max.toFixed(0) : '-'} |`), ''];
  fs.writeFileSync(path.join(root, 'docs/CHECK.md'), md.join('\n'));
}
process.exit(failed ? 1 : 0);

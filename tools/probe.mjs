// tools/probe.mjs: one page of the built game in headless Chromium: wait, evaluate an expression against the live
// state (D = surface.debug), optionally save a shot.   usage: node tools/probe.mjs '<query>' ['<js expr>'] [shot.png] [--wait ms] [--port n]
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), dist = path.join(root, 'dist');
const av = process.argv.slice(2), opt = n => { const i = av.indexOf('--' + n); if (i < 0) return null; const v = av[i + 1]; av.splice(i, 2); return v; };
const wait = +(opt('wait') || 1500), port = +(opt('port') || 5233), [q, expr, shot] = av;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer((rq, s) => { let p = decodeURIComponent(rq.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(dist, p); if (!f.startsWith(dist) || !fs.existsSync(f)) { s.writeHead(404); s.end(); return; } s.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(s); });
await new Promise(r => server.listen(port, '127.0.0.1', r));
const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--window-size=1600,900'] });
let code = 0;
try {
  const page = await browser.newPage(); await page.setViewport({ width: 1600, height: 900 }); const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); else if (/^tests /.test(m.text())) console.log(m.text()); }); page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${port}/${q || ''}`, { waitUntil: 'load', timeout: 180000 });
  try { await page.waitForFunction('window.__ready === true', { timeout: 180000 }); } catch (e) { errors.push('never became ready'); }
  await new Promise(r => setTimeout(r, wait));
  if (expr) { try { console.log(JSON.stringify(await page.evaluate(`(() => { const D = window.__dev.acts.surface.debug; return (${expr}); })()`))); } catch (e) { console.log('expr threw: ' + e.message); code = 1; } }
  if (shot) await page.screenshot({ path: path.resolve(shot) });
  if (errors.length) { console.log('ERRORS ' + errors.join(' | ')); code = 1; }
} finally { await browser.close(); server.close(); }
process.exit(code);

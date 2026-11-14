// tools/shot.mjs: one or more screenshots of a running dev or preview server (headless Chromium, software GL).
// usage: node tools/shot.mjs <base-url> <out-dir> name=query [name=query ...] [--wait ms] [--eval js] [--dpr 2] [--clip x,y,w,h]
import path from 'node:path'; import puppeteer from 'puppeteer-core';
const a = process.argv.slice(2), opt = n => { const i = a.indexOf('--' + n); if (i < 0) return null; const v = a[i + 1]; a.splice(i, 2); return v; };
const wait = +(opt('wait') || 3000), ev = opt('eval'), dpr = +(opt('dpr') || 1), clip = opt('clip'), [base, out, ...jobs] = a;
const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--window-size=1600,900'] });
let bad = 0;
await Promise.all(jobs.map(async j => {
  const k = j.indexOf('='), name = j.slice(0, k), q = j.slice(k + 1), page = await browser.newPage(); await page.setViewport({ width: 1600, height: 900, deviceScaleFactor: dpr }); const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); page.on('pageerror', e => errs.push(String(e)));
  await page.goto(base + q, { waitUntil: 'load', timeout: 180000 });
  try { await page.waitForFunction('window.__ready === true', { timeout: 60000 }); } catch (e) { errs.push('never ready'); }
  await new Promise(r => setTimeout(r, wait));
  let info = ''; if (ev) try { info = JSON.stringify(await page.evaluate(ev)); } catch (e) { info = 'eval failed: ' + e.message; }
  const st = await page.evaluate(() => window.__frameStats && window.__frameStats());
  const c = clip ? clip.split(',').map(Number) : null; await page.screenshot({ path: path.join(out, name + '.png'), ...(c ? { clip: { x: c[0], y: c[1], width: c[2], height: c[3] } } : {}) }); await page.close();
  if (errs.length) bad++; console.log(name, errs.length ? 'ERRORS ' + errs.slice(0, 6).join(' | ') : 'ok', st ? `p50 ${st.p50.toFixed(0)} ms` : '', info);
}));
await browser.close(); process.exit(bad ? 1 : 0);

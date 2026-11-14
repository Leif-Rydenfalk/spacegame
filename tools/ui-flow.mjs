// tools/ui-flow.mjs: drives the real page with mouse and keys (headless Chromium, software GL): inventory split, drag and
// drop, suit printer queue, blueprint ghost, combat fire (the round 2 kit, a dev scenario); then the round 3 start: the
// laser off its hardpoint, the reactor out of its bay, cutting, gathering, dropping, the turret; then title -> new game
// -> save -> reload -> continue with the same state hash. Prints three JSON lines and exits 1 on any console error.   usage: npm run build && node tools/ui-flow.mjs
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import puppeteer from 'puppeteer-core'; import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'), dist=path.join(root,'dist'), port=5232, MIME={'.html':'text/html','.js':'text/javascript'};
const server=http.createServer((q,s)=>{let p=decodeURIComponent(q.url.split('?')[0]); if(p==='/')p='/index.html'; const f=path.join(dist,p); if(!fs.existsSync(f)){s.writeHead(404);s.end();return;} s.writeHead(200,{'content-type':MIME[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(s);});
await new Promise(r=>server.listen(port,'127.0.0.1',r));
const browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:'new',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox','--window-size=1600,900']});
const page=await browser.newPage(); await page.setViewport({width:1600,height:900}); const errs=[]; page.on('console',m=>{ if(m.type()==='error') errs.push(m.text()); }); page.on('pageerror',e=>errs.push(String(e)));
const sleep=ms=>new Promise(r=>setTimeout(r,ms)), U=`http://127.0.0.1:${port}/`;
const D='window.__dev.acts.surface.debug';
// A: inventory
await page.goto(U+'?act=surface&scenario=oldkit',{waitUntil:'load'}); await page.waitForFunction('window.__ready===true',{timeout:120000});
await page.keyboard.press('i'); await page.waitForFunction(`${D}.S.uiOpen===true`,{timeout:30000}); await page.waitForFunction(`document.querySelector('#win .slot[data-c="p"][data-i="5"]')`,{timeout:30000});
const box=async sel=>{ const b=await (await page.$(sel)).boundingBox(); return [b.x+b.width/2,b.y+b.height/2]; };
let [x,y]=await box('#win .slot[data-c="p"][data-i="0"]'); await page.mouse.click(x,y,{button:'right'});
await sleep(1500); [x,y]=await box('#win .slot[data-c="p"][data-i="20"]'); await page.mouse.click(x,y);
const a1=await page.evaluate(`${D}.S.inv.slots.map(s=>s?s.id+":"+s.n:0).filter(Boolean).join(" ")`);
await sleep(1500); [x,y]=await box('#win .slot[data-c="p"][data-i="20"]'); await page.mouse.move(x,y); await page.mouse.down(); await sleep(300); [x,y]=await box('#win .slot[data-c="p"][data-i="30"]'); await page.mouse.move(x,y,{steps:4}); await page.mouse.up();
const a2=await page.evaluate(`${D}.S.inv.slots.map((s,i)=>s&&s.id==="iron"?i+":"+s.n:0).filter(Boolean).join(" ")`);
await sleep(1500); [x,y]=await box('#win [data-a="print"][data-i="belt"]'); await page.mouse.click(x,y);
const a3=await page.evaluate(`[${D}.S.printer.q.length, ${D}.S.count("iron")]`);
await page.keyboard.press('Escape'); await page.waitForFunction(`${D}.S.uiOpen===false`,{timeout:30000});
// blueprint mode: toggle, place a ghost at the cursor
await page.keyboard.press('b'); await page.waitForFunction(`${D}.S.mode==="blueprint"`,{timeout:30000}); await page.keyboard.press('5'); await sleep(2500);
await page.mouse.move(1000,530); await sleep(1500); await page.mouse.down(); await sleep(2500); await page.mouse.up();
const a4=await page.evaluate(`[${D}.BP.ghosts.map(g=>g.kind+"@"+g.x+","+g.y).join(" "), ${D}.BP.sel]`);
await page.keyboard.press('c'); await page.waitForFunction(`${D}.S.mode==="combat"`,{timeout:30000}); await page.mouse.down(); await sleep(4000); await page.mouse.up();
const a5=await page.evaluate(`[${D}.P.mag.rifle, ${D}.S.count("rifle rounds"), ${D}.S.stats.shots]`);
console.log(JSON.stringify({split:a1, drag:a2, print:a3, ghost:a4, shots:a5, errs})); let bad = errs.length;
// C: the round 3 start, with real keys: unbolt the laser (e), walk away from the wreck and fire (no reactor in reach:
// nothing is cut), walk to the bay, pull the reactor (e), cut the ground (lmb),
// gather a loose chunk by hand (v), drop it again (x), stand the laser on its legs (g), set the reactor down (q)
errs.length=0; await page.goto(U+'?act=surface',{waitUntil:'load'}); await page.waitForFunction('window.__ready===true',{timeout:120000});
const W=(js,t=180000)=>page.waitForFunction(js,{timeout:t});
const c0=await page.evaluate(`[${D}.K.laser.state, ${D}.K.reactor.state, ${D}.S.inv.slots.filter(Boolean).map(s=>s.id).join()]`);
await page.keyboard.press('e'); await W(`${D}.K.laser.state==="held"`);
await page.keyboard.down('d'); await W(`${D}.P.x>0.5`); await page.keyboard.up('d'); await sleep(1500);      // out of reach of the cable from the bay: the suit bus alone
await page.mouse.move(1150,640); await page.mouse.down(); await sleep(4000); await page.mouse.up(); const cNo=await page.evaluate(`[${D}.S.stats.dug, +${D}.K.laser.frac.toFixed(3)]`);
await page.keyboard.down('a'); await W(`${D}.P.x<-7.7`); await page.keyboard.up('a'); await sleep(1500);
await page.keyboard.press('e'); await W(`${D}.K.reactor.state==="carried"`); const cLoad=await page.evaluate(`[Math.round(${D}.P.load), +${D}.P.mob.speed.toFixed(2), ${D}.P.mob.jet<8.7]`);
await page.mouse.move(1150,640); await page.mouse.down(); await W(`${D}.S.stats.dug>20`); await page.mouse.up(); await W(`${D}.matter.list.length>0`);
await page.evaluate(`${D}.matter.spawn("basalt", 6, ${D}.P.x+0.4, ${D}.P.y+0.5)`); await page.keyboard.down('v'); await W(`${D}.S.count("basalt")>=5.99`); await page.keyboard.up('v');
const n0=await page.evaluate(`${D}.matter.total("basalt")`); const bi=await page.evaluate(`${D}.S.inv.slots.findIndex(s=>s&&s.id==="basalt")`); await page.keyboard.press(String(bi+1)); await sleep(1500); await page.keyboard.press('x'); await W(`${D}.S.count("basalt")<0.01`); const cDrop=await page.evaluate(`[+(${D}.matter.total("basalt")-${n0}).toFixed(3)]`);
await page.keyboard.press('g'); await W(`${D}.K.laser.state==="turret"`); await page.keyboard.press('q'); await W(`${D}.K.reactor.state==="ground"`); await sleep(1500);
const cEnd=await page.evaluate(`[${D}.K.laser.state, ${D}.K.reactor.state, !!${D}.K.laser.link, ${D}.K.laser.reach, Math.round(${D}.P.load)]`);
await page.screenshot({path:path.join(root,'docs/shots/kit-flow.png')});
console.log(JSON.stringify({start:c0, noReactor:cNo, carrying:cLoad, dropped:cDrop, end:cEnd, errs})); bad += errs.length + (cNo[0]===0 && cNo[1]<0.6 && cDrop[0]===6 && cEnd[0]==='turret' && cEnd[1]==='ground' ? 0 : 1);
// B: title, new game, save, reload, continue
errs.length=0; await page.goto(U,{waitUntil:'load'}); await page.waitForSelector('#title [data-a="t-new"]',{timeout:120000});
const t0=await page.evaluate(`[!!document.querySelector('[data-a="t-continue"]'), window.__dev.G.paused]`);
[x,y]=await box('#title [data-a="t-new"]'); await page.mouse.click(x,y); await page.waitForFunction('window.__dev.G.paused===false',{timeout:30000});
await page.evaluate(`${D}.world.dig(${D}.P.x+2, ${D}.P.y-1, 1.5, 0); ${D}.S.add("lumen", 3.25)`); const h1=await page.evaluate(`window.__dev.save.write().then(b=>b.hash)`);
await page.goto(U,{waitUntil:'load'}); await page.waitForSelector('#title [data-a="t-continue"]',{timeout:120000}); await page.screenshot({path:path.join(root,'docs/shots/title-continue.png')});
[x,y]=await box('#title [data-a="t-continue"]'); await page.mouse.click(x,y); await page.waitForFunction('window.__dev.G.paused===false',{timeout:30000});
const t1=await page.evaluate(`[window.__dev.G.loadedHash, window.__dev.G.reloadHash, ${D}.S.count("lumen"), window.__dev.save.slot, window.__dev.G.seed]`);
console.log(JSON.stringify({title:t0, saved:h1, loaded:t1, errs})); bad += errs.length + (t1[0] === h1 && t1[1] === h1 ? 0 : 1);
await browser.close(); server.close(); process.exit(bad ? 1 : 0);

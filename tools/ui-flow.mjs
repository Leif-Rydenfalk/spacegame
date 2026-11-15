// tools/ui-flow.mjs: drives the real page with mouse and keys (headless Chromium, software GL): inventory split, drag and
// drop, suit printer queue, blueprint ghost, combat fire (the round 2 kit, a dev scenario); then the round 3 start: the
// laser off its hardpoint, the reactor out of its bay, cutting, gathering, dropping, the turret; then title -> new game
// -> save -> reload -> continue with the same state hash. Then the round 4 flow (D), the round 5 placing flow (E) and the round 7 tools (F). Prints six JSON lines and exits 1 on any console error.   usage: npm run build && node tools/ui-flow.mjs
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import puppeteer from 'puppeteer-core'; import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'), dist=path.join(root,'dist'), port=5232, MIME={'.html':'text/html','.js':'text/javascript'};
const server=http.createServer((q,s)=>{let p=decodeURIComponent(q.url.split('?')[0]); if(p==='/')p='/index.html'; const f=path.join(dist,p); if(!fs.existsSync(f)){s.writeHead(404);s.end();return;} s.writeHead(200,{'content-type':MIME[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(s);});
await new Promise(r=>server.listen(port,'127.0.0.1',r));
const browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:'new',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox','--window-size=1600,900']});
const page=await browser.newPage(); await page.setViewport({width:1600,height:900}); const errs=[]; page.on('console',m=>{ if(m.type()==='error') errs.push(m.text()); }); page.on('pageerror',e=>errs.push(String(e)));
const sleep=ms=>new Promise(r=>setTimeout(r,ms)), U=`http://127.0.0.1:${port}/`;
const D='window.__dev.acts.surface.debug';
// the cursor on a placement cell (the camera leans toward the cursor: aim, let it settle, aim again), a click, a key
const cell=async(gx,gy)=>{ for(let i=0;i<5;i++){ const p=await page.evaluate(`(()=>{const s=${D}.S.toScr(${gx}*0.5+0.25, ${gy}*0.5+0.25); return [s[0],s[1]];})()`); await page.mouse.move(p[0],p[1]); await page.evaluate('window.__dev.step(40)'); } };
const clk=async(button='left')=>{ await page.mouse.down({button}); await page.evaluate('window.__dev.step(4)'); await page.mouse.up({button}); await page.evaluate('window.__dev.step(4)'); };
const key=async k=>{ await page.keyboard.down(k); await page.evaluate('window.__dev.step(4)'); await page.keyboard.up(k); await page.evaluate('window.__dev.step(4)'); };
// A: inventory
await page.goto(U+'?act=surface&scenario=oldkit',{waitUntil:'load'}); await page.waitForFunction('window.__ready===true',{timeout:120000});
await page.keyboard.press('i'); await page.waitForFunction(`${D}.S.uiOpen===true`,{timeout:30000}); await page.waitForFunction(`document.querySelector('#win .slot[data-c="p"][data-i="5"]')`,{timeout:30000});
const box=async sel=>{ for(let i=0;i<20;i++){ const e=await page.$(sel), b=e&&await e.boundingBox(); if(b) return [b.x+b.width/2,b.y+b.height/2]; await sleep(250); } throw new Error('no box for '+sel); };      // a window is drawn again whenever what it shows changes: an element may be gone for a moment
let [x,y]=await box('#win .slot[data-c="p"][data-i="0"]'); await page.mouse.click(x,y,{button:'right'});
await sleep(1500); [x,y]=await box('#win .slot[data-c="p"][data-i="20"]'); await page.mouse.click(x,y);
const a1=await page.evaluate(`${D}.S.inv.slots.map(s=>s?s.id+":"+s.n:0).filter(Boolean).join(" ")`);
await sleep(1500); [x,y]=await box('#win .slot[data-c="p"][data-i="20"]'); await page.mouse.move(x,y); await page.mouse.down(); await sleep(300); [x,y]=await box('#win .slot[data-c="p"][data-i="30"]'); await page.mouse.move(x,y,{steps:4}); await page.mouse.up();
const a2=await page.evaluate(`${D}.S.inv.slots.map((s,i)=>s&&s.id==="iron"?i+":"+s.n:0).filter(Boolean).join(" ")`);
await sleep(1500); [x,y]=await box('#win [data-a="print"][data-i="belt"]'); await page.mouse.click(x,y);
const a3=await page.evaluate(`[${D}.S.printer.q.length, ${D}.S.count("iron")]`);
await page.keyboard.press('Escape'); await page.waitForFunction(`${D}.S.uiOpen===false`,{timeout:30000});
// blueprint mode: toggle, place a ghost at the cursor
await page.keyboard.press('Tab'); await page.waitForFunction(`${D}.S.mode==="blueprint"`,{timeout:30000}); await page.waitForSelector('#plan [data-a="plan"][data-i="chest"]',{timeout:30000}); [x,y]=await box('#plan [data-a="plan"][data-i="chest"]'); await page.mouse.click(x,y); await sleep(2500);
await cell(8,0); await clk();
const a4=await page.evaluate(`[${D}.BP.ghosts.map(g=>g.kind+"@"+g.x+","+g.y).join(" "), ${D}.S.plan]`);
await page.keyboard.press('c'); await page.waitForFunction(`${D}.S.mode==="combat"`,{timeout:30000}); await page.mouse.down(); await sleep(4000); await page.mouse.up();
const a5=await page.evaluate(`[${D}.P.mag.rifle, ${D}.S.count("rifle rounds"), ${D}.S.stats.shots]`);
console.log(JSON.stringify({split:a1, drag:a2, print:a3, ghost:a4, shots:a5, errs})); let bad = errs.length + (/^chest@/.test(a4[0]) && a4[1]==='chest' && a3[0]===1 && a5[2]>0 ? 0 : 1);
// C: the round 3 start, with real keys (the round 5 ones): unbolt the laser (f), walk away from the wreck and fire (no
// reactor in reach: nothing is cut), walk to the bay, pull the reactor (f), cut the ground (lmb),
// gather a loose chunk by hand (v), drop it again (z), stand the laser on its legs (g), set the reactor down (x)
errs.length=0; await page.goto(U+'?act=surface&scenario=slice',{waitUntil:'load'}); await page.waitForFunction('window.__ready===true',{timeout:120000});      // round 6: the suited start (the default start wakes you without the suit: tools/play.mjs plays that)
const W=(js,t=180000)=>page.waitForFunction(js,{timeout:t});
const c0=await page.evaluate(`[${D}.K.laser.state, ${D}.K.reactor.state, ${D}.S.inv.slots.filter(Boolean).map(s=>s.id).join()]`);
await page.keyboard.press('f'); await W(`${D}.K.laser.state==="held"`);
await page.keyboard.down('d'); await W(`${D}.P.x>0.5`); await page.keyboard.up('d'); await sleep(1500);      // out of reach of the cable from the bay: the suit bus alone
await page.mouse.move(1150,640); await page.mouse.down(); await sleep(4000); await page.mouse.up(); const cNo=await page.evaluate(`[${D}.S.stats.dug, +${D}.K.laser.frac.toFixed(3)]`);
await page.keyboard.down('a'); await W(`${D}.P.x<-7.7`); await page.keyboard.up('a'); await sleep(1500);
await page.keyboard.press('f'); await W(`${D}.K.reactor.state==="carried"`); await W(`${D}.P.load>150`); const cLoad=await page.evaluate(`[Math.round(${D}.P.load), +${D}.P.mob.speed.toFixed(2), ${D}.P.mob.jet<8.7]`);
await page.mouse.move(1150,640); await page.mouse.down(); await W(`${D}.S.stats.dug>3`); await page.mouse.up();      // round 6: a pulse is a tenth of a kilogram of soil, and the sink holds 48 of them
 await W(`${D}.matter.list.length>0`);
await page.evaluate(`${D}.matter.spawn("basalt", 6, ${D}.P.x+0.4, ${D}.P.y+0.5)`); await page.keyboard.down('v'); await W(`${D}.S.count("basalt")>=5.99`); await page.keyboard.up('v');
const n0=await page.evaluate(`${D}.matter.total("basalt")`); const bi=await page.evaluate(`${D}.S.inv.slots.findIndex(s=>s&&s.id==="basalt")`); await page.keyboard.press(String(bi+1)); await sleep(1500); await page.keyboard.press('z'); await W(`${D}.S.count("basalt")<0.01`); const cDrop=await page.evaluate(`[+(${D}.matter.total("basalt")-${n0}).toFixed(3)]`);
await page.keyboard.press('g'); await W(`${D}.K.laser.state==="turret"`); await page.keyboard.press('x'); await W(`${D}.K.reactor.state==="ground"`); await sleep(1500);
const cEnd=await page.evaluate(`[${D}.K.laser.state, ${D}.K.reactor.state, !!${D}.K.laser.link, ${D}.K.laser.reach, Math.round(${D}.P.load)]`);
await page.screenshot({path:path.join(root,'docs/shots/kit-flow.png')});
console.log(JSON.stringify({start:c0, noReactor:cNo, carrying:cLoad, dropped:cDrop, end:cEnd, errs})); bad += errs.length + (cNo[0]===0 && cNo[1]<0.6 && cDrop[0]===6 && cEnd[0]==='turret' && cEnd[1]==='ground' ? 0 : 1);
// D: round 4, with real keys: plan a chest with none anywhere (tab, the chest in the plan row, click), open the ship AI (j), raise the iron
// target with the editor's +, move the order to the front with its arrow, close; the AI has the kit made and a robot
// builds it. Then m: out to the whole planet and back.
errs.length=0; await page.goto(U+'?act=surface&scenario=supply',{waitUntil:'load'}); await page.waitForFunction('window.__ready===true',{timeout:120000});
await page.keyboard.press('Tab'); await W(`${D}.S.mode==="blueprint"`); await page.waitForSelector('#plan [data-a="plan"][data-i="chest"]',{timeout:60000}); [x,y]=await box('#plan [data-a="plan"][data-i="chest"]'); await page.mouse.click(x,y); await W(`${D}.S.plan==="chest"`);
await page.mouse.move(620,512); await W(`Math.abs(${D}.S.cam.x-(${D}.P.x+(620-800)/${D}.S.ppm*0.22))<0.04 && Math.floor(${D}.S.mouse.y*2)===0`); await page.mouse.down(); await sleep(2500); await page.mouse.up(); await W(`${D}.BP.ghosts.some(g=>g.kind==="chest")`);      // free level ground between the furnace and the antenna
const d0=await page.evaluate(`[${D}.BP.ghosts.map(g=>g.kind+(g.have?"+kit":"")).join(), ${D}.S.count("chest"), ${D}.SUP.targets.iron]`);
await page.keyboard.press('Tab'); await W(`${D}.S.mode==="build"`); await page.keyboard.press('j'); await page.waitForSelector('#win.ai [data-a="tg-inc"][data-i="iron"]',{timeout:60000}); await page.waitForSelector('#win.ai [data-a="q-top"]',{timeout:60000});
[x,y]=await box('#win.ai [data-a="tg-inc"][data-i="iron"]'); await page.mouse.click(x,y); await W(`${D}.SUP.targets.iron===${d0[2]+5}`);
[x,y]=await box('#win.ai [data-a="q-top"]'); await page.mouse.click(x,y); await sleep(1500);
const d1=await page.evaluate(`[${D}.SUP.targets.iron, document.querySelectorAll('#win.ai .qr').length, document.querySelector('#win.ai .qr .qw').textContent.slice(0,60)]`);
await page.screenshot({path:path.join(root,'docs/shots/ai-flow.png')});
await page.keyboard.press('Escape'); await W(`${D}.S.uiOpen===false`); for (let i=0;i<60 && !(await page.evaluate(`${D}.F.machines.some(m=>m.kind==="chest")`));i++) await page.evaluate('window.__dev.step(240)');      // software GL runs the game at a fifteenth of real time: the wait is stepped, two game seconds at a time
const d2=await page.evaluate(`[${D}.F.machines.map(m=>m.kind).join(), ${D}.BP.ghosts.length]`);
await page.keyboard.press('m'); await W(`${D}.S.zo>60`); const d3=await page.evaluate(`[Math.round(${D}.S.zo), Math.round(${D}.S.cam.y)]`); await page.keyboard.press('m'); await W(`${D}.S.zo<1.2`);
console.log(JSON.stringify({placed:d0, ai:d1, built:d2, planet:d3, errs})); bad += errs.length + (d0[1]===0 && d1[0]===d0[2]+5 && /chest/.test(d2[0]) && d3[0]>60 && d3[1]<-600 ? 0 : 1);
// E: round 5, with real keys: a furnace held in slot 1 is placed with a click and is gone from the slot; a second click
// places nothing; tab; q over the furnace picks it as a plan; a click elsewhere is a ghost; rmb takes the ghost back; r
// turns the belt; q on nothing clears the cursor; tab leaves
errs.length=0; await page.goto(U+'?act=surface&scenario=place',{waitUntil:'load'}); await page.waitForFunction('window.__ready===true',{timeout:120000});
const e0=await page.evaluate(`[${D}.cursorKind(), ${D}.S.count("furnace")]`);
await cell(5,0); await clk(); const e1=await page.evaluate(`[${D}.F.machines.filter(m=>m.kind==="furnace").length, ${D}.S.count("furnace"), ${D}.cursorKind()]`);
await cell(10,0); await clk(); const e2=await page.evaluate(`${D}.F.machines.filter(m=>m.kind==="furnace").length + ${D}.BP.ghosts.length`);
await key('Tab'); await cell(5,0); await key('q'); const e3=await page.evaluate(`[${D}.S.mode, ${D}.S.plan]`);
await cell(-3,0); await clk(); const e4=await page.evaluate(`${D}.BP.ghosts.map(g=>g.kind+(g.have?"+kit":"")).join()`); await sleep(2600); await page.screenshot({path:path.join(root,'docs/shots/place-flow.png')});
await clk('right'); const e5=await page.evaluate(`${D}.BP.ghosts.length`);
await key('2'); const r0=await page.evaluate(`[${D}.cursorKind(), ${D}.BP.rot]`); await key('r'); const r1=await page.evaluate(`${D}.BP.rot`); await cell(20,3); await key('q'); const e6=await page.evaluate(`[${D}.cursorKind(), ${D}.P.slot]`);
await key('Tab'); const e7=await page.evaluate(`${D}.S.mode`);
console.log(JSON.stringify({held:e0, placed:e1, second:e2, pipette:e3, ghost:e4, takenBack:e5, rotate:[r0,r1], cleared:e6, mode:e7, errs}));
bad += errs.length + (e0[0]==='furnace' && e1[0]===1 && e1[1]===0 && e1[2]===null && e2===1 && e3[0]==='blueprint' && e3[1]==='furnace' && e4==='furnace' && e5===0 && r0[0]==='belt' && r0[1]===1 && r1===2 && e6[0]===null && e7==='build' ? 0 : 1);
// F: round 7, with real keys and a real mouse: a belt laid as a dragged path from a machine's port, round a corner and up a
// lift; the deconstruction planner's box marks it, shift+drag unmarks it; the right button held on the furnace takes it down
// by hand, as worn as it was; the blueprint copies the line with a box and pastes it as plans
errs.length=0; await page.goto(U+'?act=surface&scenario=tools7',{waitUntil:'load'}); await page.waitForFunction('window.__ready===true',{timeout:120000});
const drag=async(a,b,opt={})=>{ await cell(a[0],a[1]); if(opt.shift) await page.keyboard.down('Shift'); await page.mouse.down({button:opt.button||'left'}); await page.evaluate('window.__dev.step(6)'); for(const q of (opt.via||[]).concat([b])) await cell(q[0],q[1]); await page.mouse.up({button:opt.button||'left'}); if(opt.shift) await page.keyboard.up('Shift'); await page.evaluate('window.__dev.step(20)'); };
await key('5'); const f0=await page.evaluate(`[${D}.cursorKind(), ${D}.S.count("belt")]`);
await drag([27,0],[33,2],{via:[[33,0]]}); const f1=await page.evaluate(`[${D}.F.machines.filter(m=>m.kind==="belt").map(m=>m.x+","+m.y+">"+m.dir).join(" "), ${D}.S.count("belt"), ${D}.BP.ghosts.length]`);
await key('3'); await drag([28,0],[33,3]); const f2=await page.evaluate(`[${D}.toolSlot()&&${D}.toolSlot().id, ${D}.F.machines.filter(m=>m.decon).length]`);
await drag([28,0],[33,3],{shift:true}); const f3=await page.evaluate(`${D}.F.machines.filter(m=>m.decon).length`);
await key('9'); await cell(26,0); await page.mouse.down({button:'right'}); for(let i=0;i<60 && (await page.evaluate(`${D}.F.machines.some(m=>m.kind==="furnace")`));i++) await page.evaluate("window.__dev.step(120)"); await page.mouse.up({button:'right'}); await page.evaluate('window.__dev.step(10)');
const f4=await page.evaluate(`(()=>{const s=${D}.S.inv.slots.find(q=>q&&q.id==="furnace"); return [${D}.F.machines.filter(m=>m.kind==="furnace").length, s?s.n:0, s&&s.c!==undefined?+s.c.toFixed(2):1];})()`);
await key('1'); await drag([28,0],[33,3]); const f5=await page.evaluate(`(()=>{const s=${D}.S.inv.slots[0]; return [s.id, s.d&&s.d.bp?s.d.bp.ents.length:0, s.d&&s.d.bp?s.d.bp.w+"x"+s.d.bp.h:""];})()`);
await cell(45,0); await clk(); await sleep(1500); const f6=await page.evaluate(`${D}.BP.ghosts.map(g=>g.kind+"@"+g.x+","+g.y+">"+g.dir).join(" ")`); await page.screenshot({path:path.join(root,'docs/shots/tools-flow.png')});
console.log(JSON.stringify({belt:f0, path:f1, marked:f2, unmarked:f3, byHand:f4, copied:f5, pasted:f6, errs}));
bad += errs.length + (f0[0]==='belt' && f0[1]===12 && f1[0]==='28,0>1 29,0>1 30,0>1 31,0>1 32,0>1 33,0>2 33,1>2 33,2>2' && f1[1]===4 && f1[2]===0 && f2[0]==='deconstruction planner' && f2[1]===8 && f3===0 && f4[0]===0 && f4[1]===1 && f4[2]===0.5 && f5[0]==='blueprint' && f5[1]===8 && f5[2]==='6x3' && f6.split(' ').length===8 && /belt@47,2>2/.test(f6) ? 0 : 1);
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

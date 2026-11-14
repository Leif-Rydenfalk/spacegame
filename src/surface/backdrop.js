// the depth of the forest: everything that is not the play plane. Seven parallax layers behind it (each a ground
// line, giant trees, undergrowth, a veil of fog and shafts of planet-light, with small wary animals moving through
// them), drawn far to near into a half-resolution target that the terrain shader shows wherever there is air, so
// distance is soft. Two layers in front of the play plane (out-of-focus foliage and trunks that pass over the player)
// are drawn into the main scene with soft edges. Every layer grows the same species as the play plane (flora-gen.js)
// and bends in the same wind.
import { THREE, R, Batch, makeRT } from '../render.js';
import { G, hash, rng, noise2, clamp, lerp } from '../core.js';
import { biome } from './gen.js';
import { genPlant, drawPlant, wind, PAL } from './flora-gen.js';
import { S, mul } from './state.js';

// p = parallax (1 = the play plane), s = apparent size, f = how much fog sits in front of it, k = ambient on its
// surfaces, cell = metres between tree slots (layer metres), dens = chance of a tree per slot, hk = giant factor,
// amp = height of its ground swell, lift = how far its ground line sits above the play plane's
const LAYERS = [
  { p: 0.08, s: 0.30, f: 0.93, k: 0.3, cell: 15, dens: 0.5, hk: 3.4, amp: 5, lift: 3.6 },
  { p: 0.14, s: 0.36, f: 0.86, k: 0.3, cell: 11, dens: 0.6, hk: 2.5, amp: 5, lift: 3.0 },
  { p: 0.22, s: 0.44, f: 0.76, k: 0.3, cell: 8, dens: 0.7, hk: 1.9, amp: 4.5, lift: 2.45 },
  { p: 0.33, s: 0.54, f: 0.63, k: 0.3, cell: 7, dens: 0.72, hk: 1.5, amp: 3.6, lift: 1.9 },
  { p: 0.47, s: 0.66, f: 0.48, k: 0.28, cell: 6.5, dens: 0.75, hk: 1.25, amp: 2.6, lift: 1.4 },
  { p: 0.63, s: 0.8, f: 0.32, k: 0.25, cell: 6, dens: 0.75, hk: 1.1, amp: 1.8, lift: 0.9 },
  { p: 0.82, s: 0.93, f: 0.17, k: 0.22, cell: 5.5, dens: 0.7, hk: 1, amp: 1.1, lift: 0.45 },
];
const FORE = [{ p: 1.32, s: 1.25, soft: 3.5, cell: 38, dens: 0.3, drop: 5.3 }, { p: 1.75, s: 1.9, soft: 8, cell: 57, dens: 0.22, drop: 7 }];
const FOG = [[0.011, 0.033, 0.038], [0.026, 0.017, 0.048], [0.018, 0.034, 0.012]];
const SMALL = ['fern', 'paddle', 'grass', 'reed', 'bulb', 'fungi', 'fern', 'grass', 'flower'];
export const ridgeH = (x, s) => 0.5 + 0.5 * (Math.sin(x * 0.11 + s) * 0.5 + Math.sin(x * 0.047 + s * 2.3) * 0.9 + Math.sin(x * 0.31 + s * 4.1) * 0.2 + Math.sin(x * 0.83 + s * 7.7) * 0.07 + Math.sin(x * 1.9 + s * 3.3) * 0.03 + Math.sin(x * 4.3 + s) * 0.012) / 1.712;

const SKY = `
precision highp float; varying vec2 vV; uniform vec2 uCam, uRes; uniform float uPPM, uTime, uHorizon; uniform vec3 uFog;
float h(vec2 p){ p=fract(p*vec2(443.897,441.423)); p+=dot(p,p.yx+19.19); return fract((p.x+p.y)*p.x); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
float fb(vec2 p){ return vn(p)*.5+vn(p*2.03)*.25+vn(p*4.1)*.125+vn(p*8.3)*.0625; }
void main(){
  vec2 sv = vV/uRes.y; float hy = (uHorizon-uCam.y)*uPPM;
  vec3 sky = mix(vec3(.0011,.0028,.0058), vec3(.005,.015,.02), smoothstep(.55,-.3,sv.y));
  for(int i=0;i<3;i++){ float fi=float(i); vec2 p=(vV+uCam*uPPM*(.004+.004*fi))/(3.+fi*2.); vec2 ci=floor(p); float r=h(ci+fi*13.);
    float tw=.7+.3*sin(uTime*(1.+r*3.)+r*40.); vec2 sp=fract(p)-.5-(vec2(h(ci+1.),h(ci+2.))-.5)*.6;
    sky += mix(vec3(1.,.75,.55),vec3(.6,.8,1.),h(ci+5.))*step(.955+fi*.012,r)*smoothstep(.2,.0,length(sp))*tw*(.5-.12*fi); }
  // a long dust lane across the sky
  { vec2 p=sv*vec2(1.,2.4)+vec2(.2,-.5)+uCam*.0004; float b=fb(p*3.+fb(p*7.)*.6); sky += vec3(.012,.016,.03)*pow(b,3.)*smoothstep(.9,.1,abs(p.y+p.x*.35)); }
  vec2 gp = sv-vec2(.42,.2)-vec2(uCam.x*.00002,0.); float gd=length(gp)/.21;
  if(gd<1.){ float lit=smoothstep(-.25,.7,dot(gp/.21,normalize(vec2(-.8,.45)))+sqrt(1.-gd*gd)*.2); float band=fb(vec2(gp.y*38.+fb(gp*9.)*1.5,gp.x*2.));
    float rs=1.-.6*smoothstep(.02,.0,abs(gp.y+gp.x*.05+.012))*step(gp.x,.1);
    sky = mix(sky, vec3(.115,.088,.135)*(.35+band)*lit*rs*smoothstep(1.,.96,gd)+vec3(.004,.006,.01), smoothstep(1.,.985,gd)); sky += vec3(.03,.045,.08)*pow(gd,6.)*lit*.5; }
  else { sky += vec3(.03,.04,.07)*exp(-(gd-1.)*11.)*.55; }
  float rg=length(gp*vec2(1.,3.6))/.21; if(rg>1.25&&rg<2.1&&(gd>1.||gp.y<0.)) sky += vec3(.05,.045,.06)*(.4+.6*vn(vec2(rg*60.,0.)))*(.6+.4*vn(vec2(rg*230.,1.)))*smoothstep(1.25,1.3,rg)*smoothstep(2.1,2.,rg);
  // thin high cloud, lit from the planet's side
  { vec2 p=vec2(sv.x*1.6+uCam.x*.0006+uTime*.0015, sv.y*5.); float c=fb(p*2.+fb(p*5.3+uTime*.004)*.7); c=smoothstep(.45,.8,c)*smoothstep(-.1,.35,sv.y);
    sky = mix(sky, sky*.55+vec3(.014,.02,.03)*(.6+.8*smoothstep(.6,.0,length(gp))), c*.6); }
  // two far ridges
  for(int i=0;i<2;i++){ float fi=float(i), par=.03+.03*fi; float x=(uCam.x*par+vV.x/uPPM)*.07*(1.+fi*.6)+fi*40.; float ridge=(fb(vec2(x,fi*9.))-.35)*uRes.y*(.42-.14*fi)+hy*par+uRes.y*(.08-.05*fi);
    float m=smoothstep(ridge+1.5,ridge-1.5,vV.y); sky = mix(sky, mix(vec3(.0016,.0045,.006)*(1.6-fi), uFog*.55, .5+.2*fi)+uFog*exp(-(ridge-vV.y)/uRes.y*7.)*.5, m); }
  sky += uFog*exp(-abs(vV.y-hy*.06-uRes.y*.05)/uRes.y*5.)*.75;
  gl_FragColor = vec4(sky,1.);
}`;

export const backdrop = { rt: null, scene: null, batch: null, fore: [], fog: [0.012, 0.03, 0.035], glare: 0, fauna: [], scare: 0 };
const pools = [], trees = [];
let skyU = null;
export function initBackdrop(mainScene) {
  const bd = backdrop; bd.rt = makeRT(0.5); bd.scene = new THREE.Scene();
  skyU = { uCam: { value: new THREE.Vector2() }, uRes: { value: new THREE.Vector2(1, 1) }, uPPM: { value: 60 }, uTime: { value: 0 }, uHorizon: { value: 0 }, uFog: { value: new THREE.Vector3() } };
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: skyU, depthTest: false, depthWrite: false, fragmentShader: SKY, vertexShader: 'uniform vec2 uRes; varying vec2 vV; void main(){ vV=position.xy*uRes*.5; gl_Position=vec4(position.xy,0.,1.); }' }));
  sky.frustumCulled = false; sky.renderOrder = 0; bd.scene.add(sky);
  bd.batch = new Batch(bd.scene, 36000, 1); bd.batch.u.uSun.value.set(0.5, 0.86); bd.batch.u.uRim.value.set(0.004, 0.007, 0.008);
  for (const f of FORE) { const b = new Batch(mainScene, 3000, 20 + bd.fore.length); b.u.uSoft.value = f.soft; b.u.uSun.value.set(0.5, 0.86); bd.fore.push(b); }
  // a pool of every species: the layers draw from it, so nothing is generated while the camera moves
  for (let bi = 0; bi < 3; bi++) { const r = rng(9001 + bi * 77); trees[bi] = []; for (let i = 0; i < 12; i++) trees[bi].push(genPlant('tree', bi, r, 0.5 + r() * 0.7)); pools[bi] = {}; for (const t of new Set(SMALL)) { pools[bi][t] = []; for (let i = 0; i < 5; i++) pools[bi][t].push(genPlant(t, bi, r, 0.7 + r() * 0.5)); } pools[bi].vine = []; for (let i = 0; i < 5; i++) pools[bi].vine.push(genPlant('vine', bi, r, 1.3, { anchor: -1 })); }
  R.pre.push(() => { const r = R.renderer, t = r.getRenderTarget(); r.setRenderTarget(bd.rt); r.render(bd.scene, R.camera); r.setRenderTarget(t); });
  for (let li = 2; li < LAYERS.length; li++) for (let i = 0; i < 3; i++) bd.fauna.push({ li, x: (hash(li, i, 300) - 0.5) * 120, v: 0, dir: hash(li, i, 301) < 0.5 ? -1 : 1, t: hash(li, i, 302) * 6, ph: hash(li, i, 303) * 6.28, kind: i === 2 ? 1 : 0, y: 0, graze: 0 });
}
// groves and clearings in world x, shared by every layer, so the sky and the planet show through all of them at once.
// The crash site is one: the transport tore the canopy open on its way down.
const grove = wx => clamp(noise2(wx * 0.011, 7, 46) * 3.2 - 0.85, 0.06, 1.15) * (0.12 + 0.88 * clamp((Math.abs(wx) - 14) / 34, 0, 1));
const tint = { k: 1, fog: [0, 0, 0], f: 0, e: 1, lod: 0.7 }, col = [0, 0, 0];
// camera in metres, ppm, time; horizon = the smoothed surface height under the camera
export function drawBackdrop(cx, cy, ppm, time, horizon) {
  const bd = backdrop, b = bd.batch, hw = G.w / 2, hh = G.h / 2, tg = FOG[biome(cx)], fg = bd.fog, gl = bd.glare;
  for (let i = 0; i < 3; i++) fg[i] = lerp(fg[i], tg[i], 0.01);
  skyU.uCam.value.set(cx, cy); skyU.uRes.value.set(G.w, G.h); skyU.uPPM.value = ppm; skyU.uTime.value = time; skyU.uHorizon.value = horizon; skyU.uFog.value.set(fg[0], fg[1], fg[2]);
  b.begin(0, 0, 1); b.u.uTime.value = time;
  for (let li = 0; li < LAYERS.length; li++) {
    const L = LAYERS[li], k = ppm * L.s, seed = 1.7 + li * 3.1, X0 = cx * L.p / L.s, half = hw / k, base = ((horizon - cy) * L.p + L.lift) * ppm, near = L.p * L.p;
    tint.k = L.k * 0.085; tint.f = L.f; tint.e = (1 - L.f) * (1 - L.f) * 0.8 + 0.03; tint.lod = 1.3; tint.fog[0] = fg[0] + gl * 0.05 * near; tint.fog[1] = fg[1] + gl * 0.02 * near; tint.fog[2] = fg[2] + gl * 0.004 * near;
    const sx = X => (X - X0) * k, gy = X => base + (ridgeH(X, seed) * L.amp - 0.25) * k;
    // shafts of planet-light falling between this layer and the one behind it
    for (let c = Math.floor((X0 - half) / 17) - 1; c <= Math.floor((X0 + half) / 17) + 1; c++) { const r = hash(c, li, 210); if (r > 0.6) continue; const X = (c + 0.5 + (hash(c, li, 211) - 0.5) * 0.8) * 17, br = 0.5 + 0.5 * Math.sin(time * 0.13 + r * 40), len = (11 + r * 9) * k, w = (0.9 + hash(c, li, 212) * 2.2) * k, a = -1.92 + (r - 0.3) * 0.12;
      col[0] = (0.02 + fg[0]) * 1.05; col[1] = (0.03 + fg[1]) * 1.05; col[2] = (0.034 + fg[2]) * 1.05; b.px(sx(X) + Math.cos(a) * len * 0.5, base + 10.5 * k + Math.sin(a) * len * 0.5, len, w, a, col, (0.45 + 0.55 * br) * (0.4 + L.p * 0.6), 10, 2, c + li * 7.3); }
    // trees
    for (let c = Math.floor((X0 - half) / L.cell) - 2; c <= Math.floor((X0 + half) / L.cell) + 2; c++) {
      const r = hash(c, li, 200); if (r > L.dens * grove((c + 0.5) * L.cell * L.s / L.p)) continue;
      const X = (c + 0.5 + (hash(c, li, 201) - 0.5) * 0.75) * L.cell, bi = biome(X * L.s / L.p), pool = trees[bi], g = pool[Math.floor(hash(c, li, 202) * pool.length)], hk = L.hk * (0.75 + hash(c, li, 203) * 0.6), ph = r * 50;
      drawPlant(b, g, sx(X), gy(X), k * hk, wind(X * L.s / L.p, time - li * 0.4) * 0.8 / Math.sqrt(hk), time, ph, tint);
    }
    // the ground line of this layer
    col[0] = PAL[0].bark[0] * tint.k * (1 - L.f) + tint.fog[0] * L.f; col[1] = PAL[0].bark[1] * tint.k * (1 - L.f) + tint.fog[1] * L.f; col[2] = PAL[0].bark[2] * tint.k * (1 - L.f) + tint.fog[2] * L.f;
    { const top = base + L.amp * k, bot = -hh - 4, h = top - bot; if (h > 0) b.px(0, (top + bot) / 2, G.w + 8, h, X0, col, k, 9, 0, seed, L.amp, 0, 0.5); }
    // undergrowth on the ground line
    const uw = 0.9 + (1 - L.p) * 2.2;
    if (li > 0) for (let c = Math.floor((X0 - half) / uw) - 1; c <= Math.floor((X0 + half) / uw) + 1; c++) {
      const r = hash(c, li, 220); if (r > 0.8) continue; const X = (c + hash(c, li, 221)) * uw, bi = biome(X * L.s / L.p), pool = pools[bi][SMALL[Math.floor(r * 11.2) % SMALL.length]], g = pool[c & 3], sc = 0.9 + hash(c, li, 222) * 0.7 + (1 - L.p) * 0.9;
      drawPlant(b, g, sx(X), gy(X) + 0.12 * k, k * sc, wind(X * L.s / L.p, time - li * 0.4) * 1.2, time, r * 60, tint);
    }
    drawFauna(b, li, L, k, sx, gy, time, X0, half);
    // the veil in front of this layer: fog that pools on its ground and thins upward
    col[0] = tint.fog[0]; col[1] = tint.fog[1]; col[2] = tint.fog[2];
    { const top = base + (L.amp + 9) * k, bot = -hh - 4; if (top > bot) b.px(0, (top + bot) / 2, G.w * 2.2, top - bot, 0, col, 0.2 + 0.16 * (1 - L.p), 11, 0, li * 1.37 + cx * L.p * 0.004, 1.2, 0, 0, 0.75); }
  }
  b.end();
  // in front of the play plane: out-of-focus undergrowth along the bottom, hanging growth along the top, a trunk now and then
  for (let fi = 0; fi < FORE.length; fi++) {
    const F = FORE[fi], fb = bd.fore[fi], k = ppm * F.s, X0 = cx * F.p / F.s, half = hw / k, base = ((horizon - cy) * F.p - F.drop) * ppm, topY = hh + 0.6 * k;
    fb.begin(0, 0, 1); fb.u.uTime.value = time; tint.k = 0.02; tint.f = 0.5; tint.e = 0.16; tint.lod = 1; tint.fog[0] = fg[0] * 0.14 + gl * 0.012; tint.fog[1] = fg[1] * 0.14 + gl * 0.005; tint.fog[2] = fg[2] * 0.14;
    const sx = X => (X - X0) * k, uw = 1.5;
    for (let c = Math.floor((X0 - half) / F.cell) - 1; c <= Math.floor((X0 + half) / F.cell) + 1; c++) { const r = hash(c, fi, 240); if (r > F.dens) continue; const X = (c + 0.5 + (hash(c, fi, 241) - 0.5) * 0.6) * F.cell, bi = biome(X * F.s / F.p), g = trees[bi][Math.floor(hash(c, fi, 242) * 12)]; drawPlant(fb, g, sx(X), base - 1.5 * k, k * 1.05, wind(X, time) * 0.5, time, r * 30, tint); }
    for (let c = Math.floor((X0 - half) / uw) - 2; c <= Math.floor((X0 + half) / uw) + 2; c++) {
      const r = hash(c, fi, 250), X = (c + hash(c, fi, 251)) * uw, bi = biome(X * F.s / F.p), n = noise2(X * 0.07, fi * 9, 44);
      if (r < 0.75 && n > 0.36) { const pool = pools[bi][SMALL[Math.floor(r * 13.3) % 4]], g = pool[c & 3]; drawPlant(fb, g, sx(X), base + (n - 0.5) * 1.6 * k, k * (0.9 + hash(c, fi, 252) * 0.8), wind(X, time) * 1.3, time, r * 60, tint); }
      const r2 = hash(c, fi, 260); if (r2 < 0.5 && noise2(X * 0.05, 3 + fi * 5, 45) > 0.52) drawPlant(fb, pools[bi].vine[c & 3], sx(X), topY, k * (1 + r2 * 1.5), wind(X, time) * 1.2, time, r2 * 60, tint);
    }
    fb.end();
  }
  bd.glare = Math.max(0, bd.glare - 0.06);
}
// small animals in the layers: long-legged browsers that walk the ground lines and stop to feed, and a drifting
// lantern-float now and then. They are wary: a loud noise in the play plane (backdrop.scare) sends them running.
function drawFauna(b, li, L, k, sx, gy, time, X0, half) {
  const bd = backdrop, dt = 1 / 60;
  for (const a of bd.fauna) {
    if (a.li !== li) continue;
    if (a.x < X0 - half - 30) a.x += half * 2 + 50; else if (a.x > X0 + half + 30) a.x -= half * 2 + 50;
    const scared = bd.scare > 0.2; a.t -= dt;
    if (a.kind === 1) {      // a float: a pale bell with trailing threads, high in the canopy
      a.x += (0.25 * a.dir + Math.sin(time * 0.21 + a.ph) * 0.2) * dt; const X = a.x, y = gy(X) + (5.5 + Math.sin(time * 0.3 + a.ph) * 1.2 + a.ph) * k, p = 0.6 + 0.4 * Math.sin(time * 1.7 + a.ph), e = tint.e;
      col[0] = 0.5 * e * p; col[1] = 0.25 * e * p; col[2] = 1.1 * e * p; b.px(sx(X), y, 1.5 * k, 1.5 * k, 0, col, 0.5, 1, 2); b.px(sx(X), y, 0.36 * k, 0.26 * k, 0, col, 0.9, 8, 2);
      for (let j = -1; j <= 1; j++) b.px(sx(X) + j * 0.09 * k + Math.sin(time * 1.3 + j + a.ph) * 0.03 * k, y - 0.34 * k, 0.5 * k, 0.03 * k + 1, -1.57, col, 0.5, 2, 2, 0, 0, Math.sin(time * 1.1 + j * 2 + a.ph) * 0.06 * k);
      continue;
    }
    if (scared) { a.v = lerp(a.v, 4.2 * (a.x * L.s / L.p > S.cam.x ? 1 : -1), 0.08); a.dir = Math.sign(a.v) || 1; a.graze = 0; a.t = 2 + a.ph; }
    else if (a.t <= 0) { a.t = 3 + hash(Math.floor(time), li, 304) * 7; if (a.graze) { a.graze = 0; a.dir = hash(Math.floor(time * 3), li, 305) < 0.5 ? -1 : 1; } else a.graze = hash(Math.floor(time * 2), li, 306) < 0.55 ? 1 : 0; }
    if (!scared) a.v = lerp(a.v, a.graze ? 0 : 0.55 * a.dir, 0.04);
    a.x += a.v * dt; const X = a.x, gx = sx(X), g0 = gy(X) + 0.2 * k, d = a.dir, run = Math.abs(a.v), ph = a.x * (run > 2 ? 2.2 : 3.4), sz = 1.15 + a.ph * 0.06, bob = Math.abs(Math.sin(ph)) * 0.05 * Math.min(1, run);
    col[0] = PAL[0].bark[0] * tint.k * (1 - L.f) * 0.5 + tint.fog[0] * L.f * 0.82; col[1] = PAL[0].bark[1] * tint.k * (1 - L.f) * 0.5 + tint.fog[1] * L.f * 0.82; col[2] = PAL[0].bark[2] * tint.k * (1 - L.f) * 0.5 + tint.fog[2] * L.f * 0.82;
    const u = k * sz, by = g0 + (1.02 + bob) * u, head = a.graze && !scared ? clamp(1 - (a.t % 5) * 0.2, 0, 1) * 0 + 1 : 0;
    for (let j = 0; j < 4; j++) { const hx = gx + ((j < 2 ? 0.42 : -0.42) + (j % 2 ? 0.05 : -0.05)) * u * d, sw = Math.sin(ph + j * 1.57 + (j % 2 ? 0.4 : 0)) * 0.26 * Math.min(1, run + 0.05), fx = hx + sw * u, fy = g0 + Math.max(0, Math.cos(ph + j * 1.57)) * 0.12 * u * Math.min(1, run); b.px((hx + fx) / 2, (by - 0.1 * u + fy) / 2, Math.hypot(fx - hx, by - 0.1 * u - fy) + 0.06 * u, 0.065 * u + 1, Math.atan2(fy - by, fx - hx), col, 1, 2, 0, j, 0.5); }
    b.px(gx, by, 1.25 * u, 0.46 * u, d * 0.04, col, 1, 2, 0, 3, 0.25, 0.05 * u, 0.8);                         // body
    const nx = gx + d * 0.58 * u, ny = by + 0.12 * u, hx = nx + d * (head ? 0.5 : 0.3) * u, hy = head ? g0 + 0.2 * u + Math.sin(time * 2.2 + a.ph) * 0.03 * u : ny + 0.62 * u;
    b.px((nx + hx) / 2, (ny + hy) / 2, Math.hypot(hx - nx, hy - ny) + 0.14 * u, 0.16 * u, Math.atan2(hy - ny, hx - nx), col, 1, 2, 0, 5, 0.4, 0, 0.6);                                      // neck
    b.px(hx + d * 0.1 * u, hy, 0.32 * u, 0.15 * u, d > 0 ? (head ? -0.5 : 0.1) : Math.PI - (head ? -0.5 : 0.1), col, 1, 2, 0, 6, 0.4);                                                      // head
    b.px(gx - d * 0.7 * u, by + 0.06 * u, 0.5 * u, 0.05 * u + 1, d > 0 ? 3.5 : -0.4, col, 1, 2, 0, 7, 0.8, d * 0.05 * u);                                                                  // tail
    const e = tint.e * (0.6 + 0.4 * Math.sin(time * 1.3 + a.ph)); col[0] = 0.2 * e; col[1] = 1.3 * e; col[2] = 0.9 * e;
    for (let j = 0; j < 4; j++) { b.px(gx + (j - 1.5) * 0.26 * u * d, by + 0.1 * u, 0.09 * u + 1.5, 0.07 * u + 1.5, 0, col, 0.95, 2, 2); b.px(gx + (j - 1.5) * 0.26 * u * d, by + 0.1 * u, 0.4 * u, 0.4 * u, 0, col, 0.25, 1, 2); }
    if (!head) b.px(hx + d * 0.16 * u, hy + 0.02 * u, 0.05 * u + 1, 0.05 * u + 1, 0, [1.4 * tint.e, 1.2 * tint.e, 0.7 * tint.e], 1, 1, 2);
  }
  if (li === LAYERS.length - 1) bd.scare = Math.max(0, bd.scare - dt * 0.25);
}

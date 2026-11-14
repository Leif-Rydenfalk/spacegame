// space view: starfield, lit bodies with atmosphere limb (one shader, exact at any zoom thanks to a plane mode for
// huge radii), orbit lines sampled densely near the point of interest so a ship sits on its own line at 0.1 m/px.
import { THREE } from '../render.js';
import { G, TAU } from '../core.js';
import { bodies, bodyState, stateAtNu, trueAnomaly, HOME } from './orbit.js';

const VS = 'uniform vec2 uRes; varying vec2 vV; void main(){ vV=position.xy*uRes*.5; gl_Position=vec4(position.xy,0.,1.); }';
const NOISE = `float h(vec2 p){ p=fract(p*vec2(443.897,441.423)); p+=dot(p,p.yx+19.19); return fract((p.x+p.y)*p.x); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
float fb(vec2 p){ return vn(p)*.5+vn(p*2.03)*.25+vn(p*4.1)*.125+vn(p*8.3)*.0625; }`;
const STARS = `precision highp float; varying vec2 vV; uniform vec2 uRes, uOff; uniform float uTime, uDim; ${NOISE}
void main(){ vec3 c=vec3(.0006,.0009,.0016);
  for(int i=0;i<3;i++){ float fi=float(i); vec2 p=(vV+uOff*(1.+fi*.8))/(2.6+fi*2.2)+fi*71.; vec2 ci=floor(p); float r=h(ci);
    vec2 sp=fract(p)-.5-(vec2(h(ci+1.3),h(ci+2.7))-.5)*.7; float t=h(ci+5.);
    vec3 sc=mix(vec3(1.,.62,.4),mix(vec3(1.,.95,.86),vec3(.62,.78,1.),smoothstep(.5,1.,t)),smoothstep(0.,.5,t));
    c += sc*step(.962+fi*.01,r)*smoothstep(.22,.0,length(sp))*(.35+1.4*h(ci+9.)*h(ci+4.))*(1.-.2*fi); }
  vec2 q=(vV+uOff*.3)/uRes.y; float band=fb(q*1.6+vec2(3.,7.))*smoothstep(.55,.0,abs(q.y*.8+q.x*.35+ (fb(q*.9)-.5)*.5));
  c += vec3(.012,.014,.022)*band*band*2.2 + vec3(.014,.006,.02)*pow(fb(q*2.3+11.),3.)*band*3.;
  gl_FragColor=vec4(c*uDim,1.); }`;
const BODY = `precision highp float; varying vec2 vV; uniform vec2 uC, uS, uN, uSun; uniform float uR, uAtmo, uKind, uRing, uScale, uArc, uTime; uniform vec3 uCol; ${NOISE}
void main(){
  float alt; vec2 n; float along;
  if(uR<40000.){ vec2 d=vV-uC; float l=length(d); alt=l-uR; n=d/max(l,1e-3); along=atan(n.y,n.x)*uR; }
  else { vec2 d=vV-uS; float tt=dot(d,vec2(-uN.y,uN.x)); alt=dot(d,uN)+tt*tt/(2.*uR); n=normalize(uN+vec2(-uN.y,uN.x)*tt/uR); along=tt; }
  float day=dot(n,uSun); vec3 c=vec3(0.); float a=0.; vec2 q=n*(1.+alt/uR);
  if(uKind>2.5){                                                     // the star
    float x=max(alt,0.)/uR; c=uCol*(alt<0.?9.:0.)+uCol*(1.8*exp(-x*5.)+.5/(1.+x*x*22.)+.06/(1.+x*2.)); a=alt<0.?1.:0.;
    gl_FragColor=vec4(c,a); return; }
  float aa=smoothstep(.75,-.75,alt);
  if(aa>0.){
    float lit=smoothstep(-.12,.3,day); vec2 sp=n*uR*uScale; float arc=along*uScale+uArc;
    vec3 alb=uCol;
    if(uKind>1.5){ float lat=dot(q,vec2(.35,.94)); alb*=.5+1.*fb(vec2(lat*11.+fb(q*3.+uCol.xy*9.)*1.2,dot(q,vec2(.94,-.35))*1.5)); }   // gas bands
    else { float cn=fb(q*4.+uCol.xy*31.); alb*=.4+1.3*cn; alb=mix(alb,alb*vec3(.45,.6,.8),smoothstep(.5,.56,fb(q*7.+3.))); alb*=.75+.5*fb(q*26.); }
    float limb=1.-.6*smoothstep(-uR*.6,0.,alt)*smoothstep(-uR,0.,alt);
    c=alb*lit*limb*1.15;
    if(uKind>.5&&uKind<1.5){                                         // home: the dark side carries bioluminescence
      float glow=smoothstep(.5,.72,fb(q*17.+5.))*(.3+.7*h(floor(q*uR/2.5))); c+=vec3(.03,.9,.64)*glow*(1.-lit)*.5*smoothstep(0.,3.,uR/600.);
      float depth=-alt*uScale;                                       // close to the ground: terrain line and glowing flora
      if(uScale<40.){ float ridge=(fb(vec2(arc/900.,2.))-.5)*520.+(fb(vec2(arc/60.,5.))-.5)*30.; float m=smoothstep(0.,2.*uScale+.5,depth+ridge*smoothstep(4000.,0.,abs(arc-uArc))*0.+0.);
        float fl=step(.93,h(floor(vec2(arc/1.5,depth/1.5))))*exp(-depth/14.); vec3 gcol=mix(vec3(.03,.9,.64),vec3(.34,1.,.05),h(floor(vec2(arc/37.,1.))));
        c=mix(c,vec3(.006,.008,.01)*(.6+fb(vec2(arc,depth)*.4)),smoothstep(60.,8.,uScale)); c+=gcol*fl*1.4*smoothstep(12.,1.5,uScale)*(1.-lit*.8); }
    }
    a=aa;
  }
  if(uAtmo>0.){ float x=alt/uAtmo; float dens=alt>0.?exp(-x*7.):1.; float sun=smoothstep(-.35,.25,day+max(x,0.)*.25);
    vec3 ac=mix(uCol*3.+vec3(.05,.12,.2),vec3(.2,.5,.9),.55); if(uKind>.5&&uKind<1.5) ac=vec3(.1,.55,.6);
    c+=ac*dens*(alt>0.?.34:.07*smoothstep(-uAtmo*3.,0.,alt)+.02)*sun + ac*dens*.012; a=max(a,min(1.,dens*.6)*step(0.,alt)*0.); }
  if(uRing>0.&&alt>0.){ float rr=(alt+uR)/uR; float m=smoothstep(1.28,1.34,rr)*smoothstep(2.25,2.15,rr); float bands=.35+.65*vn(vec2(rr*42.,1.))*vn(vec2(rr*140.,7.)+.5);
    float sh=1.-smoothstep(.0,-.2,day)*smoothstep(1.05,.9,abs(dot(n,vec2(-uSun.y,uSun.x)))*rr); c+=vec3(.5,.45,.5)*m*bands*.16*sh; }
  gl_FragColor=vec4(c,a);
}`;
export const V = { stars: null, discs: [], lines: [], lineN: 0 };
const NPT = 257;
export function initView(scene) {
  V.su = { uRes: { value: new THREE.Vector2(1, 1) }, uOff: { value: new THREE.Vector2() }, uTime: { value: 0 }, uDim: { value: 1 } };
  V.stars = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: V.su, vertexShader: VS, fragmentShader: STARS, depthTest: false, depthWrite: false }));
  V.stars.frustumCulled = false; V.stars.renderOrder = 0; scene.add(V.stars);
  for (const b of bodies) {
    const u = { uRes: V.su.uRes, uC: { value: new THREE.Vector2() }, uS: { value: new THREE.Vector2() }, uN: { value: new THREE.Vector2(0, 1) }, uSun: { value: new THREE.Vector2(1, 0) }, uR: { value: 1 }, uAtmo: { value: 0 },
      uKind: { value: b.kind === 'star' ? 3 : b.kind === 'gas' ? 2 : b.kind === 'home' ? 1 : 0 }, uRing: { value: b.ring }, uScale: { value: 1 }, uArc: { value: 0 }, uTime: V.su.uTime, uCol: { value: new THREE.Vector3(...b.col) } };
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: u, vertexShader: VS, fragmentShader: BODY, depthTest: false, depthWrite: false, transparent: true,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor }));
    m.frustumCulled = false; m.renderOrder = b.kind === 'star' ? 1 : 2; scene.add(m); V.discs.push({ m, u, b });
  }
  for (let i = 0; i < 16; i++) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NPT * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, depthTest: false, blending: THREE.AdditiveBlending })); l.frustumCulled = false; l.renderOrder = 3; l.visible = false; scene.add(l); V.lines.push(l);
  }
}
const st = [0, 0, 0, 0], bs = [0, 0, 0, 0];
// camera: absolute focus (cx, cy) metres, scale metres per px. Returns screen data for each body: [x px, y px, r px]
export function updateView(cx, cy, scale, t, time, dim) {
  V.su.uRes.value.set(G.w, G.h); V.su.uTime.value = time; V.su.uDim.value = dim; V.su.uOff.value.set(Math.log10(scale) * 37, Math.log10(scale) * 21);
  V.lineN = 0; const out = [];
  for (const d of V.discs) {
    const b = d.b; bodyState(b.id, t, bs); const dx = bs[0] - cx, dy = bs[1] - cy, dist = Math.hypot(dx, dy), rpx = b.R / scale, u = d.u, x = dx / scale, y = dy / scale;
    out.push([x, y, rpx, bs[0], bs[1]]);
    const ext = (b.kind === 'star' ? b.R * 14 : b.R * (b.ring ? 2.3 : 1) + b.atmo * 1.5) / scale, far = Math.max(Math.abs(x) - G.w / 2, Math.abs(y) - G.h / 2);
    d.m.visible = rpx > 0.9 && far < ext; if (!d.m.visible) continue;
    u.uR.value = rpx; u.uC.value.set(x, y); u.uAtmo.value = b.atmo / scale; u.uScale.value = scale;
    const nx = dist > 1 ? -dx / dist : 0, ny = dist > 1 ? -dy / dist : 1; u.uN.value.set(nx, ny); u.uS.value.set(nx * (b.R - dist) / scale, ny * (b.R - dist) / scale);
    u.uArc.value = (Math.atan2(ny, nx) * b.R) % 65536;
    if (b.kind !== 'star') { const sl = Math.hypot(bs[0], bs[1]) || 1; u.uSun.value.set(-bs[0] / sl, -bs[1] / sl); }
  }
  return out;
}
// draw a conic around (ox, oy) absolute; nu0 = where to sample densely; col = [r,g,b] (may exceed 1), full = whole ellipse
export function orbitLine(el, ox, oy, cx, cy, scale, nu0, col, alpha = 1, nuMax = Math.PI) {
  if (V.lineN >= V.lines.length) return; const l = V.lines[V.lineN++], pos = l.geometry.attributes.position.array, H = (NPT - 1) / 2;
  let lim = nuMax; if (el.e >= 1) lim = Math.min(nuMax, Math.acos(-1 / el.e) * 0.985);
  for (let i = 0; i < NPT; i++) {
    const u = (i - H) / H; let nu = nu0 + Math.sign(u) * Math.pow(Math.abs(u), 3) * Math.PI;
    if (el.e >= 1 || nuMax < Math.PI) nu = Math.max(-lim, Math.min(lim, nu0 + Math.sign(u) * Math.pow(Math.abs(u), 3) * 2 * lim));
    stateAtNu(el, nu, st); pos[i * 3] = (ox + st[0] - cx) / scale; pos[i * 3 + 1] = (oy + st[1] - cy) / scale; pos[i * 3 + 2] = 0;
  }
  l.geometry.attributes.position.needsUpdate = true; l.material.color.setRGB(col[0] * alpha, col[1] * alpha, col[2] * alpha); l.visible = true;
}
export function endLines() { for (let i = V.lineN; i < V.lines.length; i++) V.lines[i].visible = false; }
export { trueAnomaly, TAU, HOME };

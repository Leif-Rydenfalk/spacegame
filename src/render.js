// render: three.js renderer, post chain (bloom, grain, vignette, edge chromatic aberration, tone curve),
// one instanced sprite batch per scene, particles, and the 2D HUD canvas.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { G } from './core.js';

export const R = { renderer: null, composer: null, camera: null, scenes: {}, hud: null, bloom: null, final: null, dpr: 1 };

const FinalShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uExp: { value: 1 }, uRes: { value: new THREE.Vector2(1, 1) }, uFlash: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uExp, uFlash; uniform vec2 uRes; varying vec2 vUv;
    float h(vec2 p){ p=fract(p*vec2(443.897,441.423)); p+=dot(p,p.yx+19.19); return fract((p.x+p.y)*p.x); }
    void main(){
      vec2 c = vUv-.5; float r2 = dot(c,c);
      vec2 off = c*r2*r2*14.0/uRes;          // about 1.5 px at the corners, nothing in the middle
      vec3 col = vec3(texture2D(tDiffuse,vUv+off).r, texture2D(tDiffuse,vUv).g, texture2D(tDiffuse,vUv-off).b);
      col *= uExp;
      col = 1.0-exp(-col*1.25);                           // soft shoulder for the emitters
      col = pow(col, vec3(1.0/2.2));
      col = mix(col, col*col*(3.0-2.0*col), 0.45);        // gentle S curve
      col *= 1.0 - 0.38*smoothstep(0.3,0.95,length(c*vec2(1.0,0.82))*1.35);
      float g = h(gl_FragCoord.xy*0.5+fract(uTime*7.13)*97.0)-.5;
      col += g*0.045*(1.0-0.5*dot(col,vec3(.33)));
      col = mix(col, vec3(1.0,0.12,0.1), uFlash*r2*1.6);  // damage pulse lives at the edges only
      gl_FragColor = vec4(col,1.0);
    }`,
};

export function initRender() {
  const canvas = document.getElementById('gl');
  const r = R.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false });
  r.setClearColor(0x000000, 1); r.autoClear = true; r.outputColorSpace = THREE.LinearSRGBColorSpace;
  R.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
  R.scenes.surface = new THREE.Scene(); R.scenes.space = new THREE.Scene();
  const comp = R.composer = new EffectComposer(r);
  R.pass = new RenderPass(R.scenes.surface, R.camera); comp.addPass(R.pass);
  R.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.85, 0.55, 1.0); comp.addPass(R.bloom);
  R.final = new ShaderPass(FinalShader); comp.addPass(R.final);
  R.hud = document.getElementById('hud').getContext('2d');
  resize(); addEventListener('resize', resize);
}
function resize() {
  const w = innerWidth, h = innerHeight, dpr = R.dpr = Math.min(devicePixelRatio || 1, 2);
  G.w = w; G.h = h;
  R.renderer.setPixelRatio(dpr); R.renderer.setSize(w, h, false);
  R.composer.setPixelRatio(dpr); R.composer.setSize(w, h);
  const c = R.camera; c.left = -w / 2; c.right = w / 2; c.top = h / 2; c.bottom = -h / 2; c.updateProjectionMatrix();
  R.final.uniforms.uRes.value.set(w * dpr, h * dpr);
  const hc = R.hud.canvas; hc.width = w * dpr; hc.height = h * dpr;
}
export function renderFrame(flash) {
  R.pass.scene = R.scenes[G.act];
  R.final.uniforms.uTime.value = G.real; R.final.uniforms.uExp.value = G.exposure; R.final.uniforms.uFlash.value = flash || 0;
  R.composer.render();
}

// ---- instanced sprite batch -------------------------------------------------------------------------------------
// shapes: 0 grained rect, 1 soft glow, 2 capsule, 3 sunlit hull plate, 4 ring, 5 sunlit ball, 6 engine plume
// modes:  0 unlit, 1 lit by the surface light map, 2 additive emissive
const BV = `
attribute vec4 iA, iB, iC; varying vec2 vL, vS, vW; varying vec4 vC; varying vec4 vP;
void main(){ vec2 p = position.xy*iA.zw; float c=cos(iB.x), s=sin(iB.x);
  p = vec2(c*p.x-s*p.y, s*p.x+c*p.y)+iA.xy; vL=position.xy; vS=iA.zw; vW=p; vC=iC; vP=iB;
  gl_Position = projectionMatrix*vec4(p,0.,1.); }`;
const BF = `
precision highp float; varying vec2 vL, vS, vW; varying vec4 vC; varying vec4 vP;
uniform sampler2D uLight; uniform vec4 uLR; uniform vec2 uSun;
float h(vec2 p){ p=fract(p*vec2(443.897,441.423)); p+=dot(p,p.yx+19.19); return fract((p.x+p.y)*p.x); }
void main(){
  float shape=vP.y, mode=vP.z, a=1.0; vec3 col=vC.rgb; vec2 q=vL*vS;
  float cr=cos(-vP.x), sr=sin(-vP.x); vec2 sl=vec2(cr*uSun.x-sr*uSun.y, sr*uSun.x+cr*uSun.y);
  float gr = 0.84+0.32*h(floor(q/1.5)+vP.w*91.0);
  if(shape<0.5){ col*=gr; vec2 e=vS*.5-abs(q); col*=0.72+0.28*smoothstep(0.0,2.5,min(e.x,e.y)); }
  else if(shape<1.5){ float d=length(vL)*2.0; a=exp(-d*d*4.5)*smoothstep(1.0,0.6,d); }
  else if(shape<2.5){ float r=min(vS.x,vS.y)*.5; vec2 d=abs(q)-(vS*.5-r); float sd=length(max(d,0.0))-r;
    a=smoothstep(0.7,-0.7,sd); col*=gr*(1.0-0.45*smoothstep(-r,0.0,sd)); }
  else if(shape<3.5){ vec2 e=vS*.5-abs(q); float ed=min(e.x,e.y);
    float lit=smoothstep(-0.75,0.75,dot(vL*2.0,sl)+ (h(floor(q/3.0)+vP.w)-.5)*0.25);
    col*=gr*mix(0.045,1.0,lit)*(0.55+0.45*smoothstep(0.0,2.0,ed));
    col+=vC.rgb*0.9*pow(max(0.0,1.0-abs(dot(vL*2.0,sl)-0.55)*3.0),4.0)*smoothstep(0.0,3.0,ed); }
  else if(shape<4.5){ float d=length(vL)*2.0; a=smoothstep(0.08,0.0,abs(d-0.9))*0.9; }
  else if(shape<5.5){ float d=length(vL)*2.0; a=smoothstep(1.0,0.92,d); vec3 n=vec3(vL*2.0,sqrt(max(0.0,1.0-d*d)));
    col*=gr*mix(0.03,1.0,smoothstep(-0.25,0.45,dot(n.xy,sl)+n.z*0.15)); }
  else { float x=vL.x+0.5; float wd=0.22+x*0.78; float y=vL.y*2.0/wd; a=exp(-y*y*3.0)*pow(1.0-x,1.6)*smoothstep(0.0,0.06,x)/wd*0.5;
    a*=0.75+0.5*h(floor(q/2.0)+vP.w*37.0); }
  if(mode>0.5&&mode<1.5){ vec3 L=texture2D(uLight,(vW-uLR.xy)*uLR.zw).rgb; col*=L*L*4.0; }
  a*=vC.a;
  gl_FragColor = mode>1.5 ? vec4(col*a,0.0) : vec4(col*a,a);
}`;
export class Batch {
  constructor(scene, cap = 20000, order = 10) {
    this.cap = cap; this.n = 0; this.ox = 0; this.oy = 0; this.k = 1;
    const g = new THREE.InstancedBufferGeometry(); const p = new THREE.PlaneGeometry(1, 1);
    g.index = p.index; g.setAttribute('position', p.attributes.position);
    this.A = new Float32Array(cap * 4); this.B = new Float32Array(cap * 4); this.C = new Float32Array(cap * 4);
    for (const [n, arr] of [['iA', this.A], ['iB', this.B], ['iC', this.C]]) { const at = new THREE.InstancedBufferAttribute(arr, 4); at.setUsage(THREE.DynamicDrawUsage); g.setAttribute(n, at); }
    this.u = { uLight: { value: null }, uLR: { value: new THREE.Vector4(0, 0, 1, 1) }, uSun: { value: new THREE.Vector2(1, 0) } };
    const m = new THREE.ShaderMaterial({ vertexShader: BV, fragmentShader: BF, uniforms: this.u, transparent: true, depthTest: false, depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor });
    this.mesh = new THREE.Mesh(g, m); this.mesh.frustumCulled = false; this.mesh.renderOrder = order; scene.add(this.mesh); this.g = g;
  }
  begin(ox, oy, k) { this.n = 0; this.ox = ox; this.oy = oy; this.k = k; }
  // world units; col = [r,g,b] linear, may exceed 1 for emitters
  add(x, y, w, h, rot, col, a = 1, shape = 0, mode = 0, seed = 0) { this.px((x - this.ox) * this.k, (y - this.oy) * this.k, w * this.k, h * this.k, rot, col, a, shape, mode, seed); }
  px(x, y, w, h, rot, col, a = 1, shape = 0, mode = 0, seed = 0) {
    if (this.n >= this.cap) return; const i = this.n++ * 4, A = this.A, B = this.B, C = this.C;
    A[i] = x; A[i + 1] = y; A[i + 2] = w; A[i + 3] = h; B[i] = rot; B[i + 1] = shape; B[i + 2] = mode; B[i + 3] = seed;
    C[i] = col[0]; C[i + 1] = col[1]; C[i + 2] = col[2]; C[i + 3] = a;
  }
  // a line segment from a to b as a capsule or rect of thickness t (world units)
  seg(x1, y1, x2, y2, t, col, a = 1, shape = 2, mode = 0, seed = 0) { const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy); this.add((x1 + x2) / 2, (y1 + y2) / 2, l + (shape === 2 ? t : 0), t, Math.atan2(dy, dx), col, a, shape, mode, seed); }
  end() { const g = this.g; g.instanceCount = this.n; for (const n of ['iA', 'iB', 'iC']) { const at = g.attributes[n]; at.clearUpdateRanges(); at.addUpdateRange(0, this.n * 4); at.needsUpdate = true; } }
}

// ---- particles: many and small ------------------------------------------------------------------------------------
export class Particles {
  constructor(cap = 5000) { this.cap = cap; this.list = []; }
  spawn(o) { if (this.list.length >= this.cap) this.list.shift(); o.max = o.life; this.list.push(o); return o; }
  // acc(p) returns [ax, ay]; solid(x, y) is optional tile collision
  step(dt, ax, ay, solid) {
    const L = this.list; let w = 0;
    for (let i = 0; i < L.length; i++) {
      const p = L[i]; p.life -= dt; if (p.life <= 0) continue;
      const g = p.grav === undefined ? 1 : p.grav; p.vx += ax * g * dt; p.vy += ay * g * dt;
      if (p.drag) { const d = Math.exp(-p.drag * dt); p.vx *= d; p.vy *= d; }
      const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt;
      if (solid && p.col) {
        if (solid(nx, p.y)) { p.vx *= -(p.bounce || 0.3); p.hit && p.hit(p); } else p.x = nx;
        if (solid(p.x, ny)) { if (Math.abs(p.vy) > 1.2 && p.hit) p.hit(p); p.vy *= -(p.bounce || 0.3); p.vx *= 0.7; if (p.spin) p.spin *= 0.6; } else p.y = ny;
      } else { p.x = nx; p.y = ny; }
      if (p.spin) p.rot = (p.rot || 0) + p.spin * dt;
      L[w++] = p;
    }
    L.length = w;
  }
  draw(b, minPx = 0) {
    for (const p of this.list) {
      const f = p.life / p.max, a = (p.fade === 0 ? 1 : f < 0.5 ? f * 2 : 1) * (p.a === undefined ? 1 : p.a);
      let s = p.size * (p.grow ? 1 + p.grow * (1 - f) : 1); if (s * b.k < minPx) s = minPx / b.k;
      let c = p.c; if (p.c2) { const t = 1 - f; c = [c[0] + (p.c2[0] - c[0]) * t, c[1] + (p.c2[1] - c[1]) * t, c[2] + (p.c2[2] - c[2]) * t]; }
      b.add(p.x, p.y, s * (p.asp || 1), s, p.rot || 0, c, a, p.shape === undefined ? 1 : p.shape, p.mode === undefined ? 2 : p.mode, i_seed(p));
    }
  }
}
const i_seed = p => p.seed || 0;
export { THREE };

// surface view: one full-screen shader draws sky, back walls, rock, ores and flora from the tile window texture
// and multiplies the light map over it; a fan mesh shaped by the lamp rays is the volumetric haze.
import { THREE } from '../render.js';
import { G } from '../core.js';
import { light, LW, LH, RAYS } from './light.js';

const FRAG = `
precision highp float; varying vec2 vV;
uniform sampler2D uTiles, uLight; uniform vec2 uOrigin, uCamRel, uRes; uniform float uPPT, uTime, uHorizon; uniform vec3 uCrack;
float h(vec2 p){ p=fract(p*vec2(443.897,441.423)); p+=dot(p,p.yx+19.19); return fract((p.x+p.y)*p.x); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
float fb(vec2 p){ return vn(p)*.5+vn(p*2.03)*.25+vn(p*4.1)*.125+vn(p*8.3)*.0625; }
float kindAt(vec2 c){ return texture2D(uTiles,(c+.5)/vec2(${LW}.,${LH}.)).r*255.; }
float sol(float id){ float k=mod(id,32.); return (k>1.5&&k<7.5)||(k>8.5&&k<9.5)||(k>12.5&&k<13.5) ? 1.:0.; }
vec3 rock(float k, vec2 w, float d){
  vec3 c = k<2.5||(k>8.5&&k<9.5) ? vec3(.105,.082,.092) : k<3.5 ? vec3(.078,.094,.115) : k<4.5 ? vec3(.04,.04,.058) : k>12.5 ? vec3(.2,.22,.24) : vec3(.078,.094,.115);
  if(k>4.5&&k<7.5&&d>0.) c=vec3(.07,.085,.105);
  float g = h(floor(w*8.)), lo = fb(w*.37), st = sin(w.y*2.6+lo*9.)*.5+.5;
  c *= (.62+.5*g)*(.55+.9*lo)*(.85+.3*st*st);
  if(k>3.5&&k<4.5) c += vec3(.05,.06,.09)*pow(vn(w*vec2(1.3,7.)+lo*4.),7.)*3.;      // glass streaks in obsidian
  if(k>12.5) { vec2 f=fract(w); c *= .7+.3*smoothstep(0.,.08,min(min(f.x,1.-f.x),min(f.y,1.-f.y))); }
  return c;
}
void main(){
  vec2 t = uCamRel + vV/uPPT, cell = floor(t), f = t-cell, w = t+uOrigin, wc = cell+uOrigin;
  float id = kindAt(cell), k = mod(id,32.), wall = step(31.5,id), s = sol(id);
  float sL=sol(kindAt(cell+vec2(-1,0))), sR=sol(kindAt(cell+vec2(1,0))), sU=sol(kindAt(cell+vec2(0,1))), sD=sol(kindAt(cell+vec2(0,-1)));
  vec3 L = texture2D(uLight, t/vec2(${LW}.,${LH}.)).rgb; L = L*L*4.;
  float hv = h(wc), h2 = h(wc+7.7), pulse = .75+.25*sin(uTime*.8+hv*6.283);
  vec3 alb = vec3(0.), em = vec3(0.); vec2 sv = vV/uRes.y;
  if(s>.5){
    alb = rock(k,w,1.);
    float ed = min(min(sL>.5?1.:f.x, sR>.5?1.:1.-f.x), min(sU>.5?1.:1.-f.y, sD>.5?1.:f.y));
    alb *= .38+.62*smoothstep(0.,.42,ed);
    if(sU<.5) alb *= 1.+.9*smoothstep(.86,1.,f.y);                                   // top edges catch light
    if(k>4.5&&k<5.5){ float o=vn(w*5.)*vn(w*11.+3.); alb = mix(alb, vec3(.34,.13,.06)*(.6+h(floor(w*8.))), smoothstep(.22,.3,o)); }
    if(k>5.5&&k<6.5){ float o=vn(w*5.+9.)*vn(w*12.); alb = mix(alb, mix(vec3(.08,.3,.2),vec3(.5,.24,.08),h(floor(w*8.)+2.)), smoothstep(.22,.3,o)); }
    if(k>6.5&&k<7.5){ vec2 q=w*3.5; vec2 ci=floor(q); float sh=0.; for(int a=0;a<2;a++){ vec2 c2=ci+vec2(float(a),0.); float r=h(c2*1.7); vec2 p=q-c2-vec2(.5,.5); float an=r*6.283; p=vec2(cos(an)*p.x-sin(an)*p.y,sin(an)*p.x+cos(an)*p.y); sh=max(sh, step(.45,r)*smoothstep(.07,.02,abs(p.x))*smoothstep(.42,.2,abs(p.y))); }
      em += vec3(.12,.8,1.)*sh*(1.4+pulse); alb *= 1.-.5*sh; }
    if(k>8.5&&k<9.5&&sU<.5){ float m=smoothstep(.62,.95,f.y+ (vn(w*6.)-.5)*.3); alb=mix(alb,vec3(.03,.09,.03),m*.8); em += vec3(.34,1.,.05)*m*step(.78,h(floor(w*12.)))*1.6*pulse; }
    if(uCrack.z>0. && cell==uCrack.xy){ float cr=abs(vn(w*9.)-.5); alb *= 1.-uCrack.z*.85*smoothstep(.09,.0,cr-.02*uCrack.z); }
  } else {
    if(wall>.5){
      float dp = clamp((uHorizon-wc.y)/60.,0.,1.);
      alb = rock(wc.y>uHorizon-70.?3.:4., w*1.0+31., 0.)*mix(.5,.3,dp);
      float ao = min(min(sL>.5?f.x:1., sR>.5?1.-f.x:1.), min(sU>.5?1.-f.y:1., sD>.5?f.y:1.));
      alb *= .45+.55*smoothstep(0.,.7,ao);
    } else {
      // night sky: a ringed giant, three star depths, far ridges
      vec3 sky = mix(vec3(.0012,.003,.006), vec3(.006,.017,.022), smoothstep(.55,-.35,sv.y));
      for(int i=0;i<3;i++){ float fi=float(i); vec2 p=(vV+uCamRel*uPPT*(.004+.004*fi)+uOrigin*uPPT*(.004+.004*fi))/(3.+fi*2.); vec2 ci=floor(p); float r=h(ci+fi*13.);
        float tw=.7+.3*sin(uTime*(1.+r*3.)+r*40.); vec2 sp=fract(p)-.5-(vec2(h(ci+1.),h(ci+2.))-.5)*.6;
        sky += mix(vec3(1.,.75,.55),vec3(.6,.8,1.),h(ci+5.))*step(.955+fi*.012,r)*smoothstep(.2,.0,length(sp))*tw*(.5-.12*fi); }
      vec2 gp = sv-vec2(.42,.2); float gd=length(gp)/.21;
      if(gd<1.){ float lit=smoothstep(-.25,.7,dot(gp/.21,normalize(vec2(-.8,.45)))+sqrt(1.-gd*gd)*.2); float band=fb(vec2(gp.y*38.+fb(gp*9.)*1.5,gp.x*2.));
        sky = mix(sky, vec3(.11,.085,.13)*(.35+band)*lit*smoothstep(1.,.96,gd)+vec3(.004,.006,.01), smoothstep(1.,.985,gd)); }
      else { sky += vec3(.03,.04,.07)*exp(-(gd-1.)*14.)*.5; }
      float rg=length(gp*vec2(1.,3.6))/.21; if(rg>1.25&&rg<2.1&&(gd>1.||gp.y<0.)) sky += vec3(.05,.045,.06)*(.4+.6*vn(vec2(rg*60.,0.)))*smoothstep(1.25,1.3,rg)*smoothstep(2.1,2.,rg);
      float hy = (uHorizon-(uCamRel.y+uOrigin.y))*uPPT;                               // horizon in view px
      for(int i=0;i<2;i++){ float fi=float(i), par=.12+.2*fi; float x=(w.x*par+vV.x/uPPT*(1.-par))*.035*(1.+fi*.6)+fi*40.; float ridge=(fb(vec2(x,fi*9.))-.35)*uRes.y*(.42-.14*fi)+hy*par-uRes.y*.02*fi;
        float m=smoothstep(ridge+1.5,ridge-1.5,vV.y); sky = mix(sky, vec3(.0016,.0045,.006)*(1.6-fi)+vec3(.0,.01,.008)*exp(-(ridge-vV.y)/uRes.y*9.)*.35, m); }
      alb = vec3(0.); em += sky;
    }
    if(k>9.5&&k<10.5){ float cx=.5+(hv-.5)*.34, hh=.3+.5*h2, rw=.2+.16*hv;
      float stem=smoothstep(.055,.03,abs(f.x-cx-sin(f.y*5.+hv*9.)*.03))*step(f.y,hh);
      vec2 cp=(f-vec2(cx,hh))/vec2(rw,.2); float cd=length(cp); float cap=smoothstep(1.,.9,cd)*step(-.12,cp.y);
      float und=cap*smoothstep(.5,-.1,cp.y);
      alb=mix(alb,vec3(.02,.07,.07),max(stem*.9,cap)); em += vec3(.03,.9,.64)*(stem*.35*f.y/hh+und*1.9+cap*.16+cap*step(.8,h(floor(f*9.)+wc))*.9)*pulse; }
    if(k>10.5&&k<11.5){ vec2 c=vec2(.5+(hv-.5)*.2,.36); float d=length((f-c)/vec2(.3,.34)); float b=smoothstep(1.,.85,d);
      float stalk=smoothstep(.05,.02,abs(f.x-c.x))*step(f.y,.2);
      alb=mix(alb,vec3(.04,.02,.07),max(b,stalk)); float p2=.5+.5*sin(uTime*1.7+hv*6.283);
      em += vec3(.3,.09,1.)*(b*exp(-d*d*3.)*(1.2+2.2*p2)+b*.12); }
    if(k>11.5&&k<12.5){ float x=.5+.2*sin(w.y*3.1+hv*6.)+(hv-.5)*.3; float v=smoothstep(.05,.02,abs(f.x-x));
      float bead=smoothstep(.13,.04,length(vec2(f.x-x,fract(w.y*1.5+hv)-.5)));
      alb=mix(alb,vec3(.02,.05,.02),v); em += vec3(.34,1.,.05)*(v*.25+bead*1.5)*pulse; }
    if(k>7.5&&k<8.5){ float n=fb(w*.6+vec2(uTime*.05,uTime*.02)); em += vec3(1.8,.28,.04)*(.5+1.5*n*n)+vec3(1.5,1.,.3)*smoothstep(.62,.7,n); alb=vec3(0.); }
    float fog = fb(w*.07+vec2(uTime*.012,uTime*.004)); em += (L+vec3(.002,.004,.005))*fog*fog*vec3(.07,.085,.09)*(wall>.5?.8:1.6);
  }
  gl_FragColor = vec4(alb*L + em, 1.);
}`;

export const view = { mesh: null, haze: null, ppt: 32 };
export function initTiles(scene) {
  const u = view.u = { uTiles: { value: light.tilesTex }, uLight: { value: light.lightTex }, uOrigin: { value: new THREE.Vector2() }, uCamRel: { value: new THREE.Vector2() }, uRes: { value: new THREE.Vector2(1, 1) }, uPPT: { value: 32 }, uTime: { value: 0 }, uHorizon: { value: 0 }, uCrack: { value: new THREE.Vector3() } };
  const m = new THREE.ShaderMaterial({ uniforms: u, depthTest: false, depthWrite: false, fragmentShader: FRAG,
    vertexShader: 'uniform vec2 uRes; varying vec2 vV; void main(){ vV=position.xy*uRes*.5; gl_Position=vec4(position.xy,0.,1.); }' });
  view.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m); view.mesh.frustumCulled = false; view.mesh.renderOrder = 0; scene.add(view.mesh);
  // haze fan: vertex 0 at the lamp, one vertex per ray at its hit distance
  const g = new THREE.BufferGeometry(), pos = new Float32Array((RAYS + 1) * 3), fd = new Float32Array((RAYS + 1) * 2), idx = [];
  for (let i = 1; i < RAYS; i++) idx.push(0, i, i + 1);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('aF', new THREE.BufferAttribute(fd, 2).setUsage(THREE.DynamicDrawUsage)); g.setIndex(idx);
  view.hazeU = { uK: { value: 1 }, uTime: { value: 0 } };
  const hm = new THREE.ShaderMaterial({ uniforms: view.hazeU, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'attribute vec2 aF; varying vec2 vF; varying vec2 vP; void main(){ vF=aF; vP=position.xy; gl_Position=projectionMatrix*vec4(position.xy,0.,1.); }',
    fragmentShader: `precision highp float; varying vec2 vF, vP; uniform float uK, uTime;
      float h(vec2 p){ p=fract(p*vec2(443.897,441.423)); p+=dot(p,p.yx+19.19); return fract((p.x+p.y)*p.x); }
      float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
      void main(){ float e=1.-vF.y*vF.y; float d=vF.x; float n=.7+.6*vn(vP*.006+uTime*.04)*vn(vP*.017-uTime*.025);
        float a=pow(e,1.6)*pow(1.-d,1.7)*(.25+.75*smoothstep(0.,.05,d))*n*uK; gl_FragColor=vec4(vec3(1.,.9,.74)*a*.07,1.); }` });
  view.haze = new THREE.Mesh(g, hm); view.haze.frustumCulled = false; view.haze.renderOrder = 5; scene.add(view.haze);
}
// cam in tiles; ppt = pixels per tile
export function updateTiles(camTx, camTy, ppt, time, crack) {
  const u = view.u; view.ppt = ppt;
  u.uOrigin.value.set(light.ox, light.oy); u.uCamRel.value.set(camTx - light.ox, camTy - light.oy); u.uRes.value.set(G.w, G.h); u.uPPT.value = ppt; u.uTime.value = time;
  u.uCrack.value.set(crack ? crack.x - light.ox : 0, crack ? crack.y - light.oy : 0, crack ? crack.p : 0);
  const L = light.lamp, g = view.haze.geometry, pos = g.attributes.position.array, fd = g.attributes.aF.array, half = 0.366;
  view.haze.visible = L.on; view.hazeU.uK.value = L.k; view.hazeU.uTime.value = time;
  pos[0] = (L.x - camTx) * ppt; pos[1] = (L.y - camTy) * ppt; fd[0] = 0; fd[1] = 0;
  for (let r = 0; r < RAYS; r++) {
    const uu = (r / (RAYS - 1)) * 2 - 1, a = L.ang + uu * half, d = Math.min(light.rayD[r] + 0.6, 48);
    pos[(r + 1) * 3] = (L.x + Math.cos(a) * d - camTx) * ppt; pos[(r + 1) * 3 + 1] = (L.y + Math.sin(a) * d - camTy) * ppt; fd[(r + 1) * 2] = d / 48; fd[(r + 1) * 2 + 1] = uu;
  }
  g.attributes.position.needsUpdate = true; g.attributes.aF.needsUpdate = true;
}

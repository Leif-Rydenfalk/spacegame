// surface view: one full-screen shader reads the density window (linear filtered, so the iso-line is smooth at any
// zoom) and the material window, shades rock, ore, ruins, hive tissue and human concrete, draws the sky and the far
// forest, and multiplies the light map over it. A fan mesh shaped by the lamp rays is the volumetric haze.
import { THREE, R } from '../render.js';
import { G } from '../core.js';
import { world, CELL, TS } from './world.js';
import { LAVA_Y, CIRC, RAD, surfaceH, biome, lushness } from './gen.js';
import { structsIn } from './structures.js';
import { SKYFN } from './backdrop.js';
import { S } from './state.js';
import { light, LW, LH, RAYS } from './light.js';
import { heat, HC, HW, HH } from './heat.js';
export const DW = 768, DH = 432, PN = CIRC / 2;       // the density window (96 x 54 m); the planet profile has one texel per 2 m
const dens = new Uint8Array(DW * DH), mats = new Uint8Array(DW * DH);

const FRAG = `
precision highp float; varying vec2 vV;
uniform sampler2D uDens, uMat, uLight, uBack, uHeat, uProf; uniform vec2 uOrigin, uCam, uRes, uLO, uHO, uPx, uSky; uniform float uPPM, uTime, uHorizon; uniform vec3 uFog; uniform vec4 uPl;
const vec2 DS = vec2(${DW}.,${DH}.), LS = vec2(${LW * TS},${LH * TS}), HS = vec2(${HW * HC},${HH * HC});
// the lattice is taken modulo 1024 before it is hashed: a kilometre or three from the crash site the products would
// otherwise run out of float bits and the rock would turn to streaks
float h(vec2 p){ p=mod(p,1024.); p=fract(p*vec2(443.897,441.423)); p+=dot(p,p.yx+19.19); return fract((p.x+p.y)*p.x); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
float fb(vec2 p){ return vn(p)*.5+vn(p*2.03)*.25+vn(p*4.1)*.125+vn(p*8.3)*.0625; }
float dn(vec2 s){ return texture2D(uDens,(s+.5)/DS).r; }
float mt(vec2 s){ return floor(texture2D(uMat,(floor(s+.5)+.5)/DS).r*255.+.5); }
vec3 lt(vec2 w){ vec2 u=(w-uLO)/LS; vec3 L=texture2D(uLight,u).rgb; vec2 e=min(u,1.-u); return L*L*4.*smoothstep(0.,.04,min(e.x,e.y)); }
vec3 rock(float k, vec2 w){
  vec2 t=w*2.; float g=vn(t*17.)*.55+vn(t*41.)*.45, lo=fb(t*.37), st=sin(t.y*2.6+lo*9.)*.5+.5;
  vec3 c = k<1.5 ? vec3(.105,.082,.092) : k<2.5 ? vec3(.078,.094,.115) : k<3.5 ? vec3(.04,.04,.058) : k<6.5 ? vec3(.07,.085,.105) : k<7.5 ? vec3(.2,.22,.24) : k<8.5 ? vec3(.12,.04,.055) : k<9.5 ? vec3(.085,.09,.11) : k<10.5 ? vec3(.17,.172,.175) : vec3(.1,.11,.125);
  if(k<6.5){ c *= (.62+.5*g)*(.55+.9*lo)*(.85+.3*st*st); if(k>2.5&&k<3.5) c += vec3(.05,.06,.09)*pow(vn(t*vec2(1.3,7.)+lo*4.),7.)*3.; }
  else if(k<7.5){ vec2 f=fract(w*2.); c *= (.8+.3*g)*(.7+.3*smoothstep(0.,.08,min(min(f.x,1.-f.x),min(f.y,1.-f.y)))); }
  else if(k<8.5){ float v=abs(vn(w*vec2(2.2,1.1)+lo*3.)-.5); c *= (.7+.4*g)*(.6+.8*lo)*(.55+.9*smoothstep(0.,.12,v)); }
  else if(k<9.5){ vec2 p=vec2(w.x+floor(w.y/.75)*.56,w.y)/vec2(1.5,.75); vec2 f=fract(p); c *= (.9+.14*g)*(.75+.5*lo)*(.5+.5*smoothstep(0.,.035,min(min(f.x,1.-f.x)*2.,min(f.y,1.-f.y)))); }
  else if(k<10.5){ vec2 f=fract(w/vec2(2.,1.)); c *= (.82+.25*g)*(.6+.7*lo)*(.72+.28*smoothstep(0.,.03,min(f.x,f.y)))*(1.-.35*smoothstep(.5,.9,vn(vec2(w.x*3.,w.y*.4)))); }
  else { vec2 f=fract(w/vec2(1.,.5)); c *= (.85+.2*g)*(.7+.4*lo)*(.6+.4*smoothstep(0.,.04,min(f.x,f.y))); c += vec3(.05)*smoothstep(.06,.03,length(f-vec2(.12,.25)*1.)); }
  return c;
}
${SKYFN}
// the planet profile: height of the ground, biome, lushness and what stands there, by arc length
vec4 prof(float x){ float u=x/${(CIRC / PN).toFixed(1)}, i=floor(u), f=u-i; vec4 a=texture2D(uProf,vec2((mod(i,${PN}.)+.5)/${PN}.,.5)), b=texture2D(uProf,vec2((mod(i+1.,${PN}.)+.5)/${PN}.,.5)); return vec4(mix(a.r,b.r,f), a.g, mix(a.b,b.b,f), floor(a.a)==floor(b.a) ? mix(a.a,b.a,f) : max(a.a,b.a)); }
// everything outside the density window, and the whole planet from far away: the ground line from the profile, soil
// over basalt over obsidian, the rock warming toward a molten core, the forest as a dark glowing band, hives and
// bases as their own light, and the air as a thin limb that the giant lights from its side
vec3 farCol(vec2 w, vec2 vv, vec3 sk){
  vec4 pf = prof(w.x); float alt = w.y-pf.r, lush = pf.b, aa = 1./uPPM, fine = smoothstep(.25,2.5,uPPM), ang = w.x/uPl.x;
  vec3 gl = pf.g<.5 ? vec3(.03,.9,.63) : pf.g<1.5 ? vec3(.3,.09,1.) : vec3(.34,1.,.05);
  float giant = .5+.5*cos(ang-.48);                                   // the side of the planet that faces the giant
  // air
  float hc = (4.+9.*lush)*(.55+.9*vn(vec2(w.x*.11,7.))), tr = vn(vec2(w.x*.9,alt*.35+3.))*.6+vn(vec2(w.x*.27,1.))*.4;
  float can = smoothstep(hc*(.35+.9*tr), hc*(.1+.5*tr), alt)*smoothstep(.02,.3,lush)*step(0.,alt);
  vec3 air = sk + (uFog*1.3+vec3(.004,.01,.014))*(.25+.75*giant)*(exp(-max(alt,0.)/26.)*.9+exp(-max(alt,0.)/85.)*.5);
  vec3 cc = vec3(.0035,.007,.008)+gl*.012*lush; { float sc=mix(.3,1.5,fine); vec2 q=vec2(w.x,alt)*sc, ci=floor(q); float r1=h(ci); vec2 o=fract(q)-.5-(vec2(h(ci+1.),h(ci+2.))-.5)*.5;
    cc += gl*.07*lush*(1.-fine); cc += gl*step(.9,r1)*smoothstep(.34,.05,length(o))*(.5+1.1*h(ci+3.))*(.6+.4*sin(uTime*(.5+h(ci+7.))+r1*40.))*(.35+.65*fine); }
  air = mix(air, cc, can*.93);
  float site = floor(pf.a), sf = smoothstep(0.,.4,fract(pf.a)/.9), hv = (site>1.5&&site<2.5 ? 1. : site>3.5 ? 2.4 : 0.)*sf, org = fb(vec2(w.x*.05,w.y*.07)+2.);
  if(hv>0.) air += vec3(.34,1.,.05)*hv*.035*exp(-max(alt,0.)/(6.*hv+2.))*(.7+.3*sin(uTime*.7+w.x*.3))*smoothstep(.25,.6,org+.2);
  if(site>2.5&&site<3.5){ vec2 q=vec2(w.x*.45,alt*.6); air += vec3(1.,.45,.07)*.5*sf*step(.6,h(floor(q)))*smoothstep(.4,.1,length(fract(q)-.5))*step(alt,5.)*step(.5,alt); }
  if(site>.5&&site<1.5) air += vec3(.5,.75,1.)*.02*exp(-max(alt,0.)/6.);
  // ground: dark, lit a little from the giant's side, and from inside by what lives and what burns in it
  float d = max(-alt,0.), g = vn(w*.9)*.5+vn(w*.21+3.)*.5, st = .5+.5*sin(w.y*.55+fb(w*.05)*9.);
  vec3 c = d<2.4 ? vec3(.105,.082,.092) : w.y<-45.+7.*vn(vec2(w.x/15.,4.)) ? vec3(.04,.04,.058) : vec3(.078,.094,.115);
  c *= (.45+.8*mix(.5,g,fine))*(.75+.35*st)*(.35+.65*giant)*mix(.26,.1,smoothstep(0.,45.,d));
  float cave = smoothstep(.06,.015,abs(fb(vec2(w.x/19.,w.y/12.)+5.)-.5))*smoothstep(3.,9.,d)*smoothstep(-70.,-52.,w.y); c *= 1.-.55*cave*fine;
  c += gl*.02*lush*exp(-d*.9); { vec2 q=w*.6, ci=floor(q); c += gl*.07*fine*step(.985,h(ci))*smoothstep(.4,.1,length(fract(q)-.5))*smoothstep(1.,6.,d)*smoothstep(60.,20.,d); }      // the living skin of the ground, lumen in the rock
  if(hv>0.){ float m=smoothstep(34.*hv+1.,8.*sf,d)*smoothstep(.34,.6,org+.25*smoothstep(30.*hv+1.,0.,d))*sf; c = mix(c, vec3(.03,.01,.014), m*.85); c += vec3(.34,1.,.05)*.05*m*pow(1.-abs(fb(w*.11)-.5)*2.,8.)*(.6+.4*sin(uTime*.9+org*20.)); }
  // the interior, in the planet's own Cartesian frame so nothing streaks toward the centre: a thick dark crust, slow
  // veins of heat under it, and a core that is only a dull glow
  vec2 pc = (uPl.x+w.y)*vec2(sin(ang),cos(ang)); float deep = smoothstep(-58.,-190.,w.y), core = smoothstep(-uPl.x*.5,-uPl.x*.95,w.y), nz = fb(pc*.011+vec2(uTime*.003,0.)), vein = pow(max(0.,1.-abs(fb(pc*.02+nz)-.5)*2.),9.);
  c = mix(c, c*.3, deep); c += vec3(1.1,.15,.018)*deep*(.006+.16*vein*nz*(1.-.6*core)+core*core*(.05+.12*nz)) + vec3(1.,.5,.14)*pow(core,6.)*.12;
  c += vec3(1.6,.26,.04)*.06*smoothstep(-110.,-70.,w.y)*smoothstep(-52.,-66.,w.y)*nz*nz;
  return mix(air, c, smoothstep(-aa, aa, -alt));
}
void main(){
  // the camera looks along local down: this pixel's true place, as arc length and altitude
  vec2 rel = vec2(vV.x/uPPM, vV.y/uPPM+uPl.x+uCam.y); float rr = length(rel);
  vec2 w = vec2(uCam.x+(rr>.01?atan(rel.x,rel.y):0.)*uPl.x, rr-uPl.x), s = w/${CELL} - uOrigin, sv = vV/uRes.y;
  float det = clamp(min(min(s.x,DS.x-s.x),min(s.y,DS.y-s.y))/24.,0.,1.)*(1.-uPl.z);
  vec3 sk = skyCol(vV);
  if(det<=0.){ gl_FragColor = vec4(farCol(w,vV,sk),1.); return; }
  float d0 = dn(s), sd = (d0-.50196)*1.00394;
  vec2 gr = vec2(dn(s+vec2(1.,0.))-dn(s-vec2(1.,0.)), dn(s+vec2(0.,1.))-dn(s-vec2(0.,1.))); vec2 n = -gr/(length(gr)+1e-4);
  float aa = .7/uPPM, solid = smoothstep(-aa, aa, sd);
  vec2 jit = (vec2(vn(w*4.3), vn(w*4.3+17.))-.5)*2.4;
  float id = mt(s), kj = mod(mt(s+jit),128.), k = mod(id,128.);
  vec2 sf = floor(s), fr = s-sf; float wall = mix(mix(step(127.5,mt(sf)),step(127.5,mt(sf+vec2(1.,0.))),fr.x), mix(step(127.5,mt(sf+vec2(0.,1.))),step(127.5,mt(sf+vec2(1.,1.))),fr.x), fr.y); wall = smoothstep(.35,.65,wall);
  if(kj>.5 && (kj<6.5)==(k<6.5)) k = kj; if(k<.5) k = 1.;
  vec3 L = lt(w), alb = vec3(0.), em = vec3(0.);
  float pulse = .75+.25*sin(uTime*.8+vn(w*.7)*6.283), rim = 1.-smoothstep(0.,.3,sd);
  vec4 ht = texture2D(uHeat,(w-uHO)/HS); float heat = ht.r*2., scorch = ht.g;
  // rock side
  vec3 ra = rock(k,w); vec3 Ls = mix(max(L, max(lt(w+n*(sd+.3)), lt(w+n*(sd+.75))*.92)*exp(-sd*2.6)), max(L, lt(w+n*.5)*.85), smoothstep(.3,.5,sd));    // near the surface the rock takes the light that falls on the surface above it, so slopes are lit smoothly
  ra *= .5+.5*smoothstep(-.05,.28,sd)*(1.-.35*smoothstep(.3,.5,sd));
  ra *= 1.+1.3*rim*rim*max(n.y,0.) - .35*rim*max(-n.y,0.);
  vec3 re = vec3(0.);
  if(k>3.5&&k<4.5){ float o=vn(w*10.)*vn(w*22.+3.); ra = mix(ra, vec3(.34,.13,.06)*(.6+vn(w*23.)), smoothstep(.22,.3,o)); }
  if(k>4.5&&k<5.5){ float o=vn(w*10.+9.)*vn(w*24.); ra = mix(ra, mix(vec3(.08,.3,.2),vec3(.5,.24,.08),vn(w*19.+2.)), smoothstep(.22,.3,o)); }
  if(k>5.5&&k<6.5){ vec2 q=w*7.; vec2 ci=floor(q); float sh=0.; for(int a=0;a<2;a++){ vec2 c2=ci+vec2(float(a),0.); float r=h(c2*1.7); vec2 p=q-c2-vec2(.5,.5); float an=r*6.283; p=vec2(cos(an)*p.x-sin(an)*p.y,sin(an)*p.x+cos(an)*p.y); sh=max(sh, step(.45,r)*smoothstep(.07,.02,abs(p.x))*smoothstep(.42,.2,abs(p.y))); }
    re += vec3(.12,.8,1.)*sh*(1.4+pulse); ra *= 1.-.5*sh; }
  if(k<2.5){ float m=rim*smoothstep(.25,.7,n.y)*smoothstep(.3,.55,vn(w*1.1+5.)+.25); vec3 mc=mix(vec3(.34,1.,.05),vec3(.03,.9,.64),smoothstep(.4,.6,vn(vec2(w.x*.02,3.))));
    ra = mix(ra, vec3(.02,.07,.035), m*.9); vec2 mf=fract(w*30.)-.5; re += mc*m*step(.965,h(floor(w*30.)))*smoothstep(.42,.12,length(mf))*1.3*pulse; }
  if(k>7.5&&k<8.5){ float v=abs(vn(w*vec2(2.2,1.1)+fb(w*.74)*3.)-.5); re += vec3(.34,1.,.05)*smoothstep(.035,.0,v)*(.25+.5*pulse)*(.4+rim); }
  if(k>8.5&&k<9.5){ vec2 p=vec2(w.x+floor(w.y/.75)*.56,w.y)/vec2(1.5,.75); vec2 ci=floor(p), f=fract(p); float r=h(ci*1.3+3.);
    float gl=step(.72,r)*smoothstep(.05,.02,abs(abs(f.x-.5)-.12-.1*h(ci)))*step(.22,f.y)*step(f.y,.78)*step(.5,h(vec2(ci.x,floor(f.y*7.)+ci.y*9.)));
    re += vec3(.5,.75,1.)*gl*(.5+.6*sin(uTime*.6+r*30.))*1.6; }
  // wet ground: glints that come and go with the light and the eye, only where light reaches
  { float up=smoothstep(.2,.8,n.y)*rim; vec2 gc=floor(w*40.); float gh=h(gc), gt=pow(.5+.5*sin(uTime*(1.2+3.*gh)+gh*40.+uCam.x*1.7),8.);
    re += Ls*vec3(.9,1.,1.05)*step(.955,gh)*smoothstep(.4,.1,length(fract(w*40.)-.5))*gt*up*3.; ra *= 1.+.5*up*smoothstep(.45,.7,vn(w*vec2(.9,3.)+2.)); }
  // roots and threads of the forest reaching down through the soil
  if(k<1.5){ float rt=abs(vn(w*vec2(5.,1.3)+fb(w*.6)*4.)-.5); ra = mix(ra, ra*1.9+vec3(.004,.007,.006), smoothstep(.03,.0,rt)*smoothstep(.5,.1,sd)*.7); }
  // heat: a glow that sits in the rock and cools into a dark glassy crust; the cut edge runs molten
  { float crust=.55+.9*vn(w*7.+3.)*vn(w*15.); ra *= 1.-.62*scorch*(.4+.6*rim);
    re += Ls*vec3(.8,.9,1.)*scorch*rim*step(.9,h(floor(w*44.)))*smoothstep(.4,.1,length(fract(w*44.)-.5))*2.;
    re += vec3(2.3,.5,.055)*heat*heat*crust*(.22+1.5*rim*rim) + vec3(1.7,1.35,.7)*smoothstep(.85,1.6,heat)*rim*rim*2.2; }
  // air side
  vec3 aa2 = vec3(0.), ae = vec3(0.), skyc = vec3(0.);
  if(wall>.01){
    aa2 = rock(k, w+31.)*(k>6.5?.55:.42)*mix(1.,.6,clamp((uHorizon-w.y)/30.,0.,1.));
    aa2 *= .42+.58*smoothstep(0.,-.42,sd);
    ae += vec3(2.,.45,.05)*heat*.1*wall;
  }
  if(wall<.99){ vec2 bu=(w-uCam)*uPPM/uRes+.5; vec4 bk=texture2D(uBack,clamp(bu,0.,1.))*(1.-uSky.y); skyc = sk*(1.-bk.a) + bk.rgb + vec3(2.,.45,.05)*heat*.07; }      // the layers were drawn flat: they are read where this pixel would be on a flat world, so they bend with the ground
  if(w.y < ${LAVA_Y.toFixed(1)}){ float nz=fb(w*.3+vec2(uTime*.05,uTime*.02)); ae = vec3(1.8,.28,.04)*(.5+1.5*nz*nz)+vec3(1.5,1.,.3)*smoothstep(.62,.7,nz); aa2=vec3(0.); skyc=vec3(0.); }
  float fog = fb(w*.035+vec2(uTime*.012,uTime*.004)); vec3 Lf = min(L*.075, vec3(.3)); ae += (Lf+vec3(.002,.004,.005))*fog*fog*vec3(.07,.085,.09)*(wall>.5?.8:1.);
  // ground mist in the play plane: it pools low, drifts with the wind and takes the colour of whatever lights it
  { float ms=fb(vec2(w.x*.07-uTime*.035,w.y*.2+uTime*.008)), lo=exp(-max(0.,w.y-uHorizon+.5)*.3)*(1.-wall*.6);
    ae += (Lf*.5+uFog*.35)*ms*ms*lo*.3*smoothstep(.0,-.4,sd); }
  // the back wall is never black: what was cut open shows dark rock behind it even where no lamp reaches
  vec3 col = mix(mix(skyc, aa2*(L+vec3(.16,.18,.22)), wall) + ae, ra*Ls + re, solid);
  if(det<1.) col = mix(farCol(w,vV,sk), col, det);
  gl_FragColor = vec4(max(col,0.), 1.);
}`;

export const view = { mesh: null, haze: null };
export function initTerrain(scene) {
  heat.init();
  const dt = view.dTex = new THREE.DataTexture(dens, DW, DH, THREE.RedFormat, THREE.UnsignedByteType); dt.magFilter = dt.minFilter = THREE.LinearFilter;
  const mt = view.mTex = new THREE.DataTexture(mats, DW, DH, THREE.RedFormat, THREE.UnsignedByteType); mt.magFilter = mt.minFilter = THREE.NearestFilter; dt.needsUpdate = mt.needsUpdate = true;
  const u = view.u = { uDens: { value: dt }, uMat: { value: mt }, uLight: { value: light.lightTex }, uOrigin: { value: new THREE.Vector2() }, uCam: { value: new THREE.Vector2() }, uRes: { value: new THREE.Vector2(1, 1) }, uLO: { value: new THREE.Vector2() },
    uPPM: { value: 60 }, uTime: { value: 0 }, uHorizon: { value: 0 }, uBack: { value: null }, uHeat: { value: heat.tex }, uHO: { value: new THREE.Vector2() }, uPx: { value: new THREE.Vector2(1, 1) }, uFog: { value: new THREE.Vector3(0.012, 0.03, 0.035) }, uSky: { value: new THREE.Vector2(0, 0) }, uPl: { value: new THREE.Vector4(RAD, 0, 0, 1) }, uProf: { value: profileTex() } };
  const m = new THREE.ShaderMaterial({ uniforms: u, depthTest: false, depthWrite: false, fragmentShader: FRAG,
    vertexShader: 'uniform vec2 uRes; varying vec2 vV; void main(){ vV=position.xy*uRes*.5; gl_Position=vec4(position.xy,0.,1.); }' });
  view.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m); view.mesh.frustumCulled = false; view.mesh.renderOrder = 0; scene.add(view.mesh);
  // haze fan: vertex 0 at the lamp, one vertex per ray at its hit distance
  const g = new THREE.BufferGeometry(), pos = new Float32Array((RAYS + 1) * 3), fd = new Float32Array((RAYS + 1) * 3), idx = [];
  for (let i = 1; i < RAYS; i++) idx.push(0, i, i + 1);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('aF', new THREE.BufferAttribute(fd, 3).setUsage(THREE.DynamicDrawUsage)); g.setIndex(idx);
  view.hazeU = { uK: { value: 1 }, uTime: { value: 0 }, uBend: { value: new THREE.Vector2(1e6, 0) } };
  const hm = new THREE.ShaderMaterial({ uniforms: view.hazeU, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'attribute vec3 aF; varying vec3 vF; varying vec2 vP; uniform vec2 uBend; void main(){ vF=aF; vP=position.xy; vec2 p=position.xy; float th=p.x/uBend.x, rr=uBend.x+uBend.y+p.y; p=vec2(rr*sin(th), rr*cos(th)-uBend.x-uBend.y); gl_Position=projectionMatrix*vec4(p,0.,1.); }',
    fragmentShader: `precision highp float; varying vec3 vF; varying vec2 vP; uniform float uK, uTime;
      float h(vec2 p){ p=fract(p*vec2(443.897,441.423)); p+=dot(p,p.yx+19.19); return fract((p.x+p.y)*p.x); }
      float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
      void main(){ float uu=vF.y/max(vF.z,1e-4); float e=max(0.,1.-uu*uu); float d=vF.x; /* uu: the angle across the cone, constant along a ray, so the cone's edge is soft all the way out */ float n=.7+.6*vn(vP*.006+uTime*.04)*vn(vP*.017-uTime*.025);
        float a=pow(e,1.6)*pow(1.-d,1.7)*(.25+.75*smoothstep(0.,.05,d))*n*uK; gl_FragColor=vec4(vec3(1.,.9,.74)*a*.07,1.); }` });
  view.haze = new THREE.Mesh(g, hm); view.haze.frustumCulled = false; view.haze.renderOrder = 5; scene.add(view.haze);
}
// one texel per 2 m of circumference: ground height, biome, lushness, and what stands there
// (1 ruin, 2 hive, 3 human facility, 4 the hive's main base)
export function profileTex() {
  const a = new Float32Array(PN * 4), st = structsIn(-CIRC / 4, CIRC * 3 / 4);
  for (let i = 0; i < PN; i++) { const x = i * CIRC / PN; a[i * 4] = surfaceH(x); a[i * 4 + 1] = biome(x); a[i * 4 + 2] = lushness(x); }
  for (const q of st) { const k = q.main ? 4 : q.kind === 'hive' ? 2 : q.kind === 'ruin' ? 1 : 3, half = q.main ? 42 : q.kind === 'hive' ? 16 : 10; for (let x = q.x - half; x <= q.x + half; x += 2) a[((Math.round(x / 2) % PN + PN) % PN) * 4 + 3] = k + 0.9 * (1 - Math.abs(x - q.x) / half); }
  const t = new THREE.DataTexture(a, PN, 1, THREE.RGBAFormat, THREE.FloatType); t.magFilter = t.minFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
}
// heat left by the laser and by impacts goes into the heat field (heat.js)
export function heatAt(x, y, r, v) { heat.add(x, y, r, v); }
export function stepHeat(dt) { heat.step(dt); }
// camera in metres; ppm = pixels per metre
export function updateTerrain(cx, cy, ppm, time, horizon) {
  const u = view.u, ox = (Math.floor(cx / CELL / 8) * 8) - DW / 2, oy = (Math.floor(cy / CELL / 8) * 8) - DH / 2;
  if (ox !== view.ox || oy !== view.oy || world.rev !== view.rev) { view.ox = ox; view.oy = oy; view.rev = world.rev; world.window(ox, oy, DW, DH, dens, mats); view.dTex.needsUpdate = true; view.mTex.needsUpdate = true; }
  u.uOrigin.value.set(ox, oy); u.uCam.value.set(cx, cy); u.uSky.value.set(cx / RAD, S.far); u.uPl.value.set(RAD, S.far, S.lod, S.zo); view.hazeU.uBend.value.set(RAD * ppm, cy * ppm); u.uRes.value.set(G.w, G.h); u.uPPM.value = ppm; u.uTime.value = time; u.uHorizon.value = horizon; u.uLO.value.set(light.ox * TS, light.oy * TS);
  heat.upload(cx, cy); u.uHO.value.set(heat.ox * HC, heat.oy * HC); u.uPx.value.set(R.renderer.domElement.width, R.renderer.domElement.height);
  const L = light.lamp, g = view.haze.geometry, pos = g.attributes.position.array, fd = g.attributes.aF.array, half = 0.366;
  view.haze.visible = L.on; view.hazeU.uK.value = L.k; view.hazeU.uTime.value = time;
  pos[0] = (L.x * TS - cx) * ppm; pos[1] = (L.y * TS - cy) * ppm; fd[0] = 0; fd[1] = 0; fd[2] = 0;
  for (let r = 0; r < RAYS; r++) {
    const uu = (r / (RAYS - 1)) * 2 - 1, a = L.ang + uu * half, d = Math.min(light.rayD[r] + 0.6, 48) * TS;
    pos[(r + 1) * 3] = (L.x * TS + Math.cos(a) * d - cx) * ppm; pos[(r + 1) * 3 + 1] = (L.y * TS + Math.sin(a) * d - cy) * ppm; fd[(r + 1) * 3] = d / 24; fd[(r + 1) * 3 + 1] = uu; fd[(r + 1) * 3 + 2] = 1;
  }
  g.attributes.position.needsUpdate = true; g.attributes.aF.needsUpdate = true;
}

// the belt: sectors generated lazily as a pure function of (seed, ring, slot); asteroids as radial height maps that
// deform under the mining laser and eject chunks; collector, mining platform, depot refinery and shipyard, hauler drones.
import { THREE } from '../render.js';
import { events, hash, rand, clamp, TAU, angDiff } from '../core.js';
import { audio } from '../audio.js';
import { AU, MU_STAR, STAR, stateFromEl } from './orbit.js';
import { Sp, K, mul } from './state.js';
import { makeShip, BP, partWorld, PARTS } from './ship.js';

export const SEC = 0.05 * AU, R0 = 2.1 * AU, RINGS = 24, NS = 128;
const COMP = { rock: [0.2, 0.19, 0.18], iron: [0.26, 0.17, 0.12], ice: [0.36, 0.42, 0.5], lumen: [0.1, 0.24, 0.26] };
const ringN = ring => { const rc = R0 + (ring + 0.5) * SEC; return [Math.sqrt(MU_STAR / (rc * rc * rc)), Math.round(TAU * rc / SEC)]; };
export function sectorOf(x, y, t) { const r = Math.hypot(x, y), ring = Math.floor((r - R0) / SEC); if (ring < 0 || ring >= RINGS) return null; const [n, ns] = ringN(ring); const th = (((Math.atan2(y, x) - n * t) % TAU) + TAU) % TAU; return { ring, slot: Math.floor(th / TAU * ns), ns }; }
export function genSector(ring, slot) {       // pure: same seed, same rocks, on every machine
  const [, ns] = ringN(ring), s0 = ring * 7919 + slot, n = 1 + Math.floor(hash(s0, 1, 50) * 3), out = [];
  for (let i = 0; i < n; i++) {
    const h = k => hash(s0, i * 16 + k, 51), a = R0 + (ring + h(0)) * SEC, e = h(1) * 0.004, w = h(2) * TAU, th = (slot + h(3)) / ns * TAU, R = 70 + h(4) * h(4) * 330;
    const comp = h(5) < 0.5 ? 'rock' : h(5) < 0.75 ? 'iron' : h(5) < 0.9 ? 'ice' : 'lumen', r = new Float32Array(NS), ph = [h(6) * TAU, h(7) * TAU, h(8) * TAU, h(9) * TAU];
    for (let j = 0; j < NS; j++) { const q = j / NS * TAU; r[j] = R * (1 + 0.16 * Math.sin(2 * q + ph[0]) + 0.09 * Math.sin(3 * q + ph[1]) + 0.05 * Math.sin(5 * q + ph[2]) + 0.03 * Math.sin(9 * q + ph[3]) + 0.025 * (hash(s0 + j, i, 52) - 0.5)); }
    out.push({ id: `${ring}:${slot}:${i}`, el: { a, e, w, dir: 1, n: Math.sqrt(MU_STAR / (a * a * a)), M0: th - w, t0: 0, mu: MU_STAR }, R, r, comp, spin: (h(10) - 0.5) * 0.02, ang0: h(11) * TAU, mined: 0, hot: null, dirty: true, mesh: null, p: [0, 0], v: [0, 0], ang: 0, platform: null });
  }
  return out;
}
const AV = 'varying vec2 vP; void main(){ vP=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }';
const AF = `precision highp float; varying vec2 vP; uniform vec2 uSun; uniform vec3 uCol, uHot; uniform float uR, uAng;
float h(vec2 p){ p=fract(p*vec2(443.897,441.423)); p+=dot(p,p.yx+19.19); return fract((p.x+p.y)*p.x); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
float fb(vec2 p){ return vn(p)*.5+vn(p*2.03)*.25+vn(p*4.1)*.125+vn(p*8.3)*.0625; }
void main(){ vec2 q=vP/uR; float rr=min(length(q),1.); float c=cos(uAng), s=sin(uAng); vec2 sl=vec2(c*uSun.x+s*uSun.y,-s*uSun.x+c*uSun.y);
  float e=.02; float hgt=fb(q*5.), hx=fb(q*5.+vec2(e,0.))-hgt, hy=fb(q*5.+vec2(0.,e))-hgt; vec2 n=q*.9-vec2(hx,hy)/e*1.5;
  float lit=smoothstep(-.25,.8,dot(n,sl)+sqrt(1.-rr*rr)*.1);
  float cr=smoothstep(.5,.62,fb(q*9.+7.)); vec3 alb=uCol*(.4+.9*fb(q*14.))*(1.-.5*cr)*(.75+.5*h(floor(vP/.7)))*(.8+.4*fb(vP*.35));
  vec3 col=alb*mix(.008,1.25,lit);
  float hd=length(vP-uHot.xy); col+=vec3(3.,.9,.15)*uHot.z*exp(-hd*hd/40.)+vec3(1.2,.2,.03)*uHot.z*exp(-hd*hd/700.);
  gl_FragColor=vec4(col,1.); }`;
function makeMesh(a, scene) {
  const g = new THREE.BufferGeometry(), pos = new Float32Array((NS + 1) * 3), idx = []; for (let j = 0; j < NS; j++) idx.push(0, 1 + j, 1 + (j + 1) % NS);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setIndex(idx);
  a.u = { uSun: { value: new THREE.Vector2(1, 0) }, uCol: { value: new THREE.Vector3(...COMP[a.comp]) }, uHot: { value: new THREE.Vector3() }, uR: { value: a.R }, uAng: { value: 0 } };
  a.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: a.u, vertexShader: AV, fragmentShader: AF, depthTest: false, depthWrite: false })); a.mesh.frustumCulled = false; a.mesh.renderOrder = 4; scene.add(a.mesh);
}
const loaded = new Map(), tmp = [0, 0, 0, 0];
export const belt = { loaded, scene: null };
// keep the sector under the focus plus a one-sector margin (at most 9); a sector someone changed is kept
export function updateBelt(fx, fy, t) {
  const s = sectorOf(fx, fy, t), want = new Set();
  if (s) for (let dr = -1; dr <= 1; dr++) { const ring = s.ring + dr; if (ring < 0 || ring >= RINGS) continue; const [, ns] = ringN(ring), sl = Math.floor(s.slot / s.ns * ns); for (let ds = -1; ds <= 1; ds++) want.add(ring + ':' + ((sl + ds + ns) % ns)); }
  for (const k of want) if (!loaded.has(k)) { const [ring, slot] = k.split(':').map(Number); loaded.set(k, { asts: genSector(ring, slot), mod: false }); }
  for (const [k, sec] of loaded) if (!want.has(k) && !sec.mod) { for (const a of sec.asts) if (a.mesh) { belt.scene.remove(a.mesh); a.mesh.geometry.dispose(); a.mesh.material.dispose(); } loaded.delete(k); }
  Sp.asteroids.length = 0; for (const sec of loaded.values()) for (const a of sec.asts) { stateFromEl(a.el, t, tmp); a.p[0] = tmp[0]; a.p[1] = tmp[1]; a.v[0] = tmp[2]; a.v[1] = tmp[3]; a.ang = a.ang0 + a.spin * t; Sp.asteroids.push(a); }
}
export const touch = a => { for (const sec of loaded.values()) if (sec.asts.includes(a)) sec.mod = true; };
export function radiusAt(a, lx, ly) { const q = ((Math.atan2(ly, lx) - a.ang) % TAU + TAU) % TAU; return a.r[Math.round(q / TAU * NS) % NS]; }
// mining laser from body-frame point (ox, oy) along ang. Returns the hit distance or the range.
let chunkT = 0;
export function fireLaser(s, ox, oy, ang, dt) {
  const dx = Math.cos(ang), dy = Math.sin(ang), RANGE = 600; let hit = RANGE, ha = null;
  for (const a of Sp.asteroids) { const rx = ox - a.p[0], ry = oy - a.p[1], along = -(rx * dx + ry * dy), perp = Math.abs(rx * dy - ry * dx); if (perp > a.R * 1.4 || along < -a.R * 1.4 || along - a.R * 1.4 > hit) continue;
    for (let d = Math.max(0, along - a.R * 1.4); d < Math.min(hit, along + a.R * 1.4); d += 1.2) { const lx = rx + dx * d, ly = ry + dy * d; if (lx * lx + ly * ly < Math.pow(radiusAt(a, lx, ly), 2)) { hit = d; ha = a; break; } } }
  const hx = ox + dx * hit, hy = oy + dy * hit; s.beam = [ox - s.p[0], oy - s.p[1], hx - s.p[0], hy - s.p[1]]; s.lasing = true;
  if (ha) {
    const a = ha, lx = hx - a.p[0], ly = hy - a.p[1], q = ((Math.atan2(ly, lx) - a.ang) % TAU + TAU) % TAU, i0 = Math.round(q / TAU * NS), l = Math.hypot(lx, ly) || 1, nx = lx / l, ny = ly / l;
    for (let k = -4; k <= 4; k++) { const j = ((i0 + k) % NS + NS) % NS; a.r[j] = Math.max(a.R * 0.2, a.r[j] - 2.2 * dt * Math.exp(-k * k / 5)); }
    a.dirty = true; a.mined += dt; touch(a); const ca = Math.cos(-a.ang), sa = Math.sin(-a.ang); a.hot = { x: ca * lx - sa * ly, y: sa * lx + ca * ly, t: 1 };
    for (let i = 0; i < 2; i++) Sp.parts.spawn({ x: hx, y: hy, vx: a.v[0] + nx * rand(5, 40) + rand(-14, 14), vy: a.v[1] + ny * rand(5, 40) + rand(-14, 14), life: rand(0.3, 1.2), size: rand(0.15, 0.4), c: [4, 2, 0.6], c2: [0.8, 0.1, 0.02], grav: 0 });
    if (Math.random() < 0.3) Sp.parts.spawn({ x: hx, y: hy, vx: a.v[0] + nx * rand(2, 9) + rand(-3, 3), vy: a.v[1] + ny * rand(2, 9) + rand(-3, 3), life: rand(2, 5), size: rand(2, 5), grow: 3, c: [0.06, 0.055, 0.05], a: 0.5, grav: 0 });
    chunkT -= dt; if (chunkT <= 0 && Sp.chunks.length < 260) { chunkT = 0.16; const sp = rand(3, 11), tg = rand(-4, 4);
      Sp.chunks.push({ x: hx + nx, y: hy + ny, vx: a.v[0] + nx * sp - ny * tg, vy: a.v[1] + ny * sp + nx * tg, ang: rand(TAU), spin: rand(-3, 3), heat: 1, size: rand(0.5, 1.5), comp: a.comp, life: 300 }); events.emit('firstAsteroid'); }
  }
  return hit;
}
export function stepBelt(dt) {
  const me = Sp.me, w = [0, 0];
  for (const a of Sp.asteroids) { if (a.hot && (a.hot.t -= dt * 0.7) <= 0) a.hot = null; const pf = a.platform; if (pf) { pf.ore = Math.min(60, pf.ore + 0.45 * dt); const j = pf.j, q = a.ang + j / NS * TAU, r = a.r[j] + 2; pf.x = a.p[0] + Math.cos(q) * r; pf.y = a.p[1] + Math.sin(q) * r; pf.ang = q;
      if (Math.random() < 0.2) Sp.parts.spawn({ x: pf.x - Math.cos(q) * 3, y: pf.y - Math.sin(q) * 3, vx: a.v[0] + Math.cos(q + rand(-1, 1)) * rand(3, 14), vy: a.v[1] + Math.sin(q + rand(-1, 1)) * rand(3, 14), life: rand(0.3, 1), size: 0.25, c: [4, 2, 0.6], c2: [0.8, 0.1, 0.02], grav: 0 }); } }
  // chunks: free rigid bodies under the star's gravity, cooling; the collector field pulls them in under 30 m
  const C = Sp.chunks; let n = 0; const cargo = me && !me.dead ? me.parts.filter(p => p.type === 'cargo') : [];
  for (let i = 0; i < C.length; i++) {
    const c = C[i]; c.life -= dt; if (c.life <= 0) continue; const r = Math.hypot(c.x, c.y), g = -MU_STAR / (r * r * r); c.vx += g * c.x * dt; c.vy += g * c.y * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.ang += c.spin * dt; c.heat = Math.max(0, c.heat - dt / 7);
    let got = false;
    for (const p of cargo) { partWorld(me, p, w); const dx = w[0] - c.x, dy = w[1] - c.y, d = Math.hypot(dx, dy); if (d < 30 && me.ore < me.cargoCap) { const k = Math.exp(-2.5 * dt); c.vx = me.v[0] + (c.vx - me.v[0]) * k + dx / d * 22 * dt; c.vy = me.v[1] + (c.vy - me.v[1]) * k + dy / d * 22 * dt; if (d < 2.4) { me.ore++; got = true; audio.play('click'); } break; } }
    if (!got) C[n++] = c;
  }
  C.length = n;
  // depot: refinery, then the shipyard builds a hauler from the saved blueprint whenever the stock covers it
  const D = Sp.depot;
  if (D && !D.dead) {
    const r = Math.min(D.ore, 0.6 * dt); D.ore -= r; D.metal += r;
    const drones = Sp.ships.filter(s => s.drone && !s.dead);
    if (D.metal >= 14 && drones.length < 5 && D.platform) { D.metal -= 14; spawnDrone(D, D.platform); Sp.say(`depot shipyard built hauler-${Sp.ships.filter(s => s.drone).length} from blueprint`); }
    if (me && !me.dead && me.ore > 0 && Math.hypot(me.p[0] - D.p[0], me.p[1] - D.p[1]) < 120 && Math.hypot(me.v[0] - D.v[0], me.v[1] - D.v[1]) < 8) { const k = Math.min(me.ore, 8 * dt); me.ore -= k; D.ore += k; for (const p of me.parts) if (PARTS[p.type].fuel) p.fuel = Math.min(PARTS[p.type].fuel, p.fuel + dt * 0.2); }
  }
  for (const s of Sp.ships) if (s.drone && !s.dead && s.core) stepDrone(s, dt);
}
export function spawnDrone(D, pf) { const s = makeShip(BP.drone, { name: 'hauler', drone: { state: 'out', t: 0, load: 0, pf }, body: D.body, sas: true }); s.p = [D.p[0] + Math.cos(D.ang) * 12, D.p[1] + Math.sin(D.ang) * 12]; s.v = [D.v[0], D.v[1]]; s.ang = D.ang; Sp.ships.push(s); events.emit('firstDrone'); return s; }
// accelerate, coast, brake: accel-limited velocity control toward a moving dock point (Newtonian, through the engine)
export function flyTo(s, tx, ty, tvx, tvy, vmax, amax, stop = 0) {
  const dx = tx - s.p[0], dy = ty - s.p[1], dist = Math.hypot(dx, dy) || 1, rem = Math.max(0, dist - stop), sp = Math.min(vmax, Math.sqrt(2 * amax * 0.55 * rem));
  let ax = (dx / dist * sp - (s.v[0] - tvx)) * 1.4, ay = (dy / dist * sp - (s.v[1] - tvy)) * 1.4; const a = Math.hypot(ax, ay);
  if (a > amax) { ax *= amax / a; ay *= amax / a; }
  s.ext = [ax * s.m, ay * s.m]; s.vis = Math.min(1, a / amax); if (a > amax * 0.15) s.hold = Math.atan2(ay, ax); return dist;
}
function stepDrone(s, dt) {
  const d = s.drone, D = Sp.depot, pf = d.pf; if (!D || D.dead) { s.ext = null; s.vis = 0; return; }
  if (d.state === 'out') { const q = pf.ang, dist = flyTo(s, pf.x + Math.cos(q) * 9, pf.y + Math.sin(q) * 9, pf.a.v[0], pf.a.v[1], 42, 3); d.tx = pf.x; d.ty = pf.y; if (dist < 5) { d.state = 'load'; d.t = 3; } }
  else if (d.state === 'load') { flyTo(s, pf.x + Math.cos(pf.ang) * 9, pf.y + Math.sin(pf.ang) * 9, pf.a.v[0], pf.a.v[1], 42, 3); if ((d.t -= dt) <= 0) { d.load = Math.min(10, pf.ore); pf.ore -= d.load; d.state = 'back'; } }
  else if (d.state === 'back') { const dist = flyTo(s, D.p[0] + Math.cos(D.ang) * 13, D.p[1] + Math.sin(D.ang) * 13, D.v[0], D.v[1], 42, 3); d.tx = D.p[0]; d.ty = D.p[1]; if (dist < 5) { d.state = 'unload'; d.t = 2; } }
  else { flyTo(s, D.p[0] + Math.cos(D.ang) * 13, D.p[1] + Math.sin(D.ang) * 13, D.v[0], D.v[1], 42, 3); if ((d.t -= dt) <= 0) { D.ore += d.load; d.load = 0; d.state = 'out'; } }
}
// draw asteroids (mesh when large, a lit ball when small), platforms, chunks. (ox, oy) = absolute origin of the belt frame (the star: 0, 0)
export function drawBelt(b, cx, cy, scale, time, sun) {
  for (const a of Sp.asteroids) {
    if (!a.mesh) makeMesh(a, belt.scene);
    const x = (a.p[0] - cx) / scale, y = (a.p[1] - cy) / scale, rp = a.R / scale, vis = rp > 3 && Math.abs(x) < 3e6 && Math.abs(y) < 3e6;
    a.mesh.visible = vis;
    if (!vis) { if (Math.abs(x) < 4000 && Math.abs(y) < 4000) b.px(x, y, Math.max(3, rp * 2), Math.max(3, rp * 2), 0, mul(COMP[a.comp], 2.5), 1, 5, 0); continue; }
    if (a.dirty) { const pos = a.mesh.geometry.attributes.position.array; for (let j = 0; j < NS; j++) { const q = j / NS * TAU; pos[(j + 1) * 3] = Math.cos(q) * a.r[j]; pos[(j + 1) * 3 + 1] = Math.sin(q) * a.r[j]; } a.mesh.geometry.attributes.position.needsUpdate = true; a.dirty = false; }
    a.mesh.position.set(x, y, 0); a.mesh.scale.setScalar(1 / scale); a.mesh.rotation.z = a.ang; a.u.uSun.value.set(sun[0], sun[1]); a.u.uAng.value = a.ang; a.u.uHot.value.set(a.hot ? a.hot.x : 0, a.hot ? a.hot.y : 0, a.hot ? a.hot.t : 0);
    const pf = a.platform;
    if (pf) { const c = Math.cos(pf.ang), s = Math.sin(pf.ang), at = (ox, oy, w, h, col, sh = 3, md = 0, al = 1) => b.add(pf.x + c * ox - s * oy, pf.y + s * ox + c * oy, w, h, pf.ang, col, al, sh, md, ox * 3 + oy);
      at(0, 0, 3, 9, mul(K.hull, 0.8)); at(2.2, -2.5, 2.2, 3, mul(K.hull, 0.65)); at(2.2, 2.5, 2.2, 3, mul(K.steel, 1)); at(-3, 0, 5, 1, K.dark); at(3.6, 2.5, 0.4, 0.4, mul(K.amber, 4), 1, 2); at(-5.5, 0, 3, 3, [3, 1.2, 0.3], 1, 2, 0.6 + 0.4 * Math.sin(time * 20));
      for (let i = 0; i < 5; i++) at(2.2, -3.6 + i * 0.55, 1.6, 0.3, mul(K.cyan, i < pf.ore / 12 ? 1.6 : 0.1), 0, 2); }
  }
  for (const c of Sp.chunks) { const col = COMP[c.comp], hh = c.heat * c.heat; b.add(c.x, c.y, c.size * 1.6, c.size * 1.25, c.ang, [col[0] * 1.6 + hh * 5, col[1] * 1.6 + hh * 1.6, col[2] * 1.6 + hh * 0.3], 1, hh > 0.3 ? 2 : 5, hh > 0.3 ? 2 : 0, c.size * 9); if (hh > 0.05) b.add(c.x, c.y, c.size * 6, c.size * 6, 0, [2.5, 0.7, 0.1], hh * 0.5, 1, 2); }
}

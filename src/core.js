// core: the one global G, events, input, deterministic hashing and noise.
const q = new URLSearchParams(location.search);
export const G = {
  seed: (parseInt(q.get('seed') || '7', 10) | 0) || 7,
  act: q.get('act') === 'space' ? 'space' : 'surface',
  scenario: q.get('scenario') || '',
  auto: q.get('auto') === '1', test: q.get('test') === '1', prewarm: parseFloat(q.get('t') || '0') || 0,
  time: 0, real: 0, frame: 0, paused: false,
  playerId: 'local-player', // demo 1: local id. Final architecture: the ce-net identity that owns the ships.
  w: 1, h: 1, shake: 0, exposure: 1,
};

const handlers = {};
export const events = {
  on(n, f) { (handlers[n] || (handlers[n] = [])).push(f); },
  emit(n, d) { (handlers[n] || []).forEach(f => f(d)); (handlers['*'] || []).forEach(f => f(n, d)); },
};

export const input = {
  keys: new Set(), pressed: new Set(), mx: 0, my: 0, down: [false, false, false], clicked: [false, false, false], wheel: 0, dbl: false,
  key(k) { return this.keys.has(k); }, hit(k) { return this.pressed.has(k); },
  endFrame() { this.pressed.clear(); this.wheel = 0; this.clicked = [false, false, false]; this.dbl = false; },
};
export function initInput(el) {
  addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (!input.keys.has(k)) input.pressed.add(k);
    input.keys.add(k);
    if (['Tab', 'F1', ' '].includes(e.key)) e.preventDefault();
    events.emit('gesture');
  });
  addEventListener('keyup', e => { input.keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key); });
  addEventListener('blur', () => { input.keys.clear(); input.down = [false, false, false]; });
  addEventListener('mousemove', e => { input.mx = e.clientX; input.my = e.clientY; });
  el.addEventListener('mousedown', e => { input.down[e.button] = true; input.clicked[e.button] = true; events.emit('gesture'); });
  addEventListener('mouseup', e => { input.down[e.button] = false; });
  addEventListener('dblclick', () => { input.dbl = true; });
  addEventListener('contextmenu', e => e.preventDefault());
  addEventListener('wheel', e => { input.wheel += e.deltaY; }, { passive: true });
}

// integer hash -> [0,1); pure, so the same seed gives the same world on every machine
export function hash(x, y = 0, s = 0) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul((s | 0) + G.seed * 7919, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245); h ^= h >>> 16; h = Math.imul(h, 2246822519); h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const sm = t => t * t * (3 - 2 * t);
export function noise2(x, y, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = sm(x - xi), fy = sm(y - yi);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
export function fbm(x, y, s = 0, oct = 4) { let v = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { v += a * noise2(x * f, y * f, s + i * 17); a *= 0.5; f *= 2; } return v / (1 - a * 2 > 0 ? 1 - a * 2 : 1); }
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
export const TAU = Math.PI * 2;
export function angDiff(a, b) { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }
export const hex = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];

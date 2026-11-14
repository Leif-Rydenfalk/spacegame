// the world's noise and pollution. Noise is an event with a level in metres of audible radius that fades in seconds.
// Pollution accumulates in 8 m cells, spreads to the neighbours and decays slowly. The hivemind reads both.
const CW = 8, key = (i, j) => (i + 32768) * 65536 + (j + 32768);
export const env = {
  events: [], poll: new Map(), mine: 0, tick: 0,
  // level = radius in metres at which it is still heard. own = made by the player (for the HUD readout)
  noise(x, y, level, own = true) {
    if (own && level > this.mine) this.mine = level;
    for (const e of this.events) if (Math.abs(e.x - x) < 3 && Math.abs(e.y - y) < 3) { if (level * 1 >= e.l * e.t) { e.l = level; e.t = 1; e.x = x; e.y = y; } return; }
    if (this.events.length > 40) this.events.shift(); this.events.push({ x, y, l: level, t: 1 });
  },
  // the loudest thing heard at a point: { x, y, v } with v metres of margin, or null
  heard(x, y, sens = 1) { let best = null, bv = 0; for (const e of this.events) { const v = e.l * e.t * sens - Math.hypot(e.x - x, e.y - y); if (v > bv) { bv = v; best = e; } } return best ? { x: best.x, y: best.y, v: bv } : null; },
  pollute(x, y, a) { const k = key(Math.floor(x / CW), Math.floor(y / CW)); this.poll.set(k, (this.poll.get(k) || 0) + a); },
  pollAt(x, y) { return this.poll.get(key(Math.floor(x / CW), Math.floor(y / CW))) || 0; },
  pollAround(x, y, r) { let s = 0; const n = Math.ceil(r / CW); for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) s += this.poll.get(key(Math.floor(x / CW) + i, Math.floor(y / CW) + j)) || 0; return s; },
  total() { let s = 0; for (const v of this.poll.values()) s += v; return s; },
  step(dt) {
    this.mine = Math.max(0, this.mine - dt * (4 + this.mine * 0.5));
    for (let i = this.events.length - 1; i >= 0; i--) if ((this.events[i].t -= dt / 3) <= 0) this.events.splice(i, 1);
    this.tick += dt; if (this.tick < 1) return; this.tick -= 1;
    const add = new Map();
    for (const [k, v] of this.poll) { if (v < 0.02) { this.poll.delete(k); continue; } const g = v * 0.012; this.poll.set(k, v * 0.9985 - g * 4); for (const d of [1, -1, 65536, -65536]) add.set(k + d, (add.get(k + d) || 0) + g); }
    for (const [k, v] of add) this.poll.set(k, (this.poll.get(k) || 0) + v);
  },
  dump() { return { poll: [...this.poll].map(([k, v]) => [k, +v.toFixed(3)]) }; },
  load(o) { this.poll = new Map(o && o.poll || []); this.events.length = 0; this.mine = 0; },
};

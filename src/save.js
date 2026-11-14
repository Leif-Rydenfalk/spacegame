// save and load. One module, one adapter interface: { load(slot), save(slot, blob), list() }, all returning promises.
// The default adapter is IndexedDB with a localStorage fallback (and a synchronous localStorage copy when the page is
// being hidden, because an IndexedDB write may not finish then). A ce-net state.store adapter tied to the player's
// identity can replace it later with save.use(adapter): nothing else in the game touches storage.
// A blob is { version, rev, savedAt, hash, data }. data = { seed, act, time, playerId, parts: { name: dump } }.
import { G } from './core.js';
export const VERSION = 6;
// version n -> n + 1. Version 1 was demo 1, which had no saves. Version 3 (round 3) added the kit (ship laser and
// reactor instead of the laser drill item), loose matter, the ship hold and the stock targets: a version 2 save gets
// the kit on the player's back, an empty hold, and no loose matter. Its rifle and shotgun stay in the pack.
const MIGRATE = { 1: b => { b.version = 2; return b; }, 2: b => { b.version = 3; const s = b.data && b.data.parts && b.data.parts.surface;
  if (s && !s.kit) { s.kit = { r: ['carried', 0, 0], l: ['held', 0, 0, 0, +(s.p && s.p.heat) || 0], hold: new Array(24).fill(0), pend: {}, awake: 0 }; s.matter = []; s.supply = null; s.inv = (s.inv || []).map(q => q && q[0] === 'laser drill' ? 0 : q); }
  return b; },
  // version 4 (round 4): the world is a round planet. A flat round 3 save maps straight onto it: x was metres from the
  // crash site and still is, now along the circumference (anything beyond half of it wraps round); edited terrain
  // chunks are folded onto the circle when they load; the build queue gets its order, the AI its routes.
  3: b => { b.version = 4; const s = b.data && b.data.parts && b.data.parts.surface; if (s && s.auto === undefined) s.auto = { on: 1, st: [] }; return b; },
  // version 5 (round 5): decks (the passable layer), the list of items the base has seen (it decides which recipes are
  // shown), loose bodies with a shape and a pose, and Tab's blueprint mode in place of the old one. A version 4 save
  // has no decks; it has seen what it holds (the suit, the hold, chests, machines); its loose bodies get a shape when
  // they load (matter.js) and lie where they lay; a game saved in the old blueprint mode comes back in the normal one,
  // its queued ghosts untouched.
  4: b => { b.version = 5; const s = b.data && b.data.parts && b.data.parts.surface; if (!s) return b;
    if (!s.plats) s.plats = [];
    if (!s.known) { const k = new Set(), add = a => { for (const q of a || []) if (q) k.add(q[0]); }; add(s.inv); add(s.kit && s.kit.hold); for (const m of (s.factory && s.factory.m) || []) { add(m.inv); for (const id in m.i || {}) k.add(id); for (const id in m.o || {}) k.add(id); k.add(m.k); } for (const q of s.matter || []) k.add(q[0]); s.known = [...k].sort(); }
    if (s.mode === 'blueprint') s.mode = 'build';
    return b; },
  // version 6 (round 6): the exosuit is an object of its own (a version 5 player was in it: it is on, whole, and the AI is
  // up), the wreck is a list of parts (all still in it), the mine, the geology that has been measured (nothing: what a
  // version 5 game dug it dug without a scanner, so the crash site counts as scanned from the cuts that were made
  // there), the sensors' data, the stockpile zones (the AI opens them when it next tidies). Robots keep their place and
  // their load and get the new battery; a kit weighs what went into it now, so nothing in a slot changes but its mass.
  // Items and recipes that are gone are dropped where they are named (a stock target, a fabricator job).
  5: b => { b.version = 6; const s = b.data && b.data.parts && b.data.parts.surface; if (!s) return b;
    s.suit = { on: 1, id: 'exo-0001', cond: 1, slots: {}, wear: {}, pin: 0, hist: [[0, 'carried over from a round 5 save']], water: 0, boot: 1, needs: [0.8, 0.75, 0.85, 0.25], edible: {} };
    s.wreck = null; s.mine = null; s.fog = null; s.stock = null; s.stage = 2; s.dev = 0;
    const k = []; for (let x = -30; x < 30; x++) for (let y = -12; y < 8; y++) k.push([(x + 8192) * 16384 + y + 8192, 1]); s.geo = { k, s: 1, a: 0 };
    if (s.supply && s.supply.t) { delete s.supply.t['power cell']; delete s.supply.t['o2 cell']; }
    for (const r of s.robots || []) r.wh = r.k ? 400 : 250;
    return b; } };
const parts = {};
export function fnv(str) { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16).padStart(8, '0'); }

function idb() { return new Promise((res, rej) => { const r = indexedDB.open('spacegame', 1); r.onupgradeneeded = () => r.result.createObjectStore('saves'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
const tx = (mode, f) => idb().then(db => new Promise((res, rej) => { const q = f(db.transaction('saves', mode).objectStore('saves')); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }));
export const idbAdapter = { load: slot => tx('readonly', s => s.get(slot)).then(v => v || null), save: (slot, blob) => tx('readwrite', s => s.put(blob, slot)), list: () => tx('readonly', s => s.getAllKeys()) };
const LK = 'spacegame:';
export const lsAdapter = {
  async load(slot) { const s = localStorage.getItem(LK + slot); return s ? JSON.parse(s) : null; },
  async save(slot, blob) { localStorage.setItem(LK + slot, JSON.stringify(blob)); },
  async list() { return Object.keys(localStorage).filter(k => k.startsWith(LK)).map(k => k.slice(LK.length)); },
};
export const memAdapter = () => { const m = new Map(); return { async load(s) { return m.has(s) ? JSON.parse(m.get(s)) : null; }, async save(s, b) { m.set(s, JSON.stringify(b)); }, async list() { return [...m.keys()]; } }; };
// IndexedDB first, localStorage when it is missing or refuses; on load the newer of the two wins
export const localAdapter = {
  async load(slot) { let a = null, b = null; try { a = await idbAdapter.load(slot); } catch (e) { /* no IndexedDB */ } try { b = await lsAdapter.load(slot); } catch (e) { /* no localStorage */ } return !a ? b : !b ? a : (b.rev || 0) > (a.rev || 0) ? b : a; },
  async save(slot, blob) { try { await idbAdapter.save(slot, blob); try { localStorage.removeItem(LK + slot); } catch (e) { /* ignore */ } } catch (e) { await lsAdapter.save(slot, blob); } },
  async list() { const out = new Set(); try { for (const k of await idbAdapter.list()) out.add(k); } catch (e) { /* ignore */ } try { for (const k of await lsAdapter.list()) out.add(k); } catch (e) { /* ignore */ } return [...out]; },
};
export const save = {
  adapter: localAdapter, slot: null, rev: 0, last: 0, chain: null, status: '',
  use(a) { this.adapter = a; },
  // a game unit registers { dump(), load(o) }; load order is registration order
  register(name, unit) { parts[name] = unit; },
  collect() { const data = { seed: G.seed, act: G.act, time: +G.time.toFixed(3), playerId: G.playerId, parts: {} }; for (const k in parts) data.parts[k] = parts[k].dump(); return data; },
  hash(data) { return fnv(JSON.stringify(data)); },
  blob() { const data = this.collect(); return { version: VERSION, rev: ++this.rev, savedAt: Date.now(), hash: this.hash(data), data }; },
  migrate(b) { while (b.version < VERSION) { const f = MIGRATE[b.version]; if (!f) throw new Error('no migration from save version ' + b.version); b = f(b); } if (b.version > VERSION) throw new Error('save is from a newer version'); return b; },
  // put a blob's data into the running game
  apply(b) { b = this.migrate(b); const d = b.data; G.seed = d.seed; G.time = d.time; G.playerId = d.playerId || G.playerId; this.rev = b.rev || 0; for (const k in parts) if (d.parts[k] !== undefined) parts[k].load(d.parts[k]); return d; },
  // writes are queued, so two callers never interleave and each gets the blob it wrote
  write(slot = this.slot) {
    if (!slot) return Promise.resolve(null);
    const run = async () => { try { const b = this.blob(); await this.adapter.save(slot, b); this.last = performance.now(); this.status = 'saved'; return b; } catch (e) { this.status = 'save failed: ' + e.message; console.warn(this.status); return null; } };
    return (this.chain = (this.chain || Promise.resolve()).then(run));
  },
  // the page is going away: one synchronous copy to localStorage, then the normal write
  flush() { if (!this.slot) return; try { const b = this.blob(); try { localStorage.setItem(LK + this.slot, JSON.stringify(b)); } catch (e) { /* too large for localStorage: IndexedDB below still tries */ } this.adapter.save(this.slot, b).catch(() => {}); } catch (e) { console.warn('flush failed', e); } },
  async read(slot) { try { const b = await this.adapter.load(slot); return b ? this.migrate(b) : null; } catch (e) { console.warn('load failed', e); return null; } },
  tick(now) { if (this.slot && now - this.last > 30000) { this.last = now; this.write(); } },
  exportFile() { const b = this.blob(), a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(b)], { type: 'application/json' })); a.download = `spacegame-save-${new Date(b.savedAt).toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); },
  async importFile(file, slot = 'main') { const b = this.migrate(JSON.parse(await file.text())); if (!b.data || !b.data.parts) throw new Error('not a spacegame save'); b.rev = Date.now(); await this.adapter.save(slot, b); return b; },
};

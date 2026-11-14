// the task market (round 6 O): one place where every job is priced and every robot bids. Pure: no world, no state.
// A job has a value (its class of priority, raised by urgency) and, for each robot, a cost: the seconds it would take
// (distance over the speed that robot has with that load), the charge it would use, the risk on the way. The robots'
// bids are value minus cost; the best bid wins, then the next, and nothing is given twice: a job to one robot (or to
// one team, when the load is more than one drone lifts), a robot to one job. A bid that cannot be made has a reason
// (too heavy, no power, no way, no link, danger), and a job nobody can bid on is returned with the reason that stood
// in the way, so it is shown and retried another way instead of waiting in silence.
// jobs: [{ key, kind, x, y, value, kg, who: 'drone' | 'crawler' | undefined, team: bool (drones may share the load) }]
// bots: [{ id, kind: 'drone' | 'crawler', x, y, wh, whMax, free }]
// ctx: { cap(bot) kg, speed(bot, kg, n) m/s, power(bot, kg) W, reach(bot, job) -> null or a reason (asked late: it is the
//        dear one), danger(job) 0..1, fit(bot, job) -> null or a reason (cheap) }
export const VALUE = { support: 1000, rescue: 900, build: 600, order: 520, feed: 420, output: 320, mine: 260, salvage: 240, clear: 230, tidy: 150, spoil: 110, repair: 200 };
export function auction(bots, jobs, ctx) {
  const pairs = [], why = new Map(), note = (j, w) => { const m = why.get(j) || {}; m[w] = (m[w] || 0) + 1; why.set(j, m); };
  for (const j of jobs) for (const b of bots) {
    if (!b.free) continue; if (j.who && j.who !== b.kind) { note(j, j.who === 'crawler' ? 'needs the hauler' : 'needs a drone'); continue; }
    const f = ctx.fit ? ctx.fit(b, j) : null; if (f) { note(j, f); continue; }
    const cap = j.cap || ctx.cap(b), kg = j.kg || 0, n = kg > cap + 1e-6 ? (b.kind === 'drone' && j.team ? Math.ceil(kg / cap - 1e-9) : 0) : 1; if (!n) { note(j, 'too heavy'); continue; }
    const d = Math.hypot(j.x - b.x, j.y - b.y) + (j.d2 || 0), v = ctx.speed(b, kg, n); if (!(v > 0.05)) { note(j, 'too heavy'); continue; }
    const t = d / v + 4, wh = ctx.power(b, kg / n) * t / 3600; if (wh > b.wh * 0.85) { note(j, b.wh < b.whMax * 0.6 ? 'no power: charging first' : 'too far for one charge'); continue; }
    const risk = ctx.danger ? ctx.danger(j, b) : 0; if (risk >= 1 && j.kind !== 'rescue' && j.kind !== 'support') { note(j, 'danger: waits for cover'); continue; }
    pairs.push({ b, j, n, cost: t + wh * 0.2 + risk * 60, bid: j.value - (t + wh * 0.2 + risk * 60) });
  }
  pairs.sort((a, c) => c.bid - a.bid);
  const assign = [], jobTaken = new Set(), botTaken = new Set(), holds = [], holding = new Set();
  for (const p of pairs) {
    if (jobTaken.has(p.j) || botTaken.has(p.b)) continue; let helpers = [];
    if (p.n > 1) {      // a team: the nearest free drones that are not taken yet
      helpers = bots.filter(q => q !== p.b && q.kind === 'drone' && q.free && !botTaken.has(q) && !(ctx.fit && ctx.fit(q, p.j))).sort((a, c) => Math.hypot(a.x - p.b.x, a.y - p.b.y) - Math.hypot(c.x - p.b.x, c.y - p.b.y)).slice(0, p.n - 1);
      if (helpers.length < p.n - 1) {
        // not enough free hands yet. If the drones exist, this one waits for the next to come free (or no team would ever
        // form while each is busy in turn); if they do not exist, the job is too heavy and says so
        if (bots.filter(q => q.kind === 'drone').length >= p.n && !holding.has(p.j)) { holding.add(p.j); botTaken.add(p.b); for (const h of helpers) botTaken.add(h); holds.push({ bot: p.b, job: p.j, helpers }); note(p.j, `waits for ${p.n} drones to share ${(p.j.kg || 0).toFixed(0)} kg`); }
        else note(p.j, `too heavy: ${(p.j.kg || 0).toFixed(0)} kg needs ${p.n} drones`); continue; }
    }
    const r = ctx.reach ? ctx.reach(p.b, p.j) : null; if (r) { note(p.j, r); continue; }
    jobTaken.add(p.j); botTaken.add(p.b); for (const h of helpers) botTaken.add(h); assign.push({ bot: p.b, job: p.j, helpers, cost: p.cost, bid: p.bid });
  }
  const fails = []; for (const j of jobs) if (!jobTaken.has(j)) { const m = why.get(j); let best = 'every robot is busy', bn = 0; if (m) for (const k in m) if (m[k] > bn || (m[k] === bn && k !== 'every robot is busy')) { bn = m[k]; best = k; } fails.push({ job: j, why: best }); }
  return { assign, fails, holds };
}
// batching: the stops of one trip. Given what a robot can still carry and the open pickups of the same thing going the
// same way, take the ones nearest the route first, nearest neighbour from the first stop. Returns the chosen pickups.
export function batch(first, others, room, maxDetour = 5) {
  const out = []; let x = first.x, y = first.y, left = room - first.kg;
  const pool = others.filter(o => o !== first && o.item === first.item && o.dst === first.dst);
  while (left > 0.5 && pool.length) { let bi = -1, bd = maxDetour; for (let i = 0; i < pool.length; i++) { const d = Math.hypot(pool[i].x - x, pool[i].y - y); if (d < bd && pool[i].kg <= left + 1e-9) { bd = d; bi = i; } } if (bi < 0) break; const o = pool.splice(bi, 1)[0]; out.push(o); x = o.x; y = o.y; left -= o.kg; }
  return out;
}
// the decisions, kept short and shown (the AI window, and one line on the HUD)
export const LOG = { lines: [], say(t, time = 0) { const l = this.lines; if (l.length && l[l.length - 1].t === t) { l[l.length - 1].n++; return; } l.push({ t, at: time, n: 1 }); if (l.length > 40) l.shift(); } };

// power and network: pure functions, no world, so the tests drive them directly.
// Power is physical: the ship's reactor is the only source that can run the ship laser. It reaches devices through a
// cable (CABLE metres) from wherever it is: in the wreck, on your back, or set down. The suit's own bus gives 0.4 kW:
// enough for the lamp and the arm's matter compiler, not for the laser. Data is physical too: a device takes orders
// from a computer only inside the range of an antenna, and rock in the way halves that range.
export const REACTOR_W = 25000, LASER_W = 18000, SUIT_BUS_W = 400, CHARGE_W = 3000, CABLE = 7, MIN_FRAC = 0.6;
export const REACTOR_KG = 140, LASER_KG = 38, BODY_KG = 110, ANT_RANGE = 70, SHIP_LINK = 9, TURRET_RANGE = 17;
// sources [{ id, w }], loads [{ id, w, from: [source ids it can reach] }] in priority order.
// Each load takes what it needs from the sources it reaches, first come first served.
// Returns { supply, demand, used, served: { loadId: fraction 0..1 }, left: { sourceId: watts } }
export function powerBudget(sources, loads) {
  const left = {}, served = {}; let supply = 0, demand = 0, used = 0;
  for (const s of sources) { left[s.id] = (left[s.id] || 0) + s.w; supply += s.w; }
  for (const l of loads) { let need = l.w; demand += l.w; for (const id of l.from) { const k = Math.min(need, left[id] || 0); if (k > 0) { left[id] -= k; need -= k; } } served[l.id] = l.w > 0 ? (l.w - need) / l.w : 1; used += l.w - need; }
  return { supply, demand, used, served, left };
}
// is the device at (x, y) inside the network? antennas [{ x, y, range }]; blocked(ax, ay, bx, by) -> true when rock is in
// the way. Returns the antenna that reaches it, or null.
export function linked(x, y, antennas, blocked) {
  for (const a of antennas) { const d = Math.hypot(a.x - x, a.y - y); if (d <= a.range * 0.5 || (d <= a.range && !(blocked && blocked(a.x, a.y, x, y)))) return a; }
  return null;
}
// how a body of BODY_KG moves with a load on it: top speed, jump speed, jet acceleration, ground acceleration.
// With the reactor and the laser (178 kg) the jet no longer beats gravity: it only slows the fall.
export function mobility(load) {
  const m = BODY_KG / (BODY_KG + load), k = Math.min(1, load / 300);
  return { speed: 6.5 * (1 - 0.45 * k), sprint: 8.5 * (1 - 0.5 * k), jump: 4.6 * Math.sqrt(m) * (1 - 0.12 * k), jet: 14 * m, acc: 24 * (0.35 + 0.65 * m), k };
}

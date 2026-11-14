// real numbers (round 6, docs/LASER-ENERGY.md and docs/ROUND6.md A, E, H, I). Pure: no world, no state, so the tests
// drive every formula here directly. Everything that digs, burns, hits, flies, builds or carries takes its figure
// from this file; nothing in the game holds a rate that is not derived from an energy, a mass or a power below.
import { SLAB, M } from './gen.js';

// ---- the reactor and the laser ----------------------------------------------------------------------------------------
// The 140 kg unit is the ship's auxiliary reactor: 2.0 MW electric, 0.5 MW of waste heat. On your back it has no fins
// in free air and throttles to what the pack can shed; set down on its fins (or in its bay) it gives all of it.
export const REACTOR = { w: 2.0e6, wasteW: 0.5e6, kg: 140, backFrac: 0.3 };
// The ship laser: 1.5 MW in, 600 kW of beam (40 %), 80 % of the beam absorbed by rock. The other 900 kW is heat in the
// laser. Off the ship it has no cooling loop, so it fires in 50 ms pulses into its own 38 kg copper sink.
export const LASERP = { inW: 1.5e6, beamW: 6.0e5, absorb: 0.8, pulseS: 0.05, hz: 10, kg: 38, sinkC: 385, sinkDT: 150, passiveW: 50 * 0.5 * 150, waterJ: 2.6e6, packL: 5, loopW: 4.6e5, kerf: 0.02 };
export const SINK_J = LASERP.kg * LASERP.sinkC * LASERP.sinkDT;             // 2.19 MJ before the optics suffer
export const PULSE_BEAM_J = LASERP.beamW * LASERP.pulseS;                    // 30 kJ on target
export const PULSE_HEAT_J = (LASERP.inW - LASERP.beamW) * LASERP.pulseS;     // 45 kJ into the sink
export const PULSE_IN_J = LASERP.inW * LASERP.pulseS;                        // 75 kJ from the reactor
export const pulsesToFull = (j0 = 0) => Math.floor((SINK_J - j0) / PULSE_HEAT_J);          // about 48 from cold
export const passivePulseEvery = () => PULSE_HEAT_J / LASERP.passiveW;                     // about 12 s a pulse on air alone
export const waterPulses = litres => Math.floor(litres * LASERP.waterJ / PULSE_HEAT_J);    // 5 L is about 289 more
// one cooling step. sink J, water L, loop = a coolant line to fins (the cable to a set-down reactor, the wreck's
// hardpoint). Passive air cooling always; the loop when there is one; water boils off only above 60 % so a quiet sink
// keeps its water. Returns [sinkJ, waterL].
export function coolSink(j, water, dt, loop) {
  j = Math.max(0, j - (LASERP.passiveW + (loop ? LASERP.loopW : 0)) * dt);
  if (water > 0 && j > SINK_J * 0.6) { const boil = Math.min(water, (j - SINK_J * 0.6) / LASERP.waterJ, 0.35 * dt); j -= boil * LASERP.waterJ; water -= boil; }
  return [j, water];
}
// ---- breaking rock ----------------------------------------------------------------------------------------------------
// melt: e = rho (c dT + L_f), times k_loss for the heat conducted away. spall: short pulses crack rock by thermal shock
// at a fraction of that (docs/MINING.md section 3: 500-1,000 MJ/m3 for hard rock; soil is blown out by steam).
export const K_LOSS = 1.4;
export const ROCKP = {
  [M.SOIL]: { rho: 1500, melt: 0.45e9, spall: 0.32e9, steam: 1 },
  [M.BASALT]: { rho: 2900, c: 840, dT: 1200, L: 4.0e5, spall: 0.75e9 },
  [M.OBSIDIAN]: { rho: 2500, c: 800, dT: 1100, L: 3.5e5, spall: 0.4e9 },
  [M.IRON]: { rho: 5000, c: 650, dT: 1565, L: 4.0e5, spall: 1.1e9 },
  [M.COPPER]: { rho: 4200, c: 700, dT: 1300, L: 3.5e5, spall: 0.95e9 },
  [M.LUMEN]: { rho: 2100, c: 800, dT: 900, L: 3.0e5, spall: 0.35e9 },
  [M.PLATE]: { rho: 2400, c: 500, dT: 1500, L: 2.7e5, spall: 2.2e9 },
  [M.HIVE]: { rho: 1100, melt: 2.9e9, spall: 2.0e9 },
  [M.XENO]: { rho: 3400, c: 900, dT: 2600, L: 9.0e5, spall: 9.0e9 },
  [M.CONCRETE]: { rho: 2400, c: 880, dT: 1300, L: 4.0e5, spall: 0.6e9 },
  [M.STEEL]: { rho: 7800, c: 490, dT: 1500, L: 2.7e5, spall: 7.0e9 },
};
// J per m3 removed
export function energyPerM3(mat, mode = 'melt') { const r = ROCKP[mat] || ROCKP[M.BASALT]; if (mode === 'spall') return r.spall; return r.melt !== undefined ? r.melt : r.rho * (r.c * r.dT + r.L); }
// m2 of the side view removed per second by absorbed watts (the slice is SLAB thick)
export function digRate(absW, mat, mode = 'melt') { return absW / (energyPerM3(mat, mode) * (mode === 'melt' ? K_LOSS : 1) * SLAB); }
// m2 one pulse removes; and how far one pulse drives a 2 cm kerf (m)
export const pulseArea = (mat, frac = 1) => PULSE_BEAM_J * LASERP.absorb * frac / (energyPerM3(mat, 'spall') * SLAB);
export const kerfPerPulse = (mat, frac = 1) => pulseArea(mat, frac) / LASERP.kerf;

// ---- hurting things ---------------------------------------------------------------------------------------------------
// A pulse vaporises tissue at 2.6 MJ/kg along a channel about 1 cm wide; chitin ablates at 5 MJ/kg and spreads the spot
// to three times the area. Returns { grams, depth m, through: chitin pierced, chitin: m of chitin ablated }.
export const TISSUE = { J: 2.6e6, rho: 1000, spot: 7.85e-5 }, CHITIN = { J: 5.0e6, rho: 1400, spread: 3 };
export function ablate(E, chitinM = 0) {
  const perM = CHITIN.J * CHITIN.rho * TISSUE.spot * CHITIN.spread, need = chitinM * perM;
  if (E <= need) return { grams: 0, depth: 0, through: false, chitin: E / perM };
  const kg = (E - need) / TISSUE.J; return { grams: kg * 1000, depth: kg / (TISSUE.rho * TISSUE.spot), through: true, chitin: chitinM };
}
// a body's life in the game's unit: 20 per kg (2 % of the body destroyed stops it). A channel that reaches the core of
// a vital segment (half its thickness deep) kills whatever is left.
export const hpOf = kg => 20 * kg;
// the fist: 60-100 N s through the arm. The speed it can give is capped by the speed of the hand; the hurt is the
// blunt energy against what the body can take (about 100 J per kg). glove = the suit's actuators behind it.
export const FIST = { J: 80, v: 9, mEff: 4.5, stamina: 0.12 };
export function punch(kg, glove = 1) {
  const J = FIST.J * glove, dv = Math.min(J / kg, 2 * FIST.v * Math.sqrt(glove)), E = Math.min(0.5 * kg * dv * dv, 0.5 * FIST.mEff * FIST.v * FIST.v * glove);
  return { dv, E, frac: Math.min(1, E / (kg * 100)) };
}

// ---- movers -----------------------------------------------------------------------------------------------------------
// a rotor drone: 8 kg, thrust four times its own weight. It hovers with anything under (T/g - m); it is useful
// (thrust to weight 1.3) with 16 kg. Top speed falls with the load because the thrust left over to tilt forward does.
export const DRONE = { kg: 8, tw: 4, vmax: 9, lift: 15, hover: 24 };
export function droneSpeed(payload, n = 1) { const twl = DRONE.tw * DRONE.kg * n / (DRONE.kg * n + payload); return twl <= 1.02 ? 0 : DRONE.vmax * Math.min(1, Math.sqrt((twl * twl - 1) / (DRONE.tw * DRONE.tw - 1)) * 1.35); }
export const dronesFor = kg => Math.max(1, Math.ceil(kg / DRONE.lift - 1e-9));
// the six-legged hauler: 35 kg, 60 kg of load, a walking machine: 1.6 m/s empty, slower loaded
export const HAULER = { kg: 35, cargo: 60, v: 1.6 };
export const haulerSpeed = load => HAULER.v * HAULER.kg / (HAULER.kg + 0.6 * load);
// hoists run 1-10 m/s, belts 0.5-2 m/s
export const HOIST_V = 2.5, BELT_V = 1.5;
// seconds to assemble a kit of this mass with a tool of this power (bolting and welding prepared parts: 1.5 kJ/kg),
// and to make a thing of this mass in a machine (the matter compiler's 12 kJ/kg; an arc furnace's 1.44 MJ/kg)
export const E_BUILD = 1500, E_COMPILE = 12000, E_SMELT = 1.44e6;
export const buildTime = (kg, toolW = 2000) => Math.max(0.4, kg * E_BUILD / toolW);
export const makeTime = (kg, W, e = E_COMPILE) => kg * e / W;
// a wire: watts lost in a run of this length carrying this power at this voltage. Copper, cross-section in mm2.
export function wireLoss(W, metres, mm2 = 50, volts = 800) { const I = W / volts, R = 1.72e-8 * metres * 2 / (mm2 * 1e-6); return Math.min(W, I * I * R); }
// a radio link: Mbit/s at this distance for an antenna of this reach (inverse square from 1 Gbit/s at a tenth of it)
export const linkMbit = (d, range) => d > range ? 0 : Math.min(1000, 1000 * Math.pow(range * 0.1 / Math.max(d, 1), 2));

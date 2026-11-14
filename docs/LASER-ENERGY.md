# Ship laser and reactor: real energy numbers (decided 2026-11-14, queued for after round 5)

Leif: "the ship laser looks like it should but digs too quickly. if we need realistic formnulas for this and calculate the actual engergy and decide ho powerful this reactor is"

## Today (round 4 code)
- REACTOR_W 25 kW, LASER_W 18 kW (src/surface/power.js); dig = SDF front moving 2.1 m/s / hardness (src/surface/kit.js LASER.rate), not tied to energy.
- Mass slice SLAB = 0.02 m (1 m2 of basalt on screen = 58 kg), src/surface/gen.js.
- Result: about 2 m2/s of basalt removed, about 116 kg/s. Melting that takes about 160 MW, so 18 kW digs about 9,000 times faster than physics allows.

## Formulas (to implement)
- Energy to remove a volume by melting: e = rho * (c * dT + L_f) * k_loss, with k_loss = 1.4 (heat conducted into the surrounding rock).
- Removal rate (m2/s on screen) = P_absorbed / (e * SLAB).
- Kerf cutting: a slot 2 cm wide costs only the slot; the block it frees falls out as a real rock body (round 5 fracture). Line speed = rate / kerf width.
- Machines get real power too: e.g. an electric arc furnace uses about 400 kWh per tonne of steel.

| material | rho kg/m3 | c kJ/kgK | melt C | L_f kJ/kg | e GJ/m3 |
|---|---|---|---|---|---|
| basalt | 2900 | 0.84 | 1200 | 400 | 4.0 |
| iron ore (hematite) | 5000 | 0.65 | 1565 | ~400 | ~7 |
| soil (spalled by steam, not melted) | 1500 | - | - | - | ~0.45 |

## Decisions
- Reactor: 2.0 MW electric, still 140 kg (14 kW/kg). This is fiction: a compact direct-conversion fusion core. Today's best fission microreactors give about 0.01 kWe/kg, so 2 MW would weigh about 200 t. Direct conversion keeps waste heat at about 0.5 MW. On your back it throttles for heat; set down on its fins or in water it gives the full 2 MW.
- Laser: draws 1.5 MW, beam 600 kW (40 %, like a fibre laser), 80 % absorbed = 480 kW into the rock. Waste heat 900 kW.
- Laser heat: its own 38 kg sink holds about 8 s of full fire. After that it boils coolant water, at 0.35 kg/s (2.6 MJ/kg). A 10 L tank gives about 75 s more. Water becomes a stock target, so the AI keeps the tank filled.
- Resulting dig rates at 480 kW:
  - basalt: 43 cm2/s by melting, so a beam-sized hole (0.6 m2, 35 kg) takes about 2.5 min; a kerf slot moves at about 21 cm/s;
  - iron ore: 24 cm2/s;
  - soil: about 380 cm2/s, under 2 s per hole.
- Bulk melting is about 460 times slower than now. The fast way through rock is cutting kerfs so blocks fall out, then hauling them. Heavy machinery stays far ahead for bulk rock: tunnel-boring machines use 10 to 100 MJ/m3, against 4,000 MJ/m3 for melting. That fits Leif's "underground you need heavy machinery".

## Heat, revised (Leif, verbatim: "raelistically without the ships cooling systems the handheld ship turret would heat up and melt so fast so you can only shot it in fast pulses.")
- The waste heat is 900 kW at full beam. Off the ship there is no cooling loop, so the heat goes into the laser's own mass.
- Heat sink: 38 kg of copper (c = 0.385 kJ/kg·K) can take a 150 K rise before the optics and diodes are damaged. That holds 38 × 0.385 × 150 = 2.2 MJ, which is only about 2.4 s of full fire in total.
- Passive cooling in the thick atmosphere is about h 50 W/m²K × 0.5 m² × 150 K, or roughly 4 kW. Emptying a full sink that way takes about 9 minutes.
- So the handheld laser fires in fast pulses (about 50 ms at 600 kW, so 30 kJ of beam and 45 kJ of heat per pulse). That is about 50 pulses before the sink is full, then roughly one every 11 s from passive cooling alone.
- Going past the limit is real damage, not just venting: the optics degrade, the beam loses power, and at worst the laser is wrecked and has to be repaired with parts.
- Ways to fire more:
  - Water boil-off: an evaporative pack at 2.6 MJ/kg; a 5 L pack is about 290 more pulses. Water is a stock target the AI keeps filled.
  - A radiator or cooling loop: on the wreck's hardpoint, as a turret plumbed into the ship's or a built radiator, or through a coolant line in the reactor cable to the set-down reactor's fins. This gives sustained fire.
- Pulses are also the realistic way to dig. Short pulses crack rock by thermal shock (spallation) at a fraction of the melting energy. Pulsed digging spalls chips and kerfs; continuous beam needs the cooling loop.

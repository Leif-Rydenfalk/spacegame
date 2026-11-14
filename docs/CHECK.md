# CHECK

Run: 2026-11-14T12:14:17.435Z by `node tools/check.mjs` on foreman-ops-1 (arm64, Node v18.20.4).
Browser: /usr/bin/chromium headless, software GL (`--use-angle=swiftshader`). **Frame times below are software-rendering numbers, not a GPU number**; the 16.7 ms budget must be measured on a machine with a GPU.

Result: **PASS**. Property tests: `tests ok 49`.

Save round-trip (save, reload the page, compare the state hash):
- surface: explicit save 0950d23c, stored blob 0950d23c, state after reload 0950d23c: identical
- surface, the kit, loose matter, robots, stock targets: explicit save d1393b1c, stored blob d1393b1c, state after reload d1393b1c: identical
- space: explicit save e0dc28ec, stored blob e0dc28ec, state after reload e0dc28ec: identical

| scenario | url | shot | console errors | p50 ms | p95 ms | max ms |
|---|---|---|---|---|---|---|
| title | `` | [docs/shots/title.png](shots/title.png) | 0 | 667 | 667 | 667 |
| surface | `?act=surface` | [docs/shots/surface.png](shots/surface.png) | 0 | 1450 | 1450 | 1450 |
| slice | `?act=surface&scenario=slice&auto=1&t=16` | [docs/shots/slice.png](shots/slice.png) | 0 | - | - | - |
| reactor | `?act=surface&scenario=reactor&auto=1&t=4` | [docs/shots/reactor.png](shots/reactor.png) | 0 | 1033 | 1033 | 1033 |
| turret | `?act=surface&scenario=turret&auto=1&t=0.9` | [docs/shots/turret.png](shots/turret.png) | 0 | 1250 | 1250 | 1250 |
| herd | `?act=surface&scenario=herd&t=2` | [docs/shots/herd.png](shots/herd.png) | 0 | 1567 | 1567 | 1567 |
| predator | `?act=surface&scenario=predator&auto=1&t=1.4` | [docs/shots/predator.png](shots/predator.png) | 0 | 1633 | 1633 | 1633 |
| supply | `?act=surface&scenario=supply&t=45` | [docs/shots/supply.png](shots/supply.png) | 0 | 1283 | 1283 | 1283 |
| forest | `?act=surface&scenario=forest` | [docs/shots/forest.png](shots/forest.png) | 0 | 1033 | 1033 | 1033 |
| drill | `?act=surface&scenario=drill&auto=1&t=3` | [docs/shots/drill.png](shots/drill.png) | 0 | 1417 | 1417 | 1417 |
| inventory | `?act=surface&scenario=inventory` | [docs/shots/inventory.png](shots/inventory.png) | 0 | 1350 | 1350 | 1350 |
| factory | `?act=surface&scenario=factory&t=30` | [docs/shots/factory.png](shots/factory.png) | 0 | 1250 | 1250 | 1250 |
| blueprint | `?act=surface&scenario=blueprint&t=3.5` | [docs/shots/blueprint.png](shots/blueprint.png) | 0 | 1400 | 1400 | 1400 |
| combat | `?act=surface&scenario=combat&auto=1&t=2.5` | [docs/shots/combat.png](shots/combat.png) | 0 | 1283 | 1283 | 1283 |
| ruins | `?act=surface&scenario=ruins` | [docs/shots/ruins.png](shots/ruins.png) | 0 | 1383 | 1383 | 1383 |
| base | `?act=surface&scenario=base` | [docs/shots/base.png](shots/base.png) | 0 | 1067 | 1067 | 1067 |
| hive | `?act=surface&scenario=hive&t=6` | [docs/shots/hive.png](shots/hive.png) | 0 | 1500 | 1500 | 1500 |
| launch | `?act=space&scenario=launch` | [docs/shots/launch.png](shots/launch.png) | 0 | 367 | 633 | 633 |
| orbit | `?act=space` | [docs/shots/orbit.png](shots/orbit.png) | 0 | 233 | 833 | 833 |
| mining | `?act=space&scenario=mining&auto=1&t=20` | [docs/shots/mining.png](shots/mining.png) | 0 | 250 | 450 | 450 |
| combat-space | `?act=space&scenario=combat&auto=1&t=13` | [docs/shots/combat-space.png](shots/combat-space.png) | 0 | 217 | 333 | 333 |
| builder | `?act=space&scenario=builder` | [docs/shots/builder.png](shots/builder.png) | 0 | 233 | 500 | 500 |

## Round 3: what each new shot is proof of

- `surface`: the default start. Unarmed beside the wreck: the laser on its hardpoint, the reactor in its bay, the antenna frame, the canopy torn open over the crash site, the stock targets already counting.
- `slice`: the same start played by itself for 16 s: laser unbolted, reactor pulled and carried, the outcrop cut. Heat in the rock, molten edges, loose rock with mass lying in the cut, the antenna built on the way, the robots awake, the hive stirring.
- `reactor`: the body under 178 kg: the lean against the pack, the planted feet, the cable from the reactor to the laser.
- `turret`: the laser on its legs, the reactor set down and cabled to it, the antenna up, the ship AI aiming it at a stalker.
- `herd`: striders that have seen the lamp: heads up, flank lights bright, keeping their distance. Nothing attacks.
- `predator`: the stalker, bigger than the player, hunting.
- `supply`: stock targets in the HUD, the furnace as producer for iron, robots carrying with the load slung under them, the arm waiting for inputs for the cells.
- `drill`: the beam, the heat field, the cut, the chunks.
- `forest`: the layers: play plane, seven behind, two in front, fog veils between, shafts of planet-light.
- `kit-flow` (from `tools/ui-flow.mjs`): the end of the real-keys run: laser as a turret, reactor on the ground.

The interface run (`node tools/ui-flow.mjs`) is a separate command; its three JSON lines are the proof that the keys do what the README says.

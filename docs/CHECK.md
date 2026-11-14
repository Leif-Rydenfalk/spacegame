# CHECK

Run: 2026-11-14T14:38:27.862Z by `node tools/check.mjs` on foreman-ops-1 (arm64, Node v18.20.4).
Browser: /usr/bin/chromium headless, software GL (`--use-angle=swiftshader`). **Frame times below are software-rendering numbers, not a GPU number**; the 16.7 ms budget must be measured on a machine with a GPU.

Result: **PASS**. Property tests: `tests ok 63`.

Save round-trip (save, reload the page, compare the state hash):
- surface: explicit save 59f8c015, stored blob 59f8c015, state after reload 59f8c015: identical
- surface, the kit, loose matter, robots, stock targets: explicit save 65f843a1, stored blob 65f843a1, state after reload 65f843a1: identical
- surface, the build queue, the ship fabricator, the ground hauler: explicit save 5c6446e1, stored blob 5c6446e1, state after reload 5c6446e1: identical
- space: explicit save fd48c965, stored blob fd48c965, state after reload fd48c965: identical

| scenario | url | shot | console errors | p50 ms | p95 ms | max ms |
|---|---|---|---|---|---|---|
| title | `` | [docs/shots/title.png](shots/title.png) | 0 | - | - | - |
| surface | `?act=surface` | [docs/shots/surface.png](shots/surface.png) | 0 | - | - | - |
| slice | `?act=surface&scenario=slice&auto=1&t=16` | [docs/shots/slice.png](shots/slice.png) | 0 | - | - | - |
| reactor | `?act=surface&scenario=reactor&auto=1&t=4` | [docs/shots/reactor.png](shots/reactor.png) | 0 | - | - | - |
| turret | `?act=surface&scenario=turret&auto=1&t=0.9` | [docs/shots/turret.png](shots/turret.png) | 0 | - | - | - |
| herd | `?act=surface&scenario=herd&t=2` | [docs/shots/herd.png](shots/herd.png) | 0 | - | - | - |
| predator | `?act=surface&scenario=predator&auto=1&t=1.4` | [docs/shots/predator.png](shots/predator.png) | 0 | 1383 | 1383 | 1383 |
| supply | `?act=surface&scenario=supply&t=45` | [docs/shots/supply.png](shots/supply.png) | 0 | - | - | - |
| forest | `?act=surface&scenario=forest` | [docs/shots/forest.png](shots/forest.png) | 0 | 1717 | 1717 | 1717 |
| drill | `?act=surface&scenario=drill&auto=1&t=3` | [docs/shots/drill.png](shots/drill.png) | 0 | - | - | - |
| inventory | `?act=surface&scenario=inventory` | [docs/shots/inventory.png](shots/inventory.png) | 0 | 2017 | 2017 | 2017 |
| factory | `?act=surface&scenario=factory&t=30` | [docs/shots/factory.png](shots/factory.png) | 0 | - | - | - |
| blueprint | `?act=surface&scenario=blueprint&t=3.5` | [docs/shots/blueprint.png](shots/blueprint.png) | 0 | 1883 | 1883 | 1883 |
| combat | `?act=surface&scenario=combat&auto=1&t=2.5` | [docs/shots/combat.png](shots/combat.png) | 0 | - | - | - |
| ruins | `?act=surface&scenario=ruins` | [docs/shots/ruins.png](shots/ruins.png) | 0 | - | - | - |
| base | `?act=surface&scenario=base` | [docs/shots/base.png](shots/base.png) | 0 | 2383 | 2383 | 2383 |
| hive | `?act=surface&scenario=hive&t=6` | [docs/shots/hive.png](shots/hive.png) | 0 | - | - | - |
| planet | `?act=surface&scenario=planet` | [docs/shots/planet.png](shots/planet.png) | 0 | 483 | 683 | 683 |
| horizon | `?act=surface&scenario=horizon` | [docs/shots/horizon.png](shots/horizon.png) | 0 | 483 | 1200 | 1200 |
| far90 | `?act=surface&scenario=far90&auto=1&t=3` | [docs/shots/far90.png](shots/far90.png) | 0 | 2217 | 2217 | 2217 |
| seam | `?act=surface&scenario=seam&auto=1&t=8` | [docs/shots/seam.png](shots/seam.png) | 0 | - | - | - |
| antipode | `?act=surface&scenario=antipode&t=2` | [docs/shots/antipode.png](shots/antipode.png) | 0 | - | - | - |
| autobuild | `?act=surface&scenario=autobuild&t=75` | [docs/shots/autobuild.png](shots/autobuild.png) | 0 | - | - | - |
| queue | `?act=surface&scenario=queue&t=20` | [docs/shots/queue.png](shots/queue.png) | 0 | - | - | - |
| conveyor | `?act=surface&scenario=conveyor&t=40` | [docs/shots/conveyor.png](shots/conveyor.png) | 0 | - | - | - |
| overhang | `?act=surface&scenario=overhang&t=4` | [docs/shots/overhang.png](shots/overhang.png) | 0 | - | - | - |
| targets | `?act=surface&scenario=targets&t=30` | [docs/shots/targets.png](shots/targets.png) | 0 | - | - | - |
| launch | `?act=space&scenario=launch` | [docs/shots/launch.png](shots/launch.png) | 0 | 650 | 1017 | 1017 |
| orbit | `?act=space` | [docs/shots/orbit.png](shots/orbit.png) | 0 | 267 | 683 | 683 |
| mining | `?act=space&scenario=mining&auto=1&t=20` | [docs/shots/mining.png](shots/mining.png) | 0 | 233 | 467 | 467 |
| combat-space | `?act=space&scenario=combat&auto=1&t=13` | [docs/shots/combat-space.png](shots/combat-space.png) | 0 | 250 | 467 | 467 |
| builder | `?act=space&scenario=builder` | [docs/shots/builder.png](shots/builder.png) | 0 | 267 | 483 | 483 |

## Round 4: what each new shot is proof of

Every round 4 scenario also carries a condition on the live game state, evaluated when the shot is taken; a shot whose condition does not hold fails the check.

- `planet`: the whole planet from far out: the disc, the thin limb of air, the forest as a glowing skin, the crust and the dull core, the ringed giant behind it. The camera sits on the centre (condition: zoom over 90, camera at -642 m).
- `horizon`: thirteen times out: the ground is a curve, the giant stands over it.
- `far90`: 95 degrees east of the crash site and walking on. The camera has turned with gravity: down is the bottom of the screen (condition: longitude over 94, moving).
- `seam`: walking west across the place where the two charts of the planet meet: nothing shows (condition: the chart changed under the player).
- `antipode`: the far side, 180 degrees round: the mouth of the hive's main base. The giant never rises here.
- `autobuild`: four frames placed with no kit anywhere, 75 s on: the ship fabricator made the kits from the hold, drones built the furnace and the assembler in queue order, the hub still waits for lumen and says so (condition: both machines stand, the hub names lumen).
- `queue`: the ship AI window (J) on the same scene: the build queue with a reason on every line and arrows to reorder it, logistics, the stock-target editor.
- `conveyor`: a furnace and an assembler five metres apart on level ground: the AI laid the belt itself and iron rides it; the second furnace, across the wreck, is served by robots, and the reason is on the HUD (condition: eight or more AI belts, one belt route done, one robot route, iron in the assembler).
- `overhang`: ore under a ledge where no drone can drop a line: the six-legged ground hauler walks in under it (condition: the hauler is past the ledge's edge or loaded).
- `targets`: the stock-target editor: have / target, minus, plus, remove, and the grid of things to keep in stock as well.
- `ai-flow` (from `tools/ui-flow.mjs`): the same window reached with real keys, after placing a chest frame with B and raising the iron target with the + button.

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

The interface run (`node tools/ui-flow.mjs`) is a separate command; its four JSON lines are the proof that the keys do what the README says.

# CHECK

Run: 2026-11-14T22:22:16.375Z by `node tools/check.mjs` on foreman-ops-1 (arm64, Node v18.20.4).
Browser: /usr/bin/chromium headless, software GL (`--use-angle=swiftshader`). **Frame times below are software-rendering numbers, not a GPU number**; the 16.7 ms budget must be measured on a machine with a GPU.

Result: **PASS**. Property tests: `tests ok 100`.

Save round-trip (save, reload the page, compare the state hash):
- surface: explicit save ec13c267, stored blob ec13c267, state after reload ec13c267: identical
- surface, the kit, loose matter, robots, stock targets: explicit save afe5bdb5, stored blob afe5bdb5, state after reload afe5bdb5: identical
- surface, the build queue, the fabricator, the ground hauler: explicit save 1e84a021, stored blob 1e84a021, state after reload 1e84a021: identical
- space: explicit save 11c026f6, stored blob 11c026f6, state after reload 11c026f6: identical
- a round 4 save (version 4, hash 96ff5c76, 3 loose bodies, 97 kg of iron ore loose, carried and in the hold, 7 ghosts, 3 robots) migrated to version 6: the suit (its furnace went straight into the frame beside it), the queue, the robots and every kilogram of ore are there, the loose bodies have shapes, 10 s of play, then saved and reloaded as version 6 with state 7a1e04e9: ok
- a round 5 save (version 5, hash 303d6deb, written by the v0.5 build: 3 robots, antenna,furnace, 109.5 kg of iron ore loose, carried, in the suit, the hold and the furnace, 6 ghosts, 1 deck) migrated to version 6: you are in the exosuit with the ai up, the wreck has all its parts, the crash site counts as scanned, the robots, the machines, the deck and every kilogram of ore are there, 10 s of play with no robot giving a job up, then saved and reloaded with state 9500b7cd: ok

| scenario | url | shot | console errors | p50 ms | p95 ms | max ms |
|---|---|---|---|---|---|---|
| title | `` | [docs/shots/title.png](shots/title.png) | 0 | - | - | - |
| surface | `?act=surface` | [docs/shots/surface.png](shots/surface.png) | 0 | 1467 | 1467 | 1467 |
| slice | `?act=surface&scenario=slice&auto=1&t=16` | [docs/shots/slice.png](shots/slice.png) | 0 | - | - | - |
| reactor | `?act=surface&scenario=reactor&auto=1&t=4` | [docs/shots/reactor.png](shots/reactor.png) | 0 | 1300 | 1300 | 1300 |
| turret | `?act=surface&scenario=turret&auto=1&t=0.9` | [docs/shots/turret.png](shots/turret.png) | 0 | 1267 | 1267 | 1267 |
| herd | `?act=surface&scenario=herd&t=2` | [docs/shots/herd.png](shots/herd.png) | 0 | 1350 | 1350 | 1350 |
| predator | `?act=surface&scenario=predator&auto=1&t=1.4` | [docs/shots/predator.png](shots/predator.png) | 0 | 1600 | 1600 | 1600 |
| supply | `?act=surface&scenario=supply&t=45` | [docs/shots/supply.png](shots/supply.png) | 0 | - | - | - |
| forest | `?act=surface&scenario=forest` | [docs/shots/forest.png](shots/forest.png) | 0 | 1267 | 1267 | 1267 |
| drill | `?act=surface&scenario=drill&auto=1&t=3` | [docs/shots/drill.png](shots/drill.png) | 0 | 1417 | 1417 | 1417 |
| inventory | `?act=surface&scenario=inventory` | [docs/shots/inventory.png](shots/inventory.png) | 0 | 1150 | 1150 | 1150 |
| factory | `?act=surface&scenario=factory&t=30` | [docs/shots/factory.png](shots/factory.png) | 0 | 1250 | 1250 | 1250 |
| blueprint | `?act=surface&scenario=blueprint&t=3.5` | [docs/shots/blueprint.png](shots/blueprint.png) | 0 | 1267 | 1267 | 1267 |
| combat | `?act=surface&scenario=combat&auto=1&t=2.5` | [docs/shots/combat.png](shots/combat.png) | 0 | 1183 | 1183 | 1183 |
| ruins | `?act=surface&scenario=ruins` | [docs/shots/ruins.png](shots/ruins.png) | 0 | 1133 | 1133 | 1133 |
| base | `?act=surface&scenario=base` | [docs/shots/base.png](shots/base.png) | 0 | 833 | 1000 | 1000 |
| hive | `?act=surface&scenario=hive&t=6` | [docs/shots/hive.png](shots/hive.png) | 0 | 1267 | 1267 | 1267 |
| planet | `?act=surface&scenario=planet` | [docs/shots/planet.png](shots/planet.png) | 0 | 433 | 900 | 900 |
| horizon | `?act=surface&scenario=horizon` | [docs/shots/horizon.png](shots/horizon.png) | 0 | 467 | 667 | 667 |
| far90 | `?act=surface&scenario=far90&auto=1&t=3` | [docs/shots/far90.png](shots/far90.png) | 0 | 1333 | 1333 | 1333 |
| seam | `?act=surface&scenario=seam&auto=1&t=8` | [docs/shots/seam.png](shots/seam.png) | 0 | 1450 | 1450 | 1450 |
| antipode | `?act=surface&scenario=antipode&t=2` | [docs/shots/antipode.png](shots/antipode.png) | 0 | 1250 | 1250 | 1250 |
| autobuild | `?act=surface&scenario=autobuild&t=120` | [docs/shots/autobuild.png](shots/autobuild.png) | 0 | 1200 | 1200 | 1200 |
| queue | `?act=surface&scenario=queue&t=20` | [docs/shots/queue.png](shots/queue.png) | 0 | 1250 | 1250 | 1250 |
| conveyor | `?act=surface&scenario=conveyor&t=120` | [docs/shots/conveyor.png](shots/conveyor.png) | 0 | 1167 | 1167 | 1167 |
| overhang | `?act=surface&scenario=overhang&t=9` | [docs/shots/overhang.png](shots/overhang.png) | 0 | 1500 | 1500 | 1500 |
| targets | `?act=surface&scenario=targets&t=30` | [docs/shots/targets.png](shots/targets.png) | 0 | - | - | - |
| fall | `?act=surface&scenario=fall&t=4` | [docs/shots/fall.png](shots/fall.png) | 0 | 1233 | 1233 | 1233 |
| layers | `?act=surface&scenario=layers&t=3` | [docs/shots/layers.png](shots/layers.png) | 0 | 1450 | 1450 | 1450 |
| rocks | `?act=surface&scenario=rocks&t=24` | [docs/shots/rocks.png](shots/rocks.png) | 0 | - | - | - |
| place | `?act=surface&scenario=place&t=1` | [docs/shots/place.png](shots/place.png) | 0 | 1333 | 1333 | 1333 |
| plan | `?act=surface&scenario=plan&t=120` | [docs/shots/plan.png](shots/plan.png) | 0 | 1100 | 1100 | 1100 |
| wake | `?act=surface&t=3` | [docs/shots/wake.png](shots/wake.png) | 0 | 933 | 1150 | 1150 |
| suitup | `?act=surface&scenario=suitup&auto=1&t=8` | [docs/shots/suitup.png](shots/suitup.png) | 0 | 1267 | 1267 | 1267 |
| interior | `?act=surface&scenario=interior` | [docs/shots/interior.png](shots/interior.png) | 0 | 950 | 1133 | 1133 |
| kerf | `?act=surface&scenario=kerf&auto=1&t=14` | [docs/shots/kerf.png](shots/kerf.png) | 0 | 1433 | 1433 | 1433 |
| heat | `?act=surface&scenario=heat&auto=1&t=12` | [docs/shots/heat.png](shots/heat.png) | 0 | 1200 | 1200 | 1200 |
| fists | `?act=surface&scenario=fists&auto=1&t=6` | [docs/shots/fists.png](shots/fists.png) | 0 | 1200 | 1200 | 1200 |
| defend | `?act=surface&scenario=defend&t=5` | [docs/shots/defend.png](shots/defend.png) | 0 | 1333 | 1333 | 1333 |
| swarm | `?act=surface&scenario=swarm&t=7` | [docs/shots/swarm.png](shots/swarm.png) | 0 | 1183 | 1183 | 1183 |
| market | `?act=surface&scenario=market&t=25` | [docs/shots/market.png](shots/market.png) | 0 | 1200 | 1200 | 1200 |
| rescue | `?act=surface&scenario=rescue&t=13` | [docs/shots/rescue.png](shots/rescue.png) | 0 | 1217 | 1217 | 1217 |
| stockpile | `?act=surface&scenario=stockpile&t=70` | [docs/shots/stockpile.png](shots/stockpile.png) | 0 | - | - | - |
| reach | `?act=surface&scenario=reach&t=4` | [docs/shots/reach.png](shots/reach.png) | 0 | 1300 | 1300 | 1300 |
| assay | `?act=surface&scenario=assay&t=40` | [docs/shots/assay.png](shots/assay.png) | 0 | 1117 | 1117 | 1117 |
| shaft | `?act=surface&scenario=shaft&t=110` | [docs/shots/shaft.png](shots/shaft.png) | 0 | 1000 | 1000 | 1000 |
| supports | `?act=surface&scenario=supports&t=60` | [docs/shots/supports.png](shots/supports.png) | 0 | 1350 | 1350 | 1350 |
| collapse | `?act=surface&scenario=collapse&t=14` | [docs/shots/collapse.png](shots/collapse.png) | 0 | 1333 | 1333 | 1333 |
| wires | `?act=surface&scenario=wires&t=8` | [docs/shots/wires.png](shots/wires.png) | 0 | 1100 | 1100 | 1100 |
| needs | `?act=surface&scenario=needs&t=5` | [docs/shots/needs.png](shots/needs.png) | 0 | 1300 | 1300 | 1300 |
| fog | `?act=surface&scenario=fog&t=3` | [docs/shots/fog.png](shots/fog.png) | 0 | 1283 | 1283 | 1283 |
| deckrock | `?act=surface&scenario=deckrock&t=8` | [docs/shots/deckrock.png](shots/deckrock.png) | 0 | 1117 | 1117 | 1117 |
| knowledge | `?act=surface&scenario=knowledge` | [docs/shots/knowledge.png](shots/knowledge.png) | 0 | 433 | 583 | 583 |
| launch | `?act=space&scenario=launch` | [docs/shots/launch.png](shots/launch.png) | 0 | 250 | 517 | 517 |
| orbit | `?act=space` | [docs/shots/orbit.png](shots/orbit.png) | 0 | 217 | 583 | 583 |
| mining | `?act=space&scenario=mining&auto=1&t=20` | [docs/shots/mining.png](shots/mining.png) | 0 | 200 | 350 | 350 |
| combat-space | `?act=space&scenario=combat&auto=1&t=13` | [docs/shots/combat-space.png](shots/combat-space.png) | 0 | 167 | 183 | 283 |
| builder | `?act=space&scenario=builder` | [docs/shots/builder.png](shots/builder.png) | 0 | 167 | 200 | 283 |

## Round 6: what each new shot is proof of

Round 6 is in `docs/ROUND6.md` (Leif's words) and `docs/ROUND6-STATUS.md` (each section: done, partial, moved to round 7). Every round 6 scenario carries a condition on the live state; the numbers themselves are pinned by the property tests (`?test=1`: the dig rate from energy, the heat sink's pulse count, ablation and the punch, the task market, the ground path-finding and the rescue of a stuck hauler, the composition ranges and the estimate after an assay, a kerf that frees a block, support priority, collapse, the suit, the wreck, the ledger, queue-anything, wire loss, the migration 5 to 6). `node tools/play.mjs` plays the new start by real input with the forest and the hive left on.

- `wake`: the default start: inside the wreck, in the crew room, without the suit. No instruments: a mask, the hands, the body. The hull is cut away; nothing from later is in any menu (condition: inside, no suit, no robots, stage 1, no pad or bio-printer recipe visible).
- `suitup`: the same start played by itself: aft to the locker, the suit on, the boot lines coming up (condition: suit on, boot running).
- `interior`: the wreck from inside, suited, lights on: frame and ribs, the volumes (engine bay, hold, tank, reactor bay, the sealed section behind the bulkhead: life support, crew room, computer bay, cockpit) and the parts that fill them; one turbopump salvaged and gone (condition: 30 or more parts, one gone, repair dearer than a new hull).
- `kerf`: the laser in kerf mode, the reactor set down for its coolant line: a slot through the shoulder of the outcrop and the cap it cut off, fallen as blocks (condition: kilograms freed, bodies, the coolant line).
- `heat`: pulses into the ground with the reactor on the back (600 kW): the sink full after its 48, the HUD counting (condition: 46 to 60 pulses in 12 s, the laser waiting).
- `fists`: no laser: combat mode, punches at the first workers of a hive (condition: punches thrown, something killed, the laser still on the ship).
- `defend`: nobody touches the mouse: the body turns, fires and steps back by itself (condition: pulses fired and a kill with no input).
- `swarm`: numbers: thirty-odd small bodies against the turret and its sink (condition: thirty bodies, none over 16 kg, the turret firing).
- `market`: the AI window on the task market: the queue with bids, what waits and why, the log of decisions, the stockpiles (condition: jobs taken, a zone open, nothing given up).
- `rescue`: a hauler on a ledge with no way down, in the lines of the two drones (condition: lifted or already set down, nothing given up).
- `stockpile`: loose rock of four kinds tidied into the zones the AI opened for them (condition: two zones, kilograms in them, the ledger still exact).
- `reach`: the inventory window: what is on you, what is in reach with its place and its time, the suit and its slots, the recipes by what can be done now (condition: the chest and the hold in the list, the furnace in reach).
- `assay`: a scan ring on the outcrop, the finds marked, the assay station sorting rubble (condition: an assay done, its ground at level 2).
- `shaft`: the shaft rig: headframe, string, casing, rotary head, the hoist's skip, sunk as far as it was paid for (condition: sinking at its centimetre a second, modules fitted, a skip trip).
- `supports`: a drift under its safe factor: the bolts the AI planned and had a drone set (condition: a support stands, nothing fell).
- `collapse`: the same with a wider span and no help: the roof on the floor as bodies (condition: a collapse, rock down, you alive at the mouth).
- `wires`: Alt held: the grid as sagging cable with its current, the radio links, the reach of every antenna, sensor, node and the turret (condition: links, a loss figure, a signal).
- `needs`: the four needs low on the HUD; the pump, filter and controller out of the wreck standing in the open with furniture (condition: the pump ready).
- `fog`: one animal in sight, one that went behind the rock (a ghost where it was), the radar up (condition: one seen, one not).
- `deckrock`: rock that fell on a deck lying on it (condition: a body asleep on a deck).
- `knowledge`: the planet from far out, dark but for the slice that has been seen; g with a range, the radius unknown (condition: under 400 m known).
- `v5-save` (from the save check): a save written by the round 5 build, loaded in this one.
- `play-wake`, `play-boot`, `play-reach`, `play-scan`, `play-kerf`, `play-blocks`, `play-craft`, `play-furnace`, `play-order`, `play-supports`, `play-end` (from `tools/play.mjs`): the new start by hand.

## Round 5: what each new shot is proof of

Round 5 is a robustness round. Its proof is mostly not in pictures: it is in the property tests (`?test=1`: the field is a distance again after an edit; no tunnelling at terminal velocity onto a floor, a wall, a deck and fresh-dug ground; a rock stack comes to rest; a pile wakes when its support is taken; fracture conserves mass; a hard landing breaks rock; a robot job completes with one fetcher for one kit; a robot goes round a wall; the path search; inventory place consumes the item; blueprint mode places what you hold and plans what you do not; what cannot be made yet is not shown; a blueprint ghost gets built; save migration 4 to 5), in the version 4 save loaded above, and in `node tools/play.mjs`, which plays a fresh start with real keys and a real mouse and writes `docs/shots/play.json`. The shots:

- `fall`: dropped from seven metres over a shaft: standing on the first deck, air under it, the back wall of the shaft behind (condition: on the deck at -2 m, not in rock).
- `layers`: decks at three heights in a cut shaft and two round chambers dug beside it: every cut shows darker rock behind it, never sky (condition: on a deck, 21 deck cells, the chamber is air with the wall bit set).
- `rocks`: 120 rocks (2,491 kg) let go over a hollow, 24 s later: broken where they landed hard, piled, all asleep, none in the ground, the amounts unchanged (condition: all of that).
- `place`: a furnace in slot 1 on the cursor in normal mode: the thing itself, framed green where the click will put it; no plan row (condition: the cursor is the furnace, one in the inventory).
- `plan`: blueprint mode two minutes on: the dashed plan row with only what can be made, an assembler ghost on the cursor, and the furnace and four belts that were ghosts, built by the drones (condition: mode, plan, the machines, no hub in the row).
- `v4-save` (from the save check): the round 4 save loaded in the round 5 build.
- `play-cut`, `play-craft`, `play-furnace-cursor`, `play-deck`, `play-ghost`, `play-end` (from `tools/play.mjs`): the by-hand run: the cut with the wall behind it, the crafting menu, the furnace on the cursor, standing on a deck over the pit, the chest ghost, the end state.
- `place-flow` (from `tools/ui-flow.mjs`): a furnace placed from its slot, then a furnace ghost planned with Q and a click.

## Round 4: what each new shot is proof of

Every round 4 scenario also carries a condition on the live game state, evaluated when the shot is taken; a shot whose condition does not hold fails the check.

- `planet`: the whole planet from far out: the disc, the thin limb of air, the forest as a glowing skin, the crust and the dull core, the ringed giant behind it. The camera sits on the centre (condition: zoom over 90, camera at -642 m).
- `horizon`: thirteen times out: the ground is a curve, the giant stands over it.
- `far90`: 95 degrees east of the crash site and walking on. The camera has turned with gravity: down is the bottom of the screen (condition: longitude over 94, moving).
- `seam`: walking west across the place where the two charts of the planet meet: nothing shows (condition: the chart changed under the player).
- `antipode`: the far side, 180 degrees round: the mouth of the hive's main base. The giant never rises here.
- `autobuild`: four frames placed with no kit anywhere, two minutes on: the fabricator made the kits from the hold, drones built the furnace and the assembler in queue order, the hub still waits for lumen and says so (condition: both machines stand, the hub names lumen).
- `queue`: the AI window (J) on the same scene: the build queue with a reason on every line and arrows to reorder it, logistics, the stock-target editor.
- `conveyor`: a furnace and an assembler five metres apart on level ground: the AI laid the belt itself and iron rides it; the second furnace, across the wreck, is served by robots, and the reason is on the HUD (condition: eight or more AI belts, one belt route done, one robot route, iron in the assembler).
- `overhang`: ore under a ledge where no drone can drop a line: the six-legged ground hauler walks in under it (condition: the hauler is past the ledge's edge or loaded).
- `targets`: the stock-target editor: have / target, minus, plus, remove, and the grid of things to keep in stock as well.
- `ai-flow` (from `tools/ui-flow.mjs`): the same window reached with real keys, after planning a chest in blueprint mode (Tab) and raising the iron target with the + button.

## Round 3: what each new shot is proof of

- `surface`: the default start. Unarmed beside the wreck: the laser on its hardpoint, the reactor in its bay, the antenna frame, the canopy torn open over the crash site, the stock targets already counting.
- `slice`: the same start played by itself for 16 s: laser unbolted, reactor pulled and carried, the outcrop cut. Heat in the rock, molten edges, loose rock with mass lying in the cut, the antenna built on the way, the robots awake, the hive stirring.
- `reactor`: the body under 178 kg: the lean against the pack, the planted feet, the cable from the reactor to the laser.
- `turret`: the laser on its legs, the reactor set down and cabled to it, the antenna up, the AI aiming it at a stalker.
- `herd`: striders that have seen the lamp: heads up, flank lights bright, keeping their distance. Nothing attacks.
- `predator`: the stalker, bigger than the player, hunting.
- `supply`: stock targets in the HUD, the furnace as producer for iron, robots carrying with the load slung under them, the arm waiting for inputs for the cells.
- `drill`: the beam, the heat field, the cut, the chunks.
- `forest`: the layers: play plane, seven behind, two in front, fog veils between, shafts of planet-light.
- `kit-flow` (from `tools/ui-flow.mjs`): the end of the real-keys run: laser as a turret, reactor on the ground.

The interface run (`node tools/ui-flow.mjs`) and the by-hand run (`node tools/play.mjs`) are separate commands; their JSON lines are the proof that the keys do what the README says.

# spacegame, demo 1 (round 2)

One page, two acts, feel first. Act 1 is a side-view survival and factory game on a dark, overgrown, bioluminescent
world: a smooth voxel terrain you carve with a laser drill, a suit that prints anything slowly and machines that do
one thing fast, blueprints and builder drones, a combat mode, and under the ground a hivemind that hears your noise
and smells your pollution. Act 2 is top-down space at real 1:1 scale with Kepler orbits, ships built from parts,
belt mining and combat. Setting: a neighbouring star system where Earth sent prisoners to do research on its planets;
that is where it went wrong. All story text is a `[placeholder]` in `src/story.js` until Leif's own text replaces it.

Rendering is three.js on WebGL2: orthographic camera, one instanced sprite batch, custom shaders (density-field
terrain, light map, lit planets, asteroids), and an EffectComposer chain (bloom, film grain, vignette, edge chromatic
aberration, tone curve). Everything is procedural and seeded (`?seed=7`); there are no asset files and no network
calls. Progress is saved in the browser (IndexedDB) and survives reloads and restarts.

## Run

```sh
npm install        # Node 18+; three 0.170.0, vite 5.4.11, puppeteer-core (check only)
npm run dev        # http://localhost:5200
npm run build      # -> dist/ (one page, one bundle)
npm run check      # headless: every scenario -> docs/shots/*.png, console errors, save round-trip, ?test=1, writes docs/CHECK.md
node tools/ui-flow.mjs   # headless: real mouse and keys through inventory, printer, blueprint, combat, title, save, continue
```

## Scenario URLs

The bare URL shows the title screen: **Continue** loads the saved game, **New game** starts one (and asks before it
replaces a saved one). A URL that names an act or a scenario starts at once and does not touch the saved game unless
it also names a slot (`&slot=name`, and `&continue=1` to load it).

| URL | Starts |
|---|---|
| `./` | title screen; the game plays in the save slot `main` |
| `?act=surface` | the crash site at night: laser drill, rifle, shotgun, a little iron |
| `?act=surface&scenario=forest` | deep in the violet thicket |
| `?act=surface&scenario=drill&auto=1` | the laser drill cutting into a hillside |
| `?act=surface&scenario=inventory` | the inventory window and the suit printer with a queue |
| `?act=surface&scenario=factory` | miner, belts, furnace, assembler running; pad half built; bio-printer and a chest (`&t=30` fast-forwards 30 s) |
| `?act=surface&scenario=blueprint` | blueprint mode: a hub, three builder drones, a chest of kits, a queue of ghosts and a terrain-clear job |
| `?act=surface&scenario=combat` | combat mode with scouts, swarmers, a brute, a spitter and fliers (`&auto=1` aims and fires) |
| `?act=surface&scenario=ruins` | at the mouth of an alien ruin |
| `?act=surface&scenario=base` | at the blast door of a military outpost under lockdown |
| `?act=surface&scenario=hive` | near a hive mouth with the hive already alert |
| `?act=space&scenario=launch` | the rocket at 40 km on the ascent autopilot |
| `?act=space` | a 220 x 640 km orbit around the home moon in the 12-part scout, 1,770 m/s of delta-v |
| `?act=space&scenario=mining` | beside a belt asteroid with a mining platform, the depot and two haulers |
| `?act=space&scenario=combat` | at the depot with two hive ships closing |
| `?act=space&scenario=builder` | the hangar |
| `?test=1` | in-page property tests, prints `tests ok N` |

Extra parameters: `seed=N`, `t=S` (simulate S seconds before the first frame), `auto=1` (scripted input for the proof
shots), `slot=name`, `continue=1`. `F1` in the game opens the dev menu with the same list, **save now**, and
**export / import save** as a file.

## Controls

| Act 1, surface | Act 2, space |
|---|---|
| A/D move, W or Space jump, Shift sprint, hold Space in the air for the jetpack | W main engines (Z lock full, X cut), A/D rotate, Q/E strafe, S retro (RCS) |
| Mouse aim (the headlamp follows). **Build mode** (default): LMB laser drill, RMB place the selected soil, basalt or iron as terrain | LMB autocannon, RMB mining laser, wheel zoom (continuous, 0.01 m/px to 1e10 m/px) |
| 1-9 or wheel: hotbar slot. **I** or **Tab**: inventory window and the suit printer (LMB move or drag, RMB split / place one, Shift quick move; click a recipe to queue it, Shift x5; click a queued job to cancel) | M map (local, planet system, star system), Tab focus (ship, target, depot), T target |
| **C** combat mode: LMB fire, RMB aim down sights, R reload, 1-9 weapon | `,` `.` time (x2, x4 under thrust; x10 to x100,000 on rails), N prediction on/off |
| **B** blueprint mode: 1-9 or wheel pick a building, LMB queue a ghost (hold to paint belts and walls), R rotate, RMB cancel, X mark for deconstruction, T drag a terrain-clear rectangle. Drones build the queue; within 4 m the suit builds by hand | B hangar, P ascent autopilot (from the pad), L story log, F1 dev menu |
| **E** use: machine, chest or cache window, hub (dock drones), terminal, audio log, lore stone; E at the finished pad boards the rocket | |
| F headlamp, L story log, Esc close window, F1 dev menu (scenarios, save, export, import) | |

## What is simulated

- Terrain: a density field at 0.125 m (64 x 64 chunks, one density byte and one material byte per sample),
  generated on demand as a pure function of (x, y, seed) and drawn by one shader from a linear-filtered window, so
  the surface is a smooth iso-line at any zoom. Digging and placing are circular brushes with soft edges; materials
  blend at their borders. The player, creatures, bullets, particles and drones collide with the field by sampling
  its distance and normal. Every brush reports the kilograms it moved, per material (1 m2 of basalt is 58 kg).
- Light: an RGB light map at 0.5 m, flood-propagated from flora, glyphs, ore, lava, machines, beams and muzzle
  flashes; a 96-ray headlamp cone that also shapes the volumetric haze.
- Items are continuous amounts: bulk in kg, fluids in L, discrete things one each with a mass, ammunition counted
  to the round. A slot holds a mass or volume limit, the suit carries 600 kg. The suit has a battery (Wh), oxygen
  (kg) and jet propellant (kg); the laser draws 4.5 kW, the lamp 15 W, the printer 180 W.
- The suit printer prints every recipe, 8 times slower than the machine that specialises in it. Machines work on
  real amounts per second: the miner bores down and outputs exactly the ore its bit removed, the furnace smelts
  continuously (biomass in the firebox makes it 2.5 times faster and dirtier), the assembler runs batches.
- Laser drill: a beam that carves the field at 3.4 m/s through soft ground, with heat glow on the cut edge, sparks,
  molten droplets, smoke, debris, overheat and venting. It also cuts trees and anything that walks into it.
- Blueprints and builder drones: ghosts with rotation and cost, a queue, deconstruction marks, terrain-clear
  rectangles. Drones fly with momentum, fetch kits from the suit or a chest, weld, haul what they cut to a chest,
  and recharge at their hub (40 Wh each).
- Forest: per-chunk seeded flora anchored to the ground that is actually there: giant cap trees, lantern stalks and
  weeping vine trees by biome, roots, shelves, fronds, grass, cave fungi, hanging vines, pods, drifting spores.
  Instanced, swaying, light-casting, choppable; a plant whose ground is dug away falls.
- Noise and pollution: every loud thing emits noise with a radius in metres that fades in seconds; machines and
  drilling emit pollution that accumulates in 8 m cells, spreads and decays slowly. Hives raise their alert from
  both and send more and larger waves; creatures go to the loudest thing they hear and wreck loud machines.
- Six hive species (scout, swarmer, brute, spitter, burrower, flier) and two natives, each with its own body and
  behaviour; walkers have IK legs that step over the field, burrowers swim through rock and leave tunnels.
- Structures from seeded generators: alien ruins (a grammar with five style rules: halls, vaults, arches,
  monoliths, spires, glyph lights, lore stones, caskets), hives (chambers, tunnels, egg sacs, a heart that can be
  killed), and human outposts and research facilities under lockdown (blast doors, emergency lights, dead sentries
  and turrets, a breach with hive growth, terminals, audio logs, caches). Facilities go dark as the hivemind spreads.
- Saving: autosave every 30 s, when the page is hidden or closed, and on act switch. Terrain is saved as the edited
  chunks only (run-length encoded); plus player, suit, inventory, printer queue, machines and their buffers, chests,
  blueprints, drones, kills, site state, hive alert, pollution, story beats seen, and the space state (ships with
  parts, orbits as elements at an epoch, depot, platforms, drones, cut asteroids). `src/save.js` is the only module
  that touches storage, through an adapter `{ load(slot), save(slot, blob), list() }` and a versioned schema with a
  migration hook, so a ce-net `state.store` adapter tied to the player's identity can replace IndexedDB.
- Death: until you build the bio-printer, dying restarts you at the crash site; once it exists you respawn there.
  Your body and inventory stay where you died. Ships are yours (demo 1: a local player id; later a ce-net identity),
  and stay yours as wrecks.
- Space: a star, seven planets, the home moon around a ringed giant, a belt at 2.1 to 3.3 AU, all at real scale in
  double-precision metres with a floating origin. Ships integrate under thrust (velocity Verlet, 120 Hz) and ride
  Kepler rails under time warp, with sphere-of-influence switching, the predicted conic, Ap/Pe and SOI-exit markers.
  A ship is a grid of parts: mass, centre of mass, inertia, engine torque, RCS selected by torque sign, Tsiolkovsky
  delta-v, fuel drained per tank. Destroyed parts split the ship along its connectivity graph into free bodies.
- Belt: sectors are a pure function of (seed, ring, slot), loaded around the ship and freed again. Asteroids are
  128-sample radial height maps that deform under the laser and eject hot chunks; the cargo bay's collector pulls
  them in. A platform mines into a silo, haulers carry ore to the depot, the depot refines it and builds more
  haulers from a blueprint.
- Combat: 30 mm shells inherit the ship's velocity, a lead marker solves the intercept, hive ships are grown from a
  seed, obey the same physics and spit slow plasma.

## Layout

`src/core.js` (G, events, input, hashing), `src/render.js` (renderer, post, sprite batch, particles), `src/items.js`
(items, inventories, recipes, suit printer), `src/icons.js` (procedural icon set), `src/ui.js` (hotbar, inventory,
windows, blueprint bar, title), `src/save.js`, `src/story.js`, `src/audio.js`, `src/hud.js`, `src/test.js`.
`src/surface/`: `gen.js` (pure generation), `world.js` (density field, brushes, queries), `terrain.js` (shader),
`light.js`, `flora.js`, `player.js`, `creatures.js`, `env.js` (noise, pollution), `hive.js` (hivemind),
`structures.js` with `ruins-gen.js`, `hive-gen.js`, `base-gen.js`, `sites.js` (props, lore, caches), `factory.js`,
`blueprint.js`, `robots.js`. `src/space/*` (orbit, ship, belt, combat, view). `tools/check.mjs`.
Plan, decisions and lore notes: `PLAN.md`. Check result and proof shots: `docs/CHECK.md`, `docs/shots/`.

## Licence

Apache-2.0, see `LICENSE`. Dependencies: three (MIT), vite (MIT, build only), puppeteer-core (Apache-2.0, check only).

## Cut or simplified (said plainly)

- Surface: no water, no weather beyond fog, no day cycle (always night), no world wrap, no power grid or inserters
  (belts feed machines directly), one generic rocket part, no food or water, no gamepad. Machines stand on a 0.5 m
  placement grid and do not block the player. Rock the miner removes is tailings and is not kept.
- Combat mode: two weapons (rifle, shotgun); the drill is not a weapon slot but its beam does damage. Dead turrets
  cannot be repaired. Creatures in flight or on the ground at the moment of a save are not saved (kills and hive
  alert are); the next wave replaces them.
- Robots: they route over the ground, not through caves; a drone stuck for 5 s passes through terrain. They do not
  defend themselves and are not attacked.
- Ruins, hives and facilities: one layout family each; blast doors do not open (cut through, or use the breach);
  audio logs show text, they do not play sound. Every line of lore is a placeholder.
- Hivemind: facilities go dark on a threshold of one global value; hives do not grow new chambers.
- Icons are 64 px procedural canvases, not a hand-drawn set.
- Launch: the view switches from the surface to the planet view at ignition instead of one continuous zoom.
- Space: unchanged from demo 1 apart from icons in the hangar and saving. Hauler drones fly accelerate-and-brake
  transfers, burn no fuel, ore has no mass, asteroids have no gravity and ships do not collide with them.
- Frame budget (p95 16.7 ms) is not measured: this machine has software GL only. JavaScript per frame was measured
  at about 5 ms of draw and 0.8 ms per 120 Hz step on this machine (arm64 server CPU).

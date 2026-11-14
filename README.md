# spacegame, demo 1 (round 3: the look and the feel)

One page, two acts, feel first. Act 1 is a side-view survival and factory game on a dark, overgrown, bioluminescent
world. Round 3 is a vertical slice of it, about ten minutes from a new start, built to set the look of the whole
game: you wake beside the wreck with nothing in your hands, in a forest that is many layers deep and never still.
The ship's weapon comes off its hardpoint as a handheld laser, the ship's reactor comes out of its bay onto your back
(140 kg: it slows you, and the jet no longer lifts you), and with the two of them you cut rock that glows, runs and
falls as loose matter with mass. A herd watches you and keeps its distance; something bigger than you does not. The
arm's matter compiler prints your first machine, slowly; the ship AI keeps count of what you use, picks who makes
more of it, and sends the ship's robots to carry. Under the ground a hive hears the cutting and sends something to
look. Act 2 (top-down space at real 1:1 scale, Kepler orbits, ships from parts, belt mining, combat) is unchanged
from round 2. Setting: a neighbouring star system where Earth sent prisoners to do research on its planets. All story
text is a `[placeholder]` in `src/story.js` until Leif's own text replaces it; `docs/ROUND3.md` holds Leif's asks,
`docs/THEMES-AI-GENERATED.md` the AI-written themes.

Rendering is three.js on WebGL2: orthographic camera, instanced sprite batches with procedural shapes (tapered and
curved limbs, leaf blades, leaf masses, rock, ground lines, light shafts, fog), a density-field terrain shader, a
light map, a heat field, a parallax backdrop rendered far to near into its own target, and an EffectComposer chain
(bloom, film grain, vignette, edge chromatic aberration, tone curve, a cool-shadow warm-highlight grade). Everything
is procedural and seeded (`?seed=7`); there are no asset files and no network calls. Progress is saved in the
browser (IndexedDB) and survives reloads and restarts.

## Run

```sh
npm install        # Node 18+; three 0.170.0, vite 5.4.11, puppeteer-core (check only)
npm run dev        # http://localhost:5200
npm run build      # -> dist/ (one page, one bundle)
npm run check      # headless: every scenario -> docs/shots/*.png, console errors, save round-trips, ?test=1, writes docs/CHECK.md
node tools/ui-flow.mjs   # headless, real mouse and keys: inventory, arm, blueprint, the round 3 kit, title, save, continue
node tools/shot.mjs http://localhost:5200/ out-dir name='?act=surface'   # one shot of a running server (--dpr 2 --clip x,y,w,h)
```

## Scenario URLs

The bare URL shows the title screen: **Continue** loads the saved game, **New game** starts one (and asks before it
replaces a saved one). A URL that names an act or a scenario starts at once and does not touch the saved game unless
it also names a slot (`&slot=name`, and `&continue=1` to load it).

| URL | Starts |
|---|---|
| `./` | title screen; the game plays in the save slot `main` |
| `?act=surface` | **the slice, and the default start**: awake at the wreck, unarmed; the laser on its hardpoint, the reactor in its bay, an antenna frame to build, a herd in the trees, an outcrop with an iron seam to the east |
| `?act=surface&scenario=slice&auto=1` | the same, played by itself: laser off the mount, reactor out, walk to the outcrop, cut (`&t=16` jumps in) |
| `?act=surface&scenario=reactor&auto=1` | the walk with 178 kg on the body |
| `?act=surface&scenario=turret&auto=1` | the laser on its legs, the reactor set down on its cable, the antenna up, the ship AI firing on a stalker |
| `?act=surface&scenario=herd` | a herd of striders that has seen you and has not decided yet |
| `?act=surface&scenario=predator&auto=1` | the stalker: bigger than you, and it eats things your size |
| `?act=surface&scenario=supply` | demand and supply: stock targets, a furnace, the arm, loose ore, the ship's robots carrying (`&t=45`) |
| `?act=surface&scenario=drill&auto=1` | the ship laser cutting a hillside |
| `?act=surface&scenario=forest` | deep in the violet thicket |
| `?act=surface&scenario=inventory` | the inventory window and the arm's matter compiler with a queue |
| `?act=surface&scenario=factory` | round 2: miner, belts, furnace, assembler running; pad half built (`&t=30`) |
| `?act=surface&scenario=blueprint` | round 2: blueprint mode, a hub, three builder drones, a queue of ghosts |
| `?act=surface&scenario=combat` | dev: an attack wave of all six hive species and the round 2 rifle and shotgun (`&auto=1` aims and fires) |
| `?act=surface&scenario=oldkit` | dev: the round 2 kit (rifle, shotgun), used by the interface test |
| `?act=surface&scenario=ruins` / `base` / `hive` | at an alien ruin, a locked-down outpost, an alert hive mouth |
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
| A/D move, W or Space jump, Shift sprint, hold Space in the air for the jetpack (with the reactor on your back it only brakes the fall) | W main engines (Z lock full, X cut), A/D rotate, Q/E strafe, S retro (RCS) |
| Mouse aim (the headlamp follows; the laser swings after it, late). LMB the ship laser: it cuts ground and it is the weapon. RMB place the selected soil, basalt or iron as terrain | LMB autocannon, RMB mining laser, wheel zoom (continuous, 0.01 m/px to 1e10 m/px) |
| **E** use: at the wreck unbolt the laser, pull the reactor, open the ship hold; machine, chest or cache window, terminal, audio log, lore stone; the finished pad | M map (local, planet system, star system), Tab focus (ship, target, depot), T target |
| **Q** set the reactor down / lift it. **G** stand the laser on its legs as a turret / take it back | `,` `.` time (x2, x4 under thrust; x10 to x100,000 on rails), N prediction on/off |
| **V** (hold) gather loose matter within reach into the suit. **X** drop the selected stack at your feet | B hangar, P ascent autopilot (from the pad), L story log, F1 dev menu |
| 1-9 or wheel: hotbar slot. **I** or **Tab**: inventory and the arm's matter compiler (LMB move or drag, RMB split, Shift quick move; click a recipe to queue it, Shift x5; click a queued job to cancel) | |
| **B** blueprint mode: 1-9, 0 or wheel pick a building, LMB queue a ghost, R rotate, RMB cancel, X mark for deconstruction, T drag a terrain-clear rectangle. Robots build the queue; within 4 m the suit builds by hand | |
| **C** combat mode (the laser, or a round 2 gun if a dev scenario gave you one: RMB aim, R reload) | |
| F headlamp, L story log, Esc close window, F1 dev menu (scenarios, save, export, import) | |

## What is simulated

Round 3 (the slice):

- **The forest, in depth.** Seven parallax layers behind the play plane and two in front of it, plus the plane
  itself drawn in two passes: twelve planes with the sky. Each background layer is a ground line with its own swell,
  giant trees (the far ones several times the size of the near ones), undergrowth, a veil of fog that pools on its
  ground, and shafts of planet-light between it and the next; all of it drawn far to near into a half-resolution
  target, so distance is soft. The two front layers are out-of-focus undergrowth, hanging growth and the odd trunk
  that pass over the player. Groves and clearings are shared by all layers, so the sky and the ringed planet show
  through all of them at once; the crash site is one (the transport tore the canopy open). Every layer grows the same
  species as the play plane, from one generator (`flora-gen.js`): cap trees with buttress roots, boughs, lit gills
  and hanging threads; lantern stalks with whorls of blades and a bulb in a husk; weepers on prop roots with leaf
  masses and curtains of beaded vines; ferns, paddles, reeds, bulbs, flowers, fungi, root arches, moss, cave vines,
  glow threads, pods.
- **Wind.** One travelling field (a breeze, gust fronts that move downwind, flutter) that every plant in every layer
  samples at its own place, so a gust is seen crossing the forest. In the play plane every plant is a damped spring:
  the wind pulls it, the stem pulls back, and it leans away from whatever pushes through it (the player, animals),
  from the laser's impact, a landing, the jet. Plants scorch on hot ground; a plant whose ground is gone falls.
- **Small life.** Spores and motes that ride the wind, moths that circle the forest's lights and scatter from the
  laser, skitters that freeze and bolt for cover when you come near, long-legged browsers and lantern-floats that walk
  and drift through the background layers and run from loud noise. None of it is saved; all of it is wary.
- **The body.** The physics body is three circles on the density field, as before. On top of it nothing is a canned
  animation: each foot is planted in the world and steps, one at a time, onto the ground that is really there when
  the hip has left it behind; the pelvis hangs on a spring as high as the planted legs allow; the torso leans into
  acceleration and forward against a heavy pack; breath follows exertion; a hard landing or a bad foothold makes it
  stumble; a hand reaches for what it works on. The laser is heavy: it swings after the aim on a spring, and the
  beam goes where the weapon points, not where the mouse is. Load is physical (`mobility()` in `power.js`): with the
  reactor and the laser (178 kg) pace is 73 %, jump 57 %, and the jet gives 5.3 m/s2 against 8.7 of gravity.
- **The kit: one weapon, one reactor.** No rifle and no shotgun in the default start. The ship laser (38 kg) draws
  18 kW; the suit's own bus gives 0.4 kW, which is a thread of light that cuts nothing. The reactor gives 25 kW to
  whatever its 7 m cable reaches: from its bay in the wreck, from your back, or set down. Budgets are computed every
  step (`powerBudget`): the laser, suit charging at 3 kW. The cable is a rope that sags and lies on the ground.
- **The turret and the network.** The laser stands on its own legs (G). It then needs power (the reactor within
  cable reach) and a computer to aim it: the ship AI, over the network. The wreck's own mast reaches 9 m; the
  antenna that stands as a frame in the starting blueprint reaches 70 m (rock in the way halves it). In the network
  the ship AI fires the turret at whatever is hunting you, and the ship's robots work; outside it nothing takes orders.
- **Cutting is heavy.** The beam carves at 2.1 m/s through soft ground. What it removes is counted per material:
  75 to 100 % of it falls out of the cut as glowing loose rock, the rest is vapour. A heat field (0.25 m cells, only
  hot cells exist) takes the beam's heat, cools, bleeds into its neighbours and leaves scorch: the rock glows from
  inside, the cut edge runs molten, then cools to a dark glassy crust. Molten drops leave glowing spots where they
  land. Hot ground burns plants and the body; smoke is lit from below; the forest's small life scatters.
- **Loose matter.** Everything that lies in the world is one kind of body (`matter.js`): rock from the cut, what a
  cut plant or a dead animal leaves, what you drop (X), what the arm prints when the suit is full. Bodies have mass,
  roll, pile, come to rest and merge into heaps. Nothing enters an inventory by itself: you gather by hand (V, 28
  kg/s, and it loads you down), or the ship's robots winch it up and carry it. Too-hot rock cannot be picked up yet.
- **Ecology, not enemies.** Every species has a size, a diet and a temper, and `stance()` (pure, tested) decides
  from those: a predator bigger than you that eats meat hunts you (the stalker: it stalks in the dark, stops when the
  lamp is on it and you face it, charges, and runs when it is badly hurt); everything else is wary (the strider
  herds with their calves, the grazer, the jelly): it watches, keeps its distance, runs from you and from noise, the
  herd going as one a moment apart, and strikes back only when hurt or cornered. The hive species act on the hive's
  orders: with none they are wary too.
- **The hive stirs.** It hears the cutting (the laser is heard at 109 m). A stirring hive sends a scout or two to
  look: they come to the noise, watch, and go home; if they saw you its alert jumps. Only an alert hive, or one whose
  animals you hurt, answers with an attack wave.
- **Demand and supply.** The ship AI keeps target levels (iron 30 kg, power cells 2, oxygen cells 2). Under target
  is demand. `planDemand` (pure, tested) orders each from the best producer that stands: the machine that
  specialises in the recipe if there is one, else the arm (the suit's matter compiler, 8 times slower). The arm is
  queued directly when the suit holds the inputs; otherwise robots bring them. A furnace gets ore carried in and its
  iron carried out to the ship hold. Loose ore and organics go to the hold, spoil to the hold up to a level and then
  to a heap. Robots carry 60 kg in a net that swings, slower the heavier it is.

From round 2, unchanged unless noted:

- Terrain: a density field at 0.125 m (64 x 64 chunks, one density byte and one material byte per sample),
  generated on demand as a pure function of (x, y, seed) and drawn by one shader from a linear-filtered window, so
  the surface is a smooth iso-line at any zoom. Digging and placing are circular brushes with soft edges; materials
  blend at their borders. Every brush reports the kilograms it moved, per material (1 m2 of basalt is 58 kg).
  Round 3 adds wet glints, roots in the soil, ground mist, and lighting that follows the surface on slopes.
- Light: an RGB light map at 0.5 m, flood-propagated from flora, glyphs, ore, lava, machines, beams, hot rock and
  the reactor; a 96-ray headlamp cone that also shapes the volumetric haze (now soft at its edges).
- Items are continuous amounts: bulk in kg, fluids in L, discrete things one each with a mass. The suit frame
  carries 600 kg, and every kilogram slows you. The suit has a battery (Wh), oxygen (kg) and jet propellant (kg).
- The arm prints every recipe, 8 times slower than the machine that specialises in it (180 W). Machines work on
  real amounts per second: the miner outputs exactly the ore its bit removed, the furnace smelts continuously
  (biomass in the firebox makes it 2.5 times faster and dirtier), the assembler runs batches.
- Blueprints and builder drones: ghosts with rotation and cost, a queue, deconstruction marks, terrain-clear
  rectangles. A hub is also a 45 m network relay.
- Noise and pollution: every loud thing emits noise with a radius in metres that fades in seconds; machines and
  cutting emit pollution that accumulates in 8 m cells, spreads and decays slowly. Hives raise their alert from both.
- Six hive species (scout, swarmer, brute, spitter, burrower, flier), each with its own body; walkers have IK legs
  that step over the field, burrowers swim through rock and leave tunnels.
- Structures from seeded generators: alien ruins (a grammar with five style rules: halls, vaults, arches,
  monoliths, spires, glyph lights, lore stones, caskets), hives (chambers, tunnels, egg sacs, a heart that can be
  killed), and human outposts and research facilities under lockdown (blast doors, emergency lights, dead sentries
  and turrets, a breach with hive growth, terminals, audio logs, caches). Facilities go dark as the hivemind spreads.
- Saving: autosave every 30 s, when the page is hidden or closed, and on act switch. Terrain is saved as the edited
  chunks only (run-length encoded); plus player, suit, inventory, the arm's queue, the kit (where the laser and the
  reactor are), the ship hold, every loose body, stock targets, machines and their buffers, chests, blueprints,
  robots and their loads, kills, site state, hive alert, pollution, story beats seen, and the space state.
  `src/save.js` is the only module that touches storage, through an adapter `{ load(slot), save(slot, blob), list() }`
  and a versioned schema: version 3, with a migration from round 2's version 2 (the laser drill item becomes the
  kit on your back; tested).
- Death: until you build the bio-printer, dying restarts you at the crash site; once it exists you respawn there.
  Your body and inventory stay where you died, and so do the reactor and the laser: go and get them.
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

`src/core.js` (G, events, input, hashing), `src/render.js` (renderer, post, sprite batch and its shapes, render
targets, particles), `src/items.js` (items, inventories, recipes, the arm), `src/icons.js`, `src/ui.js`,
`src/save.js`, `src/story.js`, `src/audio.js`, `src/hud.js`, `src/test.js`.
`src/surface/`: `gen.js` (pure generation), `world.js` (density field, brushes, queries), `terrain.js` (shader),
`light.js`, `heat.js` (the heat field), `flora-gen.js` (species, wind, the shared plant draw), `flora.js` (the play
plane), `backdrop.js` (sky, seven layers behind, two in front, background animals), `life.js` (motes, moths,
skitters), `player.js` (body and rig), `power.js` (pure: power budget, network reach, load), `kit.js` (laser,
reactor, turret, cables, the wreck), `matter.js` (loose bodies), `supply.js` (stock targets, demand, carrying jobs),
`creatures.js` (species, `stance`, herds), `env.js` (noise, pollution), `hive.js`, `structures.js` with
`ruins-gen.js`, `hive-gen.js`, `base-gen.js`, `sites.js`, `factory.js`, `blueprint.js`, `robots.js`.
`src/space/*` (orbit, ship, belt, combat, view). `tools/check.mjs`, `tools/ui-flow.mjs`, `tools/shot.mjs`.
Plan, decisions and lore notes: `PLAN.md`. Leif's round 3 asks: `docs/ROUND3.md`. Check result and proof shots:
`docs/CHECK.md`, `docs/shots/`.

## Licence

Apache-2.0, see `LICENSE`. Dependencies: three (MIT), vite (MIT, build only), puppeteer-core (Apache-2.0, check only).

## Cut or simplified (said plainly)

- Round 3 is the slice and the core mechanics that needed no design decision. **Not built**: the engine rewrite
  (ECS / systems scheduling), a rigid-body engine with constraints, ragdolls, gore and fluid splatting, radar and
  fog of war, more weapons, the mech suit, the loadout body view, and everything that waits for the design document
  (the advanced species, Earth, the campaign clock, endings, balloon and interstellar logistics).
- The robots are still the flying drones of round 2 with a net under them; there is no ground hauler. They winch a
  chunk up from wherever they can see it, and skip what lies under an overhang. Their route finding is "go over it".
- Only the laser and suit charging are on the power budget; machines still run without power. The network is range
  with rock halving it, not a traced line of sight; the turret's only controller is the ship AI.
- Stock targets are shown in the HUD and saved, but there is no window to edit them yet.
- Heat acts on terrain, plants, the body and loose rock; not yet on machines or animals (those burn in the beam only).
- The background animals, moths, skitters and motes are not simulated creatures: they cannot be hurt, and are not
  saved. Creatures in the play plane are not saved either (as in round 2).
- The backdrop is half resolution by design (soft distance). Frame times in `docs/CHECK.md` are software rendering;
  the slice has not been measured on a GPU.
- Loose bodies are circles, not rigid polygons; heaps are merged bodies drawn as several rocks.
- Surface: no water, no weather beyond fog, no day cycle (always night), no world wrap, no power grid or inserters
  (belts feed machines directly), one generic rocket part, no food or water, no gamepad. Machines stand on a 0.5 m
  placement grid and do not block the player. Rock the miner removes is tailings and is not kept.
- Combat mode: the ship laser is the weapon. The round 2 rifle and shotgun exist only in dev scenarios. Dead turrets
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

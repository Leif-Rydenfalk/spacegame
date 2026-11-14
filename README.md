# spacegame, demo 1 (round 5: what exists works when you play it by hand)

Round 5 is a robustness round (Leif's words after playing round 4 are in `docs/ROUND5.md`). Nothing new was added
to the world; six things that were there were made to hold:

1. **The body and the ground.** The body is felt at eighteen points on its outline and moved in steps of at most
   8 cm, so no speed carries it through a floor, and ground that was cut, filled or built on holds exactly like
   ground that was never touched. (The real fault was in the field: a brush only wrote the samples it covered, so
   worked ground stopped being a distance field and everything that asked it "how far is the rock" got a wrong
   answer. Every edit now repairs the field round itself.)
2. **Layers.** Decks are a passable layer in front of the rock: you land on one, jump up through it, and hold **S**
   to drop through, so a shaft has as many floors as you lay. Behind the rock is the back wall: cut anything away
   and darker rock shows behind it, never the sky.
3. **Rock.** Loose rock is rigid convex bodies in one solver: contacts with the ground and with each other,
   friction, a little bounce, rest and sleep, and fracture: a hard landing splits a rock into smaller rocks whose
   masses add up to the parent's exactly.
4. **Robots.** A drone plans a way through the air round what is in its way, says what it is doing and for what
   (over its head and in the list), reserves what it goes to fetch, notices when it gets nowhere, plans again, and
   after four tries gives the job up and goes home instead of pushing at a wall.
5. **One inventory, as in Factorio.** A furnace is an item. You craft it into a slot (the arm, slowly) or the base
   makes it; with the slot selected the left button puts it down and the item is gone.
6. **Blueprint mode is Tab.** The same items and the same cursor; what you hold is still placed, what you do not
   hold goes down as a ghost, drawn as a ghost, and the ship AI has it made, carried and built. What you cannot
   make yet is not shown, in the crafting menu or in the plan row.

`node tools/play.mjs` plays all of that from a fresh start with real keys and a real mouse and fails if any of it
does not hold. The rest of this file is the earlier rounds' text, updated where round 5 changed it.

## Round 4: a whole planet, and a base that builds itself

Round 4 does two things (Leif's words are in `docs/ROUND4.md`). **The world is a whole round planet**: the ground
closes on itself, gravity points at the centre for every body, the camera turns with it so down is always the bottom
of the screen, you can walk or jet all the way round and come back to the wreck, the hive's main base is on the
antipode, and the view zooms without a cut from the body to the whole disc with its limb of air. **And the base runs
itself**: you place a frame, anything, anywhere, with no kit in your hands; the ship AI orders the kit, has it made by
whatever can make it (the wreck's fabricator, a built assembler, the arm on your suit), has it carried and built by
the robots, in a queue it orders by what helps the base expand and then by what you placed first, and that you can
reorder. It moves everything else the same way: robots where that is enough, a conveyor it lays itself where the
route is worth one, and it says why. The rest of this file is round 3's text, updated where round 4 changed it.

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
node tools/ui-flow.mjs   # headless, real mouse and keys: inventory, arm, blueprint, the round 3 kit, placing, title, save, continue
node tools/play.mjs      # headless, the game played by hand from a fresh start (round 5): falls, cutting, rock, crafting, placing, decks, Tab, drones
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
| `?act=surface&scenario=planet` | **round 4**: zoomed all the way out: the whole planet, the limb, the giant behind it |
| `?act=surface&scenario=horizon` | round 4: thirteen times out, the ground is a curve |
| `?act=surface&scenario=far90&auto=1` | round 4: 95 degrees east of the crash site and walking on; the camera has turned with gravity |
| `?act=surface&scenario=seam&auto=1` | round 4: walking west across the place where the two charts of the planet meet |
| `?act=surface&scenario=antipode` | round 4: the far side: the mouth of the hive's main base |
| `?act=surface&scenario=autobuild` | round 4: four frames placed with no kit anywhere; the AI has them made, carried and built (`&t=75`) |
| `?act=surface&scenario=queue` | round 4: the same, with the ship AI window open: build queue, logistics, stock targets |
| `?act=surface&scenario=conveyor` | round 4: a furnace and an assembler on level ground: the AI lays the belt; a far furnace gets robots (`&t=40`) |
| `?act=surface&scenario=overhang` | round 4: ore under a ledge: the ground hauler walks in (`&t=9`) |
| `?act=surface&scenario=targets` | round 4: the stock-target editor |
| `?act=surface&scenario=fall` | **round 5**: a fall into a shaft with two decks in it: you land on the first (S drops you to the next) |
| `?act=surface&scenario=layers` | round 5: decks at three heights in a cut shaft, and the back wall behind everything that was dug |
| `?act=surface&scenario=rocks` | round 5: 120 rocks let go over a hollow: they fall, break, pile up and lie still (`&t=16`) |
| `?act=surface&scenario=place` | round 5: a furnace in slot 1, on the cursor: click and it stands, and the slot is empty |
| `?act=surface&scenario=plan` | round 5: blueprint mode, the plan row, ghosts the ship AI builds (`&t=45`) |
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
| A/D move, W or Space jump, Shift sprint, hold Space in the air for the jetpack (with the reactor on your back it only brakes the fall). **S** drop through the deck you stand on | W main engines (Z lock full, X cut), A/D rotate, Q/E strafe, S retro (RCS) |
| Mouse aim (the headlamp follows; the laser swings after it, late). **LMB**: with a placeable item on the cursor, place it; with nothing on the cursor, the ship laser (it cuts ground and it is the weapon); on a machine, open it | LMB autocannon, RMB mining laser, wheel zoom (continuous, 0.01 m/px to 1e10 m/px) |
| **RMB** take back: cancel a ghost, mark a machine to be taken apart (the suit does it within 4 m, robots anywhere), lift a deck; anywhere else, lay the selected soil, basalt or iron as ground | M map (local, planet system, star system), Tab focus (ship, target, depot), T target |
| **E** (or I) inventory and crafting: LMB move or drag, RMB split, Shift quick move; click a recipe to craft it into the inventory on the arm (Shift x5), click a queued job to cancel, RMB a placeable recipe to plan it. Only recipes whose inputs you have seen are shown | `,` `.` time (x2, x4 under thrust; x10 to x100,000 on rails), N prediction on/off |
| 1-9 or wheel: hotbar slot. A slot with a machine, a belt or a deck in it puts that on the cursor. **Q** pipette: what is under the cursor goes on the cursor (the slot that holds it; in blueprint mode a plan if you hold none); on nothing, clears the cursor. **R** rotate (belts) | B hangar, P ascent autopilot (from the pad), O story log, F1 dev menu |
| **Tab** (or B) blueprint mode, for planning. The hotbar stays; a dashed row above it lists everything you can make. LMB: what you hold is placed, what you do not hold becomes a ghost and an order for the ship AI. **T** drag a rectangle of ground for the robots to cut. Tab again leaves | |
| **F** use: at the wreck unbolt the laser, pull the reactor, open the ship hold; a machine, chest or cache, a terminal, an audio log, a lore stone; board the finished rocket | |
| **X** set the reactor down / lift it. **G** stand the laser on its legs as a turret / take it back. **V** (hold) gather loose matter within reach. **Z** drop the selected stack | |
| **C** combat mode (the laser, or a round 2 gun if a dev scenario gave you one: RMB aim, R reload) | |
| **J** the ship AI: build queue (arrows reorder, x cancels), logistics with the reason for every route, what every robot is doing, stock targets (+, -, x, and a grid to add more). **M** out to the whole planet and back; **-** and **=** zoom | |
| **L** headlamp, O story log, Esc close window, F1 dev menu (scenarios, save, export, import) | |

Keys that moved in round 5, and why: **Tab** was the inventory and is blueprint mode (Leif's ask); **E** was "use" and
is the inventory (Factorio), so use is **F**; the headlamp went from F to **L** and the story log from L to **O**;
**Q** was the reactor and is the pipette, so the reactor is **X**; drop went from X to **Z**; marking a machine for
deconstruction was X in the old blueprint mode and is the right button. B and I still work as second keys for Tab and E.

## What is simulated

Round 5, robustness:

- **The field stays a distance field.** The terrain is a byte of signed distance per 0.125 m sample (saturating at
  half a metre) and a byte of material. A brush (`world.shape`) writes only the samples it covers; one step outside
  a filled floor the old value still said "half a metre from anything", and beside a fresh cut the rock still said
  "deep inside". `redist` (in `world.js`) runs after every edit over the edited box and five samples round it: the
  samples that carry the surface (within half a sample of it, or next to a change of sign) are kept bit for bit, so
  the iso-line and the mass in every sample are unchanged; every other sample gets the chamfer distance to them. A
  test reads the field 0.1 to 0.4 m off a filled floor and off a dug hole (error under 3 cm) and adds the mass up.
- **The body.** `player.js`: a capsule 0.6 m wide and 1.8 m tall, felt at eighteen outline points (five under the
  feet, ten up the sides, three over the head). A point inside rock is pushed out along the field's gradient there,
  deepest first, up to five times a step. Ground under a foot point that is walkable (normal within 45 degrees of
  up) lifts the body straight up, so standing on a slope does not creep; a low step or a steep bank the legs can
  take is stepped onto when you push into it; anything else is a wall or a slide. The move is cut into steps of at
  most 8 cm (60 m/s at 120 Hz is seven of them). The last free position is remembered: a body that ends up more
  than 0.2 m deep all the same (ground laid on top of it) goes back there. A body that has stopped with a foot on
  a steep hold, or with rock against both sides (wedged in a cut 0.9 m wide), or that gravity has simply not
  moved for a quarter of a second, counts as standing: it can jump and climb out instead of hanging there. The two layers of forest in front of the play plane fade when the camera
  goes below the ground, so down a shaft you see the shaft. Tests: terminal velocity onto a floor
  half a metre thick, 60 m/s sideways into a wall half a metre thick, terminal velocity onto a deck, and onto ground
  dug a moment before.
- **Decks** (`layers.js`). A deck is grating at the top of one 0.5 m cell, kept in its own sparse map, drawn in
  front of the rock. It is one-way: the body lands on it when its feet cross the deck's height going down, passes
  it going up, and ignores it while S is held. It needs support (rock or a deck beside it, rock or a deck under it),
  machines can stand on it, loose rock falls through the grating. An item: 2 kg of iron makes four. Saved.
- **The back wall** is a bit in the material byte (`WALL`). It is set for rock deeper than 0.45 m under the
  surface and for rock laid down as part of the world (the outcrop of the slice), never changed by digging, and so
  saved with the terrain. The shader draws it wherever the sample is air: the rock's own texture, darker, lit by
  the light map plus a small floor of its own, so a cut with no lamp in it is still rock and not a hole in the
  picture. Ground you lay by hand in the open has no wall behind it.
- **Rock** (`matter.js`). Every loose body (cut rock, ore, a dropped kit, biomass) is a rigid convex polygon: a box
  with four chamfered corners, eight vertices, sized so its area times the 2 cm slab times the density is its mass;
  the renderer draws the same polygon (sprite shape 14), so what you see is what collides. Per 120 Hz step, up to
  four sub-steps when something is fast: gravity; contacts (each vertex and the midpoints of the long sides against
  the field; polygon against polygon by separating axes with a clipped two-point manifold; a 1.6 m grid as broad
  phase); eight iterations of sequential impulses with Coulomb friction 0.65, restitution 0.18 above 1.2 m/s, and a
  speculative margin against the ground; overlap is taken out of positions, not speeds, so a resting pile gains no
  energy; angular damping in contact. A body slower than 0.15 m/s for 0.4 s, or wedged in place for a second,
  sleeps: it costs nothing and is solid to the others. It wakes when the ground beside it is edited, when what it
  leans on is taken or wakes after losing its own support, or when it is hit. **Fracture**: the largest normal
  impulse a body took in a step, over its mass, is a change of speed; over 5.5 m/s + 30 / kg (a 60 kg rock: a 2 m
  fall; a 4 kg one: hardly ever) the rock splits across its long axis into two pieces, three if the blow was much
  harder, each a new body with the parent's outer corners and fresh ones along the break, amounts adding up to the
  parent's to the last bit. Kits and organic matter never break. Above 260 bodies, resting gravel of one kind that
  touches merges into heaps so the count stays bounded. Radial gravity comes with the polar field: -y is toward the
  centre everywhere. Measured on this VM (software GL, one core): 120 rocks dropped at once, 250 bodies after
  breaking, 0.7 ms a step on average, all asleep by 14 s.
- **Robots** (`robots.js`, `nav.js`). The job states are what they were (idle, fetch, go, work for the build
  queue; cfetch, cgo for carrying; haul to unload; charge), and each has one exit when it fails. New: *the way*: a
  drone flies straight when the line is free and otherwise along an A* path through the air on a 0.25 m grid
  (bounded search, corners cut where the line is free), replanned when the target moves; the rock pushes it off
  before it touches and it is never inside it. A cut the laser made (0.9 m wide) can be flown, so a drone goes into
  a cavity for a rock that lies under a ledge; what it finds no way to is left to the hauler for four minutes. *Stuck*: every 1.5 s it checks that it got nearer; if not it plans
  again; after four times, or three searches with no way, or 75 s on one leg whatever the reason, it gives the job up,
  leaves that target alone for 25 to 40 s (so the hauler or another drone can try) and goes home. The ground
  hauler, which walks the rock and so can walk into a cave and not find the way out, gets the same net: 55 s on
  one leg or two failures running, and it folds its legs and jets back to the wreck on its lift thrusters.
  *The hold is finite* (24 slots): nothing is carried to it that it has no room for (it used to be set down at
  the hatch and carried again, for ever); the HUD says when the hold is full. What a robot cannot unload is set
  down beside it, never lost. *Reservations*: a kit a drone is on its way to fetch
  stays promised to it across planning rounds; a ghost, a loose body and a machine input each have one taker.
  *Intent*: over every working robot, in the HUD list and in the J window, one line: "fetching iron ore for the
  hold", "carrying the chest to the site", "building the chest 40%"; a row of marks runs to its target. A drone
  tops up from neighbouring pieces of the same stuff before it flies back. What the suit holds is the player's: the
  AI no longer prints stock-target goods on the arm from it (it still does for something you planned), and a robot
  with leftovers unloads into a store, not into your hands.
- **Inventory and placing** (`blueprint.js`, `ui.js`). One slot holds one stack of one item. Machines, belts and
  decks are items with a recipe; the arm crafts them into the inventory (eight times slower than the machine that
  specialises in it), the wreck's fabricator and assemblers make them for the base. The selected slot is the
  cursor: LMB places within 8 m and takes one from the stack. In blueprint mode (Tab) the cursor can also be a plan
  picked from the dashed row, by Q, or by RMB on a recipe: if you hold the item the click places it, if not it puts
  down a ghost (a blue hologram in a dashed frame with corner marks, an amber dot once its item is on site), which
  is an order in the ship AI's queue (round 4). Placing the item on its own ghost builds it. **What is shown**: a
  recipe appears in the crafting menu, and its product in the plan row, when every input has been in your hands or
  in the base's stores (`S.known`, saved). At a fresh start that is what iron and copper make; the furnace appears
  when you first pick up basalt, the hub with the first lumen.


Round 4, the planet:

- **Geometry.** The density and material field is stored in polar coordinates (`gen.js`, `planet.js`): x is arc
  length along the datum circle, y is altitude above it; a sample is 0.125 m at the datum; chunk columns are counted
  modulo the circumference, so x and x + 4,032 m are the same place and chunks are still generated on demand. The
  planet is 4,032 m around (56 site slots of 72 m, 504 chunks of 8 m), radius 641.7 m: a playable scale, about
  1 : 8,100 of the home moon the orbital act flies around (5,200 km), with the real g (8.7 m/s2) kept and shown. The generators
  are noise along x, which does not close by itself: over the last 96 m before the seam (a quarter turn west of the
  crash site) every field cross-fades into its own continuation, so there is no step (tested).
- **Gravity** is -y in those coordinates, which is toward the centre everywhere, for the player, creatures, loose
  matter, robots, particles and projectiles alike; plants stand along local up because the renderer puts every
  sprite where it really is. `planet.toCart`, `gravity` and `up` give the Cartesian picture, and the tests check that
  a body let go a quarter and a half of the way round falls at the centre.
- **The camera** looks along local down. Every sprite is placed by the vertex shader at its true position in a frame
  turned so that the camera's up is the screen's up (`uBend` in `render.js`); the terrain shader does the inverse per
  pixel; the parallax layers are drawn flat into their target and read through the same map, so they bend with the
  ground; the mouse is mapped back through it. Close up the ground is nearly flat (0.5 m of drop at the edge of the
  screen); **-**, **=** and **M** zoom out without a cut: at 13 times the horizon is a curve, at 104 times the whole
  disc is on screen and the camera has moved to the centre. Outside the 96 x 54 m density window the shader draws
  the planet from a profile (ground height, biome, lushness and sites, one texel per 2 m): soil over basalt over
  obsidian, the crust warming toward a dull core, the forest as a dark glowing band, hives and bases as their own
  light, the air as a thin limb. The sky turns against the camera: the ringed giant stands over the crash site and
  has set by the time you reach the far side. The HUD has a longitude strip and the planet with you on top of it.
- **Two charts.** A periodic x needs a seam somewhere; it is kept away from the player. Chart 0 holds x in
  [-1008, 3024), chart 1 holds [-3024, 1008); the half of the planet around the crash site has the same coordinates
  in both, so home never moves. When the player comes within 400 m of the current seam everything on the far half
  is re-expressed (x +- 4,032): player, camera, feet, creatures, robots, loose matter, machines, ghosts, the kit.
- **Layout.** Ruins, hives, outposts and labs stand in the 56 slots round the circumference (the first hours' sites
  are where round 3 had them); the hive's main base, deeper and with twice the chambers, is on the antipode.
- **Launch.** The pad's longitude goes to the orbital act: the rocket stands where the pad really is on the moon.

Round 4, the automation loop (`auto.js`, `supply.js`, `robots.js`):

- **Place anything.** A frame costs nothing to place and needs no kit in your hands. Every frame is an order.
- **The queue.** Orders are served by what helps the base expand (network and robots, then mining, smelting,
  assembly, storage, belts, the rest), then in the order you placed them (`queueOrder`, pure, tested). The ship AI
  window (J) lists the queue with a reason on every line (who is building it, who is making the kit and how long is
  left, which raw material is short and by how much, no free robot, outside the network) and has arrows that move an
  order up, down or to the front, and a cancel.
- **Every means.** `planAll` (pure, tested) meets the queue's kits first and the stock targets second from what is
  in stock; what is missing is ordered from the best producer that stands: the machine that specialises in the
  recipe; else the wreck's fabricator, which works straight from the ship hold, three times slower; else the arm on
  the suit, eight times slower. If the hold lacks the inputs and the suit holds them, the arm gets the job. Each
  producer's inputs become demand in turn, down to raw matter; what nobody has is named as the bottleneck. What an
  earlier order still waits for is kept for it: a cheaper, later order does not eat the iron first. Robots carry the
  kit to the frame and build it; within reach, the suit builds by hand.
- **Logistics.** Every steady flow (a machine's output to the machine that consumes it, else to the hold) is weighed
  by `chooseRoute` (pure, tested): robots (trip time there and back at loaded speed, 60 kg a trip, the share of the
  fleet the flow would take, watt-hours per kilogram) against a belt (cells to build, iron, 40 W a cell, whether the
  line between is level and free, whether a hive is awake beside it, whether the grid has the power). When the belt
  wins the AI queues the belt frames itself; they go through the same queue; a finished belt takes the flow and the
  robots leave it alone. A belt that ends at the wreck's intake feeds the hold. The reason for every choice is on
  the HUD and in the window; robot routes are drawn as moving marks.
- **The ground hauler.** The wreck releases two drones and one six-legged hauler. It walks the surface it holds on
  to (down into a cut, along a wall, under an overhang), carries 150 kg, fills its bed from pieces lying together,
  and takes the loose matter no drone can drop a line on.
- **Power.** Machines are on a budget: the wreck's auxiliary bus (4 kW) and the reactor (25 kW, less what the laser
  takes) when it is in its bay, set down, or on your back within 26 m of the grid. The grid grows from the wreck
  through every machine within reach; loads are served in the queue's priority (`powerBudget`); a starved machine
  runs slower in proportion, a belt too, and a machine off the grid stops. Carry the reactor off to cut rock and the
  base runs on 4 kW.
- **Stock targets** are edited in the same window: plus, minus (shift x5), remove, and a grid of everything that can
  be kept in stock as well.

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
  and a versioned schema: version 5 (round 5 adds decks, the seen-items list and the shape and pose of loose bodies; a version 4 save loads: `tools/fixtures/save-v4.json` is one, written by the round 4 build, and the check loads it), with migrations from round 2's version 2 (the laser drill item becomes the
  kit on your back; tested) and round 3's version 3 (a flat world maps onto the planet: x is still metres from the
  crash site, edited chunks are folded onto the circle).
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
`src/surface/`: `gen.js` (pure generation, the planet's size and seam), `planet.js` (charts, Cartesian maps, the
camera's map), `auto.js` (the ship AI's planner: queue, demand, routes, power), `world.js` (density field, brushes,
queries), `terrain.js` (shader),
`light.js`, `heat.js` (the heat field), `flora-gen.js` (species, wind, the shared plant draw), `flora.js` (the play
plane), `backdrop.js` (sky, seven layers behind, two in front, background animals), `life.js` (motes, moths,
skitters), `player.js` (body and rig), `power.js` (pure: power budget, network reach, load), `kit.js` (laser,
reactor, turret, cables, the wreck), `matter.js` (loose bodies), `supply.js` (stock targets, demand, carrying jobs),
`creatures.js` (species, `stance`, herds), `env.js` (noise, pollution), `hive.js`, `structures.js` with
`ruins-gen.js`, `hive-gen.js`, `base-gen.js`, `sites.js`, `factory.js`, `blueprint.js` (placing, ghosts, blueprint
mode), `layers.js` (decks), `robots.js`, `nav.js` (the drones' path search).
`src/space/*` (orbit, ship, belt, combat, view). `tools/check.mjs`, `tools/ui-flow.mjs`, `tools/play.mjs`,
`tools/shot.mjs`, `tools/fixtures/save-v4.json` (a save written by the round 4 build, loaded by the check).
Plan, decisions and lore notes: `PLAN.md`. Leif's asks: `docs/ROUND5.md`, `docs/ROUND4.md`, `docs/ROUND3.md`. Check result and proof shots:
`docs/CHECK.md`, `docs/shots/`.

## Licence

Apache-2.0, see `LICENSE`. Dependencies: three (MIT), vite (MIT, build only), puppeteer-core (Apache-2.0, check only).

## Cut or simplified (said plainly)

Round 5:

- **Rock breaks, the ground does not fall.** Loose rock fractures on impact. The terrain itself is still only cut by
  the laser, the miner and the robots: an overhang you undercut stays up; there is no collapse of unsupported
  ground into rubble. The laser does not split a loose rock it sweeps over either.
- The rock solver has no warm starting and treats a sleeping body as fixed. Tall thin stacks are softer than in a
  full engine; piles, which is what cutting makes, settle and stay. The body shape is one family (a chamfered box),
  so a break is always across the long axis, never a diagonal shard. The player and the creatures do not collide
  with loose rock (you walk through a pile, as before); rock falls through decks.
- The body is felt at points, not as a swept shape: a spike of rock thinner than the gap between two outline
  points (about 0.3 m) can reach in between them. The step limit and the last-free-place rule keep it from ever
  ending inside the ground. There is no jet downward; S only lets go of a deck.
- Decks carry you and machines, nothing else: robots fly through them, the hauler does not walk on them, creatures
  ignore them. A deck may be laid wherever it has support; it has no strength limit.
- The drones' path search is bounded (10 m of margin round both ends, 26,000 nodes): a way that needs a longer
  detour than that is "no way", and the job waits for the hauler or for you. The hauler's own walk is round 4's
  wall-following; what is new is that it notices when it is lost and jets home. Robots do not collide with loose
  rock or with each other.
- "What you can make" is decided by what has been seen, not by a tech tree: there is no research. The wall block is
  plan-only (in the row when iron is known); by hand, iron in the selected slot is laid as plate with RMB.
- Blueprint mode has no copy, paste or stamp of several things at once: one cursor, one thing.
- The old `B` blueprint bar (number keys picking buildings) is gone; `tools/ui-flow.mjs` drives the new keys.

Round 4:

- **The simulation runs in the polar chart, not in Cartesian space.** Arc length is measured at the datum circle; a
  metre along the ground at altitude h is really (R + h) / R metres, 8 % more at +50 m and 8 % less at -50 m. A round
  brush is therefore slightly oval in true space, and horizontal speed scales the same way. The planet does not
  rotate, so there are no Coriolis terms. The body's jet does not reach orbit: the launch is still the pad.
- The planet is small (4 km around) and its interior is drawn, not simulated: below the generated crust the far
  view shows a painted mantle and core. Zoomed out past about four times, ground outside the density window comes
  from the profile: caves, cuts and buildings there are not shown; sprites fade out between 7 and 12 times, and
  beyond that the HUD marks you, the wreck, outposts and the main hive.
- The parallax layers are not periodic: after a full lap the trees behind the crash site are different trees (the
  play plane, the groves and the sky are the same). The sky's turn is a 2D convention (a pivot under the horizon).
- Things on the far half of the planet jump by one circumference in the chart when it switches; a creature or a
  robot that is exactly on the seam at that moment may lose its target for a step. Pollution does not diffuse
  across one fixed column. Sites far from the crash site are not where a round 3 save had them (the slots now close
  round the planet and the main hive took the antipode); edits a round 3 save made out there stay in the rock.
- Belts run level only, so the AI lays one only between two ends on the same row with free, supported cells
  between; it does not grade terrain for a belt, and it does not take a belt up again when a flow dies.
- The route model uses nominal rates (a furnace's smelting rate, an assembler's batch mass per batch time), not a
  measured throughput; danger is one test (an awake hive within 70 m of the line).
- The power grid is reach-based (26 m from node to node), not cabled; the wreck's fabricator is not on it.
- The ground hauler follows the surface greedily and tries the other way round when it makes no way; it has no path
  search, does not build, and can be beaten by a maze. Drones still fly over.
- Mining raw ore is still yours (the laser) or a miner's: the AI names the shortage, it does not go and cut rock.
- The launch carries the pad's longitude into the orbital act; the view still switches at ignition.
- Frame times are software GL; the terrain shader now evaluates the sky per pixel at full resolution.

Round 3 and before:

- Round 3 is the slice and the core mechanics that needed no design decision. **Not built**: the engine rewrite
  (ECS / systems scheduling), a rigid-body engine with constraints, ragdolls, gore and fluid splatting, radar and
  fog of war, more weapons, the mech suit, the loadout body view, and everything that waits for the design document
  (the advanced species, Earth, the campaign clock, endings, balloon and interstellar logistics).
- The drones winch a chunk up from wherever they can see it; what lies under an overhang is the ground hauler's.
- The network is range
  with rock halving it, not a traced line of sight; the turret's only controller is the ship AI.
- Heat acts on terrain, plants, the body and loose rock; not yet on machines or animals (those burn in the beam only).
- The background animals, moths, skitters and motes are not simulated creatures: they cannot be hurt, and are not
  saved. Creatures in the play plane are not saved either (as in round 2).
- The backdrop is half resolution by design (soft distance). Frame times in `docs/CHECK.md` are software rendering;
  the slice has not been measured on a GPU.
- Loose bodies are circles, not rigid polygons; heaps are merged bodies drawn as several rocks.
- Surface: no water, no weather beyond fog, no day cycle (always night), no inserters
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

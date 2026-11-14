# spacegame: plan for Leif's review

Author: Fable 5.1 (lead designer and architect lane), 2026-11-14. Status: PLAN, nothing built. Start fresh.

Two things in one document: **A** the first demo (one HTML page, feel and gameplay first), and **B** the final
architecture (spacegame as the scalability test of ce-net: cells, Twinton rendering, a physics engine over millions of
machines). B is noted down and not built now. **C** are the questions for Leif.

---

## Leif's words

Verbatim, 2026-11-14.

1. "make a simple webbased game that runs across 5 differetn cells as a open source demo of ce-net. continue developing
   spacegame the 2d space game i mean and turn it into a fully distribugted open source corr platform infrmte scalability
   browser game with procedural terrain and make the ship building and 1:1 orbital mechanics and asteroid mining with a
   ship map actually realistic and playable with real good physics."
2. "fous on the gameplay and playability of it and not the architectuer for now since other agents are doing that. and
   focus also on the graphics and making it very nice to play. its a massive scale rpg where you build ships and factories
   like factory but on a planetary scale and start on a alien planet. ive written a lot of storyfor it. i want the start
   to play like terraria but with realistic physics and set in a dark scary alien world like avatar where you setup
   everything and build factories first manually and then autoamte more and more of the process tnhen once you reach
   space it plasy top down and u mine asteroids, setup mining platforms and orbital debots and supply chains between
   planets completely automatically building new ships in your fleet. start fresh. i want to see in the demo the building
   mechanics, the realistic physics and the asteroid mining and the bullet and combat system in a satisfying realistic
   way. it msut look realistic and even though its 2d it cannot feel cartoony it must look very cool and stylized and
   artistic with heavy realistimand details and physics must be amazing and sdcalable across the solar system. look at
   maps.ce-net.com this is the scalability we should bring"
3. "it should use the distribute rendering engine of twinton ti scale across many many devices and showcase its ability
   and dynamic rendering fucntionality. use fable 5.2 to plan this and what we need to add and refine in the twinton
   rendering systems and physics systems. spacegame is a test of ce-net to test its scalability, draw attentin to the
   architecture, make it robust weher every machine is an actual amchine in the real world, test the physics engine and
   how it scales across millions of devices and test the rendering engien and scale and story and dynamic nature of the
   game engine we buuild on top of the red nenring engine. all as cells. note this down for the final arhcitecture and
   what we achifeve. but righ now keep it simple for the first demo and focus on the feeliong and gameplay of it and
   makei tone html file or very minimal."

What I take from them, in order of priority for the demo: feel and playability; graphics that read as real (dark,
detailed, stylised, never cartoon); realistic physics on the surface and 1:1 orbital mechanics in space; building,
mining, combat visible in the demo; one HTML file or very few files; architecture written down, not built.

---

## What is on disk (read 2026-11-14, read-only)

Measured facts, each with its ce-ref. These ground part B and some choices in part A.

| Fact | Where |
|---|---|
| A cell is a program, document or aggregator in a graph; program cells are headless typed Rust made by `cell-forge new-cell`, called with `ce cell call`, state in `state.store`. | repo:foreman/prompts (AGENTS.md section 3), repo:cell-forge/README.md |
| Twinton is "the global digital twin": real factories, fleets and cities on one globe at maps.ce-net.com, five zoom levels loaded only when reached. | repo:twinton-project/PROJECT-MAP.md |
| The Twinton rendering engine today is `globe-render` (Rust, wasm for the web): crates `globe-render-core` (the HLOD core, 250 lines so far: `lib.rs`, `wasm.rs`), `bodies-ephem`, `bodies-wasm`, `movers-format`, `movers-sim`, `movers-agg`, `osm-mesh`, `osm-mvt`, `osm-wasm`, `field-igrf`. | repo:globe-render/crates, repo:globe-render/README.md |
| HLOD contract: one node type for every domain (`id`, `container`, `frame`, f64 `centre`, `radius`, `error_m`, `proxy`, `children` Implicit/Listed/Declared), one selector over all domains with a global budget (`frame_ms, gpu_bytes, upload_bytes, draw_calls`), `priority = sse_pred x centrality x velocity`, tau controller on measured frame time, 300 ms dithered fades, exact cover (never a hole, never a double draw), runs as wasm in a worker: `frame(cams, viewport, budget, now) -> {draw, load, drop}`. Scale bands galaxy -> building are container cells; 19 decades over 10 bands. | repo:maps-ce-net/docs/HLOD.md sections 1-4 |
| Frames and precision: heliocentric ecliptic J2000, km, f64; camera-relative rendering (three computes modelView in f64 on the CPU, casts to f32) is the floating origin; a shader never forms an absolute world position; render unit 1 = 6371 km; body cells carry `radius_km, mu_km3s2`. | repo:maps-ce-net/docs/BODIES.md sections 1-2 |
| Camera: exponential zoom `distance x exp(deltaY x 0.0017)`, `minDistance_m 0.005` ("no floor to the zoom"), one scheme from street to solar system. | repo:maps-ce-net/docs/CAMERA.md |
| maps.ce-net.com tiles: quadtree `z/x/y`, a tile covers 180/2^z degrees, a leaf holds at most 1,000 twins, a fuller tile is a 16 x 16 count grid plus 4 children; `index.json` names roots and gen; written to R2 by `twin.registry` Snapshot with an HMAC ticket; cached immutable; client opens a node only while the zoom asks for it and the tile faces the camera, cache 600 tiles, loads throttled 150 ms. 1M-twin test: at most 1.21 MB loaded, 41-59 fps on a loaded box. | repo:twin-registry/docs/TILES-AND-RATES.md sections 1-2 |
| Movers/1: every moving object is simulated by its cell; viewers get only the nearby objects one by one and counts for the rest; lat/lon quadtree with u16/u16 position inside a tile; movers-sim holds 50 M agents in 2.1 GB, 96 M agent-steps/s on 4 threads, 1.27 B/object/s on the wire. | repo:maps-ce-net/docs/MOVERS.md, repo:maps-ce-net/docs/MOVERS-SIM.md |
| Planet-scale audit: today Twinton is centralised: every simulation runs on one 4-core Debian box, it publishes static JSON to one Cloudflare account on the free plan (100,000 requests/day cap, 126,894 used on 10-16), browsers poll; viewers compute nothing and serve nothing; every state.store write goes through one Postgres advisory lock; replication is multi-master LWW on a hybrid logical clock; a libp2p node (Kademlia, relay, hole punching) exists but the globe does not use it; detail is content-addressed immutable chunks by sha256. | repo:maps-ce-net/docs/TWINTON-SCALE-AND-GODS-EYE-2026-10-18.md sections 0-1 |
| Post chain and streaming exist only inside Valdrada (New York): EffectComposer with TAA, GTAO, SSGI, SSR, bloom, godrays, motion blur, DoF, LUT, grain, vignette; planned extraction into `render.light` and `stream.tiles` cells (not done). | repo:maps-ce-net/docs/GENERIC-SYSTEMS.md sections 2.1-2.2 |
| Headless Chromium measurement tools: `tools/lod-bench.mjs` (scripted camera paths, holes/double-draw/behind probes), `tools/draws-bench.mjs`, `tools/lib-browser.mjs` (2 machine-wide browser slots, waits while load >= 24); `render.still` makes one PNG of a WebGL page; `film.render` steps a page's clock 1/30 s a frame. | repo:maps-ce-net/docs/LOD-BENCH.md, repo:maps-ce-net/docs/DRAWS.md, repo:render-still/README.md, repo:film-render/README.md |
| Time is part of the twin protocol: every read takes a viewed time `t`, answers carry `basis` observed/forecast/interpolated. twin-protocol is **private** ("Dont open source it"). | repo:twin-protocol/README.md |
| Leases in state.store already exist as a pattern: `space.graph` holds `lease/writer = "<node16> <expires_ms>"` (30 s, renewed every 10 s), one replica runs the layout. | repo:space-graph/README.md |
| Precedent for a one-file page in this fleet: `sim-alien-pyramids/web/index.html`, "one self-contained page with sample data, no network". | repo:sim-alien-pyramids/README.md |
| **No physics engine exists on disk.** `ce-search "physics engine rigid body"` returns nothing relevant; the only large simulation is movers-sim (traffic on road graphs). The older spacegame (Rust, GPU shape-matching rigid bodies, points-and-beams, load-partitioned quadtree, LIVING-GALAXY mandate) is on another machine and is context only. | ce-search 2026-11-14; `ls ~/dev` |

Everything in part B marked **guess** is my design, not something measured.

---

## A. Demo 1: one page, feel first

### A.0 Shape of the deliverable

- `index.html` plus ES modules in `src/` (one file per work unit, so ten agents never edit the same file), **no build
  step**, no dependencies, no network. Served with any static server during development (`python3 -m http.server`),
  because Chrome refuses ES modules over `file://`.
- `tools/bundle.mjs` (about 40 lines, Node, no deps) concatenates `src/*.js` in dependency order into **one
  `spacegame.html`** for release: that is the "one html file" Leif asked for, and it opens from `file://`.
- Rendering: Canvas 2D for the game layers (base, light map, emissive) composed into one canvas, then **one WebGL2
  full-screen post pass** (bloom from the emissive layer, vignette, grain, slight chromatic aberration, tone curve).
  If WebGL2 is missing the page runs without post. Reason: Canvas 2D keeps every unit simple to write in parallel;
  the post pass alone carries most of the "film, not cartoon" look (see A.5). Question C1.
- Target size: **about 9,000 lines of JS** in total, 600-1,300 per unit (table in A.9), plus ~150 lines HTML/CSS.
- Everything procedural, seeded (`seed` in the URL); the same seed gives the same planet and belt on every machine.
  This is also the first property the final architecture needs (determinism), so it costs nothing to do now.

### A.1 Act 1, the surface (Terraria-like side view)

**World.** A planet of circumference 32,768 tiles x height 2,048 tiles, generated in 64 x 64 chunks on demand
(deterministic hash of chunk coordinates and seed), so walking never hits an edge; the world wraps. 1 tile = 0.5 m.
Surface gravity 8.7 m/s^2 (alien, a little under Earth; stated in the HUD). Layers from a 1-D fractal surface with
overhangs: spore-soil, glass-basalt, deep obsidian, bone-coral caves, ice pockets. Caves from 2-D value noise
thresholds and worm-carved tunnels; ores by depth and noise: iron (shallow), copper, titanium (deep), uranium (very
deep, near heat), and "lumen" crystals (the glowing flora's mineral). Flora: bioluminescent fungi, hanging vines,
spore-emitting pods, placed by surface and cave rules; each is an emissive light source with its own colour and a slow
pulse. Weather: spore fog (scrolling noise alpha layer), occasional rain of glowing motes. A 36-minute day; night is the
default start, because the dark is the point.

**Lighting (the hard unit).** A tile light map in RGB per tile, flood-propagated (Terraria style) from emitters
(flora, lava, furnace, muzzle flash, player headlamp) with per-material attenuation (air 0.91, water 0.82, solid 0.56),
recomputed only for dirty chunks within the view plus one chunk margin. Real darkness: ambient at night is 0.02; a
cave is black. The **headlamp** is a raycast cone: 96 rays, DDA through the tile grid, 24 m reach, 42 degree cone with
a soft edge, written into the light map as additive and into the emissive layer as volumetric haze. The light map is
drawn at tile resolution to a small canvas and scaled with bilinear smoothing, then multiplied over the base layer.
Fake ambient occlusion: tiles bordering air get a 2 px inner shadow. Water tints light blue-green and refracts
(sine offset of the row below the surface).

**Player physics.** AABB 0.6 x 1.8 m vs tiles, fixed step 120 Hz. Acceleration 24 m/s^2 ground, 6 air; friction by
material (ice slides); max run 6.5 m/s; **momentum** (you keep speed and have to brake; corners cost). Jump 4.6 m/s.
**Jetpack**: 14 N/kg thrust, 11 s fuel, heat bar; refuels at base. **Fall damage** from impact speed above 11 m/s,
quadratic; the screen flashes, the lamp flickers. Swimming with buoyancy and drag. Mining with a hand drill: hold on a
tile, progress by hardness, chips and dust particles fly; placing blocks and machines on a grid with placement
validity (support, overlap). Inventory of 10 quick slots plus a bag.

**Creatures (procedural legs).** Three for the demo: *stalker* (six legs, ambush predator, hunts by your light),
*grazer* (four legs, slow, armoured, drops chitin), *spore jelly* (floats, buoyancy, drifts toward warmth). Legs: two
segments each with analytic IK to a foot target; a foot steps when its target moves more than its stride; body height
follows the mean of planted feet; gait phase offsets per leg. Bodies are soft chains (verlet points with distance
constraints), so a stalker flows over terrain. Bioluminescent spots that reveal them in the dark; eyes catch the
headlamp. AI: wander, stalk (approach while you face away), charge, flee below 20 % health. They are killable, they
bite (knockback with momentum, damage).

**Ballistic combat.** A rifle and a shotgun for the demo. A shot is a point mass: muzzle 820 m/s, gravity, quadratic
drag, substepped raycast against tiles and creature capsules every physics step; **gravity drop is visible at 40+ m**;
tracers every third round. Recoil pushes the player (momentum). **Casings** are small rigid particles with
restitution and spin that bounce on tiles and stay as decals for 20 s (tink sound). **Impacts**: sparks (emissive
particles), dust puffs by material, a dark crater decal on the tile, chips off soft tiles; hits on creatures spawn
glowing ichor. **Muzzle flash** lights the light map for one frame. Magazines and reload. Aim with the mouse; the
headlamp follows the aim.

**Factory loop (the progression of Act 1).** Items flow through machines; everything is placed in the world and
visible working.

| Step | What you do | What you build |
|---|---|---|
| 1 | Mine ore and lumen by hand | nothing |
| 2 | Hand-fed furnace: put ore and fuel in, ingots out after 8 s (fire lights the cave) | furnace |
| 3 | Drill on an ore vein: outputs 1 ore / 3 s onto a conveyor | drill, conveyor (items ride at 1.5 m/s, visible), inserter |
| 4 | Conveyors feed the furnace; furnace feeds an assembler; assembler makes parts (plates, frames, engine, tank) | assembler, storage, power (a lumen reactor; cables) |
| 5 | A launch pad; parts assemble a rocket piece by piece (you watch it grow) | launch pad |
| 6 | Launch: physics, not a cutscene (next paragraph) | the rocket |

**Rocket launch.** The rocket is the first ship: a stack of parts with mass, a tank that empties (mass flow
F / (Isp g0)), thrust, gravity from the planet's centre (point mass, so it weakens with altitude), an exponential
atmosphere with drag that fades to nothing by 70 km, and a gravity turn you steer with A/D. The camera zooms out
continuously as altitude grows (A.3's log zoom); the ground becomes a curve, then a disc. If the predicted apoapsis
passes 80 km and the trajectory is an orbit, **Act 2 starts with the real state vector**: nothing is reset. A
failed launch falls back; the parts survive if slow enough.

### A.2 Act 2, space (top-down)

**Scale.** A fictional star system (Leif's story names it; placeholders in `story.js`): one star (1.0 solar mass),
seven planets at 0.4 to 30 AU, moons, a belt at 2.1-3.3 AU. Positions in **double precision metres**, heliocentric,
with a **floating origin**: everything is drawn relative to the camera's focus body, exactly the rule in
BODIES.md. **Continuous log zoom** from 0.01 m/px to 1e10 m/px (one scheme, no steps, like maps.ce-net.com), wheel
`scale x exp(deltaY x 0.0017)`; what the HUD draws depends on scale (ship parts -> ship icon -> orbit line -> planet
dot). Everything stays visible by rule: a body below 2 px is a point with its glow, never nothing.

**Orbits.** Patched conics on rails: every body and ship not under thrust carries orbital elements (a, e, omega, M0,
epoch, central body); position by solving Kepler's equation (elliptic and hyperbolic). Under thrust or inside an
atmosphere: Newtonian integration (RK4, substeps) with the dominant body's gravity, then re-railed when thrust stops.
**Sphere-of-influence transitions** re-express the state in the new body. **Prediction**: the current conic is drawn
in full, with **Ap and Pe markers**, the SOI exit point and the next conic in the new body when there is one.
**Time warp** 1x to 100,000x, only on rails (warp drops to 1x when you fire an engine or come within 2 km of
anything). A clock in the HUD shows mission time. Property tests in-page (`?test=1`): Kepler round-trip, energy
conserved along the conic within 1e-9, Hohmann transfer time matches the formula.

**Ship building.** A grid of parts, built in a hangar view (also usable at the depot in flight): hull block, fuel
tank, main engine (Isp 320 s), RCS block, reactor, cargo bay, mining laser, autocannon, drone bay, cockpit (the
core). Each part has mass (dry plus contents), armour HP and attachment faces. The builder computes and shows live:
**total mass, centre of mass, moment of inertia** (parallel axis sum), thrust and **torque per thruster** (r x F),
the imbalance torque of the main engines, **delta-v (Tsiolkovsky, Isp g0 ln(m0/m1))**, burn time, and acceleration.
A badly balanced ship spins when you burn: the physics is the lesson. RCS is grouped by what each thruster's torque
and force sign contribute, so "rotate left" fires the right subset. Fuel use is per tank with mass loss; the
centre of mass moves as tanks empty.

**Ships break apart.** Parts form a graph through their attachment faces. When a part is destroyed, a BFS from the
core finds the connected set; every other island becomes a free rigid body with the parent's velocity plus
omega x r, its own mass, inertia and remaining parts. Debris keeps orbiting (on rails after a second).

**Asteroid belt, lazily generated.** The belt is cut into **sectors** in polar coordinates (radial rings of 0.05 AU
x angular slots so a sector is about 0.05 AU on a side). A sector's content is a pure function of
`hash(seed, ring, slot)`: count, orbital elements, size, composition (rock, iron, ice, lumen), spin. Generated when a
ship or the view enters the sector plus a one-sector margin, freed otherwise; a sector you changed (mined, built on)
keeps a delta record. This is the same idea as the Implicit children of HLOD.md, so it is infinitely scalable and
needs no storage until someone touches a sector.

**Mining.** The mining laser heats a point on the asteroid (a glowing spot, smoke); the asteroid's shape is a radial
height map of 128 samples around its centre; material is removed where heated, so the **shape deforms**, and ore
chunks are **ejected as rigid bodies** with heat-dependent velocity and spin, cooling from orange to grey. A cargo
bay with a collector field pulls chunks under 30 m in. Asteroid mass and inertia update as they lose material.
**Mining platform**: a part set anchored to an asteroid, mines by itself into its silo. **Orbital depot**: a station
in a chosen orbit with storage, a refinery and a shipyard. **Hauler drones**: launched from the depot, fly a
computed Hohmann transfer to the platform (on rails, correct transfer time, visible on the map), load, return. The
depot **auto-builds** a ship from a saved blueprint whenever its inventory covers it, and the new ship joins the
fleet with a task (mine, haul, escort). The chain is visible on the map as moving dots and lines; nothing is
simulated behind a curtain.

**Combat.** The autocannon fires 30 mm shells at 1,100 m/s **plus the ship's velocity**; relative motion matters
and the **lead indicator** solves the intercept quadratic for the target's current velocity. Shells hit parts:
armour absorbs, then part HP, then the part dies (the connectivity rule above). Debris, sparks, a flash that lights
nearby hulls, a shock ring; fuel tanks explode and push neighbours. **Alien hive ships**: organic, asymmetric,
grown from a seed (procedural silhouette), move as a flock with Newtonian thrust (they obey the same physics), spit
slow plasma globs you can dodge, and bleed glowing fluid. Three enemy sizes. A combat scenario starts with two
hive ships closing on your depot.

### A.3 Camera, zoom and transitions

One camera model for both acts: a focus point, a scale (m/px) and a soft follow. In Act 1 the scale is fixed at 32
px/tile (0.0156 m/px) with a 2x zoom for aiming; during the launch the scale animates continuously to Act 2's. In
Act 2 the wheel is a continuous log zoom; double-click focuses a body; `Tab` cycles ship / target / depot; `M` is the
full system view (1e10 m/px) with orbit lines, the same page, same camera.

### A.4 Controls

| Act 1 | Act 2 |
|---|---|
| A/D move, W/Space jump, Shift sprint, hold Space jetpack | W main engines, A/D rotate (RCS), Q/E strafe (RCS), S retro |
| Mouse aim, LMB fire or mine, RMB place, wheel select slot | LMB autocannon, RMB mining laser, wheel zoom, drag pan |
| E interact (furnace, assembler, pad), I inventory, B build menu | B hangar / builder, T target, Tab cycle, M map, `,` `.` time warp |
| F toggle headlamp, R reload, G drop, Esc menu | N orbit prediction toggle, Esc menu |
| Gamepad: left stick move, right stick aim, triggers | same mapping, left stick translate, right stick rotate |

### A.5 Art direction (how to judge "realistic, stylised, not cartoony")

**Rules.** No outlines. No flat fills: every surface has grain (procedural noise at 2 px) and an edge shadow. Dark
first: the image is mostly near-black and the lights carry it. Few, deep colours; saturation comes only from emission.
Motion has mass: nothing stops in one frame. Particles are many and small, not few and big. Text is small, thin and
quiet. If a frame could be a still from a film, it passes; if it could be a sticker, it fails.

**Palette.** Base: #05080c (night sky), #0b1016 (rock shadow), #1a222a (lit rock), #2b3136 (steel). Bioluminescence:
#2ef2d0 (cyan fungi), #8a4dff (violet pods), #9dff3a (acid moss), #ff5e3a (lava, hot ore). Human tech: #ffb347 (amber
lamps and HUD warnings), #c9d2d8 (hull), #ff2d2d only for damage. Space: #020305 background, stars in three parallax
depths with colour by temperature, the star's light a warm white #fff1dc.

**Lighting model.** Surface: multiply light map (RGB) over the base, additive emissive layer, headlamp haze, fake
AO, water refraction. Space: a single directional light from the star; every sprite has a lit side and a shadow side
(two-tone with a soft terminator computed per part), engine plumes and lasers on the emissive layer, hull specular
streak when the star angle fits, asteroids with a terminator and self-shadow from their height map. Planets are lit
discs with atmosphere limb glow; the night side is dark except city points.

**Post.** Bloom: emissive layer downsampled 4x, 2-pass blur, added back (threshold-free because only emitters are on
that layer); vignette 0.35; film grain 0.04 animated; chromatic aberration 1.5 px at the edges only; a gentle S tone
curve; a 0.5 s exposure adaptation when leaving a cave or when the star enters the frame. No scanlines, no pixel
rounding.

**HUD.** 1 px lines, small monospace caps in #9fb3bf at 60 % opacity, angular brackets for targets, numbers with
units (m/s, km, kN, s), an orbit readout (Ap, Pe, period, dv left), a compass strip and an altitude tape in Act 1.
Nothing bounces, nothing is rounded. Follows the ce-design standard's tokens where they apply (skill `ce-design`),
but the game owns its palette.

**Audio (WebAudio synthesis, no files).** Act 1: wind (filtered brown noise shaped by altitude and cave depth),
dripping, creature calls (FM with formant filters, each species its own), footsteps by material, rifle (noise burst +
120 Hz thump + ring), casings (short metallic ping), furnace hum, conveyor ticks, drill grind, rocket (brown noise
rumble with an LFO and a sub). Act 2: silence outside; only sounds conducted through your hull: muffled engine rumble,
RCS hiss, autocannon as a low thud, impacts as hull groans; a soft UI click for the HUD. Music is a slot (Leif's
choice); an ambient pad generator is the default, mutable.

### A.6 Story hooks

Leif has written the story; the demo leaves clean slots and invents nothing beyond placeholders.

- `src/story.js` exports `STORY = { title, system: { starName, planets: [...] }, beats: [...] }`. A beat is
  `{ id, trigger, text, speaker, once }`; triggers are events the engine already emits: `landed`, `firstNight`,
  `firstCreature`, `firstKill`, `furnaceLit`, `firstAutomation`, `launch`, `orbit`, `firstAsteroid`, `depotBuilt`,
  `firstDrone`, `hiveSighted`, `shipLost`.
- Beats show as a quiet line at the bottom of the screen for 6 s and are kept in a log (`L`). No cutscenes.
- The placeholder text is marked `[placeholder]` so it can never be mistaken for Leif's writing.

### A.7 Starting each act straight away

- `index.html?act=surface` (default) starts at night, at the crash site, with a hand drill and a rifle.
- `?act=surface&scenario=factory` starts with the drill, furnace, conveyors and an assembler already placed and the
  pad half built, so the automation and launch show in two minutes.
- `?act=space` starts in a 220 km orbit around the home planet in a 12-part ship with 1,800 m/s of dv.
- `?act=space&scenario=mining` starts beside a belt asteroid with a depot in orbit and two drones.
- `?act=space&scenario=combat` starts at the depot with two hive ships closing.
- `?act=space&scenario=builder` opens the hangar.
- `F1` in-game opens the dev menu with the same list, a seed field, and time controls.

### A.8 Acceptance checks, with proof

Run by `tools/check.mjs` (headless Chromium through the same slot discipline as maps-ce-net `tools/lib-browser.mjs`,
so it never fights other tests for the machine):

1. Opens each of the six URLs of A.7, waits 4 s, saves a 1600 x 900 PNG to `docs/shots/<scenario>.png`. The shots
   are the proof Leif looks at: surface at night with headlamp and flora, the factory running, the launch at 40 km,
   an orbit with prediction and Ap/Pe, mining with ejected chunks, combat with debris.
2. Zero console errors or unhandled rejections across all six (fails otherwise).
3. `?test=1` runs the in-page property tests (Kepler round-trip, energy, Tsiolkovsky, connectivity split, light
   propagation symmetry) and prints `tests ok N` (fails otherwise).
4. Frame budget: the page records `performance.now()` deltas for 10 s per scenario; **p95 <= 16.7 ms on a machine
   with a GPU** (leif-desk or a Mac; software GL on the Debian is not a GPU number, as DRAWS.md says) and no frame
   over 50 ms after load. Reported per scenario in `docs/CHECK.md` with the machine named.
5. Memory: the surface at 10 minutes of walking holds at most 400 chunks; the belt at most 9 sectors.

### A.9 Work split: ten units, their contracts, suggested models

Ten agents work in parallel, each in its own file. `core.js` is written first (half a day) and frozen; everything
else codes against it. Shared types live in `core.js` as documented plain objects; no class hierarchies.

Shared contract in `core.js`:

```js
// Loop: fixed 120 Hz physics, variable render; G is the one global.
G = { seed, time, dt, act, cam: { x, y, scale, focus }, world, ships, bodies, input, events, audio, rng }
// Every unit registers a system: { name, order, init(G), step(G, dt), draw(G, layers), ui?(G) }
G.register(system)
// Events: G.events.emit(name, data) / G.events.on(name, fn); the story and audio listen here.
// Layers: { base, light, emissive, hud } 2D contexts; the post pass composes them.
// Rigid body (space): { id, p: [f64, f64], v, ang, angVel, m, I, com, parts?, railed?: Elements }
// Elements: { body, a, e, w, M0, epoch }   // body = central body id
// Tile world: G.world.get(x, y) -> u16 tile id; set(x, y, id) marks the chunk dirty for light and mesh
// Asteroid: { sector, elements, r: Float32Array(128) heights, mass, I, spin, composition }
// Item: { kind, n } ; Machine: { kind, x, y, inv, state, step(dt) }
```

| # | Unit | File | Exports | Depends on | Lines | Model |
|---|---|---|---|---|---|---|
| 1 | Engine and core loop: G, loop, input, camera (log zoom, floating origin), layers, events, RNG, URL scenarios, dev menu | `core.js` | `G`, `register`, `events`, `cam` | - | 700 | Opus 5.5 |
| 2 | Surface world: chunks, generation, tiles, flora, water, weather, mining and placing | `world.js` | `world.get/set/chunkAt/generate`, `flora[]` | 1 | 1,100 | Haiku 5.5 |
| 3 | Surface lighting: flood light map, raycast headlamp, AO, light canvas | `light.js` | `light.mark(x,y)`, `light.add(emitter)`, `light.draw` | 1, 2 | 800 | Opus 5.5 |
| 4 | Surface factory: items, machines, conveyors, recipes, power, launch pad, rocket stack and launch physics, act transition | `factory.js` | `machines[]`, `recipes`, `rocket.launch()` | 1, 2 | 1,200 | Haiku 5.5 |
| 5 | Surface combat and creatures: player body, weapons, ballistics, casings, impacts, creature IK and AI | `surface.js` | `player`, `creatures[]`, `fire()` | 1, 2, 3 | 1,200 | Opus 5.5 |
| 6 | Orbital mechanics: bodies, Kepler, patched conics, SOI, prediction, time warp, star system definition | `orbit.js` | `bodies`, `rail(body)`, `unrail`, `predict(body)`, `warp` | 1 | 900 | Opus 5.5 |
| 7 | Ship builder and ship physics: parts, grid, mass/CoM/inertia, thrusters and RCS groups, fuel, dv, break-apart, hangar UI | `ship.js` | `parts`, `Ship`, `builder.open()`, `split(ship)` | 1, 6 | 1,200 | Opus 5.5 |
| 8 | Asteroids, mining, automation: sectors, asteroid shapes, mining laser, chunks, collector, platform, depot, drones (Hohmann), auto-build | `belt.js` | `sectors`, `asteroids[]`, `depot`, `drones[]` | 1, 6, 7 | 1,100 | Haiku 5.5 |
| 9 | Space combat: autocannon, lead indicator, damage, explosions, hive ships (shape, flock, AI) | `combat.js` | `shells[]`, `hives[]`, `damage(ship, part)` | 1, 6, 7 | 800 | Haiku 5.5 |
| 10 | Art, post and audio: palette, post pass (WebGL2), particles, HUD drawing, WebAudio synth, story display | `art.js`, `audio.js`, `story.js` | `post.compose`, `particles`, `hud`, `audio.play(name)`, `STORY` | 1 | 900 | Haiku 5.5 |
| 11 | Integration and QA: `tools/bundle.mjs`, `tools/check.mjs`, property tests, shots, frame budget, `docs/CHECK.md` | `tools/`, `test.js` | - | all | 400 | Fable (review and judgement), Haiku 5.5 for the scripts |

Rules so the parallel work lands: a unit touches only its file; a unit that needs something from another writes the
call against the contract above and the integrator fixes the seam; every unit ships a `?test=1` check of its own
invariants; the integrator (Fable) reviews each unit against A.5 by looking at its shot, not its code.

Order: unit 1 first (frozen after half a day), then 2-10 in parallel (about two days wall), then 11 (one day).

---

## B. The final architecture: spacegame as the scalability test of ce-net

Noted down for later; nothing here is built in demo 1. Each item says **fact** (read on disk, cited above) or
**guess** (my design).

### B.1 Everything is a cell

**Fact:** a program cell is one typed Rust function (`cell-forge new-cell <area>.<function>`), with state in
`state.store`, found over `net.find`, rights by ce-cap. **Guess:** spacegame becomes these cells, each one function,
public repos (question C5), none depending on the private twin-protocol:

| Cell | Function | Holds in state.store |
|---|---|---|
| `spacegame.world` | surface chunk generation and the delta record of changed chunks (a chunk is a node: Implicit children by hash) | chunk deltas |
| `spacegame.sector` | an orbital sector's authority: asteroids, ships, debris in it; the physics step for what is inside; hands bodies over at the border | sector deltas, authority lease |
| `spacegame.orbit` | Kepler propagation and patched conics as a service (any viewer asks for a body at time t) | nothing (pure) |
| `spacegame.fleet` | a player's ships, blueprints, depots, drones and their tasks | fleet records |
| `spacegame.story` | Leif's beats and each player's progress; time-aware (`t`), like twin/1.1 | progress |
| `spacegame.view` | the browser page: a viewer that subscribes to sectors and chunks and renders through the Twinton engine | ui state |

Leif's words 1 ask for a demo "across 5 different cells": **guess** that demo 2 is exactly `world`, `sector`,
`orbit`, `fleet`, `view` on five real machines, with `story` folded into `fleet` until the sixth is needed.

### B.2 Twinton distributed rendering, and what spacegame needs added

**Fact:** the Twinton rendering engine is `globe-render` with the HLOD contract: one node tree over all domains, one
selector with a global budget in a wasm worker, f64 frames with camera-relative floating origin, movers/1 for things
that move, content-addressed chunks on the edge. **Fact:** "distributed" today means each browser renders its own
view from static tiles; viewers compute nothing and serve nothing; proxies that merge many sources are built offline or
by a server cell (HLOD.md section 3, "Offline vs runtime").

What spacegame adds or refines (**guesses**, grounded in the contracts):

1. **A 2D orthographic selector mode** in `globe-render-core hlod`. The selector's screen-space error assumes a
   perspective camera (viewport height and vertical fov). Top-down space is orthographic: `sse = error_m / (m per px)`.
   One flag on `frame()`; the exact-cover, fades, budgets and tau controller stay. (repo:globe-render/crates/globe-render-core, repo:maps-ce-net/docs/HLOD.md section 2)
2. **Game frames and moving nodes.** Nodes carry a static `centre` in a frame (earth.B3, sun.E3, a place ENU). A ship
   and an asteroid are frames that move every step; add `FrameId` for "rigid body k" with its pose fed per frame, so
   a ship's parts, damage decals and interior are HLOD children of the ship node. Movers already do this for points;
   this makes it general.
3. **Orbital sectors as a tile scheme.** movers/1 tiles are lat/lon squares with u16 positions (0.3 m at z10), which
   fits a planet surface and not a belt. Add a heliocentric polar sector scheme (ring x slot, the A.2 belt) and
   **Kepler elements as the record** for anything on rails: six numbers and an epoch predict a body for hours with
   zero further bandwidth; only burns send a new record. Debris and ore chunks ride the same stream.
   (repo:maps-ce-net/docs/MOVERS.md)
4. **Devices that render also build proxies.** Today proxies come from one Debian box or offline tools. Spacegame
   needs baked asteroid-field chunks, lightmaps of a surface chunk, merged debris fields: any device holding a sector
   can build its proxy and publish it as a content-addressed chunk (sha256 names already exist), signed with its
   ce-cap. The viewer's loader does not care who built it. This is the "dynamic rendering across many devices" of
   Leif's words 3, and it is the part with no code today.
5. **render.light 2D.** The post chain exists only inside Valdrada and is planned for extraction as `render.light`
   (GENERIC-SYSTEMS 2.1). Spacegame's demo post pass (A.5: bloom, grain, vignette, aberration, tone curve, exposure
   adaptation) is the 2D preset of that cell; when `render.light` lands, the demo's shader moves there and the game
   calls it. Also a 2D light-map pass (flood light plus raycast lamps) as a render.light mode, since no twin has
   tile lighting yet.
6. **stream.tiles for implicit, deterministic content.** HLOD nodes already allow `Implicit { Quad | Oct }` children.
   Add a `Hash` child scheme: children exist by seed and index, generated on the device, with an optional delta record
   fetched from a cell. The belt, the surface and the star field all use it. (repo:maps-ce-net/docs/HLOD.md section 1)
7. **One clock.** Game time with warp must be the twin clock (`host.clock`, twin/1.1 viewed time `t`): a viewer can
   scrub a battle back, and a cell answers "where was this ship at t". Time warp is a rate on that clock, nothing
   separate.
8. **Benchmarks.** Add a `spacegame` path to lod-bench (surface night, launch, system zoom, belt, combat) and run the
   same holes/double-draw/pops probes; the DRAWS.md per-cell draw counts become per-sector counts.

### B.3 A physics engine that scales across millions of devices

**Fact:** nothing exists; it has to be written. The older spacegame's shape-matching rigid bodies and points-and-beams
engine are a design reference, not code we have. **Guesses**, all of them:

| Piece | Design |
|---|---|
| `physics.rigid2d` (Rust, no deps, wasm) | polygon rigid bodies, contacts with warm-started sequential impulses, joints for ship parts (so a hull flexes and breaks along its attachment graph), continuous collision for shells; fixed step 120 Hz, integer tick; f64 and no platform transcendental calls (own sin/cos/exp tables) so the same wasm gives bit-identical results on every device |
| `physics.orbit` (Rust, no deps) | Kepler, patched conics, SOI, Lambert (for drones and intercepts), n-body only for the star system's own bodies at coarse step; shares frames and units with `bodies-ephem` (km, f64, heliocentric) |
| `physics.terrain` | tile world chunks, destructible, flood light, fluid cells; deterministic from seed plus delta |
| Spatial and orbital partitioning | the surface in 64 x 64 chunks grouped in region cells; space in the polar sectors of B.2.3, nested (a planet's SOI is its own sector tree). The partition is the HLOD tree, so the same node is the unit of rendering, loading and authority |
| Authority | one device holds a **lease** on a sector (the `lease/writer` pattern of space.graph: 30 s, renewed every 10 s) and steps everything in it; empty sectors have no lease and no cost: everything in them is on rails. Physics only runs where someone is; that is why a solar system is cheap |
| Handoff | a body crossing a sector border is handed over as `(tick, state, hash of the sector's inputs)`; the receiving lease holder re-simulates from the shared tick; a mismatch is logged and the sender's hash wins once, then the sender is audited |
| Interest management | a viewer subscribes to the sectors in its view plus the predicted next ones (the 3-pose idea of HLOD's selector); far sectors arrive as counts and elements, near ones as full state at 20 Hz; prediction between updates is Kepler, not dead reckoning |
| Determinism | fixed step, ordered bodies, same wasm, inputs as a tick-stamped log; two devices given the same log produce the same hash; the hash is published with every handoff |
| Persistence | state.store for leases, fleets, chunk and sector deltas (LWW with HLC is fine for records); the physics log of a sector is an append-only chunk stream (content-addressed) so any device can replay it; the Postgres single lock is the known bottleneck (gods-eye audit) and sector deltas must shard around it |
| Every machine real | a sector lease is held by a real device with a ce-cap; a sector's neighbour re-simulates a random sample of handoffs (cheap, deterministic) and reports a liar; a device's history of agreement is its standing. No invented machines, no simulated players presented as people (the maps rule) |
| Scale picture | 1e6 devices each holding 1-4 sectors near their own ships gives a few million live sectors; movers-sim's numbers (16 bytes an agent, 30 ns a step) say one device can step 1e5 rigid-ish bodies at 120 Hz, far more than a sector holds |

What the test measures: live sectors against devices; handoff mismatch rate (must be 0); p95 frame on a phone and a
desktop by the lod-bench probes; bytes per device per second (the movers/1 figure is 1.27 B/object/s for traffic;
Kepler records should bring a ship to near zero between burns); state.store write rate per sector; time to replay a
sector from its log.

### B.4 Story and the dynamic game engine on top of the rendering engine

**Guess:** the game engine is the thin layer that the demo's `core.js` already is (systems, events, a clock) moved
onto the cell graph: a system is a cell, an event is a typed op, the clock is twin time. Story beats are records with
triggers; progress is per player in `spacegame.story`; the world's changes (a mined asteroid, a built depot) are
deltas any viewer sees, so the galaxy is persistent and alive. The "LIVING-GALAXY" mandate of the old spacegame
(continuous 1:1, no jump graph, physical warp, persistent state) carries over as the rule of B.3: nothing is on a
graph, everything has a state vector, and rails make the empty parts free.

### B.5 Measured now, to be measured later

| Measured now (fact) | To measure in the final (the test) |
|---|---|
| 1 compute machine, 7 on the tailnet | devices holding leases, live sectors |
| 100,000 edge requests/day cap, 126,894 used | bytes/device/s, requests/device/day |
| 1M twins in 1.21 MB at ~55 fps | 1M bodies in the view's sectors at p95 <= 16.7 ms desktop, 33 ms phone |
| 96 M agent-steps/s on 4 threads (traffic) | rigid-body steps/s per device, handoff mismatch 0 |
| one Postgres advisory lock per write | sector delta writes/s without that lock |

---

## C. Open questions for Leif (each with a default)

1. **Rendering stack for demo 1**: Canvas 2D layers plus one WebGL2 post pass (default: yes), or full WebGL2 from
   the start (slower to write in parallel, better bloom and lighting)? Default: Canvas 2D + WebGL2 post; move to
   `render.light` when it exists.
2. **Star system**: your fictional system from the story (default), or our Solar System? Default: fictional, with
   placeholder names in `story.js` for you to replace; sizes and distances real.
3. **Modules bundled into one file** (`src/*.js` -> `spacegame.html` by a 40-line script, default) or one
   hand-edited HTML file from day one (ten agents cannot work on it in parallel)? Default: modules, bundled.
4. **The five cells**: demo 1 is one page; demo 2 splits it into `world`, `sector`, `orbit`, `fleet`, `view` on five
   real machines. Default: yes, in that order; demo 2 planned after demo 1 passes A.8.
5. **Licence and repo**: open source means a public repo and a licence; twin-protocol is private and spacegame must
   not depend on it. Default: public `Leif-Rydenfalk/spacegame`, Apache-2.0 (patent grant for the physics), only
   public crates as dependencies. This is a legal choice, so it is yours.
6. **Death and loss**: realistic physics kills. Default: on death you respawn at your last base, your body and
   inventory stay where you died (recoverable), ships lost in space stay as debris in their orbit; no permadeath.

---

## D. Leif's decisions (2026-11-14, verbatim, these override A and C where they differ)

"Use gpu rendering so it renders nicely on muy laptop. use threejs os its later compatible with the twinton engine when we run the conversion and upgrade. make it completly open source. this is a demo on how ce-net works later and will teach people how the architecture and scalabiltiy and why thehy would want to use ce-net architecture and infrastructure. build it. your body respawns once you have built hte machine to print a new one. your ships stays yours. all of the ships run on ce-net and are connected to your identity. keep demo 1 simpkle and one page. have many source fiels which cwe bundle up properly using industry standard not just one file. its a neighboring star system where we put prisoners of earth to do research on other plaanets which is where it got messed up."

"use fable 5.2"

What this changes:
- C1: **GPU rendering with three.js** (WebGL2), not Canvas 2D. Orthographic camera, instanced meshes, custom shaders, three's EffectComposer for bloom/grain/vignette. Chosen so the later conversion onto the Twinton engine is direct.
- C3: **many source files bundled with Vite** (industry standard; `npm run dev`, `npm run build` -> `dist/`). No hand-concat script. One page.
- C5: **completely open source**: Apache-2.0, public repo, only public npm deps (three, vite).
- C6: **respawn needs a body printer**: until you build the bio-printer machine, death means restarting from the crash site; after it exists you respawn there. Body and inventory stay where you died. **Ships stay yours** after loss (as wrecks you own). In demo 1 identity is a local player id; in the final architecture every ship is a ce-net object tied to the player's ce-net identity.
- C2: **setting**: a neighbouring star system where Earth sends prisoners to do research on its planets; that is where it went wrong. Real-scale distances, names stay placeholders in `story.js` for Leif's story.
- C4: demo 1 is one page; the five-cell split is demo 2 (default kept).
- Models: Fable 5.2 plans, integrates and judges.

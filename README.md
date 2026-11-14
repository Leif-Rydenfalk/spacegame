# spacegame, demo 1

One page, two acts, feel first. Act 1 is a side-view survival and factory game on a dark bioluminescent world. Act 2 is
top-down space at real 1:1 scale with Kepler orbits, ships built from parts, belt mining and combat. Setting: a
neighbouring star system where Earth sent prisoners to do research on its planets; that is where it went wrong.
All story text is a `[placeholder]` in `src/story.js` until Leif's own text replaces it.

Rendering is three.js on WebGL2: orthographic camera, one instanced sprite batch, custom shaders (tile world, light
map, lit planets, asteroids), and an EffectComposer chain (bloom, film grain, vignette, edge chromatic aberration,
tone curve). Everything is procedural and seeded (`?seed=7`); there are no asset files and no network calls.

## Run

```sh
npm install        # Node 18+; three 0.170.0, vite 5.4.11, puppeteer-core (check only)
npm run dev        # http://localhost:5200
npm run build      # -> dist/ (one page, one bundle)
npm run check      # headless: every scenario -> docs/shots/*.png, console errors, ?test=1, writes docs/CHECK.md
```

## Scenario URLs

| URL | Starts |
|---|---|
| `?act=surface` | the crash site at night, hand drill and rifle |
| `?act=surface&scenario=factory` | drill, belts, furnace, assembler running; pad half built; bio-printer placed (`&t=30` fast-forwards 30 s) |
| `?act=space&scenario=launch` | the rocket at 40 km on the ascent autopilot |
| `?act=space` | a 220 x 640 km orbit around the home moon in the 12-part scout, 1,770 m/s of delta-v |
| `?act=space&scenario=mining` | beside a belt asteroid with a mining platform, the depot and two haulers |
| `?act=space&scenario=combat` | at the depot with two hive ships closing |
| `?act=space&scenario=builder` | the hangar |
| `?test=1` | in-page property tests, prints `tests ok N` |

Extra parameters: `seed=N`, `t=S` (simulate S seconds before the first frame), `auto=1` (the ship's laser and cannon
aim themselves; used for the proof shots). `F1` in the game opens the dev menu with the same list.

## Controls

| Act 1, surface | Act 2, space |
|---|---|
| A/D move, W or Space jump, Shift sprint, hold Space in the air for the jetpack | W main engines (Z lock full, X cut), A/D rotate, Q/E strafe, S retro (RCS) |
| Mouse aim (the headlamp follows), LMB mine or fire, RMB place | LMB autocannon, RMB mining laser, wheel zoom (continuous, 0.01 m/px to 1e10 m/px) |
| 1 drill, 2 rifle, 3 shotgun, 4 build; wheel changes slot; B next buildable | M map (local, planet system, star system), Tab focus (ship, target, depot), T target |
| E use the nearest machine (put in, take out); E at the finished pad boards the rocket | `,` `.` time (x2, x4 under thrust; x10 to x100,000 on rails), N prediction on/off |
| R reload, F headlamp, L story log, F1 dev menu | B hangar, P ascent autopilot (from the pad), L story log, F1 dev menu |

## What is simulated

- Surface: 0.5 m tiles in chunks generated on demand; an RGB light map flood-propagated from flora, lava, furnaces
  and muzzle flashes; a 96-ray headlamp cone that also shapes the volumetric haze; 120 Hz player physics with
  momentum, jetpack and fall damage; rifle and shotgun rounds as point masses with drag and gravity, casings, sparks,
  craters; creatures with IK legs that step over terrain; machines that move real items on belts; a rocket that
  grows on the pad part by part.
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

`src/core.js` (G, events, input, hashing), `src/render.js` (renderer, post, sprite batch, particles),
`src/surface/*` (world, light, tiles, player, creatures, factory), `src/space/*` (orbit, ship, belt, combat, view),
`src/story.js`, `src/audio.js`, `src/hud.js`, `src/test.js`, `tools/check.mjs`. Plan and decisions: `PLAN.md`.
Check result and proof shots: `docs/CHECK.md`, `docs/shots/`.

## Licence

Apache-2.0, see `LICENSE`. Dependencies: three (MIT), vite (MIT, build only), puppeteer-core (Apache-2.0, check only).

## Cut or simplified in demo 1 (said plainly)

- Surface: no water, no weather beyond fog, no day cycle (always night), no world wrap, no power grid or inserters
  (belts feed machines directly), one generic rocket part instead of plates/frames/engine/tank, ore veins never
  run out, no bag UI (counts only), no aim zoom, no gamepad, exposure adaptation not implemented.
- Launch: the view switches from the tile world to the planet view at ignition instead of one continuous zoom.
- Space: hauler drones fly accelerate-and-brake transfers in the local frame (the Hohmann formula is tested but
  not flown by drones), drones burn no fuel, ore has no mass, asteroids have no gravity and ships do not collide
  with them, no self-shadowing on asteroids, no friendly fire, the hangar cannot rotate parts and costs nothing,
  the next-conic preview after an SOI exit is approximate, belt memory cap (9 sectors) is by construction, not measured.
- Frame budget (p95 16.7 ms) is not measured: this machine has software GL only.

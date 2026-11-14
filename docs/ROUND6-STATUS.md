# Round 6: status (2026-11-14)

What `docs/ROUND6.md` asked for (with `MINING.md`, `SCIENCE.md`, `SHIPS.md`, `LASER-ENERGY.md`), section by section:
**done**, **partial** (what is there, what is not), or **round 7** (as the Placement of that section says, or because
it did not fit). Proof: `node tools/check.mjs` (scenarios with conditions, `docs/CHECK.md`), `?test=1` (100 property
tests), `node tools/play.mjs` (the new start by real input, `docs/shots/play.json`).

| section | status | what there is |
|---|---|---|
| A real energy | **done** | 2 MW reactor (0.6 MW on the back); laser 1.5 MW in, 600 kW beam, 80 % absorbed; dig rate from energy per material (melt formula and pulsed spall, `physics.js`); kerfs free blocks as bodies; 38 kg sink (48 pulses), water boil-off pack (a suit part) kept filled by the robots, coolant line to a set-down reactor, optics damage past the limit; furnace 150 kW, assembler 40 kW, real smelting energy. Not done: a radiator as a buildable. |
| B0 mining mechanics | **partial** | Joints and fragments, pulse and kerf (kerf-and-wedge is what the drones cut with), spoil to a rock pile zone, supports and collapse, the shaft rig with hoist, the assay station as crusher and sorter, mining orders in blueprint mode (T rectangle, shaft drag, branch drag). Not done: blasting, muck as a granular heap, water, gas, heat with depth, hive galleries, seismic survey, core drill, the probability overlay. |
| B large machinery | round 7 | (shaft rig and hoist are in; TBM, excavator, conveyor ladder, balloons: round 7) |
| C procedural machines | round 7 | |
| D clean inventory | round 7 | (categories exist on every item and group the "in reach" list) |
| E fists | **done** | In combat mode an empty or unusable hand punches (no laser, sink full, starved, on its legs): wind-up, strike, recoil on the body; 80 N s against mass; knocks small bodies and loose rock, costs stamina; the suit's glove multiplies it. |
| F self-defence | **done** | The body turns, fires (or punches) and keeps its distance when bitten or hunted and the hand is off the mouse; input always wins; N cycles always / combat mode / off; the suit hops out of a grab; the turret takes targets by threat. Wary and fleeing animals are never started on. |
| G composition, cut-off, supports, blueprints | **partial** | Composition fields with real grades, iron from anything (three recipes, electrolysis with oxygen and silicon), live cut-off grade, automatic supports with ghosts that jump the queue, lethal collapse. Blueprint library (copy, paste, books, strings): round 7. |
| H hive rebalance | **done** | Masses, chitin, ablation and vital hits; workers 0.6 kg, scouts 2.5, early soldiers 10 kg (1 to 3 pulses); waves of ten to fifty small bodies; armoured brute (90 kg, 2 cm chitin) and burrower only at escalation level 2, which the hive reaches by losing bodies. Not done: breakers over 500 kg. |
| I scanning, tech tree, items UI | round 7 | (the scan itself, hold H, is in: grade with range, finds, edible or toxic, animal mass; databank window and tech tree: round 7) |
| I pace and mass | **done** | Drones 8 kg lifting 15, speed from thrust and load, hover power per kg; hauler 35 kg carrying 60; kits weigh what went into them; build time from mass and tool power; craft time from mass, energy and machine power; hoist 2.5 m/s. Not audited: creature speeds, belt speed (1.5 m/s, in range). |
| I modular miner | **done** | One drag for collar and depth; a rod and a casing per metre actually sunk; modules on the same rig: deeper (drag again), branch (drag sideways), rotary head, hoist line. Not done: TBM head, robot lift, power and network down the shaft. |
| I auto-fetch | **done** | Orders with material in reach are fetched by the cheapest carrier that bids; the fabricator's inputs are brought to the hold; the reason is shown when something waits. |
| J queue anything, global queue | **done** (local) | Every craft click is an order when the hand lacks the inputs; one queue; arm, fabricator and machines bid by time; bids shown. One site (the wreck) for now. |
| J stockpiles, ledger | **done** | AI-opened zones (rubble yard, ore bin, rock pile, organics), filter, priority and limit editable in the AI window, new zone where you stand; everything loose is tidied; exact ledger with place and time. |
| J always finds work | **partial** | Tidy, top up targets, repair bitten machines, supports, salvage what you marked, mine what is scanned and short. Not done: pre-producing likely demand, surveying. |
| J fog of war, sensors | **partial** | Eyes and lamp, hull cameras, placed cameras, radar blobs, stale ghosts; scans and cameras cost storage; SSDs raise the cap. Not done: darkening of unseen terrain beyond what the light already does, seismic. |
| J categories, placeable defence, auto-upgrades | round 7 | |
| K wreck | **partial** | Frame, volumes, a fill that lays the parts out, 34 parts with mass and condition, salvage by hand or by drone (marked parts), repair, the cut-away interior, the sealed section with its own air. Perimeter, ground and beam base-building steps: not done (round 7 with interiors for built structures). |
| L wires, links, ranges | **done** | Sagging cable sized by current with I2R loss and flow marks, radio links with packets, Alt overlay for antennas, sensors, turret, grid nodes, scanner, safe spans. Not done: player-drawn cable, trips on overload. |
| L two depth layers | **partial** | The wreck interior is a layer behind the play plane that you step into (S) and out of (W). A second voxel field behind dug terrain that you walk in is **not built**: moved to round 7. |
| M one AI, reachable inventory | **done** | No "ship AI" in code strings or UI; the inventory lists everything in reach with place and ETA; placing and crafting from reach. |
| N suitless start, antenna, scan-gated mining, assay | **done** | As described at the top of the README. Drone scanner modules: round 7. |
| O smarter AI | **done** | Task market with bids, reservations, batching, charge look-ahead, danger; ground A*; team lifts; hauler rescue; failure reasons, retries, a decision log; three tests. Pre-staging inputs before a build starts: only as far as kits are delivered ahead of the builder. |
| P one suit | **done** | Persistent object with id, condition, history, nine slots, five swappable upgrades that change real stats. Mech docking: round 7. Auto-upgrade of the suit: not done. |
| Q progression | **partial** | No future content at the start or in menus; craft menu split into now / from reach / can be ordered; the next panel; stages 1 to 3 played end to end by `play.mjs`. Stage 4 (lines and stockpiles) is reachable but was not tuned by play. |
| R body and brain | round 7 | |
| S science | **partial** | Data as a resource, knowledge from zero (known slice on M, g and radius as estimates that measurements narrow), needs (food, water, sleep, toilet, oxygen) with edible-by-scan, time controls. Round 7 items untouched. |
| T ships | **partial** | Frame and volume model used for the wreck; personal atmosphere (mask tank, the wreck's sealed air, the detachable pump, filter and controller as placeable machines that make oxygen); furniture placeable. "Everything is a rendered thing" holds for zone piles and carried loads; items in the hold and in chests are still counts. Player frame editor, Earth-size planet: round 7. |

Round 5 gaps: the player, animals and drones collide with loose rock (the hauler steps over it); rock rests on decks.

Known weak spots, said plainly:
- The hauler is reliable on level ground and gets stuck on broken ground more often than it should; it then calls for
  a lift and gets one, so nothing is lost, but it costs time.
- Balance past the first twenty minutes (hive pressure against real heat limits) is untested by play.
- Software-GL frame times only; no GPU number.

Last runs (2026-11-14): `node tools/check.mjs` PASS (60 scenarios, zero console errors, `tests ok 100`, save round-trips,
the v4 and v5 fixtures), `node tools/play.mjs` PASS (17 checks, hive and animals on, no robot gave a job up),
`node tools/ui-flow.mjs` exit 0. After that full run two HUD-only fixes went in (a time-warp default for loaded games,
no "unknown" mask on the dev planet views) and were re-verified with `--only` runs of `planet`, `horizon`,
`knowledge`, `antipode`, `wake`, `v4`, `v5` and the tests; `docs/CHECK.md` is the full run before them.

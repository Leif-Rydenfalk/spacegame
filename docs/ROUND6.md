# Round 6 (queued 2026-11-14; starts when round 5 lands, one Fable 5.2)

Leif, verbatim:
> the ship laser looks like it should but digs too quickly. if we need realistic formnulas for this and calculate the actual engergy and decide ho powerful this reactor is
> continue adding what ive said like mineshafts and a lot more types of large machinery the nes ive mentioned and make it procedural so that things can be merged and biggger and faster and upgraded and everythng as a clean inventory.

## A. Real energy for the laser, reactor and machines (heat-limited pulses: see the Heat, revised section of LASER-ENERGY.md)
Implement docs/LASER-ENERGY.md:
- 2 MW reactor;
- 1.5 MW in and 600 kW out of the laser;
- dig rate = P / (rho (c dT + L) k_loss SLAB);
- kerf cutting frees blocks as rock bodies;
- laser heat sink plus coolant water as a stock target;
- reactor throttles for heat when on your back;
- machines on real power numbers.

## B0. Mining mechanics: implement docs/MINING.md sections 1-8 (minimum: joints + fragments, pulse/kerf/wedge/blast, spoil, support + collapse, shaft with hoist, crusher/sorter, mining orders in blueprint mode)

## B. Large machinery Leif has named (from docs/ROUND3.md and docs/DESIGN.md)
- Mine and elevator shafts: dig a shaft, the AI lines it, puts a lift cage in it, and sets up turrets at the shaft head and at each landing.
- Heavy excavation, "semi given to you by your ship": tunnel-boring head, excavator, rock crusher, ore hoist, automated excavation following ore.
- Logistics machines on the ladder Leif gave: hand, then robots, then bigger long-range machines, then conveyors, then the cargo balloon tamed from the floating species (a cleared site, a mooring mast and an AI route above the canopy), then launch pods and rails later.
- Turrets that the AI places from your design and scales; weather balloons; antenna masts.

## C. Procedural machines: merge, bigger, faster, upgrade
- A machine is built from procedural parts (frame, drive, tool head, power, controller) with real stats derived from the parts' size and tech tier.
- Place two of the same machine adjacent and they merge into one bigger machine, faster per unit of power and with shared inputs. Size tiers scale geometry and art procedurally.
- Upgrade in place by swapping or adding parts; the AI replicates a design you made once.

## D. Clean inventory
- Every machine, part and upgrade is an item stack in the round 5 Factorio-style inventory and crafting menu.
- One clear item icon per item, with tier and size marks.
- Blueprint mode (Tab) covers all of it.

## E. Fists (Leif, verbatim: "i should always be able to hit with my fist in combat mode.")
- In combat mode an unarmed or emptied hand always punches. That covers no laser, laser venting, reactor starved, or laser set down as a turret.
- Real physics: about 60 to 100 N·s impulse through the arm's mass. It knocks back small creatures and loose rocks, does little to big ones, and costs stamina.
- Procedural punch animation on the existing body (wind-up, follow-through, recoil); a heavy suit glove makes it hit harder.

## F. Automatic self-defence (Leif, verbatim: "and my character need sto defent itself automatically. and my personal defernces too. if something attacks me he shouldnt jut stand aroind he should activcely try to kill it to defend himself")
- When something attacks the character, the character fights back without player input:
  - turns to face the attacker;
  - aims and fires the laser if powered and not venting, otherwise punches (section E);
  - keeps footing, steps back or sidesteps;
  - continues until the threat is dead or flees.
- Player input always overrides. A setting chooses whether it is active only in combat mode or always.
- Personal defences do the same:
  - the laser turret and any placed turrets engage whatever attacks the player or the base;
  - suit systems react on their own (lamp flare to scare, jet hop away from a grab).
  - The ship AI assigns targets by threat.
- It follows the ecology stances: no auto-attacks on wary or fleeing animals, only on whatever is attacking or hunting you.

## G. From MINING.md revision 1 (Leif's answers)
- Composition fields replace ore materials: realistic grades from procedural geology; iron from anything, with real energy and haulage.
- Live cut-off grade.
- Automatic support planning, with support ghosts that jump the queue; collapse can kill and trap.
- Factorio-style blueprints:
  - copy, cut and paste, rotate and flip, curvature-aware;
  - a library with books, exportable as strings;
  - deconstruction and upgrade planners;
  - AI replication uses the same blueprints.

## H. Hive rebalance: real damage, numbers are the threat
Leif, verbatim: "the hive monsters are very too powerful. if my gun can destroy rock it can destory a bug. the problem with the bugs are numbers and once we make the handheld more ralistica nd actually based on real numbes it scales a lot easiler and they are a lot smaller inthe beginning. they scale and get bigger eventually"

- **Damage from physics, not HP bars.**
  - A 50 ms pulse puts 30 kJ on target.
  - Wet tissue ablates at about 2.6 MJ/kg, so one pulse vaporises about 11 g: a channel about 1 cm wide and 14 cm deep.
  - Any channel through a vital organ kills.
  - Chitin armour ablates slower (about 5 MJ/kg) and spreads the spot, so a pulse can scorch it without penetrating.
  - A punch uses its impulse against the creature's mass.
- **Early hive bodies are small.**
  - Scouts and workers are 0.2-3 kg; a pulse or a solid punch kills one.
  - Early soldiers are 5-15 kg with thin chitin and take 1-3 pulses.
- **The threat is numbers.**
  - A wave is tens to hundreds of small bodies.
  - The laser's heat budget (about 50 pulses, then about one every 11 s) is what loses the fight, not the damage per shot.
  - So scaling up your defence means turrets, cooling, more guns and area weapons.
- **The hive scales with your aggression and its awareness.** As it learns, it grows bigger castes over time:
  - armoured soldiers, 40-120 kg, chitin 1-3 cm;
  - burrowers that come through rock;
  - later, large breakers of 500 kg and up that need heavy weapons.
  - Size and armour rise with the escalation level, not from the start.
- **Tune the round 3/4 numbers to match.** Creature masses and organs become real; the laser's hurt code uses energy per pulse, ablation per material and penetration; punch damage uses impulse.

## I. Scanning, tech tree, items UI, pace and mass, modular miner
Leif, verbatim: "like subnautica i want to scan everything with can effects to know more details about everything eventually.  model the tech tree and the items and the ui for the inventory and items more celarly. tehres lots of things we can still improve with the logisitics and auto fetch. making mineshafts should be intuitive and easy. everything must move at a more realistic pace somethimes its moving too fat. we need to account for mass everywhere.  the cost of the miner doesnt make much sense. thought once its rod grows it needs to have more material and tahat makes sense. you should be able to upgrade it to branch out furghet down and switch out the drill if you pay more material to lines for logsitics and to carry up and down material and robots. you only pay for what you use and need. everything must modular and upgradable. and make sense in the rael world physically."

- **Scanning (Subnautica-like)**
  - A hold-to-scan beam from the arm: a visible scan sweep over the target, then a progress ring.
  - Each scan adds detail in layers: name and mass; composition and grade; behaviour and weak points; then the blueprint or tech unlock (alien tech, ruins, wreck parts).
  - Things need several scans or several samples before everything is known.
  - Everything is scannable: rocks (assay), plants, creatures, hive structures, ruins, your own machines (stats, wear).
  - A databank window collects every entry.
- **Tech tree, modelled explicitly**
  - Nodes are unlocked by scans, by crafting something the first time, and by research from samples. Each node unlocks items, parts and recipes.
  - A data file holds the whole tree.
  - The UI shows only what you can craft or are one step from; unknown nodes are hidden, not greyed out (consistent with round 5).
- **Items and inventory UI, clearer**
  - One item model: id, mass per unit, volume, stack rule, tier, parts.
  - Clear icons with tier and size marks; a tooltip with mass, use, and what makes it and what it makes.
  - Weight and volume are always shown for the inventory and each slot.
- **Logistics and auto-fetch**
  - The AI fetches anything you queue or craft from wherever it is stored, by the cheapest carrier.
  - Fetch tasks show their source, carrier, ETA and mass.
  - Fix any case where an order waits while the material sits somewhere reachable.
- **Pace and mass everywhere**
  - Every mover (player, drones, haulers, cages, belts, carts, creatures) has a mass-based max speed, acceleration and energy cost; loaded carriers are slower.
  - Build and craft times come from mass and power, not constants.
  - Audit anything that moves too fast against real figures (drone payload speeds, hoist speeds about 1-10 m/s, belts 0.5-2 m/s).
- **Modular miner and shafts, pay for what you use**
  - Placing a shaft is one easy action: mark the collar and the depth (drag down).
  - The rig starts as a small head with a short drill string.
  - The cost grows with the length actually built: rod, casing and lining per metre.
  - **Upgrades as modules on the same rig:**
    - extend deeper;
    - branch sideways at a level;
    - swap the drill head (pulse laser, rotary, TBM head);
    - add a hoist line or skip for carrying up and down;
    - add a robot lift, power and network down the shaft.
  - Each module pays only its own material.
  - Physically sound: the string's mass and the rock torque set the power needed, and the hoist rating sets the load per trip.

## Split (too much for one run)
- **Round 6** (one Fable): A energy and heat pulses, E fists, F self-defence, H hive rebalance, B0 mining core plus R1-R3 composition and supports, I pace and mass, I modular miner and shafts, I auto-fetch fixes.
- **Round 7** (one Fable): I scanning and databank, the tech tree, the items and inventory UI, R4 blueprint system, C procedural merge and upgrade machines, B large machinery and the logistics ladder.

## J. Global queue, categories, defences, stockpiles, fog of war
Leif, verbatim: "even if we are missing material i should be abel to queue it. the construction is not jjust local to me. when i start cusnstruction of something like a drone or shotgun the entire system wants to produce this and its put in the global queue. that means all stations and bases and factories in the hole solar system wants to produce this and optimizes for it.a nd it needs proper categories since we will ahve so manmy itmems. we need a lot more weapons you can place down. turrets. walls. and everything is producural and upgradable. upgrades happens automatically. the ysstem always works and finds something to do. it tireis to organize resources into pilesincluding rubble and asignes stockpiles for it and like rimworld we can configure this but also the ai autoamtically. so everyyhing is organized and easier to mass produce int osomething. it always keeps proper organized stock to keep track of everything. a drone needs a scanner. i hold a scanner. to know whats in a rock it needs to be scanned. to see underground i need to scan it. i cant see underground only if i have some system to see underground. fog of war is real and scanners and radar alows me to see blobs if i want vision i need to setup cameras and it expires after a short while"

- **Queue anything, even with missing material.**
  - Crafting or ordering always succeeds as an order.
  - Missing inputs become demand all the way down to raw rock (the round 4 rule, now without exceptions).
- **One global queue.**
  - An order (a drone, a shotgun) goes to the network's global queue, not to the suit.
  - Every producer anywhere (arm, machines, bases, later stations across the system) bids on it and on its sub-parts.
  - A planner splits the work by capability, distance, power, stock and transport time, and optimises completion time.
  - It is built on the ce-net cell model (each site a cell), but simulated locally for now.
  - The queue UI shows per order: where each part is being made and why.
- **Categories everywhere.**
  - A category tree: raw, intermediate, parts, machines, logistics, defence, weapons, tools, consumables, alien.
  - Used in the inventory, crafting menu, queue, stock targets and stockpile filters, with search and filtering by category.
- **Placeable defence, all procedural and upgradable.**
  - Many more placeable weapons: pulse-laser turret, autocannon, flamer (sulfur and organics), mortar, mine field, tesla arc, sonic deterrent for the wary fauna.
  - Walls and gates in tiers: rubble, rammed earth, basalt block, steel.
  - Each is built from procedural parts (mount, barrel/emitter, feed, cooling, sensor, computer) with stats from those parts.
- **Automatic upgrades.**
  - When a better part is unlocked and affordable, the AI queues upgrades by priority (defence under threat first).
  - You can pin a machine to opt out.
- **The system always finds something to do.**
  - Idle robots and machines pick work: tidy rubble, top up stock, pre-produce likely demand, repair, upgrade, extend supports, survey.
  - Never "idle" while there is a useful job.
- **Stockpiles like RimWorld.**
  - Stockpile zones with filters by category, priority and limits.
  - The AI creates and sizes zones automatically (rubble yard, ore bins, part store, ammo near turrets); the player can configure or override any of them.
  - Everything loose, including rubble, gets hauled into a zone.
  - The AI keeps an exact ledger of all stock by location, and the stock is what the global queue plans from.
- **Sensors are items, and fog of war is real.**
  - You only see what a sensor sees:
    - your eyes and lamp: line of sight;
    - the scanner you hold: short range, through rock, assay;
    - radar: blobs for moving things, no identity;
    - seismic: blobs underground;
    - cameras: real vision in their cone.
  - What a sensor saw goes stale: it fades to a last-known ghost after a short time.
  - Robots and drones need their own scanner module to identify things or assay rock; without one they only carry.
  - Underground stays black unless scanned or seen.

## Placement in the split
- **Round 6 adds:** queue-anything plus the global queue (local sites now), stockpiles and the ledger, the "always find work" behaviour, and fog of war with the sensor items (eyes, held scanner, radar blobs, cameras with expiry).
- **Round 7 adds:** categories across all UI, the placeable defence set with automatic upgrades, and drone scanner modules (with the scanning work).

## K. Salvageable wreck, deep bill of materials, mass orders, base building, interiors
Leif, verbatim: "the ship needs to be fully salvagable. the rocket engine and all of the component sand everything in it and fully repairable too. but its too wrecked actualyl to be repaired. it must be easy ti tell the system to craft 100 mech suits and it should try its best if you ahve the supply. but its very expensieve and all the componetns needs to be modelled. all the circuits and custom pcbs which needds to be setup and massproducesd specifically for this. custom pcbs, general cpus and gpus, structural parts custom molded or printed, bolts and screws  of all kinds of materials with coatings, concrete, steel beams. we quickly setup a parmieter and steel and ground. we use iron to forge beams and create ground for us and structuer to start building a ship and base and protection and something that feels ike inside. we need the layer ssytem and i want to bea ble to walkinto the ship through the door and see the interior once i do."

- **The wreck is a real ship made of real parts.**
  - Main engine (chamber, nozzle, turbopumps), tanks, reactor bay, laser hardpoint, computer core, antenna, hull plates, frames, wiring looms, life support, the printer.
  - Every part can be salvaged: the AI or you cut and unbolt it, robots haul it into stockpiles, and it becomes items or scrap by its condition.
  - Every part is in principle repairable (condition per part, repair = parts + time + power).
  - The ship as a whole is too wrecked to fly again: the keel is broken and the total repair cost exceeds building new.
  - Salvage is the early-game shortcut to parts you cannot make yet (CPUs, GPUs, PCBs, pumps).
- **Deep bill of materials, all modelled.** Each layer is an item with a recipe and a machine class:
  - **Electronics:** custom PCBs (designed per product, needing a PCB line set up and tooled for that design), general CPUs and GPUs (a chip line, hard tier; salvage first), passives, wiring looms, sensors.
  - **Structure:** steel beams (forged or rolled), plates, custom moulded or printed structural parts, concrete (cement, aggregate, water).
  - **Fasteners:** bolts, screws and rivets by material (steel, stainless, titanium, alien alloy), each with a coating option (zinc, phosphate, ceramic) and sizes.
  - **Tooling:** product-specific tooling (moulds, PCB masks, jigs) is itself an item, made once. It is the real cost of starting mass production, and the reason a line is set up "specifically for this".
- **Mass orders.** "Make 100 mech suits" is one action (a count field on any craft).
  - The global queue explodes it into the full tree, sets up the tooling and lines it needs, and produces as supply allows.
  - The order shows progress per sub-part, the bottleneck, and an ETA from current supply.
  - It never refuses: it does its best and says what limits it.
- **Base building that feels like inside.**
  - Early, fast: mark a perimeter and the AI builds it in steps: clearing, graded and compacted ground, a forged steel-beam frame, plate walls and floors, then a roof.
  - Iron to beams and ground pads is an early cheap recipe chain.
  - Enclosed space becomes an **interior**: pressurised and lit, with its own atmosphere value. It keeps the outside sound, weather and some creatures out.
- **Layers and interiors.**
  - The world has layers: a background wall, the play layer, interiors, and foreground passable layers (round 5).
  - Walking through a door into the ship or a building switches to that interior layer.
  - The outer hull fades away (cut-away view) and the interior shows rooms, consoles, pipes and wiring, and the salvageable parts in place.
  - Walking out restores the exterior.
  - The wreck's interior is authored procedurally from its part list, so salvaging a part visibly removes it from the interior.

## Placement
- **Round 6:** the wreck as real parts with salvage and condition; the door, interior and cut-away layer for the wreck; the perimeter, ground and beam base-building steps.
- **Round 7:** the full electronics, fastener and tooling bill of materials; mass orders with explosion and ETA; interiors for built structures.

## L. Visible networks and ranges; stepping between depth layers
Leif, verbatim: "the network must be visible wires for power and proper networks for signals which cis visible. range of things must be visible. pressing down around dug terrain should get me down to it as if im stepping in 3d down adn its 2 seperate layers proeprly."

- **Power is physical wire.**
  - Cables are real, sagging and routed: the AI lays them, and you can draw them.
  - Rated by cross-section, with I²R loss over length.
  - Drawn with a faint current flow when loaded; overload shows as heat glow and then a trip.
  - Poles and junctions are items.
- **Signal networks are visible too.**
  - Data cable and radio links between antennas, drawn as thin lines or arcs with packet pulses when active.
  - A link shows its bandwidth and range.
  - A machine without a network link shows that clearly and runs on its own local logic.
- **Ranges are visible.** Hold Alt, or hover in blueprint mode, to show:
  - antenna, turret, camera, radar and scanner ranges;
  - drone service radius;
  - power-pole reach;
  - the safe span of supports.
  - Cones for directional sensors, rings for omnidirectional ones, clipped by line of sight where it applies.
- **Two separate depth layers you can step between.**
  - The terrain has a front layer and a back layer, each a full voxel field with its own collision.
  - Where the front layer is dug away, pressing down (S) steps you back into the back layer, like stepping into the screen in 3D.
  - Pressing up (W) at an opening steps you forward again. The step is animated as a real stride with a depth shift: scale, shade and parallax.
  - Each layer collides only with itself, so you can walk behind a front-layer pillar or tunnel past things.
  - The back layer is what stays rendered behind dug terrain (round 5's back wall becomes a real, walkable layer).
  - Creatures, robots and loose matter live on a layer too.
  - The rule is used everywhere: base interiors (L/K) and passable platforms (round 5) sit on the same layer model.

## Placement
- **Round 6:** visible power wires with loss, visible signal links, range overlays, and the two walkable depth layers (it extends round 5's layer work).

## M. One global AI; reachable inventory is your inventory
Leif, verbatim: "theres no things as "ships ai" theres one ai system globally whichc youre a parrt of that serves you. the "ships ai" shoudl be yout inventory and is. you see everything whci is in reach and the whole system wroks for you to serve you. you see all clsoeby inventoryies which can be reached in a reasonable time by robots so you can just palce something and the robots do the actaul work of carrying everything"

- **One AI, global.**
  - Remove "ship AI" as a separate entity in code, UI and text.
  - There is one AI system across everything you own: suit, robots, machines, sites, later stations. You are part of it, and it serves you.
  - Its local face is your inventory and HUD.
  - Rename every "ship AI ..." string. The wreck's computer core is just hardware the AI runs on (salvageable, section K).
- **Reachable inventory.** Your inventory shows everything within reach, not just what is on your body:
  - your suit;
  - every stockpile, chest, machine buffer and loose pile that robots can bring to you within a reasonable time (an ETA threshold, default about 60 s, adjustable).
  - Grouped by category.
  - Each stack shows where it is and its ETA ("4.2 kg iron, store B, 18 s").
  - Items on your body are marked as in hand.
- **Place from reachable stock.**
  - You can place, craft or order anything that is in reachable stock as if you held it.
  - Robots do the carrying, from the stock to the site.
  - If nothing reachable has it, the order goes to the global queue (section J) and the item shows as a blueprint ghost.
  - Normal mode vs blueprint mode (round 5) becomes: normal places from reachable stock; blueprint (Tab) also allows planning with things not yet in stock.
- **The whole system works for you**, with the global queue, stockpiles and "always finds work" from section J as its engine.

## Placement
- **Round 6:** the one-AI rename, and reachable inventory with place-from-reachable-stock.

## N. Scanning gates drone mining; the suitless start; the mesh inventory
Leif, verbatim: "and if we scan and see a resource we need teh drones should be able to mine it for themselves. the problem is scanning which is expensie and the player has the only scanned at the start this is why the player needs to dig. and twaht the miner gets out has to be scanned manualyl by an assembly line all of htis is good for round 6. use proper  version control. the ocncept of inventory is the whole mesh inventory. you as a individual is pretty weak and this must be shown early the only reason you can even lift hte 140 kg reactor (or what it weighs) is becasue of your exosuit which is fragile. i want the game to start with you without any suit and beign slow and weak andyou have to put it on and find it within the shipa nd after you conect it it connects to your personal brain interface to the ship ai system adn computers and all the drones and sensors spring online. the ship has an antenna already so the drones spring active immidantely without physcial antenas. very long range. what you tdo need is cameras and data to actually see everyyhing when youre not actuavely lookingwhich is done by yoru ai system"

- **Scanning gates autonomous mining.**
  - Once a resource is scanned and known (grade and location), drones may mine it on their own when demand needs it, without a mining order.
  - Unscanned rock is never mined autonomously.
  - At the start the player's held scanner is the only scanner, and scanning costs time and power. So the player digs and scans; the drones follow.
  - Mined output of unknown composition must pass an **assay station** (a machine on the line) before the network knows what it is and can use it. Unassayed material sits as "unassayed rubble" in stockpiles.
  - Scanner modules for drones come later (round 7).
- **The inventory is the whole mesh inventory** (extends section M): everything you own anywhere, with reach and ETA deciding what can be used now.
- **Suitless start.**
  - The game opens with you inside the wreck, without the suit: a weak, slow human.
    - About 25 kg carry before slowing hard; no jet; a short jump; cold and oxygen pressure; easily hurt.
    - The 140 kg reactor is impossible to lift.
  - You find the exosuit inside the ship (interior, section K) and put it on with an animated step. It is fragile: it has condition, and damage to the suit's actuators cuts strength.
  - On connecting, the suit links to your brain interface and the AI system comes up. Drones, ship sensors and computers spring online with a visible boot sequence (HUD lines appearing, drones lifting off, lights coming on in the wreck).
  - Without the suit or after it breaks, you are back to the weak human.
- **The ship antenna covers a long range from the start.** Drones work immediately, with no physical antennas needed early (this replaces the antenna-placement requirement for the starting area). Relays matter only far away or deep underground.
- **Vision needs cameras and data** (consistent with section J fog of war): what you are not looking at is only known through cameras, sensors and the AI's records, and goes stale.
- **Version control (proper).**
  - Trunk-based on main. The fleet rule forbids branches: Leif, 2026-10-26: "we should never branch or we have branch hell".
  - One commit per feature or round, after the checks pass, and an annotated tag per round (v0.N).
  - The Pages deploy runs from main.
  - Planning documents are committed as they are written.

## Placement
- **Round 6:** all of section N.

## O. Smarter AI; robots help each other
Leif, verbatim: "drones can carry the hauler if its stuck. the ai needs to be a lot smarter."

- **Robots help robots.**
  - A stuck hauler (no progress for N s, or no path) raises a rescue job.
  - Drones whose combined lift exceeds the hauler's mass plus its load attach, lift and carry it to a reachable point, or carry its load in shares.
  - The same applies to a toppled robot, one buried by a collapse (dig out), or one out of power (bring a cell or tow it).
- **A smarter planner** (replace the greedy rules):
  - Real pathfinding on the planet's voxel layers for ground robots (A* or a navigation graph that updates on terrain edits), plus flight paths for drones with lift and energy limits.
  - One task market: every job (haul, build, mine, rescue, tidy, support, scan) has a value (priority × urgency) and a cost (time, energy, risk).
  - Robots bid; assignments are re-planned every few seconds, with reservations so no two robots take the same item or spot.
  - Batching: combine several pickups on one trip and plan multi-stop routes.
  - Look-ahead: pre-stage inputs for queued builds before they start, and charge before long trips.
  - Failure handling: detect and explain every failure (no path, too heavy, no power, no scan, danger), retry another way (another carrier, another source, call for help), and never silently idle.
  - Danger-aware: avoid awake creatures and unsupported spans, and wait for turret cover.
- **The AI's reasoning is visible:**
  - every robot's current job and plan line;
  - the queue's reasons;
  - a short log of decisions ("hauler 3 stuck at 40 m E, drones 1+2 lifting it").
- **Tests:**
  - a scenario where a hauler gets stuck and is rescued;
  - a batch-trip scenario;
  - no idle robot while a valid job exists.

## Placement
- **Round 6:** all of section O (it is the core of "the system always works for you").

## P. One suit that grows with you
Leif, verbatim: "iwant otehe suti and systmss to be upgradable. the same exosuit and system i start with is the one i upgrade and put into the mech later and bigger and bigger"

- **The exosuit you find in the wreck is a persistent, modular object** with an identity, condition and history. It is never replaced; it is upgraded.
- **Slots (procedural parts):**
  - frame;
  - actuators (strength, speed);
  - power cell and later a reactor mount;
  - cooling;
  - sensors (scanner, radar, camera);
  - brain-interface core (compute, link range, how many robots it can direct);
  - armour plates;
  - tool and weapon mounts (adapters, as Leif described for the laser).
- **Upgrades change real stats:** carry mass, speed, jump and jet, cooling budget, scan range and speed, armour by material and thickness. Installing one is a craft plus time; it is queued like anything else, and the AI can auto-upgrade it (section J) unless pinned.
- **Systems are upgradable the same way:** the AI core, network, sensors, robots and the shared part model.
- **Growth path:** the same suit docks into a mech frame as its cockpit and core. The mech is built around it, and later around the mech come bigger frames. The suit's core, interface and history carry through every size (suit, then mech, then larger walkers, and eventually the core can sit in a ship). Bigger frames scale strength, mass, power and weapons; the core you started with stays the centre.
- **Placement:**
  - Round 6: the suit as a modular persistent object with slots and stat-changing upgrades (needed by the suitless start in section N).
  - Round 7: docking into a first mech frame.

## Q. Progression: focus on now
Leif, verbatim: "we need proper progression and focus on the now . seeing the launchpad at the start when you cant build it is not fun. only show what we can do right now and it should be a lot. or show waht we should do right now to increase and go to the next stage of automation."

- **No future content at the start.**
  - Remove the launch pad, rocket and any out-of-reach structures from the default start and from the build and craft menus until their tech is reachable.
  - Dev scenarios keep them.
- **Show only what you can do now, and make that a lot.**
  - Every stage has a rich set of available actions, crafts, placements, upgrades and scans.
  - Menus list only the doable (or doable with what is in reach, plus blueprint planning of unlocked items).
- **Show the next step.** A quiet "next" panel (not a quest log) shows the 1-3 actions that advance automation right now, derived from the tech tree and the current bottleneck. For example:
  - "scan the red layer east: likely iron 30 %";
  - "assay station: lets drones use what you mine";
  - "second furnace: iron is your bottleneck".
  - Each has a short why.
- **Stages of automation as the spine of progression:**
  1. Suitless survival.
  2. Suit online, robots working, hand mining and scanning.
  3. First machines, assay, drone mining of scanned ore.
  4. Lines and stockpiles; the global queue doing most of the work.
  5. Shafts, heavy machinery and defence at scale.
  6. Replicated sites around the planet.
  7. Launch (only now does the pad appear).
- Each stage unlocks a visible new capability and a bigger scale. The "next" panel always points at the current stage's exit.

## Placement
- **Round 6:** remove future content from the start; doable-only menus; the next-step panel; stages 1-4 tuned to play well.
- **Round 7:** stages 5-7.

## R. The body and brain are upgradable too
Leif, verbatim: "everything is upgradable and replacable. even your human body and brain. once you have the bio tech for it in teh tech tree. with strength mutations and infinate life - after all youre going to survive 1000 years to complete this game."

- **Your body is a modular system like the suit.**
  - Organs and systems: muscles, bones, heart and lungs, skin, eyes, nervous system, brain.
  - Each has condition and stats, and each can be replaced or upgraded.
- **A biotech branch in the tech tree.** It is unlocked by scanning and sampling alien biology; the best biology sits near the hive nests (Leif, round 3).
  - Strength mutations (muscle density, bone lattice), regeneration, toxin and heat tolerance, low-light eyes.
  - Organ printing and replacement.
  - Longevity treatments up to **indefinite life**, because the campaign spans about 1,000 years.
  - Brain: augmentation of the interface core (more robots, faster links), memory backups, and later full replacement or continuity across bodies. This ties into the existing respawn rule: "your body respawns once you have built the machine to print a new one".
- **Upgrades have real costs and trade-offs:** materials, power, time, rejection or instability risk for alien grafts, and how the advanced species and Earth see you.
- **The same rule for everything:** every system (body, brain, suit, mech, robots, machines, sites) is made of replaceable parts with stats and upgrade paths.
- **Placement:**
  - Round 7: the body as modular parts with condition, plus the biotech branch's first nodes (mutations, organ printing).
  - Longevity and brain continuity: listed in the design doc for later rounds.

## S. Science, data, survival, rocket, remote presence
See docs/SCIENCE.md (Leif's words verbatim, design and placement). Round 6 takes its round 6 list; round 7 takes the rest.

## T. Frames and volumes, Earth-size planet, oxygen
See docs/SHIPS.md (Leif's words verbatim, design and placement).

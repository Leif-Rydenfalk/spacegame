# Space mid-game prototype: design (2026-11-15; for Leif's review; feeds round 8)

Leif, verbatim:
> alright this is all good for the planet start. i want to start prototyping the space part of it. same engne. same codbase. differnet spawnpoint and starting conditions. middlegame space where you maintain your base. top down view instead of sidescroller now- mining asteroids. this is more similar to sxygen not included game where you need to mine everything and we need the crafting syste mto be a lot more logical and bueaitufl and showcase all numbers. same world. same solar system. same game. same codbase same engine. all that is different is the spawnpoint and starting conditions and i want he dynamic reaassembly like shape ship building system with structures and shapes and differne fucntionality. its extremely modular. in the engine we need to seperate material from shape and functionality. a screw can be of amny differnet materials and for our purpose it doesnt matter. but htey have idfferent strengths and contribute differently. i dont like the "mk1" as in factorio. everything is logical and realistic. a suite is just a suit with the materials which makes it up which need sto be mapped in the component and parts tree. better parts and better components create a higher quality suit with more abilities because of the realistic ways to achieve things. stronger steel with higher carbon amount and highe purity means stronger suit. all of the supply chain must be mapped and tracked. all the percentages and processes. and you ideally wouldnt palce machines mnaualy. the ai palces what you need for you. and everything is realistic. you need toyou pulverize rock, haul it using a freighter by physcially movigng eand collecting the loose rock. you melt it by physically moving the rock through a furnace an dd seperate the different materials using a centrifuge or the realistic equivilent in thsi scenario. then you cast it. adn the whole step is autoamted and the ai tells you wahat you need to do and does it for you when possible because its so complicarted that the inventory cant even show all of the items and machines you need. fulyl simulated. aftrer casting you need to crack it and run another pass through another furnace for higher purity. then you refine it further by cleaning it using water and then you cut it up and pull it through rollers and bend it and smith it to the shape and waht you need. not a single step is missing and it takes a lot of space and special machinery. thats where the ai comes in to build it for you. but yo ucan build it yourself but it would take weeks because you have to knwo the whole chain. teh crafting system needs to be this detailed. extre,meöy detailed. and every single part need sto be an actual part you need to produce and everythijng exists in hte real world. i dont like the idea of inventories really except for the idea of abstraction and optimizing at planet scale. in space it should look a lot like factorio too but with the more advanced and automatd mechanics. shipyards. autoamted ship cosntruction. orbital logistics and mechanics and asteroid lockon. the most important part is the inventory and the logistic system and the look and feel of it. how do we make the automation fun and intuitive and breathtakingly complex.

## 0. What it is
- **Same game, codebase, engine, solar system and save format.** Only the starting condition differs: `?start=belt-base`. You spawn at an established mid-game base in the asteroid belt, years into the campaign, with a station, a small fleet, a working but incomplete metals chain, and your suit.
- **Top-down view**, the existing space act's camera and floating origin, real orbits.
  - On a base asteroid the view is a dense Factorio-like factory floor on the rock's surface and inside its tunnels.
  - Zooming out goes seamlessly to the station, the local swarm of asteroids and ships, then the belt, then the system.
- **Like Oxygen Not Included:** everything you have was mined and made here. Life support, power, heat and the crew's needs are all simulated. The base is a living machine you keep alive and grow.

## 1. Material, shape and function: three separate axes (engine core)
Every physical thing is **material × shape × function**. They are stored separately and combined.

- **Material** is a full spec, not a name:
  - **composition**: wt % of each element, e.g. Fe 98.9, C 0.42, Mn 0.65, Si 0.02, S 0.008, P 0.010;
  - **processing state**: cast, hot rolled, cold worked, quenched and tempered, annealed; grain size;
  - **derived properties** computed from those by real relations (examples of the scale, not all of them):
    - steel yield strength rises with C (about 250 MPa at 0.1 % C hot rolled; about 400-550 MPa at 0.4 % C; 900-1,400 MPa quenched and tempered);
    - S and P above about 0.03 % make it brittle (toughness drops);
    - copper conductivity falls about 1 % IACS per 0.01 % of impurities like P or Fe;
    - density, modulus, melting point, thermal conductivity, corrosion resistance.
- **Shape** is a parametric geometry from a small grammar: screw (thread, diameter, length, head), sheet (thickness, w × h), bar, tube, I-beam profile, plate, wire (gauge), casting (mould id), machined block. It gives volume, so mass = volume × density.
- **Function** is the role in an assembly: fastener (needs clamp load and shear), structural member (load and stiffness), conductor (current and loss), seal, bearing, pressure wall, heat path.
  - The function asks for requirements; any material and shape pair that meets them works.
  - "A screw can be many materials. For our purpose it doesn't matter, but they have different strengths and contribute differently": an M8 screw in 0.4 % C quenched steel carries a higher preload than one in pure iron, and that flows up into the joint, the frame and the suit.
- **No "Mk1/Mk2".** An assembly's stats are computed from its parts' real properties.
  - A suit's actuator torque comes from its motor (magnet material, copper purity, winding fill) and its gearbox (steel hardness).
  - Frame stiffness comes from the members' modulus and sections; armour from the material's toughness and thickness; cooling from the conductivity of the heat path.
  - Better materials and parts give a better suit, automatically and explainably: hover any stat and see which parts and which material properties set it.

## 2. The real chain from asteroid to part (space version; microgravity matters)
Asteroid types set the feed (realistic compositions):

| type | what it is | useful content |
|---|---|---|
| M (metallic) | Fe-Ni metal | Fe ~85-90 %, Ni 5-10 %, Co ~0.5 %, platinum-group metals ~10-50 ppm |
| S (stony) | olivine and pyroxene silicates | 10-20 % Fe-Ni metal grains, Mg, Si, O |
| C (carbonaceous) | hydrated silicates and organics | water 10-20 % (bound), C 2-5 %, N, S, some metal |

Each step is a machine with real throughput, power, heat and wear. Microgravity changes how things move: loose rock floats, and separation needs spin.

1. **Prospect and lock on.** Radar and spectrometer survey; a tug matches the asteroid's orbit, despins it (spin rate × moment of inertia sets the impulse and propellant), and anchors to it.
2. **Break.** Drill and blast, laser spall or grinding head. Fragments fly off with real velocities.
3. **Collect.** Freighters and collector drones physically chase and net or bag loose fragments (Leif: haul it by physically moving and collecting the loose rock). Anything missed drifts off and becomes debris on its own orbit.
4. **Pulverise.** Crusher, then ball or roller mill in a closed spinning drum (no gravity to feed it), down to a particle size.
5. **Separate the metal.** Magnetic separation pulls Fe-Ni grains from S-type fines. A centrifugal classifier sorts by density.
6. **Melt.** Solar concentrator furnace (mirrors; free energy near the sun) or electric induction/arc. In microgravity, slag and metal don't settle, so a **rotating furnace (centrifuge) separates them by density**: metal to the outside, slag to the inside.
7. **Cast.** Into ingots or slabs in spinning moulds or under pressure.
8. **Crack and remelt for purity.** Cast ingots are crushed or cracked and remelted in a second, cleaner furnace:
   - vacuum refining is free in space, removing dissolved gases;
   - oxygen blowing lowers C, S and P;
   - alloying adds C (from C-type asteroids), Mn, Cr and Ni to hit the target spec.
   - Alternatively the **carbonyl (Mond) process**: Fe-Ni + CO → gaseous carbonyls at about 50-150 °C, distilled apart, then decomposed into very pure Fe and Ni (powder or deposited shapes). Real, and well suited to asteroids.
9. **Clean.** Water washing and pickling remove scale and oxides. Water comes from C-types (baked out at 200-600 °C), recycled through a loop, with losses tracked.
10. **Cut.** Slab to bloom or billet by saw or shear.
11. **Form.**
    - Hot rolling, then cold rolling, to sheet, plate, bar or rod.
    - Wire drawing.
    - Bending and press forming.
    - Forging (smithing) for high-load parts.
    - Machining (CNC) for precision; heat treatment (quench and temper).
12. **Make the parts.** Thread rolling for screws, stamping, welding, assembly.
13. **Inspect.** Measure dimensions and test hardness; defects follow the yield and quality model (SCIENCE V2).

- **Side chains** run alongside: water to H2 and O2 (propellant and life support); C and CO from C-types (carbonyl process, steel carbon, polymers); silicon from slag (solar cells, chips via the arm and later a fab); glass; regolith concrete-like sinter for radiation shielding.
- **Recycling is total** (ROUND7 section 3): slag, swarf, scrap and wastewater all loop back.
- **Real equipment is big.** A rolling mill line is long, and a furnace needs radiators. The base layout is dominated by these machines, which is why the AI builds it.

## 3. The supply chain is fully mapped and tracked
- **Every batch of material carries a lineage:** which asteroid, which furnace run, its measured composition (with uncertainty, SCIENCE V3), and its process history.
- **Every part knows its batch.** A failed screw can be traced to a furnace run that drifted high in sulphur.
- **The process graph** (one graph with the part tree, ROUND7 section 5) records each step's inputs, outputs, yields, energy, time and machine.
- **Percentages are shown everywhere:** composition of every stream, yield of every step, losses, recycle fractions.

## 4. You don't place machines: you state intent, the AI plans and builds
- **You say what you want, at any level:**
  - "100 suits";
  - "steel sheet, 0.4 % C, S below 0.01 %, 2 mm, 40 t per month";
  - "a freighter with 2,000 t capacity";
  - "keep the station at 21 °C with 30 crew".
- **The AI plans:**
  - expands the part tree;
  - picks processes, sizes each step (machines × throughput) and lays out the factory;
  - routes logistics: belts and pipes inside, tugs and freighters outside;
  - shows the plan as a graph with every number before building.
- **You approve, edit or constrain:**
  - "use solar furnaces only";
  - "keep it under 2 MW";
  - "put the rolling mill on the station, not the rock".
- **Then robots build it.** Ghost machines appear and drones and construction ships assemble them.
- You *can* place every machine yourself; it would take weeks of real expertise, which is the point (Leif).

## 5. Inventory is replaced by the ledger, flows and zoom
- **Things exist only as physical objects**: in bins, tanks, on belts, in holds, drifting. There is no magic inventory.
- **The ledger is the abstraction:**
  - aggregated by material spec and form, e.g. "0.4 % C steel, 2 mm sheet: 12.4 t at station hold C, 3.1 t in transit";
  - drill down to batches and locations;
  - this is the "inventory as abstraction for optimising at scale" Leif accepts.
- **The flow view is the main screen for automation:**
  - a live Sankey diagram of the process graph;
  - stream widths are kg/s, colour is purity or composition;
  - bottlenecks glow, idle machines are dim;
  - numbers sit on every edge (rate, composition, energy).
- **Semantic zoom** (DESIGN.md abstraction layers): a screw in the thread roller, then the machine, the line, the factory, the base, the belt, the system. Each layer summarises the one below. A chain that runs stably **collapses into one solved node** you can expand again.

## 6. What makes it fun, intuitive and breathtakingly complex
1. **Intent, not micromanagement.** The player's decisions are what to make, to what spec, from which asteroid, with which energy, and where. The AI turns intent into the hundred machines and thousand parts. Complexity is visible and explorable, never mandatory busywork.
2. **Everything you see is real and moves.** Rock clouds after a blast, freighters chasing fragments, glowing slag spinning out of a centrifuge furnace, sheet unrolling from a mill, screws dropping into bins. Factorio's joy is watching the machine you made run; here it is physical, at every scale.
3. **Numbers you can follow to the bottom.** Hover the suit's strength and see it trace to the screw preload, to the steel's carbon content, to the furnace run, to the asteroid. Mastery means understanding why, not memorising recipes.
4. **Trade-offs with consequences:**
   - quality vs throughput (an extra refining pass makes the steel stronger and the line slower);
   - energy vs time (solar furnaces are free but need mirrors and sun angle);
   - distance vs richness (rich M-type far away vs C-type nearby for water);
   - purity vs recovery (recycle everything vs dump slag).
   - The AI proposes; the player picks the strategy.
5. **Bottleneck hunting at a glance.** The flow view shows where it chokes. Fixing it means a decision (more mills, a better process, a different asteroid), and the AI does the building.
6. **Growth you can feel.** The first ingot is handmade by the arm and a tiny furnace; later a belt-wide industry runs a shipyard. Solved chains collapse into nodes, so the screen stays readable while the empire grows.
7. **Orbital logistics as the second puzzle.** Launch windows, delta-v budgets, freighter schedules from demand forecasts (SCIENCE V9). Supply lines that physically fly are beautiful to watch and plan.
8. **Breathtaking at zoom-out.** Thousands of moving objects across the belt, each real, each on its orbit, drawn cleanly at every scale (maps.ce-net.com-style seamless zoom).

## 7. Ships and structures (SHIPS.md frame and volume system, in space)
- Reassembly-like frames of any shape. Volumes are assigned a function, and the AI fills them with real parts made in the chain.
- **Shipyards:** you order a design; the yard pulls parts from the ledger and the AI schedules the build; drones weld frames, install volumes and test.
- Ship stats come from parts and materials (section 1).
- **Asteroid lock-on:** a tug docks to a target and matches orbit and spin; the asteroid becomes a "site" that the AI can turn into a mine, a base or a shipyard.

## 8. Prototype scope (round 8, one Fable)
1. `?start=belt-base`: spawn at a small existing base on an S-type asteroid with a station in a nearby orbit, 2 freighters, 6 drones and the suit, in the same solar system. Top-down camera on the asteroid with the existing seamless zoom out to the belt.
2. The engine's material × shape × function model with derived properties for steel (C, Mn, S, P), iron, nickel, copper and water. A suit and a screw computed from parts, with a hover-to-trace stat breakdown.
3. The chain end to end in real physics, at small scale:
   - blast or grind, then physical collection of the loose fragments by freighter;
   - pulverise, magnetic separation, centrifuge furnace, cast;
   - crack and remelt with alloying to a spec, water wash, cut, roll to sheet;
   - thread-roll screws.
   - Each machine visible, with throughput, power and heat.
4. The flow view (live Sankey with numbers) plus the ledger, and lineage on batches.
5. The intent box: "make N of X to spec Y". The AI plans the chain, shows the graph, and places ghost machines that drones build.
6. Asteroid lock-on with a tug (match orbit, despin, anchor).

Out of scope for round 8: shipyard, combat, crew needs beyond O2, power and heat, the carbonyl process, chips.

## Open questions for Leif
1. Should the belt base's starting state be hand-authored lore (what you built during the "missing years") or generated from a simulated fast-forward of the planet game?
2. Is the solar furnace (mirrors) allowed early, or must power be electric?

---

# Revision 1 (Leif, 2026-11-15)

Leif, verbatim:
> nothing is written by hand. everything si genrated. on the fly. procedural. the whole solar sysstem is unique per player. Everything is allowed the question is can you produce it. do you have the mateirals and technology for it? do you have the mahchine tomake the specialized mirrors required for it and the time to reate the thousands of specialized components? it would take a week on your hand matter compiler withut the supply chain. tiem is the limit. time sis why you scale up and create more and more specialied machines and automate that too. build the shipyard system and atuoamtion right a way. the pooint of the demo is prototyping this gameplay loop and how automation feels. every singel machine is made up of actaul parts. in reandering and in teh tech tree and component tree. everything is rendered and something that can be modified. very single machine is made up of fudnamentla components that can be altered. this si an important complex system. every single component is made up of actual functaionly and ho it actually works is modular. so every machine is made up of fundamental components. amd tjese co,pometms are made and palced and moved and assembled in palce by robots and designed by ai and we have several and many blueprinsts for it to start - the amchines you can place at the start. but everythign si modifyiable and you can make your own designs. desinging aeacho of the individual parts and machines and functiojnlity and pieces and componetns and parts is very important. everything is structurally simulated. the ships are physialyl accurate and the pulses traverse the ships physically based and the phsyics is completely realistic with deformation. its not grid based but highyl efficent. the shapes cna be any shape like in reassembly with attatchement points made up of these ufndamentla parts. everything is procedural so that when placing a strucuterwith any size the blueprint palces the boldts and scres and the metal beams and designs them with the material constraints you nede so that it s all actually produced. very high complexity but this allows us to procedurally genrate and simulte entire ships and fleets and have procedural customizable technology you can dig deep into to optimize and perfect but also make it easy to just place using th recursive blueprint system if you need to.

## Answers to the open questions
1. **Nothing is hand-written.** The belt base's starting state is generated on the fly from the player's seed, like everything else. The whole solar system is unique per player.
2. **Everything is allowed; the limit is whether you can produce it.** Do you have the materials, the technology, the machine that makes the specialised mirrors, and the time to make the thousands of parts? On the arm alone it would take about a week of game time. **Time is the limit**, and that is why you scale up into specialised machines and then automate making those machines too.

## RV1. Machines are made of fundamental components (one system, all the way down)
- **Fundamental components** are a small library of physically working building blocks, each a material × shape × function (section 1):
  - structure: beam, plate, bracket, fastener, weld;
  - motion: bearing, shaft, gear, belt drive, linear guide, hydraulic cylinder, valve;
  - energy: electric motor, heater element, induction coil, heat pipe, radiator panel, battery cell, solar cell, mirror facet;
  - fluids: pipe, pump, tank, seal;
  - sensing and control: sensor, controller (PCB), wiring.
- **Each component works by its real principle**, simulated at a level that gives its stats. A motor's torque comes from coil current × flux; a roller's force from motor torque × gear ratio ÷ radius; a furnace's power from the coil and the load.
- **Every machine is an assembly of components**, rendered as those components (you see the motor, the gearbox, the rollers, the frame, the bolts).
  - It is listed in the part tree; its capability is computed from them.
  - Example: a rolling mill's maximum reduction per pass comes from roll force, roll diameter and the strip's yield strength.
- **Robots make, move, place and assemble components in place.** Building a machine is visible assembly, not a progress bar.
- **Starting blueprints:** the game ships with many procedurally generated, AI-designed machine blueprints (crusher, mill, magnetic separator, centrifuge furnace, caster, rolling stand, thread roller, wire drawer, press, CNC, welder, tug, freighter, shipyard gantry...).
  - Every one is modifiable: open it, swap a motor, change a material, resize a roll, and see the new capability and part list live.
  - You can design your own from scratch.

## RV2. The recursive, procedural blueprint system
- A blueprint is **parametric and recursive**: a structure blueprint takes size and load requirements and generates its own members, joints, bolts and screws, sized by real structural rules for the chosen materials (section 1). Those are then real parts in the part tree that must be produced.
- Placing a hull section of any size or shape:
  - the blueprint lays out the frame members;
  - it designs each joint (bolt count, diameter, grade from the material's strength);
  - it adds plating thickness from the loads;
  - and emits the bill of materials into the global queue.
- **Recursion:** a ship blueprint contains volume blueprints (SHIPS.md), which contain machine blueprints, which contain component blueprints, which contain material specs. Every level can be opened and edited, or left to the AI.
- **Easy by default, deep on demand:** "place a freighter" works in one click; a player who wants to perfect a gearbox's tooth profile can.

## RV3. Structural simulation (not grid-based, efficient)
- Structures (ships, stations, machines, asteroid anchors) are simulated as a **node-and-member network**: the frame's beams and joints as nodes and elastic-plastic members with real stiffness from the material and section. Plates are shell elements coarsened to their frame cells.
  - Solved with an implicit or XPBD solver on the GPU or in a worker, sparse, at an adaptive resolution: fine near loads and damage, coarse elsewhere.
- **What this gives:**
  - **Stress and deformation** under thrust, docking, spin, impacts and thermal expansion. Members yield and bend plastically, and joints fail when bolt shear or weld strength is exceeded. The ship splits along failed members (the existing connectivity split).
  - **Impulses travel physically**: an impact or a weapon pulse sends a stress wave through the members at the material's wave speed (√(E/ρ) ≈ 5 km/s in steel), attenuating at joints, so damage spreads realistically.
  - **Any shape** (Reassembly-like): attachment points are real joints made of fundamental parts, so the shape is free.
- The level of detail of the simulation follows the camera and the action. Distant fleets run as rigid bodies with a stored stress state until something happens to them.

## RV4. Shipyard and automation from the start of the prototype
- **The shipyard is in round 8:**
  - a gantry and drone swarm that assembles any ship blueprint from parts pulled from the ledger;
  - visible welding and bolting;
  - frame first, then volumes, then systems, then tests.
- **Automated production of production:** the AI also builds the machines that make the machines. "Make 10 freighters" can expand into "first build a second rolling stand and a thread roller", and the plan shows that.
- **The demo's point (Leif): prototype this loop and how automation feels.** Intent, the AI plan, robots assembling real components into machines, machines producing parts, the shipyard assembling ships, and ships extending logistics.

## Round 8 scope, revised (replaces section 8 where it differs)
1. `?start=belt-base`: generated per seed, a solar system unique per player, the base generated from the seed (no authored layout).
2. Material × shape × function plus derived properties (section 1).
3. The fundamental component library (RV1), with real-principle stats and rendering.
4. Machines as component assemblies, generated as starting blueprints and editable in a machine editor with live stats.
5. Parametric recursive blueprints that size joints and fasteners (RV2).
6. Structural simulation on ships and stations (RV3), with deformation, joint failure, splitting and stress-wave propagation.
7. The asteroid-to-screw chain (section 2) built from those machines.
8. Robots assembling components in place.
9. Shipyard (RV4).
10. Flow view, ledger and lineage; the intent box with the AI plan; tug lock-on.

Priority if time runs short:
- **First:** 1-5, 8 and a minimal 7 (a short chain); 9 with a small freighter; 10.
- **Then:** 6 at basic level (static stress plus joint failure).
- **Moves to round 9:** stress waves and the full chain.

---

# Revision 2 (Leif, 2026-11-15): biology uses the same components

Leif, verbatim:
> everythign is mafe up of these fundamental components. and biology also has. trees. plants. animals. everytihng is made up of componetns with parametrs so its 100% procedural, reusable and can be used in the tech tree and system. a treebranch can become a structural material your robots use. a insect antenna can be used by your snesors and plugged into a circuit to detect and colelct data on smell nd animal presence. for example .the engine must be modular enough so that modelling thousands of details like this becomes pretty easy and modualr and ettensible and produces millions and billions of combinations and systems and variations. fully procedural

## RV5. One component model for machines and living things
- **Living things are assemblies of parametrised biological components**, on the same footing as machine components (material × shape × function):
  - structural: wood, bone, chitin plate, cartilage, shell, root;
  - motion: muscle (force ∝ cross-section), tendon, joint, wing membrane, cilia;
  - energy and chemistry: leaf (photosynthesis rate ∝ area × light), fat store, gland (secretion: venom, resin, ichor), bioluminescent organ;
  - fluids: vessels, heart pump, xylem;
  - sensing: eye, antenna (chemoreceptor), lateral line, hair sensor;
  - control: ganglion, brain.
- **Each has a material spec** (wood: density, fibre strength along and across grain; chitin: modulus, toughness) **and a working principle** that gives stats, exactly like a motor or a beam.
- **The procedural generator builds organisms from these components** with body-plan grammars: tree, shrub, fungus, crawler, strider, flyer, balloon, hive caste. Species parameters (seeded per planet) set sizes, counts and materials. Rendering, physics (springs, ragdolls, felling), behaviour limits (speed from muscle and mass) and scan results all come from the assembly.
- **Harvested biological parts are items in the same part tree** and can fill any function slot whose requirements they meet:
  - a tree branch, as a beam with the wood's properties, is a structural member robots can use;
  - an insect antenna, as a chemoreceptor with sensitivity and selectivity, plugs into a circuit as a smell or animal-presence sensor that streams data;
  - resin is an adhesive or sealant; chitin plates are armour; balloon gas sacs are lift volumes for cargo balloons; bioluminescent organs are light sources; muscle fibre is an actuator in a bio-machine.
  - Scanning reveals each part's real parameters; the more data, the narrower the uncertainty (SCIENCE V3).
- **Biotech in the tech tree** is about learning to use, grow, breed and then design these components: cultivate the antenna organism, grow trees as structural timber farms, engineer balloon species. It is the same research and data loop (SCIENCE section 4).

## RV6. Engine requirement: modular and extensible enough for billions of combinations
- **A component is a data definition, not code:**
  - parameters with ranges;
  - a material slot;
  - a shape grammar;
  - a function block (inputs, outputs, requirements, a small formula set for its working principle);
  - render rules;
  - physics rules;
  - recycling paths.
  - Adding a new component (a new gland, a new valve) is one definition file plus at most a small principle formula.
- **Assemblies are graphs of components** with typed ports: mechanical, fluid, electrical, data, chemical and biological-signal. Ports validate compatibility by requirements, not by item id, so a chitin plate fits an armour slot, and an antenna fits a sensor port through a bio-electric interface component.
- **Generators** (planet, species, machines, ships, blueprints) are grammars over this graph. Combinations multiply: thousands of definitions × parameters × materials × assemblies produce millions to billions of distinct, valid, simulated things.
- **Stats, rendering, physics, scanning, the part tree, the tech tree, recycling and the ledger all read the same graph.** No subsystem keeps a separate copy of what a thing is.
- **Performance:**
  - definitions are compiled to compact typed arrays at load;
  - assemblies are stored as flat component lists with port indices;
  - aggregate stats are cached and invalidated on edit;
  - LOD collapses distant assemblies to their cached stats and impostor rendering.
- **Round 8:**
  - build this component data model and the definition format first, with the machine library and a first biological set (tree, branch, leaf, the antenna insect, the strider);
  - demonstrate one cross-over each way: a branch used as a structural member, and an insect antenna plugged in as a sensor;
  - the full surface species migration moves to a later round.

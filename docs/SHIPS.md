# Construction: frames and volumes (ships, bases, the wreck) (design, 2026-11-14)

Leif, verbatim:
> everything has attributes here. all players and rocks and machines and parts and component and everything has a place in the world and is rendered. the way you model the starter ship is how the construction system and dynamic ship building will wokr. im imagining reassembly but with more customizability and blueprints and a lot more parts and systems and options for each setup.. i want to build frames of any shape and fill it with waht i need, armor, fule tank, sensor, tank, storage, room for human, any shape and any size but i select what the space is used for and the ai and dynamic system fills it in. so the structureal fram and shape is kept away from the dynamicfunctionality  and rendering baed on that. make the planet as big as earth or slightly bigger  becasue we want a thicker atmosphere to allow the balons and bigger fauna and flora. oxygen is devfenetly not inlcuded and will need to be managed and produced. and a steady atmosphere needs to be managed.

## 1. Everything is a thing in the world
- Every entity has attributes (mass, material, condition, temperature, data, owner) and a position, and is rendered.
- This covers players, rocks, machines, parts, components, items in storage and items being carried.
- No abstract counters without a physical counterpart. A stockpile of bolts is bolts in bins.

## 2. Frame and volume, separated (Reassembly, with more depth)
- **Frame**: you draw the structure in any shape and any size: beams, nodes and skin panels as a free polygon or graph, not a grid.
  - The frame has real structural attributes: material, section, mass, stiffness and load limits.
  - Its strength is checked under thrust, gravity and impacts.
- **Volumes**: you select regions inside the frame and assign a use:
  - armour, fuel tank, oxidiser tank, cargo or storage, crew room (bunk, galley, toilet);
  - life support (O2 production, CO2 scrubbing, pressure);
  - reactor bay, engine bay, sensor bay, computer and data, battery, radiator, hangar, weapons bay.
- **The dynamic system fills each volume.**
  - It picks and lays out the actual components to fit the shape: tank walls following the outline, bunks and consoles in a room, armour layered to the skin, pipes and wiring routed between volumes.
  - Results come from the volume's size and the unlocked tech; it re-fills automatically when tech upgrades.
- **Rendering follows function.** The look comes from the frame plus the filled components, procedurally: hull panels, tank curvature, windows on crew rooms, radiators on radiator volumes. The cut-away interior (round 6 K) shows the filled rooms.
- **Derived stats:** mass, centre of mass, inertia, thrust-to-weight, delta-v, power, cooling, crew capacity and endurance (food, water, O2 days), sensor coverage, armour per side.
- **Blueprints and options:**
  - A frame plus its volume assignments is a blueprint (round 7 blueprint system).
  - Each volume has options (tank pressure rating, armour material, room comfort level). The AI can propose fills.
  - The same system builds ships, bases, stations and mechs.
- **The starter wreck is built with this system**, so salvage, interiors and repair use it from round 6, and the player's first ship uses the same tools.
- **Damage** is per component and per frame member. Broken frame members can split the ship along its graph (the existing space-act splitting).

## 3. Planet scale (Leif's decision)
- Earth-size or slightly bigger, with a thicker atmosphere for balloons and large fauna and flora.
- Proposed values, consistent with the current g of 8.7 m/s²:

| quantity | value |
|---|---|
| radius | about 6,800 km |
| mass | about 6.0 × 10^24 kg (1.01 Earth) |
| mean density | about 4.6 g/cm³ |
| surface pressure | about 2.5 bar, dense air with no free O2 |
| orbital speed at the surface | √(gR) ≈ 7.7 km/s |
| escape speed | about 10.9 km/s |
| delta-v to low orbit | about 9.5-10 km/s with drag and gravity losses |
| far-side light delay | about 0.07 s along a ground path, about 1/3 s by satellite relay |

- **What this means:**
  - Only the area around active sites exists in voxel detail (lazy, deterministic). The rest is LOD terrain, shown only where known (SCIENCE.md section 5).
  - The antipode hive is about 21,000 km away by surface.
  - A realistic launch vehicle is large. The reactor's energy for propellant still makes it achievable (SCIENCE.md section 2).

## 4. Oxygen and atmosphere (correction to SCIENCE.md section 6)
- Oxygen **is** included: the air has no free O2, so it must be produced and managed (Leif: "oxygen is devfenetly not inlcuded and will need to be managed and produced").
- Sources: electrolysis of water (about 5 kWh per kg O2 net), molten-oxide electrolysis by-product (MINING.md R2), and later bio sources.
- Consumers: the person (about 0.84 kg O2/day), and suit and habitat leaks.
- Every interior volume has an atmosphere state: pressure, O2, CO2, temperature, humidity. Life support keeps it steady:
  - scrubbers remove CO2;
  - heaters and coolers hold temperature;
  - airlocks lose gas per cycle;
  - hull breaches vent.
- The suit has its own O2 supply and scrubber.

## Placement
- **Round 6:**
  - the frame and volume model as the core data structure;
  - the wreck modelled with it (salvage, condition, interior from the fills);
  - "everything is a rendered thing" for stockpiles and carried items;
  - oxygen and atmosphere for the suit and the wreck interior.
- **Round 7:**
  - the player-facing frame editor (any shape, any size), volume assignment and the AI fill;
  - derived stats and blueprints;
  - base and habitat atmosphere management;
  - the Earth-size planet change (section 3) with LOD.

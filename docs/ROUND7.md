# Round 7 (Leif's play feedback on round 6, 2026-11-15, plus round 7 items from ROUND6.md, MINING.md, SCIENCE.md and SHIPS.md)

Leif, verbatim:
> the conveyor belts doesnt make much sense and its still not like factorio where blueprints and items are all an item in an ivnentory which i want. the conveyor belt placement didnt make much sense. and there is no easy way of deconstructing and the robtos are still idle mostly even if we have thingds to do. i just died from stepping into a couple of rocks. thats dumb. rocks should be more solid even when in their loose state and i shouldbe ableto climb over htem without dying. logistics needs to be improved and omore clear and the miner should actually output all of its rock at the top for robtos to take away. and storing all rockts loosely basicxally at the ship site is not very nice. maybe use it to create a wall against critters. and we need the depth system for this. i dont step over the rocks once they are placed in our piles i step through them in 3d layer. we need a lot more detailed part system. everything is automatic. you can craft the 10000 different parts for the nuclear reactor individually but mosta re put on queue by the systemocence you say you want to do it. we calculate the part and component tree. this is sokmething i want you to create. a part and component tree. and every machine and everything and the tech tree is a part of it. every single part and how it connects to all mahines and everything. and disasemblying a camera or anything need sto be realistic. there is still chance of saving it. i dont like the concept of "grade"as a percentage and the yield of material is based on tht. in the real world basically all material is recovarable and recycleble. this is very important in space missions too. cuting down trees is way too easy and n ot realiistic with the laser.

## 1. Fixes from play (first)
1. **Rocks don't kill you by walking into them.** Loose rock is solid for the player: you step up onto and climb over piles (step height plus a climb assist). Contact damage only from real impacts (relative speed above about 6 m/s, by energy), never from resting or slow contact.
2. **Robots are never idle while work exists.** Audit the task market with a live counter (open jobs vs idle robots, and the reason each idle robot rejects each job). Fix the causes until the counter shows no idle robot beside a doable job in a 20-minute play run.
3. **Easy deconstruction.**
   - A deconstruct tool (Factorio's deconstruction planner): drag over things and robots take them down, haul the parts to stock and keep their condition.
   - Also a single-target remove (right-click hold).
4. **Conveyors that make sense.**
   - Belts are an item you hold and place by dragging a path, Factorio-style: direction arrows, snapping to machine ports, inserters or loaders at the ends.
   - The AI may propose belts as ghosts in blueprint mode, but never lays surprise belts.
   - The flow on a belt is visible as items moving.
5. **Blueprints are inventory items** (Factorio): a blueprint, a blueprint book, the deconstruction planner and the upgrade planner are all items in slots.
6. **The miner outputs at the top.** The shaft rig hoists everything it cuts to a collar output pile or bin at the surface, where robots take it away. Nothing is left at the face.
7. **Rock storage that makes sense.**
   - Spoil goes to designated spoil zones away from the base, or is used: the AI builds rubble walls and berms against critters on the perimeter, backfill, and ground pads.
   - Piles live on the back depth layer, so you walk past them in front, not through them (needs section 2).
8. **Trees are hard to cut.** Wood and alien trunks take real energy: a trunk of diameter d needs a kerf through it, plus a pulsed laser that chars rather than cuts cleanly, so it takes many pulses. Felling is a job: cut, the tree falls with physics, then sectioning into logs.

## 2. Depth layers (now required)
- A general two-layer world: front and back voxel fields with their own collision.
- Step back with S where the front is open, and forward with W.
- Stockpiles, spoil and walls can sit on the back layer.
- (ROUND6 L, now for all terrain, not only the wreck.)

## 3. Recycling replaces "grade"
- The game stops showing grade as a single percentage that sets yield.
- Every piece of matter has a full composition (mass of each element or compound), and **all of it is recoverable**: given the process and energy, nothing is waste.
  - Slag gives Si, Al, Ca and O.
  - Tailings are reprocessed.
  - Scrap is sorted and remelted.
  - Organic waste becomes C, N, P, water and fuel.
- Processing cost depends on how the element is bound (free metal, oxide, silicate, sulfide) and how mixed it is. Rich ore is cheap per kg; ordinary rock costs more energy and handling but still yields everything.
- Show composition as a breakdown (kg of each, with uncertainty), not a "grade".
- Recycling is central (space missions recycle everything): every machine, part and item can be disassembled back toward materials.

## 4. Realistic disassembly
- Taking something apart (a camera, a pump, a hull plate) is a job with a tool and a time.
- Each sub-part comes out with its own condition and a chance to be damaged in removal (by skill and tool tier).
- Damaged parts can be repaired or recycled.

## 5. The part and component tree (Leif: "this is something i want you to create")
One graph holds every item in the game: raw materials, parts, components, assemblies, machines, structures, vehicles, and the tech tree nodes that unlock them.

- **Node:** id, name, category path, mass, volume, materials (composition), precision class, the processes that make it (machine class, time, energy), and its children (part id × count).
- **Edges:** "made of" (BOM), "made by" (machine class), "unlocked by" (tech node), "needs tooling" (moulds, masks, jigs).
- **Procedural generation of the deep tree.** A reactor's 10,000 unique parts are not typed by hand. Grammars expand an assembly into subassemblies and parts by type:
  - fastener families by size × material × coating;
  - PCBs per product, with their chips and passives;
  - pipes and valves by bore and pressure;
  - seals, bearings, wiring looms, sensors, brackets.
  - Seeded, deterministic, and they reuse common parts across products (a real bolt is shared).
- **Rollups** computed from the leaves: total mass, material bill, energy, time, the machine classes needed and the tooling needed.
- **Ordering:** saying "make a reactor" explodes the tree into the global queue. Common parts come from stock; missing machines and tooling become their own orders. You can still open any node and craft a single part by hand.
- **One graph:** the tech tree, the item tree, the machines that make them and the recycling paths back are all one graph.
- **A browser UI:** search, a category tree, the parts of an item, where an item is used, what makes it, what it unlocks and where you have it.
- **Export to data** (docs/parts/*.json, generated at build time) so the community can read and extend it.

## 6. Round 7 items carried from earlier docs
- ROUND6:
  - I: scanning and databank, tech tree, items and inventory UI;
  - R4: the blueprint system (now as inventory items);
  - C: procedural merge and upgrade machines;
  - B: large machinery and the logistics ladder;
  - J: categories, placeable defence and drone scanners;
  - K: bill of materials and mass orders (now the part tree, section 5);
  - P: mech docking;
  - Q: stages 5-7;
  - R: the body.
- SCIENCE.md: round 7 items (science scaling law, chips from the compiler, remote presence with delay, farming, the realistic rocket with the reactor drive core, mission supply planning, yield and quality, scheduled transport).
- SHIPS.md: round 7 items (the frame editor, volume fill, derived stats, base atmosphere, the Earth-size planet with LOD).

## Priority
1. Section 1 fixes.
2. Section 2 depth layers.
3. Section 5 part tree and its UI, with section 3 recycling and section 4 disassembly.
4. Blueprints as items, scanning, the tech tree.
5. The rest of section 6 as far as it goes. List what moves to round 8.

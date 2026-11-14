# Mining mechanics (design, 2026-11-14; for Leif's review; feeds round 6)

Leif: "come up with how the mining mechanics will work and behave."
This builds on what Leif has said: realistic physics, heavy machinery underground, mine shafts, the AI doing the work, noise waking the hive, real rock that breaks like rock, everything carried. Numbers come from docs/LASER-ENERGY.md.

## 1. Rock is a material, not a block
Every voxel sample carries a material (already true) plus two hidden fields generated with the terrain:
- **Joints**: a fracture network per rock body, made of a few sets of planes with spacing (basalt has columnar joints about 0.3 to 1 m apart; obsidian has almost none). Rock breaks along joints first.
- **Stress**: rock under a lot of overburden is loaded. It matters for collapse (section 6).

Each material has density, compressive strength, fracture toughness, specific melting energy and abrasiveness. These decide which method works:

| material | rho | strength | joints | best method |
|---|---|---|---|---|
| soil | 1500 | weak | none | shovel, bucket, steam-spall |
| basalt | 2900 | 200 MPa | columnar 0.3-1 m | pulse spall, wedge, blast, TBM |
| obsidian | 2500 | brittle, glassy | none | thermal shock (shatters into sharp shards) |
| iron ore (hematite) | 5000 | 150 MPa | blocky | blast + crush |
| copper ore | 4200 | veins in basalt | follows the vein | selective cut along the vein |
| lumen | 2100 | soft crystal, glows | brittle | careful: shatters and loses yield if blasted |
| xeno stone | 3400 | very hard | none | only alien tech or a long time |

## 2. Finding ore
You cannot see ore through rock. Exposed faces show it, and surveys reveal it:
- **Eye and lamp**: surface outcrops, coloured seams in cut faces, lumen glow in cracks.
- **Suit scanner** (short range, a few m): a density and conductivity probe that shows a fuzzy ore map around you.
- **Seismic survey**: every hit, pulse and blast sends waves the ship AI listens to. Blasting reveals a large area but is loud.
- **Core drill**: a small machine bores a thin hole and returns a column sample. It is exact, but only along that line.
- The AI keeps a **probability map**: each sample tightens it. It is drawn as a soft overlay in blueprint mode (Tab), so you plan mines on what you know.

## 3. Ways to break rock (energy per m³ of rock moved)
Higher tiers are orders of magnitude cheaper, which is the progression:

| method | how it behaves | energy |
|---|---|---|
| hand: fist, pick, pry | only soil, loose rock and joint blocks | your stamina |
| laser, continuous (melt) | needs the cooling loop; clean, slow, molten slag | ~4,000 MJ/m³ |
| laser, pulsed (spall) | handheld; chips and kerfs; frees joint blocks | ~500-1,000 MJ/m³ |
| kerf + wedge | cut slots, a hydraulic wedge splits along the joints, whole blocks fall | ~50 MJ/m³ |
| blasting (sulfur + organics) | the AI drills holes and charges them; rock breaks into a size spread; very loud; flyrock | ~3-10 MJ/m³ (chemical) |
| excavator / ripper | soil and broken rock | ~20 MJ/m³ |
| tunnel-boring head | cuts a round tunnel, continuous muck stream | 10-100 MJ/m³ |

## 4. Fracture and loose rock
- When rock is freed (a kerf closes a loop, a wedge splits, a blast fires) the cut-out region becomes rigid **fragments**. They are split along the joint planes first, then by a Voronoi pattern sized by the energy (more energy, smaller pieces).
- Fragments are real bodies (round 5 solver): mass from volume times density, they tumble, pile, wedge and settle. A pile has a real angle of repose (~35° for broken basalt).
- Big fragments are boulders. A crusher, more pulses or a wedge breaks them down. Small fragments become granular **muck**, drawn as particles and simulated as one heap that flows, to keep the body count down.
- Mass is always conserved: rock in place = fragments + muck + vapour.
- Hot cuts leave glowing slag that cools and glazes the face.

## 5. Carrying it away (it is all physical)
- Freed rock blocks the tunnel until it is moved. Mining speed is usually limited by **hauling, not breaking**.
- Each tier moves more:
  - you carry, up to your load limit;
  - drones carry 15 kg and haulers 60 kg;
  - a muck cart on rails is about 1 t;
  - a conveyor carries a few t/h;
  - a skip in a shaft (hoist) carries tonnes per trip.
- The AI sorts at the face: ore goes to processing, waste rock goes to a **spoil heap** (it builds embankments, fills old voids, or backfills).
- Spoil and dust are pollution and noise. The heap is visible, and the hive notices.

## 6. Underground: shafts, support and collapse
- **Opening span**: each rock has a maximum unsupported span. It depends on strength, joints and depth (stress). Past it, the roof starts to fail: first dust and cracking sounds, then falling blocks, then collapse.
- **Support**: rock bolts, mesh, steel sets and concrete lining. Each raises the safe span. The AI places support behind the face automatically as part of every tunnel job.
- **Collapses are real events**: the roof fragments fall as bodies and can bury machines, cut belts or trap you.
- **Mine shafts** (vertical):
  - Dig the collar, and the AI lines the shaft and installs headframe, hoist, cage and skip.
  - Every landing gets a station (power, network relay, turret).
- **Hazards**:
  - water inflow (pumps, or the level floods);
  - gas pockets (alien methane-like; explosive with the laser);
  - heat that rises with depth;
  - **hive tunnels you break into**.

## 7. Processing the ore
Each step is a machine with real throughput and power. Grade matters: a 40 % iron ore yields less than 60 % ore and makes more tailings.
1. Crusher: boulders to gravel.
2. Grinder or mill: gravel to fines.
3. Sorter: by density and magnetism; ore concentrate on one side, tailings on the other.
4. Smelter: about 400 kWh per tonne of iron on an electric furnace.
5. Products.

## 8. Automation: you mark it, the AI mines it
- **Blueprint mode (Tab) has mining orders**:
  - paint a region to clear;
  - draw a tunnel or shaft path;
  - mark an ore body to "follow".
- **The AI plans the job**: method by rock and available kit, then support, haulage route (robot vs belt vs rail, round 4 logic), spoil site, and the turret cover the job needs. It shows the plan and the reasons, the same way as the build queue.
- **Execution is physical**: machines and robots break, load, haul, bolt and advance. Bottlenecks show (e.g. "face waits for haulage").
- **Do it once, replicate**: once you have run a working mine (face → crusher → sorter → smelter → stock), the AI can stamp out the same mine on any other ore body. That is Leif's "AI replicates anything done once".
- **Demand drives it**: stock targets pull ore; the AI opens or expands mines when a target can't be met, prioritising expansion (round 4 priority rule).

## 9. The hive reacts to mining
- Noise travels through rock better than air. Blasting is heard far underground, TBMs are a steady hum, pulsed lasers are a tick.
- Deep mines break into hive galleries. **The best ore and the best biology sit near the nests** (Leif). Every expansion is a choice between quiet-and-slow (wedges, pulses) and loud-and-fast (blasting, TBM).
- Turrets at shaft landings and tunnel faces are part of every mining job.

## 10. Order of play
1. Pulse the laser and free joint blocks by hand; carry rock; the arm prints a pick and a wedge.
2. Drones haul; a crusher and furnace line runs; the AI clears marked regions.
3. The first shaft with a hoist; blasting from sulfur and organics; rock support; ore following.
4. TBM, rail muck carts, deep levels, water and gas, the first hive breach.
5. Replicated mines across the planet, then the same rules on asteroids in Act 2 (no gravity: freed rock floats away, so it has to be netted or bagged).

## Open questions for Leif
1. (Answered in revision 1: collapses can kill and trap; supports are planned and placed automatically.)
2. Is blasting allowed from the start (sulfur and organics are everywhere), or gated behind a tech step?
3. Should the AI ever break rock by itself without a marked order? The default here is no: it only mines what you mark or what demand needs, inside regions you allowed.

---

# Revision 1 (Leif, 2026-11-14)

Leif, verbatim: "I want ore concentration to be ralistic and procentural and based on the procedural genration. so ore is just rock with high concentration of what you want but you can get irion out of basically anything and eveything. a lot more realistic. realistic numbers. yes collapse can kill meand trap me o supports are autoamtically palnned and our logistic system and ai and robotics place suports to stop that from happening. i want a proper blueprint ystem like factory where yo ucan create maps of layouts that works and copy and paste them"

This replaces the material table in section 1 and section 7 where they differ.

## R1. Ore is rock with a high concentration (composition fields)
- There are no "ore materials". Every sample of rock has a **composition**: weight fractions of oxides and elements, generated procedurally from the geology. A material id only names the host rock (soil, basalt, felsic rock, sediment, hive tissue, xeno stone).
- Composition = **host rock baseline** + **ore-forming processes**. Each process is a procedural field tied to the generation, so ore sits where real geology would put it:

| process | what it makes | where it forms | realistic grade |
|---|---|---|---|
| host baseline: basalt | Fe 8-10 %, Si 23 %, Al 8 %, Mg 4 %, Ca 7 %, Ti 1 %, O 44 % | everywhere mafic | Fe ~8 % |
| host baseline: felsic rock | Fe 1.5-3 %, Si 32 %, Al 7 %, K 3 % | crust blocks | Fe ~2 % |
| host baseline: soil / laterite | Fe 3-6 %, enriched to 20-40 % in weathered red layers | near the surface in wet biomes | 5-40 % |
| magmatic segregation | magnetite / ilmenite layers: Fe 30-55 %, Ti 5-15 % | bands near the base of old lava bodies | 30-55 % |
| banded iron (sedimentary) | hematite and quartz layers: Fe 25-35 %, rich pods 55-65 % | old sea-floor sediments | 25-65 % |
| hydrothermal veins | Cu 0.5-5 %, Zn, Pb, Ag ppm, sulfur | along fractures (the joint field) around intrusions | 0.5-5 % Cu |
| porphyry | Cu 0.3-1 %, Mo 0.01-0.05 % | huge low-grade bodies around intrusions | 0.3-1 % |
| lumen (alien) | lumen crystal 0.1-3 % | veins near hive nests and ruins | 0.1-3 % |
| placer | heavy minerals concentrated by water | river and cave beds | variable |

- Typical crustal abundances keep the trace numbers honest: Fe 5.6 %, Cu 60 ppm, Ti 0.57 %, S 0.04 %, before any process enriches them.
- **Everything is a source of everything.** Dirt, basalt, slag and spoil all carry iron, and the processing chain decides whether it is worth getting it out. Biomass and hive tissue carry trace metals and lots of C, N, P and S.

## R2. Realistic extraction numbers
Getting a kg of metal costs two separate things:
- **Handling the rock**: mining, hauling, crushing and grinding scale with the rock mass, which is 1 / grade per kg of metal.
- **Reducing the metal**: chemistry per kg of metal, roughly independent of grade.

| step | real figure |
|---|---|
| crush + grind | 10-30 kWh per tonne of rock |
| magnetic / density separation | 70-90 % recovery for magnetite; poor for fine hematite; near useless for Fe locked in basalt silicates |
| direct reduction + electric furnace (rich ore) | ~3-4 MWh per tonne of steel including hydrogen |
| molten-oxide electrolysis of any rock | ~3.5-4.5 kWh per kg Fe; gives **oxygen, silicon and aluminium alloys as co-products** |
| copper: flotation + smelt (sulfide) | 85-90 % recovery; smelting ~1-2 kWh/kg Cu, more as grade falls |

Worked example: 1 t of iron.
- **From 60 % hematite**: about 1.7 t of rock moved, ~3.5 MWh, little waste.
- **From 8 % basalt by electrolysis**: about 12.5 t of rock moved and ~4.5 MWh, plus about 4 t of oxygen and ~3 t of silicon alloy. It works anywhere, but the haulage and the spoil are 7 times larger.

So rich deposits are a logistics prize, not a hard gate. Early on you take iron from whatever you dig; later the AI finds grade and builds mines where it pays. The **cut-off grade** is computed live: the AI mines a block only if its metal pays for its handling and power at current demand. The probability map of section 2 is a map of **grade**, not of ore/no ore.

## R3. Supports: planned and placed automatically, collapse is lethal
- **Collapse can kill you or trap you** (Leif). Roof fragments are real bodies: a falling block kills by mass and speed, a buried player has limited oxygen, and robots or you dig them out.
- Every opening, whether dug by you, the AI or a blast, is checked continuously.
  - Span, depth (stress) and the joint field give a stability factor.
  - Openings below the safe factor get **support ghosts** automatically: bolts, mesh, sets or lining, chosen by span and rock.
- **Support ghosts jump the queue**: safety ahead of expansion, ahead of placement order. The logistics system routes bolts and steel to them, and robots install them.
- Dig by hand faster than support can follow and the HUD warns: "unsupported span 6.2 m, safe 4.0 m".
- Warning signs before failure: dust trickles, cracking sounds, small falls, then collapse. Time scales with how far over the limit the opening is.
- Supports are items like everything else, so the AI keeps stock targets for them.

## R4. Blueprints like Factorio: layouts you copy, paste and keep
- **Copy**: drag a box in blueprint mode (Tab) over anything working (machines, belts, supports, turrets, mining orders, power, network) and it becomes a blueprint item. Ctrl+C / Ctrl+V; Ctrl+X cuts (deconstructs and keeps the blueprint).
- **Paste**: the blueprint follows the cursor as a ghost.
  - Rotate with R and flip with F/G.
  - It follows the planet's curvature and the local terrain.
  - Red ghosts show what can't go there; the AI proposes foundations and cut-and-fill so it fits.
- **Library**: a blueprint library window (B) with named blueprints and **blueprint books**, i.e. "maps of layouts that work", e.g. "smelter line 2 t/h", "shaft head with turrets", "drone depot".
  - Saved with the game and exportable as a text string, so players can share layouts.
- **Planners**: the deconstruction planner (marks for removal; the AI hauls everything back to stock) and the upgrade planner (swap tier 1 parts for tier 2 across a region).
- **The AI builds blueprints like any placement**: ghosts enter the queue with the round 4 priority rules, missing items are produced, and robots build.
- **Do once, replicate**: the AI's "copy a working mine or factory" uses this same blueprint system, so what the AI replicates is a blueprint you can open, edit and reuse.
- Blueprints carry **intent, not only coordinates**: a mine blueprint re-anchors to the next ore body's grade map; a shaft-head blueprint re-anchors to the shaft.

# spacegame: gameplay design document

Author: Fable 5.2 (game designer lane), 2026-11-14. Status: DRAFT for Leif's review. Nothing in sections 4 to 8 is
built unless section 7.0 lists it as "start now".

Sources, in order of authority:
1. Leif's words: `repo:spacegame-notes/ROUND3.md` (17 messages and the 11 confirmed proposals), `repo:spacegame/PLAN.md`
   sections D and "Lore notes".
2. `repo:spacegame/PLAN.md` sections A and B (demo 1 and the ce-net architecture), `repo:spacegame/README.md` (what
   round 2 built).
3. `repo:spacegame-notes/THEMES-AI-GENERATED.md` (the metaphor; AI-generated, liked by Leif, to be deepened).

Leif's own past writing is not available now. Wherever it later differs from this document, his writing wins and this
document is edited to match.

How to read the tags:

| Tag | Meaning |
|---|---|
| `[L n]` | Leif's message n in ROUND3.md (his words, or scope taken directly from them) |
| `[P n]` | confirmed proposal n in ROUND3.md ("i like all of these ideas") |
| `[PLAN x]` | PLAN.md section x, including Leif's decisions in D |
| `[built]` | exists in the round 2 code, per README.md |
| `[proposal]` | my addition; not Leif's words; open to change |
| `[placeholder]` | story text or a name that waits for Leif's writing |

All numbers are starting values to tune from, not measurements.

---

## 1. Pillars and theme

### 1.1 One sentence

A prisoner sent to a neighbouring star system to do research for Earth [PLAN D] survives a crash with one arm that can
make anything slowly [L 1], builds a system that makes everything quickly [L 3], and over about 1000 in-game years
[L 14] grows until the hive, the older species and Earth all want them dead [L 13], and then chooses whether to save
Earth [L 15].

### 1.2 Pillars

Each pillar is a test. A feature that fails one of them is cut or changed.

| # | Pillar | Test | Source |
|---|---|---|---|
| 1 | Everything is a system | Every object has ports (power, data, material, heat) and state. Nothing works by exception. | [L 2] |
| 2 | Matter is physical | Every kilogram is somewhere on screen: in the ground, loose, carried, contained, in a machine or built in. No hidden inventory. | [L 4] |
| 3 | Do it once, then it is automated | Anything done once by hand can be repeated by the AI. The player never does the same job twice unless they want to. | [L 3] |
| 4 | Attention moves outward | Hands, then orchestration, then the frontier. The game always has a frontier that needs hands. | [L 3] |
| 5 | The world reacts in proportion | Noise, pollution and killing have costs that grow with scale. Silence is a real option. | [L 5][L 10] |
| 6 | The world runs without you | Hive, older species and Earth follow their own rules on one clock. Doing nothing has an outcome: Earth dies. | [L 15] |
| 7 | Dark, dense, alive | A frame reads as a film still: many layers, mass in every motion, light as the main colour. | [L 1][L 16][PLAN A.5] |
| 8 | Demand pulls, nothing is pushed | Production starts because something is below its target, never because the player clicked "make 50". | [L 6] |

### 1.3 The metaphor, system by system

The first two columns restate THEMES-AI-GENERATED.md. The third column is new and is all `[proposal]`: it says what
the player must feel in play for the metaphor to be carried by mechanics and not by text.

| Thing in the game | What it stands for | How the mechanic carries it [proposal] |
|---|---|---|
| The prisoner | The person society could not place, valued only for output | Earth's first messages are quotas with deadlines, never help. The quota is a real demand in the demand graph (4.8, 4.16), so the player serves it with the same tools as their own needs and can measure what it costs them. |
| The arm with the matter compiler | One mind with a general tool: can do anything, not at scale | The compiler is always available and always slow (8 times slower than a specialised machine [built]). It is never removed. Late in the game it is still how every new thing is made the first time. |
| Carrying the reactor | The weight of doing everything yourself | Load changes gait, speed, jump and jetpack (4.1). The first robot that carries for you is felt in the body, not read in a tooltip. |
| "Done once" becoming a template | Skill becoming infrastructure | A proven line collapses into one node (4.7). The screen gets simpler as the system gets bigger. |
| The network with an antenna in the blueprint | Designed intelligence: typed, owned, permissioned | Every device shows its owner, its controller and its link. An unlinked device keeps its last orders and nothing more (4.5). |
| The hive | Intelligence without understanding; society's immune response; unaligned AI | Awareness spreads through carriers the player can see and stop (4.14). It scales with violence, not with the player's intent. It never negotiates. |
| The hive's learning | A system optimising against you without a model of you | It adapts to the damage type that kills it most. The player reads what it learned by dissecting bodies [P 2]. |
| The older species | The establishment: real power, survival through quiet | Two values, hostility and fear, both rise as the player scales [L 11]. Their best trade terms come when they hate the player most. |
| Earth | The system that threw the outsider away and still wants results | Trade and kill-ships arrive in the same convoys [L 14]. Good conduct slows the kill-ships and does not stop them. |
| The relief fleet | Consequences that were already on the way before you understood anything | The distress signal left at year 0 [L 13]. The player learns of the clock from intercepts, later than it started. |
| The player at year 1000 | The superintelligence everyone fears | The same demand graph that kept 200 rounds of ammunition in stock now builds fleets. No new mechanic is added to make the player dangerous; scale alone does it. |
| Save Earth or not | Whether power is benevolent is a choice, made after reasons not to | The game records what Earth did to the player (kill-ships sent, quotas, survivors abandoned) and shows that record at the choice. It does not score the choice. |

### 1.4 Deepening the theme `[proposal]`

Six additions. Each is a mechanic first; the text for each is `[placeholder]`.

1. **Two kinds of scale.** The hive scales by adding bodies; the player scales by adding structure. The planet map
   shows both with the same visual language (flow lines and node sizes), so the player sees two distributed systems
   growing toward each other. The difference shown on screen: the player's nodes have owners and controllers, the
   hive's nodes have none.
2. **Legibility as the player's only real advantage.** The hive is stronger in mass. The older species is stronger in
   technology. Earth is stronger in numbers of people. The player wins because their system can be read, copied and
   redirected in minutes. Every UI layer (4.7) exists to keep that true as the part count passes one million.
3. **Silence has a cost and a time limit.** The older species survived by silence and stopped growing. A silent
   player survives the hive and loses to the clock (relief fleet, Earth's enforcers). The game never lets one stance
   win alone; the player chooses when to become loud.
4. **Other prisoners.** Survivors in lockdown facilities [P 7] are people in the same position who did not get a
   working arm. Rescuing them gives operators (4.9). Each rescued person carries a record of what Earth sent them for.
   In multiplayer [P 10] the other prisoners are other players on the same hive: one loud player endangers all.
5. **The ship AI is aligned because it is owned.** The ship AI does what the player's identity permits and nothing
   else, and says what it is doing in one line (the job list in 4.9). The game contains two other intelligences that
   are not owned: the hive, and Earth's sentinels (owned by someone far away with a 4.4-year delay). The contrast is
   shown, not explained.
6. **Ruins of your own making.** Lost bases persist with their logs [P 5]. Over 1000 years the player walks through
   layers of their own earlier work, as they walk through the older species' ruins. The save file is a history.

---

## 2. The world

### 2.1 The star system

Round 2 built a star, seven planets, the home moon around a ringed giant and a belt at 2.1 to 3.3 AU, at real scale
in double-precision metres [built]. Names are `[placeholder]` in `repo:spacegame/src/story.js`.

| Body | Role in play | Source |
|---|---|---|
| Star (1.0 solar mass) | light direction in space; solar power far weaker on the prison world's surface than in orbit | [built] |
| Ringed giant | parent of the prison world; ring material is the first off-world ore; fills a third of the sky on the near side | [built] |
| Prison world (the giant's moon) | Acts 1 to 4: surface, underground, hive, older species | [built][PLAN D] |
| Other moons of the giant | first off-world sites; one holds an older-species refuge (they "go up in orbit and to other planets") | [L 10], placement [proposal] |
| Belt, 2.1 to 3.3 AU | bulk metals and ice; mining platforms, depots, haulers | [built] |
| Inner and outer planets | later sites: heat and metals inside, volatiles outside; other prison research stations, most of them dark | [PLAN D], contents [proposal] |
| Sentinel shell | Earth's automated guards in orbit of the prison world and at the system's edge (4.17) | [L 15], placement [proposal] |
| Earth's system | 4.4 light years away `[proposal, placeholder]`; an interstellar-layer node, never walked on | [L 14] |
| The allies' system | where the distress signal went; source of the relief fleet | [L 13] |

### 2.2 The prison world

Facts already set: gravity 8.7 m/s2 [PLAN A.1]; a heavy atmosphere that floating species live in [L 7]; many species,
hives underground [PLAN lore]; human bases and facilities under lockdown [PLAN lore]; alien ruins [PLAN lore]; much
sulfur and organic material [L 6]; the hive's main base on the far side from the landing site [L 10].

Proposals:

- **Geometry.** The side view is a cut along one great circle that passes through the crash site and the hive's main
  base. The strip is generated on demand from (x, y, seed) as now [built], so its length costs nothing until visited.
  At real scale the far side is thousands of kilometres away; nobody walks there. That distance is the reason for
  the logistics tiers and for the three endings.
- **Sites off the strip.** Places not on the main cut (most hive outposts, older-species enclaves, other facilities)
  exist on the globe as nodes. A node the player visits gets its own local strip, generated from its globe position.
  Unvisited nodes run as rate models (4.7, "solved nodes").
- **Day.** 36 minutes of real time at 1x [PLAN A.1]. Night is the default start. The giant's reflected light gives
  a second, dimmer "giant-light" phase on the near side.
- **Atmosphere.** Surface density about 4 times Earth's `[proposal]`: slow falls for light things, strong lift for
  balloons, sound carries far (noise radii are large), solar power at the surface is weak, launches cost more.

### 2.3 Surface biomes

Round 2 has giant cap trees, lantern stalks, weeping vine trees, roots, shelves, fronds, grass, cave fungi, vines,
pods and spores by biome [built]. The table fixes seven biomes; the last four are `[proposal]`.

| Biome | Ground | Canopy and light | Resources | Fauna character | Hive presence |
|---|---|---|---|---|---|
| Cap forest (crash site) | spore-soil over basalt | giant cap trees, cyan fungi, light shafts between caps | iron (shallow), biomass, lumen | many small wary species, one mid predator | low; scouts only |
| Violet thicket | wet soil, root mats | weeping vine trees, violet pods, dense fog | organics, nitrates, resins | ambush predators; visibility 10 m | medium; pheromone trails cross it |
| Lantern fen | shallow water, peat | lantern stalks reflected in water, drifting motes | sulfur springs, peat fuel, water | grazers in herds, a large water predator | low |
| Sulfur flats `[proposal]` | yellow crust, vents | little growth; vent glow and steam columns | sulfur, heat, rare salts | few; armoured scavengers | none (hive avoids vents) |
| Bone-coral ridge `[proposal]` | exposed coral and obsidian | sparse; wind; long views of the giant | copper, titanium outcrops, ruin entrances | fliers, balloon species above | medium; hive mouths in the ridge faces |
| Balloon steppe `[proposal]` | open moss plain | no canopy; herds of floating balloon animals 50 to 400 m up | lift gas organs, open sky for balloon sites and launch pads | balloon herds, their aerial predator | low |
| Nest country `[proposal]` | resin-hardened ground, hive growth | dark; hive bioluminescence in acid green | the best biological material [L 7] | hive species only | high; a nest every few hundred metres |

### 2.4 The layered forest

The forest is a stack of depth layers, not one layer [L 1]. Section 6.1 gives the full stack with parallax factors.
In world terms there are four living storeys, each with its own species and its own use:

| Storey | Height above ground | What lives there | Use to the player |
|---|---|---|---|
| Floor | 0 to 3 m | fungi, grass, roots, small wary fauna, hive scouts | walking, digging, building; darkest |
| Understorey | 3 to 15 m | fronds, shelves, vines, pods; ambush predators | cover; shelves hold a person; vines burn |
| Canopy | 15 to 60 m | caps and crowns; fliers; most of the light | antenna line of sight starts here; platforms |
| Sky | 60 m and up | balloon species, spore clouds, weather | balloon logistics [L 7], weather balloons, radar relays |

### 2.5 Underground strata

Round 2 generates soil, basalt, ores by depth, caves, hives with chambers and a heart, and ruins [built]. Depths
below are `[proposal]`.

| Stratum | Depth | Material | Resources | Who is there | Heat |
|---|---|---|---|---|---|
| Root zone | 0 to 20 m | spore-soil, roots | biomass, iron nodules | burrowing natives | ambient |
| Glass-basalt | 20 to 150 m | hard basalt, gas pockets | iron, copper, lumen veins | hive tunnels, small nests | ambient |
| Bone-coral caverns | 150 to 600 m | open caverns, coral pillars, underground lakes | organics, nitrates, coral (structural) | large nests; the richest biology sits under them [L 7] | warm |
| Obsidian deep | 600 to 2,000 m | dense obsidian, faults | titanium, uranium | hive war-front against the older species | hot; machines need cooling |
| The quiet layer | 2,000 to 6,000 m | engineered rock, sealed galleries | older-species enclaves, warp and gravity technology [L 9] | the older species | controlled |
| Mantle edge | below 6,000 m | plastic rock | geothermal power (silent, large) | nothing | very hot |

The side view shows one stratum at a time at play scale. An elevator shaft (4.11) is the object that joins them; the
shaft view (zoomed out) shows all strata as a column with traffic.

### 2.6 The hive

- One hivemind, many species [PLAN lore]. Six combat species and two harmless natives exist [built].
- It is distributed and disorganised, does not understand the player, wants to learn [L 10].
- It has many outposts across the planet and a main base on the far side; billions of bodies [L 10].
- Nests sit on the best biological material; taking a nest stirs the hive [L 7].
- It has been at war with the older species underground for a very long time [L 9].
- It recently attacked the human facilities and is shutting them down one by one [PLAN lore][built: `hive.spread`].
- `[proposal]` It has no fast communication. Knowledge moves by carriers and pheromone trails [P 1]. This is the
  weakness the whole early game is built on. System: 4.14.

### 2.7 The older species

- Far more advanced than humans; hides underground; at war with the hive for a very long time [L 9].
- Has warp technology and gravity technology [L 9].
- Does not like the player; the relationship changes with what the player does [L 9][L 11].
- Survived by hiding and living in silence, or by leaving for orbit and other planets [L 10].
- Sent a distress signal to allies in another star system when humanity landed and the feedback loop began [L 13].
- `[proposal]` The ruins on the surface are theirs: places they gave up when the hive grew. The instant
  faster-than-light communication the player can repurpose [L 7] is theirs, found first in ruins. (Open question 1.)
- `[proposal]` They are few: tens of thousands on this world. Every one the player kills, or lets the hive kill by
  drawing it downward, is counted (4.15) and is read out when the relief fleet arrives.

### 2.8 Earth

- Sends prisoners to this system to do research on its planets; that is where it went wrong [PLAN D].
- Trade is slow and depends on conduct; with warp technology it becomes fast [L 14].
- It has much to deliver and will likely try to shut the player down [L 14].
- It sends sentinels and, now and then, ships to kill the player [L 15].
- Left alone, all of Earth is wiped out [L 15].
- `[proposal]` Why Earth dies without the player: the relief fleet destroys the hive, removes the humans on the prison
  world, then goes to the source. It reaches Earth near year 1000. Only a player strong enough to stop or turn that
  fleet changes the outcome. This makes "beat humanity to save humanity" literal: the strength needed to stop the
  fleet can only be built by first breaking Earth's control (sentinels, kill-ships, quotas).

### 2.9 One clock, 1000 years

A campaign is about 1000 in-game years, played over weeks of real time [L 14][L 15].

`[proposal]` There is one campaign clock. The player's view level sets how fast it runs:

| View | Rate | 1 real minute is | What is simulated in full | What runs as rates |
|---|---|---|---|---|
| Body | 1x | 1 minute | everything near the player | sites elsewhere |
| Site | up to 100x | 1.7 hours | the site's machines, robots, creatures | other sites |
| Planet map | up to 10,000x | 6.9 days | routes, hive graph, weather | inside every solved site |
| System map | up to 100,000x | 69 days | orbits, fleets, convoys | planets |
| Interstellar map | up to 1,000,000x | 1.9 years | Earth convoys, relief fleet, warp routes | systems |

Rules:
- The rate is capped by the lowest layer that is not solved (4.7). A site with an open alarm, an unserved demand or a
  fight caps the clock at 100x. This is the pressure to make things reliable: reliability buys time.
- Any event on the alarm list (attack, arrival, contact, stock-out of a critical item, death) drops the clock to 1x
  and moves the camera there, as time warp does now when an engine fires [built].
- Example budget for one campaign of 80 hours: 30 hours at body and site rates (under one in-game year in total),
  40 hours on the planet and system maps, 8 to 10 hours on the interstellar map. The last carries most of the
  1000 years; 1000 years at the top rate is 8.8 hours.
- Single player: the clock runs only while the game runs. With ce-net cells (section 8) the world cells keep running
  at a set rate while the player is away; that rate is open question 3.

### 2.10 Campaign timeline

Years are `[proposal]`; the order of events is Leif's.

| Year | Event | Source |
|---|---|---|
| before 0 | Earth builds the prison research colony; facilities across the system | [PLAN D] |
| about -1 | the hive attacks; facilities go into lockdown | [PLAN lore] |
| 0 | the feedback loop passes a threshold; the older species sends the distress signal; the player crashes | [L 13] |
| 0 to 1 | Act 1: hands. Crash site, first machine, first robot | section 5 |
| 1 to 30 | Act 2: the line, the site, the first nest, the first lost base | |
| 4.4 | Earth receives the sentinels' report of the escape (light delay) | [proposal] |
| about 22 | first scheduled convoy from Earth arrives (sent before the crash): cargo, a quota, and guards | [L 14] |
| 30 to 150 | Act 3: underground, the older species, balloons and belts, planet-scale logistics | |
| about 50 | first kill-ship aimed at the player arrives (4.4 years of signal + 44 years of flight) | [L 15] |
| 150 to 400 | Act 4: space, the sentinel shell broken, the hive at planetary scale, one of three endings for the hive | [L 10] |
| H + 10, at the latest 400 | the relief fleet arrives (H = the year the hive's main base falls) | [L 13] |
| 400 to 900 | Act 5: answer the fleet with trade or war; Earth turns on the player fully | [L 13] |
| 900 to 1000 | Act 6: the fleet (or what is left of it, or the player) reaches Earth; the choice | [L 15] |
| 1000 | if nothing stopped it: Earth is wiped out. The simulation ends here with or without the player | [L 15] |

---

## 3. Core loops

### 3.1 Second to second: the body

| Verb | What happens | Why it feels right |
|---|---|---|
| Move | A loaded body with momentum: the reactor on the back shortens the stride, widens the stance, lengthens braking (4.1) | weight is seen in the gait before it is read in a number |
| Aim | The two-handed ship laser swings with inertia; the headlamp follows the aim [built] | a 38 kg tool does not snap to the cursor |
| Fire or cut | A beam that heats what it touches; the cut edge glows, drips, smokes and leaves physical debris | heat is the feedback: colour says how close to melting |
| Carry | Pick up a chunk, a container or a device; it occupies a body slot and adds its mass | no item disappears into a bag |
| Set down | A carried device becomes a placed device with ports; the reactor trails a cable | "dropped" is a state change you watch [L 4] |
| Listen and look | Fog of war in the dark; sound tells direction before sight does (4.19) | the forest is information, not decoration |

The second-to-second loop is complete in round 3 and never removed. At year 900 the player can still walk out with the
laser.

### 3.2 Minute to minute: the place

1. **Dig.** Carve a cut; spoil piles up where it falls; ore breaks into chunks. The cut fills with its own debris
   unless it is carried away.
2. **Haul.** By hand at first: a sack, then a sled. Every trip is noise and time.
3. **Print.** The arm prints a machine part by part, slowly, drawing power from the reactor.
4. **Place and connect.** Machine down, cable to the reactor, antenna in range, the ship computer takes control.
5. **Fight or avoid.** A wary animal watches from the edge of the lamp. A predator bigger than you decides you are
   food. The hive's scout hears the laser and leaves; if it gets home, more come (4.14).
6. **Repair and adapt.** Something breaks or runs short; the stock target shows red; the player fixes the cause once.

The minute loop ends, for each task, the first time a robot does it. The loop then moves to a new task.

### 3.3 Hour to hour: the system

1. **A demand appears** (ammunition below target, a machine part missing, an Earth quota).
2. **The AI plans**: picks a producer, queues jobs, dispatches robots (4.8).
3. **Something is missing**: a part with no producer, a material with no source, a route with no capacity. This is
   the frontier marker. The player goes there with hands.
4. **The player solves it once**: finds the ore, designs the part, builds the first line.
5. **It is proven**: the line holds its rate; it collapses to one node; the AI may copy it (4.9).
6. **The world answers**: more machines means more noise and pollution; the forest thins near the factory [P 4]; the
   hive's awareness rises; the older species' hostility and fear rise.
7. **The player sets policy**: noise budget, where the AI may build, what to keep in stock, what to defend.

### 3.4 Campaign: the frontier

| Stage | Years | Logistics tier | Frontier (needs hands) | Main threat | Main screen |
|---|---|---|---|---|---|
| Hands | 0 to 1 | hand | everything | predators, power | body view |
| Line | 1 to 10 | robots | each new machine | hive scouts and first waves | site view |
| Site | 10 to 30 | robots, crawlers | first nest, first mine shaft | local hive mobilisation | site view |
| Region | 30 to 150 | balloons, belts | underground, first contact, alien technology | regional hive, the older species, first convoy | planet flow map |
| Planet | 150 to 300 | shuttles, railguns, pods | orbit, the sentinel shell | planetary hive, kill-ships | planet and system maps |
| System | 300 to 600 | ships, depots | the hive ending, the relief fleet | the fleet, Earth | system map |
| Interstellar | 600 to 1000 | warp routes | Earth, the allies' system | everyone | interstellar map |

### 3.5 How attention moves

- **Hands (body view).** The player does the thing. Controls are WASD, mouse, E.
- **Orchestration (site and planet views).** The player sets targets, budgets and permissions; the AI does the
  thing. Controls are selecting nodes and editing three kinds of value: a stock target, a budget, a permission.
- **Frontier (back to body view, somewhere new).** The AI cannot do what has never been done. The player goes.

One key (`M`, as now [built]) steps the view outward; clicking a node steps inward, down to the body. The body is
always somewhere real: stepping in on a distant site means travelling there, or taking control of a robot or mech
there over the network (4.5), with real signal delay off-world.

The rule that keeps the three in balance `[proposal]`: **at every stage, at least one demand in the graph has no
producer the AI can use.** The planet-scale design (resources placed far apart, technology behind the older species,
biology under nests) is arranged so that this is always true until the last act.

---
## 4. Systems

Each system is given as: **State** (what is stored), **In / out**, **Rules**, **Start numbers**, **On screen**.
The device model in 4.4 is the base; every later system is built from devices, items and designs.

### 4.1 Physical materials and carrying [L 4]

**State.** Every piece of matter is in exactly one of seven states:

| State | Stored as | Example |
|---|---|---|
| In ground | density field sample (density, material) [built] | basalt wall |
| Loose | density field sample with a `loose` flag; settles to an angle of repose | spoil pile under a cut |
| Chunk | rigid body with mass, shape, material, temperature | 12 kg ore chunk, a cut limb, a log |
| Contained | amount inside a container object (the container is a rigid body or a device) | 80 L sack, crate, tank, hopper |
| Carried | chunk, container or device attached to a body slot of a person, robot or vehicle | reactor on the back |
| In process | amount inside a machine's buffer | ore in the furnace |
| Built in | part of a structure or machine, by design | a frame's iron |

**In / out.** Transitions are the only way matter changes state: dig (in ground -> loose and chunks), settle, scoop
(loose -> contained), pick up (chunk -> carried), set down, load, unload, process, build, break (built in -> chunks
and loose). Each transition is an event with kilograms per material; the sum over a transition is zero.

**Rules.**
- Digging removes field mass and spawns the same mass as loose material and chunks at the cut. Round 2 already
  reports kilograms per brush [built]; round 4 spawns them.
- Loose material is the density field itself with a flag: it flows downhill until its slope is at or below the angle
  of repose, in a cheap cellular pass limited to dirty chunks. No particle per grain.
- Chunks are rigid bodies in the physics engine (4.18). A chunk at rest for 10 s sleeps; far chunks are stored as
  records.
- A body has slots. The person: two hands, back, chest, two hips, the arm (the compiler, fixed) [L 1]. A two-handed
  object uses both hands. The back holds one large thing: the reactor, a sack, a pack frame.
- Carried mass changes movement (numbers below), balance (the centre of mass shifts toward the load; the body leans
  to compensate) and noise (heavier steps are louder).
- Robots carry by the same rule with their own slots and limits (4.10). The ship's robots automate hauling [L 4].

**Start numbers.** Person 80 kg, suit 45 kg. Round 2's flat 600 kg suit limit [built] is replaced by:

| Carried load | Run speed | Jump speed | Jetpack net lift (thrust 2,400 N, g 8.7) | Gait |
|---|---|---|---|---|
| 0 kg | 6.5 m/s | 4.6 m/s | +10.5 m/s2 | upright, long stride |
| 60 kg (suit frame carries this free) | 6.5 | 4.2 | +4.3 | slight lean |
| 124 kg (reactor 86 + laser 38) | 4.2 | 3.3 | +0.9 (hover, slow climb) | bent, short stride, slow turn |
| 180 kg | 2.9 | 2.4 | none | stagger; stumbles on slopes over 20 degrees |
| 220 kg | limit | 0 | none | cannot lift more |

Speed factor above 60 kg: `1 / (1 + (load - 60) / 120)`. Angle of repose: soil 35 degrees, rubble 40, wet soil 25.
Chunk size from the laser: 5 to 40 kg. Sack 80 L. Sled 300 kg, pulled at half speed, leaves a track.

**On screen.** The gait itself. A load readout by the body in the loadout view (kg, centre-of-mass marker). Piles and
chunks lit by the same light map as terrain. Every carried object is drawn on the body where it is slotted.

### 4.2 The float item model [PLAN lore][built]

**State.** A stack is `{ design, amount, unit, temp_K, grade }`. Units: kg (bulk), L (fluids and gases at a stated
pressure), each (discrete things, each with a mass from its design), rounds (ammunition, counted exactly) [built].
`grade` is 0 to 1 (ore richness, part tolerance, tissue freshness).

**In / out.** Recipes consume and produce amounts per second, not batches, except assembly of discrete things.

**Rules.**
- Mass is conserved in every recipe: inputs = outputs + named waste (slag, gas, heat). A `?test=1` property checks
  every recipe.
- Amounts are never rounded for display in a way that hides a shortage: 0.4 of a part is shown as 0.4.
- Temperature rides with the stack: hot ingots are hot chunks; they light the scene and burn what they touch.
- Grade multiplies yield or failure rate downstream. Biological material loses grade with time unless cooled; this
  is why nest material needs fast logistics [L 7].
- Consumables are counted to the unit: every round fired, every watt-hour, every gram of propellant [PLAN lore].

**Start numbers.** As built: slot limits by mass or volume; suit battery in Wh, oxygen in kg, jet propellant in kg.
New: tissue grade half-life 2 hours at ambient, 10 days chilled.

**On screen.** Icons with the amount and unit beneath; a thin bar for grade; a colour ramp for temperature.

### 4.3 Power and the carried reactor [L 2]

**State.** A power network is a graph of devices joined by cables. Each device has a draw or a supply in watts and
may have storage in Wh. The reactor: output, capacitor charge, core temperature, fuel fraction.

**In / out.** Reactor: fuel in (lasts decades), electricity and waste heat out. Consumers: watts in, work and heat out.

**Rules.**
- Power is solved per network every tick: supply is shared in priority order (life support, control, defence,
  production, charging). A device short of power slows in proportion; it does not switch off unless below 20 %.
- The ship's reactor can be pulled from its bay and carried on the back. With the reactor gone the ship runs on its
  battery: the ship computer stays up, the ship's weapons and robots' chargers do not [L 2].
- The suit battery cannot drive the laser: its discharge limit is below the laser's draw. Without the reactor the
  player has "not enough power" [L 2] and is close to unarmed.
- The reactor can be worn (cable to the suit) or set down (cable trails up to 25 m; the cable is a physical rope that
  snags and can be cut). Set down, it is a power source for anything cabled to it.
- Waste heat goes to the heat field (4.18). A reactor in a closed cave warms the cave; hot air and the hum are
  signals (4.13).

**Start numbers.**

| Thing | Mass | Power | Notes |
|---|---|---|---|
| Ship reactor (core) | 86 kg | 15 kW continuous, 60 kW for 4 s from its capacitor (recharge 20 s) | 30 kW waste heat at full output; hum heard to 35 m |
| Suit battery | in suit | 2 kWh, 1.5 kW max discharge | lamp 15 W, compiler 180 W [built] |
| Ship laser, cut mode | 38 kg | 4.5 kW [built] | carves 3.4 m/s in soft ground [built] |
| Ship laser, lance mode | | 12 kW | 60 m reach |
| Ship laser, pulse | | one capacitor dump, 60 kW for 0.2 s | cuts a mid predator in two |
| Compiler on reactor power | | up to 2 kW | prints 4 times faster than on the suit battery `[proposal]` |
| Cable | 0.3 kg/m | 20 kW per strand | 25 m reel on the reactor |

Later sources, in the order the player meets them `[proposal]`: biomass burner (cheap, loud, dirty), lumen reactor
[built], sulfur-vent turbine, geothermal tap in the obsidian deep (silent, large), fission from deep uranium, fusion,
gravity-gradient tap (older-species technology).

**On screen.** Cables as lit lines that brighten with load. A watt figure on any selected device. The reactor's fins
glow with core temperature. In the site view, the power graph is one overlay (`P`).

### 4.4 The device model: ports, placement, controllers [L 2]

**State.** A device is `{ design, owner, state: carried | placed | installed, pose, ports[], controller, orders,
health, temp_K }`. Ports are typed: power, data, material (solid, fluid, gas), heat.

**Rules.**
- Any device can be carried (if light enough), set down, and picked up again. Set down, its ports become live.
- Place and assign: a placed device needs a controller. The ship computer is assigned by default and automatically
  [L 2]. Other controllers: a local control box, a robot's own computer, an operator (a rescued survivor [P 7]), the
  player directly.
- A controller needs a data path to the device (4.5). If the path is lost the device keeps its last orders (hold
  fire arcs, keep the current recipe) and reports nothing.
- The laser set down on its bipod with a controller is a turret or a fixed drill. Picked up, it is the handheld tool.
  One object, two uses, no conversion step [L 2].
- Every device has a heat port: it makes waste heat and fails above its limit.

**Start numbers.** Ship computer: 8 control channels `[proposal]`; one channel per actively controlled device (a
turret tracking, a robot path-planning), none for a device on standing orders. A control box adds 4 channels.

**On screen.** Selecting a device shows four port rows (power, data, material, heat) with what is connected and the
live flow on each, plus owner and controller. This panel is the same for a lamp and for a shipyard.

### 4.5 The network and the antenna [L 2][L 7]

**State.** Nodes (anything with a radio or a cable), links (cable, radio with range and line of sight, relay,
faster-than-light pair), per-link delay. Each controller's channel use.

**Rules.**
- Radio needs line of sight through air; rock and dense canopy attenuate it. The antenna is already part of the
  starting blueprint [L 2]; the ship raises its mast when the blueprint is placed.
- Coverage is what limits where automation works. Robots outside coverage finish their current job and return.
- Off-world, links have light delay. Orders arrive late; devices need local controllers to act in time.
- The older species' faster-than-light communicator [L 7], once repurposed, is a link with zero delay and no range
  limit between paired nodes. It becomes the backbone between sites, then planets, then stars.
- Fleet control: any ship of the player's on the network exposes its weapons and systems as devices [L 2].
- Radio is not heard by the hive. It is detected by the older species (adds to hostility near their enclaves) and
  by Earth's sentinels (4.17). `[proposal]`

**Start numbers.** Suit radio 150 m. Ship mast (12 m) 400 m at ground level, 2 km to a node above the canopy. Relay
pole 1.5 km. Balloon relay at 300 m altitude: 40 km. Rock: 3 m of basalt blocks a link; use cable in shafts.

**On screen.** Coverage is the bright part of the fog-of-war map (4.19). Links are thin lines in the network overlay
(`N`). A device without a controller path shows a broken-link glyph in amber.

### 4.6 Designs as parametric items [L 2][L 3]

**State.** A design is `{ id, kind, version, author, params{}, ports[], bill[], process, tier, proven }`. `bill` lists
child designs with amounts; `process` says which kind of machine can make it and at what rate; `proven` is set by 4.7.
A design is data. An item in the world points to its design.

**In / out.** Requirements in, a design out. Example: "adapter: laser mount pattern A to mech hardpoint M2, load
400 N recoil, pass 12 kW" -> the ship AI returns geometry, mass, bill and print time [L 2].

**Rules.**
- Everything is designable and every design does something [L 3]. There are no decorative items.
- The player states requirements with a few parameters (size, power, rate, range, mass limit). The ship AI solves the
  rest and shows what it traded away. Designing costs compute time on a controller.
- Geometry, animation and sound are generated from the parameters (4.18), so a new design needs no art.
- A design belongs to its author's identity and can be shared or licensed [P 9] (section 8).
- Tiers gate parameters, not items: tier 2 allows tolerances and temperatures tier 1 does not.

**Start numbers.** Design time on the ship computer: 20 s for a part, 5 min for a machine, hours for a ship
`[proposal]`. Technology tiers:

| Tier | Unlocked by | Allows |
|---|---|---|
| 0 | the arm | printed parts, iron, soil glass |
| 1 | furnace and assembler | alloys, motors, simple robots |
| 2 | chemistry (sulfur, nitrates, organics) [L 6] | explosives, propellants, polymers, batteries |
| 3 | deep ores, cooling | precision parts, heavy machinery, railguns |
| 4 | nest biology [L 7] | grown materials, bio-printer organs, balloon husbandry, the bio-weapon path |
| 5 | repurposed alien technology | faster-than-light links, dampening, lift |
| 6 | gravity technology [L 9] | gravity plating, mass drivers without recoil, the black-hole path |
| 7 | warp technology [L 9] | interstellar ships |

**On screen.** The design sheet: a generated drawing of the object, its ports, its bill as a short list of child
nodes (not a wall of parts), and the three numbers that matter for its kind.

### 4.7 Abstraction layers and solved nodes [L 3]

**State.** A tree of nodes. Each node has a layer, children, measured rates (in, out, power, noise, pollution),
health, and `solved: bool`.

| Layer | Made of | Typical count in the layer above | What the player edits here |
|---|---|---|---|
| Part | material + process | 10 to 100 per component | parameters |
| Component | parts | 10 to 100 per machine | ports, parameters |
| Machine | components | 3 to 30 per line | recipe family, placement |
| Line | machines + belts or robots | 3 to 20 per factory | target rate |
| Factory | lines + stores + power | 1 to 10 per site | stock targets, budgets |
| Site | factories + defence + links | 10 to 1,000 per planet | purpose, permissions |
| Planet | sites + routes | 1 to 10 per system | flows, policy |
| System | planets, belts, depots, fleets | several | routes, fleets |
| Interstellar | systems + warp or sublight routes | | trade, war |

**Rules.**
- The player works one layer at a time. The view shows the current node's children as boxes with rates and nothing
  below them.
- **Solved.** A node is solved when it has met at least 95 % of its demanded output for 3 full cycles of its slowest
  input and at least 20 minutes of its own running time, with no open alarm. A solved node draws as one box. "Once my
  system starts producing one part which I need I don't want to worry about it" [L 3].
- A solved node that falls below 80 % for 5 minutes becomes unsolved, raises an alarm and caps the clock (2.9).
- A solved node away from the player is simulated as rates, not item by item. Entering it restores item-level
  state from its rates and stocks (deterministically, from the seed and the tick).
- **A million unique parts.** A rocket's bill is a tree, about 40 sections x 250 assemblies x 100 parts [L 3]. Child
  designs are generated on demand from the parent's parameters and a hash, the same way terrain chunks and belt
  sectors are [built]. They are real designs with real bills and need real producers; they are stored only when
  touched or changed. The player sees one number: how many of the node's parts have a producer.
- Blueprints scale by layer, not by part count: placing a factory blueprint places lines, not 40,000 parts.

**Start numbers.** As in the rules. Rate model time step for solved nodes: 10 s at the planet map, 1 hour at the
interstellar map.

**On screen.** A breadcrumb (`system > planet > site > factory > line`). Boxes: green edge solved, amber unsolved,
red alarm. Each box: name, out rate against demand, and a "coverage" figure (parts with a producer / parts needed).

### 4.8 Demand and supply [L 6]

**State.** Per store and item: `{ min, target, max, stock, inbound, reserved }`. Per producer: recipes it can run,
rate, queue, inputs on hand, location. A job is `{ item, amount, producer, inputs[], haul tasks[], due }`.

**In / out.** Consumption and targets in; jobs and haul tasks out.

**Rules.**
- `demand = target - (stock + inbound - reserved)`. Demand above zero creates a job. Firing a weapon lowers stock,
  which creates demand, which queues production: nobody presses "craft" [L 6].
- The AI sets default targets from use: target = 30 minutes of the recent peak use rate, min = 5 minutes. The player
  can pin any target.
- Demand propagates down the bill: a job reserves its inputs; missing inputs become demands on their stores.
- **Producer selection.** For each job the AI scores every producer able to make the item:
  `score = time_to_deliver + w_energy x energy + w_noise x noise_added + w_risk x route_risk`, where
  `time_to_deliver = queue_time + amount / rate + haul_time`. Lowest score wins. The suit compiler is always a
  candidate and is always slow; a special ammunition line wins as soon as it exists [L 6].
- Machines are general within their design and tier and retool to what is demanded [L 3]. Retooling costs time
  (start: 30 s) so the AI batches.
- Robots are dispatched to carry inputs to the producer and outputs to the store [L 6]. Haul tasks are jobs too.
- A demand with no possible producer, or no source for a raw material, is flagged **frontier**. The frontier list is
  the player's task list.
- External demand uses the same graph: Earth quotas [P 6], trade contracts with the older species, a fleet order.
- Priority classes when capacity is short: survival, defence, repair, contracts with deadlines, growth, stock-up.

**Start numbers.** Weights: `w_energy` 0, `w_noise` 60 s per metre of added noise radius while over budget (4.13),
`w_risk` 120 s per expected loss. Re-plan every 2 s per site.

**On screen.** The stock panel: one row per item with stock, target and a bar; red below min. The job list: each
line reads as a sentence, for example "iron plate 40 kg: furnace 2, 3 min; hauler R4 bringing ore". The frontier
list at the top.

### 4.9 AI replication [L 3][L 8]

**State.** Templates: a proven node (line, factory, route, turret group, shaft) saved with its bill, footprint,
needs (power, ore grade, coverage, clearance) and measured rates. Deploy orders. Policies per site.

**Rules.**
- A node becomes a template when it is solved (4.7). "Once something is done once the AI can replicate it" [L 3].
- The AI deploys a copy when demand needs it and policy allows: it surveys a location, clears it, orders the parts
  through the demand graph, sends builders, connects ports, and proves the copy.
- The AI scales a design, it does not only copy it: more shafts, more turrets, a longer line, adapted to the ground
  that is actually there [L 8]. A scaled copy is unsolved until it proves itself.
- The AI places sites where logistics need them: depots, relays, balloon stations [L 7].
- The AI helps place turrets: given a perimeter and a threat direction it proposes positions and arcs; the player
  accepts, edits or lets policy accept [L 8].
- The player controls replication through policy, not placement: where it may build (painted areas), budgets (noise,
  pollution, material, power), what must never be touched, how much risk is allowed.
- The AI never does a thing that has never been done. A first-of-kind is always the player's.
- Operators: rescued survivors [P 7] hold a site's control locally. A site with an operator keeps running policies
  and replication when its link to the ship is lost.

**Start numbers.** Survey 60 s per site; build speed from builders available; one deploy per controller channel.

**On screen.** Ghosts in the AI's colour (dim cyan) where it intends to build, with the reason in one line. The
player's own ghosts are amber. A policy panel per site with five sliders and a painted map.

### 4.10 Robots and logistics tiers [L 4][L 7]

**State.** Carriers `{ design, payload, pose, energy, task, controller }`; routes `{ from, to, tier, capacity,
measured flow, risk }`; stations.

| Tier | Carrier | Payload | Speed | Range | Needs | Noise | Opens |
|---|---|---|---|---|---|---|---|
| 0 | the player | 60 to 220 kg | 3 to 6.5 m/s | where you walk | nothing | steps | year 0 |
| 1 | ship robots: hauler, builder drone [built], digger | 120 kg | 3 m/s | coverage (4.5) | hub, charge | low | first robot |
| 2 | crawlers and long-range walkers | 2 t | 6 m/s | 50 km | cleared track | medium | tier 1 tech |
| 2 | balloons (repurposed balloon species) [L 7] | 500 kg | 8 m/s with wind | 500 km | cleared site, mooring mast, an AI unit | near silent | tier 4 biology |
| 3 | conveyor belts, pipes | 10 kg/s | 1.5 m/s [built] | fixed line | built along the whole route | steady hum | tier 1 |
| 3 | elevators (4.11) | 5 t per car | 10 m/s | one shaft | shaft | medium | tier 3 |
| 4 | shuttles | 20 t to orbit | | surface to orbit | pad, propellant | very loud | tier 2 chemistry |
| 4 | railguns and pods | 200 kg per shot, 1 shot / 10 s | orbital speed | surface to orbit, moon to moon | large power, vacuum barrel or high site | loud, seismic | tier 3 |
| 5 | ships: haulers, tankers, depots [built in part] | 100 to 100,000 t | Hohmann transfers [built] | in system | depots | none on the ground | orbit |
| 6 | warp freighters | large | 4.4 light years in 6 months | interstellar | warp technology | n/a | tier 7 |

**Rules.**
- Each tier is semi-automatic: the player builds the first route of a tier by hand; the AI then plans routes of that
  tier [L 7].
- The AI picks the tier per flow by cost: belts for steady high flow over short distances, balloons for light,
  spread-out flows over forest, railguns for bulk to orbit.
- Balloons: clear an area and set up a station; fit a balloon with an AI unit; it goes where it is needed [L 7].
  They float above the vegetation, so they need no track and make almost no noise. They are slow, depend on wind and
  are prey for the aerial predator of the balloon steppe.
- Every carrier is a physical object that can be seen, followed, attacked and lost. Lost cargo lies where it fell.

**On screen.** At body scale, the carriers themselves. At the planet map, routes as lines whose width is flow and
whose colour is the tier; moving dots at true positions [P 11].

### 4.11 Underground operations [L 8]

**State.** Shafts `{ top, depth, cars, power }`; workings (galleries); heavy machines `{ borer, digger, hauler,
crusher }`; secured zones with turrets; the strata of 2.5.

**Rules.**
- Automated mining and excavation need heavy machinery; the ship gives a first set in part: one borer head, one
  hauler frame and the designs for the rest [L 8].
- A borer cuts a gallery and produces spoil at its cut rate; haulers must carry it to a shaft or the borer stops.
  Spoil is physical (4.1): a mine needs a spoil route and a dump.
- An elevator shaft joins the surface to the workings and carries material, robots and people [L 8]. Cable carries
  power and data down; radio does not pass the rock (4.5).
- Digging disturbs what lives there: vibration is a signal that travels through rock (4.13). Hive tunnels opened by
  a borer are entry points until sealed or guarded.
- Securing a working: clear it, place turrets at the openings, let the AI extend the pattern as the working grows
  [L 8].
- Heat rises with depth; machines below 600 m need cooling loops (a heat port joined to a radiator on the surface or
  to an underground lake).
- Below 2,000 m the player is in the older species' ground. Vibration there raises hostility directly (4.15).

**Start numbers.** Borer: 3 m diameter, 0.5 m/min in basalt, 250 kW, vibration felt to 400 m through rock. Shaft
sinking: 2 m/min in soil, 0.3 in basalt. Elevator car 5 t at 10 m/s. Turret (a second ship-type laser on a mount):
12 kW, 60 m, one control channel while tracking.

**On screen.** Side view per stratum; the shaft view as a vertical column with cars moving and each stratum as a
band with its alarms. Underground light comes only from what the player brings and what glows there.

### 4.12 Ecology and creature behaviour [L 5][P 4]

**State.** Per species: mass, diet (plant, small prey, large prey, carrion, filter), temperament (wary, bold,
territorial), senses (sight range by light, hearing, smell, vibration), herd size, young. Per individual: hunger,
fear, health, state. Per region: population per species, plant biomass.

**Rules.**
- Nothing is hostile by default. Nothing is kind either [L 5].
- **Hunt rule.** A creature hunts the player only if it is larger than the player and eats prey of the player's size
  [L 5]. In the mech the player is larger; fewer things qualify.
- **Fear rule.** Everything else is afraid: of the player, of noise, light and machines. It keeps a flight distance,
  flees when that is crossed, and fights only in self-defence: cornered, struck, guarding young or a nest [L 5].
- State machine: graze or roam -> notice -> watch (keeps distance, eyes catch the lamp) -> flee, or if cornered ->
  threat display -> defend. Predators: roam -> stalk (approach while unseen) -> charge -> feed, or -> break off when
  hurt beyond 30 %.
- Fear is per individual and learned: a species hunted by the player keeps a larger distance over generations; one
  left alone habituates and walks through the base.
- Populations are simulated per region as numbers and drawn as individuals near the player. Removing predators makes
  grazers boom and strips plants; pollution kills forest near factories [P 4]. Dead forest loses its layers on screen.
- Hive species are a separate case: they act for the hive (4.14). A lone scout still behaves as wary.
- Balloon species are herd filter-feeders; they can be kept and bred once tier 4 biology exists [L 7].

**Start numbers.** Flight distance = 6 m x (player noise radius / 10 m), clamped 4 to 60 m, x1.5 under the lamp.
Corner test: no escape path within 8 m. Region size 1 km. Grazer doubling time without predators: 2 in-game years.

**On screen.** Eyes at the edge of the light. Posture reads state: ears and stalks up (watch), low and still (stalk),
broadside with colours flaring (threat). No health bars on animals.

### 4.13 Noise and pollution [built][P 3][P 4]

**State.** Noise: events with a radius in metres that fade in seconds [built]; a standing acoustic signature per
running machine [P 3]; vibration events through rock. Pollution: amount per 8 m cell, spreading and decaying [built].
Per site: a noise budget and the current total.

**Rules.**
- A site's signature is the largest radius at which any listener would hear it: sources add as areas, not radii.
- Mufflers, burying a machine (each metre of soil over it cuts its radius), running at night-quiet rates, and
  dampening technology traded from the older species reduce signatures [P 3]. Noise is a budget the AI plans
  against (4.8, `w_noise`).
- Hive creatures go to the loudest thing they hear and wreck loud machines [built]. What they hear also feeds
  awareness (4.14).
- Wary animals leave noisy ground; predators learn that noise means wounded things and come to gunfire. `[proposal]`
- Pollution lowers plant biomass, then kills trees, then poisons water; it raises hive alert [built] and older-
  species hostility when it reaches groundwater. Dead ground stays dead for years.
- Silence is a valid way to play [L 10]: a buried, muffled, low-rate base can stay under the hive's threshold for
  decades. It grows slowly.

**Start numbers.** Radii: footstep 6 m (loaded 10 m), laser cut 60 m, lance 90 m, pulse 150 m, reactor 35 m,
furnace 40 m, borer 120 m in air and 400 m as vibration, shuttle launch 30 km. One metre of soil cover: radius x 0.6.

**On screen.** A sound overlay (`H`): rings around every source, the site's total ring, and the nearest known
listener. In normal view, loudness is felt in the audio mix and in animals leaving.

### 4.14 Hive awareness [L 10][P 1][P 2]

**State.**
- Hive graph: nodes (nest, outpost, main base) with `force` (bodies), `K` (knowledge of the player, 0 to 1), `alert`
  (0 to 100, as built), `profile` (resistance per damage type), `stock` (biomass). Edges are trails with a length.
- Carriers: individuals or pheromone trails in transit, each with a payload `{ dK, profile sample, location }`.
- Violence field `V`: per region, kilograms of hive biomass killed, decaying.
- Planet awareness `A = sum(force x K) / sum(force)`.

**Rules.**
- **Ambient start.** `K = 0` everywhere. Hive creatures near the player are ordinary wary animals with a nest.
- **Detection.** A hive creature that senses the player, a machine or a kill becomes a carrier and heads home.
  Payload grows with what it witnessed: presence a little, noise more, deaths most ("as soon as it detects it scales
  up" [L 10]).
- **Carriers can be stopped** [P 1]: killed (quietly, or the kill is itself witnessed), jammed (trail scrubbers,
  dampening), or decoyed (a false trail sends the response to an empty place).
- **Spread.** A node whose `K` rose sends carriers along its trails. The receiving node moves toward the sender's
  `K` in proportion to the payload. Knowledge crosses the planet at carrier speed, node by node.
- **Forgetting.** `K` decays where no carrier arrives. A quiet player is forgotten in years.
- **Violence routes force.** Each node sends reinforcements toward regions in proportion to their share of `V`: it
  "sends troops to where the most killing happens" [L 10]. A kill zone pulls the hive in. That can be used (a decoy
  battlefield far from the base) and it always raises `K`.
- **Concentration and chaos.** As force gathers, local waves come faster and bigger but coordination between
  species drops: friendly trampling, feeding on the dead, uneven arrival [L 10].
- **Learning** [P 2]. Each brood cycle a node shifts `profile` toward the damage types that killed its bodies.
  Dissecting a body shows the profile of the node that bred it.
- **Arming up.** With `K` a node shifts its brood from scouts to combat castes, then to castes not seen before
  (siege burrowers, armoured fliers, spore artillery) `[proposal]`.
- **Bands of `A`:**

| A | Hive state | What the player meets |
|---|---|---|
| under 0.05 | ambient | scouts, small waves at loud sites (as built) |
| 0.05 to 0.2 | local mobilisation | combat castes from nearby nests, tunnels dug toward the base |
| 0.2 to 0.5 | regional | sieges, adapted broods, attacks on routes and balloons, facilities fall faster |
| 0.5 and above | the majority knows | force arriving grows without limit; no surface position holds [L 10] |

- Above 0.5 the surface is lost in time. The answers are to have ended the hive before then, or to be off the
  surface: orbit, another moon, deep allied ground. The three endings (5.3) act on the main base's share of `force`.
- Nests hold the best biological material. Killing a nest's heart [built] gives it and sets `V` and outgoing
  payloads very high for that region [L 7].
- The hive keeps attacking human facilities on its own clock [built: `hive.spread`], whatever the player does.

**Start numbers.** Payload `dK`: sighting 0.002, sustained noise 0.01, witnessed deaths 0.02 per 100 kg killed, a
nest heart killed 0.3. Transfer per carrier: `K_to += payload x (1 - K_to)`. Forgetting half-life 5 years. `V`
half-life 2 days. Carrier speed: scout 4 m/s, flier 12 m/s. Brood cycle 6 hours. Resistance target per type =
0.7 x that type's share of the node's last 10,000 deaths. Main base holds 70 % of `force` at year 0.

**On screen.** Carriers are visible creatures with a distinct behaviour: they stop feeding, raise a scent organ that
glows, and run a straight line home. On the planet map: known nests as nodes, known trails as lines, `K` as node
brightness where the player has information (radar, dissection, older-species trade); unknown otherwise. A single
planet figure "hive awareness" with its band, shown only as accurately as the player's information allows.

### 4.15 The older species [L 9][L 11][L 13]

**State.** `hostility H` and `fear F`, each 0 to 100, per enclave and as a planet mean. A grievance ledger `G`:
their dead, split into killed by the player and killed by the hive that the player drew down. Open contracts.
Known technology: dampening, faster-than-light links, gravity, warp.

**In / out.** The player's actions in; trade offers, raids, sabotage, silence, and the ledger out.

**Rules.**
- `H` rises with: noise and vibration near enclaves, hive traffic drawn into their ground, pollution in groundwater,
  trespass, theft, killing. It rises as the player scales, whatever the intent [L 11].
- `F` rises with: the player's measured force (power generated, weapons deployed, nests destroyed, ships in orbit),
  successful defence against them, and demonstrations.
- `H` falls slowly with kept contracts, silence, and hive kills that relieve their fronts. `F` does not fall while
  force stays.
- What they do depends on both values:

| | F low (under 30) | F high (over 60) |
|---|---|---|
| **H low (under 30)** | they ignore you; a guarded door; barter for small things | open trade; shared hive intelligence; joint operations |
| **H high (over 60)** | sabotage and raids: collapsed galleries (gravity tools), jammed links, stolen reactors | trade under duress on terms that favour you; treaties with limits (depth, noise); every grievance recorded |

- Access by fear: dampening at `F` 20, faster-than-light pairs at 40, gravity at 60, warp at 80. Price multiplier
  `1 + H/100 - F/80`, clamped 0.4 to 3.
- **Theft** is the other path [L 9]: raid an enclave or a ruin vault for a device and reverse-engineer it. It works
  and is faster. It adds heavily to `H` and to `G`.
- Three-way fights underground: the hive attacks both; the older species will let the hive through a sealed gallery
  onto the player.
- They sent the distress signal at year 0 [L 13]. `G` is what the relief fleet is told (5.4).
- The black-hole ending needs their gravity technology [P 8], by trade or theft.

**Start numbers.** `H` 35, `F` 5 at first contact. Theft of a major device: `H` +25 at that enclave, +10 planet-wide.
Each of their dead by the player's hand: `G` +1; by a hive the player drew: `G` +0.5.

**On screen.** They are rarely seen: light bending in a gallery, a sealed door that was not there, machines that
make no sound. Contact happens at thresholds (doors) with an offer panel. `H` and `F` are shown as two bars only
after first contact, and as their estimate of you where the player has an informant or an intercept.

### 4.16 Earth: trade [L 14][P 6]

**State.** `usefulness U` and `alarm X`, each 0 to 100, as Earth last knew them (delayed). Convoys in transit
`{ sent, arrives, cargo, quota, escort }`. The quota ledger. Whether Earth has warp.

**Rules.**
- Without faster-than-light contact, Earth knows what the sentinels report, 4.4 years late, and acts by ship, 44
  years in transit at 0.1 c: what arrives answers what the player did about 48 years earlier. `[proposal: distances]`
- Convoys were on a schedule before the crash: about one arrival every 22 years. Each brings cargo (people,
  machines, rare goods, designs), a quota (research, biology, alien technology, with a deadline) [P 6], and an
  escort.
- The player sells: alien technology, biology, research data, refined rare materials [L 14]. Outbound cargo goes
  back with the convoy.
- `U` rises with quotas met and cargo sent. `X` rises with sentinels destroyed, force in orbit, refused quotas,
  survivors' reports, and with `U` itself past a point: a useful prisoner is an asset; a very capable one is a
  threat.
- A repurposed faster-than-light link lets the player talk to Earth without delay: negotiate, bargain, lie. It also
  lets Earth see sooner.
- **The warp deal.** Giving Earth warp technology cuts the round trip to about 1 year: trade becomes fast and large
  [L 14]. Earth also becomes stronger, and its kill-ships arrive in months.
- Trade and threat run in parallel: the same convoy can carry what was ordered and a force to shut the player down.

**Start numbers.** `U` 10, `X` 20 at year 0. Convoy: 5,000 t cargo. Quota deadline: the next convoy. Meeting a
quota: `U` +15. Missing one: `U` -10, `X` +5.

**On screen.** The interstellar map: convoys as dots on a line between two stars with arrival years; a ledger of
quotas with deadlines; Earth's last known `U` and `X` with the date of that knowledge.

### 4.17 Earth's enforcers: sentinels and kill-ships [L 15]

**State.** Sentinels `{ orbit or patrol area, weapons, alert }`; kill-ships in transit and in system; Earth's
doctrine level (how hard it tries), driven by `X`.

**Rules.**
- Sentinels are automated hunters [L 15]. `[proposal]` They are the prison's guard: a shell in orbit of the prison
  world and pickets at the system's edge. They ignore a prisoner on the ground. They attack launches, orbital
  construction and radio sources above a power limit. Reaching space means beating, blinding or spoofing them.
- Sentinels also descend: when `X` is high a hunter unit lands and tracks the player by radio and heat.
- Kill-ships arrive with or between convoys, sized by the `X` Earth knew when they left. Early ones are one armed
  ship with marines. Late ones are fleets.
- Destroyed sentinels and ships are wrecks the player owns as salvage; their parts are designs to learn from.
- "Beat humanity to save humanity" [L 15]: breaking the shell and surviving the kill-ships is the training and the
  industry the player needs for the relief fleet.

**Start numbers.** Shell: 24 sentinels in 600 km orbit `[proposal]`. Each: two 30 mm cannon [built type], one lance.
First kill-ship about year 50; then one per convoy period, growing 1.5 times each time `X` passes a new quarter.

**On screen.** Before orbit: moving stars that are not stars; a launch that is shot down. In space: sprites with the
hard, clean lines of Earth's hardware against the player's patched ships and the hive's grown ones.

### 4.18 Weapons, combat and the physics under them [L 1][L 2]

**Physics engine (round 4).** Rigid bodies with contacts and joints; ragdolls for creatures and people (bodies are
jointed rigid parts driven by procedural animation while alive, by physics alone when dead or stunned); cutting
(a beam or blade splits a body along its path: joints and shapes are cut, both halves stay as bodies); splatting
(fluid hits are decals on terrain and bodies plus short-lived droplets); all colliding with the density field
[built]. Fixed 120 Hz step, deterministic, as PLAN B.3 requires later.

**Heat field.** One temperature value per 0.5 m cell (the light map's grid), in a window around the view, diffused on
the GPU each step. Sources: beams, reactor, machines, fire, lava. Effects by threshold: tissue burns, plants
ignite, machines derate then fail, soil fuses to glass, rock melts and flows as loose material, metal softens.
Far from the view, heat is not simulated; standing sources keep an analytic steady state.

**Procedural weapons** [L 1][L 2]. A weapon is a design (4.6) with parameters: energy source (electrical, chemical,
kinetic store, biological, gravity), emitter or barrel, power draw, pulse shape, mass, cooling, mount pattern. Its
model, recoil, deploy, reload and vent animations and its sound are generated from those parameters. There are no
hand-made weapon sprites.

| Family | Damage type | Source of the first one | Character |
|---|---|---|---|
| Ship laser (start) [L 2] | thermal | the crashed ship | one heavy tool: cut, lance, pulse; also the drill |
| Laser variants | thermal | redesign of the ship laser | wide cutter, long lance, point-defence array |
| Coil and rail | kinetic | tier 3 | very long range; recoil moves the firer; needs capacitors |
| Explosives and rockets | chemical, blast | sulfur, nitrates, organics [L 6] | cheap, loud, area; made in bulk early |
| Incendiary and gas | thermal, chemical | sulfur chemistry | denies ground; pollutes heavily |
| Arc projectors | electric | reactor engineering | chains between bodies; short range |
| Bio agents | biological | nest biology | spreads through a brood; slow; the bio-weapon path |
| Gravity tools | gravity | older species | crush, fling, collapse tunnels; no sound |
| Orbital strike | kinetic, thermal | ships | called from the network on a marked point |

**Rules.**
- The starting kit is one weapon: the ship's weapon system repurposed as a handheld laser. No rifle, no shotgun.
  Without it and its reactor the player is unarmed [L 2]. (Round 2's rifle and shotgun [built] are removed from the
  start and return later as things the player designs.)
- Damage is physical: a beam delivers joules to what it touches; tissue and armour have heat capacity and limits. A
  kinetic round delivers momentum and penetration. There are no hit points on parts that physics can cut.
- Every weapon heats itself; cooling is a design parameter and a limit in a fight.
- **Mech suit** [L 1]. A walking frame the player enters and leaves; its own rigid body, legs with the same procedural
  gait as creatures, its own power bay (it can carry the reactor), hardpoints, and upgrade slots. In it the player
  is larger than most predators (4.12) and far louder (4.13).
- **Adapters** [L 2]. A handheld weapon mounts on a mech hardpoint through an adapter the ship AI designs on request
  (4.6). The same holds for mounting anything on anything: turret bases, robot arms, ship mounts.
- **Loadout view** [L 1]. A body view showing every slot on the person or the mech: what is in it, its mass, power,
  data link and heat. Upgrades are devices fitted to slots. The arm with the compiler is slot one and is permanent.
- Ship weapons are devices on the network: the player fires the grounded ship's remaining guns from the suit if the
  ship has power and a link [L 2].

**Start numbers.** Laser as in 4.3. Emitter heat capacity: 20 s of cut, 6 s of lance, then a 4 s vent [built:
overheat and venting]. Mech: 900 kg, carries 600 kg, walks 5 m/s, steps heard at 40 m. Thresholds: tissue 500 K,
plant ignition 550 K, machine derate 400 K and fail 450 K, soil to glass 1,400 K, basalt melt 1,500 K, iron 1,810 K.

**On screen.** Heat as colour on the thing itself (black, dull red, orange, white). Cut faces glow. Ragdolls keep
their mass. The body view is a drawing of the actual procedural body with lines to slot panels.

### 4.19 Radar and fog of war [L 1]

**State.** Per map cell, one of three knowledge states: unknown, remembered (with the time last seen), live. A list
of contacts `{ kind if known, position, velocity, age, source }`. Sensors as devices with coverage shapes.

**Rules.**
- The player knows only what a sensor of theirs has observed. Everything else is black (unknown) or a dim ghost with
  its age (remembered).
- Sensors: eyes and lamp (cone, blocked by terrain) [built]; passive acoustic (direction and loudness, no identity);
  thermal (warm bodies through foliage, not rock); seismic (movement through rock, for underground); active radar
  (range and velocity through foliage and weather; it is a radio emission: 4.5 says who detects it); balloon and
  orbital survey (wide, coarse).
- Contacts degrade: after its age passes a limit a contact becomes a ghost and then is dropped.
- Sensor coverage and network coverage are different things and both are shown: a robot can see where it cannot
  report.
- The hive, the older species and Earth have fog too. Decoys, silence and jamming work because they do not know
  where the player is either.

**Start numbers.** Lamp cone 24 m, 42 degrees [PLAN A.1]. Suit acoustic 80 m. Ship radar 3 km above the canopy,
600 m through it. Seismic stake 150 m in rock. Contact ghost after 30 s, dropped after 10 min.

**On screen.** The map (`M`) and a small scope on the HUD: live areas clear, remembered areas desaturated with a
last-seen time, unknown black. Contacts as brackets [PLAN A.5] with a tail showing velocity; unidentified contacts
as plain dots sized by signal strength.

### 4.20 Death and the bio-printer [PLAN D]

**State.** Bio-printers `{ site, power, stock of tissue feed, pattern date }`; the player's bodies (the live one,
dead ones where they fell).

**Rules.**
- Until a bio-printer exists, death restarts the player at the crash site [PLAN D][built].
- Once one exists, the player respawns at a powered, stocked bio-printer. The old body and what it carried stay
  where they fell and can be recovered. Ships stay the player's, as wrecks [PLAN D].
- `[proposal]` Printing a body takes tissue feed (tier 4 biology improves it) and time; the campaign clock runs
  meanwhile. Early prints take days, so dying costs time on the campaign clock, not items.
- `[proposal]` Over 1000 years the player lives through many bodies. The pattern is tied to the player's identity
  (4.21), not to a body. Loadout upgrades fitted to a body stay with that body.
- `[proposal]` Long absences (high clock rates) are spent in stasis in the printer. Leaving the body view for the
  maps means the body is stored; it steps out again when the player steps in.

**Start numbers.** First bio-printer: 40 kg tissue feed and 3 days per body; later 2 hours.

**On screen.** Waking in the printer with the date and how long it took. Old bodies marked on the map.

### 4.21 Saves and identity [PLAN D][built][P 5][P 9]

**State.** As built: edited terrain chunks, player, suit, inventory, queues, machines, chests, blueprints, drones,
site state, hive alert, pollution, beats seen, space state. Added by this design: designs and templates, the node
tree with solved flags and rate models, the demand graph's targets and policies, the hive graph, `H`, `F`, `G`, `U`,
`X`, convoys, the campaign clock, fog-of-war memory, lost bases and their logs [P 5].

**Rules.**
- `save.js` stays the only module that touches storage, behind the adapter `{ load, save, list }` [built].
- Everything the player owns (ships, devices, designs, sites) carries an owner id. In demo builds that is a local
  player id; later it is the player's ce-net identity [PLAN D].
- Solved nodes away from the player are saved as rates and stocks, not items. Unvisited ground is not saved at all.
- Lost bases are not deleted: they stay in the world as ruins with their logs, and can be salvaged [P 5].

**On screen.** A campaign log (`L`) with dated entries the game writes from events: firsts, losses, contacts,
arrivals. It is the player's own history and the source for the record shown at the final choice.

---
## 5. Story structure

Leif has written much for this story and that writing is not available now. This section gives structure only: acts,
beats, triggers and slots. Every text is `[placeholder]`. Beat ids and triggers are stable; Leif's text replaces the
placeholder strings in `repo:spacegame/src/story.js` without code changes, as now [built].

### 5.1 Acts

| Act | Years | The player is | The act's question | Ends when |
|---|---|---|---|---|
| 1. Hands | 0 to 1 | a prisoner with one arm, a reactor and a ship's gun | can I live through the night | the first robot carries for you |
| 2. The line | 1 to 30 | a builder | can I stop doing this by hand | the first site is solved; the first nest is taken; the first base is lost |
| 3. Below | 30 to 150 | an intruder | who else is here, and what do they want | first contract with the older species, or first theft from them; first Earth convoy answered |
| 4. The planet | 150 to 400 | a power | how does the hive end | the hive's main base falls by one of three means, or the player leaves the surface for good |
| 5. The fleet | 400 to 900 | the thing everyone fears | trade or war | the relief fleet is turned, bound by treaty, or destroyed |
| 6. Earth | 900 to 1000 | the one who decides | save Earth or not | the choice is made, or year 1000 passes |

### 5.2 Beats

Existing triggers [built]: `landed`, `firstCreature`, `firstKill`, `firstMachinePrinted`, `firstRobot`, `furnaceLit`,
`firstAutomation`, `blueprintMode`, `printerBuilt`, `suitPrinted`, `died`, `ruinFound`, `stoneRead`, `baseFound`,
`labFound`, `terminalRead`, `audioLog`, `cacheOpened`, `facilityDark`, `hiveFound`, `hiveSighted`, `hiveWave`,
`eggHatched`, `hiveHeartKilled`, `machineLost`, `launch`, `orbit`, `firstAsteroid`, `depotBuilt`, `firstDrone`,
`shipLost`.

New beats this design needs. All are events the systems in section 4 already produce.

| Act | Beat id | Trigger (event) | What it marks | Text |
|---|---|---|---|---|
| 1 | `a1.reactorPulled` | reactor leaves the ship bay | the weight; the ship goes dim | [placeholder] |
| 1 | `a1.firstCut` | first laser cut | the tool that is also the weapon | [placeholder] |
| 1 | `a1.watched` | first wary animal holds its distance for 10 s | not everything is hostile | [placeholder] |
| 1 | `a1.hunted` | first predator charge | some things are | [placeholder] |
| 1 | `a1.carrierSeen` | first hive carrier leaves toward a nest | being noticed | [placeholder] |
| 1 | `a1.firstStockTarget` | first job created by a stock target | demand pulls | [placeholder] |
| 2 | `a2.firstSolved` | first node solved | not having to think about it | [placeholder] |
| 2 | `a2.firstCopy` | first AI deploy of a template | the system copies itself | [placeholder] |
| 2 | `a2.survivorFound` | first survivor rescued [P 7] | another prisoner | [placeholder] |
| 2 | `a2.dissection` | first hive profile read [P 2] | it is learning | [placeholder] |
| 2 | `a2.forestDies` | a region's plant biomass under 30 % [P 4] | your cost | [placeholder] |
| 2 | `a2.baseLost` | a site is abandoned or overrun [P 5] | your first ruin | [placeholder] |
| 3 | `a3.shaftSunk` | first elevator shaft in use | going down | [placeholder] |
| 3 | `a3.silentMachines` | first sighting of the older species' work | not alone below | [placeholder] |
| 3 | `a3.firstContact` | first offer panel at a door | they speak | [placeholder] |
| 3 | `a3.firstTrade` / `a3.firstTheft` | first contract kept / first device stolen | which way you went | [placeholder] |
| 3 | `a3.ftlRepurposed` | first faster-than-light pair in the network | the backbone | [placeholder] |
| 3 | `a3.intercept1` | first decoded distress traffic | the clock exists | [placeholder] |
| 3 | `a3.balloonFirst` | first balloon cargo delivered | above the forest | [placeholder] |
| 3 | `a3.convoyArrives` | first Earth convoy in system | Earth has not forgotten | [placeholder] |
| 3 | `a3.quotaSet` / `a3.quotaMet` / `a3.quotaRefused` | quota events | what Earth wants | [placeholder] |
| 3 | `a3.killShip` | first kill-ship identified | what Earth does | [placeholder] |
| 4 | `a4.sentinelDown` | first sentinel destroyed | beating humanity begins | [placeholder] |
| 4 | `a4.shellBroken` | free launch corridor exists | escape | [placeholder] |
| 4 | `a4.awarenessRegional` / `a4.awarenessMajority` | `A` passes 0.2 / 0.5 | the hive knows | [placeholder] |
| 4 | `a4.intercept2` | relief fleet departure time decoded | the clock has a date | [placeholder] |
| 4 | `a4.endingChosen.bomb` / `.bio` / `.hole` | the ending's project is started | how | [placeholder] |
| 4 | `a4.hiveFalls` | main base `force` under 5 % of its start | it is over, and it is not | [placeholder] |
| 5 | `a5.fleetArrives` | relief fleet enters the system | the answer is due | [placeholder] |
| 5 | `a5.ledgerRead` | the fleet states `G` | what you did | [placeholder] |
| 5 | `a5.treaty` / `a5.war` | the player's answer | trade or war | [placeholder] |
| 5 | `a5.warpToEarth` | Earth receives warp technology | a faster, stronger Earth | [placeholder] |
| 5 | `a5.earthTurns` | Earth's doctrine reaches its top level | everyone | [placeholder] |
| 6 | `a6.fleetBoundForEarth` | a hostile force is on a course for Earth | the last distance | [placeholder] |
| 6 | `a6.record` | the choice screen opens | what Earth did to you, what you did | [placeholder] |
| 6 | `a6.choice.save` / `a6.choice.leave` | the choice | | [placeholder] |
| 6 | `a6.end.*` | the outcomes in 5.5 | | [placeholder] |

### 5.3 The three ends of the hive [L 10]

The player's call. Each is a production and logistics project in the demand graph, not a cutscene. Requirements and
consequences beyond Leif's words are `[proposal]`.

| | Bombing | Bio-weapon | Black hole |
|---|---|---|---|
| What it is | sustained strategic bombardment of the far side from orbit and by long-range launch | an agent bred against the hive, released into it | a gravity device that consumes the planet |
| Needs | the sentinel shell broken; orbital industry; munitions by the hundred thousand tonnes; years | tier 4 biology from several nests and one sample from the main base's own brood; current hive profiles | the older species' gravity technology [P 8], by treaty or theft; everything the player wants to keep moved off-world |
| How it works in the systems | reduces main-base `force` directly; `V` on the far side goes to its maximum, which pulls the hive's force away from the player | travels on the hive's own carriers and trails (4.14); the hive's learning races it, so it must be released wide and at once | removes every node, and the planet |
| Risk | slow; the hive adapts by digging deeper; `A` reaches 1 during it | it fails if the hive adapts first; it can cross into native species and the balloon herds | none for the hive; total for anything left behind |
| Cost to the world | the far side is ruined; enclaves under it die unless warned | the planet's biology, the best resource, is degraded for centuries | the prison world, its enclaves, the ruins, the player's first sites |
| Older species | `G` rises unless a treaty covers it | `F` rises sharply: the same could be made for them | by treaty: they evacuate first and `G` is small; by theft: `G` is at its maximum |
| Earth | `X` rises: strategic force shown | `X` rises most of all: a weapon that could reach Earth in a convoy | `X` at maximum |
| What it says about the player | force | cunning | no limits |

A fourth course exists and is not an ending: leave the surface and let the relief fleet destroy the hive [L 13]. The
player then meets the fleet without having shown strength.

### 5.4 The relief fleet [L 13]

- Arrives 10 years after the hive's main base falls, or at year 400 if the player is too slow (2.10).
- The clock is revealed in steps: `a3.intercept1` (a signal was sent), `a4.intercept2` (when the fleet left, so when
  it arrives). Ruin stones and enclave terminals carry earlier hints [L 13].
- On arrival it destroys what remains of the hive, then turns to the player. Its opening stance is set by `G`, `H`
  and `F`:

| | G low | G high |
|---|---|---|
| **F high** | offers a treaty between equals | demands reparations, then negotiates |
| **F low** | orders the player off the world, gives time | attacks without talking |

- The player answers with trade (technology, territory, limits, reparations, or Earth's coordinates) or with war.
- Unless turned, bound or destroyed, the fleet goes on to Earth (2.8).

### 5.5 The final war and the choice [L 13][L 15]

By Act 5 Earth has turned fully on the player and the older species' allies are in the system: "everyone wants to
kill you because everyone fears you" [L 13]. The final state the game builds toward is a fleet and an interplanetary
army able to beat both. Then the choice.

| Outcome id | State at year 1000 | How it is reached |
|---|---|---|
| `a6.end.silence` | Earth wiped out; the player dead or gone | the simulation with no player, or a player who lost [L 15] |
| `a6.end.left` | Earth wiped out; the player alive and strong | the player could have stopped it and chose not to |
| `a6.end.shield` | Earth alive and still in charge of itself | the player stops the fleet and withdraws |
| `a6.end.keeper` | Earth alive under the player's control | the player beats Earth's forces and the fleet, and stays |
| `a6.end.treaty` | Earth alive under a three-way treaty | the player binds both by trade; hardest to reach `[proposal]` |

The game does not rank these. The record screen (`a6.record`) lists dated facts from the campaign log (4.21):
kill-ships sent, quotas, survivors found and what happened to them, the older species' ledger, nests, the hive's
end. Then two buttons.

### 5.6 Where Leif's writing goes

| Slot in `story.js` | Holds | Keyed by |
|---|---|---|
| `STORY.system`, `STORY.species`, `STORY.sites` [built] | names | body, species, site kind |
| `STORY.beats` [built] | one-line beats shown for 6 s and logged | beat id, trigger |
| `STORY.lore.ruin` [built], `.terminal`, `.audio` | stones, terminals, audio logs found in the world | site kind + index |
| `STORY.survivors` (new) | each rescued prisoner's record and lines | survivor id |
| `STORY.earth` (new) | quota messages, convoy manifests, warnings | `U`/`X` band + convoy number |
| `STORY.elders` (new) | the older species' offers, refusals, threats | quadrant of the `H`/`F` table + event |
| `STORY.intercepts` (new) | the distress signal and fleet traffic, decoded in stages | intercept number |
| `STORY.record` (new) | sentence templates for the final record | fact kind |
| `STORY.endings` (new) | the five outcome texts | outcome id |

Longer passages (Leif's prose) are shown in the log (`L`) as readable pages, never as interruptions. No cutscenes
[PLAN A.6].

---

## 6. Visual and audio direction

This is Leif's top priority now: deep, detailed, lush, alive, many layers [L 1][L 16]. The rules of PLAN A.5 stand
unchanged: no outlines, no flat fills, dark first, saturation only from emission, motion has mass, many small
particles, quiet thin text, "a still from a film, not a sticker". This section adds depth, life and the per-biome
and per-act direction.

### 6.1 The layer stack

Fourteen layers, back to front. Parallax 0 moves with the camera (infinitely far); 1 is the play plane. Every layer is
generated per chunk from the seed and the biome, so it is different everywhere and the same on every machine.

| # | Layer | Parallax | Content | Moves with |
|---|---|---|---|---|
| 0 | Sky | 0.00 to 0.02 | stars in three depths [PLAN A.5], the ringed giant, its rings' shadow, aurora at high alarm | time of day |
| 1 | Cloud and spore deck | 0.05 | slow noise sheets lit from below by the forest's glow | high wind |
| 2 | Far ridges | 0.10 | terrain silhouettes from the real height function of distant strips | none |
| 3 | Far forest | 0.20 | crown silhouettes with rim glow; balloon herds as dots | wind, slow |
| 4 | Mid-far trunks | 0.35 | trunks and caps in fog, only values, no detail | wind |
| 5 | Fog sheet A and light shafts | 0.45 | scrolling fog; shafts where layer 4 has gaps | wind; shafts with the giant or sun angle |
| 6 | Mid trunks and vines | 0.60 | recognisable species, hanging vines, silhouettes of large animals passing | wind; animals on their own paths |
| 7 | Fog sheet B and spores | 0.75 | thin fog, drifting spores and motes in thousands | wind, player's wake |
| 8 | Near-back flora | 0.90 | full-detail plants just behind the play plane | wind, gusts |
| 9 | Play plane | 1.00 | terrain, loose material, the player, creatures, machines, cables | physics |
| 10 | Play-plane volumetrics | 1.00 | lamp haze [built], smoke, steam, heat shimmer, dust | heat field, wind |
| 11 | Near-front growth | 1.10 | grass, fronds and roots that overlap feet and wheels | contact: bends when touched |
| 12 | Foreground canopy | 1.40 to 1.80 | dark, soft-focus leaves and vines crossing the frame | wind, strong |
| 13 | Lens | screen | droplets in rain, spores on the visor, post chain [built] | camera motion |

Rules for the stack:
- **One wind.** A single wind field (direction, strength, gusts as travelling waves) drives every layer, delayed by
  depth, so a gust is seen arriving from the back of the forest to the front.
- **One light.** Emitters on the play plane light the layers behind and in front with falloff by depth. The laser
  lights trunks at layer 6; a muzzle flash prints the foreground leaves for one frame.
- **Depth by value, not blur alone.** Far layers are lighter and bluer in fog and lose contrast; near-front layers
  are almost black. Only layer 12 is defocused.
- **Life in every layer.** Each layer from 3 to 12 has something that moves by itself: flocks, a slow herd, falling
  spores, an animal that stops and looks, a vine that uncoils. Animals in layers 6 and 8 are the same ecology as the
  play plane (4.12) drawn at depth: when the region's grazers boom, the background fills with them; when the forest
  dies from pollution, layers 4 to 8 thin and brown [P 4].
- **Reaction.** Noise makes background animals flee in a wave outward from the source; the forest goes quiet after a
  shot and the sound comes back over a minute.
- **Budget.** All flora instanced [built]; layers 2 to 7 render to half-resolution targets and are composited; p95
  frame time at or under 16.7 ms on Leif's laptop GPU.

### 6.2 Per biome

Base palette as PLAN A.5. Each biome owns one emission colour and one sound bed.

| Biome | Dominant emission | Shapes and motion | Fog and particles | Sound bed |
|---|---|---|---|---|
| Cap forest | cyan #2ef2d0 | broad caps, gill light underneath, slow breathing pulse | blue-grey fog, cyan spores rising | low wind in caps, clicks, distant calls answering each other |
| Violet thicket | violet #8a4dff | vines everywhere, pods that open as you pass | dense violet fog, visibility 10 m | close, wet, dripping; calls are near and stop when you move |
| Lantern fen | warm white stalk tips, reflected | vertical stalks, still water with exact reflections, ripples from every step | ground mist, slow motes | water, insects in chorus, a deep call at long intervals |
| Sulfur flats | yellow-white vents, #ff5e3a at the cracks | flat, bare, steam columns leaning in wind | steam, ash flakes | hiss, rumble, no animals |
| Bone-coral ridge | none; lit by the giant | pale coral forms, long sight lines, the giant huge in layer 0 | clear air, blown dust | hard wind, high flier calls |
| Balloon steppe | faint green from balloon bellies overhead | open ground, herds drifting at 50 to 400 m, their shadows on the moss | clear, seed drift | open wind, the herd's low tones |
| Nest country | acid green #9dff3a | resin ribs, breathing walls, trails of light along the ground | warm haze, pheromone motes | a pulse felt as much as heard; chitin on resin |
| Underground: basalt | lumen veins, ore glints | tight, hard; only the player's light | dust in the beam | drip, the player's own echo, far scraping |
| Underground: coral caverns | mixed bioluminescence, the richest colours in the game | large volumes, pillars, lakes | cool mist | long reverb, water, something large moving |
| Underground: the quiet layer | almost none; cold white where they allow it | exact geometry, surfaces with no grain (the one place the "grain" rule is broken, on purpose) | none; the air is clean | near silence; the player's suit sounds become loud |

### 6.3 Per act

| Act | Look | Sound | What changes on screen |
|---|---|---|---|
| 1. Hands | night; the lamp and the laser are the only strong lights; the forest is intact | the forest's full bed; the reactor's hum close | everything is body scale; HUD is minimal |
| 2. The line | amber human light (#ffb347) spreads from the crash site; first cleared ground; first dead trees | machines join the bed; animals grow distant | the site view appears; cables and belts as lit lines |
| 3. Below | vertical: shafts of work light dropping into dark; the quiet layer's cold white | reverb, vibration, long silences | the planet flow map appears; the forest above is seen from balloon height |
| 4. The planet | the far side burning, sick or bending, by the ending chosen; launch plumes lighting cloud from below | the hive's pulse under everything; launches | the system map; the sky layer now has the player's own ships in it |
| 5. The fleet | space dark #020305; three hardware styles side by side: Earth's clean lines, the player's patched mass production, the allies' seamless forms | hull-conducted sound only [PLAN A.5] | fleets as formations; the interstellar map |
| 6. Earth | one blue point growing | almost nothing | the record screen: plain text on black |

### 6.4 The body and the tool (round 3 focus)

- **Gait.** A balance model: the body's centre of mass over its support; foot placement by reach and terrain normal;
  the stride shortens and the torso leans with load (4.1); braking takes steps; a slope shifts the hips; a stumble
  when a foot target fails. No canned run cycle.
- **Carrying.** The reactor swings a little on its frame and its fins glow. The cable hangs, drags and snags.
- **The laser.** Two-handed, with inertia. The beam is a hot core with a soft sheath; where it meets ground there is
  a white point, an orange pool, dripping melt that cools to dark glass, sparks with gravity, smoke that rises into
  the wind field, and debris that stays [L 16]. The cut face glows and fades over seconds by the heat field.
- **Sound of the laser.** A capacitor whine rising, a heavy continuous crackle with a sub-bass body, the hiss of
  melt, rock cracking as it cools; the forest falls silent around it.
- **Printing.** The arm's compiler lays material in visible passes, bright at the nozzle, part by part, slowly; the
  printed part cools from orange.

### 6.5 Interface

HUD rules as PLAN A.5 (1 px lines, small monospace caps, units on every number, nothing bounces). Added by this
design: the port panel (4.4), the stock panel and job sentences (4.8), layer boxes with a breadcrumb (4.7), the
overlays (`P` power, `N` network, `H` sound, `M` map), the loadout body view (4.18). The planet flow map follows the
maps.ce-net.com style [P 11] and the ce-design tokens where they apply.

---

## 7. Round plan

### 7.0 What can start now, and what waits for review

Leif: "a lot of things can be started right away without waiting but the rest yes i want a design document."

| Start now (his words are specific enough; no open design choice) | Waits for his review of this document |
|---|---|
| Round 3 slice, all of 7.1 | the time model (2.9) and timeline years (2.10) |
| The layer stack, wind, life in layers (6.1) | the hive awareness model and its numbers (4.14) |
| Organic body movement and the load model (4.1, 6.4) | hostility and fear rules and thresholds (4.15) |
| The reactor and the ship laser as the starting kit (4.3, 4.18) | Earth's distances, convoys, sentinels as a prison shell (4.16, 4.17) |
| Engine: systems architecture ready for the cell split [L 1] | the solved rule and rate models (4.7) |
| Physics engine: rigid bodies, ragdoll, cutting, splatting; the heat field [L 1] | story structure, endings and beat list (section 5) |
| Loose material and chunks that must be carried (4.1) | planet geometry (2.2) and the proposals in 1.4 |
| Procedural animation for weapons, tools and parts [L 2] | anything tagged `[proposal]` that changes a system's rules |
| Ecological behaviour: wary by default, hunt rule [L 5] | |

### 7.1 Round 3: the visual and feel slice [L 16]

About 10 minutes of play at film quality on round 2's engine. Scenario `?act=surface&scenario=slice`.

| Minute | What happens | Systems shown |
|---|---|---|
| 0 to 1 | Night at the crash site in the cap forest. The ship is dim. The forest moves in 14 layers. | 6.1 |
| 1 to 3 | Pull the reactor from the ship; the gait changes. Take the ship laser. | 4.1, 4.3, 6.4 |
| 3 to 5 | Carve into a hillside: heat glow, molten edges, smoke, debris that stays and piles. | 4.18 (laser, first heat field), 4.1 (first loose material) |
| 5 to 6 | A wary animal watches from the edge of the light and leaves when approached. | 4.12 |
| 6 to 7 | A predator larger than the player stalks and charges; the pulse cuts it; it falls as a ragdoll. | 4.12, 4.18 |
| 7 to 9 | Print the first machine with the arm, slowly, on reactor power; then a robot; the robot carries the spoil. | 4.4, 4.10 |
| 9 to 10 | A hive scout that heard the laser turns and runs for its nest; far off, an answer. | 4.14 (first carrier), 6.1 (reaction) |

Acceptance checks (run by `repo:spacegame/tools/check.mjs`, as now):
1. Shots at minutes 0, 2, 4, 6, 7, 9 and 10 saved to `docs/shots/slice-*.png`; Leif judges them against PLAN A.5.
2. A layer-debug shot (`&layers=1`) shows 14 separately tinted layers; a 10 s capture shows one gust crossing them
   back to front.
3. With the reactor carried, measured run speed is 4.2 m/s (within 5 %) and stride length is shorter than unloaded;
   printed by `?test=1`.
4. Mass conservation: kilograms removed by the laser equal kilograms of loose material and chunks spawned, within
   0.1 %; `?test=1`.
5. The wary animal never closes below its flight distance unless cornered; the predator charges only at a body
   smaller than itself; `?test=1` with scripted positions.
6. The start has no rifle and no shotgun; without the reactor connected the laser does not fire.
7. p95 frame time at or under 16.7 ms on a machine with a GPU, named in `docs/CHECK.md`; zero console errors.
8. All earlier scenarios still load and pass.

### 7.2 Rounds 4 and later

Order rule: every round ends playable and better looking than the one before; each adds one scale of the loop (3.4)
and reuses the slice's body, tool and forest unchanged.

| Round | Name | Builds | Acceptance checks |
|---|---|---|---|
| 4 | The physical world | systems architecture (components, systems, schedule) [L 1]; physics engine: rigid bodies, joints, ragdolls, cutting, splatting; heat field with thresholds; loose material and chunks everywhere (4.1); containers, sack, sled; loadout body view | determinism test: same inputs, same state hash after 60 s; mass conserved across all transitions; a tree cut by the beam falls as two bodies; heat shot: glass where soil was fused; 2,000 sleeping chunks at p95 16.7 ms |
| 5 | Power, network, devices | port model (4.4); cables as ropes; reactor set down as a source; place-and-assign with the ship computer; antenna, coverage, relay; control channels; the laser as a turret; radar and fog of war (4.19); ship guns fired from the suit | a device out of coverage keeps last orders; cutting a cable drops its network; fog shot with live, remembered and unknown areas; turret tracks only with a channel free |
| 6 | Demand and supply | stock targets, jobs, producer selection, haul tasks (4.8); general machines that retool; sulfur and nitrate chemistry, explosives [L 6]; hauler and digger robots; the frontier list | fire 50 rounds: stock returns to target with no player input; build an ammunition line: the AI moves the job from the compiler to it; recipe mass conservation; job list reads as sentences |
| 7 | Designs and weapons | parametric designs and the design sheet (4.6); procedural weapons across four families; the mech; adapters designed by the ship AI [L 2]; upgrades | 20 generated weapons, each with distinct model, animation and sound, in one shot sheet; a handheld weapon mounted on the mech through a designed adapter; mech gait check |
| 8 | Ecology and the hive graph | species parameters, regions, populations, pollution damage [P 4]; hive graph, carriers, violence field, learning, dissection (4.14); noise budgets and mufflers [P 3]; the sound overlay | kill every carrier in a test: `K` at the nest stays 0; let them go: waves arrive; 80 % thermal kills: next brood shows thermal resistance, visible in dissection; grazer boom after predator removal |
| 9 | Below | strata; borers, haulers, shafts, elevators (4.11); underground heat; the older species: enclaves, `H`, `F`, `G`, offers, theft (4.15); faster-than-light pair; survivors as operators [P 7] | a mine runs with spoil hauled and no player input; the four quadrants of 4.15 each produce their behaviour in scripted tests; a stolen device raises `H` and `G` |
| 10 | Layers and the planet | solved nodes and rate models (4.7); templates and AI deploy (4.9); policies; sites; balloons and belts (4.10); the planet flow map [P 11]; clock rates up to 10,000x (2.9); lost bases as ruins [P 5] | a solved factory at 10,000x for one in-game year matches item-level simulation within 2 %; the AI deploys a second factory from demand alone; balloon route shot; the clock drops to 1x on an alarm |
| 11 | Orbit | sentinel shell (4.17); shuttles, railguns, pods; fleet control; depots and haulers tied into the demand graph; system map; clock to 100,000x | a launch is shot down while the shell stands; a corridor opens after sentinels fall; ore moves belt to depot to surface factory with no input |
| 12 | Earth and the clock | convoys, quotas, `U`, `X`, kill-ships (4.16); intercepts; the relief fleet's clock; interstellar map; clock to 1,000,000x | 1000 years with no player input ends in `a6.end.silence` (the world runs without you [L 15]); a quota met and a quota refused each change the next convoy as specified |
| 13 | Ends | the three hive endings (5.3); fleet arrival and stance (5.4); warp deal; the final war; the record and the choice (5.5) | each ending reachable from a prepared save; each of the five outcomes reachable; the record lists only facts present in the campaign log |
| 14 | Cells and other prisoners | the split onto ce-net cells (section 8) [PLAN B]; shared hive between players [P 10]; designs shared and licensed [P 9] | two machines, two players, one hive: one player's noise raises the other's waves; a design licensed from one identity builds on another's site; handoff mismatch rate 0 [PLAN B.3] |

Each round also adds its scenario URLs and shots to `tools/check.mjs` and keeps all earlier ones passing.

---

## 8. How the systems map to ce-net cells

All of this is `[proposal]` on top of PLAN B.1 (itself marked "guess" there). Nothing here is built before round 14,
except that round 4's architecture must not prevent it.

| Game system | Cell (program cell unless noted) | Holds in `state.store` | ce-net idea it shows |
|---|---|---|---|
| Terrain, loose material (4.1) | `spacegame.world` [PLAN B.1] | chunk deltas | state as a pure function of a seed plus deltas |
| Physics near a player (4.18) | `spacegame.sector` [PLAN B.1] | sector deltas, authority lease | leases: one device steps a region; handoff with a hash |
| Orbits | `spacegame.orbit` [PLAN B.1] | nothing (pure) | a pure typed function as a service |
| Devices and ports (4.4) | each device kind is a typed contract; a placed device is an object owned by an identity | owner, controller, orders | every machine is a real addressable thing with an owner |
| Network, controllers (4.5) | `net.find` and capabilities, shown directly | links, channel use | discovery; rights by capability; a device keeps working offline on last orders |
| Designs (4.6) | document cells, one per design, tied to identity [P 9] | params, bill, version, licence | cells as shareable, versioned, licensable units |
| Layers and solved nodes (4.7) | aggregator cells: a line cell links machine cells | measured rates, solved flag | the cell graph; aggregation over many machines |
| Demand and supply (4.8) | `spacegame.demand` | targets, jobs, reservations | orchestration: one graph schedules many producers |
| AI replication (4.9) | deploy of a template = a ce-net deploy [P 9] | templates, policies | do it once, then deploy it anywhere |
| Fleets, routes (4.10) | `spacegame.fleet` [PLAN B.1] | carriers, routes, tasks | movers at scale; counts far away, objects near |
| Hive, older species, Earth (4.14 to 4.17) | `spacegame.hive`, `spacegame.powers` (world cells, not owned by a player) | graph, `K`, `H`, `F`, `G`, `U`, `X`, convoys | shared state many players change; the world runs without any one client |
| Clock (2.9) | the twin clock [PLAN B.2.7] | rate, epoch | one viewed time `t` for everyone |
| Story | `spacegame.story` [PLAN B.1] | beats seen, campaign log | per-identity progress |
| Saves, identity (4.21) | the `save.js` adapter onto `state.store` | everything above | ownership follows identity across machines |
| The page | `spacegame.view` [PLAN B.1] | UI state | a viewer that subscribes and renders |

What the game teaches about ce-net, in the order a player meets it:

1. **A thing has an owner and a controller**, and you can see both (the port panel). That is identity and capability.
2. **A device needs a path to its controller**, and keeps its last orders without one. That is why local autonomy
   and links matter.
3. **Do it once, then deploy it.** A proven line becomes a template the AI places anywhere. That is a cell deployed
   to another machine.
4. **Layers hide what is solved.** A million parts read as nine boxes. That is the cell graph and aggregation.
5. **Demand pulls work through a graph of producers.** That is orchestration across many machines.
6. **One clock, one world, many machines stepping pieces of it.** That is leases, handoff and determinism.
7. **A designed network against an emergent one.** The hive is what scale looks like with no owners, no types and
   no permissions. The player's network is the argument for having them.

---

## 9. Open questions for Leif

> **Leif answered Q2 (2026-11-14):** "its a its a whole planet. this is why i told you no grid becaue the camera msut rotate bsed on gravity.  the hive is on the other side of the planet." The surface is a full round planet with radial gravity and a camera that rotates with it, not a strip. Round 4 builds it (ROUND4.md).

Each has a default that this document already assumes. Silence means the default stands.

| # | Question | Default |
|---|---|---|
| 1 | Who built the ruins, and whose is the instant faster-than-light communication you want to repurpose [L 7]: the older species, or something else? | The older species: ruins are places they gave up; the hive has no fast communication and spreads knowledge by carriers [P 1]. |
| 2 | Planet geometry: one side-view strip along the great circle from the crash site to the hive's main base, with off-strip places as map nodes that get their own strip when visited? | Yes. |
| 3 | The clock: one campaign clock whose top rate depends on the view and on how much is solved (2.9)? And when you are away: paused, or running? | One clock as in 2.9. Paused in single player; in the ce-net version the world runs at about 1 year per real hour, so 1000 years is 6 weeks. |
| 4 | Why does Earth die without the player [L 15]? | The relief fleet, after the hive and the prisoners, goes to the source and reaches Earth near year 1000 (2.8). |
| 5 | When does the relief fleet arrive [L 13][L 15]? | 10 years after the hive's main base falls, and no later than year 400 of 1000. |
| 6 | Are the sentinels the prison's own guard in orbit, ignoring prisoners on the ground and attacking anything that launches or radiates (4.17)? | Yes. |
| 7 | Earth's distance and pace: 4.4 light years, convoys at 0.1 c arriving about every 22 years, so Earth reacts about 48 years late until you or they have faster-than-light links or warp (4.16)? | Yes; the name of the system stays a placeholder. |
| 8 | Remove the rifle and shotgun from the start in round 3, leaving only the ship laser and reactor [L 2]? Kinetic weapons return later as designs. | Yes. |
| 9 | Is Earth (and the allies' system) ever walked on, or only reached on the maps and in space battles? | Maps and space only; the last act is fleets and the choice. |
| 10 | Your message "we neda lot more co" was cut off [L 1 note]. What was the rest? And when your past writing is at hand, is the slot scheme in 5.6 the right shape for it? | Read as "a lot more components"; covered by 4.6 and 4.7. The slots in 5.6 stand until your writing shows otherwise. |

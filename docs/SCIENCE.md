# Science, data, survival, the rocket and remote presence (design, 2026-11-14)

Leif, verbatim:
> but also ar ocke isnt that hard with your matter compiler. its the most powerful tech in the whole game and in the story you smuggled it becasue yo ugot it from the black market. its how you escaped by manufacturing yoru tools for it. now it allows you to slowly but surely create the microprocessors nad gpus and cpius to do the orbital calculations and data to create your launchpad and rocket. it need sto be so much bigger in size the rocket. realistic size. unless we have better energy soiurce.s and with the reactor providing that much enregy a rocket is pretty easy. the hard part is the data nd what youre suppoed to do once you get to space. on the tech tree most of space tech is already unlocked and easy. but once you arrvie you need a supply network to sustain yourself, you need to eat and sleep and food so you need safety and ai system to guard you while youre at it. you dont need to be on site and can detach from your body to follow your sensors and steer only your robots and plans but youre limited by lightspeed with this and the delay is added on top. the otehr side of ht planet its almost 1/3 of as second. in sapce its much worse. so space should be pretty quick with the reactor and robot and drone start. later there will be many modes. one wher eyou start wiht no tech at all and have to find it in ruins. but this first mode is the easiest and you have the ship. you need to scan and invent the technology again using your ai sytem. and scanning takes data. lots of data. you need to craft ssds to store the terrapytes and petabytes of data and power those all is calculated.  all your data and sensors acrsos teh mesh needs todata and processors and bandwidth andstorage space too. everything is calculated and realistic and included in the upgrade system and handeld automaticaxlly by the ai system. once you arrive in space you have to have your own food and storage and toilet. you have to hav everything planned. this is a detailed simulation. oxygen is not included. sims. youn eed to take care of yoru character. scan things and find out what you can eat. farm it. optimize it using bioresearch by puttin more and more data into it. the more dta a. the more chips. the more power. the more snesors and the bigger your settlement is andthe more you haveconcurred the better your sciecne becomes. becasue of ai scaling lways. thebetter your sicence is the more you can do. and that is how the tech tree works and scales. in the beginning you dont even know what the planet looks like. you kniow nothing and pressing m only shows your tiny slice of the planet. once you can more and more you see more and more and eventualyl you ahe a long distance radar and calaculate stuff like planet radius and gravity and everything fully autonomoiusly using the ai and data but all ois in the tech treee and story ssytem and has text for it.

## 1. The matter compiler (lore and role)
- It is the most powerful tech you **start** with, not the most powerful in the game (Leif corrected this 2026-11-14: "its not at all the strongest tech in the game. its the strongest tech you start wiht."). Alien warp and gravity tech, hive biology and later human and alien tech go far beyond it. You bought it on the black market, smuggled it, and used it to make the tools you escaped with.
- It makes anything from raw matter, slowly. That includes microprocessors, CPUs and GPUs: the chips for orbital calculation and the data work behind the launch pad and rocket.
- Its limit is rate, not capability. Dedicated machines are fast and narrow (design doc rule), and the compiler is the bootstrap for every first part.

## 2. The rocket at realistic size; energy makes it easy, data makes it hard
- Space tech is mostly already known (it is in the tech tree from the start of this mode). The hard parts are the chips, the data and the plan for living in space.
- Rocket size is realistic for the planet's real gravity and radius: tens of tonnes of propellant for a small crewed or cargo vehicle, not a toy.
- **The reactor makes the propellant.**
  - Electrolysing water to LH2/LOX costs about 50 kWh per kg H2, roughly 7-9 kWh per kg of propellant including liquefaction.
  - 50 t of propellant is about 450 MWh, roughly 9-10 days of the 2 MW reactor.
  - That is realistic pacing: energy-limited but straightforward, as Leif says ("with the reactor providing that much energy a rocket is pretty easy").
- A better energy source (later tech) shrinks or changes the vehicle.
- **Planet scale must be realistic for this to hold**, see section 8.

## 3. Data is a physical resource
- Scanning produces data. Each scan type has a real data size:
  - a hyperspectral surface scan: about 1-10 GB per m² at mm resolution;
  - a seismic survey: TB per km²;
  - a full planetary survey: PB.
- Data needs:
  - **storage**: crafted SSDs, about 4-8 TB per drive at about 50 g and about 5 W active;
  - **compute** to turn it into knowledge: CPUs and GPUs, about 1 PFLOP-class per 700 W unit in late tech;
  - **bandwidth** to move it across the mesh: links have Mbit/s to Gbit/s by type and range;
  - **power** for all of it.
- Every sensor, camera and robot across the mesh streams data. That costs bandwidth and storage, and is processed by compute somewhere.
- The AI sizes, places and upgrades storage, compute and links automatically (part of the upgrade system). The player sees the budgets: TB stored and free, compute load, link use, power.

## 4. Science scales like AI (the tech tree engine)
- Research progress on a node = f(data about the subject, compute, power, sensors, settlement size, conquered area).
- It follows a scaling law with diminishing returns per input and growth when all of them grow together: roughly science rate ∝ (data × compute)^a, with a about 0.3-0.5.
- **The bigger and more instrumented your civilisation, the faster your science.** That is how the tech tree scales: "the better your science is the more you can do".
- Nodes need specific data (samples of this species, scans of that ruin), not just generic points.
- Every node has story text: what you found, what the AI concluded.

## 5. Knowledge of the world starts at zero
- At the start you know nothing about the planet.
  - M shows only the slice you have seen or scanned.
  - Planet radius, gravity, day length and atmosphere are unknown in the HUD ("g ≈ ?" until measured).
- Measurement is a progression:
  - pendulum or drop timing for g;
  - star and horizon sightings, then radar, then orbital survey, for the radius;
  - long-range radar and seismic for the interior.
- Each is a tech or story node with text. The AI computes the values autonomously once it has the data.
- The map fills in as sensors, drones and later satellites cover more.

## 6. Survival needs (The Sims-like)
- Needs: hunger, thirst, sleep, toilet, hygiene, safety and comfort. Each has real rates (e.g. about 2,500 kcal and 2-3 L of water per day).
- Oxygen IS a managed need (Leif corrected this 2026-11-14): the air has no free O2, so it is produced and managed. See SHIPS.md section 4.
- Food:
  - Scan plants and animals to find out what is edible. Scanning is needed because some things are toxic.
  - Farm them, and improve yield with bioresearch fed by data.
- Shelter and safety while you sleep: the AI and turrets guard the body, and a sleeping body in an unsafe place is a risk.
- Space is the real test:
  - you bring or grow your own food, storage and toilet;
  - a mission is planned like a supply chain: consumables × days × crew, plus margin;
  - the AI checks the plan before launch.

## 7. Remote presence with light delay
- You can detach from your body and follow any sensor, steer robots, and edit plans anywhere in the mesh.
- Your body stays where it is and needs guarding, plus food and sleep on its schedule.
- Control and vision are delayed by light-speed over the actual link path, plus processing.
  - The planet's far side by satellite relay: a geostationary hop alone is about 0.24 s; with routing about 1/3 s (Leif's number).
  - In space it is minutes.
- Delayed control shapes play: you set plans and let local AI act, rather than micro-steering far away.

## 8. Planet scale (decision needed, recommended)
- Round 4 chose a 642 m radius (4 km around) to keep a lap walkable. That makes orbit trivial (orbital speed √(gR) ≈ 75 m/s) and contradicts the realistic rocket and the 1/3 s far-side delay.
- **Recommended:** a realistic radius (e.g. about 4,000-6,000 km, set by the system definition).
  - Only the area around active sites exists in voxel detail, generated lazily from the same procedural functions, so it stays deterministic.
  - Far areas are heightfield and biome LOD, shown only where known (section 5).
  - The antipode hive is thousands of km away, reached by long-range logistics, balloons, aircraft and suborbital hops. That suits the scaled war Leif described and makes the far-side delay real.
  - The space act already runs 1:1.

## 9. Modes
- **This mode** is the easiest: you have the wreck, the compiler, the reactor and the drones.
- **A later mode** starts with no tech; you recover it from ruins.

## Placement
- **Round 6:**
  - data as a resource (scans cost storage, SSD items, budgets in the HUD);
  - knowledge from zero (the M map shows only the known slice; g and radius unknown until measured);
  - basic needs (food, water, sleep, toilet) with edible-by-scan;
  - oxygen production and management (SHIPS.md section 4).
- **Round 7:**
  - the science scaling law driving the tech tree with node story text;
  - chips from the compiler;
  - remote presence with light delay;
  - farming and bioresearch;
  - the realistic rocket with propellant production;
  - mission supply planning;
  - planet scale: Earth-size or slightly bigger (Leif decided; see SHIPS.md section 3).

# spacegame round 3: Leif's asks (verbatim, 2026-11-14), queued while round 2 builds

Kept outside the repo until round 2 lands, then moved to repo:spacegame/docs/ROUND3.md.

1. "its not a lot for fable 5.2. focus the most on the visuals and making it extremely detailed and lush and the forest must feel alivre with a procedural background and layers. its not just 1 layer its many. yes i agree wait for round 3. i will continue to add features i want. the underlying engine needs to use proper systems arhcitecture. radars and fog of war and much more powerful weapons. just 2 is not enough. we need a proper physics engine and splatting and ragdolling and cutout and heat being simulated in a very efficent way. sim teh movement could feel a lot more organic and biologically plausible for a human. i also want a mech suit and a system to upgrade and see what i have on me. currently i have 1 fake arm with one 3d amatter compiler whichc can make anything  out of the raw materials."

Earlier unanswered: "we neda lot more co" (cut off; ask Leif).

## Round 3 scope (from the words above)
- Visuals first: extremely detailed, lush; the forest alive (wind, creatures, particles); many procedural parallax background layers, not one.
- Engine: proper systems architecture (ECS or equivalent: components, systems, scheduling), ready for the cell split.
- A real physics engine: rigid bodies with constraints, ragdolls for creatures and people, gore/fluid splatting, cutting/cutout of bodies and terrain, heat simulated efficiently (grid diffusion on GPU or coarse field), affecting terrain, machines, weapons and creatures.
- Human movement that feels organic and biologically plausible (procedural animation driven by physics: balance, footsteps, inertia, reach, stumble).
- Radar and fog of war.
- Many more and far more powerful weapons than the current two.
- Mech suit (enter/exit, own physics, weapons, upgrades).
- Loadout/upgrade system with a body view of what you carry: one prosthetic arm with the matter compiler (the suit printer: makes anything from raw materials, slowly), slots for upgrades.

2. "we need more procedural animation. for waepons and upgrades and toolsa nd parts everything is procedural. the handheld weapons go on themech if i have an dapter which my ship ai can design for me. i have felet control over the weapons onboard on my ship and what pwers teh operation at first is the onboard reactor on the ship which i can take out and use to power my waepons. its ehavy and i have to carry it around but without it i dont haeve enough power. and the drill i have is the ship weapon system whi repurposed for a laser drill to melt ore down and to use as a weapon. no rifle or shotgun just one ehavy as ship weapon i have to carry around or im naked.  and i can also place it down and assign a computer to it which is done automatically the ship computer is the default and its all connected via network. it needs an antenna for network to work but its already in the bleuprint. everything is detailed like this. thought into everything. eveyrthing is assytem."

## Added scope (from 2)
- Procedural everything: weapons, tools, upgrades and parts are generated (geometry, animation, recoil, reload, deploy) from parameters, not hand-made sprites.
- Starting kit replaces rifle/shotgun: ONE heavy weapon, the crashed ship's weapon system repurposed as a handheld laser (melts ore, also the weapon). Without it you are unarmed.
- Power is physical: the ship's onboard reactor can be pulled out and carried (heavy: slows you, affects jump/jetpack) to power the laser; without it there is not enough power. Power flows through a network; devices draw real watts.
- Place-and-assign: the laser (and other devices) can be set down as a turret/station and assigned a computer; the ship computer (ship AI) is the default controller; everything talks over a network that needs an antenna (already in the starting blueprint), with range and line of sight.
- Fleet control: control the weapons on board your ship(s) from the network.
- Mech adapters: handheld weapons mount on the mech through an adapter the ship AI designs for you (a design step that produces a printable part).
- Design rule: every object is a system with ports (power, data/network, material, heat) and state; "thought into everything".

3. "continue thinking this lane. everything is a designable idem and allows me to do something. once my system starts producing one part which i need i dont want to worry about it. i dont want the bliueprints to slack with the complexity of the componetns and parts and machines. a rocket requires 1 million unique parts so i need to setup the network and supply chain toi  support that and produce this man ydifferent parts. this is mostly handled by ai and all machines are dynamic (if designed and the right tech tier) and produce basde on demaind like chinese factories. focus  we will build internstellar supply chains and networks betwene planets and starrs ain thusi game and everything is a system. we need autoamtic supply chians and roets and icredible depth in the complexity and absctraction each layer. once somethng is doen ocne the ai can replicate it and you have automated it. when you have pcreate your first starter factory the ai can copy it on demand and deploy it and expand it for you so that you can focus on only the frontier"

## Added scope (from 3): the production model
- Every item is designable: a design (parametric) that does something; designs compose into parts, parts into assemblies, assemblies into machines, ships, factories. A rocket can need ~1,000,000 unique parts.
- Blueprints scale with abstraction, not with part count: the player works one layer at a time; lower layers collapse into "solved" nodes once they produce reliably ("once my system starts producing one part which i need i dont want to worry about it").
- Demand-driven production: machines are general (within design and tech tier) and retool to what is demanded, like flexible Chinese contract factories; demand propagates down the bill of materials, AI schedules it.
- AI replication: anything done once (a factory, a line, a route) can be copied, deployed and expanded by the AI on demand ("once somethng is doen ocne the ai can replicate it and you have automated it"); the player's attention stays on the frontier.
- Automatic supply chains and routes: logistics planned by AI across sites, then planets, then stars; interstellar supply chains and networks are the endgame.
- Depth: incredible complexity at every layer, legible because each layer is an abstraction over the one below (part -> component -> machine -> line -> factory -> site -> planet -> system -> interstellar network).
- This is also the ce-net story: the game is a model of how ce-net runs real factories and supply chains (see PLAN.md section B).

4. "things actually drops and needs to be carried. or "dropped"just means state transition there is no abscratction in the visual you actually have to carry dirt waay. but this is auotomated by the ships robots"

## Added scope (from 4): material is physical
- Nothing vanishes into an inventory by magic: dug material becomes physical loose matter (dirt, rock, ore chunks) in the world, with mass and volume, that must be carried, hauled or moved.
- "Dropped" is a real state change of a real object (in hand -> on the ground -> in a container), visible on screen; no abstraction in the visual.
- The ship's robots automate the hauling (spoil removal, moving ore to processing, feeding machines); the player can carry by hand (slow, mass-limited, affects movement).
- Consequence for round 2's float inventory: inventory = what you physically carry (mass/volume limits), containers are physical objects, digging spawns loose material.

5. "everything isnt hostile.  unless its bigger then you and wants to eat you. its not kind eihter and its affraid of you and will do self defence."

## Added scope (from 5): creature behaviour is ecological, not hostile-by-default
- Creatures are not enemies by default. Each species has a size, diet and temperament.
- Predators larger than you that eat things your size hunt you. Everything else is wary: it keeps distance, flees, and fights back only in self-defence (cornered, attacked, protecting young or hive).
- Nothing is friendly either; fear of the player (and of noise, light, machines) drives most behaviour.
- The hivemind's waves (noise/pollution response, round 2 item 13) are the exception: a coordinated defence of the hive, still a reaction, not random aggression.

6. "so in the core of it is a demand and supply system. if you fire your shotgun and you have iron youre ai wants to keep a certain level of iron so it produces it using your printer and queues it. if you have special ammo production you might want to use that instead so it queues this and gets robots to carry things to it. the whole ennvironment is like this. and there is tons of sulfur and organic material to make bombs and weapons out of here."

## Added scope (from 6): the core loop is demand and supply
- Stock targets: the AI keeps target levels of what you use (ammo, iron, power cells...). Consuming below target creates demand automatically.
- The AI picks the best producer for each demand: the slow universal suit printer when nothing else exists, a specialised line (e.g. special ammo production) once built; it queues the job there and dispatches robots to carry the inputs and the outputs.
- The whole environment runs on this: every machine, robot, depot and route is a supplier or consumer in one demand/supply graph that the AI schedules.
- Resources on the starting planet: abundant sulfur and organic material, used for explosives, propellants and weapons (chemistry chains: sulfur + organics + nitrates -> explosives, etc.).

7. "adn to reach the best biological stuff you have to kill a hive nest which really stirs it up because it sits withthe best biological stuff. and you can also and should also repurpose alien tech like their instant faster then light communication and their floating ballons species  in the heavy atmosphere for your own machines and for your weather balloins and cehap early on logistics via balons to float it above the heavy vegetation in the sky. to do this you have to clear an area and set it up. give it an ai ssytem and it will go wherever it needs to go. and your ai sets up sites wherever its needed to aoptimize logistivcs. logistics is a hiuge part of this gamne. first its by hand, then robots, then bigger long range machines and specialized fast lines like conveyor belts, then spaceships and shuttles and railguns and pods. and everything is handled semi automatically"

## Added scope (from 7)
- Hive nests sit on the richest biological resources; taking one means killing the nest, which escalates the hivemind's response.
- Repurposing alien tech is a main progression path: the aliens' instant faster-than-light communication (your network's long-range backbone), and the floating balloon species of the heavy atmosphere (domesticated/adapted as lift for weather balloons, machines and cheap early logistics).
- Balloon logistics: float cargo above the dense vegetation; requires clearing an area and building a balloon site; give a balloon an AI system and it routes itself where it is needed.
- The AI places sites (depots, balloon stations, relays, lines) wherever needed to optimise logistics.
- Logistics is a huge part of the game, in tiers, each semi-automatic: by hand -> robots -> bigger long-range machines (balloons, crawlers) -> specialised fast lines (conveyor belts) -> spaceships, shuttles, railguns and pods.

8. "undergroand to have minders and automated excavation you need heavy machinery. this is semy given to you by your ship. you setup elevator shafts and clear out alients who dont like it and setup turrets and your ai also helps you setup turrets. the ai takes your design and scales it for you."

## Added scope (from 8): underground operations
- Automated underground mining and excavation need heavy machinery (diggers, borers, haulers), partly provided by the ship at the start.
- Elevator shafts connect the surface to underground workings (material and robot transport).
- Going underground disturbs aliens who resist; you clear them and secure the workings with turrets.
- The AI helps place turrets and, more generally, takes any design you make and scales it (more shafts, more turrets, more lines) on demand.

9. "Undergroand there is not just dumb aliens and hives. there is a nother alien species which is much more progressed hten humans who has been at ware with the hive for a long long time hiding undergroand and fighting with them. they have very advanced tech. and also dont like you. but your relaitionship with them is dynamic and trading might be the best option if you dont want to steal their warp technology and gravity technology."

## Added scope (from 9): the advanced underground species
- A second, intelligent alien civilisation far more advanced than humans, hiding underground and at war with the hive for a very long time.
- Very advanced tech: warp technology and gravity technology (also likely the source of the ruins' tech; to confirm with Leif).
- Starts unfriendly to you; the relationship is dynamic (reputation/standing changed by your actions: trading, helping against the hive, trespassing, stealing, killing).
- Two paths to their tech: trade (often best) or steal (raids on their facilities, with consequences).
- Three-way conflict underground: you, the hive, and them.

10. "so once the majority of hte hive knows about you youre fucked. even with very very advanced technology. which bascially sets the scene for this. the hiv doesnt udnerstand you or your capabiltiies but it wants to learn but is also very very distributed and disorganized. the more you fight it the more concentrated and chaotic it becomes. the  more it arms up and sends troops to where the most killing happens. even if its ambient at first as soon as it detects it scales up. and yo uhave to make sure to scale up with it. btu  it has so many outposts and a main base on the other side of the planet fofrom your location to beat it you have to bomb the shit out of the billions of alients on the otehr side of the planet or use a bio weapon or blow the whole planet up with a black hole. its up to oyu. the other alien species found that the best way of  staying alive was hiding away and living in silence or going up in orbit and to otehr planet in the solar system."

## Added scope (from 10): the hivemind as the main antagonist system
- Hive awareness is a planet-wide, distributed state: it starts ambient and ignorant of you; detection spreads; once most of the hive knows about you, you are in serious danger even with very advanced tech.
- It does not understand you or your capabilities but tries to learn (adapts to your weapons/tactics over time).
- Distributed and disorganised at first; the more you fight, the more concentrated and chaotic it becomes: it arms up and routes troops to where the most killing happens (a heat map of violence drives its logistics).
- Escalation is the pacing: you must scale your defences, production and logistics as fast as it scales.
- Geography: many outposts across the planet and a main base on the far side from your landing site; billions of aliens.
- Endgame choices (player's call): orbital/strategic bombing of the far side, a bio-weapon, or destroying the whole planet with a black hole.
- The advanced species' survival strategy: hiding and living in silence (noise discipline matters, ties to the noise model), or leaving for orbit and the other planets of the system. Silence is a valid play style for the player too.

11. "your pressence makes it very dangerous for the other species and sothey hate you the more you scale. butthe more leverage yo uahve to trade with them because they start fearing you."

## Added scope (from 11): standing with the advanced species has two axes
- Hostility and fear both rise as you scale: your noise and fighting draw the hive and endanger their silent hiding, so they hate you more.
- The bigger you get, the more they fear you, and fear is leverage: better trade terms, access to warp and gravity tech.
- Model it as two values (hostility, fear) rather than one reputation score; trade outcomes depend on both.

12. "spacegmae is a hobby project sand an example for ce-net. im fine with sharing my ideaas for everyone about htos. keep it pulbic." -> repo stays public; these notes move to repo:spacegame/docs/ROUND3.md when round 2 lands.

## Proposals from foreman/win-ceb3 (CONFIRMED by Leif 2026-11-14: "i like all of these ideas")
1. Hive awareness travels by carriers (scouts, pheromone trails): intercept, jam or decoy it.
2. Hive adapts to your dominant damage type; dissection reveals what it learned.
3. Acoustic signature per machine; mufflers, buried factories, dampening tech (traded) make noise a budget.
4. Ecological feedback: pollution kills forest near factories; predator removal causes grazer booms.
5. Lost bases persist as ruins with your logs, salvageable later.
6. Earth's company as a demand source: supply ships with research quotas and deadlines.
7. Survivors in lockdown facilities can be rescued and become operators; ship AI coordinates.
8. Black-hole ending needs the advanced species' gravity tech, tying endings to diplomacy.
9. Designs are ce-net cells tied to identity, shareable/licensable; AI replication = ce-net deploy.
10. Multiplayer: other prisoners share one hive; one loud player endangers all.
11. Planet-scale supply flow map (maps.ce-net.com style) as the zoomed-out main screen.

13. "i like all of these ideas. another thing: once you stir up the hive with your aggression and as soon as humanity set foot there and started the deadly feedback loop the more advanced species far undergroand instantly noticed and sent distress signals to their friends in anothe star system. they are heading to their rescue. and they will  collect their fleet and destroy the hive once and for all and collect their armies and destroy you because you killed so many of their friends activly to steal tech or passively. so once you beat the hive or if youre too slow  after some weeks or s months the more advanced species will come and you wull have to answer and trade or start war. so thats the fianl aending. having a fleet and interplanitery army that beats earth and this more advanced species because everyone wants to kill you becasue everyone fears you"

## Added scope (from 13): the campaign clock and the final ending
- Inciting event: when humanity landed and the hive feedback loop began, the advanced species sent a distress signal to allies in another star system. A relief fleet is on its way.
- Campaign clock: the relief fleet arrives either when you beat the hive, or after a fixed real span (weeks to months of play) if you are too slow. The clock is visible in some form (signal intercepts, ruins/terminal hints).
- Arrival: they destroy the hive for good, then turn on you, scaled by how many of their people you killed, actively (raids to steal tech) or passively (hive attacks your noise drew onto them). Ties to the hostility/fear values (item 11).
- Choice at arrival: answer them with trade or go to war.
- Final ending: build a fleet and an interplanetary army able to beat both Earth and the advanced species, because everyone fears you and so everyone wants you dead. Earth turns on you too (ties to proposal 6, the company's quotas).

14. "trade with earth is very slow and depends on how you act. if you give them the warp tech tehy can give yo uresults quickly.. in reality this game plays out over maybe 1000 years of in game time so thats plenty of supply rounds bck and forward to and from earth. you have a lotto sell and earth can certainly delvier you a lot of valuable things, but they will likely try to shut you down. sicne youre a prisoner after all who escaped. g"

## Added scope (from 14): Earth trade over ~1000 in-game years
- Timescale: a campaign spans roughly 1000 in-game years (time warp, automation and AI replication carry the long stretches; the relief-fleet clock in item 13 must be set on this scale).
- Earth trade is slow (sublight round trips, many supply rounds over the campaign) and depends on your conduct (standing with Earth as its own values).
- Giving Earth the warp tech speeds trade up dramatically (fast round trips), at a cost: Earth gets stronger.
- You have much to sell (alien tech, biology, research) and Earth can deliver valuable things (people, tech, rare goods).
- Earth's stance: you are an escaped prisoner, so it likely tries to shut you down while trading; trade and threat run in parallel.

15. "years in in g time. weeks in rael time. war pis a big part of this. this is a large scale advanced simulation where youre either a small piece or a big piece. humanity will die without you. all of earth wiped out if you dont play it and just let the simulation run. you have to beat humanity  to save humanity by escaping and fighting the sentinels and ships occassionally coming tokill you. and at the end you can choose i you want to save earth or not."

## Added scope (from 15): the world runs without you
- Clock answered: the relief fleet arrives after years of in-game time = weeks of real time.
- War is a big part of the game.
- A large-scale simulation that runs on its own: you are a small piece or a big piece depending on how you play. Left alone (no player action), the simulation ends with all of Earth wiped out (by the advanced species and/or the hive's spread).
- "Beat humanity to save humanity": escape Earth's control, fight the sentinels and the ships Earth occasionally sends to kill you, and become strong enough to change the outcome.
- Earth's enforcers: sentinels (automated hunters) and periodic kill-ships, a recurring threat over the campaign.
- Final choice: save Earth or not.

16. "ibvioustl this is a very big game with a huge story. i want to focsu as much as possible on the deep visuals and design ofthe gameplay before going all in on all of these mechanics. im sure it could one shot it but  before then i want a nice demo ifthe feeling and visuals to make it appealing."

## ROUND 3 FOCUS (overrides the scope lists above for round 3)
Round 3 is NOT the full mechanics build. It is:
A. A visual and feel demo (vertical slice, ~10 minutes of play) polished to film quality, built on round 2's engine:
   - the crash site at night inside a dense, alive, many-layered procedural forest (wind, drifting spores, small fauna, light shafts, fog depth layers, parallax background layers);
   - you carry the ship's reactor and the repurposed ship laser; carving the smooth terrain with the laser looks and sounds heavy (heat glow, molten edges, smoke, debris that is physically there);
   - organic, physically plausible body movement (weight, balance, the reactor's load);
   - one encounter with wary fauna and one with a predator; the first hive stirring at your noise;
   - printing your first machine slowly with the arm's matter compiler, then a robot carrying material.
B. A gameplay design document (Fable 5.2) covering everything in items 1-15 and the confirmed proposals: systems, loops, progression, story structure, as the plan for later rounds. Reviewed by Leif before any of it is built.
The other mechanics in this file wait for round 4+.

17. "I like the story. and i like this methaphor. it needs to be a lot deeper and ive done a lot of writing for this in the past. but i like your words. save it as ai generated" -> saved as THEMES-AI-GENERATED.md (labelled AI-generated; Leif's past writing takes precedence). Moves to repo:spacegame/docs/ with these notes.

18. "so what i mean is start right away after round2 is done with some of the things like visuals and the core mechancis and building it out even further and also design the next design doc. work in parallel."

## Run order (foreman/win-ceb3, 2026-11-14)
- Now: round 2 build (Fable 5.2, code) and DESIGN.md (Fable 5.2, notes only) run in parallel.
- The moment round 2 lands: verify (build, check, shots), commit + push (Pages redeploys), move these notes into repo:spacegame/docs/, then START ROUND 3 BUILD at once: the visual/feel vertical slice + the core mechanics that need no design decisions (physical material and carrying, carried reactor + ship laser, power network with antenna, demand/supply stock targets with the suit printer, robots hauling, wary/predator ecology, organic movement, layered living forest). Do not wait for DESIGN.md review for these.
- Mechanics that depend on DESIGN.md answers (diplomacy, Earth, campaign clock, endings, interstellar logistics) wait for Leif's review of DESIGN.md.

19. "yes go. same engine. same system and same repo. but yes. the visual demo is the actual look of the final game. the whole game will be this visually polished and procedurally beutiful."
-> The round 3 slice sets the visual standard for the whole game; every later system (space, factories, combat, UI) must reach the same polish. Same engine, same repo (repo:spacegame).

# spacegame round 4: Leif's asks (verbatim, 2026-11-14)

1. "its a its a whole planet. this is why i told you no grid becaue the camera msut rotate bsed on gravity.  the hive is on the other side of the planet. for round 4: everything must be as autoamted as possible. i can place things down and the system tries its best ot build it using all avaialble means. atuo queuing. priority on what helps us expand and what i built first. we automate as much as possible keeping taack of conveyor belts is not convenient. logistics is not that implesimpel in reality. the ai distributes all resoruces using all means. robots and sets up conveyors automatically if its good. for round 4 i want to refine gameplay and the autmomation loop as mucuh as possbile"

## Answers to DESIGN.md section 9
- Q2 (planet geometry): NOT a strip. The surface is a whole round planet: terrain lies on a circle (polar density field), gravity is radial toward the centre, and the camera rotates so "down" is always toward the planet centre. You can walk all the way around; the hive's main base is on the far side.
- Other questions: defaults stand unless Leif answers.

## Round 4 scope
A. Whole-planet geometry: polar/radial voxel field around the planet, radial gravity for every body (player, creatures, items, robots, rocket), camera rotation following local gravity, background layers and sky that rotate with it, horizon curvature visible when zoomed out, seamless zoom from body to whole planet (maps.ce-net.com style), far-side hive main base.
B. Automation-first gameplay (the focus):
 - Place anything (machine, structure, blueprint) and the system tries its best to build it with every available means (suit printer, machines, robots, hauling), automatically queued.
 - Priority: what helps expansion first, then the order the player placed things; visible and overridable.
 - The AI distributes all resources by all means (carry, robots, and conveyors it lays itself when a route is worth it); the player never has to manage belts by hand.
 - Logistics is realistic, not trivial: travel time, capacity, mass, power, terrain, threat all matter to the AI's choices; the player sees why (flows, bottlenecks, queues).
 - Refine the whole loop until it feels great: place -> watch it get built -> it starts producing -> demand flows -> expand.

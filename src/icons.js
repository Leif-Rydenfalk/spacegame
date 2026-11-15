// icons: one procedural set for every item, machine, tool, weapon and ship part. One style: machined silhouettes on
// nothing, a vertical falloff, a thin lit top edge and a shadowed bottom edge, film grain, and at most one emissive
// accent. Drawn once into 64 px canvases; the DOM uses them as data URLs and the HUD canvas draws them directly.
const SZ = 64, cache = new Map(), urls = new Map();
const ST = [58, 66, 74], DK = [22, 26, 30], LT = [128, 140, 150], HULL = [150, 162, 172], AMB = [255, 179, 71], CYA = [46, 242, 208], VIO = [138, 77, 255], ACID = [157, 255, 58], HOT = [255, 94, 58], XEN = [150, 200, 255], ROCK = [52, 60, 72], SOIL = [70, 52, 46], BRASS = [176, 128, 52], COP = [186, 104, 48], RED = [150, 44, 34];
const css = (c, k = 1, a = 1) => `rgba(${Math.min(255, c[0] * k) | 0},${Math.min(255, c[1] * k) | 0},${Math.min(255, c[2] * k) | 0},${a})`;
function B(g, d, col) {       // a solid body
  const p = new Path2D(d), gr = g.createLinearGradient(0, 8, 0, 58); gr.addColorStop(0, css(col, 1.3)); gr.addColorStop(1, css(col, 0.5)); g.fillStyle = gr; g.fill(p);
  g.save(); g.clip(p); g.lineWidth = 1.6; g.translate(0, 1.3); g.strokeStyle = 'rgba(255,255,255,.24)'; g.stroke(p); g.translate(0, -2.6); g.strokeStyle = 'rgba(0,0,0,.5)'; g.stroke(p); g.restore();
}
const Ln = (g, d, col, w = 1.5, a = 1) => { g.strokeStyle = css(col, 1, a); g.lineWidth = w; g.lineCap = 'round'; g.stroke(new Path2D(d)); };
function Gl(g, x, y, r, col, a = 0.9) { g.save(); g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, css(col, 1, a)); gr.addColorStop(0.35, css(col, 1, a * 0.35)); gr.addColorStop(1, css(col, 1, 0)); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); g.restore(); }
const Em = (g, d, col) => { g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = css(col); g.fill(new Path2D(d)); g.restore(); };
const dots = (g, pts, col, s = 3) => { g.fillStyle = css(col); for (let i = 0; i < pts.length; i += 2) g.fillRect(pts[i], pts[i + 1], s, s - 1); };
const RK = 'M12 46 L17 27 L29 16 L45 19 L53 34 L48 49 L27 53 Z', FL = [20, 32, 30, 24, 40, 30, 26, 42, 38, 40, 44, 24, 33, 34];
const rock = (g, col, fleck, f2) => { B(g, RK, col); Ln(g, 'M29 16 L33 31 L17 27 M33 31 L53 34 M33 31 L27 53', [0, 0, 0], 1, 0.3); if (fleck) dots(g, FL, fleck); if (f2) dots(g, [24, 28, 36, 44, 46, 36], f2); };
const round = (g, x) => { B(g, `M${x} 20 Q${x + 4} 10 ${x + 8} 20 V48 H${x} Z`, BRASS); B(g, `M${x - 1} 44 H${x + 9} V50 H${x - 1} Z`, [120, 86, 40]); };
const shell = (g, x) => { B(g, `M${x} 16 H${x + 12} V40 H${x} Z`, RED); B(g, `M${x - 1} 40 H${x + 13} V50 H${x - 1} Z`, BRASS); };
const D = {
  soil(g) { B(g, 'M8 50 Q18 28 30 30 Q44 22 56 50 Z', SOIL); dots(g, [20, 40, 30, 36, 40, 42, 46, 46, 26, 46], [110, 84, 70], 2); },
  basalt(g) { rock(g, ROCK); },
  'iron ore'(g) { rock(g, ROCK, [168, 83, 42]); },
  'copper ore'(g) { rock(g, ROCK, [63, 174, 132], [200, 110, 50]); },
  lumen(g) { B(g, 'M20 52 L25 26 L31 52 Z', [30, 90, 100]); B(g, 'M29 54 L37 12 L45 54 Z', [36, 120, 130]); B(g, 'M43 52 L48 30 L53 52 Z', [30, 90, 100]); Gl(g, 37, 34, 22, CYA, 0.55); Ln(g, 'M37 16 L37 50', CYA, 1, 0.8); },
  biomass(g) { B(g, 'M12 48 Q14 22 40 14 Q42 38 12 48 Z', [30, 78, 62]); B(g, 'M26 54 Q30 32 54 28 Q52 50 26 54 Z', [24, 62, 52]); Ln(g, 'M14 46 Q28 30 38 17 M28 52 Q40 40 51 30', [0, 0, 0], 1, 0.4); Gl(g, 34, 22, 7, CYA, 0.5); },
  fibre(g) { for (let i = 0; i < 4; i++) Ln(g, `M${12 + i * 3} ${44 - i * 4} Q32 ${10 + i * 6} ${52 - i * 3} ${44 - i * 5}`, [96 + i * 10, 108 + i * 8, 60], 3); Ln(g, 'M24 30 Q32 36 40 30', [40, 46, 30], 4); },
  resin(g) { B(g, 'M32 10 Q48 34 44 44 A12 12 0 1 1 20 44 Q16 34 32 10 Z', [150, 92, 20]); Gl(g, 30, 42, 12, AMB, 0.6); },
  chitin(g) { B(g, 'M10 38 Q32 6 54 38 L47 44 Q32 22 17 44 Z', [44, 40, 54]); B(g, 'M14 50 Q32 24 50 50 L44 54 Q32 38 20 54 Z', [34, 30, 44]); },
  ichor(g) { B(g, 'M24 12 H40 V18 H38 V46 A6 6 0 0 1 26 46 V18 H24 Z', [70, 80, 88]); Em(g, 'M28 30 H36 V45 A4 4 0 0 1 28 45 Z', [100, 220, 30]); Gl(g, 32, 40, 14, ACID, 0.45); },
  'xeno shard'(g) { B(g, 'M26 54 L21 30 L33 9 L43 28 L39 54 Z', [70, 76, 96]); Ln(g, 'M30 24 V40 M35 28 V46 M30 32 H35', XEN, 1.4, 0.95); Gl(g, 32, 34, 16, XEN, 0.4); },
  'xeno core'(g) { B(g, 'M32 8 L54 32 L32 56 L10 32 Z', [60, 66, 86]); Ln(g, 'M32 18 L46 32 L32 46 L18 32 Z', XEN, 1.4); Gl(g, 32, 32, 18, XEN, 0.8); },
  iron(g) { for (let i = 0; i < 3; i++) B(g, `M8 ${48 - i * 9} L22 ${40 - i * 9} H56 L42 ${48 - i * 9} Z M8 ${48 - i * 9} H42 V${53 - i * 9} H8 Z`, LT); },
  copper(g) { B(g, 'M14 46 L20 30 H44 L50 46 Z', COP); B(g, 'M20 30 L24 22 H40 L44 30 Z', [210, 128, 64]); },
  // round 7: the machine shop, its stock, electronics, wood, the fast belt and the planners
  'cnc mill'(g) { B(g, 'M8 40 H56 V54 H8 Z', ST); B(g, 'M12 12 H24 V40 H12 Z', LT); B(g, 'M12 10 H50 V17 H12 Z', ST); B(g, 'M34 17 H44 V30 H34 Z', DK); Ln(g, 'M39 30 V38', HULL, 2.5); Gl(g, 50, 46, 4, ACID, 0.9); },
  'metal printer'(g) { B(g, 'M10 10 H54 V54 H10 Z', LT); B(g, 'M18 18 H46 V40 H18 Z', DK); Em(g, 'M30 34 H34 V38 H30 Z', [255, 190, 90]); Gl(g, 32, 36, 9, AMB, 0.8); Ln(g, 'M32 18 V34', [255, 200, 120], 1, 0.7); B(g, 'M14 46 H50 V50 H14 Z', DK); },
  'polymer printer'(g) { Ln(g, 'M16 54 V10 H48 V54', LT, 3); B(g, 'M12 50 H52 V56 H12 Z', DK); B(g, 'M27 22 H37 V32 H27 Z', HULL); Ln(g, 'M32 32 V40', AMB, 2); B(g, 'M24 40 H40 V50 H24 Z', BRASS); Ln(g, 'M16 22 H48', ST, 2); },
  'solder bench'(g) { B(g, 'M6 34 H58 V39 H6 Z', LT); B(g, 'M10 39 H14 V56 H10 Z M50 39 H54 V56 H50 Z', ST); B(g, 'M16 28 H36 V34 H16 Z', [26, 96, 52]); Ln(g, 'M52 34 L42 14 L30 18', LT, 2); Gl(g, 30, 20, 7, [255, 240, 200], 0.9); Gl(g, 26, 29, 4, AMB, 0.9); },
  'metal powder'(g) { B(g, 'M10 52 Q22 24 32 26 Q44 22 54 52 Z', LT); dots(g, [20, 44, 28, 36, 36, 40, 44, 46, 30, 46, 40, 34], [190, 200, 210], 1.6); },
  polymer(g) { B(g, 'M10 52 Q22 26 32 28 Q44 24 54 52 Z', BRASS); dots(g, [20, 44, 28, 36, 36, 40, 44, 46, 30, 46, 40, 34], [230, 190, 110], 2.4); },
  swarf(g) { Ln(g, 'M12 48 Q18 30 26 44 Q32 54 38 38 Q44 24 52 44', LT, 3); Ln(g, 'M16 38 Q24 22 32 34 Q38 44 46 30', HULL, 2); Ln(g, 'M20 52 Q30 44 42 52', ST, 3); },
  log(g) { B(g, 'M8 24 H50 V44 H8 Z', [92, 62, 40]); B(g, 'M44 24 Q58 34 44 44 Z', [150, 108, 66]); Ln(g, 'M14 30 H40 M12 38 H36', [50, 32, 22], 1.5, 0.7); Ln(g, 'M50 34 m-3 0 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0', [92, 62, 40], 1.2); },
  'fast belt'(g) { B(g, 'M6 30 H58 V40 H6 Z', [120, 84, 30]); B(g, 'M10 40 H16 V50 H10 Z M48 40 H54 V50 H48 Z', ST); Em(g, 'M20 29 L28 35 L20 41 Z M32 29 L40 35 L32 41 Z M44 29 L52 35 L44 41 Z', AMB); },
  cpu(g) { B(g, 'M18 18 H46 V46 H18 Z', DK); B(g, 'M24 24 H40 V40 H24 Z', LT); Ln(g, 'M22 12 V18 M30 12 V18 M38 12 V18 M22 46 V52 M30 46 V52 M38 46 V52 M12 24 H18 M12 32 H18 M12 40 H18 M46 24 H52 M46 32 H52 M46 40 H52', BRASS, 2); Gl(g, 32, 32, 6, CYA, 0.7); },
  pcb(g) { B(g, 'M8 16 H56 V48 H8 Z', [26, 96, 52]); B(g, 'M16 24 H30 V36 H16 Z', DK); B(g, 'M38 22 H48 V28 H38 Z M38 34 H48 V42 H38 Z', ST); Ln(g, 'M30 30 H38 M23 36 V44 H44', BRASS, 1.5); Gl(g, 50, 44, 3, ACID, 0.9); },
  ssd(g) { B(g, 'M10 22 H54 V42 H10 Z', DK); B(g, 'M16 27 H28 V37 H16 Z M32 27 H44 V37 H32 Z', LT); Ln(g, 'M48 26 V38', BRASS, 3); Gl(g, 50, 24, 3, CYA, 0.9); },
  controller(g) { B(g, 'M12 18 H52 V48 H12 Z', ST); B(g, 'M18 24 H40 V36 H18 Z', DK); Em(g, 'M20 26 H38 V34 H20 Z', [30, 150, 130]); Gl(g, 46, 26, 3, AMB, 0.9); Gl(g, 46, 36, 3, ACID, 0.9); Ln(g, 'M20 42 H44', DK, 2); },
  blueprint(g) { B(g, 'M12 10 H52 V54 H12 Z', [24, 60, 110]); Ln(g, 'M18 20 H46 M18 30 H46 M18 40 H46 M24 14 V50 M34 14 V50 M44 14 V50', [110, 190, 255], 1, 0.5); Ln(g, 'M20 44 H32 V26 H44', [150, 220, 255], 2); },
  'blueprint book'(g) { B(g, 'M16 8 H54 V50 H16 Z', [18, 44, 84]); B(g, 'M10 14 H48 V56 H10 Z', [24, 60, 110]); Ln(g, 'M16 14 V56', [110, 190, 255], 2, 0.8); Ln(g, 'M22 24 H42 M22 34 H42 M22 44 H36', [150, 220, 255], 1.5, 0.7); },
  'deconstruction planner'(g) { B(g, 'M12 10 H52 V54 H12 Z', [110, 30, 24]); Ln(g, 'M20 20 L44 44 M44 20 L20 44', [255, 120, 100], 3); Ln(g, 'M16 14 H48 V50 H16 Z', [255, 120, 100], 1, 0.5); },
  'upgrade planner'(g) { B(g, 'M12 10 H52 V54 H12 Z', [26, 96, 52]); Ln(g, 'M32 46 V20 M22 30 L32 18 L42 30', [150, 255, 160], 3); Ln(g, 'M16 14 H48 V50 H16 Z', [150, 255, 160], 1, 0.5); },
  part(g) { B(g, 'M12 14 H52 V50 H12 Z', HULL); Ln(g, 'M12 26 H52 M12 38 H52 M25 14 V50 M39 14 V50', [0, 0, 0], 1, 0.35); Gl(g, 46, 20, 5, AMB, 0.9); },
  'rifle rounds'(g) { round(g, 14); round(g, 28); round(g, 42); },
  shells(g) { shell(g, 16); shell(g, 36); },
  'o2 cell'(g) { B(g, 'M22 18 Q22 12 32 12 Q42 12 42 18 V50 Q42 54 32 54 Q22 54 22 50 Z', LT); B(g, 'M28 6 H36 V12 H28 Z', ST); Em(g, 'M22 28 H42 V34 H22 Z', [60, 130, 170]); },
  'power cell'(g) { B(g, 'M18 16 H46 V52 H18 Z', ST); B(g, 'M24 10 H30 V16 H24 Z M34 10 H40 V16 H34 Z', LT); Em(g, 'M34 22 L26 36 H32 L29 47 L39 31 H33 Z', AMB); Gl(g, 32, 34, 14, AMB, 0.4); },
  'laser drill'(g) { B(g, 'M6 28 H34 V22 H44 V28 H50 V38 H44 V42 H30 L27 54 H18 L21 42 H6 Z', ST); B(g, 'M36 20 H38 V44 H36 Z M40 20 H42 V44 H40 Z', DK); B(g, 'M50 30 H56 V36 H50 Z', DK); Gl(g, 57, 33, 9, AMB, 1); Ln(g, 'M10 33 H30', AMB, 1.2, 0.6); },
  rifle(g) { B(g, 'M4 28 H42 V26 H60 V30 H42 V34 H34 L31 48 H24 L26 34 H16 L10 42 H4 Z', ST); B(g, 'M28 22 H40 V26 H28 Z', DK); },
  shotgun(g) { B(g, 'M4 27 H60 V32 H38 V36 H30 L26 48 H19 L22 36 H14 L8 42 H4 Z', ST); B(g, 'M36 33 H52 V38 H36 Z', [70, 50, 38]); },
  furnace(g) { B(g, 'M12 22 H52 V54 H12 Z', [70, 58, 56]); B(g, 'M38 8 H46 V22 H38 Z', [56, 48, 48]); B(g, 'M10 20 H54 V25 H10 Z', DK); Em(g, 'M20 36 H38 V48 H20 Z', [255, 110, 30]); Gl(g, 29, 42, 16, HOT, 0.7); },
  miner(g) { Ln(g, 'M12 54 L32 12 L52 54', LT, 4); B(g, 'M22 26 H42 V38 H22 Z', ST); B(g, 'M29 38 H35 V58 H29 Z', DK); Gl(g, 32, 12, 5, AMB, 1); },
  belt(g) { B(g, 'M6 30 H58 V40 H6 Z', DK); B(g, 'M10 40 H16 V50 H10 Z M48 40 H54 V50 H48 Z', ST); Ln(g, 'M16 35 H26 M30 35 H40', LT, 2); Em(g, 'M44 29 L52 35 L44 41 Z', AMB); },
  assembler(g) { B(g, 'M8 20 H56 V54 H8 Z', ST); B(g, 'M16 26 H48 V40 H16 Z', [10, 12, 15]); B(g, 'M6 16 H58 V21 H6 Z', DK); Ln(g, 'M32 26 V35', LT, 2); Gl(g, 32, 37, 8, [140, 220, 255], 0.9); },
  chest(g) { B(g, 'M10 24 H54 V52 H10 Z', ST); B(g, 'M8 18 H56 V26 H8 Z', DK); B(g, 'M16 24 H20 V52 H16 Z M44 24 H48 V52 H44 Z', DK); Gl(g, 32, 34, 5, AMB, 0.9); },
  platform(g) { B(g, 'M6 24 H58 V31 H6 Z', LT); B(g, 'M10 31 H54 V35 H10 Z', DK); B(g, 'M14 35 H18 V46 H14 Z M30 35 H34 V46 H30 Z M46 35 H50 V46 H46 Z', ST); Ln(g, 'M10 27 H54', HULL, 1, 0.6); },
  wall(g) { B(g, 'M14 14 H50 V50 H14 Z', ST); Ln(g, 'M14 32 H50 M32 14 V32 M24 32 V50 M40 32 V50', [0, 0, 0], 1.5, 0.45); },
  hub(g) { B(g, 'M8 44 H56 V56 H8 Z', ST); B(g, 'M14 16 H18 V44 H14 Z M46 16 H50 V44 H46 Z', LT); B(g, 'M12 12 H52 V16 H12 Z', DK); B(g, 'M24 26 H40 V32 H24 Z', HULL); Ln(g, 'M18 27 H24 M40 27 H46', LT, 2); Gl(g, 32, 40, 9, CYA, 0.8); },
  'bio-printer'(g) { B(g, 'M14 8 H50 V16 H14 Z M14 48 H50 V56 H14 Z', ST); B(g, 'M20 16 H44 V48 H20 Z', [14, 40, 42]); Gl(g, 32, 32, 18, CYA, 0.6); Em(g, 'M30 20 H34 V44 H30 Z', CYA); },
  pad(g) { B(g, 'M6 50 H58 V56 H6 Z', ST); Ln(g, 'M14 50 V8 M20 50 V8 M14 40 L20 32 M14 28 L20 20 M14 16 L20 8', LT, 1.5); B(g, 'M32 50 V22 Q38 6 44 22 V50 Z', HULL); Gl(g, 38, 28, 4, AMB, 0.9); },
  drone(g) { B(g, 'M22 28 H42 V38 H22 Z', HULL); Ln(g, 'M22 32 H10 M42 32 H54', LT, 2); Ln(g, 'M4 26 H16 M48 26 H60', [200, 220, 240], 1.5, 0.7); B(g, 'M28 38 H36 V44 H28 Z', DK); Gl(g, 12, 33, 4, [255, 60, 40], 0.9); Gl(g, 52, 33, 4, ACID, 0.9); Gl(g, 32, 44, 5, [255, 240, 200], 0.8); },
  wall(g) { B(g, 'M10 10 H54 V54 H10 Z', LT); Ln(g, 'M10 32 H54 M32 10 V54', [0, 0, 0], 1, 0.35); dots(g, [14, 14, 47, 14, 14, 48, 47, 48], DK, 3); },
  decon(g) { Ln(g, 'M14 14 L50 50 M50 14 L14 50', [255, 60, 44], 4); },
  clear(g) { g.setLineDash([5, 4]); Ln(g, 'M10 14 H54 V50 H10 Z', AMB, 2); g.setLineDash([]); Gl(g, 32, 32, 10, HOT, 0.8); },
  'ship:cockpit'(g) { B(g, 'M10 16 H38 L56 32 L38 48 H10 Z', HULL); Em(g, 'M36 24 L46 32 L36 40 Z', [80, 140, 170]); },
  'ship:hull'(g) { B(g, 'M10 10 H54 V54 H10 Z', HULL); Ln(g, 'M10 32 H54 M32 10 V54', [0, 0, 0], 1, 0.3); },
  'ship:tank'(g) { B(g, 'M10 20 Q10 12 20 12 H44 Q54 12 54 20 V44 Q54 52 44 52 H20 Q10 52 10 44 Z', LT); Ln(g, 'M22 12 V52 M42 12 V52', [0, 0, 0], 1.5, 0.35); Em(g, 'M28 28 H36 V36 H28 Z', AMB); },
  'ship:engine'(g) { B(g, 'M30 18 H52 V46 H30 Z', ST); B(g, 'M30 24 L12 14 V50 L30 40 Z', DK); Gl(g, 10, 32, 12, [140, 180, 255], 0.9); },
  'ship:ltr'(g) { B(g, 'M28 14 H54 V50 H28 Z', ST); B(g, 'M28 22 L8 8 V56 L28 42 Z', DK); Gl(g, 8, 32, 16, CYA, 0.9); Em(g, 'M36 28 H46 V36 H36 Z', CYA); },
  'ship:rcs'(g) { B(g, 'M22 22 H42 V42 H22 Z', ST); B(g, 'M28 12 H36 V22 H28 Z M28 42 H36 V52 H28 Z M12 28 H22 V36 H12 Z M42 28 H52 V36 H42 Z', DK); Gl(g, 32, 9, 5, [200, 220, 255], 0.8); },
  antenna(g) { Ln(g, 'M32 56 V12', ST, 3); Ln(g, 'M32 30 L18 56 M32 30 L46 56', DK, 1.5); Ln(g, 'M22 22 H42 M25 30 H39', LT, 2); B(g, 'M24 54 H40 V58 H24 Z', ST); Gl(g, 32, 11, 8, CYA, 0.9); },
  reactor(g) { B(g, 'M20 10 H44 V54 H20 Z', DK); B(g, 'M17 10 H47 V16 H17 Z M17 48 H47 V54 H17 Z', ST); Ln(g, 'M25 18 V46 M39 18 V46', [0, 0, 0], 2, 0.5); Gl(g, 32, 32, 13, CYA, 0.95); },
  'ship laser'(g) { B(g, 'M6 24 H26 V40 H6 Z', ST); B(g, 'M26 28 H56 V36 H26 Z', DK); Ln(g, 'M32 23 V41 M38 24 V40 M44 25 V39 M50 26 V38', LT, 2); B(g, 'M10 40 H16 V50 H10 Z', DK); Gl(g, 58, 32, 7, AMB, 0.95); },
  'ship:reactor'(g) { B(g, 'M10 10 H54 V54 H10 Z', ST); g.fillStyle = css(DK); g.beginPath(); g.arc(32, 32, 15, 0, 7); g.fill(); Gl(g, 32, 32, 16, CYA, 0.9); Ln(g, 'M32 17 V47 M17 32 H47', [0, 0, 0], 1.5, 0.5); },
  'ship:cargo'(g) { B(g, 'M10 12 H54 V52 H10 Z', ST); Ln(g, 'M10 25 H54 M10 39 H54 M24 12 V52 M40 12 V52', [0, 0, 0], 1.5, 0.4); },
  'ship:laser'(g) { B(g, 'M10 22 H36 V42 H10 Z', ST); B(g, 'M36 27 H48 V37 H36 Z', DK); Em(g, 'M48 31 H62 V33 H48 Z', CYA); Gl(g, 50, 32, 8, CYA, 0.9); },
  'ship:cannon'(g) { B(g, 'M10 20 H32 V44 H10 Z', ST); B(g, 'M32 28 H60 V36 H32 Z', DK); B(g, 'M54 26 H60 V38 H54 Z', ST); },
  'ship:dronebay'(g) { B(g, 'M10 12 H54 V52 H10 Z', ST); B(g, 'M16 18 H31 V46 H16 Z M33 18 H48 V46 H33 Z', DK); Gl(g, 32, 50, 4, AMB, 0.9); },
};
function make(id) {
  const c = document.createElement('canvas'); c.width = c.height = SZ; const g = c.getContext('2d'); g.lineJoin = 'round';
  (D[id] || D.part)(g);
  const im = g.getImageData(0, 0, SZ, SZ), d = im.data; let s = 1234567 + id.length * 7919;       // grain on the drawn pixels only
  for (let i = 0; i < d.length; i += 4) { s = (s * 1103515245 + 12345) & 0x7fffffff; if (d[i + 3] > 40) { const n = ((s >> 8) % 23) - 11; d[i] = Math.max(0, Math.min(255, d[i] + n)); d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n)); d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n)); } }
  g.putImageData(im, 0, 0); return c;
}
export const iconCanvas = id => { let c = cache.get(id); if (!c) { c = make(id); cache.set(id, c); } return c; };
export const iconUrl = id => { let u = urls.get(id); if (!u) { u = iconCanvas(id).toDataURL(); urls.set(id, u); } return u; };
export function drawIcon(ctx, id, x, y, s) { ctx.drawImage(iconCanvas(id), x, y, s, s); }
export const ICON_IDS = Object.keys(D);

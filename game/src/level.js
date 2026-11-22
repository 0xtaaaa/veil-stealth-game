// VEIL — the three levels of the Meridian Archive. Each map is a 40x20 grid
// of single characters:
//
//   #  wall — blocks movement and sight
//   .  floor
//   D  shadow floor — dark zone, detection fills far slower here
//   C  crate — solid; blocks sight only while the player crouches behind it
//   S  tall shelf — solid, always blocks sight
//   P  planter — solid, does not block sight
//   L  loot (floor underneath)
//   E  exit (floor underneath)
//   T  player start (floor underneath)
//   H  hack panel — hold E beside it to dim the lights
//
// Guard patrols are listed per level as tile waypoints; a guard walks the
// list and loops back to the start, pausing at each point.

import { COLS, ROWS } from './config.js';

const L1 = [
  '########################################',
  '#......DDD..H..........................#',
  '#.####.........####.........####.......#',
  '#.#............#............#..#.......#',
  '#.#..L.........#....CC......#..#...L...#',
  '#.#............#............#..#.......#',
  '#.####..C......####....S....####.......#',
  '#......................................#',
  '#.DDD.....#######.....#######.....DDD..#',
  '#.........#.....#.....#.....#..........#',
  '#..C......#..L..#.....#.....#....C.....#',
  '#.........#.....#.....#.....#..........#',
  '#.DDD.....#######.....#######.....DDD..#',
  '#......................................#',
  '#.####.........####.........####.......#',
  '#.#............#............#..#.......#',
  '#.#.....S......#.....PP.....#..#.......#',
  '#.#............#............#..#.......#',
  '#T....DDD..........................E...#',
  '########################################',
];

const L2 = [
  '########################################',
  '#..DDD....H......................DDD...#',
  '#.######....#######....#######....####.#',
  '#.#....#....#.....#....#.....#....#....#',
  '#.#.L..#....#.S...#....#.L...#....#....#',
  '#.#....#....#.....#....#.....#....#....#',
  '#.######....#######....#######....####.#',
  '#......................................#',
  '#..C......SS......CC......SS.......C...#',
  '#..DDD.........PP.....L....PP.....DDD..#',
  '#..C......SS......CC......SS.......C...#',
  '#......................................#',
  '#.######....#######....#######....####.#',
  '#.#....#....#.....#....#.....#....#....#',
  '#.#....#....#.L...#....#.S...#....#....#',
  '#.#....#....#.....#....#.....#....#....#',
  '#.######....#######....#######....####.#',
  '#..DDD...........................DDD..H#',
  '#T..................................E..#',
  '########################################',
];

const L3 = [
  '########################################',
  '#..DDD....H.......................DDD..#',
  '#......................................#',
  '#....PP........CC........PP.......PP...#',
  '#......................................#',
  '#..L......SS...........SS......L.......#',
  '#......................................#',
  '#....CC........PP........CC.......CC...#',
  '#......................................#',
  '#..DDD......CC......L.......CC....DDD..#',
  '#......................................#',
  '#....PP........CC........PP.......PP...#',
  '#......................................#',
  '#..L......SS...........SS......L.......#',
  '#......................................#',
  '#....CC........PP........CC.......CC...#',
  '#......................................#',
  '#..DDD...........................DDD..H#',
  '#T..................................E..#',
  '########################################',
];

export const LEVELS = [
  {
    name: 'Gallery',
    sub: 'The Meridian Archive — ground floor. Two guards, three relics.',
    map: L1,
    vision: 200,
    patrolSpeed: 58,
    chaseSpeed: 132,
    guards: [
      { name: 'Marlow', waypoints: [[5, 7], [34, 7]] },
      { name: 'Ilsa', waypoints: [[33, 3], [33, 16]] },
    ],
  },
  {
    name: 'Vault',
    sub: 'The vault floor. Three guards, four relics, tighter halls.',
    map: L2,
    vision: 210,
    patrolSpeed: 62,
    chaseSpeed: 138,
    guards: [
      { name: 'Marlow', waypoints: [[6, 7], [33, 7]] },
      { name: 'Ilsa', waypoints: [[20, 2], [20, 17]] },
      { name: 'Bram', waypoints: [[6, 11], [33, 11]] },
    ],
  },
  {
    name: 'Rooftop',
    sub: 'The rooftop terrace. Four guards, five relics, nowhere to hide.',
    map: L3,
    vision: 230,
    patrolSpeed: 66,
    chaseSpeed: 146,
    guards: [
      { name: 'Marlow', waypoints: [[4, 2], [35, 2]] },
      { name: 'Ilsa', waypoints: [[4, 10], [35, 10]] },
      { name: 'Bram', waypoints: [[8, 4], [8, 16]] },
      { name: 'Sable', waypoints: [[32, 4], [32, 16]] },
    ],
  },
];

// Turn a level definition into the live data the game uses. The map letters
// L, E, T and H become floor tiles plus a record of where they sit.
export function parseLevel(def) {
  if (def.map.length !== ROWS) throw new Error(`level ${def.name}: ${def.map.length} rows, need ${ROWS}`);
  const grid = [];
  const loot = [];
  const panels = [];
  let exit = null;
  let start = null;
  for (let y = 0; y < ROWS; y++) {
    const row = def.map[y];
    if (row.length !== COLS) throw new Error(`level ${def.name} row ${y}: ${row.length} cells, need ${COLS}`);
    const cells = [];
    for (let x = 0; x < COLS; x++) {
      const ch = row[x];
      cells.push(ch);
      if (ch === 'L') loot.push({ cx: x, cy: y, taken: false });
      else if (ch === 'E') exit = { cx: x, cy: y };
      else if (ch === 'T') start = { cx: x, cy: y };
      else if (ch === 'H') panels.push({ cx: x, cy: y, hacked: false });
    }
    grid.push(cells);
  }
  if (!exit || !start) throw new Error(`level ${def.name}: missing exit or start`);
  return { def, grid, loot, panels, exit, start };
}

export function tileAt(level, cx, cy) {
  if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return '#';
  return level.grid[cy][cx];
}

// Solid for movement: walls, crates, shelves, planters.
export function isSolid(level, cx, cy) {
  const t = tileAt(level, cx, cy);
  return t === '#' || t === 'C' || t === 'S' || t === 'P';
}

// Solid for sight. A crate only hides a crouched player; a standing player
// can be seen over it. Walls and tall shelves always block sight.
export function blocksSight(level, cx, cy, playerCrouched) {
  const t = tileAt(level, cx, cy);
  if (t === '#' || t === 'S') return true;
  if (t === 'C' && playerCrouched) return true;
  return false;
}

export function isShadow(level, cx, cy) {
  return tileAt(level, cx, cy) === 'D';
}

export function tileCenterX(cx) {
  return cx * 32 + 16;
}

export function tileCenterY(cy) {
  return cy * 32 + 16;
}

// Line of sight between two pixel points, sampled in small steps. Any
// blocking cell on the way means the view is cut.
export function hasLineOfSight(level, x0, y0, x1, y1, playerCrouched) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 6));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const cx = Math.floor((x0 + dx * t) / 32);
    const cy = Math.floor((y0 + dy * t) / 32);
    if (blocksSight(level, cx, cy, playerCrouched)) return false;
  }
  return true;
}

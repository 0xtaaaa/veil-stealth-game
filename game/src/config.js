// VEIL — The Meridian Archive. Every tuning number lives here, in one place,
// so the feel of the game can be balanced without hunting through the code.

export const TILE = 32;            // one map cell, in pixels
export const COLS = 40;            // map width in cells
export const ROWS = 20;            // map height in cells
export const HUD_H = 80;           // top bar height, in pixels
export const W = COLS * TILE;      // 1280 — canvas width
export const H = HUD_H + ROWS * TILE; // 720 — canvas height

// Vision cones: a guard sees inside a 90 degree wedge.
export const CONE_HALF = Math.PI / 4; // 45 degrees to each side of facing
export const CONE_RAYS = 26;          // rays used to clip the cone against walls

// The player.
export const PLAYER = {
  radius: 11,
  walk: 145,      // px per second
  run: 235,       // fast, but loud
  crouch: 78,     // slow, quiet, hard to spot
  runNoise: 135,  // guards inside this radius hear running
  walkNoise: 0,   // walking is silent
  crouchNoise: 0,
  coinRange: 300, // how far a thrown coin can land
  coinCount: 3,   // coins per level
  coinRadius: 200, // guards inside this radius investigate the clink
  interactRange: 46,
  hackTime: 1.5,  // seconds of holding E beside a panel
};

// Guards.
export const GUARD = {
  radius: 12,
  patrol: 58,     // px per second on patrol
  investigate: 92,
  chase: 132,
  search: 80,
  returnSpeed: 75,
  waitAtPoint: 1.4,   // seconds paused at each waypoint
  lookAround: 2.2,    // seconds scanning after reaching an investigate point
  searchTime: 6.0,    // seconds searching before giving up
  loseSight: 2.5,     // seconds unseen in alert before dropping to search
  catchRange: 22,     // touching the player while alert = busted
  hearRadius: 190,    // base hearing radius for a coin clink
};

// Detection meter (0..1). Fills while a guard can see the player.
export const DETECT = {
  base: 1.15,        // per second, point blank, standing, lit
  crouch: 0.45,      // crouching is much harder to spot
  running: 1.6,      // sprinting in the open is asking for it
  shadow: 0.22,      // dark zones hide you
  decay: 0.45,       // per second while unseen
  suspicious: 0.35,  // meter at which a guard comes to look
  hackedRange: 0.7,  // vision range multiplier while the lights are dimmed
};

// Alarm: one pip per fresh alert episode, decays while all is calm.
export const ALARM = {
  maxPips: 3,
  decaySeconds: 22,  // seconds of calm to drop one pip
};

export const STRIKES_PER_LEVEL = 3;

// Scoring.
export const SCORE = {
  loot: 100,
  ghostBonus: 500,   // finish a level without ever being fully spotted
  timeBonusPerSecond: 5,
  timeBonusCap: 600, // seconds; faster finishes score more
};

export const BEST_KEY = 'veil-best-v1';

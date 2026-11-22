// VEIL — the screenshot scenes behind ?shot=start|play|chase|mission. Each
// one stages a real game state with fixed positions (no randomness), then
// freezes it: the loop paints the frame twice and sets window.__shotReady,
// so a screenshot is always the same picture of the same game.
//
//   start   — the cover: Wren crouched behind a crate in shadow, a guard's
//             cone sweeping just past, the exit door visible
//   play    — patrol-learning: two guards on different routes, loot and
//             cover in frame, the player waiting in a dark zone
//   chase   — a near miss: a red cone, the meter nearly full, a guard closing in
//   mission — the Rooftop level, every relic taken, Wren at the open exit

import { STATE_ALERT, STATE_PATROL } from './guards.js';
import { tileCenterX, tileCenterY } from './level.js';

function placeGuard(game, index, cx, cy, facing) {
  const guard = game.guards[index];
  guard.x = tileCenterX(cx);
  guard.y = tileCenterY(cy);
  guard.facing = facing;
  guard.state = STATE_PATROL;
  guard.meter = 0;
  guard.waitTimer = 0;
  return guard;
}

function placePlayer(game, cx, cy, facing, crouched) {
  const p = game.player;
  p.x = tileCenterX(cx);
  p.y = tileCenterY(cy);
  p.facing = facing;
  p.crouched = crouched;
  p.running = false;
  p.moving = false;
  return p;
}

export function stageShot(name, game) {
  game.time = 0;
  game.coinMarks = [];
  if (name === 'mission') {
    game.loadLevel(2);
    for (const item of game.level.loot) item.taken = true;
    game.score = 2450;
    game.levelTime = 187;
    placePlayer(game, 35, 18, 0, false);
    placeGuard(game, 0, 20, 2, Math.PI / 2);
    placeGuard(game, 1, 12, 10, 0);
    placeGuard(game, 2, 8, 8, Math.PI / 4);
    placeGuard(game, 3, 32, 8, -Math.PI / 2);
    game.alarm = 0;
    return 'play';
  }

  if (name === 'chase') {
    game.loadLevel(0);
    game.score = 320;
    game.levelTime = 64;
    game.strikes = 3;
    placePlayer(game, 20, 12, Math.PI, false);
    const guard = placeGuard(game, 0, 17, 12, 0);
    guard.state = STATE_ALERT;
    guard.meter = 0.85;
    guard.lastSeen = { x: game.player.x, y: game.player.y };
    placeGuard(game, 1, 33, 6, Math.PI / 2);
    game.alarm = 1;
    game.ghost = false;
    return 'play';
  }

  if (name === 'play') {
    game.loadLevel(0);
    game.score = 210;
    game.levelTime = 41;
    game.strikes = 3;
    game.level.loot[0].taken = true;
    game.player.coins = 2;
    placePlayer(game, 8, 1, Math.PI / 2, true);
    placeGuard(game, 0, 14, 7, 0);
    placeGuard(game, 1, 30, 10, -Math.PI / 2);
    game.alarm = 0;
    return 'play';
  }

  // start — the cover.
  game.loadLevel(0);
  game.score = 0;
  game.levelTime = 12;
  game.strikes = 3;
  placePlayer(game, 4, 10, 0, true);
  const guard = placeGuard(game, 0, 10, 7, 2.6);
  guard.meter = 0.15;
  placeGuard(game, 1, 33, 12, Math.PI / 2);
  game.alarm = 0;
  return 'play';
}

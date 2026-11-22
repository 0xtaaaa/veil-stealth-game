// VEIL — the player: Wren, thief of the Meridian Archive. WASD or arrows to
// move, Shift to run (fast but loud), C or Control to crouch (slow, quiet,
// harder to spot), E to hold beside a hack panel, click or Q to throw a coin
// that clinks where it lands and pulls a guard over to look.

import { PLAYER, TILE } from './config.js';
import { isShadow, isSolid, tileCenterX, tileCenterY } from './level.js';

export class Player {
  constructor(start) {
    this.x = tileCenterX(start.cx);
    this.y = tileCenterY(start.cy);
    this.facing = -Math.PI / 2; // facing up, into the gallery
    this.crouched = false;
    this.running = false;
    this.moving = false;
    this.coins = PLAYER.coinCount;
    this.coinFlight = null; // {x0,y0,x1,y1,t} while a coin is in the air
    this.hackProgress = 0;
    this.stepTimer = 0;
    this.inShadow = false;
  }

  reset(start) {
    this.x = tileCenterX(start.cx);
    this.y = tileCenterY(start.cy);
    this.facing = -Math.PI / 2;
    this.crouched = false;
    this.running = false;
    this.moving = false;
    this.coins = PLAYER.coinCount;
    this.coinFlight = null;
    this.hackProgress = 0;
  }

  // Axis-separated movement so the player slides along walls instead of
  // sticking on corners.
  moveAxis(level, dx, dy) {
    const r = PLAYER.radius;
    const nx = this.x + dx;
    if (!this.hitsSolid(level, nx, this.y, r)) this.x = nx;
    const ny = this.y + dy;
    if (!this.hitsSolid(level, this.x, ny, r)) this.y = ny;
  }

  hitsSolid(level, x, y, r) {
    const minCx = Math.floor((x - r) / TILE);
    const maxCx = Math.floor((x + r) / TILE);
    const minCy = Math.floor((y - r) / TILE);
    const maxCy = Math.floor((y + r) / TILE);
    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        if (isSolid(level, cx, cy)) return true;
      }
    }
    return false;
  }

  update(dt, input, level, game) {
    const dir = input.moveVector();
    this.crouched = input.isDown('crouch');
    this.running = input.isDown('run') && !this.crouched && (dir.x !== 0 || dir.y !== 0);
    this.moving = dir.x !== 0 || dir.y !== 0;

    const speed = this.crouched ? PLAYER.crouch : this.running ? PLAYER.run : PLAYER.walk;
    if (this.moving) {
      const len = Math.hypot(dir.x, dir.y);
      const vx = (dir.x / len) * speed * dt;
      const vy = (dir.y / len) * speed * dt;
      this.moveAxis(level, vx, vy);
      this.facing = Math.atan2(dir.y, dir.x);
      // Running feet are loud enough for nearby guards to hear.
      if (this.running) game.noise(this.x, this.y, PLAYER.runNoise, 'run');
      // Soft footstep ticks for the player, quieter while crouched.
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        game.audio.playerStep(this.crouched);
        this.stepTimer = this.crouched ? 0.55 : 0.38;
      }
    }

    const pcx = Math.floor(this.x / TILE);
    const pcy = Math.floor(this.y / TILE);
    this.inShadow = isShadow(level, pcx, pcy);

    // Loot is picked up by walking over it.
    for (const item of level.loot) {
      if (item.taken) continue;
      const lx = tileCenterX(item.cx);
      const ly = tileCenterY(item.cy);
      if (Math.hypot(lx - this.x, ly - this.y) < 26) {
        item.taken = true;
        game.onLoot(item);
      }
    }

    // Hack panels: hold E beside one to dim the lights for a while.
    const panel = this.nearPanel(level);
    if (panel && !panel.hacked && input.isDown('interact')) {
      this.hackProgress += dt;
      if (this.hackProgress >= PLAYER.hackTime) {
        panel.hacked = true;
        this.hackProgress = 0;
        game.onHack(panel);
      }
    } else {
      this.hackProgress = 0;
    }

    // Coin throw: click (or Q) tosses a coin toward the cursor. It arcs
    // briefly, then clinks where it lands and every guard in earshot comes
    // to look at that spot instead of at you.
    if (input.consumeCoinThrow() && this.coins > 0 && !this.coinFlight) {
      const target = input.coinTarget || { x: this.x + 100, y: this.y };
      const dx = target.x - this.x;
      const dy = target.y - this.y;
      const d = Math.hypot(dx, dy);
      const range = Math.min(d, PLAYER.coinRange);
      this.coins -= 1;
      this.coinFlight = {
        x0: this.x,
        y0: this.y,
        x1: this.x + (dx / (d || 1)) * range,
        y1: this.y + (dy / (d || 1)) * range,
        t: 0,
      };
      game.audio.coinThrow();
    }
    if (this.coinFlight) {
      const c = this.coinFlight;
      c.t += dt / 0.28;
      if (c.t >= 1) {
        game.noise(c.x1, c.y1, PLAYER.coinRadius, 'coin');
        game.audio.coinClink();
        game.addCoinMark(c.x1, c.y1);
        this.coinFlight = null;
      }
    }
  }

  nearPanel(level) {
    for (const panel of level.panels) {
      const px = tileCenterX(panel.cx);
      const py = tileCenterY(panel.cy);
      if (Math.hypot(px - this.x, py - this.y) < PLAYER.interactRange + 14) return panel;
    }
    return null;
  }

  coinPosition() {
    const c = this.coinFlight;
    if (!c) return null;
    const t = Math.min(1, c.t);
    return {
      x: c.x0 + (c.x1 - c.x0) * t,
      y: c.y0 + (c.y1 - c.y0) * t - Math.sin(t * Math.PI) * 26,
    };
  }
}

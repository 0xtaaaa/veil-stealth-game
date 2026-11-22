// VEIL — guard AI. A guard walks a patrol route, watches a vision cone,
// and moves through five states:
//
//   patrol     — walk the waypoints, pause at each one
//   suspicious — a glimpse, a footstep or a coin: walk over and look around
//   alert      — the player is clearly seen: chase, and the alarm rises
//   search     — the player slipped away: check nearby spots, then give up
//   return     — walk back to the nearest waypoint and resume patrol
//
// The detection meter is per guard. It fills while the player is inside the
// cone with a clear line of sight, faster up close, slower when the player
// crouches or hides in shadow. At 0.35 the guard gets suspicious; at 1.0 it
// goes alert. The meter decays while the player is unseen.

import { CONE_HALF, CONE_RAYS, DETECT, GUARD, TILE } from './config.js';
import { hasLineOfSight, isShadow, tileAt, tileCenterX, tileCenterY } from './level.js';

export const STATE_PATROL = 'patrol';
export const STATE_SUSPICIOUS = 'suspicious';
export const STATE_ALERT = 'alert';
export const STATE_SEARCH = 'search';
export const STATE_RETURN = 'return';

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function moveToward(guard, tx, ty, speed, dt) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const d = Math.hypot(dx, dy);
  if (d < 2) return true;
  const step = Math.min(d, speed * dt);
  guard.x += (dx / d) * step;
  guard.y += (dy / d) * step;
  guard.facing = Math.atan2(dy, dx);
  return d - step < 2;
}

export class Guard {
  constructor(def, level, index) {
    this.name = def.name;
    this.level = level;
    this.index = index;
    this.waypoints = def.waypoints.map(([cx, cy]) => ({
      x: tileCenterX(cx),
      y: tileCenterY(cy),
    }));
    this.wpIndex = index % this.waypoints.length;
    const start = this.waypoints[this.wpIndex];
    this.x = start.x;
    this.y = start.y;
    this.facing = 0;
    this.state = STATE_PATROL;
    this.meter = 0;          // 0..1 detection of the player
    this.waitTimer = 0;
    this.lookTimer = 0;
    this.searchTimer = 0;
    this.unseenTimer = 0;
    this.target = null;      // {x, y} being investigated or chased
    this.lastSeen = null;    // last spot the player was clearly seen
    this.searchPoints = [];
    this.searchIndex = 0;
    this.alertRaised = false; // true while this alert episode already piped the alarm
    this.speed = level.def.patrolSpeed;
    this.chaseSpeed = level.def.chaseSpeed;
    this.vision = level.def.vision;
    this.stepTimer = 0;      // footstep sound timing
  }

  // Can this guard see the player right now?
  canSee(player, game) {
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);
    const range = this.vision * (game.lightsDim > 0 ? DETECT.hackedRange : 1);
    if (dist > range) return { seen: false, dist };
    const toPlayer = Math.atan2(dy, dx);
    if (Math.abs(angleDiff(toPlayer, this.facing)) > CONE_HALF) return { seen: false, dist };
    if (!hasLineOfSight(this.level, this.x, this.y, player.x, player.y, player.crouched)) {
      return { seen: false, dist };
    }
    return { seen: true, dist, range };
  }

  // A noise at (x, y): running feet, a thrown coin. Guards nearby turn to
  // look. Louder noises carry further; a coin is louder than feet.
  hear(x, y, radius) {
    if (this.state === STATE_ALERT) return;
    const d = Math.hypot(x - this.x, y - this.y);
    if (d > radius) return;
    this.target = { x, y };
    this.meter = Math.max(this.meter, DETECT.suspicious);
    this.enterSuspicious();
  }

  enterSuspicious() {
    if (this.state === STATE_ALERT) return;
    this.state = STATE_SUSPICIOUS;
    this.lookTimer = 0;
    this.waitTimer = 0;
  }

  enterAlert(game) {
    if (this.state === STATE_ALERT) return;
    this.state = STATE_ALERT;
    this.unseenTimer = 0;
    if (!this.alertRaised) {
      this.alertRaised = true;
      game.raiseAlarm();
    }
    game.onSpotted(); // kills the ghost bonus for this level
    game.audio.alertSting();
  }

  update(dt, player, game) {
    const seen = this.canSee(player, game);

    // --- detection meter ---
    if (seen.seen) {
      const closeness = 1 - (seen.dist / seen.range) * 0.7;
      let rate = DETECT.base * closeness;
      if (player.crouched) rate *= DETECT.crouch;
      if (player.running) rate *= DETECT.running;
      const pcx = Math.floor(player.x / TILE);
      const pcy = Math.floor(player.y / TILE);
      if (isShadow(this.level, pcx, pcy)) rate *= DETECT.shadow;
      this.meter = Math.min(1, this.meter + rate * dt);
      this.lastSeen = { x: player.x, y: player.y };
      this.unseenTimer = 0;
    } else {
      this.meter = Math.max(0, this.meter - DETECT.decay * dt);
      if (this.state === STATE_ALERT) this.unseenTimer += dt;
    }

    if (this.meter >= 1 && this.state !== STATE_ALERT) this.enterAlert(game);
    else if (this.meter >= DETECT.suspicious && this.state === STATE_PATROL) {
      this.target = this.lastSeen ? { ...this.lastSeen } : { x: player.x, y: player.y };
      this.enterSuspicious();
    }

    // --- movement by state ---
    switch (this.state) {
      case STATE_PATROL: {
        if (this.waitTimer > 0) {
          this.waitTimer -= dt;
          // Idle guards slowly scan the room instead of staring at a wall.
          this.facing += Math.sin(game.time * 0.9 + this.index * 2.1) * 0.35 * dt;
          break;
        }
        const wp = this.waypoints[this.wpIndex];
        if (moveToward(this, wp.x, wp.y, this.speed, dt)) {
          this.waitTimer = GUARD.waitAtPoint;
          this.wpIndex = (this.wpIndex + 1) % this.waypoints.length;
        }
        break;
      }
      case STATE_SUSPICIOUS: {
        if (!this.target) { this.state = STATE_RETURN; break; }
        if (moveToward(this, this.target.x, this.target.y, GUARD.investigate, dt)) {
          this.lookTimer += dt;
          this.facing += Math.sin(game.time * 2.4) * 1.4 * dt;
          if (this.lookTimer > GUARD.lookAround) {
            if (this.meter < DETECT.suspicious) this.state = STATE_RETURN;
            else this.lookTimer = 0; // keep looking while still uneasy
          }
        }
        break;
      }
      case STATE_ALERT: {
        if (seen.seen) {
          this.target = { x: player.x, y: player.y };
          moveToward(this, player.x, player.y, this.chaseSpeed, dt);
        } else if (this.unseenTimer > GUARD.loseSight) {
          this.state = STATE_SEARCH;
          this.searchTimer = 0;
          const base = this.lastSeen || { x: this.x, y: this.y };
          this.searchPoints = [
            { x: base.x + 70, y: base.y - 40 },
            { x: base.x - 60, y: base.y + 50 },
            { x: base.x + 10, y: base.y + 80 },
          ];
          this.searchIndex = 0;
          this.alertRaised = false;
        } else if (this.lastSeen) {
          moveToward(this, this.lastSeen.x, this.lastSeen.y, this.chaseSpeed, dt);
        }
        break;
      }
      case STATE_SEARCH: {
        this.searchTimer += dt;
        if (this.searchTimer > GUARD.searchTime) { this.state = STATE_RETURN; break; }
        const point = this.searchPoints[this.searchIndex];
        if (point && moveToward(this, point.x, point.y, GUARD.search, dt)) {
          this.searchIndex += 1;
          this.lookTimer = 0;
        }
        break;
      }
      case STATE_RETURN: {
        let best = this.waypoints[0];
        let bestD = Infinity;
        for (const wp of this.waypoints) {
          const d = Math.hypot(wp.x - this.x, wp.y - this.y);
          if (d < bestD) { bestD = d; best = wp; }
        }
        if (moveToward(this, best.x, best.y, GUARD.returnSpeed, dt)) {
          this.wpIndex = this.waypoints.indexOf(best);
          this.state = STATE_PATROL;
          this.waitTimer = 0.5;
        }
        break;
      }
      default:
        break;
    }

    // Footsteps: the player hears a guard by distance, so a nearby patrol
    // is a warning before the cone ever touches them.
    this.stepTimer -= dt;
    if (this.stepTimer <= 0) {
      const moving = this.state !== STATE_PATROL || this.waitTimer <= 0;
      if (moving) {
        const d = Math.hypot(player.x - this.x, player.y - this.y);
        if (d < 420) game.audio.guardStep(d);
        this.stepTimer = this.state === STATE_ALERT ? 0.28 : 0.52;
      } else {
        this.stepTimer = 0.3;
      }
    }
  }

  // The vision cone as a polygon, clipped by walls: cast a fan of rays and
  // stop each one at the first cell that blocks sight. This is what makes
  // the cones react to cover instead of painting over it.
  conePolygon(game) {
    const range = this.vision * (game.lightsDim > 0 ? DETECT.hackedRange : 1);
    const points = [{ x: this.x, y: this.y }];
    for (let i = 0; i <= CONE_RAYS; i++) {
      const a = this.facing - CONE_HALF + (2 * CONE_HALF * i) / CONE_RAYS;
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      let len = range;
      for (let d = 8; d < range; d += 6) {
        const cx = Math.floor((this.x + dx * d) / TILE);
        const cy = Math.floor((this.y + dy * d) / TILE);
        const t = tileAt(this.level, cx, cy);
        if (t === '#' || t === 'S' || t === 'C') { len = d; break; }
      }
      points.push({ x: this.x + dx * len, y: this.y + dy * len });
    }
    return points;
  }
}

// VEIL — boot and the one loop. Input is read every frame, the world
// advances in fixed 1/60 s steps (several in a slow frame, none in a fast
// one), and the renderer paints what is there. The game moves between
// screens: title, level intro, play, paused, busted, level done, game over
// and win.
//
// ?seed=N fixes the run's randomness. ?shot=start|play|chase|mission (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.

import { ALARM, BEST_KEY, GUARD, SCORE, STRIKES_PER_LEVEL } from './config.js';
import { LEVELS, parseLevel, tileCenterX, tileCenterY } from './level.js';
import { Guard, STATE_ALERT } from './guards.js';
import { Player } from './player.js';
import { AudioSys } from './audio.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_RETRY, createInput } from './input.js';
import { createRenderer } from './render.js';
import { stageShot } from './shots.js';
import { makeRng } from './random.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 1;

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.input = createInput(canvas);
    this.audio = new AudioSys();
    this.renderer = createRenderer(canvas);
    this.rng = makeRng(seed);
    this.screen = 'title';
    this.best = this.readBest();
    this.score = 0;
    this.ghostLevels = 0;
    this.time = 0;
    this.levelIndex = 0;
    this.level = null;
    this.guards = [];
    this.player = null;
    this.levelTime = 0;
    this.strikes = STRIKES_PER_LEVEL;
    this.alarm = 0;
    this.alarmTimer = 0;
    this.lightsDim = 0;
    this.ghost = true;
    this.coinMarks = [];
    this.bustedBy = null;
    this.loadLevel(0);
  }

  readBest() {
    try {
      const raw = window.localStorage.getItem(BEST_KEY);
      return raw ? JSON.parse(raw) : { score: 0, ghost: 0 };
    } catch {
      return { score: 0, ghost: 0 };
    }
  }

  saveBest() {
    try {
      window.localStorage.setItem(BEST_KEY, JSON.stringify(this.best));
    } catch {
      // Storage can be off (private windows): the best then lasts this visit only.
    }
  }

  loadLevel(index) {
    this.levelIndex = index;
    this.level = parseLevel(LEVELS[index]);
    this.player = new Player(this.level.start);
    this.guards = LEVELS[index].guards.map(
      (def, i) => new Guard(def, this.level, i),
    );
    this.levelTime = 0;
    this.strikes = STRIKES_PER_LEVEL;
    this.alarm = 0;
    this.alarmTimer = 0;
    this.lightsDim = 0;
    this.ghost = true;
    this.coinMarks = [];
    this.bustedBy = null;
  }

  resetAfterBusted() {
    // Back to the start of the level; loot already taken stays taken, the
    // guards go back to their patrols and the alarm calms down.
    this.player.reset(this.level.start);
    this.guards = LEVELS[this.levelIndex].guards.map(
      (def, i) => new Guard(def, this.level, i),
    );
    this.alarm = 0;
    this.alarmTimer = 0;
    this.lightsDim = 0;
    this.coinMarks = [];
    this.bustedBy = null;
    this.screen = 'play';
  }

  lootLeft() {
    return this.level.loot.filter((item) => !item.taken).length;
  }

  lootGot() {
    return this.level.loot.length - this.lootLeft();
  }

  lootTotal() {
    return this.level.loot.length;
  }

  maxDetection() {
    let m = 0;
    for (const guard of this.guards) m = Math.max(m, guard.meter);
    return m;
  }

  objectiveText() {
    if (this.lootLeft() > 0) {
      return `Collect the relics — ${this.lootLeft()} left — then reach the green exit.`;
    }
    return 'All relics taken — reach the green exit, unseen.';
  }

  levelSummaryLines() {
    const lines = [
      `Relics ${this.lootGot()}/${this.lootTotal()}  •  Time ${Math.floor(this.levelTime)}s`,
      `Ghost bonus ${this.ghost ? `+${SCORE.ghostBonus} — never spotted` : '— spotted once'}`,
    ];
    return lines;
  }

  winSummaryLines(best) {
    return [
      `Final score ${this.score} — best ${Math.max(best.score, this.score)}.`,
      `Ghost levels: ${this.ghostLevels} of 3. The archive never saw you coming.`,
    ];
  }

  noise(x, y, radius, kind) {
    for (const guard of this.guards) guard.hear(x, y, radius);
  }

  raiseAlarm() {
    this.alarm = Math.min(ALARM.maxPips, this.alarm + 1);
    this.alarmTimer = 0;
  }

  onSpotted() {
    this.ghost = false;
  }

  onLoot() {
    this.score += SCORE.loot;
    this.audio.pickup();
  }

  onHack() {
    this.lightsDim = 20;
    this.audio.hack();
  }

  addCoinMark(x, y) {
    this.coinMarks.push({ x, y, t: 4 });
  }

  update(dt) {
    this.time += dt;
    if (this.screen !== 'play') return;
    this.levelTime += dt;
    if (this.lightsDim > 0) this.lightsDim = Math.max(0, this.lightsDim - dt);

    // Alarm calms down after a stretch with no guard alert or suspicious.
    const hot = this.guards.some(
      (g) => g.state === STATE_ALERT || g.state === 'suspicious',
    );
    if (hot) this.alarmTimer = 0;
    else {
      this.alarmTimer += dt;
      if (this.alarmTimer >= ALARM.decaySeconds && this.alarm > 0) {
        this.alarm -= 1;
        this.alarmTimer = 0;
      }
    }

    this.player.update(dt, this.input, this.level, this);
    for (const guard of this.guards) guard.update(dt, this.player, this);

    for (const mark of this.coinMarks) mark.t -= dt;
    this.coinMarks = this.coinMarks.filter((mark) => mark.t > 0);

    // Caught: an alert guard touching the player ends the attempt.
    for (const guard of this.guards) {
      if (guard.state !== STATE_ALERT) continue;
      const d = Math.hypot(guard.x - this.player.x, guard.y - this.player.y);
      if (d < GUARD.catchRange) {
        this.strikes -= 1;
        this.bustedBy = guard.name;
        this.audio.busted();
        if (this.strikes <= 0) {
          this.screen = 'gameover';
          if (this.score > this.best.score) {
            this.best = { score: this.score, ghost: this.ghostLevels };
            this.saveBest();
          }
        } else {
          this.screen = 'busted';
        }
        return;
      }
    }

    // Exit: all relics taken and Wren standing on the green door.
    if (this.lootLeft() === 0) {
      const ex = tileCenterX(this.level.exit.cx);
      const ey = tileCenterY(this.level.exit.cy);
      if (Math.hypot(ex - this.player.x, ey - this.player.y) < 26) {
        const timeBonus = Math.max(
          0,
          (SCORE.timeBonusCap - Math.floor(this.levelTime)) * SCORE.timeBonusPerSecond,
        );
        this.score += timeBonus;
        if (this.ghost) {
          this.score += SCORE.ghostBonus;
          this.ghostLevels += 1;
        }
        this.audio.levelDone();
        this.screen = 'leveldone';
      }
    }
  }

  handleActions() {
    const actions = this.input.takeActions();
    if (actions & ACTION_CONFIRM) this.audio.ensure();
    if (this.screen === 'title' && (actions & ACTION_CONFIRM)) {
      this.audio.ensure();
      this.audio.startAmbient();
      this.score = 0;
      this.ghostLevels = 0;
      this.loadLevel(0);
      this.screen = 'intro';
    } else if (this.screen === 'intro' && (actions & ACTION_CONFIRM)) {
      this.screen = 'play';
    } else if (this.screen === 'play' && (actions & ACTION_PAUSE)) {
      this.screen = 'pause';
    } else if (this.screen === 'pause' && (actions & (ACTION_PAUSE | ACTION_CONFIRM))) {
      this.screen = 'play';
    } else if (this.screen === 'busted' && (actions & ACTION_RETRY)) {
      this.resetAfterBusted();
    } else if (this.screen === 'leveldone' && (actions & ACTION_CONFIRM)) {
      if (this.levelIndex + 1 >= LEVELS.length) {
        this.screen = 'win';
        this.audio.win();
        if (this.score > this.best.score) {
          this.best = { score: this.score, ghost: this.ghostLevels };
          this.saveBest();
        }
      } else {
        this.loadLevel(this.levelIndex + 1);
        this.screen = 'intro';
      }
    } else if ((this.screen === 'gameover' || this.screen === 'win') && (actions & ACTION_CONFIRM)) {
      this.score = 0;
      this.ghostLevels = 0;
      this.loadLevel(0);
      this.screen = 'intro';
    }
  }

  frame(now) {
    requestAnimationFrame((t) => this.frame(t));
    const dt = Math.min((now - this.last) / 1000, MAX_FRAME);
    this.last = now;
    this.handleActions();
    if (this.screen === 'title') {
      // Attract mode: the gallery lives behind the title, guards patrolling.
      this.time += dt;
      for (const guard of this.guards) guard.update(dt, this.player, this);
    } else if (this.screen === 'play') {
      this.accumulator += dt;
      while (this.accumulator >= STEP) {
        this.update(STEP);
        this.accumulator -= STEP;
        if (this.screen !== 'play') break;
      }
    }
    this.renderer.draw(this, this.screen, this.best.score);
  }

  run() {
    this.accumulator = 0;
    this.last = performance.now();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.screen === 'play') this.screen = 'pause';
    });
    requestAnimationFrame((t) => this.frame(t));
  }
}

const canvas = document.getElementById('game');
const game = new Game(canvas);
// Debug hook for automated play-testing; harmless in play.
window.__veil = game;

if (shot) {
  const screen = stageShot(shot, game);
  let painted = 0;
  function paint() {
    game.renderer.draw(game, screen, game.best.score);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
} else {
  game.run();
}

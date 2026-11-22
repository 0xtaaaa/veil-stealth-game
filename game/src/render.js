// VEIL — everything on screen. One canvas, drawn in layers: floor and cover,
// then the guards' vision cones (clipped against walls, so they react to
// cover), then loot, exit and people, then a soft night-lighting wash, then
// the HUD bar, the minimap, and the menu overlays.
//
// The palette is a museum at night: deep navy floors, warm lit stone, dark
// shadow zones that read as safe, and guards in uniforms that stand out
// against the floor so a patrol is readable at a glance.

import { COLS, HUD_H, ROWS, TILE, W } from './config.js';
import { STATE_ALERT, STATE_SEARCH, STATE_SUSPICIOUS } from './guards.js';
import { tileAt, tileCenterX, tileCenterY } from './level.js';

const PALETTE = {
  hud: '#0d1120',
  hudLine: '#2a3350',
  floorA: '#1d2338',
  floorB: '#1a1f31',
  shadow: '#10142a',
  shadowEdge: '#232c4d',
  wall: '#3a4358',
  wallTop: '#4d5878',
  crate: '#6b4a2f',
  crateEdge: '#8a6242',
  shelf: '#2c3140',
  shelfEdge: '#454d66',
  planter: '#2e5d3a',
  planterEdge: '#4c8a5c',
  loot: '#f2c94c',
  exit: '#3ddc84',
  panel: '#35c4dc',
  player: '#2ec4b6',
  playerDark: '#1a7f76',
  guard: '#9aa3b8',
  guardDark: '#5d6678',
  text: '#eef1f5',
  muted: '#8b93a3',
  danger: '#e5534b',
  warn: '#f2a93b',
};

const CONE_COLOR = {
  patrol: 'rgba(242, 201, 76, 0.30)',
  suspicious: 'rgba(242, 169, 59, 0.38)',
  alert: 'rgba(229, 83, 75, 0.45)',
  search: 'rgba(242, 169, 59, 0.34)',
  return: 'rgba(242, 201, 76, 0.30)',
};

// The cone's rim: a bright edge so the sweep reads even at a glance.
const CONE_EDGE = {
  patrol: 'rgba(242, 201, 76, 0.55)',
  suspicious: 'rgba(242, 169, 59, 0.65)',
  alert: 'rgba(229, 83, 75, 0.75)',
  search: 'rgba(242, 169, 59, 0.60)',
  return: 'rgba(242, 201, 76, 0.55)',
};

const GUARD_COLOR = {
  patrol: '#9aa3b8',
  suspicious: '#f2a93b',
  alert: '#e5534b',
  search: '#f2a93b',
  return: '#9aa3b8',
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function drawFloor(level) {
    for (let cy = 0; cy < ROWS; cy++) {
      for (let cx = 0; cx < COLS; cx++) {
        const t = tileAt(level, cx, cy);
        const x = cx * TILE;
        const y = cy * TILE;
        const checker = (cx + cy) % 2 === 0;
        ctx.fillStyle = t === 'D' ? PALETTE.shadow : checker ? PALETTE.floorA : PALETTE.floorB;
        ctx.fillRect(x, y, TILE, TILE);
        if (t === 'D') {
          // Shadow zones read as safe at a glance: darker, with a dotted edge.
          ctx.strokeStyle = PALETTE.shadowEdge;
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
          ctx.fillStyle = 'rgba(120, 150, 255, 0.10)';
          ctx.fillRect(x + 6, y + 6, 3, 3);
          ctx.fillRect(x + 20, y + 20, 3, 3);
        }
      }
    }
  }

  function drawCover(level) {
    for (let cy = 0; cy < ROWS; cy++) {
      for (let cx = 0; cx < COLS; cx++) {
        const t = tileAt(level, cx, cy);
        const x = cx * TILE;
        const y = cy * TILE;
        if (t === '#') {
          ctx.fillStyle = PALETTE.wall;
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = PALETTE.wallTop;
          ctx.fillRect(x, y, TILE, 5);
        } else if (t === 'C') {
          ctx.fillStyle = PALETTE.crate;
          ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
          ctx.strokeStyle = PALETTE.crateEdge;
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 5.5, y + 5.5, TILE - 11, TILE - 11);
          ctx.beginPath();
          ctx.moveTo(x + 5, y + 5);
          ctx.lineTo(x + TILE - 5, y + TILE - 5);
          ctx.moveTo(x + TILE - 5, y + 5);
          ctx.lineTo(x + 5, y + TILE - 5);
          ctx.stroke();
        } else if (t === 'S') {
          ctx.fillStyle = PALETTE.shelf;
          ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
          ctx.strokeStyle = PALETTE.shelfEdge;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x + 2, y + 11);
          ctx.lineTo(x + TILE - 2, y + 11);
          ctx.moveTo(x + 2, y + 21);
          ctx.lineTo(x + TILE - 2, y + 21);
          ctx.stroke();
        } else if (t === 'P') {
          ctx.fillStyle = '#4a3a28';
          ctx.beginPath();
          ctx.arc(x + 16, y + 16, 11, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = PALETTE.planter;
          ctx.beginPath();
          ctx.arc(x + 16, y + 14, 9, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = PALETTE.planterEdge;
          ctx.beginPath();
          ctx.arc(x + 13, y + 11, 4, 0, Math.PI * 2);
          ctx.arc(x + 19, y + 12, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  function drawLootExitPanels(game) {
    const level = game.level;
    for (const item of level.loot) {
      if (item.taken) continue;
      const x = tileCenterX(item.cx);
      const y = tileCenterY(item.cy);
      const pulse = 1 + Math.sin(game.time * 3 + item.cx) * 0.12;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = PALETTE.loot;
      const s = 8 * pulse;
      ctx.fillRect(-s, -s, s * 2, s * 2);
      ctx.strokeStyle = '#fff3c4';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-s, -s, s * 2, s * 2);
      ctx.restore();
    }
    const ex = tileCenterX(level.exit.cx);
    const ey = tileCenterY(level.exit.cy);
    const open = game.lootLeft() === 0;
    ctx.fillStyle = open ? PALETTE.exit : '#3a6b52';
    roundRect(ctx, ex - 13, ey - 13, 26, 26, 5);
    ctx.fill();
    ctx.fillStyle = '#0d1120';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(open ? '→' : '✕', ex, ey + 1);
    if (open) {
      ctx.strokeStyle = `rgba(61, 220, 132, ${0.5 + Math.sin(game.time * 4) * 0.3})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(ex - 16, ey - 16, 32, 32);
    }
    for (const panel of level.panels) {
      const px = tileCenterX(panel.cx);
      const py = tileCenterY(panel.cy);
      ctx.fillStyle = panel.hacked ? '#1d4b56' : PALETTE.panel;
      roundRect(ctx, px - 9, py - 9, 18, 18, 3);
      ctx.fill();
      ctx.fillStyle = '#eafcff';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.fillText('H', px, py + 1);
    }
  }

  function drawPatrolRoutes(game) {
    // Dotted patrol routes: the guard's walk, readable before it happens,
    // so a level teaches its own timing at a glance.
    for (const guard of game.guards) {
      const pts = guard.waypoints;
      if (!pts || pts.length < 2) continue;
      ctx.strokeStyle = 'rgba(238, 241, 245, 0.30)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([2, 7]);
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(238, 241, 245, 0.45)';
      for (const p of pts) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawCones(game) {
    for (const guard of game.guards) {
      const poly = guard.conePolygon(game);
      ctx.beginPath();
      ctx.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
      ctx.closePath();
      ctx.fillStyle = CONE_COLOR[guard.state] || CONE_COLOR.patrol;
      ctx.fill();
      ctx.strokeStyle = CONE_EDGE[guard.state] || CONE_EDGE.patrol;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  function drawGuards(game) {
    for (const guard of game.guards) {
      ctx.fillStyle = GUARD_COLOR[guard.state] || GUARD_COLOR.patrol;
      ctx.beginPath();
      ctx.arc(guard.x, guard.y, 12, 0, Math.PI * 2);
      ctx.fill();
      // Pale rim so a guard reads against any floor, lit or dark.
      ctx.strokeStyle = 'rgba(238, 241, 245, 0.85)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = PALETTE.guardDark;
      ctx.beginPath();
      ctx.arc(guard.x, guard.y, 5, 0, Math.PI * 2);
      ctx.fill();
      // Facing tick so the patrol direction is obvious.
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(guard.x, guard.y);
      ctx.lineTo(guard.x + Math.cos(guard.facing) * 17, guard.y + Math.sin(guard.facing) * 17);
      ctx.stroke();
      // Detection ring: fills as the guard closes in on spotting you.
      if (guard.meter > 0.05) {
        ctx.strokeStyle = guard.meter >= 1 ? PALETTE.danger : PALETTE.warn;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(guard.x, guard.y, 17, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * guard.meter);
        ctx.stroke();
      }
      // A "?" or "!" over the head: the guard's state, readable at a glance.
      if (guard.state === STATE_SUSPICIOUS || guard.state === STATE_SEARCH) {
        ctx.fillStyle = PALETTE.warn;
        ctx.font = 'bold 15px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('?', guard.x, guard.y - 20);
      } else if (guard.state === STATE_ALERT) {
        ctx.fillStyle = PALETTE.danger;
        ctx.font = 'bold 16px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('!', guard.x, guard.y - 20);
      }
    }
  }

  function drawPlayer(game) {
    const p = game.player;
    const coin = p.coinPosition();
    const r = p.crouched ? 8 : 11;
    ctx.fillStyle = p.crouched ? PALETTE.playerDark : PALETTE.player;
    // Hooded cloak: a circle for the body, a small triangle for the hood.
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(238, 241, 245, 0.85)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(p.facing) * (r + 5), p.y + Math.sin(p.facing) * (r + 5));
    ctx.lineTo(p.x + Math.cos(p.facing + 2.5) * r, p.y + Math.sin(p.facing + 2.5) * r);
    ctx.lineTo(p.x + Math.cos(p.facing - 2.5) * r, p.y + Math.sin(p.facing - 2.5) * r);
    ctx.closePath();
    ctx.fillStyle = '#d9fff8';
    ctx.fill();
    // Hack progress ring while holding E at a panel.
    if (p.hackProgress > 0) {
      ctx.strokeStyle = PALETTE.panel;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (p.hackProgress / 1.5));
      ctx.stroke();
    }
    if (coin) {
      ctx.fillStyle = PALETTE.loot;
      ctx.beginPath();
      ctx.arc(coin.x, coin.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const mark of game.coinMarks) {
      ctx.fillStyle = 'rgba(242, 201, 76, 0.85)';
      ctx.beginPath();
      ctx.arc(mark.x, mark.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // Noise ring while running: what the guards can hear.
    if (p.running && p.moving) {
      ctx.strokeStyle = 'rgba(238, 241, 245, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 135 * (0.85 + Math.sin(game.time * 8) * 0.15), 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawLighting(game) {
    // A soft wash of night over the floor, lifted around the player and the
    // exit so the eye knows where safety is.
    const g = ctx.createRadialGradient(
      game.player.x, game.player.y, 40,
      game.player.x, game.player.y, 260,
    );
    g.addColorStop(0, 'rgba(8, 10, 20, 0)');
    g.addColorStop(1, 'rgba(8, 10, 20, 0.22)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, ROWS * TILE);
  }

  function drawHud(game) {
    ctx.fillStyle = PALETTE.hud;
    ctx.fillRect(0, 0, W, HUD_H);
    ctx.strokeStyle = PALETTE.hudLine;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, HUD_H - 1);
    ctx.lineTo(W, HUD_H - 1);
    ctx.stroke();

    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 20px system-ui, sans-serif';
    const level = game.level.def;
    ctx.fillText(`VEIL — ${level.name}`, 18, 30);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText(game.objectiveText(), 18, 54);

    // Detection bar: the highest guard meter right now.
    const det = game.maxDetection();
    const bx = 560;
    const bw = 240;
    ctx.fillStyle = PALETTE.muted;
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText('SEEN', bx, 22);
    ctx.fillStyle = '#232a3d';
    roundRect(ctx, bx, 30, bw, 14, 7);
    ctx.fill();
    const dc = det >= 1 ? PALETTE.danger : det >= 0.35 ? PALETTE.warn : '#3ddc84';
    if (det > 0.01) {
      ctx.fillStyle = dc;
      roundRect(ctx, bx, 30, bw * Math.min(1, det), 14, 7);
      ctx.fill();
    }
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(det >= 1 ? 'SPOTTED!' : det >= 0.35 ? 'Suspicious…' : 'Unseen', bx, 62);

    // Alarm pips.
    ctx.fillStyle = PALETTE.muted;
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText('ALARM', bx + 270, 22);
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i < game.alarm ? PALETTE.danger : '#2a3350';
      ctx.beginPath();
      const px = bx + 278 + i * 22;
      const py = 37;
      ctx.moveTo(px, py - 7);
      ctx.lineTo(px + 7, py);
      ctx.lineTo(px, py + 7);
      ctx.lineTo(px - 7, py);
      ctx.closePath();
      ctx.fill();
    }

    // Loot, coins, time, score on the right.
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.loot;
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText(`◆ ${game.lootGot()}/${game.lootTotal()}`, W - 300, 32);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText(`◉ ${game.player.coins} coins`, W - 300, 56);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText(`${Math.floor(game.levelTime)}s`, W - 180, 32);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText(`Score ${game.score}`, W - 180, 56);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(`Strikes ${game.strikes}  •  Level ${game.levelIndex + 1}/3`, W - 18, 32);
    if (game.lightsDim > 0) {
      ctx.fillStyle = PALETTE.panel;
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillText(`Lights dimmed ${Math.ceil(game.lightsDim)}s`, W - 18, 56);
    }
    ctx.textAlign = 'left';
  }

  function drawMinimap(game) {
    const scale = 4;
    const mw = COLS * scale;
    const mh = ROWS * scale;
    const mx = W - mw - 14;
    const my = HUD_H + 14;
    ctx.fillStyle = 'rgba(10, 13, 24, 0.82)';
    roundRect(ctx, mx - 6, my - 6, mw + 12, mh + 12, 6);
    ctx.fill();
    for (let cy = 0; cy < ROWS; cy++) {
      for (let cx = 0; cx < COLS; cx++) {
        const t = tileAt(game.level, cx, cy);
        if (t === '#') ctx.fillStyle = '#4d5878';
        else if (t === 'D') ctx.fillStyle = '#1c2450';
        else if (t === 'C' || t === 'S' || t === 'P') ctx.fillStyle = '#3a4358';
        else continue;
        ctx.fillRect(mx + cx * scale, my + cy * scale, scale, scale);
      }
    }
    for (const item of game.level.loot) {
      if (item.taken) continue;
      ctx.fillStyle = PALETTE.loot;
      ctx.fillRect(mx + item.cx * scale, my + item.cy * scale, scale, scale);
    }
    ctx.fillStyle = PALETTE.exit;
    ctx.fillRect(mx + game.level.exit.cx * scale, my + game.level.exit.cy * scale, scale, scale);
    for (const guard of game.guards) {
      ctx.fillStyle = GUARD_COLOR[guard.state] || GUARD_COLOR.patrol;
      ctx.beginPath();
      ctx.arc(mx + (guard.x / TILE) * scale, my + (guard.y / TILE) * scale, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(mx + (game.player.x / TILE) * scale, my + (game.player.y / TILE) * scale, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(mx - 6.5, my - 6.5, mw + 13, mh + 13);
  }

  function drawOverlay(title, lines, prompt) {
    ctx.fillStyle = 'rgba(6, 8, 16, 0.78)';
    ctx.fillRect(0, 0, W, HUD_H + ROWS * TILE);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.fillText(title, W / 2, 250);
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.muted;
    lines.forEach((line, i) => ctx.fillText(line, W / 2, 300 + i * 30));
    if (prompt) {
      ctx.fillStyle = PALETTE.text;
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.fillText(prompt, W / 2, 300 + lines.length * 30 + 40);
    }
    ctx.textAlign = 'left';
  }

  function draw(game, screen, best) {
    ctx.clearRect(0, 0, W, HUD_H + ROWS * TILE);
    ctx.fillStyle = '#0a0d18';
    ctx.fillRect(0, 0, W, HUD_H + ROWS * TILE);

    if (screen === 'title') {
      // A quiet title over a dimmed gallery: the first level, staged.
      ctx.save();
      ctx.translate(0, HUD_H);
      drawFloor(game.level);
      drawCover(game.level);
      drawPatrolRoutes(game);
      drawCones(game);
      drawLootExitPanels(game);
      drawGuards(game);
      drawPlayer(game);
      ctx.restore();
      ctx.fillStyle = 'rgba(6, 8, 16, 0.72)';
      ctx.fillRect(0, 0, W, HUD_H + ROWS * TILE);
      ctx.textAlign = 'center';
      ctx.fillStyle = PALETTE.text;
      ctx.font = 'bold 72px system-ui, sans-serif';
      ctx.fillText('VEIL', W / 2, 220);
      ctx.font = '20px system-ui, sans-serif';
      ctx.fillStyle = PALETTE.loot;
      ctx.fillText('The Meridian Archive — one thief, one night, the Auric Lumen.', W / 2, 262);
      ctx.fillStyle = PALETTE.muted;
      ctx.font = '17px system-ui, sans-serif';
      const controls = [
        'WASD / Arrows — move      Shift — run (loud)      C — crouch (quiet)',
        'Click / Q — throw a coin to distract      E — hold at a panel to dim the lights',
        'Collect every relic, then reach the exit unseen. Three strikes and the night is over.',
      ];
      controls.forEach((line, i) => ctx.fillText(line, W / 2, 330 + i * 28));
      ctx.fillStyle = PALETTE.text;
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.fillText('Press Enter to begin', W / 2, 470);
      if (best > 0) {
        ctx.fillStyle = PALETTE.muted;
        ctx.font = '16px system-ui, sans-serif';
        ctx.fillText(`Best score: ${best}`, W / 2, 510);
      }
      ctx.textAlign = 'left';
      return;
    }

    ctx.save();
    ctx.translate(0, HUD_H);
    drawFloor(game.level);
    drawCover(game.level);
    drawPatrolRoutes(game);
    drawCones(game);
    drawLootExitPanels(game);
    drawGuards(game);
    drawPlayer(game);
    drawLighting(game);
    ctx.restore();

    drawHud(game);
    drawMinimap(game);

    if (screen === 'intro') {
      drawOverlay(game.level.def.name, [game.level.def.sub, 'Collect every relic, then slip out the exit.'], 'Press Enter to begin');
    } else if (screen === 'pause') {
      drawOverlay('Paused', ['The guards wait. The night does not.'], 'Press Esc to keep going');
    } else if (screen === 'busted') {
      drawOverlay('BUSTED!', [`Caught by ${game.bustedBy || 'a guard'}.`, `${game.strikes} ${game.strikes === 1 ? 'strike' : 'strikes'} left this level.`], 'Press R to slip back to the start');
    } else if (screen === 'leveldone') {
      drawOverlay(`${game.level.def.name} — cleared`, game.levelSummaryLines(), 'Press Enter for the next level');
    } else if (screen === 'gameover') {
      drawOverlay('The archive keeps its secrets', [`Score ${game.score} — best ${best}.`, 'Three strikes. The night is over.'], 'Press Enter to try again');
    } else if (screen === 'win') {
      drawOverlay('The Auric Lumen is yours', game.winSummaryLines(best), 'Press Enter to play again');
    }
  }

  return { draw };
}

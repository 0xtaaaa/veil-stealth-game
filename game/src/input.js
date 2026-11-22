// VEIL — keyboard and mouse. WASD or arrows move; Shift runs; C or Control
// crouches; E interacts; click or Q throws a coin toward the cursor; Esc or
// P pauses; Enter or Space confirms on menus.

import { HUD_H } from './config.js';

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
  KeyC: 'crouch', ControlLeft: 'crouch', ControlRight: 'crouch',
  KeyE: 'interact',
  KeyQ: 'coin',
  Enter: 'confirm', Space: 'confirm',
  Escape: 'pause', KeyP: 'pause',
  KeyR: 'retry',
};

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RETRY = 4;

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  let coinQueued = false;
  let coinTarget = null;

  function toWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  window.addEventListener('keydown', (event) => {
    const action = KEYMAP[event.code];
    if (!action) return;
    if (action === 'confirm' || action === 'pause' || action === 'retry') {
      if (!event.repeat) pressed.add(action);
    } else {
      held.add(action);
      if (action === 'coin' && !event.repeat) coinQueued = true;
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
  });

  window.addEventListener('keyup', (event) => {
    const action = KEYMAP[event.code];
    if (action) held.delete(action);
  });

  canvas.addEventListener('mousedown', (event) => {
    const point = toWorld(event.clientX, event.clientY);
    if (point.y > HUD_H) {
      coinTarget = point;
      coinQueued = true;
    }
  });

  window.addEventListener('blur', () => held.clear());

  return {
    isDown(action) {
      return held.has(action);
    },
    moveVector() {
      let x = 0;
      let y = 0;
      if (held.has('left')) x -= 1;
      if (held.has('right')) x += 1;
      if (held.has('up')) y -= 1;
      if (held.has('down')) y += 1;
      return { x, y };
    },
    consumeCoinThrow() {
      if (!coinQueued) return false;
      coinQueued = false;
      this.coinTarget = coinTarget;
      return true;
    },
    coinTarget: null,
    takeActions() {
      let flags = 0;
      if (pressed.has('confirm')) flags |= ACTION_CONFIRM;
      if (pressed.has('pause')) flags |= ACTION_PAUSE;
      if (pressed.has('retry')) flags |= ACTION_RETRY;
      pressed.clear();
      return flags;
    },
  };
}

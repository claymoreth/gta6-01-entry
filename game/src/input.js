// CITY OF EMBERS — input state (original, Phase 1; Phase 3: E + Space).
// Keyboard (WASD + arrows + Shift sprint/boost + Space handbrake + E enter
// or exit vehicle + Esc/P pause) and mouse orbit (drag, or pointer lock
// after clicking the canvas).

export function createInput(canvas) {
  const keys = new Set();
  const state = {
    keys,
    // Camera orbit deltas accumulated since last frame (consumed by camera).
    mouseDX: 0,
    mouseDY: 0,
    pointerLocked: false,
    // One-shot edge flags, consumed by main.js each frame.
    pausePressed: false,
    interactPressed: false,
    anyKeyPressed: false,
  };

  const KEYMAP = {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    ShiftLeft: 'sprint', ShiftRight: 'sprint',
    Space: 'handbrake',
  };

  function onKeyDown(e) {
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (!e.repeat) state.pausePressed = true;
      return;
    }
    // E = enter / exit vehicle (one-shot edge, no repeat).
    if (e.code === 'KeyE') {
      if (!e.repeat) state.interactPressed = true;
      return;
    }
    const action = KEYMAP[e.code];
    if (action) {
      keys.add(action);
      state.anyKeyPressed = true;
      e.preventDefault();
    }
  }
  function onKeyUp(e) {
    const action = KEYMAP[e.code];
    if (action) keys.delete(action);
  }
  function onBlur() {
    keys.clear();
  }
  function onMouseMove(e) {
    if (state.pointerLocked) {
      state.mouseDX += e.movementX;
      state.mouseDY += e.movementY;
    } else if (dragging) {
      state.mouseDX += e.movementX;
      state.mouseDY += e.movementY;
    }
  }

  let dragging = false;
  function onMouseDown() {
    dragging = true;
  }
  function onMouseUp() {
    dragging = false;
  }
  function onCanvasClick() {
    if (!state.pointerLocked && canvas.requestPointerLock) {
      try {
        const p = canvas.requestPointerLock();
        if (p && p.catch) p.catch(() => { /* pointer lock denied: drag still works */ });
      } catch { /* drag fallback */ }
    }
  }
  function onLockChange() {
    state.pointerLocked = document.pointerLockElement === canvas;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('click', onCanvasClick);
  document.addEventListener('pointerlockchange', onLockChange);

  // Movement vector in camera space: x = strafe right, y = forward.
  state.moveVector = function moveVector() {
    let x = 0;
    let y = 0;
    if (keys.has('up')) y += 1;
    if (keys.has('down')) y -= 1;
    if (keys.has('right')) x += 1;
    if (keys.has('left')) x -= 1;
    if (x !== 0 || y !== 0) {
      const len = Math.hypot(x, y);
      x /= len;
      y /= len;
    }
    return { x, y, sprint: keys.has('sprint') };
  };

  state.consumeMouse = function consumeMouse() {
    const dx = state.mouseDX;
    const dy = state.mouseDY;
    state.mouseDX = 0;
    state.mouseDY = 0;
    return { dx, dy };
  };

  state.consumePause = function consumePause() {
    const p = state.pausePressed;
    state.pausePressed = false;
    return p;
  };

  state.consumeInteract = function consumeInteract() {
    const p = state.interactPressed;
    state.interactPressed = false;
    return p;
  };

  state.handbrake = function handbrake() {
    return keys.has('handbrake');
  };

  return state;
}

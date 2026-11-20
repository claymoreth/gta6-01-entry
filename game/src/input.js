export function createInput(canvas) {
  const keys = new Set();
  const state = {
    keys,
    mouseDX: 0,
    mouseDY: 0,
    pointerLocked: false,
    pausePressed: false,
    interactPressed: false,
    firePressed: false,
    meleePressed: false,
    reloadPressed: false,
    switchVal: null,
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
    if (e.code === 'KeyE') {
      if (!e.repeat) state.interactPressed = true;
      return;
    }
    const c = e.code;
    if (c === 'KeyF' || c === 'KeyR' || c === 'KeyQ' || c === 'Digit1' || c === 'Digit2') {
      if (!e.repeat) {
        if (c === 'KeyF') state.meleePressed = true;
        else if (c === 'KeyR') state.reloadPressed = true;
        else if (c === 'KeyQ') state.switchVal = -1;
        else state.switchVal = c === 'Digit1' ? 0 : 1;
      }
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
  function onMouseDown(e) {
    dragging = true;
    if (e.button === 0 && state.pointerLocked) state.firePressed = true;
  }
  function onMouseUp() {
    dragging = false;
  }
  function onCanvasClick() {
    if (!state.pointerLocked && canvas.requestPointerLock) {
      try {
        const p = canvas.requestPointerLock();
        if (p && p.catch) p.catch(() => {  });
      } catch {  }
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
  for (const [name, key] of [['consumeFire', 'firePressed'], ['consumeMelee', 'meleePressed'], ['consumeReload', 'reloadPressed'], ['consumeSwitch', 'switchVal']]) {
    state[name] = () => { const v = state[key]; state[key] = key === 'switchVal' ? null : false; return v; };
  }
  state.handbrake = function handbrake() {
    return keys.has('handbrake');
  };
  return state;
}

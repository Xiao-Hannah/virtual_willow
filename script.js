const cat = document.querySelector("#cat");
const hitbox = document.querySelector("#cat-hitbox");
const menu = document.querySelector("#cat-menu");
const walkingLayer = document.querySelector('.cat__layer--walking');

// 12-frame walking cycle. Preloaded so src swaps don't flicker.
const WALK_FRAMES = Array.from({ length: 12 }, (_, i) =>
  `assets/sprites/walk/cat_walk_${String(i + 1).padStart(2, "0")}.png`
);
const WALK_FRAME_INTERVAL = 90; // ms between frames
WALK_FRAMES.forEach((src) => {
  const img = new Image();
  img.src = src;
});

// Positive = lift cat above the window's bottom edge; 0 = sit flush. The
// Electron window itself is positioned just above the taskbar (see main.js),
// so 0 already places the cat's feet on the taskbar's top edge.
const BOTTOM_OFFSET = -5;
const WALK_SPEED = 70;
const STATE_DURATION = {
  idle: [1600, 3400],
  walking: [2600, 5200],
  playing: [2200, 3600],
  sleeping: [3200, 6200],
  stretching: [1700, 3000],
};

const state = {
  catX: 120,
  catY: 0,
  targetX: 120,
  mode: "idle",
  direction: 1,
  dragging: false,
  dragOffsetX: 0,
  dragOffsetY: 0,
  nextStateAt: 0,
  lastFrame: performance.now(),
  // When true, the cat stays in the sleeping pose and the random state
  // machine is paused until the user wakes her via the context menu.
  forcedSleep: false,
  walkFrameIdx: 0,
  nextWalkFrameAt: 0,
};

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function randomDuration(mode) {
  const [min, max] = STATE_DURATION[mode];
  return randomBetween(min, max);
}

function getCatSize() {
  return {
    width: cat.offsetWidth,
    height: cat.offsetHeight,
  };
}

function getBounds() {
  const catSize = getCatSize();

  return {
    maxX: Math.max(0, window.innerWidth - catSize.width),
    maxY: Math.max(0, window.innerHeight - catSize.height - BOTTOM_OFFSET),
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function pickTargetX() {
  const bounds = getBounds();
  return randomBetween(16, Math.max(16, bounds.maxX - 16));
}

// Keeps the cat inside the window without forcing it to the ground line, so
// the user's chosen drop position is preserved across resizes and renders.
function clampCatPosition() {
  const bounds = getBounds();
  state.catX = clamp(state.catX, 0, bounds.maxX);
  state.catY = clamp(state.catY, 0, bounds.maxY);
  state.targetX = clamp(state.targetX, 0, bounds.maxX);
}

function setMode(mode) {
  state.mode = mode;
  state.nextStateAt = performance.now() + randomDuration(mode);
  cat.className = `cat ${mode}${state.dragging ? " dragging" : ""}`;
  clampCatPosition();
  if (mode === "walking") {
    state.targetX = pickTargetX();
    // Reset the walk cycle so each walk starts on frame 1.
    state.walkFrameIdx = 0;
    walkingLayer.src = WALK_FRAMES[0];
    state.nextWalkFrameAt = performance.now() + WALK_FRAME_INTERVAL;
  }

  if (mode === "idle" || mode === "sleeping" || mode === "stretching" || mode === "playing") {
    state.targetX = state.catX;
  }
}

function chooseNextMode() {
  const roll = Math.random();

  if (roll < 0.5) {
    setMode("walking");
  } else if (roll < 0.66) {
    setMode("idle");
  } else if (roll < 0.78) {
    setMode("playing");
  } else if (roll < 0.9) {
    setMode("stretching");
  } else {
    setMode("sleeping");
  }
}

// Move only along the X axis so the cat stays grounded on the desktop strip.
function moveHorizontally(deltaTime) {
  if (state.dragging || state.forcedSleep || state.mode !== "walking") {
    return;
  }

  const dx = state.targetX - state.catX;

  if (Math.abs(dx) < 3) {
    setMode("idle");
    return;
  }

  const travel = Math.min(Math.abs(dx), WALK_SPEED * (deltaTime / 1000));
  state.catX += Math.sign(dx) * travel;
  state.direction = dx >= 0 ? 1 : -1;
}

function render() {
  clampCatPosition();
  cat.style.left = `${state.catX}px`;
  cat.style.top = `${state.catY}px`;
  cat.style.transform = `scaleX(${state.direction})`;
}

// Advance the walking spritesheet one frame at WALK_FRAME_INTERVAL ms.
function tickWalkAnimation(now) {
  if (state.mode !== "walking" || state.dragging) return;
  if (now < state.nextWalkFrameAt) return;
  state.walkFrameIdx = (state.walkFrameIdx + 1) % WALK_FRAMES.length;
  walkingLayer.src = WALK_FRAMES[state.walkFrameIdx];
  state.nextWalkFrameAt = now + WALK_FRAME_INTERVAL;
}

// The main loop handles timed state changes, horizontal walking, and rendering.
function animationLoop(now) {
  const deltaTime = now - state.lastFrame;
  state.lastFrame = now;

  if (!state.dragging && !state.forcedSleep && now > state.nextStateAt) {
    chooseNextMode();
  }

  moveHorizontally(deltaTime);
  tickWalkAnimation(now);
  render();
  requestAnimationFrame(animationLoop);
}

// Dragging supports both axes so the cat can be placed anywhere in the window.
function startDrag(event) {
  // Only respond to the primary (left) mouse button so right-clicks open the menu.
  if (event.button !== undefined && event.button !== 0) {
    return;
  }
  state.dragging = true;
  cat.classList.add("dragging");
  hitbox.setPointerCapture(event.pointerId);

  const rect = cat.getBoundingClientRect();
  state.dragOffsetX = event.clientX - rect.left;
  state.dragOffsetY = event.clientY - rect.top;
  // Keep the sleeping pose during drag if the user has forced sleep on.
  if (!state.forcedSleep) {
    setMode("idle");
  }
}

function dragCat(event) {
  if (!state.dragging) {
    return;
  }

  const bounds = getBounds();
  state.catX = clamp(event.clientX - state.dragOffsetX, 0, bounds.maxX);
  state.catY = clamp(event.clientY - state.dragOffsetY, 0, bounds.maxY);
  state.targetX = state.catX;
}

function endDrag(event) {
  if (!state.dragging) {
    return;
  }

  state.dragging = false;
  cat.classList.remove("dragging");

  if (hitbox.hasPointerCapture(event.pointerId)) {
    hitbox.releasePointerCapture(event.pointerId);
  }

  if (!state.forcedSleep) {
    state.nextStateAt = performance.now() + randomDuration("idle");
  }
}

function keepInsideWindow() {
  clampCatPosition();
  render();
}

function initializeCat() {
  const catSize = getCatSize();
  const bounds = getBounds();
  state.catX = clamp(window.innerWidth * 0.5 - catSize.width / 2, 0, bounds.maxX);
  state.catY = bounds.maxY;
  state.targetX = state.catX;
  clampCatPosition();
  setMode("idle");
  render();
  // On macOS the window extends behind the Dock so the cat *can* be dragged
  // there, but by default we want the cat sitting above it (matching the
  // visual ground line on Windows/Linux where workArea already excludes the
  // taskbar). Lift the cat by the OS bottom inset once we know it.
  if (window.petBridge?.getBottomInset) {
    window.petBridge.getBottomInset().then((inset) => {
      if (inset > 0) {
        const b = getBounds();
        state.catY = Math.max(0, b.maxY - inset);
        render();
      }
    });
  }
  requestAnimationFrame(animationLoop);
}

hitbox.addEventListener("pointerdown", startDrag);
hitbox.addEventListener("pointermove", dragCat);
hitbox.addEventListener("pointerup", endDrag);
hitbox.addEventListener("pointercancel", endDrag);
window.addEventListener("resize", keepInsideWindow);

// In Electron, the BrowserWindow swallows OS-level mouse events even where
// the page is transparent. main.js starts the window in click-through mode
// with `forward: true`, which still delivers mouse-move events here. We
// re-enable interactivity only while the cursor is actually over the cat,
// so the rest of the desktop row stays usable.
const bridge = window.petBridge;
if (bridge) {
  hitbox.addEventListener("pointerenter", () => bridge.setInteractive(true));
  hitbox.addEventListener("pointerleave", () => {
    if (!state.dragging && menu.hidden) bridge.setInteractive(false);
  });
  // Safety net: after a drag ends outside the hitbox, drop interactivity.
  hitbox.addEventListener("pointerup", () => {
    requestAnimationFrame(() => {
      const r = hitbox.getBoundingClientRect();
      const { x, y } = lastPointer;
      const inside = x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
      if (!inside && menu.hidden) bridge.setInteractive(false);
    });
  });
}

const lastPointer = { x: 0, y: 0 };
window.addEventListener("pointermove", (e) => {
  lastPointer.x = e.clientX;
  lastPointer.y = e.clientY;
}, { capture: true });

// ---- Right-click context menu --------------------------------------------
function sleepNow() {
  state.forcedSleep = true;
  setMode("sleeping");
  // Bump nextStateAt far into the future so the random scheduler stays idle.
  state.nextStateAt = Number.POSITIVE_INFINITY;
}

function wakeUp() {
  state.forcedSleep = false;
  setMode("idle");
}

function buildMenu() {
  menu.innerHTML = "";
  const items = state.forcedSleep
    ? [{ label: "Wake up", action: wakeUp }]
    : [{ label: "Go to sleep", action: sleepNow }];
  items.push({
    label: "See you tomorrow Willow\u{1F44B}",
    action: () => {
      if (bridge && bridge.quit) bridge.quit();
    },
  });
  for (const item of items) {
    const li = document.createElement("li");
    li.textContent = item.label;
    li.setAttribute("role", "menuitem");
    li.addEventListener("click", () => {
      item.action();
      hideMenu();
    });
    menu.appendChild(li);
  }
}

function showMenu(x, y) {
  buildMenu();
  menu.hidden = false;
  // Keep the Electron window interactive while the menu is open so clicks
  // outside the cat hitbox (but on the menu) still register.
  if (bridge) bridge.setInteractive(true);
  // Defer measurement until after the menu is in the layout tree.
  const rect = menu.getBoundingClientRect();
  const px = Math.min(x, window.innerWidth - rect.width - 4);
  const py = Math.min(y, window.innerHeight - rect.height - 4);
  menu.style.left = `${Math.max(4, px)}px`;
  menu.style.top = `${Math.max(4, py)}px`;
}

function hideMenu() {
  if (menu.hidden) return;
  menu.hidden = true;
  // Restore click-through unless the cursor is currently over the cat.
  if (bridge) {
    const r = hitbox.getBoundingClientRect();
    const inside =
      lastPointer.x >= r.left && lastPointer.x <= r.right &&
      lastPointer.y >= r.top  && lastPointer.y <= r.bottom;
    if (!inside && !state.dragging) bridge.setInteractive(false);
  }
}

hitbox.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  showMenu(event.clientX, event.clientY);
});

// Dismiss the menu on any outside click or Escape.
document.addEventListener("pointerdown", (event) => {
  if (!menu.hidden && !menu.contains(event.target)) {
    hideMenu();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") hideMenu();
});

initializeCat();

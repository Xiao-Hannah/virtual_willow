const cat = document.querySelector("#cat");

const BOTTOM_OFFSET = -15;
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
  nextStateAt: 0,
  lastFrame: performance.now(),
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
    bottomY: Math.max(0, window.innerHeight - catSize.height - BOTTOM_OFFSET),
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function pickTargetX() {
  const bounds = getBounds();
  return randomBetween(16, Math.max(16, bounds.maxX - 16));
}

function pinCatToBottom() {
  const bounds = getBounds();
  state.catY = bounds.bottomY;
  state.catX = clamp(state.catX, 0, bounds.maxX);
  state.targetX = clamp(state.targetX, 0, bounds.maxX);
}

function setMode(mode) {
  state.mode = mode;
  state.nextStateAt = performance.now() + randomDuration(mode);
  cat.className = `cat ${mode}${state.dragging ? " dragging" : ""}`;
  pinCatToBottom();

  if (mode === "walking") {
    state.targetX = pickTargetX();
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
  if (state.dragging || state.mode !== "walking") {
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
  pinCatToBottom();
  cat.style.left = `${state.catX}px`;
  cat.style.top = `${state.catY}px`;
  cat.style.transform = `scaleX(${state.direction})`;
}

// The main loop handles timed state changes, horizontal walking, and rendering.
function animationLoop(now) {
  const deltaTime = now - state.lastFrame;
  state.lastFrame = now;

  if (!state.dragging && now > state.nextStateAt) {
    chooseNextMode();
  }

  moveHorizontally(deltaTime);
  render();
  requestAnimationFrame(animationLoop);
}

// Dragging is constrained to X; the Y position remains pinned to the bottom.
function startDrag(event) {
  state.dragging = true;
  cat.classList.add("dragging");
  cat.setPointerCapture(event.pointerId);

  const rect = cat.getBoundingClientRect();
  state.dragOffsetX = event.clientX - rect.left;
  setMode("idle");
}

function dragCat(event) {
  if (!state.dragging) {
    return;
  }

  const bounds = getBounds();
  state.catX = clamp(event.clientX - state.dragOffsetX, 0, bounds.maxX);
  state.targetX = state.catX;
  pinCatToBottom();
}

function endDrag(event) {
  if (!state.dragging) {
    return;
  }

  state.dragging = false;
  cat.classList.remove("dragging");

  if (cat.hasPointerCapture(event.pointerId)) {
    cat.releasePointerCapture(event.pointerId);
  }

  state.nextStateAt = performance.now() + randomDuration("idle");
}

function keepInsideWindow() {
  pinCatToBottom();
  render();
}

function initializeCat() {
  const catSize = getCatSize();
  const bounds = getBounds();
  state.catX = clamp(window.innerWidth * 0.5 - catSize.width / 2, 0, bounds.maxX);
  state.targetX = state.catX;
  pinCatToBottom();
  setMode("idle");
  render();
  requestAnimationFrame(animationLoop);
}

cat.addEventListener("pointerdown", startDrag);
cat.addEventListener("pointermove", dragCat);
cat.addEventListener("pointerup", endDrag);
cat.addEventListener("pointercancel", endDrag);
window.addEventListener("resize", keepInsideWindow);

initializeCat();

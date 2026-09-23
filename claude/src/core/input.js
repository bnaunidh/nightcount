// THE NIGHT COUNT — keyboard/mouse input + pointer lock.
import { Bus } from "./util.js";
import { settings } from "./settings.js";

export const inputBus = new Bus();

const down = new Set();
let locked = false;
let enabled = true;
export const mouse = { dx: 0, dy: 0, down: false };

export function initInput(canvas) {
  addEventListener("keydown", (e) => {
    if (e.code === "Tab") e.preventDefault();
    if (down.has(e.code)) return;          // ignore auto-repeat
    down.add(e.code);
    if (enabled) inputBus.emit("press", e.code, e);
  });
  addEventListener("keyup", (e) => {
    down.delete(e.code);
    if (enabled) inputBus.emit("release", e.code, e);
  });
  addEventListener("blur", () => { down.clear(); mouse.down = false; });

  canvas.addEventListener("mousedown", (e) => {
    mouse.down = true;
    if (enabled) inputBus.emit("mousedown", e.button);
  });
  addEventListener("mouseup", () => { mouse.down = false; });

  document.addEventListener("pointerlockchange", () => {
    locked = document.pointerLockElement === canvas;
    inputBus.emit("lock", locked);
  });
  addEventListener("mousemove", (e) => {
    if (!locked || !enabled) return;
    const s = settings.sensitivity * 0.0016;
    mouse.dx += (settings.invertLookX ? -1 : 1) * e.movementX * s;
    mouse.dy += (settings.invertY ? -1 : 1) * e.movementY * s;
  });
}

export function requestLock(canvas) {
  if (locked || !canvas?.requestPointerLock) return;
  // Some embedders (and any cross-document context) reject this; the game is
  // still playable, so never let it surface as an unhandled rejection.
  try { Promise.resolve(canvas.requestPointerLock()).catch(() => {}); }
  catch (e) { /* ignore */ }
}
export function releaseLock() {
  if (locked) document.exitPointerLock?.();
}
export const isLocked = () => locked;
export const setInputEnabled = (v) => { enabled = v; if (!v) down.clear(); };
export const isDown = (code) => down.has(code);
export const key = (action) => settings.keys[action];
export const actionDown = (action) => down.has(settings.keys[action]);

/** Consume accumulated mouse delta (call once per frame). */
export function takeMouse() {
  const d = { x: mouse.dx, y: mouse.dy };
  mouse.dx = 0; mouse.dy = 0;
  return d;
}

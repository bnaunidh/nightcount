// THE NIGHT COUNT — settings store. Persists to localStorage, applied live.
import { Bus, clamp } from "./util.js";
import { store } from "./storage.js";

const KEY = "nightcount.settings.v1";

export const DEFAULTS = {
  // audio
  volMaster: 0.9, volAmbience: 0.9, volEffects: 0.9, volVoice: 1.0, volMusic: 0.7,
  scareVolume: 1.0,             // caps the peak of loud one-shots
  // look
  sensitivity: 0.85, invertY: false, fov: 72,
  // video
  brightness: 1.12, quality: "medium", resScale: 1.0, fullscreen: false,
  grain: 1.0, aberration: 0.55, vignette: 1.0, dither: true, shake: 1.0,
  motionBlur: false, reduceFlicker: false,
  // accessibility / comfort
  subtitles: true, subtitleSize: 1.0, subtitleBg: true,
  showOutlines: true,          // small brass glint at the exact interaction target
  taskMarkers: true,           // restrained nearby task glints, hidden behind walls
  promptScale: 1.0, holdToInteract: false, invertLookX: false,
  // controls (KeyboardEvent.code)
  keys: {
    forward: "KeyW", back: "KeyS", left: "KeyA", right: "KeyD",
    interact: "KeyE", cancel: "Escape", notebook: "KeyQ",
    flashlight: "KeyF", sprint: "ShiftLeft", tasks: "Tab",
  },
};

export const settings = Object.assign({}, structuredClone(DEFAULTS));
export const settingsBus = new Bus();

export function loadSettings() {
  try {
    const raw = store.get(KEY);
    if (raw) {
      const o = JSON.parse(raw);
      for (const k of Object.keys(DEFAULTS)) {
        if (k === "keys") Object.assign(settings.keys, o.keys || {});
        else if (k in o) settings[k] = o[k];
      }
    }
  } catch (e) { console.warn("settings load failed", e); }
  return settings;
}

export function saveSettings() {
  try { store.set(KEY, JSON.stringify(settings)); }
  catch (e) { console.warn("settings save failed", e); }
}

export function setSetting(k, v) {
  if (typeof DEFAULTS[k] === "number") v = Number(v);
  settings[k] = v;
  saveSettings();
  settingsBus.emit("change", k, v);
  settingsBus.emit("change:" + k, v);
}

export function resetSettings() {
  Object.assign(settings, structuredClone(DEFAULTS));
  saveSettings();
  settingsBus.emit("change", "*", null);
}

export const qualityPreset = () => ({
  low:    { internalW: 480, shadows: false, shadowSize: 512,  maxLights: 5,  camFps: 8  },
  medium: { internalW: 640, shadows: true,  shadowSize: 1024, maxLights: 8,  camFps: 12 },
  high:   { internalW: 960, shadows: true,  shadowSize: 2048, maxLights: 12, camFps: 20 },
}[settings.quality] || { internalW: 640, shadows: true, shadowSize: 1024, maxLights: 8, camFps: 12 });

export const clampVol = (v) => clamp(v, 0, 1);

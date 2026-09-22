// THE NIGHT COUNT — dev mode (the menu one).
//
// A passcode-gated shortcut into any night at any hour, so a shift can be
// tested without working the five before it. Distinct from `dev.js`, which is
// the console surface `window.__nc.dev` — this is the one with a door in the
// front end.
//
// It is deliberately not a cheat menu for players: the code is not hinted
// anywhere in the game, and a shift started from here is flagged on the save so
// a dev run can be told apart from a real one.
const CODE = "6767";
const KEY = "nc_dev_unlocked";

export const devmode = {
  unlocked: false,     // the code has been entered this session
  on: false,           // the shift currently running was started from dev mode
};

try { if (sessionStorage.getItem(KEY) === "1") devmode.unlocked = true; } catch { /* private mode */ }

export function tryUnlock(code) {
  if (String(code).trim() !== CODE) return false;
  devmode.unlocked = true;
  try { sessionStorage.setItem(KEY, "1"); } catch { /* private mode */ }
  return true;
}

export function lockDev() {
  devmode.unlocked = false;
  devmode.on = false;
  try { sessionStorage.removeItem(KEY); } catch { /* private mode */ }
}

/** The clock is minutes from midnight of the first day; the shift wraps past it. */
export const DEV_CLOCK_MIN = 20 * 60 + 20;   // 20:20, the top of the shift
export const DEV_CLOCK_MAX = 30 * 60;   // 06:00 the next morning

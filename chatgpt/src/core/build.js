// THE NIGHT COUNT — build-time constants.
//
// The demo and the full game are the same code. `tools/build_single.py --demo`
// rewrites the two values below on its way past, so there is no second branch
// of the project to keep in step and no chance of the demo drifting away from
// what it is a demo of.
//
// Nothing else in the codebase decides what a demo is. If you want the demo to
// stop somewhere else, this is the only number to change.
export const BUILD = {
  demo: false,
  lastNight: 6,     // the shift after this one does not start
};

/** "Night two" rather than "night 2" — the game never uses digits for these. */
export const NIGHT_WORD = ["", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX"];

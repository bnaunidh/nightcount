// THE NIGHT COUNT — music.
//
// Used deliberately sparingly. There is no exploration score: the station's own
// noise is the score, and taking that noise away is the loudest thing the game
// does. Music appears only where it cannot be mistaken for safety —
//
//   menu      the drift across the forecourt
//   title     the card between nights
//   climax    Night 6, from the moment the queue starts
//   endings   one cue each
//   credits   the long one
//
// It rides its own bus, so a player who wants none of it can set music to zero
// and lose nothing else.
const CUES = {
  // The menu bed is the first thing anyone hears, so it sets what kind of game
  // this is. It was the dread drone, which is a mistake in the other direction:
  // it announces the horror before the player has been given anything to be
  // frightened of, and by the time the first real scare lands they have been
  // listening to "something is wrong" for two minutes and stopped hearing it.
  //
  // Slow strings instead. Not warm and not sinister — the register of a place
  // that used to be busy, which is what the station is. The scare beds still
  // have all their force because nothing has spent them in advance.
  menu:    { slot: "mus_credits", vol: 0.26, loop: true,  fade: 3.5 },
  title:   { slot: "mus_title",   vol: 0.34, loop: false, fade: 1.2 },
  climax:  { slot: "mus_climax",  vol: 0.30, loop: true,  fade: 6.0 },
  // a low bed that comes in as the night turns, not as a sting
  unease:  { slot: "mus_unease",  vol: 0.22, loop: true,  fade: 8.0 },
  dread:   { slot: "mus_dread",   vol: 0.26, loop: true,  fade: 7.0 },
  closed:  { slot: "mus_closed",  vol: 0.40, loop: true,  fade: 3.5 },
  count:   { slot: "mus_count",   vol: 0.42, loop: true,  fade: 1.5 },
  credits: { slot: "mus_credits", vol: 0.36, loop: true,  fade: 2.5 },
  // The working shift. `mus_menu` was the only music in the project nothing
  // played — the menu uses the dread bed, because a neutral pad said
  // "atmospheric" and the dread bed says something is wrong with the building.
  // As a very low bed under the ordinary hours it is exactly right: the game
  // used to be musically empty for most of every night, which made the unease
  // bed at dread 3 arrive like a switch being thrown rather than like the
  // night turning.
  shift:   { slot: "mus_menu",    vol: 0.11, loop: true,  fade: 12.0 },
};

export class Music {
  constructor(audio) {
    this.audio = audio;
    this.cur = null;      // {name, src, gain}
  }

  /** Start a cue, crossfading out whatever was playing. */
  play(name) {
    const a = this.audio;
    if (!a.ready) { a._pending.push(() => this.play(name)); return; }
    if (this.cur && this.cur.name === name) return;
    const cue = CUES[name];
    this.stop(cue ? cue.fade * 0.6 : 1.5);
    if (!cue) return;
    const buf = a.buffers.get(cue.slot);
    if (!buf) return;                       // a missing cue is simply silence

    const c = a.ctx;
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = cue.loop;
    const g = c.createGain();
    g.gain.value = 0;
    src.connect(g);
    g.connect(a.bus.music);
    try { src.start(); } catch (e) { return; }
    const target = cue.vol * (a.norm.get(cue.slot) || 1);
    g.gain.setTargetAtTime(target, c.currentTime, Math.max(0.1, cue.fade / 3));
    this.cur = { name, src, gain: g };
  }

  stop(fade = 2.0) {
    const cur = this.cur;
    if (!cur) return;
    this.cur = null;
    const c = this.audio.ctx;
    try {
      cur.gain.gain.cancelScheduledValues(c.currentTime);
      cur.gain.gain.setTargetAtTime(0, c.currentTime, Math.max(0.05, fade / 3));
      setTimeout(() => { try { cur.src.stop(); } catch (e) {} }, fade * 1000 + 400);
    } catch (e) { /* already gone */ }
  }

  get playing() { return this.cur ? this.cur.name : null; }
}

// Original, locally synthesized firearm sound. No external files or downloads.
// The dry blast stays centred; only its quieter reflections spread in stereo.
const VARIANTS = 4;
const banks = new WeakMap();
const TAU = Math.PI * 2;

function cacheSound(audio, variant, indoors) {
  const slot = `nc_shotgun_${indoors ? 'room' : 'open'}_${variant}`;
  if (!audio.buffers.has(slot)) audio.buffers.set(slot, createShotgunBuffer(audio.ctx, variant, indoors));
  audio.norm.set(slot, 1);
  return slot;
}

export async function prepareShotgunSounds(audio) {
  // Build during audio loading, so firing never needs to synthesize a new shot.
  // Yield between buffers to let the loading screen paint/respond.
  for (const indoors of [true, false]) for (let variant = 0; variant < VARIANTS; variant++) {
    cacheSound(audio, variant, indoors);
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}

export function createShotgunBuffer(ctx, variant = 0, indoors = false) {
  const rate = ctx.sampleRate;
  const duration = indoors ? 1.15 : .9;
  const length = Math.ceil(rate * duration);
  const dry = new Float32Array(length);
  const low = new Float32Array(length);
  let seed = (0x71c041 + variant * 977) >>> 0;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2147483648 - 1;
  };
  const coefficient = hz => 1 - Math.exp(-TAU * hz / rate);
  const aBass = coefficient(210), aMid = coefficient(1900), aHigh = coefficient(8200);
  const aReflection = coefficient(1350), aTail = coefficient(950);
  let bass = 0, mid = 0, high = 0, reflection = 0;
  const pitch = 1 + (variant - 1.5) * .012;
  for (let i = 0; i < length; i++) {
    const t = i / rate, noise = random();
    bass += aBass * (noise - bass);
    mid += aMid * (noise - mid);
    high += aHigh * (noise - high);
    // A sub-millisecond onset avoids a digital discontinuity without blunting
    // the crack. Body noise and a dropping pressure pulse give the blast mass.
    const attack = 1 - Math.exp(-t / .00035);
    const crack = (high - mid) * 1.75 * Math.exp(-t / .011);
    const blast = (mid - bass) * 1.15 * Math.exp(-t / .068);
    const rumble = bass * 2.0 * Math.exp(-t / .115);
    const phase = TAU * pitch * (58 * t + 3.5 * (1 - Math.exp(-t / .035)));
    const pressure = (Math.sin(phase) + .19 * Math.sin(phase * 1.93)) * .32 * Math.exp(-t / .075);
    // Brief receiver chatter, well below the blast, not an unrelated key jingle.
    const u = t - .073;
    const mechanism = u > 0 ? (1 - Math.exp(-u / .0007)) * Math.exp(-u / .016) *
      (.024 * Math.sin(TAU * 1730 * u) + .018 * Math.sin(TAU * 2670 * u) + .035 * (high - mid)) : 0;
    dry[i] = attack * (crack + blast + rumble + pressure) + mechanism;
    reflection += aReflection * (dry[i] - reflection);
    low[i] = reflection;
  }

  const buffer = ctx.createBuffer(2, length, rate);
  // Close hard walls indoors; fewer, softer returns across the forecourt.
  const taps = indoors
    ? [[.024,.16], [.041,.13], [.066,.11], [.093,.09], [.133,.065], [.191,.04]]
    : [[.105,.075], [.181,.043], [.287,.022]];
  let peak = 0;
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    const delays = taps.map(([time, gain], j) => [
      Math.round((time + (channel ? .003 : 0) + (j % 2 ? .002 : 0)) * rate), gain,
    ]);
    let tailLow = 0, previous = 0, dc = 0;
    const dcPole = Math.exp(-TAU * 25 / rate);
    for (let i = 0; i < length; i++) {
      const t = i / rate;
      let sample = dry[i];
      for (const [delay, gain] of delays) if (i >= delay) sample += low[i - delay] * gain;
      // A diffuse, low-passed tail joins the discrete reflections smoothly.
      tailLow += aTail * (random() - tailLow);
      const u = t - .04;
      if (u > 0) sample += tailLow * (indoors ? .16 : .045) *
        (1 - Math.exp(-u / .025)) * Math.exp(-u / (indoors ? .19 : .13));
      const filtered = sample - previous + dcPole * dc;
      previous = sample; dc = filtered;
      // Fade to actual zero, including the reverberation and DC-blocker tail.
      const fade = Math.min(1, (length - 1 - i) / (rate * .035));
      data[i] = filtered * fade;
      peak = Math.max(peak, Math.abs(data[i]));
    }
  }
  // Normalize the complete mix once, without clipping its transients. Playback
  // retains the previous shot's gain and uses the user's effects/master buses.
  const gain = peak > 0 ? .82 / peak : 1;
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) data[i] *= gain;
  }
  return buffer;
}

export function playShotgunBlast(audio) {
  if (!audio.ctx) return null;
  let bank = banks.get(audio);
  if (!bank || bank.ctx !== audio.ctx) {
    bank = { ctx: audio.ctx, next: 0 };
    banks.set(audio, bank);
  }
  const variant = bank.next++ % VARIANTS;
  const indoors = audio.inside !== false;
  const slot = cacheSound(audio, variant, indoors);
  return audio.play(slot, { vol: .64, rate: 1, bus: 'sfx' });
}

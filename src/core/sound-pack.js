// Edited field recordings. Paths stay relative to the game so the same assets
// work from the source folder and from the embedded single-file archive.
export async function loadSoundPack(audio) {
  audio.soundPack = { status: "loading", count: 0 };
  try {
    const response = await fetch("assets/audio/nc/manifest.json");
    if (!response.ok) throw new Error(`Sound manifest: ${response.status}`);
    const manifest = await response.json();
    const decoded = await Promise.all(manifest.cues.map(async (cue) => {
      const file = await fetch(cue.file);
      if (!file.ok) throw new Error(`${cue.id}: ${file.status}`);
      return { cue, buffer: await audio.ctx.decodeAudioData(await file.arrayBuffer()) };
    }));
    // Commit together, so a failed load retains the complete original mix.
    for (const { cue, buffer } of decoded) {
      for (const slot of [`nc_${cue.id}`, cue.replace_slot].filter(Boolean)) {
        const layer = audio.layers.get(slot);
        if (layer) {
          try { layer.src.stop(); } catch (_) {}
          layer.gain.disconnect();
          audio.layers.delete(slot);
        }
        audio.buffers.set(slot, buffer);
        audio.norm.set(slot, 1); // The edits are already levelled with headroom.
      }
    }
    audio.soundPack = { status: "ready", count: decoded.length };
  } catch (error) {
    audio.soundPack = { status: "fallback", count: 0, error: String(error) };
    console.warn("[audio] custom pack unavailable; using original recordings", error);
  }
}

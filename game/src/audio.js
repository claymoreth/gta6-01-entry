// CITY OF EMBERS — synthesized audio (original, Phase 3).
// All sounds are generated with the Web Audio API: engine hum (two
// oscillators through a low-pass filter, pitch follows speed), tyre skid
// (looped band-passed noise) and crash thuds (filtered noise bursts).
// No audio files, no network requests. Created on the first user gesture
// (the Start button), as browsers require.

export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineFilter = null;
  let engineGain = null;
  let noiseBuf = null;
  let skidGain = null;

  function init() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();

      // Engine: sawtooth + square sub-oscillator -> low-pass -> gain.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'square';
      engineOsc2.frequency.value = 28;
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const sub = ctx.createGain();
      sub.gain.value = 0.5;
      engineOsc.connect(engineFilter);
      engineOsc2.connect(sub);
      sub.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
      engineOsc2.start();

      // Shared 1s white-noise buffer for skid + crash.
      const len = ctx.sampleRate;
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

      // Skid: looped noise through a band-pass, gain 0 until skidding.
      const skidSrc = ctx.createBufferSource();
      skidSrc.buffer = noiseBuf;
      skidSrc.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 950;
      bp.Q.value = 1.1;
      skidGain = ctx.createGain();
      skidGain.gain.value = 0;
      skidSrc.connect(bp);
      bp.connect(skidGain);
      skidGain.connect(ctx.destination);
      skidSrc.start();
    } catch {
      ctx = null; // audio unavailable: the game still works, silently.
    }
  }

  // ratio 0..1 (speed / top speed). on=false silences the engine.
  function setEngine(ratio, on) {
    if (!ctx || !engineGain) return;
    const t = ctx.currentTime;
    engineGain.gain.setTargetAtTime(on ? 0.04 + ratio * 0.035 : 0, t, 0.1);
    engineOsc.frequency.setTargetAtTime(55 + ratio * 170, t, 0.08);
    engineOsc2.frequency.setTargetAtTime(28 + ratio * 82, t, 0.08);
    engineFilter.frequency.setTargetAtTime(420 + ratio * 950, t, 0.1);
  }

  function setSkid(on) {
    if (!ctx || !skidGain) return;
    skidGain.gain.setTargetAtTime(on ? 0.045 : 0, ctx.currentTime, 0.08);
  }

  // intensity: impact speed in m/s (4..~20).
  function crash(intensity) {
    if (!ctx || !noiseBuf) return;
    try {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 320;
      const g = ctx.createGain();
      const v = Math.min(0.5, 0.08 + intensity * 0.025);
      g.gain.setValueAtTime(v, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      src.connect(f);
      f.connect(g);
      g.connect(ctx.destination);
      src.start();
      src.stop(ctx.currentTime + 0.4);
    } catch { /* ignore audio errors */ }
  }

  return { init, setEngine, setSkid, crash };
}

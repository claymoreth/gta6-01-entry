export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineFilter = null;
  let engineGain = null;
  let noiseBuf = null;
  let skidGain = null;
  let sirenOsc = null;
  let sirenLfo = null;
  let sirenGain = null;
  function init() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
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
      sub.gain.value = .5;
      engineOsc.connect(engineFilter);
      engineOsc2.connect(sub);
      sub.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
      engineOsc2.start();
      const len = ctx.sampleRate;
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
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
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 900;
      sirenLfo = ctx.createOscillator();
      sirenLfo.type = 'sine';
      sirenLfo.frequency.value = .45;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 240;
      sirenLfo.connect(lfoGain);
      lfoGain.connect(sirenOsc.frequency);
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(ctx.destination);
      sirenOsc.start();
      sirenLfo.start();
    } catch {
      ctx = null;
    }
  }
  function setEngine(ratio, on) {
    if (!ctx || !engineGain) return;
    const t = ctx.currentTime;
    engineGain.gain.setTargetAtTime(on ? .04 + ratio * .035 : 0, t, .1);
    engineOsc.frequency.setTargetAtTime(55 + ratio * 170, t, .08);
    engineOsc2.frequency.setTargetAtTime(28 + ratio * 82, t, .08);
    engineFilter.frequency.setTargetAtTime(420 + ratio * 950, t, .1);
  }
  function setSkid(on) {
    if (!ctx || !skidGain) return;
    skidGain.gain.setTargetAtTime(on ? .045 : 0, ctx.currentTime, .08);
  }
  function setSiren(on, level) {
    if (!ctx || !sirenGain) return;
    const v = on ? .018 + Math.min(1, level || 0) * .014 : 0;
    sirenGain.gain.setTargetAtTime(v, ctx.currentTime, .25);
  }
  function blip() {
    if (!ctx) return;
    try {
      const o = ctx.createOscillator();
      o.type = 'square';
      const g = ctx.createGain();
      g.gain.setValueAtTime(.05, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .28);
      o.connect(g);
      g.connect(ctx.destination);
      o.frequency.setValueAtTime(880, ctx.currentTime);
      o.frequency.setValueAtTime(660, ctx.currentTime + .14);
      o.start();
      o.stop(ctx.currentTime + .3);
    } catch {  }
  }
  function crash(intensity) {
    if (!ctx || !noiseBuf) return;
    try {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 320;
      const g = ctx.createGain();
      const v = Math.min(.5, .08 + intensity * .025);
      g.gain.setValueAtTime(v, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .35);
      src.connect(f);
      f.connect(g);
      g.connect(ctx.destination);
      src.start();
      src.stop(ctx.currentTime + .4);
    } catch {  }
  }
  function sfx(d, v, f) {
    if (!ctx || !noiseBuf) return;
    try {
      const s = ctx.createBufferSource();
      s.buffer = noiseBuf;
      const fl = ctx.createBiquadFilter();
      fl.type = 'lowpass';
      fl.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(v, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + d);
      s.connect(fl);
      fl.connect(g);
      g.connect(ctx.destination);
      s.start();
      s.stop(ctx.currentTime + d + .05);
    } catch {  }
  }
  function shot() { sfx(.12, .3, 1400); }
  return { init, setEngine, setSkid, crash, setSiren, blip, shot };
}

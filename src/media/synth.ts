/**
 * Procedural audio synthesis primitives (original sounds, no samples).
 * Works with both a live AudioContext (UI effects) and an OfflineAudioContext (video soundtrack).
 */

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();

export function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let b = noiseCache.get(ctx);
  if (!b) {
    const len = ctx.sampleRate * 2;
    b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    // Pinkish noise (Paul Kellet's economy filter)
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
    }
    noiseCache.set(ctx, b);
  }
  return b;
}

export function noiseSource(ctx: BaseAudioContext, loop = true) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = loop;
  return src;
}

type Dest = AudioNode;

export function env(ctx: BaseAudioContext, gain: GainNode, t: number, a: number, peak: number, d: number, sustain: number, r: number, hold = 0) {
  const g = gain.gain;
  g.cancelScheduledValues(t);
  g.setValueAtTime(0.0001, t);
  g.linearRampToValueAtTime(peak, t + a);
  g.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), t + a + d);
  g.setValueAtTime(Math.max(sustain, 0.0001), t + a + d + hold);
  g.exponentialRampToValueAtTime(0.0001, t + a + d + hold + r);
  void ctx;
}

export function tone(
  ctx: BaseAudioContext,
  dest: Dest,
  t: number,
  freq: number,
  dur: number,
  opts: { type?: OscillatorType; vol?: number; attack?: number; release?: number; detune?: number; cutoff?: number; glideTo?: number } = {},
) {
  const osc = ctx.createOscillator();
  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(freq, t);
  if (opts.glideTo) osc.frequency.exponentialRampToValueAtTime(opts.glideTo, t + dur);
  if (opts.detune) osc.detune.value = opts.detune;
  const g = ctx.createGain();
  const vol = opts.vol ?? 0.2;
  const attack = opts.attack ?? 0.01;
  const release = opts.release ?? 0.2;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.setValueAtTime(vol, t + Math.max(attack, dur - release));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node: AudioNode = osc;
  if (opts.cutoff) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = opts.cutoff;
    osc.connect(f);
    node = f;
  }
  node.connect(g).connect(dest);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

/** Thick detuned saw chord (brass / synth pad). */
export function chord(
  ctx: BaseAudioContext,
  dest: Dest,
  t: number,
  freqs: number[],
  dur: number,
  opts: { vol?: number; attack?: number; release?: number; cutoff?: number; type?: OscillatorType; cutoffEnd?: number } = {},
) {
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(opts.cutoff ?? 1800, t);
  if (opts.cutoffEnd) f.frequency.linearRampToValueAtTime(opts.cutoffEnd, t + dur);
  f.Q.value = 0.7;
  const g = ctx.createGain();
  const vol = opts.vol ?? 0.12;
  const attack = opts.attack ?? 0.08;
  const release = Math.min(opts.release ?? 0.4, dur * 0.9);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.setValueAtTime(vol, t + dur - release);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  f.connect(g).connect(dest);
  for (const fr of freqs) {
    for (const det of [-9, 0, 9]) {
      const o = ctx.createOscillator();
      o.type = opts.type ?? 'sawtooth';
      o.frequency.value = fr;
      o.detune.value = det;
      const og = ctx.createGain();
      og.gain.value = 1 / (freqs.length * 2.2);
      o.connect(og).connect(f);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
  }
}

export function kick(ctx: BaseAudioContext, dest: Dest, t: number, vol = 0.9) {
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + 0.5);
}

/** Big cinematic drum hit (low tom + noise transient). */
export function boom(ctx: BaseAudioContext, dest: Dest, t: number, vol = 1) {
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(90, t);
  o.frequency.exponentialRampToValueAtTime(32, t + 0.9);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + 1.7);
  const n = noiseSource(ctx, false);
  const nf = ctx.createBiquadFilter();
  nf.type = 'lowpass';
  nf.frequency.value = 900;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(vol * 0.6, t);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
  n.connect(nf).connect(ng).connect(dest);
  n.start(t);
  n.stop(t + 0.4);
}

export function snare(ctx: BaseAudioContext, dest: Dest, t: number, vol = 0.35) {
  const n = noiseSource(ctx, false);
  const f = ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 1400;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  n.connect(f).connect(g).connect(dest);
  n.start(t);
  n.stop(t + 0.25);
  tone(ctx, dest, t, 210, 0.12, { type: 'triangle', vol: vol * 0.5, release: 0.1 });
}

export function hat(ctx: BaseAudioContext, dest: Dest, t: number, vol = 0.08) {
  const n = noiseSource(ctx, false);
  const f = ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 7000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
  n.connect(f).connect(g).connect(dest);
  n.start(t);
  n.stop(t + 0.08);
}

/** Stadium crowd bed: band-passed noise with slow swells. */
export function crowd(ctx: BaseAudioContext, dest: Dest, t: number, dur: number, vol = 0.12, swell = 0) {
  const n = noiseSource(ctx);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 900;
  bp.Q.value = 0.5;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 2600;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + Math.min(1.2, dur / 3));
  if (swell > 0) {
    g.gain.linearRampToValueAtTime(vol * (1 + swell), t + dur * 0.35);
    g.gain.linearRampToValueAtTime(vol, t + dur * 0.8);
  }
  g.gain.setValueAtTime(vol, t + dur - Math.min(1.5, dur / 3));
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  n.connect(bp).connect(lp).connect(g).connect(dest);
  n.start(t);
  n.stop(t + dur + 0.1);
}

/** Crowd roar for goals / celebrations. */
export function roar(ctx: BaseAudioContext, dest: Dest, t: number, dur = 3, vol = 0.4) {
  const n = noiseSource(ctx);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(600, t);
  bp.frequency.linearRampToValueAtTime(1300, t + 0.6);
  bp.Q.value = 0.6;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.35);
  g.gain.setValueAtTime(vol * 0.9, t + dur * 0.5);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  n.connect(bp).connect(g).connect(dest);
  n.start(t);
  n.stop(t + dur + 0.1);
}

export function whistle(ctx: BaseAudioContext, dest: Dest, t: number, dur = 0.5, vol = 0.12) {
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.value = 2900;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 38;
  const lg = ctx.createGain();
  lg.gain.value = 120;
  lfo.connect(lg).connect(o.frequency);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.02);
  g.gain.setValueAtTime(vol, t + dur - 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest);
  o.start(t);
  lfo.start(t);
  o.stop(t + dur + 0.05);
  lfo.stop(t + dur + 0.05);
}

export function whoosh(ctx: BaseAudioContext, dest: Dest, t: number, dur = 0.6, vol = 0.25) {
  const n = noiseSource(ctx, false);
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 1.4;
  f.frequency.setValueAtTime(300, t);
  f.frequency.exponentialRampToValueAtTime(5000, t + dur * 0.7);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + dur * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  n.connect(f).connect(g).connect(dest);
  n.start(t);
  n.stop(t + dur + 0.05);
}

export function shimmer(ctx: BaseAudioContext, dest: Dest, t: number, base = 880, vol = 0.07) {
  [1, 1.5, 2, 3].forEach((m, i) => tone(ctx, dest, t + i * 0.05, base * m, 0.9, { type: 'triangle', vol: vol / (i + 1), release: 0.8 }));
}

export const NOTE = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

import { boom, chord, crowd, hat, kick, NOTE, roar, snare, tone, whistle, whoosh } from '../synth';

export type MusicStyle = 'epic' | 'anthem' | 'percussion' | 'ambient';

export const MUSIC_STYLES: { id: MusicStyle; label: string; desc: string }[] = [
  { id: 'epic', label: 'Épico orquestal', desc: 'Cuerdas en ostinato, metales y timbales cinematográficos.' },
  { id: 'anthem', label: 'Himno electrónico', desc: 'Pulso de estadio, sintetizadores y bombo a negras.' },
  { id: 'percussion', label: 'Percusión tribal', desc: 'Tambores graves y llamadas de cuerno, ritmo de hinchada.' },
  { id: 'ambient', label: 'Ambiente cinematográfico', desc: 'Pads amplios y notas suaves, emoción contenida.' },
];

export interface MusicCue {
  time: number;
  kind: 'boom' | 'roar' | 'whoosh' | 'whistle' | 'climax';
}

interface StyleDef {
  bpm: number;
  /** Chord roots (MIDI) and qualities for a 4-bar loop. */
  prog: { root: number; minor: boolean }[];
}

const STYLES: Record<MusicStyle, StyleDef> = {
  epic: { bpm: 92, prog: [{ root: 50, minor: true }, { root: 46, minor: false }, { root: 53, minor: false }, { root: 48, minor: false }] },
  anthem: { bpm: 124, prog: [{ root: 57, minor: true }, { root: 53, minor: false }, { root: 48, minor: false }, { root: 55, minor: false }] },
  percussion: { bpm: 108, prog: [{ root: 52, minor: true }, { root: 48, minor: false }, { root: 55, minor: false }, { root: 50, minor: false }] },
  ambient: { bpm: 72, prog: [{ root: 53, minor: false }, { root: 50, minor: true }, { root: 46, minor: false }, { root: 48, minor: false }] },
};

const triad = (root: number, minor: boolean) => [root, root + (minor ? 3 : 4), root + 7];

function impulse(ctx: BaseAudioContext, seconds = 2.6, decay = 2.8) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return b;
}

/**
 * Renders an ORIGINAL instrumental soundtrack procedurally (no samples, no copyrighted material).
 * Intensity builds through the video and peaks at the climax cue (the final / champion).
 */
export async function renderSoundtrack(o: { style: MusicStyle; duration: number; crowd: boolean; cues: MusicCue[]; sampleRate?: number }): Promise<AudioBuffer> {
  const sr = o.sampleRate ?? 48000;
  const ctx = new OfflineAudioContext(2, Math.ceil(o.duration * sr), sr);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  comp.attack.value = 0.01;
  comp.release.value = 0.25;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, 0);
  master.gain.linearRampToValueAtTime(0.9, 0.6);
  master.gain.setValueAtTime(0.9, Math.max(0.7, o.duration - 2.8));
  master.gain.linearRampToValueAtTime(0.0001, o.duration);
  master.connect(comp).connect(ctx.destination);
  const verb = ctx.createConvolver();
  verb.buffer = impulse(ctx);
  const wet = ctx.createGain();
  wet.gain.value = o.style === 'ambient' ? 0.55 : 0.32;
  verb.connect(wet).connect(master);
  const bus = ctx.createGain();
  bus.connect(master);
  bus.connect(verb);
  const drums = ctx.createGain();
  drums.gain.value = 0.8;
  drums.connect(master);

  const S = STYLES[o.style];
  const beat = 60 / S.bpm;
  const bar = beat * 4;
  const climax = o.cues.find((c) => c.kind === 'climax')?.time ?? o.duration * 0.78;
  const intensity = (t: number) => {
    if (t >= climax) return t > o.duration - 3 ? 0.6 : 1;
    return 0.25 + 0.65 * Math.pow(t / climax, 1.1);
  };
  const bars = Math.ceil(o.duration / bar);

  for (let b = 0; b < bars; b++) {
    const t0 = b * bar;
    if (t0 > o.duration - 0.2) break;
    const I = intensity(t0);
    const c = S.prog[b % S.prog.length];
    const notes = triad(c.root, c.minor).map(NOTE);
    const dur = Math.min(bar, o.duration - t0);
    const finalBar = t0 + bar >= o.duration - 3.2;

    // Pad / strings
    chord(ctx, bus, t0, notes, dur + 0.05, { vol: (o.style === 'ambient' ? 0.11 : 0.07) * (0.6 + I * 0.5), attack: o.style === 'ambient' ? 0.8 : 0.25, release: 0.4, cutoff: 900 + I * 2200, type: o.style === 'anthem' ? 'sawtooth' : 'sawtooth' });
    // Bass
    if (I > 0.3) {
      const bassF = NOTE(c.root - 12);
      if (o.style === 'anthem') for (let k = 0; k < 8; k++) tone(ctx, bus, t0 + k * beat * 0.5 + beat * 0.25, bassF, beat * 0.4, { type: 'sawtooth', vol: 0.11, cutoff: 600, release: 0.1 });
      else tone(ctx, bus, t0, bassF, dur, { type: 'triangle', vol: 0.16 * I, attack: 0.05, release: 0.5 });
    }
    // Ostinato / arpeggio
    if (I > 0.45 && !finalBar) {
      const steps = o.style === 'ambient' ? 4 : 8;
      const step = bar / steps;
      const arp = [...notes, notes[1] * 2, notes[0] * 2, notes[2], notes[1], notes[0] * 2];
      for (let k = 0; k < steps; k++) {
        tone(ctx, bus, t0 + k * step, arp[k % arp.length] * (o.style === 'ambient' ? 2 : 1), step * (o.style === 'ambient' ? 2.5 : 0.9), {
          type: o.style === 'anthem' ? 'square' : 'triangle',
          vol: (o.style === 'anthem' ? 0.035 : 0.055) * I,
          cutoff: o.style === 'anthem' ? 2500 : 4000,
          release: step * 0.6,
        });
      }
    }
    // Brass swells at high intensity
    if (I > 0.75 && (o.style === 'epic' || o.style === 'percussion') && b % 2 === 0) {
      chord(ctx, bus, t0, notes.map((f) => f / 2), bar * 0.95, { vol: 0.07, attack: 0.5, release: 0.6, cutoff: 700, cutoffEnd: 2400 });
    }
    // Drums
    for (let k = 0; k < 4; k++) {
      const tb = t0 + k * beat;
      if (tb > o.duration - 2.5) break;
      if (o.style === 'epic') {
        if (k === 0 && I > 0.35) boom(ctx, drums, tb, 0.45 + I * 0.35);
        if (k === 2 && I > 0.6) snare(ctx, drums, tb, 0.18 * I);
        if (I > 0.85) {
          tone(ctx, drums, tb + beat / 2, 120, 0.25, { type: 'sine', vol: 0.22, glideTo: 60, release: 0.2 });
        }
      } else if (o.style === 'anthem') {
        if (I > 0.3) kick(ctx, drums, tb, 0.7);
        if (I > 0.45) hat(ctx, drums, tb + beat / 2, 0.07);
        if ((k === 1 || k === 3) && I > 0.55) snare(ctx, drums, tb, 0.22);
      } else if (o.style === 'percussion') {
        if (I > 0.25) boom(ctx, drums, tb, k === 0 ? 0.7 : 0.35);
        if (I > 0.4) {
          tone(ctx, drums, tb + beat * 0.5, 180, 0.2, { type: 'sine', vol: 0.18, glideTo: 90, release: 0.15 });
          tone(ctx, drums, tb + beat * 0.75, 220, 0.18, { type: 'sine', vol: 0.14, glideTo: 110, release: 0.12 });
        }
        if (I > 0.55) for (let s = 0; s < 4; s++) hat(ctx, drums, tb + (s * beat) / 4, 0.04);
      } else if (o.style === 'ambient') {
        if (k === 0 && I > 0.8) boom(ctx, drums, tb, 0.4);
      }
    }
  }

  // Ending chord
  const endT = Math.max(0, o.duration - 3.2);
  const tonic = triad(S.prog[0].root, S.prog[0].minor && o.style !== 'epic' ? true : false).map(NOTE);
  chord(ctx, bus, endT, [...tonic, tonic[0] * 2], 3.2, { vol: 0.12, attack: 0.1, release: 2.5, cutoff: 3000 });
  boom(ctx, drums, endT, 0.9);

  // Cues
  for (const cue of o.cues) {
    if (cue.time >= o.duration - 0.1) continue;
    if (cue.kind === 'boom' || cue.kind === 'climax') boom(ctx, drums, cue.time, cue.kind === 'climax' ? 1 : 0.7);
    if (cue.kind === 'whoosh') whoosh(ctx, master, Math.max(0, cue.time - 0.55), 0.6, 0.18);
    if (cue.kind === 'whistle') {
      whistle(ctx, master, cue.time, 0.25, 0.08);
      whistle(ctx, master, cue.time + 0.32, 0.6, 0.08);
    }
    if (o.crowd && (cue.kind === 'roar' || cue.kind === 'climax')) roar(ctx, master, cue.time, 3.5, 0.28);
  }
  if (o.crowd) crowd(ctx, master, 0, o.duration, 0.055, 0.5);

  return ctx.startRendering();
}

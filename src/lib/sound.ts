import { boom, chord, crowd, NOTE, roar, shimmer, tone, whistle, whoosh } from '../media/synth';

/** Live UI sound effects (all synthesised; can be muted in Settings). */
class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  enabled = true;
  volume = 0.7;

  private ensure(): { ctx: AudioContext; out: GainNode } | null {
    if (!this.enabled || typeof window === 'undefined') return null;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    if (!this.ctx) {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    this.master!.gain.value = this.volume;
    return { ctx: this.ctx, out: this.master! };
  }

  click() {
    const a = this.ensure();
    if (!a) return;
    tone(a.ctx, a.out, a.ctx.currentTime, 1300, 0.05, { type: 'triangle', vol: 0.05, release: 0.04 });
  }
  tumble() {
    const a = this.ensure();
    if (!a) return;
    const t = a.ctx.currentTime;
    for (let i = 0; i < 7; i++) tone(a.ctx, a.out, t + i * 0.045 + Math.random() * 0.02, 600 + Math.random() * 900, 0.04, { type: 'triangle', vol: 0.03, release: 0.03 });
  }
  reveal() {
    const a = this.ensure();
    if (!a) return;
    const t = a.ctx.currentTime;
    whoosh(a.ctx, a.out, t, 0.35, 0.12);
    shimmer(a.ctx, a.out, t + 0.22, 784, 0.08);
  }
  place() {
    const a = this.ensure();
    if (!a) return;
    tone(a.ctx, a.out, a.ctx.currentTime, 520, 0.12, { type: 'sine', vol: 0.08, release: 0.1, glideTo: 780 });
  }
  whistle() {
    const a = this.ensure();
    if (!a) return;
    const t = a.ctx.currentTime;
    whistle(a.ctx, a.out, t, 0.25);
    whistle(a.ctx, a.out, t + 0.35, 0.7);
  }
  goal() {
    const a = this.ensure();
    if (!a) return;
    const t = a.ctx.currentTime;
    boom(a.ctx, a.out, t, 0.6);
    roar(a.ctx, a.out, t, 3.2, 0.32);
    chord(a.ctx, a.out, t + 0.05, [NOTE(60), NOTE(64), NOTE(67)], 1.1, { vol: 0.08, cutoff: 2600 });
  }
  qualified() {
    const a = this.ensure();
    if (!a) return;
    const t = a.ctx.currentTime;
    [0, 0.12, 0.24].forEach((d, i) => tone(a.ctx, a.out, t + d, NOTE(72 + [0, 4, 7][i]), 0.5, { type: 'triangle', vol: 0.09, release: 0.4 }));
    shimmer(a.ctx, a.out, t + 0.3, 1046, 0.06);
  }
  phase() {
    const a = this.ensure();
    if (!a) return;
    const t = a.ctx.currentTime;
    whoosh(a.ctx, a.out, t, 0.8, 0.2);
    boom(a.ctx, a.out, t + 0.55, 0.7);
    chord(a.ctx, a.out, t + 0.55, [NOTE(50), NOTE(57), NOTE(62)], 1.6, { vol: 0.09, cutoff: 1500 });
  }
  champion() {
    const a = this.ensure();
    if (!a) return;
    const t = a.ctx.currentTime;
    boom(a.ctx, a.out, t, 0.9);
    roar(a.ctx, a.out, t, 6, 0.35);
    crowd(a.ctx, a.out, t, 8, 0.1, 0.6);
    const prog = [
      [NOTE(60), NOTE(64), NOTE(67)],
      [NOTE(65), NOTE(69), NOTE(72)],
      [NOTE(67), NOTE(71), NOTE(74)],
      [NOTE(72), NOTE(76), NOTE(79)],
    ];
    prog.forEach((c, i) => chord(a.ctx, a.out, t + 0.2 + i * 0.55, c, i === 3 ? 2.4 : 0.6, { vol: 0.1, cutoff: 3000 }));
    boom(a.ctx, a.out, t + 1.85, 0.8);
  }
}

export const sound = new SoundEngine();

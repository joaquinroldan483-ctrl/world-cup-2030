import { hashString } from './random';
import { eventPeriod, isGoal } from './results';
import type { MatchEvent, MatchResult } from './types';

/** Minutes per momentum block. */
export const MOMENTUM_BLOCK = 5;
export const MOMENTUM_BLOCKS_REGULAR = 18;
export const MOMENTUM_BLOCKS_EXTRA = 24;

const clamp = (v: number) => Math.max(-100, Math.min(100, Math.round(v)));

export function hasExtraTime(r: Pick<MatchResult, 'extraTime' | 'events'>): boolean {
  return !!r.extraTime || r.events.some((e) => eventPeriod(e) === 'extra');
}

/** Number of blocks a match needs (90' or 120'). */
export function momentumBlocks(r: Pick<MatchResult, 'extraTime' | 'events'>, knockout: boolean): number {
  return knockout && hasExtraTime(r) ? MOMENTUM_BLOCKS_EXTRA : MOMENTUM_BLOCKS_REGULAR;
}

export function blockLabel(i: number): string {
  return `${i * MOMENTUM_BLOCK + 1}'–${(i + 1) * MOMENTUM_BLOCK}'`;
}

export function blockOfEvent(e: Pick<MatchEvent, 'minute' | 'type'>, blocks: number): number {
  const m = e.type === 'et_goal' ? Math.max(91, e.minute) : e.minute;
  return Math.max(0, Math.min(blocks - 1, Math.floor((Math.max(1, m) - 1) / MOMENTUM_BLOCK)));
}

/** Pads with neutral blocks or trims to the requested length; sanitises values. */
export function fitMomentum(values: number[] | null | undefined, blocks: number): number[] {
  const out = Array.from({ length: blocks }, (_, i) => clamp(Number(values?.[i]) || 0));
  return out;
}

export function smoothMomentum(values: number[]): number[] {
  return values.map((v, i) => clamp(((values[i - 1] ?? v) + v * 2 + (values[i + 1] ?? v)) / 4));
}

/**
 * Builds a momentum curve from the registered events: pressure before each goal,
 * a reaction from the conceding team, red cards tilting the rest of the match, missed penalties as pressure.
 * Deterministic: the same match always produces the same curve.
 */
export function autoMomentum(r: MatchResult, knockout: boolean): number[] {
  const n = momentumBlocks(r, knockout);
  const v = new Array<number>(n).fill(0);
  const sideOf = (teamId: string) => (teamId === r.homeId ? 1 : teamId === r.awayId ? -1 : 0);
  const totalHome = r.regular.home + (r.extraTime?.home ?? 0);
  const totalAway = r.regular.away + (r.extraTime?.away ?? 0);
  // Overall tilt from the final score.
  const tilt = Math.max(-1, Math.min(1, (totalHome - totalAway) / 3)) * 14;
  for (let i = 0; i < n; i++) {
    const noise = ((hashString(`${r.homeId}${r.awayId}${i}`) % 1000) / 1000) * 2 - 1;
    v[i] += tilt + noise * 22;
  }
  for (const e of r.events) {
    if (eventPeriod(e) === 'shootout') continue;
    const s = sideOf(e.teamId);
    if (!s) continue;
    const b = blockOfEvent(e, n);
    const add = (i: number, x: number) => {
      if (i >= 0 && i < n) v[i] += x;
    };
    if (isGoal(e)) {
      add(b, 70 * s);
      add(b - 1, 45 * s);
      add(b - 2, 20 * s);
      add(b + 1, -28 * s);
    } else if (e.type === 'penalty_miss') {
      add(b, 35 * s);
    } else if (e.type === 'red') {
      for (let i = b; i < n; i++) v[i] -= 18 * s;
    } else if (e.type === 'yellow') {
      add(b, -8 * s);
    }
  }
  return smoothMomentum(v.map(clamp));
}

/** Share of dominance (0–100) for each side, from the area of the bars. */
export function dominance(values: number[]): { home: number; away: number } {
  const pos = values.reduce((n, x) => n + Math.max(0, x), 0);
  const neg = values.reduce((n, x) => n + Math.max(0, -x), 0);
  const total = pos + neg;
  if (!total) return { home: 50, away: 50 };
  const home = Math.round((pos / total) * 100);
  return { home, away: 100 - home };
}

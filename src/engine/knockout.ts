import { GROUP_LETTERS, STAGE_SHORT, type KnockoutStage } from './types';
import { FORMATS, firstRound, type FormatDef, type TeamCount } from './formats';

export type Source =
  | { kind: 'group'; group: number; position: 1 | 2 }
  /** One of the best third-placed teams; slot k is resolved once all groups are decided. */
  | { kind: 'third'; slot: number }
  | { kind: 'winner'; matchId: string }
  | { kind: 'loser'; matchId: string };

export interface BracketSlot {
  id: string;
  stage: KnockoutStage;
  /** 1-based index within the stage. */
  index: number;
  home: Source;
  away: Source;
  /** Side of the visual bracket. */
  side: 'left' | 'right' | 'center';
}

export const koId = (stage: KnockoutStage, index: number) =>
  stage === 'F' || stage === '3P' ? stage : `${stage}-${index}`;

const NEXT: Partial<Record<KnockoutStage, KnockoutStage>> = { R32: 'R16', R16: 'QF', QF: 'SF' };

type Pair = { home: Source; away: Source; groups: number[] };

/** First-round pairings for a format. */
function firstRoundPairs(f: FormatDef): { top: Pair[]; bottom: Pair[] } {
  const G = f.groups;
  const T = f.thirds;
  const W = (g: number): Source => ({ kind: 'group', group: g, position: 1 });
  const R = (g: number): Source => ({ kind: 'group', group: g, position: 2 });
  if (!T) {
    // Winners face the runner-up of the paired group; a group's top two go to opposite halves.
    const top: Pair[] = [];
    const bottom: Pair[] = [];
    for (let i = 0; i < G / 2; i++) {
      top.push({ home: W(2 * i), away: R(2 * i + 1), groups: [2 * i, 2 * i + 1] });
      bottom.push({ home: W(2 * i + 1), away: R(2 * i), groups: [2 * i, 2 * i + 1] });
    }
    return { top, bottom };
  }
  // With best thirds: the first T group winners face a third; the other winners face runners-up;
  // the remaining runners-up face each other.
  const pairs: Pair[] = [];
  for (let k = 0; k < T; k++) pairs.push({ home: W(k), away: { kind: 'third', slot: k }, groups: [k] });
  for (let g = T; g < G; g++) pairs.push({ home: W(g), away: R(g - T), groups: [g, g - T] });
  for (let g = G - T; g < G; g += 2) pairs.push({ home: R(g), away: R(g + 1), groups: [g, g + 1] });
  // Spread into halves so each group's teams end up apart whenever possible.
  const half = pairs.length / 2;
  const top: Pair[] = [];
  const bottom: Pair[] = [];
  const used = [new Set<number>(), new Set<number>()];
  for (const p of pairs) {
    const clash = [0, 1].map((h) => p.groups.filter((g) => used[h].has(g)).length);
    const room = [top.length < half, bottom.length < half];
    let h = clash[0] <= clash[1] ? 0 : 1;
    if (!room[h]) h = 1 - h;
    else if (clash[0] === clash[1] && room[1 - h] && (h === 0 ? top : bottom).length > (h === 0 ? bottom : top).length) h = 1 - h;
    (h === 0 ? top : bottom).push(p);
    p.groups.forEach((g) => used[h].add(g));
  }
  return { top, bottom };
}

/**
 * Generates the full knockout structure dynamically for any supported format.
 * 64/32/16 teams: group winners face runners-up of the paired group, each group's top two in opposite halves.
 * 48/24 teams: the best third-placed teams are added and assigned so they never meet their own group winner.
 */
export function buildBracket(teams: TeamCount = 64): BracketSlot[] {
  const f = FORMATS[teams];
  const first = firstRound(f.bracket);
  const { top, bottom } = firstRoundPairs(f);
  const slots: BracketSlot[] = [];
  [...top, ...bottom].forEach((p, i) =>
    slots.push({ id: koId(first, i + 1), stage: first, index: i + 1, home: p.home, away: p.away, side: i < top.length ? 'left' : 'right' }),
  );
  let prev = first;
  let count = top.length + bottom.length;
  while (NEXT[prev]) {
    const stage = NEXT[prev]!;
    count /= 2;
    for (let k = 1; k <= count; k++) {
      slots.push({
        id: koId(stage, k),
        stage,
        index: k,
        home: { kind: 'winner', matchId: koId(prev, 2 * k - 1) },
        away: { kind: 'winner', matchId: koId(prev, 2 * k) },
        side: k <= count / 2 ? 'left' : 'right',
      });
    }
    prev = stage;
  }
  slots.push({ id: '3P', stage: '3P', index: 1, home: { kind: 'loser', matchId: koId('SF', 1) }, away: { kind: 'loser', matchId: koId('SF', 2) }, side: 'center' });
  slots.push({ id: 'F', stage: 'F', index: 1, home: { kind: 'winner', matchId: koId('SF', 1) }, away: { kind: 'winner', matchId: koId('SF', 2) }, side: 'center' });
  return slots;
}

const cache = new Map<TeamCount, { slots: BracketSlot[]; byId: Record<string, BracketSlot> }>();

export function bracketFor(teams: TeamCount = 64) {
  if (!cache.has(teams)) {
    const slots = buildBracket(teams);
    cache.set(teams, { slots, byId: Object.fromEntries(slots.map((s) => [s.id, s])) });
  }
  return cache.get(teams)!;
}

/** Default (64-team) bracket. */
export const BRACKET = bracketFor(64).slots;
export const BRACKET_BY_ID: Record<string, BracketSlot> = bracketFor(64).byId;

export function describeSource(src: Source): string {
  if (src.kind === 'group') return `${src.position}º Grupo ${GROUP_LETTERS[src.group]}`;
  if (src.kind === 'third') return `Mejor 3º (${src.slot + 1})`;
  const slot = BRACKET_BY_ID[src.matchId];
  const label = slot ? `${STAGE_SHORT[slot.stage]}${slot.stage === 'F' || slot.stage === '3P' ? '' : ' ' + slot.index}` : src.matchId;
  return `${src.kind === 'winner' ? 'Ganador' : 'Perdedor'} ${label}`;
}

/** All matches that (directly or indirectly) depend on the given match. */
export function downstreamOf(matchId: string, teams: TeamCount = 64): string[] {
  const BRACKET = bracketFor(teams).slots;
  const out = new Set<string>();
  const visit = (id: string) => {
    for (const s of BRACKET) {
      const dep = [s.home, s.away].some((src) => (src.kind === 'winner' || src.kind === 'loser') && src.matchId === id);
      if (dep && !out.has(s.id)) {
        out.add(s.id);
        visit(s.id);
      }
    }
  };
  visit(matchId);
  return [...out];
}

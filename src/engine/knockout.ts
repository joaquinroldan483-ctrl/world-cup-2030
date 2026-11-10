import { GROUP_COUNT, GROUP_LETTERS, STAGE_SHORT, type KnockoutStage } from './types';

export type Source =
  | { kind: 'group'; group: number; position: 1 | 2 }
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

/**
 * Generates the full knockout structure dynamically.
 * Round of 32 pairing: group winners face runners-up of the paired group,
 * with each group's top two placed in opposite halves (they can only meet in the final).
 *   Top half:    1A–2B, 1C–2D, …, 1O–2P
 *   Bottom half: 1B–2A, 1D–2C, …, 1P–2O
 */
export function buildBracket(): BracketSlot[] {
  const slots: BracketSlot[] = [];
  const pairs = GROUP_COUNT / 2;
  for (let i = 0; i < pairs; i++) {
    slots.push({
      id: koId('R32', i + 1),
      stage: 'R32',
      index: i + 1,
      home: { kind: 'group', group: 2 * i, position: 1 },
      away: { kind: 'group', group: 2 * i + 1, position: 2 },
      side: 'left',
    });
  }
  for (let i = 0; i < pairs; i++) {
    slots.push({
      id: koId('R32', pairs + i + 1),
      stage: 'R32',
      index: pairs + i + 1,
      home: { kind: 'group', group: 2 * i + 1, position: 1 },
      away: { kind: 'group', group: 2 * i, position: 2 },
      side: 'right',
    });
  }
  const next = (prev: KnockoutStage, stage: KnockoutStage, count: number) => {
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
  };
  next('R32', 'R16', 8);
  next('R16', 'QF', 4);
  next('QF', 'SF', 2);
  slots.push({
    id: '3P',
    stage: '3P',
    index: 1,
    home: { kind: 'loser', matchId: koId('SF', 1) },
    away: { kind: 'loser', matchId: koId('SF', 2) },
    side: 'center',
  });
  slots.push({
    id: 'F',
    stage: 'F',
    index: 1,
    home: { kind: 'winner', matchId: koId('SF', 1) },
    away: { kind: 'winner', matchId: koId('SF', 2) },
    side: 'center',
  });
  return slots;
}

export const BRACKET = buildBracket();
export const BRACKET_BY_ID: Record<string, BracketSlot> = Object.fromEntries(BRACKET.map((s) => [s.id, s]));

export function describeSource(src: Source): string {
  if (src.kind === 'group') return `${src.position}º Grupo ${GROUP_LETTERS[src.group]}`;
  const slot = BRACKET_BY_ID[src.matchId];
  const label = slot ? `${STAGE_SHORT[slot.stage]}${slot.stage === 'F' || slot.stage === '3P' ? '' : ' ' + slot.index}` : src.matchId;
  return `${src.kind === 'winner' ? 'Ganador' : 'Perdedor'} ${label}`;
}

/** All matches that (directly or indirectly) depend on the given match. */
export function downstreamOf(matchId: string): string[] {
  const out = new Set<string>();
  const visit = (id: string) => {
    for (const s of BRACKET) {
      const dep = [s.home, s.away].some((src) => src.kind !== 'group' && src.matchId === id);
      if (dep && !out.has(s.id)) {
        out.add(s.id);
        visit(s.id);
      }
    }
  };
  visit(matchId);
  return [...out];
}

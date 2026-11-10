import { DEFAULT_DRAW_CONFIG } from './draw';
import { BRACKET, type BracketSlot, type Source } from './knockout';
import { uid } from './random';
import { computeGroupTable, type GroupTable } from './standings';
import { resolveOutcome, type Outcome } from './results';
import { DEFAULT_RANKING, TEAMS } from './teams';
import {
  DEFAULT_TIEBREAKERS,
  GROUP_LETTERS,
  type KnockoutStage,
  type MatchResult,
  type Tournament,
} from './types';

export const DEFAULT_KICKOFF = '2030-06-13T19:00';

export function createTournament(name = 'Mi Mundial 2030'): Tournament {
  const now = Date.now();
  return {
    id: uid('t_'),
    name,
    createdAt: now,
    updatedAt: now,
    schema: 1,
    teamNames: {},
    ranking: DEFAULT_RANKING.slice(),
    drawConfig: structuredClone(DEFAULT_DRAW_CONFIG),
    groups: null,
    drawSteps: [],
    drawMode: null,
    results: {},
    tiebreakers: DEFAULT_TIEBREAKERS.slice(),
    seed: uid('s'),
    kickoff: DEFAULT_KICKOFF,
  };
}

export const ALL_TEAM_IDS = TEAMS.map((t) => t.id);

export interface GroupView {
  index: number;
  letter: string;
  teamIds: string[];
  table: GroupTable;
}

export interface KOMatchView extends BracketSlot {
  homeId?: string;
  awayId?: string;
  /** Valid result for the current participants. */
  result?: MatchResult;
  /** A stored result that no longer matches the participants. */
  stale: boolean;
  outcome: Outcome | null;
  winnerId?: string;
  loserId?: string;
}

export interface Progress {
  groupPlayed: number;
  groupTotal: number;
  koPlayed: number;
  koTotal: number;
  groupsComplete: number;
}

export interface DerivedTournament {
  t: Tournament;
  drawn: boolean;
  groups: GroupView[];
  knockout: KOMatchView[];
  ko: Record<string, KOMatchView>;
  qualified: string[];
  champion?: string;
  runnerUp?: string;
  third?: string;
  fourth?: string;
  progress: Progress;
}

/** Derives every computed view of the tournament (tables, bracket, propagation) from raw state. */
export function deriveTournament(t: Tournament): DerivedTournament {
  const groups: GroupView[] = (t.groups ?? []).map((teamIds, index) => ({
    index,
    letter: GROUP_LETTERS[index],
    teamIds,
    table: computeGroupTable(index, teamIds, t.results, t.tiebreakers, t.seed),
  }));

  const ko: Record<string, KOMatchView> = {};
  const resolve = (src: Source): string | undefined => {
    if (src.kind === 'group') {
      const g = groups[src.group];
      if (!g || !g.table.complete) return undefined;
      return g.table.rows[src.position - 1]?.teamId;
    }
    const m = ko[src.matchId];
    if (!m) return undefined;
    return src.kind === 'winner' ? m.winnerId : m.loserId;
  };

  // BRACKET is topologically ordered (each slot only depends on earlier ones).
  for (const slot of BRACKET) {
    const homeId = resolve(slot.home);
    const awayId = resolve(slot.away);
    const stored = t.results[slot.id];
    let result: MatchResult | undefined;
    let stale = false;
    if (stored) {
      if (homeId && awayId && stored.homeId === homeId && stored.awayId === awayId) result = stored;
      else stale = true;
    }
    const outcome = result ? resolveOutcome(result) : null;
    const winnerId = outcome?.winner ? (outcome.winner === 'home' ? homeId : awayId) : undefined;
    const loserId = outcome?.winner ? (outcome.winner === 'home' ? awayId : homeId) : undefined;
    ko[slot.id] = { ...slot, homeId, awayId, result, stale, outcome, winnerId, loserId };
  }

  const knockout = BRACKET.map((s) => ko[s.id]);
  const groupPlayed = groups.reduce((n, g) => n + g.table.played, 0);
  const qualified = groups.every((g) => g.table.complete)
    ? groups.flatMap((g) => g.table.rows.slice(0, 2).map((r) => r.teamId))
    : groups.flatMap((g) => (g.table.complete ? g.table.rows.slice(0, 2).map((r) => r.teamId) : []));

  return {
    t,
    drawn: !!t.groups,
    groups,
    knockout,
    ko,
    qualified,
    champion: ko.F?.winnerId,
    runnerUp: ko.F?.loserId,
    third: ko['3P']?.winnerId,
    fourth: ko['3P']?.loserId,
    progress: {
      groupPlayed,
      groupTotal: groups.length * 6 || 96,
      koPlayed: knockout.filter((m) => m.winnerId).length,
      koTotal: knockout.length,
      groupsComplete: groups.filter((g) => g.table.complete).length,
    },
  };
}

export function stageMatches(d: DerivedTournament, stage: KnockoutStage): KOMatchView[] {
  return d.knockout.filter((m) => m.stage === stage);
}

/** Phase the tournament is currently in. */
export function currentPhase(d: DerivedTournament): 'draw' | 'groups' | KnockoutStage | 'finished' {
  if (!d.drawn) return 'draw';
  if (d.progress.groupsComplete < d.groups.length) return 'groups';
  if (d.champion) return 'finished';
  for (const s of ['R32', 'R16', 'QF', 'SF'] as KnockoutStage[]) {
    if (stageMatches(d, s).some((m) => !m.winnerId)) return s;
  }
  return 'F';
}

/**
 * Removes knockout results that no longer match their participants, repeatedly,
 * until the bracket is consistent. Returns the pruned tournament and the removed match ids.
 */
export function cascadePrune(t: Tournament): { tournament: Tournament; removed: string[] } {
  let cur = t;
  const removed: string[] = [];
  for (let i = 0; i < 10; i++) {
    const d = deriveTournament(cur);
    const stale = d.knockout.filter((m) => m.stale).map((m) => m.id);
    if (!stale.length) break;
    const results = { ...cur.results };
    for (const id of stale) delete results[id];
    removed.push(...stale);
    cur = { ...cur, results };
  }
  return { tournament: cur, removed };
}

/** Knockout matches with a valid result in `before` that would be invalidated by moving to `after`. */
export function invalidatedBy(before: Tournament, after: Tournament): { tournament: Tournament; affected: string[] } {
  const db = deriveTournament(before);
  const { tournament, removed } = cascadePrune(after);
  const affected = removed.filter((id) => db.ko[id]?.result);
  return { tournament, affected };
}

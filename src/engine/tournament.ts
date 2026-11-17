import { DEFAULT_DRAW_CONFIG } from './draw';
import { BRACKET, type BracketSlot, type Source } from './knockout';
import { uid } from './random';
import { computeGroupTable, type GroupTable } from './standings';
import { resolveOutcome, type Outcome } from './results';
import { DEFAULT_PARTICIPANTS, DEFAULT_RANKING, TEAM_BY_ID } from './teams';
import { EDITIONS, type EditionId } from './editions';
import {
  DEFAULT_TIEBREAKERS,
  GROUP_LETTERS,
  type KnockoutStage,
  type MatchResult,
  type Tournament,
} from './types';

export const DEFAULT_KICKOFF = '2030-06-13T19:00';

/** Ranking restricted to the participants, keeping the default order and appending newcomers. */
export function rankingFor(participants: string[], base: string[] = DEFAULT_RANKING): string[] {
  const inBase = base.filter((id) => participants.includes(id));
  return [...inBase, ...participants.filter((id) => !inBase.includes(id))];
}

export function createTournament(name?: string, edition: EditionId = '2030'): Tournament {
  const now = Date.now();
  const ed = EDITIONS[edition];
  const participants = DEFAULT_PARTICIPANTS.slice();
  return {
    id: uid('t_'),
    name: name ?? `Mi Mundial ${ed.year}`,
    edition,
    participants,
    hosts: ed.defaultHosts.filter((h) => participants.includes(h)),
    groupOverrides: {},
    createdAt: now,
    updatedAt: now,
    schema: 1,
    teamNames: {},
    ranking: rankingFor(participants),
    drawConfig: structuredClone(DEFAULT_DRAW_CONFIG),
    groups: null,
    drawSteps: [],
    drawMode: null,
    results: {},
    tiebreakers: DEFAULT_TIEBREAKERS.slice(),
    seed: uid('s'),
    kickoff: ed.kickoff,
  };
}

/** Default participants (kept for the engine tests and the 2030 configuration). */
export const ALL_TEAM_IDS = DEFAULT_PARTICIPANTS;

/** Fills fields added in later versions so older saved tournaments keep working. */
export function migrateTournament(t: Tournament): Tournament {
  const edition: EditionId = t.edition && EDITIONS[t.edition] ? t.edition : '2030';
  const participants =
    Array.isArray(t.participants) && t.participants.length === 64 && new Set(t.participants).size === 64 && t.participants.every((id) => TEAM_BY_ID[id])
      ? t.participants
      : DEFAULT_PARTICIPANTS.slice();
  const hosts = Array.isArray(t.hosts) ? t.hosts.filter((h) => participants.includes(h)) : EDITIONS[edition].defaultHosts.filter((h) => participants.includes(h));
  const ranking = Array.isArray(t.ranking) && t.ranking.length === 64 && t.ranking.every((id) => participants.includes(id)) ? t.ranking : rankingFor(participants, t.ranking);
  return { ...t, edition, participants, hosts, ranking, groupOverrides: t.groupOverrides && typeof t.groupOverrides === 'object' ? t.groupOverrides : {} };
}

/**
 * Replaces a participant with another national team everywhere: list, ranking, groups, draw log and hosts.
 * Results of matches involving the replaced team are removed (they no longer apply).
 */
export function replaceParticipant(t: Tournament, oldId: string, newId: string): Tournament {
  if (!t.participants.includes(oldId)) throw new Error('La selección a reemplazar no participa.');
  if (t.participants.includes(newId)) throw new Error('Esa selección ya participa.');
  if (!TEAM_BY_ID[newId]) throw new Error('Selección desconocida.');
  const swap = (id: string) => (id === oldId ? newId : id);
  const results = Object.fromEntries(Object.entries(t.results).filter(([, r]) => r.homeId !== oldId && r.awayId !== oldId));
  const groupOverrides = Object.fromEntries(Object.entries(t.groupOverrides ?? {}).map(([k, v]) => [k, v.map(swap)]));
  const teamNames = { ...t.teamNames };
  delete teamNames[oldId];
  return {
    ...t,
    participants: t.participants.map(swap),
    ranking: t.ranking.map(swap),
    hosts: t.hosts.map(swap),
    groups: t.groups ? t.groups.map((g) => g.map(swap)) : null,
    drawSteps: t.drawSteps.map((s) => ({ ...s, teamId: swap(s.teamId) })),
    groupOverrides,
    teamNames,
    results,
  };
}

/** Number of saved results that involve a team. */
export function resultsOfTeam(t: Tournament, teamId: string): number {
  return Object.values(t.results).filter((r) => r.homeId === teamId || r.awayId === teamId).length;
}

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
    table: computeGroupTable(index, teamIds, t.results, t.tiebreakers, t.seed, t.groupOverrides?.[index]),
  }));

  const ko: Record<string, KOMatchView> = {};
  const resolve = (src: Source): string | undefined => {
    if (src.kind === 'group') {
      const g = groups[src.group];
      if (!g || !(g.table.complete || g.table.manual)) return undefined;
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
  const decided = (g: GroupView) => g.table.complete || g.table.manual;
  const qualified = groups.flatMap((g) => (decided(g) ? g.table.rows.slice(0, 2).map((r) => r.teamId) : []));

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
      groupsComplete: groups.filter(decided).length,
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

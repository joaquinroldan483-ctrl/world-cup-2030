import { DEFAULT_DRAW_CONFIG } from './draw';
import { type BracketSlot, type Source } from './knockout';
import { uid } from './random';
import { computeGroupTable, type GroupTable } from './standings';
import { resolveOutcome, type Outcome } from './results';
import { DEFAULT_PARTICIPANTS, DEFAULT_RANKING, TEAM_BY_ID } from './teams';
import { EDITIONS, type EditionId } from './editions';
import { FORMATS, isTeamCount, type TeamCount } from './formats';
import { bracketFor } from './knockout';
import { CATALOG } from './teams';
import { hashString } from './random';
import type { StandingRow } from './standings';
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

/** Default participants for a team count: the strongest of the default ranking, always including the hosts. */
export function defaultParticipants(n: TeamCount, hosts: string[] = [], base: string[] = DEFAULT_RANKING): string[] {
  const pool = [...base.filter((id) => TEAM_BY_ID[id]), ...DEFAULT_PARTICIPANTS, ...CATALOG.map((t) => t.id)].filter((id, i, a) => a.indexOf(id) === i);
  // Respect the default confederation quotas (2 UEFA / 1 other per group) so every draw mode is feasible.
  const G = n / 4;
  const cap = (c: string) => (c === 'UEFA' ? 2 * G : G);
  const count: Record<string, number> = {};
  const picked: string[] = [];
  for (const h of hosts) if (TEAM_BY_ID[h] && picked.length < n) {
    picked.push(h);
    count[TEAM_BY_ID[h].confederation] = (count[TEAM_BY_ID[h].confederation] ?? 0) + 1;
  }
  for (const id of pool) {
    if (picked.length >= n) break;
    const c = TEAM_BY_ID[id].confederation;
    if (picked.includes(id) || (count[c] ?? 0) >= cap(c)) continue;
    picked.push(id);
    count[c] = (count[c] ?? 0) + 1;
  }
  // Keep ranking order (hosts were inserted first).
  picked.sort((a, b) => pool.indexOf(a) - pool.indexOf(b));
  for (const h of hosts) {
    if (picked.includes(h) || !TEAM_BY_ID[h]) continue;
    const drop = [...picked].reverse().find((id) => !hosts.includes(id));
    if (drop) picked[picked.indexOf(drop)] = h;
  }
  return picked;
}

export function createTournament(name?: string, edition: EditionId = '2030', teams?: TeamCount): Tournament {
  const now = Date.now();
  const ed = EDITIONS[edition];
  const format = teams ?? ed.defaultTeams;
  const participants = format === 64 ? DEFAULT_PARTICIPANTS.slice() : defaultParticipants(format, ed.defaultHosts);
  return {
    id: uid('t_'),
    name: name ?? `Mi Mundial ${ed.year}`,
    edition,
    format,
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
  const format: TeamCount = isTeamCount(t.format) ? t.format : 64;
  const participants =
    Array.isArray(t.participants) && t.participants.length === format && new Set(t.participants).size === format && t.participants.every((id) => TEAM_BY_ID[id])
      ? t.participants
      : format === 64
        ? DEFAULT_PARTICIPANTS.slice()
        : defaultParticipants(format, EDITIONS[edition].defaultHosts);
  const hosts = Array.isArray(t.hosts) ? t.hosts.filter((h) => participants.includes(h)) : EDITIONS[edition].defaultHosts.filter((h) => participants.includes(h));
  const ranking = Array.isArray(t.ranking) && t.ranking.length === format && t.ranking.every((id) => participants.includes(id)) ? t.ranking : rankingFor(participants, t.ranking);
  const groups = t.groups && t.groups.length === FORMATS[format].groups ? t.groups : null;
  return { ...t, edition, format, participants, groups, hosts, ranking, groupOverrides: t.groupOverrides && typeof t.groupOverrides === 'object' ? t.groupOverrides : {} };
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

/**
 * Changes the number of teams. Keeps the best-ranked current participants (and the hosts) when shrinking,
 * adds the next teams of the default ranking when growing. The draw and all results are reset.
 */
export function changeFormat(t: Tournament, teams: TeamCount): Tournament {
  if (t.format === teams) return t;
  const base = [...t.ranking, ...DEFAULT_RANKING];
  const participants = defaultParticipants(teams, t.hosts, base);
  return {
    ...t,
    format: teams,
    participants,
    ranking: rankingFor(participants, base),
    hosts: t.hosts.filter((h) => participants.includes(h)),
    groups: null,
    drawSteps: [],
    drawMode: null,
    results: {},
    groupOverrides: {},
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
  groupCount: number;
}

export interface ThirdRow {
  row: StandingRow;
  group: number;
  /** Rank among all third-placed teams (1 = best). */
  rank: number;
  qualified: boolean;
}

export interface DerivedTournament {
  t: Tournament;
  /** Knockout structure of the tournament's format. */
  bracket: BracketSlot[];
  /** Ranking of the third-placed teams (formats with best thirds), once every group is decided. */
  thirds: ThirdRow[];
  /** Number of qualifiers to the knockout stage. */
  qualifierCount: number;
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

  const format = FORMATS[t.format ?? 64];
  const { slots: bracket } = bracketFor(t.format ?? 64);
  const decided = (g: GroupView) => g.table.complete || g.table.manual;
  const allDecided = groups.length > 0 && groups.every(decided);

  // Best third-placed teams (formats with thirds): ranked by points, goal difference, goals, wins, fair play, lots.
  let thirds: ThirdRow[] = [];
  const thirdForSlot: Record<number, string> = {};
  if (format.thirds && groups.length) {
    const cand = groups.map((g) => ({ row: g.table.rows[2], group: g.index })).filter((x) => x.row);
    cand.sort(
      (a, b) =>
        b.row.points - a.row.points ||
        b.row.goalDiff - a.row.goalDiff ||
        b.row.goalsFor - a.row.goalsFor ||
        b.row.won - a.row.won ||
        b.row.fairPlay - a.row.fairPlay ||
        hashString(t.seed + a.row.teamId) - hashString(t.seed + b.row.teamId),
    );
    thirds = cand.map((x, i) => ({ ...x, rank: i + 1, qualified: allDecided && i < format.thirds }));
    if (allDecided) {
      // Assign the qualified thirds to the slots so none meets the winner of its own group.
      const best = thirds.filter((x) => x.qualified);
      const slotGroup: Record<number, number> = {};
      for (const s of bracket) {
        if (s.away.kind === 'third' && s.home.kind === 'group') slotGroup[s.away.slot] = s.home.group;
      }
      const slotsK = Object.keys(slotGroup).map(Number).sort((a, b) => a - b);
      const usedT = new Set<number>();
      const assign = (i: number): boolean => {
        if (i === slotsK.length) return true;
        for (let j = 0; j < best.length; j++) {
          if (usedT.has(j) || best[j].group === slotGroup[slotsK[i]]) continue;
          usedT.add(j);
          thirdForSlot[slotsK[i]] = best[j].row.teamId;
          if (assign(i + 1)) return true;
          usedT.delete(j);
        }
        return false;
      };
      if (!assign(0)) slotsK.forEach((k, i) => (thirdForSlot[k] = best[i]?.row.teamId));
    }
  }

  const ko: Record<string, KOMatchView> = {};
  const resolve = (src: Source): string | undefined => {
    if (src.kind === 'group') {
      const g = groups[src.group];
      if (!g || !decided(g)) return undefined;
      return g.table.rows[src.position - 1]?.teamId;
    }
    if (src.kind === 'third') return thirdForSlot[src.slot];
    const m = ko[src.matchId];
    if (!m) return undefined;
    return src.kind === 'winner' ? m.winnerId : m.loserId;
  };

  // The bracket is topologically ordered (each slot only depends on earlier ones).
  for (const slot of bracket) {
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

  // Third-placed teams: qualified or eliminated once the ranking of thirds is final.
  if (format.thirds) {
    for (const x of thirds) {
      const r = groups[x.group].table.rows[2];
      if (allDecided) r.status = x.qualified ? 'qualified' : 'eliminated';
      else if (r.status === 'eliminated' && decided(groups[x.group])) r.status = 'alive';
    }
  }

  const knockout = bracket.map((s) => ko[s.id]);
  const groupPlayed = groups.reduce((n, g) => n + g.table.played, 0);
  const qualified = [
    ...groups.flatMap((g) => (decided(g) ? g.table.rows.slice(0, 2).map((r) => r.teamId) : [])),
    ...thirds.filter((x) => x.qualified).map((x) => x.row.teamId),
  ];

  return {
    t,
    bracket,
    thirds,
    qualifierCount: format.bracket,
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
      groupTotal: format.groups * 6,
      koPlayed: knockout.filter((m) => m.winnerId).length,
      koTotal: knockout.length,
      groupsComplete: groups.filter(decided).length,
      groupCount: format.groups,
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

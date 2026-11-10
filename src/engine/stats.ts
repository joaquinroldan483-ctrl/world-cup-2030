import { TEAM_BY_ID } from './teams';
import { eventPeriod, isGoal, resolveOutcome, totals } from './results';
import type { DerivedTournament } from './tournament';
import {
  CONFEDERATIONS,
  KNOCKOUT_STAGES,
  type Confederation,
  type EventType,
  type MatchResult,
  type Score,
  type Stage,
} from './types';

export interface MatchRecord {
  id: string;
  stage: Stage;
  group?: number;
  homeId: string;
  awayId: string;
  result: MatchResult;
  total: Score;
  winnerId?: string;
}

/** Every match with a valid result, in tournament order. */
export function playedMatches(d: DerivedTournament): MatchRecord[] {
  const out: MatchRecord[] = [];
  for (const g of d.groups) {
    for (const f of g.table.fixtures) {
      const r = d.t.results[f.id];
      if (!r || r.homeId !== f.homeId || r.awayId !== f.awayId) continue;
      const total = totals({ regular: r.regular, extraTime: null });
      out.push({
        id: f.id,
        stage: 'GROUP',
        group: g.index,
        homeId: f.homeId,
        awayId: f.awayId,
        result: r,
        total,
        winnerId: total.home > total.away ? f.homeId : total.away > total.home ? f.awayId : undefined,
      });
    }
  }
  for (const m of d.knockout) {
    if (!m.result || !m.homeId || !m.awayId) continue;
    out.push({
      id: m.id,
      stage: m.stage,
      homeId: m.homeId,
      awayId: m.awayId,
      result: m.result,
      total: totals(m.result),
      winnerId: m.winnerId,
    });
  }
  return out;
}

export interface TeamTotals {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  yellow: number;
  red: number;
  cleanSheets: number;
}

export interface Scorer {
  player: string;
  teamId: string;
  goals: number;
  penalties: number;
}

export interface TournamentStats {
  matches: number;
  goals: number;
  avgGoals: number;
  teams: TeamTotals[];
  topScorers: Scorer[];
  biggestWins: MatchRecord[];
  highestScoring: MatchRecord[];
  goalsByStage: { stage: Stage; matches: number; goals: number }[];
  distribution: { homeWins: number; draws: number; awayWins: number };
  scorelines: { score: string; count: number }[];
  events: Record<EventType, number>;
  goalsByMinute: { label: string; goals: number }[];
  byConfederation: {
    confederation: Confederation;
    teams: number;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    goalsFor: number;
    goalsAgainst: number;
    qualified: number;
  }[];
  extraTimeMatches: number;
  shootouts: number;
}

const blank = (teamId: string): TeamTotals => ({
  teamId,
  played: 0,
  won: 0,
  drawn: 0,
  lost: 0,
  goalsFor: 0,
  goalsAgainst: 0,
  goalDiff: 0,
  points: 0,
  yellow: 0,
  red: 0,
  cleanSheets: 0,
});

/**
 * Aggregate statistics. W/D/L follow the usual convention: a knockout match
 * decided on penalties counts as a draw; extra-time goals count.
 */
export function computeStats(d: DerivedTournament): TournamentStats {
  const matches = playedMatches(d);
  const teams = new Map<string, TeamTotals>();
  const get = (id: string) => {
    if (!teams.has(id)) teams.set(id, blank(id));
    return teams.get(id)!;
  };
  for (const g of d.groups) g.teamIds.forEach(get);

  const scorers = new Map<string, Scorer>();
  const events = Object.fromEntries(
    ['goal', 'penalty_goal', 'penalty_miss', 'own_goal', 'yellow', 'red', 'sub', 'et_goal', 'shootout_scored', 'shootout_missed'].map((k) => [k, 0]),
  ) as Record<EventType, number>;
  const buckets = ['1-15', '16-30', '31-45+', '46-60', '61-75', '76-90+', 'Prórroga'];
  const minuteGoals = buckets.map((label) => ({ label, goals: 0 }));
  const scorelines = new Map<string, number>();
  const distribution = { homeWins: 0, draws: 0, awayWins: 0 };
  let extraTimeMatches = 0;
  let shootouts = 0;

  for (const m of matches) {
    const h = get(m.homeId);
    const a = get(m.awayId);
    h.played++;
    a.played++;
    h.goalsFor += m.total.home;
    h.goalsAgainst += m.total.away;
    a.goalsFor += m.total.away;
    a.goalsAgainst += m.total.home;
    if (m.total.away === 0) h.cleanSheets++;
    if (m.total.home === 0) a.cleanSheets++;
    if (m.total.home > m.total.away) {
      h.won++;
      a.lost++;
      h.points += 3;
      distribution.homeWins++;
    } else if (m.total.home < m.total.away) {
      a.won++;
      h.lost++;
      a.points += 3;
      distribution.awayWins++;
    } else {
      h.drawn++;
      a.drawn++;
      h.points++;
      a.points++;
      distribution.draws++;
    }
    if (m.result.extraTime) extraTimeMatches++;
    if (m.result.penalties) shootouts++;
    const hi = Math.max(m.total.home, m.total.away);
    const lo = Math.min(m.total.home, m.total.away);
    const key = `${hi}-${lo}`;
    scorelines.set(key, (scorelines.get(key) ?? 0) + 1);

    for (const e of m.result.events) {
      if (e.teamId !== m.homeId && e.teamId !== m.awayId) continue;
      events[e.type]++;
      const tt = get(e.teamId);
      if (e.type === 'yellow') tt.yellow++;
      if (e.type === 'red') tt.red++;
      if (isGoal(e)) {
        const p = eventPeriod(e);
        const idx =
          p === 'extra' ? 6 : e.minute <= 15 ? 0 : e.minute <= 30 ? 1 : e.minute <= 45 ? 2 : e.minute <= 60 ? 3 : e.minute <= 75 ? 4 : 5;
        minuteGoals[idx].goals++;
        if (e.type !== 'own_goal' && e.player?.trim()) {
          const name = e.player.trim();
          const k = `${e.teamId}|${name.toLowerCase()}`;
          const s = scorers.get(k) ?? { player: name, teamId: e.teamId, goals: 0, penalties: 0 };
          s.goals++;
          if (e.type === 'penalty_goal') s.penalties++;
          scorers.set(k, s);
        }
      }
    }
  }
  for (const t of teams.values()) t.goalDiff = t.goalsFor - t.goalsAgainst;

  const goals = matches.reduce((n, m) => n + m.total.home + m.total.away, 0);
  const stages: Stage[] = ['GROUP', ...KNOCKOUT_STAGES];
  const qualifiedSet = new Set(d.qualified);

  return {
    matches: matches.length,
    goals,
    avgGoals: matches.length ? goals / matches.length : 0,
    teams: [...teams.values()],
    topScorers: [...scorers.values()].sort((a, b) => b.goals - a.goals || a.penalties - b.penalties || a.player.localeCompare(b.player)),
    biggestWins: matches
      .filter((m) => m.total.home !== m.total.away)
      .sort((a, b) => Math.abs(b.total.home - b.total.away) - Math.abs(a.total.home - a.total.away) || b.total.home + b.total.away - (a.total.home + a.total.away)),
    highestScoring: matches
      .slice()
      .sort((a, b) => b.total.home + b.total.away - (a.total.home + a.total.away) || Math.abs(b.total.home - b.total.away) - Math.abs(a.total.home - a.total.away)),
    goalsByStage: stages.map((stage) => {
      const ms = matches.filter((m) => m.stage === stage);
      return { stage, matches: ms.length, goals: ms.reduce((n, m) => n + m.total.home + m.total.away, 0) };
    }),
    distribution,
    scorelines: [...scorelines.entries()].map(([score, count]) => ({ score, count })).sort((a, b) => b.count - a.count),
    events,
    goalsByMinute: minuteGoals,
    byConfederation: CONFEDERATIONS.map((c) => {
      const ts = [...teams.values()].filter((t) => TEAM_BY_ID[t.teamId]?.confederation === c);
      const sum = (k: keyof TeamTotals) => ts.reduce((n, t) => n + (t[k] as number), 0);
      return {
        confederation: c,
        teams: ts.length,
        played: sum('played'),
        won: sum('won'),
        drawn: sum('drawn'),
        lost: sum('lost'),
        goalsFor: sum('goalsFor'),
        goalsAgainst: sum('goalsAgainst'),
        qualified: ts.filter((t) => qualifiedSet.has(t.teamId)).length,
      };
    }),
    extraTimeMatches,
    shootouts,
  };
}

export { resolveOutcome };

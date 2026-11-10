import { eventPeriod, isGoal, resolveOutcome, totals } from './results';
import type { StandingRow } from './standings';
import type { DerivedTournament } from './tournament';
import { STAGE_LABEL, type MatchEvent, type MatchResult, type Stage } from './types';

export interface JourneyStep {
  matchId: string;
  stage: Stage;
  matchday?: number;
  opponentId?: string;
  isHome: boolean;
  result?: MatchResult;
  goalsFor: number;
  goalsAgainst: number;
  /** W/D/L by scoreline (penalty shoot-outs are draws), or pending. */
  outcome: 'W' | 'D' | 'L' | 'pending';
  /** Knockout: whether the team advanced. */
  advanced?: boolean;
  decidedBy?: string | null;
  /** Events of this match, from the team's perspective. */
  events: (MatchEvent & { mine: boolean })[];
  scoreline: string;
}

export type JourneyStatus =
  | { kind: 'notDrawn'; label: string }
  | { kind: 'champion'; label: string }
  | { kind: 'runnerUp'; label: string }
  | { kind: 'third'; label: string }
  | { kind: 'fourth'; label: string }
  | { kind: 'eliminated'; stage: Stage; label: string }
  | { kind: 'alive'; stage: Stage; label: string };

export interface Journey {
  teamId: string;
  groupIndex?: number;
  groupRow?: StandingRow;
  groupComplete: boolean;
  groupSteps: JourneyStep[];
  knockoutSteps: JourneyStep[];
  status: JourneyStatus;
  /** Furthest stage reached. */
  reached: Stage;
  goalsFor: number;
  goalsAgainst: number;
  wins: number;
  draws: number;
  losses: number;
  scorers: { player: string; goals: number }[];
}

function step(
  teamId: string,
  matchId: string,
  stage: Stage,
  homeId: string | undefined,
  awayId: string | undefined,
  result: MatchResult | undefined,
  matchday?: number,
): JourneyStep {
  const isHome = homeId === teamId;
  const opponentId = isHome ? awayId : homeId;
  if (!result) {
    return { matchId, stage, matchday, opponentId, isHome, goalsFor: 0, goalsAgainst: 0, outcome: 'pending', events: [], scoreline: '–' };
  }
  const knockout = stage !== 'GROUP';
  const t = knockout ? totals(result) : result.regular;
  const gf = isHome ? t.home : t.away;
  const ga = isHome ? t.away : t.home;
  let advanced: boolean | undefined;
  let decidedBy: string | null | undefined;
  if (knockout) {
    const o = resolveOutcome(result);
    advanced = o.winner ? (o.winner === 'home') === isHome : undefined;
    decidedBy = o.decidedBy;
  }
  let scoreline = `${gf}-${ga}`;
  if (knockout && result.extraTime) scoreline += ' (pró.)';
  if (knockout && result.penalties) {
    const pf = isHome ? result.penalties.home : result.penalties.away;
    const pa = isHome ? result.penalties.away : result.penalties.home;
    scoreline += ` · pen. ${pf}-${pa}`;
  }
  return {
    matchId,
    stage,
    matchday,
    opponentId,
    isHome,
    result,
    goalsFor: gf,
    goalsAgainst: ga,
    outcome: gf > ga ? 'W' : gf < ga ? 'L' : 'D',
    advanced,
    decidedBy,
    events: result.events.map((e) => ({ ...e, mine: e.teamId === teamId })),
    scoreline,
  };
}

/** Builds the complete path of a team automatically from the tournament results. */
export function buildJourney(d: DerivedTournament, teamId: string): Journey {
  const g = d.groups.find((gr) => gr.teamIds.includes(teamId));
  const base: Journey = {
    teamId,
    groupComplete: false,
    groupSteps: [],
    knockoutSteps: [],
    status: { kind: 'notDrawn', label: 'Pendiente de sorteo' },
    reached: 'GROUP',
    goalsFor: 0,
    goalsAgainst: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    scorers: [],
  };
  if (!g) return base;
  base.groupIndex = g.index;
  base.groupRow = g.table.rows.find((r) => r.teamId === teamId);
  base.groupComplete = g.table.complete;
  base.groupSteps = g.table.fixtures
    .filter((f) => f.homeId === teamId || f.awayId === teamId)
    .map((f) => {
      const r = d.t.results[f.id];
      const valid = r && r.homeId === f.homeId && r.awayId === f.awayId ? r : undefined;
      return step(teamId, f.id, 'GROUP', f.homeId, f.awayId, valid, f.matchday);
    });

  for (const m of d.knockout) {
    if (m.homeId !== teamId && m.awayId !== teamId) continue;
    base.knockoutSteps.push(step(teamId, m.id, m.stage, m.homeId, m.awayId, m.result));
  }
  // Show the final before the third-place match only if relevant: order by bracket stage.
  const all = [...base.groupSteps, ...base.knockoutSteps];
  for (const s of all) {
    if (s.outcome === 'pending') continue;
    base.goalsFor += s.goalsFor;
    base.goalsAgainst += s.goalsAgainst;
    if (s.outcome === 'W') base.wins++;
    else if (s.outcome === 'D') base.draws++;
    else base.losses++;
  }
  const scorers = new Map<string, number>();
  for (const s of all)
    for (const e of s.events) if (e.mine && isGoal(e) && e.type !== 'own_goal' && e.player?.trim() && eventPeriod(e) !== 'shootout') {
      const n = e.player.trim();
      scorers.set(n, (scorers.get(n) ?? 0) + 1);
    }
  base.scorers = [...scorers.entries()].map(([player, goals]) => ({ player, goals })).sort((a, b) => b.goals - a.goals);

  const lastKO = base.knockoutSteps.filter((s) => s.stage !== '3P').at(-1);
  base.reached = lastKO ? lastKO.stage : 'GROUP';

  if (d.champion === teamId) base.status = { kind: 'champion', label: '¡Campeón del mundo!' };
  else if (d.runnerUp === teamId) base.status = { kind: 'runnerUp', label: 'Subcampeón del mundo' };
  else if (d.third === teamId) base.status = { kind: 'third', label: 'Tercer puesto' };
  else if (d.fourth === teamId) base.status = { kind: 'fourth', label: 'Cuarto puesto' };
  else if (g.table.complete && (base.groupRow?.position ?? 9) > 2)
    base.status = { kind: 'eliminated', stage: 'GROUP', label: `Eliminada en fase de grupos (${base.groupRow?.position}º)` };
  else {
    const lost = base.knockoutSteps.find((s) => s.advanced === false && s.stage !== '3P' && s.stage !== 'SF');
    if (lost) base.status = { kind: 'eliminated', stage: lost.stage, label: `Eliminada en ${STAGE_LABEL[lost.stage].toLowerCase()}` };
    else {
      const current = base.knockoutSteps.at(-1)?.stage ?? 'GROUP';
      base.status = { kind: 'alive', stage: current, label: `En competencia · ${STAGE_LABEL[current]}` };
    }
  }
  return base;
}

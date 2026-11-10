import { groupFixtures, type GroupFixture } from './fixtures';
import { hashString } from './random';
import type { MatchResult, TiebreakCriterion } from './types';

export interface StandingRow {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  /** Fair-play score (≤ 0): yellow −1, red −4. */
  fairPlay: number;
  form: ('W' | 'D' | 'L')[];
  position: number;
  /** Clinch status computed from remaining fixtures. */
  status: 'qualified' | 'eliminated' | 'alive';
  /** Whether a tie-break beyond points was needed against an adjacent team. */
  tiedOnPoints: boolean;
}

interface PlayedMatch {
  homeId: string;
  awayId: string;
  hg: number;
  ag: number;
}

function blankRow(teamId: string): StandingRow {
  return {
    teamId,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDiff: 0,
    points: 0,
    fairPlay: 0,
    form: [],
    position: 0,
    status: 'alive',
    tiedOnPoints: false,
  };
}

function accumulate(rows: Map<string, StandingRow>, m: PlayedMatch) {
  const h = rows.get(m.homeId);
  const a = rows.get(m.awayId);
  if (!h || !a) return;
  h.played++;
  a.played++;
  h.goalsFor += m.hg;
  h.goalsAgainst += m.ag;
  a.goalsFor += m.ag;
  a.goalsAgainst += m.hg;
  if (m.hg > m.ag) {
    h.won++;
    a.lost++;
    h.points += 3;
    h.form.push('W');
    a.form.push('L');
  } else if (m.hg < m.ag) {
    a.won++;
    h.lost++;
    a.points += 3;
    h.form.push('L');
    a.form.push('W');
  } else {
    h.drawn++;
    a.drawn++;
    h.points++;
    a.points++;
    h.form.push('D');
    a.form.push('D');
  }
  h.goalDiff = h.goalsFor - h.goalsAgainst;
  a.goalDiff = a.goalsFor - a.goalsAgainst;
}

function miniTable(teamIds: string[], matches: PlayedMatch[]) {
  const set = new Set(teamIds);
  const rows = new Map(teamIds.map((id) => [id, blankRow(id)]));
  for (const m of matches) if (set.has(m.homeId) && set.has(m.awayId)) accumulate(rows, m);
  return rows;
}

/** Recursively orders teams by the configured criteria (head-to-head criteria are evaluated within the tied subset). */
export function orderTeams(
  teamIds: string[],
  overall: Map<string, StandingRow>,
  matches: PlayedMatch[],
  criteria: TiebreakCriterion[],
  seed: string,
): string[] {
  const rank = (ids: string[], idx: number): string[] => {
    if (ids.length <= 1 || idx >= criteria.length) {
      // Final deterministic fallback: lots by seed, then id.
      return ids.slice().sort((a, b) => hashString(seed + a) - hashString(seed + b) || a.localeCompare(b));
    }
    const c = criteria[idx];
    let key: (id: string) => number;
    if (c === 'h2hPoints' || c === 'h2hGoalDiff' || c === 'h2hGoalsFor') {
      const mini = miniTable(ids, matches);
      key = (id) => {
        const r = mini.get(id)!;
        return c === 'h2hPoints' ? r.points : c === 'h2hGoalDiff' ? r.goalDiff : r.goalsFor;
      };
    } else if (c === 'lots') {
      key = (id) => -hashString(seed + id);
    } else {
      key = (id) => {
        const r = overall.get(id)!;
        switch (c) {
          case 'points':
            return r.points;
          case 'goalDiff':
            return r.goalDiff;
          case 'goalsFor':
            return r.goalsFor;
          case 'wins':
            return r.won;
          case 'fairPlay':
            return r.fairPlay;
        }
        return 0;
      };
    }
    const buckets = new Map<number, string[]>();
    for (const id of ids) {
      const k = key(id);
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k)!.push(id);
    }
    const keys = [...buckets.keys()].sort((a, b) => b - a);
    return keys.flatMap((k) => rank(buckets.get(k)!, idx + 1));
  };
  return rank(teamIds, 0);
}

export interface GroupTable {
  rows: StandingRow[];
  fixtures: GroupFixture[];
  played: number;
  complete: boolean;
}

/** Computes the standings of a group. Results whose participants do not match the fixture are ignored. */
export function computeGroupTable(
  groupIndex: number,
  teamIds: string[],
  results: Record<string, MatchResult>,
  criteria: TiebreakCriterion[],
  seed: string,
): GroupTable {
  const fixtures = groupFixtures(groupIndex, teamIds);
  const rows = new Map(teamIds.map((id) => [id, blankRow(id)]));
  const played: PlayedMatch[] = [];
  for (const f of fixtures) {
    const r = results[f.id];
    if (!r || r.homeId !== f.homeId || r.awayId !== f.awayId) continue;
    const m = { homeId: f.homeId, awayId: f.awayId, hg: r.regular.home, ag: r.regular.away };
    played.push(m);
    accumulate(rows, m);
    for (const e of r.events) {
      const row = rows.get(e.teamId);
      if (!row) continue;
      if (e.type === 'yellow') row.fairPlay -= 1;
      if (e.type === 'red') row.fairPlay -= 4;
    }
  }
  const order = orderTeams(teamIds, rows, played, criteria, seed);
  const sorted = order.map((id, i) => ({ ...rows.get(id)!, position: i + 1 }));
  for (let i = 0; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const next = sorted[i + 1];
    sorted[i].tiedOnPoints = (!!prev && prev.points === sorted[i].points) || (!!next && next.points === sorted[i].points);
  }
  const complete = played.length === fixtures.length;
  const pending = fixtures.filter((f) => !played.some((p) => p.homeId === f.homeId && p.awayId === f.awayId));
  const status = clinchStatus(teamIds, rows, pending);
  for (const r of sorted) {
    if (complete) r.status = r.position <= 2 ? 'qualified' : 'eliminated';
    else r.status = status[r.teamId];
  }
  return { rows: sorted, fixtures, played: played.length, complete };
}

/**
 * Determines, by enumerating every W/D/L outcome of the pending matches,
 * whether a team is guaranteed a top-two finish regardless of tie-breakers,
 * or can no longer reach it.
 */
export function clinchStatus(
  teamIds: string[],
  rows: Map<string, StandingRow>,
  pending: { homeId: string; awayId: string }[],
): Record<string, 'qualified' | 'eliminated' | 'alive'> {
  const out: Record<string, 'qualified' | 'eliminated' | 'alive'> = {};
  const alwaysTop = new Set(teamIds);
  const neverTop = new Set(teamIds);
  const total = 3 ** pending.length;
  for (let s = 0; s < total; s++) {
    const pts: Record<string, number> = {};
    for (const id of teamIds) pts[id] = rows.get(id)!.points;
    let x = s;
    for (const m of pending) {
      const o = x % 3;
      x = Math.floor(x / 3);
      if (o === 0) pts[m.homeId] += 3;
      else if (o === 1) pts[m.awayId] += 3;
      else {
        pts[m.homeId]++;
        pts[m.awayId]++;
      }
    }
    for (const id of teamIds) {
      const atLeast = teamIds.filter((o) => o !== id && pts[o] >= pts[id]).length;
      const strictlyMore = teamIds.filter((o) => o !== id && pts[o] > pts[id]).length;
      if (atLeast > 1) alwaysTop.delete(id); // could finish 3rd
      if (strictlyMore < 2) neverTop.delete(id); // could finish top 2
    }
  }
  for (const id of teamIds) out[id] = alwaysTop.has(id) ? 'qualified' : neverTop.has(id) ? 'eliminated' : 'alive';
  return out;
}

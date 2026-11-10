import { groupFixtures } from './fixtures';
import { secureRandom, uid, type RNG } from './random';
import { deriveTournament } from './tournament';
import type { KnockoutStage, MatchEvent, MatchResult, Score, Tournament } from './types';

/**
 * Optional auto-simulator (always triggered explicitly by the user).
 * Goals follow a Poisson model whose rates depend on the custom ranking.
 * Generated events have minutes but no player names (nothing real is invented).
 */
function poisson(lambda: number, rng: RNG): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng();
  } while (p > L && k < 12);
  return k - 1;
}

function strength(id: string, ranking: string[]): number {
  const i = ranking.indexOf(id);
  return i < 0 ? 0.3 : 1 - i / Math.max(ranking.length - 1, 1);
}

function goalMinutes(n: number, from: number, to: number, rng: RNG): { minute: number; added?: number }[] {
  const out: { minute: number; added?: number }[] = [];
  for (let i = 0; i < n; i++) {
    let minute = from + Math.floor(rng() * (to - from + 1));
    let added: number | undefined;
    if ((minute === 45 || minute === 90) && rng() < 0.5) added = 1 + Math.floor(rng() * 5);
    if (minute > to) minute = to;
    out.push({ minute, added });
  }
  return out;
}

export function simulateMatch(homeId: string, awayId: string, ranking: string[], knockout: boolean, rng: RNG = secureRandom): MatchResult {
  const sh = strength(homeId, ranking);
  const sa = strength(awayId, ranking);
  const base = 1.25;
  const lh = base * Math.exp((sh - sa) * 1.1);
  const la = base * Math.exp((sa - sh) * 1.1);
  const regular: Score = { home: poisson(lh, rng), away: poisson(la, rng) };
  const events: MatchEvent[] = [];
  const addGoals = (teamId: string, n: number, from: number, to: number, type: MatchEvent['type']) => {
    for (const m of goalMinutes(n, from, to, rng)) {
      const pen = type === 'goal' && rng() < 0.1;
      events.push({ id: uid('e'), teamId, type: pen ? 'penalty_goal' : type, minute: m.minute, added: m.added });
    }
  };
  addGoals(homeId, regular.home, 1, 90, 'goal');
  addGoals(awayId, regular.away, 1, 90, 'goal');
  // A few cards for realism of the fair-play stat.
  for (const id of [homeId, awayId]) {
    const y = poisson(1.6, rng);
    for (let i = 0; i < y; i++) events.push({ id: uid('e'), teamId: id, type: 'yellow', minute: 5 + Math.floor(rng() * 86) });
  }
  let extraTime: Score | null = null;
  let penalties: Score | null = null;
  if (knockout && regular.home === regular.away) {
    extraTime = { home: poisson(lh * 0.3, rng), away: poisson(la * 0.3, rng) };
    addGoals(homeId, extraTime.home, 91, 120, 'et_goal');
    addGoals(awayId, extraTime.away, 91, 120, 'et_goal');
    if (extraTime.home === extraTime.away) {
      const so = shootout(rng);
      penalties = so.score;
      so.kicks.forEach((k, i) =>
        events.push({
          id: uid('e'),
          teamId: k.home ? homeId : awayId,
          type: k.scored ? 'shootout_scored' : 'shootout_missed',
          minute: i + 1,
        }),
      );
    }
  }
  return { homeId, awayId, regular, extraTime, penalties, winner: null, events, updatedAt: Date.now() };
}

/** Kick-by-kick shoot-out: best of five with early finish, then sudden death. */
export function shootout(rng: RNG, p = 0.76): { score: Score; kicks: { home: boolean; scored: boolean }[] } {
  let h = 0;
  let a = 0;
  let hk = 0;
  let ak = 0;
  const kicks: { home: boolean; scored: boolean }[] = [];
  const decided = () => h > a + (5 - ak) || a > h + (5 - hk);
  for (let r = 0; r < 5; r++) {
    const hs = rng() < p;
    hk++;
    if (hs) h++;
    kicks.push({ home: true, scored: hs });
    if (decided()) break;
    const as = rng() < p;
    ak++;
    if (as) a++;
    kicks.push({ home: false, scored: as });
    if (decided()) break;
  }
  while (h === a) {
    const hs = rng() < p;
    const as = rng() < p;
    if (hs) h++;
    if (as) a++;
    kicks.push({ home: true, scored: hs }, { home: false, scored: as });
  }
  return { score: { home: h, away: a }, kicks };
}

export type SimulationScope = { kind: 'groups' } | { kind: 'group'; group: number } | { kind: 'stage'; stage: KnockoutStage } | { kind: 'knockout' } | { kind: 'all' };

/** Fills every pending match within the scope with a simulated result. Existing results are never overwritten. */
export function simulatePending(t: Tournament, scope: SimulationScope, rng: RNG = secureRandom): Tournament {
  if (!t.groups) return t;
  const results = { ...t.results };
  if (scope.kind === 'groups' || scope.kind === 'group' || scope.kind === 'all') {
    t.groups.forEach((teamIds, gi) => {
      if (scope.kind === 'group' && scope.group !== gi) return;
      for (const f of groupFixtures(gi, teamIds)) {
        const r = results[f.id];
        if (r && r.homeId === f.homeId && r.awayId === f.awayId) continue;
        results[f.id] = simulateMatch(f.homeId, f.awayId, t.ranking, false, rng);
      }
    });
  }
  let cur: Tournament = { ...t, results };
  if (scope.kind === 'stage' || scope.kind === 'knockout' || scope.kind === 'all') {
    for (let guard = 0; guard < 8; guard++) {
      const d = deriveTournament(cur);
      const pending = d.knockout.filter(
        (m) => m.homeId && m.awayId && !m.result && (scope.kind !== 'stage' || m.stage === scope.stage),
      );
      if (!pending.length) break;
      const next = { ...cur.results };
      for (const m of pending) next[m.id] = simulateMatch(m.homeId!, m.awayId!, t.ranking, true, rng);
      cur = { ...cur, results: next };
    }
  }
  return cur;
}

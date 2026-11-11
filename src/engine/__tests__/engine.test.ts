import { describe, expect, it } from 'vitest';
import {
  ALL_TEAM_IDS,
  BRACKET,
  CONFEDERATIONS,
  DEFAULT_DRAW_CONFIG,
  DEFAULT_RANKING,
  GROUP_FIXTURE_TEMPLATE,
  TEAMS,
  TEAM_BY_ID,
  buildJourney,
  buildPots,
  cascadePrune,
  checkConsistency,
  completeManualDraw,
  computeGroupTable,
  computeStats,
  createTournament,
  deriveTournament,
  groupFixtures,
  invalidatedBy,
  performDraw,
  playedMatches,
  resolveOutcome,
  seededRandom,
  shootout,
  simulatePending,
  validateGroups,
  autoMomentum,
  fitMomentum,
  smoothMomentum,
  dominance,
  type DrawConfig,
  type MatchResult,
  type Tournament,
} from '../index';

const res = (homeId: string, awayId: string, h: number, a: number, extra?: Partial<MatchResult>): MatchResult => ({
  homeId,
  awayId,
  regular: { home: h, away: a },
  extraTime: null,
  penalties: null,
  winner: null,
  events: [],
  updatedAt: 0,
  ...extra,
});

function drawnTournament(seed = 1): Tournament {
  const t = createTournament('Test');
  const d = performDraw(DEFAULT_DRAW_CONFIG, { rng: seededRandom(seed), ranking: t.ranking, teamIds: ALL_TEAM_IDS });
  return { ...t, groups: d.groups, drawSteps: d.steps, drawMode: d.mode };
}

describe('teams', () => {
  it('has exactly 64 unique teams', () => {
    expect(TEAMS).toHaveLength(64);
    expect(new Set(TEAMS.map((t) => t.id)).size).toBe(64);
    expect(new Set(TEAMS.map((t) => t.flag)).size).toBe(64);
    expect(new Set(TEAMS.map((t) => t.name)).size).toBe(64);
  });
  it('has the expected confederation counts', () => {
    const count = (c: string) => TEAMS.filter((t) => t.confederation === c).length;
    expect(count('UEFA')).toBe(21);
    expect(count('CAF')).toBe(13);
    expect(count('AFC')).toBe(12);
    expect(count('CONMEBOL')).toBe(8);
    expect(count('CONCACAF')).toBe(8);
    expect(count('OFC')).toBe(2);
  });
  it('default ranking contains each team once', () => {
    expect(DEFAULT_RANKING).toHaveLength(64);
    expect(new Set(DEFAULT_RANKING).size).toBe(64);
    for (const id of DEFAULT_RANKING) expect(TEAM_BY_ID[id]).toBeDefined();
  });
});

describe('draw', () => {
  const modes: DrawConfig['mode'][] = ['free', 'confederation', 'pots'];
  for (const mode of modes) {
    it(`${mode} draw produces 16 groups of 4 with all 64 teams`, () => {
      for (let seed = 1; seed <= 15; seed++) {
        const cfg = { ...DEFAULT_DRAW_CONFIG, mode };
        const d = performDraw(cfg, { rng: seededRandom(seed * 7919), ranking: DEFAULT_RANKING, teamIds: ALL_TEAM_IDS });
        expect(d.groups).toHaveLength(16);
        for (const g of d.groups) expect(g).toHaveLength(4);
        expect(new Set(d.groups.flat()).size).toBe(64);
        expect(d.steps).toHaveLength(64);
        expect(validateGroups(d.groups, cfg, DEFAULT_RANKING, ALL_TEAM_IDS).filter((i) => i.level === 'error')).toEqual([]);
      }
    });
  }
  it('confederation draw respects limits', () => {
    const cfg = { ...DEFAULT_DRAW_CONFIG, mode: 'confederation' as const };
    for (let seed = 1; seed <= 20; seed++) {
      const d = performDraw(cfg, { rng: seededRandom(seed), ranking: DEFAULT_RANKING, teamIds: ALL_TEAM_IDS });
      for (const g of d.groups) {
        for (const c of CONFEDERATIONS) {
          expect(g.filter((id) => TEAM_BY_ID[id].confederation === c).length).toBeLessThanOrEqual(cfg.confedMax[c]);
        }
      }
    }
  });
  it('pots draw places one team per pot in each group and seeds hosts', () => {
    const cfg = { ...DEFAULT_DRAW_CONFIG, mode: 'pots' as const, hostsSeeded: true };
    const pots = buildPots(DEFAULT_RANKING, true);
    const d = performDraw(cfg, { rng: seededRandom(3), ranking: DEFAULT_RANKING, teamIds: ALL_TEAM_IDS });
    expect(d.groups[0][0]).toBe('ESP');
    expect(d.groups[1][0]).toBe('POR');
    expect(d.groups[2][0]).toBe('MAR');
    for (const g of d.groups) {
      const ps = g.map((id) => pots.findIndex((p) => p.includes(id)));
      expect(new Set(ps).size).toBe(4);
    }
  });
  it('rejects infeasible confederation rules', () => {
    const cfg = { ...DEFAULT_DRAW_CONFIG, mode: 'confederation' as const, confedMax: { ...DEFAULT_DRAW_CONFIG.confedMax, UEFA: 1 } };
    expect(() => performDraw(cfg, { rng: seededRandom(1), ranking: DEFAULT_RANKING, teamIds: ALL_TEAM_IDS })).toThrow();
  });
  it('free draw is random (different seeds give different groups)', () => {
    const a = performDraw({ ...DEFAULT_DRAW_CONFIG, hostsSeeded: false }, { rng: seededRandom(1), ranking: DEFAULT_RANKING, teamIds: ALL_TEAM_IDS });
    const b = performDraw({ ...DEFAULT_DRAW_CONFIG, hostsSeeded: false }, { rng: seededRandom(2), ranking: DEFAULT_RANKING, teamIds: ALL_TEAM_IDS });
    expect(a.groups).not.toEqual(b.groups);
  });
  it('validation detects duplicates and broken rules', () => {
    const d = drawnTournament();
    const broken = d.groups!.map((g) => g.slice());
    broken[0][0] = broken[1][0];
    const issues = validateGroups(broken, { ...DEFAULT_DRAW_CONFIG, mode: 'manual' }, DEFAULT_RANKING, ALL_TEAM_IDS);
    expect(issues.some((i) => i.message.includes('aparece 2 veces'))).toBe(true);
  });
  it('manual draw can be completed', () => {
    const partial: string[][] = Array.from({ length: 16 }, () => []);
    partial[0] = ['ARG', 'BRA'];
    const full = completeManualDraw(partial, { ...DEFAULT_DRAW_CONFIG, mode: 'manual' }, ALL_TEAM_IDS, seededRandom(5));
    expect(full[0].slice(0, 2)).toEqual(['ARG', 'BRA']);
    expect(new Set(full.flat()).size).toBe(64);
    full.forEach((g) => expect(g).toHaveLength(4));
  });
});

describe('fixtures', () => {
  it('each group has 6 matches and each team plays 3', () => {
    expect(GROUP_FIXTURE_TEMPLATE).toHaveLength(6);
    const t = drawnTournament();
    t.groups!.forEach((teamIds, gi) => {
      const fx = groupFixtures(gi, teamIds);
      expect(fx).toHaveLength(6);
      for (const id of teamIds) expect(fx.filter((f) => f.homeId === id || f.awayId === id)).toHaveLength(3);
      const pairs = new Set(fx.map((f) => [f.homeId, f.awayId].sort().join('-')));
      expect(pairs.size).toBe(6);
      // two matches per matchday, and no team plays twice on a matchday
      for (const md of [1, 2, 3]) {
        const ms = fx.filter((f) => f.matchday === md);
        expect(ms).toHaveLength(2);
        expect(new Set(ms.flatMap((m) => [m.homeId, m.awayId])).size).toBe(4);
      }
    });
    expect(t.groups!.flatMap((g, i) => groupFixtures(i, g))).toHaveLength(96);
  });
});

describe('standings', () => {
  const ids = ['ARG', 'FRA', 'JPN', 'NZL'];
  const fx = groupFixtures(0, ids);
  const find = (a: string, b: string) => fx.find((f) => (f.homeId === a && f.awayId === b) || (f.homeId === b && f.awayId === a))!;
  const put = (results: Record<string, MatchResult>, a: string, b: string, ga: number, gb: number) => {
    const f = find(a, b);
    results[f.id] = f.homeId === a ? res(a, b, ga, gb) : res(b, a, gb, ga);
  };
  it('updates table correctly', () => {
    const results: Record<string, MatchResult> = {};
    put(results, 'ARG', 'FRA', 3, 1);
    const table = computeGroupTable(0, ids, results, createTournament().tiebreakers, 'x');
    const arg = table.rows.find((r) => r.teamId === 'ARG')!;
    const fra = table.rows.find((r) => r.teamId === 'FRA')!;
    expect(arg).toMatchObject({ played: 1, won: 1, drawn: 0, lost: 0, goalsFor: 3, goalsAgainst: 1, goalDiff: 2, points: 3, position: 1 });
    expect(fra).toMatchObject({ played: 1, lost: 1, goalDiff: -2, points: 0 });
    expect(table.played).toBe(1);
    expect(table.complete).toBe(false);
  });
  it('applies head-to-head when configured before goal difference', () => {
    const results: Record<string, MatchResult> = {};
    put(results, 'ARG', 'FRA', 0, 1); // FRA beats ARG
    put(results, 'ARG', 'JPN', 5, 0);
    put(results, 'ARG', 'NZL', 5, 0);
    put(results, 'FRA', 'JPN', 0, 1);
    put(results, 'FRA', 'NZL', 1, 0);
    put(results, 'JPN', 'NZL', 0, 0);
    // ARG 6 pts GD +9, FRA 6 pts GD +1, JPN 4, NZL 1
    const byGD = computeGroupTable(0, ids, results, ['points', 'goalDiff', 'goalsFor', 'h2hPoints'], 'x');
    expect(byGD.rows[0].teamId).toBe('ARG');
    const byH2H = computeGroupTable(0, ids, results, ['points', 'h2hPoints', 'goalDiff'], 'x');
    expect(byH2H.rows[0].teamId).toBe('FRA');
    expect(byH2H.complete).toBe(true);
    expect(byH2H.rows.map((r) => r.status)).toEqual(['qualified', 'qualified', 'eliminated', 'eliminated']);
  });
  it('detects mathematical qualification', () => {
    const results: Record<string, MatchResult> = {};
    put(results, 'ARG', 'FRA', 1, 0);
    put(results, 'ARG', 'JPN', 1, 0);
    put(results, 'FRA', 'NZL', 0, 0);
    put(results, 'JPN', 'NZL', 0, 0);
    // ARG 6, FRA 1, JPN 1, NZL 2 — remaining ARG-NZL, FRA-JPN: max others: NZL 5, FRA/JPN 4 → ARG at most 1 team ≥ 6? none can reach 6 → qualified
    const table = computeGroupTable(0, ids, results, createTournament().tiebreakers, 'x');
    expect(table.rows.find((r) => r.teamId === 'ARG')!.status).toBe('qualified');
  });
});

describe('knockout', () => {
  it('bracket has 32 matches with correct structure', () => {
    expect(BRACKET).toHaveLength(32);
    const count = (s: string) => BRACKET.filter((b) => b.stage === s).length;
    expect([count('R32'), count('R16'), count('QF'), count('SF'), count('3P'), count('F')]).toEqual([16, 8, 4, 2, 1, 1]);
    const r32 = BRACKET.filter((b) => b.stage === 'R32');
    const sources = r32.flatMap((m) => [m.home, m.away]).map((s) => (s.kind === 'group' ? `${s.group}-${s.position}` : ''));
    expect(new Set(sources).size).toBe(32);
    // winners face runners-up, never from the same group
    for (const m of r32) {
      if (m.home.kind !== 'group' || m.away.kind !== 'group') throw new Error();
      expect(m.home.position).toBe(1);
      expect(m.away.position).toBe(2);
      expect(m.home.group).not.toBe(m.away.group);
    }
    // teams of the same group are in opposite halves
    for (let g = 0; g < 16; g++) {
      const w = r32.find((m) => m.home.kind === 'group' && m.home.group === g)!;
      const r = r32.find((m) => m.away.kind === 'group' && m.away.group === g)!;
      expect((w.index <= 8) !== (r.index <= 8)).toBe(true);
    }
  });
  it('32 teams qualify and propagate through the bracket', () => {
    let t = drawnTournament(11);
    t = simulatePending(t, { kind: 'groups' }, seededRandom(42));
    let d = deriveTournament(t);
    expect(d.qualified).toHaveLength(32);
    expect(new Set(d.qualified).size).toBe(32);
    const r32 = d.knockout.filter((m) => m.stage === 'R32');
    expect(new Set(r32.flatMap((m) => [m.homeId, m.awayId])).size).toBe(32);
    expect(d.knockout.filter((m) => m.stage === 'R16').every((m) => !m.homeId)).toBe(true);

    t = simulatePending(t, { kind: 'knockout' }, seededRandom(43));
    d = deriveTournament(t);
    for (const m of d.knockout) {
      expect(m.homeId).toBeDefined();
      expect(m.winnerId).toBeDefined();
      for (const src of [m.home, m.away]) {
        if (src.kind === 'group') continue;
        const prev = d.ko[src.matchId];
        const expected = src.kind === 'winner' ? prev.winnerId : prev.loserId;
        expect(src === m.home ? m.homeId : m.awayId).toBe(expected);
      }
    }
    expect(d.champion).toBe(d.ko.F.winnerId);
    expect(d.runnerUp).toBe(d.ko.F.loserId);
    expect(d.third).toBe(d.ko['3P'].winnerId);
    expect(new Set([d.champion, d.runnerUp, d.third, d.fourth]).size).toBe(4);
  });
  it('resolves outcome with extra time, penalties and manual winner', () => {
    expect(resolveOutcome(res('A', 'B', 2, 1)).winner).toBe('home');
    expect(resolveOutcome(res('A', 'B', 1, 1)).winner).toBe(null);
    expect(resolveOutcome(res('A', 'B', 1, 1, { extraTime: { home: 0, away: 1 } }))).toMatchObject({ winner: 'away', decidedBy: 'extra' });
    expect(
      resolveOutcome(res('A', 'B', 1, 1, { extraTime: { home: 0, away: 0 }, penalties: { home: 4, away: 3 } })),
    ).toMatchObject({ winner: 'home', decidedBy: 'penalties' });
    expect(resolveOutcome(res('A', 'B', 1, 1, { winner: 'away' }))).toMatchObject({ winner: 'away', decidedBy: 'manual', override: false });
    expect(resolveOutcome(res('A', 'B', 3, 0, { winner: 'away' }))).toMatchObject({ winner: 'away', override: true });
  });
  it('changing an earlier result invalidates dependent matches', () => {
    let t = drawnTournament(5);
    t = simulatePending(t, { kind: 'all' }, seededRandom(9));
    const d = deriveTournament(t);
    const m = d.ko['R32-1'];
    // Flip the result of R32-1 so the other team advances.
    const flipped = res(m.homeId!, m.awayId!, m.winnerId === m.homeId ? 0 : 3, m.winnerId === m.homeId ? 3 : 0);
    const after = { ...t, results: { ...t.results, 'R32-1': flipped } };
    const { affected, tournament } = invalidatedBy(t, after);
    expect(affected).toContain('R16-1');
    expect(affected).toContain('QF-1');
    expect(affected).toContain('SF-1');
    expect(affected).toContain('F');
    expect(affected).toContain('3P');
    expect(affected).not.toContain('R16-2');
    const d2 = deriveTournament(tournament);
    expect(d2.ko['R16-1'].homeId).toBe(m.loserId);
    expect(d2.ko['R16-1'].result).toBeUndefined();
    expect(d2.knockout.some((x) => x.stale)).toBe(false);
  });
  it('changing a result without changing the winner invalidates nothing', () => {
    let t = drawnTournament(6);
    t = simulatePending(t, { kind: 'all' }, seededRandom(10));
    const d = deriveTournament(t);
    const m = d.ko['R16-3'];
    const homeWins = m.winnerId === m.homeId;
    const after = { ...t, results: { ...t.results, 'R16-3': res(m.homeId!, m.awayId!, homeWins ? 7 : 0, homeWins ? 0 : 7) } };
    expect(invalidatedBy(t, after).affected).toEqual([]);
  });
  it('changing a group result that alters qualifiers invalidates the knockout', () => {
    let t = drawnTournament(8);
    t = simulatePending(t, { kind: 'all' }, seededRandom(12));
    const d = deriveTournament(t);
    const g = d.groups[0];
    const results = { ...t.results };
    // Make the 4th-placed team win all their matches 9-0.
    const last = g.table.rows[3].teamId;
    for (const f of g.table.fixtures) {
      if (f.homeId === last) results[f.id] = res(f.homeId, f.awayId, 9, 0);
      if (f.awayId === last) results[f.id] = res(f.homeId, f.awayId, 0, 9);
    }
    const { affected, tournament } = invalidatedBy(t, { ...t, results });
    expect(affected.length).toBeGreaterThan(0);
    expect(cascadePrune(tournament).removed).toEqual([]);
    expect(deriveTournament(tournament).groups[0].table.rows[0].teamId).toBe(last);
  });
});

describe('statistics & consistency', () => {
  it('goals in stats equal the sum of all scores', () => {
    let t = drawnTournament(21);
    t = simulatePending(t, { kind: 'all' }, seededRandom(22));
    const d = deriveTournament(t);
    const stats = computeStats(d);
    expect(stats.matches).toBe(128);
    const sum = playedMatches(d).reduce((n, m) => n + m.total.home + m.total.away, 0);
    expect(stats.goals).toBe(sum);
    expect(stats.teams.reduce((n, x) => n + x.goalsFor, 0)).toBe(sum);
    expect(stats.teams.reduce((n, x) => n + x.goalsAgainst, 0)).toBe(sum);
    expect(stats.goalsByStage.reduce((n, s) => n + s.goals, 0)).toBe(sum);
    expect(stats.goalsByMinute.reduce((n, s) => n + s.goals, 0)).toBe(sum);
    const dist = stats.distribution;
    expect(dist.homeWins + dist.draws + dist.awayWins).toBe(128);
    // W/D/L totals are consistent
    const w = stats.teams.reduce((n, x) => n + x.won, 0);
    const l = stats.teams.reduce((n, x) => n + x.lost, 0);
    expect(w).toBe(l);
    // Simulated matches are consistent with their events
    for (const m of playedMatches(d)) expect(checkConsistency(m.result, m.stage !== 'GROUP').filter((i) => i.level === 'error')).toEqual([]);
    for (const m of playedMatches(d)) expect(checkConsistency(m.result, m.stage !== 'GROUP')).toEqual([]);
  });
  it('detects score/event inconsistency', () => {
    const r = res('ARG', 'BRA', 3, 2, {
      events: [
        { id: '1', minute: 12, teamId: 'ARG', type: 'goal' },
        { id: '2', minute: 34, teamId: 'BRA', type: 'goal' },
      ],
    });
    expect(checkConsistency(r, true).length).toBeGreaterThan(0);
    const ok = res('ARG', 'BRA', 1, 1, {
      events: [
        { id: '1', minute: 12, teamId: 'ARG', type: 'goal' },
        { id: '2', minute: 45, added: 2, teamId: 'BRA', type: 'own_goal' },
      ],
    });
    expect(checkConsistency(ok, false)).toEqual([]);
  });
  it('shoot-out simulation always produces a winner and matching kicks', () => {
    for (let s = 0; s < 200; s++) {
      const so = shootout(seededRandom(s));
      expect(so.score.home).not.toBe(so.score.away);
      expect(so.kicks.filter((k) => k.home && k.scored).length).toBe(so.score.home);
      expect(so.kicks.filter((k) => !k.home && k.scored).length).toBe(so.score.away);
    }
  });
  it('journey of the champion is complete', () => {
    let t = drawnTournament(31);
    t = simulatePending(t, { kind: 'all' }, seededRandom(32));
    const d = deriveTournament(t);
    const j = buildJourney(d, d.champion!);
    expect(j.status.kind).toBe('champion');
    expect(j.groupSteps).toHaveLength(3);
    expect(j.knockoutSteps.map((s) => s.stage)).toEqual(['R32', 'R16', 'QF', 'SF', 'F']);
    expect(j.knockoutSteps.every((s) => s.advanced)).toBe(true);
    const third = buildJourney(d, d.third!);
    expect(third.knockoutSteps.map((s) => s.stage)).toEqual(['R32', 'R16', 'QF', 'SF', '3P']);
    expect(third.status.kind).toBe('third');
  });
});

describe('momentum', () => {
  it('auto momentum has one bar per 5 minutes and favours the scorer', () => {
    const r = res('ARG', 'BRA', 1, 0, { events: [{ id: '1', minute: 62, teamId: 'ARG', type: 'goal' }] });
    const m = autoMomentum(r, false);
    expect(m).toHaveLength(18);
    expect(m.every((x) => x >= -100 && x <= 100)).toBe(true);
    expect(m[12]).toBeGreaterThan(20); // 61'-65' block
    expect(autoMomentum(r, false)).toEqual(m); // deterministic
    const et = res('ARG', 'BRA', 1, 1, { extraTime: { home: 1, away: 0 }, events: [{ id: '2', minute: 104, teamId: 'BRA', type: 'et_goal' }] });
    const m2 = autoMomentum(et, true);
    expect(m2).toHaveLength(24);
    expect(m2[20]).toBeLessThan(-20);
  });
  it('fits, smooths and measures dominance', () => {
    expect(fitMomentum([500, -3.4], 4)).toEqual([100, -3, 0, 0]);
    expect(dominance([60, -20, 0])).toEqual({ home: 75, away: 25 });
    expect(dominance([])).toEqual({ home: 50, away: 50 });
    expect(smoothMomentum([0, 100, 0])[1]).toBe(50);
  });
  it('simulated matches include a momentum curve of the right length', () => {
    let t = drawnTournament(41);
    t = simulatePending(t, { kind: 'all' }, seededRandom(42));
    const d = deriveTournament(t);
    for (const m of playedMatches(d)) {
      expect(m.result.momentum).toHaveLength(m.stage !== 'GROUP' && m.result.extraTime ? 24 : 18);
    }
  });
});

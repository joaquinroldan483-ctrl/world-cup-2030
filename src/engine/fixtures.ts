import { GROUP_LETTERS } from './types';

export interface FixtureSlot {
  matchday: number;
  /** Positions (0-based, by draw slot) of home and away teams. */
  home: number;
  away: number;
}

/**
 * Round-robin schedule using the circle method. For n=4 this produces
 * 3 matchdays × 2 matches and every pair exactly once, alternating home/away.
 */
export function roundRobin(n: number): FixtureSlot[] {
  if (n % 2 !== 0) throw new Error('roundRobin requires an even number of teams');
  const rotating = Array.from({ length: n - 1 }, (_, i) => i + 1);
  const out: FixtureSlot[] = [];
  for (let r = 0; r < n - 1; r++) {
    const circle = [0, ...rotating];
    for (let i = 0; i < n / 2; i++) {
      const a = circle[i];
      const b = circle[n - 1 - i];
      // Alternate home advantage to balance it across matchdays.
      const flip = (r + i) % 2 === 1;
      out.push({ matchday: r + 1, home: flip ? b : a, away: flip ? a : b });
    }
    rotating.unshift(rotating.pop()!);
  }
  return out;
}

export const GROUP_FIXTURE_TEMPLATE = roundRobin(4);

export const groupMatchId = (group: number, n: number) => `G${GROUP_LETTERS[group]}${n + 1}`;

export interface GroupFixture {
  id: string;
  group: number;
  matchday: number;
  homeId: string;
  awayId: string;
}

export function groupFixtures(groupIndex: number, teamIds: string[]): GroupFixture[] {
  return GROUP_FIXTURE_TEMPLATE.map((s, i) => ({
    id: groupMatchId(groupIndex, i),
    group: groupIndex,
    matchday: s.matchday,
    homeId: teamIds[s.home],
    awayId: teamIds[s.away],
  }));
}

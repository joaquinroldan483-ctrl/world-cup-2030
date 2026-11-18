import type { KnockoutStage } from './types';

/** Number of participating teams. */
export type TeamCount = 16 | 24 | 32 | 48 | 64;

export interface FormatDef {
  teams: TeamCount;
  groups: number;
  /** Best third-placed teams that also qualify. */
  thirds: number;
  /** Teams in the knockout bracket (8, 16 or 32). */
  bracket: 8 | 16 | 32;
  label: string;
  description: string;
}

export const FORMATS: Record<TeamCount, FormatDef> = {
  16: { teams: 16, groups: 4, thirds: 0, bracket: 8, label: '16 selecciones', description: '4 grupos de 4 · pasan los 2 primeros · cuartos de final' },
  24: { teams: 24, groups: 6, thirds: 4, bracket: 16, label: '24 selecciones', description: '6 grupos de 4 · 2 primeros + 4 mejores terceros · octavos' },
  32: { teams: 32, groups: 8, thirds: 0, bracket: 16, label: '32 selecciones', description: '8 grupos de 4 · pasan los 2 primeros · octavos de final' },
  48: { teams: 48, groups: 12, thirds: 8, bracket: 32, label: '48 selecciones', description: '12 grupos de 4 · 2 primeros + 8 mejores terceros · dieciseisavos' },
  64: { teams: 64, groups: 16, thirds: 0, bracket: 32, label: '64 selecciones', description: '16 grupos de 4 · pasan los 2 primeros · dieciseisavos' },
};

export const TEAM_COUNTS: TeamCount[] = [16, 24, 32, 48, 64];

export const isTeamCount = (n: unknown): n is TeamCount => TEAM_COUNTS.includes(n as TeamCount);

/** First knockout round for a bracket size. */
export function firstRound(bracket: number): KnockoutStage {
  return bracket >= 32 ? 'R32' : bracket >= 16 ? 'R16' : 'QF';
}

const ORDER: KnockoutStage[] = ['R32', 'R16', 'QF', 'SF', '3P', 'F'];

/** Knockout stages played in a format, in order. */
export function stagesOf(teams: TeamCount): KnockoutStage[] {
  return ORDER.slice(ORDER.indexOf(firstRound(FORMATS[teams].bracket)));
}

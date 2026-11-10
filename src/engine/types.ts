/**
 * Core domain types for the tournament engine.
 * The engine is pure TypeScript and has no dependency on React or the browser.
 */

export type Confederation = 'UEFA' | 'CAF' | 'AFC' | 'CONMEBOL' | 'CONCACAF' | 'OFC';

export const CONFEDERATIONS: Confederation[] = ['UEFA', 'CAF', 'AFC', 'CONMEBOL', 'CONCACAF', 'OFC'];

export interface Team {
  /** Unique identifier (FIFA-style trigram). */
  id: string;
  /** Display name (Spanish). */
  name: string;
  /** ISO / flag-icons code used to resolve the flag asset. */
  flag: string;
  confederation: Confederation;
  /** Primary identity colour. */
  color: string;
  /** Secondary identity colour. */
  color2: string;
}

export const GROUP_COUNT = 16;
export const TEAMS_PER_GROUP = 4;
export const GROUP_LETTERS = 'ABCDEFGHIJKLMNOP'.split('');

export type EventType =
  | 'goal'
  | 'penalty_goal'
  | 'penalty_miss'
  | 'own_goal'
  | 'yellow'
  | 'red'
  | 'sub'
  | 'et_goal'
  | 'shootout_scored'
  | 'shootout_missed';

export interface MatchEvent {
  id: string;
  /** Minute of the match (1–120). For shoot-out events this is the kick order. */
  minute: number;
  /** Added time (e.g. 45+2 → minute 45, added 2). */
  added?: number;
  /**
   * Team the event belongs to. For own goals this is the team that
   * BENEFITS from the goal (the one whose score increases).
   */
  teamId: string;
  type: EventType;
  player?: string;
  description?: string;
}

export interface Score {
  home: number;
  away: number;
}

export interface MatchResult {
  /** Snapshot of the participants when the result was entered (used to detect stale results). */
  homeId: string;
  awayId: string;
  /** Score after regulation time (90'). */
  regular: Score;
  /** Goals scored during extra time only (knockout). */
  extraTime?: Score | null;
  /** Penalty shoot-out score (knockout). */
  penalties?: Score | null;
  /** Explicit qualified team chosen by the user (knockout). */
  winner?: 'home' | 'away' | null;
  events: MatchEvent[];
  updatedAt: number;
}

export type KnockoutStage = 'R32' | 'R16' | 'QF' | 'SF' | '3P' | 'F';
export type Stage = 'GROUP' | KnockoutStage;

export const KNOCKOUT_STAGES: KnockoutStage[] = ['R32', 'R16', 'QF', 'SF', '3P', 'F'];

export const STAGE_LABEL: Record<Stage, string> = {
  GROUP: 'Fase de grupos',
  R32: 'Dieciseisavos de final',
  R16: 'Octavos de final',
  QF: 'Cuartos de final',
  SF: 'Semifinales',
  '3P': 'Tercer puesto',
  F: 'Gran final',
};

export const STAGE_SHORT: Record<Stage, string> = {
  GROUP: 'Grupos',
  R32: '16avos',
  R16: 'Octavos',
  QF: 'Cuartos',
  SF: 'Semis',
  '3P': '3er puesto',
  F: 'Final',
};

export type TiebreakCriterion =
  | 'points'
  | 'goalDiff'
  | 'goalsFor'
  | 'h2hPoints'
  | 'h2hGoalDiff'
  | 'h2hGoalsFor'
  | 'wins'
  | 'fairPlay'
  | 'lots';

export const TIEBREAK_LABEL: Record<TiebreakCriterion, string> = {
  points: 'Puntos',
  goalDiff: 'Diferencia de gol',
  goalsFor: 'Goles a favor',
  h2hPoints: 'Enfrentamiento directo · puntos',
  h2hGoalDiff: 'Enfrentamiento directo · diferencia de gol',
  h2hGoalsFor: 'Enfrentamiento directo · goles a favor',
  wins: 'Victorias',
  fairPlay: 'Juego limpio (tarjetas)',
  lots: 'Sorteo',
};

export const DEFAULT_TIEBREAKERS: TiebreakCriterion[] = [
  'points',
  'goalDiff',
  'goalsFor',
  'h2hPoints',
  'h2hGoalDiff',
  'h2hGoalsFor',
  'fairPlay',
  'lots',
];

export type DrawMode = 'free' | 'confederation' | 'pots' | 'manual';

export interface DrawConfig {
  mode: DrawMode;
  /** Maximum number of teams of each confederation allowed in a single group. */
  confedMax: Record<Confederation, number>;
  /** In pots mode, also enforce confederation limits. */
  potsUseConfedRules: boolean;
  /** Validate confederation limits in manual mode. */
  manualUseConfedRules: boolean;
  /** Pre-place the three hosts as heads of groups A, B and C. */
  hostsSeeded: boolean;
}

export interface DrawStep {
  teamId: string;
  group: number;
  slot: number;
  /** Pot index (0-based) when the draw used pots. */
  pot?: number;
  /** True if the team was pre-placed (e.g. hosts). */
  preset?: boolean;
}

export interface DrawResult {
  groups: string[][];
  steps: DrawStep[];
  mode: DrawMode;
}

export interface Tournament {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  schema: 1;
  /** Custom display names for teams (id → name). */
  teamNames: Record<string, string>;
  /** Custom ranking (ordered team ids) used for pots and auto-simulation strength. */
  ranking: string[];
  drawConfig: DrawConfig;
  /** 16 groups × 4 team ids, or null if the draw has not been confirmed. */
  groups: string[][] | null;
  /** Extraction order of the confirmed draw. */
  drawSteps: DrawStep[];
  drawMode: DrawMode | null;
  results: Record<string, MatchResult>;
  tiebreakers: TiebreakCriterion[];
  /** Seed used for deterministic "drawing of lots" tie-breaks. */
  seed: string;
  /** ISO date of the tournament kickoff, for the countdown. */
  kickoff: string;
}

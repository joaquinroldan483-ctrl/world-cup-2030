import type { EventType, MatchEvent, MatchResult, Score } from './types';

export const GOAL_TYPES: EventType[] = ['goal', 'penalty_goal', 'own_goal', 'et_goal'];

export const EVENT_LABEL: Record<EventType, string> = {
  goal: 'Gol',
  penalty_goal: 'Penal convertido',
  penalty_miss: 'Penal errado',
  own_goal: 'Autogol',
  yellow: 'Tarjeta amarilla',
  red: 'Tarjeta roja',
  sub: 'Cambio',
  et_goal: 'Gol en prórroga',
  shootout_scored: 'Tanda · penal convertido',
  shootout_missed: 'Tanda · penal errado',
};

export const EVENT_TYPES: EventType[] = [
  'goal',
  'penalty_goal',
  'penalty_miss',
  'own_goal',
  'yellow',
  'red',
  'sub',
  'et_goal',
  'shootout_scored',
  'shootout_missed',
];

export type Period = 'regular' | 'extra' | 'shootout';

export function eventPeriod(e: MatchEvent): Period {
  if (e.type === 'shootout_scored' || e.type === 'shootout_missed') return 'shootout';
  if (e.type === 'et_goal') return 'extra';
  return e.minute > 90 ? 'extra' : 'regular';
}

export const isGoal = (e: MatchEvent) => GOAL_TYPES.includes(e.type);

export function formatMinute(e: Pick<MatchEvent, 'minute' | 'added' | 'type'>): string {
  if (e.type === 'shootout_scored' || e.type === 'shootout_missed') return `P${e.minute}`;
  return e.added ? `${e.minute}+${e.added}'` : `${e.minute}'`;
}

export function sortEvents(events: MatchEvent[]): MatchEvent[] {
  const order = (e: MatchEvent) => (eventPeriod(e) === 'shootout' ? 10000 + e.minute : e.minute * 100 + (e.added ?? 0));
  return events.slice().sort((a, b) => order(a) - order(b));
}

export interface EventTally {
  regular: Score;
  extra: Score;
  shootout: Score;
  hasGoalEvents: boolean;
  hasShootoutEvents: boolean;
}

export function tallyEvents(r: Pick<MatchResult, 'homeId' | 'awayId' | 'events'>): EventTally {
  const t: EventTally = {
    regular: { home: 0, away: 0 },
    extra: { home: 0, away: 0 },
    shootout: { home: 0, away: 0 },
    hasGoalEvents: false,
    hasShootoutEvents: false,
  };
  for (const e of r.events) {
    const side = e.teamId === r.homeId ? 'home' : e.teamId === r.awayId ? 'away' : null;
    if (!side) continue;
    const p = eventPeriod(e);
    if (p === 'shootout') {
      t.hasShootoutEvents = true;
      if (e.type === 'shootout_scored') t.shootout[side]++;
    } else if (isGoal(e)) {
      t.hasGoalEvents = true;
      t[p][side]++;
    }
  }
  return t;
}

export interface Inconsistency {
  level: 'error' | 'warning';
  message: string;
}

const s = (x: Score) => `${x.home}-${x.away}`;

/** Checks that the score and the registered events tell the same story. */
export function checkConsistency(r: MatchResult, knockout: boolean): Inconsistency[] {
  const out: Inconsistency[] = [];
  const t = tallyEvents(r);
  for (const e of r.events) {
    if (e.teamId !== r.homeId && e.teamId !== r.awayId)
      out.push({ level: 'error', message: `Hay un acontecimiento asignado a una selección que no juega este partido.` });
    if (eventPeriod(e) === 'extra' && !knockout && isGoal(e))
      out.push({ level: 'warning', message: `Gol en el minuto ${e.minute}: la fase de grupos no tiene prórroga.` });
    if (e.minute < 0 || e.minute > 130)
      out.push({ level: 'error', message: `Minuto fuera de rango (${e.minute}).` });
  }
  if (t.hasGoalEvents) {
    if (t.regular.home !== r.regular.home || t.regular.away !== r.regular.away)
      out.push({
        level: 'warning',
        message: `Los goles registrados en el tiempo reglamentario (${s(t.regular)}) no coinciden con el marcador (${s(r.regular)}).`,
      });
    const et = r.extraTime ?? { home: 0, away: 0 };
    if (t.extra.home !== et.home || t.extra.away !== et.away)
      out.push({
        level: 'warning',
        message: `Los goles registrados en la prórroga (${s(t.extra)}) no coinciden con el resultado de la prórroga (${s(et)}).`,
      });
  }
  if (t.hasShootoutEvents) {
    const p = r.penalties ?? { home: 0, away: 0 };
    if (t.shootout.home !== p.home || t.shootout.away !== p.away)
      out.push({
        level: 'warning',
        message: `La tanda registrada (${s(t.shootout)}) no coincide con el resultado de los penales (${s(p)}).`,
      });
  }
  if (knockout) {
    const o = resolveOutcome(r);
    if (r.extraTime && r.regular.home !== r.regular.away)
      out.push({ level: 'warning', message: 'Hay prórroga cargada, pero el partido no terminó empatado en los 90 minutos.' });
    if (r.penalties && totals(r).home !== totals(r).away)
      out.push({ level: 'warning', message: 'Hay penales cargados, pero el partido no terminó empatado tras la prórroga.' });
    if (r.penalties && r.penalties.home === r.penalties.away)
      out.push({ level: 'warning', message: 'La tanda de penales no puede terminar empatada.' });
    if (o.override)
      out.push({
        level: 'warning',
        message: 'El clasificado elegido manualmente contradice el marcador (se respetará tu elección).',
      });
  }
  return out;
}

/** Total goals (regulation + extra time). Penalties are not goals. */
export function totals(r: Pick<MatchResult, 'regular' | 'extraTime'>): Score {
  return {
    home: r.regular.home + (r.extraTime?.home ?? 0),
    away: r.regular.away + (r.extraTime?.away ?? 0),
  };
}

export type DecidedBy = 'regular' | 'extra' | 'penalties' | 'manual';

export interface Outcome {
  winner: 'home' | 'away' | null;
  decidedBy: DecidedBy | null;
  /** True if an explicit winner contradicts the scoreline. */
  override: boolean;
}

/** Determines the qualified side of a knockout match. */
export function resolveOutcome(r: MatchResult): Outcome {
  let derived: 'home' | 'away' | null = null;
  let by: DecidedBy | null = null;
  if (r.regular.home !== r.regular.away) {
    derived = r.regular.home > r.regular.away ? 'home' : 'away';
    by = 'regular';
  } else if (r.extraTime) {
    const t = totals(r);
    if (t.home !== t.away) {
      derived = t.home > t.away ? 'home' : 'away';
      by = 'extra';
    }
  }
  if (!derived && r.penalties && r.penalties.home !== r.penalties.away) {
    derived = r.penalties.home > r.penalties.away ? 'home' : 'away';
    by = 'penalties';
  }
  if (r.winner) {
    if (derived && derived !== r.winner) return { winner: r.winner, decidedBy: 'manual', override: true };
    if (!derived) return { winner: r.winner, decidedBy: 'manual', override: false };
  }
  return { winner: derived, decidedBy: by, override: false };
}

export function formatScoreline(r: MatchResult, knockout: boolean): string {
  let out = `${r.regular.home}-${r.regular.away}`;
  if (knockout && r.extraTime) {
    const t = totals(r);
    out = `${t.home}-${t.away} (pró.)`;
  }
  if (knockout && r.penalties) out += ` · pen. ${r.penalties.home}-${r.penalties.away}`;
  return out;
}

export function emptyResult(homeId: string, awayId: string): MatchResult {
  return { homeId, awayId, regular: { home: 0, away: 0 }, extraTime: null, penalties: null, winner: null, events: [], updatedAt: Date.now() };
}

/** Builds a scoreline that matches the registered goal events. */
export function syncScoreFromEvents(r: MatchResult, knockout: boolean): MatchResult {
  const t = tallyEvents(r);
  const next: MatchResult = { ...r, regular: { ...t.regular } };
  if (knockout) {
    const hasExtra = t.extra.home + t.extra.away > 0 || r.extraTime;
    next.extraTime = t.regular.home === t.regular.away && hasExtra ? { ...t.extra } : r.extraTime && t.regular.home === t.regular.away ? r.extraTime : null;
    if (t.hasShootoutEvents) next.penalties = { ...t.shootout };
  }
  return next;
}

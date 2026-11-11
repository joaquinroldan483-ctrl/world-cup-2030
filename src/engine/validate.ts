import { DEFAULT_DRAW_CONFIG } from './draw';
import { TEAM_BY_ID, DEFAULT_RANKING } from './teams';
import { createTournament } from './tournament';
import { CONFEDERATIONS, DEFAULT_TIEBREAKERS, GROUP_COUNT, TEAMS_PER_GROUP, type MatchResult, type TiebreakCriterion, type Tournament } from './types';
import { EVENT_TYPES } from './results';

export class ImportError extends Error {}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const num = (x: unknown, d = 0) => (typeof x === 'number' && Number.isFinite(x) ? Math.max(0, Math.floor(x)) : d);
const score = (x: unknown) => (isObj(x) ? { home: num(x.home), away: num(x.away) } : null);

/** Parses and sanitises an imported tournament file. Throws ImportError with a readable message. */
export function parseTournament(input: unknown): Tournament {
  const raw = isObj(input) && isObj(input.tournament) ? input.tournament : input;
  if (!isObj(raw)) throw new ImportError('El archivo no contiene un torneo válido.');
  if (raw.schema !== 1) throw new ImportError('Versión de archivo no compatible.');
  const base = createTournament(typeof raw.name === 'string' ? raw.name.slice(0, 80) : 'Torneo importado');

  let groups: string[][] | null = null;
  if (Array.isArray(raw.groups)) {
    if (raw.groups.length !== GROUP_COUNT) throw new ImportError('El torneo debe tener 16 grupos.');
    groups = raw.groups.map((g, i) => {
      if (!Array.isArray(g) || g.length !== TEAMS_PER_GROUP) throw new ImportError(`El grupo ${i + 1} no tiene 4 selecciones.`);
      return g.map((id) => {
        if (typeof id !== 'string' || !TEAM_BY_ID[id]) throw new ImportError(`Selección desconocida: ${String(id)}`);
        return id;
      });
    });
    if (new Set(groups.flat()).size !== 64) throw new ImportError('Hay selecciones repetidas en los grupos.');
  }

  const results: Record<string, MatchResult> = {};
  if (isObj(raw.results)) {
    for (const [id, r] of Object.entries(raw.results)) {
      if (!isObj(r) || typeof r.homeId !== 'string' || typeof r.awayId !== 'string') continue;
      const reg = score(r.regular);
      if (!reg) continue;
      results[id] = {
        homeId: r.homeId,
        awayId: r.awayId,
        regular: reg,
        extraTime: score(r.extraTime),
        penalties: score(r.penalties),
        winner: r.winner === 'home' || r.winner === 'away' ? r.winner : null,
        events: Array.isArray(r.events)
          ? r.events
              .filter((e): e is Record<string, unknown> => isObj(e) && EVENT_TYPES.includes(e.type as never) && typeof e.teamId === 'string')
              .map((e, i) => ({
                id: typeof e.id === 'string' ? e.id : `imp${i}`,
                minute: num(e.minute, 1),
                added: e.added ? num(e.added) : undefined,
                teamId: e.teamId as string,
                type: e.type as MatchResult['events'][number]['type'],
                player: typeof e.player === 'string' ? e.player.slice(0, 60) : undefined,
                description: typeof e.description === 'string' ? e.description.slice(0, 200) : undefined,
              }))
          : [],
        momentum: Array.isArray(r.momentum)
          ? r.momentum.slice(0, 24).map((x) => (typeof x === 'number' && Number.isFinite(x) ? Math.max(-100, Math.min(100, Math.round(x))) : 0))
          : null,
        updatedAt: num(r.updatedAt, Date.now()),
      };
    }
  }

  const ranking = Array.isArray(raw.ranking) && raw.ranking.length === 64 && new Set(raw.ranking).size === 64 && raw.ranking.every((id) => TEAM_BY_ID[id as string])
    ? (raw.ranking as string[])
    : DEFAULT_RANKING.slice();
  const tiebreakers = Array.isArray(raw.tiebreakers) && raw.tiebreakers.every((c) => DEFAULT_TIEBREAKERS.includes(c as TiebreakCriterion) || c === 'wins')
    ? (raw.tiebreakers as TiebreakCriterion[])
    : DEFAULT_TIEBREAKERS.slice();
  const dc = isObj(raw.drawConfig) ? raw.drawConfig : {};
  const confedMax = { ...DEFAULT_DRAW_CONFIG.confedMax };
  if (isObj(dc.confedMax)) for (const c of CONFEDERATIONS) confedMax[c] = Math.max(1, Math.min(4, num(dc.confedMax[c], confedMax[c])));
  const teamNames: Record<string, string> = {};
  if (isObj(raw.teamNames)) for (const [k, v] of Object.entries(raw.teamNames)) if (TEAM_BY_ID[k] && typeof v === 'string' && v.trim()) teamNames[k] = v.slice(0, 40);

  return {
    ...base,
    teamNames,
    ranking,
    tiebreakers,
    drawConfig: {
      mode: ['free', 'confederation', 'pots', 'manual'].includes(dc.mode as string) ? (dc.mode as Tournament['drawConfig']['mode']) : 'free',
      confedMax,
      potsUseConfedRules: dc.potsUseConfedRules !== false,
      manualUseConfedRules: dc.manualUseConfedRules === true,
      hostsSeeded: dc.hostsSeeded !== false,
    },
    groups,
    drawSteps: groups && Array.isArray(raw.drawSteps) ? (raw.drawSteps as Tournament['drawSteps']).filter((s) => isObj(s) && TEAM_BY_ID[s.teamId]) : [],
    drawMode: groups ? ((raw.drawMode as Tournament['drawMode']) ?? 'manual') : null,
    results: groups ? results : {},
    seed: typeof raw.seed === 'string' ? raw.seed : base.seed,
    kickoff: typeof raw.kickoff === 'string' && !Number.isNaN(Date.parse(raw.kickoff)) ? raw.kickoff : base.kickoff,
  };
}

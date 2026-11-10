import { HOST_IDS, TEAM_BY_ID } from './teams';
import {
  CONFEDERATIONS,
  GROUP_COUNT,
  GROUP_LETTERS,
  TEAMS_PER_GROUP,
  type Confederation,
  type DrawConfig,
  type DrawResult,
  type DrawStep,
} from './types';
import { secureRandom, shuffle, type RNG } from './random';

export const DEFAULT_CONFED_MAX: Record<Confederation, number> = {
  UEFA: 2,
  CAF: 1,
  AFC: 1,
  CONMEBOL: 1,
  CONCACAF: 1,
  OFC: 1,
};

export const DEFAULT_DRAW_CONFIG: DrawConfig = {
  mode: 'free',
  confedMax: { ...DEFAULT_CONFED_MAX },
  potsUseConfedRules: true,
  manualUseConfedRules: false,
  hostsSeeded: true,
};

export class DrawError extends Error {}

/** Splits a ranking into 4 pots of 16 teams. */
export function buildPots(ranking: string[], hostsSeeded: boolean): string[][] {
  let order = ranking.slice();
  if (hostsSeeded) {
    order = [...HOST_IDS, ...order.filter((id) => !(HOST_IDS as readonly string[]).includes(id))];
  }
  const pots: string[][] = [];
  for (let p = 0; p < TEAMS_PER_GROUP; p++) pots.push(order.slice(p * GROUP_COUNT, (p + 1) * GROUP_COUNT));
  return pots;
}

const confOf = (id: string): Confederation => {
  const t = TEAM_BY_ID[id];
  if (!t) throw new DrawError(`Selección desconocida: ${id}`);
  return t.confederation;
};

/** Checks that confederation limits can be satisfied at all (necessary condition). */
export function checkConfedFeasibility(teamIds: string[], confedMax: Record<Confederation, number>): string[] {
  const errors: string[] = [];
  const counts = countConfeds(teamIds);
  for (const c of CONFEDERATIONS) {
    const max = confedMax[c];
    if (counts[c] > max * GROUP_COUNT) {
      errors.push(
        `${c}: ${counts[c]} selecciones no caben con un máximo de ${max} por grupo (capacidad ${max * GROUP_COUNT}).`,
      );
    }
  }
  return errors;
}

function countConfeds(ids: string[]): Record<Confederation, number> {
  const counts = Object.fromEntries(CONFEDERATIONS.map((c) => [c, 0])) as Record<Confederation, number>;
  for (const id of ids) counts[confOf(id)]++;
  return counts;
}

interface SolverState {
  groups: string[][];
  conf: Record<Confederation, number>[];
}

function emptyState(): SolverState {
  return {
    groups: Array.from({ length: GROUP_COUNT }, () => []),
    conf: Array.from(
      { length: GROUP_COUNT },
      () => Object.fromEntries(CONFEDERATIONS.map((c) => [c, 0])) as Record<Confederation, number>,
    ),
  };
}

interface Constraint {
  confedMax: Record<Confederation, number> | null;
  /** Pot index per team (pots mode): each group may contain at most one team per pot. */
  potOf: Record<string, number> | null;
}

function canPlace(state: SolverState, g: number, id: string, c: Constraint): boolean {
  const grp = state.groups[g];
  if (grp.length >= TEAMS_PER_GROUP) return false;
  if (c.confedMax) {
    const conf = confOf(id);
    if (state.conf[g][conf] >= c.confedMax[conf]) return false;
  }
  if (c.potOf) {
    const pot = c.potOf[id];
    if (grp.some((other) => c.potOf![other] === pot)) return false;
  }
  return true;
}

function place(state: SolverState, g: number, id: string) {
  state.groups[g].push(id);
  state.conf[g][confOf(id)]++;
}
function unplace(state: SolverState, g: number, id: string) {
  state.groups[g].pop();
  state.conf[g][confOf(id)]--;
}

/** DFS with minimum-remaining-values heuristic: can the remaining teams still be placed? */
function canComplete(state: SolverState, remaining: string[], c: Constraint, budget: { n: number }): boolean {
  if (remaining.length === 0) return true;
  if (--budget.n < 0) throw new DrawError('budget');
  let best = -1;
  let bestOpts: number[] | null = null;
  for (let i = 0; i < remaining.length; i++) {
    const opts: number[] = [];
    for (let g = 0; g < GROUP_COUNT; g++) if (canPlace(state, g, remaining[i], c)) opts.push(g);
    if (opts.length === 0) return false;
    if (!bestOpts || opts.length < bestOpts.length) {
      best = i;
      bestOpts = opts;
      if (opts.length === 1) break;
    }
  }
  const id = remaining[best];
  const rest = remaining.slice(0, best).concat(remaining.slice(best + 1));
  // Prefer emptier groups first: finds solutions quickly for loose constraints.
  bestOpts!.sort((a, b) => state.groups[a].length - state.groups[b].length);
  for (const g of bestOpts!) {
    place(state, g, id);
    const ok = canComplete(state, rest, c, budget);
    unplace(state, g, id);
    if (ok) return true;
  }
  return false;
}

export interface DrawOptions {
  rng?: RNG;
  ranking: string[];
  teamIds: string[];
}

/**
 * Performs an automatic draw according to the configuration.
 * - free: truly random (Fisher–Yates with crypto RNG), balls go to groups in rotation.
 * - confederation: random order; each ball goes to the first group (in rotation) that keeps the draw solvable.
 * - pots: 4 pots by custom ranking; one team per pot in every group (optionally with confederation rules).
 */
export function performDraw(config: DrawConfig, opts: DrawOptions): DrawResult {
  const rng = opts.rng ?? secureRandom;
  const teamIds = opts.teamIds;
  if (new Set(teamIds).size !== GROUP_COUNT * TEAMS_PER_GROUP) {
    throw new DrawError(`Se necesitan exactamente ${GROUP_COUNT * TEAMS_PER_GROUP} selecciones distintas.`);
  }
  if (config.mode === 'manual') throw new DrawError('El sorteo manual no se realiza automáticamente.');

  const useConfed = config.mode === 'confederation' || (config.mode === 'pots' && config.potsUseConfedRules);
  if (useConfed) {
    const errs = checkConfedFeasibility(teamIds, config.confedMax);
    if (errs.length) throw new DrawError(errs.join(' '));
  }

  let potOf: Record<string, number> | null = null;
  let order: { id: string; pot?: number }[];
  const hosts = config.hostsSeeded ? HOST_IDS.filter((h) => teamIds.includes(h)) : [];

  if (config.mode === 'pots') {
    const pots = buildPots(opts.ranking.filter((id) => teamIds.includes(id)), config.hostsSeeded);
    // Teams missing from ranking (should not happen) are appended to the last pot.
    const ranked = new Set(pots.flat());
    const missing = teamIds.filter((id) => !ranked.has(id));
    pots[pots.length - 1].push(...missing);
    potOf = {};
    pots.forEach((p, i) => p.forEach((id) => (potOf![id] = i)));
    order = pots.flatMap((p, i) => shuffle(p.filter((id) => !hosts.includes(id as never)), rng).map((id) => ({ id, pot: i })));
  } else {
    order = shuffle(teamIds.filter((id) => !hosts.includes(id as never)), rng).map((id) => ({ id }));
  }

  const constraint: Constraint = { confedMax: useConfed ? config.confedMax : null, potOf };

  for (let attempt = 0; attempt < 25; attempt++) {
    try {
      const state = emptyState();
      const steps: DrawStep[] = [];
      hosts.forEach((h, i) => {
        place(state, i, h);
        steps.push({ teamId: h, group: i, slot: 0, pot: potOf ? potOf[h] : undefined, preset: true });
      });
      const sequence = attempt === 0 ? order : reshuffleWithinPots(order, rng);
      let cursor = 0; // rotation pointer: first ball → A, next → B, ...
      for (let k = 0; k < sequence.length; k++) {
        const { id, pot } = sequence[k];
        const remaining = sequence.slice(k + 1).map((s) => s.id);
        let placed = false;
        // In pots mode the rotation restarts at group A for each pot (like a real ceremony).
        if (potOf && k > 0 && sequence[k - 1].pot !== pot) cursor = 0;
        for (let step = 0; step < GROUP_COUNT; step++) {
          const g = (cursor + step) % GROUP_COUNT;
          if (!canPlace(state, g, id, constraint)) continue;
          place(state, g, id);
          const ok =
            !constraint.confedMax && !constraint.potOf
              ? true
              : canComplete(state, remaining, constraint, { n: 20000 });
          if (ok) {
            steps.push({ teamId: id, group: g, slot: state.groups[g].length - 1, pot });
            cursor = (g + 1) % GROUP_COUNT;
            placed = true;
            break;
          }
          unplace(state, g, id);
        }
        if (!placed) throw new DrawError('dead-end');
      }
      return { groups: state.groups.map((g) => g.slice()), steps, mode: config.mode };
    } catch (e) {
      if (!(e instanceof DrawError) || (e.message !== 'dead-end' && e.message !== 'budget')) throw e;
    }
  }
  throw new DrawError('No se encontró una distribución válida con las reglas actuales. Revisá las restricciones.');
}

function reshuffleWithinPots(order: { id: string; pot?: number }[], rng: RNG) {
  if (order.every((o) => o.pot === undefined)) return shuffle(order, rng);
  const byPot = new Map<number, { id: string; pot?: number }[]>();
  for (const o of order) {
    const k = o.pot ?? 0;
    if (!byPot.has(k)) byPot.set(k, []);
    byPot.get(k)!.push(o);
  }
  return [...byPot.keys()].sort((a, b) => a - b).flatMap((k) => shuffle(byPot.get(k)!, rng));
}

export interface ValidationIssue {
  level: 'error' | 'warning';
  message: string;
}

/** Validates a set of groups against structural and configured rules. */
export function validateGroups(
  groups: string[][],
  config: DrawConfig,
  ranking: string[],
  teamIds: string[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (groups.length !== GROUP_COUNT) issues.push({ level: 'error', message: `Debe haber ${GROUP_COUNT} grupos.` });
  const seen = new Map<string, number>();
  groups.forEach((g, gi) => {
    if (g.length !== TEAMS_PER_GROUP)
      issues.push({ level: 'error', message: `Grupo ${GROUP_LETTERS[gi]}: tiene ${g.length} selecciones (deben ser ${TEAMS_PER_GROUP}).` });
    g.forEach((id) => {
      if (!TEAM_BY_ID[id]) issues.push({ level: 'error', message: `Selección desconocida: ${id}` });
      seen.set(id, (seen.get(id) ?? 0) + 1);
    });
  });
  for (const [id, n] of seen) if (n > 1) issues.push({ level: 'error', message: `${TEAM_BY_ID[id]?.name ?? id} aparece ${n} veces.` });
  for (const id of teamIds) if (!seen.has(id)) issues.push({ level: 'error', message: `${TEAM_BY_ID[id]?.name ?? id} no está asignada a ningún grupo.` });

  const useConfed =
    config.mode === 'confederation' ||
    (config.mode === 'pots' && config.potsUseConfedRules) ||
    (config.mode === 'manual' && config.manualUseConfedRules);
  if (useConfed) {
    groups.forEach((g, gi) => {
      const counts = countConfeds(g.filter((id) => TEAM_BY_ID[id]));
      for (const c of CONFEDERATIONS) {
        if (counts[c] > config.confedMax[c])
          issues.push({
            level: 'error',
            message: `Grupo ${GROUP_LETTERS[gi]}: ${counts[c]} selecciones de ${c} (máximo ${config.confedMax[c]}).`,
          });
      }
    });
  }
  if (config.mode === 'pots') {
    const pots = buildPots(ranking, config.hostsSeeded);
    const potOf: Record<string, number> = {};
    pots.forEach((p, i) => p.forEach((id) => (potOf[id] = i)));
    groups.forEach((g, gi) => {
      const ps = g.map((id) => potOf[id]);
      if (new Set(ps).size !== ps.length)
        issues.push({ level: 'error', message: `Grupo ${GROUP_LETTERS[gi]}: tiene más de una selección del mismo bombo.` });
    });
  }
  return issues;
}

/** Fills the empty slots of a partial manual draw randomly, honouring rules when possible. */
export function completeManualDraw(
  partial: string[][],
  config: DrawConfig,
  teamIds: string[],
  rng: RNG = secureRandom,
): string[][] {
  const state = emptyState();
  partial.forEach((g, gi) => g.forEach((id) => place(state, gi, id)));
  const used = new Set(partial.flat());
  const remaining = shuffle(teamIds.filter((id) => !used.has(id)), rng);
  const constraint: Constraint = { confedMax: config.manualUseConfedRules ? config.confedMax : null, potOf: null };
  for (let k = 0; k < remaining.length; k++) {
    const id = remaining[k];
    const opts = shuffle(
      Array.from({ length: GROUP_COUNT }, (_, g) => g).filter((g) => canPlace(state, g, id, constraint)),
      rng,
    );
    let placed = false;
    for (const g of opts) {
      place(state, g, id);
      let ok = true;
      if (constraint.confedMax) {
        try {
          ok = canComplete(state, remaining.slice(k + 1), constraint, { n: 20000 });
        } catch {
          ok = false;
        }
      }
      if (ok) {
        placed = true;
        break;
      }
      unplace(state, g, id);
    }
    if (!placed) {
      // Fall back to ignoring confederation rules for this team.
      const g = Array.from({ length: GROUP_COUNT }, (_, i) => i).find((i) => state.groups[i].length < TEAMS_PER_GROUP);
      if (g === undefined) throw new DrawError('No hay espacio disponible.');
      place(state, g, id);
    }
  }
  return state.groups;
}

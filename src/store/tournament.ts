import { useMemo } from 'react';
import { create } from 'zustand';
import {
  BRACKET_BY_ID,
  STAGE_LABEL,
  STAGE_SHORT,
  TEAM_BY_ID,
  createTournament,
  currentPhase,
  deriveTournament,
  formatScoreline,
  invalidatedBy,
  parseTournament,
  stageMatches,
  uid,
  type DerivedTournament,
  type KnockoutStage,
  type Tournament,
} from '../engine';
import { sound } from '../lib/sound';
import { DEFAULT_PREFS, persistence, type Prefs, type TournamentMeta } from './persistence';
import { confirmDialog, toast, useUI, type Celebration } from './ui';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface CommitOptions {
  /** Short description for undo history. */
  label?: string;
  /** Trigger celebrations: 'match' for a single edited match, 'bulk' for simulations. */
  celebrate?: 'match' | 'bulk' | false;
  matchId?: string;
}

interface State {
  ready: boolean;
  saveState: SaveState;
  index: TournamentMeta[];
  t: Tournament;
  past: { t: Tournament; label: string }[];
  future: { t: Tournament; label: string }[];
  prefs: Prefs;
  init: () => Promise<void>;
  /** Applies a change. Asks for confirmation if later results would be invalidated. Resolves to false if cancelled. */
  commit: (fn: (t: Tournament) => Tournament, opts?: CommitOptions) => Promise<boolean>;
  undo: () => void;
  redo: () => void;
  setPrefs: (p: Partial<Prefs>) => void;
  newTournament: (name?: string) => Promise<void>;
  switchTournament: (id: string) => Promise<void>;
  duplicateTournament: (id: string) => Promise<void>;
  renameTournament: (id: string, name: string) => Promise<void>;
  deleteTournament: (id: string) => Promise<void>;
  importTournament: (json: unknown) => Promise<void>;
}

const metaOf = (t: Tournament): TournamentMeta => {
  const d = deriveTournament(t);
  return { id: t.id, name: t.name, createdAt: t.createdAt, updatedAt: t.updatedAt, phase: currentPhase(d), champion: d.champion };
};

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export const useStore = create<State>((set, get) => {
  const scheduleSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    set({ saveState: 'saving' });
    saveTimer = setTimeout(async () => {
      const { t, index } = get();
      try {
        await persistence.saveTournament(t);
        const meta = metaOf(t);
        const next = index.some((m) => m.id === t.id) ? index.map((m) => (m.id === t.id ? meta : m)) : [...index, meta];
        await persistence.saveIndex(next);
        set({ index: next, saveState: 'saved' });
      } catch (e) {
        console.error(e);
        set({ saveState: 'error' });
        toast({ kind: 'error', title: 'No se pudo guardar', message: 'Revisá el espacio de almacenamiento del navegador.' });
      }
    }, 300);
  };

  const apply = (next: Tournament, label: string) => {
    const { t, past } = get();
    const stamped = { ...next, updatedAt: Date.now() };
    set({ t: stamped, past: [...past, { t, label }].slice(-80), future: [] });
    scheduleSave();
  };

  return {
    ready: false,
    saveState: 'idle',
    index: [],
    t: createTournament(),
    past: [],
    future: [],
    prefs: DEFAULT_PREFS,

    init: async () => {
      const prefs = await persistence.loadPrefs();
      sound.enabled = prefs.sound;
      sound.volume = prefs.volume;
      let index = await persistence.loadIndex();
      let t: Tournament | undefined;
      const id = prefs.activeId ?? index[0]?.id;
      if (id) t = await persistence.loadTournament(id);
      if (!t && index.length) {
        for (const m of index) {
          t = await persistence.loadTournament(m.id);
          if (t) break;
        }
      }
      if (!t) {
        t = createTournament();
        await persistence.saveTournament(t);
        index = [...index.filter((m) => m.id !== t!.id), metaOf(t)];
        await persistence.saveIndex(index);
      }
      const p = { ...prefs, activeId: t.id };
      await persistence.savePrefs(p);
      set({ ready: true, t, index, prefs: p, saveState: 'saved' });
    },

    commit: async (fn, opts = {}) => {
      const before = get().t;
      let after: Tournament;
      try {
        after = fn(before);
      } catch (e) {
        toast({ kind: 'error', title: 'No se pudo aplicar el cambio', message: (e as Error).message });
        return false;
      }
      if (after === before) return true;
      const { tournament, affected } = invalidatedBy(before, after);
      if (affected.length) {
        const ok = await confirmDialog({
          title: 'Este cambio afecta a partidos posteriores',
          message: `Al modificar este resultado cambian los clasificados. ${affected.length === 1 ? 'Se borrará 1 resultado' : `Se borrarán ${affected.length} resultados`} de rondas posteriores que ya no corresponden.`,
          details: affected.map((id) => {
            const slot = BRACKET_BY_ID[id];
            const r = before.results[id];
            const name = (x: string) => before.teamNames[x] || TEAM_BY_ID[x]?.name || x;
            return `${slot ? STAGE_SHORT[slot.stage] + (slot.stage === 'F' || slot.stage === '3P' ? '' : ' ' + slot.index) : id}: ${r ? `${name(r.homeId)} ${formatScoreline(r, true)} ${name(r.awayId)}` : ''}`;
          }),
          confirmLabel: 'Recalcular y borrar',
          danger: true,
        });
        if (!ok) return false;
      }
      apply(tournament, opts.label ?? 'Cambio');
      if (opts.celebrate && get().prefs.animations) {
        const c = detectCelebrations(deriveTournament(before), deriveTournament(tournament), opts);
        if (c.length) useUI.getState().pushCelebrations(c);
      }
      return true;
    },

    undo: () => {
      const { past, t, future } = get();
      const prev = past.at(-1);
      if (!prev) return;
      set({ t: prev.t, past: past.slice(0, -1), future: [{ t, label: prev.label }, ...future] });
      scheduleSave();
      toast({ kind: 'info', title: 'Deshecho', message: prev.label });
    },
    redo: () => {
      const { past, t, future } = get();
      const next = future[0];
      if (!next) return;
      set({ t: next.t, future: future.slice(1), past: [...past, { t, label: next.label }] });
      scheduleSave();
      toast({ kind: 'info', title: 'Rehecho', message: next.label });
    },

    setPrefs: (p) => {
      const prefs = { ...get().prefs, ...p };
      sound.enabled = prefs.sound;
      sound.volume = prefs.volume;
      set({ prefs });
      void persistence.savePrefs(prefs);
    },

    newTournament: async (name) => {
      await flushSave(get);
      const t = createTournament(name || `Mundial 2030 · ${get().index.length + 1}`);
      await persistence.saveTournament(t);
      const index = [...get().index, metaOf(t)];
      await persistence.saveIndex(index);
      const prefs = { ...get().prefs, activeId: t.id };
      await persistence.savePrefs(prefs);
      set({ t, index, prefs, past: [], future: [] });
      toast({ kind: 'success', title: 'Nuevo torneo creado', message: t.name });
    },

    switchTournament: async (id) => {
      if (id === get().t.id) return;
      await flushSave(get);
      const t = await persistence.loadTournament(id);
      if (!t) {
        toast({ kind: 'error', title: 'No se encontró el torneo' });
        return;
      }
      const prefs = { ...get().prefs, activeId: id };
      await persistence.savePrefs(prefs);
      set({ t, prefs, past: [], future: [] });
      toast({ kind: 'info', title: 'Torneo abierto', message: t.name });
    },

    duplicateTournament: async (id) => {
      await flushSave(get);
      const src = id === get().t.id ? get().t : await persistence.loadTournament(id);
      if (!src) return;
      const now = Date.now();
      const copy: Tournament = { ...structuredClone(src), id: uid('t_'), name: `${src.name} (copia)`, createdAt: now, updatedAt: now };
      await persistence.saveTournament(copy);
      const index = [...get().index, metaOf(copy)];
      await persistence.saveIndex(index);
      set({ index });
      toast({ kind: 'success', title: 'Simulación duplicada', message: copy.name });
    },

    renameTournament: async (id, name) => {
      const clean = name.trim().slice(0, 80);
      if (!clean) return;
      if (id === get().t.id) {
        apply({ ...get().t, name: clean }, 'Renombrar torneo');
        return;
      }
      const t = await persistence.loadTournament(id);
      if (!t) return;
      const next = { ...t, name: clean, updatedAt: Date.now() };
      await persistence.saveTournament(next);
      const index = get().index.map((m) => (m.id === id ? metaOf(next) : m));
      await persistence.saveIndex(index);
      set({ index });
    },

    deleteTournament: async (id) => {
      await persistence.deleteTournament(id);
      let index = get().index.filter((m) => m.id !== id);
      if (id === get().t.id) {
        let t = index[0] ? await persistence.loadTournament(index[0].id) : undefined;
        if (!t) {
          t = createTournament();
          await persistence.saveTournament(t);
          index = [...index, metaOf(t)];
        }
        const prefs = { ...get().prefs, activeId: t.id };
        await persistence.savePrefs(prefs);
        set({ t, prefs, past: [], future: [] });
      }
      await persistence.saveIndex(index);
      set({ index });
      toast({ kind: 'info', title: 'Torneo eliminado' });
    },

    importTournament: async (json) => {
      const parsed = parseTournament(json);
      await flushSave(get);
      await persistence.saveTournament(parsed);
      const index = [...get().index, metaOf(parsed)];
      await persistence.saveIndex(index);
      const prefs = { ...get().prefs, activeId: parsed.id };
      await persistence.savePrefs(prefs);
      set({ t: parsed, index, prefs, past: [], future: [] });
      toast({ kind: 'success', title: 'Torneo importado', message: parsed.name });
    },
  };
});

async function flushSave(get: () => State) {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
    const { t } = get();
    await persistence.saveTournament(t);
  }
}

function detectCelebrations(before: DerivedTournament, after: DerivedTournament, opts: CommitOptions): Celebration[] {
  const out: Celebration[] = [];
  const statusBefore = new Map(before.groups.flatMap((g) => g.table.rows.map((r) => [r.teamId, r.status] as const)));
  const newly = after.groups.flatMap((g) => g.table.rows.filter((r) => r.status === 'qualified' && statusBefore.get(r.teamId) !== 'qualified').map((r) => r.teamId));
  if (opts.celebrate === 'match' && opts.matchId) {
    const m = after.ko[opts.matchId];
    if (m?.winnerId && m.id !== 'F' && (before.ko[opts.matchId]?.winnerId !== m.winnerId || !before.ko[opts.matchId]?.result))
      out.push({ kind: 'match', matchId: m.id });
  }
  if (newly.length && opts.celebrate === 'match') out.push({ kind: 'qualified', teamIds: newly });
  if (before.progress.groupsComplete < 16 && after.progress.groupsComplete === 16) out.push({ kind: 'phase', stage: 'GROUPS_DONE' });
  for (const stage of ['R32', 'R16', 'QF', 'SF'] as KnockoutStage[]) {
    const done = (d: DerivedTournament) => stageMatches(d, stage).every((m) => m.winnerId);
    if (!done(before) && done(after)) out.push({ kind: 'phase', stage });
  }
  if (after.champion && after.champion !== before.champion) out.push({ kind: 'champion', teamId: after.champion });
  if (opts.celebrate === 'bulk') {
    // For simulations show only the most relevant moment.
    const champ = out.find((c) => c.kind === 'champion');
    if (champ) return [champ];
    const phases = out.filter((c) => c.kind === 'phase');
    return phases.length ? [phases[phases.length - 1]] : [];
  }
  return out;
}

/** Memoised derived tournament for the active tournament. */
export function useDerived(): DerivedTournament {
  const t = useStore((s) => s.t);
  return useMemo(() => deriveTournament(t), [t]);
}

export function useTeamName(): (id: string | undefined) => string {
  const names = useStore((s) => s.t.teamNames);
  return useMemo(() => (id) => (id ? names[id] || TEAM_BY_ID[id]?.name || id : '—'), [names]);
}

export const nextStageLabel: Partial<Record<KnockoutStage, string>> = {
  R32: STAGE_LABEL.R16,
  R16: STAGE_LABEL.QF,
  QF: STAGE_LABEL.SF,
  SF: STAGE_LABEL.F,
};

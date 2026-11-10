import { createStore, del, get, set, type UseStore } from 'idb-keyval';
import type { Tournament } from '../engine';

export interface TournamentMeta {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  phase: string;
  champion?: string;
}

export interface Prefs {
  activeId?: string;
  sound: boolean;
  volume: number;
  animations: boolean;
}

export const DEFAULT_PREFS: Prefs = { sound: true, volume: 0.7, animations: true };

let idb: UseStore | null = null;
let useLocal = false;

function db(): UseStore | null {
  if (useLocal) return null;
  try {
    if (!idb) idb = createStore('wc2030-road-to-glory', 'kv');
    return idb;
  } catch {
    useLocal = true;
    return null;
  }
}

async function read<T>(key: string): Promise<T | undefined> {
  const s = db();
  if (s) {
    try {
      return await get<T>(key, s);
    } catch {
      useLocal = true;
    }
  }
  try {
    const v = localStorage.getItem('wc2030:' + key);
    return v ? (JSON.parse(v) as T) : undefined;
  } catch {
    return undefined;
  }
}

async function write(key: string, value: unknown): Promise<void> {
  const s = db();
  if (s) {
    try {
      await set(key, value, s);
      return;
    } catch {
      useLocal = true;
    }
  }
  localStorage.setItem('wc2030:' + key, JSON.stringify(value));
}

async function remove(key: string) {
  const s = db();
  if (s) {
    try {
      await del(key, s);
      return;
    } catch {
      useLocal = true;
    }
  }
  localStorage.removeItem('wc2030:' + key);
}

export const persistence = {
  loadIndex: async () => (await read<TournamentMeta[]>('index')) ?? [],
  saveIndex: (list: TournamentMeta[]) => write('index', list),
  loadTournament: (id: string) => read<Tournament>('t:' + id),
  saveTournament: (t: Tournament) => write('t:' + t.id, t),
  deleteTournament: (id: string) => remove('t:' + id),
  loadPrefs: async () => ({ ...DEFAULT_PREFS, ...((await read<Prefs>('prefs')) ?? {}) }),
  savePrefs: (p: Prefs) => write('prefs', p),
  get backend() {
    return useLocal ? 'localStorage' : 'IndexedDB';
  },
};

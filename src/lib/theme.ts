import { useMemo } from 'react';
import { EDITIONS, TEAM_BY_ID, type EditionDef, type EditionId } from '../engine';
import { useStore } from '../store/tournament';

export interface EditionVisual {
  def: EditionDef;
  hosts: string[];
  stripe: string[];
  ring: [string, string, string];
  /** Uppercase hosts line for posters and video. */
  hostsLabel: string;
  title: string;
  year: number;
}

/** Visual identity of an edition, adapted to its hosts (2038 takes the colours of the hosts you choose). */
export function editionVisual(edition: EditionId, hosts: string[], names: Record<string, string> = {}): EditionVisual {
  const def = EDITIONS[edition] ?? EDITIONS['2030'];
  let stripe = def.colors.stripe;
  let ring = def.colors.ring;
  let hostsLabel = def.hostsLabel;
  if (def.hostsEditable && hosts.length) {
    const teams = hosts.map((h) => TEAM_BY_ID[h]).filter(Boolean);
    stripe = teams.flatMap((t) => [t.color, t.color2]);
    const cols = teams.flatMap((t) => [t.color, t.color2]);
    ring = [cols[0] ?? ring[0], cols[1] ?? ring[1], cols[2] ?? cols[0] ?? ring[2]];
    hostsLabel = teams.map((t) => (names[t.id] || t.name).toUpperCase()).join(' · ');
  }
  return { def, hosts, stripe, ring, hostsLabel, title: def.title, year: def.year };
}

let current: EditionVisual = editionVisual('2030', ['ESP', 'POR', 'MAR']);

/** Current edition identity, for canvas renderers (posters, video). */
export const currentEdition = () => current;

const stripeGradient = (cols: string[]) => {
  const step = 100 / cols.length;
  return `linear-gradient(90deg, ${cols.map((c, i) => `${c} ${(i * step).toFixed(1)}% ${((i + 1) * step).toFixed(1)}%`).join(', ')})`;
};

/** Applies an edition's palette to the whole interface through CSS variables. */
export function applyEdition(v: EditionVisual) {
  current = v;
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const c = v.def.colors;
  const set = (k: string, val: string) => root.style.setProperty(k, val);
  set('--color-crimson', c.primary[0]);
  set('--color-crimson-light', c.primary[1]);
  set('--color-crimson-dark', c.primary[2]);
  set('--color-emerald', c.secondary[0]);
  set('--color-emerald-light', c.secondary[1]);
  set('--color-emerald-dark', c.secondary[2]);
  set('--color-gold', c.accent[0]);
  set('--color-gold-light', c.accent[1]);
  set('--color-gold-dark', c.accent[2]);
  ['950', '900', '850', '800', '700', '600'].forEach((k, i) => set(`--color-night-${k}`, c.night[i]));
  set('--stripe', stripeGradient(v.stripe));
  set('--hero-grad', `linear-gradient(100deg, ${c.heroGradient.join(', ')})`);
  set('--gold-grad', `linear-gradient(180deg, #ffffff 0%, ${c.accent[1]} 30%, ${c.accent[0]} 62%, ${c.accent[2]} 82%, ${c.accent[1]} 100%)`);
  root.dataset.edition = v.def.id;
  root.dataset.motif = c.motif;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', c.night[0]);
}

export function useEdition(): EditionVisual {
  const edition = useStore((s) => s.t.edition);
  const hosts = useStore((s) => s.t.hosts);
  const names = useStore((s) => s.t.teamNames);
  return useMemo(() => editionVisual(edition, hosts, names), [edition, hosts, names]);
}

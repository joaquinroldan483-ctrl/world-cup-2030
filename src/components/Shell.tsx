import { AnimatePresence, motion } from 'motion/react';
import { useEffect, type ReactNode } from 'react';
import { navigate, type SectionId } from '../lib/router';
import { useStore } from '../store/tournament';
import { useUI } from '../store/ui';
import { Emblem, StadiumBackdrop } from './brand';
import { Icon, type IconName } from './Icon';
import { cx, IconButton } from './ui';

export const NAV: { id: SectionId; label: string; sub: string; icon: IconName }[] = [
  { id: 'home', label: 'Home', sub: 'Inicio', icon: 'home' },
  { id: 'draw', label: 'Draw Ceremony', sub: 'Sorteo', icon: 'draw' },
  { id: 'groups', label: 'Group Stage', sub: 'Grupos', icon: 'groups' },
  { id: 'knockout', label: 'Knockout', sub: 'Eliminatorias', icon: 'bracket' },
  { id: 'road', label: 'The Road to Glory', sub: 'Recorridos', icon: 'road' },
  { id: 'stats', label: 'Statistics', sub: 'Estadísticas', icon: 'stats' },
  { id: 'recap', label: 'Cinematic Recap', sub: 'Vídeo épico', icon: 'film' },
  { id: 'poster', label: 'Legendary Poster', sub: 'Póster', icon: 'poster' },
  { id: 'settings', label: 'Settings', sub: 'Ajustes', icon: 'settings' },
];

const MOBILE_TABS: SectionId[] = ['home', 'draw', 'groups', 'knockout'];

function SaveIndicator() {
  const s = useStore((x) => x.saveState);
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-white/45">
      <span className={cx('h-1.5 w-1.5 rounded-full', s === 'saving' ? 'animate-pulse bg-gold' : s === 'error' ? 'bg-crimson' : 'bg-emerald')} />
      {s === 'saving' ? 'Guardando…' : s === 'error' ? 'Error al guardar' : 'Guardado automático'}
    </span>
  );
}

function UndoRedo() {
  const past = useStore((s) => s.past.length);
  const future = useStore((s) => s.future.length);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  return (
    <div className="flex gap-1.5">
      <IconButton icon="undo" label="Deshacer (Ctrl+Z)" disabled={!past} onClick={undo} />
      <IconButton icon="redo" label="Rehacer (Ctrl+Shift+Z)" disabled={!future} onClick={redo} />
    </div>
  );
}

export function Shell({ section, children }: { section: SectionId; children: ReactNode }) {
  const tName = useStore((s) => s.t.name);
  const moreOpen = useUI((s) => s.moreOpen);
  const setMoreOpen = useUI((s) => s.setMoreOpen);
  const animations = useStore((s) => s.prefs.animations);

  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', !animations);
  }, [animations]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) useStore.getState().redo();
        else useStore.getState().undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        useStore.getState().redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const current = NAV.find((n) => n.id === section)!;

  return (
    <div className="min-h-dvh">
      <StadiumBackdrop />
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col border-r border-white/6 bg-night-950/70 backdrop-blur-xl lg:flex">
        <div className="h-1 host-stripe" />
        <button className="flex items-center gap-3 px-5 pb-5 pt-6 text-left" onClick={() => navigate('home')}>
          <Emblem size={46} />
          <div className="leading-none">
            <div className="font-cond text-[11px] font-bold uppercase tracking-[0.32em] text-white/55">World Cup</div>
            <div className="font-display text-[30px] tracking-wide text-gold-gradient">2030</div>
          </div>
        </button>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
          {NAV.map((n) => {
            const active = n.id === section;
            return (
              <button
                key={n.id}
                onClick={() => navigate(n.id)}
                className={cx(
                  'group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition',
                  active ? 'text-white' : 'text-white/55 hover:bg-white/5 hover:text-white',
                )}
              >
                {active && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-xl border border-gold/25 bg-gradient-to-r from-gold/18 to-transparent" transition={{ type: 'spring', damping: 30, stiffness: 350 }} />}
                {active && <motion.span layoutId="nav-bar" className="absolute left-0 top-2 bottom-2 w-1 rounded-full bg-gold" />}
                <Icon name={n.icon} className={cx('relative', active ? 'text-gold-light' : '')} />
                <span className="relative leading-tight">
                  <span className="block font-cond text-[15px] font-bold uppercase tracking-[0.08em]">{n.label}</span>
                  <span className="block text-[11px] text-white/40">{n.sub}</span>
                </span>
              </button>
            );
          })}
        </nav>
        <div className="space-y-3 border-t border-white/6 p-4">
          <div>
            <div className="label">Torneo activo</div>
            <button className="mt-1 block max-w-full truncate text-left text-sm font-semibold text-white hover:text-gold-light" onClick={() => navigate('settings')}>
              {tName}
            </button>
            <SaveIndicator />
          </div>
          <UndoRedo />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-white/6 bg-night-950/75 px-4 py-2.5 backdrop-blur-xl lg:hidden">
        <button onClick={() => navigate('home')} aria-label="Inicio">
          <Emblem size={34} />
        </button>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate font-cond text-[15px] font-bold uppercase tracking-[0.1em]">{current.label}</div>
          <div className="truncate text-[11px] text-white/45">{tName}</div>
        </div>
        <UndoRedo />
      </header>

      <main className="relative lg:pl-[264px]">
        <div className="mx-auto w-full max-w-[1440px] px-4 pb-32 pt-5 sm:px-6 lg:px-10 lg:pb-16 lg:pt-10">{children}</div>
      </main>

      {/* Mobile tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/8 bg-night-950/85 pb-[var(--safe-bottom)] backdrop-blur-xl lg:hidden">
        <div className="grid grid-cols-5">
          {MOBILE_TABS.map((id) => {
            const n = NAV.find((x) => x.id === id)!;
            const active = section === id;
            return (
              <button key={id} onClick={() => navigate(id)} className={cx('relative flex flex-col items-center gap-1 py-2.5', active ? 'text-gold-light' : 'text-white/55')}>
                {active && <motion.span layoutId="tab-active" className="absolute top-0 h-0.5 w-10 rounded-full bg-gold" />}
                <Icon name={n.icon} size={22} />
                <span className="font-cond text-[11px] font-bold uppercase tracking-wider">{n.sub}</span>
              </button>
            );
          })}
          <button onClick={() => setMoreOpen(true)} className={cx('flex flex-col items-center gap-1 py-2.5', !MOBILE_TABS.includes(section) ? 'text-gold-light' : 'text-white/55')}>
            <Icon name="menu" size={22} />
            <span className="font-cond text-[11px] font-bold uppercase tracking-wider">Más</span>
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {moreOpen && (
          <motion.div className="fixed inset-0 z-[60] lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-night-950/70 backdrop-blur-sm" onClick={() => setMoreOpen(false)} />
            <motion.div className="glass-strong absolute inset-x-0 bottom-0 rounded-t-3xl p-4 pb-[calc(1.25rem+var(--safe-bottom))]" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }}>
              <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/20" />
              <div className="grid grid-cols-2 gap-2">
                {NAV.filter((n) => !MOBILE_TABS.includes(n.id)).map((n) => (
                  <button
                    key={n.id}
                    onClick={() => {
                      setMoreOpen(false);
                      navigate(n.id);
                    }}
                    className={cx('flex items-center gap-3 rounded-2xl border p-3.5 text-left', section === n.id ? 'border-gold/40 bg-gold/12' : 'border-white/8 bg-white/4')}
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/6 text-gold-light">
                      <Icon name={n.icon} />
                    </span>
                    <span className="leading-tight">
                      <span className="block font-cond text-sm font-bold uppercase tracking-wide">{n.label}</span>
                      <span className="text-[11px] text-white/45">{n.sub}</span>
                    </span>
                  </button>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between px-1">
                <SaveIndicator />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

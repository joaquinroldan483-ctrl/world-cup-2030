import { AnimatePresence, motion } from 'motion/react';
import { useEffect } from 'react';
import { STAGE_LABEL, TEAM_BY_ID, formatScoreline, type KnockoutStage } from '../engine';
import { celebrationBurst, fireConfetti } from '../lib/confetti';
import { navigate } from '../lib/router';
import { sound } from '../lib/sound';
import { nextStageLabel, useDerived, useTeamName } from '../store/tournament';
import { useUI } from '../store/ui';
import { Flag, Trophy } from './brand';
import { Icon } from './Icon';
import { Button, Modal } from './ui';

export function ConfirmHost() {
  const req = useUI((s) => s.confirmReq);
  return (
    <Modal
      open={!!req}
      onClose={() => req?.resolve(false)}
      title={req?.title ?? ''}
      footer={
        req && (
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => req.resolve(false)}>
              {req.cancelLabel ?? 'Cancelar'}
            </Button>
            <Button variant={req.danger ? 'primary' : 'gold'} onClick={() => req.resolve(true)}>
              {req.confirmLabel ?? 'Confirmar'}
            </Button>
          </div>
        )
      }
    >
      {req && (
        <div className="space-y-4">
          <p className="text-[15px] leading-relaxed text-white/80">{req.message}</p>
          {req.details && req.details.length > 0 && (
            <ul className="max-h-56 space-y-1.5 overflow-y-auto rounded-xl border border-white/8 bg-night-950/50 p-3 text-sm text-white/70">
              {req.details.map((d, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-crimson-light">•</span>
                  {d}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}

export function ToastHost() {
  const toasts = useUI((s) => s.toasts);
  const dismiss = useUI((s) => s.dismissToast);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[95] flex flex-col items-center gap-2 px-3 sm:items-end sm:pr-6">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.button
            key={t.id}
            layout
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.96 }}
            onClick={() => dismiss(t.id)}
            className="glass-strong pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl px-4 py-3 text-left"
          >
            <span className={t.kind === 'error' ? 'text-crimson-light' : t.kind === 'success' ? 'text-emerald-light' : 'text-gold-light'}>
              <Icon name={t.kind === 'error' ? 'alert' : t.kind === 'success' ? 'check' : 'info'} />
            </span>
            <span className="min-w-0">
              <span className="block font-cond text-[15px] font-bold uppercase tracking-wide">{t.title}</span>
              {t.message && <span className="block text-[13px] text-white/60">{t.message}</span>}
            </span>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}

const STRIPES = ['#c60b1e', '#ffc400', '#e8b84a', '#006600', '#c1272d', '#006233'];

export function CelebrationHost() {
  const queue = useUI((s) => s.celebrations);
  const shift = useUI((s) => s.shiftCelebration);
  const current = queue[0];
  const d = useDerived();
  const name = useTeamName();

  useEffect(() => {
    if (!current) return;
    let ms = 4200;
    if (current.kind === 'match') {
      const m = d.ko[current.matchId];
      const w = m?.winnerId ? TEAM_BY_ID[m.winnerId] : undefined;
      sound.goal();
      fireConfetti({ colors: w ? [w.color, w.color2, '#e8b84a', '#ffffff'] : undefined, count: 200 });
    } else if (current.kind === 'qualified') {
      ms = 3400;
      sound.qualified();
      fireConfetti({ count: 90, origin: { x: 0.5, y: 0.2 } });
    } else if (current.kind === 'phase') {
      ms = 2900;
      sound.phase();
    } else if (current.kind === 'champion') {
      ms = 0;
      sound.champion();
      const t = TEAM_BY_ID[current.teamId];
      celebrationBurst(t ? [t.color, t.color2, '#e8b84a', '#fff3c4', '#ffffff'] : undefined);
      const iv = setInterval(() => celebrationBurst(['#e8b84a', '#fff3c4', '#ffffff', t?.color ?? '#e11d2e']), 2600);
      const stop = setTimeout(() => clearInterval(iv), 9000);
      return () => {
        clearInterval(iv);
        clearTimeout(stop);
      };
    }
    const timer = ms ? setTimeout(shift, ms) : undefined;
    return () => timer && clearTimeout(timer);
  }, [current, shift]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AnimatePresence mode="wait">
      {current?.kind === 'match' && <MatchCelebration key={`m${current.matchId}${queue.length}`} matchId={current.matchId} onClose={shift} />}
      {current?.kind === 'qualified' && (
        <motion.div key={`q${current.teamIds.join()}`} className="fixed inset-x-0 top-16 z-[90] flex justify-center px-4" initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -30, opacity: 0 }} onClick={shift}>
          <div className="glass-strong flex max-w-xl items-center gap-4 rounded-2xl border-emerald/40 px-5 py-4">
            <div className="flex -space-x-2">
              {current.teamIds.slice(0, 4).map((id) => (
                <Flag key={id} id={id} shape="circle" className="w-11 ring-2 ring-emerald" />
              ))}
            </div>
            <div>
              <div className="label !text-emerald-light">¡Clasificación asegurada!</div>
              <div className="font-display text-xl uppercase tracking-wide">
                {current.teamIds.map((id) => name(id)).join(' · ')}
              </div>
              <div className="text-xs text-white/60">Ya tiene{current.teamIds.length > 1 ? 'n' : ''} su lugar en dieciseisavos de final</div>
            </div>
          </div>
        </motion.div>
      )}
      {current?.kind === 'phase' && (
        <motion.div key={`p${current.stage}`} className="fixed inset-0 z-[90] flex items-center justify-center overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={shift}>
          <div className="absolute inset-0 bg-night-950/80 backdrop-blur-sm" />
          {STRIPES.map((c, i) => (
            <motion.div
              key={i}
              className="absolute h-[16vh] w-[160vw] -rotate-12"
              style={{ background: c, top: `${8 + i * 14}%`, opacity: 0.85 }}
              initial={{ x: i % 2 ? '100%' : '-100%' }}
              animate={{ x: ['-0%', '0%'], opacity: [0.9, 0] }}
              transition={{ duration: 1.1, delay: i * 0.05, ease: [0.7, 0, 0.2, 1] }}
            />
          ))}
          <motion.div className="relative text-center" initial={{ scale: 1.4, opacity: 0, letterSpacing: '0.5em' }} animate={{ scale: 1, opacity: 1, letterSpacing: '0.04em' }} transition={{ delay: 0.5, duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}>
            <div className="label mb-3 !text-gold-light">{current.stage === 'GROUPS_DONE' ? 'Fase de grupos completada' : `${STAGE_LABEL[current.stage as KnockoutStage]} completados`}</div>
            <div className="font-display text-5xl uppercase text-gold-gradient sm:text-8xl">
              {current.stage === 'GROUPS_DONE' ? 'Dieciseisavos' : nextStageLabel[current.stage as KnockoutStage] ?? 'Gran final'}
            </div>
            <div className="mt-3 font-cond text-lg font-bold uppercase tracking-[0.3em] text-white/70">Los cruces están definidos</div>
          </motion.div>
        </motion.div>
      )}
      {current?.kind === 'champion' && <ChampionCelebration key={`c${current.teamId}`} teamId={current.teamId} onClose={shift} />}
    </AnimatePresence>
  );
}

function MatchCelebration({ matchId, onClose }: { matchId: string; onClose: () => void }) {
  const d = useDerived();
  const name = useTeamName();
  const m = d.ko[matchId];
  if (!m?.result || !m.winnerId) return null;
  const next = nextStageLabel[m.stage];
  return (
    <motion.div className="fixed inset-0 z-[90] flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <div className="absolute inset-0 bg-night-950/80 backdrop-blur-md" />
      <motion.div className="relative w-full max-w-2xl text-center" initial={{ scale: 0.8, y: 30 }} animate={{ scale: 1, y: 0 }} transition={{ type: 'spring', damping: 16, stiffness: 180 }}>
        <motion.div className="font-display text-7xl uppercase text-gold-gradient sm:text-9xl" initial={{ scale: 2.4, opacity: 0, rotate: -6 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ duration: 0.55, ease: [0.2, 0.9, 0.2, 1] }}>
          ¡Victoria!
        </motion.div>
        <div className="label mt-2">{STAGE_LABEL[m.stage]}</div>
        <div className="glass-strong mt-5 flex items-center justify-between gap-3 rounded-3xl px-4 py-5 sm:px-8">
          {[m.homeId!, m.awayId!].map((id, i) => (
            <div key={id} className={`flex flex-1 flex-col items-center gap-2 ${id === m.winnerId ? '' : 'opacity-45'} ${i === 1 ? 'order-3' : ''}`}>
              <Flag id={id} className="w-20 sm:w-28" />
              <div className="font-cond text-lg font-bold uppercase tracking-wide sm:text-2xl">{name(id)}</div>
            </div>
          ))}
          <div className="order-2 font-display text-4xl tabular sm:text-6xl">{formatScoreline(m.result, true).split(' ')[0]}</div>
        </div>
        <div className="mt-2 text-sm text-white/60">{formatScoreline(m.result, true)}</div>
        <motion.div className="mt-6 inline-flex items-center gap-3 rounded-full border border-gold/40 bg-gold/10 px-5 py-2.5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Flag id={m.winnerId} shape="circle" className="w-7" />
          <span className="font-cond text-base font-bold uppercase tracking-[0.14em] text-gold-light">
            {name(m.winnerId)} {m.stage === '3P' ? 'logra el tercer puesto' : `avanza a ${next ?? 'la final'}`}
          </span>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

function ChampionCelebration({ teamId, onClose }: { teamId: string; onClose: () => void }) {
  const name = useTeamName();
  const t = TEAM_BY_ID[teamId];
  return (
    <motion.div className="fixed inset-0 z-[90] flex items-center justify-center overflow-hidden p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-night-950/90 backdrop-blur-md" />
      <div className="absolute inset-0" style={{ background: `radial-gradient(60% 50% at 50% 40%, ${t.color}55, transparent 70%)` }} />
      {Array.from({ length: 10 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute top-[-10%] h-[120%] w-24 origin-top bg-gradient-to-b from-gold-light/30 to-transparent blur-xl"
          style={{ left: `${5 + i * 10}%` }}
          animate={{ rotate: [i % 2 ? -18 : 18, i % 2 ? 12 : -12, i % 2 ? -18 : 18] }}
          transition={{ duration: 5 + i * 0.3, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
      <motion.div className="relative flex max-w-3xl flex-col items-center text-center" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 14, stiffness: 110, delay: 0.15 }}>
        <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3, duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}>
          <Trophy className="h-52 w-32 animate-float sm:h-72 sm:w-44" />
        </motion.div>
        <div className="label mt-4 !text-gold-light !tracking-[0.4em]">World Cup 2030 · Campeón del mundo</div>
        <motion.div className="mt-3 flex items-center gap-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>
          <Flag id={teamId} className="w-16 sm:w-24" />
          <h2 className="font-display text-5xl uppercase leading-none text-gold-gradient sm:text-8xl">{name(teamId)}</h2>
        </motion.div>
        <motion.div className="mt-8 flex flex-wrap justify-center gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }}>
          <Button variant="gold" icon="road" onClick={() => { onClose(); navigate('road', teamId); }}>
            Camino del campeón
          </Button>
          <Button variant="outline" icon="poster" onClick={() => { onClose(); navigate('poster'); }}>
            Crear póster
          </Button>
          <Button variant="outline" icon="film" onClick={() => { onClose(); navigate('recap'); }}>
            Vídeo épico
          </Button>
          <Button variant="ghost" icon="x" onClick={onClose}>
            Cerrar
          </Button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

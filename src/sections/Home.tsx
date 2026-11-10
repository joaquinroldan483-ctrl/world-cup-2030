import { motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { HOST_IDS, STAGE_SHORT, currentPhase, type KnockoutStage } from '../engine';
import { Emblem, Flag, Trophy } from '../components/brand';
import { Icon, type IconName } from '../components/Icon';
import { Button, Card, Chip, cx, ProgressBar } from '../components/ui';
import { navigate, type SectionId } from '../lib/router';
import { useDerived, useStore, useTeamName } from '../store/tournament';

function useCountdown(target: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);
  const diff = Math.max(0, new Date(target).getTime() - now);
  return {
    done: diff === 0,
    days: Math.floor(diff / 86400000),
    hours: Math.floor(diff / 3600000) % 24,
    minutes: Math.floor(diff / 60000) % 60,
    seconds: Math.floor(diff / 1000) % 60,
  };
}

const PHASES: { key: string; label: string }[] = [
  { key: 'draw', label: 'Sorteo' },
  { key: 'groups', label: 'Grupos' },
  { key: 'R32', label: STAGE_SHORT.R32 },
  { key: 'R16', label: STAGE_SHORT.R16 },
  { key: 'QF', label: STAGE_SHORT.QF },
  { key: 'SF', label: STAGE_SHORT.SF },
  { key: 'F', label: 'Final' },
  { key: 'finished', label: 'Campeón' },
];

const HOST_LABEL: Record<string, string> = { ESP: 'España', POR: 'Portugal', MAR: 'Marruecos · المغرب' };

export default function Home() {
  const t = useStore((s) => s.t);
  const commit = useStore((s) => s.commit);
  const d = useDerived();
  const name = useTeamName();
  const cd = useCountdown(t.kickoff);
  const phase = currentPhase(d);
  const phaseIdx = PHASES.findIndex((p) => p.key === phase);
  const [editing, setEditing] = useState(false);

  const next = useMemo((): { label: string; section: SectionId; icon: IconName } => {
    if (phase === 'draw') return { label: 'Comenzar el sorteo', section: 'draw', icon: 'draw' };
    if (phase === 'groups') return { label: 'Cargar resultados de grupos', section: 'groups', icon: 'groups' };
    if (phase === 'finished') return { label: 'Ver el camino del campeón', section: 'road', icon: 'road' };
    return { label: `Jugar ${STAGE_SHORT[phase as KnockoutStage]}`, section: 'knockout', icon: 'bracket' };
  }, [phase]);

  const total = d.progress.groupTotal + d.progress.koTotal;
  const done = d.progress.groupPlayed + d.progress.koPlayed;

  return (
    <div className="space-y-8">
      {/* HERO */}
      <section className="relative -mx-4 -mt-5 overflow-hidden sm:mx-0 sm:mt-0 sm:rounded-[2rem]">
        <div className="absolute inset-0 bg-[radial-gradient(90%_70%_at_70%_30%,rgba(232,184,74,0.18),transparent_60%),linear-gradient(160deg,#101d40_0%,#070d1c_55%,#04070f_100%)]" />
        <div className="absolute inset-0 pitch-lines opacity-50 [mask-image:radial-gradient(70%_80%_at_50%_100%,black,transparent)]" />
        <motion.div className="absolute -left-20 top-0 h-[140%] w-40 -rotate-[20deg] bg-crimson/25 blur-3xl" animate={{ x: [0, 40, 0] }} transition={{ duration: 9, repeat: Infinity }} />
        <motion.div className="absolute -right-10 top-0 h-[140%] w-40 rotate-[20deg] bg-emerald/25 blur-3xl" animate={{ x: [0, -40, 0] }} transition={{ duration: 11, repeat: Infinity }} />
        <div className="absolute inset-x-0 top-0 h-1 host-stripe" />
        <div className="relative grid gap-8 px-5 pb-10 pt-12 sm:px-10 md:grid-cols-[1.3fr_1fr] md:items-center md:py-16 lg:px-14">
          <div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex items-center gap-3">
              <Emblem size={40} />
              <span className="font-cond text-xs font-bold uppercase tracking-[0.3em] text-white/70 sm:text-sm sm:tracking-[0.42em]">Fan edition · 64 selecciones</span>
            </motion.div>
            <motion.h1 initial={{ opacity: 0, y: 30, letterSpacing: '0.3em' }} animate={{ opacity: 1, y: 0, letterSpacing: '0.02em' }} transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }} className="mt-5 font-display uppercase leading-[0.85]">
              <span className="block text-[2.4rem] text-white sm:text-6xl lg:text-7xl">World Cup</span>
              <span className="block text-[6.5rem] text-hosts-gradient drop-shadow-[0_10px_40px_rgba(232,184,74,0.25)] sm:text-[10rem] lg:text-[12rem]">2030</span>
            </motion.h1>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-1 font-cond text-xl font-bold uppercase tracking-[0.5em] text-gold-light sm:text-2xl">
              The Road to Glory
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="mt-6 flex flex-wrap gap-2">
              {HOST_IDS.map((id) => (
                <span key={id} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/6 py-1 pl-1 pr-3.5">
                  <Flag id={id} shape="circle" className="w-7" />
                  <span className="font-cond text-sm font-bold uppercase tracking-wider">{HOST_LABEL[id]}</span>
                </span>
              ))}
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.85 }} className="mt-8 flex flex-wrap gap-3">
              <Button variant="gold" size="lg" icon={next.icon} onClick={() => navigate(next.section)}>
                {next.label}
              </Button>
              <Button variant="outline" size="lg" icon="bracket" onClick={() => navigate('knockout')}>
                Ver el cuadro
              </Button>
            </motion.div>
          </div>
          <motion.div initial={{ opacity: 0, scale: 0.9, y: 40 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ delay: 0.3, duration: 1, ease: [0.2, 0.8, 0.2, 1] }} className="relative mx-auto hidden h-[420px] w-[260px] md:block">
            <Trophy className="h-full w-full animate-float" />
          </motion.div>
        </div>
      </section>

      {d.champion && (
        <motion.button initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} onClick={() => navigate('road', d.champion)} className="glass relative flex w-full items-center gap-5 overflow-hidden rounded-2xl border-gold/40 p-5 text-left">
          <div className="absolute inset-0 shine" />
          <Trophy className="h-20 w-12 shrink-0" glow={false} />
          <Flag id={d.champion} className="w-16" />
          <div className="min-w-0">
            <div className="label !text-gold-light">Campeón del mundo 2030</div>
            <div className="truncate font-display text-3xl uppercase sm:text-4xl">{name(d.champion)}</div>
            <div className="text-sm text-white/60">Subcampeón: {name(d.runnerUp)} · Tercero: {name(d.third)}</div>
          </div>
          <Icon name="chevronRight" className="ml-auto shrink-0 text-gold-light" />
        </motion.button>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        {/* COUNTDOWN */}
        <Card className="relative overflow-hidden p-5 sm:p-6">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-crimson/20 blur-3xl" />
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <div className="label">Cuenta regresiva · partido inaugural</div>
              <div className="mt-1 text-sm text-white/60">
                {new Date(t.kickoff).toLocaleString('es', { dateStyle: 'full', timeStyle: 'short' })}
              </div>
            </div>
            <Button size="sm" variant="ghost" icon="edit" onClick={() => setEditing((v) => !v)}>
              Configurar
            </Button>
          </div>
          {editing && (
            <div className="relative mt-4 flex flex-wrap items-end gap-2">
              <label className="block">
                <span className="label mb-1 block">Fecha y hora de inicio</span>
                <input
                  type="datetime-local"
                  value={t.kickoff.slice(0, 16)}
                  onChange={(e) => e.target.value && void commit((x) => ({ ...x, kickoff: e.target.value }), { label: 'Cambiar fecha de inicio' })}
                  className="h-11 rounded-xl border border-white/10 bg-night-950/60 px-3 text-sm text-white outline-none [color-scheme:dark] focus:border-gold/60"
                />
              </label>
              <span className="pb-3 text-xs text-white/40">Fecha configurable (no oficial).</span>
            </div>
          )}
          {cd.done ? (
            <div className="relative mt-6 font-display text-4xl uppercase text-gold-gradient">¡El torneo ha comenzado!</div>
          ) : (
            <div className="relative mt-5 grid grid-cols-4 gap-2 sm:gap-3">
              {[
                ['Días', cd.days],
                ['Horas', cd.hours],
                ['Min', cd.minutes],
                ['Seg', cd.seconds],
              ].map(([l, v]) => (
                <div key={l as string} className="rounded-2xl border border-white/8 bg-night-950/50 px-2 py-3 text-center sm:py-4">
                  <div className="font-display text-4xl tabular text-white sm:text-5xl">{String(v).padStart(2, '0')}</div>
                  <div className="label mt-1">{l}</div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* PROGRESS */}
        <Card className="p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="label">Progreso del torneo</div>
            <Chip tone="gold">{done}/{total} partidos</Chip>
          </div>
          <ProgressBar value={done / total} className="mt-4" />
          <div className="no-scrollbar mt-5 flex gap-1 overflow-x-auto pb-1">
            {PHASES.map((p, i) => (
              <div key={p.key} className="flex shrink-0 items-center gap-1">
                <div className={cx('rounded-lg px-2.5 py-1.5 font-cond text-xs font-bold uppercase tracking-wider', i < phaseIdx ? 'bg-emerald/15 text-emerald-light' : i === phaseIdx ? 'bg-gold text-night-950 animate-pulse-ring' : 'bg-white/5 text-white/40')}>
                  {p.label}
                </div>
                {i < PHASES.length - 1 && <Icon name="chevronRight" size={14} className="text-white/25" />}
              </div>
            ))}
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            <Stat label="Grupos completos" value={`${d.progress.groupsComplete}/16`} />
            <Stat label="Partidos de grupo" value={`${d.progress.groupPlayed}/96`} />
            <Stat label="Eliminatorias" value={`${d.progress.koPlayed}/32`} />
          </div>
        </Card>
      </div>

      {/* SECTIONS */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {(
          [
            ['draw', 'Draw Ceremony', 'Sorteo animado con bombos, restricciones y modo manual.', 'draw', 'crimson'],
            ['groups', 'Group Stage', '16 grupos, 96 partidos, tablas y desempates en vivo.', 'groups', 'emerald'],
            ['knockout', 'Knockout', 'Cuadro interactivo: prórroga, penales y momentum.', 'bracket', 'gold'],
            ['road', 'Road to Glory', 'El recorrido completo de cualquier selección.', 'road', 'gold'],
            ['stats', 'Statistics', 'Goleadores, récords, gráficos y confederaciones.', 'stats', 'emerald'],
            ['recap', 'Cinematic Recap', 'Vídeo MP4 real del Mundial con música original.', 'film', 'crimson'],
            ['poster', 'Legendary Poster', 'Pósters en alta resolución listos para compartir.', 'poster', 'gold'],
            ['settings', 'Settings', 'Torneos guardados, desempates, ranking y datos.', 'settings', 'emerald'],
          ] as [SectionId, string, string, IconName, string][]
        ).map(([id, title, desc, icon, tone], i) => (
          <motion.button
            key={id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
            whileHover={{ y: -4 }}
            onClick={() => navigate(id)}
            className="glass group relative overflow-hidden rounded-2xl p-5 text-left"
          >
            <div className={cx('absolute -right-8 -top-8 h-28 w-28 rounded-full blur-2xl transition-opacity group-hover:opacity-100 opacity-50', tone === 'crimson' ? 'bg-crimson/30' : tone === 'emerald' ? 'bg-emerald/30' : 'bg-gold/30')} />
            <Icon name={icon} size={26} className={tone === 'crimson' ? 'text-crimson-light' : tone === 'emerald' ? 'text-emerald-light' : 'text-gold-light'} />
            <div className="mt-4 font-display text-2xl uppercase tracking-wide">{title}</div>
            <div className="mt-1 text-sm text-white/55">{desc}</div>
          </motion.button>
        ))}
      </div>

      <p className="mx-auto max-w-3xl text-center text-xs leading-relaxed text-white/35">
        Proyecto de aficionados sin afiliación oficial. El formato de 64 selecciones y la lista de participantes son una configuración personalizada del usuario y no información oficial del Mundial 2030.
        Banderas: flag-icons (MIT). Música y efectos de sonido generados de forma procedural y original.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/6 bg-night-950/40 px-2 py-3">
      <div className="font-display text-2xl tabular">{value}</div>
      <div className="text-[11px] leading-tight text-white/45">{label}</div>
    </div>
  );
}

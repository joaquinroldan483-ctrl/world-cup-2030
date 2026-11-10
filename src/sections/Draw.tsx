import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ALL_TEAM_IDS,
  CONFEDERATIONS,
  GROUP_LETTERS,
  TEAMS,
  TEAM_BY_ID,
  buildPots,
  checkConfedFeasibility,
  completeManualDraw,
  performDraw,
  validateGroups,
  type DrawConfig,
  type DrawMode,
  type DrawResult,
  type DrawStep,
} from '../engine';
import { Flag } from '../components/brand';
import { Icon, type IconName } from '../components/Icon';
import { Button, Card, Chip, cx, IconButton, SectionHeader, Segmented, Stepper, Toggle } from '../components/ui';
import { fireConfetti } from '../lib/confetti';
import { navigate } from '../lib/router';
import { sound } from '../lib/sound';
import { useStore, useTeamName } from '../store/tournament';
import { confirmDialog, toast } from '../store/ui';

const MODES: { id: DrawMode; title: string; desc: string; icon: IconName }[] = [
  { id: 'free', title: 'Sorteo libre', desc: 'Totalmente aleatorio: las 64 bolillas en un solo bombo.', icon: 'shuffle' },
  { id: 'confederation', title: 'Por confederación', desc: 'Aleatorio con límites configurables de selecciones por confederación en cada grupo.', icon: 'flag' },
  { id: 'pots', title: 'Bombos por ranking', desc: '4 bombos de 16 según tu ranking personalizado: una selección de cada bombo por grupo.', icon: 'star' },
  { id: 'manual', title: 'Sorteo manual', desc: 'Colocá cada selección en el grupo que quieras, con validación de reglas.', icon: 'edit' },
];

type Phase = 'overview' | 'setup' | 'ceremony' | 'manual';

export default function Draw() {
  const t = useStore((s) => s.t);
  const [phase, setPhase] = useState<Phase>(t.groups ? 'overview' : 'setup');
  const [pending, setPending] = useState<DrawResult | null>(null);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [phase, pending]);

  const start = (cfg: DrawConfig) => {
    if (cfg.mode === 'manual') {
      setPhase('manual');
      return;
    }
    try {
      const r = performDraw(cfg, { ranking: t.ranking, teamIds: ALL_TEAM_IDS });
      setPending(r);
      setPhase('ceremony');
      sound.whistle();
    } catch (e) {
      toast({ kind: 'error', title: 'No se pudo sortear', message: (e as Error).message });
    }
  };

  return (
    <div>
      <SectionHeader
        eyebrow="Draw Ceremony · Sorteo de grupos"
        title="Draw Ceremony"
        accent="crimson"
        subtitle="64 selecciones, 16 grupos de 4. Elegí el tipo de sorteo, configurá las reglas y viví la ceremonia bolilla por bolilla."
        actions={
          phase !== 'setup' && (
            <Button variant="outline" icon="shuffle" onClick={() => setPhase('setup')}>
              Nuevo sorteo
            </Button>
          )
        }
      />
      {phase === 'overview' && t.groups && (
        <Overview
          onReplay={() => {
            setPending({ groups: t.groups!, steps: t.drawSteps.length ? t.drawSteps : stepsFromGroups(t.groups!), mode: t.drawMode ?? 'manual' });
            setPhase('ceremony');
          }}
        />
      )}
      {phase === 'setup' && <Setup onStart={start} onCancel={t.groups ? () => setPhase('overview') : undefined} />}
      {phase === 'ceremony' && pending && <Ceremony result={pending} onRedo={() => start(t.drawConfig)} onSaved={() => setPhase('overview')} onBack={() => setPhase('setup')} />}
      {phase === 'manual' && <ManualBoard onSaved={() => setPhase('overview')} onBack={() => setPhase('setup')} />}
    </div>
  );
}

function stepsFromGroups(groups: string[][]): DrawStep[] {
  const steps: DrawStep[] = [];
  for (let slot = 0; slot < 4; slot++) groups.forEach((g, gi) => g[slot] && steps.push({ teamId: g[slot], group: gi, slot }));
  return steps;
}

async function saveDraw(groups: string[][], steps: DrawStep[], mode: DrawMode): Promise<boolean> {
  const { t, commit } = useStore.getState();
  const hasResults = Object.keys(t.results).length > 0;
  if (t.groups && hasResults) {
    const ok = await confirmDialog({
      title: 'Reemplazar el sorteo actual',
      message: `Ya hay ${Object.keys(t.results).length} resultados cargados. Al confirmar un nuevo sorteo se borrarán todos los resultados del torneo (podés deshacerlo).`,
      confirmLabel: 'Confirmar nuevo sorteo',
      danger: true,
    });
    if (!ok) return false;
  }
  const done = await commit((x) => ({ ...x, groups: groups.map((g) => g.slice()), drawSteps: steps, drawMode: mode, results: {} }), { label: 'Confirmar sorteo' });
  if (done) {
    sound.qualified();
    fireConfetti({ count: 160 });
    toast({ kind: 'success', title: 'Sorteo confirmado y guardado', message: 'Los 96 partidos de la fase de grupos ya están generados.' });
  }
  return done;
}

/* ---------------------------------------------------------------- SETUP */

function Setup({ onStart, onCancel }: { onStart: (cfg: DrawConfig) => void; onCancel?: () => void }) {
  const t = useStore((s) => s.t);
  const commit = useStore((s) => s.commit);
  const cfg = t.drawConfig;
  const set = (patch: Partial<DrawConfig>) => void commit((x) => ({ ...x, drawConfig: { ...x.drawConfig, ...patch } }), { label: 'Configurar sorteo' });
  const usesRules = cfg.mode === 'confederation' || (cfg.mode === 'pots' && cfg.potsUseConfedRules) || (cfg.mode === 'manual' && cfg.manualUseConfedRules);
  const feas = checkConfedFeasibility(ALL_TEAM_IDS, cfg.confedMax);
  const pots = useMemo(() => buildPots(t.ranking, cfg.hostsSeeded), [t.ranking, cfg.hostsSeeded]);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {MODES.map((m) => {
          const active = cfg.mode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => { sound.click(); set({ mode: m.id }); }}
              className={cx('glass relative overflow-hidden rounded-2xl p-5 text-left transition', active ? '!border-gold/60 ring-1 ring-gold/40' : 'hover:!border-white/20')}
            >
              {active && <div className="absolute inset-x-0 top-0 h-1 host-stripe" />}
              <div className={cx('flex h-11 w-11 items-center justify-center rounded-xl', active ? 'bg-gold text-night-950' : 'bg-white/6 text-white/70')}>
                <Icon name={m.icon} />
              </div>
              <div className="mt-4 font-display text-xl uppercase tracking-wide">{m.title}</div>
              <div className="mt-1 text-[13px] leading-snug text-white/55">{m.desc}</div>
            </button>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <Card className="p-5">
          <div className="label mb-2">Opciones</div>
          {cfg.mode !== 'manual' && (
            <Toggle checked={cfg.hostsSeeded} onChange={(v) => set({ hostsSeeded: v })} label="Anfitriones como cabezas de serie" description="España en A1, Portugal en B1 y Marruecos en C1." />
          )}
          {cfg.mode === 'pots' && (
            <Toggle checked={cfg.potsUseConfedRules} onChange={(v) => set({ potsUseConfedRules: v })} label="Aplicar también restricciones por confederación" description="Además de un equipo por bombo en cada grupo." />
          )}
          {cfg.mode === 'manual' && (
            <Toggle checked={cfg.manualUseConfedRules} onChange={(v) => set({ manualUseConfedRules: v })} label="Validar restricciones por confederación" description="El tablero marcará los grupos que no cumplan los límites." />
          )}
          {cfg.mode === 'free' && <p className="mt-2 text-sm text-white/55">Sorteo verdaderamente aleatorio: mezcla Fisher–Yates con generador criptográfico del navegador. Sin restricciones de confederación.</p>}

          {usesRules && (
            <div className="mt-4 border-t border-white/8 pt-4">
              <div className="mb-1 flex items-center justify-between">
                <div className="label">Máximo por grupo · por confederación</div>
                <Chip tone={feas.length ? 'crimson' : 'emerald'}>{feas.length ? 'Reglas imposibles' : 'Reglas válidas'}</Chip>
              </div>
              <p className="mb-3 text-xs text-white/45">Reglas personalizadas (no reglamento oficial). Se validan antes de confirmar.</p>
              <div className="space-y-2">
                {CONFEDERATIONS.map((c) => {
                  const n = TEAMS.filter((x) => x.confederation === c).length;
                  const ok = n <= cfg.confedMax[c] * 16;
                  return (
                    <div key={c} className="flex items-center justify-between gap-3 rounded-xl border border-white/6 bg-night-950/40 px-3 py-2">
                      <div>
                        <div className="font-cond text-[15px] font-bold uppercase tracking-wide">{c}</div>
                        <div className={cx('text-[11px]', ok ? 'text-white/45' : 'text-crimson-light')}>
                          {n} selecciones · capacidad {cfg.confedMax[c] * 16}
                        </div>
                      </div>
                      <Stepper size="sm" min={1} max={4} value={cfg.confedMax[c]} onChange={(v) => set({ confedMax: { ...cfg.confedMax, [c]: v } })} />
                    </div>
                  );
                })}
              </div>
              {feas.map((f) => (
                <p key={f} className="mt-2 text-xs text-crimson-light">{f}</p>
              ))}
            </div>
          )}
        </Card>

        <Card className="flex flex-col p-5">
          {cfg.mode === 'pots' ? (
            <>
              <div className="flex items-center justify-between">
                <div className="label">Bombos según tu ranking</div>
                <Button size="sm" variant="ghost" icon="edit" onClick={() => navigate('settings')}>Editar ranking</Button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {pots.map((p, i) => (
                  <div key={i} className="rounded-xl border border-white/8 bg-night-950/40 p-2.5">
                    <div className="mb-2 font-display text-lg uppercase text-gold-light">Bombo {i + 1}</div>
                    <div className="space-y-1">
                      {p.map((id) => (
                        <div key={id} className="flex items-center gap-2 text-[12px] text-white/80">
                          <Flag id={id} className="w-5" />
                          <span className="truncate">{TEAM_BY_ID[id].name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="label">Participantes · 64 selecciones</div>
              <div className="mt-3 grid grid-cols-8 gap-1.5 sm:grid-cols-11 xl:grid-cols-13">
                {TEAMS.map((x, i) => (
                  <motion.div key={x.id} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.008 }}>
                    <Flag id={x.id} shape="circle" className="w-full" />
                  </motion.div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {CONFEDERATIONS.map((c) => (
                  <Chip key={c}>{c} · {TEAMS.filter((x) => x.confederation === c).length}</Chip>
                ))}
              </div>
            </>
          )}
          <div className="mt-auto flex flex-wrap justify-end gap-2 pt-6">
            {onCancel && <Button variant="ghost" onClick={onCancel}>Volver</Button>}
            <Button variant="primary" size="lg" icon={cfg.mode === 'manual' ? 'edit' : 'play'} disabled={usesRules && feas.length > 0} onClick={() => onStart(cfg)}>
              {cfg.mode === 'manual' ? 'Abrir tablero manual' : 'Iniciar ceremonia'}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- CEREMONY */

const SPEED_MS = { '1': 1500, '2': 750, '4': 300 } as const;

function Ceremony({ result, onRedo, onSaved, onBack }: { result: DrawResult; onRedo: () => void; onSaved: () => void; onBack: () => void }) {
  const t = useStore((s) => s.t);
  const name = useTeamName();
  const [revealed, setRevealed] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<'1' | '2' | '4'>('1');
  const steps = result.steps;
  const done = revealed >= steps.length;

  useEffect(() => {
    setRevealed(0);
    setPlaying(true);
  }, [result]);

  useEffect(() => {
    if (!playing || done) return;
    const step = steps[revealed];
    const ms = step?.preset ? Math.min(600, SPEED_MS[speed]) : SPEED_MS[speed];
    if (speed === '1') sound.tumble();
    const tm = setTimeout(() => {
      setRevealed((r) => r + 1);
      sound.reveal();
    }, ms);
    return () => clearTimeout(tm);
  }, [playing, revealed, speed, done, steps]);

  useEffect(() => {
    if (done && steps.length) {
      sound.qualified();
      fireConfetti({ count: 120, origin: { x: 0.5, y: 0.3 } });
    }
  }, [done, steps.length]);

  const current = revealed > 0 ? steps[revealed - 1] : undefined;
  const partial = useMemo(() => {
    const g: string[][] = Array.from({ length: 16 }, () => ['', '', '', '']);
    steps.slice(0, revealed).forEach((s) => (g[s.group][s.slot] = s.teamId));
    return g;
  }, [steps, revealed]);
  const remaining = steps.slice(revealed).map((s) => s.teamId);
  const pots = result.mode === 'pots' ? [0, 1, 2, 3].map((p) => steps.slice(revealed).filter((s) => s.pot === p).map((s) => s.teamId)) : null;
  const activePot = steps[revealed]?.pot ?? current?.pot;
  const issues = done ? validateGroups(result.groups, { ...t.drawConfig, mode: result.mode }, t.ranking, ALL_TEAM_IDS) : [];
  const errors = issues.filter((i) => i.level === 'error');

  return (
    <div className="grid gap-5 xl:grid-cols-[400px_1fr]">
      <div className="space-y-4 xl:sticky xl:top-8 xl:self-start">
        <Card strong className="relative overflow-hidden p-5">
          <div className="absolute inset-x-0 top-0 h-1 host-stripe" />
          <div className="flex items-center justify-between">
            <div className="label">{done ? 'Sorteo completo' : `Bolilla ${Math.min(revealed + 1, steps.length)} de ${steps.length}`}</div>
            <Chip tone="gold">{MODES.find((m) => m.id === result.mode)?.title}</Chip>
          </div>
          {pots ? (
            <div className="mt-4 grid grid-cols-4 gap-2">
              {pots.map((p, i) => (
                <div key={i} className={cx('text-center transition', activePot === i && !done ? 'scale-105' : 'opacity-50')}>
                  <Drum teams={p} size={84} active={activePot === i && !done} />
                  <div className={cx('mt-1 font-cond text-xs font-bold uppercase tracking-wider', activePot === i ? 'text-gold-light' : 'text-white/50')}>Bombo {i + 1}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 flex justify-center">
              <Drum teams={remaining} size={220} active={!done} />
            </div>
          )}
          <div className="relative mt-5 flex h-[150px] items-center justify-center">
            <AnimatePresence mode="popLayout">
              {current ? (
                <motion.div
                  key={revealed}
                  initial={{ scale: 0.2, y: -90, opacity: 0, rotate: -20 }}
                  animate={{ scale: 1, y: 0, opacity: 1, rotate: 0 }}
                  exit={{ scale: 0.6, x: 140, opacity: 0 }}
                  transition={{ type: 'spring', damping: 17, stiffness: 220 }}
                  className="glass flex w-full items-center gap-4 rounded-2xl border-gold/30 p-4"
                >
                  <Flag id={current.teamId} className="w-24 sm:w-28" />
                  <div className="min-w-0">
                    <div className="label">{TEAM_BY_ID[current.teamId].confederation}{current.pot !== undefined ? ` · Bombo ${current.pot + 1}` : ''}</div>
                    <div className="truncate font-display text-3xl uppercase leading-tight">{name(current.teamId)}</div>
                    <div className="mt-1 font-cond text-lg font-bold uppercase tracking-[0.12em] text-gold-light">
                      → Grupo {GROUP_LETTERS[current.group]}{current.slot + 1}
                      {current.preset && <span className="ml-2 text-xs text-white/50">(anfitrión)</span>}
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="font-cond text-lg uppercase tracking-[0.3em] text-white/50">
                  Mezclando bolillas…
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {!done && <IconButton icon={playing ? 'pause' : 'play'} label={playing ? 'Pausa' : 'Reanudar'} onClick={() => setPlaying((p) => !p)} />}
            {!done && <Segmented value={speed} onChange={setSpeed} options={[{ value: '1', label: '1×' }, { value: '2', label: '2×' }, { value: '4', label: '4×' }]} />}
            {!done && <Button size="sm" variant="ghost" icon="skip" onClick={() => setRevealed(steps.length)}>Saltar</Button>}
          </div>
        </Card>
        {done && (
          <Card className="p-5">
            <div className="label mb-2">Validación</div>
            {errors.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-emerald-light"><Icon name="check" /> 16 grupos de 4 · 64 selecciones únicas · reglas cumplidas</p>
            ) : (
              <ul className="space-y-1 text-sm text-crimson-light">{errors.map((e) => <li key={e.message}>• {e.message}</li>)}</ul>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="gold" icon="check" disabled={errors.length > 0} onClick={async () => { if (await saveDraw(result.groups, result.steps, result.mode)) onSaved(); }}>
                Confirmar y guardar
              </Button>
              <Button variant="outline" icon="shuffle" onClick={onRedo}>Nuevo sorteo</Button>
              <Button variant="ghost" onClick={onBack}>Configuración</Button>
            </div>
          </Card>
        )}
      </div>
      <GroupsBoard groups={partial} highlight={current ? { g: current.group, i: current.slot } : undefined} />
    </div>
  );
}

/** Glass drum with jiggling balls (one per remaining team). */
function Drum({ teams, size, active }: { teams: string[]; size: number; active: boolean }) {
  const ball = Math.max(14, Math.round(size / (teams.length > 20 ? 9.5 : 5.2)));
  const positions = useMemo(() => {
    const n = Math.max(teams.length, 1);
    return teams.map((_, i) => {
      const r = Math.sqrt((i + 0.5) / n) * (size / 2 - ball * 0.75);
      const a = i * 2.39996;
      return { x: size / 2 + r * Math.cos(a) - ball / 2, y: size / 2 + r * Math.sin(a) - ball / 2 };
    });
  }, [teams, size, ball]);
  return (
    <div className="relative mx-auto rounded-full" style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-full border border-white/20 bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,0.25),rgba(255,255,255,0.04)_45%,rgba(0,0,0,0.25)_100%)] shadow-[inset_0_-12px_30px_rgba(0,0,0,0.5),0_10px_30px_rgba(0,0,0,0.5)]" />
      {teams.map((id, i) => (
        <div
          key={id}
          className={cx('absolute rounded-full', active && 'animate-jiggle')}
          style={{
            left: positions[i].x,
            top: positions[i].y,
            width: ball,
            height: ball,
            animationDelay: `${(i * 137) % 900}ms`,
            ['--jx' as string]: `${((i * 7) % 5) - 2}px`,
            ['--jy' as string]: `${((i * 3) % 7) - 4}px`,
          }}
        >
          <Flag id={id} shape="circle" className="h-full w-full !shadow-none !ring-white/40" />
        </div>
      ))}
      <div className="pointer-events-none absolute left-[18%] top-[12%] h-[22%] w-[30%] -rotate-[25deg] rounded-full bg-white/25 blur-md" />
    </div>
  );
}

/* ---------------------------------------------------------------- BOARD */

function GroupsBoard({
  groups,
  highlight,
  onSlot,
  selected,
  invalidGroups,
  onDropTeam,
}: {
  groups: string[][];
  highlight?: { g: number; i: number };
  onSlot?: (g: number, i: number) => void;
  selected?: { g: number; i: number } | null;
  invalidGroups?: Set<number>;
  onDropTeam?: (teamId: string, g: number, i: number) => void;
}) {
  const name = useTeamName();
  return (
    <div className="grid grid-cols-1 gap-3 min-[460px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {groups.map((g, gi) => (
        <div key={gi} className={cx('glass rounded-2xl p-3', invalidGroups?.has(gi) && '!border-crimson/60')}>
          <div className="mb-2 flex items-center justify-between px-1">
            <div className="font-display text-xl uppercase tracking-wide">
              Grupo <span className="text-gold-light">{GROUP_LETTERS[gi]}</span>
            </div>
            <span className="text-[11px] text-white/40">{g.filter(Boolean).length}/4</span>
          </div>
          <div className="space-y-1.5">
            {[0, 1, 2, 3].map((i) => {
              const id = g[i];
              const hl = highlight?.g === gi && highlight.i === i;
              const sel = selected?.g === gi && selected.i === i;
              return (
                <motion.button
                  type="button"
                  key={i}
                  layout
                  disabled={!onSlot}
                  onClick={() => onSlot?.(gi, i)}
                  onDragOver={(e) => onDropTeam && e.preventDefault()}
                  onDrop={(e) => {
                    const tid = e.dataTransfer.getData('text/team');
                    if (tid && onDropTeam) onDropTeam(tid, gi, i);
                  }}
                  draggable={!!onDropTeam && !!id}
                  onDragStart={(e) => {
                    const ev = e as unknown as React.DragEvent;
                    if (id) ev.dataTransfer.setData('text/team', id);
                  }}
                  className={cx(
                    'relative flex h-10 w-full items-center gap-2.5 overflow-hidden rounded-xl border px-2.5 text-left text-sm transition',
                    id ? 'border-white/8 bg-white/5' : 'border-dashed border-white/12 bg-night-950/30',
                    hl && 'border-gold/80 bg-gold/15',
                    sel && 'border-sky ring-2 ring-sky/60',
                    onSlot && 'cursor-pointer hover:border-gold/50',
                  )}
                >
                  <span className="w-4 font-cond text-xs font-bold text-white/35">{i + 1}</span>
                  <AnimatePresence mode="popLayout">
                    {id ? (
                      <motion.span key={id} className="flex min-w-0 items-center gap-2.5" initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ opacity: 0 }} transition={{ type: 'spring', damping: 20 }}>
                        <Flag id={id} className="w-7" />
                        <span className="truncate font-medium">{name(id)}</span>
                        <span className="ml-auto hidden text-[10px] text-white/35 sm:inline">{TEAM_BY_ID[id].confederation}</span>
                      </motion.span>
                    ) : (
                      <span className="text-xs italic text-white/25">vacío</span>
                    )}
                  </AnimatePresence>
                  {hl && <motion.span className="absolute inset-0 bg-gold/20" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 1.2 }} />}
                </motion.button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function Overview({ onReplay }: { onReplay: () => void }) {
  const t = useStore((s) => s.t);
  return (
    <div className="space-y-5">
      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald/20 text-emerald-light"><Icon name="check" /></div>
          <div>
            <div className="font-display text-xl uppercase">Sorteo confirmado</div>
            <div className="text-sm text-white/55">Modo: {MODES.find((m) => m.id === t.drawMode)?.title ?? 'Manual'} · {Object.keys(t.results).length} resultados cargados</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" icon="play" onClick={onReplay}>Repetir animación</Button>
          <Button variant="gold" icon="groups" onClick={() => navigate('groups')}>Ir a la fase de grupos</Button>
        </div>
      </Card>
      <GroupsBoard groups={t.groups!} />
    </div>
  );
}

/* ---------------------------------------------------------------- MANUAL */

function ManualBoard({ onSaved, onBack }: { onSaved: () => void; onBack: () => void }) {
  const t = useStore((s) => s.t);
  const name = useTeamName();
  const [groups, setGroups] = useState<string[][]>(() => (t.groups ? t.groups.map((g) => g.slice()) : Array.from({ length: 16 }, () => ['', '', '', ''])));
  const [poolSel, setPoolSel] = useState<string | null>(null);
  const [slotSel, setSlotSel] = useState<{ g: number; i: number } | null>(null);
  const [filter, setFilter] = useState('');
  const placed = new Set(groups.flat().filter(Boolean));
  const pool = TEAMS.filter((x) => !placed.has(x.id) && (!filter || x.name.toLowerCase().includes(filter.toLowerCase()) || x.confederation.toLowerCase() === filter.toLowerCase()));
  const complete = placed.size === 64;
  const cfg = { ...t.drawConfig, mode: 'manual' as const };
  const issues = validateGroups(groups.map((g) => g.filter(Boolean)), cfg, t.ranking, ALL_TEAM_IDS).filter((i) => complete || !i.message.includes('no está asignada') && !i.message.includes('tiene'));
  const invalid = new Set(issues.filter((i) => i.message.startsWith('Grupo')).map((i) => GROUP_LETTERS.indexOf(i.message.split(' ')[1].replace(':', ''))));
  const boardRef = useRef<HTMLDivElement>(null);

  const placeAt = (teamId: string, g: number, i: number) => {
    setGroups((prev) => {
      const next = prev.map((x) => x.slice());
      // If the team is already placed, move it (swap with target).
      let from: { g: number; i: number } | null = null;
      next.forEach((grp, gi) => grp.forEach((id, ii) => id === teamId && (from = { g: gi, i: ii })));
      const target = next[g][i];
      if (from) next[(from as { g: number }).g][(from as { i: number }).i] = target;
      next[g][i] = teamId;
      return next;
    });
    sound.place();
    setPoolSel(null);
    setSlotSel(null);
  };

  const onSlot = (g: number, i: number) => {
    const id = groups[g][i];
    if (poolSel) return placeAt(poolSel, g, i);
    if (slotSel) {
      if (slotSel.g === g && slotSel.i === i) return setSlotSel(null);
      const moving = groups[slotSel.g][slotSel.i];
      if (moving) return placeAt(moving, g, i);
    }
    if (id) setSlotSel({ g, i });
  };

  const removeSelected = () => {
    if (!slotSel) return;
    setGroups((prev) => prev.map((grp, gi) => grp.map((id, ii) => (gi === slotSel.g && ii === slotSel.i ? '' : id))));
    setSlotSel(null);
  };

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="font-display text-xl uppercase">Tablero manual · {placed.size}/64</div>
            <div className="text-sm text-white/55">Tocá una selección y luego un lugar del grupo. Tocá una selección ya ubicada para moverla o intercambiarla. En escritorio también podés arrastrar.</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {slotSel && groups[slotSel.g][slotSel.i] && <Button size="sm" variant="danger" icon="x" onClick={removeSelected}>Quitar {name(groups[slotSel.g][slotSel.i])}</Button>}
            <Button size="sm" variant="outline" icon="shuffle" disabled={complete} onClick={() => { setGroups(completeManualDraw(groups.map((g) => g.filter(Boolean)), cfg, ALL_TEAM_IDS).map((g) => g.slice())); sound.reveal(); }}>Completar al azar</Button>
            <Button size="sm" variant="ghost" icon="trash" onClick={() => { setGroups(Array.from({ length: 16 }, () => ['', '', '', ''])); setSlotSel(null); }}>Vaciar</Button>
            <Button size="sm" variant="ghost" onClick={onBack}>Configuración</Button>
          </div>
        </div>
        {pool.length > 0 || filter ? (
          <div className="mt-4">
            <div className="no-scrollbar mb-2 flex gap-1.5 overflow-x-auto">
              <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Buscar…" className="h-9 w-36 shrink-0 rounded-lg border border-white/10 bg-night-950/60 px-3 text-sm outline-none focus:border-gold/60" />
              {CONFEDERATIONS.map((c) => (
                <button key={c} onClick={() => setFilter(filter === c ? '' : c)} className={cx('shrink-0 rounded-lg border px-3 font-cond text-xs font-bold uppercase tracking-wider', filter === c ? 'border-gold/60 bg-gold/15 text-gold-light' : 'border-white/10 text-white/60')}>{c}</button>
              ))}
            </div>
            <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
              {pool.map((x) => (
                <button
                  key={x.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/team', x.id)}
                  onClick={() => { setPoolSel(poolSel === x.id ? null : x.id); setSlotSel(null); sound.click(); }}
                  className={cx('flex items-center gap-2 rounded-lg border py-1 pl-1 pr-2.5 text-[13px] transition', poolSel === x.id ? 'border-sky bg-sky/15 ring-2 ring-sky/50' : 'border-white/10 bg-white/5 hover:border-white/25')}
                >
                  <Flag id={x.id} className="w-6" />
                  {name(x.id)}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {issues.length > 0 && (
          <ul className="mt-3 space-y-0.5 text-xs text-crimson-light">{issues.slice(0, 6).map((e) => <li key={e.message}>• {e.message}</li>)}</ul>
        )}
      </Card>
      <div ref={boardRef}>
        <GroupsBoard groups={groups} onSlot={onSlot} selected={slotSel} invalidGroups={invalid} onDropTeam={placeAt} />
      </div>
      <div className="sticky bottom-24 z-20 flex justify-end lg:bottom-6">
        <Button
          variant="gold"
          size="lg"
          icon="check"
          disabled={!complete || issues.some((i) => i.level === 'error')}
          onClick={async () => {
            if (await saveDraw(groups, stepsFromGroups(groups), 'manual')) onSaved();
          }}
        >
          Confirmar y guardar
        </Button>
      </div>
    </div>
  );
}

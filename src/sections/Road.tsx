import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { CONFEDERATIONS, GROUP_LETTERS, STAGE_LABEL, TEAMS, TEAM_BY_ID, buildJourney, formatMinute, isGoal, sortEvents, type Confederation, type JourneyStep } from '../engine';
import { Crest, Flag, Trophy } from '../components/brand';
import { Icon } from '../components/Icon';
import { EventGlyph } from '../components/match';
import { MomentumBars } from '../components/Momentum';
import { StandingsTable } from '../components/StandingsTable';
import { Button, Card, Chip, cx, EmptyState, SectionHeader } from '../components/ui';
import { navigate } from '../lib/router';
import { useDerived, useTeamName } from '../store/tournament';

export default function Road({ param }: { param?: string }) {
  const teamId = param && TEAM_BY_ID[param] ? param : undefined;
  if (!teamId) return <Picker />;
  return <JourneyView teamId={teamId} key={teamId} />;
}

function Picker() {
  const d = useDerived();
  const name = useTeamName();
  const [q, setQ] = useState('');
  const [conf, setConf] = useState<Confederation | 'ALL'>('ALL');
  const list = TEAMS.filter((t) => (conf === 'ALL' || t.confederation === conf) && (!q || name(t.id).toLowerCase().includes(q.toLowerCase())));
  return (
    <div>
      <SectionHeader
        eyebrow="The Road to Glory · Recorridos"
        title="The Road to Glory"
        subtitle="Elegí una selección y mirá su recorrido completo, generado automáticamente a partir de los resultados del torneo."
        actions={d.champion ? <Button variant="gold" icon="trophy" onClick={() => navigate('road', d.champion)}>Camino del campeón</Button> : undefined}
      />
      {d.champion && (
        <button onClick={() => navigate('road', d.champion)} className="glass relative mb-5 flex w-full items-center gap-4 overflow-hidden rounded-2xl !border-gold/40 p-4 text-left">
          <div className="absolute inset-0 shine" />
          <Trophy className="h-16 w-10" glow={false} />
          <Flag id={d.champion} className="w-14" />
          <div>
            <div className="label !text-gold-light">El camino del campeón</div>
            <div className="font-display text-2xl uppercase">{name(d.champion)}</div>
          </div>
          <Icon name="chevronRight" className="ml-auto text-gold-light" />
        </button>
      )}
      <Card className="p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar selección…" className="h-11 flex-1 rounded-xl border border-white/10 bg-night-950/60 px-4 text-sm outline-none focus:border-gold/60" />
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
            {(['ALL', ...CONFEDERATIONS] as const).map((c) => (
              <button key={c} onClick={() => setConf(c)} className={cx('h-11 shrink-0 rounded-xl border px-3 font-cond text-xs font-bold uppercase tracking-wider', conf === c ? 'border-gold/60 bg-gold/15 text-gold-light' : 'border-white/10 text-white/60')}>
                {c === 'ALL' ? 'Todas' : c}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
          {list.map((t, i) => {
            const j = buildJourney(d, t.id);
            return (
              <motion.button
                key={t.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.01, 0.3) }}
                onClick={() => navigate('road', t.id)}
                className={cx('group flex items-center gap-3 rounded-xl border p-2.5 text-left transition hover:border-gold/50 hover:bg-white/6', j.status.kind === 'champion' ? 'border-gold/50 bg-gold/10' : 'border-white/8 bg-white/3')}
              >
                <Flag id={t.id} className="w-10" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{name(t.id)}</span>
                  <span className={cx('block truncate text-[11px]', j.status.kind === 'champion' ? 'text-gold-light' : j.status.kind === 'eliminated' ? 'text-white/35' : 'text-white/50')}>{j.status.label}</span>
                </span>
              </motion.button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function JourneyView({ teamId }: { teamId: string }) {
  const d = useDerived();
  const name = useTeamName();
  const j = useMemo(() => buildJourney(d, teamId), [d, teamId]);
  const team = TEAM_BY_ID[teamId];
  const g = j.groupIndex !== undefined ? d.groups[j.groupIndex] : undefined;
  const statusTone = j.status.kind === 'champion' ? 'gold' : j.status.kind === 'eliminated' ? 'crimson' : j.status.kind === 'alive' ? 'emerald' : 'sky';

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <Button size="sm" variant="ghost" icon="chevronLeft" onClick={() => navigate('road')}>Todas las selecciones</Button>
        {d.champion && d.champion !== teamId && <Button size="sm" variant="ghost" icon="trophy" onClick={() => navigate('road', d.champion)}>Camino del campeón</Button>}
      </div>
      {/* HERO */}
      <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative mb-6 overflow-hidden rounded-[2rem] border border-white/10">
        <div className="absolute inset-0" style={{ background: `linear-gradient(120deg, ${team.color}cc 0%, ${team.color}55 35%, #070d1c 70%), radial-gradient(80% 100% at 100% 0%, ${team.color2}66, transparent)` }} />
        <div className="absolute inset-0 pitch-lines opacity-40" />
        <div className="relative flex flex-col gap-6 p-6 sm:p-10 md:flex-row md:items-center">
          <div className="flex items-center gap-5">
            <Crest id={teamId} size={92} className="drop-shadow-2xl" />
            <div>
              <div className="label !text-white/80">{team.confederation} · {g ? `Grupo ${g.letter}` : 'Sin sorteo'}</div>
              <h1 className="font-display text-5xl uppercase leading-none sm:text-7xl">{name(teamId)}</h1>
              <div className="mt-3"><Chip tone={statusTone}>{j.status.label}</Chip></div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 md:ml-auto md:grid-cols-6">
            {[
              ['PJ', j.wins + j.draws + j.losses],
              ['G', j.wins],
              ['E', j.draws],
              ['P', j.losses],
              ['GF', j.goalsFor],
              ['GC', j.goalsAgainst],
            ].map(([l, v]) => (
              <div key={l as string} className="rounded-xl border border-white/10 bg-night-950/50 px-3 py-2 text-center backdrop-blur">
                <div className="font-display text-3xl tabular">{v}</div>
                <div className="label">{l}</div>
              </div>
            ))}
          </div>
        </div>
        {j.status.kind === 'champion' && <Trophy className="absolute -right-4 bottom-0 hidden h-56 w-36 opacity-90 lg:block" />}
      </motion.section>

      {!g ? (
        <EmptyState icon="draw" title="Recorrido pendiente" message="Esta selección todavía no tiene grupo asignado. Realizá el sorteo para comenzar su camino." action={<Button variant="gold" onClick={() => navigate('draw')}>Ir al sorteo</Button>} />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
          <div className="relative">
            <div className="absolute bottom-6 left-[22px] top-6 w-0.5 bg-gradient-to-b from-emerald via-gold to-crimson opacity-40 sm:left-[30px]" />
            <RoadNode icon="groups" title={`Fase de grupos · Grupo ${GROUP_LETTERS[g.index]}`} subtitle={j.groupComplete ? `Terminó ${j.groupRow?.position}º con ${j.groupRow?.points} puntos` : `${j.groupRow?.played}/3 partidos · ${j.groupRow?.points} pts provisionales`} tone="emerald">
              <div className="space-y-2">
                {j.groupSteps.map((s) => (
                  <StepCard key={s.matchId} s={s} teamId={teamId} />
                ))}
              </div>
            </RoadNode>
            {j.knockoutSteps.map((s, i) => (
              <RoadNode
                key={s.matchId}
                icon={s.stage === 'F' ? 'trophy' : 'bracket'}
                title={STAGE_LABEL[s.stage]}
                subtitle={s.outcome === 'pending' ? 'Por jugar' : s.advanced ? (s.stage === 'F' ? '¡Campeón del mundo!' : s.stage === '3P' ? 'Tercer puesto' : 'Clasificado') : s.stage === 'F' ? 'Subcampeón' : s.stage === '3P' ? 'Cuarto puesto' : 'Eliminado'}
                tone={s.advanced ? (s.stage === 'F' ? 'gold' : 'emerald') : s.outcome === 'pending' ? 'neutral' : 'crimson'}
                delay={0.1 * (i + 1)}
              >
                <StepCard s={s} teamId={teamId} />
              </RoadNode>
            ))}
            {j.status.kind === 'champion' && (
              <RoadNode icon="star" title="Campeón del mundo 2030" subtitle={`${j.wins} victorias · ${j.goalsFor} goles a favor`} tone="gold" delay={0.8}>
                <div className="flex items-center gap-4 rounded-2xl border border-gold/40 bg-gold/10 p-4">
                  <Trophy className="h-24 w-16" />
                  <div className="font-display text-3xl uppercase text-gold-gradient">{name(teamId)} campeón</div>
                </div>
              </RoadNode>
            )}
          </div>
          <div className="space-y-4">
            <Card className="p-4">
              <div className="label mb-2">Grupo {g.letter}</div>
              <StandingsTable rows={g.table.rows} complete={g.table.complete} compact />
            </Card>
            <Card className="p-4">
              <div className="label mb-3">Goleadores de {name(teamId)}</div>
              {j.scorers.length ? (
                <ul className="space-y-2">
                  {j.scorers.map((s, i) => (
                    <li key={s.player} className="flex items-center gap-3">
                      <span className="w-5 font-display text-white/40">{i + 1}</span>
                      <span className="flex-1 truncate text-sm">{s.player}</span>
                      <span className="font-display text-xl text-gold-light">{s.goals}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-white/45">Agregá el nombre del jugador en los goles del editor Momentum para ver a los goleadores.</p>
              )}
            </Card>
            <Card className="p-4">
              <div className="label mb-3">Compartir el recorrido</div>
              <div className="flex flex-col gap-2">
                <Button variant="gold" icon="poster" onClick={() => navigate('poster', teamId)}>Crear póster legendario</Button>
                <Button variant="outline" icon="film" onClick={() => navigate('recap', teamId)}>Vídeo del recorrido</Button>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function RoadNode({ icon, title, subtitle, tone, children, delay = 0 }: { icon: Parameters<typeof Icon>[0]['name']; title: string; subtitle: string; tone: 'gold' | 'emerald' | 'crimson' | 'neutral'; children: React.ReactNode; delay?: number }) {
  const ring = tone === 'gold' ? 'from-gold-light to-gold-dark text-night-950' : tone === 'emerald' ? 'from-emerald-light to-emerald-dark text-white' : tone === 'crimson' ? 'from-crimson-light to-crimson-dark text-white' : 'from-white/30 to-white/10 text-white';
  return (
    <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ delay, duration: 0.5 }} className="relative mb-5 pl-14 sm:pl-20">
      <div className={cx('absolute left-0 top-0 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-b shadow-lg sm:h-[60px] sm:w-[60px]', ring)}>
        <Icon name={icon} size={22} />
      </div>
      <div className="mb-2">
        <div className="font-display text-2xl uppercase leading-tight">{title}</div>
        <div className="text-sm text-white/55">{subtitle}</div>
      </div>
      {children}
    </motion.div>
  );
}

function StepCard({ s, teamId }: { s: JourneyStep; teamId: string }) {
  const name = useTeamName();
  const goals = s.result ? sortEvents(s.result.events).filter((e) => isGoal(e) || e.type === 'red' || e.type === 'penalty_miss') : [];
  const tone = s.outcome === 'W' || s.advanced ? 'border-emerald/30' : s.outcome === 'L' || s.advanced === false ? 'border-crimson/30' : 'border-white/10';
  return (
    <button onClick={() => s.opponentId && navigate('road', s.opponentId)} className={cx('glass block w-full rounded-2xl p-3 text-left sm:p-4', tone)}>
      <div className="flex items-center gap-3">
        {s.matchday && <span className="hidden font-cond text-xs font-bold uppercase tracking-wider text-white/40 sm:block">J{s.matchday}</span>}
        <Flag id={teamId} className="w-8" />
        <span className={cx('rounded-lg px-3 py-1 font-display text-2xl tabular', s.outcome === 'pending' ? 'text-white/30' : 'bg-night-950/60')}>{s.outcome === 'pending' ? 'vs' : `${s.goalsFor} - ${s.goalsAgainst}`}</span>
        <Flag id={s.opponentId} className="w-8" />
        <span className="min-w-0 flex-1 truncate font-semibold">{s.opponentId ? name(s.opponentId) : 'Rival por definir'}</span>
        {s.outcome !== 'pending' && (
          <span className={cx('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-cond text-sm font-bold', s.outcome === 'W' ? 'bg-emerald text-white' : s.outcome === 'L' ? 'bg-crimson text-white' : 'bg-white/20')}>
            {s.outcome === 'W' ? 'G' : s.outcome === 'L' ? 'P' : 'E'}
          </span>
        )}
      </div>
      {(s.scoreline.includes('pró') || s.scoreline.includes('pen')) && <div className="mt-1.5 text-xs text-gold-light/80">{s.scoreline}</div>}
      {s.result?.momentum && s.result.momentum.length > 0 && (
        <div className="mt-2">
          <MomentumBars result={s.result} values={s.result.momentum} height={44} compact />
        </div>
      )}
      {goals.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-white/5 pt-2 text-xs">
          {goals.map((e) => (
            <span key={e.id} className={cx('flex items-center gap-1', e.teamId === teamId ? 'text-white/80' : 'text-white/40')}>
              <EventGlyph type={e.type} size={13} />
              {formatMinute(e)} {e.player ?? (e.teamId === teamId ? name(teamId) : name(e.teamId))}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

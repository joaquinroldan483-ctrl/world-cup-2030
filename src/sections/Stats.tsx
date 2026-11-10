import { useMemo, useState } from 'react';
import { STAGE_SHORT, computeStats, type MatchRecord, type TeamTotals } from '../engine';
import { Flag } from '../components/brand';
import { BarList, Columns, KPI, StackBar } from '../components/charts';
import { EventGlyph, EVENT_SHORT } from '../components/match';
import { Button, Card, cx, EmptyState, SectionHeader } from '../components/ui';
import { navigate } from '../lib/router';
import { useDerived, useTeamName } from '../store/tournament';

type SortKey = 'points' | 'goalsFor' | 'goalsAgainst' | 'goalDiff' | 'won' | 'drawn' | 'played';

export default function Stats() {
  const d = useDerived();
  const name = useTeamName();
  const s = useMemo(() => computeStats(d), [d]);
  const [sort, setSort] = useState<SortKey>('points');

  if (!s.matches)
    return (
      <>
        <SectionHeader eyebrow="Statistics · Estadísticas" title="Statistics" accent="emerald" />
        <EmptyState icon="stats" title="Todavía no hay partidos" message="Las estadísticas se generan automáticamente a medida que cargás resultados." action={<Button variant="gold" onClick={() => navigate(d.drawn ? 'groups' : 'draw')}>{d.drawn ? 'Cargar resultados' : 'Ir al sorteo'}</Button>} />
      </>
    );

  const played = s.teams.filter((t) => t.played > 0);
  const top = <K extends keyof TeamTotals>(k: K, dir: 1 | -1 = 1) => played.slice().sort((a, b) => dir * ((b[k] as number) - (a[k] as number)))[0];
  const mostGoals = top('goalsFor');
  const leastConceded = top('goalsAgainst', -1);
  const mostWins = top('won');
  const mostDraws = top('drawn');
  const bestGD = top('goalDiff');
  const biggest = s.biggestWins[0];
  const highest = s.highestScoring[0];
  const matchLine = (m?: MatchRecord) => (m ? `${name(m.homeId)} ${m.total.home}-${m.total.away} ${name(m.awayId)}` : '—');
  const sorted = played.slice().sort((a, b) => (sort === 'goalsAgainst' ? a[sort] - b[sort] : b[sort] - a[sort]) || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor);

  return (
    <div className="space-y-6">
      <SectionHeader eyebrow="Statistics · Estadísticas" title="Statistics" accent="emerald" subtitle="Todo se calcula automáticamente a partir de los resultados y acontecimientos cargados." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KPI label="Partidos" value={s.matches} sub="de 128" />
        <KPI label="Goles" value={s.goals} accent />
        <KPI label="Promedio" value={s.avgGoals.toFixed(2)} sub="goles por partido" />
        <KPI label="Prórrogas" value={s.extraTimeMatches} />
        <KPI label="Tandas de penales" value={s.shootouts} />
        <KPI label="Tarjetas rojas" value={s.events.red} sub={`${s.events.yellow} amarillas`} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Record label="Selección más goleadora" team={mostGoals?.teamId} value={`${mostGoals?.goalsFor ?? 0} goles`} />
        <Record label="Selección menos goleada" team={leastConceded?.teamId} value={`${leastConceded?.goalsAgainst ?? 0} recibidos en ${leastConceded?.played ?? 0} PJ`} />
        <Record label="Más victorias" team={mostWins?.teamId} value={`${mostWins?.won ?? 0} victorias`} />
        <Record label="Mejor diferencia de gol" team={bestGD?.teamId} value={`${(bestGD?.goalDiff ?? 0) > 0 ? '+' : ''}${bestGD?.goalDiff ?? 0}`} />
        <Record label="Más empates" team={mostDraws?.teamId} value={`${mostDraws?.drawn ?? 0} empates`} />
        <Record label="Mayor goleada" match={biggest} value={matchLine(biggest)} />
        <Record label="Partido con más goles" match={highest} value={matchLine(highest)} />
        <Record label="Máximo goleador" team={s.topScorers[0]?.teamId} title={s.topScorers[0]?.player} value={s.topScorers[0] ? `${s.topScorers[0].goals} goles` : 'Cargá jugadores en Momentum'} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Card className="p-5">
          <div className="label mb-4">Tabla de goleadores</div>
          {s.topScorers.length ? (
            <ol className="space-y-2">
              {s.topScorers.slice(0, 10).map((p, i) => (
                <li key={p.teamId + p.player} className={cx('flex items-center gap-3 rounded-xl px-3 py-2', i === 0 ? 'border border-gold/40 bg-gold/10' : 'bg-white/3')}>
                  <span className={cx('w-6 font-display text-lg', i === 0 ? 'text-gold-light' : 'text-white/40')}>{i + 1}</span>
                  <Flag id={p.teamId} className="w-7" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{p.player}</span>
                    <span className="text-[11px] text-white/45">{name(p.teamId)}{p.penalties ? ` · ${p.penalties} de penal` : ''}</span>
                  </span>
                  <span className="font-display text-2xl tabular">{p.goals}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-white/50">Para el ranking de goleadores, escribí el nombre del jugador al registrar los goles en el editor Momentum de cada partido.</p>
          )}
        </Card>
        <Card className="p-5">
          <div className="label mb-4">Selecciones más goleadoras</div>
          <BarList
            data={played
              .slice()
              .sort((a, b) => b.goalsFor - a.goalsFor)
              .slice(0, 10)
              .map((t) => ({ key: t.teamId, label: <span className="flex items-center gap-2"><Flag id={t.teamId} className="w-5" />{name(t.teamId)}</span>, value: t.goalsFor, hint: `${t.goalsFor} GF · ${t.goalsAgainst} GC · ${t.played} PJ` }))}
          />
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <div className="label mb-4">Goles por fase</div>
          <Columns data={s.goalsByStage.filter((g) => g.matches > 0).map((g) => ({ key: g.stage, label: STAGE_SHORT[g.stage], value: g.goals, hint: `${g.goals} goles en ${g.matches} partidos · ${(g.goals / g.matches).toFixed(2)} por partido` }))} />
        </Card>
        <Card className="p-5">
          <div className="label mb-4">Goles por tramo del partido</div>
          {s.goalsByMinute.some((g) => g.goals) ? (
            <Columns data={s.goalsByMinute.map((g) => ({ key: g.label, label: g.label, value: g.goals, hint: `${g.goals} goles (${g.label})` }))} />
          ) : (
            <p className="text-sm text-white/50">Registrá los minutos de los goles en Momentum para ver esta distribución.</p>
          )}
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Card className="p-5">
          <div className="label mb-4">Distribución de resultados</div>
          <StackBar
            parts={[
              { key: 'h', label: 'Victorias del primer equipo', value: s.distribution.homeWins, color: '#3d8fe6' },
              { key: 'd', label: 'Empates', value: s.distribution.draws, color: '#b8860b' },
              { key: 'a', label: 'Victorias del segundo equipo', value: s.distribution.awayWins, color: '#e2475a' },
            ]}
          />
          <div className="label mb-3 mt-6">Marcadores más repetidos</div>
          <BarList data={s.scorelines.slice(0, 6).map((x) => ({ key: x.score, label: x.score, value: x.count, hint: `${x.count} partidos terminaron ${x.score}` }))} />
        </Card>
        <Card className="p-5">
          <div className="label mb-4">Acontecimientos registrados</div>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(s.events) as (keyof typeof s.events)[]).map((k) => (
              <div key={k} className="flex items-center gap-3 rounded-xl bg-white/4 px-3 py-2.5">
                <EventGlyph type={k} size={20} />
                <span className="min-w-0 flex-1 truncate text-[13px] text-white/70">{EVENT_SHORT[k]}</span>
                <span className="font-display text-xl tabular">{s.events[k]}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="label px-5 pt-5">Estadísticas por confederación</div>
        <div className="overflow-x-auto p-5 pt-3">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="font-cond text-[11px] uppercase tracking-[0.12em] text-white/40">
              <tr>
                {['Confederación', 'Equipos', 'Clasif.', 'PJ', 'G', 'E', 'P', 'GF', 'GC', 'GF/PJ'].map((h) => <th key={h} className="py-2 text-left font-bold first:pl-0">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {s.byConfederation.map((c) => (
                <tr key={c.confederation} className="border-t border-white/5 tabular">
                  <td className="py-2 font-cond text-[15px] font-bold uppercase tracking-wide">{c.confederation}</td>
                  <td>{c.teams}</td>
                  <td className="text-emerald-light">{c.qualified}</td>
                  <td>{c.played}</td>
                  <td>{c.won}</td>
                  <td>{c.drawn}</td>
                  <td>{c.lost}</td>
                  <td>{c.goalsFor}</td>
                  <td>{c.goalsAgainst}</td>
                  <td>{c.played ? (c.goalsFor / c.played).toFixed(2) : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5">
          <div className="label">Las 64 selecciones · todo el torneo</div>
          <span className="text-[11px] text-white/40">Los partidos definidos por penales cuentan como empate.</span>
        </div>
        <div className="overflow-x-auto p-5 pt-3">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="font-cond text-[11px] uppercase tracking-[0.12em] text-white/40">
              <tr>
                <th className="py-2 text-left">#</th>
                <th className="py-2 text-left">Selección</th>
                {([['played', 'PJ'], ['won', 'PG'], ['drawn', 'PE'], [null, 'PP'], ['goalsFor', 'GF'], ['goalsAgainst', 'GC'], ['goalDiff', 'DG'], ['points', 'PTS']] as [SortKey | null, string][]).map(([k, l]) => (
                  <th key={l} className="py-2 text-center">
                    {k ? <button onClick={() => setSort(k)} className={cx('uppercase', sort === k ? 'text-gold-light' : 'hover:text-white')}>{l}{sort === k ? ' ▾' : ''}</button> : l}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((t, i) => (
                <tr key={t.teamId} className="border-t border-white/5 tabular">
                  <td className="py-1.5 text-white/40">{i + 1}</td>
                  <td>
                    <button className="flex items-center gap-2 hover:text-gold-light" onClick={() => navigate('road', t.teamId)}>
                      <Flag id={t.teamId} className="w-6" />
                      {name(t.teamId)}
                    </button>
                  </td>
                  {[t.played, t.won, t.drawn, t.lost, t.goalsFor, t.goalsAgainst, t.goalDiff > 0 ? `+${t.goalDiff}` : t.goalDiff, t.points].map((v, j) => (
                    <td key={j} className={cx('text-center', j === 7 && 'font-display text-base')}>{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Record({ label, team, match, value, title }: { label: string; team?: string; match?: MatchRecord; value: string; title?: string }) {
  const name = useTeamName();
  return (
    <Card className="p-4">
      <div className="label">{label}</div>
      <div className="mt-2 flex items-center gap-3">
        {match ? (
          <div className="flex -space-x-2">
            <Flag id={match.homeId} shape="circle" className="w-9 ring-2 ring-night-900" />
            <Flag id={match.awayId} shape="circle" className="w-9 ring-2 ring-night-900" />
          </div>
        ) : (
          <Flag id={team} className="w-11" />
        )}
        <div className="min-w-0">
          {!match && <div className="truncate font-display text-xl uppercase">{title ?? (team ? name(team) : '—')}</div>}
          <div className={cx('truncate', match ? 'font-semibold' : 'text-sm text-white/60')}>{value}</div>
          {match && <div className="text-[11px] text-white/45">{STAGE_SHORT[match.stage]}</div>}
        </div>
      </div>
    </Card>
  );
}

import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { GROUP_LETTERS, TIEBREAK_LABEL, simulatePending, type GroupFixture, type GroupView } from '../engine';
import { Flag } from '../components/brand';
import { Icon } from '../components/Icon';
import { EventGlyph } from '../components/match';
import { MatchEditor, type EditorTarget } from '../components/MatchEditor';
import { StandingsTable } from '../components/StandingsTable';
import { Button, Card, Chip, cx, EmptyState, IconButton, ProgressBar, SectionHeader, Segmented } from '../components/ui';
import { navigate } from '../lib/router';
import { useDerived, useStore, useTeamName } from '../store/tournament';
import { confirmDialog } from '../store/ui';
import { isGoal, formatMinute, sortEvents } from '../engine';

type Filter = 'all' | 'pending' | 'complete';

export default function Groups({ param }: { param?: string }) {
  const d = useDerived();
  const commit = useStore((s) => s.commit);
  const [filter, setFilter] = useState<Filter>('all');
  const [view, setView] = useState<'groups' | 'matchday'>('groups');
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const focus = param ? GROUP_LETTERS.indexOf(param.toUpperCase()) : -1;

  if (!d.drawn)
    return (
      <>
        <SectionHeader eyebrow="Group Stage · Fase de grupos" title="Group Stage" accent="emerald" />
        <EmptyState icon="draw" title="Primero, el sorteo" message="Realizá y confirmá el sorteo de grupos para generar automáticamente los 96 partidos de la fase de grupos." action={<Button variant="gold" icon="draw" onClick={() => navigate('draw')}>Ir al sorteo</Button>} />
      </>
    );

  const simulateAll = async () => {
    const ok = await confirmDialog({ title: 'Simular partidos pendientes', message: 'Se completarán con resultados aleatorios (basados en tu ranking personalizado) solo los partidos de grupo que todavía no tienen resultado. Los resultados ya cargados no se modifican.', confirmLabel: 'Simular' });
    if (ok) await commit((t) => simulatePending(t, { kind: 'groups' }), { label: 'Simular fase de grupos', celebrate: 'bulk' });
  };

  const open = (f: GroupFixture) => setEditor({ matchId: f.id, stage: 'GROUP', homeId: f.homeId, awayId: f.awayId, label: `Grupo ${GROUP_LETTERS[f.group]} · Jornada ${f.matchday}` });

  if (focus >= 0 && d.groups[focus]) return <GroupDetail g={d.groups[focus]} onOpen={open} editor={editor} setEditor={setEditor} />;

  const groups = d.groups.filter((g) => (filter === 'all' ? true : filter === 'complete' ? g.table.complete : !g.table.complete));

  return (
    <div>
      <SectionHeader
        eyebrow="Group Stage · Fase de grupos"
        title="Group Stage"
        accent="emerald"
        subtitle="Cargá el resultado exacto de cada partido. Las tablas se recalculan al instante con los criterios de desempate configurados."
        actions={
          <>
            <Button variant="outline" icon="sparkles" onClick={simulateAll} disabled={d.progress.groupPlayed === 96}>Simular pendientes</Button>
            <Button variant="gold" icon="bracket" onClick={() => navigate('knockout')}>Eliminatorias</Button>
          </>
        }
      />
      <Card className="mb-5 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/70">{d.progress.groupPlayed} de 96 partidos jugados · {d.progress.groupsComplete}/16 grupos completos</span>
              <span className="font-display text-lg text-gold-light">{Math.round((d.progress.groupPlayed / 96) * 100)}%</span>
            </div>
            <ProgressBar value={d.progress.groupPlayed / 96} className="mt-2" tone="emerald" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Segmented value={view} onChange={setView} options={[{ value: 'groups', label: 'Grupos' }, { value: 'matchday', label: 'Por jornada' }]} />
            {view === 'groups' && <Segmented value={filter} onChange={setFilter} options={[{ value: 'all', label: 'Todos' }, { value: 'pending', label: 'Pendientes' }, { value: 'complete', label: 'Completos' }]} />}
          </div>
        </div>
      </Card>

      {view === 'groups' ? (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {groups.map((g, i) => (
            <motion.div key={g.index} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.4) }}>
              <GroupCard g={g} onOpen={open} />
            </motion.div>
          ))}
        </div>
      ) : (
        <MatchdayView groups={d.groups} onOpen={open} />
      )}
      <p className="mt-6 text-xs text-white/40">
        Criterios de desempate: {d.t.tiebreakers.map((c) => TIEBREAK_LABEL[c]).join(' → ')}.{' '}
        <button className="text-gold-light underline-offset-2 hover:underline" onClick={() => navigate('settings')}>Configurar</button>
      </p>
      <MatchEditor target={editor} onClose={() => setEditor(null)} />
    </div>
  );
}

function GroupCard({ g, onOpen }: { g: GroupView; onOpen: (f: GroupFixture) => void }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/6 bg-gradient-to-r from-emerald/15 via-transparent to-transparent px-4 py-3">
        <button onClick={() => navigate('groups', g.letter)} className="flex items-center gap-3 text-left">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-b from-gold-light to-gold-dark font-display text-2xl text-night-950">{g.letter}</span>
          <span>
            <span className="block font-display text-xl uppercase leading-none">Grupo {g.letter}</span>
            <span className="text-[11px] text-white/45">{g.table.played}/6 partidos</span>
          </span>
        </button>
        <div className="flex items-center gap-2">
          {g.table.complete ? <Chip tone="emerald">Completo</Chip> : <Chip>En juego</Chip>}
          <IconButton icon="chevronRight" label="Abrir grupo" onClick={() => navigate('groups', g.letter)} />
        </div>
      </div>
      <div className="px-4 pt-2">
        <StandingsTable rows={g.table.rows} complete={g.table.complete} compact />
      </div>
      <div className="grid gap-1.5 p-3">
        {g.table.fixtures.map((f) => (
          <FixtureRow key={f.id} f={f} onOpen={onOpen} compact />
        ))}
      </div>
    </Card>
  );
}

export function FixtureRow({ f, onOpen, compact }: { f: GroupFixture; onOpen: (f: GroupFixture) => void; compact?: boolean }) {
  const r = useStore((s) => s.t.results[f.id]);
  const name = useTeamName();
  const valid = r && r.homeId === f.homeId && r.awayId === f.awayId ? r : undefined;
  const goals = valid ? sortEvents(valid.events).filter(isGoal) : [];
  return (
    <button onClick={() => onOpen(f)} className={cx('group w-full rounded-xl border text-left transition hover:border-gold/40 hover:bg-white/6', valid ? 'border-white/8 bg-white/4' : 'border-dashed border-white/10 bg-night-950/30')}>
      <div className={cx('grid grid-cols-[1fr_auto_1fr] items-center gap-2', compact ? 'px-2.5 py-2' : 'px-4 py-3')}>
        <span className="flex min-w-0 items-center justify-end gap-2 text-right">
          <span className={cx('truncate text-[13px]', valid && valid.regular.home > valid.regular.away ? 'font-semibold text-white' : 'text-white/75')}>{name(f.homeId)}</span>
          <Flag id={f.homeId} className="w-6" />
        </span>
        <span className={cx('min-w-[3.5rem] rounded-lg px-2 py-0.5 text-center font-display text-lg tabular', valid ? 'bg-night-950/70 text-white' : 'text-white/30')}>
          {valid ? `${valid.regular.home} - ${valid.regular.away}` : 'vs'}
        </span>
        <span className="flex min-w-0 items-center gap-2">
          <Flag id={f.awayId} className="w-6" />
          <span className={cx('truncate text-[13px]', valid && valid.regular.away > valid.regular.home ? 'font-semibold text-white' : 'text-white/75')}>{name(f.awayId)}</span>
        </span>
      </div>
      {!compact && (
        <div className="flex items-center justify-between border-t border-white/5 px-4 py-1.5 text-[11px] text-white/40">
          <span>Jornada {f.matchday}</span>
          {goals.length > 0 && (
            <span className="flex flex-wrap justify-end gap-x-2">
              {goals.slice(0, 6).map((e) => (
                <span key={e.id} className="flex items-center gap-1"><EventGlyph type={e.type} size={12} />{formatMinute(e)}</span>
              ))}
            </span>
          )}
          <span className="flex items-center gap-1 text-gold-light/80 opacity-0 transition group-hover:opacity-100"><Icon name="edit" size={12} /> {valid ? 'Editar' : 'Cargar'}</span>
        </div>
      )}
    </button>
  );
}

function GroupDetail({ g, onOpen, editor, setEditor }: { g: GroupView; onOpen: (f: GroupFixture) => void; editor: EditorTarget | null; setEditor: (e: EditorTarget | null) => void }) {
  const commit = useStore((s) => s.commit);
  const d = useDerived();
  return (
    <div>
      <div className="no-scrollbar -mx-4 mb-5 flex gap-1.5 overflow-x-auto px-4">
        <Button size="sm" variant="ghost" icon="chevronLeft" onClick={() => navigate('groups')}>Todos</Button>
        {d.groups.map((x) => (
          <button key={x.letter} onClick={() => navigate('groups', x.letter)} className={cx('h-9 w-9 shrink-0 rounded-lg font-display text-lg transition', x.index === g.index ? 'bg-gold text-night-950' : x.table.complete ? 'bg-emerald/15 text-emerald-light' : 'bg-white/6 text-white/60 hover:bg-white/12')}>
            {x.letter}
          </button>
        ))}
      </div>
      <SectionHeader
        eyebrow="Group Stage"
        title={`Grupo ${g.letter}`}
        accent="emerald"
        subtitle={`${g.table.played}/6 partidos jugados${g.table.complete ? ' · grupo completo, los dos primeros avanzan a dieciseisavos' : ''}`}
        actions={<Button variant="outline" icon="sparkles" disabled={g.table.complete} onClick={() => commit((t) => simulatePending(t, { kind: 'group', group: g.index }), { label: `Simular grupo ${g.letter}`, celebrate: 'bulk' })}>Simular pendientes</Button>}
      />
      <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <Card className="self-start p-4 sm:p-5">
          <div className="mb-2 flex items-center justify-between">
            <div className="label">Tabla de posiciones</div>
            <div className="flex items-center gap-3 text-[11px] text-white/45">
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-emerald" /> Clasifica</span>
            </div>
          </div>
          <StandingsTable rows={g.table.rows} complete={g.table.complete} />
        </Card>
        <div className="space-y-4">
          {[1, 2, 3].map((md) => (
            <div key={md}>
              <div className="label mb-2">Jornada {md}</div>
              <div className="space-y-2">
                {g.table.fixtures.filter((f) => f.matchday === md).map((f) => (
                  <FixtureRow key={f.id} f={f} onOpen={onOpen} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <MatchEditor target={editor} onClose={() => setEditor(null)} />
    </div>
  );
}

function MatchdayView({ groups, onOpen }: { groups: GroupView[]; onOpen: (f: GroupFixture) => void }) {
  const [md, setMd] = useState(1);
  const fixtures = useMemo(() => groups.flatMap((g) => g.table.fixtures.filter((f) => f.matchday === md)), [groups, md]);
  return (
    <div>
      <Segmented className="mb-4 w-fit" value={String(md)} onChange={(v) => setMd(Number(v))} options={[1, 2, 3].map((n) => ({ value: String(n), label: `Jornada ${n}` }))} />
      <div className="grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
        {fixtures.map((f) => (
          <div key={f.id}>
            <div className="mb-1 font-cond text-[11px] font-bold uppercase tracking-wider text-white/40">Grupo {GROUP_LETTERS[f.group]}</div>
            <FixtureRow f={f} onOpen={onOpen} />
          </div>
        ))}
      </div>
    </div>
  );
}

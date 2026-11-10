import { motion } from 'motion/react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  STAGE_LABEL,
  STAGE_SHORT,
  describeSource,
  formatMinute,
  isGoal,
  simulatePending,
  sortEvents,
  stageMatches,
  totals,
  type KnockoutStage,
  type KOMatchView,
} from '../engine';
import { Flag, Trophy } from '../components/brand';
import { Icon } from '../components/Icon';
import { EventGlyph } from '../components/match';
import { MatchEditor, type EditorTarget } from '../components/MatchEditor';
import { Button, Card, Chip, cx, IconButton, SectionHeader, Segmented } from '../components/ui';
import { navigate } from '../lib/router';
import { useDerived, useStore, useTeamName } from '../store/tournament';
import { confirmDialog, toast } from '../store/ui';

const CARD_W = 184;
const CARD_H = 62;
const GAP_Y = 14;
const COL_GAP = 40;
const CENTER_W = 260;

type Pos = { x: number; y: number };

const COL_LABELS = ['16avos', 'Octavos', 'Cuartos', 'Semis', '', 'Semis', 'Cuartos', 'Octavos', '16avos'];
const colLeft = (i: number) => (i < 4 ? i * (CARD_W + COL_GAP) : i === 4 ? 4 * (CARD_W + COL_GAP) : 4 * (CARD_W + COL_GAP) + CENTER_W + (i - 5) * (CARD_W + COL_GAP) + COL_GAP);

function matchLabel(m: KOMatchView) {
  return m.stage === 'F' || m.stage === '3P' ? STAGE_LABEL[m.stage] : `${STAGE_LABEL[m.stage]} · Partido ${m.index}`;
}

export default function Knockout() {
  const d = useDerived();
  const commit = useStore((s) => s.commit);
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const [view, setView] = useState<'bracket' | 'rounds'>(() => (typeof window !== 'undefined' && window.innerWidth < 1024 ? 'rounds' : 'bracket'));

  const open = (m: KOMatchView) => {
    if (!m.homeId || !m.awayId) {
      toast({ kind: 'info', title: 'Cruce por definir', message: `${describeSource(m.home)} vs ${describeSource(m.away)}` });
      return;
    }
    setEditor({ matchId: m.id, stage: m.stage, homeId: m.homeId, awayId: m.awayId, label: matchLabel(m) });
  };

  const current = (['R32', 'R16', 'QF', 'SF', 'F'] as KnockoutStage[]).find((s) => stageMatches(d, s).some((m) => !m.winnerId && m.homeId && m.awayId));
  const groupsDone = d.progress.groupsComplete === 16;

  const simulate = async (scope: 'stage' | 'all') => {
    const ok = await confirmDialog({
      title: scope === 'stage' ? `Simular ${current ? STAGE_LABEL[current] : 'ronda'}` : 'Simular todas las eliminatorias',
      message: 'Se completarán con resultados aleatorios (basados en tu ranking, con prórroga y penales cuando corresponda) solo los partidos sin resultado. Los resultados existentes no se modifican.',
      confirmLabel: 'Simular',
    });
    if (!ok) return;
    if (scope === 'stage' && current) {
      const stages: KnockoutStage[] = current === 'F' ? ['3P', 'F'] : [current];
      await commit((t) => stages.reduce((acc, s) => simulatePending(acc, { kind: 'stage', stage: s }), t), { label: `Simular ${STAGE_SHORT[current]}`, celebrate: 'bulk' });
    } else await commit((t) => simulatePending(t, { kind: 'knockout' }), { label: 'Simular eliminatorias', celebrate: 'bulk' });
  };

  return (
    <div>
      <SectionHeader
        eyebrow="Knockout Stage · Eliminatorias"
        title="Knockout"
        subtitle="Dieciseisavos, octavos, cuartos, semifinales, tercer puesto y la gran final. Tocá un cruce para cargar el marcador, la prórroga, los penales y el momentum del partido."
        actions={
          <>
            <Segmented value={view} onChange={setView} options={[{ value: 'bracket', label: 'Cuadro' }, { value: 'rounds', label: 'Por rondas' }]} />
            <Button variant="outline" icon="sparkles" disabled={!current} onClick={() => simulate('stage')}>Simular ronda</Button>
            <Button variant="ghost" icon="sparkles" disabled={!groupsDone || !!d.champion} onClick={() => simulate('all')}>Simular todo</Button>
          </>
        }
      />
      {!d.drawn ? (
        <Card className="mb-5 flex items-center justify-between gap-3 p-4">
          <span className="text-sm text-white/70">El cuadro se completa a partir del sorteo y de la fase de grupos.</span>
          <Button size="sm" variant="gold" onClick={() => navigate('draw')}>Ir al sorteo</Button>
        </Card>
      ) : !groupsDone ? (
        <Card className="mb-5 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2 text-sm text-white/70"><Icon name="info" className="text-gold-light" />Los cruces se definen automáticamente cuando cada grupo termina ({d.progress.groupsComplete}/16 completos).</span>
          <Button size="sm" variant="outline" onClick={() => navigate('groups')}>Fase de grupos</Button>
        </Card>
      ) : null}
      {d.knockout.some((m) => m.stale) && (
        <Card className="mb-5 border-crimson/40 p-4 text-sm text-crimson-light">Hay resultados que ya no corresponden a los cruces actuales; se ignoran hasta que los vuelvas a cargar.</Card>
      )}
      {view === 'bracket' ? <Bracket onOpen={open} /> : <Rounds onOpen={open} initial={current ?? 'R32'} />}
      <MatchEditor target={editor} onClose={() => setEditor(null)} />
    </div>
  );
}

/* --------------------------------------------------------------- BRACKET */

function useLayout() {
  return useMemo(() => {
    const pos: Record<string, Pos> = {};
    const colX = (side: 'left' | 'right', depth: number) =>
      side === 'left' ? depth * (CARD_W + COL_GAP) : 4 * (CARD_W + COL_GAP) + CENTER_W + (3 - depth) * (CARD_W + COL_GAP) + COL_GAP;
    const stages: KnockoutStage[] = ['R32', 'R16', 'QF', 'SF'];
    stages.forEach((s, depth) => {
      const per = 8 / 2 ** depth; // matches per side
      for (const side of ['left', 'right'] as const) {
        for (let i = 0; i < per; i++) {
          const index = side === 'left' ? i + 1 : per + i + 1;
          const id = s === 'SF' ? `SF-${side === 'left' ? 1 : 2}` : `${s}-${index}`;
          const span = 2 ** depth;
          const y = (i * span + (span - 1) / 2) * (CARD_H + GAP_Y);
          pos[id] = { x: colX(side, depth), y };
        }
      }
    });
    const height = 8 * (CARD_H + GAP_Y) - GAP_Y;
    const width = 8 * (CARD_W + COL_GAP) + CENTER_W + COL_GAP;
    const cx = 4 * (CARD_W + COL_GAP) + (CENTER_W + COL_GAP) / 2 - 2;
    pos.F = { x: cx - 110, y: height / 2 - 70 };
    pos['3P'] = { x: cx - 92, y: height / 2 + 120 };
    return { pos, width, height };
  }, []);
}

function Bracket({ onOpen }: { onOpen: (m: KOMatchView) => void }) {
  const d = useDerived();
  const { pos, width, height } = useLayout();
  const wrap = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(1);
  const [zoom, setZoom] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setFit(Math.max(0.78, Math.min(1, (el.clientWidth - 8) / width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);
  const scale = zoom ?? fit;

  const lines = d.knockout
    .filter((m) => m.stage !== 'R32' && m.stage !== '3P' && m.stage !== 'F')
    .flatMap((m) => [m.home, m.away].map((src) => (src.kind === 'winner' ? { from: src.matchId, to: m.id } : null)))
    .filter(Boolean) as { from: string; to: string }[];
  lines.push({ from: 'SF-1', to: 'F' }, { from: 'SF-2', to: 'F' });

  return (
    <Card className="relative overflow-hidden p-3 sm:p-5">
      <div className="mb-2 flex justify-end gap-1.5">
        <IconButton icon="zoomOut" label="Alejar" onClick={() => setZoom(Math.max(0.4, (zoom ?? fit) - 0.1))} />
        <IconButton icon="zoomIn" label="Acercar" onClick={() => setZoom(Math.min(1.4, (zoom ?? fit) + 0.1))} />
        {zoom !== null && <Button size="sm" variant="ghost" onClick={() => setZoom(null)}>Ajustar</Button>}
      </div>
      <div ref={wrap} className="overflow-x-auto overflow-y-hidden pb-2">
        <div style={{ width: width * scale, height: (height + 76) * scale }}>
          <div className="relative origin-top-left" style={{ width, height: height + 40, transform: `scale(${scale}) translateY(36px)` }}>
            <svg className="absolute inset-0" width={width} height={height + 40}>
              <defs>
                <linearGradient id="ln" x1="0" x2="1">
                  <stop offset="0" stopColor="#e8b84a" stopOpacity="0.9" />
                  <stop offset="1" stopColor="#e8b84a" stopOpacity="0.5" />
                </linearGradient>
              </defs>
              {lines.map(({ from, to }) => {
                const a = pos[from];
                const b = pos[to];
                const fromRight = a.x < b.x;
                const x1 = fromRight ? a.x + CARD_W : a.x;
                const y1 = a.y + CARD_H / 2;
                const toF = to === 'F';
                const x2 = toF ? (fromRight ? b.x : b.x + 220) : fromRight ? b.x : b.x + CARD_W;
                const y2 = toF ? b.y + 70 : b.y + CARD_H / 2;
                const mx = (x1 + x2) / 2;
                const active = !!d.ko[from]?.winnerId;
                return <path key={from + to} d={`M${x1} ${y1} H${mx} V${y2} H${x2}`} fill="none" stroke={active ? 'url(#ln)' : 'rgba(255,255,255,0.12)'} strokeWidth={active ? 2 : 1.5} />;
              })}
            </svg>
            {COL_LABELS.map((l, i) => (
              <div key={i} className="absolute text-center font-cond text-[12px] font-bold uppercase tracking-[0.2em] text-white/40" style={{ left: colLeft(i), top: -30, width: i === 4 ? CENTER_W : CARD_W }}>
                {l}
              </div>
            ))}
            {d.knockout
              .filter((m) => m.stage !== 'F' && m.stage !== '3P')
              .map((m) => (
                <div key={m.id} className="absolute" style={{ left: pos[m.id].x, top: pos[m.id].y, width: CARD_W, height: CARD_H }}>
                  <BracketCard m={m} onOpen={onOpen} />
                </div>
              ))}
            <div className="absolute flex flex-col items-center" style={{ left: pos.F.x, top: pos.F.y - 170, width: 220 }}>
              <Trophy className="h-36 w-24" />
              {d.champion && (
                <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mt-1 text-center">
                  <div className="label !text-gold-light">Campeón</div>
                </motion.div>
              )}
            </div>
            <div className="absolute" style={{ left: pos.F.x, top: pos.F.y, width: 220 }}>
              <div className="mb-1.5 text-center font-display text-lg uppercase tracking-[0.2em] text-gold-gradient">Gran final</div>
              <BracketCard m={d.ko.F} onOpen={onOpen} big />
            </div>
            <div className="absolute" style={{ left: pos['3P'].x, top: pos['3P'].y, width: CARD_W }}>
              <div className="mb-1.5 text-center font-cond text-xs font-bold uppercase tracking-[0.2em] text-white/50">Tercer puesto</div>
              <BracketCard m={d.ko['3P']} onOpen={onOpen} />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function sideScore(m: KOMatchView, side: 'home' | 'away') {
  if (!m.result) return null;
  const t = totals(m.result);
  return { goals: t[side], pens: m.result.penalties ? m.result.penalties[side] : null };
}

function BracketCard({ m, onOpen, big }: { m: KOMatchView; onOpen: (m: KOMatchView) => void; big?: boolean }) {
  const name = useTeamName();
  const rows: { id?: string; side: 'home' | 'away' }[] = [
    { id: m.homeId, side: 'home' },
    { id: m.awayId, side: 'away' },
  ];
  return (
    <button
      onClick={() => onOpen(m)}
      className={cx(
        'group relative h-full w-full overflow-hidden rounded-xl border text-left transition hover:-translate-y-0.5 hover:border-gold/60',
        big ? 'border-gold/50 bg-gradient-to-b from-night-700 to-night-900 shadow-[0_0_40px_rgba(232,184,74,0.25)]' : 'border-white/10 bg-night-850/90',
        m.stale && 'border-crimson/60',
      )}
      style={big ? { height: 96 } : undefined}
    >
      {rows.map((r, i) => {
        const sc = sideScore(m, r.side);
        const win = !!r.id && m.winnerId === r.id;
        const lose = !!m.winnerId && !win;
        return (
          <div key={i} className={cx('flex items-center gap-2 px-2.5', big ? 'h-12' : 'h-[31px]', i === 0 && 'border-b border-white/6', win && 'bg-gradient-to-r from-gold/20 to-transparent')}>
            {win && <span className="absolute left-0 h-[31px] w-0.5 bg-gold" style={{ top: i === 0 ? 0 : big ? 48 : 31, height: big ? 48 : 31 }} />}
            <Flag id={r.id} className={big ? 'w-8' : 'w-6'} />
            <span className={cx('min-w-0 flex-1 truncate', big ? 'text-[15px]' : 'text-[13px]', !r.id ? 'italic text-white/35' : lose ? 'text-white/45' : 'text-white', win && 'font-semibold')}>
              {r.id ? name(r.id) : describeSource(r.side === 'home' ? m.home : m.away)}
            </span>
            {sc && (
              <span className={cx('flex items-baseline gap-1 font-display tabular', big ? 'text-2xl' : 'text-base', win ? 'text-gold-light' : 'text-white/70')}>
                {sc.goals}
                {sc.pens !== null && <span className="font-cond text-[11px] text-white/50">({sc.pens})</span>}
              </span>
            )}
          </div>
        );
      })}
      {m.result?.extraTime && !m.result.penalties && <span className="absolute right-1 top-1/2 -translate-y-1/2 font-cond text-[9px] text-white/35">pró</span>}
    </button>
  );
}

/* ---------------------------------------------------------------- ROUNDS */

const ROUND_TABS: { value: KnockoutStage; label: string }[] = [
  { value: 'R32', label: '16avos' },
  { value: 'R16', label: 'Octavos' },
  { value: 'QF', label: 'Cuartos' },
  { value: 'SF', label: 'Semis' },
  { value: 'F', label: 'Final' },
];

function Rounds({ onOpen, initial }: { onOpen: (m: KOMatchView) => void; initial: KnockoutStage }) {
  const d = useDerived();
  const [stage, setStage] = useState<KnockoutStage>(initial === '3P' ? 'F' : initial);
  useEffect(() => setStage(initial === '3P' ? 'F' : initial), [initial]);
  const matches = stage === 'F' ? [d.ko.F, d.ko['3P']] : stageMatches(d, stage);
  return (
    <div>
      <Segmented className="mb-4" value={stage} onChange={setStage} options={ROUND_TABS.map((t) => ({ ...t, label: `${t.label} ${stageMatches(d, t.value).filter((m) => m.winnerId).length}/${stageMatches(d, t.value).length + (t.value === 'F' ? 1 : 0)}` }))} />
      <motion.div key={stage} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {matches.map((m) => (
          <RoundCard key={m.id} m={m} onOpen={onOpen} />
        ))}
      </motion.div>
    </div>
  );
}

function RoundCard({ m, onOpen }: { m: KOMatchView; onOpen: (m: KOMatchView) => void }) {
  const name = useTeamName();
  const goals = m.result ? sortEvents(m.result.events).filter(isGoal) : [];
  return (
    <button onClick={() => onOpen(m)} className={cx('glass w-full overflow-hidden rounded-2xl text-left transition hover:!border-gold/50', m.stage === 'F' && '!border-gold/50')}>
      <div className="flex items-center justify-between border-b border-white/6 px-4 py-2">
        <span className="font-cond text-xs font-bold uppercase tracking-[0.16em] text-white/55">{matchLabel(m)}</span>
        {m.winnerId ? <Chip tone="emerald">Jugado</Chip> : m.homeId && m.awayId ? <Chip tone="gold">Por jugar</Chip> : <Chip>Por definir</Chip>}
      </div>
      <div className="space-y-1 px-4 py-3">
        {(['home', 'away'] as const).map((side) => {
          const id = side === 'home' ? m.homeId : m.awayId;
          const sc = sideScore(m, side);
          const win = !!id && m.winnerId === id;
          return (
            <div key={side} className="flex items-center gap-3">
              <Flag id={id} className="w-9" />
              <span className={cx('min-w-0 flex-1 truncate', !id ? 'italic text-white/35' : win ? 'font-semibold' : m.winnerId ? 'text-white/50' : '')}>{id ? name(id) : describeSource(side === 'home' ? m.home : m.away)}</span>
              {win && <Icon name="check" size={16} className="text-gold-light" />}
              {sc && (
                <span className={cx('font-display text-2xl tabular', win ? 'text-gold-light' : 'text-white/70')}>
                  {sc.goals}
                  {sc.pens !== null && <span className="ml-1 font-cond text-sm text-white/50">({sc.pens})</span>}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {(goals.length > 0 || m.result?.extraTime || m.result?.penalties) && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-white/5 px-4 py-2 text-[11px] text-white/50">
          {m.result?.extraTime && <span className="text-gold-light/80">Prórroga</span>}
          {m.result?.penalties && <span className="text-emerald-light/80">Penales {m.result.penalties.home}-{m.result.penalties.away}</span>}
          {goals.slice(0, 8).map((e) => (
            <span key={e.id} className="flex items-center gap-1">
              <Flag id={e.teamId} className="w-3.5" />
              <EventGlyph type={e.type} size={12} />
              {formatMinute(e)}
              {e.player ? ` ${e.player}` : ''}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

import { useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import {
  autoMomentum,
  blockLabel,
  blockOfEvent,
  dominance,
  eventPeriod,
  fitMomentum,
  isGoal,
  momentumBlocks,
  smoothMomentum,
  type MatchResult,
} from '../engine';
import { matchColors } from '../lib/teamColors';
import { useTeamName } from '../store/tournament';
import { Flag } from './brand';
import { Icon } from './Icon';
import { EventGlyph } from './match';
import { Button, cx } from './ui';

interface ChartProps {
  result: MatchResult;
  values: number[];
  height?: number;
  compact?: boolean;
  selected?: number | null;
  /** Painting handlers (editor only). */
  onPaint?: (index: number, value: number, start: boolean) => void;
}

/** Momentum bars: above the line the home team dominates, below the away team. */
export function MomentumBars({ result, values, height = 150, compact, selected, onPaint }: ChartProps) {
  const name = useTeamName();
  const ref = useRef<HTMLDivElement>(null);
  const painting = useRef(false);
  const colors = matchColors(result.homeId, result.awayId);
  const n = values.length;
  const goals = result.events.filter((e) => isGoal(e) && eventPeriod(e) !== 'shootout');
  const reds = result.events.filter((e) => e.type === 'red');

  const handle = (e: RPointerEvent<HTMLDivElement>, start: boolean) => {
    if (!onPaint || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const i = Math.max(0, Math.min(n - 1, Math.floor(((e.clientX - r.left) / r.width) * n)));
    const raw = ((r.top + r.height / 2 - e.clientY) / (r.height / 2)) * 100;
    const v = Math.max(-100, Math.min(100, Math.round(raw / 5) * 5));
    onPaint(i, v, start);
  };

  return (
    <div className="select-none">
      {!compact && (
        <div className="mb-1 flex items-center gap-1.5 text-[11px] text-white/55">
          <Flag id={result.homeId} className="w-4" />
          {name(result.homeId)} domina ↑
        </div>
      )}
      <div
        ref={ref}
        role={onPaint ? 'application' : 'img'}
        aria-label={`Momentum: ${name(result.homeId)} ${dominance(values).home}% · ${name(result.awayId)} ${dominance(values).away}%`}
        className={cx('relative rounded-xl border border-white/8 bg-night-950/60', onPaint && 'cursor-crosshair touch-none')}
        style={{ height }}
        onPointerDown={(e) => {
          if (!onPaint) return;
          painting.current = true;
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          handle(e, true);
        }}
        onPointerMove={(e) => painting.current && handle(e, false)}
        onPointerUp={() => (painting.current = false)}
        onPointerCancel={() => (painting.current = false)}
      >
        {/* half-time and extra-time guides */}
        <div className="pointer-events-none absolute inset-y-1 w-px bg-white/15" style={{ left: `${(9 / n) * 100}%` }} />
        {n > 18 && <div className="pointer-events-none absolute inset-y-0 right-0 rounded-r-xl bg-gold/8" style={{ width: `${(6 / n) * 100}%` }} />}
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-white/25" />
        <div className="pointer-events-none absolute inset-0 flex gap-[2px] px-[2px]">
          {values.map((v, i) => (
            <div key={i} className={cx('relative flex-1', selected === i && 'rounded bg-white/8')} title={`${blockLabel(i)} · ${v === 0 ? 'parejo' : `${name(v > 0 ? result.homeId : result.awayId)} ${Math.abs(v)}`}`}>
              {v > 0 && <div className="absolute inset-x-0 bottom-1/2 rounded-t-[3px] transition-[height] duration-150" style={{ height: `${(v / 100) * 48}%`, background: colors.home }} />}
              {v < 0 && <div className="absolute inset-x-0 top-1/2 rounded-b-[3px] transition-[height] duration-150" style={{ height: `${(-v / 100) * 48}%`, background: colors.away }} />}
            </div>
          ))}
        </div>
        {/* goal and red-card markers */}
        {[...goals, ...reds].map((e) => {
          const b = blockOfEvent(e, n);
          const top = e.teamId === result.homeId;
          return (
            <div key={e.id} className="pointer-events-none absolute -translate-x-1/2" style={{ left: `${((b + 0.5) / n) * 100}%`, [top ? 'top' : 'bottom']: 3 }}>
              <EventGlyph type={e.type} size={compact ? 12 : 16} />
            </div>
          );
        })}
      </div>
      {!compact && (
        <>
          <div className="mt-1 flex justify-between font-cond text-[10px] text-white/35">
            <span>1'</span>
            <span>45'</span>
            <span>90'</span>
            {n > 18 && <span>120'</span>}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-white/55">
            <Flag id={result.awayId} className="w-4" />
            {name(result.awayId)} domina ↓
          </div>
        </>
      )}
    </div>
  );
}

export function DominanceBar({ result, values }: { result: MatchResult; values: number[] }) {
  const name = useTeamName();
  const d = dominance(values);
  const colors = matchColors(result.homeId, result.awayId);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 font-semibold"><Flag id={result.homeId} className="w-5" />{name(result.homeId)} <b className="tabular">{d.home}%</b></span>
        <span className="flex items-center gap-1.5 font-semibold"><b className="tabular">{d.away}%</b> {name(result.awayId)}<Flag id={result.awayId} className="w-5" /></span>
      </div>
      <div className="flex h-2 gap-[2px] overflow-hidden rounded-full">
        <div style={{ width: `${d.home}%`, background: colors.home }} />
        <div style={{ width: `${d.away}%`, background: colors.away }} />
      </div>
    </div>
  );
}

/** Editable momentum: paint with a finger/mouse, auto-generate from events, smooth, reset. */
export function MomentumEditor({ result, knockout, onChange }: { result: MatchResult; knockout: boolean; onChange: (m: number[] | null) => void }) {
  const name = useTeamName();
  const n = momentumBlocks(result, knockout);
  const has = !!result.momentum?.length;
  const values = fitMomentum(result.momentum, n);
  const [selected, setSelected] = useState<number | null>(null);
  const colors = matchColors(result.homeId, result.awayId);

  const set = (i: number, v: number) => {
    const next = values.slice();
    next[i] = v;
    onChange(next);
  };

  if (!has)
    return (
      <div className="rounded-2xl border border-white/10 bg-white/4 p-4">
        <div className="font-cond text-lg font-bold uppercase tracking-wide">Barras de dominio</div>
        <p className="mt-1 text-sm text-white/55">Mostrá quién dominó cada tramo de 5 minutos. Podés generarlas a partir de los goles y tarjetas cargados y después ajustarlas con el dedo, o dibujarlas desde cero.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="gold" size="sm" icon="sparkles" onClick={() => onChange(autoMomentum(result, knockout))}>Generar desde los acontecimientos</Button>
          <Button variant="outline" size="sm" icon="edit" onClick={() => onChange(new Array(n).fill(0))}>Dibujar desde cero</Button>
        </div>
      </div>
    );

  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-white/4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-cond text-lg font-bold uppercase tracking-wide">Barras de dominio</div>
        <span className="text-[11px] text-white/45">Arrastrá sobre el gráfico para dibujar</span>
      </div>
      <DominanceBar result={result} values={values} />
      <MomentumBars
        result={result}
        values={values}
        selected={selected}
        onPaint={(i, v) => {
          setSelected(i);
          set(i, v);
        }}
      />
      {selected !== null && selected < n && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/8 bg-night-950/50 px-3 py-2">
          <span className="font-cond text-sm font-bold uppercase tracking-wide text-gold-light">{blockLabel(selected)}</span>
          <Flag id={result.awayId} className="w-5" />
          <input
            type="range"
            min={-100}
            max={100}
            step={5}
            value={values[selected]}
            onChange={(e) => set(selected, Number(e.target.value))}
            className="min-w-[8rem] flex-1"
            style={{ accentColor: values[selected] >= 0 ? colors.home : colors.away }}
            aria-label={`Dominio en ${blockLabel(selected)}`}
          />
          <Flag id={result.homeId} className="w-5" />
          <span className="w-28 text-right text-xs text-white/60">
            {values[selected] === 0 ? 'Parejo' : `${name(values[selected] > 0 ? result.homeId : result.awayId)} ${Math.abs(values[selected])}`}
          </span>
          <button className="rounded-lg p-1 text-white/50 hover:bg-white/10 hover:text-white" onClick={() => setSelected(null)} aria-label="Cerrar ajuste fino">
            <Icon name="x" size={16} />
          </button>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" icon="sparkles" onClick={() => onChange(autoMomentum(result, knockout))}>Regenerar</Button>
        <Button size="sm" variant="ghost" onClick={() => onChange(smoothMomentum(values))}>Suavizar</Button>
        <Button size="sm" variant="ghost" icon="swap" onClick={() => onChange(values.map((v) => -v))}>Invertir</Button>
        <Button size="sm" variant="ghost" onClick={() => onChange(new Array(n).fill(0))}>Parejo</Button>
        <Button size="sm" variant="ghost" icon="trash" onClick={() => { setSelected(null); onChange(null); }}>Quitar barras</Button>
      </div>
    </div>
  );
}

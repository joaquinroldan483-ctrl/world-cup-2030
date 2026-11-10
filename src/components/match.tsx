import { motion } from 'motion/react';
import { TEAM_BY_ID, eventPeriod, formatMinute, isGoal, sortEvents, type EventType, type MatchEvent, type MatchResult } from '../engine';
import { useTeamName } from '../store/tournament';
import { Flag } from './brand';
import { Icon } from './Icon';
import { cx } from './ui';

export function EventGlyph({ type, size = 22 }: { type: EventType; size?: number }) {
  const s = { width: size, height: size };
  const base = 'inline-flex shrink-0 items-center justify-center rounded-full font-cond font-extrabold';
  switch (type) {
    case 'goal':
      return <span className={cx(base, 'bg-white text-night-950')} style={s}><Icon name="ball" size={size * 0.78} strokeWidth={2} /></span>;
    case 'et_goal':
      return <span className={cx(base, 'bg-gold text-night-950')} style={s}><Icon name="ball" size={size * 0.78} strokeWidth={2} /></span>;
    case 'penalty_goal':
      return <span className={cx(base, 'bg-emerald text-white')} style={{ ...s, fontSize: size * 0.55 }}>P</span>;
    case 'penalty_miss':
      return <span className={cx(base, 'bg-crimson-dark text-crimson-light ring-1 ring-crimson')} style={{ ...s, fontSize: size * 0.55 }}>P</span>;
    case 'own_goal':
      return <span className={cx(base, 'bg-crimson text-white')} style={s}><Icon name="ball" size={size * 0.78} strokeWidth={2} /></span>;
    case 'yellow':
      return <span className="inline-block shrink-0 rounded-[3px] bg-[#ffd400] shadow" style={{ width: size * 0.62, height: size * 0.85 }} />;
    case 'red':
      return <span className="inline-block shrink-0 rounded-[3px] bg-[#e11d2e] shadow" style={{ width: size * 0.62, height: size * 0.85 }} />;
    case 'sub':
      return <span className={cx(base, 'bg-sky/25 text-sky')} style={s}><Icon name="swap" size={size * 0.7} /></span>;
    case 'shootout_scored':
      return <span className={cx(base, 'bg-emerald text-white')} style={s}><Icon name="check" size={size * 0.7} strokeWidth={3} /></span>;
    case 'shootout_missed':
      return <span className={cx(base, 'bg-crimson text-white')} style={s}><Icon name="x" size={size * 0.7} strokeWidth={3} /></span>;
  }
}

/** Visual match timeline: home events above, away events below. */
export function MatchTimeline({ result, compact }: { result: MatchResult; compact?: boolean }) {
  const name = useTeamName();
  const events = sortEvents(result.events).filter((e) => eventPeriod(e) !== 'shootout');
  const shoot = sortEvents(result.events).filter((e) => eventPeriod(e) === 'shootout');
  const hasExtra = !!result.extraTime || events.some((e) => eventPeriod(e) === 'extra');
  const max = hasExtra ? 120 : 90;
  const pos = (e: MatchEvent) => Math.min(100, ((Math.min(e.minute, max) + Math.min(e.added ?? 0, 6) * 0.25) / max) * 100);
  const ticks = hasExtra ? [0, 15, 30, 45, 60, 75, 90, 105, 120] : [0, 15, 30, 45, 60, 75, 90];
  const home = TEAM_BY_ID[result.homeId];
  const away = TEAM_BY_ID[result.awayId];
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto pb-1">
        <div className={cx('relative', compact ? 'h-24 min-w-[420px]' : 'h-32 min-w-[520px]')}>
          <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-white/8">
            <div className="absolute inset-y-0 left-0" style={{ width: `${(45 / max) * 100}%`, background: `linear-gradient(90deg, ${home?.color}66, ${away?.color}44)` }} />
            <div className="absolute inset-y-0" style={{ left: `${(45 / max) * 100}%`, width: `${(45 / max) * 100}%`, background: `linear-gradient(90deg, ${away?.color}44, ${home?.color}66)` }} />
            {hasExtra && <div className="absolute inset-y-0 right-0 bg-gold/40" style={{ width: `${(30 / max) * 100}%` }} />}
          </div>
          {ticks.map((m) => (
            <div key={m} className="absolute top-1/2 -translate-x-1/2" style={{ left: `${(m / max) * 100}%` }}>
              <div className={cx('mx-auto w-px -translate-y-1/2', m === 45 || m === 90 ? 'h-5 bg-white/40' : 'h-2.5 bg-white/20')} />
              <div className="mt-1 whitespace-nowrap text-center font-cond text-[10px] text-white/35" style={{ transform: 'translateY(8px)' }}>{`${m}'`}</div>
            </div>
          ))}
          {events.map((e, i) => {
            const top = e.teamId === result.homeId;
            return (
              <motion.div
                key={e.id}
                initial={{ opacity: 0, y: top ? -8 : 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="group absolute -translate-x-1/2"
                style={{ left: `${pos(e)}%`, [top ? 'bottom' : 'top']: 'calc(50% + 10px)' }}
                title={`${formatMinute(e)} ${name(e.teamId)}${e.player ? ' · ' + e.player : ''}`}
              >
                <div className={cx('flex flex-col items-center gap-0.5', !top && 'flex-col-reverse')}>
                  <span className="font-cond text-[10px] font-bold text-white/60">{formatMinute(e)}</span>
                  <EventGlyph type={e.type} size={compact ? 18 : 22} />
                </div>
              </motion.div>
            );
          })}
          <div className="absolute left-0 top-0 flex items-center gap-1.5 text-[11px] text-white/50"><Flag id={result.homeId} className="w-4" />{name(result.homeId)}</div>
          <div className="absolute bottom-0 left-0 flex items-center gap-1.5 text-[11px] text-white/50"><Flag id={result.awayId} className="w-4" />{name(result.awayId)}</div>
        </div>
      </div>
      {shoot.length > 0 && (
        <div className="rounded-xl border border-white/8 bg-night-950/40 p-3">
          <div className="label mb-2">Tanda de penales</div>
          {[result.homeId, result.awayId].map((id) => (
            <div key={id} className="flex items-center gap-2 py-1">
              <Flag id={id} className="w-6" />
              <span className="w-24 truncate text-xs text-white/70">{name(id)}</span>
              <div className="flex flex-wrap gap-1">
                {shoot.filter((e) => e.teamId === id).map((e) => <EventGlyph key={e.id} type={e.type} size={18} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Ordered list of key events with running score. */
export function EventList({ result, highlightTeam, onEdit, onDelete }: { result: MatchResult; highlightTeam?: string; onEdit?: (e: MatchEvent) => void; onDelete?: (e: MatchEvent) => void }) {
  const name = useTeamName();
  let h = 0;
  let a = 0;
  const rows = sortEvents(result.events);
  if (!rows.length) return <p className="py-4 text-center text-sm text-white/40">Sin acontecimientos registrados.</p>;
  return (
    <ul className="divide-y divide-white/5">
      {rows.map((e) => {
        let running: string | null = null;
        if (isGoal(e) && eventPeriod(e) !== 'shootout') {
          if (e.teamId === result.homeId) h++;
          else if (e.teamId === result.awayId) a++;
          running = `${h}-${a}`;
        }
        const mine = highlightTeam ? e.teamId === highlightTeam : true;
        return (
          <li key={e.id} className={cx('flex items-center gap-3 py-2', !mine && 'opacity-55')}>
            <span className="w-12 shrink-0 text-right font-cond text-sm font-bold tabular text-gold-light">{formatMinute(e)}</span>
            <EventGlyph type={e.type} />
            <Flag id={e.teamId} className="w-6" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm">
                <span className="font-semibold">{e.player || name(e.teamId)}</span>
                <span className="text-white/45"> · {EVENT_SHORT[e.type]}</span>
              </div>
              {e.description && <div className="truncate text-xs text-white/45">{e.description}</div>}
            </div>
            {running && <span className="rounded-md bg-white/8 px-2 py-0.5 font-display text-sm tabular">{running}</span>}
            {onEdit && (
              <button className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white" onClick={() => onEdit(e)} aria-label="Editar">
                <Icon name="edit" size={16} />
              </button>
            )}
            {onDelete && (
              <button className="rounded-lg p-1.5 text-white/50 hover:bg-crimson/20 hover:text-crimson-light" onClick={() => onDelete(e)} aria-label="Eliminar">
                <Icon name="trash" size={16} />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export const EVENT_SHORT: Record<EventType, string> = {
  goal: 'Gol',
  penalty_goal: 'Gol de penal',
  penalty_miss: 'Penal errado',
  own_goal: 'Autogol',
  yellow: 'Amarilla',
  red: 'Roja',
  sub: 'Cambio',
  et_goal: 'Gol en prórroga',
  shootout_scored: 'Tanda · convertido',
  shootout_missed: 'Tanda · errado',
};

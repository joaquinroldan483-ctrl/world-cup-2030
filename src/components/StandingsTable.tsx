import { motion } from 'motion/react';
import type { StandingRow } from '../engine';
import { useTeamName } from '../store/tournament';
import { Flag } from './brand';
import { cx } from './ui';
import { navigate } from '../lib/router';

export function StandingsTable({ rows, complete, compact }: { rows: StandingRow[]; complete: boolean; compact?: boolean }) {
  const name = useTeamName();
  const cols = compact ? ['PJ', 'DG', 'PTS'] : ['PJ', 'PG', 'PE', 'PP', 'GF', 'GC', 'DG', 'PTS'];
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-0 text-sm">
        <thead>
          <tr className="font-cond text-[11px] uppercase tracking-[0.12em] text-white/40">
            <th className="w-7 py-1.5 text-left font-bold">#</th>
            <th className="py-1.5 text-left font-bold">Selección</th>
            {cols.map((c) => (
              <th key={c} className={cx('w-8 py-1.5 text-center font-bold', c === 'PTS' && 'text-gold-light', !compact && ['PG', 'PE', 'PP', 'GF', 'GC'].includes(c) && 'hidden sm:table-cell')}>
                {c}
              </th>
            ))}
            {!compact && <th className="hidden w-24 py-1.5 text-center font-bold md:table-cell">Forma</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const q = r.status === 'qualified';
            const e = r.status === 'eliminated';
            const inZone = r.position <= 2;
            const vals: Record<string, number | string> = {
              PJ: r.played,
              PG: r.won,
              PE: r.drawn,
              PP: r.lost,
              GF: r.goalsFor,
              GC: r.goalsAgainst,
              DG: r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff,
              PTS: r.points,
            };
            return (
              <motion.tr layout key={r.teamId} transition={{ type: 'spring', damping: 26, stiffness: 300 }} className={cx('border-t border-white/5', e && 'opacity-50')}>
                <td className="py-2">
                  <span className={cx('flex h-6 w-6 items-center justify-center rounded-md font-cond text-xs font-bold', inZone ? (q ? 'bg-emerald text-white' : 'bg-emerald/20 text-emerald-light') : 'bg-white/6 text-white/50')}>{r.position}</span>
                </td>
                <td className="max-w-0 py-2">
                  <button className="flex w-full min-w-0 items-center gap-2 text-left hover:text-gold-light" onClick={() => navigate('road', r.teamId)}>
                    <Flag id={r.teamId} className="w-6" />
                    <span className="truncate font-medium">{name(r.teamId)}</span>
                    {q && <span className="shrink-0 rounded bg-emerald/20 px-1 font-cond text-[10px] font-bold uppercase text-emerald-light">{complete ? 'Clasif.' : 'Asegurado'}</span>}
                    {e && !complete && <span className="shrink-0 rounded bg-crimson/20 px-1 font-cond text-[10px] font-bold uppercase text-crimson-light">Elim.</span>}
                  </button>
                </td>
                {cols.map((c) => (
                  <td key={c} className={cx('py-2 text-center tabular', c === 'PTS' ? 'font-display text-base text-white' : 'text-white/70', !compact && ['PG', 'PE', 'PP', 'GF', 'GC'].includes(c) && 'hidden sm:table-cell')}>
                    {vals[c]}
                  </td>
                ))}
                {!compact && (
                  <td className="hidden py-2 md:table-cell">
                    <div className="flex justify-center gap-1">
                      {[0, 1, 2].map((i) => {
                        const f = r.form[i];
                        return <span key={i} className={cx('h-5 w-5 rounded text-center font-cond text-[11px] font-bold leading-5', f === 'W' ? 'bg-emerald text-white' : f === 'D' ? 'bg-white/25 text-white' : f === 'L' ? 'bg-crimson text-white' : 'bg-white/5 text-white/20')}>{f === 'W' ? 'G' : f === 'D' ? 'E' : f === 'L' ? 'P' : '·'}</span>;
                      })}
                    </div>
                  </td>
                )}
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

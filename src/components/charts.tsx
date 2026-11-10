import { motion } from 'motion/react';
import { useState, type ReactNode } from 'react';
import { cx } from './ui';

/** Horizontal bars (single series, magnitude). Hover reveals an exact-value tooltip. */
export function BarList({ data, format = (v) => String(v), color = '#d9a93f' }: { data: { key: string; label: ReactNode; value: number; hint?: string }[]; format?: (v: number) => string; color?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const [hover, setHover] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      {data.map((d, i) => (
        <div key={d.key} className="group relative" onMouseEnter={() => setHover(d.key)} onMouseLeave={() => setHover(null)}>
          <div className="mb-1 flex items-center justify-between gap-2 text-[13px]">
            <span className="min-w-0 truncate text-white/80">{d.label}</span>
            <span className="tabular font-semibold text-white">{format(d.value)}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-white/6">
            <motion.div
              className="h-full rounded-r-[4px]"
              style={{ background: color, opacity: hover && hover !== d.key ? 0.45 : 1 }}
              initial={{ width: 0 }}
              whileInView={{ width: `${(d.value / max) * 100}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: i * 0.03 }}
            />
          </div>
          {hover === d.key && d.hint && <div className="glass-strong absolute right-0 top-full z-10 mt-1 rounded-lg px-2.5 py-1.5 text-xs text-white/80">{d.hint}</div>}
        </div>
      ))}
    </div>
  );
}

/** Vertical columns (single series). */
export function Columns({ data, color = '#d9a93f', height = 170 }: { data: { key: string; label: string; value: number; hint?: string }[]; color?: string; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div>
      <div className="relative flex items-end gap-2" style={{ height }}>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <div key={f} className="pointer-events-none absolute inset-x-0 border-t border-white/5" style={{ bottom: f * (height - 22) }} />
        ))}
        {data.map((d, i) => (
          <div key={d.key} className="relative flex h-full flex-1 flex-col justify-end" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <div className="mb-1 text-center font-cond text-xs font-bold tabular text-white/70">{d.value}</div>
            <motion.div
              className="w-full rounded-t-[4px]"
              style={{ background: color, opacity: hover !== null && hover !== i ? 0.45 : 1 }}
              initial={{ height: 0 }}
              whileInView={{ height: `${(d.value / max) * (height - 22)}px` }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: i * 0.05 }}
            />
            {hover === i && d.hint && <div className="glass-strong absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs">{d.hint}</div>}
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2 border-t border-white/10 pt-1.5">
        {data.map((d) => (
          <div key={d.key} className="flex-1 truncate text-center font-cond text-[11px] font-semibold uppercase tracking-wide text-white/50">{d.label}</div>
        ))}
      </div>
    </div>
  );
}

/** Part-to-whole stacked bar with direct labels and a legend (3 categories max). */
export function StackBar({ parts }: { parts: { key: string; label: string; value: number; color: string }[] }) {
  const total = parts.reduce((n, p) => n + p.value, 0) || 1;
  return (
    <div>
      <div className="flex h-10 gap-[2px] overflow-hidden rounded-[6px]">
        {parts.map((p) => (
          <motion.div
            key={p.key}
            title={`${p.label}: ${p.value} (${Math.round((p.value / total) * 100)}%)`}
            className="flex items-center justify-center overflow-hidden font-cond text-sm font-bold text-white"
            style={{ background: p.color }}
            initial={{ width: 0 }}
            whileInView={{ width: `${(p.value / total) * 100}%` }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            {p.value / total > 0.08 && `${Math.round((p.value / total) * 100)}%`}
          </motion.div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
        {parts.map((p) => (
          <span key={p.key} className="flex items-center gap-2 text-[13px] text-white/75">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
            {p.label} <b className="tabular text-white">{p.value}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

export function KPI({ label, value, sub, accent }: { label: string; value: ReactNode; sub?: ReactNode; accent?: boolean }) {
  return (
    <div className={cx('glass rounded-2xl p-4', accent && '!border-gold/40')}>
      <div className="label">{label}</div>
      <div className={cx('mt-1 font-display text-4xl tabular', accent ? 'text-gold-gradient' : 'text-white')}>{value}</div>
      {sub && <div className="mt-0.5 truncate text-xs text-white/50">{sub}</div>}
    </div>
  );
}

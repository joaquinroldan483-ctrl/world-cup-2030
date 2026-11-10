import { AnimatePresence, motion } from 'motion/react';
import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { sound } from '../lib/sound';

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

type Variant = 'primary' | 'gold' | 'ghost' | 'outline' | 'danger' | 'emerald' | 'subtle';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-gradient-to-b from-crimson-light to-crimson text-white shadow-[0_10px_30px_-10px_rgba(225,29,46,0.8)] hover:brightness-110',
  gold: 'bg-gradient-to-b from-gold-light via-gold to-gold-dark text-night-950 shadow-[0_10px_30px_-10px_rgba(232,184,74,0.75)] hover:brightness-110',
  emerald: 'bg-gradient-to-b from-emerald-light to-emerald-dark text-white shadow-[0_10px_30px_-12px_rgba(16,178,108,0.8)] hover:brightness-110',
  ghost: 'text-white/80 hover:text-white hover:bg-white/8',
  subtle: 'bg-white/7 text-white hover:bg-white/12 border border-white/8',
  outline: 'border border-white/18 text-white hover:border-gold/70 hover:text-gold-light',
  danger: 'bg-crimson-dark/50 border border-crimson/50 text-crimson-light hover:bg-crimson-dark/80',
};

export function Button({
  variant = 'subtle',
  size = 'md',
  icon,
  iconRight,
  children,
  className,
  onClick,
  silent,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  icon?: IconName;
  iconRight?: IconName;
  silent?: boolean;
}) {
  const sz = size === 'sm' ? 'h-9 px-3 text-[13px] gap-1.5' : size === 'lg' ? 'h-13 px-6 text-base gap-2.5' : 'h-11 px-4 text-sm gap-2';
  return (
    <button
      type="button"
      className={cx(
        'inline-flex select-none items-center justify-center rounded-xl font-cond font-bold uppercase tracking-[0.08em] transition-all duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40',
        sz,
        VARIANTS[variant],
        className,
      )}
      onClick={(e) => {
        if (!silent) sound.click();
        onClick?.(e);
      }}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === 'sm' ? 16 : 18} />}
    </button>
  );
}

export function IconButton({ icon, label, className, active, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/8 bg-white/5 text-white/80 transition hover:bg-white/12 hover:text-white active:scale-95 disabled:opacity-30 disabled:pointer-events-none',
        active && 'border-gold/60 bg-gold/15 text-gold-light',
        className,
      )}
      {...rest}
    >
      <Icon name={icon} size={18} />
    </button>
  );
}

export function Card({ children, className, strong }: { children: ReactNode; className?: string; strong?: boolean }) {
  return <div className={cx(strong ? 'glass-strong' : 'glass', 'rounded-2xl', className)}>{children}</div>;
}

export function Chip({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'gold' | 'emerald' | 'crimson' | 'sky'; className?: string }) {
  const tones = {
    neutral: 'bg-white/8 text-white/75 border-white/10',
    gold: 'bg-gold/15 text-gold-light border-gold/35',
    emerald: 'bg-emerald/15 text-emerald-light border-emerald/35',
    crimson: 'bg-crimson/15 text-crimson-light border-crimson/40',
    sky: 'bg-sky/12 text-sky border-sky/30',
  };
  return (
    <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 font-cond text-[11px] font-bold uppercase tracking-[0.12em]', tones[tone], className)}>
      {children}
    </span>
  );
}

export function SectionHeader({ eyebrow, title, subtitle, actions, accent = 'gold' }: { eyebrow: string; title: string; subtitle?: ReactNode; actions?: ReactNode; accent?: 'gold' | 'crimson' | 'emerald' }) {
  const bar = accent === 'gold' ? 'from-gold to-gold-dark' : accent === 'crimson' ? 'from-crimson-light to-crimson' : 'from-emerald-light to-emerald';
  return (
    <motion.header initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.2, 0.7, 0.2, 1] }} className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <div className="mb-2 flex items-center gap-3">
          <span className={cx('h-1 w-10 rounded-full bg-gradient-to-r', bar)} />
          <span className="label !text-white/70">{eyebrow}</span>
        </div>
        <h1 className="font-display text-[2.6rem] leading-[0.92] tracking-wide text-white uppercase sm:text-6xl">{title}</h1>
        {subtitle && <p className="mt-3 max-w-2xl text-sm text-white/60 md:text-[15px]">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </motion.header>
  );
}

export function Modal({
  open,
  onClose,
  children,
  title,
  wide,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: ReactNode;
  wide?: boolean;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-night-950/75 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal
            className={cx(
              'glass-strong relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl',
              wide ? 'sm:max-w-4xl' : 'sm:max-w-lg',
            )}
            initial={{ y: 60, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 60, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
          >
            <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-white/20 sm:hidden" />
            {title !== undefined && (
              <div className="flex items-center justify-between gap-3 border-b border-white/8 px-5 py-4">
                <div className="min-w-0 font-display text-xl uppercase tracking-wide">{title}</div>
                <IconButton icon="x" label="Cerrar" onClick={onClose} />
              </div>
            )}
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5">{children}</div>
            {footer && <div className="border-t border-white/8 bg-night-950/40 px-5 py-4 pb-[calc(1rem+var(--safe-bottom))]">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Stepper({ value, onChange, min = 0, max = 99, size = 'md', label }: { value: number; onChange: (v: number) => void; min?: number; max?: number; size?: 'sm' | 'md' | 'lg'; label?: string }) {
  const btn = size === 'lg' ? 'h-12 w-12' : size === 'sm' ? 'h-8 w-8' : 'h-10 w-10';
  const box = size === 'lg' ? 'h-16 w-16 text-5xl' : size === 'sm' ? 'h-9 w-10 text-xl' : 'h-12 w-12 text-3xl';
  return (
    <div className="flex items-center gap-1.5" aria-label={label}>
      <button type="button" aria-label="Restar" className={cx(btn, 'flex items-center justify-center rounded-xl bg-white/6 text-white/70 transition hover:bg-white/14 active:scale-90 disabled:opacity-30')} disabled={value <= min} onClick={() => { sound.click(); onChange(Math.max(min, value - 1)); }}>
        <Icon name="minus" size={16} />
      </button>
      <input
        inputMode="numeric"
        aria-label={label}
        className={cx(box, 'tabular rounded-xl border border-white/10 bg-night-950/60 text-center font-display text-white outline-none focus:border-gold/70')}
        value={value}
        onChange={(e) => {
          const n = parseInt(e.target.value.replace(/\D/g, ''), 10);
          onChange(Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min);
        }}
        onFocus={(e) => e.target.select()}
      />
      <button type="button" aria-label="Sumar" className={cx(btn, 'flex items-center justify-center rounded-xl bg-white/6 text-white/70 transition hover:bg-white/14 active:scale-90 disabled:opacity-30')} disabled={value >= max} onClick={() => { sound.click(); onChange(Math.min(max, value + 1)); }}>
        <Icon name="plus" size={16} />
      </button>
    </div>
  );
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; description?: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-2">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-white">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-white/50">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => { sound.click(); onChange(!checked); }}
        className={cx('relative mt-0.5 h-7 w-12 shrink-0 rounded-full border transition', checked ? 'border-emerald/60 bg-emerald/70' : 'border-white/15 bg-white/10')}
      >
        <span className={cx('absolute top-0.5 h-5.5 w-5.5 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
      </button>
    </label>
  );
}

export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; className?: string }) {
  return (
    <div className={cx('no-scrollbar flex gap-1 overflow-x-auto rounded-xl border border-white/8 bg-night-950/50 p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => { sound.click(); onChange(o.value); }}
          className={cx(
            'relative shrink-0 rounded-lg px-3 py-2 font-cond text-[13px] font-bold uppercase tracking-[0.08em] transition',
            value === o.value ? 'text-night-950' : 'text-white/65 hover:text-white',
          )}
        >
          {value === o.value && <motion.span layoutId={`seg-${options.map((x) => x.value).join('')}`} className="absolute inset-0 rounded-lg bg-gradient-to-b from-gold-light to-gold" transition={{ type: 'spring', damping: 28, stiffness: 380 }} />}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function TextInput({ label, className, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <label className={cx('block', className)}>
      {label && <span className="label mb-1.5 block">{label}</span>}
      <input
        className="h-11 w-full rounded-xl border border-white/10 bg-night-950/60 px-3.5 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-gold/60"
        {...rest}
      />
    </label>
  );
}

export function Select<T extends string>({ label, value, onChange, options, className }: { label?: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; className?: string }) {
  return (
    <label className={cx('block', className)}>
      {label && <span className="label mb-1.5 block">{label}</span>}
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
          className="h-11 w-full appearance-none rounded-xl border border-white/10 bg-night-900 pl-3.5 pr-9 text-sm text-white outline-none focus:border-gold/60"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Icon name="chevronDown" size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/50" />
      </div>
    </label>
  );
}

export function EmptyState({ icon, title, message, action }: { icon: IconName; title: string; message: ReactNode; action?: ReactNode }) {
  return (
    <Card className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-gold/30 bg-gold/10 text-gold-light">
        <Icon name={icon} size={30} />
      </div>
      <h3 className="font-display text-2xl uppercase tracking-wide">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-white/60">{message}</p>
      {action && <div className="mt-6 flex flex-wrap justify-center gap-2">{action}</div>}
    </Card>
  );
}

export function ProgressBar({ value, className, tone = 'gold' }: { value: number; className?: string; tone?: 'gold' | 'emerald' | 'crimson' }) {
  const bg = tone === 'gold' ? 'from-gold-dark via-gold to-gold-light' : tone === 'emerald' ? 'from-emerald-dark to-emerald-light' : 'from-crimson-dark to-crimson-light';
  return (
    <div className={cx('h-1.5 overflow-hidden rounded-full bg-white/8', className)}>
      <motion.div className={cx('h-full rounded-full bg-gradient-to-r', bg)} initial={false} animate={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }} transition={{ duration: 0.6 }} />
    </div>
  );
}

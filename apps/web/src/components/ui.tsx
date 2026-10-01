import { AnimatePresence, motion } from 'motion/react';
import { clsx } from 'clsx';
import { X, Loader2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react';

export const cx = clsx;

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'live';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
};

export function Button({ variant = 'secondary', size = 'md', loading, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cx(
        'relative inline-flex items-center justify-center gap-2 rounded-full font-semibold transition active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none select-none whitespace-nowrap',
        {
          primary: 'bg-brand text-white shadow-glow-pink hover:brightness-110',
          secondary: 'bg-surface-2 text-fg border border-line hover:bg-surface-3 hover:border-line-strong',
          ghost: 'text-muted hover:text-fg hover:bg-white/5',
          danger: 'bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25',
          live: 'bg-live text-ink hover:brightness-110 shadow-[0_8px_30px_-8px_rgb(62_229_143/0.6)]',
        }[variant],
        { sm: 'h-8 px-3 text-xs', md: 'h-10 px-4 text-sm', lg: 'h-12 px-6 text-base', icon: 'h-10 w-10' }[size],
        className,
      )}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Card({ className, children, glow }: { className?: string; children: ReactNode; glow?: 'pink' | 'cyan' }) {
  return (
    <div
      className={cx(
        'rounded-3xl border border-line bg-surface/80 shadow-card',
        glow === 'pink' && 'shadow-glow-pink',
        glow === 'cyan' && 'shadow-glow-cyan',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Section({ title, action, children, className, icon }: { title: ReactNode; action?: ReactNode; children: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <section className={cx('space-y-3', className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          {icon}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Pill({ children, tone = 'default', className }: { children: ReactNode; tone?: 'default' | 'live' | 'pink' | 'cyan' | 'gold' | 'violet' | 'muted'; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap',
        {
          default: 'bg-white/8 text-fg',
          live: 'bg-live/15 text-live',
          pink: 'bg-pink/15 text-pink',
          cyan: 'bg-cyan/15 text-cyan',
          gold: 'bg-gold/15 text-gold',
          violet: 'bg-violet/20 text-violet',
          muted: 'bg-white/5 text-muted',
        }[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function LiveDot({ className, color = 'bg-live' }: { className?: string; color?: string }) {
  return (
    <span className={cx('relative inline-flex size-2.5', className)}>
      <span className={cx('absolute inset-0 rounded-full animate-pulse-ring', color)} />
      <span className={cx('relative inline-flex size-2.5 rounded-full', color)} />
    </span>
  );
}

export function Chip({ active, onClick, children, icon }: { active?: boolean; onClick?: () => void; children: ReactNode; icon?: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition whitespace-nowrap',
        active ? 'border-transparent bg-fg text-ink' : 'border-line bg-surface-2/70 text-muted hover:text-fg hover:border-line-strong',
      )}
    >
      {icon}
      {children}
    </button>
  );
}

export function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cx('relative h-7 w-12 shrink-0 rounded-full transition', on ? 'bg-brand' : 'bg-surface-3', disabled && 'opacity-50')}
    >
      <motion.span layout transition={{ type: 'spring', stiffness: 600, damping: 35 }} className={cx('absolute top-1 size-5 rounded-full bg-white shadow', on ? 'right-1' : 'left-1')} />
    </button>
  );
}

export function Segmented<T extends string>({ value, options, onChange, size = 'md' }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; size?: 'sm' | 'md' }) {
  return (
    <div className={cx('inline-flex rounded-full bg-surface-2 p-1 border border-line', size === 'sm' && 'text-xs')}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cx('relative rounded-full font-medium transition', size === 'sm' ? 'px-2.5 py-1' : 'px-3.5 py-1.5 text-sm', value === o.value ? 'text-ink' : 'text-muted hover:text-fg')}
        >
          {value === o.value && <motion.span layoutId={`seg-${options.map((x) => x.value).join()}`} className="absolute inset-0 rounded-full bg-fg" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-line px-6 py-10 text-center">
      <div className="mb-3 grid size-12 place-items-center rounded-2xl bg-surface-2 text-2xl text-muted">{icon}</div>
      <p className="font-semibold">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx('size-5 animate-spin text-muted', className)} />;
}

export function PageLoader() {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <div className="flex flex-col items-center gap-3 text-muted">
        <div className="size-10 rounded-full bg-brand animate-spin [mask:radial-gradient(farthest-side,transparent_calc(100%-4px),#000_calc(100%-3px))]" />
        <span className="text-sm">Warming up the mic…</span>
      </div>
    </div>
  );
}

/** Bottom sheet on phones, centered dialog on larger screens. */
export function Sheet({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6">
          <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 36 }}
            className={cx('relative flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-line bg-night shadow-2xl sm:rounded-3xl pb-safe', wide ? 'sm:max-w-2xl' : 'sm:max-w-lg')}
          >
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-white/15 sm:hidden" />
            <div className="flex items-center justify-between gap-4 px-5 pt-3 pb-2 sm:pt-5">
              <div className="text-lg font-bold font-display">{title}</div>
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
                <X className="size-5" />
              </Button>
            </div>
            <div className="overflow-y-auto px-5 pb-6">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function Stat({ label, value, sub, accent }: { label: string; value: ReactNode; sub?: ReactNode; accent?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface-2/60 p-4">
      <div className="text-xs font-medium uppercase tracking-wider text-muted">{label}</div>
      <div className={cx('mt-1 font-display text-3xl font-bold', accent)}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

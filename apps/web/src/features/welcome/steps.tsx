import { motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Disc3, Mail, MailCheck, Mic2, Store } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button, cx } from '~/components/ui';

/** Shared role picker and card; the email/code steps below are for the local demo. */
export type Role = 'singer' | 'kj' | 'venue';

export const ROLES: { role: Role; icon: typeof Mic2; color: string; label: string; blurb: string }[] = [
  { role: 'singer', icon: Mic2, color: 'from-pink to-violet', label: 'Singer', blurb: 'Find tonight’s best karaoke, check in, send songs to the KJ, and collect badges and venue coupons.' },
  { role: 'kj', icon: Disc3, color: 'from-violet to-cyan', label: 'KJ', blurb: 'Upload your song book so singers know what you’ve got, accept song submissions, list your venues and promote your nights.' },
  { role: 'venue', icon: Store, color: 'from-cyan to-live', label: 'Venue', blurb: 'Post events and drink specials, reward singers with coupons, rate your KJs and see who’s going.' },
];

export function RolePicker({ onPick, children }: { onPick: (role: Role) => void; children?: ReactNode }) {
  return (
    <motion.div key="role" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
      <h2 className="mb-4 text-sm font-semibold tracking-widest text-faint uppercase">I am a…</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {ROLES.map((p, i) => (
          <motion.button
            key={p.role}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * 0.07 }}
            whileHover={{ y: -4 }}
            onClick={() => onPick(p.role)}
            className="group relative overflow-hidden rounded-3xl border border-line bg-surface/80 p-6 text-left shadow-card transition hover:border-line-strong"
          >
            <div className={cx('absolute -top-16 -right-16 size-48 rounded-full bg-gradient-to-br opacity-25 blur-2xl transition group-hover:opacity-40', p.color)} />
            <div className="relative flex items-center gap-3">
              <div className={cx('grid size-12 place-items-center rounded-2xl bg-gradient-to-br text-white', p.color)}>
                <p.icon className="size-6" />
              </div>
              <div className="font-display text-2xl font-bold">{p.label}</div>
            </div>
            <p className="relative mt-4 text-sm text-muted">{p.blurb}</p>
            <div className="relative mt-5 flex items-center gap-2 text-sm font-semibold text-fg">
              Continue as {p.label === 'KJ' ? 'a KJ' : `a ${p.label.toLowerCase()}`} <ArrowRight className="size-4 transition group-hover:translate-x-1" />
            </div>
          </motion.button>
        ))}
      </div>
      {children}
    </motion.div>
  );
}

export function StepCard({ children, onBack, title, icon }: { children: ReactNode; onBack: () => void; title: string; icon: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="max-w-md">
      <button onClick={onBack} className="mb-4 flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Back
      </button>
      <div className="rounded-3xl border border-line bg-surface/80 p-6 shadow-card">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-2xl bg-brand text-white">{icon}</div>
          <h2 className="font-display text-2xl font-bold">{title}</h2>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </motion.div>
  );
}

/** Demo email step. `role` is unset for a returning user. */
export function EmailStep({ role, busy, onBack, onNext, children }: { role?: Role; busy?: boolean; onBack: () => void; onNext: (email: string) => void; children?: ReactNode }) {
  const [email, setEmail] = useState('');
  const [legit, setLegit] = useState(false);
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const label = ROLES.find((r) => r.role === role)?.label;
  return (
    <StepCard onBack={onBack} title={!label ? 'Sign in' : role === 'venue' ? 'Venue sign in' : `${label} sign in`} icon={<Mail className="size-5" />}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valid && (role !== 'venue' || legit)) onNext(email.trim());
        }}
        className="space-y-4"
      >
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold tracking-wide text-muted uppercase">{role === 'venue' ? 'Business email' : 'Email'}</span>
          <input type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder={role === 'venue' ? 'manager@yourbar.com' : 'you@example.com'} className="w-full" />
        </label>
        {role === 'venue' && (
          <label className="flex items-start gap-3 rounded-2xl border border-gold/30 bg-gold/5 p-4 text-sm">
            <input type="checkbox" checked={legit} onChange={(e) => setLegit(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-[var(--color-gold)]" />
            <span>
              <b className="text-gold">I am the owner or an authorized operator of this business.</b>{' '}
              <span className="text-muted">Venue accounts can post specials, award coupons and rate KJs, so we verify every venue before it goes live. Accounts that impersonate a business are removed.</span>
            </span>
          </label>
        )}
        <Button variant="primary" className="w-full" type="submit" loading={busy} disabled={!valid || (role === 'venue' && !legit)}>
          Email me a code <ArrowRight className="size-4" />
        </Button>
        <p className="text-center text-xs text-faint">New here? The same code creates your account.</p>
      </form>
      {children}
    </StepCard>
  );
}

export function VerifyStep({ email, busy, onBack, onDone, hint }: { email: string; busy: boolean; onBack: () => void; onDone: (code: string) => void; hint?: (fill: (code: string) => void) => ReactNode }) {
  const [code, setCode] = useState('');
  return (
    <StepCard onBack={onBack} title="Check your email" icon={<MailCheck className="size-5" />}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (code.length === 6) onDone(code);
        }}
        className="space-y-4"
      >
        <p className="text-sm text-muted">
          We sent a 6-digit code to <b className="text-fg">{email}</b>. Enter it to verify your email.
        </p>
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="••••••"
          className="w-full text-center font-display text-3xl tracking-[0.5em]"
        />
        <Button variant="primary" className="w-full" type="submit" disabled={code.length !== 6} loading={busy}>
          Verify & continue
        </Button>
        {hint?.(setCode)}
      </form>
    </StepCard>
  );
}

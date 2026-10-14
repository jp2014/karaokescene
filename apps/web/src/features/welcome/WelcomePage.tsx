import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Disc3, Mail, MailCheck, Mic2, Store } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button, cx } from '~/components/ui';
import { DebugPanel } from '~/features/debug/DebugPanel';
import { useDemoAccounts } from '~/lib/queries';
import { homeFor, signInAs } from '~/lib/session';

type Role = 'singer' | 'kj' | 'venue';

const ROLES: { role: Role; persona: string; icon: typeof Mic2; color: string; label: string; blurb: string }[] = [
  { role: 'singer', persona: 'usr_jess', icon: Mic2, color: 'from-pink to-violet', label: 'Singer', blurb: 'Find tonight’s best karaoke, check in, send songs to the KJ, and collect badges and venue coupons.' },
  { role: 'kj', persona: 'usr_velvetvox', icon: Disc3, color: 'from-violet to-cyan', label: 'KJ', blurb: 'Upload your song book so singers know what you’ve got, accept song submissions, list your venues and promote your nights.' },
  { role: 'venue', persona: 'usr_neon-mic', icon: Store, color: 'from-cyan to-live', label: 'Venue', blurb: 'Post events and drink specials, reward singers with coupons, rate your KJs and see who’s going.' },
];

type Step = { at: 'role' } | { at: 'email'; role: Role } | { at: 'verify'; role: Role; email: string };

export function WelcomePage() {
  const { data: accounts } = useDemoAccounts();
  const { next } = useSearch({ from: '/welcome' });
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>({ at: 'role' });
  const [busy, setBusy] = useState(false);
  const [allOpen, setAllOpen] = useState(false);

  /** The POC has no real accounts yet: every sign-up lands in that role's demo persona. */
  async function finish(role: Role) {
    setBusy(true);
    try {
      const user = await signInAs(ROLES.find((r) => r.role === role)!.persona, qc);
      toast.success(`Welcome, ${user.displayName}!`, { description: 'Demo: you’re signed in as the sample account for this role.' });
      if (next && next !== '/') navigate({ href: next });
      else navigate({ to: homeFor(user.role) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <FloatingNotes />
      <div className="relative mx-auto flex max-w-6xl flex-col px-5 py-8 sm:px-8 lg:py-14">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/icon.svg" alt="" className="size-10" />
            <span className="font-display text-xl font-extrabold">
              Karaoke<span className="text-gradient"> Scene</span>
            </span>
          </div>
          <Link to="/about" className="text-sm font-medium text-muted hover:text-fg">
            For venues & KJs →
          </Link>
        </header>

        <section className={cx('mt-14 max-w-3xl lg:mt-20', step.at !== 'role' && 'hidden sm:block')}>
          <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 px-3 py-1 text-xs font-semibold text-muted">
            <span className="size-1.5 rounded-full bg-live" /> Now live in Omaha · Council Bluffs · Lincoln
          </motion.p>
          <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="text-5xl leading-[0.95] font-extrabold sm:text-7xl">
            Your karaoke scene, <span className="text-gradient animate-shimmer">all in one place.</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-5 max-w-xl text-lg text-muted">
            Find who’s singing tonight, see when the KJ is on-site, check in with a tap, and build a reputation that follows you from bar to bar.
          </motion.p>
        </section>

        <section className="mt-12">
          <AnimatePresence mode="wait">
            {step.at === 'role' && (
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
                      onClick={() => setStep({ at: 'email', role: p.role })}
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
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Button variant="ghost" onClick={() => setAllOpen(true)}>
                    Browse all {accounts?.length ?? ''} demo accounts
                  </Button>
                </div>
              </motion.div>
            )}
            {step.at === 'email' && <EmailStep key="email" role={step.role} onBack={() => setStep({ at: 'role' })} onNext={(email) => setStep({ at: 'verify', role: step.role, email })} />}
            {step.at === 'verify' && <VerifyStep key="verify" email={step.email} busy={busy} onBack={() => setStep({ at: 'email', role: step.role })} onDone={() => finish(step.role)} />}
          </AnimatePresence>
        </section>
      </div>
      <DebugPanel open={allOpen} onClose={() => setAllOpen(false)} />
    </div>
  );
}

function StepCard({ children, onBack, title, icon }: { children: React.ReactNode; onBack: () => void; title: string; icon: React.ReactNode }) {
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

function EmailStep({ role, onBack, onNext }: { role: Role; onBack: () => void; onNext: (email: string) => void }) {
  const [email, setEmail] = useState('');
  const [legit, setLegit] = useState(false);
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const label = ROLES.find((r) => r.role === role)!.label;
  return (
    <StepCard onBack={onBack} title={role === 'venue' ? 'Venue sign in' : `${label} sign in`} icon={<Mail className="size-5" />}>
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
        <Button variant="primary" className="w-full" type="submit" disabled={!valid || (role === 'venue' && !legit)}>
          Email me a code <ArrowRight className="size-4" />
        </Button>
        <p className="text-center text-xs text-faint">New here? The same code creates your account.</p>
      </form>
    </StepCard>
  );
}

function VerifyStep({ email, busy, onBack, onDone }: { email: string; busy: boolean; onBack: () => void; onDone: () => void }) {
  const [code, setCode] = useState('');
  return (
    <StepCard onBack={onBack} title="Check your email" icon={<MailCheck className="size-5" />}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (code.length === 6) onDone();
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
        <div className="rounded-2xl border border-dashed border-gold/40 bg-gold/5 p-3 text-center text-xs text-gold">
          Demo: no email is sent. Any 6 digits work.{' '}
          <button type="button" className="font-semibold underline" onClick={() => setCode('123456')}>
            Fill in a code
          </button>
        </div>
      </form>
    </StepCard>
  );
}

function FloatingNotes() {
  const notes = ['🎤', '🎶', '✨', '🎵', '🪩', '🎸'];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="absolute top-[-20%] right-[-10%] size-[60vw] max-w-[700px] rounded-full bg-violet/20 blur-[120px]" />
      <div className="absolute bottom-[-20%] left-[-10%] size-[50vw] max-w-[600px] rounded-full bg-pink/15 blur-[120px]" />
      {notes.map((n, i) => (
        <span key={i} className="absolute animate-float text-3xl opacity-30 sm:text-5xl" style={{ top: `${12 + ((i * 37) % 70)}%`, right: `${4 + ((i * 23) % 40)}%`, animationDelay: `${i * 0.8}s` }}>
          {n}
        </span>
      ))}
    </div>
  );
}

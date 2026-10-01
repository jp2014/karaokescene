import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { ArrowRight, Disc3, Mic2, Store } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Avatar } from '~/components/Avatar';
import { Button, cx } from '~/components/ui';
import { DebugPanel } from '~/features/debug/DebugPanel';
import { useDemoAccounts } from '~/lib/queries';
import { homeFor, signInAs } from '~/lib/session';

const PERSONAS = [
  { id: 'usr_jess', icon: Mic2, color: 'from-pink to-violet', role: 'Singer', blurb: 'Find tonight’s best night, check in, spin Song Roulette and collect badges from KJs.' },
  { id: 'usr_velvetvox', icon: Disc3, color: 'from-violet to-cyan', role: 'Karaoke DJ', blurb: 'Run the rotation, see who walked in (and out), award badges and auto-post your nights.' },
  { id: 'usr_neon-mic', icon: Store, color: 'from-cyan to-live', role: 'Venue', blurb: 'Post events and drink specials, see who’s going, curate your gallery and rate your KJs.' },
];

export function WelcomePage() {
  const { data: accounts } = useDemoAccounts();
  const { next } = useSearch({ from: '/welcome' });
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const [allOpen, setAllOpen] = useState(false);

  async function go(userId: string) {
    setBusy(userId);
    try {
      const user = await signInAs(userId, qc);
      toast.success(`Welcome, ${user.displayName}!`);
      if (next && next !== '/') navigate({ href: next });
      else navigate({ to: homeFor(user.role) });
    } finally {
      setBusy(null);
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

        <section className="mt-14 max-w-3xl lg:mt-20">
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
          <h2 className="mb-4 text-sm font-semibold tracking-widest text-faint uppercase">Pick a demo persona</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {PERSONAS.map((p, i) => {
              const a = accounts?.find((x) => x.id === p.id);
              return (
                <motion.button
                  key={p.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + i * 0.07 }}
                  whileHover={{ y: -4 }}
                  onClick={() => go(p.id)}
                  disabled={!!busy}
                  className="group relative overflow-hidden rounded-3xl border border-line bg-surface/80 p-6 text-left shadow-card transition hover:border-line-strong"
                >
                  <div className={cx('absolute -top-16 -right-16 size-48 rounded-full bg-gradient-to-br opacity-25 blur-2xl transition group-hover:opacity-40', p.color)} />
                  <div className="relative flex items-center gap-3">
                    <div className={cx('grid size-11 place-items-center rounded-2xl bg-gradient-to-br text-white', p.color)}>
                      <p.icon className="size-5" />
                    </div>
                    <div className="text-xs font-bold tracking-widest text-muted uppercase">{p.role}</div>
                  </div>
                  <div className="relative mt-6 flex items-center gap-3">
                    {a ? <Avatar user={a} size="lg" /> : <div className="size-14 animate-pulse rounded-full bg-surface-2" />}
                    <div>
                      <div className="font-display text-xl font-bold">{a?.displayName ?? '…'}</div>
                      <div className="text-sm text-muted">{a?.venueName ?? `@${a?.handle ?? ''}`}</div>
                    </div>
                  </div>
                  <p className="relative mt-4 text-sm text-muted">{p.blurb}</p>
                  <div className="relative mt-5 flex items-center gap-2 text-sm font-semibold text-fg">
                    {busy === p.id ? 'Signing in…' : `Continue as ${p.role.toLowerCase()}`} <ArrowRight className="size-4 transition group-hover:translate-x-1" />
                  </div>
                </motion.button>
              );
            })}
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button variant="ghost" onClick={() => setAllOpen(true)}>
              Browse all {accounts?.length ?? ''} demo accounts
            </Button>
            <span className="text-xs text-faint">Google / Facebook sign-in comes later. The POC uses seeded personas.</span>
          </div>
        </section>
      </div>
      <DebugPanel open={allOpen} onClose={() => setAllOpen(false)} />
    </div>
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

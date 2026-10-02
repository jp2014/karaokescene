import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { ArrowRight, Disc3, Mic2, Store } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Avatar } from '~/components/Avatar';
import { Button, cx } from '~/components/ui';
import { homeFor } from '~/lib/session';
import { signInAs, useDemoAccounts } from './api';
import { DebugPanel } from './DebugPanel';

const PERSONAS = [
  { id: 'usr_jess', icon: Mic2, color: 'from-pink to-violet', role: 'Singer', blurb: 'Find tonight’s best night, check in, spin Song Roulette and collect badges from KJs.' },
  { id: 'usr_velvetvox', icon: Disc3, color: 'from-violet to-cyan', role: 'Karaoke DJ', blurb: 'Run the rotation, see who walked in (and out), award badges and auto-post your nights.' },
  { id: 'usr_neon-mic', icon: Store, color: 'from-cyan to-live', role: 'Venue', blurb: 'Post events and drink specials, see who’s going, curate your gallery and rate your KJs.' },
];

/** Local demo sign-in: become one of the seeded personas. */
export function PersonaPicker({ next }: { next?: string }) {
  const { data: accounts } = useDemoAccounts();
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
    <>
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
              <span className="text-xs text-faint">Local demo only: seeded personas instead of real sign-in.</span>
            </div>
          </section>
      <DebugPanel open={allOpen} onClose={() => setAllOpen(false)} />
    </>
  );
}

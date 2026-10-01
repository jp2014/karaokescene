import { AnimatePresence, motion } from 'motion/react';
import { Dices } from 'lucide-react';
import { useState } from 'react';
import { Button, cx } from '~/components/ui';
import { api, unwrap } from '~/lib/api';

type Song = { id: string; title: string; artist: string };

/**
 * Song Roulette: shuffles through the singer's list like a slot machine and lands on
 * a pick (restricted to the KJ's songbook when at a live show).
 */
export function SongRoulette({ pool, kjId, onLanded, action }: { pool: Song[]; kjId?: string; onLanded?: (s: Song) => void; action?: (s: Song) => React.ReactNode }) {
  const [spinning, setSpinning] = useState(false);
  const [shown, setShown] = useState<Song | null>(null);
  const [landed, setLanded] = useState(false);

  async function spin() {
    if (spinning) return;
    setSpinning(true);
    setLanded(false);
    const result = unwrap(api.songs.roulette.$post({ json: { kjId } }));
    const deck = pool.length ? pool : [{ id: '?', title: 'Mystery track', artist: '???' }];
    for (let i = 0; i < 18; i++) {
      setShown(deck[Math.floor(Math.random() * deck.length)]);
      await new Promise((r) => setTimeout(r, 50 + i * i * 1.4));
    }
    const pick = await result;
    if (pick) {
      setShown(pick);
      setLanded(true);
      onLanded?.(pick);
    }
    setSpinning(false);
  }

  return (
    <div className="relative overflow-hidden rounded-3xl border border-violet/30 bg-gradient-to-br from-violet/20 via-surface to-pink/15 p-5">
      <div className="pointer-events-none absolute -top-10 -right-10 size-40 rounded-full bg-pink/20 blur-3xl" />
      <div className="relative flex items-center gap-2 text-sm font-bold tracking-widest text-violet uppercase">
        <Dices className="size-4" /> Song Roulette
      </div>
      <div className="relative mt-4 flex h-20 items-center justify-center overflow-hidden rounded-2xl bg-ink/60 px-4 text-center">
        <AnimatePresence mode="popLayout">
          {shown ? (
            <motion.div key={shown.id + (landed ? '-l' : '')} initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1, scale: landed ? [1, 1.08, 1] : 1 }} exit={{ y: 30, opacity: 0 }} transition={{ duration: spinning ? 0.08 : 0.35 }}>
              <div className={cx('truncate font-display text-xl font-bold', landed && 'text-gradient')}>{shown.title}</div>
              <div className="truncate text-sm text-muted">{shown.artist}</div>
            </motion.div>
          ) : (
            <div className="text-sm text-muted">Feeling lucky? Let fate pick your next song.</div>
          )}
        </AnimatePresence>
      </div>
      <div className="relative mt-4 flex flex-wrap gap-2">
        <Button variant="primary" onClick={spin} loading={spinning} className="flex-1">
          <Dices className="size-4" /> {shown ? 'Spin again' : 'Spin'}
        </Button>
        {landed && shown && action?.(shown)}
      </div>
    </div>
  );
}

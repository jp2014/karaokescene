import { Link } from '@tanstack/react-router';
import { motion } from 'motion/react';
import { Avatar } from '~/components/Avatar';
import { ago } from '~/lib/format';
import type { usePraiseFeed } from '~/lib/queries';

type PraiseItem = NonNullable<ReturnType<typeof usePraiseFeed>['data']>['items'][number];

export function PraiseList({ items, hideTo }: { items: PraiseItem[]; hideTo?: boolean }) {
  return (
    <ul className="space-y-3">
      {items.map((p, i) => (
        <motion.li key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }} className="rounded-3xl border border-line bg-surface/70 p-4">
          <div className="flex items-start gap-3">
            <Link to="/u/$handle" params={{ handle: p.from.handle }}>
              <Avatar user={p.from} />
            </Link>
            <div className="min-w-0 flex-1">
              <div className="text-sm">
                <Link to="/u/$handle" params={{ handle: p.from.handle }} className="font-semibold hover:underline">
                  {p.from.displayName}
                </Link>
                {!hideTo && (
                  <>
                    <span className="text-muted"> praised </span>
                    <Link to="/u/$handle" params={{ handle: p.to.handle }} className="font-semibold hover:underline">
                      {p.to.displayName}
                    </Link>
                  </>
                )}
                <span className="text-faint"> · {ago(p.createdAt)}</span>
              </div>
              <div className="mt-2 flex items-start gap-2 rounded-2xl bg-gradient-to-br from-pink/10 to-violet/10 p-3">
                <span className="text-2xl leading-none">{p.emoji}</span>
                <p className="font-medium">{p.message}</p>
              </div>
              {(p.song || p.venue) && (
                <div className="mt-2 flex flex-wrap gap-x-3 text-xs text-muted">
                  {p.song && <span>🎵 {p.song.title} · {p.song.artist}</span>}
                  {p.venue && (
                    <Link to="/venues/$slug" params={{ slug: p.venue.slug }} className="hover:text-fg">
                      📍 {p.venue.name}
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>
        </motion.li>
      ))}
    </ul>
  );
}

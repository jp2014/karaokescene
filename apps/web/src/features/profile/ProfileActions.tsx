import { useQuery } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { useState } from 'react';
import { BadgeMedal } from '~/components/Badge';
import { Button, cx, Sheet, Spinner } from '~/components/ui';
import { api, unwrap } from '~/lib/api';
import { qk, useAction, usePraiseFeed } from '~/lib/queries';

/** Positive-only praise. There is intentionally no free-form "rating" or criticism. */
export function PraiseSheet({ open, onClose, to, venueId }: { open: boolean; onClose: () => void; to: { id: string; displayName: string; handle: string }; venueId?: string }) {
  const { data } = usePraiseFeed();
  const [picked, setPicked] = useState<{ emoji: string; message: string } | null>(null);
  const [custom, setCustom] = useState('');
  const send = useAction(
    () => unwrap(api.social.praise[':userId'].$post({ param: { userId: to.id }, json: { emoji: picked?.emoji ?? '✨', message: custom.trim() || picked?.message || 'Amazing performance!', venueId } })),
    {
      invalidate: [qk.profile(to.handle), qk.praise],
      success: `Praise sent to ${to.displayName.split(' ')[0]} 💖`,
      onSuccess: () => {
        onClose();
        setPicked(null);
        setCustom('');
      },
    },
  );
  return (
    <Sheet open={open} onClose={onClose} title={`Praise ${to.displayName.split(' ')[0]}`}>
      <p className="mb-4 text-sm text-muted">Karaoke Scene is positive-only. Tell them what made their performance great.</p>
      <div className="grid grid-cols-2 gap-2">
        {data?.presets.map((p) => (
          <button
            key={p.message}
            onClick={() => setPicked(p)}
            className={cx('flex items-center gap-2 rounded-2xl border p-3 text-left text-sm transition', picked?.message === p.message ? 'border-pink bg-pink/10' : 'border-line bg-surface-2/50 hover:border-line-strong')}
          >
            <span className="text-2xl">{p.emoji}</span>
            {p.message}
          </button>
        ))}
      </div>
      <input value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={140} placeholder="…or write your own (keep it kind!)" className="mt-3 w-full" />
      <Button variant="primary" className="mt-4 w-full" disabled={!picked && custom.trim().length < 2} loading={send.isPending} onClick={() => send.mutate(undefined)}>
        Send praise
      </Button>
    </Sheet>
  );
}

/** KJs award singer badges; venues award KJ badges. Once per badge per night. */
export function AwardBadgeSheet({ open, onClose, to }: { open: boolean; onClose: () => void; to: { id: string; displayName: string; handle: string } }) {
  const { data, isLoading, refetch } = useQuery({ queryKey: ['awardable', to.id], queryFn: () => unwrap(api.reputation.awardable[':userId'].$get({ param: { userId: to.id } })), enabled: open });
  const award = useAction((badgeKey: string) => unwrap(api.reputation.award.$post({ json: { recipientId: to.id, badgeKey } })), {
    invalidate: [qk.profile(to.handle), qk.booth],
    success: (_, key) => `${data?.find((b) => b.key === key)?.label} awarded to ${to.displayName.split(' ')[0]} 🏅`,
    onSuccess: () => refetch(),
  });
  return (
    <Sheet open={open} onClose={onClose} title={`Award ${to.displayName.split(' ')[0]} a badge`}>
      {isLoading ? (
        <Spinner />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {data?.map((b) => (
            <button
              key={b.key}
              disabled={b.givenRecently || award.isPending}
              onClick={() => award.mutate(b.key)}
              className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2/50 p-3 text-left transition hover:border-gold/50 disabled:opacity-50"
            >
              <BadgeMedal badge={{ ...b, tier: 'gold' }} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{b.label}</div>
                <div className="truncate text-xs text-muted">{b.description}</div>
              </div>
              {b.givenRecently && <Check className="size-4 text-live" />}
            </button>
          ))}
        </div>
      )}
      <p className="mt-4 text-xs text-faint">Badges build trust across the scene: they help singers pick nights, KJs attract talent and venues choose reliable hosts.</p>
    </Sheet>
  );
}

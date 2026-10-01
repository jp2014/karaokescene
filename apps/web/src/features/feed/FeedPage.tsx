import { Link } from '@tanstack/react-router';
import { MessageCircleHeart, Trophy } from 'lucide-react';
import { useState } from 'react';
import { Avatar } from '~/components/Avatar';
import { Card, PageLoader, Pill, Section } from '~/components/ui';
import { dateLabel, timeLabel } from '~/lib/format';
import { useCircle, useEvents, useMe, usePraiseFeed } from '~/lib/queries';
import { PraiseSheet } from '~/features/profile/ProfileActions';
import { PraiseList } from './PraiseList';

export function FeedPage() {
  const { data, isLoading } = usePraiseFeed();
  const { data: events } = useEvents();
  const { data: me } = useMe();
  const { data: circle } = useCircle();
  const [to, setTo] = useState<{ id: string; displayName: string; handle: string } | null>(null);
  if (isLoading) return <PageLoader />;
  return (
    <div className="grid gap-8 [&>*]:min-w-0 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-extrabold">
            Praise <span className="text-gradient">Feed</span>
          </h1>
          <p className="mt-1 text-muted">Shout-outs from around the scene. Positive vibes only, always.</p>
        </div>
        {me?.role === 'singer' && !!circle?.friends.length && (
          <Card className="p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <MessageCircleHeart className="size-4 text-pink" /> Hype up a friend
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
              {circle.friends.map((f) => (
                <button key={f.id} onClick={() => setTo(f)} className="flex w-16 shrink-0 flex-col items-center gap-1 text-center">
                  <Avatar user={f} size="lg" />
                  <span className="w-full truncate text-[11px] text-muted">{f.displayName.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </Card>
        )}
        <PraiseList items={data?.items ?? []} />
      </div>
      <aside className="space-y-6">
        <Section title="Happening soon" icon={<Trophy className="size-5 text-gold" />}>
          <div className="space-y-2">
            {events?.slice(0, 8).map((e) => (
              <Link key={e.id} to="/venues/$slug" params={{ slug: e.venueSlug }} className="block rounded-2xl border border-line bg-surface/70 p-3 transition hover:border-line-strong">
                <div className="flex items-center justify-between gap-2">
                  <Pill tone={e.kind === 'competition' ? 'gold' : e.kind === 'scene' ? 'cyan' : 'pink'}>{e.kind}</Pill>
                  <span className="text-xs text-muted">{dateLabel(e.startsAt)}</span>
                </div>
                <div className="mt-1.5 font-semibold">{e.title}</div>
                <div className="text-xs text-muted">{e.venueName} · {timeLabel(e.startsAt)}</div>
              </Link>
            ))}
          </div>
        </Section>
      </aside>
      {to && <PraiseSheet open={!!to} onClose={() => setTo(null)} to={to} />}
    </div>
  );
}

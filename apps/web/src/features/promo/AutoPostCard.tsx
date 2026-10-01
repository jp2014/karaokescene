import { useQuery } from '@tanstack/react-query';
import { Lock, Megaphone, Sparkles } from 'lucide-react';
import { FacebookIcon as Facebook, InstagramIcon as Instagram } from '~/components/BrandIcons';
import { useState } from 'react';
import { Button, Card, cx, Pill } from '~/components/ui';
import { api, unwrap } from '~/lib/api';
import { dayTimeLabel, serverNow } from '~/lib/format';
import { qk, useAction, useMe } from '~/lib/queries';

type Network = 'facebook' | 'instagram' | 'karaokescene';
const NETS: { key: Network; label: string; icon: typeof Facebook | null; pro: boolean }[] = [
  { key: 'karaokescene', label: 'Karaoke Scene', icon: null, pro: false },
  { key: 'facebook', label: 'Facebook', icon: Facebook, pro: true },
  { key: 'instagram', label: 'Instagram', icon: Instagram, pro: true },
];

/** Auto-Posting: schedule promos for your nights. Social networks are a Pro (paid) feature. */
export function AutoPostCard({ venues, defaultVenueId }: { venues: { id: string; name: string }[]; defaultVenueId?: string }) {
  const { data: me } = useMe();
  const posts = useQuery({ queryKey: ['posts'], queryFn: () => unwrap(api.promo.posts.$get()) });
  const [venueId, setVenueId] = useState(defaultVenueId ?? venues[0]?.id);
  const venue = venues.find((v) => v.id === venueId);
  const [body, setBody] = useState('');
  const [nets, setNets] = useState<Network[]>(['karaokescene']);
  const [when, setWhen] = useState<'now' | '3h' | 'tomorrow'>('now');
  const pro = !!me?.isPremium;

  const schedule = useAction(
    () =>
      unwrap(
        api.promo.posts.$post({
          json: {
            body: body || `🎤 Karaoke tonight at ${venue?.name}! Come sing with us. #OmahaKaraoke #KaraokeScene`,
            networks: nets,
            venueId,
            scheduledFor: serverNow() + { now: 0, '3h': 3 * 3600_000, tomorrow: 24 * 3600_000 }[when],
          },
        }),
      ),
    {
      success: (r) => (r.scheduledFor <= serverNow() ? 'Posted! 📣' : `Scheduled for ${dayTimeLabel(r.scheduledFor)}`),
      onSuccess: () => {
        setBody('');
        posts.refetch();
      },
    },
  );
  const upgrade = useAction(() => unwrap(api.promo.upgrade.$post()), { invalidate: [qk.me], success: 'Pro unlocked ✨ Auto-post everywhere.' });

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold">
          <Megaphone className="size-4 text-pink" /> Auto-Posting
        </div>
        {pro ? <Pill tone="gold">Pro</Pill> : <Pill tone="muted">Free</Pill>}
      </div>
      <div className="mt-3 space-y-3">
        {venues.length > 1 && (
          <select value={venueId} onChange={(e) => setVenueId(e.target.value)} className="w-full text-sm">
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        )}
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} className="w-full text-sm" placeholder={`🎤 Karaoke tonight at ${venue?.name ?? 'the bar'}! …`} />
        <div className="flex flex-wrap gap-1.5">
          {NETS.map((n) => {
            const locked = n.pro && !pro;
            const on = nets.includes(n.key);
            return (
              <button
                key={n.key}
                onClick={() => !locked && setNets(on ? nets.filter((x) => x !== n.key) : [...nets, n.key])}
                className={cx('flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition', on ? 'border-pink bg-pink/15 text-fg' : 'border-line text-muted', locked && 'opacity-50')}
              >
                {locked ? <Lock className="size-3" /> : n.icon ? <n.icon className="size-3.5" /> : '🎤'} {n.label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={when} onChange={(e) => setWhen(e.target.value as typeof when)} className="!h-9 !py-0 text-sm">
            <option value="now">Post now</option>
            <option value="3h">In 3 hours</option>
            <option value="tomorrow">Tomorrow</option>
          </select>
          <Button size="sm" variant="primary" className="ml-auto" disabled={!nets.length} loading={schedule.isPending} onClick={() => schedule.mutate(undefined)}>
            {when === 'now' ? 'Post' : 'Schedule'}
          </Button>
        </div>
        {!pro && (
          <button onClick={() => upgrade.mutate(undefined)} className="flex w-full items-center gap-2 rounded-2xl border border-gold/30 bg-gold/5 p-3 text-left text-xs">
            <Sparkles className="size-4 shrink-0 text-gold" />
            <span className="flex-1">
              <b className="text-gold">Go Pro ($9/mo)</b> to auto-post to Facebook & Instagram every week.
            </span>
          </button>
        )}
      </div>
      {!!posts.data?.length && (
        <div className="mt-4 space-y-2 border-t border-line pt-4">
          {posts.data.slice(0, 4).map((p) => (
            <div key={p.id} className="text-xs">
              <div className="flex items-center gap-2">
                <Pill tone={p.status === 'posted' ? 'live' : 'cyan'}>{p.status}</Pill>
                <span className="text-muted">{dayTimeLabel(p.scheduledFor)}</span>
                <span className="ml-auto text-faint">{p.networks.join(' · ')}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-muted">{p.body}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

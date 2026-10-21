import { useQuery } from '@tanstack/react-query';
import { BellRing, Megaphone, Share2, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { PLANS, UpgradeSheet } from '~/components/Premium';
import { ShareSheet } from '~/components/ShareSheet';
import { Button, Card, Pill } from '~/components/ui';
import { api, unwrap } from '~/lib/api';
import { dayTimeLabel } from '~/lib/format';
import { useMe } from '~/lib/queries';

export const venueUrl = (slug: string) => `${window.location.origin}/venues/${slug}`;

/**
 * Promote your night: write it once and share it anywhere (the device share sheet, Facebook,
 * a text). Paid plans add reminders: Auto Promote for KJs, special reminders for venues.
 */
export function PromoteCard({ venues }: { venues: { id: string; name: string; slug: string }[] }) {
  const { data: me } = useMe();
  const reminders = useQuery({ queryKey: ['posts'], queryFn: () => unwrap(api.promo.posts.$get()) });
  const [venueId, setVenueId] = useState(venues[0]?.id);
  const venue = venues.find((v) => v.id === venueId) ?? venues[0];
  const [sharing, setSharing] = useState(false);
  const [plan, setPlan] = useState(false);
  const upcoming = reminders.data?.filter((r) => r.status === 'scheduled').slice(0, 3) ?? [];
  if (!venue) return null;
  const pitch = me?.role === 'venue' ? 'reminders to share your drink specials on their days' : 'Auto Promote: a reminder to share each of your nights, a day ahead';

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold">
          <Megaphone className="size-4 text-pink" /> Promote your night
        </div>
        {me?.isPremium && <Pill tone="gold">{PLANS[me.role].name}</Pill>}
      </div>
      <div className="mt-3 space-y-3">
        <p className="text-sm text-muted">Share it to Instagram, Facebook, group chats or wherever your crowd is. The link opens {venue.name} on Karaoke Scene.</p>
        {venues.length > 1 && (
          <select value={venue.id} onChange={(e) => setVenueId(e.target.value)} className="w-full text-sm">
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        )}
        <Button variant="primary" className="w-full" onClick={() => setSharing(true)}>
          <Share2 className="size-4" /> Share {venue.name}
        </Button>
        {!me?.isPremium && (
          <button onClick={() => setPlan(true)} className="flex w-full items-center gap-2 rounded-2xl border border-gold/30 bg-gold/5 p-3 text-left text-xs">
            <Sparkles className="size-4 shrink-0 text-gold" />
            <span className="flex-1">
              <b className="text-gold">{me ? PLANS[me.role].name : 'Upgrade'}</b> adds {pitch}.
            </span>
          </button>
        )}
      </div>
      {upcoming.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-line pt-4">
          {upcoming.map((r) => (
            <div key={r.id} className="text-xs">
              <div className="flex items-center gap-2 text-muted">
                <BellRing className="size-3.5 text-cyan" /> Reminder {dayTimeLabel(r.scheduledFor)}
              </div>
              <p className="mt-1 line-clamp-2 text-faint">{r.body}</p>
            </div>
          ))}
        </div>
      )}
      <ShareSheet open={sharing} onClose={() => setSharing(false)} title={`Share ${venue.name}`} text={`🎤 Karaoke at ${venue.name}! Come sing with us. #KaraokeScene`} url={venueUrl(venue.slug)} />
      <UpgradeSheet open={plan} onClose={() => setPlan(false)} feature={me?.role === 'venue' ? 'Special reminders' : 'Auto Promote'} />
    </Card>
  );
}

import { useQuery } from '@tanstack/react-query';
import { QrCode } from 'lucide-react';
import { Avatar } from '~/components/Avatar';
import { Button, Card, Section } from '~/components/ui';
import { VenueArt } from '~/components/VenueArt';
import { useQrScan } from '~/features/qr/useQrScan';
import { api, unwrap } from '~/lib/api';
import { useLocation } from '~/lib/location';
import { useCircle, useMe, useVenues } from '~/lib/queries';

/** Demo: pretend to scan a nearby venue's code, a friend's QR card, or (as a venue) a singer's coupon. */
export function SimulatedScans() {
  const scan = useQrScan();
  const loc = useLocation();
  const { data: venues } = useVenues({ lat: loc.current.lat, lng: loc.current.lng, radiusMi: 20 });
  const { data: circle } = useCircle();
  const { data: me } = useMe();
  const issued = useQuery({ queryKey: ['issued'], queryFn: () => unwrap(api.wallet.issued.$get()), enabled: me?.role === 'venue' });
  const isVenue = me?.role === 'venue';
  const nearby = isVenue ? [] : (venues?.venues.filter((v) => v.isLive).slice(0, 4) ?? []);
  const people = isVenue ? [] : [...(circle?.friends ?? []), ...(circle?.incoming ?? [])].slice(0, 4);
  const coupons = issued.data?.filter((c) => c.status === 'active').slice(0, 4) ?? [];
  return (
    <Section title="Simulate a scan" icon={<QrCode className="size-5 text-pink" />}>
      <p className="-mt-1 text-sm text-muted">For the demo: pretend you just scanned one of these codes.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {nearby.map((v) => (
          <Card key={v.id} className="flex items-center gap-3 p-3">
            <VenueArt name={v.name} hue={v.hue} photoUrl={v.photoUrl} className="size-11 rounded-xl" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{v.name}</div>
              <div className="text-xs text-muted">Venue code → check in</div>
            </div>
            <Button size="sm" onClick={() => scan({ kind: 'v', key: v.slug })}>
              Scan
            </Button>
          </Card>
        ))}
        {coupons.map((c) => (
          <Card key={c.id} className="flex items-center gap-3 p-3">
            {c.singer && <Avatar user={c.singer} />}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{c.title}</div>
              <div className="text-xs text-muted">{c.singer?.displayName}'s coupon → redeem</div>
            </div>
            <Button size="sm" onClick={() => scan({ kind: 'c', key: c.code })}>
              Scan
            </Button>
          </Card>
        ))}
        {isVenue && !coupons.length && <p className="text-sm text-muted">No unredeemed coupons. Award one to a singer from Venue HQ.</p>}
        {people.map((u) => (
          <Card key={u.id} className="flex items-center gap-3 p-3">
            <Avatar user={u} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{u.displayName}</div>
              <div className="text-xs text-muted">QR card → connect</div>
            </div>
            <Button size="sm" onClick={() => scan({ kind: 'u', key: u.handle })}>
              Scan
            </Button>
          </Card>
        ))}
      </div>
    </Section>
  );
}

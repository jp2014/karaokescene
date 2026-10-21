import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { BadgeCheck, Plus, Search, Store } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { Button, Card, Section, Sheet } from '~/components/ui';
import { VenueArt } from '~/components/VenueArt';
import { useVenuePlace, VenuePlaceFields } from '~/features/venue/VenuePlaceFields';
import { api, unwrap } from '~/lib/api';
import { useAction } from '~/lib/queries';

type Listing = Awaited<ReturnType<typeof fetchUnclaimed>>[number];
const fetchUnclaimed = (q: string) => unwrap(api.venues.unclaimed.$get({ query: { q } }));

/**
 * A venue account without a venue yet: claim the listing a KJ already made for it, or add it.
 * Shown on Venue HQ and Profile until one of those is done.
 */
export function VenueSetup() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const dq = useDeferredValue(q.trim());
  const listings = useQuery({ queryKey: ['unclaimed', dq], queryFn: () => fetchUnclaimed(dq), enabled: dq.length > 1 });
  const [claiming, setClaiming] = useState<Listing | null>(null);
  const [adding, setAdding] = useState(false);

  const done = async () => {
    // The account (and its id, after a claim) changed: refetch everything that's on screen.
    await qc.resetQueries();
    navigate({ to: '/hq' });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold">
          Set up your <span className="text-gradient">venue</span>
        </h1>
        <p className="mt-1 text-muted">Bring your venue onto Karaoke Scene to post specials and events, reward singers with coupons and choose your KJs.</p>
      </div>

      <Section title="Already listed by your KJ?" icon={<Search className="size-5 text-cyan" />}>
        <p className="-mt-1 text-sm text-muted">KJs can list the venues they host before the owner joins. If yours is there, claim it to keep its ratings and nights.</p>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by venue name" className="w-full" />
        {listings.data && (
          <div className="grid grid-cols-1 gap-2">
            {listings.data.map((v) => (
              <Card key={v.id} className="flex min-w-0 items-center gap-3 p-3">
                <VenueArt name={v.name} hue={v.hue} photoUrl={v.photoUrl} className="size-11 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{v.name}</div>
                  <div className="truncate text-xs text-muted">
                    {v.address}, {v.city}
                    {v.createdBy && ` · listed by ${v.createdBy.displayName}`}
                  </div>
                </div>
                <Button size="sm" className="shrink-0" onClick={() => setClaiming(v)}>
                  This is mine
                </Button>
              </Card>
            ))}
            {!listings.data.length && <p className="text-sm text-muted">No unclaimed venue called “{dq}”. Add yours below.</p>}
          </div>
        )}
      </Section>

      <Section title="Add your venue" icon={<Store className="size-5 text-pink" />}>
        {adding ? (
          <AddOwnVenue onDone={done} />
        ) : (
          <Button variant="primary" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> Add your venue
          </Button>
        )}
      </Section>

      {claiming && <ClaimSheet listing={claiming} onClose={() => setClaiming(null)} onDone={done} />}
    </div>
  );
}

function AddOwnVenue({ onDone }: { onDone: () => void }) {
  const placeState = useVenuePlace();
  const create = useAction(() => unwrap(api.venues.own.$post({ json: placeState.place })), { success: (v) => `${v.name} is on the map 🎉`, onSuccess: onDone });
  return (
    <Card className="space-y-4 p-5">
      <VenuePlaceFields state={placeState} />
      <Button variant="primary" className="w-full" disabled={!placeState.valid} loading={create.isPending} onClick={() => create.mutate(undefined)}>
        Add venue
      </Button>
    </Card>
  );
}

function ClaimSheet({ listing, onClose, onDone }: { listing: Listing; onClose: () => void; onDone: () => void }) {
  const [owner, setOwner] = useState(false);
  const claim = useAction(() => unwrap(api.venues[':venueId'].claim.$post({ param: { venueId: listing.id } })), { success: `You now manage ${listing.name} 🎉`, onSuccess: onDone });
  return (
    <Sheet open onClose={onClose} title={`Claim ${listing.name}`}>
      <div className="space-y-4 text-sm">
        <p className="text-muted">
          {listing.address}, {listing.city}
          {listing.createdBy && <> · listed by {listing.createdBy.displayName}</>}
        </p>
        <p className="text-muted">Claiming makes this account the venue’s manager. Its ratings, favorites and the KJ’s nights stay as they are.</p>
        <label className="flex items-start gap-3 rounded-2xl border border-gold/30 bg-gold/5 p-4">
          <input type="checkbox" checked={owner} onChange={(e) => setOwner(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-[var(--color-gold)]" />
          <span>
            <b className="text-gold">I own or run {listing.name}.</b> <span className="text-muted">The KJ who listed it is told it was claimed, and claims that impersonate a business are removed.</span>
          </span>
        </label>
        <Button variant="primary" className="w-full" disabled={!owner} loading={claim.isPending} onClick={() => claim.mutate(undefined)}>
          <BadgeCheck className="size-4" /> Claim {listing.name}
        </Button>
      </div>
    </Sheet>
  );
}

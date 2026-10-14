import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Ban, Check, Heart, Megaphone, PartyPopper, Radar, Search, UserPlus, X } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { Avatar, UserRow } from '~/components/Avatar';
import { Button, Card, cx, EmptyState, PageLoader, Pill, Section, Segmented, Sheet } from '~/components/ui';
import { VenueArt } from '~/components/VenueArt';
import { api, unwrap } from '~/lib/api';
import { DAYS } from '~/lib/format';
import { useLocation } from '~/lib/location';
import { qk, useAction, useCircle, useMe, useVenues, type VenueSummary } from '~/lib/queries';

type Tab = 'friends' | 'find' | 'favorites' | 'blocked';

/** Singers get their people; KJs and venues get Singers Near You with a "Promote tonight" button. */
export function FriendsPage() {
  const { data: me } = useMe();
  if (!me) return <PageLoader />;
  return me.role === 'singer' ? <SingerFriends /> : <SingersNearYou />;
}

function SingerFriends() {
  const { data: c, isLoading } = useCircle();
  const [tab, setTab] = useState<Tab>('friends');
  const [inviting, setInviting] = useState(false);
  const inv = [qk.circle, ['profile']];
  const respond = useAction((x: { id: string; accept: boolean }) => unwrap(api.social.friends[':userId'].respond.$post({ param: { userId: x.id }, json: { accept: x.accept } })), {
    invalidate: inv,
    success: (_, x) => (x.accept ? 'Friend added 🤝' : 'Request declined'),
  });
  const unblock = useAction((id: string) => unwrap(api.social.blocks[':userId'].$put({ param: { userId: id }, json: { on: false } })), { invalidate: inv, success: 'Unblocked' });

  if (isLoading || !c) return <PageLoader />;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold">Your people</h1>
          <p className="mt-1 text-muted">Friends, favorite KJs and venues, and the people you'd rather not see.</p>
        </div>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'friends', label: `Friends ${c.friends.length}` },
            { value: 'find', label: 'Find' },
            { value: 'favorites', label: 'Favorites' },
            { value: 'blocked', label: 'Blocked' },
          ]}
        />
      </div>

      {tab === 'friends' && (
        <div className="grid gap-6 [&>*]:min-w-0 lg:grid-cols-[1fr_360px]">
          <div className="space-y-3">
            {c.friends.length > 0 && (
              <Card className="flex items-center gap-3 border-pink/30 bg-pink/5 p-4">
                <PartyPopper className="size-6 shrink-0 text-pink" />
                <div className="min-w-0 flex-1 text-sm">
                  <div className="font-semibold">Invite friends out</div>
                  <div className="text-muted">Pick a night and a venue. They get an invite and can say they're going.</div>
                </div>
                <Button variant="primary" size="sm" onClick={() => setInviting(true)}>
                  Invite out
                </Button>
              </Card>
            )}
            <Card className="p-2">
              {c.friends.length ? c.friends.map((f) => <UserRow key={f.id} user={f} />) : <EmptyState icon="👋" title="No friends yet" body="Scan someone's QR card at a show, or find them by name." />}
            </Card>
          </div>
          <div className="space-y-6">
            {c.incoming.length > 0 && (
              <Section title={`Requests · ${c.incoming.length}`}>
                <Card className="p-2">
                  {c.incoming.map((f) => (
                    <UserRow
                      key={f.id}
                      user={f}
                      right={
                        <div className="flex gap-1">
                          <Button size="icon" variant="primary" className="!size-8" onClick={() => respond.mutate({ id: f.id, accept: true })} aria-label="Accept">
                            <Check className="size-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="!size-8" onClick={() => respond.mutate({ id: f.id, accept: false })} aria-label="Decline">
                            <X className="size-4" />
                          </Button>
                        </div>
                      }
                    />
                  ))}
                </Card>
              </Section>
            )}
            {c.outgoing.length > 0 && (
              <Section title="Sent">
                <Card className="p-2">
                  {c.outgoing.map((f) => (
                    <UserRow key={f.id} user={f} sub="Request pending" />
                  ))}
                </Card>
              </Section>
            )}
          </div>
        </div>
      )}

      {tab === 'find' && <FriendFinder />}

      {tab === 'favorites' && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Section title="KJs" icon={<Heart className="size-5 text-pink" />}>
            <Card className="p-2">{c.favoriteKjs.length ? c.favoriteKjs.map((f) => <UserRow key={f.id} user={f} />) : <p className="p-3 text-sm text-muted">Star a KJ to get a ping when they go live.</p>}</Card>
          </Section>
          <Section title="Venues">
            <div className="space-y-2">
              {c.favoriteVenues.map((v) => (
                <Link key={v.id} to="/venues/$slug" params={{ slug: v.slug }} className="flex items-center gap-3 rounded-2xl border border-line bg-surface/70 p-2 hover:border-line-strong">
                  <VenueArt name={v.name} hue={v.hue} className="size-11 rounded-xl" />
                  <div>
                    <div className="text-sm font-semibold">{v.name}</div>
                    <div className="text-xs text-muted">{v.neighborhood}</div>
                  </div>
                </Link>
              ))}
            </div>
          </Section>
          <Section title="Singers">
            <Card className="p-2">{c.favoriteSingers.length ? c.favoriteSingers.map((f) => <UserRow key={f.id} user={f} />) : <p className="p-3 text-sm text-muted">None yet.</p>}</Card>
          </Section>
        </div>
      )}

      {tab === 'blocked' && (
        <Card className="p-2">
          {c.blocked.length ? (
            c.blocked.map((f) => (
              <UserRow
                key={f.id}
                user={f}
                link={false}
                right={
                  <Button size="sm" onClick={() => unblock.mutate(f.id)}>
                    Unblock
                  </Button>
                }
              />
            ))
          ) : (
            <EmptyState icon={<Ban />} title="No one blocked" body="Blocking hides you from each other everywhere: check-ins, praise, profiles and Singers Near You." />
          )}
        </Card>
      )}
      <InviteOutSheet open={inviting} onClose={() => setInviting(false)} friends={c.friends} />
    </div>
  );
}

function InviteOutSheet({ open, onClose, friends }: { open: boolean; onClose: () => void; friends: { id: string; displayName: string; handle: string; role: 'singer' | 'kj' | 'venue'; avatarHue: number; avatarEmoji: string; avatarUrl?: string | null }[] }) {
  const loc = useLocation();
  const { data } = useVenues({ lat: loc.current.lat, lng: loc.current.lng, radiusMi: 20 });
  const [picked, setPicked] = useState<string[]>([]);
  const [dayOffset, setDayOffset] = useState(0);
  const [venueId, setVenueId] = useState<string>();
  const date = new Date(Date.now() + dayOffset * 86_400_000);
  const dateStr = date.toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
  // Venues with karaoke on the chosen day: tonight's list for today, otherwise next-night matches.
  const options: VenueSummary[] = (data?.venues ?? []).filter((v) => (dayOffset === 0 ? !!v.tonight : v.nextNight?.dayOfWeek === date.getDay() || !!v.tonight)).slice(0, 12);
  const venue = options.find((v) => v.id === venueId) ?? options[0];
  const send = useAction(() => unwrap(api.social.invites.$post({ json: { friendIds: picked, venueId: venue!.id, date: dateStr } })), {
    invalidate: [['venue']],
    success: (r) => `Invite sent to ${r.sent} friend${r.sent === 1 ? '' : 's'} 🎉`,
    onSuccess: () => {
      setPicked([]);
      onClose();
    },
  });
  return (
    <Sheet open={open} onClose={onClose} title="Invite friends out">
      <div className="space-y-5">
        <div>
          <div className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">When</div>
          <Segmented size="sm" value={String(dayOffset)} onChange={(v) => setDayOffset(Number(v))} options={[0, 1, 2, 3].map((d) => ({ value: String(d), label: d === 0 ? 'Tonight' : d === 1 ? 'Tomorrow' : DAYS[(date.getDay() - dayOffset + d + 7) % 7] }))} />
        </div>
        <div>
          <div className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Where</div>
          <div className="grid max-h-48 gap-1.5 overflow-y-auto">
            {options.map((v) => (
              <button key={v.id} onClick={() => setVenueId(v.id)} className={cx('flex items-center gap-3 rounded-2xl border p-2 text-left', venue?.id === v.id ? 'border-pink bg-pink/10' : 'border-line')}>
                <VenueArt name={v.name} hue={v.hue} photoUrl={v.photoUrl} className="size-9 shrink-0 rounded-lg" />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{v.name}</span>
                <span className="text-xs text-muted">{v.distanceMi} mi</span>
              </button>
            ))}
            {!options.length && <p className="text-sm text-muted">No karaoke nights found for that day nearby.</p>}
          </div>
        </div>
        <div>
          <div className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Who · {picked.length} picked</div>
          <div className="flex flex-wrap gap-2">
            {friends.map((f) => {
              const on = picked.includes(f.id);
              return (
                <button key={f.id} onClick={() => setPicked(on ? picked.filter((x) => x !== f.id) : [...picked, f.id])} className={cx('flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm', on ? 'border-pink bg-pink/15' : 'border-line')}>
                  <Avatar user={f} size="xs" /> {f.displayName.split(' ')[0]}
                </button>
              );
            })}
          </div>
        </div>
        <Button variant="primary" className="w-full" disabled={!picked.length || !venue} loading={send.isPending} onClick={() => send.mutate(undefined)}>
          <PartyPopper className="size-4" /> Send invite{picked.length > 1 ? 's' : ''}
        </Button>
        <p className="text-center text-xs text-faint">You'll be marked as going, so they can see you'll be there.</p>
      </div>
    </Sheet>
  );
}

/** KJs and venues: who's out singing nearby, and a one-tap ping about tonight's show. */
function SingersNearYou() {
  const loc = useLocation();
  const [radius, setRadius] = useState<'5' | '10' | '20'>('10');
  const near = useQuery({
    queryKey: ['singers-near', loc.current, radius],
    queryFn: () => unwrap(api.presence['singers-near'].$get({ query: { lat: String(loc.current.lat), lng: String(loc.current.lng), radiusMi: radius } })),
  });
  const promote = useAction(() => unwrap(api.presence['promote-tonight'].$post({ json: { lat: loc.current.lat, lng: loc.current.lng, radiusMi: Number(radius) } })), {
    success: (r) => (r.sent ? `Tonight's show sent to ${r.sent} singers nearby 📣` : `Everyone nearby already got tonight's ping (${r.skipped})`),
  });
  const out = near.data?.filter((u) => u.checkedInVenueId).length ?? 0;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold">
            Singers <span className="text-gradient">near you</span>
          </h1>
          <p className="mt-1 text-muted">Singers within {radius} miles of {loc.label}. People in Ghost Mode never show up here.</p>
        </div>
        <Segmented value={radius} onChange={setRadius} options={[{ value: '5', label: '5 mi' }, { value: '10', label: '10 mi' }, { value: '20', label: '20 mi' }]} />
      </div>
      <Card glow="pink" className="flex flex-wrap items-center gap-4 border-pink/40 p-5">
        <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-pink/15 text-pink">
          <Megaphone className="size-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold">Promote tonight</div>
          <div className="text-sm text-muted">Send tonight's show to every singer within {radius} miles. Each singer gets it once per night.</div>
        </div>
        <Button variant="primary" loading={promote.isPending} onClick={() => promote.mutate(undefined)}>
          <Megaphone className="size-4" /> Promote tonight
        </Button>
      </Card>
      <div className="flex gap-3">
        <Pill tone="cyan">
          <Radar className="size-3" /> {near.data?.length ?? '…'} nearby
        </Pill>
        <Pill tone="live">{out} out singing now</Pill>
      </div>
      <Card className="p-2">
        {near.data?.map((u) => <UserRow key={u.id} user={u} sub={`${u.distanceMi} mi away${u.checkedInVenueId ? ' · out singing now' : ''}`} />)}
        {near.data?.length === 0 && <EmptyState icon="🌙" title="No one nearby" body="Try a bigger radius." />}
      </Card>
    </div>
  );
}

function FriendFinder() {
  const [q, setQ] = useState('');
  const dq = useDeferredValue(q);
  const loc = useLocation();
  const search = useQuery({ queryKey: ['people', dq], queryFn: () => unwrap(api.profiles.search.$get({ query: { q: dq } })) });
  const near = useQuery({
    queryKey: ['singers-near', loc.current, 5],
    queryFn: () => unwrap(api.presence['singers-near'].$get({ query: { lat: String(loc.current.lat), lng: String(loc.current.lng), radiusMi: '5' } })),
  });
  const add = useAction((id: string) => unwrap(api.social.friends[':userId'].$post({ param: { userId: id } })), { invalidate: [qk.circle], success: 'Friend request sent' });
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Section title="Search">
        <div className="relative">
          <Search className="absolute top-3 left-3.5 size-5 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or @handle" className="w-full pl-11" />
        </div>
        <Card className="max-h-[60vh] overflow-y-auto p-2">
          {search.data?.map((u) => (
            <UserRow
              key={u.id}
              user={u}
              right={
                u.role === 'singer' && (
                  <Button size="icon" variant="ghost" className="!size-8" onClick={() => add.mutate(u.id)} aria-label="Add friend">
                    <UserPlus className="size-4" />
                  </Button>
                )
              }
            />
          ))}
        </Card>
      </Section>
      <Section title="Singers within 5 miles">
        <Card className="max-h-[60vh] overflow-y-auto p-2">
          {near.data?.map((u) => <UserRow key={u.id} user={u} sub={`${u.distanceMi} mi away${u.checkedInVenueId ? ' · out singing now' : ''}`} />)}
          {near.data?.length === 0 && <p className="p-3 text-sm text-muted">No one nearby (or they're in Ghost Mode).</p>}
        </Card>
      </Section>
    </div>
  );
}

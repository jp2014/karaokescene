import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Ban, Check, Heart, Search, UserPlus, X } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { UserRow } from '~/components/Avatar';
import { Button, Card, EmptyState, PageLoader, Section, Segmented } from '~/components/ui';
import { VenueArt } from '~/components/VenueArt';
import { api, unwrap } from '~/lib/api';
import { useLocation } from '~/lib/location';
import { qk, useAction, useCircle } from '~/lib/queries';

type Tab = 'friends' | 'find' | 'favorites' | 'blocked';

export function FriendsPage() {
  const { data: c, isLoading } = useCircle();
  const [tab, setTab] = useState<Tab>('friends');
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
          <Card className="p-2">
            {c.friends.length ? c.friends.map((f) => <UserRow key={f.id} user={f} />) : <EmptyState icon="👋" title="No friends yet" body="Scan someone's QR card at a show, or find them by name." />}
          </Card>
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

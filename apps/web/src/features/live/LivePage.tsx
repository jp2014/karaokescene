import { DEMO } from '~/lib/demo';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Award, CheckCircle2, Clock3, LogOut, Mic2, Music2, Search, Send, Star, X } from 'lucide-react';
import { useState } from 'react';
import { Avatar } from '~/components/Avatar';
import { BusyMeter } from '~/components/BusyMeter';
import { Button, Card, cx, EmptyState, LiveDot, PageLoader, Pill, Section, Spinner, Toggle } from '~/components/ui';
import { VenueArt } from '~/components/VenueArt';
import { VenueCard } from '~/features/discover/VenueCard';
import { AwardBadgeSheet, PraiseSheet } from '~/features/profile/ProfileActions';
import { SongRoulette } from '~/features/songs/SongRoulette';
import { api, unwrap } from '~/lib/api';
import { useDebounced } from '~/lib/debounce';
import { ago, duration, serverNow } from '~/lib/format';
import { useLocation } from '~/lib/location';
import { qk, useAction, useMe, useMyLive, useMySongs, useVenue, useVenues } from '~/lib/queries';

/** The singer's "I'm here" screen: songs sent to the KJ, roulette, ratings and who's in the room. */
export function LivePage() {
  const { data, isLoading } = useMyLive();
  if (isLoading) return <PageLoader />;
  if (!data?.checkin || !data.venue) return <NotCheckedIn />;
  return <LiveNight data={data as LiveData} />;
}

type LiveData = NonNullable<ReturnType<typeof useMyLive>['data']> & { venue: NonNullable<NonNullable<ReturnType<typeof useMyLive>['data']>['venue']>; checkin: NonNullable<NonNullable<ReturnType<typeof useMyLive>['data']>['checkin']> };

function LiveNight({ data }: { data: LiveData }) {
  const { data: songs } = useMySongs(data.kj?.id);
  const { data: venue } = useVenue(data.venue.slug);
  const { data: me } = useMe();
  const [praiseTo, setPraiseTo] = useState<{ id: string; displayName: string; handle: string } | null>(null);
  const [rate, setRate] = useState<{ id: string; displayName: string; handle: string } | null>(null);
  const [onlyKjBook, setOnlyKjBook] = useState(true);
  const inv = [qk.myLive, qk.me, ['venues'], qk.venue(data.venue.slug)];
  const submit = useAction((x: { songId: string; source: 'list' | 'roulette' | 'search' }) => unwrap(api.live.submissions.$post({ json: x })), { invalidate: inv, success: 'Sent to the KJ 🎤 You’ll see when they accept it.' });
  const withdraw = useAction((id: string) => unwrap(api.live.submissions[':id'].$delete({ param: { id } })), { invalidate: inv, success: 'Song withdrawn' });
  const checkOut = useAction(() => unwrap(api.presence['check-out'].$post()), { invalidate: inv, success: 'Checked out. Thanks for singing!' });

  const pending = data.submissions.filter((q) => q.status === 'submitted');
  const sent = new Set(pending.map((q) => q.song.id));
  const canSubmit = !!data.kjSessionId && pending.length < 3;
  const hasBookInfo = songs?.some((s) => s.inKjBook != null);
  const list = (songs ?? []).filter((s) => !onlyKjBook || s.inKjBook !== false);
  const hidden = (songs?.length ?? 0) - list.length;

  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden">
        <VenueArt name={data.venue.name} hue={data.venue.hue} photoUrl={data.venue.photoUrl} big className="absolute inset-0 opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/80 to-ink/30" />
        <div className="relative flex flex-wrap items-center gap-4 p-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-live uppercase">
              <LiveDot /> You're checked in · {duration(serverNow() - data.checkin.checkedInAt)}
            </div>
            <Link to="/venues/$slug" params={{ slug: data.venue.slug }} className="mt-1 block font-display text-3xl font-extrabold hover:underline">
              {data.venue.name}
            </Link>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted">
              {data.kj ? (
                <span className="flex items-center gap-2">
                  <Avatar user={data.kj} size="xs" /> {data.kj.displayName} is hosting
                </span>
              ) : (
                <span>The KJ hasn't checked in yet. You can send songs once they do.</span>
              )}
              {venue && <BusyMeter level={venue.crowd.level} count={venue.crowd.count} />}
              {me?.ghostMode && <Pill tone="violet">👻 Ghost</Pill>}
            </div>
          </div>
          <Button variant="ghost" onClick={() => checkOut.mutate(undefined)} loading={checkOut.isPending}>
            <LogOut className="size-4" /> Check out
          </Button>
        </div>
      </Card>

      <div className="grid gap-6 [&>*]:min-w-0 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Section title="Your songs tonight" icon={<Music2 className="size-5 text-pink" />}>
            <p className="-mt-1 text-sm text-muted">The KJ runs the rotation in their own system. Send them a song here and you'll see when they've accepted it.</p>
            {data.submissions.length ? (
              <div className="space-y-2">
                {data.submissions.map((q) => (
                  <div key={q.id} className={cx('flex items-center gap-3 rounded-2xl border p-3', q.status === 'accepted' ? 'border-live/30 bg-live/5' : 'border-pink/30 bg-pink/5')}>
                    {q.status === 'accepted' ? <CheckCircle2 className="size-5 shrink-0 text-live" /> : <Clock3 className="size-5 shrink-0 text-pink" />}
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{q.song.title}</div>
                      <div className="truncate text-xs text-muted">
                        {q.song.artist} · {q.status === 'accepted' ? `accepted ${ago(q.decidedAt ?? q.createdAt)}${q.source === 'kj' ? ' · picked by the KJ' : ''}` : `sent ${ago(q.createdAt)}`}
                      </div>
                    </div>
                    <Pill tone={q.status === 'accepted' ? 'live' : 'pink'}>{q.status === 'accepted' ? 'Accepted' : 'Submitted'}</Pill>
                    {q.status === 'submitted' && (
                      <button onClick={() => withdraw.mutate(q.id)} className="text-faint hover:text-fg" aria-label="Withdraw">
                        <X className="size-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon="🎶" title="No songs sent yet" body={data.kj ? 'Search the song book or pick from your list below.' : 'Songs open up when the KJ checks in.'} />
            )}
          </Section>

          <Section
            title="Send a song"
            icon={<Mic2 className="size-5 text-violet" />}
            action={!canSubmit && data.kjSessionId ? <span className="text-xs text-muted">3 waiting max</span> : undefined}
          >
            {hasBookInfo && data.kj && (
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface/70 px-4 py-3 text-sm">
                <Toggle on={onlyKjBook} onChange={setOnlyKjBook} label="Only songs the KJ has" />
                <span className="flex-1">
                  Only songs in <b>{data.kj.displayName}</b>'s song book
                  {onlyKjBook && hidden > 0 && <span className="text-muted"> · {hidden} hidden</span>}
                </span>
              </div>
            )}
            {data.kj && (
              <SongBookSearch
                kj={data.kj}
                action={(id) => (
                  <Button size="sm" disabled={!canSubmit || sent.has(id)} onClick={() => submit.mutate({ songId: id, source: 'search' })}>
                    <Send className="size-3.5" /> {sent.has(id) ? 'Sent' : 'Send'}
                  </Button>
                )}
              />
            )}
            <Card className="max-h-[420px] divide-y divide-line overflow-y-auto">
              {list.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                  {s.isGoTo ? <Star className="size-4 shrink-0 fill-gold text-gold" /> : <span className="size-4 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{s.title}</div>
                    <div className="truncate text-xs text-muted">
                      {s.artist}
                      {s.inKjBook === false && ' · not in this KJ’s book'}
                    </div>
                  </div>
                  <Button size="sm" disabled={!canSubmit || sent.has(s.id)} onClick={() => submit.mutate({ songId: s.id, source: 'list' })}>
                    <Send className="size-3.5" /> {sent.has(s.id) ? 'Sent' : 'Send'}
                  </Button>
                </div>
              ))}
              {!list.length && (
                <div className="p-4 text-sm text-muted">{data.kj ? `Nothing from your list yet. Search ${data.kj.displayName}'s song book above.` : 'No songs here yet. Add some on your Song List.'}</div>
              )}
            </Card>
            <Link to="/songs" className="block text-xs text-muted hover:text-fg">
              + Add songs to your list
            </Link>
          </Section>
        </div>

        <aside className="space-y-6">
          <SongRoulette
            pool={list}
            kjId={data.kj?.id}
            action={(s) => (
              <Button variant="live" disabled={!canSubmit || sent.has(s.id)} onClick={() => submit.mutate({ songId: s.id, source: 'roulette' })}>
                <Send className="size-4" /> Send to KJ
              </Button>
            )}
          />
          {venue && (
            <Card className="p-5">
              <div className="flex items-center gap-2 font-semibold">
                <Award className="size-4 text-gold" /> Rate tonight
              </div>
              <p className="mt-1 text-sm text-muted">Positive badges only. They help other singers pick a great night.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setRate({ id: venue.venue.ownerId, displayName: venue.venue.name, handle: venue.venue.ownerHandle ?? venue.venue.slug })}>
                  Rate {venue.venue.name}
                </Button>
                {data.kj && (
                  <Button size="sm" onClick={() => setRate(data.kj!)}>
                    Rate {data.kj.displayName}
                  </Button>
                )}
              </div>
              <div className="mt-4 border-t border-line pt-3 text-xs text-muted">
                {venue.myVisits >= venue.regularAfter ? (
                  <span className="text-gold">⭐ You're a Regular here ({venue.myVisits} nights)</span>
                ) : (
                  <>
                    {venue.myVisits} of {venue.regularAfter} nights to become a Regular here
                  </>
                )}
              </div>
            </Card>
          )}
          {venue && venue.here.length > 0 && (
            <Section title="In the room">
              <div className="flex flex-wrap gap-2">
                {venue.here
                  .filter((u) => u.id !== me?.id)
                  .slice(0, 18)
                  .map((u) => (
                    <button key={u.id} onClick={() => u.role === 'singer' && setPraiseTo(u)} title={`Praise ${u.displayName}`} className="transition hover:scale-110">
                      <Avatar user={u} size="md" />
                    </button>
                  ))}
              </div>
              <p className="text-xs text-faint">Tap someone to send them praise.</p>
            </Section>
          )}
        </aside>
      </div>
      {praiseTo && <PraiseSheet open onClose={() => setPraiseTo(null)} to={praiseTo} venueId={data.venue.id} />}
      {rate && <AwardBadgeSheet open onClose={() => setRate(null)} to={rate} />}
    </div>
  );
}

/** Singers new to the app have no list yet: let them find a song in the KJ's book and send it straight away. */
function SongBookSearch({ kj, action }: { kj: { id: string; displayName: string }; action: (songId: string) => React.ReactNode }) {
  const [q, setQ] = useState('');
  const dq = useDebounced(q.trim());
  const search = useQuery({
    queryKey: ['song-search', dq, kj.id],
    queryFn: () => unwrap(api.songs.search.$get({ query: { q: dq, kjId: kj.id } })),
    enabled: dq.length > 1,
  });
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute top-3 left-4 size-4 text-faint" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${kj.displayName}'s song book…`} aria-label="Search the KJ's song book" className="h-11 w-full !rounded-2xl pl-11 text-sm" />
        {search.isFetching && <Spinner className="absolute top-3 right-4" />}
      </div>
      {dq.length > 1 && search.data && (
        <Card className="max-h-72 divide-y divide-line overflow-y-auto">
          {search.data.map((s) => (
            <div key={s.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{s.title}</div>
                <div className="truncate text-xs text-muted">{s.artist}</div>
              </div>
              {action(s.id)}
            </div>
          ))}
          {!search.data.length && <div className="p-4 text-sm text-muted">No match in {kj.displayName}'s song book.</div>}
        </Card>
      )}
    </div>
  );
}

function NotCheckedIn() {
  const loc = useLocation();
  const { data } = useVenues({ lat: loc.current.lat, lng: loc.current.lng, radiusMi: 20, liveOnly: true });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold">
          Your <span className="text-gradient">night</span>
        </h1>
        <p className="mt-1 text-muted">Check in at a venue to send songs to the KJ, spin Song Roulette and see who's in the room.</p>
      </div>
      <Card className="flex flex-wrap items-center gap-4 p-5">
        <div className="text-4xl">📍</div>
        <div className="flex-1 text-sm text-muted">
          Walk into a venue and Karaoke Scene offers to check you in automatically, or scan the QR code by the stage.{DEMO && <> For the demo, use <b className="text-fg">Demo controls → Stand inside venue</b>.</>}
        </div>
        <Link to="/scan">
          <Button variant="primary">Scan venue QR</Button>
        </Link>
      </Card>
      <Section title="Live right now">
        {data?.venues.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {data.venues.map((v) => (
              <VenueCard key={v.id} v={v} />
            ))}
          </div>
        ) : (
          <EmptyState icon="🌙" title="Nothing live right now" body={DEMO ? 'Time-travel to a Friday night from Demo controls to see the scene in action.' : 'Check back tonight, or browse upcoming nights on Discover.'} />
        )}
      </Section>
    </div>
  );
}

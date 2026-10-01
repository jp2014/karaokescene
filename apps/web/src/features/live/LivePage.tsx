import { Link } from '@tanstack/react-router';
import { motion } from 'motion/react';
import { LogOut, MessageCircleHeart, Mic2, Music2, Send, Star, X } from 'lucide-react';
import { useState } from 'react';
import { Avatar } from '~/components/Avatar';
import { BusyMeter } from '~/components/BusyMeter';
import { Button, Card, cx, EmptyState, LiveDot, PageLoader, Pill, Section } from '~/components/ui';
import { VenueArt } from '~/components/VenueArt';
import { VenueCard } from '~/features/discover/VenueCard';
import { PraiseSheet } from '~/features/profile/ProfileActions';
import { SongRoulette } from '~/features/songs/SongRoulette';
import { api, unwrap } from '~/lib/api';
import { duration, serverNow } from '~/lib/format';
import { useLocation } from '~/lib/location';
import { qk, useAction, useMe, useMyLive, useMySongs, useVenue, useVenues } from '~/lib/queries';

/** The singer's "I'm here" screen: the rotation, my requests, roulette and who's in the room. */
export function LivePage() {
  const { data, isLoading } = useMyLive();
  if (isLoading) return <PageLoader />;
  if (!data?.checkin || !data.venue) return <NotCheckedIn />;
  return <LiveNight data={data as LiveData} />;
}

type LiveData = NonNullable<ReturnType<typeof useMyLive>['data']> & { venue: NonNullable<NonNullable<ReturnType<typeof useMyLive>['data']>['venue']>; checkin: NonNullable<NonNullable<ReturnType<typeof useMyLive>['data']>['checkin']> };

function LiveNight({ data }: { data: LiveData }) {
  const { data: songs } = useMySongs();
  const { data: venue } = useVenue(data.venue.slug);
  const { data: me } = useMe();
  const [praiseTo, setPraiseTo] = useState<{ id: string; displayName: string; handle: string } | null>(null);
  const inv = [qk.myLive, qk.me, ['venues'], qk.venue(data.venue.slug)];
  const request = useAction((x: { songId: string; source: 'list' | 'roulette' | 'search' }) => unwrap(api.live.requests.$post({ json: x })), { invalidate: inv, success: 'Sent to the KJ 🎤' });
  const cancel = useAction((id: string) => unwrap(api.live.requests[':id'].$delete({ param: { id } })), { invalidate: inv, success: 'Request withdrawn' });
  const checkOut = useAction(() => unwrap(api.presence['check-out'].$post()), { invalidate: inv, success: 'Checked out. Thanks for singing!' });

  const myQueued = data.queue.filter((q) => q.isMine);
  const up = data.queue.find((q) => q.status === 'up');
  const waiting = data.queue.filter((q) => q.status === 'queued');
  const myPos = waiting.findIndex((q) => q.isMine);
  const canRequest = !!data.kjSessionId && myQueued.filter((q) => q.status === 'queued').length < 2;
  const requested = new Set(myQueued.map((q) => q.song.id));

  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden">
        <VenueArt name={data.venue.name} hue={data.venue.hue} big className="absolute inset-0 opacity-50" />
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
                  <Avatar user={data.kj} size="xs" /> {data.kj.displayName} is running the show
                </span>
              ) : (
                <span>The KJ hasn't started yet. Requests open when they go live.</span>
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
          {/* Now singing + my position */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="p-5">
              <div className="text-xs font-bold tracking-widest text-muted uppercase">On stage</div>
              {up ? (
                <div className="mt-3 flex items-center gap-3">
                  <motion.div animate={{ rotate: [0, -6, 6, 0] }} transition={{ repeat: Infinity, duration: 1.6 }}>
                    <Avatar user={up.singer} size="lg" />
                  </motion.div>
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{up.isMine ? 'You! 🎤' : up.singer.displayName}</div>
                    <div className="truncate text-sm text-muted">
                      {up.song.title} · {up.song.artist}
                    </div>
                    {!up.isMine && up.singer.role === 'singer' && (
                      <button onClick={() => setPraiseTo(up.singer)} className="mt-1 flex items-center gap-1 text-xs font-semibold text-pink">
                        <MessageCircleHeart className="size-3.5" /> Send praise
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-muted">Between songs</div>
              )}
            </Card>
            <Card className={cx('p-5', myPos >= 0 && 'border-pink/40')} glow={myPos >= 0 && myPos < 2 ? 'pink' : undefined}>
              <div className="text-xs font-bold tracking-widest text-muted uppercase">Your turn</div>
              {up?.isMine ? (
                <div className="mt-2 font-display text-3xl font-bold text-gradient">You're up!</div>
              ) : myPos >= 0 ? (
                <>
                  <div className="mt-2 font-display text-4xl font-bold">{myPos === 0 ? 'Next!' : `#${myPos + 1}`}</div>
                  <div className="text-sm text-muted">{myPos === 0 ? 'Head toward the stage' : `${myPos} singer${myPos > 1 ? 's' : ''} ahead of you`}</div>
                </>
              ) : (
                <div className="mt-2 text-muted">Pick a song below to get in the rotation.</div>
              )}
            </Card>
          </div>

          {myQueued.length > 0 && (
            <Section title="Your requests">
              <div className="space-y-2">
                {myQueued.map((q) => (
                  <div key={q.id} className="flex items-center gap-3 rounded-2xl border border-pink/30 bg-pink/5 p-3">
                    <Music2 className="size-5 text-pink" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{q.song.title}</div>
                      <div className="truncate text-xs text-muted">{q.song.artist}</div>
                    </div>
                    <Pill tone={q.status === 'up' ? 'live' : 'pink'}>{q.status === 'up' ? 'On stage' : 'Queued'}</Pill>
                    {q.status === 'queued' && (
                      <button onClick={() => cancel.mutate(q.id)} className="text-faint hover:text-fg" aria-label="Withdraw">
                        <X className="size-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          <Section title="Request from your list" icon={<Mic2 className="size-5 text-violet" />} action={!canRequest && data.kjSessionId ? <span className="text-xs text-muted">Max 2 in the rotation</span> : undefined}>
            <Card className="max-h-[420px] divide-y divide-line overflow-y-auto">
              {songs?.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                  {s.isGoTo ? <Star className="size-4 shrink-0 fill-gold text-gold" /> : <span className="size-4 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{s.title}</div>
                    <div className="truncate text-xs text-muted">{s.artist}</div>
                  </div>
                  <Button size="sm" disabled={!canRequest || requested.has(s.id)} onClick={() => request.mutate({ songId: s.id, source: 'list' })}>
                    <Send className="size-3.5" /> {requested.has(s.id) ? 'Requested' : 'Request'}
                  </Button>
                </div>
              ))}
            </Card>
          </Section>
        </div>

        <aside className="space-y-6">
          <SongRoulette
            pool={songs ?? []}
            kjId={data.kj?.id}
            action={(s) => (
              <Button variant="live" disabled={!canRequest} onClick={() => request.mutate({ songId: s.id, source: 'roulette' })}>
                <Send className="size-4" /> Send to KJ
              </Button>
            )}
          />
          <Section title="The rotation">
            <Card className="divide-y divide-line">
              {waiting.slice(0, 8).map((q, i) => (
                <div key={q.id} className={cx('flex items-center gap-3 px-4 py-2.5', q.isMine && 'bg-pink/10')}>
                  <span className="w-5 text-center text-xs font-bold text-faint">{i + 1}</span>
                  <Avatar user={q.singer} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{q.isMine ? 'You' : q.singer.displayName}</div>
                    <div className="truncate text-xs text-muted">{q.song.title}</div>
                  </div>
                </div>
              ))}
              {!waiting.length && <div className="p-4 text-sm text-muted">The rotation is empty. Be the first!</div>}
            </Card>
          </Section>
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
        <p className="mt-1 text-muted">Check in at a venue to join the rotation, spin Song Roulette and see who's in the room.</p>
      </div>
      <Card className="flex flex-wrap items-center gap-4 p-5">
        <div className="text-4xl">📍</div>
        <div className="flex-1 text-sm text-muted">
          Walk into a venue and Karaoke Scene offers to check you in automatically, or scan the QR code by the stage. For the demo, use <b className="text-fg">Demo controls → Stand inside venue</b>.
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
          <EmptyState icon="🌙" title="Nothing live right now" body="Time-travel to a Friday night from Demo controls to see the scene in action." />
        )}
      </Section>
    </div>
  );
}

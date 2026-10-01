import { Link } from '@tanstack/react-router';
import { AnimatePresence, motion } from 'motion/react';
import { Award, BookOpen, Check, ChevronRight, DoorOpen, Mic2, Play, Power, SkipForward, Star, Users } from 'lucide-react';
import { useState } from 'react';
import { Avatar } from '~/components/Avatar';
import { BadgeMedal } from '~/components/Badge';
import { Button, Card, cx, EmptyState, LiveDot, PageLoader, Pill, Section, Stat } from '~/components/ui';
import { VenueArt } from '~/components/VenueArt';
import { AwardBadgeSheet } from '~/features/profile/ProfileActions';
import { AutoPostCard } from '~/features/promo/AutoPostCard';
import { api, unwrap } from '~/lib/api';
import { ago, duration, serverNow, timeLabel } from '~/lib/format';
import { qk, useAction, useBooth, type Booth } from '~/lib/queries';
import { SongbookCard } from './SongbookCard';

export function KjBoothPage() {
  const { data, isLoading } = useBooth();
  if (isLoading || !data) return <PageLoader />;
  return data.session && data.venue ? <LiveBooth b={data as LiveBoothData} /> : <StartShow b={data} />;
}

type LiveBoothData = Booth & { session: NonNullable<Booth['session']>; venue: NonNullable<Booth['venue']> };

function StartShow({ b }: { b: Booth }) {
  const start = useAction((venueId: string) => unwrap(api.presence.kj.start.$post({ json: { venueId } })), {
    invalidate: [qk.booth, qk.me, ['venues']],
    success: "You're live! Fans who favorited you just got a ping 🎧",
  });
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold">
          KJ <span className="text-gradient">Booth</span>
        </h1>
        <p className="mt-1 text-muted">Go live at a venue to turn on “KJ Now”, open requests and see who walks in.</p>
      </div>
      <Section title="Your venues">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {b.venues.map((v) => (
            <Card key={v.id} className="overflow-hidden">
              <VenueArt name={v.name} hue={v.hue} className="h-28" />
              <div className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{v.name}</div>
                  <div className="text-xs text-muted">{v.neighborhood}</div>
                </div>
                <Button variant="live" onClick={() => start.mutate(v.id)} loading={start.isPending && start.variables === v.id}>
                  <Power className="size-4" /> Go live
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </Section>
      <div className="grid gap-6 lg:grid-cols-2">
        <SongbookCard />
        <AutoPostCard venues={b.venues} />
      </div>
    </div>
  );
}

function LiveBooth({ b }: { b: LiveBoothData }) {
  const [awardTo, setAwardTo] = useState<{ id: string; displayName: string; handle: string } | null>(null);
  const inv = [qk.booth];
  const end = useAction(() => unwrap(api.presence.kj.end.$post()), { invalidate: [qk.booth, qk.me, ['venues']], success: 'Show ended. Great night! 🌙' });
  const setStatus = useAction((x: { id: string; status: 'up' | 'done' | 'skipped' | 'queued' }) => unwrap(api.live.requests[':id'].status.$put({ param: { id: x.id }, json: { status: x.status } })), { invalidate: inv });
  const pull = useAction((x: { singerId: string; songId: string }) => unwrap(api.live.pull.$post({ json: x })), { invalidate: inv, success: 'Added to the rotation' });

  const up = b.queue.find((q) => q.status === 'up');
  const waiting = b.queue.filter((q) => q.status === 'queued');
  const done = b.queue.filter((q) => q.status === 'done');
  const queuedSingers = new Set(waiting.map((q) => q.singerId));

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="relative overflow-hidden" glow="cyan">
        <VenueArt name={b.venue.name} hue={b.venue.hue} big className="absolute inset-0 opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/85 to-ink/40" />
        <div className="relative flex flex-wrap items-center gap-4 p-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-live uppercase">
              <LiveDot /> KJ Now · live since {timeLabel(b.session.startedAt)}
            </div>
            <Link to="/venues/$slug" params={{ slug: b.venue.slug }} className="mt-1 block font-display text-3xl font-extrabold hover:underline">
              {b.venue.name}
            </Link>
          </div>
          <Button variant="danger" onClick={() => end.mutate(undefined)} loading={end.isPending}>
            <Power className="size-4" /> End show
          </Button>
        </div>
        <div className="relative grid grid-cols-2 gap-3 px-6 pb-6 sm:grid-cols-4">
          <Stat label="In the room" value={b.singers.length} />
          <Stat label="In rotation" value={waiting.length} accent="text-pink" />
          <Stat label="Sung tonight" value={done.length} />
          <Stat label="On for" value={duration(serverNow() - b.session.startedAt)} />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_340px]">
        {/* Rotation */}
        <Section className="min-w-0" title="Rotation" icon={<Mic2 className="size-5 text-pink" />}>
          <Card className={cx('p-5', up && 'border-live/40 bg-live/5')}>
            <div className="text-xs font-bold tracking-widest text-muted uppercase">On stage</div>
            {up ? (
              <div className="mt-3 flex items-center gap-3">
                <Avatar user={up.singer} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display text-lg font-bold">{up.singer.displayName}</div>
                  <div className="truncate text-sm text-muted">
                    {up.song.title} · {up.song.artist}
                  </div>
                </div>
                <Button variant="live" size="sm" onClick={() => (waiting[0] ? setStatus.mutate({ id: waiting[0].id, status: 'up' }) : setStatus.mutate({ id: up.id, status: 'done' }))}>
                  {waiting[0] ? (
                    <>
                      Next <ChevronRight className="size-4" />
                    </>
                  ) : (
                    <>
                      <Check className="size-4" /> Done
                    </>
                  )}
                </Button>
              </div>
            ) : waiting[0] ? (
              <Button variant="live" className="mt-3 w-full" onClick={() => setStatus.mutate({ id: waiting[0].id, status: 'up' })}>
                <Play className="size-4" /> Call up {waiting[0].singer.displayName.split(' ')[0]}
              </Button>
            ) : (
              <div className="mt-2 text-sm text-muted">Nobody's up. Pull someone from the room →</div>
            )}
          </Card>
          <Card className="divide-y divide-line">
            <AnimatePresence initial={false}>
              {waiting.map((q, i) => (
                <motion.div key={q.id} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="flex items-center gap-3 px-4 py-3">
                  <span className="w-5 text-center text-xs font-bold text-faint">{i + 1}</span>
                  <Avatar user={q.singer} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{q.singer.displayName}</div>
                    <div className="truncate text-xs text-muted">
                      {q.song.title} · {q.song.artist}
                    </div>
                  </div>
                  {q.source === 'roulette' && <Pill tone="violet">Roulette</Pill>}
                  <button onClick={() => setStatus.mutate({ id: q.id, status: 'up' })} className="text-faint hover:text-live" title="Call up now">
                    <Play className="size-4" />
                  </button>
                  <button onClick={() => setStatus.mutate({ id: q.id, status: 'skipped' })} className="text-faint hover:text-danger" title="Skip">
                    <SkipForward className="size-4" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
            {!waiting.length && <div className="p-4 text-sm text-muted">Rotation is empty.</div>}
          </Card>
        </Section>

        {/* Room */}
        <Section className="min-w-0" title={`In the room · ${b.singers.length}`} icon={<Users className="size-5 text-cyan" />}>
          <div className="space-y-2">
            {b.singers.map((s) => (
              <Card key={s.id} className={cx('p-3', s.ghost && 'border-dashed')}>
                <div className="flex items-center gap-3">
                  <Avatar user={s} ghost={s.ghost} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 truncate font-semibold">
                      {s.ghost ? `👻 ${s.displayName}` : s.displayName}
                      {queuedSingers.has(s.id) && <span className="size-1.5 rounded-full bg-pink" title="In rotation" />}
                    </div>
                    <div className="text-xs text-muted">
                      here {ago(s.checkedInAt)} · {s.listSize} songs{s.method === 'qr' ? ' · scanned in' : s.method === 'geo' ? ' · auto check-in' : ''}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {s.badges.slice(0, 2).map((badge) => (
                      <span key={badge.key} title={`${badge.label} ×${badge.count}`}>
                        <BadgeMedal badge={badge} size="sm" />
                      </span>
                    ))}
                  </div>
                  <Button size="icon" variant="ghost" className="!size-8 text-gold" onClick={() => setAwardTo(s)} title="Award a badge">
                    <Award className="size-4" />
                  </Button>
                </div>
                {s.goTo.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {s.goTo.map((song) => (
                      <button
                        key={song.id}
                        onClick={() => pull.mutate({ singerId: s.id, songId: song.id })}
                        className="flex items-center gap-1 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-xs transition hover:border-pink/50 hover:text-pink"
                        title="Pull into rotation"
                      >
                        <Star className="size-3 fill-gold text-gold" /> {song.title}
                      </button>
                    ))}
                  </div>
                )}
              </Card>
            ))}
            {!b.singers.length && <EmptyState icon="🪑" title="Room is empty" body="Check-ins appear here the moment singers arrive." />}
          </div>
        </Section>

        {/* Right rail */}
        <div className="grid min-w-0 content-start gap-6 lg:col-span-2 lg:grid-cols-3 2xl:col-span-1 2xl:grid-cols-1">
          <Section title="Auto Leave" icon={<DoorOpen className="size-5 text-gold" />}>
            <Card className="divide-y divide-line">
              {b.departures.map((d, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <Avatar user={d.user} size="sm" />
                  <div className="min-w-0 flex-1 text-sm">
                    <span className="font-semibold">{d.user.displayName}</span> left
                    <div className="text-xs text-muted">{ago(d.at)} · removed from rotation</div>
                  </div>
                </div>
              ))}
              {!b.departures.length && <div className="p-4 text-sm text-muted">When a checked-in singer walks out of range, you'll see it here and their songs drop out of the rotation.</div>}
            </Card>
          </Section>
          <SongbookCard compact />
          <AutoPostCard venues={b.venues} defaultVenueId={b.venue.id} />
        </div>
      </div>
      {awardTo && <AwardBadgeSheet open onClose={() => setAwardTo(null)} to={awardTo} />}
      <p className="text-center text-xs text-faint">
        <BookOpen className="mr-1 inline size-3.5" /> Tip: open another tab as a singer at {b.venue.name} and request a song or walk away. It shows up here within seconds.
      </p>
    </div>
  );
}

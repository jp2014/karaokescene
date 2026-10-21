import { Link } from '@tanstack/react-router';
import { AnimatePresence, motion } from 'motion/react';
import { Award, BookOpen, Check, CheckCircle2, DoorOpen, Inbox, Megaphone, MessageCircleHeart, Power, Star, Users, X } from 'lucide-react';
import { useState } from 'react';
import { Avatar } from '~/components/Avatar';
import { BadgeMedal } from '~/components/Badge';
import { PremiumGate, PremiumPill } from '~/components/Premium';
import { Button, Card, cx, EmptyState, LiveDot, PageLoader, Section, Stat } from '~/components/ui';
import { VenueArt } from '~/components/VenueArt';
import { AwardBadgeSheet, PraiseSheet } from '~/features/profile/ProfileActions';
import { PromoteCard } from '~/features/promo/PromoteCard';
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
        <p className="mt-1 text-muted">Go live at a venue to turn on “KJ Now”, take song submissions and see who walks in.</p>
      </div>
      <Section
        title="Your venues"
        action={
          <Link to="/my-venues" className="text-sm font-semibold text-muted hover:text-fg">
            Manage venues & hours →
          </Link>
        }
      >
        {!b.venues.length && <EmptyState icon="🎤" title="Add your first venue" body="List where you host and set your hours. Then you can go live and take song submissions." action={<Link to="/my-venues" className="text-sm font-semibold text-brand">Add a venue →</Link>} />}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {b.venues.map((v) => (
            <Card key={v.id} className="overflow-hidden">
              <VenueArt name={v.name} hue={v.hue} photoUrl={v.photoUrl} className="h-28" />
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
        <PromoteCard venues={b.venues} />
      </div>
    </div>
  );
}

function LiveBooth({ b }: { b: LiveBoothData }) {
  const [awardTo, setAwardTo] = useState<{ id: string; displayName: string; handle: string } | null>(null);
  const [praiseTo, setPraiseTo] = useState<{ id: string; displayName: string; handle: string } | null>(null);
  const inv = [qk.booth];
  const end = useAction(() => unwrap(api.presence.kj.end.$post()), { invalidate: [qk.booth, qk.me, ['venues']], success: 'Show ended. Great night! 🌙' });
  const decide = useAction((x: { id: string; accept: boolean }) => unwrap(api.live.submissions[':id'].decision.$put({ param: { id: x.id }, json: { accept: x.accept } })), {
    invalidate: inv,
    success: (_, x) => (x.accept ? 'Accepted. The singer got a ✅' : 'Declined'),
  });
  const add = useAction((x: { singerId: string; songId: string }) => unwrap(api.live['add-for-singer'].$post({ json: x })), { invalidate: inv, success: 'Added. The singer got a ping 🎤' });
  const waiting = new Set(b.submitted.map((q) => q.singerId));

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="relative overflow-hidden" glow="cyan">
        <VenueArt name={b.venue.name} hue={b.venue.hue} photoUrl={b.venue.photoUrl} big className="absolute inset-0 opacity-40" />
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
          <Stat label="To review" value={b.submitted.length} accent="text-pink" />
          <Stat label="Accepted tonight" value={b.accepted.length} />
          <Stat label="On for" value={duration(serverNow() - b.session.startedAt)} />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_340px]">
        {/* Submissions */}
        <Section className="min-w-0" title="Submitted songs" icon={<Inbox className="size-5 text-pink" />}>
          <p className="-mt-1 text-sm text-muted">Enter the song in your own KJ software, then tap Accept. The singer gets a ✅. No need to keep the app updated beyond that.</p>
          <Card className="divide-y divide-line">
            <AnimatePresence initial={false}>
              {b.submitted.map((q) => (
                <motion.div key={q.id} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="flex items-center gap-3 px-4 py-3">
                  <Avatar user={q.singer} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">
                      {q.song.title} <span className="font-normal text-muted">· {q.song.artist}</span>
                    </div>
                    <div className="truncate text-xs text-muted">
                      {q.singer.displayName} · {ago(q.createdAt)}
                      {q.source === 'roulette' && ' · 🎲 Roulette'}
                    </div>
                  </div>
                  <Button size="sm" variant="live" onClick={() => decide.mutate({ id: q.id, accept: true })} disabled={decide.isPending}>
                    <Check className="size-4" /> Accept
                  </Button>
                  <button onClick={() => decide.mutate({ id: q.id, accept: false })} className="text-faint hover:text-danger" title="Decline">
                    <X className="size-4" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
            {!b.submitted.length && <div className="p-4 text-sm text-muted">All caught up. New submissions show up here.</div>}
          </Card>
          {b.accepted.length > 0 && (
            <>
              <div className="pt-2 text-xs font-bold tracking-widest text-muted uppercase">Accepted tonight</div>
              <Card className="divide-y divide-line">
                {b.accepted.slice(0, 12).map((q) => (
                  <div key={q.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <CheckCircle2 className="size-4 shrink-0 text-live" />
                    <span className="min-w-0 flex-1 truncate">
                      <b>{q.song.title}</b> <span className="text-muted">· {q.singer.displayName}</span>
                    </span>
                    <span className="text-xs text-faint">{ago(q.decidedAt ?? q.createdAt)}</span>
                  </div>
                ))}
              </Card>
            </>
          )}
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
                      {waiting.has(s.id) && <span className="size-1.5 rounded-full bg-pink" title="Has a song waiting" />}
                    </div>
                    <div className="text-xs text-muted">
                      here {ago(s.checkedInAt)} · {s.listSize} songs{s.method === 'qr' ? ' · scanned in' : s.method === 'geo' ? ' · auto check-in' : ''}
                    </div>
                  </div>
                  <div className="hidden gap-1 sm:flex">
                    {s.badges.slice(0, 2).map((badge) => (
                      <span key={badge.key} title={`${badge.label} ×${badge.count}`}>
                        <BadgeMedal badge={badge} size="sm" />
                      </span>
                    ))}
                  </div>
                  {!s.ghost && (
                    <Button size="icon" variant="ghost" className="!size-8 text-pink" onClick={() => setPraiseTo(s)} title="Send praise">
                      <MessageCircleHeart className="size-4" />
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" className="!size-8 text-gold" onClick={() => setAwardTo(s)} title="Award a badge">
                    <Award className="size-4" />
                  </Button>
                </div>
                {s.goTo.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {s.goTo.map((song) => (
                      <button
                        key={song.id}
                        onClick={() => add.mutate({ singerId: s.id, songId: song.id })}
                        className="flex items-center gap-1 rounded-full border border-line bg-surface-2 px-2.5 py-1 text-xs transition hover:border-pink/50 hover:text-pink"
                        title="Add this song for them"
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
          <Section title="Auto Leave" icon={<DoorOpen className="size-5 text-gold" />} action={<PremiumPill role="kj" />}>
            <PremiumGate feature="Auto Leave" blurb="Know the moment a singer walks out, and their waiting songs are withdrawn for you." teaser={false}>
              <Card className="divide-y divide-line">
                {b.departures.map((d, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <Avatar user={d.user} size="sm" />
                    <div className="min-w-0 flex-1 text-sm">
                      <span className="font-semibold">{d.user.displayName}</span> left
                      <div className="text-xs text-muted">{ago(d.at)} · waiting songs withdrawn</div>
                    </div>
                  </div>
                ))}
                {!b.departures.length && <div className="p-4 text-sm text-muted">When a checked-in singer walks out of range, you'll see it here and their waiting songs are withdrawn.</div>}
              </Card>
            </PremiumGate>
          </Section>
          <MessageBlastCard />
          <SongbookCard compact />
          <PromoteCard venues={[b.venue, ...b.venues.filter((x) => x.id !== b.venue.id)]} />
        </div>
      </div>
      {awardTo && <AwardBadgeSheet open onClose={() => setAwardTo(null)} to={awardTo} />}
      {praiseTo && <PraiseSheet open onClose={() => setPraiseTo(null)} to={praiseTo} venueId={b.venue.id} />}
      <p className="text-center text-xs text-faint">
        <BookOpen className="mr-1 inline size-3.5" /> Tip: singers checked in at {b.venue.name} can send songs from My Night. Submissions appear here within seconds.
      </p>
    </div>
  );
}

/** Message Blast (KJ Pro): one message to everyone who follows you or sings at your venues. */
function MessageBlastCard() {
  const [message, setMessage] = useState('');
  const blast = useAction(() => unwrap(api.promo.blast.$post({ json: { message } })), {
    success: (r) => `Sent to ${r.sent} singers 📣`,
    onSuccess: () => setMessage(''),
  });
  return (
    <Section title="Message Blast" icon={<Megaphone className="size-5 text-pink" />} action={<PremiumPill role="kj" />}>
      <PremiumGate feature="Message Blast" blurb="Message every singer who follows you or has sung at your venues lately.">
        <Card className="space-y-3 p-4">
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={280} className="w-full text-sm" placeholder="🎤 Just added 300 new songs to the book! See you Friday at The Neon Mic." />
          <Button size="sm" variant="primary" className="w-full" disabled={message.trim().length < 3} loading={blast.isPending} onClick={() => blast.mutate(undefined)}>
            <Megaphone className="size-4" /> Send to my singers
          </Button>
        </Card>
      </PremiumGate>
    </Section>
  );
}

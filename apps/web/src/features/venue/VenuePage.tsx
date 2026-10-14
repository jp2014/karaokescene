import { Link, useNavigate, useParams, useRouter } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Award, BadgeCheck, CalendarDays, Camera, Check, Clock, FileText, Heart, LogOut, MapPin, Martini, QrCode, Settings2, Share2, Star, Trophy, Users, UtensilsCrossed } from 'lucide-react';
import { useState } from 'react';
import { Avatar, AvatarStack } from '~/components/Avatar';
import { BadgeGrid, BadgeMedal } from '~/components/Badge';
import { FilePicker } from '~/components/FilePicker';
import { AwardBadgeSheet } from '~/features/profile/ProfileActions';
import { BusyMeter } from '~/components/BusyMeter';
import { QrCard, qrUrl } from '~/components/QrCard';
import { ShareSheet } from '~/components/ShareSheet';
import { Button, Card, cx, EmptyState, LiveDot, PageLoader, Pill, Section, Sheet } from '~/components/ui';
import { GalleryTile, VenueArt } from '~/components/VenueArt';
import { api, unwrap } from '~/lib/api';
import { ago, DAYS, DAYS_LONG, dateLabel, duration, hoursLabel, SCENE_TZ, serverNow, timeLabel } from '~/lib/format';
import { qk, useAction, useMe, useVenue, type VenueDetail } from '~/lib/queries';
import { useLiveQueries } from '~/lib/realtime';
import { demoClaim } from '~/lib/demo';
import { PeakHours } from './PeakHours';

const EVENT_TONE = { karaoke: 'violet', competition: 'gold', theme: 'pink', scene: 'cyan' } as const;

export function VenuePage() {
  const { slug } = useParams({ from: '/venues/$slug' });
  const { data: d, isLoading } = useVenue(slug);
  useLiveQueries(d ? `venue:${d.venue.id}` : null, [qk.venue(slug)]);
  const { data: me } = useMe();
  const router = useRouter();
  const [share, setShare] = useState(false);
  const [qr, setQr] = useState(false);
  const inv = [qk.venue(slug), qk.me, ['venues'], qk.myLive];

  const checkIn = useAction(() => unwrap(api.presence['check-in'].$post({ json: { venueId: d!.venue.id, method: 'manual' } })), { invalidate: inv, success: `Checked in. Have a great night! 🎤` });
  const checkOut = useAction(() => unwrap(api.presence['check-out'].$post()), { invalidate: inv, success: 'Checked out. See you next time!' });
  const fav = useAction((on: boolean) => unwrap(api.social.favorites[':type'][':id'].$put({ param: { type: 'venue', id: d!.venue.id }, json: { on } })), {
    invalidate: [qk.venue(slug), ['venues'], qk.circle],
    success: (r) => (r.favorited ? 'Added to favorites' : 'Removed from favorites'),
  });

  if (isLoading || !d) return <PageLoader />;
  const v = d.venue;
  const nowHour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: SCENE_TZ }).format(new Date(serverNow())));
  const tonight = d.schedule.find((n) => n.isLive) ?? d.schedule.find((n) => n.dayOfWeek === new Date(serverNow()).getDay());

  return (
    <div className="-mx-4 -mt-6 sm:-mx-6 lg:-mx-10 lg:-mt-10">
      {/* Hero */}
      <div className="relative h-72 overflow-hidden sm:h-80">
        <VenueArt name={v.name} hue={v.hue} photoUrl={v.photoUrl} big className="absolute inset-0" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent" />
        <div className="absolute top-4 left-4 flex gap-2 sm:left-6 lg:left-10">
          <Button variant="secondary" size="icon" className="glass" onClick={() => router.history.back()} aria-label="Back">
            <ArrowLeft className="size-5" />
          </Button>
        </div>
        <div className="absolute inset-x-0 bottom-0 px-4 pb-5 sm:px-6 lg:px-10">
          <div className="flex flex-wrap items-center gap-2">
            {d.kjNow ? (
              <Pill tone="live">
                <LiveDot className="scale-75" /> KJ Now
              </Pill>
            ) : d.isLive ? (
              <Pill tone="cyan">Karaoke on now</Pill>
            ) : null}
            {v.isPremiere && (
              <Pill tone="gold">
                <Star className="size-3 fill-current" /> Premier
              </Pill>
            )}
            {v.venueTypes.map((x) => (
              <Pill key={x} tone="cyan">
                {x}
              </Pill>
            ))}
            {v.vibes.map((x) => (
              <Pill key={x} tone="muted">
                {x}
              </Pill>
            ))}
            {me?.role === 'singer' && d.myVisits >= d.regularAfter && <Pill tone="gold">⭐ You're a Regular</Pill>}
          </div>
          <h1 className="mt-2 text-4xl font-extrabold sm:text-5xl">{v.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-muted">
            <span className="text-fg/90 italic">“{v.tagline}”</span>
            <span className="flex items-center gap-1">
              <MapPin className="size-3.5" /> {v.address}, {v.neighborhood}
            </span>
          </p>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-10">
        {/* Action bar */}
        <div className="flex flex-wrap items-center gap-2 py-4">
          {me?.role === 'singer' &&
            (d.myCheckin ? (
              <>
                <Link to="/live">
                  <Button variant="live" size="lg">
                    <LiveDot color="bg-ink" /> You're here · open My Night
                  </Button>
                </Link>
                <Button variant="ghost" onClick={() => checkOut.mutate(undefined)} loading={checkOut.isPending}>
                  <LogOut className="size-4" /> Check out
                </Button>
              </>
            ) : (
              <Button variant="primary" size="lg" onClick={() => checkIn.mutate(undefined)} loading={checkIn.isPending}>
                <Check className="size-5" /> Check in
              </Button>
            ))}
          {d.canManage && (
            <Link to="/hq">
              <Button variant="primary" size="lg">
                <Settings2 className="size-5" /> Manage in Venue HQ
              </Button>
            </Link>
          )}
          <Button size="lg" onClick={() => fav.mutate(!d.isFavorite)} className={cx(d.isFavorite && 'text-pink')}>
            <Heart className={cx('size-5', d.isFavorite && 'fill-current')} /> {d.isFavorite ? 'Favorited' : 'Favorite'}
          </Button>
          <Button size="lg" onClick={() => setShare(true)}>
            <Share2 className="size-5" /> Share
          </Button>
          <Button size="lg" variant="ghost" onClick={() => setQr(true)}>
            <QrCode className="size-5" /> QR
          </Button>
        </div>

        {!v.claimed && <ClaimBanner d={d} />}

        <div className="grid gap-6 [&>*]:min-w-0 lg:grid-cols-[1fr_340px]">
          <div className="space-y-8">
            <TonightCard d={d} tonight={tonight} />
            <WhosHere d={d} />
            {d.whosGoing && <WhosGoing d={d} going={d.whosGoing} />}
            {d.peakHours && (
              <Section title="Peak hours" icon={<Users className="size-5 text-violet" />}>
                <Card className="p-5">
                  <PeakHours data={d.peakHours} currentHour={nowHour} />
                </Card>
              </Section>
            )}
            <Ratings d={d} />
            <Events d={d} />
            <Gallery d={d} />
          </div>
          <aside className="space-y-6">
            <VenueInfo d={d} />
            <Specials d={d} />
            <Section title="Weekly karaoke" icon={<CalendarDays className="size-5 text-cyan" />}>
              <Card className="divide-y divide-line">
                {d.schedule.map((n) => (
                  <div key={n.id} className={cx('flex items-center gap-3 px-4 py-3 text-sm', n.isLive && 'bg-live/5')}>
                    <span className={cx('w-10 font-semibold', n.isLive ? 'text-live' : 'text-muted')}>{DAYS[n.dayOfWeek]}</span>
                    <span className="flex-1">{hoursLabel(n.startMin, n.endMin)}</span>
                    {n.kj && (
                      <Link to="/u/$handle" params={{ handle: n.kj.handle }} className="flex items-center gap-1.5 text-xs text-muted hover:text-fg">
                        <Avatar user={n.kj} size="xs" /> {n.kj.displayName}
                      </Link>
                    )}
                  </div>
                ))}
              </Card>
            </Section>
            <Section title="KJs who host here">
              <div className="space-y-2">
                {d.kjs.map((k) => (
                  <Link key={k.id} to="/u/$handle" params={{ handle: k.handle }} className="block rounded-2xl border border-line bg-surface/70 p-3 transition hover:border-line-strong">
                    <div className="flex items-center gap-3">
                      <Avatar user={k} />
                      <div className="min-w-0 flex-1 font-semibold">{k.displayName}</div>
                    </div>
                    <div className="mt-2 flex gap-1.5">
                      {k.badges.map((b) => (
                        <span key={b.key} title={`${b.label} ×${b.count}`}>
                          <BadgeMedal badge={b} size="sm" />
                        </span>
                      ))}
                    </div>
                  </Link>
                ))}
              </div>
            </Section>
            <p className="px-1 text-sm text-muted">{v.description}</p>
          </aside>
        </div>
      </div>

      <ShareSheet open={share} onClose={() => setShare(false)} title={`Share ${v.name}`} text={`🎤 Karaoke tonight at ${v.name}! ${tonight ? hoursLabel(tonight.startMin, tonight.endMin) : ''} Who's coming? #KaraokeScene`} url={qrUrl('v', v.slug)} />
      <Sheet open={qr} onClose={() => setQr(false)} title="Venue check-in code">
        <QrCard kind="v" keyValue={v.slug} title={v.name} subtitle={`${v.neighborhood} · ${v.city}`} hue={v.hue} cta="Scan to check in" />
        <p className="mt-3 text-center text-xs text-muted">Print this by the stage. Singers scan it to check in instantly.</p>
      </Sheet>
    </div>
  );
}

function TonightCard({ d, tonight }: { d: VenueDetail; tonight?: VenueDetail['schedule'][number] }) {
  if (d.kjNow) {
    return (
      <Card glow="cyan" className="relative overflow-hidden p-5">
        <div className="absolute -top-20 -right-10 size-56 rounded-full bg-live/15 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-4">
          <Avatar user={d.kjNow.kj} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-live uppercase">
              <LiveDot /> KJ Now
            </div>
            <Link to="/u/$handle" params={{ handle: d.kjNow.kj.handle }} className="font-display text-2xl font-bold hover:underline">
              {d.kjNow.kj.displayName}
            </Link>
            <div className="text-sm text-muted">
              On-site for {duration(serverNow() - d.kjNow.since)}
              {tonight && <> · karaoke {hoursLabel(tonight.startMin, tonight.endMin)}</>}
            </div>
          </div>
          <BusyMeter level={d.crowd.level} count={d.crowd.count} />
        </div>
      </Card>
    );
  }
  return (
    <Card className="p-5">
      <div className="text-xs font-bold tracking-widest text-muted uppercase">{d.isLive ? 'On now' : 'Tonight'}</div>
      {tonight ? (
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <div className="font-display text-2xl font-bold">{hoursLabel(tonight.startMin, tonight.endMin)}</div>
          {tonight.kj && <span className="text-sm text-muted">with {tonight.kj.displayName}</span>}
          {d.isLive && <span className="text-xs text-cyan">The KJ hasn't checked in on-site yet</span>}
        </div>
      ) : (
        <div className="mt-1 text-muted">No karaoke tonight. Check the weekly schedule.</div>
      )}
    </Card>
  );
}

function WhosHere({ d }: { d: VenueDetail }) {
  return (
    <Section title={<>Who's here <span className="text-base font-medium text-muted">· {d.here.length}</span></>} icon={<LiveDot />}>
      {d.here.length ? (
        <Card className="p-4">
          {d.crowd.friends.length > 0 && <div className="mb-3 text-sm text-live">{d.crowd.friends.map((f) => f.displayName.split(' ')[0]).join(', ')} {d.crowd.friends.length > 1 ? 'are' : 'is'} here 🎉</div>}
          <div className="flex flex-wrap gap-3">
            {d.here.slice(0, 24).map((u) => (
              <Link key={u.id} to="/u/$handle" params={{ handle: u.handle }} className="group flex w-16 flex-col items-center gap-1 text-center">
                <Avatar user={u} size="lg" ghost={u.ghost} className="transition group-hover:scale-105" />
                <span className="w-full truncate text-[11px] text-muted">{u.ghost ? 'Ghost' : u.displayName.split(' ')[0]}</span>
              </Link>
            ))}
          </div>
          <p className="mt-3 text-xs text-faint">People in Ghost Mode aren't shown.</p>
        </Card>
      ) : (
        <EmptyState icon="🪑" title="Nobody's checked in yet" body="Be the first. The KJ sees new check-ins instantly." />
      )}
    </Section>
  );
}

function WhosGoing({ d, going }: { d: VenueDetail; going: NonNullable<VenueDetail['whosGoing']> }) {
  const { data: me } = useMe();
  const rsvp = useAction((x: { date: string; going: boolean }) => unwrap(api.venues[':venueId'].rsvp.$put({ param: { venueId: d.venue.id }, json: x })), {
    invalidate: [qk.venue(d.venue.slug)],
    success: (_, x) => (x.going ? "You're on the list! 🎉" : 'RSVP removed'),
  });
  const nightDays = new Set(d.schedule.map((n) => n.dayOfWeek));
  return (
    <Section title="Who's going" icon={<CalendarDays className="size-5 text-pink" />}>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:grid sm:grid-cols-7 sm:px-0">
        {going.map((day, i) => {
          const date = new Date(`${day.date}T12:00:00`);
          const hasKaraoke = nightDays.has(date.getDay());
          return (
            <div key={day.date} className={cx('flex min-w-[92px] flex-col items-center gap-2 rounded-2xl border p-3 text-center', day.me ? 'border-pink/50 bg-pink/10' : 'border-line bg-surface/70', !hasKaraoke && 'opacity-50')}>
              <div className="text-xs font-semibold text-muted">{i === 0 ? 'Today' : DAYS[date.getDay()]}</div>
              <div className="font-display text-2xl font-bold">{day.count}</div>
              <div className="h-6">{day.going.length > 0 && <AvatarStack users={day.going} max={3} size="xs" />}</div>
              {me?.role === 'singer' && hasKaraoke && (
                <button onClick={() => rsvp.mutate({ date: day.date, going: !day.me })} className={cx('w-full rounded-full py-1 text-[11px] font-bold', day.me ? 'bg-pink text-white' : 'bg-white/8 text-fg hover:bg-white/15')}>
                  {day.me ? "I'm going" : 'Going?'}
                </button>
              )}
              {!hasKaraoke && <div className="text-[10px] text-faint">No karaoke</div>}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function Specials({ d }: { d: VenueDetail }) {
  return (
    <Section title="Drink specials" icon={<Martini className="size-5 text-gold" />}>
      {d.specials.length ? (
        <div className="space-y-2">
          {d.specials.map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-2xl border border-gold/20 bg-gold/5 p-3">
              <div className="grid min-w-14 place-items-center rounded-xl bg-gold/15 px-2 py-2 font-display text-lg font-extrabold text-gold">{s.price || '★'}</div>
              <div className="min-w-0">
                <div className="font-semibold">{s.title}</div>
                <div className="text-xs text-muted">{s.details}</div>
                <div className="mt-0.5 text-[11px] text-gold/80">{s.days.map((x) => DAYS[x]).join(' · ')}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">No specials posted.</p>
      )}
    </Section>
  );
}

function Events({ d }: { d: VenueDetail }) {
  if (!d.events.length) return null;
  return (
    <Section title="Upcoming events" icon={<Trophy className="size-5 text-gold" />}>
      <div className="grid gap-3 sm:grid-cols-2">
        {d.events.map((e) => (
          <Card key={e.id} className="p-4">
            <div className="flex items-center justify-between">
              <Pill tone={EVENT_TONE[e.kind]}>{e.kind}</Pill>
              <span className="text-xs text-muted">{dateLabel(e.startsAt)} · {timeLabel(e.startsAt)}</span>
            </div>
            <div className="mt-2 font-display text-lg font-bold">{e.title}</div>
            <p className="mt-1 text-sm text-muted">{e.description}</p>
          </Card>
        ))}
      </div>
    </Section>
  );
}

function Gallery({ d }: { d: VenueDetail }) {
  const { data: me } = useMe();
  const [open, setOpen] = useState(false);
  const [caption, setCaption] = useState('');
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const add = useAction(() => unwrap(api.venues[':venueId'].gallery.$post({ param: { venueId: d.venue.id }, json: { caption: caption || 'Great night!', mediaUrl: mediaUrl! } })), {
    invalidate: [qk.venue(d.venue.slug)],
    success: 'Posted to the gallery',
    onSuccess: () => {
      setOpen(false);
      setCaption('');
      setMediaUrl(null);
    },
  });
  return (
    <Section
      title="Gallery"
      icon={<Camera className="size-5 text-pink" />}
      action={
        me && (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Camera className="size-4" /> Add photo
          </Button>
        )
      }
    >
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {d.gallery.slice(0, 12).map((g, i) => (
          <GalleryTile key={g.id} {...g} className={cx(i === 0 && 'col-span-2 row-span-2')} />
        ))}
      </div>
      <p className="text-xs text-faint">Curated by {d.venue.name}. Featured shots float to the top. Last upload {d.gallery[0] ? ago(d.gallery[0].createdAt) : 'n/a'}.</p>
      <Sheet open={open} onClose={() => setOpen(false)} title="Add to the gallery">
        <div className="space-y-4">
          <div className="relative grid aspect-video place-items-center overflow-hidden rounded-2xl border border-dashed border-line-strong bg-surface-2/50 text-center text-sm text-muted">
            {mediaUrl ? (
              <img src={mediaUrl} alt="" className="absolute inset-0 size-full object-cover" />
            ) : (
              <FilePicker variant="primary" capture="environment" onUploaded={setMediaUrl}>
                <Camera className="size-4" /> Take or choose a photo
              </FilePicker>
            )}
          </div>
          <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Caption (e.g. Bohemian Rhapsody group sing)" className="w-full" />
          <Button variant="primary" className="w-full" disabled={!mediaUrl} loading={add.isPending} onClick={() => add.mutate(undefined)}>
            Post
          </Button>
        </div>
      </Sheet>
    </Section>
  );
}

/** Hours, happy hours and food, from the venue's settings. */
function VenueInfo({ d }: { d: VenueDetail }) {
  const v = d.venue;
  const today = new Date(serverNow()).toLocaleDateString('en-US', { weekday: 'long', timeZone: SCENE_TZ });
  const todayIdx = DAYS_LONG.indexOf(today);
  if (!v.hours.length && !v.happyHours.length && !v.foodAvailable) return null;
  return (
    <Section title="Hours & food" icon={<Clock className="size-5 text-violet" />}>
      <Card className="divide-y divide-line text-sm">
        {v.hours.length > 0 && (
          <div className="space-y-1 px-4 py-3">
            {DAYS.map((day, i) => {
              const h = v.hours.find((x) => x.day === i);
              return (
                <div key={day} className={cx('flex justify-between', i === todayIdx ? 'font-semibold text-fg' : 'text-muted')}>
                  <span>{day}</span>
                  <span>{h ? hoursLabel(h.openMin, h.closeMin) : 'Closed'}</span>
                </div>
              );
            })}
          </div>
        )}
        {v.happyHours.map((hh, i) => (
          <div key={i} className="flex items-start gap-3 px-4 py-3">
            <Martini className="mt-0.5 size-4 shrink-0 text-gold" />
            <div>
              <div className="font-semibold">Happy hour · {hoursLabel(hh.startMin, hh.endMin)}</div>
              <div className="text-xs text-muted">
                {hh.days.map((x) => DAYS[x]).join(' · ')}
                {hh.details && ` · ${hh.details}`}
              </div>
            </div>
          </div>
        ))}
        {v.foodAvailable && (
          <div className="flex items-center gap-3 px-4 py-3">
            <UtensilsCrossed className="size-4 shrink-0 text-gold" />
            <span className="flex-1">Food available</span>
            {v.menuUrl && (
              <a href={v.menuUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs font-semibold text-pink">
                <FileText className="size-3.5" /> Menu
              </a>
            )}
          </div>
        )}
      </Card>
    </Section>
  );
}

/** Singers rate venues with positive badges only. */
function Ratings({ d }: { d: VenueDetail }) {
  const { data: me } = useMe();
  const [rate, setRate] = useState(false);
  const total = d.ratings.reduce((n, b) => n + b.count, 0);
  return (
    <Section
      title={<>Singers say <span className="text-base font-medium text-muted">· {total}</span></>}
      icon={<Award className="size-5 text-gold" />}
      action={
        me?.role === 'singer' && (
          <Button size="sm" className="border-gold/40 text-gold" onClick={() => setRate(true)}>
            <Award className="size-4" /> Rate this venue
          </Button>
        )
      }
    >
      {d.ratings.length ? <BadgeGrid badges={d.ratings} /> : <p className="text-sm text-muted">No ratings yet. Singers rate venues with positive badges only.</p>}
      {rate && <AwardBadgeSheet open onClose={() => setRate(false)} to={{ id: d.venue.ownerId, displayName: d.venue.name, handle: d.venue.ownerHandle ?? d.venue.slug }} />}
    </Section>
  );
}

/** A KJ listed this venue before its owner joined. Owners claim it to manage the page. */
function ClaimBanner({ d }: { d: VenueDetail }) {
  const { data: me } = useMe();
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const claim = useAction(() => demoClaim!(d.venue.id, qc), {
    success: (r) => `You now manage ${r.displayName} 🎉`,
    onSuccess: () => navigate({ to: '/me' }),
  });
  return (
    <>
      <Card className="mb-5 flex flex-wrap items-center gap-3 border-gold/40 bg-gold/5 p-4">
        <BadgeCheck className="size-6 shrink-0 text-gold" />
        <div className="min-w-0 flex-1 text-sm">
          <div className="font-semibold">Unclaimed venue</div>
          <div className="text-muted">Listed by {d.venue.createdBy?.displayName ?? 'a KJ'} who hosts karaoke here. Own or run {d.venue.name}?</div>
        </div>
        {demoClaim && me?.id !== d.venue.createdBy?.id && (
          <Button size="sm" variant="primary" onClick={() => setOpen(true)}>
            Claim this venue
          </Button>
        )}
      </Card>
      <Sheet open={open} onClose={() => setOpen(false)} title={`Claim ${d.venue.name}`}>
        <div className="space-y-4 text-sm">
          <p className="text-muted">Claiming lets you add photos, hours, specials and coupons, and choose your KJs. The KJ's nights stay on the schedule.</p>
          <ol className="list-decimal space-y-1.5 pl-5 text-muted">
            <li>Sign in with your business email.</li>
            <li>Confirm you're the owner or an authorized operator.</li>
            <li>We verify with a quick call to the venue's listed phone number.</li>
          </ol>
          <div className="rounded-2xl border border-dashed border-gold/40 bg-gold/5 p-3 text-xs text-gold">Demo: verification is skipped. Claiming signs you in as this venue's account.</div>
          <Button variant="primary" className="w-full" loading={claim.isPending} onClick={() => claim.mutate(undefined)}>
            I'm the owner · claim {d.venue.name}
          </Button>
        </div>
      </Sheet>
    </>
  );
}

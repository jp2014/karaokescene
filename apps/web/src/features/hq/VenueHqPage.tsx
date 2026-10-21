import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Award, CalendarPlus, Crown, ExternalLink, Lock, Martini, Megaphone, Star, Ticket, Trash2, Trophy, Users } from 'lucide-react';
import { useState } from 'react';
import { Avatar } from '~/components/Avatar';
import { PremiumGate, PremiumPill, UpgradeSheet } from '~/components/Premium';
import { BadgeMedal } from '~/components/Badge';
import { QrCard } from '~/components/QrCard';
import { Button, Card, cx, EmptyState, LiveDot, PageLoader, Pill, Section, Segmented, Sheet, Stat, Toggle } from '~/components/ui';
import { GalleryTile } from '~/components/VenueArt';
import { PeakHours } from '~/features/venue/PeakHours';
import { AwardBadgeSheet } from '~/features/profile/ProfileActions';
import { PromoteCard } from '~/features/promo/PromoteCard';
import { api, unwrap } from '~/lib/api';
import { ago, dateLabel, DAYS, SCENE_TZ, serverNow, timeLabel } from '~/lib/format';
import { VenueSetup } from './VenueSetup';
import { qk, useAction, useMe, useVenue, type VenueDetail } from '~/lib/queries';

export function VenueHqPage() {
  const { data: me } = useMe();
  const { data: d } = useVenue(me?.venue?.slug ?? '');
  if (!me) return <PageLoader />;
  if (!me.venue) return <VenueSetup />;
  if (!d) return <PageLoader />;
  return <Hq d={d} />;
}

function Hq({ d }: { d: VenueDetail }) {
  const v = d.venue;
  const [awardTo, setAwardTo] = useState<{ id: string; displayName: string; handle: string } | null>(null);
  const [plan, setPlan] = useState(false);
  const inv = [qk.venue(v.slug), ['venues'], qk.events];
  const feature = useAction((x: { id: string; on: boolean }) => unwrap(api.venues.gallery[':itemId'].featured.$put({ param: { itemId: x.id }, json: { on: x.on } })), { invalidate: inv });
  const nowHour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: SCENE_TZ }).format(new Date(serverNow())));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold tracking-widest text-muted uppercase">Venue HQ</div>
          <h1 className="text-3xl font-extrabold">{v.name}</h1>
        </div>
        <Link to="/venues/$slug" params={{ slug: v.slug }}>
          <Button>
            <ExternalLink className="size-4" /> View public page
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Checked in now" value={d.crowd.count} sub={d.crowd.level.replace('-', ' ')} accent="text-live" />
        <Stat label="Going today" value={d.whosGoing ? d.whosGoing[0]?.count ?? 0 : <Lock className="mt-2 size-6 text-gold" />} sub={d.whosGoing ? 'RSVPs' : 'Venue Premier'} />
        <Stat label="Going this week" value={d.whosGoing ? d.whosGoing.reduce((n, x) => n + x.count, 0) : <Lock className="mt-2 size-6 text-gold" />} sub={d.whosGoing ? undefined : 'Venue Premier'} />
        <Stat
          label="KJ on-site"
          value={d.kjNow ? <LiveDot className="mt-2" /> : '—'}
          sub={d.kjNow ? d.kjNow.kj.displayName : d.isLive ? 'Not checked in yet' : 'No show right now'}
        />
      </div>

      <Card className={cx('relative overflow-hidden p-5', v.isPremiere && 'border-gold/50')}>
        <div className="absolute -top-16 -right-16 size-48 rounded-full bg-gold/15 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-4">
          <div className="grid size-12 place-items-center rounded-2xl bg-gold/15 text-gold">
            <Crown className="size-6" />
          </div>
          <div className="min-w-48 flex-1">
            <div className="font-semibold">{v.isPremiere ? 'You’re on Venue Premier' : 'Venue Premier'}</div>
            <div className="text-sm text-muted">Premier listing (priority on the map, gold pin), who's going on your page, Peak Hours insights and reminders to share your specials. $49/mo.</div>
          </div>
          <Button variant={v.isPremiere ? 'secondary' : 'primary'} onClick={() => setPlan(true)}>
            {v.isPremiere ? 'Manage plan' : 'Upgrade'}
          </Button>
        </div>
      </Card>
      <UpgradeSheet open={plan} onClose={() => setPlan(false)} />

      <RewardSingers d={d} />

      <div className="grid gap-8 [&>*]:min-w-0 lg:grid-cols-2">
        <EventsManager d={d} />
        <SpecialsManager d={d} />
      </div>

      <div className="grid gap-8 [&>*]:min-w-0 lg:grid-cols-[1fr_380px]">
        <div className="space-y-8">
          <Section title="Rate your KJs" icon={<Award className="size-5 text-gold" />}>
            <p className="-mt-1 text-sm text-muted">Venue badges help KJs build a reputation, and help other venues pick reliable hosts.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {d.kjs.map((k) => (
                <Card key={k.id} className="p-4">
                  <div className="flex items-center gap-3">
                    <Avatar user={k} />
                    <div className="min-w-0 flex-1 font-semibold">{k.displayName}</div>
                    <Button size="sm" className="border-gold/40 text-gold" onClick={() => setAwardTo(k)}>
                      <Award className="size-4" /> Award
                    </Button>
                  </div>
                  <div className="mt-3 flex gap-1.5">
                    {k.badges.map((b) => (
                      <span key={b.key} title={`${b.label} ×${b.count}`}>
                        <BadgeMedal badge={b} size="sm" />
                      </span>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          </Section>
          <Section title="Gallery curation" icon={<Star className="size-5 text-gold" />}>
            <p className="-mt-1 text-sm text-muted">Tap ★ to feature a photo on your page. Featured shots appear first.</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {d.gallery.map((g) => (
                <button key={g.id} onClick={() => feature.mutate({ id: g.id, on: !g.featured })} className="text-left">
                  <GalleryTile {...g} />
                </button>
              ))}
            </div>
          </Section>
          <Section title="Peak hours" action={<PremiumPill role="venue" />}>
            <PremiumGate feature="Peak Hours" blurb="See when your room fills up, from real check-ins." teaser={!!d.peakHours}>
              <Card className="p-5">{d.peakHours ? <PeakHours data={d.peakHours} currentHour={nowHour} /> : null}</Card>
            </PremiumGate>
          </Section>
        </div>
        <aside className="space-y-6">
          <PromoteCard venues={[v]} />
          <QrCard kind="v" keyValue={v.slug} title={v.name} subtitle="Scan to check in & see tonight's specials" hue={v.hue} cta="Scan to check in" />
          <p className="text-center text-xs text-muted">Print this as a table tent or by the stage. Scans check singers in and count toward your growth stats.</p>
        </aside>
      </div>
      {awardTo && <AwardBadgeSheet open onClose={() => setAwardTo(null)} to={awardTo} />}
    </div>
  );
}

type Kind = 'karaoke' | 'competition' | 'theme' | 'scene';

function EventsManager({ d }: { d: VenueDetail }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState<Kind>('theme');
  const [date, setDate] = useState(() => new Date(serverNow() + 86400000).toISOString().slice(0, 10));
  const [time, setTime] = useState('20:00');
  const inv = [qk.venue(d.venue.slug), qk.events];
  const create = useAction(
    () => {
      const startsAt = new Date(`${date}T${time}:00`).getTime();
      return unwrap(api.venues[':venueId'].events.$post({ param: { venueId: d.venue.id }, json: { title, description, kind, startsAt, endsAt: startsAt + 4 * 3600_000 } }));
    },
    {
      invalidate: inv,
      success: 'Event posted 🎉',
      onSuccess: () => {
        setTitle('');
        setDescription('');
      },
    },
  );
  const del = useAction((eventId: string) => unwrap(api.venues.events[':eventId'].$delete({ param: { eventId } })), { invalidate: inv, success: 'Event removed' });
  return (
    <Section title="Events" icon={<CalendarPlus className="size-5 text-pink" />}>
      <Card className="space-y-3 p-5">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Event name (e.g. 90s Night)" className="w-full" />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="What's happening?" className="w-full text-sm" />
        <Segmented<Kind>
          size="sm"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'theme', label: 'Theme' },
            { value: 'competition', label: 'Competition' },
            { value: 'karaoke', label: 'Karaoke' },
            { value: 'scene', label: 'Meetup' },
          ]}
        />
        <div className="flex flex-wrap gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="flex-1" />
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          <Button variant="primary" disabled={title.length < 3} loading={create.isPending} onClick={() => create.mutate(undefined)}>
            Post
          </Button>
        </div>
      </Card>
      <div className="space-y-2">
        {d.events.map((e) => (
          <div key={e.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface/70 p-3">
            <Trophy className={cx('size-5', e.kind === 'competition' ? 'text-gold' : 'text-pink')} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{e.title}</div>
              <div className="text-xs text-muted">
                {dateLabel(e.startsAt)} · {timeLabel(e.startsAt)}
              </div>
            </div>
            <Pill tone="muted">{e.kind}</Pill>
            <button onClick={() => del.mutate(e.id)} className="text-faint hover:text-danger" aria-label="Delete">
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </Section>
  );
}

function SpecialsManager({ d }: { d: VenueDetail }) {
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [details, setDetails] = useState('');
  const [days, setDays] = useState<number[]>([5, 6]);
  const [autoPost, setAutoPost] = useState(d.venue.isPremiere);
  const [plan, setPlan] = useState(false);
  const inv = [qk.venue(d.venue.slug), ['venues'], ['posts']];
  const create = useAction(() => unwrap(api.venues[':venueId'].specials.$post({ param: { venueId: d.venue.id }, json: { title, price, details, days, autoPost: autoPost && d.venue.isPremiere } })), {
    invalidate: inv,
    success: (r) => (r.autoPosts ? `Special posted 🍹 We'll remind you to share it on ${r.autoPosts} day${r.autoPosts === 1 ? '' : 's'} this week` : 'Special posted 🍹'),
    onSuccess: () => {
      setTitle('');
      setPrice('');
      setDetails('');
    },
  });
  const del = useAction((specialId: string) => unwrap(api.venues.specials[':specialId'].$delete({ param: { specialId } })), { invalidate: inv, success: 'Special removed' });
  return (
    <Section title="Drink specials" icon={<Martini className="size-5 text-gold" />}>
      <Card className="space-y-3 p-5">
        <div className="flex gap-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Special (e.g. $3 Wells)" className="min-w-0 flex-1" />
          <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="$3" className="w-20" />
        </div>
        <input value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Details (optional)" className="w-full text-sm" />
        <div className="flex items-center gap-3 rounded-2xl border border-line px-3 py-2 text-sm">
          <Megaphone className="size-4 shrink-0 text-pink" />
          <span className="flex-1">
            Remind me to share it on each of its days <span className="text-xs text-muted">(4pm)</span>
          </span>
          {d.venue.isPremiere ? (
            <Toggle on={autoPost} onChange={setAutoPost} label="Remind me to share this special" />
          ) : (
            <button onClick={() => setPlan(true)} className="flex items-center gap-1 text-xs font-semibold text-gold">
              <Lock className="size-3.5" /> Premier
            </button>
          )}
        </div>
        <UpgradeSheet open={plan} onClose={() => setPlan(false)} feature="Special reminders" />
        <div className="flex flex-wrap items-center gap-1.5">
          {DAYS.map((day, i) => (
            <button key={day} onClick={() => setDays(days.includes(i) ? days.filter((x) => x !== i) : [...days, i])} className={cx('h-8 w-11 rounded-full text-xs font-semibold', days.includes(i) ? 'bg-gold text-ink' : 'bg-surface-2 text-muted')}>
              {day}
            </button>
          ))}
          <Button variant="primary" size="sm" className="ml-auto" disabled={title.length < 2 || !days.length} loading={create.isPending} onClick={() => create.mutate(undefined)}>
            Post
          </Button>
        </div>
      </Card>
      <div className="space-y-2">
        {d.specials.map((s) => (
          <div key={s.id} className="flex items-center gap-3 rounded-2xl border border-gold/20 bg-gold/5 p-3">
            <div className="grid min-w-12 place-items-center rounded-xl bg-gold/15 px-2 py-1.5 font-display font-bold text-gold">{s.price || '★'}</div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{s.title}</div>
              <div className="text-xs text-muted">
                {s.days.map((x) => DAYS[x]).join(' · ')}
                {s.autoPost && <span className="text-pink"> · share reminders</span>}
              </div>
            </div>
            <button onClick={() => del.mutate(s.id)} className="text-faint hover:text-danger" aria-label="Delete">
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </Section>
  );
}

/** Venues reward singers with one-time coupons that land in the singer's wallet. */
function RewardSingers({ d }: { d: VenueDetail }) {
  const issued = useQuery({ queryKey: ['issued'], queryFn: () => unwrap(api.wallet.issued.$get()) });
  const [to, setTo] = useState<VenueDetail['here'][number] | null>(null);
  const singers = d.here.filter((u) => u.role === 'singer' && !u.ghost);
  return (
    <div className="grid gap-8 [&>*]:min-w-0 lg:grid-cols-2">
      <Section title="Reward singers" icon={<Ticket className="size-5 text-gold" />}>
        <p className="-mt-1 text-sm text-muted">Send a coupon to someone in the room. It lands in their wallet as a one-time QR code you scan at the bar.</p>
        {singers.length ? (
          <Card className="max-h-80 overflow-y-auto p-2">
            {singers.map((u) => (
              <div key={u.id} className="flex items-center gap-3 rounded-2xl p-2 hover:bg-white/[0.03]">
                <Avatar user={u} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{u.displayName}</div>
                  <div className="text-xs text-muted">here {ago(u.checkedInAt)}</div>
                </div>
                <Button size="sm" className="border-gold/40 text-gold" onClick={() => setTo(u)}>
                  <Ticket className="size-4" /> Coupon
                </Button>
              </div>
            ))}
          </Card>
        ) : (
          <EmptyState icon={<Users />} title="Nobody checked in right now" body="Singers who check in show up here." />
        )}
      </Section>
      <Section title="Coupons sent">
        <Card className="max-h-80 divide-y divide-line overflow-y-auto">
          {issued.data?.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              {c.singer && <Avatar user={c.singer} size="xs" />}
              <span className="min-w-0 flex-1 truncate">
                <b>{c.title}</b> <span className="text-muted">· {c.singer?.displayName}</span>
              </span>
              <Pill tone={c.status === 'active' ? 'gold' : c.status === 'redeemed' ? 'live' : 'muted'}>{c.status}</Pill>
            </div>
          ))}
          {!issued.data?.length && <p className="p-4 text-sm text-muted">No coupons sent yet.</p>}
        </Card>
      </Section>
      {to && <CouponSheet d={d} to={to} onClose={() => setTo(null)} />}
    </div>
  );
}

const COUPON_IDEAS = ['Free well drink', '$5 off your tab', 'Free appetizer', 'Skip-the-line song'];

function CouponSheet({ d, to, onClose }: { d: VenueDetail; to: { id: string; displayName: string }; onClose: () => void }) {
  const [title, setTitle] = useState(COUPON_IDEAS[0]);
  const [details, setDetails] = useState('');
  const [validDays, setValidDays] = useState('14');
  const send = useAction(() => unwrap(api.wallet.coupons.$post({ json: { singerId: to.id, title, details, validDays: Number(validDays) } })), {
    invalidate: [['issued']],
    success: `Coupon sent to ${to.displayName.split(' ')[0]} 🎟️`,
    onSuccess: onClose,
  });
  return (
    <Sheet open onClose={onClose} title={`Coupon for ${to.displayName.split(' ')[0]}`}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {COUPON_IDEAS.map((idea) => (
            <button key={idea} onClick={() => setTitle(idea)} className={cx('rounded-full border px-3 py-1.5 text-xs font-semibold', title === idea ? 'border-gold bg-gold/15' : 'border-line text-muted')}>
              {idea}
            </button>
          ))}
        </div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="Coupon" className="w-full" />
        <input value={details} onChange={(e) => setDetails(e.target.value)} maxLength={160} placeholder={`Thanks for singing at ${d.venue.name}!`} className="w-full text-sm" />
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted">Valid for</span>
          <Segmented size="sm" value={validDays} onChange={setValidDays} options={[{ value: '7', label: '1 week' }, { value: '14', label: '2 weeks' }, { value: '30', label: '30 days' }]} />
        </div>
        <Button variant="primary" className="w-full" disabled={title.trim().length < 2} loading={send.isPending} onClick={() => send.mutate(undefined)}>
          <Ticket className="size-4" /> Send coupon
        </Button>
        <p className="text-center text-xs text-faint">One-time use. Redeem it by scanning their QR in Scan & Share.</p>
      </div>
    </Sheet>
  );
}

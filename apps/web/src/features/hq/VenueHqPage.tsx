import { Link } from '@tanstack/react-router';
import { Award, CalendarPlus, Crown, ExternalLink, Martini, Star, Trash2, Trophy } from 'lucide-react';
import { useState } from 'react';
import { Avatar } from '~/components/Avatar';
import { BadgeMedal } from '~/components/Badge';
import { QrCard } from '~/components/QrCard';
import { Button, Card, cx, EmptyState, LiveDot, PageLoader, Pill, Section, Segmented, Stat, Toggle } from '~/components/ui';
import { GalleryTile } from '~/components/VenueArt';
import { PeakHours } from '~/features/venue/PeakHours';
import { AwardBadgeSheet } from '~/features/profile/ProfileActions';
import { AutoPostCard } from '~/features/promo/AutoPostCard';
import { api, unwrap } from '~/lib/api';
import { dateLabel, DAYS, SCENE_TZ, serverNow, timeLabel } from '~/lib/format';
import { qk, useAction, useMe, useVenue, type VenueDetail } from '~/lib/queries';

export function VenueHqPage() {
  const { data: me } = useMe();
  const { data: d } = useVenue(me?.venue?.slug ?? '');
  if (!me?.venue) return <EmptyState icon="🏠" title="No venue linked" body="Switch to a venue account from Demo controls." />;
  if (!d) return <PageLoader />;
  return <Hq d={d} />;
}

function Hq({ d }: { d: VenueDetail }) {
  const v = d.venue;
  const [awardTo, setAwardTo] = useState<{ id: string; displayName: string; handle: string } | null>(null);
  const inv = [qk.venue(v.slug), ['venues'], qk.events];
  const premiere = useAction((isPremiere: boolean) => unwrap(api.venues[':venueId'].$patch({ param: { venueId: v.id }, json: { isPremiere } })), {
    invalidate: inv,
    success: (_, on) => (on ? 'You are now a Premiere Partner ⭐ Priority listing is on.' : 'Premiere Partner turned off'),
  });
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
        <Stat label="Going today" value={d.whosGoing[0]?.count ?? 0} sub="RSVPs" />
        <Stat label="Going this week" value={d.whosGoing.reduce((n, x) => n + x.count, 0)} />
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
          <div className="min-w-0 flex-1">
            <div className="font-semibold">Premiere Partner</div>
            <div className="text-sm text-muted">Priority placement on the map and in lists, a gold star on your pin, and featured events. $49/mo (mocked).</div>
          </div>
          <Toggle on={v.isPremiere} onChange={(on) => premiere.mutate(on)} label="Premiere Partner" />
        </div>
      </Card>

      <div className="grid gap-8 lg:grid-cols-2">
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
          <Section title="Peak hours">
            <Card className="p-5">
              <PeakHours data={d.peakHours} currentHour={nowHour} />
            </Card>
          </Section>
        </div>
        <aside className="space-y-6">
          <AutoPostCard venues={[{ id: v.id, name: v.name }]} />
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
  const inv = [qk.venue(d.venue.slug), ['venues']];
  const create = useAction(() => unwrap(api.venues[':venueId'].specials.$post({ param: { venueId: d.venue.id }, json: { title, price, details, days } })), {
    invalidate: inv,
    success: 'Special posted 🍹',
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
              <div className="text-xs text-muted">{s.days.map((x) => DAYS[x]).join(' · ')}</div>
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

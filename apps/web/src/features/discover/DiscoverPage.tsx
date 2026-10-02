import { DEMO } from '~/lib/demo';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Disc3, List, Map as MapIcon, Radar, Radio, Sparkles, Sunset } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Avatar, AvatarStack } from '~/components/Avatar';
import { Chip, cx, EmptyState, LiveDot, Segmented, Spinner } from '~/components/ui';
import { api, unwrap } from '~/lib/api';
import { plural, SCENE_TZ, serverNow, timeLabel } from '~/lib/format';
import { useLocation } from '~/lib/location';
import { useMe, useVenues, type VenueFilters } from '~/lib/queries';
import { VenueCard } from './VenueCard';
import { VenueMap } from './VenueMap';

type When = 'all' | 'live' | 'kjnow' | 'tonight';
type Hours = 'any' | 'early' | 'prime' | 'late';
const HOURS: Record<Hours, { label: string; from?: number; to?: number }> = {
  any: { label: 'Any hours' },
  early: { label: '6–9pm', from: 18 * 60, to: 21 * 60 },
  prime: { label: '9pm–12am', from: 21 * 60, to: 24 * 60 },
  late: { label: 'After midnight', from: 24 * 60, to: 28 * 60 },
};

function sceneGreeting() {
  const parts = new Intl.DateTimeFormat('en-US', { weekday: 'long', hour: 'numeric', hourCycle: 'h23', timeZone: SCENE_TZ }).formatToParts(new Date(serverNow()));
  const day = parts.find((p) => p.type === 'weekday')?.value;
  const hour = Number(parts.find((p) => p.type === 'hour')?.value);
  return `${day} ${hour >= 17 || hour < 4 ? 'night' : hour < 12 ? 'morning' : 'afternoon'}`;
}

export function DiscoverPage() {
  const { data: me } = useMe();
  const loc = useLocation();
  const [when, setWhen] = useState<When>('all');
  const [hours, setHours] = useState<Hours>('any');
  const [radiusMi, setRadius] = useState(20);
  const [selected, setSelected] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'map' | 'list'>('map');

  const filters: VenueFilters = {
    lat: Math.round(loc.current.lat * 1000) / 1000,
    lng: Math.round(loc.current.lng * 1000) / 1000,
    radiusMi,
    liveOnly: when === 'live',
    kjNowOnly: when === 'kjnow',
    tonightOnly: when === 'tonight',
    fromMin: HOURS[hours].from,
    toMin: HOURS[hours].to,
  };
  const { data, isLoading } = useVenues(filters);
  const venues = data?.venues ?? [];
  const stats = useMemo(
    () => ({ live: venues.filter((v) => v.isLive).length, kjNow: venues.filter((v) => v.kjNow).length, singers: venues.reduce((n, v) => n + v.crowd.count, 0) }),
    [venues],
  );

  const header = (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold tracking-widest text-muted uppercase">
          <LiveDot /> {sceneGreeting()} · {timeLabel(serverNow())}
        </div>
        <h1 className="mt-1 text-3xl font-extrabold">
          {stats.live ? (
            <>
              <span className="text-gradient">{plural(stats.live, 'night')}</span> going on near you
            </>
          ) : (
            'Find your next karaoke night'
          )}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {stats.kjNow} KJs on-site · {stats.singers} singers checked in · within {radiusMi} mi of {loc.mode === 'real' ? 'you' : loc.label}
        </p>
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none lg:mx-0 lg:flex-wrap lg:px-0">
        <Chip active={when === 'all'} onClick={() => setWhen('all')}>All</Chip>
        <Chip active={when === 'live'} onClick={() => setWhen('live')} icon={<Radio className="size-4" />}>Live now</Chip>
        <Chip active={when === 'kjnow'} onClick={() => setWhen('kjnow')} icon={<Disc3 className="size-4" />}>KJ Now</Chip>
        <Chip active={when === 'tonight'} onClick={() => setWhen('tonight')} icon={<Sunset className="size-4" />}>Tonight</Chip>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select value={hours} onChange={(e) => setHours(e.target.value as Hours)} className="!h-9 !rounded-full !py-0 text-sm" aria-label="Hours of karaoke">
          {Object.entries(HOURS).map(([k, h]) => (
            <option key={k} value={k}>
              🕘 {h.label}
            </option>
          ))}
        </select>
        <select value={radiusMi} onChange={(e) => setRadius(Number(e.target.value))} className="!h-9 !rounded-full !py-0 text-sm" aria-label="Radius">
          {[5, 10, 20].map((r) => (
            <option key={r} value={r}>
              📍 {r} miles
            </option>
          ))}
        </select>
        {isLoading && <Spinner className="size-4" />}
      </div>
    </div>
  );

  const list = (
    <div className="space-y-2.5">
      {venues.map((v) => (
        <VenueCard key={v.id} v={v} selected={v.id === selected} onHover={() => setSelected(v.id)} />
      ))}
      {!venues.length && !isLoading && <EmptyState icon="🎤" title="No karaoke matches those filters" body={DEMO ? 'Try a different time window, or time-travel to a Friday night from Demo controls.' : 'Try a different time window or a wider radius.'} />}
      {!!data?.outsideRadius && (
        <p className="px-2 pt-2 text-center text-xs text-faint">
          {plural(data.outsideRadius, 'more venue')} outside your {radiusMi}-mile radius (Karaoke Scene keeps it local)
        </p>
      )}
    </div>
  );

  return (
    <div className="lg:grid lg:h-dvh lg:grid-cols-[minmax(380px,460px)_1fr]">
      {/* Desktop list panel */}
      <div className="hidden overflow-y-auto border-r border-line p-6 lg:block">
        {header}
        {me && me.role !== 'singer' && <SingersNearYou />}
        <div className="mt-5">{list}</div>
      </div>

      {/* Map (desktop: right side; mobile: full-bleed) */}
      <div className={cx('relative h-[calc(100dvh-64px-76px)] lg:h-dvh', mobileView === 'list' && 'max-lg:hidden')}>
        <VenueMap venues={venues} center={data?.center ?? loc.current} radiusMi={radiusMi} me={loc.current} selectedId={selected} onSelect={setSelected} className="absolute inset-0" />
        <MapLegend />
        {/* Mobile overlays */}
        <div className="absolute inset-x-0 top-0 p-3 lg:hidden">
          <div className="flex gap-2 overflow-x-auto scrollbar-none">
            <Chip active={when === 'all'} onClick={() => setWhen('all')}>All</Chip>
            <Chip active={when === 'live'} onClick={() => setWhen('live')}>Live now</Chip>
            <Chip active={when === 'kjnow'} onClick={() => setWhen('kjnow')}>KJ Now</Chip>
            <Chip active={when === 'tonight'} onClick={() => setWhen('tonight')}>Tonight</Chip>
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-3 lg:hidden">
          <div className="mb-2 flex justify-center">
            <button onClick={() => setMobileView('list')} className="glass flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-semibold">
              <List className="size-4" /> List · {venues.length}
            </button>
          </div>
          <div
            className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-[7vw] pb-1 scrollbar-none"
            onScroll={(e) => {
              const el = e.currentTarget;
              const idx = Math.round(el.scrollLeft / (el.scrollWidth / Math.max(venues.length, 1)));
              const v = venues[idx];
              if (v && v.id !== selected) setSelected(v.id);
            }}
          >
            {venues.map((v) => (
              <VenueCard key={v.id} v={v} selected={v.id === selected} compact />
            ))}
          </div>
        </div>
      </div>

      {/* Mobile list view */}
      {mobileView === 'list' && (
        <div className="px-4 py-5 lg:hidden">
          <div className="mb-4 flex justify-end">
            <Segmented
              size="sm"
              value={mobileView}
              onChange={setMobileView}
              options={[
                { value: 'map', label: <span className="flex items-center gap-1"><MapIcon className="size-3.5" /> Map</span> },
                { value: 'list', label: <span className="flex items-center gap-1"><List className="size-3.5" /> List</span> },
              ]}
            />
          </div>
          {header}
          {me && me.role !== 'singer' && <SingersNearYou />}
          <div className="mt-5">{list}</div>
        </div>
      )}
    </div>
  );
}

function MapLegend() {
  const items = [
    ['#3ee58f', 'KJ Now'],
    ['#22d3ee', 'Live'],
    ['#8b5cf6', 'Tonight'],
    ['#6f6690', 'Other nights'],
  ];
  return (
    <div className="glass absolute top-16 left-3 hidden flex-col gap-1.5 rounded-2xl border border-line p-3 text-xs sm:flex lg:top-4">
      {items.map(([c, l]) => (
        <span key={l} className="flex items-center gap-2">
          <span className="size-2.5 rounded-full" style={{ background: c, boxShadow: `0 0 8px ${c}` }} /> {l}
        </span>
      ))}
      <span className="flex items-center gap-2">
        <span className="grid size-3.5 place-items-center rounded-full bg-gold text-[8px] text-ink">★</span> Premiere Partner
      </span>
    </div>
  );
}

/** For KJs and venues: who's around to invite tonight. */
function SingersNearYou() {
  const loc = useLocation();
  const { data } = useQuery({
    queryKey: ['singers-near', loc.current],
    queryFn: () => unwrap(api.presence['singers-near'].$get({ query: { lat: String(loc.current.lat), lng: String(loc.current.lng), radiusMi: '20' } })),
  });
  if (!data?.length) return null;
  const free = data.filter((s) => !s.checkedInVenueId);
  return (
    <div className="mt-5 rounded-3xl border border-cyan/25 bg-cyan/5 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Radar className="size-4 text-cyan" /> Singers near you
        <span className="ml-auto text-xs font-normal text-muted">{free.length} not out yet</span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <AvatarStack users={free} max={8} size="sm" />
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-none">
        {free.slice(0, 6).map((s) => (
          <Link key={s.id} to="/u/$handle" params={{ handle: s.handle }} className="flex shrink-0 items-center gap-2 rounded-full bg-surface-2 py-1 pr-3 pl-1 text-xs">
            <Avatar user={s} size="xs" /> {s.displayName.split(' ')[0]} · {s.distanceMi}mi
          </Link>
        ))}
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
        <Sparkles className="size-3.5 text-gold" /> Promote tonight with Auto-Posting to reach them.
      </p>
    </div>
  );
}

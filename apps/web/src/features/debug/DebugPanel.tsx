import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Clock3, Footprints, LocateFixed, MapPin, RotateCcw, Search, Sparkles, UserPlus, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Avatar, ROLE_LABEL } from '~/components/Avatar';
import { Button, cx, Section, Segmented, Sheet } from '~/components/ui';
import { api, unwrap } from '~/lib/api';
import { DAYS, dayTimeLabel, serverNow } from '~/lib/format';
import { locationStore, OMAHA, teleport, useLocation } from '~/lib/location';
import { useAction, useClock, useDemoAccounts, useMe, useVenues } from '~/lib/queries';
import { homeFor, signInAs } from '~/lib/session';

const TIME_PRESETS = [
  { label: 'Fri 10:15pm', dayOfWeek: 5, minutes: 22 * 60 + 15 },
  { label: 'Sat 11:30pm', dayOfWeek: 6, minutes: 23 * 60 + 30 },
  { label: 'Wed 9pm', dayOfWeek: 3, minutes: 21 * 60 },
  { label: 'Tue 2pm', dayOfWeek: 2, minutes: 14 * 60 },
];

/**
 * Demo controls: become anyone, be anywhere, at any time, and trigger the
 * moments (crowds, Auto Leave, referrals) that are hard to stage live.
 */
export function DebugPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<'people' | 'world'>('people');
  return (
    <Sheet open={open} onClose={onClose} wide title={<span className="flex items-center gap-2">🛠️ Demo controls</span>}>
      <div className="mb-5">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'people', label: 'Switch persona' },
            { value: 'world', label: 'Place, time & events' },
          ]}
        />
      </div>
      {tab === 'people' ? <PersonaSwitcher onDone={onClose} /> : <WorldControls />}
    </Sheet>
  );
}

function PersonaSwitcher({ onDone }: { onDone: () => void }) {
  const { data: accounts } = useDemoAccounts();
  const { data: me } = useMe();
  const [role, setRole] = useState<'singer' | 'kj' | 'venue'>('singer');
  const [q, setQ] = useState('');
  const qc = useQueryClient();
  const navigate = useNavigate();
  const list = useMemo(
    () => (accounts ?? []).filter((a) => a.role === role && (!q || a.displayName.toLowerCase().includes(q.toLowerCase()))),
    [accounts, role, q],
  );

  async function become(userId: string) {
    const user = await signInAs(userId, qc);
    toast.success(`You're now ${user.displayName}`, { description: ROLE_LABEL[user.role] });
    onDone();
    navigate({ to: homeFor(user.role) });
  }

  const featured = ['usr_jess', 'usr_velvetvox', 'usr_neon-mic'];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2">
        {featured.map((id) => {
          const a = accounts?.find((x) => x.id === id);
          if (!a) return <div key={id} className="h-28 animate-pulse rounded-2xl bg-surface-2" />;
          return (
            <button key={id} onClick={() => become(id)} className={cx('flex flex-col items-center gap-2 rounded-2xl border p-3 text-center transition hover:border-pink/50', me?.id === id ? 'border-pink/60 bg-pink/10' : 'border-line bg-surface-2/50')}>
              <Avatar user={a} size="lg" />
              <div className="text-sm font-semibold leading-tight">{a.displayName}</div>
              <div className="text-[11px] text-muted">Demo {ROLE_LABEL[a.role]}</div>
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          size="sm"
          value={role}
          onChange={setRole}
          options={[
            { value: 'singer', label: 'Singers' },
            { value: 'kj', label: 'KJs' },
            { value: 'venue', label: 'Venues' },
          ]}
        />
        <div className="relative min-w-40 flex-1">
          <Search className="absolute top-2.5 left-3 size-4 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search accounts" className="w-full !py-2 pl-9 text-sm" />
        </div>
      </div>
      <div className="grid max-h-[40vh] gap-1 overflow-y-auto sm:grid-cols-2">
        {list.map((a) => (
          <button key={a.id} onClick={() => become(a.id)} className={cx('flex items-center gap-3 rounded-2xl p-2 text-left transition hover:bg-white/5', me?.id === a.id && 'bg-pink/10')}>
            <Avatar user={a} size="sm" ghost={a.ghostMode} />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{a.displayName}</div>
              <div className="truncate text-xs text-muted">{a.venueName ?? a.bio}</div>
            </div>
          </button>
        ))}
      </div>
      <p className="text-xs text-faint">Tip: each browser tab keeps its own persona. Open the KJ in one tab and a singer in another to watch check-ins and Auto Leave alerts land in real time.</p>
    </div>
  );
}

function WorldControls() {
  const loc = useLocation();
  const { data: me } = useMe();
  const { data: clock } = useClock();
  const { data: venues } = useVenues({ radiusMi: 100 });
  const qc = useQueryClient();
  const [venueId, setVenueId] = useState('ven_neon-mic');
  const [confirmReset, setConfirmReset] = useState(false);
  const venue = venues?.venues.find((v) => v.id === venueId);

  const setClock = useAction((target: { dayOfWeek: number; minutes: number } | null) => unwrap(api.debug.clock.$put({ json: { target } })), {
    success: (r) => `Clock set to ${dayTimeLabel(r.now)}`,
    onSuccess: () => qc.invalidateQueries(),
  });
  const crowd = useAction(() => unwrap(api.debug.crowd[':venueId'].$post({ param: { venueId }, json: { count: 8 } })), {
    success: (r) => `${r.added} singers just walked into ${venue?.name}`,
    onSuccess: () => qc.invalidateQueries(),
  });
  const leave = useAction(() => unwrap(api.debug['auto-leave'][':venueId'].$post({ param: { venueId } })), {
    success: (r) => (r.left ? `${r.left} walked out → Auto Leave sent to the KJ` : 'Nobody is checked in there'),
    onSuccess: () => qc.invalidateQueries(),
  });
  const referral = useAction(() => unwrap(api.debug.referral.$post()), {
    success: (r) => `@${r.handle} joined via your QR code (${r.scans} total)`,
    onSuccess: () => qc.invalidateQueries(),
  });
  const reset = useAction(() => unwrap(api.debug.reset.$post()), {
    success: 'Demo data reset',
    onSuccess: () => {
      teleport(OMAHA, 'Downtown Omaha');
      qc.invalidateQueries();
    },
  });

  return (
    <div className="space-y-7">
      <Section title="Where am I?" icon={<MapPin className="size-5 text-pink" />}>
        <div className="rounded-2xl border border-line bg-surface-2/50 p-4">
          <div className="mb-3 text-sm">
            <span className="text-muted">Current:</span> <span className="font-semibold">{loc.mode === 'real' ? 'Real GPS' : loc.label}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => teleport(OMAHA, 'Downtown Omaha')}>
              Downtown Omaha
            </Button>
            <Button
              size="sm"
              disabled={!venue}
              onClick={() => venue && teleport({ lat: venue.lat, lng: venue.lng }, venue.name)}
            >
              <LocateFixed className="size-4" /> Stand inside {venue?.name ?? 'venue'}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                const c = loc.current;
                teleport({ lat: c.lat + 0.012, lng: c.lng + 0.012 }, 'A mile down the road');
                toast('🚶 Walking away…', { description: me?.checkin ? 'Auto Leave will fire on the next location ping.' : undefined });
              }}
            >
              <Footprints className="size-4" /> Walk away
            </Button>
            <Button
              size="sm"
              variant={loc.mode === 'real' ? 'primary' : 'secondary'}
              onClick={() => locationStore.set({ mode: loc.mode === 'real' ? 'sim' : 'real' })}
            >
              {loc.mode === 'real' ? 'Using real GPS' : 'Use real GPS'}
            </Button>
          </div>
          <p className="mt-3 text-xs text-faint">Singers get a check-in prompt on arrival (Auto Check-in) and are checked out automatically when they walk away (Auto Leave).</p>
        </div>
      </Section>

      <Section title="Target venue" icon={<Users className="size-5 text-cyan" />}>
        <select value={venueId} onChange={(e) => setVenueId(e.target.value)} className="w-full">
          {venues?.venues.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name} · {v.neighborhood} {v.isLive ? '· LIVE' : ''}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" loading={crowd.isPending} onClick={() => crowd.mutate(undefined)}>
            <Users className="size-4" /> Send in a crowd (+8)
          </Button>
          <Button size="sm" loading={leave.isPending} onClick={() => leave.mutate(undefined)}>
            <Footprints className="size-4" /> Someone walks out
          </Button>
        </div>
      </Section>

      <Section title="What time is it?" icon={<Clock3 className="size-5 text-gold" />}>
        <div className="rounded-2xl border border-line bg-surface-2/50 p-4">
          <div className="mb-3 text-sm">
            <span className="text-muted">Scene time:</span> <span className="font-semibold">{clock ? dayTimeLabel(serverNow()) : '…'}</span>
            {clock?.offsetMs ? <span className="ml-2 text-xs text-gold">(time-travelling)</span> : <span className="ml-2 text-xs text-muted">(real time)</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            {TIME_PRESETS.map((p) => (
              <Button key={p.label} size="sm" onClick={() => setClock.mutate({ dayOfWeek: p.dayOfWeek, minutes: p.minutes })}>
                {p.label}
              </Button>
            ))}
            <Button size="sm" variant="ghost" onClick={() => setClock.mutate(null)}>
              Real time
            </Button>
          </div>
          <p className="mt-3 text-xs text-faint">Karaoke nights, "Live now" and Peak Hours follow scene time ({DAYS.length}-day schedule, Central Time).</p>
        </div>
      </Section>

      <Section title="Growth loop" icon={<Sparkles className="size-5 text-violet" />}>
        <Button size="sm" disabled={!me || me.role === 'venue'} loading={referral.isPending} onClick={() => referral.mutate(undefined)}>
          <UserPlus className="size-4" /> A new singer joins via my QR card
        </Button>
        <p className="text-xs text-faint">Every 3 referrals earns Scene Builder (singers) or Scene Ambassador (KJs).</p>
      </Section>

      <div className="border-t border-line pt-5">
        <Button variant="danger" size="sm" loading={reset.isPending} onClick={() => (confirmReset ? (setConfirmReset(false), reset.mutate(undefined)) : setConfirmReset(true))}>
          <RotateCcw className="size-4" /> {confirmReset ? 'Tap again to wipe & reseed' : 'Reset demo data'}
        </Button>
      </div>
    </div>
  );
}


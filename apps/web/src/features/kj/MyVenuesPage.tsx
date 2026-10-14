import { Link } from '@tanstack/react-router';
import { Building2, CalendarClock, MapPin, Megaphone, Plus, Save, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, cx, EmptyState, PageLoader, Pill, Sheet, Toggle } from '~/components/ui';
import { VenueArt } from '~/components/VenueArt';
import { api, unwrap } from '~/lib/api';
import { DAYS, dayTimeLabel, endAfter, fromTimeInput, hoursLabel, toTimeInput } from '~/lib/format';
import { useLocation } from '~/lib/location';
import { qk, useAction, useMyVenues, type MyVenue } from '~/lib/queries';
import { VENUE_TYPES, type VenueType } from '~/lib/venues';

type Night = { dayOfWeek: number; startMin: number; endMin: number };

/** A KJ's venues: their nights at each (hours), Auto Promote, and venues they've listed. */
export function MyVenuesPage() {
  const { data, isLoading } = useMyVenues();
  const [adding, setAdding] = useState(false);
  if (isLoading || !data) return <PageLoader />;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold">
            My <span className="text-gradient">Venues</span>
          </h1>
          <p className="mt-1 text-muted">Set your hours at each venue and let Auto Promote post your nights for you.</p>
        </div>
        <Button variant="primary" onClick={() => setAdding(true)}>
          <Plus className="size-4" /> Add a venue
        </Button>
      </div>
      {data.length ? (
        <div className="grid gap-5 xl:grid-cols-2">
          {data.map((v) => (
            <VenueCard key={v.id} v={v} />
          ))}
        </div>
      ) : (
        <EmptyState icon={<Building2 />} title="No venues yet" body="Add the bars where you host. The owner can claim the listing later." />
      )}
      <AddVenueSheet open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

function VenueCard({ v }: { v: MyVenue }) {
  const mine = v.nights.filter((n) => n.mine);
  const others = v.nights.filter((n) => !n.mine);
  const [editing, setEditing] = useState(false);
  const promote = useAction((on: boolean) => unwrap(api.venues[':venueId']['auto-promote'].$put({ param: { venueId: v.id }, json: { on } })), {
    invalidate: [qk.myVenues, ['posts']],
    success: (r) => (r.on ? (r.next ? `Auto Promote on. Next post ${dayTimeLabel(r.next.scheduledFor)}` : 'Auto Promote on') : 'Auto Promote off'),
  });
  return (
    <Card className="overflow-hidden">
      <div className="relative">
        <VenueArt name={v.name} hue={v.hue} photoUrl={v.photoUrl} className="h-28" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/90 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 flex items-end gap-2 p-4">
          <div className="min-w-0 flex-1">
            <Link to="/venues/$slug" params={{ slug: v.slug }} className="block truncate font-display text-xl font-bold hover:underline">
              {v.name}
            </Link>
            <div className="truncate text-xs text-muted">
              {v.address} · {v.neighborhood}
            </div>
          </div>
          {!v.claimed && <Pill tone="gold">{v.listedByMe ? 'Listed by you' : 'Unclaimed'}</Pill>}
        </div>
      </div>
      <div className="space-y-4 p-4">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <CalendarClock className="size-4 text-cyan" /> Your hours here
            </div>
            {!editing && (
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                Adjust hours
              </Button>
            )}
          </div>
          {editing ? (
            <NightsEditor venueId={v.id} initial={mine} onDone={() => setEditing(false)} />
          ) : mine.length ? (
            <div className="flex flex-wrap gap-1.5">
              {mine.map((n) => (
                <span key={n.id} className="rounded-full border border-line bg-surface-2 px-3 py-1 text-xs">
                  <b>{DAYS[n.dayOfWeek]}</b> {hoursLabel(n.startMin, n.endMin)}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">No nights set. Add your hours so singers can find you.</p>
          )}
          {others.length > 0 && <p className="mt-2 text-xs text-faint">Other KJs here: {others.map((n) => `${n.kj?.displayName ?? 'TBA'} (${DAYS[n.dayOfWeek]})`).join(', ')}</p>}
        </div>
        <div className={cx('flex items-center gap-3 rounded-2xl border p-3', v.autoPromote ? 'border-pink/40 bg-pink/5' : 'border-line')}>
          <Megaphone className="size-5 shrink-0 text-pink" />
          <div className="min-w-0 flex-1 text-sm">
            <div className="font-semibold">Auto Promote</div>
            <div className="text-xs text-muted">Posts each of your nights here 24 hours before it starts.</div>
          </div>
          <Toggle on={v.autoPromote} onChange={(on) => promote.mutate(on)} label="Auto Promote" disabled={!mine.length} />
        </div>
        {!v.claimed && <p className="text-xs text-faint">The owner hasn't claimed this venue yet. Once they do, they can add photos, specials and coupons. Your nights stay as they are.</p>}
      </div>
    </Card>
  );
}

function NightsEditor({ venueId, initial, onDone }: { venueId: string; initial: Night[]; onDone: () => void }) {
  const [nights, setNights] = useState<Night[]>(initial.map(({ dayOfWeek, startMin, endMin }) => ({ dayOfWeek, startMin, endMin })));
  const save = useAction(() => unwrap(api.venues[':venueId']['my-nights'].$put({ param: { venueId }, json: { nights } })), {
    invalidate: [qk.myVenues, ['venues'], ['venue']],
    success: 'Hours saved',
    onSuccess: onDone,
  });
  const set = (i: number, patch: Partial<Night>) => setNights(nights.map((n, j) => (j === i ? { ...n, ...patch } : n)));
  return (
    <div className="space-y-2">
      {nights.map((n, i) => (
        <NightRow key={i} night={n} onChange={(p) => set(i, p)} onRemove={() => setNights(nights.filter((_, j) => j !== i))} />
      ))}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setNights([...nights, { dayOfWeek: 5, startMin: 21 * 60, endMin: 25 * 60 }])}>
          <Plus className="size-4" /> Add a night
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button size="sm" variant="primary" className="ml-auto" loading={save.isPending} onClick={() => save.mutate(undefined)}>
          <Save className="size-4" /> Save hours
        </Button>
      </div>
    </div>
  );
}

function NightRow({ night, onChange, onRemove }: { night: Night; onChange: (p: Partial<Night>) => void; onRemove?: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select value={night.dayOfWeek} onChange={(e) => onChange({ dayOfWeek: Number(e.target.value) })} className="!h-9 !py-0 text-sm">
        {DAYS.map((d, i) => (
          <option key={d} value={i}>
            {d}
          </option>
        ))}
      </select>
      <input type="time" value={toTimeInput(night.startMin)} onChange={(e) => onChange({ startMin: fromTimeInput(e.target.value), endMin: endAfter(fromTimeInput(e.target.value), night.endMin % 1440) })} className="!h-9 !py-0 text-sm" />
      <span className="text-xs text-muted">to</span>
      <input type="time" value={toTimeInput(night.endMin)} onChange={(e) => onChange({ endMin: endAfter(night.startMin, fromTimeInput(e.target.value)) })} className="!h-9 !py-0 text-sm" />
      {onRemove && (
        <button onClick={onRemove} className="text-faint hover:text-danger" aria-label="Remove night">
          <Trash2 className="size-4" />
        </button>
      )}
    </div>
  );
}

/** KJs can list a venue whose owner isn't on Karaoke Scene yet. */
function AddVenueSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const loc = useLocation();
  const [form, setForm] = useState({ name: '', address: '', neighborhood: '', city: 'Omaha' });
  const [types, setTypes] = useState<VenueType[]>(['Bar']);
  const [night, setNight] = useState<Night>({ dayOfWeek: 2, startMin: 21 * 60, endMin: 25 * 60 });
  const create = useAction(
    () => unwrap(api.venues.$post({ json: { ...form, venueTypes: types, nights: [night], lat: loc.current.lat + (Math.random() - 0.5) * 0.004, lng: loc.current.lng + (Math.random() - 0.5) * 0.004 } })),
    {
      invalidate: [qk.myVenues, qk.booth, ['venues']],
      success: (v) => `${v.name} is on the map 🎉`,
      onSuccess: () => {
        onClose();
        setForm({ name: '', address: '', neighborhood: '', city: 'Omaha' });
      },
    },
  );
  const set = (k: keyof typeof form, v: string) => setForm({ ...form, [k]: v });
  return (
    <Sheet open={open} onClose={onClose} title="Add a venue">
      <p className="mb-4 text-sm text-muted">Host somewhere that isn't on Karaoke Scene yet? Add it so singers can find your night. The owner can claim the listing later.</p>
      <div className="space-y-3">
        <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Venue name" className="w-full" />
        <input value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Street address" className="w-full" />
        <div className="flex gap-2">
          <input value={form.neighborhood} onChange={(e) => set('neighborhood', e.target.value)} placeholder="Neighborhood" className="min-w-0 flex-1" />
          <input value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="City" className="min-w-0 flex-1" />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted">
          <MapPin className="size-3.5" /> Pinned at your current location ({loc.label})
        </div>
        <div>
          <div className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">Venue type</div>
          <div className="flex flex-wrap gap-1.5">
            {VENUE_TYPES.map((t) => (
              <button key={t} onClick={() => setTypes(types.includes(t) ? types.filter((x) => x !== t) : [...types, t])} className={cx('rounded-full border px-3 py-1.5 text-xs font-semibold', types.includes(t) ? 'border-pink bg-pink/15' : 'border-line text-muted')}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">Your karaoke night</div>
          <NightRow night={night} onChange={(p) => setNight({ ...night, ...p })} />
        </div>
        <Button variant="primary" className="w-full" disabled={form.name.trim().length < 2 || form.address.trim().length < 3} loading={create.isPending} onClick={() => create.mutate(undefined)}>
          Add venue
        </Button>
      </div>
    </Sheet>
  );
}

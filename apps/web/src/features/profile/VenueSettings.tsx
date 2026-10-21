import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Camera, Clock, Disc3, Eye, FileText, Link2, Martini, Plus, Save, Store, Trash2, UtensilsCrossed, X } from 'lucide-react';
import { useState } from 'react';
import { useDebounced } from '~/lib/debounce';
import { Avatar, UserRow } from '~/components/Avatar';
import { FilePicker } from '~/components/FilePicker';
import { QrCard } from '~/components/QrCard';
import { Button, Card, cx, Section, Toggle } from '~/components/ui';
import { VenueArt } from '~/components/VenueArt';
import { api, unwrap } from '~/lib/api';
import { DAYS, endAfter, fromTimeInput, toTimeInput } from '~/lib/format';
import { qk, useAction, type Me } from '~/lib/queries';
import { VENUE_TYPES, type VenueType } from '~/lib/venues';
import { Field, PlanCard } from './MePage';

type Venue = NonNullable<Me['venue']>;
type HappyHour = Venue['happyHours'][number];
type Patch = Parameters<(typeof api.venues)[':venueId']['$patch']>[0]['json'];

/**
 * A venue's Profile & Settings: business details instead of a person's profile
 * (no Ghost Mode, avatar icon, age or years singing).
 */
export function VenueSettings({ me }: { me: Me }) {
  const v = me.venue!;
  const save = useAction((patch: Patch) => unwrap(api.venues[':venueId'].$patch({ param: { venueId: v.id }, json: patch })), {
    invalidate: [qk.me, ['venue'], ['venues'], ['profile']],
    success: 'Saved',
  });
  const [about, setAbout] = useState({ name: v.name, tagline: v.tagline, description: v.description });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold tracking-widest text-muted uppercase">Venue profile & settings</div>
          <h1 className="text-3xl font-extrabold">{v.name}</h1>
        </div>
        <Link to="/venues/$slug" params={{ slug: v.slug }}>
          <Button>
            <Eye className="size-4" /> View public page
          </Button>
        </Link>
      </div>

      <div className="grid gap-8 [&>*]:min-w-0 lg:grid-cols-[1fr_360px]">
        <div className="space-y-8">
          <Section title="Picture & details" icon={<Camera className="size-5 text-pink" />}>
            <Card className="space-y-5 p-5">
              <div className="flex flex-wrap items-center gap-4">
                <VenueArt name={v.name} hue={v.hue} photoUrl={v.photoUrl} className="h-28 w-44 shrink-0 rounded-2xl" />
                <div className="flex flex-col gap-2">
                  <FilePicker variant="primary" size="sm" onUploaded={(photoUrl) => save.mutate({ photoUrl })}>
                    <Camera className="size-4" /> {v.photoUrl ? 'Change picture' : 'Upload a picture'}
                  </FilePicker>
                  {v.photoUrl && (
                    <Button size="sm" variant="ghost" onClick={() => save.mutate({ photoUrl: null })}>
                      <X className="size-4" /> Remove
                    </Button>
                  )}
                  <span className="text-xs text-faint">Shows on your page, the map and your profile.</span>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Venue name">
                  <input value={about.name} onChange={(e) => setAbout({ ...about, name: e.target.value })} className="w-full" />
                </Field>
                <Field label="Tagline">
                  <input value={about.tagline} onChange={(e) => setAbout({ ...about, tagline: e.target.value })} maxLength={80} className="w-full" />
                </Field>
              </div>
              <Field label="About">
                <textarea value={about.description} onChange={(e) => setAbout({ ...about, description: e.target.value })} rows={3} maxLength={600} className="w-full" />
              </Field>
              <div className="flex justify-end">
                <Button variant="primary" disabled={about.name === v.name && about.tagline === v.tagline && about.description === v.description} loading={save.isPending} onClick={() => save.mutate(about)}>
                  <Save className="size-4" /> Save details
                </Button>
              </div>
            </Card>
          </Section>

          <Section title="Venue type" icon={<Store className="size-5 text-cyan" />}>
            <div className="flex flex-wrap gap-2">
              {VENUE_TYPES.map((t) => {
                const on = v.venueTypes.includes(t);
                return (
                  <button
                    key={t}
                    onClick={() => save.mutate({ venueTypes: on ? v.venueTypes.filter((x) => x !== t) : [...v.venueTypes, t as VenueType] })}
                    className={cx('rounded-full border px-4 py-2 text-sm font-semibold transition', on ? 'border-cyan bg-cyan/15 text-fg' : 'border-line text-muted hover:text-fg')}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </Section>

          <HoursEditor v={v} onSave={(hours) => save.mutate({ hours })} saving={save.isPending} />
          <HappyHoursEditor v={v} onSave={(happyHours) => save.mutate({ happyHours })} saving={save.isPending} />

          <Section title="Food" icon={<UtensilsCrossed className="size-5 text-gold" />}>
            <Card className="space-y-4 p-5">
              <div className="flex items-center gap-3">
                <Toggle on={v.foodAvailable} onChange={(foodAvailable) => save.mutate({ foodAvailable })} label="Food available" />
                <span className="text-sm font-semibold">Food available</span>
              </div>
              {v.foodAvailable && <MenuEditor v={v} onSave={(menuUrl) => save.mutate({ menuUrl })} />}
            </Card>
          </Section>

          <AssociatedKjs v={v} kjs={me.venueKjs} />
        </div>

        <aside className="space-y-6">
          <PlanCard me={me} />
          <QrCard kind="v" keyValue={v.slug} title={v.name} subtitle="Scan to check in" hue={v.hue} cta="Scan to check in" />
        </aside>
      </div>
    </div>
  );
}

function HoursEditor({ v, onSave, saving }: { v: Venue; onSave: (h: Venue['hours']) => void; saving: boolean }) {
  const [hours, setHours] = useState(v.hours);
  const dirty = JSON.stringify(hours) !== JSON.stringify(v.hours);
  return (
    <Section title="Hours" icon={<Clock className="size-5 text-violet" />}>
      <Card className="divide-y divide-line">
        {DAYS.map((day, d) => {
          const h = hours.find((x) => x.day === d);
          const set = (patch: Partial<Venue['hours'][number]> | null) =>
            setHours(patch === null ? hours.filter((x) => x.day !== d) : h ? hours.map((x) => (x.day === d ? { ...x, ...patch } : x)) : [...hours, { day: d, openMin: 16 * 60, closeMin: 26 * 60, ...patch }].sort((a, b) => a.day - b.day));
          return (
            <div key={day} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
              <span className="w-10 font-semibold">{day}</span>
              <Toggle on={!!h} onChange={(open) => set(open ? {} : null)} label={`Open ${day}`} />
              {h ? (
                <>
                  <input type="time" value={toTimeInput(h.openMin)} onChange={(e) => set({ openMin: fromTimeInput(e.target.value), closeMin: endAfter(fromTimeInput(e.target.value), h.closeMin % 1440) })} className="!h-9 !py-0" />
                  <span className="text-muted">to</span>
                  <input type="time" value={toTimeInput(h.closeMin)} onChange={(e) => set({ closeMin: endAfter(h.openMin, fromTimeInput(e.target.value)) })} className="!h-9 !py-0" />
                </>
              ) : (
                <span className="text-muted">Closed</span>
              )}
            </div>
          );
        })}
      </Card>
      <div className="flex justify-end">
        <Button variant="primary" size="sm" disabled={!dirty} loading={saving} onClick={() => onSave(hours)}>
          <Save className="size-4" /> Save hours
        </Button>
      </div>
      <p className="text-xs text-faint">Karaoke nights are set by your KJs (or in Venue HQ). These are your opening hours.</p>
    </Section>
  );
}

function HappyHoursEditor({ v, onSave, saving }: { v: Venue; onSave: (h: HappyHour[]) => void; saving: boolean }) {
  const [list, setList] = useState<HappyHour[]>(v.happyHours);
  const dirty = JSON.stringify(list) !== JSON.stringify(v.happyHours);
  const set = (i: number, patch: Partial<HappyHour>) => setList(list.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <Section
      title="Happy hours"
      icon={<Martini className="size-5 text-gold" />}
      action={
        <Button size="sm" onClick={() => setList([...list, { days: [1, 2, 3, 4, 5], startMin: 16 * 60, endMin: 18 * 60, details: '' }])}>
          <Plus className="size-4" /> Add
        </Button>
      }
    >
      <div className="space-y-2">
        {list.map((hh, i) => (
          <Card key={i} className="space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-1.5">
              {DAYS.map((day, d) => (
                <button key={day} onClick={() => set(i, { days: hh.days.includes(d) ? hh.days.filter((x) => x !== d) : [...hh.days, d].sort() })} className={cx('h-8 w-11 rounded-full text-xs font-semibold', hh.days.includes(d) ? 'bg-gold text-ink' : 'bg-surface-2 text-muted')}>
                  {day}
                </button>
              ))}
              <button onClick={() => setList(list.filter((_, j) => j !== i))} className="ml-auto text-faint hover:text-danger" aria-label="Remove happy hour">
                <Trash2 className="size-4" />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <input type="time" value={toTimeInput(hh.startMin)} onChange={(e) => set(i, { startMin: fromTimeInput(e.target.value), endMin: endAfter(fromTimeInput(e.target.value), hh.endMin % 1440) })} className="!h-9 !py-0" />
              <span className="text-muted">to</span>
              <input type="time" value={toTimeInput(hh.endMin)} onChange={(e) => set(i, { endMin: endAfter(hh.startMin, fromTimeInput(e.target.value)) })} className="!h-9 !py-0" />
              <input value={hh.details} onChange={(e) => set(i, { details: e.target.value })} maxLength={120} placeholder="$2 off drafts and wells" className="min-w-40 flex-1" />
            </div>
          </Card>
        ))}
        {!list.length && <p className="text-sm text-muted">No happy hours yet.</p>}
      </div>
      <div className="flex justify-end">
        <Button variant="primary" size="sm" disabled={!dirty || list.some((h) => !h.days.length)} loading={saving} onClick={() => onSave(list)}>
          <Save className="size-4" /> Save happy hours
        </Button>
      </div>
    </Section>
  );
}

/** Menu as an uploaded PDF or a link to an online menu. */
function MenuEditor({ v, onSave }: { v: Venue; onSave: (url: string | null) => void }) {
  const [link, setLink] = useState('');
  const isPdf = v.menuUrl?.startsWith('/api/media/');
  return (
    <div className="space-y-3">
      {v.menuUrl ? (
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2/50 p-3 text-sm">
          {isPdf ? <FileText className="size-5 text-gold" /> : <Link2 className="size-5 text-gold" />}
          <a href={v.menuUrl} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate underline underline-offset-4">
            {isPdf ? 'Menu (PDF)' : v.menuUrl}
          </a>
          <button onClick={() => onSave(null)} className="text-faint hover:text-danger" aria-label="Remove menu">
            <Trash2 className="size-4" />
          </button>
        </div>
      ) : (
        <p className="text-sm text-muted">Add your menu so singers know what's on offer.</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <FilePicker size="sm" accept="application/pdf,image/*" onUploaded={(url) => onSave(url)}>
          <FileText className="size-4" /> Upload menu PDF
        </FilePicker>
        <span className="text-xs text-muted">or</span>
        <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://yourbar.com/menu" className="!h-9 min-w-48 flex-1 !py-0 text-sm" />
        <Button size="sm" disabled={!/^https?:\/\/\S+\.\S+/.test(link)} onClick={() => (onSave(link), setLink(''))}>
          Save link
        </Button>
      </div>
    </div>
  );
}

/** The KJs who host at this venue. Venues can add or remove them. */
function AssociatedKjs({ v, kjs }: { v: Venue; kjs: Me['venueKjs'] }) {
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const search = useQuery({ queryKey: ['people', dq], queryFn: () => unwrap(api.profiles.search.$get({ query: { q: dq } })), enabled: dq.length > 1 });
  const set = useAction((x: { kjId: string; on: boolean }) => unwrap(api.venues[':venueId'].kjs[':kjId'].$put({ param: { venueId: v.id, kjId: x.kjId }, json: { on: x.on } })), {
    invalidate: [qk.me, ['venue']],
    success: (_, x) => (x.on ? 'KJ added' : 'KJ removed'),
    onSuccess: () => setQ(''),
  });
  const linked = new Set(kjs.map((k) => k.id));
  const results = search.data?.filter((u) => u.role === 'kj' && !linked.has(u.id)) ?? [];
  return (
    <Section title="Associated KJs" icon={<Disc3 className="size-5 text-cyan" />}>
      <Card className="p-2">
        {kjs.map((k) => (
          <UserRow
            key={k.id}
            user={k}
            right={
              <Button size="sm" variant="ghost" onClick={() => set.mutate({ kjId: k.id, on: false })}>
                Remove
              </Button>
            }
          />
        ))}
        {!kjs.length && <p className="p-3 text-sm text-muted">No KJs yet.</p>}
      </Card>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Add a KJ by name…" className="w-full" />
      {results.length > 0 && (
        <Card className="p-2">
          {results.map((k) => (
            <div key={k.id} className="flex items-center gap-3 p-2">
              <Avatar user={k} size="sm" />
              <span className="flex-1 text-sm font-semibold">{k.displayName}</span>
              <Button size="sm" onClick={() => set.mutate({ kjId: k.id, on: true })}>
                <Plus className="size-4" /> Add
              </Button>
            </div>
          ))}
        </Card>
      )}
    </Section>
  );
}

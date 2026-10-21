import { lazy, Suspense, useState } from 'react';
import { cx } from '~/components/ui';
import { useLocation, type LatLng } from '~/lib/location';
import { VENUE_TYPES, type VenueType } from '~/lib/venues';

const PinPicker = lazy(() => import('~/components/PinPicker'));

export type VenuePlace = { name: string; address: string; neighborhood: string; city: string; venueTypes: VenueType[] } & LatLng;

/** Name, address, type and map pin for a new venue (KJ listing or owner setup). */
export function useVenuePlace() {
  const loc = useLocation();
  // Start the pin where you are (or the city center); `moved` tracks an explicit placement.
  const [draft, setPlace] = useState<VenuePlace>({ name: '', address: '', neighborhood: '', city: 'Omaha', venueTypes: ['Bar'], ...loc.current });
  const [moved, setMoved] = useState(false);
  // Until the pin is placed by hand it follows the device (a GPS fix may arrive after this mounts).
  const place = moved ? draft : { ...draft, ...loc.current };
  const valid = place.name.trim().length >= 2 && place.address.trim().length >= 3 && place.city.trim().length >= 2 && (moved || loc.known);
  return { place, setPlace, moved, setMoved, valid, precise: loc.known };
}

export function VenuePlaceFields({ state }: { state: ReturnType<typeof useVenuePlace> }) {
  const { place, setPlace, setMoved, precise, moved } = state;
  const set = (patch: Partial<VenuePlace>) => setPlace({ ...place, ...patch });
  return (
    <div className="space-y-3">
      <input value={place.name} onChange={(e) => set({ name: e.target.value })} placeholder="Venue name" className="w-full" />
      <input value={place.address} onChange={(e) => set({ address: e.target.value })} placeholder="Street address" className="w-full" />
      <div className="flex gap-2">
        <input value={place.neighborhood} onChange={(e) => set({ neighborhood: e.target.value })} placeholder="Neighborhood" className="min-w-0 flex-1" />
        <input value={place.city} onChange={(e) => set({ city: e.target.value })} placeholder="City" className="min-w-0 flex-1" />
      </div>
      <div>
        <div className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">On the map{!precise && !moved && <span className="ml-2 font-normal normal-case text-gold">place the pin</span>}</div>
        <Suspense fallback={<div className="h-56 animate-pulse rounded-2xl bg-surface-2" />}>
          <PinPicker
            value={place}
            precise={precise}
            onChange={(at) => {
              setMoved(true);
              set(at);
            }}
          />
        </Suspense>
      </div>
      <div>
        <div className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">Venue type</div>
        <div className="flex flex-wrap gap-1.5">
          {VENUE_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => set({ venueTypes: place.venueTypes.includes(t) ? place.venueTypes.filter((x) => x !== t) : [...place.venueTypes, t] })}
              className={cx('rounded-full border px-3 py-1.5 text-xs font-semibold', place.venueTypes.includes(t) ? 'border-pink bg-pink/15' : 'border-line text-muted')}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

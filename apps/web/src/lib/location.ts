import { createStore } from './store';

export type LatLng = { lat: number; lng: number };
export const OMAHA: LatLng = { lat: 41.2565, lng: -95.9345 };

/**
 * Where the app thinks you are: the device's GPS. The local demo can also use a simulated
 * location (teleport to a venue, walk away to trigger Auto Leave); production builds can't.
 */
export const locationStore = createStore<{ mode: 'sim' | 'real'; sim: LatLng; real: LatLng | null; label: string }>('ks.location', {
  mode: __DEMO__ ? 'sim' : 'real',
  sim: OMAHA,
  real: null,
  label: 'Downtown Omaha',
});

const resolve = (s: ReturnType<typeof locationStore.get>) => {
  const mode = __DEMO__ ? s.mode : 'real';
  // Before the first GPS fix, center on the scene (but don't report it as a real position).
  return { ...s, mode, current: mode === 'real' ? (s.real ?? OMAHA) : s.sim, known: mode === 'sim' || !!s.real };
};

export const currentLocation = (): LatLng => resolve(locationStore.get()).current;
export const useLocation = () => resolve(locationStore.use());

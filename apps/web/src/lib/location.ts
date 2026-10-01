import { createStore } from './store';

export type LatLng = { lat: number; lng: number };
export const OMAHA: LatLng = { lat: 41.2565, lng: -95.9345 };

/**
 * Where the app thinks you are. Demos use a simulated location (teleport to a venue,
 * walk away to trigger Auto Leave); "real" mode uses the browser's GPS.
 */
export const locationStore = createStore<{ mode: 'sim' | 'real'; sim: LatLng; real: LatLng | null; label: string }>('ks.location', {
  mode: 'sim',
  sim: OMAHA,
  real: null,
  label: 'Downtown Omaha',
});

export function currentLocation(): LatLng {
  const s = locationStore.get();
  return s.mode === 'real' && s.real ? s.real : s.sim;
}

export const useLocation = () => {
  const s = locationStore.use();
  return { ...s, current: s.mode === 'real' && s.real ? s.real : s.sim };
};

export function teleport(to: LatLng, label: string) {
  locationStore.set({ mode: 'sim', sim: to, label });
}

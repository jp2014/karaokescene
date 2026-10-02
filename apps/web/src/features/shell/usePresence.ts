import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { api, unwrap } from '~/lib/api';
import { locationStore, useLocation } from '~/lib/location';
import { qk, type Me } from '~/lib/queries';

/**
 * The geolocation heartbeat: sends the (real or simulated) location to the API, which
 * handles Auto Leave and suggests Auto Check-in when you arrive somewhere with karaoke.
 */
export function usePresenceHeartbeat(me: Me | undefined) {
  const loc = useLocation();
  const qc = useQueryClient();
  const prompted = useRef<string | null>(null);
  const { lat, lng } = loc.current;
  const known = loc.known;

  // Real GPS mode: watch the device position.
  useEffect(() => {
    if (loc.mode !== 'real' || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (p) => locationStore.set({ real: { lat: p.coords.latitude, lng: p.coords.longitude } }),
      () => toast.error('Location is off, so Auto Check-in and Auto Leave are paused'),
      { enableHighAccuracy: true, maximumAge: 15_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [loc.mode]);

  useEffect(() => {
    // No position yet (GPS not granted/fixed): don't report one, or Auto Leave would misfire.
    if (!me || me.role !== 'singer' || !known) return;
    let cancelled = false;
    async function beat() {
      const res = await unwrap(api.presence.location.$post({ json: { lat, lng } })).catch(() => null);
      if (!res || cancelled) return;
      if (res.autoLeft) {
        toast(`👋 You left ${res.autoLeft.name}`, { description: 'Auto Leave checked you out and let the KJ know.' });
        qc.invalidateQueries({ queryKey: qk.me });
        qc.invalidateQueries({ queryKey: qk.myLive });
      }
      if (res.arrivedAt && prompted.current !== res.arrivedAt.venueId) {
        prompted.current = res.arrivedAt.venueId;
        const venue = res.arrivedAt;
        toast(`📍 You're at ${venue.name}`, {
          description: 'Check in so the KJ knows you’re here to sing.',
          duration: 12_000,
          action: {
            label: 'Check in',
            onClick: async () => {
              await unwrap(api.presence['check-in'].$post({ json: { venueId: venue.venueId, method: 'geo' } }));
              toast.success(`Checked in at ${venue.name}`);
              qc.invalidateQueries();
            },
          },
        });
      }
      if (!res.arrivedAt && !res.checkedInAt) prompted.current = null;
    }
    beat();
    const t = setInterval(beat, 20_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [me?.id, me?.role, lat, lng, known, qc]);
}

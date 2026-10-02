import { useEffect } from 'react';
import { refreshPushToken } from '~/lib/push';
import { qk, type Me } from '~/lib/queries';
import { useLiveQueries } from '~/lib/realtime';

/**
 * Keeps live data fresh from Realtime signals (replaces polling):
 * - user:<me>    new notification → the list (toasts follow), plus anything it may affect
 * - venue:<id>   queue / who's-here changes where I'm checked in or running the show
 * - scene        check-ins anywhere → map counts and "KJ Now"
 */
export function useRealtimeSync(me: Me | undefined) {
  const myVenue = me?.kjSession?.venueId ?? me?.checkin?.venueId;
  useLiveQueries(me ? `user:${me.id}` : null, [qk.notifications, qk.booth, qk.myLive, qk.me]);
  useLiveQueries(myVenue ? `venue:${myVenue}` : null, [qk.booth, qk.myLive, qk.me]);
  useLiveQueries(me ? 'scene' : null, [['venues']]);
  useEffect(() => {
    if (me?.id) refreshPushToken();
  }, [me?.id]);
}

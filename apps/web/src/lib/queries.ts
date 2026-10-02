import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, unwrap } from './api';
import { auth } from './auth';

/**
 * Query keys in one place so invalidation stays consistent. Live data (booth, my night,
 * notifications, venue crowds) is refreshed by Realtime signals, not polling: see useRealtimeSync.
 */
export const qk = {
  me: ['me'] as const,
  venues: (f: object) => ['venues', f] as const,
  venue: (slug: string) => ['venue', slug] as const,
  profile: (handle: string) => ['profile', handle] as const,
  circle: ['circle'] as const,
  mySongs: ['songs', 'mine'] as const,
  booth: ['booth'] as const,
  myLive: ['live', 'mine'] as const,
  notifications: ['notifications'] as const,
  praise: ['praise'] as const,
  events: ['events'] as const,
};

const signedIn = () => auth.signedIn();

export const useMe = () =>
  useQuery({ queryKey: qk.me, queryFn: () => unwrap(api.profiles.me.$get()), enabled: signedIn(), retry: false, staleTime: 10_000 });

export type Me = NonNullable<ReturnType<typeof useMe>['data']>;

export type VenueFilters = {
  lat?: number;
  lng?: number;
  radiusMi?: number;
  fromMin?: number;
  toMin?: number;
  liveOnly?: boolean;
  kjNowOnly?: boolean;
  tonightOnly?: boolean;
};

export const useVenues = (f: VenueFilters) =>
  useQuery({
    queryKey: qk.venues(f),
    queryFn: () =>
      unwrap(
        api.discover.venues.$get({
          query: Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined && v !== false).map(([k, v]) => [k, String(v)])),
        }),
      ),
    placeholderData: keepPreviousData,
  });
export type VenueSummary = NonNullable<ReturnType<typeof useVenues>['data']>['venues'][number];

export const useVenue = (slug: string) =>
  useQuery({ queryKey: qk.venue(slug), queryFn: () => unwrap(api.discover.venues[':slug'].$get({ param: { slug } })) });
export type VenueDetail = NonNullable<ReturnType<typeof useVenue>['data']>;

export const useProfile = (handle: string) =>
  useQuery({ queryKey: qk.profile(handle), queryFn: () => unwrap(api.profiles[':handle'].$get({ param: { handle } })) });
export type Profile = NonNullable<ReturnType<typeof useProfile>['data']>;

export const useCircle = () => useQuery({ queryKey: qk.circle, queryFn: () => unwrap(api.social.circle.$get()), enabled: signedIn() });
export const useMySongs = () => useQuery({ queryKey: qk.mySongs, queryFn: () => unwrap(api.songs.mine.$get()), enabled: signedIn() });
export type ListSong = NonNullable<ReturnType<typeof useMySongs>['data']>[number];

export const useBooth = () => useQuery({ queryKey: qk.booth, queryFn: () => unwrap(api.live.booth.$get()) });
export type Booth = NonNullable<ReturnType<typeof useBooth>['data']>;
export const useMyLive = (enabled = true) =>
  useQuery({ queryKey: qk.myLive, queryFn: () => unwrap(api.live.mine.$get()), enabled: enabled && signedIn() });

export const useNotifications = () =>
  useQuery({ queryKey: qk.notifications, queryFn: () => unwrap(api.notifications.$get()), enabled: signedIn() });

export const usePraiseFeed = () => useQuery({ queryKey: qk.praise, queryFn: () => unwrap(api.social.praise.$get()), refetchInterval: 20_000 });
export const useEvents = () => useQuery({ queryKey: qk.events, queryFn: () => unwrap(api.venues.events.$get()) });

/**
 * A mutation with the app's standard UX: success toast, error toast, then
 * invalidate the queries that the change affects.
 */
export function useAction<TArgs, TResult>(
  fn: (args: TArgs) => Promise<TResult>,
  opts: { invalidate?: QueryKey[]; success?: string | ((r: TResult, a: TArgs) => string | undefined); onSuccess?: (r: TResult, a: TArgs) => void } = {},
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async (r, a) => {
      const msg = typeof opts.success === 'function' ? opts.success(r, a) : opts.success;
      if (msg) toast.success(msg);
      opts.onSuccess?.(r, a);
      await Promise.all((opts.invalidate ?? []).map((queryKey) => qc.invalidateQueries({ queryKey })));
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

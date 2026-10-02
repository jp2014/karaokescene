import { useQuery, type QueryClient } from '@tanstack/react-query';
import { hc } from 'hono/client';
import type { DemoApiType } from '@ks/api/demo';
import { apiBaseUrl, unwrap } from '~/lib/api';
import { auth } from '~/lib/auth';
import { setServerOffset } from '~/lib/format';

/** Client for the local-only /api/demo endpoints. */
export const demoApi = hc<DemoApiType>(`${apiBaseUrl}/demo`, {
  headers: (): Record<string, string> => {
    const token = auth.token();
    return token ? { authorization: `Bearer ${token}` } : {};
  },
});

const KEY = 'ks.token';

/**
 * Persona tokens live in sessionStorage so each browser tab can be a different persona
 * (e.g. a KJ in one tab, a singer in another), falling back to the last one used.
 */
export const personaToken = {
  get: (): string | null => sessionStorage.getItem(KEY) ?? localStorage.getItem(KEY),
  set(token: string) {
    sessionStorage.setItem(KEY, token);
    localStorage.setItem(KEY, token);
  },
  clear() {
    sessionStorage.removeItem(KEY);
    localStorage.removeItem(KEY);
  },
};

export const demoKeys = { clock: ['demo', 'clock'] as const, accounts: ['demo', 'accounts'] as const };

export const useClock = () =>
  useQuery({
    queryKey: demoKeys.clock,
    queryFn: async () => {
      const c = await unwrap(demoApi.clock.$get());
      setServerOffset(c.offsetMs);
      return c;
    },
    refetchInterval: 30_000,
  });

export const useDemoAccounts = () => useQuery({ queryKey: demoKeys.accounts, queryFn: () => unwrap(demoApi.accounts.$get()) });

/** Sign in as a seeded account and start fresh. */
export async function signInAs(userId: string, qc: QueryClient) {
  const { token, user } = await unwrap(demoApi['sign-in'].$post({ json: { userId } }));
  personaToken.set(token);
  qc.clear();
  return user;
}

export const demoUpgrade = () => unwrap(demoApi.upgrade.$post());
export const demoSetPremiere = (venueId: string, on: boolean) => unwrap(demoApi.premiere[':venueId'].$put({ param: { venueId }, json: { on } }));

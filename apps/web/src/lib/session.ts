import type { QueryClient } from '@tanstack/react-query';
import { api, tokenStore, unwrap } from './api';

/** Demo sign-in: get a token for a seeded account and start fresh. */
export async function signInAs(userId: string, qc: QueryClient) {
  const { token, user } = await unwrap(api.auth['demo-sign-in'].$post({ json: { userId } }));
  tokenStore.set(token);
  qc.clear();
  return user;
}

export function signOut(qc: QueryClient) {
  tokenStore.clear();
  qc.clear();
}

export const homeFor = (role: 'singer' | 'kj' | 'venue') => (role === 'kj' ? '/kj' : role === 'venue' ? '/hq' : '/');

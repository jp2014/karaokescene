import type { QueryClient } from '@tanstack/react-query';
import { auth } from './auth';

export async function signOut(qc: QueryClient) {
  await auth.signOut();
  qc.clear();
}

export const homeFor = (role: 'singer' | 'kj' | 'venue') => (role === 'kj' ? '/kj' : role === 'venue' ? '/hq' : '/');

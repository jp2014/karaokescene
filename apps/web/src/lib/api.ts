import { createApiClient, unwrap, ApiError } from '@ks/api-client';

const KEY = 'ks.token';

/**
 * Tokens live in sessionStorage so each browser tab can be a different persona
 * (e.g. a KJ in one tab, a singer in another), falling back to the last one used.
 */
export const tokenStore = {
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

const baseUrl = import.meta.env.VITE_API_URL ?? `${window.location.origin}/api`;
export const api = createApiClient(baseUrl, tokenStore.get);
export { unwrap, ApiError };

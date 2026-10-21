import { createApiClient, inRegion, unwrap, ApiError } from '@ks/api-client';
import { auth } from './auth';

export const apiBaseUrl = import.meta.env.VITE_API_URL ?? `${window.location.origin}/api`;
/** Production: the database's region, so the API runs beside it (set by scripts/release.mjs). */
const apiRegion = import.meta.env.VITE_API_REGION || undefined;
export const api = createApiClient(apiBaseUrl, auth.token, { region: apiRegion });
/** Absolute URL for a raw `fetch` to the API (uploads), pinned like the typed client. */
export const apiUrl = (path: string) => inRegion(`${apiBaseUrl}${path}`, apiRegion);
export { unwrap, ApiError };

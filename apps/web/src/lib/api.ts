import { createApiClient, unwrap, ApiError } from '@ks/api-client';
import { auth } from './auth';

export const apiBaseUrl = import.meta.env.VITE_API_URL ?? `${window.location.origin}/api`;
export const api = createApiClient(apiBaseUrl, auth.token);
export { unwrap, ApiError };

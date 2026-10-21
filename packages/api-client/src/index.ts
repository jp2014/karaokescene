import { hc, type ClientResponse } from 'hono/client';
import type { SuccessStatusCode } from 'hono/utils/http-status';
import type { ApiType } from '@ks/api/app';

/**
 * Typed client for the Karaoke Scene API, shared by the web app and any future
 * native app (React Native / Expo can import this package unchanged).
 */
export function createApiClient(baseUrl: string, getToken: () => string | null, opts: { region?: string } = {}) {
  return hc<ApiType>(baseUrl, {
    headers: (): Record<string, string> => {
      const token = getToken();
      return token ? { authorization: `Bearer ${token}` } : {};
    },
    fetch: (input: string | URL | Request, init?: RequestInit) => fetch(typeof input === 'string' || input instanceof URL ? inRegion(input, opts.region) : input, init),
  });
}

/**
 * Supabase runs an Edge Function in the region nearest the caller unless told otherwise. The API
 * makes several database round trips per request, so it should run next to the database instead.
 * A query parameter (unlike the x-region header) doesn't add a CORS preflight.
 */
export function inRegion(url: string | URL, region: string | undefined) {
  if (!region) return url.toString();
  const u = new URL(url);
  u.searchParams.set('forceFunctionRegion', region);
  return u.toString();
}

export type ApiClient = ReturnType<typeof createApiClient>;

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** The JSON body of the 2xx variants of a response union (drops typed validation errors). */
export type OkBody<R> = R extends ClientResponse<infer T, infer S, infer _F> ? (S extends SuccessStatusCode ? T : never) : never;

/** Await a client call, throw an ApiError on non-2xx, and return the typed JSON body. */
export async function unwrap<R extends ClientResponse<unknown, number, string>>(call: Promise<R>): Promise<OkBody<R>> {
  const res = await call;
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: unknown };
    // Route errors are strings; request validation failures (zod) arrive as an object.
    const message = typeof body.error === 'string' ? body.error : res.status === 400 ? 'Some of that wasn’t accepted. Check it and try again.' : `Request failed (${res.status})`;
    throw new ApiError(res.status, message);
  }
  return (await res.json()) as OkBody<R>;
}

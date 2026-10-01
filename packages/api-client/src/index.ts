import { hc, type ClientResponse } from 'hono/client';
import type { SuccessStatusCode } from 'hono/utils/http-status';
import type { ApiType } from '@ks/api/app';

/**
 * Typed client for the Karaoke Scene API, shared by the web app and any future
 * native app (React Native / Expo can import this package unchanged).
 */
export function createApiClient(baseUrl: string, getToken: () => string | null) {
  return hc<ApiType>(baseUrl, {
    headers: (): Record<string, string> => {
      const token = getToken();
      return token ? { authorization: `Bearer ${token}` } : {};
    },
  });
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
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, body.error ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as OkBody<R>;
}

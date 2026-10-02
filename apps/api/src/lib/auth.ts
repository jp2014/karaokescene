import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify, type JWTPayload } from 'jose';
import { supabaseConfig, type SupabaseConfig } from './supabase.ts';

/** What we need from a Supabase Auth user to find or create their profile. */
export type AuthIdentity = { authId: string; email: string | null; name: string | null };

let jwks: { url: string; set: ReturnType<typeof createRemoteJWKSet> } | null = null;
const legacyCache = new Map<string, { identity: AuthIdentity | null; until: number }>();

function identityFrom(sub: string, email: unknown, meta: Record<string, unknown> | undefined): AuthIdentity {
  const name = meta?.full_name ?? meta?.name ?? meta?.user_name;
  return { authId: sub, email: typeof email === 'string' ? email : null, name: typeof name === 'string' ? name : null };
}

/** Projects on asymmetric signing keys (the default): verify locally against the JWKS. */
async function verifyWithJwks(cfg: SupabaseConfig, token: string) {
  if (jwks?.url !== cfg.url) jwks = { url: cfg.url, set: createRemoteJWKSet(new URL(`${cfg.url}/auth/v1/.well-known/jwks.json`)) };
  const { payload } = await jwtVerify<JWTPayload & { email?: string; user_metadata?: Record<string, unknown> }>(token, jwks.set, {
    issuer: `${cfg.url}/auth/v1`,
    audience: 'authenticated',
  });
  return payload.sub ? identityFrom(payload.sub, payload.email, payload.user_metadata) : null;
}

/** Projects still on the legacy shared secret (HS256): ask Auth, and cache briefly. */
async function verifyWithAuthServer(cfg: SupabaseConfig, token: string) {
  const hit = legacyCache.get(token);
  if (hit && hit.until > Date.now()) return hit.identity;
  const res = await fetch(`${cfg.url}/auth/v1/user`, { headers: { apikey: cfg.serviceKey, authorization: `Bearer ${token}` } });
  const user = res.ok ? ((await res.json()) as { id: string; email?: string; user_metadata?: Record<string, unknown> }) : null;
  const identity = user ? identityFrom(user.id, user.email, user.user_metadata) : null;
  if (legacyCache.size > 1000) legacyCache.clear();
  legacyCache.set(token, { identity, until: Date.now() + 60_000 });
  return identity;
}

/** Verify a Supabase Auth access token. Returns null for anything that isn't a valid, current one. */
export async function verifySupabaseToken(token: string): Promise<AuthIdentity | null> {
  const cfg = supabaseConfig();
  if (!cfg) return null;
  let alg: string | undefined;
  try {
    alg = decodeProtectedHeader(token).alg;
  } catch {
    return null; // not a JWT (e.g. a local demo token)
  }
  try {
    return alg === 'HS256' ? await verifyWithAuthServer(cfg, token) : await verifyWithJwks(cfg, token);
  } catch {
    return null;
  }
}

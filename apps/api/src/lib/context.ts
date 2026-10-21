import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';
import { schema } from '../db/client.ts';
import { profiles } from '../modules/profiles/service.ts';
import { verifySupabaseToken, type AuthIdentity } from './auth.ts';
import { fail } from './http.ts';

export type User = typeof schema.users.$inferSelect;
/** `identity`: a valid Supabase sign-in. `viewer`: its profile, once onboarding created one. */
export type AppEnv = { Variables: { viewer: User | null; identity: AuthIdentity | null } };

type TokenResolver = (token: string) => Promise<User | null>;
let devResolver: TokenResolver | null = null;

/** Local development only: the Node host registers the demo persona sign-in here. */
export function setDevTokenResolver(resolver: TokenResolver) {
  devResolver = resolver;
}

/**
 * Resolves the viewer from a Supabase Auth access token (email code or Google sign-in).
 * Works identically for the web app and a future native app. A first-time sign-in has an
 * identity but no profile until it picks a role (POST /profiles/onboard).
 */
export const viewerMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  let viewer: User | null = null;
  let identity: AuthIdentity | null = null;
  if (token) {
    identity = await verifySupabaseToken(token);
    if (identity) viewer = await profiles.byAuthId(identity.authId);
    else if (devResolver) viewer = await devResolver(token);
  }
  c.set('identity', identity);
  c.set('viewer', viewer);
  await next();
});

export function requireIdentity(c: Context<AppEnv>): AuthIdentity {
  return c.get('identity') ?? fail(401, 'Sign in first');
}

export function requireViewer(c: Context<AppEnv>, role?: User['role']): User {
  const viewer = c.get('viewer');
  if (!viewer) return fail(c.get('identity') ? 403 : 401, c.get('identity') ? 'Finish setting up your account first' : 'Sign in first');
  if (role && viewer.role !== role) return fail(403, `Only ${role} accounts can do that`);
  return viewer;
}

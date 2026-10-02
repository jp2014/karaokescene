import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';
import { schema } from '../db/client.ts';
import { profiles } from '../modules/profiles/service.ts';
import { verifySupabaseToken } from './auth.ts';
import { fail } from './http.ts';

export type User = typeof schema.users.$inferSelect;
export type AppEnv = { Variables: { viewer: User | null } };

type TokenResolver = (token: string) => Promise<User | null>;
let devResolver: TokenResolver | null = null;

/** Local development only: the Node host registers the demo persona sign-in here. */
export function setDevTokenResolver(resolver: TokenResolver) {
  devResolver = resolver;
}

/**
 * Resolves the viewer from a Supabase Auth access token (Google, Apple or Facebook
 * sign-in). Works identically for the web app and a future native app. A first-time
 * user gets a singer profile created from their auth identity.
 */
export const viewerMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  let viewer: User | null = null;
  if (token) {
    const identity = await verifySupabaseToken(token);
    if (identity) viewer = await profiles.forAuthIdentity(identity);
    else if (devResolver) viewer = await devResolver(token);
  }
  c.set('viewer', viewer);
  await next();
});

export function requireViewer(c: Context<AppEnv>, role?: User['role']): User {
  const viewer = c.get('viewer');
  if (!viewer) return fail(401, 'Sign in first');
  if (role && viewer.role !== role) return fail(403, `Only ${role} accounts can do that`);
  return viewer;
}

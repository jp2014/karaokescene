import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db/client.ts';
import { fail } from './http.ts';

export type User = typeof schema.users.$inferSelect;
export type AppEnv = { Variables: { viewer: User | null } };

/**
 * Resolves the viewer from a bearer token. Works identically for the web app and a
 * future native app; swapping in real OAuth only changes how tokens get issued.
 */
export const viewerMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  let viewer: User | null = null;
  if (token) {
    const session = await db.query.sessions.findFirst({ where: eq(schema.sessions.token, token) });
    if (session) viewer = (await db.query.users.findFirst({ where: eq(schema.users.id, session.userId) })) ?? null;
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

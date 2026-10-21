import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireIdentity, requireViewer, type AppEnv } from '../../lib/context.ts';
import { isStoredMediaUrl } from '../../lib/storage.ts';
import { profiles } from './service.ts';

const vis = z.enum(['everyone', 'friends', 'nobody']);
const patch = z.object({
  displayName: z.string().min(2).max(40),
  bio: z.string().max(200),
  avatarHue: z.number().int().min(0).max(359),
  avatarEmoji: z.string().max(8),
  avatarUrl: z.string().max(500).refine(isStoredMediaUrl, 'Upload a photo').nullable(),
  hometown: z.string().max(60).nullable(),
  ageRange: z.string().max(20).nullable(),
  favoriteNight: z.string().max(20).nullable(),
  yearsSinging: z.number().int().min(0).max(80).nullable(),
  isPro: z.boolean(),
  ghostMode: z.boolean(),
  privacy: z.object({ hometown: vis, ageRange: vis, favoriteNight: vis, yearsSinging: vis, proStatus: vis, songList: vis }).partial(),
}).partial();

export const profileRoutes = new Hono<AppEnv>()
  /** Where this caller stands: signed out, signed in but not onboarded, or ready (with their profile). */
  .get('/session', async (c) => {
    const viewer = c.get('viewer');
    const identity = c.get('identity');
    if (viewer) return c.json({ status: 'ready' as const, email: identity?.email ?? null, me: await profiles.me(viewer) });
    if (identity) return c.json({ status: 'onboarding' as const, email: identity.email, name: identity.name, me: null });
    return c.json({ status: 'signed-out' as const, email: null, me: null });
  })
  .post('/onboard', zValidator('json', z.object({ role: z.enum(['singer', 'kj', 'venue']), displayName: z.string().max(40).optional() })), async (c) =>
    c.json(await profiles.me(await profiles.onboard(requireIdentity(c), c.req.valid('json')))),
  )
  .get('/me', async (c) => c.json(await profiles.me(requireViewer(c))))
  .patch('/me', zValidator('json', patch), async (c) => c.json(await profiles.update(requireViewer(c), c.req.valid('json'))))
  .get('/search', async (c) => c.json(await profiles.search(c.get('viewer'), c.req.query('q') ?? '')))
  .get('/:handle', async (c) => c.json(await profiles.view(c.get('viewer'), c.req.param('handle'))));

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { HTTPException } from 'hono/http-exception';
import { viewerMiddleware, type AppEnv } from './lib/context.ts';
import { authRoutes, profileRoutes } from './modules/profiles/routes.ts';
import { discoveryRoutes } from './modules/discovery/routes.ts';
import { presenceRoutes } from './modules/presence/routes.ts';
import { liveRoutes } from './modules/live/routes.ts';
import { venueRoutes } from './modules/venues/routes.ts';
import { songRoutes } from './modules/songs/routes.ts';
import { socialRoutes } from './modules/social/routes.ts';
import { reputationRoutes } from './modules/reputation/routes.ts';
import { notificationRoutes } from './modules/notifications/routes.ts';
import { qrRoutes } from './modules/qr/routes.ts';
import { promoRoutes } from './modules/promo/routes.ts';
import { debugRoutes } from './modules/debug/routes.ts';

/**
 * The HTTP surface. Each module owns its routes; this file only composes them.
 * Runtime-agnostic: `app.fetch` runs on Node, Bun, Deno, Cloudflare Workers or Lambda.
 */
const api = new Hono<AppEnv>()
  .use(viewerMiddleware)
  .get('/health', (c) => c.json({ ok: true }))
  .route('/auth', authRoutes)
  .route('/profiles', profileRoutes)
  .route('/discover', discoveryRoutes)
  .route('/presence', presenceRoutes)
  .route('/live', liveRoutes)
  .route('/venues', venueRoutes)
  .route('/songs', songRoutes)
  .route('/social', socialRoutes)
  .route('/reputation', reputationRoutes)
  .route('/notifications', notificationRoutes)
  .route('/qr', qrRoutes)
  .route('/promo', promoRoutes)
  .route('/debug', debugRoutes);

export const app = new Hono()
  .use(logger())
  .use('/api/*', cors({ origin: (o) => o, credentials: true }))
  .route('/api', api);

app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
  console.error(err);
  return c.json({ error: 'Something went wrong' }, 500);
});

export type ApiType = typeof api;

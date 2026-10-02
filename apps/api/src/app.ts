import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { HTTPException } from 'hono/http-exception';
import { viewerMiddleware, type AppEnv } from './lib/context.ts';
import { profileRoutes } from './modules/profiles/routes.ts';
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

/**
 * The HTTP surface. Each module owns its routes; this file only composes them.
 * Runtime-agnostic: hosts (src/hosts/*) pick the database and adapters, then serve `app.fetch`.
 * Nothing demo-related is composed here; the local Node host mounts that under /api/demo.
 */
const api = new Hono<AppEnv>()
  .use(viewerMiddleware)
  .get('/health', (c) => c.json({ ok: true }))
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
  .route('/promo', promoRoutes);

/** Comma-separated origins allowed to call the API (production); unset allows any origin. */
const allowedOrigin = (origin: string) => {
  const allowed = process.env.ALLOWED_ORIGINS?.split(',').map((o) => o.trim());
  return !allowed || allowed.includes(origin) ? origin : null;
};

export const app = new Hono()
  .use(logger())
  .use('/api/*', cors({ origin: allowedOrigin }))
  .route('/api', api);

app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
  console.error(err);
  return c.json({ error: 'Something went wrong' }, 500);
});

export type ApiType = typeof api;

import { Hono } from 'hono';
import { requireViewer, type AppEnv } from '../../lib/context.ts';
import { notifications } from './service.ts';

export const notificationRoutes = new Hono<AppEnv>()
  .get('/', async (c) => c.json(await notifications.list(requireViewer(c).id)))
  .post('/read', async (c) => {
    await notifications.markAllRead(requireViewer(c).id);
    return c.json({ ok: true });
  });

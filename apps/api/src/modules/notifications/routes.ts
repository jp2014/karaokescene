import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { clock } from '../../lib/clock.ts';
import { requireViewer, type AppEnv } from '../../lib/context.ts';
import { push } from '../../lib/push.ts';
import { notifications } from './service.ts';

const device = z.object({ token: z.string().min(10).max(4096), platform: z.enum(['web', 'ios', 'android']).default('web') });

export const notificationRoutes = new Hono<AppEnv>()
  .get('/', async (c) => c.json(await notifications.list(requireViewer(c).id)))
  .post('/read', async (c) => {
    await notifications.markAllRead(requireViewer(c).id);
    return c.json({ ok: true });
  })
  /** Register this device for push (an FCM registration token). */
  .put('/push-token', zValidator('json', device), async (c) => {
    const { token, platform } = c.req.valid('json');
    await push.register(requireViewer(c).id, token, platform, clock.now());
    return c.json({ ok: true, enabled: push.enabled() });
  })
  .delete('/push-token', zValidator('json', device.pick({ token: true })), async (c) => {
    await push.unregister(requireViewer(c).id, c.req.valid('json').token);
    return c.json({ ok: true });
  });

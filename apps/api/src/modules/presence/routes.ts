import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireViewer, type AppEnv } from '../../lib/context.ts';
import { DEFAULT_CENTER } from '../../lib/geo.ts';
import { presence } from './service.ts';

const latLng = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });

export const presenceRoutes = new Hono<AppEnv>()
  .get('/current', async (c) => c.json(await presence.currentCheckin(requireViewer(c).id)))
  .post('/check-in', zValidator('json', z.object({ venueId: z.string(), method: z.enum(['geo', 'qr', 'manual']).default('manual') })), async (c) => {
    const { venueId, method } = c.req.valid('json');
    return c.json(await presence.checkIn(requireViewer(c), venueId, method));
  })
  .post('/check-out', async (c) => c.json(await presence.checkOut(requireViewer(c), 'manual')))
  .post('/location', zValidator('json', latLng), async (c) => c.json(await presence.updateLocation(requireViewer(c), c.req.valid('json'))))
  .post('/kj/start', zValidator('json', z.object({ venueId: z.string() })), async (c) => c.json(await presence.startKj(requireViewer(c, 'kj'), c.req.valid('json').venueId)))
  .post('/kj/end', async (c) => c.json(await presence.endKj(requireViewer(c, 'kj'))))
  .get('/singers-near', zValidator('query', z.object({ lat: z.coerce.number().optional(), lng: z.coerce.number().optional(), radiusMi: z.coerce.number().default(20) })), async (c) => {
    const q = c.req.valid('query');
    const center = q.lat != null && q.lng != null ? { lat: q.lat, lng: q.lng } : DEFAULT_CENTER;
    return c.json(await presence.singersNear(requireViewer(c), center, q.radiusMi));
  });

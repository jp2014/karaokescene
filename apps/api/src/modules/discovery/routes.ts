import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { AppEnv } from '../../lib/context.ts';
import { discovery } from './service.ts';

const bool = z.enum(['true', 'false']).transform((v) => v === 'true').optional();

export const discoveryRoutes = new Hono<AppEnv>()
  .get(
    '/venues',
    zValidator(
      'query',
      z.object({
        lat: z.coerce.number().optional(),
        lng: z.coerce.number().optional(),
        radiusMi: z.coerce.number().min(1).max(100).optional(),
        fromMin: z.coerce.number().optional(),
        toMin: z.coerce.number().optional(),
        liveOnly: bool,
        kjNowOnly: bool,
        tonightOnly: bool,
      }),
    ),
    async (c) => {
      const { lat, lng, ...f } = c.req.valid('query');
      return c.json(await discovery.nearby(c.get('viewer'), { ...f, center: lat != null && lng != null ? { lat, lng } : undefined }));
    },
  )
  .get('/venues/:slug', async (c) => c.json(await discovery.venueDetail(c.get('viewer'), c.req.param('slug'))));

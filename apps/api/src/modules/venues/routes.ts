import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireViewer, type AppEnv } from '../../lib/context.ts';
import { venues } from './service.ts';

/** Venue management (events, specials, gallery, schedule) plus RSVPs. Reading venues lives in discovery. */
export const venueRoutes = new Hono<AppEnv>()
  .get('/events', async (c) => c.json(await venues.upcomingEvents(undefined, 30)))
  .post(
    '/:venueId/events',
    zValidator('json', z.object({ title: z.string().min(3).max(80), description: z.string().max(400).default(''), kind: z.enum(['karaoke', 'competition', 'theme', 'scene']), startsAt: z.number(), endsAt: z.number() })),
    async (c) => c.json(await venues.createEvent(requireViewer(c), c.req.param('venueId'), c.req.valid('json'))),
  )
  .delete('/events/:eventId', async (c) => {
    await venues.deleteEvent(requireViewer(c), c.req.param('eventId'));
    return c.json({ ok: true });
  })
  .post(
    '/:venueId/specials',
    zValidator('json', z.object({ title: z.string().min(2).max(60), price: z.string().max(20).default(''), details: z.string().max(200).default(''), days: z.array(z.number().int().min(0).max(6)).min(1) })),
    async (c) => c.json(await venues.createSpecial(requireViewer(c), c.req.param('venueId'), c.req.valid('json'))),
  )
  .delete('/specials/:specialId', async (c) => {
    await venues.deleteSpecial(requireViewer(c), c.req.param('specialId'));
    return c.json({ ok: true });
  })
  .put('/:venueId/rsvp', zValidator('json', z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), going: z.boolean() })), async (c) => {
    const { date, going } = c.req.valid('json');
    await venues.setRsvp(requireViewer(c).id, c.req.param('venueId'), date, going);
    return c.json({ ok: true });
  })
  .post('/:venueId/gallery', zValidator('json', z.object({ caption: z.string().max(120), kind: z.enum(['photo', 'video']), emoji: z.string().max(8) })), async (c) =>
    c.json(await venues.addGalleryItem(requireViewer(c), c.req.param('venueId'), c.req.valid('json'))),
  )
  .put('/gallery/:itemId/featured', zValidator('json', z.object({ on: z.boolean() })), async (c) => {
    await venues.setFeatured(requireViewer(c), c.req.param('itemId'), c.req.valid('json').on);
    return c.json({ ok: true });
  })
  .patch('/:venueId', zValidator('json', z.object({ tagline: z.string().max(80), description: z.string().max(600), isPremiere: z.boolean() }).partial()), async (c) => {
    await venues.update(requireViewer(c), c.req.param('venueId'), c.req.valid('json'));
    return c.json({ ok: true });
  })
  .put(
    '/:venueId/nights',
    zValidator('json', z.object({ nights: z.array(z.object({ dayOfWeek: z.number().int().min(0).max(6), startMin: z.number().int(), endMin: z.number().int(), kjId: z.string().nullable() })) })),
    async (c) => {
      await venues.setNights(requireViewer(c), c.req.param('venueId'), c.req.valid('json').nights);
      return c.json({ ok: true });
    },
  )
  .put('/:venueId/kjs/:kjId', zValidator('json', z.object({ on: z.boolean() })), async (c) => {
    const viewer = requireViewer(c, 'kj');
    await venues.linkKj(viewer.id, c.req.param('venueId'), c.req.valid('json').on);
    return c.json({ ok: true });
  });

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireViewer, type AppEnv } from '../../lib/context.ts';
import { fail } from '../../lib/http.ts';
import { VENUE_TYPES } from '../../db/schema.ts';
import { profiles } from '../profiles/service.ts';
import { promo } from '../promo/service.ts';
import { venues } from './service.ts';

const night = z.object({ dayOfWeek: z.number().int().min(0).max(6), startMin: z.number().int().min(0).max(1439), endMin: z.number().int().min(1).max(2880) });
const venueTypes = z.array(z.enum(VENUE_TYPES)).max(VENUE_TYPES.length);
const mediaUrl = z.string().max(500).regex(/^(\/api\/media\/|https?:\/\/)/, 'Use an uploaded file or a web link');

/** Venue management (events, specials, gallery, schedule) plus RSVPs. Reading venues lives in discovery. */
export const venueRoutes = new Hono<AppEnv>()
  .get('/events', async (c) => c.json(await venues.upcomingEvents(undefined, 30)))
  .get('/mine', async (c) => c.json(await venues.myVenuesForKj(requireViewer(c, 'kj'))))
  .post(
    '/',
    zValidator(
      'json',
      z.object({
        name: z.string().min(2).max(60),
        address: z.string().min(3).max(120),
        neighborhood: z.string().max(60).default(''),
        city: z.string().min(2).max(60),
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        venueTypes: venueTypes.default([]),
        nights: z.array(night).max(7).default([]),
      }),
    ),
    async (c) => c.json(await venues.createByKj(requireViewer(c, 'kj'), c.req.valid('json'))),
  )
  .post('/:venueId/claim', async (c) => {
    const v = await venues.claim(c.req.param('venueId'));
    // Demo shortcut: sign in as the venue's account. The real app verifies the owner first.
    return c.json(await profiles.demoSignIn(v.ownerId));
  })
  .put('/:venueId/my-nights', zValidator('json', z.object({ nights: z.array(night).max(14) })), async (c) => {
    await venues.setKjNights(requireViewer(c, 'kj'), c.req.param('venueId'), c.req.valid('json').nights);
    return c.json({ ok: true });
  })
  .put('/:venueId/auto-promote', zValidator('json', z.object({ on: z.boolean() })), async (c) => {
    const kj = requireViewer(c, 'kj');
    const venueId = c.req.param('venueId');
    const { on } = c.req.valid('json');
    await venues.setAutoPromote(kj, venueId, on);
    return c.json({ on, next: on ? await promo.autoPromoteNext(kj, venueId) : null });
  })
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
    zValidator('json', z.object({ title: z.string().min(2).max(60), price: z.string().max(20).default(''), details: z.string().max(200).default(''), days: z.array(z.number().int().min(0).max(6)).min(1), autoPost: z.boolean().default(false) })),
    async (c) => {
      const viewer = requireViewer(c);
      const input = c.req.valid('json');
      const special = await venues.createSpecial(viewer, c.req.param('venueId'), input);
      const posts = input.autoPost ? await promo.autoPostSpecial(viewer, special) : [];
      return c.json({ ...special, autoPosts: posts.length });
    },
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
  .post('/:venueId/gallery', zValidator('json', z.object({ caption: z.string().max(120), kind: z.enum(['photo', 'video']), emoji: z.string().max(8), imageUrl: mediaUrl.optional() })), async (c) =>
    c.json(await venues.addGalleryItem(requireViewer(c), c.req.param('venueId'), c.req.valid('json'))),
  )
  .put('/gallery/:itemId/featured', zValidator('json', z.object({ on: z.boolean() })), async (c) => {
    await venues.setFeatured(requireViewer(c), c.req.param('itemId'), c.req.valid('json').on);
    return c.json({ ok: true });
  })
  .patch(
    '/:venueId',
    zValidator(
      'json',
      z
        .object({
          name: z.string().min(2).max(60),
          tagline: z.string().max(80),
          description: z.string().max(600),
          isPremiere: z.boolean(),
          photoUrl: mediaUrl.nullable(),
          venueTypes,
          hours: z.array(z.object({ day: z.number().int().min(0).max(6), openMin: z.number().int().min(0).max(1439), closeMin: z.number().int().min(1).max(2880) })).max(7),
          happyHours: z.array(z.object({ days: z.array(z.number().int().min(0).max(6)).min(1), startMin: z.number().int().min(0).max(1439), endMin: z.number().int().min(1).max(2880), details: z.string().max(120) })).max(10),
          foodAvailable: z.boolean(),
          menuUrl: mediaUrl.nullable(),
        })
        .partial(),
    ),
    async (c) => {
      await venues.update(requireViewer(c), c.req.param('venueId'), c.req.valid('json'));
      return c.json({ ok: true });
    },
  )
  .put(
    '/:venueId/nights',
    zValidator('json', z.object({ nights: z.array(z.object({ dayOfWeek: z.number().int().min(0).max(6), startMin: z.number().int(), endMin: z.number().int(), kjId: z.string().nullable() })) })),
    async (c) => {
      await venues.setNights(requireViewer(c), c.req.param('venueId'), c.req.valid('json').nights);
      return c.json({ ok: true });
    },
  )
  /** Venues manage their associated KJs; a KJ can also add or remove themselves. */
  .put('/:venueId/kjs/:kjId', zValidator('json', z.object({ on: z.boolean() })), async (c) => {
    const viewer = requireViewer(c);
    const { venueId, kjId } = c.req.param();
    const { on } = c.req.valid('json');
    if (viewer.role === 'venue') await venues.setVenueKj(viewer, venueId, kjId, on);
    else if (viewer.role === 'kj' && viewer.id === kjId) await venues.linkKj(kjId, venueId, on);
    else fail(403, 'Only the venue or that KJ can change this');
    return c.json({ ok: true });
  });

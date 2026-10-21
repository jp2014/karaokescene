import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireViewer, type AppEnv } from '../../lib/context.ts';
import { fail } from '../../lib/http.ts';
import { requirePremium } from '../../lib/plans.ts';
import { isStoredMediaUrl } from '../../lib/storage.ts';
import { VENUE_TYPES } from '../../db/schema.ts';
import { promo } from '../promo/service.ts';
import { defer } from '../../lib/defer.ts';
import { venues } from './service.ts';

const place = {
  name: z.string().min(2).max(60),
  address: z.string().min(3).max(120),
  neighborhood: z.string().max(60).default(''),
  city: z.string().min(2).max(60),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
};
const night = z.object({ dayOfWeek: z.number().int().min(0).max(6), startMin: z.number().int().min(0).max(1439), endMin: z.number().int().min(1).max(2880) });
const venueTypes = z.array(z.enum(VENUE_TYPES)).max(VENUE_TYPES.length);
/** Photos must be files uploaded through /api/media; a menu can also be a link to the venue's own site. */
const storedMedia = z.string().max(500).refine(isStoredMediaUrl, 'Upload a photo');
const menuUrl = z.string().max(500).refine((u) => isStoredMediaUrl(u) || /^https:\/\//.test(u), 'Upload a PDF or use an https link');

/** Venue management (events, specials, gallery, schedule) plus RSVPs. Reading venues lives in discovery. */
export const venueRoutes = new Hono<AppEnv>()
  .get('/events', async (c) => c.json(await venues.upcomingEvents(undefined, 30)))
  .get('/mine', async (c) => {
    const kj = requireViewer(c, 'kj');
    defer('auto promote', () => promo.rollAutoPromote(kj));
    return c.json(await venues.myVenuesForKj(kj));
  })
  .post(
    '/',
    zValidator(
      'json',
      z.object({ ...place, venueTypes: venueTypes.default([]), nights: z.array(night).max(7).default([]) }),
    ),
    async (c) => c.json(await venues.createByKj(requireViewer(c, 'kj'), c.req.valid('json'))),
  )
  // Venue accounts: add your own venue, or find and claim the listing a KJ already made.
  .post('/own', zValidator('json', z.object({ ...place, venueTypes: venueTypes.default([]) })), async (c) => c.json(await venues.createByOwner(requireViewer(c, 'venue'), c.req.valid('json'))))
  .get('/unclaimed', zValidator('query', z.object({ q: z.string().max(60).default('') })), async (c) => c.json(await venues.unclaimed(c.req.valid('query').q)))
  .post('/:venueId/claim', async (c) => {
    await venues.claim(requireViewer(c, 'venue'), c.req.param('venueId'));
    return c.json({ ok: true });
  })
  .put('/:venueId/my-nights', zValidator('json', z.object({ nights: z.array(night).max(14) })), async (c) => {
    await venues.setKjNights(requireViewer(c, 'kj'), c.req.param('venueId'), c.req.valid('json').nights);
    return c.json({ ok: true });
  })
  .put('/:venueId/auto-promote', zValidator('json', z.object({ on: z.boolean() })), async (c) => {
    const kj = requireViewer(c, 'kj');
    const venueId = c.req.param('venueId');
    const { on } = c.req.valid('json');
    if (on) await requirePremium(kj, 'Auto Promote');
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
      if (input.autoPost) await requirePremium(viewer, 'Special reminders');
      const special = await venues.createSpecial(viewer, c.req.param('venueId'), input);
      const posts = input.autoPost ? await promo.remindSpecial(viewer, special) : [];
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
  .post('/:venueId/gallery', zValidator('json', z.object({ caption: z.string().max(120), mediaUrl: storedMedia })), async (c) =>
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
          photoUrl: storedMedia.nullable(),
          lat: place.lat,
          lng: place.lng,
          venueTypes,
          hours: z.array(z.object({ day: z.number().int().min(0).max(6), openMin: z.number().int().min(0).max(1439), closeMin: z.number().int().min(1).max(2880) })).max(7),
          happyHours: z.array(z.object({ days: z.array(z.number().int().min(0).max(6)).min(1), startMin: z.number().int().min(0).max(1439), endMin: z.number().int().min(1).max(2880), details: z.string().max(120) })).max(10),
          foodAvailable: z.boolean(),
          menuUrl: menuUrl.nullable(),
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

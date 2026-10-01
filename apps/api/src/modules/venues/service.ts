import { and, asc, desc, eq, gte, inArray } from 'drizzle-orm';
import { db, schema } from '../../db/client.ts';
import { cardsById } from '../../lib/cards.ts';
import { addDays, clock, localParts } from '../../lib/clock.ts';
import type { User } from '../../lib/context.ts';
import { fail, notFound } from '../../lib/http.ts';
import { newId } from '../../lib/ids.ts';

const V = schema.venues;
export type Venue = typeof V.$inferSelect;

async function owned(viewer: User, venueId: string) {
  const v = await db.query.venues.findFirst({ where: eq(V.id, venueId) });
  if (!v) return notFound('Venue');
  if (v!.ownerId !== viewer.id) fail(403, 'You do not manage this venue');
  return v!;
}

export const venues = {
  all: () => db.select().from(V),
  byId: (id: string) => db.query.venues.findFirst({ where: eq(V.id, id) }),
  bySlug: (slug: string) => db.query.venues.findFirst({ where: eq(V.slug, slug) }),
  ownedBy: (userId: string) => db.query.venues.findFirst({ where: eq(V.ownerId, userId) }),
  nights: () => db.select().from(schema.karaokeNights),
  nightsFor: (venueId: string) => db.select().from(schema.karaokeNights).where(eq(schema.karaokeNights.venueId, venueId)).orderBy(asc(schema.karaokeNights.dayOfWeek)),

  async kjsFor(venueId: string) {
    const links = await db.select().from(schema.kjVenueLinks).where(eq(schema.kjVenueLinks.venueId, venueId));
    return [...(await cardsById(links.map((l) => l.kjId))).values()];
  },

  async venuesForKj(kjId: string) {
    const links = await db.select().from(schema.kjVenueLinks).where(eq(schema.kjVenueLinks.kjId, kjId));
    if (!links.length) return [];
    return db.select().from(V).where(inArray(V.id, links.map((l) => l.venueId)));
  },

  async linkKj(kjId: string, venueId: string, linked: boolean) {
    if (linked) await db.insert(schema.kjVenueLinks).values({ kjId, venueId }).onConflictDoNothing();
    else await db.delete(schema.kjVenueLinks).where(and(eq(schema.kjVenueLinks.kjId, kjId), eq(schema.kjVenueLinks.venueId, venueId)));
  },

  // --- Events & specials -------------------------------------------------
  async upcomingEvents(venueId?: string, limit = 20) {
    const rows = await db
      .select({ event: schema.events, venueName: V.name, venueSlug: V.slug })
      .from(schema.events)
      .innerJoin(V, eq(V.id, schema.events.venueId))
      .where(and(gte(schema.events.endsAt, clock.now()), venueId ? eq(schema.events.venueId, venueId) : undefined))
      .orderBy(asc(schema.events.startsAt))
      .limit(limit);
    return rows.map((r) => ({ ...r.event, venueName: r.venueName, venueSlug: r.venueSlug }));
  },

  async createEvent(viewer: User, venueId: string, input: { title: string; description: string; kind: 'karaoke' | 'competition' | 'theme' | 'scene'; startsAt: number; endsAt: number }) {
    await owned(viewer, venueId);
    const row = { id: newId('evt'), venueId, ...input, createdAt: clock.now() };
    await db.insert(schema.events).values(row);
    return row;
  },

  async deleteEvent(viewer: User, eventId: string) {
    const e = (await db.query.events.findFirst({ where: eq(schema.events.id, eventId) })) ?? notFound('Event');
    await owned(viewer, e!.venueId);
    await db.delete(schema.events).where(eq(schema.events.id, eventId));
  },

  specialsFor: (venueId: string) => db.select().from(schema.specials).where(eq(schema.specials.venueId, venueId)).orderBy(desc(schema.specials.createdAt)),

  async createSpecial(viewer: User, venueId: string, input: { title: string; price: string; details: string; days: number[] }) {
    await owned(viewer, venueId);
    const row = { id: newId('spc'), venueId, ...input, createdAt: clock.now() };
    await db.insert(schema.specials).values(row);
    return row;
  },

  async deleteSpecial(viewer: User, specialId: string) {
    const s = (await db.query.specials.findFirst({ where: eq(schema.specials.id, specialId) })) ?? notFound('Special');
    await owned(viewer, s!.venueId);
    await db.delete(schema.specials).where(eq(schema.specials.id, specialId));
  },

  // --- Who's going ---------------------------------------------------------
  /** Next 7 days of RSVPs for a venue, with the viewer's own status per day. */
  async whosGoing(venueId: string, viewerId: string | undefined, hidden: Set<string>) {
    const today = localParts(clock.now()).date;
    const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
    const rows = await db.select().from(schema.rsvps).where(and(eq(schema.rsvps.venueId, venueId), inArray(schema.rsvps.date, days)));
    const users = await db.select().from(schema.users).where(inArray(schema.users.id, rows.map((r) => r.userId).concat('-')));
    const ghost = new Set(users.filter((u) => u.ghostMode && u.id !== viewerId).map((u) => u.id));
    const cards = await cardsById(rows.map((r) => r.userId));
    return days.map((date) => {
      const today = rows.filter((r) => r.date === date && !hidden.has(r.userId));
      return {
        date,
        count: today.length,
        going: today.filter((r) => !ghost.has(r.userId)).map((r) => cards.get(r.userId)!).slice(0, 12),
        me: !!viewerId && today.some((r) => r.userId === viewerId),
      };
    });
  },

  async setRsvp(userId: string, venueId: string, date: string, going: boolean) {
    if (going) await db.insert(schema.rsvps).values({ userId, venueId, date }).onConflictDoNothing();
    else await db.delete(schema.rsvps).where(and(eq(schema.rsvps.userId, userId), eq(schema.rsvps.venueId, venueId), eq(schema.rsvps.date, date)));
  },

  // --- Gallery -----------------------------------------------------------
  async gallery(venueId: string) {
    const rows = await db.select().from(schema.galleryItems).where(eq(schema.galleryItems.venueId, venueId)).orderBy(desc(schema.galleryItems.featured), desc(schema.galleryItems.createdAt)).limit(24);
    const cards = await cardsById(rows.map((r) => r.uploaderId));
    return rows.map((r) => ({ ...r, uploader: cards.get(r.uploaderId) ?? null }));
  },

  async addGalleryItem(viewer: User, venueId: string, input: { caption: string; kind: 'photo' | 'video'; emoji: string }) {
    const row = { id: newId('gal'), venueId, uploaderId: viewer.id, ...input, hue: Math.floor(Math.random() * 360), featured: false, createdAt: clock.now() };
    await db.insert(schema.galleryItems).values(row);
    return row;
  },

  /** Venues curate their gallery by featuring the best shots. */
  async setFeatured(viewer: User, itemId: string, featured: boolean) {
    const item = (await db.query.galleryItems.findFirst({ where: eq(schema.galleryItems.id, itemId) })) ?? notFound('Photo');
    await owned(viewer, item!.venueId);
    await db.update(schema.galleryItems).set({ featured }).where(eq(schema.galleryItems.id, itemId));
  },

  async update(viewer: User, venueId: string, patch: Partial<Pick<Venue, 'tagline' | 'description' | 'isPremiere'>>) {
    await owned(viewer, venueId);
    await db.update(V).set(patch).where(eq(V.id, venueId));
  },

  async setNights(viewer: User, venueId: string, nights: { dayOfWeek: number; startMin: number; endMin: number; kjId: string | null }[]) {
    await owned(viewer, venueId);
    await db.delete(schema.karaokeNights).where(eq(schema.karaokeNights.venueId, venueId));
    if (nights.length) await db.insert(schema.karaokeNights).values(nights.map((n) => ({ id: newId('nit'), venueId, ...n })));
  },
};

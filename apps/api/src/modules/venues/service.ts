import { and, asc, desc, eq, gte, inArray } from 'drizzle-orm';
import { db, schema } from '../../db/client.ts';
import { cardsById } from '../../lib/cards.ts';
import { addDays, clock, localParts } from '../../lib/clock.ts';
import type { VenueType } from '../../db/schema.ts';
import type { User } from '../../lib/context.ts';
import { fail, notFound } from '../../lib/http.ts';
import { newId } from '../../lib/ids.ts';
import { DEFAULT_PRIVACY } from '../profiles/privacy.ts';
import { liveNight, tonight } from './schedule.ts';

const V = schema.venues;
const L = schema.kjVenueLinks;
const N = schema.karaokeNights;
export type Venue = typeof V.$inferSelect;
export type NightInput = { dayOfWeek: number; startMin: number; endMin: number };
export type VenueProfilePatch = Partial<
  Pick<Venue, 'name' | 'tagline' | 'description' | 'isPremiere' | 'photoUrl' | 'venueTypes' | 'hours' | 'happyHours' | 'foodAvailable' | 'menuUrl'>
>;

const slugify = (name: string) =>
  name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'venue';

function minutesLabel(min: number) {
  const m = ((min % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h % 12 === 0 ? 12 : h % 12}${mm ? `:${String(mm).padStart(2, '0')}` : ''}${h >= 12 ? 'pm' : 'am'}`;
}

async function linkedKj(kj: User, venueId: string) {
  const link = await db.query.kjVenueLinks.findFirst({ where: and(eq(L.kjId, kj.id), eq(L.venueId, venueId)) });
  if (!link) fail(403, "You don't host at this venue");
  return link!;
}

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

  /** A KJ's "My Venues": each venue with their nights there, Auto Promote and claim status. */
  async myVenuesForKj(kj: User) {
    const links = await db.select().from(L).where(eq(L.kjId, kj.id));
    if (!links.length) return [];
    const vs = await db.select().from(V).where(inArray(V.id, links.map((l) => l.venueId)));
    const nights = await db.select().from(N).where(inArray(N.venueId, vs.map((v) => v.id))).orderBy(asc(N.dayOfWeek), asc(N.startMin));
    const kjCards = await cardsById(nights.map((n) => n.kjId).filter((x): x is string => !!x));
    return vs
      .map((v) => ({
        ...v,
        autoPromote: links.find((l) => l.venueId === v.id)!.autoPromote,
        listedByMe: v.createdById === kj.id,
        nights: nights.filter((n) => n.venueId === v.id).map((n) => ({ ...n, mine: n.kjId === kj.id, kj: n.kjId ? (kjCards.get(n.kjId) ?? null) : null })),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  /**
   * KJs can list a venue that isn't on Karaoke Scene yet. It gets a placeholder venue
   * account (unclaimed) that the owner can claim later; the KJ's nights go live right away.
   */
  async createByKj(kj: User, input: { name: string; address: string; neighborhood: string; city: string; lat: number; lng: number; venueTypes: VenueType[]; nights: NightInput[] }) {
    let slug = slugify(input.name);
    if (await venues.bySlug(slug)) slug = `${slug}-${Math.floor(Math.random() * 900 + 100)}`;
    const hue = Math.floor(Math.random() * 360);
    const ownerId = `usr_${slug}`;
    const now = clock.now();
    await db.insert(schema.users).values({
      id: ownerId, role: 'venue', handle: slug, displayName: input.name, avatarEmoji: '🍸', avatarHue: hue, bio: '', privacy: DEFAULT_PRIVACY, lat: input.lat, lng: input.lng, createdAt: now,
    });
    const venue = {
      id: `ven_${slug}`, ownerId, claimed: false, createdById: kj.id, slug, name: input.name, tagline: `Karaoke with ${kj.displayName}`,
      description: `${input.name} was added to Karaoke Scene by ${kj.displayName}, who hosts karaoke here.`, address: input.address, neighborhood: input.neighborhood || input.city,
      city: input.city, lat: input.lat, lng: input.lng, hue, isPremiere: false, capacity: 80, vibes: [], venueTypes: input.venueTypes,
    };
    await db.insert(V).values(venue);
    await db.insert(L).values({ kjId: kj.id, venueId: venue.id });
    if (input.nights.length) await db.insert(N).values(input.nights.map((n) => ({ id: newId('nit'), venueId: venue.id, kjId: kj.id, ...n })));
    return venue;
  },

  /** Owner claims a KJ-listed venue. (The real app verifies the owner first; see the claim sheet.) */
  async claim(venueId: string) {
    const v = (await venues.byId(venueId)) ?? notFound('Venue');
    if (v!.claimed) fail(409, 'This venue has already been claimed');
    await db.update(V).set({ claimed: true }).where(eq(V.id, venueId));
    return v!;
  },

  /** KJs manage their own nights at a venue (the owner's other KJs are untouched). */
  async setKjNights(kj: User, venueId: string, nights: NightInput[]) {
    await linkedKj(kj, venueId);
    await db.delete(N).where(and(eq(N.venueId, venueId), eq(N.kjId, kj.id)));
    if (nights.length) await db.insert(N).values(nights.map((n) => ({ id: newId('nit'), venueId, kjId: kj.id, ...n })));
  },

  async setAutoPromote(kj: User, venueId: string, on: boolean) {
    await linkedKj(kj, venueId);
    await db.update(L).set({ autoPromote: on }).where(and(eq(L.kjId, kj.id), eq(L.venueId, venueId)));
  },

  /** Venue owners choose which KJs are associated with them. */
  async setVenueKj(viewer: User, venueId: string, kjId: string, on: boolean) {
    await owned(viewer, venueId);
    const kj = await db.query.users.findFirst({ where: eq(schema.users.id, kjId) });
    if (kj?.role !== 'kj') fail(400, 'That account is not a KJ');
    await venues.linkKj(kjId, venueId, on);
  },

  /** Tonight's show for a KJ (where they're live, else scheduled) or a venue, for promos. */
  async showTonight(user: User) {
    const now = clock.now();
    const all = user.role === 'kj' ? await db.select().from(N).where(eq(N.kjId, user.id)) : await db.select().from(N).innerJoin(V, eq(V.id, N.venueId)).where(eq(V.ownerId, user.id)).then((r) => r.map((x) => x.karaoke_nights));
    const night = liveNight(all, now) ?? tonight(all, now);
    if (!night) return null;
    const v = (await venues.byId(night.venueId))!;
    return { venueId: v.id, venueName: v.name, venueSlug: v.slug, when: `${minutesLabel(night.startMin)}–${minutesLabel(night.endMin)}` };
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

  async createSpecial(viewer: User, venueId: string, input: { title: string; price: string; details: string; days: number[]; autoPost: boolean }) {
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

  /** A photo from the night, already uploaded through /api/media. */
  async addGalleryItem(viewer: User, venueId: string, input: { caption: string; mediaUrl: string }) {
    const venue = (await venues.byId(venueId)) ?? notFound('Venue');
    const row = {
      id: newId('gal'), venueId: venue!.id, uploaderId: viewer.id, kind: 'photo' as const, caption: input.caption || 'Great night!', mediaUrl: input.mediaUrl,
      hue: Math.floor(Math.random() * 360), emoji: '📸', featured: false, createdAt: clock.now(),
    };
    await db.insert(schema.galleryItems).values(row);
    return row;
  },

  /** Venues curate their gallery by featuring the best shots. */
  async setFeatured(viewer: User, itemId: string, featured: boolean) {
    const item = (await db.query.galleryItems.findFirst({ where: eq(schema.galleryItems.id, itemId) })) ?? notFound('Photo');
    await owned(viewer, item!.venueId);
    await db.update(schema.galleryItems).set({ featured }).where(eq(schema.galleryItems.id, itemId));
  },

  /** Venue profile & settings. The venue photo doubles as the venue account's avatar. */
  async update(viewer: User, venueId: string, patch: VenueProfilePatch) {
    const v = await owned(viewer, venueId);
    if (Object.keys(patch).length) await db.update(V).set(patch).where(eq(V.id, venueId));
    const account: Partial<User> = {};
    if (patch.photoUrl !== undefined) account.avatarUrl = patch.photoUrl;
    if (patch.name) account.displayName = patch.name;
    if (Object.keys(account).length) await db.update(schema.users).set(account).where(eq(schema.users.id, v.ownerId));
  },

  async setNights(viewer: User, venueId: string, nights: (NightInput & { kjId: string | null })[]) {
    await owned(viewer, venueId);
    await db.delete(schema.karaokeNights).where(eq(schema.karaokeNights.venueId, venueId));
    if (nights.length) await db.insert(schema.karaokeNights).values(nights.map((n) => ({ id: newId('nit'), venueId, ...n })));
  },
};

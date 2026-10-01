import { inArray } from 'drizzle-orm';
import { db, schema } from '../../db/client.ts';
import { cardsById } from '../../lib/cards.ts';
import { clock, localParts } from '../../lib/clock.ts';
import type { User } from '../../lib/context.ts';
import { DEFAULT_CENTER, DISCOVERY_RADIUS_MI, distanceMi, type LatLng } from '../../lib/geo.ts';
import { notFound } from '../../lib/http.ts';
import { busyLevel, presence } from '../presence/service.ts';
import { reputation } from '../reputation/service.ts';
import { social } from '../social/service.ts';
import { liveNight, nextNight, tonight } from '../venues/schedule.ts';
import { venues } from '../venues/service.ts';

export type DiscoverFilters = {
  center?: LatLng;
  radiusMi?: number;
  /** Only venues whose karaoke night overlaps this local-time window (minutes from midnight). */
  fromMin?: number;
  toMin?: number;
  liveOnly?: boolean;
  kjNowOnly?: boolean;
  tonightOnly?: boolean;
};

/** Discovery composes venues + schedule + live presence into what the map and lists show. */
export const discovery = {
  async nearby(viewer: User | null, f: DiscoverFilters = {}) {
    const center = f.center ?? DEFAULT_CENTER;
    const radius = f.radiusMi ?? DISCOVERY_RADIUS_MI;
    const now = clock.now();
    const today = localParts(now);
    const [all, nights, kjNow, counts, favVenues, specials] = await Promise.all([
      venues.all(),
      venues.nights(),
      presence.kjNowByVenue(),
      presence.liveCounts(viewer?.id),
      viewer ? social.favoriteVenueIds(viewer.id) : Promise.resolve([] as string[]),
      db.select().from(schema.specials),
    ]);
    const kjCards = await cardsById(nights.map((n) => n.kjId).filter((x): x is string => !!x));
    const friendCards = await cardsById([...counts.values()].flatMap((c) => c.friendIds));

    const items = all.map((v) => {
      const vNights = nights.filter((n) => n.venueId === v.id);
      const liveN = liveNight(vNights, now);
      const tonightN = liveN ?? tonight(vNights, now);
      const next = nextNight(vNights, now);
      const live = counts.get(v.id);
      const count = live?.count ?? 0;
      const kjOnSite = kjNow.get(v.id);
      return {
        id: v.id,
        slug: v.slug,
        name: v.name,
        tagline: v.tagline,
        neighborhood: v.neighborhood,
        city: v.city,
        lat: v.lat,
        lng: v.lng,
        hue: v.hue,
        vibes: v.vibes,
        isPremiere: v.isPremiere,
        distanceMi: Math.round(distanceMi(center, v) * 10) / 10,
        isLive: !!liveN,
        tonight: tonightN ? { startMin: tonightN.startMin, endMin: tonightN.endMin, kj: tonightN.kjId ? (kjCards.get(tonightN.kjId) ?? null) : null } : null,
        nextNight: next ? { startsAt: next.startsAt, dayOfWeek: next.night.dayOfWeek, kj: next.night.kjId ? (kjCards.get(next.night.kjId) ?? null) : null } : null,
        kjNow: kjOnSite ? { kj: kjOnSite.kj, since: kjOnSite.session.startedAt } : null,
        crowd: { count, level: busyLevel(count, v.capacity) },
        friendsHere: (live?.friendIds ?? []).map((id) => friendCards.get(id)!).filter(Boolean),
        isFavorite: favVenues.includes(v.id),
        specialsToday: specials.filter((s) => s.venueId === v.id && s.days.includes(today.dayOfWeek)).map((s) => ({ title: s.title, price: s.price })),
        nightsPerWeek: vNights.length,
      };
    });

    const filtered = items.filter((v) => {
      if (v.distanceMi > radius) return false;
      if (f.liveOnly && !v.isLive) return false;
      if (f.kjNowOnly && !v.kjNow) return false;
      if (f.tonightOnly && !v.tonight) return false;
      if (f.fromMin != null && f.toMin != null) {
        if (!v.tonight) return false;
        if (v.tonight.endMin <= f.fromMin || v.tonight.startMin >= f.toMin) return false;
      }
      return true;
    });
    // Priority listing: within the same live status, Premiere Partners float up.
    const score = (v: (typeof items)[number]) => (v.kjNow ? 4 : 0) + (v.isLive ? 2 : 0) + (v.isPremiere ? 1.5 : 0) + (v.tonight ? 1 : 0) - v.distanceMi / 25;
    filtered.sort((a, b) => score(b) - score(a));
    return {
      now,
      center,
      radiusMi: radius,
      venues: filtered,
      outsideRadius: items.filter((v) => v.distanceMi > radius).length,
    };
  },

  async venueDetail(viewer: User | null, slug: string) {
    const v = (await venues.bySlug(slug)) ?? notFound('Venue');
    const venue = v!;
    const now = clock.now();
    const hidden = await social.hiddenIds(viewer?.id);
    const [nights, kjSession, here, events, specials, gallery, whosGoing, peak, kjs, favIds, owner] = await Promise.all([
      venues.nightsFor(venue.id),
      presence.activeKjSession(venue.id),
      presence.here(venue.id, viewer),
      venues.upcomingEvents(venue.id, 6),
      venues.specialsFor(venue.id),
      venues.gallery(venue.id),
      venues.whosGoing(venue.id, viewer?.id, hidden),
      presence.peakHours(venue.id),
      venues.kjsFor(venue.id),
      viewer ? social.favoriteVenueIds(viewer.id) : Promise.resolve([] as string[]),
      db.select().from(schema.users).where(inArray(schema.users.id, [venue.ownerId])),
    ]);
    const kjCards = await cardsById([...nights.map((n) => n.kjId).filter((x): x is string => !!x), ...(kjSession ? [kjSession.kjId] : [])]);
    const liveN = liveNight(nights, now);
    const myCheckin = viewer ? await presence.currentCheckin(viewer.id) : null;
    const friendIds = new Set(viewer ? await social.friendIds(viewer.id) : []);
    const kjBadges = await Promise.all(kjs.map(async (k) => ({ ...k, badges: (await reputation.summary(k.id)).slice(0, 4) })));
    return {
      now,
      venue: { ...venue, ownerHandle: owner[0]?.handle ?? null },
      isLive: !!liveN,
      schedule: nights.map((n) => ({ ...n, kj: n.kjId ? (kjCards.get(n.kjId) ?? null) : null, isLive: n.id === liveN?.id })),
      kjNow: kjSession ? { kj: kjCards.get(kjSession.kjId)!, since: kjSession.startedAt } : null,
      crowd: { count: here.length, level: busyLevel(here.length, venue.capacity), friends: here.filter((h) => friendIds.has(h.id)) },
      here,
      events,
      specials,
      gallery,
      whosGoing,
      peakHours: peak,
      kjs: kjBadges,
      isFavorite: favIds.includes(venue.id),
      myCheckin: myCheckin?.venueId === venue.id ? myCheckin : null,
      canManage: viewer?.id === venue.ownerId,
    };
  },
};

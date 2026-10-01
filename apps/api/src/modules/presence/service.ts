import { and, eq, gte, inArray, isNull, ne } from 'drizzle-orm';
import { db, schema } from '../../db/client.ts';
import { cardsById, toCard, type UserCard } from '../../lib/cards.ts';
import { clock, localParts } from '../../lib/clock.ts';
import type { User } from '../../lib/context.ts';
import { ARRIVE_RADIUS_MI, distanceMi, LEAVE_RADIUS_MI, type LatLng } from '../../lib/geo.ts';
import { fail, notFound } from '../../lib/http.ts';
import { newId } from '../../lib/ids.ts';
import { notifications } from '../notifications/service.ts';
import { social } from '../social/service.ts';
import { venues } from '../venues/service.ts';

const C = schema.checkins;
const K = schema.kjSessions;
/** Check-ins older than this are considered stale (people forget to check out). */
const CHECKIN_TTL_MS = 8 * 3600_000;

const activeCheckinWhere = () => and(isNull(C.checkedOutAt), gte(C.checkedInAt, clock.now() - CHECKIN_TTL_MS));
const activeKjWhere = () => and(isNull(K.endedAt), gte(K.startedAt, clock.now() - 12 * 3600_000));

export type BusyLevel = 'quiet' | 'warming-up' | 'busy' | 'packed';
export function busyLevel(count: number, capacity: number): BusyLevel {
  const r = count / Math.max(capacity * 0.18, 1);
  return r >= 1 ? 'packed' : r >= 0.55 ? 'busy' : r >= 0.2 ? 'warming-up' : 'quiet';
}

export const presence = {
  async currentCheckin(userId: string) {
    const row = await db.query.checkins.findFirst({ where: and(eq(C.userId, userId), activeCheckinWhere()) });
    return row ?? null;
  },

  async activeKjSession(venueId: string) {
    return (await db.query.kjSessions.findFirst({ where: and(eq(K.venueId, venueId), activeKjWhere()) })) ?? null;
  },

  async kjSessionFor(kjId: string) {
    return (await db.query.kjSessions.findFirst({ where: and(eq(K.kjId, kjId), activeKjWhere()) })) ?? null;
  },

  /** venueId -> {session, kj} for every venue with a KJ on-site right now ("KJ Now"). */
  async kjNowByVenue() {
    const rows = await db.select().from(K).where(activeKjWhere());
    const cards = await cardsById(rows.map((r) => r.kjId));
    return new Map(rows.map((r) => [r.venueId, { session: r, kj: cards.get(r.kjId)! }]));
  },

  /** venueId -> number of people checked in, plus which of them are the viewer's friends. */
  async liveCounts(viewerId?: string) {
    const rows = await db.select({ venueId: C.venueId, userId: C.userId }).from(C).where(activeCheckinWhere());
    const friends = new Set(viewerId ? await social.friendIds(viewerId) : []);
    const ghosts = new Set(
      rows.length
        ? (await db.select({ id: schema.users.id }).from(schema.users).where(and(inArray(schema.users.id, rows.map((r) => r.userId)), eq(schema.users.ghostMode, true)))).map((r) => r.id)
        : [],
    );
    const map = new Map<string, { count: number; friendIds: string[] }>();
    for (const r of rows) {
      const m = map.get(r.venueId) ?? { count: 0, friendIds: [] };
      m.count++;
      if (friends.has(r.userId) && !ghosts.has(r.userId)) m.friendIds.push(r.userId);
      map.set(r.venueId, m);
    }
    return map;
  },

  async checkIn(user: User, venueId: string, method: 'geo' | 'qr' | 'manual') {
    const venue = (await venues.byId(venueId)) ?? notFound('Venue');
    const current = await presence.currentCheckin(user.id);
    if (current?.venueId === venueId) return current;
    if (current) await presence.checkOut(user, 'manual');
    const row = { id: newId('chk'), userId: user.id, venueId, method, checkedInAt: clock.now(), checkedOutAt: null, checkoutReason: null };
    await db.insert(C).values(row);
    const kj = await presence.activeKjSession(venueId);
    if (kj && user.role === 'singer') {
      await notifications.send(kj.kjId, {
        kind: 'check-in',
        title: user.ghostMode ? `👻 A ghost singer checked in` : `${user.displayName} checked in`,
        body: `at ${venue!.name}${method === 'qr' ? ' via QR' : method === 'geo' ? ' automatically' : ''}`,
        link: '/kj',
      });
    }
    return row;
  },

  /**
   * Ends the user's check-in. Auto Leave (geofence exit) notifies the KJ so they can
   * pull that singer from the rotation, and drops their queued songs.
   */
  async checkOut(user: User, reason: 'manual' | 'auto-leave') {
    const current = await presence.currentCheckin(user.id);
    if (!current) return null;
    await db.update(C).set({ checkedOutAt: clock.now(), checkoutReason: reason }).where(eq(C.id, current.id));
    const kj = await presence.activeKjSession(current.venueId);
    if (kj) {
      const dropped = await db
        .update(schema.songRequests)
        .set({ status: 'skipped' })
        .where(and(eq(schema.songRequests.kjSessionId, kj.id), eq(schema.songRequests.singerId, user.id), eq(schema.songRequests.status, 'queued')))
        .returning();
      if (reason === 'auto-leave') {
        await notifications.send(kj.kjId, {
          kind: 'auto-leave',
          title: `🚪 ${user.ghostMode ? 'A ghost singer' : user.displayName} left the venue`,
          body: dropped.length ? `Auto Leave pulled ${dropped.length} song${dropped.length > 1 ? 's' : ''} from your queue` : 'Auto Leave: they walked out of range',
          link: '/kj',
        });
      }
    }
    return { ...current, checkoutReason: reason };
  },

  /**
   * The geolocation heartbeat. Saves the location, auto-checks-out when the user
   * walks out of range, and suggests a check-in when they arrive somewhere with karaoke.
   */
  async updateLocation(user: User, loc: LatLng) {
    await db.update(schema.users).set({ lat: loc.lat, lng: loc.lng }).where(eq(schema.users.id, user.id));
    const current = await presence.currentCheckin(user.id);
    let autoLeft: { venueId: string; name: string } | null = null;
    if (current) {
      const v = (await venues.byId(current.venueId))!;
      if (distanceMi(loc, v) > LEAVE_RADIUS_MI) {
        await presence.checkOut(user, 'auto-leave');
        autoLeft = { venueId: v.id, name: v.name };
      } else {
        return { autoLeft, arrivedAt: null, checkedInAt: { venueId: v.id, name: v.name, slug: v.slug } };
      }
    }
    const all = await venues.all();
    const here = all.map((v) => ({ v, d: distanceMi(loc, v) })).filter((x) => x.d <= ARRIVE_RADIUS_MI).sort((a, b) => a.d - b.d)[0];
    return { autoLeft, arrivedAt: here ? { venueId: here.v.id, name: here.v.name, slug: here.v.slug } : null, checkedInAt: null };
  },

  /** Who's at a venue right now. Ghosts are hidden from everyone except the KJ running the show. */
  async here(venueId: string, viewer: User | null) {
    const rows = await db.select().from(C).where(and(eq(C.venueId, venueId), activeCheckinWhere()));
    const users = rows.length ? await db.select().from(schema.users).where(inArray(schema.users.id, rows.map((r) => r.userId))) : [];
    const kj = await presence.activeKjSession(venueId);
    const isHostKj = !!viewer && kj?.kjId === viewer.id;
    const hidden = await social.hiddenIds(viewer?.id);
    const byId = new Map(users.map((u) => [u.id, u]));
    return rows
      .filter((r) => !hidden.has(r.userId))
      .filter((r) => isHostKj || r.userId === viewer?.id || !byId.get(r.userId)?.ghostMode)
      .map((r) => ({ ...toCard(byId.get(r.userId)!), ghost: byId.get(r.userId)!.ghostMode, checkedInAt: r.checkedInAt, method: r.method }))
      .sort((a, b) => a.checkedInAt - b.checkedInAt);
  },

  async startKj(kj: User, venueId: string) {
    const venue = (await venues.byId(venueId)) ?? notFound('Venue');
    const existing = await presence.kjSessionFor(kj.id);
    if (existing?.venueId === venueId) return existing;
    if (existing) await presence.endKj(kj);
    const other = await presence.activeKjSession(venueId);
    if (other) fail(409, 'Another KJ is already running this venue');
    const row = { id: newId('kjs'), kjId: kj.id, venueId, startedAt: clock.now(), endedAt: null };
    await db.insert(K).values(row);
    // Let fans know: everyone who favorited this KJ or this venue.
    const fans = await db
      .select({ userId: schema.favorites.userId })
      .from(schema.favorites)
      .where(
        and(
          inArray(schema.favorites.targetId, [kj.id, venueId]),
          ne(schema.favorites.userId, kj.id),
        ),
      );
    for (const userId of new Set(fans.map((f) => f.userId))) {
      await notifications.send(userId, { kind: 'kj-now', title: `🎤 ${kj.displayName} is live now`, body: `at ${venue!.name}`, link: `/venues/${venue!.slug}` });
    }
    return row;
  },

  async endKj(kj: User) {
    const s = await presence.kjSessionFor(kj.id);
    if (s) await db.update(K).set({ endedAt: clock.now() }).where(eq(K.id, s.id));
    return null;
  },

  /** Average head-count by hour of night over the last 4 weeks (Peak Hours insight). */
  async peakHours(venueId: string) {
    const since = clock.now() - 28 * 86_400_000;
    const rows = await db.select().from(C).where(and(eq(C.venueId, venueId), gte(C.checkedInAt, since)));
    const buckets = new Map<number, number>();
    const nights = new Set<string>();
    for (const r of rows) {
      const end = r.checkedOutAt ?? Math.min(clock.now(), r.checkedInAt + 2 * 3600_000);
      nights.add(localParts(r.checkedInAt - 6 * 3600_000).date);
      for (let t = r.checkedInAt; t < end; t += 3600_000) {
        const h = localParts(t).hour;
        const slot = h < 6 ? h + 24 : h; // 1am -> 25 so the night reads left to right
        buckets.set(slot, (buckets.get(slot) ?? 0) + 1);
      }
    }
    const n = Math.max(nights.size, 1);
    return Array.from({ length: 10 }, (_, i) => 18 + i).map((slot) => ({
      hour: slot % 24,
      avg: Math.round(((buckets.get(slot) ?? 0) / n) * 10) / 10,
    }));
  },

  /** Singers Near You: helps KJs and venues know who to invite. Respects ghost mode and blocks. */
  async singersNear(viewer: User, center: LatLng, radiusMi: number) {
    const hidden = await social.hiddenIds(viewer.id);
    const rows = await db.select().from(schema.users).where(and(eq(schema.users.role, 'singer'), eq(schema.users.ghostMode, false)));
    const active = await db.select().from(C).where(activeCheckinWhere());
    const at = new Map(active.map((c) => [c.userId, c.venueId]));
    const out: (UserCard & { distanceMi: number; checkedInVenueId: string | null })[] = [];
    for (const u of rows) {
      if (u.lat == null || u.lng == null || hidden.has(u.id) || u.id === viewer.id) continue;
      const d = distanceMi(center, { lat: u.lat, lng: u.lng });
      if (d <= radiusMi) out.push({ ...toCard(u), distanceMi: Math.round(d * 10) / 10, checkedInVenueId: at.get(u.id) ?? null });
    }
    return out.sort((a, b) => a.distanceMi - b.distanceMi);
  },
};

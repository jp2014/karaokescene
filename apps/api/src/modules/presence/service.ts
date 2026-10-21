import { and, eq, gte, inArray, isNull, ne } from 'drizzle-orm';
import { db, schema, type DB } from '../../db/client.ts';
import { cardsById, toCard, type UserCard } from '../../lib/cards.ts';
import { clock, localParts } from '../../lib/clock.ts';
import type { User } from '../../lib/context.ts';
import { ARRIVE_RADIUS_MI, distanceMi, LEAVE_RADIUS_MI, nearbyArea, type LatLng } from '../../lib/geo.ts';
import { fail, notFound } from '../../lib/http.ts';
import { withUserLock } from '../../lib/locks.ts';
import { hasPremium } from '../../lib/plans.ts';
import { newId } from '../../lib/ids.ts';
import { realtime } from '../../lib/realtime.ts';
import { notifications } from '../notifications/service.ts';
import { social } from '../social/service.ts';
import { venues } from '../venues/service.ts';

const C = schema.checkins;
const K = schema.kjSessions;
/** Check-ins older than this are considered stale (people forget to check out). */
const CHECKIN_TTL_MS = 8 * 3600_000;

const activeCheckinWhere = () => and(isNull(C.checkedOutAt), gte(C.checkedInAt, clock.now() - CHECKIN_TTL_MS));
const activeKjWhere = () => and(isNull(K.endedAt), gte(K.startedAt, clock.now() - 12 * 3600_000));
/** Check-ins (on separate nights) that make you a Regular at a venue. */
export const REGULAR_AFTER = 5;
/** Karaoke nights run past midnight: shift 6h so a 1am check-in counts toward the night before. */
const nightOf = (ms: number) => localParts(ms - 6 * 3600_000).date;

export type BusyLevel = 'quiet' | 'warming-up' | 'busy' | 'packed';
export function busyLevel(count: number, capacity: number): BusyLevel {
  const r = count / Math.max(capacity * 0.18, 1);
  return r >= 1 ? 'packed' : r >= 0.55 ? 'busy' : r >= 0.2 ? 'warming-up' : 'quiet';
}

type Checkin = typeof C.$inferSelect;
type Closed = { current: Checkin; kj: typeof K.$inferSelect | null; dropped: unknown[] };

/** Inside the user's lock: end the check-in and withdraw their pending song submissions. */
async function closeCheckin(tx: DB, userId: string, current: Checkin, reason: 'manual' | 'auto-leave'): Promise<Closed> {
  await tx.update(C).set({ checkedOutAt: clock.now(), checkoutReason: reason }).where(eq(C.id, current.id));
  const kj = await presence.activeKjSession(current.venueId, tx);
  const dropped = kj
    ? await tx
        .update(schema.songRequests)
        .set({ status: 'withdrawn', decidedAt: clock.now() })
        .where(and(eq(schema.songRequests.kjSessionId, kj.id), eq(schema.songRequests.singerId, userId), eq(schema.songRequests.status, 'submitted')))
        .returning()
    : [];
  return { current, kj, dropped };
}

/** After the lock is released: realtime signals, and the Auto Leave alert (a KJ Pro feature). */
async function afterCheckout(user: User, { current, kj, dropped }: Closed, reason: 'manual' | 'auto-leave') {
  realtime.presenceChanged(current.venueId);
  if (!kj || reason !== 'auto-leave') return;
  const kjUser = await db.query.users.findFirst({ where: eq(schema.users.id, kj.kjId) });
  if (kjUser && (await hasPremium(kjUser))) {
    await notifications.send(kj.kjId, {
      kind: 'auto-leave',
      title: `🚪 ${user.ghostMode ? 'A ghost singer' : user.displayName} left the venue`,
      body: dropped.length ? `Auto Leave withdrew ${dropped.length} pending song${dropped.length > 1 ? 's' : ''}` : 'Auto Leave: they walked out of range',
      link: '/kj',
    });
  }
}

export const presence = {
  async currentCheckin(userId: string, q: DB = db) {
    const row = await q.query.checkins.findFirst({ where: and(eq(C.userId, userId), activeCheckinWhere()) });
    return row ?? null;
  },

  async activeKjSession(venueId: string, q: DB = db) {
    return (await q.query.kjSessions.findFirst({ where: and(eq(K.venueId, venueId), activeKjWhere()) })) ?? null;
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
    // Under the user's lock (shared with checkout and song submission) so two check-ins at once
    // can't leave two open rows.
    const result = await withUserLock(user.id, async (tx) => {
      const current = await presence.currentCheckin(user.id, tx);
      if (current?.venueId === venueId) return { row: current, left: null };
      const left = current ? await closeCheckin(tx, user.id, current, 'manual') : null;
      const row = { id: newId('chk'), userId: user.id, venueId, method, checkedInAt: clock.now(), checkedOutAt: null, checkoutReason: null };
      await tx.insert(C).values(row);
      return { row, left, created: true };
    });
    if (result.left) await afterCheckout(user, result.left, 'manual');
    if (!('created' in result)) return result.row;
    const { row } = result;
    realtime.presenceChanged(venueId);
    if (user.role === 'singer') {
      const visits = await presence.visitCount(user.id, venueId);
      if (visits === REGULAR_AFTER) {
        await notifications.send(user.id, { kind: 'regular', title: `⭐ You're a Regular at ${venue!.name}!`, body: `${REGULAR_AFTER} nights checked in. The KJ and venue can see it on your profile.`, link: '/scan' });
      }
    }
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
   * Ends the user's check-in and withdraws their pending song submissions. Auto Leave
   * (geofence exit) also alerts the KJ, a KJ Pro feature.
   */
  async checkOut(user: User, reason: 'manual' | 'auto-leave', onlyCheckinId?: string) {
    // Same lock as song submission and check-in, so nothing lands after the singer has left.
    // `onlyCheckinId`: the caller decided based on that check-in; leave a newer one alone.
    const done = await withUserLock(user.id, async (tx) => {
      const current = await presence.currentCheckin(user.id, tx);
      if (!current || (onlyCheckinId && current.id !== onlyCheckinId)) return null;
      return closeCheckin(tx, user.id, current, reason);
    });
    if (!done) return null;
    await afterCheckout(user, done, reason);
    return { ...done.current, checkoutReason: reason };
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
        // Only this check-in: if the singer checked in somewhere else meanwhile, that one stands.
        if (await presence.checkOut(user, 'auto-leave', current.id)) autoLeft = { venueId: v.id, name: v.name };
        else {
          const now = await presence.currentCheckin(user.id);
          const nv = now && (await venues.byId(now.venueId));
          if (nv) return { autoLeft, arrivedAt: null, checkedInAt: { venueId: nv.id, name: nv.name, slug: nv.slug } };
        }
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
    realtime.presenceChanged(venueId);
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
    await notifications.sendMany([...new Set(fans.map((f) => f.userId))].map((userId) => ({ userId, kind: 'kj-now', title: `🎤 ${kj.displayName} is live now`, body: `at ${venue!.name}`, link: `/venues/${venue!.slug}` })));
    return row;
  },

  async endKj(kj: User) {
    const s = await presence.kjSessionFor(kj.id);
    if (s) {
      await db.update(K).set({ endedAt: clock.now() }).where(eq(K.id, s.id));
      realtime.presenceChanged(s.venueId);
    }
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

  /** Nights (not check-ins) a user has spent at a venue. */
  async visitCount(userId: string, venueId: string) {
    const rows = await db.select({ at: C.checkedInAt }).from(C).where(and(eq(C.userId, userId), eq(C.venueId, venueId)));
    return new Set(rows.map((r) => nightOf(r.at))).size;
  },

  /** Venues a singer has been to, with progress toward Regular status, most visited first. */
  async regulars(userId: string) {
    const rows = await db.select({ venueId: C.venueId, at: C.checkedInAt }).from(C).where(eq(C.userId, userId));
    const nights = new Map<string, Set<string>>();
    for (const r of rows) nights.set(r.venueId, (nights.get(r.venueId) ?? new Set()).add(nightOf(r.at)));
    const vs = nights.size ? await db.select().from(schema.venues).where(inArray(schema.venues.id, [...nights.keys()])) : [];
    return vs
      .map((v) => ({ venue: { id: v.id, slug: v.slug, name: v.name, hue: v.hue, photoUrl: v.photoUrl }, visits: nights.get(v.id)!.size, isRegular: nights.get(v.id)!.size >= REGULAR_AFTER }))
      .sort((a, b) => b.visits - a.visits);
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
      const d = Math.ceil(distanceMi(center, nearbyArea({ lat: u.lat, lng: u.lng })));
      if (d <= Math.min(radiusMi, 25)) out.push({ ...toCard(u), distanceMi: d, checkedInVenueId: at.get(u.id) ?? null });
    }
    return out.sort((a, b) => a.distanceMi - b.distanceMi);
  },

  /**
   * "Promote tonight": a KJ or venue pings singers near them about tonight's show.
   * Singers already at that venue are skipped; one ping per singer per sender per night.
   */
  async promoteTonight(sender: User, _center: LatLng, radiusMi: number, show: { venueId: string; venueName: string; venueSlug: string; when: string }) {
    const venue = (await venues.byId(show.venueId)) ?? notFound('Venue');
    const near = (await presence.singersNear(sender, venue, radiusMi)).filter((s) => s.checkedInVenueId !== show.venueId);
    const night = nightOf(clock.now());
    const sent = await notifications.sendMany(
      near.map((s) => ({ userId: s.id, kind: 'promo', title: `🎤 ${sender.displayName}: karaoke tonight!`, body: `${show.venueName} · ${show.when}. Come sing with us.`, link: `/venues/${show.venueSlug}`, dedupeId: `ntf_promo_${sender.id}_${s.id}_${night}` })),
    );
    return { sent, skipped: near.length - sent };
  },
};

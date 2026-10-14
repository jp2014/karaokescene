import { and, desc, eq, inArray } from 'drizzle-orm';
import { customAlphabet } from 'nanoid';
import { db, schema } from '../../db/client.ts';
import { cardsById } from '../../lib/cards.ts';
import { clock } from '../../lib/clock.ts';
import type { User } from '../../lib/context.ts';
import { fail, notFound } from '../../lib/http.ts';
import { newId } from '../../lib/ids.ts';
import { notifications } from '../notifications/service.ts';
import { venues } from '../venues/service.ts';

const C = schema.coupons;
// No 0/O/1/I so codes can be read aloud at the bar.
const newCode = customAlphabet('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', 8);
const DAY = 86_400_000;

export type CouponStatus = 'active' | 'redeemed' | 'expired';
const statusOf = (c: typeof C.$inferSelect, now: number): CouponStatus => (c.redeemedAt ? 'redeemed' : c.expiresAt < now ? 'expired' : 'active');

async function withVenues(rows: (typeof C.$inferSelect)[]) {
  const vs = rows.length ? await db.select().from(schema.venues).where(inArray(schema.venues.id, [...new Set(rows.map((r) => r.venueId))])) : [];
  const singers = await cardsById(rows.map((r) => r.singerId));
  const now = clock.now();
  return rows.map((r) => {
    const v = vs.find((x) => x.id === r.venueId)!;
    return { ...r, status: statusOf(r, now), venue: { id: v.id, slug: v.slug, name: v.name, hue: v.hue, photoUrl: v.photoUrl }, singer: singers.get(r.singerId) ?? null };
  });
}

/** Venue Coupons: a venue rewards a singer; the singer shows a one-time QR that the venue scans. */
export const wallet = {
  async mine(singer: User) {
    const rows = await db.select().from(C).where(eq(C.singerId, singer.id)).orderBy(desc(C.createdAt));
    const order = { active: 0, redeemed: 1, expired: 2 };
    return (await withVenues(rows)).sort((a, b) => order[a.status] - order[b.status]);
  },

  async issued(venueUser: User) {
    const venue = (await venues.ownedBy(venueUser.id)) ?? fail(403, 'Only venues issue coupons');
    return withVenues(await db.select().from(C).where(eq(C.venueId, venue!.id)).orderBy(desc(C.createdAt)).limit(30));
  },

  async award(venueUser: User, input: { singerId: string; title: string; details: string; validDays: number }) {
    const venue = (await venues.ownedBy(venueUser.id)) ?? fail(403, 'Only venues can award coupons');
    const singer = (await db.query.users.findFirst({ where: eq(schema.users.id, input.singerId) })) ?? notFound('Singer');
    if (singer!.role !== 'singer') fail(400, 'Coupons go to singers');
    const now = clock.now();
    const row = { id: newId('cpn'), code: newCode(), venueId: venue!.id, singerId: singer!.id, title: input.title, details: input.details, expiresAt: now + input.validDays * DAY, redeemedAt: null, createdAt: now };
    await db.insert(C).values(row);
    await notifications.send(singer!.id, { kind: 'coupon', title: `🎟️ ${venue!.name} sent you a coupon`, body: input.title, link: '/wallet' });
    return row;
  },

  /** The venue scans (or types) the code. Each coupon works exactly once, at its own venue. */
  async redeem(venueUser: User, code: string) {
    const venue = (await venues.ownedBy(venueUser.id)) ?? fail(403, 'Only venues can redeem coupons');
    const coupon = (await db.query.coupons.findFirst({ where: eq(C.code, code.trim().toUpperCase()) })) ?? notFound('Coupon');
    if (coupon!.venueId !== venue!.id) fail(403, 'This coupon belongs to another venue');
    const status = statusOf(coupon!, clock.now());
    if (status === 'redeemed') fail(409, 'Already redeemed');
    if (status === 'expired') fail(409, 'This coupon has expired');
    const now = clock.now();
    await db.update(C).set({ redeemedAt: now }).where(and(eq(C.id, coupon!.id)));
    await notifications.send(coupon!.singerId, { kind: 'coupon', title: `✅ Coupon redeemed at ${venue!.name}`, body: coupon!.title, link: '/wallet' });
    const [full] = await withVenues([{ ...coupon!, redeemedAt: now }]);
    return full;
  },
};

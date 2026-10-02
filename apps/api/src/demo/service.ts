import { and, asc, eq, isNull } from 'drizzle-orm';
import { db, schema } from '../db/client.ts';
import { toCard } from '../lib/cards.ts';
import { clock, localParts } from '../lib/clock.ts';
import type { User } from '../lib/context.ts';
import { notFound } from '../lib/http.ts';
import { newId } from '../lib/ids.ts';
import { DEFAULT_PRIVACY, profiles } from '../modules/profiles/service.ts';
import { presence } from '../modules/presence/service.ts';
import { qr } from '../modules/qr/service.ts';
import { venues } from '../modules/venues/service.ts';
import { demoClock } from './clock.ts';
import { seed } from './seed.ts';

/** Persona tokens are just the user id: there is nothing to protect on a local demo. */
const TOKEN_PREFIX = 'demo.';
export const userIdFromDemoToken = (token: string) => (token.startsWith(TOKEN_PREFIX) ? token.slice(TOKEN_PREFIX.length) : null);

/** Demo controls and the persona switcher. Only ever mounted by the local Node host. */
export const demo = {
  async accounts() {
    const rows = await db.select().from(schema.users).orderBy(asc(schema.users.role), asc(schema.users.displayName));
    const vs = await venues.all();
    return rows.map((u) => ({
      ...toCard(u),
      bio: u.bio,
      ghostMode: u.ghostMode,
      venueName: u.role === 'venue' ? (vs.find((v) => v.ownerId === u.id)?.name ?? null) : null,
    }));
  },

  async signIn(userId: string) {
    const user = (await db.query.users.findFirst({ where: eq(schema.users.id, userId) })) ?? notFound('User');
    return { token: `${TOKEN_PREFIX}${user!.id}`, user: await profiles.me(user!) };
  },

  async userForToken(token: string) {
    const id = userIdFromDemoToken(token);
    return id ? ((await db.query.users.findFirst({ where: eq(schema.users.id, id) })) ?? null) : null;
  },

  reset: () => seed(),

  clockState() {
    const now = clock.now();
    return { now, offsetMs: clock.offset(), local: localParts(now) };
  },

  async setClock(target: { dayOfWeek: number; minutes: number } | null) {
    await demoClock.jumpTo(target);
    return demo.clockState();
  },

  /** Check a handful of random singers into a venue to show busy status changing. */
  async crowd(venueId: string, count: number) {
    const venue = (await venues.byId(venueId)) ?? notFound('Venue');
    const singers = await db.select().from(schema.users).where(eq(schema.users.role, 'singer'));
    const free = [];
    for (const s of singers.sort(() => Math.random() - 0.5)) {
      if (free.length >= count) break;
      if (!(await presence.currentCheckin(s.id))) free.push(s);
    }
    for (const s of free) await presence.checkIn(s, venue!.id, 'geo');
    return { added: free.length };
  },

  /** Make a random checked-in singer walk out of range so the KJ sees an Auto Leave. */
  async autoLeave(venueId: string) {
    const rows = await db.select().from(schema.checkins).where(and(eq(schema.checkins.venueId, venueId), isNull(schema.checkins.checkedOutAt)));
    const row = rows[Math.floor(Math.random() * rows.length)];
    if (!row) return { left: null };
    const user = (await db.query.users.findFirst({ where: eq(schema.users.id, row.userId) }))!;
    await presence.checkOut(user, 'auto-leave');
    return { left: user.displayName };
  },

  /** Growth loop demo: a brand-new singer joins by scanning the viewer's QR card. */
  async referralJoin(viewer: User) {
    const n = Math.floor(Math.random() * 9000) + 1000;
    const id = newId('usr');
    await db.insert(schema.users).values({
      id, role: 'singer', handle: `newbie${n}`, displayName: `New Singer ${n}`, avatarEmoji: '🐣', avatarHue: Math.floor(Math.random() * 360),
      bio: 'Just joined Karaoke Scene!', privacy: DEFAULT_PRIVACY, referredById: viewer.id, createdAt: clock.now(), lat: viewer.lat, lng: viewer.lng,
    });
    const scans = await qr.creditScan(viewer, `🐣 New Singer ${n} joined through your QR card`);
    return { handle: `newbie${n}`, scans };
  },

  /** Mock checkout for the upsell flows (KJ Pro, singer Plus, Premiere Partner). Real payments aren't built yet. */
  async upgrade(user: User) {
    await db.update(schema.users).set({ isPremium: true }).where(eq(schema.users.id, user.id));
    return { isPremium: true };
  },
};

import { and, eq, isNull } from 'drizzle-orm';
import { db, schema } from '../../db/client.ts';
import { clock, localParts, localTimeToMs } from '../../lib/clock.ts';
import type { User } from '../../lib/context.ts';
import { notFound } from '../../lib/http.ts';
import { newId } from '../../lib/ids.ts';
import { seed } from '../../seed/seed.ts';
import { DEFAULT_PRIVACY } from '../profiles/service.ts';
import { presence } from '../presence/service.ts';
import { qr } from '../qr/service.ts';
import { venues } from '../venues/service.ts';

/** Demo controls. Only mounted when DEBUG_TOOLS !== 'off'. */
export const debug = {
  reset: () => seed(),

  clockState() {
    const now = clock.now();
    return { now, offsetMs: clock.offset(), local: localParts(now) };
  },

  /** Jump to a weekday + time in scene time, or `null` for real time. */
  async setClock(target: { dayOfWeek: number; minutes: number } | null) {
    if (!target) await clock.setOffset(0);
    else {
      const real = Date.now();
      const { dayOfWeek } = localParts(real);
      const ms = localTimeToMs(real, (target.dayOfWeek - dayOfWeek + 7) % 7, target.minutes);
      await clock.setOffset(ms - real);
    }
    return debug.clockState();
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
};

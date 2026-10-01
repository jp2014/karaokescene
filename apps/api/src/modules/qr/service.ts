import { eq, sql } from 'drizzle-orm';
import { db, schema } from '../../db/client.ts';
import { toCard } from '../../lib/cards.ts';
import type { User } from '../../lib/context.ts';
import { notFound } from '../../lib/http.ts';
import { notifications } from '../notifications/service.ts';
import { presence } from '../presence/service.ts';
import { reputation } from '../reputation/service.ts';
import { venues } from '../venues/service.ts';

/** Every 3 scans/referrals earns another growth badge. */
const GROWTH_STEP = 3;

/**
 * QR codes encode plain URLs (https://<host>/q/u/<handle> or /q/v/<slug>) so any phone
 * camera opens them. Scanning a venue checks you in; scanning a person connects you.
 */
export const qr = {
  async scan(viewer: User, kind: 'u' | 'v', key: string) {
    if (kind === 'v') {
      const venue = (await venues.bySlug(key)) ?? notFound('Venue');
      const checkin = await presence.checkIn(viewer, venue!.id, 'qr');
      return { type: 'venue' as const, slug: venue!.slug, name: venue!.name, checkinId: checkin.id };
    }
    const owner = (await db.query.users.findFirst({ where: eq(schema.users.handle, key) })) ?? notFound('Profile');
    if (owner!.id !== viewer.id) await qr.creditScan(owner!, `${viewer.displayName} scanned your QR card`);
    return { type: 'user' as const, handle: owner!.handle, user: toCard(owner!) };
  },

  /** The growth loop: sharing your code earns Scene Builder / Ambassador badges. */
  async creditScan(owner: User, message: string) {
    const [row] = await db
      .update(schema.users)
      .set({ qrScans: sql`${schema.users.qrScans} + 1` })
      .where(eq(schema.users.id, owner.id))
      .returning();
    await notifications.send(owner.id, { kind: 'qr-scan', title: message, body: `${row.qrScans} people reached through your QR card`, link: '/me' });
    if (row.qrScans % GROWTH_STEP === 0 && owner.role !== 'venue') {
      const key = owner.role === 'kj' ? 'growth.kj-ambassador' : 'growth.scene-builder';
      await reputation.awardSystem(owner, key);
      await notifications.send(owner.id, { kind: 'badge', title: owner.role === 'kj' ? 'You earned Scene Ambassador!' : 'You earned Scene Builder!', body: 'Thanks for growing the scene', link: '/me' });
    }
    return row.qrScans;
  },
};

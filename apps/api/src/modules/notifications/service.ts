import { and, desc, eq, isNull } from 'drizzle-orm';
import { db, schema } from '../../db/client.ts';
import { clock } from '../../lib/clock.ts';
import { defer } from '../../lib/defer.ts';
import { newId } from '../../lib/ids.ts';
import { push } from '../../lib/push.ts';
import { realtime } from '../../lib/realtime.ts';

export type NotificationKind =
  | 'auto-leave'
  | 'venue-claimed'
  | 'promo-reminder'
  | 'check-in'
  | 'badge'
  | 'praise'
  | 'friend-request'
  | 'friend-accepted'
  | 'song-request'
  | 'up-next'
  | 'kj-now'
  | 'qr-scan'
  | 'request-accepted'
  | 'coupon'
  | 'invite'
  | 'promo'
  | 'blast'
  | 'regular';

type Message = { kind: NotificationKind; title: string; body?: string; link?: string };

export const notifications = {
  /** Store it for the in-app list, nudge any open app over Realtime, and push to their devices. */
  async send(userId: string, n: Message, dedupeId?: string) {
    return (await notifications.sendMany([{ userId, ...n, dedupeId }])) === 1;
  },

  /**
   * `send` to many people at once (fan-out to fans, friends, nearby singers) in a few statements.
   * Rows whose `dedupeId` already exists are skipped. Returns how many were delivered.
   */
  async sendMany(items: (Message & { userId: string; dedupeId?: string })[]) {
    const now = clock.now();
    const rows = [];
    const ids = new Set<string>();
    for (const n of items) {
      const id = n.dedupeId ?? newId('ntf');
      if (ids.has(id)) continue; // repeated within this call: still one notification (the first)
      ids.add(id);
      rows.push({ id, userId: n.userId, kind: n.kind, title: n.title, body: n.body ?? '', link: n.link ?? null, createdAt: now });
    }
    let delivered = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const batch = rows.slice(i, i + 500);
      const ids = new Set((await db.insert(schema.notifications).values(batch).onConflictDoNothing().returning({ id: schema.notifications.id })).map((r) => r.id));
      // Signal each stored batch now: if a later batch fails, a retry skips these by dedupe id.
      const stored = batch.filter((r) => ids.has(r.id));
      realtime.publishMany(stored.map((r) => ({ topic: `user:${r.userId}` as const, event: 'notification' as const, payload: { id: r.id, kind: r.kind } })));
      for (const r of stored) defer('push', () => push.send(r.userId, r));
      delivered += stored.length;
    }
    return delivered;
  },

  async list(userId: string) {
    const items = await db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, userId))
      .orderBy(desc(schema.notifications.createdAt))
      .limit(50);
    return { items, unread: items.filter((n) => !n.readAt).length };
  },

  async markAllRead(userId: string) {
    await db
      .update(schema.notifications)
      .set({ readAt: clock.now() })
      .where(and(eq(schema.notifications.userId, userId), isNull(schema.notifications.readAt)));
  },
};

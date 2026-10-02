import { and, desc, eq, isNull } from 'drizzle-orm';
import { db, schema } from '../../db/client.ts';
import { clock } from '../../lib/clock.ts';
import { defer } from '../../lib/defer.ts';
import { newId } from '../../lib/ids.ts';
import { push } from '../../lib/push.ts';
import { realtime } from '../../lib/realtime.ts';

export type NotificationKind =
  | 'auto-leave'
  | 'check-in'
  | 'badge'
  | 'praise'
  | 'friend-request'
  | 'friend-accepted'
  | 'song-request'
  | 'up-next'
  | 'kj-now'
  | 'qr-scan';

export const notifications = {
  /** Store it for the in-app list, nudge any open app over Realtime, and push to their devices. */
  async send(userId: string, n: { kind: NotificationKind; title: string; body?: string; link?: string }) {
    const row = { id: newId('ntf'), userId, kind: n.kind, title: n.title, body: n.body ?? '', link: n.link ?? null, createdAt: clock.now() };
    await db.insert(schema.notifications).values(row);
    realtime.publish(`user:${userId}`, 'notification', { id: row.id, kind: row.kind });
    defer('push', () => push.send(userId, row));
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

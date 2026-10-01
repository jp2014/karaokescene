import { and, desc, eq, isNull } from 'drizzle-orm';
import { db, schema } from '../../db/client.ts';
import { clock } from '../../lib/clock.ts';
import { newId } from '../../lib/ids.ts';

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
  async send(userId: string, n: { kind: NotificationKind; title: string; body?: string; link?: string }) {
    await db.insert(schema.notifications).values({
      id: newId('ntf'),
      userId,
      kind: n.kind,
      title: n.title,
      body: n.body ?? '',
      link: n.link,
      createdAt: clock.now(),
    });
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

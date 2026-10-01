import { and, desc, eq, gte } from 'drizzle-orm';
import { db, schema } from '../../db/client.ts';
import { cardsById } from '../../lib/cards.ts';
import { clock } from '../../lib/clock.ts';
import type { User } from '../../lib/context.ts';
import { fail, notFound } from '../../lib/http.ts';
import { newId } from '../../lib/ids.ts';
import { notifications } from '../notifications/service.ts';
import { BADGES, badgeByKey, tierFor } from './badges.ts';

const A = schema.badgeAwards;

export const reputation = {
  catalog: BADGES,

  /** Badge counts and tiers for a profile, best first. */
  async summary(userId: string) {
    const rows = await db.select().from(A).where(eq(A.recipientId, userId));
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.badgeKey, (counts.get(r.badgeKey) ?? 0) + 1);
    return [...counts.entries()]
      .map(([key, count]) => ({ ...badgeByKey.get(key)!, count, tier: tierFor(count) }))
      .filter((b) => b.key)
      .sort((a, b) => b.count - a.count);
  },

  /** Badges this giver can hand to this recipient, with whether they already did today. */
  async awardable(giver: User, recipientId: string) {
    const recipient = await db.query.users.findFirst({ where: eq(schema.users.id, recipientId) });
    if (!recipient) return [];
    const since = clock.now() - 20 * 3600_000;
    const recent = await db
      .select()
      .from(A)
      .where(and(eq(A.giverId, giver.id), eq(A.recipientId, recipientId), gte(A.createdAt, since)));
    return BADGES.filter((b) => b.givenBy === giver.role && b.givenTo === recipient.role).map((b) => ({
      ...b,
      givenRecently: recent.some((r) => r.badgeKey === b.key),
    }));
  },

  /** Awards follow the trust rules: KJs award singers, venues award KJs, once per night per badge. */
  async award(giver: User, recipientId: string, badgeKey: string) {
    const def = badgeByKey.get(badgeKey) ?? notFound('Badge');
    const recipient = (await db.query.users.findFirst({ where: eq(schema.users.id, recipientId) })) ?? notFound('User');
    if (def!.givenBy !== giver.role || def!.givenTo !== recipient!.role) fail(403, `${giver.role} accounts can't give that badge`);
    const options = await reputation.awardable(giver, recipientId);
    if (options.find((o) => o.key === badgeKey)?.givenRecently) fail(409, 'Already given tonight');
    await db.insert(A).values({ id: newId('bdg'), badgeKey, recipientId, giverId: giver.id, createdAt: clock.now() });
    await notifications.send(recipientId, {
      kind: 'badge',
      title: `You earned ${def!.label}!`,
      body: `Awarded by ${giver.displayName}`,
      link: `/u/${recipient!.handle}`,
    });
    return reputation.summary(recipientId);
  },

  /** Automatic growth-loop badge when someone joins via your QR code. */
  async awardSystem(recipient: User, badgeKey: string) {
    await db.insert(A).values({ id: newId('bdg'), badgeKey, recipientId: recipient.id, giverId: 'system', createdAt: clock.now() });
  },

  async recentFor(userId: string, limit = 10) {
    const rows = await db.select().from(A).where(eq(A.recipientId, userId)).orderBy(desc(A.createdAt)).limit(limit);
    const cards = await cardsById(rows.map((r) => r.giverId));
    return rows.map((r) => ({ id: r.id, badge: badgeByKey.get(r.badgeKey)!, giver: cards.get(r.giverId) ?? null, createdAt: r.createdAt }));
  },
};

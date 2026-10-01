import { desc, eq } from 'drizzle-orm';
import { db, schema } from '../../db/client.ts';
import { clock } from '../../lib/clock.ts';
import type { User } from '../../lib/context.ts';
import { fail } from '../../lib/http.ts';
import { newId } from '../../lib/ids.ts';

export type Network = 'facebook' | 'instagram' | 'karaokescene';

/**
 * Auto-Posting (a paid KJ/venue tool). Posting to Facebook/Instagram is mocked:
 * posts are stored and marked "posted" once their time passes.
 */
export const promo = {
  async list(user: User) {
    const rows = await db.select().from(schema.promoPosts).where(eq(schema.promoPosts.authorId, user.id)).orderBy(desc(schema.promoPosts.scheduledFor));
    const now = clock.now();
    return rows.map((r) => ({ ...r, status: r.scheduledFor <= now ? ('posted' as const) : r.status }));
  },

  async schedule(user: User, input: { body: string; networks: Network[]; scheduledFor: number; venueId?: string }) {
    if (!user.isPremium && input.networks.some((n) => n !== 'karaokescene')) fail(403, 'Auto-posting to social networks is a Pro feature');
    const row = { id: newId('pst'), authorId: user.id, venueId: input.venueId ?? null, networks: input.networks, body: input.body, scheduledFor: input.scheduledFor, status: 'scheduled' as const, createdAt: clock.now() };
    await db.insert(schema.promoPosts).values(row);
    return row;
  },

  /** Mock checkout for the upsell flows (KJ Pro, singer premium recommendations). */
  async upgrade(user: User) {
    await db.update(schema.users).set({ isPremium: true }).where(eq(schema.users.id, user.id));
    return { isPremium: true };
  },
};

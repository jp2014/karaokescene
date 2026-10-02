import { desc, eq } from 'drizzle-orm';
import { db, schema } from '../../db/client.ts';
import { clock } from '../../lib/clock.ts';
import type { User } from '../../lib/context.ts';
import { fail } from '../../lib/http.ts';
import { newId } from '../../lib/ids.ts';

export type Network = 'facebook' | 'instagram' | 'karaokescene';

/**
 * Auto-Posting (a paid KJ/venue tool). Posts are stored and marked "posted" once their
 * time passes (a scheduled job does this too). Delivery to Facebook/Instagram is not
 * built yet; the social networks need Pro, and paid upgrades only exist in the local demo.
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
};

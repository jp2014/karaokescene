import { and, desc, eq, gte, inArray } from 'drizzle-orm';
import { db, schema } from '../../db/client.ts';
import { clock, localParts, localTimeToMs } from '../../lib/clock.ts';
import type { User } from '../../lib/context.ts';
import { newId } from '../../lib/ids.ts';
import { hasPremium, requirePremium } from '../../lib/plans.ts';
import { notifications } from '../notifications/service.ts';
import { social } from '../social/service.ts';
import { nextNight } from '../venues/schedule.ts';
import { venues } from '../venues/service.ts';

export type Network = 'facebook' | 'instagram' | 'karaokescene';
const P = schema.promoPosts;
const DAY = 86_400_000;

async function networksFor(user: User): Promise<Network[]> {
  return (await hasPremium(user)) ? ['karaokescene', 'facebook', 'instagram'] : ['karaokescene'];
}

/**
 * Promotion tools. Posts are stored and marked "posted" once their time passes (a
 * scheduled job does this too). Delivery to Facebook/Instagram is not built; social
 * networks and blasts are paid features.
 */
export const promo = {
  async list(user: User) {
    const rows = await db.select().from(P).where(eq(P.authorId, user.id)).orderBy(desc(P.scheduledFor));
    const now = clock.now();
    return rows.map((r) => ({ ...r, status: r.scheduledFor <= now ? ('posted' as const) : r.status }));
  },

  async schedule(user: User, input: { body: string; networks: Network[]; scheduledFor: number; venueId?: string }) {
    if (input.networks.some((n) => n !== 'karaokescene')) await requirePremium(user, 'Auto social posting');
    const row = { id: newId('pst'), authorId: user.id, venueId: input.venueId ?? null, networks: input.networks, body: input.body, scheduledFor: input.scheduledFor, status: 'scheduled' as const, createdAt: clock.now() };
    await db.insert(P).values(row);
    return row;
  },

  /** Auto Promote: queue a post for the KJ's next night at a venue, 24 hours before it starts. */
  async autoPromoteNext(kj: User, venueId: string) {
    const v = (await venues.byId(venueId))!;
    const nights = (await venues.nightsFor(venueId)).filter((n) => n.kjId === kj.id);
    const next = nextNight(nights, clock.now());
    if (!next) return null;
    const scheduledFor = Math.max(next.startsAt - DAY, clock.now());
    const existing = await db.query.promoPosts.findFirst({ where: and(eq(P.authorId, kj.id), eq(P.venueId, venueId), gte(P.scheduledFor, scheduledFor - 60_000)) });
    if (existing) return existing;
    const day = new Date(next.startsAt).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Chicago' });
    return promo.schedule(kj, { venueId, scheduledFor, networks: await networksFor(kj), body: `🎤 ${day} night: karaoke at ${v.name} with ${kj.displayName}! Grab your crew and come sing. #KaraokeScene` });
  },

  /** Drink Special Auto Post (Venue Premier): announce a special at 4pm on each of its days this week. */
  async autoPostSpecial(venueUser: User, special: { venueId: string; title: string; price: string; details: string; days: number[] }) {
    await requirePremium(venueUser, 'Drink Special Auto Post');
    const v = (await venues.byId(special.venueId))!;
    const now = clock.now();
    const posts = [];
    for (let d = 0; d < 7; d++) {
      const at = localTimeToMs(now, d, 16 * 60);
      if (at < now || !special.days.includes(localParts(at).dayOfWeek)) continue;
      posts.push(await promo.schedule(venueUser, { venueId: v.id, scheduledFor: at, networks: ['karaokescene', 'facebook', 'instagram'], body: `🍹 Tonight at ${v.name}: ${special.title}${special.price ? ` (${special.price})` : ''}. ${special.details} #KaraokeScene` }));
    }
    return posts;
  },

  /**
   * Message Blast (KJ Pro): one message to every singer who follows the KJ or has
   * checked in at one of their venues in the last 60 days.
   */
  async blast(kj: User, message: string) {
    await requirePremium(kj, 'Message Blast');
    const fans = await db.select({ id: schema.favorites.userId }).from(schema.favorites).where(and(eq(schema.favorites.targetType, 'user'), eq(schema.favorites.targetId, kj.id)));
    const myVenues = (await venues.venuesForKj(kj.id)).map((v) => v.id);
    const recent = myVenues.length
      ? await db.select({ id: schema.checkins.userId }).from(schema.checkins).where(and(inArray(schema.checkins.venueId, myVenues), gte(schema.checkins.checkedInAt, clock.now() - 60 * DAY)))
      : [];
    const hidden = await social.hiddenIds(kj.id);
    const ids = [...new Set([...fans, ...recent].map((r) => r.id))].filter((id) => !hidden.has(id));
    const singers = ids.length ? await db.select({ id: schema.users.id }).from(schema.users).where(and(inArray(schema.users.id, ids), eq(schema.users.role, 'singer'))) : [];
    for (const s of singers) await notifications.send(s.id, { kind: 'blast', title: `📣 ${kj.displayName}`, body: message, link: `/u/${kj.handle}` });
    return { sent: singers.length };
  },
};

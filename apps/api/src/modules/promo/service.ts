import { and, desc, eq, gte, inArray } from 'drizzle-orm';
import { db, schema } from '../../db/client.ts';
import { clock, localParts, localTimeToMs, SCENE_TZ } from '../../lib/clock.ts';
import type { User } from '../../lib/context.ts';
import { newId } from '../../lib/ids.ts';
import { hasPremium, requirePremium } from '../../lib/plans.ts';
import { notifications } from '../notifications/service.ts';
import { social } from '../social/service.ts';
import { nextNight } from '../venues/schedule.ts';
import { venues } from '../venues/service.ts';

const P = schema.promoPosts;
const DAY = 86_400_000;

/**
 * Promotion tools. Nothing is posted on anyone's behalf: people share from the app (the
 * device share sheet, Facebook's share link, a text). Paid plans add reminders, stored as
 * promo posts; when one is due the scheduled job notifies its author with a link to share
 * it (see run_scheduled_jobs). Message Blast is a paid in-app message to a KJ's singers.
 */
export const promo = {
  async list(user: User) {
    const rows = await db.select().from(P).where(eq(P.authorId, user.id)).orderBy(desc(P.scheduledFor)).limit(50);
    const vs = await venues.all();
    const now = clock.now();
    return rows.map((r) => {
      const v = vs.find((x) => x.id === r.venueId);
      return { ...r, status: r.scheduledFor <= now ? ('posted' as const) : r.status, venue: v ? { id: v.id, slug: v.slug, name: v.name } : null };
    });
  },

  /** A reminder to share `body` at `scheduledFor`. */
  async schedule(user: User, input: { body: string; scheduledFor: number; venueId?: string; id?: string; sourceKey?: string }) {
    const row = { sourceKey: input.sourceKey ?? null, id: input.id ?? newId('pst'), authorId: user.id, venueId: input.venueId ?? null, networks: ['share'], body: input.body, scheduledFor: input.scheduledFor, status: 'scheduled' as const, createdAt: clock.now() };
    const [created] = await db.insert(P).values(row).onConflictDoNothing().returning();
    return created ?? (await db.query.promoPosts.findFirst({ where: eq(P.id, row.id) }))!;
  },

  /** Auto Promote (KJ Pro): a reminder to share the KJ's next night at a venue, 24 hours before it starts. */
  async autoPromoteNext(kj: User, venueId: string) {
    const v = (await venues.byId(venueId))!;
    const nights = (await venues.nightsFor(venueId)).filter((n) => n.kjId === kj.id);
    const next = nextNight(nights, clock.now());
    if (!next) return null;
    const scheduledFor = Math.max(next.startsAt - DAY, clock.now());
    // One stable primary key per show occurrence, even when requests race or the reminder is overdue.
    const id = `pst_auto_${kj.id}_${venueId}_${next.startsAt}`;
    const day = new Date(next.startsAt).toLocaleDateString('en-US', { weekday: 'long', timeZone: SCENE_TZ });
    return promo.schedule(kj, { id, sourceKey: `night:${next.night.id}`, venueId, scheduledFor, body: `🎤 ${day} night: karaoke at ${v.name} with ${kj.displayName}! Grab your crew and come sing. #KaraokeScene` });
  },

  /**
   * Auto Promote rolls forward: queue the next reminder for each venue where it's on. Runs
   * in the background when a KJ opens the booth or their venues (idempotent).
   */
  async rollAutoPromote(kj: User) {
    if (!(await hasPremium(kj))) return;
    const links = await db.select().from(schema.kjVenueLinks).where(and(eq(schema.kjVenueLinks.kjId, kj.id), eq(schema.kjVenueLinks.autoPromote, true)));
    for (const l of links) await promo.autoPromoteNext(kj, l.venueId);
  },

  /** Special reminders (Venue Premier): a reminder at 4pm on each of the special's days this week. */
  async remindSpecial(venueUser: User, special: { id: string; venueId: string; title: string; price: string; details: string; days: number[] }) {
    await requirePremium(venueUser, 'Special reminders');
    const v = (await venues.byId(special.venueId))!;
    const now = clock.now();
    const posts = [];
    for (let d = 0; d < 7; d++) {
      const at = localTimeToMs(now, d, 16 * 60);
      if (at < now || !special.days.includes(localParts(at).dayOfWeek)) continue;
      posts.push(await promo.schedule(venueUser, { id: `pst_special_${special.id}_${at}`, sourceKey: `special:${special.id}`, venueId: v.id, scheduledFor: at, body: `🍹 Tonight at ${v.name}: ${special.title}${special.price ? ` (${special.price})` : ''}. ${special.details} #KaraokeScene` }));
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

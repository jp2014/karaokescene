import { and, desc, eq, inArray, or } from 'drizzle-orm';
import { db, schema } from '../../db/client.ts';
import { cardsById, type UserCard } from '../../lib/cards.ts';
import { clock } from '../../lib/clock.ts';
import { fail, notFound } from '../../lib/http.ts';
import { newId } from '../../lib/ids.ts';
import type { Visibility } from '../../db/schema.ts';
import { notifications } from '../notifications/service.ts';

export type Relationship = {
  isSelf: boolean;
  friend: 'none' | 'friends' | 'requested' | 'incoming';
  favorited: boolean;
  blocked: boolean;
  blockedBy: boolean;
};

const { friendships: F, favorites: Fav, blocks: B } = schema;

export const PRAISE_PRESETS = [
  { emoji: '🔥', message: 'Absolutely brought the house down' },
  { emoji: '🎯', message: 'Nailed every note' },
  { emoji: '💃', message: 'Got the whole room dancing' },
  { emoji: '🥹', message: 'Gave me chills' },
  { emoji: '🎸', message: 'Pure rock star energy' },
  { emoji: '👏', message: 'Brave song choice, totally owned it' },
] as const;

async function friendIds(userId: string) {
  const rows = await db
    .select()
    .from(F)
    .where(and(eq(F.status, 'accepted'), or(eq(F.requesterId, userId), eq(F.addresseeId, userId))));
  return rows.map((r) => (r.requesterId === userId ? r.addresseeId : r.requesterId));
}

export const social = {
  friendIds,

  /** Everyone the viewer has blocked or been blocked by. Hidden from each other everywhere. */
  async hiddenIds(viewerId: string | undefined): Promise<Set<string>> {
    if (!viewerId) return new Set();
    const rows = await db
      .select()
      .from(B)
      .where(or(eq(B.userId, viewerId), eq(B.blockedId, viewerId)));
    return new Set(rows.map((r) => (r.userId === viewerId ? r.blockedId : r.userId)));
  },

  async relationship(viewerId: string | undefined, otherId: string): Promise<Relationship> {
    const base: Relationship = { isSelf: viewerId === otherId, friend: 'none', favorited: false, blocked: false, blockedBy: false };
    if (!viewerId || base.isSelf) return base;
    const [f, fav, blk] = await Promise.all([
      db.query.friendships.findFirst({
        where: or(and(eq(F.requesterId, viewerId), eq(F.addresseeId, otherId)), and(eq(F.requesterId, otherId), eq(F.addresseeId, viewerId))),
      }),
      db.query.favorites.findFirst({ where: and(eq(Fav.userId, viewerId), eq(Fav.targetType, 'user'), eq(Fav.targetId, otherId)) }),
      db.select().from(B).where(or(and(eq(B.userId, viewerId), eq(B.blockedId, otherId)), and(eq(B.userId, otherId), eq(B.blockedId, viewerId)))),
    ]);
    if (f) base.friend = f.status === 'accepted' ? 'friends' : f.requesterId === viewerId ? 'requested' : 'incoming';
    base.favorited = !!fav;
    base.blocked = blk.some((b) => b.userId === viewerId);
    base.blockedBy = blk.some((b) => b.userId === otherId);
    return base;
  },

  /** Privacy check for a single profile field. */
  canSee(visibility: Visibility, rel: Relationship) {
    if (rel.isSelf) return true;
    if (visibility === 'everyone') return true;
    if (visibility === 'friends') return rel.friend === 'friends';
    return false;
  },

  async requestFriend(viewerId: string, otherId: string) {
    if (viewerId === otherId) fail(400, "You can't friend yourself");
    const rel = await social.relationship(viewerId, otherId);
    if (rel.blocked || rel.blockedBy) fail(403, 'Not available');
    if (rel.friend === 'incoming') return social.respond(viewerId, otherId, true);
    if (rel.friend !== 'none') return rel;
    await db.insert(F).values({ requesterId: viewerId, addresseeId: otherId, status: 'pending', createdAt: clock.now() });
    const me = (await cardsById([viewerId])).get(viewerId)!;
    await notifications.send(otherId, { kind: 'friend-request', title: `${me.displayName} wants to be friends`, link: `/u/${me.handle}` });
    return social.relationship(viewerId, otherId);
  },

  async respond(viewerId: string, requesterId: string, accept: boolean) {
    const where = and(eq(F.requesterId, requesterId), eq(F.addresseeId, viewerId));
    if (accept) {
      await db.update(F).set({ status: 'accepted' }).where(where);
      const me = (await cardsById([viewerId])).get(viewerId)!;
      await notifications.send(requesterId, { kind: 'friend-accepted', title: `${me.displayName} accepted your friend request`, link: `/u/${me.handle}` });
    } else {
      await db.delete(F).where(where);
    }
    return social.relationship(viewerId, requesterId);
  },

  async unfriend(viewerId: string, otherId: string) {
    await db
      .delete(F)
      .where(or(and(eq(F.requesterId, viewerId), eq(F.addresseeId, otherId)), and(eq(F.requesterId, otherId), eq(F.addresseeId, viewerId))));
    return social.relationship(viewerId, otherId);
  },

  async setBlocked(viewerId: string, otherId: string, blocked: boolean) {
    if (blocked) {
      await social.unfriend(viewerId, otherId);
      await db.insert(B).values({ userId: viewerId, blockedId: otherId, createdAt: clock.now() }).onConflictDoNothing();
    } else {
      await db.delete(B).where(and(eq(B.userId, viewerId), eq(B.blockedId, otherId)));
    }
    return social.relationship(viewerId, otherId);
  },

  async setFavorite(viewerId: string, targetType: 'user' | 'venue', targetId: string, on: boolean) {
    if (on) {
      await db.insert(Fav).values({ userId: viewerId, targetType, targetId, createdAt: clock.now() }).onConflictDoNothing();
    } else {
      await db.delete(Fav).where(and(eq(Fav.userId, viewerId), eq(Fav.targetType, targetType), eq(Fav.targetId, targetId)));
    }
    return { favorited: on };
  },

  async favoriteVenueIds(viewerId: string) {
    const rows = await db.select().from(Fav).where(and(eq(Fav.userId, viewerId), eq(Fav.targetType, 'venue')));
    return rows.map((r) => r.targetId);
  },

  /** The viewer's whole social graph in one call: friends, requests, favorites, blocks. */
  async circle(viewerId: string) {
    const [fr, favs, blks] = await Promise.all([
      db.select().from(F).where(or(eq(F.requesterId, viewerId), eq(F.addresseeId, viewerId))),
      db.select().from(Fav).where(eq(Fav.userId, viewerId)),
      db.select().from(B).where(eq(B.userId, viewerId)),
    ]);
    const otherOf = (r: (typeof fr)[number]) => (r.requesterId === viewerId ? r.addresseeId : r.requesterId);
    const favUserIds = favs.filter((f) => f.targetType === 'user').map((f) => f.targetId);
    const cards = await cardsById([...fr.map(otherOf), ...favUserIds, ...blks.map((b) => b.blockedId)]);
    const favVenueIds = favs.filter((f) => f.targetType === 'venue').map((f) => f.targetId);
    const venues = favVenueIds.length
      ? await db.select({ id: schema.venues.id, slug: schema.venues.slug, name: schema.venues.name, hue: schema.venues.hue, neighborhood: schema.venues.neighborhood }).from(schema.venues).where(inArray(schema.venues.id, favVenueIds))
      : [];
    const pick = (ids: string[]) => ids.map((id) => cards.get(id)).filter((c): c is UserCard => !!c);
    return {
      friends: pick(fr.filter((r) => r.status === 'accepted').map(otherOf)),
      incoming: pick(fr.filter((r) => r.status === 'pending' && r.addresseeId === viewerId).map((r) => r.requesterId)),
      outgoing: pick(fr.filter((r) => r.status === 'pending' && r.requesterId === viewerId).map((r) => r.addresseeId)),
      favoriteKjs: pick(favUserIds).filter((c) => c.role === 'kj'),
      favoriteSingers: pick(favUserIds).filter((c) => c.role === 'singer'),
      favoriteVenues: venues,
      blocked: pick(blks.map((b) => b.blockedId)),
    };
  },

  /** Positive-only praise between singers. There is deliberately no way to post criticism. */
  async givePraise(viewerId: string, toId: string, input: { emoji: string; message: string; venueId?: string; songId?: string }) {
    if (viewerId === toId) fail(400, "Praising yourself? We love the confidence, but no.");
    const to = await db.query.users.findFirst({ where: eq(schema.users.id, toId) });
    if (!to) notFound('User');
    const rel = await social.relationship(viewerId, toId);
    if (rel.blocked || rel.blockedBy) fail(403, 'Not available');
    const row = { id: newId('prs'), fromId: viewerId, toId, ...input, createdAt: clock.now() };
    await db.insert(schema.praise).values(row);
    const me = (await cardsById([viewerId])).get(viewerId)!;
    await notifications.send(toId, { kind: 'praise', title: `${input.emoji} ${me.displayName} praised you`, body: input.message, link: `/u/${to!.handle}` });
    return row;
  },

  /** Praise feed. Pass `toId` for one user's wall, or omit for the scene-wide feed. */
  async praiseFeed(viewerId: string | undefined, opts: { toId?: string; limit?: number } = {}) {
    const rows = await db
      .select()
      .from(schema.praise)
      .where(opts.toId ? eq(schema.praise.toId, opts.toId) : undefined)
      .orderBy(desc(schema.praise.createdAt))
      .limit(opts.limit ?? 40);
    const hidden = await social.hiddenIds(viewerId);
    const visible = rows.filter((r) => !hidden.has(r.fromId) && !hidden.has(r.toId));
    const cards = await cardsById(visible.flatMap((r) => [r.fromId, r.toId]));
    const songIds = visible.map((r) => r.songId).filter((x): x is string => !!x);
    const venueIds = visible.map((r) => r.venueId).filter((x): x is string => !!x);
    const [songRows, venueRows] = await Promise.all([
      songIds.length ? db.select().from(schema.songs).where(inArray(schema.songs.id, songIds)) : [],
      venueIds.length ? db.select({ id: schema.venues.id, name: schema.venues.name, slug: schema.venues.slug }).from(schema.venues).where(inArray(schema.venues.id, venueIds)) : [],
    ]);
    const songMap = new Map(songRows.map((s) => [s.id, s]));
    const venueMap = new Map(venueRows.map((v) => [v.id, v]));
    return visible.map((r) => ({
      id: r.id,
      emoji: r.emoji,
      message: r.message,
      createdAt: r.createdAt,
      from: cards.get(r.fromId)!,
      to: cards.get(r.toId)!,
      song: r.songId ? (songMap.get(r.songId) ?? null) : null,
      venue: r.venueId ? (venueMap.get(r.venueId) ?? null) : null,
    }));
  },
};

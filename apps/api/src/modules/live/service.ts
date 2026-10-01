import { and, asc, desc, eq, gte, inArray } from 'drizzle-orm';
import { db, schema } from '../../db/client.ts';
import { cardsById, toCard } from '../../lib/cards.ts';
import { clock } from '../../lib/clock.ts';
import type { User } from '../../lib/context.ts';
import { fail, notFound } from '../../lib/http.ts';
import { newId } from '../../lib/ids.ts';
import { notifications } from '../notifications/service.ts';
import { presence } from '../presence/service.ts';
import { reputation } from '../reputation/service.ts';
import { songLists } from '../songs/service.ts';
import { venues } from '../venues/service.ts';

const R = schema.songRequests;

async function queueFor(sessionId: string) {
  const rows = await db
    .select({ req: R, song: schema.songs })
    .from(R)
    .innerJoin(schema.songs, eq(schema.songs.id, R.songId))
    .where(and(eq(R.kjSessionId, sessionId), inArray(R.status, ['queued', 'up', 'done'])))
    .orderBy(asc(R.createdAt));
  const cards = await cardsById(rows.map((r) => r.req.singerId));
  return rows.map((r) => ({ ...r.req, song: r.song, singer: cards.get(r.req.singerId)! }));
}

/** The live show: the KJ's booth and the singer's "I'm here" screen. */
export const live = {
  /** Everything a KJ needs on one screen while running a night. */
  async booth(kj: User) {
    const session = await presence.kjSessionFor(kj.id);
    const myVenues = await venues.venuesForKj(kj.id);
    if (!session) return { session: null, venue: null, venues: myVenues, singers: [], queue: [], departures: [] };
    const venue = (await venues.byId(session.venueId))!;
    const here = await presence.here(venue.id, kj);
    const singers = await Promise.all(
      here
        .filter((u) => u.role === 'singer')
        .map(async (u) => {
          const list = await songLists.forUser(u.id);
          return { ...u, goTo: list.filter((s) => s.isGoTo).slice(0, 3), listSize: list.length, badges: (await reputation.summary(u.id)).slice(0, 3) };
        }),
    );
    const left = await db
      .select()
      .from(schema.checkins)
      .where(and(eq(schema.checkins.venueId, venue.id), eq(schema.checkins.checkoutReason, 'auto-leave'), gte(schema.checkins.checkedOutAt, session.startedAt)))
      .orderBy(desc(schema.checkins.checkedOutAt))
      .limit(10);
    const leftCards = await cardsById(left.map((l) => l.userId));
    return {
      session,
      venue,
      venues: myVenues,
      singers,
      queue: await queueFor(session.id),
      departures: left.map((l) => ({ user: leftCards.get(l.userId)!, at: l.checkedOutAt! })),
    };
  },

  /** The singer's view of their current night. */
  async mine(singer: User) {
    const checkin = await presence.currentCheckin(singer.id);
    if (!checkin) return { checkin: null, venue: null, kj: null, queue: [], mine: [] };
    const venue = (await venues.byId(checkin.venueId))!;
    const session = await presence.activeKjSession(venue.id);
    const queue = session ? (await queueFor(session.id)).filter((q) => q.status !== 'done') : [];
    return {
      checkin,
      venue,
      kj: session ? ((await cardsById([session.kjId])).get(session.kjId) ?? null) : null,
      kjSessionId: session?.id ?? null,
      queue: queue.map((q) => ({ id: q.id, status: q.status, song: q.song, singer: q.singer, isMine: q.singerId === singer.id })),
      mine: queue.filter((q) => q.singerId === singer.id).map((q) => q.id),
    };
  },

  async request(singer: User, songId: string, source: 'list' | 'roulette' | 'search') {
    const checkin = (await presence.currentCheckin(singer.id)) ?? fail(400, 'Check in to a venue first');
    const session = (await presence.activeKjSession(checkin!.venueId)) ?? fail(400, "There's no KJ running this venue right now");
    const song = (await db.query.songs.findFirst({ where: eq(schema.songs.id, songId) })) ?? notFound('Song');
    const queued = await db.select().from(R).where(and(eq(R.kjSessionId, session!.id), eq(R.singerId, singer.id), eq(R.status, 'queued')));
    if (queued.length >= 2) fail(409, 'You already have 2 songs in the rotation');
    const row = { id: newId('req'), kjSessionId: session!.id, singerId: singer.id, songId, source, status: 'queued' as const, createdAt: clock.now() };
    await db.insert(R).values(row);
    await notifications.send(session!.kjId, {
      kind: 'song-request',
      title: `${singer.ghostMode ? '👻 Ghost singer' : singer.displayName} requested a song`,
      body: `${song!.title} — ${song!.artist}${source === 'roulette' ? ' (Song Roulette!)' : ''}`,
      link: '/kj',
    });
    return row;
  },

  async cancel(singer: User, requestId: string) {
    await db.update(R).set({ status: 'skipped' }).where(and(eq(R.id, requestId), eq(R.singerId, singer.id)));
  },

  /** KJ moves a request through the rotation. "up" pings the singer. */
  async setStatus(kj: User, requestId: string, status: 'queued' | 'up' | 'done' | 'skipped') {
    const req = (await db.query.songRequests.findFirst({ where: eq(R.id, requestId) })) ?? notFound('Request');
    const session = await db.query.kjSessions.findFirst({ where: eq(schema.kjSessions.id, req!.kjSessionId) });
    if (session?.kjId !== kj.id) fail(403, 'Not your show');
    if (status === 'up') {
      await db.update(R).set({ status: 'done' }).where(and(eq(R.kjSessionId, req!.kjSessionId), eq(R.status, 'up')));
      const song = await db.query.songs.findFirst({ where: eq(schema.songs.id, req!.songId) });
      await notifications.send(req!.singerId, { kind: 'up-next', title: "🎤 You're up!", body: `${song?.title} — head to the stage`, link: '/live' });
    }
    await db.update(R).set({ status }).where(eq(R.id, requestId));
    return queueFor(req!.kjSessionId);
  },

  /** KJ pulls a song straight from a singer's favorites list into the rotation. */
  async pullFromList(kj: User, singerId: string, songId: string) {
    const session = (await presence.kjSessionFor(kj.id)) ?? fail(400, 'Start your show first');
    const row = { id: newId('req'), kjSessionId: session!.id, singerId, songId, source: 'list' as const, status: 'queued' as const, createdAt: clock.now() };
    await db.insert(R).values(row);
    const singer = await db.query.users.findFirst({ where: eq(schema.users.id, singerId) });
    const song = await db.query.songs.findFirst({ where: eq(schema.songs.id, songId) });
    if (singer) await notifications.send(singer.id, { kind: 'song-request', title: `${kj.displayName} added you to the rotation`, body: `${song?.title} — ${song?.artist}`, link: '/live' });
    return { ...row, singer: singer ? toCard(singer) : null };
  },
};

import { and, desc, eq, gte, inArray } from 'drizzle-orm';
import { db, schema } from '../../db/client.ts';
import { cardsById } from '../../lib/cards.ts';
import { clock } from '../../lib/clock.ts';
import type { User } from '../../lib/context.ts';
import { fail, notFound } from '../../lib/http.ts';
import { newId } from '../../lib/ids.ts';
import { realtime } from '../../lib/realtime.ts';
import { hasPremium } from '../../lib/plans.ts';
import { notifications } from '../notifications/service.ts';
import { presence } from '../presence/service.ts';
import { reputation } from '../reputation/service.ts';
import { songLists } from '../songs/service.ts';
import { venues } from '../venues/service.ts';

const R = schema.songRequests;
/** Songs a singer can have waiting for the KJ at once. */
const MAX_PENDING = 3;

/** Tell the booth and every singer's "My Night" at this venue that the submissions changed. */
const queueChanged = (venueId: string) => realtime.publish(`venue:${venueId}`, 'live');

async function submissionsFor(sessionId: string, opts: { singerId?: string } = {}) {
  const rows = await db
    .select({ req: R, song: schema.songs })
    .from(R)
    .innerJoin(schema.songs, eq(schema.songs.id, R.songId))
    .where(and(eq(R.kjSessionId, sessionId), inArray(R.status, ['submitted', 'accepted']), opts.singerId ? eq(R.singerId, opts.singerId) : undefined))
    .orderBy(desc(R.createdAt));
  const cards = await cardsById(rows.map((r) => r.req.singerId));
  return rows.map((r) => ({ ...r.req, song: r.song, singer: cards.get(r.req.singerId)! }));
}

/**
 * The live show. The app does not run the KJ's rotation (KJs keep their own software):
 * singers submit songs, and the KJ accepts each one once it's in their system.
 */
export const live = {
  /** Everything a KJ needs on one screen while running a night. */
  async booth(kj: User) {
    const session = await presence.kjSessionFor(kj.id);
    const myVenues = await venues.venuesForKj(kj.id);
    const premium = await hasPremium(kj);
    if (!session) return { session: null, venue: null, venues: myVenues, singers: [], submitted: [], accepted: [], departures: [], premium };
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
    const all = await submissionsFor(session.id);
    // Auto Leave is a KJ Pro feature: free KJs don't get the departures list.
    const left = premium
      ? await db
          .select()
          .from(schema.checkins)
          .where(and(eq(schema.checkins.venueId, venue.id), eq(schema.checkins.checkoutReason, 'auto-leave'), gte(schema.checkins.checkedOutAt, session.startedAt)))
          .orderBy(desc(schema.checkins.checkedOutAt))
          .limit(10)
      : [];
    const leftCards = await cardsById(left.map((l) => l.userId));
    return {
      session,
      venue,
      venues: myVenues,
      singers,
      submitted: all.filter((r) => r.status === 'submitted').reverse(),
      accepted: all.filter((r) => r.status === 'accepted'),
      departures: left.map((l) => ({ user: leftCards.get(l.userId)!, at: l.checkedOutAt! })),
      premium,
    };
  },

  /** The singer's view of their current night: where they are and what they've sent the KJ. */
  async mine(singer: User) {
    const checkin = await presence.currentCheckin(singer.id);
    if (!checkin) return { checkin: null, venue: null, kj: null, kjSessionId: null, submissions: [] };
    const venue = (await venues.byId(checkin.venueId))!;
    const session = await presence.activeKjSession(venue.id);
    const mine = session ? await submissionsFor(session.id, { singerId: singer.id }) : [];
    return {
      checkin,
      venue,
      kj: session ? ((await cardsById([session.kjId])).get(session.kjId) ?? null) : null,
      kjSessionId: session?.id ?? null,
      submissions: mine.map((q) => ({ id: q.id, status: q.status, source: q.source, song: q.song, createdAt: q.createdAt, decidedAt: q.decidedAt })),
    };
  },

  async submit(singer: User, songId: string, source: 'list' | 'roulette' | 'search') {
    const checkin = (await presence.currentCheckin(singer.id)) ?? fail(400, 'Check in to a venue first');
    const session = (await presence.activeKjSession(checkin!.venueId)) ?? fail(400, "There's no KJ running this venue right now");
    const song = (await db.query.songs.findFirst({ where: eq(schema.songs.id, songId) })) ?? notFound('Song');
    const pending = await db.select().from(R).where(and(eq(R.kjSessionId, session!.id), eq(R.singerId, singer.id), eq(R.status, 'submitted')));
    if (pending.length >= MAX_PENDING) fail(409, `You already have ${MAX_PENDING} songs waiting for the KJ`);
    if (pending.some((p) => p.songId === songId)) fail(409, 'You already submitted that song');
    const row = { id: newId('req'), kjSessionId: session!.id, singerId: singer.id, songId, source, status: 'submitted' as const, createdAt: clock.now(), decidedAt: null };
    await db.insert(R).values(row);
    queueChanged(session!.venueId);
    await notifications.send(session!.kjId, {
      kind: 'song-request',
      title: `${singer.ghostMode ? '👻 Ghost singer' : singer.displayName} submitted a song`,
      body: `${song!.title} — ${song!.artist}${source === 'roulette' ? ' (Song Roulette!)' : ''}`,
      link: '/kj',
    });
    return row;
  },

  async withdraw(singer: User, requestId: string) {
    const [req] = await db.update(R).set({ status: 'withdrawn', decidedAt: clock.now() }).where(and(eq(R.id, requestId), eq(R.singerId, singer.id), eq(R.status, 'submitted'))).returning();
    const session = req && (await db.query.kjSessions.findFirst({ where: eq(schema.kjSessions.id, req.kjSessionId) }));
    if (session) queueChanged(session.venueId);
  },

  /** KJ accepts a submission (it's in their own system now) or declines it. Pings the singer. */
  async decide(kj: User, requestId: string, accept: boolean) {
    const req = (await db.query.songRequests.findFirst({ where: eq(R.id, requestId) })) ?? notFound('Submission');
    const session = await db.query.kjSessions.findFirst({ where: eq(schema.kjSessions.id, req!.kjSessionId) });
    if (session?.kjId !== kj.id) fail(403, 'Not your show');
    await db.update(R).set({ status: accept ? 'accepted' : 'declined', decidedAt: clock.now() }).where(eq(R.id, requestId));
    queueChanged(session!.venueId);
    const song = await db.query.songs.findFirst({ where: eq(schema.songs.id, req!.songId) });
    await notifications.send(req!.singerId, accept
      ? { kind: 'request-accepted', title: `✅ ${kj.displayName} accepted your song`, body: `${song?.title} — you're on the list`, link: '/live' }
      : { kind: 'request-accepted', title: `${kj.displayName} couldn't fit your song in`, body: `${song?.title}. Try another one!`, link: '/live' });
    return { ok: true };
  },

  /** KJ adds a song straight from a singer's go-to list (accepted right away). */
  async addForSinger(kj: User, singerId: string, songId: string) {
    const session = (await presence.kjSessionFor(kj.id)) ?? fail(400, 'Start your show first');
    const row = { id: newId('req'), kjSessionId: session!.id, singerId, songId, source: 'kj' as const, status: 'accepted' as const, createdAt: clock.now(), decidedAt: clock.now() };
    await db.insert(R).values(row);
    queueChanged(session!.venueId);
    const song = await db.query.songs.findFirst({ where: eq(schema.songs.id, songId) });
    await notifications.send(singerId, { kind: 'request-accepted', title: `🎤 ${kj.displayName} picked a song for you`, body: `${song?.title} — ${song?.artist}`, link: '/live' });
    return row;
  },
};

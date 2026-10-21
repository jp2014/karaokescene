import { and, asc, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { db, schema } from '../../db/client.ts';
import { clock } from '../../lib/clock.ts';
import { newId } from '../../lib/ids.ts';
import { parseSongbook } from './import.ts';

const { songs: S, songListEntries: L, songbookEntries: SB } = schema;
export type Song = typeof S.$inferSelect;

/**
 * The public catalog is whatever KJs have imported: songs in at least one songbook. A song a
 * singer free-adds exists only on their own list until some KJ imports it too.
 */
const inCatalog = sql`exists (select 1 from ${SB} where ${SB.songId} = ${S.id})`;

function decadeOf(year?: number) {
  return year ? `${Math.floor(year / 10) * 10}s` : 'Unknown';
}

export const songCatalog = {
  async search(q: string, opts: { kjId?: string; limit?: number } = {}) {
    const term = `%${q.trim()}%`;
    const match = q.trim() ? or(ilike(S.title, term), ilike(S.artist, term)) : undefined;
    const base = opts.kjId
      ? db.select({ song: S }).from(S).innerJoin(SB, and(eq(SB.songId, S.id), eq(SB.kjId, opts.kjId))).where(match)
      : db.select({ song: S }).from(S).where(and(inCatalog, match));
    const rows = await base.orderBy(asc(S.artist), asc(S.title)).limit(opts.limit ?? 50);
    return rows.map((r) => r.song);
  },

  /** Find a song by title+artist, creating it in the shared catalog if needed. */
  async upsert(title: string, artist: string, genre = 'Other', year?: number): Promise<Song> {
    const existing = await db.query.songs.findFirst({
      where: and(sql`lower(${S.title}) = lower(${title})`, sql`lower(${S.artist}) = lower(${artist})`),
    });
    if (existing) return existing;
    const song = { id: newId('sng'), title, artist, genre, decade: decadeOf(year) };
    await db.insert(S).values(song);
    return song;
  },
};

export const songLists = {
  /** A singer's list. With `kjId`, each song says whether that KJ's songbook has it. */
  async forUser(userId: string, kjId?: string) {
    const rows = await db
      .select({ song: S, isGoTo: L.isGoTo, addedAt: L.addedAt })
      .from(L)
      .innerJoin(S, eq(S.id, L.songId))
      .where(eq(L.userId, userId))
      .orderBy(desc(L.isGoTo), asc(S.artist));
    const inBook = kjId && rows.length
      ? new Set((await db.select({ id: SB.songId }).from(SB).where(and(eq(SB.kjId, kjId), inArray(SB.songId, rows.map((r) => r.song.id))))).map((r) => r.id))
      : null;
    return rows.map((r) => ({ ...r.song, isGoTo: r.isGoTo, addedAt: r.addedAt, inKjBook: inBook ? inBook.has(r.song.id) : null }));
  },

  async add(userId: string, songId: string) {
    await db.insert(L).values({ userId, songId, addedAt: clock.now() }).onConflictDoNothing();
  },

  /** Free add: any title + artist, even if no KJ's songbook has it yet. */
  async addCustom(userId: string, title: string, artist: string) {
    const song = await songCatalog.upsert(title.trim(), artist.trim());
    await songLists.add(userId, song.id);
    return song;
  },

  async remove(userId: string, songId: string) {
    await db.delete(L).where(and(eq(L.userId, userId), eq(L.songId, songId)));
  },

  async setGoTo(userId: string, songId: string, isGoTo: boolean) {
    await db.update(L).set({ isGoTo }).where(and(eq(L.userId, userId), eq(L.songId, songId)));
  },

  /**
   * Song Roulette: a random pick from the singer's list, restricted to the KJ's
   * songbook when they're at a live show so the KJ can actually play it.
   */
  async roulette(userId: string, kjId?: string) {
    let list = await songLists.forUser(userId);
    if (kjId && list.length) {
      const inBook = await db
        .select({ id: SB.songId })
        .from(SB)
        .where(and(eq(SB.kjId, kjId), inArray(SB.songId, list.map((s) => s.id))));
      const ids = new Set(inBook.map((r) => r.id));
      list = list.filter((s) => ids.has(s.id));
    }
    if (!list.length) {
      if (kjId) {
        const [any] = await db.select({ song: S }).from(S).innerJoin(SB, eq(SB.songId, S.id))
          .where(eq(SB.kjId, kjId)).orderBy(sql`random()`).limit(1);
        return any?.song ?? null;
      }
      const [any] = await db.select().from(S).where(inCatalog).orderBy(sql`random()`).limit(1);
      return any ?? null;
    }
    return list[Math.floor(Math.random() * list.length)];
  },

  /** Recommendations: popular songs from people with overlapping taste that aren't on your list yet. */
  async recommend(userId: string, limit = 6) {
    const mine = await db.select({ id: L.songId }).from(L).where(eq(L.userId, userId));
    const mineIds = mine.map((m) => m.id);
    const rows = await db
      .select({ song: S, n: sql<number>`count(*)`.as('n') })
      .from(L)
      .innerJoin(S, eq(S.id, L.songId))
      .where(and(inCatalog, mineIds.length ? sql`${L.songId} not in ${mineIds}` : undefined))
      .groupBy(S.id)
      .orderBy(desc(sql`n`))
      .limit(limit);
    return rows.map((r) => ({ ...r.song, popularity: Number(r.n) }));
  },
};

export const songbooks = {
  async stats(kjId: string) {
    const [row] = await db.select({ n: sql<number>`count(*)` }).from(SB).where(eq(SB.kjId, kjId));
    const genres = await db
      .select({ genre: S.genre, n: sql<number>`count(*)` })
      .from(SB)
      .innerJoin(S, eq(S.id, SB.songId))
      .where(eq(SB.kjId, kjId))
      .groupBy(S.genre)
      .orderBy(desc(sql`count(*)`));
    return { total: Number(row?.n ?? 0), genres: genres.map((g) => ({ genre: g.genre, count: Number(g.n) })) };
  },

  async add(kjId: string, songId: string) {
    await db.insert(SB).values({ kjId, songId }).onConflictDoNothing();
  },

  async remove(kjId: string, songId: string) {
    await db.delete(SB).where(and(eq(SB.kjId, kjId), eq(SB.songId, songId)));
  },

  /**
   * Import a songbook from CSV/TSV text, one "Title, Artist[, Genre][, Year]" per line,
   * which is how most KJ software exports. Returns how many were new.
   */
  async importText(kjId: string, text: string) {
    const { songs, skipped, lines } = parseSongbook(text);
    const before = (await songbooks.stats(kjId)).total;
    for (const input of songs) {
      const song = await songCatalog.upsert(input.title, input.artist, input.genre, input.year);
      await songbooks.add(kjId, song.id);
    }
    return { added: (await songbooks.stats(kjId)).total - before, skipped, lines };
  },
};

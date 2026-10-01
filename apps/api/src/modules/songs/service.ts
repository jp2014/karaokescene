import { and, asc, desc, eq, inArray, like, or, sql } from 'drizzle-orm';
import { db, schema } from '../../db/client.ts';
import { clock } from '../../lib/clock.ts';
import { newId } from '../../lib/ids.ts';

const { songs: S, songListEntries: L, songbookEntries: SB } = schema;
export type Song = typeof S.$inferSelect;

function decadeOf(year?: number) {
  return year ? `${Math.floor(year / 10) * 10}s` : 'Unknown';
}

export const songCatalog = {
  async search(q: string, opts: { kjId?: string; limit?: number } = {}) {
    const term = `%${q.trim()}%`;
    const match = q.trim() ? or(like(S.title, term), like(S.artist, term)) : undefined;
    const base = opts.kjId
      ? db.select({ song: S }).from(S).innerJoin(SB, and(eq(SB.songId, S.id), eq(SB.kjId, opts.kjId))).where(match)
      : db.select({ song: S }).from(S).where(match);
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
  async forUser(userId: string) {
    const rows = await db
      .select({ song: S, isGoTo: L.isGoTo, addedAt: L.addedAt })
      .from(L)
      .innerJoin(S, eq(S.id, L.songId))
      .where(eq(L.userId, userId))
      .orderBy(desc(L.isGoTo), asc(S.artist));
    return rows.map((r) => ({ ...r.song, isGoTo: r.isGoTo, addedAt: r.addedAt }));
  },

  async add(userId: string, songId: string) {
    await db.insert(L).values({ userId, songId, addedAt: clock.now() }).onConflictDoNothing();
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
      if (ids.size) list = list.filter((s) => ids.has(s.id));
    }
    if (!list.length) {
      const [any] = await db.select().from(S).orderBy(sql`random()`).limit(1);
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
      .where(mineIds.length ? sql`${L.songId} not in ${mineIds}` : undefined)
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
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    let added = 0;
    let skipped = 0;
    const before = (await songbooks.stats(kjId)).total;
    for (const line of lines) {
      const parts = line.split(/\t|,|\s+-\s+/).map((p) => p.trim().replace(/^"|"$/g, ''));
      if (parts.length < 2 || /^title$/i.test(parts[0])) {
        skipped++;
        continue;
      }
      const song = await songCatalog.upsert(parts[0], parts[1], parts[2] || 'Other', Number(parts[3]) || undefined);
      await songbooks.add(kjId, song.id);
    }
    added = (await songbooks.stats(kjId)).total - before;
    return { added, skipped, lines: lines.length };
  },
};

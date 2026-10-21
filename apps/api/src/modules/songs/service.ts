import { and, asc, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { db, rowsOf, schema } from '../../db/client.ts';
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

/** Serializes creating catalog songs, so concurrent adds and imports can't duplicate one. */
const catalogLock = sql`select pg_advisory_xact_lock(hashtext('songs:catalog'))`;
/** Songs matched and inserted per statement during a songbook import. */
const IMPORT_BATCH = 500;

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
    // The md5 terms let Postgres use songs_title_artist_md5_idx; the lower() terms decide.
    const match = and(
      sql`md5(lower(${S.title})) = md5(lower(${title}))`,
      sql`md5(lower(${S.artist})) = md5(lower(${artist}))`,
      sql`lower(${S.title}) = lower(${title})`,
      sql`lower(${S.artist}) = lower(${artist})`,
    );
    const existing = await db.query.songs.findFirst({ where: match });
    if (existing) return existing;
    return db.transaction(async (tx) => {
      await tx.execute(catalogLock);
      const raced = await tx.query.songs.findFirst({ where: match });
      if (raced) return raced;
      const song = { id: newId('sng'), title, artist, genre, decade: decadeOf(year) };
      await tx.insert(S).values(song);
      return song;
    });
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

  /** For lists of singers (the KJ booth): each one's list size and first few go-to songs. */
  async goToSummaries(userIds: string[], perUser = 3) {
    const ids = [...new Set(userIds)];
    if (!ids.length) return new Map<string, { listSize: number; goTo: Song[] }>();
    const [sizes, goTos] = await Promise.all([
      db.select({ userId: L.userId, n: sql<number>`count(*)` }).from(L).where(inArray(L.userId, ids)).groupBy(L.userId),
      db.select({ userId: L.userId, song: S }).from(L).innerJoin(S, eq(S.id, L.songId)).where(and(inArray(L.userId, ids), eq(L.isGoTo, true))).orderBy(asc(S.artist)),
    ]);
    return new Map(
      ids.map((id) => [
        id,
        { listSize: Number(sizes.find((r) => r.userId === id)?.n ?? 0), goTo: goTos.filter((r) => r.userId === id).slice(0, perUser).map((r) => r.song) },
      ]),
    );
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
    // Songbooks run to tens of thousands of songs: match and insert in batches rather than one
    // round trip per song. The catalog lock keeps concurrent imports from duplicating a new song.
    const added = await db.transaction(async (tx) => {
      await tx.execute(catalogLock);
      /** Postgres-normalized title + artist → the catalog song used for it in this import. */
      const chosen = new Map<string, string>();
      let added = 0;
      for (let i = 0; i < songs.length; i += IMPORT_BATCH) {
        const batch = songs.slice(i, i + IMPORT_BATCH);
        // Postgres lower(), not JavaScript's, decides what "the same song" is (they differ for some
        // Unicode). With case-variant duplicates in the catalog, prefer one already in this KJ's
        // book, then the oldest id, so re-imports are stable.
        const input = sql.join(batch.map((b, j) => sql`(${j}::int, ${b.title}::text, ${b.artist}::text)`), sql`, `);
        const rows = rowsOf<{ i: number; title: string; artist: string; id: string | null }>(
          await tx.execute(sql`
            with input(i, title, artist) as (values ${input})
            select input.i, lower(input.title) as title, lower(input.artist) as artist, s.id,
              -- A per-row primary-key probe: as a join, stale stats mid-import made the planner
              -- compare every row against the KJ's whole book.
              exists (select 1 from ${SB} mine where mine.kj_id = ${kjId} and mine.song_id = s.id) as mine
            from input
            left join ${S} s on md5(lower(s.title)) = md5(lower(input.title)) and md5(lower(s.artist)) = md5(lower(input.artist))
              and lower(s.title) = lower(input.title) and lower(s.artist) = lower(input.artist)
            order by input.i, mine desc, s.id`),
        );
        const matches = rows.map((r) => ({ i: Number(r.i), key: JSON.stringify([r.title, r.artist]), id: r.id }));
        const fresh: Song[] = [];
        const seen = new Set<number>();
        for (const m of matches) {
          if (seen.has(m.i)) continue; // first (preferred) candidate only
          seen.add(m.i);
          if (chosen.has(m.key)) continue;
          if (m.id) chosen.set(m.key, m.id);
          else {
            // First spelling in the file wins for a song new to the catalog.
            const b = batch[m.i];
            fresh.push({ id: newId('sng'), title: b.title, artist: b.artist, genre: b.genre, decade: decadeOf(b.year) });
            chosen.set(m.key, fresh.at(-1)!.id);
          }
        }
        if (fresh.length) await tx.insert(S).values(fresh);
        const entries = [...new Set(matches.map((m) => chosen.get(m.key)!))].map((songId) => ({ kjId, songId }));
        added += (await tx.insert(SB).values(entries).onConflictDoNothing().returning({ songId: SB.songId })).length;
      }
      return added;
    });
    return { added, skipped, lines };
  },
};

import { and, asc, desc, eq, ilike, inArray, lte, or, sql } from 'drizzle-orm';
import { db, rowsOf, schema, type DB } from '../../db/client.ts';
import { clock } from '../../lib/clock.ts';
import { newId } from '../../lib/ids.ts';
import { parseSongbook } from './import.ts';

const { songs: S, songListEntries: L, songbookEntries: SB, catalogSyncs: CS } = schema;
export type Song = typeof S.$inferSelect;
type Tx = Parameters<Parameters<DB['transaction']>[0]>[0];

/**
 * The public catalog: the base catalog (popular karaoke songs, see `baseCatalog`) plus whatever
 * KJs have imported. A song a singer free-adds exists only on their own list until then.
 */
const inCatalog = sql`(${S.baseRank} is not null or exists (select 1 from ${SB} where ${SB.songId} = ${S.id}))`;
/** Most popular first; songs outside the base catalog follow alphabetically. */
const byPopularity = [sql`${S.baseRank} asc nulls last`, asc(S.artist), asc(S.title)];
/** Bump when parsing or matching changes, so the next release resyncs an unchanged file. */
const BASE_SYNC_VERSION = 2;
/** Roulette with nothing on your list picks among songs nearly everyone knows. */
const WELL_KNOWN = 1000;

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
    const rows = await base.orderBy(...byPopularity).limit(opts.limit ?? 50);
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
      const song = { id: newId('sng'), title, artist, genre, decade: decadeOf(year), baseRank: null };
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
      const [known] = await db.select().from(S).where(lte(S.baseRank, WELL_KNOWN)).orderBy(sql`random()`).limit(1);
      if (known) return known;
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
      const resolve = songResolver(tx, kjId);
      let added = 0;
      for (let i = 0; i < songs.length; i += IMPORT_BATCH) {
        const ids = await resolve(songs.slice(i, i + IMPORT_BATCH));
        const entries = [...new Set(ids)].map((songId) => ({ kjId, songId }));
        added += (await tx.insert(SB).values(entries).onConflictDoNothing().returning({ songId: SB.songId })).length;
      }
      return added;
    });
    return { added, skipped, lines };
  },
};

type ParsedSong = ReturnType<typeof parseSongbook>['songs'][number];

/**
 * Matches parsed songs to catalog songs case-insensitively by title + artist, creating the
 * missing ones. Returns each input song's id. Call inside a transaction holding `catalogLock`;
 * reuse one resolver across a file's batches so its duplicates resolve to one song.
 */
function songResolver(tx: Tx, preferKj?: string) {
  /** Postgres-normalized title + artist → the catalog song used for it in this file. */
  const chosen = new Map<string, string>();
  return async (batch: ParsedSong[]) => {
    // Postgres lower(), not JavaScript's, decides what "the same song" is (they differ for some
    // Unicode). With case-variant duplicates in the catalog, prefer one already in this KJ's
    // book, then the base catalog's, then one in any songbook (the copies singers can pick from
    // search, so they find it in that KJ's book), then the oldest id, so re-imports are stable.
    const input = sql.join(batch.map((b, j) => sql`(${j}::int, ${b.title}::text, ${b.artist}::text)`), sql`, `);
    // A per-row primary-key probe: as a join, stale stats mid-import made the planner compare
    // every row against the KJ's whole book.
    const mine = preferKj
      ? sql`exists (select 1 from ${SB} mine where mine.kj_id = ${preferKj} and mine.song_id = s.id)`
      : sql`false`;
    const shared = sql`exists (select 1 from ${SB} book where book.song_id = s.id)`;
    const rows = rowsOf<{ i: number; title: string; artist: string; id: string | null }>(
      await tx.execute(sql`
        with input(i, title, artist) as (values ${input})
        select input.i, lower(input.title) as title, lower(input.artist) as artist, s.id, ${mine} as mine, ${shared} as shared
        from input
        left join ${S} s on md5(lower(s.title)) = md5(lower(input.title)) and md5(lower(s.artist)) = md5(lower(input.artist))
          and lower(s.title) = lower(input.title) and lower(s.artist) = lower(input.artist)
        order by input.i, mine desc, s.base_rank is not null desc, shared desc, s.id`),
    );
    const ids: string[] = [];
    const fresh: Song[] = [];
    for (const r of rows) {
      const i = Number(r.i);
      if (ids[i]) continue; // first (preferred) candidate only
      const key = JSON.stringify([r.title, r.artist]);
      if (!chosen.has(key)) {
        if (r.id) chosen.set(key, r.id);
        else {
          // First spelling in the file wins for a song new to the catalog.
          const b = batch[i];
          fresh.push({ id: newId('sng'), title: b.title, artist: b.artist, genre: b.genre, decade: decadeOf(b.year), baseRank: null });
          chosen.set(key, fresh.at(-1)!.id);
        }
      }
      ids[i] = chosen.get(key)!;
    }
    if (fresh.length) await tx.insert(S).values(fresh);
    return ids;
  };
}

/**
 * The base catalog: popular karaoke songs (apps/api/catalog/base-songs.csv, most popular first)
 * that make the app useful before any KJ imports a songbook. scripts/sync-base-songs.ts loads it
 * on every release; KJ imports and singer adds match these songs instead of duplicating them.
 */
export const baseCatalog = {
  /**
   * Make the catalog's base songs exactly the file's: rank its songs, unrank songs no longer in it
   * (they stay for lists and songbooks that use them). Atomic, and skipped if the file is unchanged.
   */
  async sync(text: string, opts: { force?: boolean } = {}) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${BASE_SYNC_VERSION}\n${text}`));
    const sha256 = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
    const { songs, skipped } = parseSongbook(text);
    if (!songs.length) throw new Error('The base catalog has no songs');
    return db.transaction(async (tx) => {
      await tx.execute(catalogLock);
      const [last] = await tx.select().from(CS).where(eq(CS.name, 'base'));
      if (last?.sha256 === sha256 && !opts.force) return { changed: false, songs: last.songs, skipped };
      // Match every song before clearing ranks: the resolver prefers the currently ranked copy, so a
      // resync keeps the base song singers saved rather than switching to an equivalent duplicate.
      const resolve = songResolver(tx);
      const ids: string[] = [];
      for (let i = 0; i < songs.length; i += IMPORT_BATCH) ids.push(...(await resolve(songs.slice(i, i + IMPORT_BATCH))));
      await tx.update(S).set({ baseRank: null }).where(sql`${S.baseRank} is not null`);
      const ranked = new Set<string>();
      for (let i = 0; i < songs.length; i += IMPORT_BATCH) {
        // A duplicate line keeps its first (best) rank. Songs whose genre or decade nobody knew
        // take the base catalog's.
        const values = songs.slice(i, i + IMPORT_BATCH).flatMap((b, j) => {
          const id = ids[i + j];
          if (ranked.has(id)) return [];
          ranked.add(id);
          return [sql`(${id}::text, ${i + j + 1}::int, ${b.genre}::text, ${decadeOf(b.year)}::text)`];
        });
        if (!values.length) continue;
        await tx.execute(sql`
          update ${S} set base_rank = v.rank,
            genre = case when ${S.genre} = 'Other' then v.genre else ${S.genre} end,
            decade = case when ${S.decade} = 'Unknown' then v.decade else ${S.decade} end
          from (values ${sql.join(values, sql`, `)}) v(id, rank, genre, decade)
          where ${S.id} = v.id`);
      }
      const row = { name: 'base', sha256, songs: ranked.size, syncedAt: clock.now() };
      await tx.insert(CS).values(row).onConflictDoUpdate({ target: CS.name, set: row });
      return { changed: true, songs: ranked.size, skipped };
    });
  },
};

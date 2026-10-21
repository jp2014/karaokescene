// Run from apps/api: node --import tsx scripts/check-data-paths.ts
// Each persistence check uses an isolated in-memory database, never a developer stack.
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { eq } from 'drizzle-orm';
import { schema, setDb, type DB } from '../src/db/client.ts';
import { localTimeToMs, SCENE_TZ } from '../src/lib/clock.ts';
import { parseSongbook } from '../src/modules/songs/import.ts';
import { songbooks, songCatalog, songLists } from '../src/modules/songs/service.ts';
import { venues } from '../src/modules/venues/service.ts';
import { DEFAULT_PRIVACY } from '../src/modules/profiles/privacy.ts';

assert.equal(SCENE_TZ, 'America/Chicago', 'These DST fixtures use the default scene timezone');
const at = (from: string, days: number, minutes: number) => new Date(localTimeToMs(Date.parse(from), days, minutes)).toISOString();
assert.equal(at('2026-10-31T17:00:42Z', 1, 720), '2026-11-01T18:00:00.000Z');
assert.equal(at('2026-03-07T18:00:00Z', 1, 720), '2026-03-08T17:00:00.000Z');
assert.equal(at('2026-10-31T17:00:00Z', 1, 90), '2026-11-01T06:30:00.000Z'); // first 01:30
assert.equal(at('2026-03-07T18:00:00Z', 1, 150), '2026-03-08T08:30:00.000Z'); // gap -> 03:30
assert.equal(at('2026-10-31T17:00:00Z', 0, 1440 + 180), '2026-11-01T09:00:00.000Z');
console.log('✓ wall-clock schedules preserve local times across DST, folds, gaps and overnight times');

const parsed = parseSongbook('\uFEFFTitle,Artist,Genre,Year\r\n"Hello, Goodbye","The Beatles",Rock,1967\r\n"A ""quoted""\nSong",Singer,,\r\nMissing artist,,,');
assert.deepEqual(parsed, { songs: [
  { title: 'Hello, Goodbye', artist: 'The Beatles', genre: 'Rock', year: 1967 },
  { title: 'A "quoted"\nSong', artist: 'Singer', genre: 'Other', year: undefined },
], skipped: 2, lines: 4 });
assert.equal(parseSongbook('Title\tArtist\nA Song\tArtist, Jr.').songs[0].artist, 'Artist, Jr.');
assert.equal(parseSongbook('"A\tSong",Artist').songs[0].title, 'A\tSong');
assert.equal(parseSongbook('A Song - Artist').songs[0].title, 'A Song');

const pg = new PGlite();
const db = drizzle(pg, { schema });
setDb(db as unknown as DB);
try {
  await migrate(db, { migrationsFolder: resolve(import.meta.dirname, '../../../supabase/migrations') });
  for (const [id, role] of [['kj', 'kj'], ['other-kj', 'kj'], ['empty-kj', 'kj'], ['singer', 'singer']] as const) {
    await db.insert(schema.users).values({ id, handle: id, displayName: id, role, privacy: DEFAULT_PRIVACY, createdAt: Date.now() });
  }
  const kj = (await db.query.users.findFirst({ where: eq(schema.users.id, 'kj') }))!;
  await songbooks.importText(kj.id, '"Hello, Goodbye","The Beatles"');
  assert.equal((await songCatalog.search('', { kjId: kj.id }))[0].title, 'Hello, Goodbye');
  await assert.rejects(songbooks.importText(kj.id, 'Would otherwise import,Artist\n"Unclosed,Artist'), /Invalid songbook CSV/);
  assert.equal((await songbooks.stats(kj.id)).total, 1);
  assert.equal((await db.select().from(schema.songs)).length, 1, 'Malformed files must not partly import');
  console.log('✓ CSV/TSV quotes, commas, newlines and malformed-file rejection preserve song data');

  const privateSong = await songLists.addCustom('singer', 'Private song', 'Private artist');
  const available = (await songCatalog.search('', { kjId: kj.id }))[0];
  assert.equal((await songLists.roulette('singer', kj.id))?.id, available.id, 'Fall back to the selected book');
  assert.equal(await songLists.roulette('singer', 'empty-kj'), null, 'An empty selected book cannot play other songs');
  assert.equal((await songLists.roulette('singer'))?.id, privateSong.id, 'Without a KJ the personal list remains available');
  await songLists.add('singer', available.id);
  assert.equal((await songLists.roulette('singer', kj.id))?.id, available.id);
  await songLists.remove('singer', privateSong.id);
  await songLists.remove('singer', available.id);
  assert.equal((await songLists.roulette('singer', kj.id))?.id, available.id, 'Empty personal list uses selected book');
  console.log('✓ Roulette always chooses a playable song when a KJ is selected');

  const venue = await venues.createByKj(kj, { name: 'Unlink regression', address: '1 Main', neighborhood: '', city: 'Omaha', lat: 41.25, lng: -95.93, venueTypes: [], nights: [{ dayOfWeek: 2, startMin: 1200, endMin: 1440 }] });
  const night = (await venues.nightsFor(venue.id))[0];
  await venues.linkKj('other-kj', venue.id, true);
  await db.insert(schema.karaokeNights).values({ id: 'other-night', kjId: 'other-kj', venueId: venue.id, dayOfWeek: 3, startMin: 1200, endMin: 1440 });
  for (const [id, sourceKey] of [['automatic', `night:${night.id}`], ['manual', null]] as const) {
    await db.insert(schema.promoPosts).values({ id, authorId: kj.id, venueId: venue.id, sourceKey, body: id, networks: ['share'], status: 'scheduled', scheduledFor: Date.now() + 1000, createdAt: Date.now() });
  }
  await venues.linkKj(kj.id, venue.id, false);
  assert.deepEqual((await venues.nightsFor(venue.id)).map((row) => row.id), ['other-night']);
  assert.deepEqual((await db.select().from(schema.kjVenueLinks)).map((row) => row.kjId), ['other-kj']);
  assert.deepEqual((await db.select().from(schema.promoPosts)).map((row) => row.id), ['manual']);
  console.log('✓ unlink removes only that KJ’s nights and automatic reminders, preserving other hosts and manual posts');
} finally {
  await pg.close();
}

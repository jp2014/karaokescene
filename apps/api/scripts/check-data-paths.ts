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
import { baseCatalog, songbooks, songCatalog, songLists } from '../src/modules/songs/service.ts';
import { venues } from '../src/modules/venues/service.ts';
import { notifications } from '../src/modules/notifications/service.ts';
import { BADGES } from '../src/modules/reputation/badges.ts';
import { reputation } from '../src/modules/reputation/service.ts';
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
assert.deepEqual(parseSongbook('Title,Artist\nTitle,Meghan Trainor,Pop,2014').songs.map((s) => s.artist), ['Meghan Trainor'], 'Only a leading Title,Artist row is a header');
assert.equal(parseSongbook('Title,Meghan Trainor').songs.length, 1);
for (const header of ['Title,Artist Name', 'Song Title,Artist', 'TITLE,ARTIST', 'Song,Artist', 'Name,Performer', 'Title,Artist/Band', 'song_title\tartist_name', 'Title,Artists']) {
  const row = header.includes('\t') ? 'Creep\tRadiohead' : 'Creep,Radiohead';
  assert.deepEqual(parseSongbook(`${header}\n${row}`).songs.map((s) => s.title), ['Creep'], `"${header}" is a header`);
}

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

  // Real songbooks are tens of thousands of lines: imported in batches, matched case-insensitively.
  const big = Array.from({ length: 2400 }, (_, i) => `Song ${i},Artist ${i % 300}`);
  const bigText = ['"HELLO, GOODBYE","the beatles"', ...big, 'song 7,ARTIST 7', 'Song 8,Artist 8'].join('\n');
  const imported = await songbooks.importText('other-kj', bigText);
  assert.equal(imported.added, 2401, 'Duplicate lines and case variants are one song each');
  assert.equal((await db.select().from(schema.songs)).length, 2401, 'Existing catalog songs are reused, not duplicated');
  assert.equal((await songbooks.importText('other-kj', bigText)).added, 0, 'Re-importing adds nothing');
  assert.deepEqual((await db.select().from(schema.songs).where(eq(schema.songs.title, 'Song 7'))).map((s) => s.artist), ['Artist 7'], 'First spelling wins');
  const [a, b] = await Promise.all([songCatalog.upsert('Race Song', 'Racer'), songCatalog.upsert('race song', 'RACER')]);
  assert.equal(a.id, b.id, 'Concurrent adds of a new song share one catalog row');
  assert.equal((await songbooks.importText('other-kj', `${'x'.repeat(201)},Artist`)).skipped, 1, 'Oversized fields are skipped, not stored');
  // Legacy oversized rows must not break the songs index or later lookups.
  await db.insert(schema.songs).values({ id: 'sng_huge', title: Array.from({ length: 6000 }, (_, i) => String.fromCharCode(33 + ((i * 7919) % 90))).join(''), artist: 'Legacy', genre: 'Other', decade: 'Unknown' });
  assert.equal((await songCatalog.upsert('Legacy song', 'Legacy')).title, 'Legacy song');
  // Postgres decides sameness: JavaScript lowercases some Unicode differently (İ).
  assert.equal((await songbooks.importText('other-kj', 'İstanbul,Artist')).added, 1);
  assert.equal((await songbooks.importText('other-kj', 'İstanbul,Artist')).added, 0, 'Unicode titles re-import without duplicates');
  assert.equal((await db.select().from(schema.songs).where(eq(schema.songs.artist, 'Artist'))).length, 1);
  // Case-variant duplicates already in the catalog: a re-import keeps the KJ's existing song.
  await db.insert(schema.songs).values([{ id: 'sng_hello_a', title: 'Hello', artist: 'Adele', genre: 'Pop', decade: '2010s' }, { id: 'sng_hello_b', title: 'HELLO', artist: 'ADELE', genre: 'Pop', decade: '2010s' }]);
  await songbooks.add('other-kj', 'sng_hello_b');
  assert.equal((await songbooks.importText('other-kj', 'Hello,Adele\nhello,adele')).added, 0, 'An equivalent song already in the book counts');
  assert.deepEqual((await db.select().from(schema.songbookEntries).where(eq(schema.songbookEntries.songId, 'sng_hello_a'))).length, 0);
  console.log('✓ large songbook imports batch, dedupe like Postgres does and stay idempotent');

  await db.insert(schema.badgeAwards).values([
    { id: 'b1', badgeKey: BADGES[0].key, recipientId: 'kj', giverId: 'singer', createdAt: 1 },
    { id: 'b2', badgeKey: BADGES[0].key, recipientId: 'kj', giverId: 'other-kj', createdAt: 2 },
    { id: 'b3', badgeKey: 'retired-badge', recipientId: 'kj', giverId: 'singer', createdAt: 3 },
  ]);
  const sums = await reputation.summaries(['kj', 'singer', 'kj']);
  assert.deepEqual(sums.get('kj')!.map((x) => [x.key, x.count]), [[BADGES[0].key, 2]]);
  assert.deepEqual(sums.get('singer'), []);
  assert.deepEqual(await reputation.summary('kj'), sums.get('kj'));
  await songLists.add('singer', a.id);
  await songLists.setGoTo('singer', a.id, true);
  const lists = await songLists.goToSummaries(['singer', 'empty-kj']);
  assert.deepEqual([lists.get('singer')!.listSize, lists.get('singer')!.goTo.map((x) => x.id), lists.get('empty-kj')!.listSize], [1, [a.id], 0]);
  await songLists.remove('singer', a.id);
  const fanout = [{ userId: 'singer', kind: 'promo' as const, title: 'x', dedupeId: 'ntf_dedupe' }, { userId: 'kj', kind: 'promo' as const, title: 'y' }];
  assert.equal(await notifications.sendMany(fanout), 2);
  assert.equal(await notifications.sendMany(fanout), 1, 'A repeated dedupe id is not delivered twice');
  assert.equal(await notifications.send('singer', { kind: 'promo', title: 'x' }, 'ntf_dedupe'), false);
  assert.equal(await notifications.sendMany([{ userId: 'kj', kind: 'promo', title: 'first', dedupeId: 'ntf_twice' }, { userId: 'kj', kind: 'promo', title: 'second', dedupeId: 'ntf_twice' }]), 1, 'A dedupe id repeated in one call is one delivery');
  assert.equal((await db.select().from(schema.notifications).where(eq(schema.notifications.id, 'ntf_twice')))[0].title, 'first');
  console.log('✓ batched badge, song list and notification fan-out match the single-user paths');

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

  const songCount = async () => (await db.select().from(schema.songs)).length;
  const rankOf = async (id: string) => (await db.query.songs.findFirst({ where: eq(schema.songs.id, id) }))!.baseRank;
  const baseText = 'Title,Artist,Genre,Year\nHello,Adele,Pop,2015\nBrand New,Base Artist,Rock,1999\nbrand new,BASE ARTIST,,\nRace Song,Racer,Pop,2001\nShared,Dup,,\n';
  await db.insert(schema.songs).values([{ id: 'sng_base_a', title: 'Shared', artist: 'Dup', genre: 'Pop', decade: '2010s' }, { id: 'sng_base_b', title: 'SHARED', artist: 'DUP', genre: 'Pop', decade: '2010s' }]);
  await songbooks.add('kj', 'sng_base_b');
  const before = await songCount();
  assert.deepEqual(await baseCatalog.sync(baseText), { changed: true, songs: 4, skipped: 1 });
  assert.equal(await songCount(), before + 1, 'Base songs reuse catalog songs (any case); only new ones are created');
  assert.equal((await songCatalog.search(''))[0].id, 'sng_hello_b', 'The catalog lists the most popular base songs first, as the copy a KJ has');
  const brandNew = (await songCatalog.search('brand new'))[0];
  assert.deepEqual([brandNew?.title, brandNew?.baseRank], ['Brand New', 2], 'Base songs are public without a songbook; a duplicate keeps its first rank');
  assert.deepEqual([a.genre, (await db.query.songs.findFirst({ where: eq(schema.songs.id, a.id) }))!.genre], ['Other', 'Pop'], 'Unknown genres take the base catalog’s');
  assert.deepEqual([await rankOf('sng_base_a'), await rankOf('sng_base_b')], [null, 5], 'Of equivalent songs, the one a KJ has is ranked');
  assert.equal((await songCatalog.search('', { kjId: 'empty-kj' })).length, 0, 'A KJ’s book still holds only its own songs');
  assert.ok((await songLists.roulette('singer'))!.baseRank, 'Roulette with an empty list picks a well-known song');
  assert.equal((await baseCatalog.sync(baseText)).changed, false, 'An unchanged file is skipped');
  assert.equal((await songbooks.importText('empty-kj', 'BRAND NEW,base artist')).added, 1);
  assert.equal((await songbooks.stats('empty-kj')).total, 1);
  assert.equal((await songCatalog.search('', { kjId: 'empty-kj' }))[0].id, brandNew.id, 'KJ imports reuse base songs');
  // Sol's lifecycle: once ranked, a duplicate stays the base song after its KJ drops it.
  await songLists.add('singer', 'sng_base_b');
  await songbooks.remove('kj', 'sng_base_b');
  await songbooks.add('other-kj', 'sng_base_a'); // a competing public duplicate
  await baseCatalog.sync(`${baseText}Unrelated,Newcomer\n`);
  assert.deepEqual([await rankOf('sng_base_a'), await rankOf('sng_base_b')], [null, 5], 'A resync keeps the ranked duplicate');
  await songbooks.importText('kj', 'shared,dup');
  assert.equal((await songLists.forUser('singer', 'kj')).find((s) => s.id === 'sng_base_b')?.inKjBook, true, 'KJ imports then reuse the singer’s copy');
  await songLists.remove('singer', 'sng_base_b');
  await baseCatalog.sync('Hello,Adele');
  assert.deepEqual([await rankOf('sng_hello_b'), await rankOf(brandNew.id), await rankOf(a.id)], [1, null, null], 'Songs dropped from the file lose their rank');
  assert.equal((await songCatalog.search('race song')).length, 0, 'A dropped song without a songbook leaves the catalog');
  assert.equal((await songCatalog.search('brand new')).length, 1, 'A dropped song a KJ has stays public');
  await assert.rejects(baseCatalog.sync('Title,Artist\n'), /no songs/);
  console.log('✓ the base catalog ranks, reuses and retires songs idempotently alongside KJ songbooks');

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

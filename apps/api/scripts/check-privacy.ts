// Isolated regressions for public identity, location disclosure and promotion deduplication.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { eq } from 'drizzle-orm';
import { schema, setDb, type DB } from '../src/db/client.ts';
import { clock } from '../src/lib/clock.ts';
import { isStoredMediaUrl } from '../src/lib/storage.ts';
import { profiles } from '../src/modules/profiles/service.ts';
import { presence } from '../src/modules/presence/service.ts';
import { venues } from '../src/modules/venues/service.ts';
import { returnPath } from '../../web/src/lib/return-path.ts';

for (const bad of ['https://evil.test', '//evil.test', '/\\evil.test', '/\t/evil.test', 'javascript:alert(1)']) assert.equal(returnPath(bad), undefined);
assert.equal(returnPath('/venues/lounge?tab=nights#show'), '/venues/lounge?tab=nights#show');
assert.equal(returnPath('/a/..//evil.test'), undefined);
const originalUrl = process.env.SUPABASE_URL;
process.env.SUPABASE_URL = 'https://project.example';
assert.equal(isStoredMediaUrl('/api/media/anything'), false);
assert.equal(isStoredMediaUrl('https://project.example/storage/v1/object/public/media/uploads/a.jpg'), true);
assert.equal(isStoredMediaUrl('https://project.example/storage/v1/object/public/media/../elsewhere'), false);
if (originalUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = originalUrl;

const pg = new PGlite();
const db = drizzle(pg, { schema });
setDb(db as unknown as DB);
try {
  await migrate(db, { migrationsFolder: resolve(import.meta.dirname, '../../../supabase/migrations') });
  const onboard = (role: 'singer' | 'kj', name?: string) => profiles.onboard({ authId: randomUUID(), email: 'private.email.1987@example.com', name: null }, { role, displayName: name });
  const singer = await onboard('singer');
  assert.equal(singer.displayName, 'New Singer');
  assert.equal(singer.handle.includes('private'), false);
  const named = await onboard('singer', 'Stage Name');
  assert.equal(named.displayName, 'Stage Name');
  const kj = await onboard('kj', 'Host');
  const fixture = async (lat: number, lng: number) => db.update(schema.users).set({ lat, lng }).where(eq(schema.users.id, singer.id));
  const queries = [
    { lat: 41.25, lng: -95.93 }, { lat: 41.3, lng: -96 }, { lat: 41.2, lng: -95.8 },
  ];
  await fixture(41.251, -95.949);
  const before = await Promise.all(queries.map((center) => presence.singersNear(kj, center, 25)));
  // Moving raw GPS throughout the same fixed cell must leave ALL observable data unchanged,
  // including membership at radii just below and above the reported distance.
  await fixture(41.299, -95.901);
  const after = await Promise.all(queries.map((center) => presence.singersNear(kj, center, 25)));
  assert.deepEqual(after, before);
  for (let i = 0; i < queries.length; i++) {
    const distance = before[i][0].distanceMi;
    assert.equal(Number.isInteger(distance), true);
    assert.equal((await presence.singersNear(kj, queries[i], distance - 0.001)).length, 0);
    assert.equal((await presence.singersNear(kj, queries[i], distance)).length, 1);
  }
  await db.update(schema.users).set({ ghostMode: true }).where(eq(schema.users.id, singer.id));
  assert.deepEqual(await presence.singersNear(kj, queries[0], 25), []);
  await db.update(schema.users).set({ ghostMode: false }).where(eq(schema.users.id, singer.id));
  await db.insert(schema.blocks).values({ userId: singer.id, blockedId: kj.id, createdAt: clock.now() });
  assert.deepEqual(await presence.singersNear(kj, queries[0], 25), []);
  await db.delete(schema.blocks);
  const venue = await venues.createByKj(kj, { name: 'Show', address: '1 Main', city: 'Omaha', neighborhood: '', lat: 41.27, lng: -95.92, venueTypes: [], nights: [] });
  const show = { venueId: venue.id, venueName: venue.name, venueSlug: venue.slug, when: 'tonight' };
  const far = { lat: 0, lng: 0 };
  const first = await presence.promoteTonight(kj, far, 10, show);
  assert.equal(first.sent, 1, 'Uses show coordinates, not the client center');
  const renamed = { ...kj, displayName: 'Renamed Host' };
  const repeat = await Promise.all(Array.from({ length: 3 }, () => presence.promoteTonight(renamed, far, 10, show)));
  assert.equal(repeat.reduce((n, result) => n + result.sent, 0), 0);
  assert.equal((await db.select().from(schema.notifications).where(eq(schema.notifications.kind, 'promo'))).length, 1);
  console.log('✓ names stay private, nearby searches expose only fixed areas, ghosts/blocks hold, promotion dedupe survives renames and concurrency');
} finally { await pg.close(); }

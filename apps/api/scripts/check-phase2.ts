// Focused regression checks: real persistence methods against a fresh embedded Postgres.
// Run from apps/api: node --import tsx scripts/check-phase2.ts
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { eq, sql } from 'drizzle-orm';
import { schema, setDb, type DB } from '../src/db/client.ts';
import { clock, localParts } from '../src/lib/clock.ts';
import { DEFAULT_PRIVACY } from '../src/modules/profiles/privacy.ts';
import { venues } from '../src/modules/venues/service.ts';
import { promo } from '../src/modules/promo/service.ts';

const pg = new PGlite();
const db = drizzle(pg, { schema });
setDb(db as unknown as DB);
await migrate(db, { migrationsFolder: resolve(import.meta.dirname, '../../../supabase/migrations') });
const user = async (id: string, role: 'venue' | 'kj' | 'singer') => (await db.insert(schema.users).values({
  id, role, handle: id, authId: randomUUID(), displayName: id, privacy: DEFAULT_PRIVACY, createdAt: clock.now(), isPremium: role === 'kj',
}).returning())[0];
const place = { name: 'Regression Lounge', address: '1 Main', neighborhood: '', city: 'Omaha', lat: 41.25, lng: -95.93, venueTypes: [] };

const testOffset = Date.parse('2026-10-20T17:00:00Z') - Date.now();
clock.setOffset(testOffset);
try {
  const kj = await user('kj', 'kj');
  const owner = await user('owner', 'venue');
  const fan = await user('fan', 'singer');
  const listed = await venues.createByKj(kj, { ...place, nights: [{ dayOfWeek: localParts(clock.now()).dayOfWeek, startMin: 1439, endMin: 1500 }] });
  for (const targetId of [owner.id, listed.ownerId]) {
    await db.insert(schema.favorites).values({ userId: fan.id, targetType: 'user', targetId, createdAt: clock.now() });
    await db.insert(schema.blocks).values({ userId: fan.id, blockedId: targetId, createdAt: clock.now() });
    await db.insert(schema.friendships).values({ requesterId: fan.id, addresseeId: targetId, status: 'accepted', createdAt: clock.now() });
  }
  const claimed = await venues.claim(owner, listed.id);
  assert.equal(claimed.authId, owner.authId);
  for (const table of [schema.favorites, schema.blocks, schema.friendships]) assert.equal((await db.select().from(table)).length, 1);
  console.log('✓ overlapping favorites, blocks and friendships survive a venue claim');

  const newOwner = await user('new-owner', 'venue');
  const setup = await Promise.allSettled([
    venues.createByOwner(newOwner, { ...place, name: 'One' }),
    venues.createByOwner(newOwner, { ...place, name: 'Two' }),
  ]);
  assert.equal(setup.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal((await db.select().from(schema.venues).where(eq(schema.venues.ownerId, newOwner.id))).length, 1);
  console.log('✓ concurrent owner setup creates exactly one venue');

  await venues.setAutoPromote(kj, listed.id, true);
  const first = await promo.autoPromoteNext(kj, listed.id);
  clock.setOffset(testOffset + 120000);
  const later = await promo.autoPromoteNext(kj, listed.id);
  assert.equal(first?.id, later?.id);
  const concurrent = await Promise.all(Array.from({ length: 4 }, () => promo.autoPromoteNext(kj, listed.id)));
  assert.ok(concurrent.every((p) => p?.id === first?.id));
  console.log('✓ same show has one reminder across time and simultaneous requests');

  // Claiming the due rows and inserting notifications must be atomic and repeatable.
  await db.execute(sql`select app.run_scheduled_jobs(${clock.now()})`);
  await db.execute(sql`select app.run_scheduled_jobs(${clock.now()})`);
  const notes = await db.select().from(schema.notifications).where(eq(schema.notifications.kind, 'promo-reminder'));
  assert.equal(notes.length, 1);
  assert.equal(notes[0].link, `/share/${first!.id}`);
  console.log('✓ running scheduled jobs twice delivers one share notification');
  const canceled = await venues.createByKj(kj, { ...place, name: 'Canceled', nights: [{ dayOfWeek: localParts(clock.now()).dayOfWeek, startMin: 1439, endMin: 1500 }] });
  await venues.setAutoPromote(kj, canceled.id, true);
  const pending = await promo.autoPromoteNext(kj, canceled.id);
  await venues.setAutoPromote(kj, canceled.id, false);
  // Also cover a late insert racing with cancellation: the job validates the source at delivery.
  await db.insert(schema.promoPosts).values(pending!);
  await db.execute(sql`select app.run_scheduled_jobs(${clock.now()})`);
  assert.equal((await db.select().from(schema.notifications).where(eq(schema.notifications.kind, 'promo-reminder'))).length, 1);
  const special = await venues.createSpecial(claimed, listed.id, { title: 'Expired offer', price: '$2', details: '', days: [2], autoPost: true });
  await promo.schedule(claimed, { sourceKey: `special:${special.id}`, venueId: listed.id, body: 'Expired offer', scheduledFor: clock.now() });
  await venues.deleteSpecial(claimed, special.id);
  await db.execute(sql`select app.run_scheduled_jobs(${clock.now()})`);
  assert.equal((await db.select().from(schema.notifications).where(eq(schema.notifications.kind, 'promo-reminder'))).length, 1);
  console.log('✓ disabled promotions and deleted specials do not send stale reminders');
} finally {
  clock.setOffset(0);
  await pg.close();
}

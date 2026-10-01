import { migrateDb } from './client.ts';
import { seed } from '../seed/seed.ts';

await migrateDb();
console.log(await seed());

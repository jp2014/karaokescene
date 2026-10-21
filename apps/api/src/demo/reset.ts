import { connectLocalDb, loadLocalEnv } from '../local/db.ts';
import { seed } from './seed.ts';

/** `pnpm db:reset`: wipe the local database and reseed the demo scene. */
loadLocalEnv();
await connectLocalDb();
console.log(await seed());
process.exit(0);

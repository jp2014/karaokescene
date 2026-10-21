import { eq } from 'drizzle-orm';
import { db, schema } from '../db/client.ts';
import { clock, localParts, localTimeToMs } from '../lib/clock.ts';

/** The demo clock's offset survives restarts in app_settings. */
const KEY = 'clockOffsetMs';

export const demoClock = {
  async load() {
    const row = await db.query.appSettings.findFirst({ where: eq(schema.appSettings.key, KEY) });
    clock.setOffset(typeof row?.value === 'number' ? row.value : 0);
  },

  async setOffset(ms: number) {
    clock.setOffset(ms);
    await db
      .insert(schema.appSettings)
      .values({ key: KEY, value: ms })
      .onConflictDoUpdate({ target: schema.appSettings.key, set: { value: ms } });
  },

  /** Jump to a weekday + time in scene time, or `null` for real time. */
  async jumpTo(target: { dayOfWeek: number; minutes: number } | null) {
    if (!target) return demoClock.setOffset(0);
    const real = Date.now();
    const { dayOfWeek } = localParts(real);
    const ms = localTimeToMs(real, (target.dayOfWeek - dayOfWeek + 7) % 7, target.minutes);
    await demoClock.setOffset(ms - real);
  },
};

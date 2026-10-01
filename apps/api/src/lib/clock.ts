import { eq } from 'drizzle-orm';
import { db, schema } from '../db/client.ts';

/**
 * The single source of "now" for the API. The demo can time-travel (e.g. to a
 * Friday at 9pm) so karaoke nights are live whenever you happen to demo.
 */
export const SCENE_TZ = process.env.SCENE_TZ ?? 'America/Chicago';
const KEY = 'clockOffsetMs';
let offsetMs = 0;

export const clock = {
  now: () => Date.now() + offsetMs,
  offset: () => offsetMs,
  async load() {
    const row = await db.query.appSettings.findFirst({ where: eq(schema.appSettings.key, KEY) });
    offsetMs = typeof row?.value === 'number' ? row.value : 0;
  },
  async setOffset(ms: number) {
    offsetMs = ms;
    await db
      .insert(schema.appSettings)
      .values({ key: KEY, value: ms })
      .onConflictDoUpdate({ target: schema.appSettings.key, set: { value: ms } });
  },
};

const fmt = new Intl.DateTimeFormat('en-US', {
  timeZone: SCENE_TZ,
  weekday: 'short',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Wall-clock parts in the scene's timezone. */
export function localParts(ms: number) {
  const p = Object.fromEntries(fmt.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return {
    dayOfWeek: WEEKDAYS.indexOf(p.weekday),
    minutes: Number(p.hour) * 60 + Number(p.minute),
    hour: Number(p.hour),
    date: `${p.year}-${p.month}-${p.day}`,
  };
}

/** Epoch ms for a local wall-clock time `minutes` after local midnight, `dayOffset` days from `fromMs`. */
export function localTimeToMs(fromMs: number, dayOffset: number, minutes: number) {
  const here = localParts(fromMs);
  const midnight = fromMs - (here.minutes * 60_000 + (fromMs % 60_000));
  return midnight + dayOffset * 86_400_000 + minutes * 60_000;
}

export function addDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

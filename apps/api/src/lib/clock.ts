/**
 * The single source of "now" for the API. In production the offset is always 0; local demos
 * time-travel (e.g. to a Friday at 9pm) so karaoke nights are live whenever you demo.
 */
export const SCENE_TZ = process.env.SCENE_TZ ?? 'America/Chicago';
let offsetMs = 0;

export const clock = {
  now: () => Date.now() + offsetMs,
  offset: () => offsetMs,
  setOffset(ms: number) {
    offsetMs = ms;
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

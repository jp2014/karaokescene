import { localParts, localTimeToMs } from '../../lib/clock.ts';

export type Night = { id: string; venueId: string; kjId: string | null; dayOfWeek: number; startMin: number; endMin: number };

/** The karaoke night in progress at `nowMs`, handling nights that run past midnight. */
export function liveNight<N extends Night>(nights: N[], nowMs: number): N | undefined {
  const { dayOfWeek, minutes } = localParts(nowMs);
  const yesterday = (dayOfWeek + 6) % 7;
  return nights.find(
    (n) =>
      (n.dayOfWeek === dayOfWeek && n.startMin <= minutes && minutes < n.endMin) ||
      (n.dayOfWeek === yesterday && n.endMin > 1440 && minutes < n.endMin - 1440),
  );
}

/** Next upcoming night (start time in ms) within the coming week. */
export function nextNight<N extends Night>(nights: N[], nowMs: number): { night: N; startsAt: number; endsAt: number } | undefined {
  const { dayOfWeek, minutes } = localParts(nowMs);
  let best: { night: N; startsAt: number; endsAt: number } | undefined;
  for (const n of nights) {
    let offset = (n.dayOfWeek - dayOfWeek + 7) % 7;
    if (offset === 0 && n.startMin <= minutes) offset = 7;
    const startsAt = localTimeToMs(nowMs, offset, n.startMin);
    if (!best || startsAt < best.startsAt) best = { night: n, startsAt, endsAt: localTimeToMs(nowMs, offset, n.endMin) };
  }
  return best;
}

export function tonight<N extends Night>(nights: N[], nowMs: number) {
  const { dayOfWeek } = localParts(nowMs);
  return nights.find((n) => n.dayOfWeek === dayOfWeek);
}

import { cx } from './ui';

export type BusyLevel = 'quiet' | 'warming-up' | 'busy' | 'packed';
const LEVELS: BusyLevel[] = ['quiet', 'warming-up', 'busy', 'packed'];
const LABEL: Record<BusyLevel, string> = { quiet: 'Quiet', 'warming-up': 'Warming up', busy: 'Busy', packed: 'Packed' };
const COLOR: Record<BusyLevel, string> = { quiet: 'bg-cyan', 'warming-up': 'bg-live', busy: 'bg-gold', packed: 'bg-pink' };

/** Busy status from checked-in head-count, always shown with a text label (never color alone). */
export function BusyMeter({ level, count, compact }: { level: BusyLevel; count: number; compact?: boolean }) {
  const n = LEVELS.indexOf(level) + 1;
  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted">
      <span className="flex items-end gap-[3px]" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={cx('w-[4px] rounded-full', i <= n ? COLOR[level] : 'bg-white/12')} style={{ height: 4 + i * 3 }} />
        ))}
      </span>
      <span>
        <span className="font-semibold text-fg">{LABEL[level]}</span>
        {!compact && <> · {count} here</>}
      </span>
    </span>
  );
}

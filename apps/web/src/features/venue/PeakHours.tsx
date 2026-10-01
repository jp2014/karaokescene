import { useState } from 'react';
import { hourLabel } from '~/lib/format';
import { cx } from '~/components/ui';

/**
 * Peak Hours: one series (average head-count by hour), so a single sequential hue,
 * thin rounded bars, a hover tooltip, and the current hour called out by label.
 */
export function PeakHours({ data, currentHour }: { data: { hour: number; avg: number }[]; currentHour?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.avg), 1);
  const peak = data.reduce((a, b) => (b.avg > a.avg ? b : a), data[0]);
  const H = 120;

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between gap-2 text-sm">
        <span className="text-muted">
          Usually busiest around <span className="font-semibold text-fg">{hourLabel(peak.hour)}m</span>
        </span>
        <span className="text-xs text-faint">avg. singers checked in · last 4 weeks</span>
      </div>
      <div className="relative" role="img" aria-label={`Peak hours chart. Busiest at ${hourLabel(peak.hour)}m with about ${peak.avg} singers.`}>
        <div className="flex items-end gap-1.5" style={{ height: H }}>
          {data.map((d, i) => {
            const h = Math.max((d.avg / max) * (H - 18), d.avg > 0 ? 4 : 2);
            const isNow = d.hour === currentHour;
            return (
              <div
                key={d.hour}
                className="relative flex h-full flex-1 items-end justify-center"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                {(hover === i || (isNow && hover === null)) && (
                  <div className="absolute -top-1 z-10 -translate-y-full rounded-lg border border-line bg-surface-3 px-2 py-1 text-[11px] whitespace-nowrap shadow-lg">
                    <span className="font-semibold">{hourLabel(d.hour)}</span> · {d.avg} {isNow && <span className="text-pink">· now</span>}
                  </div>
                )}
                <div
                  className={cx('w-full max-w-7 rounded-t-[4px] transition-all', isNow ? 'bg-pink' : hover === i ? 'bg-violet' : 'bg-violet/55')}
                  style={{ height: h }}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-1.5 flex gap-1.5 border-t border-line pt-1.5">
          {data.map((d) => (
            <div key={d.hour} className={cx('flex-1 text-center text-[10px]', d.hour === currentHour ? 'font-bold text-pink' : 'text-faint')}>
              {hourLabel(d.hour)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

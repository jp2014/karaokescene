import { Link } from '@tanstack/react-router';
import { Heart, Star } from 'lucide-react';
import { AvatarStack } from '~/components/Avatar';
import { BusyMeter } from '~/components/BusyMeter';
import { cx, LiveDot } from '~/components/ui';
import { VenueArt } from '~/components/VenueArt';
import { DAYS, hoursLabel, timeLabel } from '~/lib/format';
import type { VenueSummary } from '~/lib/queries';

export function StatusLine({ v }: { v: VenueSummary }) {
  if (v.kjNow)
    return (
      <span className="flex items-center gap-1.5 text-xs font-semibold text-live">
        <LiveDot /> KJ Now · {v.kjNow.kj.displayName}
      </span>
    );
  if (v.isLive) return <span className="text-xs font-semibold text-cyan">Karaoke on now · KJ not checked in yet</span>;
  if (v.tonight) return <span className="text-xs font-medium text-violet">Tonight {hoursLabel(v.tonight.startMin, v.tonight.endMin)}</span>;
  if (v.nextNight) return <span className="text-xs text-muted">Next karaoke: {DAYS[v.nextNight.dayOfWeek]} at {timeLabel(v.nextNight.startsAt)}</span>;
  return <span className="text-xs text-muted">No karaoke scheduled</span>;
}

export function VenueCard({ v, selected, onHover, compact }: { v: VenueSummary; selected?: boolean; onHover?: () => void; compact?: boolean }) {
  return (
    <Link
      to="/venues/$slug"
      params={{ slug: v.slug }}
      onMouseEnter={onHover}
      className={cx(
        'group flex gap-3 rounded-3xl border bg-surface/90 p-3 transition',
        selected ? 'border-pink/50 shadow-glow-pink' : 'border-line hover:border-line-strong hover:bg-surface-2/70',
        compact && 'w-[86vw] max-w-sm shrink-0 snap-center backdrop-blur-xl',
      )}
    >
      <div className="relative">
        <VenueArt name={v.name} hue={v.hue} className="size-20 rounded-2xl sm:size-24" />
        {v.isPremiere && (
          <span className="absolute -top-1.5 -left-1.5 grid size-6 place-items-center rounded-full bg-gold text-ink shadow-lg" title="Premiere Partner">
            <Star className="size-3.5 fill-current" />
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate font-display text-[17px] leading-tight font-bold">{v.name}</div>
            <div className="truncate text-xs text-muted">
              {v.neighborhood} · {v.distanceMi} mi
            </div>
          </div>
          {v.isFavorite && <Heart className="size-4 shrink-0 fill-pink text-pink" />}
        </div>
        <StatusLine v={v} />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {(v.isLive || v.crowd.count > 0) && <BusyMeter level={v.crowd.level} count={v.crowd.count} compact={compact} />}
          {v.friendsHere.length > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <AvatarStack users={v.friendsHere} max={3} size="xs" /> {v.friendsHere.length} friend{v.friendsHere.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        {!compact && v.specialsToday[0] && (
          <div className="truncate text-xs">
            <span className="text-gold">🍹 {v.specialsToday[0].price}</span> <span className="text-muted">{v.specialsToday[0].title}</span>
          </div>
        )}
      </div>
    </Link>
  );
}

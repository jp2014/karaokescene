import { Clock, Mic, Sparkles, PartyPopper, HeartHandshake, Users, Waves, Infinity as InfinityIcon, SprayCan, QrCode, Megaphone, Award, type LucideIcon } from 'lucide-react';
import { cx } from './ui';

const ICONS: Record<string, LucideIcon> = { Clock, Mic, Sparkles, PartyPopper, HeartHandshake, Users, Waves, Infinity: InfinityIcon, SprayCan, QrCode, Megaphone };

const TIER = {
  bronze: { ring: 'from-[#c98a5a] to-[#7a4a2a]', text: 'text-[#e8b48c]', label: 'Bronze' },
  silver: { ring: 'from-[#e6e9f2] to-[#8b91a8]', text: 'text-[#dfe3ee]', label: 'Silver' },
  gold: { ring: 'from-[#ffe08a] to-[#d99a1e]', text: 'text-gold', label: 'Gold' },
} as const;

export type BadgeView = { key: string; label: string; description: string; icon: string; count?: number; tier?: keyof typeof TIER };

export function BadgeMedal({ badge, size = 'md' }: { badge: BadgeView; size?: 'sm' | 'md' | 'lg' }) {
  const Icon = ICONS[badge.icon] ?? Award;
  const tier = TIER[badge.tier ?? 'bronze'];
  const dims = { sm: 'size-9', md: 'size-14', lg: 'size-20' }[size];
  return (
    <div className={cx('relative grid shrink-0 place-items-center rounded-full bg-gradient-to-br p-[2px]', tier.ring, dims)}>
      <div className="grid size-full place-items-center rounded-full bg-night">
        <Icon className={cx(tier.text, { sm: 'size-4', md: 'size-6', lg: 'size-9' }[size])} strokeWidth={2.2} />
      </div>
      {badge.count != null && badge.count > 1 && size !== 'sm' && (
        <span className="absolute -right-1 -bottom-1 grid min-w-5 place-items-center rounded-full bg-fg px-1 text-[10px] font-bold text-ink">×{badge.count}</span>
      )}
    </div>
  );
}

export function BadgeGrid({ badges }: { badges: BadgeView[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {badges.map((b) => (
        <div key={b.key} className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2/50 p-3">
          <BadgeMedal badge={b} />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{b.label}</div>
            <div className={cx('text-xs font-medium', TIER[b.tier ?? 'bronze'].text)}>
              {TIER[b.tier ?? 'bronze'].label} · {b.count}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function BadgeIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon = ICONS[icon] ?? Award;
  return <Icon className={className} />;
}

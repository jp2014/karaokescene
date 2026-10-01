import { Link } from '@tanstack/react-router';
import { cx } from './ui';

export type CardUser = { id: string; handle: string; displayName: string; role: 'singer' | 'kj' | 'venue'; avatarHue: number; avatarEmoji: string; isPro?: boolean };

const SIZES = { xs: 'size-6 text-xs', sm: 'size-8 text-sm', md: 'size-10 text-lg', lg: 'size-14 text-2xl', xl: 'size-24 text-5xl' };

/** Generated avatar: a hue-shifted gradient orb with the person's emoji. */
export function Avatar({ user, size = 'md', ring, ghost, className }: { user: Pick<CardUser, 'avatarHue' | 'avatarEmoji' | 'displayName' | 'role'>; size?: keyof typeof SIZES; ring?: boolean; ghost?: boolean; className?: string }) {
  const h = user.avatarHue;
  return (
    <span
      title={user.displayName}
      className={cx('relative inline-grid shrink-0 place-items-center select-none', user.role === 'venue' ? 'rounded-[30%]' : 'rounded-full', SIZES[size], ring && 'ring-2 ring-ink', ghost && 'opacity-50 grayscale', className)}
      style={{ background: `radial-gradient(circle at 30% 25%, hsl(${h} 95% 72%), hsl(${(h + 40) % 360} 80% 45%) 55%, hsl(${(h + 80) % 360} 70% 22%))` }}
    >
      <span className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.35)]">{ghost ? '👻' : user.avatarEmoji}</span>
    </span>
  );
}

export function AvatarStack({ users, max = 5, size = 'sm' }: { users: CardUser[]; max?: number; size?: keyof typeof SIZES }) {
  const extra = users.length - max;
  return (
    <div className="flex -space-x-2">
      {users.slice(0, max).map((u) => (
        <Avatar key={u.id} user={u} size={size} ring />
      ))}
      {extra > 0 && <span className={cx('inline-grid place-items-center rounded-full bg-surface-3 font-semibold text-muted ring-2 ring-ink', SIZES[size], '!text-[11px]')}>+{extra}</span>}
    </div>
  );
}

export const ROLE_LABEL = { singer: 'Singer', kj: 'KJ', venue: 'Venue' } as const;

export function UserRow({ user, sub, right, link = true }: { user: CardUser; sub?: React.ReactNode; right?: React.ReactNode; link?: boolean }) {
  const body = (
    <>
      <Avatar user={user} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 truncate font-semibold">
          {user.displayName}
          {user.role !== 'singer' && <span className="rounded bg-cyan/15 px-1.5 text-[10px] font-bold uppercase text-cyan">{ROLE_LABEL[user.role]}</span>}
          {user.isPro && <span className="rounded bg-gold/15 px-1.5 text-[10px] font-bold uppercase text-gold">Pro</span>}
        </div>
        <div className="truncate text-xs text-muted">{sub ?? `@${user.handle}`}</div>
      </div>
    </>
  );
  return (
    <div className="flex items-center gap-3 rounded-2xl p-2 transition hover:bg-white/[0.03]">
      {link ? (
        <Link to="/u/$handle" params={{ handle: user.handle }} className="flex min-w-0 flex-1 items-center gap-3">
          {body}
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3">{body}</div>
      )}
      {right}
    </div>
  );
}

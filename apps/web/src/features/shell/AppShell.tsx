import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { Bell, Compass, Disc3, Home, ListMusic, LogOut, MessageCircleHeart, Mic2, QrCode, Store, User, Users, Wrench } from 'lucide-react';
import { Suspense, useState, type ReactNode } from 'react';
import { Avatar, ROLE_LABEL } from '~/components/Avatar';
import { cx, LiveDot } from '~/components/ui';
import { DemoControls } from '~/lib/demo';
import { NotificationsSheet } from './NotificationsSheet';
import { usePresenceHeartbeat } from './usePresence';
import { useNotificationToasts } from './useNotificationToasts';
import { useRealtimeSync } from './useRealtimeSync';
import { signOut } from '~/lib/session';
import { useMe, useNotifications, type Me } from '~/lib/queries';

type NavItem = { to: string; label: string; icon: typeof Home; live?: boolean };

function navFor(me: Me): NavItem[] {
  const common = { discover: { to: '/', label: 'Discover', icon: Compass }, feed: { to: '/feed', label: 'Praise Feed', icon: MessageCircleHeart }, friends: { to: '/friends', label: 'Friends', icon: Users }, me: { to: '/me', label: 'Profile', icon: User } };
  if (me.role === 'kj') return [common.discover, { to: '/kj', label: 'KJ Booth', icon: Disc3, live: !!me.kjSession }, common.feed, common.friends, common.me];
  if (me.role === 'venue') return [common.discover, { to: '/hq', label: 'Venue HQ', icon: Store }, common.feed, common.me];
  return [common.discover, { to: '/live', label: 'My Night', icon: Mic2, live: !!me.checkin }, { to: '/songs', label: 'Song List', icon: ListMusic }, common.feed, common.friends, common.me];
}

function Logo({ compact }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <img src="/icon.svg" alt="" className="size-9" />
      {!compact && (
        <span className="font-display text-lg leading-none font-extrabold">
          Karaoke<span className="text-gradient"> Scene</span>
        </span>
      )}
    </Link>
  );
}

export function AppShell() {
  const { data: me } = useMe();
  const { data: notes } = useNotifications();
  const [notesOpen, setNotesOpen] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const qc = useQueryClient();
  const navigate = useNavigate();
  usePresenceHeartbeat(me);
  useRealtimeSync(me);
  useNotificationToasts();

  const nav = me ? navFor(me) : [];
  const isActive = (to: string) => (to === '/' ? path === '/' : path.startsWith(to));
  const unread = notes?.unread ?? 0;
  const fullBleed = path === '/';

  return (
    <div className="min-h-dvh lg:pl-72">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-line bg-night/80 p-5 backdrop-blur-xl lg:flex">
        <Logo />
        <nav className="mt-8 space-y-1">
          {nav.map((n) => (
            <Link key={n.to} to={n.to} className={cx('group flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-[15px] font-medium transition', isActive(n.to) ? 'bg-white/[0.07] text-fg' : 'text-muted hover:bg-white/[0.04] hover:text-fg')}>
              <n.icon className={cx('size-5', isActive(n.to) && 'text-pink')} />
              {n.label}
              {n.live && <LiveDot className="ml-auto" />}
            </Link>
          ))}
          <Link to="/scan" className={cx('flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-[15px] font-medium transition', isActive('/scan') ? 'bg-white/[0.07]' : 'text-muted hover:bg-white/[0.04] hover:text-fg')}>
            <QrCode className="size-5" /> Scan & Share
          </Link>
          <button onClick={() => setNotesOpen(true)} className="flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-[15px] font-medium text-muted transition hover:bg-white/[0.04] hover:text-fg">
            <Bell className="size-5" /> Notifications
            {unread > 0 && <span className="ml-auto rounded-full bg-pink px-2 py-0.5 text-xs font-bold text-white">{unread}</span>}
          </button>
        </nav>
        <div className="mt-auto space-y-3">
          {DemoControls && (
            <button onClick={() => setDebugOpen(true)} className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-gold/40 bg-gold/5 px-3.5 py-2.5 text-sm font-semibold text-gold transition hover:bg-gold/10">
              <Wrench className="size-4" /> Demo controls
            </button>
          )}
          {me && (
            <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface/70 p-3">
              <Link to="/me">
                <Avatar user={me} />
              </Link>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{me.displayName}</div>
                <div className="text-xs text-muted">{ROLE_LABEL[me.role]}{me.ghostMode && ' · 👻 Ghost'}</div>
              </div>
              <button
                title="Sign out"
                onClick={async () => {
                  await signOut(qc);
                  navigate({ to: '/welcome' });
                }}
                className="text-faint hover:text-fg"
              >
                <LogOut className="size-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className={cx('sticky top-0 z-40 flex items-center justify-between gap-3 px-4 py-3 pt-safe lg:hidden', fullBleed ? 'glass border-b border-line' : 'glass border-b border-line')}>
        <Logo />
        <div className="flex items-center gap-1">
          {DemoControls && (
            <IconBtn onClick={() => setDebugOpen(true)} label="Demo controls">
              <Wrench className="size-5 text-gold" />
            </IconBtn>
          )}
          <IconBtn onClick={() => setNotesOpen(true)} label="Notifications">
            <Bell className="size-5" />
            {unread > 0 && <span className="absolute top-1 right-1 grid min-w-4 place-items-center rounded-full bg-pink px-1 text-[10px] font-bold text-white">{unread}</span>}
          </IconBtn>
          {me && (
            <Link to="/me" className="ml-1">
              <Avatar user={me} size="sm" />
            </Link>
          )}
        </div>
      </header>

      {me?.checkin && me.role === 'singer' && path !== '/live' && <LiveBanner />}

      <main className={cx(fullBleed ? '' : 'mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10', 'pb-28 lg:pb-10')}>
        <AnimatePresence mode="wait">
          <motion.div key={path.split('/')[1]} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mobile bottom tabs */}
      {me && <BottomTabs me={me} isActive={isActive} />}

      <NotificationsSheet open={notesOpen} onClose={() => setNotesOpen(false)} />
      {DemoControls && debugOpen && (
        <Suspense>
          <DemoControls open onClose={() => setDebugOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}

function IconBtn({ children, onClick, label }: { children: ReactNode; onClick: () => void; label: string }) {
  return (
    <button aria-label={label} onClick={onClick} className="relative grid size-10 place-items-center rounded-full text-muted hover:bg-white/5 hover:text-fg">
      {children}
    </button>
  );
}

function LiveBanner() {
  return (
    <Link to="/live" className="sticky top-[60px] z-30 mx-4 mt-3 flex items-center gap-3 rounded-2xl border border-live/30 bg-live/10 px-4 py-2.5 text-sm backdrop-blur-xl lg:top-4 lg:mx-10">
      <LiveDot />
      <span className="flex-1 font-medium">You're checked in. Open your night for the queue, Song Roulette and who's here.</span>
      <span className="font-semibold text-live">Open →</span>
    </Link>
  );
}

function BottomTabs({ me, isActive }: { me: Me; isActive: (to: string) => boolean }) {
  const roleTab = me.role === 'kj' ? { to: '/kj', label: 'Booth', icon: Disc3, live: !!me.kjSession } : me.role === 'venue' ? { to: '/hq', label: 'HQ', icon: Store, live: false } : { to: '/live', label: 'My Night', icon: Mic2, live: !!me.checkin };
  const left = [{ to: '/', label: 'Discover', icon: Compass, live: false }, roleTab];
  const right = [me.role === 'singer' ? { to: '/songs', label: 'Songs', icon: ListMusic, live: false } : { to: '/feed', label: 'Feed', icon: MessageCircleHeart, live: false }, { to: '/me', label: 'Me', icon: User, live: false }];
  const Tab = (t: (typeof left)[number]) => (
    <Link key={t.to} to={t.to} className={cx('relative flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium', isActive(t.to) ? 'text-fg' : 'text-faint')}>
      <t.icon className={cx('size-[22px]', isActive(t.to) && 'text-pink')} />
      {t.label}
      {t.live && (
        <span className="absolute top-1.5 right-[30%] scale-75">
          <LiveDot />
        </span>
      )}
    </Link>
  );
  return (
    <nav className="glass fixed inset-x-0 bottom-0 z-40 border-t border-line pb-safe lg:hidden">
      <div className="mx-auto flex max-w-md items-end px-2">
        {left.map(Tab)}
        <Link to="/scan" className="-mt-6 flex flex-1 flex-col items-center gap-1 pb-2 text-[11px] font-medium text-fg">
          <span className="grid size-14 place-items-center rounded-2xl bg-brand shadow-glow-pink">
            <QrCode className="size-6 text-white" />
          </span>
          Scan
        </Link>
        {right.map(Tab)}
      </div>
    </nav>
  );
}

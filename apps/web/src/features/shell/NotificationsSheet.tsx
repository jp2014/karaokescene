import { Link } from '@tanstack/react-router';
import { useEffect } from 'react';
import { Bell } from 'lucide-react';
import { api, unwrap } from '~/lib/api';
import { ago } from '~/lib/format';
import { qk, useAction, useNotifications } from '~/lib/queries';
import { cx, EmptyState, Sheet } from '~/components/ui';

export function NotificationsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data } = useNotifications();
  const markRead = useAction(() => unwrap(api.notifications.read.$post()), { invalidate: [qk.notifications] });
  useEffect(() => {
    if (open && data?.unread) {
      const t = setTimeout(() => markRead.mutate(undefined), 1500);
      return () => clearTimeout(t);
    }
  }, [open, data?.unread]);

  return (
    <Sheet open={open} onClose={onClose} title="Notifications">
      {!data?.items.length ? (
        <EmptyState icon={<Bell />} title="All quiet" body="Badges, praise, friend requests and KJ alerts show up here." />
      ) : (
        <ul className="space-y-1">
          {data.items.map((n) => {
            const body = (
              <div className={cx('flex gap-3 rounded-2xl p-3 transition hover:bg-white/[0.04]', !n.readAt && 'bg-violet/10')}>
                <span className={cx('mt-1.5 size-2 shrink-0 rounded-full', n.readAt ? 'bg-transparent' : 'bg-pink')} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{n.title}</div>
                  {n.body && <div className="text-sm text-muted">{n.body}</div>}
                  <div className="mt-0.5 text-xs text-faint">{ago(n.createdAt)}</div>
                </div>
              </div>
            );
            return <li key={n.id}>{n.link ? <Link to={n.link} onClick={onClose}>{body}</Link> : body}</li>;
          })}
        </ul>
      )}
    </Sheet>
  );
}

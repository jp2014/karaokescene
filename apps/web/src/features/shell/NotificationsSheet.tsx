import { Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Bell, BellRing } from 'lucide-react';
import { api, unwrap } from '~/lib/api';
import { ago } from '~/lib/format';
import { qk, useAction, useNotifications } from '~/lib/queries';
import { Button, cx, EmptyState, Sheet } from '~/components/ui';
import { enablePush, pushAvailable, pushPermission } from '~/lib/push';

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
      <PushPrompt />
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

/** Offer device push (FCM) when it's configured and not yet allowed. */
function PushPrompt() {
  const [permission, setPermission] = useState(pushPermission);
  const [busy, setBusy] = useState(false);
  if (!pushAvailable() || permission !== 'default') return null;
  async function enable() {
    setBusy(true);
    try {
      if (await enablePush()) toast.success('Alerts are on for this device');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPermission(pushPermission());
      setBusy(false);
    }
  }
  return (
    <div className="mb-4 flex items-center gap-3 rounded-2xl border border-violet/30 bg-violet/10 p-3 text-sm">
      <BellRing className="size-5 shrink-0 text-violet" />
      <span className="flex-1">Get "You're up!" and KJ alerts even when the app is closed.</span>
      <Button size="sm" variant="primary" loading={busy} onClick={enable}>
        Turn on
      </Button>
    </div>
  );
}

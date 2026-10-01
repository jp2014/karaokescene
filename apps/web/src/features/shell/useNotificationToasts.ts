import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useNotifications } from '~/lib/queries';

const ICON: Record<string, string> = { 'auto-leave': '🚪', 'check-in': '📍', badge: '🏅', praise: '💖', 'friend-request': '👋', 'friend-accepted': '🤝', 'song-request': '🎵', 'up-next': '🎤', 'kj-now': '🎧', 'qr-scan': '📲' };

/** Pops a toast for notifications that arrive while the app is open (polling stands in for push). */
export function useNotificationToasts() {
  const { data } = useNotifications();
  const seen = useRef<Set<string> | null>(null);
  const qc = useQueryClient();
  useEffect(() => {
    if (!data) return;
    if (!seen.current) {
      seen.current = new Set(data.items.map((n) => n.id));
      return;
    }
    const fresh = data.items.filter((n) => !seen.current!.has(n.id));
    for (const n of fresh.reverse()) {
      seen.current.add(n.id);
      const urgent = n.kind === 'auto-leave' || n.kind === 'up-next';
      (urgent ? toast.warning : toast)(n.title.startsWith(ICON[n.kind] ?? '') ? n.title : `${ICON[n.kind] ?? '🔔'} ${n.title}`, { description: n.body || undefined, duration: urgent ? 10_000 : 5_000 });
    }
    if (fresh.length) {
      qc.invalidateQueries({ queryKey: ['booth'] });
      qc.invalidateQueries({ queryKey: ['live'] });
    }
  }, [data, qc]);
}

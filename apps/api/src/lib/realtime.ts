import { defer } from './defer.ts';
import { serviceHeaders, type SupabaseConfig } from './supabase.ts';

/**
 * Realtime signals. Payloads only say *what* changed; clients refetch through the API,
 * so privacy rules stay in one place.
 *   user:<userId>    notifications for one person
 *   venue:<venueId>  the live queue and who's here at one venue
 *   scene            check-ins anywhere (map counts)
 */
export type Topic = `user:${string}` | `venue:${string}` | 'scene';
export type RealtimeEvent = 'notification' | 'live' | 'presence';
export type RealtimeMessage = { topic: Topic; event: RealtimeEvent; payload: Record<string, unknown> };
export type RealtimeTransport = (messages: RealtimeMessage[]) => Promise<void>;

let transport: RealtimeTransport = async () => {};

export function setRealtimeTransport(t: RealtimeTransport) {
  transport = t;
}

export const realtime = {
  publish(topic: Topic, event: RealtimeEvent, payload: Record<string, unknown> = {}) {
    defer('realtime publish', () => transport([{ topic, event, payload }]));
  },

  /** Someone arrived or left: the venue's screens and the map both care. */
  presenceChanged(venueId: string) {
    defer('realtime publish', () =>
      transport([
        { topic: `venue:${venueId}`, event: 'presence', payload: {} },
        { topic: 'scene', event: 'presence', payload: { venueId } },
      ]),
    );
  },
};

/** Supabase Realtime Broadcast over REST, on private channels (see the platform migration's RLS policy). */
export function supabaseBroadcast(cfg: SupabaseConfig): RealtimeTransport {
  return async (messages) => {
    const res = await fetch(`${cfg.url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { ...serviceHeaders(cfg), 'content-type': 'application/json' },
      body: JSON.stringify({ messages: messages.map((m) => ({ ...m, private: true })) }),
    });
    if (!res.ok) throw new Error(`broadcast ${res.status}: ${await res.text()}`);
  };
}

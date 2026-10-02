import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { apiBaseUrl } from './api';
import { supabase } from './auth';

/**
 * Realtime "something changed" signals from the API (see apps/api/src/lib/realtime.ts).
 * Production: Supabase Realtime private broadcast channels. Local: the API's SSE stream.
 */
type Handler = (event: string, payload: Record<string, unknown>) => void;
const handlers = new Map<string, Set<Handler>>();
const dispatch = (topic: string, event: string, payload: Record<string, unknown>) => handlers.get(topic)?.forEach((h) => h(event, payload));

const channels = new Map<string, RealtimeChannel>();
let localStream: EventSource | null = null;

function open(topic: string) {
  if (supabase) {
    const ch = supabase
      .channel(topic, { config: { private: true } })
      .on('broadcast', { event: '*' }, (m) => dispatch(topic, m.event, (m.payload ?? {}) as Record<string, unknown>))
      .subscribe();
    channels.set(topic, ch);
  } else if (!localStream) {
    localStream = new EventSource(`${apiBaseUrl}/realtime/local`);
    localStream.onmessage = (e) => {
      const m = JSON.parse(e.data) as { topic: string; event: string; payload: Record<string, unknown> };
      dispatch(m.topic, m.event, m.payload);
    };
  }
}

function close(topic: string) {
  const ch = channels.get(topic);
  if (ch) {
    channels.delete(topic);
    void supabase?.removeChannel(ch);
  }
}

export function subscribe(topic: string, handler: Handler) {
  let set = handlers.get(topic);
  if (!set) {
    handlers.set(topic, (set = new Set()));
    open(topic);
  }
  set.add(handler);
  return () => {
    set.delete(handler);
    if (!set.size) {
      handlers.delete(topic);
      close(topic);
    }
  };
}

/** Refetch `keys` whenever `topic` signals (debounced, so a burst of check-ins is one refetch). */
export function useLiveQueries(topic: string | null | undefined, keys: QueryKey[], events?: string[]) {
  const qc = useQueryClient();
  const latest = useRef({ keys, events });
  latest.current = { keys, events };
  useEffect(() => {
    if (!topic) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = subscribe(topic, (event) => {
      if (latest.current.events && !latest.current.events.includes(event)) return;
      clearTimeout(timer);
      timer = setTimeout(() => latest.current.keys.forEach((queryKey) => qc.invalidateQueries({ queryKey })), 300);
    });
    return () => {
      clearTimeout(timer);
      off();
    };
  }, [topic, qc]);
}

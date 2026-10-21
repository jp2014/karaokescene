import { EventEmitter } from 'node:events';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { RealtimeMessage, RealtimeTransport } from '../lib/realtime.ts';

/**
 * Local stand-in for Supabase Realtime: an in-process bus streamed to browsers over SSE.
 * Every client gets every signal (payloads are only "something changed" hints, and this
 * never runs outside your machine), and the web app filters by topic.
 */
const bus = new EventEmitter().setMaxListeners(0);

export const localRealtime: RealtimeTransport = async (messages) => {
  for (const m of messages) bus.emit('message', m);
};

export const localRealtimeRoutes = new Hono().get('/', (c) =>
  streamSSE(c, async (stream) => {
    const onMessage = (m: RealtimeMessage) => void stream.writeSSE({ data: JSON.stringify(m) });
    bus.on('message', onMessage);
    stream.onAbort(() => {
      bus.off('message', onMessage);
    });
    while (!stream.aborted) {
      await stream.sleep(25_000);
      await stream.writeSSE({ event: 'ping', data: '' });
    }
  }),
);

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { requireViewer, type AppEnv } from '../../lib/context.ts';
import { songCatalog, songLists, songbooks } from './service.ts';

export const songRoutes = new Hono<AppEnv>()
  .get('/search', zValidator('query', z.object({ q: z.string().default(''), kjId: z.string().optional() })), async (c) => {
    const { q, kjId } = c.req.valid('query');
    return c.json(await songCatalog.search(q, { kjId }));
  })
  .get('/mine', async (c) => c.json(await songLists.forUser(requireViewer(c).id)))
  .get('/recommendations', async (c) => c.json(await songLists.recommend(requireViewer(c).id)))
  .put('/mine/:songId', async (c) => {
    await songLists.add(requireViewer(c).id, c.req.param('songId'));
    return c.json({ ok: true });
  })
  .delete('/mine/:songId', async (c) => {
    await songLists.remove(requireViewer(c).id, c.req.param('songId'));
    return c.json({ ok: true });
  })
  .put('/mine/:songId/go-to', zValidator('json', z.object({ on: z.boolean() })), async (c) => {
    await songLists.setGoTo(requireViewer(c).id, c.req.param('songId'), c.req.valid('json').on);
    return c.json({ ok: true });
  })
  .post('/roulette', zValidator('json', z.object({ kjId: z.string().optional() })), async (c) =>
    c.json(await songLists.roulette(requireViewer(c).id, c.req.valid('json').kjId)),
  )
  .get('/songbook', async (c) => c.json(await songbooks.stats(requireViewer(c, 'kj').id)))
  .put('/songbook/:songId', async (c) => {
    await songbooks.add(requireViewer(c, 'kj').id, c.req.param('songId'));
    return c.json({ ok: true });
  })
  .delete('/songbook/:songId', async (c) => {
    await songbooks.remove(requireViewer(c, 'kj').id, c.req.param('songId'));
    return c.json({ ok: true });
  })
  .post('/songbook/import', zValidator('json', z.object({ text: z.string().max(500_000) })), async (c) =>
    c.json(await songbooks.importText(requireViewer(c, 'kj').id, c.req.valid('json').text)),
  );

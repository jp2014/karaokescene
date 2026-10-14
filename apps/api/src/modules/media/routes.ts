import { Hono } from 'hono';
import { requireViewer, type AppEnv } from '../../lib/context.ts';
import { fail } from '../../lib/http.ts';
import { newId } from '../../lib/ids.ts';
import { EXTENSIONS, media } from '../../lib/media.ts';

const MAX_BYTES = 5 * 1024 * 1024;

/** Photo and menu uploads. Files are stored outside the database and served back from here. */
export const mediaRoutes = new Hono<AppEnv>()
  .post('/', async (c) => {
    requireViewer(c);
    const form = await c.req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return fail(400, 'Attach a file');
    const ext = EXTENSIONS[file.type] ?? fail(400, 'Upload a photo (JPG, PNG, WebP) or a PDF');
    if (file.size > MAX_BYTES) fail(400, 'Files must be under 5 MB');
    const key = `${newId('m')}.${ext}`;
    await media.store().put(key, new Uint8Array(await file.arrayBuffer()), file.type);
    return c.json({ url: `/api/media/${key}` });
  })
  .get('/:key{[\\w.-]+}', async (c) => {
    const file = await media.store().get(c.req.param('key'));
    if (!file) return c.notFound();
    return c.body(file.body as Uint8Array<ArrayBuffer>, 200, { 'content-type': file.contentType, 'cache-control': 'public, max-age=31536000, immutable' });
  });

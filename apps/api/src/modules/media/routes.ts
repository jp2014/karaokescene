import { Hono } from 'hono';
import { requireViewer, type AppEnv } from '../../lib/context.ts';
import { fail } from '../../lib/http.ts';
import { newId } from '../../lib/ids.ts';
import { mediaStore } from '../../lib/storage.ts';

const MAX_BYTES = 5 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'application/pdf': 'pdf' };

/** Photo and menu uploads, stored in Supabase Storage (on disk locally). Returns the public URL. */
export const mediaRoutes = new Hono<AppEnv>().post('/', async (c) => {
  const viewer = requireViewer(c);
  const form = await c.req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return fail(400, 'Attach a file');
  const ext = EXTENSIONS[file.type] ?? fail(400, 'Upload a photo (JPG, PNG, WebP) or a PDF');
  if (file.size > MAX_BYTES) fail(400, 'Files must be under 5 MB');
  const url = await mediaStore().put(`uploads/${viewer.id}/${newId('m')}.${ext}`, new Uint8Array(await file.arrayBuffer()), file.type);
  return c.json({ url });
});

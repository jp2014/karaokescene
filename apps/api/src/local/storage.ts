import { mkdirSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { serveStatic } from '@hono/node-server/serve-static';
import type { MediaStore } from '../lib/storage.ts';

/** Local stand-in for Supabase Storage: files on disk, served by the Node host at /api/media. */
export function localStorage(dir: string): MediaStore {
  return {
    async put(key, body) {
      const path = join(dir, key);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, body);
      return `/api/media/${key}`;
    },
  };
}

export function serveLocalMedia(dir: string) {
  mkdirSync(dir, { recursive: true });
  return serveStatic({ root: dir, rewriteRequestPath: (p) => p.replace(/^\/api\/media/, '') });
}

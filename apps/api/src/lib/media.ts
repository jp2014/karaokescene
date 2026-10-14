import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Where uploaded photos and menus live. Hosts swap the implementation (see netlify/api.ts). */
export type MediaStore = {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<{ body: Uint8Array; contentType: string } | null>;
};

const TYPES: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', pdf: 'application/pdf' };
export const EXTENSIONS = Object.fromEntries(Object.entries(TYPES).map(([ext, type]) => [type, ext]));
export const contentTypeOf = (key: string) => TYPES[key.split('.').pop() ?? ''] ?? 'application/octet-stream';

/** Files on disk next to the local database. */
export function diskStore(dir = resolve(dirname(fileURLToPath(import.meta.url)), '../../data/media')): MediaStore {
  return {
    async put(key, body) {
      const path = resolve(dir, key);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, body);
    },
    async get(key) {
      const body = await readFile(resolve(dir, key)).catch(() => null);
      return body ? { body, contentType: contentTypeOf(key) } : null;
    },
  };
}

let store: MediaStore = diskStore();
export const media = {
  store: () => store,
  use(s: MediaStore) {
    store = s;
  },
};

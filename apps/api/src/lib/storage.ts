import { serviceHeaders, type SupabaseConfig } from './supabase.ts';

/** Where uploaded media goes. Returns the public URL of the stored file. */
export type MediaStore = { put(key: string, body: Uint8Array<ArrayBuffer>, contentType: string): Promise<string> };

let store: MediaStore | null = null;

export function setMediaStore(s: MediaStore) {
  store = s;
}

export function mediaStore(): MediaStore {
  if (!store) throw new Error('No media store configured');
  return store;
}

const BUCKET = 'media';

/** Supabase Storage, public `media` bucket (created by the platform migration). */
export function supabaseStorage(cfg: SupabaseConfig): MediaStore {
  return {
    async put(key, body, contentType) {
      const res = await fetch(`${cfg.url}/storage/v1/object/${BUCKET}/${key}`, {
        method: 'POST',
        headers: { ...serviceHeaders(cfg), 'content-type': contentType },
        body,
      });
      if (!res.ok) throw new Error(`storage upload ${res.status}: ${await res.text()}`);
      return `${cfg.url}/storage/v1/object/public/${BUCKET}/${key}`;
    },
  };
}

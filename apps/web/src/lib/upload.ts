import { ApiError, apiBaseUrl } from './api';
import { auth } from './auth';

const MAX_SIDE = 1600;

/** Phone photos are huge: scale them down and re-encode as JPEG before uploading. */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not read that photo'))), 'image/jpeg', 0.85));
}

/** Upload a photo or PDF and get back its URL. */
export async function uploadFile(file: File): Promise<string> {
  const isPhoto = /^image\/(jpeg|png|webp|heic|heif)$/.test(file.type);
  const body = isPhoto ? await shrink(file) : file;
  const form = new FormData();
  form.append('file', body, isPhoto ? 'photo.jpg' : file.name);
  const token = auth.token();
  const res = await fetch(`${apiBaseUrl}/media`, { method: 'POST', body: form, headers: token ? { authorization: `Bearer ${token}` } : {} });
  const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !json.url) throw new ApiError(res.status, json.error ?? 'Upload failed');
  return json.url;
}

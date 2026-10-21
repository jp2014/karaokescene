/** Auth return destinations stay inside the app, including after URL normalization. */
export function returnPath(value?: string): string | undefined {
  if (!value?.startsWith('/') || value.startsWith('//') || /[\\\s]/.test(value)) return;
  const base = 'https://return.invalid';
  try {
    const url = new URL(value, base);
    if (url.origin !== base || url.pathname.startsWith('//')) return;
    return url.pathname + url.search + url.hash;
  } catch { return; }
}

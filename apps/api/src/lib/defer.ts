/**
 * Work that shouldn't hold up the response (realtime signals, push). Serverless hosts
 * register their waitUntil so the runtime stays alive until it finishes.
 */
let waitUntil: (p: Promise<unknown>) => void = () => {};

export function setWaitUntil(fn: (p: Promise<unknown>) => void) {
  waitUntil = fn;
}

export function defer(label: string, task: () => Promise<unknown>) {
  waitUntil(task().catch((err) => console.error(`${label} failed:`, err)));
}

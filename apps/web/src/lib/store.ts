import { useSyncExternalStore } from 'react';

/** A tiny persisted external store; enough for client-only state like simulated location. */
export function createStore<T>(key: string, initial: T) {
  let state: T = initial;
  try {
    const raw = localStorage.getItem(key);
    if (raw) state = { ...initial, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  const listeners = new Set<() => void>();
  const store = {
    get: () => state,
    set(next: Partial<T>) {
      state = { ...state, ...next };
      try {
        localStorage.setItem(key, JSON.stringify(state));
      } catch {
        /* ignore */
      }
      listeners.forEach((l) => l());
    },
    subscribe(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    use: () => useSyncExternalStore(store.subscribe, store.get),
  };
  return store;
}

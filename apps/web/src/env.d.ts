/// <reference types="vite/client" />

/** Build-time flag: true for local dev/demo builds, false (and tree-shaken) for real deploys. */
declare const __DEMO__: boolean;

interface ImportMetaEnv {
  /** API base URL, e.g. https://<ref>.supabase.co/functions/v1/api. Defaults to same-origin /api. */
  readonly VITE_API_URL?: string;
  readonly VITE_SUPABASE_URL?: string;
  /** The project's publishable (anon) key. Safe to ship to browsers. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_FIREBASE_VAPID_KEY?: string;
}

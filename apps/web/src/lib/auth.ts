import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Supabase (Auth + Realtime). Null when not configured, e.g. a plain local demo. */
export const supabase = url && anonKey ? createClient(url, anonKey) : null;


/** A token source that takes precedence over Supabase. Only the local demo's persona sign-in sets one. */
type TokenOverride = { get(): string | null; clear(): void };

let accessToken: string | null = null;
let override: TokenOverride | null = null;

/**
 * Who the API calls are made as. Supabase keeps the session fresh (and in localStorage);
 * we mirror its access token so the API client can read it synchronously.
 */
export const auth = {
  async init() {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    accessToken = data.session?.access_token ?? null;
    supabase.auth.onAuthStateChange((_event, session) => {
      accessToken = session?.access_token ?? null;
    });
  },

  token: () => override?.get() ?? accessToken,
  signedIn: () => !!auth.token(),

  setTokenOverride(o: TokenOverride) {
    override = o;
  },

  /** Creates a real account. Confirm email is disabled for the current launch setup. */
  async signUp(email: string, password: string) {
    if (!supabase) throw new Error('Sign-in is not configured');
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    if (!data.session) throw new Error('Check your email to confirm your account, then sign in.');
    accessToken = data.session.access_token;
  },

  async signIn(email: string, password: string) {
    if (!supabase) throw new Error('Sign-in is not configured');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    accessToken = data.session.access_token;
  },

  async signOut() {
    override?.clear();
    accessToken = null;
    await supabase?.auth.signOut().catch(() => {});
  },
};

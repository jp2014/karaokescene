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

  /** Email sign-in, step 1: send a 6-digit code (creates the account on first use). */
  async sendCode(email: string) {
    if (!supabase) throw new Error('Sign-in is not configured');
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    if (error) throw error;
  },

  /** Email sign-in, step 2: the code from the email. */
  async verifyCode(email: string, code: string) {
    if (!supabase) throw new Error('Sign-in is not configured');
    const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
    if (error) throw error;
    accessToken = data.session?.access_token ?? accessToken;
  },

  /** Google sign-in: leaves the app and comes back to `returnTo` (a path on this site). */
  async signInWithGoogle(returnTo: string) {
    if (!supabase) throw new Error('Sign-in is not configured');
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: new URL(returnTo, window.location.origin).href } });
    if (error) throw error;
  },

  async signOut() {
    override?.clear();
    accessToken = null;
    await supabase?.auth.signOut().catch(() => {});
  },
};

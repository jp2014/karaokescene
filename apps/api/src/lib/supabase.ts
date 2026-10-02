/**
 * Supabase project settings. Inside a Supabase Edge Function these are injected
 * automatically; locally they're optional (set them in .env to try real sign-in).
 * Read lazily so hosts can load env files before the first call.
 */
export function supabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && serviceKey ? { url: url.replace(/\/$/, ''), serviceKey } : null;
}

export type SupabaseConfig = NonNullable<ReturnType<typeof supabaseConfig>>;

export const serviceHeaders = (cfg: SupabaseConfig) => ({ apikey: cfg.serviceKey, authorization: `Bearer ${cfg.serviceKey}` });

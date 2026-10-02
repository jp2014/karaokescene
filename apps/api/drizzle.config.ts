import { defineConfig } from 'drizzle-kit';

/**
 * Migrations are written straight into supabase/migrations with Supabase-style timestamp
 * names, so `supabase db push` applies them in production and the local PGlite database
 * runs the same files through Drizzle's migrator (it reads ./meta/_journal.json there).
 */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: '../../supabase/migrations',
  schemaFilter: ['app'],
  migrations: { prefix: 'supabase' },
});

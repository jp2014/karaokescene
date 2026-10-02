#!/usr/bin/env node
/**
 * `pnpm release`: ship everything to production in one go.
 *
 *   1. typecheck
 *   2. Supabase: apply migrations, set function secrets, deploy the `api` Edge Function
 *   3. Netlify: build the PWA (no demo code) against that API and deploy it
 *
 * Settings come from the environment or `.env.deploy` (see .env.deploy.example).
 * The Supabase and Netlify CLIs run through npx, so nothing needs installing globally.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const envFile = join(root, '.env.deploy');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const env = process.env;
const missing = ['SUPABASE_PROJECT_REF', 'SUPABASE_DB_PASSWORD', 'NETLIFY_SITE_ID'].filter((k) => !env[k]);
if (missing.length) {
  console.error(`✗ Missing ${missing.join(', ')}. Copy .env.deploy.example to .env.deploy and fill it in.`);
  process.exit(1);
}

const ref = env.SUPABASE_PROJECT_REF;
const supabaseUrl = `https://${ref}.supabase.co`;
const step = (title) => console.log(`\n▶ ${title}`);
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { cwd: root, stdio: 'inherit', ...opts });
const capture = (cmd, args) => execFileSync(cmd, args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
const supabase = (...args) => run('npx', ['--yes', 'supabase@2', ...args]);
const netlify = (...args) => run('npx', ['--yes', 'netlify-cli@27', ...args]);

step('Typecheck');
run('pnpm', ['typecheck']);

step(`Supabase: link ${ref} and push migrations`);
supabase('link', '--project-ref', ref, '--password', env.SUPABASE_DB_PASSWORD);
supabase('db', 'push', '--linked', '--password', env.SUPABASE_DB_PASSWORD);

step('Supabase: function secrets');
const siteUrl = env.SITE_URL?.replace(/\/$/, '');
const secrets = {
  APP_URL: siteUrl,
  ALLOWED_ORIGINS: env.ALLOWED_ORIGINS ?? siteUrl,
  SCENE_TZ: env.SCENE_TZ,
  FCM_SERVICE_ACCOUNT: env.FCM_SERVICE_ACCOUNT_FILE ? JSON.stringify(JSON.parse(readFileSync(resolve(root, env.FCM_SERVICE_ACCOUNT_FILE), 'utf8'))) : undefined,
};
const lines = Object.entries(secrets)
  .filter(([, v]) => v)
  .map(([k, v]) => `${k}=${JSON.stringify(v)}`);
if (lines.length) {
  const dir = mkdtempSync(join(tmpdir(), 'ks-secrets-'));
  try {
    writeFileSync(join(dir, '.env'), lines.join('\n') + '\n', { mode: 0o600 });
    supabase('secrets', 'set', '--project-ref', ref, '--env-file', join(dir, '.env'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
} else {
  console.log('  (none set)');
}

step('Supabase: deploy the api Edge Function');
run('pnpm', ['--filter', '@ks/api', 'build:edge']);
supabase('functions', 'deploy', 'api', '--project-ref', ref, '--no-verify-jwt', '--use-api');

step('Netlify: build the PWA');
let anonKey = env.SUPABASE_ANON_KEY;
if (!anonKey) {
  const keys = JSON.parse(capture('npx', ['--yes', 'supabase@2', 'projects', 'api-keys', '--project-ref', ref, '-o', 'json']));
  anonKey = (keys.find((k) => k.type === 'publishable') ?? keys.find((k) => k.name === 'anon'))?.api_key;
  if (!anonKey) throw new Error('Could not find the project publishable/anon key; set SUPABASE_ANON_KEY');
}
const webEnv = {
  ...env,
  VITE_DEMO: 'false',
  VITE_API_URL: `${supabaseUrl}/functions/v1/api`,
  VITE_SUPABASE_URL: supabaseUrl,
  VITE_SUPABASE_ANON_KEY: anonKey,
};
run('pnpm', ['--filter', '@ks/web', 'build'], { env: webEnv });

step('Netlify: deploy');
netlify('deploy', '--prod', '--no-build', '--dir', 'apps/web/dist', '--site', env.NETLIFY_SITE_ID);

console.log(`\n✓ Released. API: ${supabaseUrl}/functions/v1/api${siteUrl ? ` · Web: ${siteUrl}` : ''}`);

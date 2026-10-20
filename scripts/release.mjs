#!/usr/bin/env node
// Build first, then deploy Supabase + Cloudflare Pages. --check builds without remote writes.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function releaseConfig(env) {
  const required = ['SUPABASE_PROJECT_REF', 'SUPABASE_DB_PASSWORD', 'SUPABASE_ANON_KEY', 'CLOUDFLARE_PAGES_PROJECT', 'SITE_URL'];
  const missing = required.filter((k) => !env[k]);
  if (missing.length) throw new Error(`Missing ${missing.join(', ')}. Fill in .env.deploy (see .env.deploy.example).`);
  if (!/^[a-z]{20}$/.test(env.SUPABASE_PROJECT_REF)) throw new Error('SUPABASE_PROJECT_REF must be the 20-letter project reference.');
  if (!/^[a-z0-9][a-z0-9-]{0,57}[a-z0-9]$/.test(env.CLOUDFLARE_PAGES_PROJECT)) throw new Error('Invalid CLOUDFLARE_PAGES_PROJECT.');
  const site = new URL(env.SITE_URL);
  if (site.protocol !== 'https:' || site.username || site.password || site.pathname !== '/' || site.search || site.hash) throw new Error('SITE_URL must be the HTTPS origin of the production web app.');
  const key = env.SUPABASE_ANON_KEY;
  let anon = key.startsWith('sb_publishable_');
  if (!anon) {
    try { anon = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'anon'; } catch { /* invalid key */ }
  }
  if (!anon) throw new Error('SUPABASE_ANON_KEY must be a public publishable/anon key, never a service role or secret key.');
  return {
    ref: env.SUPABASE_PROJECT_REF,
    siteUrl: site.origin,
    supabaseUrl: `https://${env.SUPABASE_PROJECT_REF}.supabase.co`,
    project: env.CLOUDFLARE_PAGES_PROJECT,
    branch: env.CLOUDFLARE_PAGES_BRANCH || 'main',
    anonKey: key,
  };
}

export function release({ env = process.env, checkOnly = false, run = execFileSync } = {}) {
  const root = resolve(import.meta.dirname, '..');
  const cfg = releaseConfig(env);
  const invoke = (cmd, args, overrides = {}) => run(cmd, args, { cwd: root, stdio: 'inherit', env, ...overrides });
  const supabase = (...args) => invoke('npx', ['--yes', 'supabase@2', ...args]);
  const step = (title) => console.log(`\n▶ ${title}`);
  step('Typecheck and build production artifacts');
  invoke('pnpm', ['typecheck']);
  // node --import avoids tsx's IPC listener and works in restricted local environments.
  invoke('node', ['--import', 'tsx', 'scripts/build-edge.ts'], { cwd: join(root, 'apps/api') });
  const webEnv = {
    ...env, VITE_DEMO: 'false', VITE_API_URL: `${cfg.supabaseUrl}/functions/v1/api`,
    VITE_SUPABASE_URL: cfg.supabaseUrl, VITE_SUPABASE_ANON_KEY: cfg.anonKey,
  };
  // Push is deliberately dormant for launch, even if the shell has Firebase settings.
  for (const key of Object.keys(webEnv)) if (key.startsWith('VITE_FIREBASE_')) webEnv[key] = '';
  invoke('pnpm', ['--filter', '@ks/web', 'build'], { env: webEnv });
  if (checkOnly) {
    console.log('\n✓ Release check passed. No remote changes made. Auth, SMTP and account access still require verification.');
    return;
  }
  step(`Supabase: link ${cfg.ref} and push migrations`);
  supabase('link', '--project-ref', cfg.ref);
  supabase('db', 'push', '--linked');
  step('Supabase: configure API origins');
  const dir = mkdtempSync(join(tmpdir(), 'ks-secrets-'));
  try {
    const secrets = { APP_URL: cfg.siteUrl, ALLOWED_ORIGINS: cfg.siteUrl, SCENE_TZ: env.SCENE_TZ || 'America/Chicago' };
    const file = join(dir, '.env');
    writeFileSync(file, Object.entries(secrets).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join('\n') + '\n', { mode: 0o600 });
    supabase('secrets', 'set', '--project-ref', cfg.ref, '--env-file', file);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  step('Supabase: deploy API');
  supabase('functions', 'deploy', 'api', '--project-ref', cfg.ref, '--no-verify-jwt', '--use-api');
  step('Cloudflare Pages: deploy web app');
  invoke('npx', ['--yes', 'wrangler@4', 'pages', 'deploy', 'apps/web/dist', '--project-name', cfg.project, '--branch', cfg.branch]);
  console.log(`\n✓ Released. Web: ${cfg.siteUrl} · API: ${cfg.supabaseUrl}/functions/v1/api`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const file = resolve(import.meta.dirname, '../.env.deploy');
  if (existsSync(file)) process.loadEnvFile(file);
  try { release({ checkOnly: process.argv.includes('--check') }); }
  catch (error) { console.error(`✗ ${error.message}`); process.exitCode = 1; }
}

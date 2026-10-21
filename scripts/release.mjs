#!/usr/bin/env node
// Build first, then deploy Supabase + Cloudflare Workers Static Assets. --check builds without remote writes.
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function releaseConfig(env) {
  const required = ['SUPABASE_PROJECT_REF', 'SUPABASE_DB_PASSWORD', 'SUPABASE_ANON_KEY', 'CLOUDFLARE_WORKER_NAME', 'CLOUDFLARE_ACCOUNT_ID', 'SITE_URL'];
  const missing = required.filter((k) => !env[k]);
  if (missing.length) throw new Error(`Missing ${missing.join(', ')}. Fill in .env.deploy (see .env.deploy.example).`);
  if (!/^[a-z]{20}$/.test(env.SUPABASE_PROJECT_REF)) throw new Error('SUPABASE_PROJECT_REF must be the 20-letter project reference.');
  if (!/^[a-z0-9][a-z0-9-]{0,57}[a-z0-9]$/.test(env.CLOUDFLARE_WORKER_NAME)) throw new Error('Invalid CLOUDFLARE_WORKER_NAME.');
  if (!/^[a-f0-9]{32}$/.test(env.CLOUDFLARE_ACCOUNT_ID)) throw new Error('Invalid CLOUDFLARE_ACCOUNT_ID.');
  if (env.CI === 'true' && (!env.SUPABASE_ACCESS_TOKEN || !env.CLOUDFLARE_API_TOKEN)) throw new Error('CI deployment requires SUPABASE_ACCESS_TOKEN and CLOUDFLARE_API_TOKEN.');
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
    worker: env.CLOUDFLARE_WORKER_NAME,
    anonKey: key,
  };
}

export function release({ env = process.env, checkOnly = false, run = execFileSync, writeAsset = writeFileSync } = {}) {
  const root = resolve(import.meta.dirname, '..');
  const cfg = releaseConfig(env);
  const revision = env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  if (!/^[a-f0-9]{40}$/.test(revision)) throw new Error('Release revision must be a full Git commit SHA.');
  const releaseEnv = { ...env, RELEASE_SHA: revision };
  const invoke = (cmd, args, overrides = {}) => run(cmd, args, { cwd: root, stdio: 'inherit', env, ...overrides });
  const supabase = (...args) => invoke('pnpm', ['exec', 'supabase', ...args]);
  const step = (title) => console.log(`\n▶ ${title}`);
  step('Typecheck and build production artifacts');
  invoke('pnpm', ['typecheck']);
  // node --import avoids tsx's IPC listener and works in restricted local environments.
  invoke('node', ['--import', 'tsx', 'scripts/build-edge.ts'], { cwd: join(root, 'apps/api'), env: releaseEnv });
  const webEnv = {
    ...env, VITE_DEMO: 'false', VITE_API_URL: `${cfg.supabaseUrl}/functions/v1/api`,
    VITE_SUPABASE_URL: cfg.supabaseUrl, VITE_SUPABASE_ANON_KEY: cfg.anonKey,
  };
  // Push is deliberately dormant for launch, even if the shell has Firebase settings.
  for (const key of Object.keys(webEnv)) if (key.startsWith('VITE_FIREBASE_')) webEnv[key] = '';
  invoke('pnpm', ['--filter', '@ks/web', 'build'], { env: webEnv });
  writeAsset(join(root, 'apps/web/dist/release.json'), JSON.stringify({ revision, apiUrl: `${cfg.supabaseUrl}/functions/v1/api` }) + '\n');
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
  step('Verify deployed API and database before publishing the frontend');
  invoke('node', ['scripts/verify-release.mjs', 'api'], { env: releaseEnv });
  step('Cloudflare Workers: deploy static web app');
  invoke('pnpm', ['exec', 'wrangler', 'deploy', '--config', 'wrangler.jsonc', '--name', cfg.worker]);
  step('Verify deployed frontend and API connectivity');
  invoke('node', ['scripts/verify-release.mjs', 'web'], { env: releaseEnv });
  invoke('node', ['scripts/e2e/production-smoke.mjs'], { env: releaseEnv });
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `## Production release\n\nCommit: \`${revision}\`\n\nWeb: ${cfg.siteUrl}\n\nAPI: ${cfg.supabaseUrl}/functions/v1/api\n`);
  console.log(`\n✓ Released. Web: ${cfg.siteUrl} · API: ${cfg.supabaseUrl}/functions/v1/api`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const file = resolve(import.meta.dirname, '../.env.deploy');
  if (existsSync(file)) process.loadEnvFile(file);
  try { release({ checkOnly: process.argv.includes('--check') }); }
  catch (error) { console.error(`✗ ${error.message}`); process.exitCode = 1; }
}

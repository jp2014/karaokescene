// Runs real-mode checks against the stack already started by CI. Never resets a database.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const run = (cmd, args, options = {}) => execFileSync(cmd, args, { cwd: root, stdio: 'inherit', ...options });
const local = JSON.parse(execFileSync('pnpm', ['exec', 'supabase', 'status', '-o', 'json'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }));
const url = new URL(local.API_URL);
if (!['127.0.0.1', 'localhost'].includes(url.hostname)) throw new Error('CI checks require a local Supabase stack');
const port = process.env.CI_API_PORT || '8791';
const web = `http://127.0.0.1:${port}`;
const env = {
  ...process.env, DEMO: 'off', PORT: port, DATABASE_URL: local.DB_URL, DATABASE_MIGRATE: 'off',
  SUPABASE_URL: local.API_URL, SUPABASE_SERVICE_ROLE_KEY: local.SERVICE_ROLE_KEY,
  VITE_DEMO: 'false', VITE_SUPABASE_URL: local.API_URL, VITE_SUPABASE_ANON_KEY: local.ANON_KEY,
  WEB_URL: web,
};
// Browser tests call the Node host's same-origin API; never inherit a production API URL.
delete env.VITE_API_URL;
delete env.AUTH_JWT_ISSUER;
const dir = mkdtempSync(join(tmpdir(), 'ks-ci-'));
const children = [];
async function waitFor(url, child) {
  for (let i = 0; i < 60; i++) {
    if (child.exitCode !== null) throw new Error('Verification server exited before becoming ready');
    try { if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) return; } catch { /* starting */ }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out waiting for ${url}`);
}
try {
  run('pnpm', ['--filter', '@ks/web', 'build'], { env });
  const api = spawn('node', ['--import', 'tsx', 'src/hosts/node.ts'], { cwd: join(root, 'apps/api'), env, stdio: 'inherit', detached: true });
  children.push(api);
  const file = join(dir, '.env');
  writeFileSync(file, `AUTH_JWT_ISSUER=${local.API_URL}/auth/v1\n`, { mode: 0o600 });
  const edge = spawn('pnpm', ['exec', 'supabase', 'functions', 'serve', 'api', '--no-verify-jwt', '--env-file', file], { cwd: root, env, stdio: 'inherit', detached: true });
  children.push(edge);
  await Promise.all([waitFor(`${web}/api/health`, api), waitFor(`${local.API_URL}/functions/v1/api/health`, edge)]);
  run('node', ['scripts/e2e/edge-smoke.mjs'], { env });
  run('node', ['scripts/e2e/real-auth.mjs'], { env });
  run('node', ['scripts/e2e/real-venues.mjs'], { env });
} finally {
  for (const child of children) {
    try { process.kill(-child.pid, 'SIGTERM'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
  }
  rmSync(dir, { recursive: true, force: true });
}

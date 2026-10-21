import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { release, releaseConfig, transactionPoolerUrl } from './release.mjs';

const env = {
  CLOUDFLARE_ACCOUNT_ID: 'b'.repeat(32), GITHUB_SHA: 'a'.repeat(40), SUPABASE_PROJECT_REF: 'abcdefghijklmnopqrst', SUPABASE_DB_PASSWORD: 'test-only',
  SUPABASE_ANON_KEY: 'sb_publishable_test', CLOUDFLARE_WORKER_NAME: 'scene-test', SITE_URL: 'https://scene-test.example.workers.dev',
};
const readPoolerUrl = () => 'postgresql://postgres.abcdefghijklmnopqrst@aws-1-us-west-2.pooler.supabase.com:5432/postgres\n';
test('release rejects private keys and invalid site URLs before doing work', () => {
  for (const value of ['sb_secret_private', `header.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.signature`]) {
    assert.throws(() => releaseConfig({ ...env, SUPABASE_ANON_KEY: value }), /public publishable\/anon/);
  }
  assert.throws(() => releaseConfig({ ...env, SITE_URL: 'http://localhost:5173' }), /HTTPS origin/);
  assert.throws(() => releaseConfig({ ...env, SITE_URL: 'https://site.test/path' }), /HTTPS origin/);
});
test('check builds real artifacts without remote mutations or inherited demo flags', () => {
  const calls = [];
  release({ env: { ...env, VITE_DEMO: 'true', VITE_FIREBASE_API_KEY: 'inherited' }, checkOnly: true,
    writeAsset: () => {}, run: (cmd, args, opts) => calls.push({ cmd, args, opts }) });
  assert.equal(calls.length, 3);
  assert.ok(calls.every((c) => c.cmd !== 'npx'));
  assert.equal(calls[1].opts.env.RELEASE_SHA, env.GITHUB_SHA);
  const web = calls.at(-1).opts.env;
  assert.equal(web.VITE_DEMO, 'false');
  assert.equal(web.VITE_FIREBASE_API_KEY, '');
  assert.equal(web.VITE_API_URL, 'https://abcdefghijklmnopqrst.supabase.co/functions/v1/api');
});
test('build failure stops before migrations or deployment', () => {
  let called = 0;
  assert.throws(() => release({ env, run: () => { called++; throw new Error('build failed'); } }), /build failed/);
  assert.equal(called, 1);
});

test('release verifies API before frontend deployment, then verifies the published site', () => {
  const calls = [];
  release({ env, readPoolerUrl, writeAsset: () => {}, run: (cmd, args) => calls.push([cmd, ...args].join(' ')) });
  const at = (part) => calls.findIndex((call) => call.includes(part));
  assert.ok(at('supabase db push') < at('supabase functions deploy'));
  assert.ok(at('supabase functions deploy') < at('verify-release.mjs api'));
  assert.ok(at('verify-release.mjs api') < at('wrangler deploy'));
  assert.ok(at('wrangler deploy') < at('verify-release.mjs web'));
  assert.ok(at('verify-release.mjs web') < at('production-smoke.mjs'));
});
test('API smoke failure prevents frontend publication', () => {
  const calls = [];
  assert.throws(() => release({ env, readPoolerUrl, writeAsset: () => {}, run: (cmd, args) => {
    const call = [cmd, ...args].join(' ');
    calls.push(call);
    if (call.includes('verify-release.mjs api')) throw new Error('API did not become healthy');
  } }), /API did not become healthy/);
  assert.ok(!calls.some((call) => call.includes('wrangler deploy')));
});

test('CI credentials are checked before any deployment work', () => {
  assert.throws(() => releaseConfig({ ...env, CI: 'true' }), /CI deployment requires/);
});

test('the API connects through the transaction pooler, never directly', () => {
  let secrets = '';
  release({ env: { ...env, SUPABASE_DB_PASSWORD: 'p@ss:/$HOME"x' }, readPoolerUrl, writeAsset: () => {}, run: (cmd, args) => {
    if (args.includes('secrets')) secrets = readFileSync(args[args.indexOf('--env-file') + 1], 'utf8');
  } });
  const line = secrets.split('\n').find((l) => l.startsWith('DB_POOLER_URL='));
  const url = new URL(JSON.parse(line.slice('DB_POOLER_URL='.length)));
  assert.equal(url.host, 'aws-1-us-west-2.pooler.supabase.com:6543');
  assert.equal(url.username, 'postgres.abcdefghijklmnopqrst');
  assert.equal(decodeURIComponent(url.password), 'p@ss:/$HOME"x');
  assert.ok(!line.includes('$'), 'the env file must not contain anything to expand');
  assert.throws(() => transactionPoolerUrl('postgresql://postgres@db.abcdefghijklmnopqrst.supabase.co:5432/postgres', 'x', 'abcdefghijklmnopqrst'), /pooler URL/);
  assert.throws(() => transactionPoolerUrl('postgresql://postgres.zzzzzzzzzzzzzzzzzzzz@aws-1-us-west-2.pooler.supabase.com:5432/postgres', 'x', 'abcdefghijklmnopqrst'), /pooler URL/);
});
test('a missing pooler URL stops the release before migrations', () => {
  const calls = [];
  assert.throws(() => release({ env, readPoolerUrl: () => { throw new Error('ENOENT'); }, writeAsset: () => {}, run: (cmd, args) => calls.push(args.join(' ')) }), /did not record the database pooler URL/);
  assert.ok(calls.some((c) => c.includes('supabase link')));
  assert.ok(!calls.some((c) => c.includes('db push') || c.includes('secrets') || c.includes('functions deploy')));
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { release, releaseConfig } from './release.mjs';

const env = {
  SUPABASE_PROJECT_REF: 'abcdefghijklmnopqrst', SUPABASE_DB_PASSWORD: 'test-only',
  SUPABASE_ANON_KEY: 'sb_publishable_test', CLOUDFLARE_PAGES_PROJECT: 'scene-test', SITE_URL: 'https://scene-test.pages.dev',
};
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
    run: (cmd, args, opts) => calls.push({ cmd, args, opts }) });
  assert.equal(calls.length, 3);
  assert.ok(calls.every((c) => c.cmd !== 'npx'));
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

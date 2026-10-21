// Local Supabase Edge Function smoke check, including real email/password Auth.
// Needs `supabase start` and a built API bundle. Never prints keys or access tokens.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { run, testPassword } from './lib.mjs';

const status = JSON.parse(execFileSync('pnpm', ['exec', 'supabase', 'status', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
const base = status.API_URL;
const api = `${base}/functions/v1/api`;
const call = async (url, { token, body, ...init } = {}) => {
  const response = await fetch(url, { ...init, headers: { apikey: status.ANON_KEY, ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.json().catch(() => null) };
};
assert.equal((await call(`${api}/health`)).body.ok, true);
assert.equal((await call(`${api}/profiles/session`)).body.status, 'signed-out');
assert.equal((await call(`${api}/demo/sign-in`, { method: 'POST', body: { userId: 'usr_jess' } })).status, 404);
assert.equal((await call(`${api}/promo/upgrade`, { method: 'POST', body: { on: true } })).status, 404);
console.log('✓ production Edge URL works; demo sign-in and mock upgrade are absent');

const email = `edge-${run}@example.com`;
const created = await call(`${base}/auth/v1/signup`, { method: 'POST', body: { email, password: testPassword } });
assert.equal(created.status, 200);
assert.ok(created.body.access_token, 'Signup must issue a session without email confirmation');
const verified = await call(`${base}/auth/v1/token?grant_type=password`, { method: 'POST', body: { email, password: testPassword } });
assert.equal(verified.status, 200);
const token = verified.body.access_token;
assert.ok(token);
assert.equal((await call(`${api}/profiles/session`, { token })).body.status, 'onboarding');
const onboarded = await call(`${api}/profiles/onboard`, { token, method: 'POST', body: { role: 'singer' } });
assert.equal(onboarded.status, 200);
const session = await call(`${api}/profiles/session`, { token });
assert.equal(session.body.status, 'ready');
assert.equal(session.body.me.role, 'singer');
assert.equal(session.body.me.isPremium, false);
console.log('✓ real Supabase password sign-in → Edge token verification → role onboarding → free profile');

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyRelease } from './verify-release.mjs';

const cfg = { apiUrl: 'https://api.example.test/functions/v1/api', supabaseUrl: 'https://api.example.test', anonKey: 'sb_publishable_test', siteUrl: 'https://scene.example.test', revision: 'a'.repeat(40), region: 'us-west-2' };
const authSettings = { mailer_autoconfirm: true, disable_signup: false, external: { email: true, google: false } };
function responding(overrides = {}, { honoursRegion = true } = {}) {
  return async (url) => {
    const path = new URL(url).pathname;
    const ranIn = (honoursRegion && new URL(url).searchParams.get('forceFunctionRegion')) || 'us-east-1';
    const body = overrides[path] ?? (path.endsWith('/health') ? { ok: true, revision: cfg.revision }
      : path.endsWith('/discover/venues') ? { venues: [] }
      : path === '/auth/v1/settings' ? authSettings
      : path === '/release.json' ? { revision: cfg.revision, apiUrl: cfg.apiUrl, apiRegion: cfg.region }
      : '<div id="root"></div><script type="module" src="/assets/app.js"></script>');
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { headers: { 'x-sb-edge-region': ranIn, 'access-control-allow-origin': cfg.siteUrl, 'content-type': path.endsWith('.js') ? 'application/javascript' : path.endsWith('.css') ? 'text/css' : 'text/html' } });
  };
}
test('read-only checks accept matching API, database and frontend deployments', async () => {
  await verifyRelease('web', { ...cfg, fetchImpl: responding() });
});
test('release rejects Auth settings that prevent the launch sign-in flow', async () => {
  for (const settings of [
    { ...authSettings, mailer_autoconfirm: false },
    { ...authSettings, disable_signup: true },
    { ...authSettings, external: { email: false, google: false } },
    { ...authSettings, external: { email: true, google: true } },
  ]) {
    await assert.rejects(verifyRelease('api', { ...cfg, fetchImpl: responding({ '/auth/v1/settings': settings }) }), /Auth:/);
  }
});
test('stale API and frontend revisions fail even when HTTP is healthy', async () => {
  await assert.rejects(verifyRelease('api', { ...cfg, fetchImpl: responding({ '/functions/v1/api/health': { ok: true, revision: 'old' } }) }), /different release/);
  await assert.rejects(verifyRelease('web', { ...cfg, fetchImpl: responding({ '/release.json': { revision: 'old', apiUrl: cfg.apiUrl } }) }), /different release/);
});
test('database failures and broken client routes fail release verification', async () => {
  await assert.rejects(verifyRelease('api', { ...cfg, fetchImpl: responding({ '/functions/v1/api/discover/venues': { error: 'unavailable' } }) }), /read the database/);
  await assert.rejects(verifyRelease('web', { ...cfg, fetchImpl: responding({ '/welcome': '<h1>Not found</h1>' }) }), /React app/);
});

test('SPA HTML in place of a missing JS asset fails verification', async () => {
  const normal = responding();
  const fetchImpl = async (url) => new URL(url).pathname.endsWith('.js') ? new Response('<html>fallback</html>', { headers: { 'content-type': 'text/html' } }) : normal(url);
  await assert.rejects(verifyRelease('web', { ...cfg, fetchImpl }), /built asset/);
});

test('the pinned region must serve this release and reach the database', async () => {
  const pinnedOnly = (body) => async (url) => (new URL(url).searchParams.has('forceFunctionRegion') && new URL(url).pathname.endsWith(body[0]) ? new Response(JSON.stringify(body[1]), { headers: { 'x-sb-edge-region': cfg.region, 'access-control-allow-origin': cfg.siteUrl } }) : responding()(url));
  await assert.rejects(verifyRelease('api', { ...cfg, fetchImpl: pinnedOnly(['/health', { ok: true, revision: 'OLD-RELEASE' }]) }), /different release/);
  await assert.rejects(verifyRelease('api', { ...cfg, fetchImpl: pinnedOnly(['/discover/venues', { error: 'unavailable' }]) }), /read the database/);
});
test('the API must run beside the database, and the frontend must pin it there', async () => {
  await assert.rejects(verifyRelease('api', { ...cfg, fetchImpl: responding({}, { honoursRegion: false }) }), /database region/);
  await assert.rejects(verifyRelease('web', { ...cfg, fetchImpl: responding({ '/release.json': { revision: cfg.revision, apiUrl: cfg.apiUrl, apiRegion: null } }) }), /pin the API/);
});

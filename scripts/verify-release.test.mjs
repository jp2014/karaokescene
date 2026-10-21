import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyRelease } from './verify-release.mjs';

const cfg = { apiUrl: 'https://api.example.test/functions/v1/api', siteUrl: 'https://scene.example.test', revision: 'a'.repeat(40) };
function responding(overrides = {}) {
  return async (url) => {
    const path = new URL(url).pathname;
    const body = overrides[path] ?? (path.endsWith('/health') ? { ok: true, revision: cfg.revision }
      : path.endsWith('/discover/venues') ? { venues: [] }
      : path === '/release.json' ? { revision: cfg.revision, apiUrl: cfg.apiUrl }
      : '<div id="root"></div><script type="module" src="/assets/app.js"></script>');
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { headers: { 'access-control-allow-origin': cfg.siteUrl, 'content-type': path.endsWith('.js') ? 'application/javascript' : path.endsWith('.css') ? 'text/css' : 'text/html' } });
  };
}
test('read-only checks accept matching API, database and frontend deployments', async () => {
  await verifyRelease('web', { ...cfg, fetchImpl: responding() });
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

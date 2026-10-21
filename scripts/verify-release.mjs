// Read-only post-deployment checks. Retries tolerate propagation, with bounded requests.
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function verifyRelease(kind, { apiUrl, siteUrl, revision, fetchImpl = fetch }) {
  const get = async (url, headers = {}) => {
    const res = await fetchImpl(url, { headers: { 'cache-control': 'no-cache', ...headers }, signal: AbortSignal.timeout(10_000) });
    assert.equal(res.status, 200, `${new URL(url).pathname} returned ${res.status}`);
    return res;
  };
  const health = await get(`${apiUrl}/health`, { origin: siteUrl });
  assert.equal(health.headers.get('access-control-allow-origin'), siteUrl, 'API must allow the production web origin');
  const status = await health.json();
  assert.equal(status.ok, true);
  assert.equal(status.revision, revision, 'API is still serving a different release');
  const discovery = await (await get(`${apiUrl}/discover/venues?lat=41.2565&lng=-95.9345&radiusMi=1`)).json();
  assert.ok(Array.isArray(discovery.venues), 'Discovery must successfully read the database');
  if (kind === 'web') {
    const deployed = await (await get(`${siteUrl}/release.json?revision=${revision}`)).json();
    assert.equal(deployed.revision, revision, 'Frontend is still serving a different release');
    assert.equal(deployed.apiUrl, apiUrl, 'Frontend must target this API');
    for (const path of ['/', '/welcome']) {
      const html = await (await get(`${siteUrl}${path}`, { 'sec-fetch-mode': 'navigate' })).text();
      assert.match(html, /id="root"/, `${path} must serve the React app`);
      assert.match(html, /<script[^>]+src="\/assets\/[^\"]+\.js"/, `${path} must load the built frontend`);
      const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+\.(?:js|css))"/g)].map((m) => m[1]);
      for (const asset of new Set(assets)) {
        const res = await get(`${siteUrl}${asset}`);
        assert.match(res.headers.get('content-type') ?? '', asset.endsWith('.js') ? /javascript/ : /text\/css/, `${asset} must serve a built asset, not SPA fallback HTML`);
      }
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const kind = process.argv[2];
    assert.ok(['api', 'web'].includes(kind), 'Usage: node scripts/verify-release.mjs <api|web>');
    const { SITE_URL, SUPABASE_PROJECT_REF, RELEASE_SHA } = process.env;
    assert.ok(SITE_URL && SUPABASE_PROJECT_REF && RELEASE_SHA, 'Missing release verification settings');
    const settings = { apiUrl: `https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1/api`, siteUrl: new URL(SITE_URL).origin, revision: RELEASE_SHA };
    for (let attempt = 0; ; attempt++) {
      try { await verifyRelease(kind, settings); break; }
      catch (error) {
        if (attempt === 11) throw error;
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
    console.log(`✓ ${kind} verified for ${RELEASE_SHA}`);
  } catch (error) {
    console.error(`✗ ${error.message}`);
    process.exitCode = 1;
  }
}

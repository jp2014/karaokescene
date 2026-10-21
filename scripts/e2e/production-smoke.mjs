// Read-only production browser smoke. No sign-in emails or mutations.
import assert from 'node:assert/strict';
import { launchBrowser } from './lib.mjs';

const site = new URL(process.env.SITE_URL).origin;
const api = `https://${process.env.SUPABASE_PROJECT_REF}.supabase.co/functions/v1/api`;
const browser = await launchBrowser();
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${site}/welcome`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Continue as a singer/i }).click();
  await page.locator('input[type=email]').waitFor();
  assert.equal(await page.locator('input[type=password]').count(), 2);
  assert.equal(await page.getByRole('button', { name: /Google/ }).count(), 0);
  // Runs in the real site's browser origin, so this verifies CORS as well as connectivity.
  const result = await page.evaluate(async (base) => {
    const res = await fetch(`${base}/discover/venues?lat=41.2565&lng=-95.9345&radiusMi=1`);
    return { status: res.status, body: await res.json() };
  }, api);
  assert.equal(result.status, 200);
  assert.ok(Array.isArray(result.body.venues));
  assert.deepEqual(errors, []);
  console.log('✓ production frontend renders, responds to interaction, and reaches Supabase from its browser origin');
} finally {
  await browser.close();
}

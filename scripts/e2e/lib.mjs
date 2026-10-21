import { chromium } from 'playwright-core';
// Helpers for the real-mode end-to-end checks (app built without the demo + local Supabase).
export const web = process.env.WEB_URL ?? 'http://localhost:5174';
export const run = Date.now().toString(36);
export const testPassword = 'Scene-test-password-42!';

/** Through the welcome screens: `role` signs up (singer | KJ | venue); without it, signs in. Returns where it landed. */
export async function signIn(page, { role, email, password = testPassword, displayName = `Test ${role}` }) {
  await page.goto(`${web}/welcome`, { waitUntil: 'networkidle' });
  if (role) await page.getByRole('button', { name: new RegExp(`Continue as an? ${role}`, 'i') }).click();
  else await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.fill('input[type=email]', email);
  if (role) await page.getByLabel('Public display name', { exact: true }).fill(displayName);
  if (role === 'venue') await page.check('input[type=checkbox]');
  await page.getByLabel('Password', { exact: true }).fill(password);
  if (role) await page.getByLabel('Confirm password', { exact: true }).fill(password);
  await page.getByRole('button', { name: role ? 'Create account' : 'Sign in', exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/welcome'), { timeout: 15000 });
  await page.waitForTimeout(800);
  const errors = await page.locator('[data-sonner-toast][data-type=error]').allTextContents();
  if (errors.length) throw new Error(`Error toast after sign-in: ${errors.join(' | ')}`);
  return new URL(page.url()).pathname;
}

/** Calls the API as the page's signed-in user. */
export const apiAs = (page, path, init = {}) =>
  page.evaluate(
    async ({ path, init }) => {
      const key = Object.keys(localStorage).find((k) => k.endsWith('-auth-token'));
      const token = key && JSON.parse(localStorage.getItem(key)).access_token;
      const res = await fetch(`/api${path}`, { ...init, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` } });
      return { status: res.status, body: await res.json().catch(() => null) };
    },
    { path, init },
  );

export function checker() {
  let failed = false;
  const check = (ok, label) => {
    console.log(`${ok ? '✓' : '✗'} ${label}`);
    if (!ok) failed = true;
  };
  return { check, fail: (e) => check(false, e.message.split('\n')[0]), done: () => process.exit(failed ? 1 : 0) };
}

/** A phone-sized context with GPS at downtown Omaha. */
export const phone = (browser, at = { latitude: 41.2565, longitude: -95.9345 }) =>
  browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, geolocation: at, permissions: ['geolocation'] });

// Local developers use Chrome; CI installs Playwright's matching Chromium build.
export const launchBrowser = () => chromium.launch(process.env.PLAYWRIGHT_CHANNEL === 'chromium' ? {} : { channel: 'chrome' });

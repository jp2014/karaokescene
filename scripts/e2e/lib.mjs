import { chromium } from 'playwright-core';
// Helpers for the real-mode end-to-end checks (app built without the demo + local Supabase).
export const web = process.env.WEB_URL ?? 'http://localhost:5174';
export const mailpit = process.env.MAILPIT_URL ?? 'http://127.0.0.1:55424';
export const run = Date.now().toString(36);

/** The newest sign-in code emailed to `email` (from the local stack's test inbox). */
export async function latestCode(email) {
  for (let i = 0; i < 40; i++) {
    const res = await fetch(`${mailpit}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}&limit=1`);
    const msg = (await res.json()).messages?.[0];
    if (msg) {
      const full = await (await fetch(`${mailpit}/api/v1/message/${msg.ID}`)).json();
      const code = (full.Text || full.HTML).match(/\b(\d{6})\b/)?.[1];
      if (code) {
        await fetch(`${mailpit}/api/v1/messages`, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ IDs: [msg.ID] }) });
        return code;
      }
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`No code arrived for ${email}`);
}

/** Through the welcome screens: `role` signs up (singer | KJ | venue); without it, signs in. Returns where it landed. */
export async function signIn(page, { role, email }) {
  await page.goto(`${web}/welcome`, { waitUntil: 'networkidle' });
  if (role) await page.getByRole('button', { name: new RegExp(`Continue as an? ${role}`, 'i') }).click();
  else await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.fill('input[type=email]', email);
  if (role === 'venue') await page.check('input[type=checkbox]');
  await page.getByRole('button', { name: /Email me a code/ }).click();
  await page.fill('input[inputmode=numeric]', await latestCode(email));
  await page.getByRole('button', { name: /Verify/ }).click();
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

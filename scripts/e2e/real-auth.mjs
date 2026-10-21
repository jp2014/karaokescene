// End-to-end check of real sign-in against a local Supabase stack (no demo code involved).
//
// Usage: node scripts/e2e/real-auth.mjs   (WEB_URL override the defaults in lib.mjs)
// Needs the app without the demo (VITE_DEMO=false, on :5174 by default) and a local Supabase stack.
// Signs up a singer, a KJ and a venue with email/password, checks each lands on its home screen,
// then signs the singer out and back in as a returning user. Needs Google Chrome.
import { apiAs, checker, testPassword, launchBrowser, phone, run, signIn, web } from './lib.mjs';

const browser = await launchBrowser();
const { check, fail, done } = checker();
try {
  for (const [role, home] of [['singer', '/'], ['KJ', '/kj'], ['venue', '/hq']]) {
    const ctx = await phone(browser);
    const page = await ctx.newPage();
    const emailRequests = [];
    page.on('request', (r) => { if (/\/auth\/v1\/(otp|verify|authorize)/.test(r.url())) emailRequests.push(r.url()); });
    const email = `${role.toLowerCase()}-${run}@example.com`;
    if (role === 'singer') {
      await page.goto(`${web}/welcome`, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: /Continue as a singer/i }).click();
      await page.fill('input[type=email]', email);
      await page.getByLabel('Password', { exact: true }).fill(testPassword);
      await page.getByLabel('Confirm password', { exact: true }).fill('does-not-match');
      check(await page.getByRole('button', { name: 'Create account', exact: true }).isDisabled(), 'mismatched passwords cannot create an account');
    }
    const landed = await signIn(page, { role, email });
    check(landed === home, `new ${role} signs up without email confirmation and lands on ${home} (got ${landed})`);
    const { body: session } = await apiAs(page, '/profiles/session');
    check(session.status === 'ready' && session.me.role === role.toLowerCase(), `${role} profile created with role ${role.toLowerCase()}`);
    check(emailRequests.length === 0, `${role} signup does not request an email code or OAuth`);
    if (role === 'singer') {
      const badCtx = await phone(browser);
      const badPage = await badCtx.newPage();
      await badPage.goto(`${new URL(page.url()).origin}/welcome`, { waitUntil: 'networkidle' });
      await badPage.getByRole('button', { name: 'Sign in', exact: true }).click();
      check(await badPage.getByRole('button', { name: /Google/ }).count() === 0, 'Google sign-in is hidden');
      await badPage.fill('input[type=email]', email);
      await badPage.getByLabel('Password', { exact: true }).fill(`${testPassword}-wrong`);
      await badPage.getByRole('button', { name: 'Sign in', exact: true }).click();
      await badPage.locator('[data-sonner-toast][data-type=error]').waitFor();
      const wrong = await apiAs(badPage, '/profiles/session');
      check(wrong.body.status === 'signed-out' && new URL(badPage.url()).pathname === '/welcome', 'wrong password remains signed out');
      await badCtx.close();
      await ctx.clearCookies();
      await page.evaluate(() => localStorage.clear());
      const again = await signIn(page, { email });
      check(again === '/', `returning singer signs in without picking a role (landed ${again})`);
    }
    await ctx.close();
  }
} catch (e) {
  fail(e);
} finally {
  await browser.close();
}
done();

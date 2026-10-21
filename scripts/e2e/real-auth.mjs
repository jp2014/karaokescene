// End-to-end check of real sign-in against a local Supabase stack (no demo code involved).
//
// Usage: node scripts/e2e/real-auth.mjs   (WEB_URL, MAILPIT_URL override the defaults in lib.mjs)
// Needs the app without the demo (VITE_DEMO=false, on :5174 by default) and a local Supabase stack.
// Signs up a singer, a KJ and a venue with email codes, checks each lands on its home screen,
// then signs the singer out and back in as a returning user. Needs Google Chrome.
import { apiAs, checker, launchBrowser, phone, run, signIn } from './lib.mjs';

const browser = await launchBrowser();
const { check, fail, done } = checker();
try {
  for (const [role, home] of [['singer', '/'], ['KJ', '/kj'], ['venue', '/hq']]) {
    const ctx = await phone(browser);
    const page = await ctx.newPage();
    const email = `${role.toLowerCase()}-${run}@example.com`;
    const landed = await signIn(page, { role, email });
    check(landed === home, `new ${role} signs up with an email code and lands on ${home} (got ${landed})`);
    const { body: session } = await apiAs(page, '/profiles/session');
    check(session.status === 'ready' && session.me.role === role.toLowerCase(), `${role} profile created with role ${role.toLowerCase()}`);
    if (role === 'singer') {
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

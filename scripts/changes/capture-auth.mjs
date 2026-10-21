// Password-auth change round. Capture "before" before changing the real sign-in screens.
import { mkdirSync } from 'node:fs';
import { launchBrowser, phone, web } from '../e2e/lib.mjs';
const version = process.argv[2];
if (!['before', 'after'].includes(version)) throw new Error('Usage: node scripts/changes/capture-auth.mjs <before|after>');
const out = `apps/web/changes/password-auth/${version}`;
mkdirSync(out, { recursive: true });
const browser = await launchBrowser();
try {
  const context = await phone(browser);
  const page = await context.newPage();
  for (const mode of ['signup', 'signin']) {
    await page.goto(`${web}/welcome`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: mode === 'signup' ? /Continue as a singer/i : 'Sign in', exact: mode === 'signin' }).click();
    await page.locator('input[type=email]').waitFor();
    await page.waitForTimeout(700);
    const form = page.locator('section.mt-12');
    await form.evaluate((node) => { node.style.outline = '3px solid #ff2d2d'; node.style.outlineOffset = '-3px'; });
    await form.screenshot({ path: `${out}/${mode}.jpg`, type: 'jpeg', quality: 88 });
    console.log(`✓ ${version}/${mode}`);
  }
} finally { await browser.close(); }

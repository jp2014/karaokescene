// Real-mode evidence for /changes/go-real. Requires local Supabase + real-mode web on :5174.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { latestCode, phone, run, signIn, web } from '../e2e/lib.mjs';

const out = 'apps/web/changes/go-real/after';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
async function shot(page, name, target) {
  await page.waitForTimeout(500);
  await page.addStyleTag({ content: '[data-sonner-toaster]{display:none!important}' });
  const el = target ?? page.locator('section.mt-12');
  await el.evaluate((node) => { node.style.outline = '3px solid #ff2d2d'; node.style.outlineOffset = '-3px'; });
  await el.screenshot({ path: `${out}/${name}.jpg`, type: 'jpeg', quality: 88 });
  console.log(`✓ ${name}`);
}
try {
  const singer = await phone(browser);
  const page = await singer.newPage();
  await page.goto(`${web}/welcome`, { waitUntil: 'networkidle' });
  await shot(page, 'welcome-roles');
  await page.getByRole('button', { name: /Continue as a singer/i }).click();
  const email = `changes-${run}@example.com`;
  await page.fill('input[type=email]', email);
  await page.getByRole('button', { name: /Email me a code/ }).click();
  await page.fill('input[inputmode=numeric]', await latestCode(email));
  await shot(page, 'welcome-verify');
  await page.getByRole('button', { name: /Verify/ }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/welcome'));
  await page.goto(`${web}/songs`, { waitUntil: 'networkidle' });
  await page.getByText('Unlock with', { exact: false }).first().click();
  await shot(page, 'upgrade-sheet', page.locator('[role=dialog]'));

  const owner = await phone(browser);
  const venuePage = await owner.newPage();
  await signIn(venuePage, { role: 'venue', email: `changes-owner-${run}@example.com` });
  await shot(venuePage, 'venue-claim', venuePage.locator('main').first());
} finally {
  await browser.close();
}

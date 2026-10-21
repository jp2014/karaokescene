// Evidence for /changes/base-songs: a new singer searches before any KJ has imported a songbook.
// Usage: node scripts/changes/capture-base-songs.mjs before|after. Requires the real-mode web app (WEB_URL).
import { mkdirSync } from 'node:fs';
import { launchBrowser, phone, run, signIn } from '../e2e/lib.mjs';

const kind = process.argv[2];
if (!['before', 'after'].includes(kind)) throw new Error('Usage: capture-base-songs.mjs before|after');
const out = `apps/web/changes/base-songs/${kind}`;
mkdirSync(out, { recursive: true });
const browser = await launchBrowser();
try {
  const page = await (await phone(browser)).newPage();
  await signIn(page, { role: 'singer', email: `changes-songs-${run}@example.com` });
  await page.goto(`${process.env.WEB_URL ?? 'http://localhost:5174'}/songs`, { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: '[data-sonner-toaster]{display:none!important}' });
  await page.fill('input[placeholder^="Search songs"]', 'tennessee whiskey');
  await page.waitForTimeout(1500);
  // The search box and its results, boxed; a viewport shot keeps the sticky header in place.
  await page.locator('input[placeholder^="Search songs"]').evaluate((input) => {
    const box = input.closest('section') ?? input.parentElement.parentElement;
    box.style.outline = '3px solid #ff2d2d'; box.style.outlineOffset = '4px';
  });
  await page.screenshot({ path: `${out}/search.jpg`, type: 'jpeg', quality: 88 });
  console.log(`✓ ${kind}/search`);
} finally {
  await browser.close();
}

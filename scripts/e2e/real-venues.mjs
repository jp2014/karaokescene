// End-to-end check of venue onboarding in the real app (no demo): a venue account adds its own
// venue; a KJ lists a venue and its owner later finds and claims it.
// Usage: node scripts/e2e/real-venues.mjs   (see lib.mjs for WEB_URL / MAILPIT_URL)
import { apiAs, checker, launchBrowser, phone, run, signIn, web } from './lib.mjs';

const browser = await launchBrowser();
const { check, fail, done } = checker();
try {
  // 1. A venue account with no venue gets the setup screen (on HQ and Profile), then adds its venue.
  {
    const ctx = await phone(browser);
    const page = await ctx.newPage();
    await signIn(page, { role: 'venue', email: `owner-${run}@example.com` });
    await page.getByText('Set up your venue').waitFor();
    await page.goto(`${web}/me`, { waitUntil: 'networkidle' });
    check(await page.getByText('Set up your venue').isVisible(), 'Profile shows venue setup instead of crashing');
    await page.getByRole('button', { name: 'Add your venue' }).click();
    await page.fill('input[placeholder="Venue name"]', `Owner Lounge ${run}`);
    await page.fill('input[placeholder="Street address"]', '1200 Farnam St');
    await page.getByRole('button', { name: 'Add venue' }).click();
    await page.waitForURL(/\/hq$/);
    await page.getByRole('heading', { name: new RegExp(`Owner Lounge ${run}`) }).first().waitFor({ timeout: 10000 });
    const { body } = await apiAs(page, '/profiles/session');
    check(body.me.venue?.name === `Owner Lounge ${run}` && body.me.displayName === `Owner Lounge ${run}`, 'venue added; the account takes the venue name');
    check(Math.abs(body.me.venue.lat - 41.2565) < 0.01, 'venue pinned at the device location');
    await ctx.close();
  }

  // 2. A KJ lists a venue (pin from GPS), then the owner claims it.
  const listed = `Claimable Tap ${run}`;
  const kjCtx = await phone(browser, { latitude: 41.2588, longitude: -95.9371 });
  const kj = await kjCtx.newPage();
  await signIn(kj, { role: 'KJ', email: `kj-${run}@example.com` });
  await kj.goto(`${web}/my-venues`, { waitUntil: 'networkidle' });
  await kj.getByRole('button', { name: 'Add a venue' }).first().click();
  await kj.fill('input[placeholder="Venue name"]', listed);
  await kj.fill('input[placeholder="Street address"]', '501 N 16th St');
  await kj.getByRole('button', { name: 'Add venue' }).click();
  await kj.getByText(`${listed} is on the map`).waitFor({ timeout: 10000 });
  const mine = await apiAs(kj, '/venues/mine');
  const venue = mine.body.find((v) => v.name === listed);
  check(!!venue && !venue.claimed && Math.abs(venue.lat - 41.2588) < 0.001, 'KJ lists an unclaimed venue at their GPS position');

  const ownerCtx = await phone(browser);
  const owner = await ownerCtx.newPage();
  const ownerEmail = `claimer-${run}@example.com`;
  await signIn(owner, { role: 'venue', email: ownerEmail });
  await owner.fill('input[placeholder="Search by venue name"]', `Claimable Tap ${run}`);
  await owner.getByRole('button', { name: 'This is mine' }).click();
  const claimBtn = owner.getByRole('button', { name: new RegExp(`Claim ${listed}`) });
  check(await claimBtn.isDisabled(), 'claim needs the owner confirmation');
  await owner.locator('[role=dialog] input[type=checkbox]').check();
  await claimBtn.click();
  await owner.waitForURL(/\/hq$/);
  await owner.getByRole('heading', { name: listed }).first().waitFor({ timeout: 10000 });
  const s = await apiAs(owner, '/profiles/session');
  check(s.body.status === 'ready' && s.body.me.venue?.name === listed && s.body.me.venue.claimed, 'owner now manages the claimed venue');
  check(s.body.email === ownerEmail, 'still signed in as the same person');
  const again = await apiAs(owner, `/venues/${venue.id}/claim`, { method: 'POST' });
  check(again.status === 409, `claiming twice is refused (${again.status})`);
  const notes = await apiAs(kj, '/notifications');
  check((notes.body.items ?? notes.body).some((n) => n.kind === 'venue-claimed'), 'listing KJ is told the venue was claimed');
  const kjVenues = await apiAs(kj, '/venues/mine');
  check(kjVenues.body.find((v) => v.id === venue.id)?.nights.some((n) => n.mine), "KJ's night stays on the schedule");
  await kjCtx.close();
  await ownerCtx.close();
} catch (e) {
  fail(e);
} finally {
  await browser.close();
}
done();

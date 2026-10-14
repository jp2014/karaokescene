// Before/after screenshots for the /changes/ page (apps/web/public/changes).
//
// Usage: node scripts/changes/capture.mjs <before|after> <outDir> [only,names]
//   before: the previous version, e.g. `git worktree add /tmp/ks-old <commit>`, then run its API
//           with PORT=8788 and its web app with `API_URL=http://localhost:8788 vite --port 5174`
//   after:  this checkout's `pnpm dev` on :5173
// Each spec crops to the element that changed and draws a red box around it. For a new
// feedback round, replace the BEFORE/AFTER specs and write to changes/<round>/{before,after}.
// Needs Google Chrome installed (playwright-core drives it).
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const [version, out, onlyArg] = process.argv.slice(2);
const base = version === 'before' ? 'http://localhost:5174' : 'http://localhost:5173';
const only = onlyArg?.split(',');
mkdirSync(out, { recursive: true });

const api = async (path, { token, method = 'GET', body } = {}) => {
  const res = await fetch(`${base}/api${path}`, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${await res.text()}`);
  return res.json();
};
const signIn = async (userId) => (await api('/auth/demo-sign-in', { method: 'POST', body: { userId } })).token;

await api('/debug/reset', { method: 'POST' });
const tokens = { singer: await signIn('usr_jess'), kj: await signIn('usr_velvetvox'), venue: await signIn('usr_neon-mic') };
await api('/presence/check-in', { token: tokens.singer, method: 'POST', body: { venueId: 'ven_neon-mic', method: 'manual' } });
if (version === 'after') {
  const songs = await api('/songs/mine?kjId=usr_velvetvox', { token: tokens.singer });
  const inBook = songs.filter((s) => s.inKjBook);
  const a = await api('/live/submissions', { token: tokens.singer, method: 'POST', body: { songId: inBook[0].id, source: 'list' } });
  await api('/live/submissions', { token: tokens.singer, method: 'POST', body: { songId: inBook[2].id, source: 'roulette' } });
  await api(`/live/submissions/${a.id}/decision`, { token: tokens.kj, method: 'PUT', body: { accept: true } });
}
const setPlan = (who, on) => api('/promo/upgrade', { token: tokens[who], method: 'POST', body: { on } });

const browser = await chromium.launch({ channel: 'chrome' });
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const desktop = await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2 });

// Locator helpers
const section = (title) => (p) => p.locator('section', { has: p.locator('h2', { hasText: title }) }).first();
const card = (text) => (p) => p.locator('div.rounded-3xl', { hasText: text }).last();
const dialog = (p) => p.locator('[role=dialog]').first();
const header = (p) => p.locator('h1').first().locator('xpath=../..');
const click = (text) => async (p) => {
  await p.getByText(text, { exact: false }).first().click();
  await p.waitForTimeout(900);
};

async function shot({ name, path, as, wide, prep, targets, context, pad = 14, maxH = 1100, full = false, noBox = false }) {
  const page = await (wide ? desktop : phone).newPage();
  await page.addInitScript((t) => {
    if (t) {
      sessionStorage.setItem('ks.token', t);
      localStorage.setItem('ks.token', t);
    } else {
      sessionStorage.clear();
      localStorage.clear();
    }
  }, as ? tokens[as] : null);
  await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  // Fixed chrome (bottom tabs, toasts) would cover the crop.
  await page.addStyleTag({ content: 'nav.fixed.bottom-0,[data-sonner-toaster]{display:none!important}' });
  if (prep) await prep(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  const boxes = [];
  for (const t of targets) {
    const loc = t(page);
    const n = await loc.count();
    if (!n) throw new Error(`target not found in ${name}`);
    const b = await loc.first().boundingBox();
    boxes.push(b);
  }
  const ctxFns = context ? (Array.isArray(context) ? context : [context]) : null;
  const ctxBoxes = ctxFns ? await Promise.all(ctxFns.map((c) => c(page).first().boundingBox())) : [...boxes];
  if (noBox) boxes.length = 0;
  // Red boxes around what changed (document coordinates; we're scrolled to the top).
  await page.evaluate((bs) => {
    for (const b of bs) {
      const d = document.createElement('div');
      Object.assign(d.style, { position: 'absolute', left: `${b.x - 5}px`, top: `${b.y - 5}px`, width: `${b.width + 10}px`, height: `${b.height + 10}px`, border: '3px solid #ff2d2d', borderRadius: '16px', boxShadow: '0 0 0 3px rgb(255 45 45 / 0.25)', zIndex: 2147483647, pointerEvents: 'none' });
      document.body.appendChild(d);
    }
  }, boxes);
  const top = Math.max(0, Math.min(...ctxBoxes.map((b) => b.y)) - pad);
  const bottom = Math.max(...ctxBoxes.map((b) => b.y + b.height)) + pad;
  const vw = page.viewportSize().width;
  const clip = wide
    ? { x: 0, y: top, width: Math.min(vw, Math.max(...ctxBoxes.map((b) => b.x + b.width)) + pad), height: Math.min(bottom - top, maxH) }
    : { x: 0, y: top, width: vw, height: Math.min(bottom - top, maxH) };
  await page.screenshot({ path: `${out}/${name}.jpg`, type: 'jpeg', quality: 80, fullPage: true, clip: full ? undefined : clip });
  await page.close();
  console.log('✓', name);
}

const BEFORE = [
  { name: 'welcome-roles', path: '/welcome', targets: [section('Pick a demo persona')] },
  { name: 'welcome-kj', path: '/welcome', targets: [(p) => p.locator('button', { hasText: 'Karaoke DJ' }).locator('p')], context: (p) => p.locator('button', { hasText: 'Karaoke DJ' }) },
  { name: 'menu-singer', path: '/feed', as: 'singer', wide: true, noBox: true, targets: [(p) => p.locator('aside nav')] },
  { name: 'menu-kj', path: '/feed', as: 'kj', wide: true, targets: [(p) => p.locator('aside nav a', { hasText: 'Discover' })], context: (p) => p.locator('aside nav') },
  { name: 'menu-venue', path: '/feed', as: 'venue', wide: true, targets: [(p) => p.locator('aside nav a', { hasText: 'Discover' })], context: (p) => p.locator('aside nav') },
  { name: 'mynight', path: '/live', as: 'singer', targets: [card('On stage'), card('Your turn')] },
  { name: 'mynight-rotation', path: '/live', as: 'singer', targets: [section('The rotation')] },
  { name: 'booth', path: '/kj', as: 'kj', targets: [section('Rotation')], maxH: 900 },
  { name: 'kj-friends', path: '/friends', as: 'kj', targets: [(p) => p.locator('h1', { hasText: 'Your people' }).locator('xpath=../..')], pad: 20 },
  { name: 'venue-feed', path: '/feed', as: 'venue', targets: [(p) => p.getByText('Shout-outs from around the scene')], context: (p) => p.locator('h1').locator('xpath=../..'), maxH: 700 },
  { name: 'venue-profile', path: '/me', as: 'venue', targets: [card('Ghost Mode'), (p) => section('Profile')(p).locator('div.flex.items-center.gap-4').first(), (p) => p.locator('label', { hasText: 'Age range' }), (p) => p.locator('label', { hasText: 'Years' })], context: (p) => p.locator('div.space-y-8', { has: p.getByText('Ghost Mode') }).first(), maxH: 1150 },
  { name: 'singer-avatar', path: '/me', as: 'singer', targets: [(p) => section('Profile')(p).locator('div.flex.items-center.gap-4').first()] },
  { name: 'hq-premiere', path: '/hq', as: 'venue', targets: [card('Premiere Partner')] },
  { name: 'songs-recs', path: '/songs', as: 'singer', targets: [section('Recommended for you')] },
];

const AFTER = [
  { name: 'welcome-roles', path: '/welcome', targets: [section('I am a')] },
  { name: 'welcome-kj', path: '/welcome', targets: [(p) => p.locator('button', { hasText: 'Upload your song book' }).locator('p')], context: (p) => p.locator('button', { hasText: 'Upload your song book' }) },
  {
    name: 'welcome-venue-email', path: '/welcome',
    prep: async (p) => { await click('Continue as a venue')(p); await p.fill('input[type=email]', 'manager@theneonmic.com'); await p.check('input[type=checkbox]'); await p.waitForTimeout(300); },
    targets: [(p) => p.locator('label', { has: p.locator('input[type=checkbox]') })], context: card('Venue sign in'),
  },
  {
    name: 'welcome-verify', path: '/welcome',
    prep: async (p) => { await click('Continue as a singer')(p); await p.fill('input[type=email]', 'jess@example.com'); await click('Email me a code')(p); await p.fill('input[inputmode=numeric]', '123456'); },
    targets: [card('Check your email')],
  },
  { name: 'menu-singer', path: '/feed', as: 'singer', wide: true, targets: [(p) => p.locator('aside nav a[href="/wallet"]')], context: (p) => p.locator('aside nav') },
  { name: 'menu-kj', path: '/feed', as: 'kj', wide: true, targets: [(p) => p.locator('aside nav a[href="/my-venues"]'), (p) => p.locator('aside nav a[href="/friends"]')], context: (p) => p.locator('aside nav') },
  { name: 'menu-venue', path: '/feed', as: 'venue', wide: true, targets: [(p) => p.locator('aside nav a[href="/friends"]')], context: (p) => p.locator('aside nav') },
  { name: 'mynight', path: '/live', as: 'singer', targets: [section('Your songs tonight')] },
  { name: 'mynight-send', path: '/live', as: 'singer', targets: [(p) => p.locator('div.rounded-2xl', { hasText: 'Only songs in' }).last()], context: section('Send a song'), maxH: 520 },
  { name: 'wallet', path: '/wallet', as: 'singer', targets: [(p) => p.locator('div.grid', { has: p.getByText('Tap to use') }).first()], context: (p) => p.locator('div.mx-auto.max-w-3xl').first(), maxH: 760 },
  { name: 'wallet-qr', path: '/wallet', as: 'singer', prep: click('Free well drink'), targets: [dialog], pad: 0, noBox: true },
  { name: 'songs-freeadd', path: '/songs', as: 'singer', prep: click("Can't find a song"), targets: [card('Add any song')] },
  { name: 'songs-kjfilter', path: '/songs', as: 'singer', targets: [(p) => p.locator('div.rounded-2xl', { hasText: "You're at" }).first()], pad: 24 },
  { name: 'friends-invite', path: '/friends', as: 'singer', targets: [card('Invite friends out')], pad: 24 },
  { name: 'friends-invite-sheet', path: '/friends', as: 'singer', prep: async (p) => { await click('Invite out')(p); for (const n of ['Marcus', 'Priya']) await p.locator('[role=dialog] button', { hasText: n }).first().click(); }, targets: [dialog], pad: 0, noBox: true },
  {
    name: 'singer-avatar', path: '/me', as: 'singer',
    prep: async (p) => { await p.locator('input[type=file]').first().setInputFiles(new URL('./selfie.jpg', import.meta.url).pathname); await p.waitForTimeout(2500); },
    targets: [(p) => section('Profile')(p).locator('div.flex.flex-wrap.items-center.gap-4').first()],
  },
  { name: 'scan-regulars', path: '/scan', as: 'singer', targets: [section('Become a Regular')] },
  { name: 'venue-ratings', path: '/venues/neon-mic', as: 'singer', targets: [section('Singers say')] },
  { name: 'venue-rate-sheet', path: '/venues/neon-mic', as: 'singer', prep: click('Rate this venue'), targets: [dialog], pad: 0, noBox: true },
  { name: 'venue-info', path: '/venues/neon-mic', as: 'singer', targets: [section('Hours & food')] },
  { name: 'booth', path: '/kj', as: 'kj', targets: [section('Submitted songs')], maxH: 900 },
  { name: 'myvenues', path: '/my-venues', as: 'kj', targets: [(p) => p.locator('div.rounded-3xl', { hasText: 'The Neon Mic' }).last()] },
  { name: 'myvenues-add', path: '/my-venues', as: 'kj', prep: click('Add a venue'), targets: [dialog], pad: 0, noBox: true },
  { name: 'venue-unclaimed', path: '/venues/leavenworth-lounge', as: 'singer', targets: [card('Unclaimed venue')], context: [(p) => p.locator('h1').first(), card('Unclaimed venue')] },
  { name: 'kj-promote', path: '/friends', as: 'kj', targets: [card('Promote tonight')], context: [header, card('Promote tonight')], pad: 20 },
  {
    name: 'kj-scan-photos', path: '/scan', as: 'kj',
    prep: async (p) => { await p.locator('input[type=file]').first().setInputFiles(new URL('./stage.jpg', import.meta.url).pathname); await p.waitForTimeout(3000); },
    targets: [section('Share photos from tonight')],
  },
  { name: 'venue-feed', path: '/feed', as: 'venue', targets: [(p) => p.getByText('Praise from singers and KJs at')], context: (p) => p.locator('h1').locator('xpath=../..'), maxH: 700 },
  { name: 'venue-settings-details', path: '/me', as: 'venue', targets: [section('Picture & details'), section('Venue type')] },
  { name: 'venue-settings-hours', path: '/me', as: 'venue', targets: [section('Hours'), section('Happy hours')], maxH: 1500 },
  { name: 'venue-settings-food', path: '/me', as: 'venue', targets: [section('Food'), section('Associated KJs')] },
  { name: 'venue-promote', path: '/friends', as: 'venue', targets: [card('Promote tonight')], context: [header, card('Promote tonight')], pad: 20 },
  { name: 'hq-reward', path: '/hq', as: 'venue', targets: [section('Reward singers')], maxH: 700 },
  { name: 'hq-coupon-sheet', path: '/hq', as: 'venue', prep: async (p) => { await p.getByRole('button', { name: 'Coupon' }).first().click(); await p.waitForTimeout(900); }, targets: [dialog], pad: 0, noBox: true },
  { name: 'hq-premier', path: '/hq', as: 'venue', targets: [(p) => p.locator('div.rounded-3xl', { hasText: 'Manage plan' }).last()] },
  { name: 'hq-specials-autopost', path: '/hq', as: 'venue', targets: [(p) => p.locator('div.rounded-2xl', { hasText: 'Auto-post on each of its days' }).first()], context: section('Drink specials') },
  // Free plan: paid features show locked (restored to paid afterwards).
  { name: 'songs-recs-locked', path: '/songs', as: 'singer', prep: async (p) => { await setPlan('singer', false); await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(1200); }, targets: [section('Recommended for you')] },
  { name: 'booth-locked', path: '/kj', as: 'kj', prep: async (p) => { await setPlan('kj', false); await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(1200); }, targets: [section('Auto Leave'), section('Message Blast')] },
  { name: 'hq-locked', path: '/hq', as: 'venue', prep: async (p) => { await setPlan('venue', false); await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(1200); }, targets: [section('Peak hours')] },
];

for (const s of version === 'before' ? BEFORE : AFTER) {
  if (only && !only.includes(s.name)) continue;
  try {
    await shot(s);
  } catch (e) {
    console.log('✗', s.name, e.message.split('\n')[0]);
  }
}
if (version === 'after') for (const who of ['singer', 'kj', 'venue']) await setPlan(who, true);
await browser.close();

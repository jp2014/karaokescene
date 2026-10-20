# Karaoke Scene

A location-based social network for the karaoke community: **Singers**, **KJs** and **Venues** in one ecosystem.
Production uses Supabase Auth, Postgres, Storage and Realtime through a Hono API. Local development includes a fictional Omaha scene; production starts empty.

## Run it

```bash
pnpm install
pnpm dev
```

Open **http://localhost:5173**. No Docker or accounts needed: the first run creates an embedded Postgres
(PGlite, in `apps/api/data`) with the same migrations production uses, and seeds the demo scene.
On your phone (same Wi-Fi), use the "Network" URL Vite prints. Printed QR codes then open on real phones too.

| Command | What it does |
| --- | --- |
| `pnpm dev` | API (`:8787`) + web (`:5173`) with hot reload |
| `pnpm start` | Production-style build (demo included), served by the API as one process on `:8787` |
| `pnpm db:reset` | Wipe and reseed demo data (also available in **Demo controls**) |
| `pnpm typecheck` | Typecheck every package |
| `pnpm db:generate` | Generate a migration after editing `apps/api/src/db/schema.ts` (written to `supabase/migrations`) |
| `pnpm release` | Deploy production (requires hosting accounts; see below) |

Requires Node 22+ and pnpm 10+.

## Demo script

1. **Pick a profile** on the welcome screen (Singer, KJ or Venue), enter any email and any 6-digit code. You land in that
   role's demo persona: Jess (singer), DJ Velvet Vox (KJ) or The Neon Mic (venue).
   The demo clock is set to **Friday 10:15pm**, so nights are live. Change it in Demo controls.
2. **Singer:** browse the map → open The Neon Mic → **Check in** → *My Night*: send a song to the KJ, spin **Song Roulette**,
   rate the venue and KJ. *My Wallet* has venue coupons (one-time QR codes). *Scan & Share* tracks Regular status (5 nights).
3. **KJ:** open a second tab as DJ Velvet Vox (each tab keeps its own persona) → **KJ Booth**: submitted songs arrive and you
   tap **Accept** (the app doesn't mirror the KJ's own rotation software). *My Venues*: hours, Auto Promote, list a new venue.
4. **Auto Leave (KJ Pro):** in the singer tab, *Demo controls → Walk away*. Within ~20s the singer is checked out and the KJ gets an alert.
   *Stand inside venue* triggers the Auto Check-in prompt.
5. **Venue:** *Venue HQ*: post events and drink specials, send coupons to singers, rate KJs, curate the gallery.
   *Profile & Settings*: photo, type, hours, happy hours, menu, associated KJs.
6. **Paid plans:** Singer Plus, KJ Pro and Venue Premier features show locked on the free plan. Personas start upgraded;
   *Demo controls → Paid plan* switches it off and on.
7. **Growth loop:** *Scan & Share* shows your QR card; *Demo controls → A new singer joins via my QR* earns Scene Builder badges.

**What changed, with before/after screenshots:** http://localhost:5173/changes/ while `pnpm dev` is running (source: `apps/web/changes/`; development only, never deployed). Add a round there for every change; `scripts/changes/capture.mjs` captures the cropped, red-boxed screenshots.

**Demo controls** (wrench icon) also include: switching to any of the ~120 accounts, teleporting, time travel, sending a crowd into a venue, and resetting the data.

## Local demo vs. production

The demo (persona sign-in, seeded Omaha scene, **Demo controls**, time travel, simulated GPS and QR scans,
mock checkout) only exists locally:

- **API:** everything demo lives in `apps/api/src/demo` and is mounted at `/api/demo` by the local host
  (`src/hosts/node.ts`). The production host (`src/hosts/edge.ts`) never imports it, and the edge build fails
  if demo code ends up in the bundle.
- **Web:** everything demo lives in `apps/web/src/demo`, reached only through `src/lib/demo.ts` behind the
  build-time `__DEMO__` flag (on for `vite` dev and `pnpm start`, off for real builds), so it's tree-shaken out.

| | Local (`pnpm dev`) | Production (`pnpm release`) |
| --- | --- | --- |
| API host | Node (`src/hosts/node.ts`) | Supabase Edge Function `api` (`src/hosts/edge.ts`) |
| Database | PGlite, or `DATABASE_URL` | Supabase Postgres (`app` schema, not exposed via the Data API) |
| Sign-in | Demo personas (+ Supabase if configured) | Supabase Auth: email code + Google |
| Realtime | In-process bus over SSE | Supabase Realtime (private broadcast channels) |
| Media | `apps/api/data/media` | Supabase Storage (`media` bucket) |
| Scheduled jobs | 60s timer | pg_cron (every 5 min) |
| Push | off | Dormant; use in-app notifications + Realtime |
| Web | Vite dev server | Static host (Cloudflare Pages planned) |

To try real Supabase locally, see `apps/api/.env.example`.

## Production setup

Production is not deployed yet. Hosting direction: a free static web host with Supabase for the backend.
The old `pnpm release` script still targets Netlify and will be replaced in Phase 3. Do not use it yet.

Create a production Supabase project in US East, then configure:

1. Auth: email codes using `supabase/templates/email-code.html`, Google OAuth, and the final site's URL/redirect URLs.
2. Custom SMTP for real users. Supabase's built-in sender only delivers to project team addresses
   ([SMTP documentation](https://supabase.com/docs/guides/auth/auth-smtp)).
3. Database migrations, the `api` Edge Function, and Storage via the release workflow.
4. The static web build with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (public key), and
   `VITE_API_URL=https://<ref>.supabase.co/functions/v1/api`. Service keys never go into web settings.

Leave Firebase settings unset for launch. Push remains dormant; in-app notifications and Realtime work independently.
Payments show “coming soon”; local demo plan toggles never ship in the real build.

### Verify against local Supabase

The stack uses ports 55421 (API), 55422 (Postgres), 55423 (Studio), 55424 (Mailpit).
`npx supabase start` requires Docker. The project's Auth config is for local development;
production URLs and Google credentials must be set separately before deployment.

Run the API with `DEMO=off`, `DATABASE_URL` pointing at local Supabase, `DATABASE_MIGRATE=off`
(if the CLI applied migrations), `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`.
Run Vite with `VITE_DEMO=false`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `API_URL` pointing at that API.
Use separate ports from the demo (8791 / 5174). `npx supabase status` gives the local settings.

Existing browser checks (Chrome required; default web port 5174):

```bash
node scripts/e2e/real-auth.mjs
node scripts/e2e/real-venues.mjs
```

Focused persistence regressions (fresh in-memory database, no Docker required):

```bash
cd apps/api
node --import tsx scripts/check-phase2.ts
```

These check account-claim overlaps, concurrent venue setup, reminder deduplication, and job delivery.
PGlite serializes transactions; real Postgres is still needed to verify multi-connection races.

## Architecture

```
apps/api          Hono REST API (TypeScript), Drizzle ORM, Postgres
apps/web          React 19 PWA: Vite, TanStack Router + Query, Tailwind v4, MapLibre, Motion
packages/api-client  Typed client generated from the API's routes (Hono RPC). A future Expo/React Native app imports this as-is.
```

**API modules** (`apps/api/src/modules/*`). Each exposes a small service interface and thin routes:

| Module | Owns |
| --- | --- |
| `discovery` | Map/list query (20-mi radius, hours filter, KJ Now, busy level, priority listing) and venue detail |
| `presence` | Check-in/out, the geolocation heartbeat (Auto Check-in / Auto Leave), KJ Now sessions, Peak Hours, Singers Near You |
| `live` | Song submissions (singer sends, KJ accepts), KJ booth, singer's "My Night" |
| `venues` | Schedules, events, drink specials, RSVPs ("who's going"), gallery, venue settings, KJ-listed venues and claims |
| `wallet` | Venue coupons: awarded by venues, redeemed once by scanning the singer's QR |
| `profiles` | Supabase identity, role onboarding, privacy-filtered profile views, Ghost Mode |
| `social` | Friends, favorites, blocks, positive-only praise |
| `reputation` | Badge catalog and award rules (KJ→singer, venue→KJ, growth badges) |
| `songs` | Catalog, personal song lists, roulette, recommendations, KJ songbooks + CSV import |
| `qr` | QR scan handling and the referral growth loop |
| `promo` | Share reminders, Auto Promote, Message Blast; users share through native share, Facebook links, SMS or clipboard |
| `media` | Photo and menu uploads (Supabase Storage; disk locally) |
| `wallet` | Venue coupons: awarded by venues, redeemed once by scanning the singer's QR |
| `notifications` | In-app notifications, Realtime nudges and FCM push |

All "now" logic goes through `lib/clock.ts`, which is how the demo time-travels (the offset is always 0 in production).
Platform adapters (`lib/realtime.ts`, `lib/storage.ts`, `lib/push.ts`) are chosen by the host, so modules don't know where they run.

### Real vs. not built yet

**Real:** accounts and sign-in (Supabase Auth), profiles, privacy, check-ins, KJ sessions, song submissions, badges, praise,
friends/blocks/favorites, events, specials, RSVPs, songbooks, song lists, coupons, notifications (Realtime + FCM push),
photo and menu uploads (Storage), promo post scheduling, GPS.

**Not built yet** (production shows "coming soon"; the local demo mocks them):
- Payments (Singer Plus, KJ Pro, Venue Premier).
- Automated publishing to Facebook/Instagram (replaced with manual sharing).

**Real onboarding:** email code or Google → explicit role selection → profile. Venue owners can add their own
venue or claim an unclaimed KJ listing, with an ownership declaration. Claims preserve the listing’s reputation
and notify its listing KJ. This is self-serve; ownership is not independently verified.

**Promotion:** sharing works without paid plans. Paid Auto Promote queues a reminder for the next show when
the KJ opens Booth/My Venues; it refreshes on later visits. Special reminders cover the next seven days.
Scheduled jobs deliver each due reminder once, with a link back to its share page; they do not publish to social networks.

### Hosting flexibility

- The API is `app.fetch` from Hono; `src/hosts/*` adapt it to Node and Supabase Edge Functions (Deno). Another host is one small file.
- `VITE_API_URL` points the web app (or a mobile app) at a remote API. `SCENE_TZ` sets the scene timezone (default `America/Chicago`).

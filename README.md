# Karaoke Scene

A location-based social network for the karaoke community: **Singers**, **KJs** and **Venues** in one ecosystem.
Production uses Supabase Auth, Postgres, Storage and Realtime through a Hono API. Local development includes a fictional Omaha scene; production starts with no venues or accounts.

**Song catalog:** the base catalog (`apps/api/catalog/base-songs.csv`, from KaraFun's public catalog, most popular first)
plus every KJ's imported songbook. Each release loads the base file after migrations, only when it changed.
To refresh it from a new KaraFun export: `cd apps/api && node --import tsx scripts/prepare-base-songs.ts <export.csv>`, then commit the file.

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
| `pnpm db:base-songs` | Load the base song catalog into the local database (stop `pnpm dev` first; `pnpm db:reset` removes it) |
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
| Sign-in | Demo personas (+ Supabase if configured) | Supabase Auth: email/password |
| Realtime | In-process bus over SSE | Supabase Realtime (private broadcast channels) |
| Media | `apps/api/data/media` | Supabase Storage (`media` bucket) |
| Scheduled jobs | 60s timer | pg_cron (every 5 min) |
| Push | off | Dormant; use in-app notifications + Realtime |
| Web | Vite dev server | Cloudflare Workers Static Assets |

To try real Supabase locally, see `apps/api/.env.example`.

## Production setup

[Deployment setup and operations](docs/deployment.md) covers the GitHub `production` environment,
Cloudflare Worker, Supabase Auth, and the exact secrets and variables to configure.

`.github/workflows/pipeline.yml` runs on pull requests and pushes to `main`:

- **Verify:** typecheck, focused regressions, fresh Supabase migrations, real Auth/venue browser checks,
  Edge Runtime smoke, production builds with demo exclusion, and a Workers deployment dry run.
- **Deploy production:** after verification on `main`, build both production artifacts, apply migrations,
  deploy the API, check its embedded commit and database access, deploy the frontend, then verify assets,
  browser rendering and browser-to-API connectivity. PR checks never receive production credentials.

A running main pipeline is not superseded. GitHub keeps only the newest pending run when several pushes queue.
Use backward-compatible migrations: an older frontend/API may remain active during a release.
There are no hosted PR previews or separate staging project yet.

```bash
pnpm release --check   # Validate settings and build; no remote writes
pnpm release           # Same ordered release used by GitHub Actions
node --test scripts/*.test.mjs
```

Local releases read ignored `.env.deploy`; GitHub uses environment secrets/variables.
`--check` does not verify remote credentials, Auth provider settings or email delivery.
The old Netlify configuration is removed; an existing Netlify site must be disabled in that account.

### Verify against local Supabase

The stack uses ports 55421 (API), 55422 (Postgres), 55423 (Studio), 55424 (Mailpit).
`pnpm exec supabase start` requires Docker. The project's Auth config is for local development;
production URLs and Confirm email OFF must be set separately before deployment.

Run the API with `DEMO=off`, `DATABASE_URL` pointing at local Supabase, `DATABASE_MIGRATE=off`
(if the CLI applied migrations), `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`.
Run Vite with `VITE_DEMO=false`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `API_URL` pointing at that API.
Use separate ports from the demo (8791 / 5174). `pnpm exec supabase status` gives the local settings.

Existing browser checks (Chrome required; default web port 5174):

```bash
node scripts/e2e/real-auth.mjs
node scripts/e2e/real-venues.mjs
```

Verify the actual Edge Runtime too (it uses Kong internally, so the local public JWT issuer is explicit):

```bash
# Create a local ignored env file containing AUTH_JWT_ISSUER=http://127.0.0.1:55421/auth/v1
pnpm exec supabase functions serve api --no-verify-jwt --env-file /path/to/local-edge.env
# In another terminal:
node scripts/e2e/edge-smoke.mjs
```

Keep `AUTH_JWT_ISSUER` unset in hosted production; there the default Supabase URL matches the token issuer.
The smoke check validates real password authentication, onboarding, and absence of demo endpoints through the Edge URL.

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
| `songs` | Catalog (base catalog + KJ imports), personal song lists, roulette, recommendations, KJ songbooks + CSV import |
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

**Real onboarding:** role selection → email/password signup → profile. Venue owners can add their own
venue or claim an unclaimed KJ listing, with an ownership declaration. Claims preserve the listing’s reputation
and notify its listing KJ. This is self-serve; ownership is not independently verified.

**Promotion:** sharing works without paid plans. Paid Auto Promote queues a reminder for the next show when
the KJ opens Booth/My Venues; it refreshes on later visits. Special reminders cover the next seven days.
Scheduled jobs deliver each due reminder once, with a link back to its share page; they do not publish to social networks.

### Hosting flexibility

- The API is `app.fetch` from Hono; `src/hosts/*` adapt it to Node and Supabase Edge Functions (Deno). Another host is one small file.
- `VITE_API_URL` points the web app (or a mobile app) at a remote API. `SCENE_TZ` sets the scene timezone (default `America/Chicago`).

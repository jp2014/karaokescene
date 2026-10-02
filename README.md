# Karaoke Scene: POC

A location-based social network for the karaoke community: **Singers**, **KJs** and **Venues** in one ecosystem.
This is a high-fidelity, functional demo seeded with a fictional Omaha scene.

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
| `pnpm release` | Ship to production: Supabase (migrations, secrets, Edge Function) + Netlify (PWA) |

Requires Node 22+ and pnpm 10+.

## Demo script

1. **Pick a persona** on the welcome screen: Jess (singer), DJ Velvet Vox (KJ) or The Neon Mic (venue).
   The demo clock is set to **Friday 10:15pm**, so nights are live. Change it in Demo controls.
2. **Singer:** browse the map → open The Neon Mic → **Check in** → *My Night*: request a song, spin **Song Roulette**, praise someone on stage.
3. **KJ:** open a second tab as DJ Velvet Vox (each tab keeps its own persona) → **KJ Booth**: watch requests arrive,
   call singers up, pull songs from a singer's go-to list, award badges.
4. **Auto Leave:** in the singer tab, *Demo controls → Walk away*. Within ~20s the singer is checked out and the KJ gets an alert.
   *Stand inside venue* triggers the Auto Check-in prompt.
5. **Venue:** *Venue HQ*: post events and drink specials, rate KJs, curate the gallery, toggle **Premiere Partner** (gold pin, priority listing).
6. **Growth loop:** *Scan & Share* shows your QR card; *Demo controls → A new singer joins via my QR* earns Scene Builder badges.

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
| Sign-in | Demo personas (+ Supabase if configured) | Supabase Auth: Google, Apple, Facebook |
| Realtime | In-process bus over SSE | Supabase Realtime (private broadcast channels) |
| Media | `apps/api/data/media` | Supabase Storage (`media` bucket) |
| Scheduled jobs | 60s timer | pg_cron (every 5 min) |
| Push | off | FCM (if configured) |
| Web | Vite dev server | Netlify (static) |

To try real Supabase locally, see `apps/api/.env.example`.

## Deploying

One-time setup:

1. Create a Supabase project. In **Authentication → Sign In / Providers**, enable Google, Apple and Facebook
   (each needs an OAuth app in that provider's console), and add your site URL under **URL Configuration**.
2. Optional push: create a Firebase project, generate a service account key and a Web Push (VAPID) key.
3. `cp .env.deploy.example .env.deploy`, fill it in, and log the CLIs in once:
   `npx supabase@2 login` and `npx netlify-cli@27 login`.

Then every release is:

```bash
pnpm release
```

It typechecks, pushes migrations (`supabase/migrations`), sets function secrets, bundles and deploys the
API Edge Function, then builds the PWA against it and deploys to Netlify.

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
| `live` | The night's rotation: requests, KJ booth, singer's "My Night" |
| `venues` | Schedules, events, drink specials, RSVPs ("who's going"), gallery curation |
| `profiles` | Identity, demo sign-in, privacy-filtered profile views, Ghost Mode |
| `social` | Friends, favorites, blocks, positive-only praise |
| `reputation` | Badge catalog and award rules (KJ→singer, venue→KJ, growth badges) |
| `songs` | Catalog, personal song lists, roulette, recommendations, KJ songbooks + CSV import |
| `qr` | QR scan handling and the referral growth loop |
| `promo` | Auto-posting (mocked) and paid upgrades (mocked) |
| `notifications` | In-app notifications, Realtime nudges and FCM push |

All "now" logic goes through `lib/clock.ts`, which is how the demo time-travels (the offset is always 0 in production).
Platform adapters (`lib/realtime.ts`, `lib/storage.ts`, `lib/push.ts`) are chosen by the host, so modules don't know where they run.

### Real vs. not built yet

**Real:** accounts and sign-in (Supabase Auth), profiles, privacy, check-ins, KJ sessions, rotation, badges, praise,
friends/blocks/favorites, events, specials, RSVPs, songbooks, song lists, notifications (Realtime + FCM push),
gallery uploads (Storage), promo post scheduling, GPS.

**Not built yet** (production shows "coming soon"; the local demo mocks them):
- Payments (Pro, Plus, Premiere Partner).
- Delivering promo posts to Facebook/Instagram (requires Pro).
- KJ and venue onboarding: new sign-ins are singers. Promote an account by setting `app.users.role`
  (and `app.venues.owner_id` for a venue) in the Supabase SQL editor.

### Hosting flexibility

- The API is `app.fetch` from Hono; `src/hosts/*` adapt it to Node and Supabase Edge Functions (Deno). Another host is one small file.
- `VITE_API_URL` points the web app (or a mobile app) at a remote API. `SCENE_TZ` sets the scene timezone (default `America/Chicago`).

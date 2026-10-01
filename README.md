# Karaoke Scene: POC

A location-based social network for the karaoke community: **Singers**, **KJs** and **Venues** in one ecosystem.
This is a high-fidelity, functional demo seeded with a fictional Omaha scene.

## Run it

```bash
pnpm install
pnpm dev
```

Open **http://localhost:5173**. The first run creates and seeds a SQLite database automatically.
On your phone (same Wi-Fi), use the "Network" URL Vite prints. Printed QR codes then open on real phones too.

| Command | What it does |
| --- | --- |
| `pnpm dev` | API (`:8787`) + web (`:5173`) with hot reload |
| `pnpm start` | Production build, served by the API as one process on `:8787` |
| `pnpm db:reset` | Wipe and reseed demo data (also available in **Demo controls**) |
| `pnpm typecheck` | Typecheck every package |
| `pnpm db:generate` | Generate a migration after editing `apps/api/src/db/schema.ts` |

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

## Architecture

```
apps/api          Hono REST API (TypeScript), Drizzle ORM, SQLite via libSQL
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
| `notifications` | In-app notifications (polled; swap for push/websockets later) |
| `debug` | Demo controls: reset, clock, crowds, referrals |

All "now" logic goes through `lib/clock.ts`, which is how the demo time-travels.

### Real vs. mocked

**Real, stored in SQLite:** accounts, profiles, privacy, check-ins, KJ sessions, rotation, badges, praise, friends/blocks/favorites,
events, specials, RSVPs, songbooks, song lists, notifications, promo posts.

**Mocked:**
- Google/Facebook login. Bearer-token sessions already exist, so OAuth only changes how tokens get issued.
- Posting to Facebook/Instagram.
- Payments (Pro, Plus, Premiere Partner).
- Photo uploads (the gallery uses generated art).
- Push notifications (polled every ~6s).
- GPS (simulated by default; real GPS can be toggled on).

### Hosting flexibility

- The API is `app.fetch` from Hono, so it runs on Node (current), Bun, Deno, Cloudflare Workers, AWS Lambda, Fly, Render, etc.
- Set `DATABASE_URL=libsql://…` + `DATABASE_AUTH_TOKEN` to use Turso instead of the local file. Moving to Postgres means swapping Drizzle's dialect.
- `VITE_API_URL` points the web app (or a mobile app) at a remote API. `SCENE_TZ` sets the scene timezone (default `America/Chicago`).

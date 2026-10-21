# Deployment

One GitHub Actions workflow owns the release order for Supabase and Cloudflare Workers Static Assets.
Do not enable a separate Cloudflare Git build or Supabase Git deployment for this repository.
The pipeline is ready in source; production accounts and credentials must be configured before its first release.

## One-time setup

1. Create the production Supabase project in US East. Keep `app` out of the Data API's exposed schemas.
2. Create a Cloudflare account and select a Workers subdomain. You can create a `karaokescene` Hello World
   Worker to establish the URL; our first deployment replaces it. The CLI can also create the Worker.
3. In GitHub, open **Settings → Environments → New environment**, name it **production**, and allow
   deployments from `main` only. Configure the settings below. No additional approval gate is required.
4. Under **Settings → Rules → Rulesets** (or branch protection), require a pull request and the
   **Verify** check before merging into `main`. The workflow runs only after it is pushed to GitHub.
5. Merge the pipeline and application changes into `main`. A successful verification triggers production
   automatically. **Actions → Pipeline → Run workflow** on `main` can retry a release.

### GitHub production secrets

| Name | Value |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI deployment access token |
| `SUPABASE_DB_PASSWORD` | Production project's database password |
| `CLOUDFLARE_API_TOKEN` | Token with Workers Scripts edit permission, scoped to the production account |

### GitHub production variables

| Name | Value |
| --- | --- |
| `SUPABASE_PROJECT_REF` | 20-letter Supabase project reference |
| `SUPABASE_ANON_KEY` | Public publishable key, or legacy `anon` key |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID |
| `CLOUDFLARE_WORKER_NAME` | `karaokescene`, or your chosen Worker name |
| `SITE_URL` | Exact HTTPS origin, such as `https://karaokescene.your-subdomain.workers.dev` |

The service-role key is injected into Supabase Edge Runtime by Supabase. It is not a frontend setting.
The release config rejects secret/service-role keys in `SUPABASE_ANON_KEY`.
For a custom domain, configure it on the Worker separately; changing `SITE_URL` alone does not attach DNS.

### Supabase Auth and email

Configure once in the production dashboard:

- Site URL: the exact `SITE_URL`; allow `<SITE_URL>/welcome` as an OAuth redirect.
- Email OTP: six digits. Paste `supabase/templates/email-code.html` into the confirmation and magic-link
  email templates. They must contain `{{ .Token }}`, rather than a link-only message.
- Configure custom SMTP for users outside your project team. The built-in sender is for testing.
- Enable Google using its OAuth client credentials. Its Google callback URL is
  `https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`.
- Leave Firebase unset for launch. Paid plans remain coming soon.

Do not run `supabase config push` against production using this repository's local Auth URLs.
Keep `AUTH_JWT_ISSUER` unset in production; the override is for local Docker verification only.
OAuth-provider credentials, SMTP and remote dashboard configuration are not changed by routine releases.

## Pull request verification

The `Verify` job has no production secrets. It installs tools pinned by the lockfile, runs TypeScript and
focused regression checks, builds the Edge Function, then starts a fresh local Supabase stack on the
GitHub runner. This applies every migration, including Storage, Realtime and pg_cron setup.
It builds the real frontend against that stack and exercises real email OTP, all roles, owner creation,
venue claims, and authenticated Edge database access. It finishes with a Workers deployment dry run.
Google credentials in that job are local placeholders; this does not test external Google OAuth.
The temporary stack is stopped and discarded even when verification fails.

## Production release

Only verified `main` commits reach the `production` job. Both artifacts build before remote mutation:

1. Push pending Supabase migrations. Never reset the production database or run demo seeds.
2. Configure the API's site origin/timezone and deploy the bundled Edge Function.
3. Verify its **compiled-in** Git SHA, CORS and a read-only database-backed discovery response.
4. Upload the frontend to Workers Static Assets with SPA routing and no server-side Worker script.
5. Check frontend release metadata, root/client routes and referenced JS/CSS, then run a read-only
   browser check that renders the app, opens the email form and reads discovery through the real API.

Each failed step stops subsequent steps. The running main pipeline cannot be automatically superseded;
GitHub replaces older pending runs with the newest pending commit. PR checks can be canceled by a newer push.
Successful releases record commit and URLs in the Actions summary. Built API/frontend artifacts are retained
for 14 days, including when deployment fails after building. There is no automatic database rollback.

## Failures and rollback

- A migration or API failure leaves the previous frontend deployed. Fix the issue and rerun the release.
- A frontend smoke failure marks the release failed; the new frontend may already be live.
- Prefer reverting the faulty application commit and releasing again. Correct schema defects with a new
  forward migration. A reverted commit must retain already-applied migrations in the repository.
- Keep migrations compatible with both the old and new application. Add columns first; remove obsolete
  columns only in a later release after old code no longer uses them. Old browser tabs can outlive a deploy.

## Local commands

`pnpm release --check` builds without deploying, using `.env.deploy` (copy `.env.deploy.example`).
`pnpm release` uses the same ordered release as CI; local CLI logins may substitute for access tokens.
CLI versions are pinned in `package.json` and the lockfile.

For a CI-style local verification, start a **disposable** Supabase stack with `pnpm exec supabase start`,
build the Edge bundle, then run `node scripts/ci/verify-local.mjs`. It creates local test users/venues but
never resets an existing database. Default browser is Chrome; CI sets `PLAYWRIGHT_CHANNEL=chromium` and
installs the matching browser with `pnpm exec playwright-core install --with-deps chromium`.

References: [Supabase CI deployment](https://supabase.com/docs/guides/deployment/managing-environments),
[Cloudflare SPA hosting](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/).

# Strava feed — a free workaround for the Strava API paywall

The **Strava** app in AndreOS shows André's activity history, and the OS Assistant can
answer questions about it. This document explains how that data gets there without paying
for the Strava API.

## Why

Strava now gates its data API behind a paid subscription — even a personal API app can't
be created on a free account. Rather than pay for access to *your own* data, AndreOS uses
a fully free approach:

- **No API, no subscription.** Instead of the official API, a scheduled job reuses your own
  logged-in **session cookie** (the long-lived `strava_remember_token`) to read your
  activities from the same internal endpoint Strava's web dashboard uses. It's just your
  own account reading your own data — no login automation, no third-party service.
- **No server to run.** The data is cached in **Cloudflare Workers KV** (free tier) and
  served by a tiny **Pages Function**, so the site stays fully static and $0 to host.
- **Self-updating.** A weekly **GitHub Action** (free CI) refreshes the feed; when the
  cookie eventually expires you just update one secret.

## How it works

```
Weekly GitHub Action ─▶ scripts/fetch-strava.mjs ─▶ Cloudflare KV ─▶ /api/strava-feed ─▶ Strava app
     (cron)                (uses a session cookie)      (activities)   (Pages Function)   (+ assistant)
```

1. A scheduled [GitHub Action](../.github/workflows/strava-feed.yml) reuses a stored Strava
   **session cookie** (no login automation) to fetch the full activity history via
   [`scripts/fetch-strava.mjs`](../scripts/fetch-strava.mjs). It warms a session from the
   `strava_remember_token`, then pages through `training_activities` until it reaches
   already-known activities (incremental), normalising each row to numeric metres/seconds
   plus an ISO start time.
2. It uploads the normalised JSON to a **Workers KV** namespace (key `activities`).
3. The Pages Function [`functions/api/strava-feed.js`](../functions/api/strava-feed.js)
   reads that key and serves it at `/api/strava-feed`.
4. The Strava app and the assistant's context provider fetch that endpoint, falling back to
   a static `public/strava/activities.json` for local dev.

## One-time setup

1. **Create a KV namespace:** Cloudflare dashboard → **Storage & Databases → KV → Create**,
   and note its **Namespace ID**.
2. **Bind it to the Pages project:** project → **Settings → Functions → KV namespace
   bindings** → add a binding named **`STRAVA_KV`** pointing at that namespace, then redeploy.
3. **Create an API token:** **My Profile → API Tokens → Create Token** with the
   **Account · Workers KV Storage · Edit** permission.
4. **Add repository secrets** (GitHub → Settings → Secrets and variables → Actions):

   | Secret | Value |
   |---|---|
   | `STRAVA_COOKIE` | Full cookie string incl. the long-lived `strava_remember_token` (+ `strava_remember_id`) |
   | `CF_ACCOUNT_ID` | Cloudflare account ID |
   | `CF_KV_NAMESPACE_ID` | The KV namespace ID from step 1 |
   | `CF_API_TOKEN` | The API token from step 3 |

### Getting the session cookie

1. Log in to strava.com in your browser (keep "Remember me" enabled).
2. DevTools → **Application → Cookies → https://www.strava.com**.
3. Copy `strava_remember_token`, `strava_remember_id`, and `_strava4_session` into one string:

   ```
   strava_remember_id=…; strava_remember_token=…; _strava4_session=…
   ```

4. Store it as the `STRAVA_COOKIE` secret. The `strava_remember_token` is the long-lived one
   that keeps the weekly job working; `_strava4_session` rotates but is re-minted on each run.

## Running it

- The workflow runs weekly and can be triggered manually from the **Actions** tab.
- Runs are **incremental** by default (only new activities are fetched). Tick
  **"Full re-fetch"** on a manual run to rebuild the entire feed — needed after any change to
  the stored data shape.

## Notes

- **It's your own data.** This only ever reads your own account through your own session —
  no scraping of other users, no credentials shared with any third party. Treat the cookie as
  a secret; it grants access to your Strava account.
- **Durability.** The `strava_remember_token` typically lasts months. If a run fails with a
  `401`/login redirect, refresh the `STRAVA_COOKIE` secret.

# Deploying Shield Safe Bank

The app is two pieces. Both must be live for the admin panel to see everyone.

## 1. The shared backend (required)

This holds users, balances, chats and verification state for **all** devices.
Without it the app silently falls back to per-browser storage — which is why
chats from other computers were not visible.

Deploy it to Render from this repo (config lives in `render.yaml`):

1. Push this repo to GitHub (already done).
2. On [render.com](https://render.com) → **New → Blueprint** → pick this repo.
   Render reads `render.yaml` and creates the service.
3. When it finishes you get a URL like `https://shieldsafebank-api.onrender.com`.

Any Node host works (Railway, Fly.io, a VPS). It needs:
- Node 20+, `npm install && npm start` inside `server/`
- `DATABASE_URL` pointing at a Postgres database (Supabase is what we use)

If `DATABASE_URL` is not set, the server still falls back to a local
`server/data/store.json` file (or `DATA_DIR/store.json`) so local development
works without Postgres.

## 1b. Supabase Postgres (`DATABASE_URL`)

Chats, users, balances and KYC now live in Postgres so they survive Render
free-tier restarts. Set this on the **shieldsafebank-api** service in Render
(Dashboard → **Environment** → *Environment Variables*), **not** on the
frontend service:

```
DATABASE_URL=postgresql://postgres.[project-ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres
```

Accepted forms (the driver reads any standard Postgres URI):

| Form | Example |
| --- | --- |
| Transaction pooler (port `6543`) | `postgresql://postgres.[ref]:[pw]@aws-0-[region].pooler.supabase.com:6543/postgres` |
| Session pooler (port `5432`) | `postgresql://postgres.[ref]:[pw]@aws-0-[region].pooler.supabase.com:5432/postgres` |
| Direct connection | `postgresql://postgres:[pw]@db.[ref].supabase.co:5432/postgres` |

`postgres://` works too. Keep `?sslmode=require` (or nothing) — the server
already forces SSL for any non-localhost host, so no extra flag is needed.

How to get that string:

1. Open the Supabase project → **Project Settings → Database**.
2. Copy the **URI** connection string (Session pooler / Transaction pooler both
   work). Replace `[YOUR-PASSWORD]` with the database password.
3. In Render: **shieldsafebank-api → Environment → Add Environment Variable**,
   key `DATABASE_URL`, paste the URI, then **Save Changes**. Render restarts the
   service; the API creates its tables on first boot.

If `DATABASE_URL` is set but wrong, the service crash-loops and Render's
`/api/health` check fails — remove or fix the variable to recover.

Do **not** commit the URI or password to git.

### One-time data move from `store.json`

Run this once from `server/` so existing sign-ups and chat history are copied
into Postgres (nothing is deleted from the JSON file):

```
cd server
npm install
DATABASE_URL="postgresql://..." node migrate-store.js ./data/store.json
```

If the live Render process still has chats that never made it to disk (common
on the free tier), pull them from the running API as well:

```
DATABASE_URL="postgresql://..." node migrate-store.js --from-live https://shieldsafebank-api.onrender.com
```

`--from-live` merges users/threads/messages from the API with passwords from
`store.json` (or the demo accounts). After it finishes, restart the API so it
loads from Postgres.

## 2. Point the frontend at the backend

The frontend already defaults to the hosted API (`HOSTED_API_BASE` in
`src/lib/config.ts`), so nothing has to be set for `shieldsafebank-api.onrender.com`.
To point it somewhere else, set an environment variable on the frontend build:

```
VITE_API_BASE=https://shieldsafebank-api.onrender.com/api
```

The `/api` suffix matters — `API_BASE` is used as a prefix, so every call is
`${VITE_API_BASE}/auth/login` and similar. Use the `*.onrender.com/api` form
(not the bare origin), then redeploy the frontend.

On every app load the client fires a fire-and-forget `GET /api/health` ping
(`wakeBackend()` in `src/lib/api.ts`) so a sleeping Render free-tier instance
starts warming before the customer opens chat or the admin console. Requests
also wait up to 40s (`REQUEST_TIMEOUT_MS`) to survive a cold start.

## 3. Recovering messages that were sent while offline

Messages written before the backend was reachable were saved in the sender's
browser only. When that person next opens the app **and the backend is
reachable**, those messages upload automatically and appear in the admin
Chat Inbox. Nothing needs to be done by hand.

## 4. Local server fallback

If the configured backend cannot be reached, the API layer automatically retries
each request against `http://localhost:4000/api` (`LOCAL_API_BASE` in
`src/lib/config.ts`). That keeps chats, users and balances shared between every
browser — including incognito windows, which have their own separate
`localStorage` — instead of silently degrading to per-browser storage. It only
helps when `node server/index.js` is actually running.

Admins can answer one conversation at a time or use **Reply to All** in the Chat
Inbox to broadcast a single message to every open thread
(`POST /api/admin/threads/reply-all`).

## Local development

Start the shared server **first** (it is what makes every browser see the same
data), then the app:

```
node server/index.js        # shared backend on http://localhost:4000
npm run start:dev           # Vite dev server on http://localhost:8443
```

`npm run start:dev` proxies `/api` → `http://localhost:4000`, but it does not
start the backend itself. `npm start` only serves the prebuilt `dist/` folder
through `node start.mjs` and does not provide an API either.

To use the production build locally:

```
npm run build
npm start                   # serves dist/ on http://localhost:3000
```

On localhost the app calls `/api`, which `node start.mjs` does not proxy; the
API layer's localhost fallback then reaches `http://localhost:4000/api`
directly, so the shared server must still be running.

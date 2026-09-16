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
- A persistent directory for the data file, exposed as `DATA_DIR`
  (defaults to `server/data` locally).

## 2. Point the frontend at the backend

Set an environment variable on the frontend build:

```
VITE_API_BASE=https://shieldsafebank-api.onrender.com
```

(replace with your real backend URL). Then redeploy the frontend. If it is not
set, the app uses `/api`, which only works where the backend runs on the same
host.

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

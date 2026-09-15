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

## Local development

```
npm start
```

Starts both the app (http://localhost:8443) and the shared server
(http://localhost:4000).

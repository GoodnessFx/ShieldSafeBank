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

### Chat

Chatting works like a normal chat app: customers and admins can exchange as
many messages as they like, whenever they like — nothing closes either side's
input, and there are no timers, countdowns or automated replies.

* Every message is appended to the thread and persisted in Postgres (or the
  local file store without `DATABASE_URL`), so both sides see the complete
  history whenever they come back.
* While an admin console holds its chat stream open, the widget header shows a
  green **Agent online** dot. When nobody is connected the dot turns grey outside
  the advertised hours (Mon–Fri, 9am–6pm New York time); the empty chat still
  shows those hours. The dot is honest — it is not always on.
* Presence is a public endpoint that only exposes a count, so the widget can
  check it before chatting: `GET /api/chat/presence` →
  `{ ok: true, agents: <number>, agentOnline: <boolean> }`.

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

On Windows PowerShell that is `$env:DATABASE_URL="postgresql://..."; node migrate-store.js ./data/store.json`.
Alternatively drop `DATABASE_URL=postgresql://...` into a **git-ignored**
`server/.env` and run `node migrate-store.js` — the script reads that file when
the variable is not already set, so the URI never lands in your shell history.

If the live Render process still has chats that never made it to disk (common
on the free tier), pull them from the running API as well:

```
DATABASE_URL="postgresql://..." node migrate-store.js --from-live https://shieldsafebank-api.onrender.com
```

`--from-live` merges users/threads/messages from the API with passwords from
`store.json` (or the demo accounts). Preview what it would write, with no
connection string and no writes, using `--dry-run`:

```
node migrate-store.js --from-live https://shieldsafebank-api.onrender.com --dry-run
```

After it finishes, restart the API so it loads from Postgres.

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

## 5. Email delivery (Resend)

Password-reset links and email-verification codes are sent via
[Resend](https://resend.com). The server only attempts to send when
`RESEND_API_KEY` is present — without it the endpoint returns a `500` with a
clear error so the user is never told "check your email" when nothing was sent.

Both messages come from `no-reply@shieldsafebank.com` (single source of truth:
`MAILBOX` / `MAIL_FROM` in `server/email-config.js`), which is why that domain
must be **verified in Resend** before any code or reset link can be delivered —
see *Domain verification* below, and check your progress at any time with
`npm run check-email` inside `server/`.

### Environment variables (set on the **shieldsafebank-api** service in Render)

| Variable | Required | Notes |
|---|---|---|
| `RESEND_API_KEY` | **Yes** for email | Get from Resend dashboard → API Keys. **Sending access** is enough for the server itself; a **Full access** key is only needed by `check-email-dns.js` to read the record list and verification status. Never commit to git. |
| `APP_URL` | Recommended | Base URL of the **frontend** (e.g. `https://shieldsafebank.com`). Used to build the `/reset-password?token=…` link in the reset email. Defaults to `https://shieldsafebank.com` if not set. |

### Adding the variables on Render

1. Open **shieldsafebank-api → Environment → Environment Variables**.
2. Add `RESEND_API_KEY` with the value from your Resend dashboard.
3. Add `APP_URL` with your frontend URL (no trailing slash).
4. Click **Save Changes** — Render restarts the service automatically.

### Domain verification in Resend (required before emails deliver)

**Status: the API key is live, the domain is not verified.** A probe of the
deployed API on 2026-09-24 returned the Resend error rather than "Email service
is not configured on this server":

```
POST /api/auth/forgot-password  →  500
{"error":"The shieldsafebank.com domain is not verified. Please, add and verify your domain on https://resend.com/domains"}
```

That proves `RESEND_API_KEY` is correct and sending — only the DNS records are
missing (`send.`, `rsend.`, `resend._domainkey.` and `_dmarc.` all return
NXDOMAIN). Until they exist **no verification code or reset link reaches
anybody**: the endpoint stores the code, the send fails, the code is deleted
again, and the user sees the error above.

#### Step 1 — see the current state

```
cd server
node check-email-dns.js        # npm run check-email
```

Put a key in the git-ignored `server/.env` first. A **Full access** key lets the
script read the expected records and the verification status straight from
Resend; a **Sending access** key (or no key) still runs every DNS check and
still allows `--send-test`, it just falls back to the standard record set. Exit
code 0 means everything is in place. Re-run it after every DNS change.

#### Step 2 — add the domain in Resend

[resend.com/domains](https://resend.com/domains) → **Add Domain** →
`shieldsafebank.com`. Leave the region on the default (`us-east-1`) unless you
change it deliberately — it decides which `feedback-smtp` hostname the MX record
must point at. Keep the page open: the **Value** column holds long strings that
must be copied verbatim.

#### Step 3 — add the records at your DNS provider

DNS for this domain is hosted by **Global Domain Group LLC**
(`ns1`/`ns2.globaldomaingroup.com`, registrar IANA 3956). Global Domain Group is
a white-label registrar, so there is no GDG login: records are edited in the
panel the domain was bought from, under *Domain Names → shieldsafebank.com →
Manage DNS Records* (often *Advanced DNS*). The root domain has no TXT or MX
records at all today, so all four below are new:

| Type | Host (paste this) | Full record name | Value (target) |
| --- | --- | --- | --- |
| TXT | `resend._domainkey` | `resend._domainkey.shieldsafebank.com` | `p=MIGfMA0GCS…` — copy the **whole** key from Resend |
| CNAME | `send` | `send.shieldsafebank.com` | `send.forge.rmta.net` |
| CNAME | `rsend` | `rsend.shieldsafebank.com` | `rsend-euw1.forge.rmta.net` |
| TXT | `_dmarc` | `_dmarc.shieldsafebank.com` | `v=DMARC1; p=none;` |

This is the **EU (eu-west-1)** set, which is what the 🇪🇺 domain in the dashboard
uses. Other regions publish an **MX + TXT** pair on `send`
(`feedback-smtp.<region>.amazonses.com` with priority 10) instead of those two
CNAMEs — `check-email-dns.js` accepts either form, and always trust the values
Resend shows over any example here.

- **Copy the Value column from Resend, not these examples** — the DKIM key is
  generated for the domain and is unique to it.
- Use **Host** when the panel already appends the domain name, **Full record
  name** when it asks for the complete name. Pasting
  `send.shieldsafebank.com` into a panel that appends the domain creates
  `send.shieldsafebank.com.shieldsafebank.com` — the script detects and reports
  exactly that mistake.
- `send` and `rsend` are **CNAMEs**: a CNAME cannot coexist with any other
  record at the same name, so do not also add an MX or TXT record called `send`.
  Empty the target field except for the hostname itself (`send.forge.rmta.net`)
  — no `https://`, no path, no trailing dot.
- No trailing dot on values, and leave proxying/"cloud" off if the panel offers it.
- `_dmarc` is recommended, not required: verification succeeds without it, but
  it is what stops others spoofing the domain.
- If the domain already publishes an SPF record, **merge** the Resend include
  into that one record instead of adding a second SPF record — two SPF records
  break SPF entirely.

#### Step 4 — verify

1. Resend re-checks on its own, or click **Verify DNS Records** on the domain page.
2. Allow a few minutes for propagation; Resend tolerates up to 72 hours.
3. Confirm with `node check-email-dns.js` (exit code 0), then prove real delivery:

```
node check-email-dns.js --send-test you@example.com
```

4. Sign in as a customer, open the email-verification page and press **Send
   verification code** — the 6-digit code (10-minute TTL) should arrive.

> Development shortcut: while the domain is unverified you can send from
> Resend's test domain by changing `MAILBOX` in `server/email-config.js` to
> `onboarding@resend.dev`. Mail from that address only reaches the mailbox that
> owns the Resend account, so it cannot serve real customers.

### What the API returns when email cannot be sent

`sendMail()` never throws — it returns `{ ok: false, error }`, and both email
endpoints delete the token/code they just stored before answering `500`, so a
failed send never leaves an orphan code. The frontend shows the server's message
verbatim, so there is no false "check your email" screen.

| Situation | Endpoints | Response |
| --- | --- | --- |
| `RESEND_API_KEY` not set | `POST /api/auth/forgot-password`, `POST /api/auth/send-verification` | `500 { error: "Email service is not configured on this server." }` |
| Key set, domain **not** verified | both | `500 { error: "The shieldsafebank.com domain is not verified. Please, add and verify your domain on https://resend.com/domains" }` |
| Key invalid, revoked, or restricted | both | `500 { error: "Email service is temporarily unavailable. Please try again in a few minutes." }` — the real Resend error (`API key is invalid`, 401) is written to the server log only, because it is not actionable for a customer |
| Domain verified, key valid | both | `200 { ok: true }` and the mail is delivered |

#### `[email] Resend error: API key is invalid` in the Render log

A 401 means the key the server is holding was never valid **or** no longer
exists in Resend — usually because it was deleted or rotated in the dashboard
and Render was never updated. It is **not** a domain problem: check
`https://resend.com/domains` first (it should read *Verified*), then fix the key.

> **Check the prefix before anything else.** Resend keys start with **`re_`**.
> A value starting with **`rnd_`** is a **Render** API key — it authenticates
> against `api.render.com`, not Resend, and every Resend call answers
> `API key is invalid`. It was copied from Render → Account Settings → API Keys
> instead of Resend → API Keys. Revoke such a key: it can read environment
> variables and redeploy services.

1. Resend → **API Keys** → **Create API Key** (**Sending access** is enough for
   this server) and copy the `re_…` value — it is shown once.
2. Prove the key works *before* saving it anywhere:

```
node --input-type=module -e "const k='PASTE_KEY_HERE'; const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+k,'Content-Type':'application/json'},body:JSON.stringify({from:'Shield Safe Bank <no-reply@shieldsafebank.com>',to:'delivered@resend.dev',subject:'key test',html:'<p>ok</p>'})}); console.log(r.status, await r.text())"
```

   Expect `200 {"id":"…"}`. A `401`/`400` means it is the wrong key — do not put
   it on Render.
3. Render → **shieldsafebank-api → Environment** → edit `RESEND_API_KEY` and
   paste the new value. Paste it plainly: a stray leading/trailing space, a
   newline, or wrapping quotes are also classic causes of `API key is invalid`
   (the server strips spaces and quotes defensively, but a typo still fails).
4. **Save Changes** — Render restarts the service.
5. Verify end to end:

```
node check-email-dns.js --send-test you@example.com
```

Any 401 is logged as `[email] Resend error: {...}` with the full Resend payload,
so the Render log always shows the real cause even though the customer sees a
neutral message.

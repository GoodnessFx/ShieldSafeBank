# Shield Safe Bank

A crypto-to-fiat banking platform demo — buy, hold, and convert leading cryptocurrencies (BTC, ETH, USDT) into trusted fiat (USD), withdraw directly to your bank, and get human support when you need it.

Built with a fully responsive React 19 + Vite 8 + Tailwind CSS v4 frontend and a lightweight Express demo API so the entire experience runs locally with no external services.

## Features

- Landing pages for Retail, Business, and Investors
- Account sign-up with Google sign-in, secure login, and simulated 2FA
- Dashboard with live balances, conversion ledger, deposits, and withdrawals
- Real deposit addresses (BTC + USDT ERC-20)
- KYC identity verification flow with an admin review queue
- Admin console for users, transaction holds, KYC decisions, and support chat
- In-app chat widget with human fallback to a contact form
- Emails, compliance, FAQ, and locations pages

## Quick Start

**Prerequisites:** Node.js 20+ and pnpm.

Install and run the frontend (Vite dev server on port 8443):

```bash
pnpm install
pnpm dev
```

Run the demo API separately (Express on port 4000):

```bash
cd server
pnpm install
node index.js
```

The Vite dev server proxies `/api` to the backend on `localhost:4000`. If the API is down, the frontend gracefully falls back to offline demo mode.

## Demo Credentials

| Role | URL | Email | Password | 2FA |
|------|-----|-------|----------|-----|
| Customer (balance $17,760.94) | `/login` | `demo@shieldsafebank.com` | `demo1234` | simulated |
| Admin | `/xk9-admin-console-7f3a` | `admin@shieldsafebank.com` | `admin1234` | `123456` |

New registrations are created with realistic seed data (KYC status, balances, transactions, support threads) so the admin console always has something to review.

## Admin Console

The admin console lives at `/xk9-admin-console-7f3a` and is intentionally unlinked from the public site. Sign in with the admin credentials above to access:

- **Chat Inbox** — view and reply to support threads
- **Users** — manage customer accounts
- **Transaction Log** — place / release holds on withdrawals
- **KYC Queue** — approve or reject identity verifications

## Demo API

`server/index.js` is a dependency-free Express app (express + cors only) that persists to `server/data/store.json`. Endpoints:

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Sign in (returns JWT-like token) |
| POST | `/api/auth/google` | Google sign-in / sign-up |
| POST | `/api/auth/forgot-password` | Reset request |
| GET | `/api/auth/me` | Current user profile |
| GET | `/api/transactions` | Conversion ledger |
| POST | `/api/withdrawals` | Request a withdrawal |
| GET | `/api/deposit-addresses` | Deposit addresses |
| POST | `/api/support/message` | Contact form |
| POST | `/api/admin/login` | Admin sign-in |
| GET/POST | `/api/admin/users`, `/api/admin/kyc`, `/api/admin/transactions`, `/api/admin/threads` | Admin data + actions |

This is a **demo backend**, not production-grade: tokens are random strings, passwords are stored in plaintext, and the JSON file store is local-only. Swap it for a real API (Postgres + auth provider) before any production use.

## Legal & Disclaimers

This is a demonstration project. The admin credentials and deposit addresses are examples. Deposit addresses in `src/lib/config.ts` are real example addresses owned by the project for demo purposes; never publish real addresses or secrets outside a secure backend.
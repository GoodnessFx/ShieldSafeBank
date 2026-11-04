# Deploying Shield Safe Bank to PXXL

The app is two pieces. Both must be live for the admin panel to see everyone from every device.

## 1. Supabase Postgres (required)

Create a free Supabase project at https://supabase.com/

1. Create a new project
2. Go to Settings -> Database and copy the URI connection string
3. Go to Authentication -> Users and create your admin user, then set app_metadata.role = 'admin' in the Supabase dashboard
4. Run the Phase 1 migration SQL (server/migrations/001_phase1_security.sql) against your database

## 2. Backend API (Express server in /server)

Deploy the server/ directory to PXXL as a Node.js service.

Build command: npm install (inside server/)
Start command: node index.js (inside server/)

Environment variables (set in PXXL dashboard only -- never commit these):

| Variable | Required | Description |
|----------|----------|-------------|
| DATABASE_URL | Yes | Supabase Postgres connection string |
| SUPABASE_URL | Yes | Supabase project URL |
| SUPABASE_SERVICE_ROLE_KEY | Yes | Supabase service role key (server-side only) |
| SESSION_SECRET | Yes | Random string for legacy HMAC token signing |
| ALLOWED_ORIGINS | Yes | Comma-separated frontend origin(s) |
| PORT | No | Server port (default 4000) |
| RESEND_API_KEY | Yes (for email) | Resend API key for password reset / verification emails |
| APP_URL | Recommended | Frontend base URL for reset password links |

The server exposes GET /health for health checks.

## 3. Frontend (Vite build)

Deploy the frontend as a static site on PXXL.

Build command: pnpm run build (or npm run build)
Output directory: dist/

Environment variables (set at build time):

| Variable | Description |
|----------|-------------|
| VITE_API_BASE | Backend API base URL |

The built frontend connects to the backend API for all data-changing operations and to Supabase directly for chat (Realtime) and reading its own data.

## 4. Admin Console

The admin console is at the hidden route configured in PXXL environment. The admin user is created by you in the Supabase dashboard with app_metadata.role = 'admin'. Admin login goes through Supabase Auth.

## 5. Security

- All secrets live in PXXL dashboard environment variables only
- .env files are gitignored (.env* in .gitignore)
- .env.example contains variable names only, no values
- The repo is public -- no secrets may be committed
- RLS is enabled on all 9 database tables
- Admin routes verify Supabase JWT with app_metadata.role = 'admin'

## 6. Keep-alive

Add a GitHub Action (every 5 minutes) that calls the PXXL /health URL and makes a lightweight Supabase request, so neither the server nor the free Supabase project goes idle.

## What was removed

- render.yaml -- Render-specific config (Render service was suspended)
- Hardcoded admin credentials (admin@shieldsafebank.com / admin1234)
- Hardcoded demo account passwords
- Hardcoded SESSION_SECRET fallback
- Hardcoded admin1234 2FA code

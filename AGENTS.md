# figma-make-app

React + Vite + Tailwind CSS project running inside Figma Make.

## Running everything (app + shared server)

### Deployed

- **App (Pxxl, static):** it only builds the frontend (`pnpm run build`) and
  serves `dist/` through `node start.mjs` — a plain-Node static server with no
  installs, no Vite and no writes, safe for read-only runtime filesystems.
  Pxxl runs that file, so never put `pnpm install` or dev-server commands in
  the container start path.
- **Shared server (Render):** chats, users, verification and balances live here
  (`server/` on Render). **Keep this running**: it is what makes the admin
  panel show everyone from every browser/device. The built frontend reaches it
  automatically (anything that is not localhost uses the hosted API base, see
  `src/lib/config.ts`).

### Local development

- `npm start` → runs `node start.mjs` (serves the built `dist/`)
- `npm run start:dev` → Vite dev server. It does **not** start the backend; it
  only proxies `/api` → `localhost:4000`, so the shared server must already be
  running for chats/users/balances to be shared.
- `npm run build` → production build into `dist/`
- Shared server locally: `node server/index.js` (needs `server/node_modules`,
  install via `pnpm install` inside `server/`)

**Always start the shared server when testing chats.** With it down every
request fails and the app falls back to per-browser `localStorage`, which is
isolated between a normal window and an incognito window — so a chat written in
one browser never appears in the other. `src/lib/api.ts` now retries failed
requests against `LOCAL_API_BASE` (`http://localhost:4000/api`, see
`src/lib/config.ts`), so the app still works when the hosted backend is
unreachable, but only if that local server is actually running.

Admins can reply to a single conversation or use **Reply to All** in the Chat
Inbox to broadcast one message to every open thread
(`POST /api/admin/threads/reply-all`).

Admin console: `/xk9-admin-console-7f3a` (login `admin@shieldsafebank.com` /
`admin1234`).

## Development Server

A Vite development server is **already running** on `$PORT` (default 8443). You don't need to start it manually.

- Preview URL: The user can access the running app through the preview panel
- Hot reload: Changes to source files are reflected immediately

## Project Structure

This is the canonical project structure. Start with task-relevant files below. Only follow imports or inspect other files when required, when a documented path is missing, or when the repository contradicts this guide.

- `src/main.tsx` - React entrypoint; imports `src/index.css` and mounts `src/App.tsx` into the `#root` element
- `src/App.tsx` - Primary application component and the usual starting point for UI work
- `src/index.css` - Global CSS entrypoint and Tailwind CSS v4 import
- `index.html` - Vite HTML shell containing the `#root` element and loading `src/main.tsx`
- `package.json` - Project dependencies and the Vite build, development, preview, and formatting scripts
- `vite.config.ts` - Vite configuration with React, Tailwind CSS v4, and Figma Make plugins plus the `@` alias for `src`
- `.mise.toml` - Toolchain versions for Node.js and pnpm

## Dependencies

- Runtime: React 19 and React DOM 19
- Styling: Tailwind CSS v4 with the `@tailwindcss/vite` plugin
- Build tooling: Vite 8, TypeScript 5.7, and `@vitejs/plugin-react`
- Formatting: oxfmt

## Styling

This project uses **Tailwind CSS v4** through the `@tailwindcss/vite` plugin configured in `vite.config.ts`. `src/index.css` imports Tailwind with `@import 'tailwindcss';`. Use Tailwind utility classes directly in JSX and put global CSS or Tailwind v4 theme customization in `src/index.css`. This scaffold does not need a Tailwind config file or PostCSS config.

`src/main.tsx` imports `src/index.css`, so global font wiring belongs in `src/index.css`. Keep CSS `@import` statements first, then add any `@font-face` rules and font-family defaults there.

## Code quality

- Use double quotes for strings containing apostrophes (`"We're here to help"`), or escape them in single-quoted strings. An unescaped apostrophe in a single-quoted string breaks the build.
- Ensure JSX tags are closed and braces are balanced.
- Export components as default exports.

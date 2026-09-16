/**
 * Starts both services in one process for Pxxl and local `npm start`.
 *
 *  - Shared backend (server/index.js): chats, users, verification, balances.
 *  - App dev server (vite): the customer-facing site.
 *
 * Path notes (pnpm):
 *  - Run CLIs through `pnpm exec` so Node resolves the package binary from
 *    the right package directory. Never hardcode paths like
 *    `node_modules/vite/bin/vite.js`, which do not exist in pnpm layouts.
 *  - Server dependencies live in server/package.json and are installed with
 *    `pnpm install` run inside server/ before the server starts.
 */
import { spawn } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(fileURLToPath(import.meta.url));
const APP_PORT = process.env.PORT || '8443';
const SERVER_PORT = process.env.SERVER_PORT || '4000';

const children = [];

function log(label, color, stream, chunk) {
  for (const line of String(chunk).split('\n')) {
    if (!line.trim()) continue;
    stream.write(`${color}[${label}]\x1b[0m ${line}\n`);
  }
}

function run(label, color, command, cwd, opts = {}) {
  const child = spawn(command, { cwd, env: process.env, shell: true, windowsHide: false });
  children.push(child);
  child.stdout?.on('data', d => log(label, color, process.stdout, d));
  child.stderr?.on('data', d => log(label, color, process.stderr, d));
  child.on('exit', code => {
    if (opts.optional && code !== 0) {
      process.stdout.write(`\n\x1b[33m[${label}]\x1b[0m Stopped (exit ${code}). The shared server keeps running.\n`);
      return;
    }
    if (code !== 0 && code !== null) {
      process.stdout.write(`\n\x1b[31m[${label}]\x1b[0m Exited with code ${code}.\n`);
      process.exit(code || 1);
    }
  });
  return child;
}

function shutdown(code = 0) {
  for (const c of children) {
    try { c.kill(); } catch { /* already gone */ }
  }
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

process.stdout.write(`\x1b[36mShield Safe Bank - starting both services\x1b[0m
  Shared server  -> http://localhost:${SERVER_PORT}
  App (dev)      -> http://localhost:${APP_PORT}
  Press Ctrl+C to stop both.

`);

run('install-server', '\x1b[33m', 'pnpm install --frozen-lockfile', join(ROOT, 'server'), { optional: true });
run('install-app', '\x1b[33m', 'pnpm install --frozen-lockfile', ROOT, { optional: true });
run('server', '\x1b[32m', 'node server/index.js', ROOT, { optional: false });
run('app', '\x1b[36m', `pnpm exec vite --port ${APP_PORT} --strictPort`, ROOT, { optional: true });

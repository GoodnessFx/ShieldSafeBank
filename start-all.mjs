/**
 * Starts the Shield Safe Bank app and its shared backend server together with
 * one command:  npm start
 *
 *   • Shared server  → http://localhost:4000  (chats, users, verify, balances)
 *   • App (Vite dev) → http://localhost:8443  (or $PORT)
 *
 * Both run in one console with labelled output. Press Ctrl+C to stop both.
 */
import { spawn } from 'node:child_process';
import process from 'node:process';

const APP_PORT = process.env.PORT || '8443';
const SERVER_PORT = process.env.SERVER_PORT || '4000';

const children = [];

function paint(label, color, stream, chunk) {
  for (const line of String(chunk).split('\n')) {
    if (!line.trim()) continue;
    stream.write(`${color}[${label}]\u001b[0m ${line}\n`);
  }
}

function start(label, color, args, cwd, { optional = false } = {}) {
  const child = spawn(process.execPath, args, { cwd, env: process.env, windowsHide: true });
  children.push(child);
  child.stdout?.on('data', d => paint(label, color, process.stdout, d));
  child.stderr?.on('data', d => paint(label, color, process.stderr, d));
  child.on('exit', code => {
    if (optional && code !== 0) {
      process.stdout.write(`\n\u001b[33m[${label}]\u001b[0m Stopped (exit ${code}). The shared server keeps running.\n`);
      return;
    }
    if (code !== 0 && code !== null) {
      process.stdout.write(`\n\u001b[31m[${label}]\u001b[0m Exited with code ${code}.\n`);
      shutdown(code || 1);
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

process.stdout.write(`
\x1b[36mShield Safe Bank - starting both services\x1b[0m
  Shared server  -> http://localhost:${SERVER_PORT}
  App (dev)      -> http://localhost:${APP_PORT}
  Press Ctrl+C to stop both.

`);

// The shared backend: chats, users, verification and balances live here. This
// is what makes the admin panel show everyone from every browser/device.
start('server', '\u001b[32m', ['index.js'], 'server');

// The customer app itself. Optional so that, where a dev server is already
// running (for example the live preview), the shared server still comes up.
start('app', '\u001b[36m', [
  'node_modules/vite/bin/vite.js', '--port', APP_PORT, '--strictPort',
], '.', { optional: true });

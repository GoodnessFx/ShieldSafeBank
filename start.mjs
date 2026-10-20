/**
 * Production entrypoint for Pxxl (and any static host that runs a command).
 *
 * It serves ONLY the prebuilt `dist/` folder with plain Node — no installs, no
 * Vite, no writes, no node_modules lookups at runtime. The shared backend
 * (chats, users, balances) is the already-live Render service; the built
 * frontend reaches it automatically (anything that is not localhost uses the
 * hosted API base, see src/lib/config.ts).
 */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT || 3000);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

function isDir(p) {
  try { return statSync(p).isDirectory(); } catch { return false; }
}

const server = http.createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent(String(req.url || '/').split('?')[0]);
    if (urlPath === '/health' || urlPath === '/healthz' || urlPath === '/ping') {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('OK');
      return;
    }
    const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
    let file = path.normalize(path.join(DIST, rel));
    if (file !== DIST && !file.startsWith(DIST + path.sep)) file = path.join(DIST, 'index.html');
    if (!existsSync(file) || isDir(file)) file = path.join(DIST, 'index.html');
    const ext = path.extname(file).toLowerCase();
    const isHtml = ext === '.html';
    const headers = {
      'content-type': MIME[ext] || 'application/octet-stream',
      'cache-control': isHtml ? 'no-cache, no-store, must-revalidate' : 'public, max-age=31536000, immutable',
    };
    if (req.method === 'HEAD') {
      res.writeHead(200, headers);
      res.end();
      return;
    }
    const body = await readFile(file);
    res.writeHead(200, headers);
    res.end(body);
  } catch {
    try {
      const fallback = await readFile(path.join(DIST, 'index.html'));
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-cache, no-store, must-revalidate',
      });
      res.end(fallback);
    } catch {
      res.writeHead(500, { 'content-type': 'text/plain' });
      res.end('Server error');
    }
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Shield Safe Bank static server on http://0.0.0.0:${PORT} (serving dist/)`);
});

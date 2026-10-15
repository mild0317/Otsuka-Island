import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';

const root = fileURLToPath(new URL('.', import.meta.url));
const hostIndex = process.argv.indexOf('--host');
const host = hostIndex === -1 ? '127.0.0.1' : process.argv[hostIndex + 1];
if (!['127.0.0.1', '0.0.0.0'].includes(host)) throw new Error('Host must be 127.0.0.1 or 0.0.0.0');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png' };
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const filename = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!filename.startsWith(root) || !types[path.extname(filename)]) { res.writeHead(404); res.end(); return; }
    if (!(await stat(filename)).isFile()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(filename)], 'Cache-Control': 'no-cache' });
    createReadStream(filename).pipe(res);
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.listen(4173, host, () => {
  console.log('Local: http://127.0.0.1:4173');
  if (host === '0.0.0.0') {
    for (const entry of Object.values(os.networkInterfaces()).flat()) {
      if (entry.family === 'IPv4' && !entry.internal && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(entry.address)) console.log(`Phone (same Wi-Fi): http://${entry.address}:4173`);
    }
  }
});

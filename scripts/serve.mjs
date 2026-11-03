import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';

const root = fileURLToPath(new URL('../', import.meta.url));
const hostIndex = process.argv.indexOf('--host');
const host = hostIndex === -1 ? '127.0.0.1' : process.argv[hostIndex + 1];
if (!['127.0.0.1', '0.0.0.0'].includes(host)) throw new Error('Host must be 127.0.0.1 or 0.0.0.0');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4' };
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const filename = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!filename.startsWith(root) || !types[path.extname(filename)]) { res.writeHead(404); res.end(); return; }
    const info=await stat(filename);
    if (!info.isFile()) { res.writeHead(404); res.end(); return; }
    const headers={ 'Content-Type': types[path.extname(filename)], 'Cache-Control': 'no-cache', 'Content-Length': info.size };
    let start=0,end=info.size-1,status=200;
    if(path.extname(filename)==='.mp4'){
      headers['Accept-Ranges']='bytes';
      if(req.headers.range){
        const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
        if(match&&(match[1]||match[2])){
          start=match[1]?Number(match[1]):Math.max(0,info.size-Number(match[2]));
          end=match[1]&&match[2]?Math.min(Number(match[2]),info.size-1):info.size-1;
        }else start=-1;
        if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=info.size||end<start){res.writeHead(416,{'Content-Range':'bytes */'+info.size});res.end();return;}
        status=206;headers['Content-Range']=`bytes ${start}-${end}/${info.size}`;headers['Content-Length']=end-start+1;
      }
    }
    res.writeHead(status,headers);
    if(req.method==='HEAD')res.end();else createReadStream(filename,{start,end}).pipe(res);
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

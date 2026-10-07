import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(fileURLToPath(new URL('../docs/', import.meta.url)));
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.xml':'application/xml','.txt':'text/plain; charset=utf-8'};
const port = Number(process.env.PORT || 4173);
const server = http.createServer(async (request,response) => {
  try {
    if (!['GET','HEAD'].includes(request.method)) { response.writeHead(405, {'Allow':'GET, HEAD'}); response.end(); return; }
    const url = new URL(request.url,'http://127.0.0.1');
    const decoded = decodeURIComponent(url.pathname);
    let file = path.resolve(root, '.'+decoded);
    if ((file !== root && !file.startsWith(root + path.sep)) || decoded.includes('\\') || decoded.includes('\0')) { response.writeHead(403); response.end(); return; }
    let info;
    try { info = await stat(file); } catch { file = path.join(root,'404.html'); response.statusCode = 404; info = await stat(file); }
    if (info.isDirectory()) {
      if (!url.pathname.endsWith('/')) { response.writeHead(301,{'Location':url.pathname+'/'+url.search}); response.end(); return; }
      file = path.join(file,'index.html');
    }
    const data = await readFile(file);
    response.setHeader('Content-Type',types[path.extname(file)] || 'application/octet-stream');
    response.setHeader('Cache-Control','no-store');
    response.setHeader('X-Content-Type-Options','nosniff');
    response.setHeader('Content-Length',data.length);
    response.end(request.method === 'HEAD' ? undefined : data);
  } catch { response.writeHead(400); response.end('Bad request'); }
});
server.listen(port,'127.0.0.1',()=>console.log(`Preview: http://127.0.0.1:${port}`));

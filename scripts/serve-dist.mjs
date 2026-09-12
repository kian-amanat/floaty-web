/* Serves dist/ the way vercel.json says to — static files first, everything
   else rewritten to index.html — so the production build can be checked
   locally before it is pushed. Not used at runtime. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const TYPES = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.ico':'image/x-icon', '.svg':'image/svg+xml' };

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let file = path.join(ROOT, url);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(ROOT, 'index.html');
  const body = fs.readFileSync(file);
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  res.end(body);
}).listen(4180, () => console.log('serving dist on http://localhost:4180'));

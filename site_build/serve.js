// Local test server with gzip, like a real host. usage: node serve.js ../dist 8766
const http = require('http'), fs = require('fs'), path = require('path'), zlib = require('zlib');
const root = path.resolve(process.argv[2] || '../dist'), port = +process.argv[3] || 8766;
const T = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml', '.txt': 'text/plain' };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  let f = path.join(root, p);
  if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  let status = 200;
  if (!fs.existsSync(f)) { f = path.join(root, '404.html'); status = 404; }
  const ext = path.extname(f), type = T[ext] || 'application/octet-stream';
  let body = fs.readFileSync(f);
  const h = { 'Content-Type': type, 'Cache-Control': /\/(assets|img)\//.test(p) ? 'public, max-age=31536000, immutable' : 'no-cache' };
  if (/text|javascript|svg|json|xml/.test(type) && /gzip/.test(req.headers['accept-encoding'] || '')) { body = zlib.gzipSync(body, { level: 9 }); h['Content-Encoding'] = 'gzip'; }
  res.writeHead(status, h); res.end(body);
}).listen(port, () => console.log('serving', root, 'on', port));

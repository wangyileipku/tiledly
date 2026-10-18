import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8'
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.googleadservices.com https://*.googleadservices.com https://*.google.com https://pagead2.googlesyndication.com https://*.googlesyndication.com https://connect.facebook.net https://analytics.tiktok.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://www.googleadservices.com https://*.googleadservices.com https://*.google.com https://pagead2.googlesyndication.com https://*.doubleclick.net https://api.resend.com; frame-src 'self' https://googleads.g.doubleclick.net https://pagead2.googlesyndication.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self';"
};

const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];
  const relativePath = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const filePath = path.join(__dirname, relativePath);

  // Security check: prevent traversal and sensitive file disclosure
  if (
    !filePath.startsWith(__dirname) ||
    relativePath.startsWith('.') ||
    relativePath.startsWith('api/') ||
    relativePath === 'package.json' ||
    relativePath === 'package-lock.json' ||
    relativePath === 'server.mjs' ||
    relativePath === 'test.js'
  ) {
    res.writeHead(403, { 'Content-Type': 'text/plain', ...SECURITY_HEADERS });
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain', ...SECURITY_HEADERS });
      res.end('Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      ...SECURITY_HEADERS
    });
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`⚡ Tiledly server is running at http://localhost:${PORT}/`);
});

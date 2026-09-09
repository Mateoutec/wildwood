const path = require('node:path');
const fs = require('node:fs/promises');

const CSP = "default-src 'self'; script-src 'self'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; media-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-src 'none'; form-action 'none'";
const MIME = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.json':'application/json','.woff2':'font/woff2'};

function assetPath(root, rawUrl) {
  const url = new URL(rawUrl);
  if (url.protocol !== 'wildwood:' || url.host !== 'game' || url.username || url.password) return null;
  const pathname = decodeURIComponent(url.pathname);
  if (pathname.includes('\\') || pathname.includes('\0')) return null;
  const destination = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  const relative = path.relative(root, destination);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative) ? destination : null;
}

async function serveAsset(root, request) {
  try {
    if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', {status:405});
    const file = assetPath(root, request.url);
    if (!file) return new Response('Forbidden', {status:403});
    const bytes = await fs.readFile(file);
    return new Response(request.method === 'HEAD' ? null : bytes, {headers: {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Content-Security-Policy': CSP,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-cache',
    }});
  } catch { return new Response('Not found', {status:404}); }
}

module.exports = {assetPath, serveAsset};

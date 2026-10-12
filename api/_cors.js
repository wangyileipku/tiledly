// Shared CORS configuration for all Tiledly API endpoints.
// Restricts origins to production domains instead of wildcard '*'.

const ALLOWED_ORIGINS = [
  'https://tiledly.com',
  'https://www.tiledly.com',
];

// Allow localhost during development
if (process.env.NODE_ENV !== 'production' && process.env.VERCEL_ENV !== 'production') {
  ALLOWED_ORIGINS.push('http://localhost:3000', 'http://localhost:8080', 'http://127.0.0.1:3000');
}

/**
 * Set CORS headers on the response.
 * Returns true if the request is an OPTIONS preflight that was handled.
 *
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @returns {boolean} true if the caller should return immediately (OPTIONS handled)
 */
export function applyCors(req, res) {
  const origin = req?.headers?.origin || req?.headers?.Origin || '';

  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader?.('Access-Control-Allow-Origin', origin);
    res.setHeader?.('Vary', 'Origin');
  }
  // If origin isn't in the allowlist, no CORS header is set — browser blocks the response.

  res.setHeader?.('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader?.('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader?.('Access-Control-Max-Age', '86400');

  if (req?.method === 'OPTIONS') {
    res.status?.(200).end?.();
    return true;
  }

  return false;
}

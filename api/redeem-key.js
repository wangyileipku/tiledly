// Vercel Serverless Function: Redeem VIP Key
// Validates VIP keys server-side using SHA-256 hashes stored in memory.
// Keys are NEVER sent to or visible in client-side code.
//
// Usage: POST /api/redeem-key
// Body: { "key": "SOME_VIP_KEY", "deviceId": "<uuid>" }
//
// Optional env var:
//   VIP_KEY_HASHES - JSON array of additional SHA-256 hashes to accept
//                    e.g. '["abc123...", "def456..."]'
//
// Required env vars (for Redis persistence):
//   KV_REST_API_URL (or UPSTASH_REDIS_REST_URL)
//   KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_TOKEN)

import crypto from 'crypto';
import { applyCors } from './_cors.js';
import { createProToken } from './_token.js';

/**
 * Hash a key with SHA-256 for constant-time comparison.
 */
function hashKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

// Pre-computed SHA-256 hashes of valid VIP keys.
// Plaintext keys are never stored in source code.
// To add a new key: `echo -n "YOUR_KEY" | shasum -a 256` and add the hash below.
const VALID_KEY_HASHES = new Map([
  // Lifetime passes
  ['e7245e09a5d2e655a55d62fca8d07228dac66aff6c2aa7923ee868416e850d0b', { plan: 'lifetime', label: 'Lifetime VIP (2026)' }],
  ['8ef76d675285421e370c119f5eefcd73e406139f9ca0163863ae401d1fc68806', { plan: 'lifetime', label: 'Founder Lifetime' }],
  ['cca268fdec2319f1b8d33455ee865cb09cef018649956d0edba62a0cc008961b', { plan: 'lifetime', label: 'Tiledly Lifetime' }],
  // 30-day passes
  ['fbf792dbe6274257a0253574e0ef63fa45815ded43a839567e46622f7e9780fb', { plan: 'monthly', durationDays: 30, label: '30-Day PRO Pass' }],
  ['0b111415866ec12de7fd54586bf59126dd67a44b3f2161e7017cde41c15e95d6', { plan: 'monthly', durationDays: 30, label: '30-Day PRO Pass' }],
]);

// Load additional key hashes from environment variable (for dynamic key management)
try {
  const envHashes = process.env.VIP_KEY_HASHES;
  if (envHashes) {
    const parsed = JSON.parse(envHashes);
    for (const entry of parsed) {
      if (entry.hash && entry.plan) {
        VALID_KEY_HASHES.set(entry.hash, { plan: entry.plan, durationDays: entry.durationDays, label: entry.label || 'VIP Key' });
      }
    }
  }
} catch (_) {
  console.warn('Failed to parse VIP_KEY_HASHES env var');
}

// In-memory fallback tracking for when Redis is unavailable (dev/offline)
const memoryAttempts = new Map();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function isMemoryRateLimited(ip) {
  const now = Date.now();
  const entry = memoryAttempts.get(ip);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    memoryAttempts.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

async function isRateLimited(ip) {
  const sanitizedIp = String(ip).replace(/[^a-zA-Z0-9_.-]/g, '_');
  const rateLimitKey = `tiledly_redeem_ratelimit_${sanitizedIp}`;
  const attempts = await runRedisCommand(['INCR', rateLimitKey]);
  if (attempts === 1) {
    await runRedisCommand(['EXPIRE', rateLimitKey, '900']); // 15 minutes TTL
  }
  if (typeof attempts === 'number') {
    return attempts > MAX_ATTEMPTS;
  }
  // Fallback to in-memory rate limiting when Redis is unavailable
  return isMemoryRateLimited(ip);
}

async function runRedisCommand(commandArray) {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commandArray),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.result;
  } catch (err) {
    console.warn('Redis error in redeem-key:', err.message);
    return null;
  }
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting (prioritize x-real-ip set by Vercel edge proxy)
  const clientIp = req.headers?.['x-real-ip'] ||
                   req.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
                   req.socket?.remoteAddress ||
                   'unknown';
  if (await isRateLimited(clientIp)) {
    return res.status(429).json({ error: 'Too many attempts. Please try again later.' });
  }

  let body = {};
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  } catch (_) {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const { key, deviceId } = body;

  if (!deviceId || typeof deviceId !== 'string' || deviceId.length < 5 || deviceId.length > 64) {
    return res.status(400).json({ error: 'Missing or invalid deviceId parameter' });
  }

  if (!key || typeof key !== 'string') {
    return res.status(400).json({ success: false, error: 'Please enter a VIP Key' });
  }

  const cleanKey = key.trim().toUpperCase();
  if (cleanKey.length < 3 || cleanKey.length > 64) {
    return res.status(400).json({ success: false, error: 'Invalid VIP Key' });
  }

  // Lookup the key hash
  const keyHash = hashKey(cleanKey);
  const match = VALID_KEY_HASHES.get(keyHash);

  if (!match) {
    return res.status(200).json({ success: false, error: 'Invalid VIP Key' });
  }

  // Build PRO record
  const now = Date.now();
  const expiryTimestamp = match.durationDays
    ? now + (match.durationDays * 24 * 60 * 60 * 1000)
    : null; // Lifetime = no expiry

  const proRecord = JSON.stringify({
    active: true,
    plan: match.plan,
    activatedAt: now,
    expiryTimestamp,
    source: 'vip_key',
  });

  // Store in Redis
  const redisKey = `tiledly_pro_${deviceId}`;
  await runRedisCommand(['SET', redisKey, proRecord]);

  const message = match.plan === 'lifetime'
    ? '👑 Lifetime VIP Activated!'
    : `👑 ${match.label} Activated!`;

  const token = createProToken(deviceId, match.plan, expiryTimestamp);

  return res.status(200).json({
    success: true,
    plan: match.plan,
    expiryTimestamp,
    token,
    message,
  });
}

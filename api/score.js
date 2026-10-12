// Vercel Serverless Function: Daily Leaderboard & Ranking API
// Uses Vercel KV / Upstash Redis Sorted Sets (ZADD, ZREVRANK, ZCARD, ZREVRANGE)
// Falls back gracefully if KV is not yet provisioned in Vercel dashboard.

import { applyCors } from './_cors.js';

async function runRedisCommand(commandArray) {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null; // Redis not configured, use fallback
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(commandArray)
    });

    if (!res.ok) {
      console.warn(`Redis command failed with status ${res.status}`);
      return null;
    }

    const data = await res.json();
    return data.result;
  } catch (err) {
    console.warn('Redis connection error:', err.message);
    return null;
  }
}

class Mulberry32 {
  constructor(seed) {
    this.seed = seed;
  }
  next() {
    let t = this.seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

async function ensureDailyGhostsSeeded(date) {
  const leaderboardKey = `tiledly_lb_${date}`;
  const count = await runRedisCommand(['ZCARD', leaderboardKey]);

  if (count === null || count > 0) {
    return; // Already initialized or Redis unavailable
  }

  // Pre-seed 99 realistic ghost racers so every player enters a full 100-player race from minute 1!
  const seedNum = parseInt(date, 10) || 20261005;
  const rng = new Mulberry32(seedNum);

  // Score distribution across 99 baseline bots:
  // IMPORTANT: Bots are deliberately kept modest (capped below 7200) so that real human
  // players can easily take #1, #2, #3 and celebrate genuine podium finishes!
  const zaddArgs = ['ZADD', leaderboardKey];
  for (let i = 1; i <= 99; i++) {
    let botScore;
    const r = rng.next();
    if (r < 0.30) {
      // Average runners (scores 6000 to 7200, ~55-75 seconds)
      botScore = 6000 + Math.floor(rng.next() * 1200);
    } else if (r < 0.75) {
      // Casual runners (scores 4500 to 6000, ~80-120 seconds)
      botScore = 4500 + Math.floor(rng.next() * 1500);
    } else {
      // Relaxed runners (scores 3000 to 4500, ~120-180 seconds)
      botScore = 3000 + Math.floor(rng.next() * 1500);
    }
    zaddArgs.push(botScore, `ghost_bot_${i}`);
  }
  await runRedisCommand(zaddArgs);
}

// In-memory fallback tracking for when Redis is unavailable (dev/offline)
const scoreMemoryAttempts = new Map();
const MAX_SCORE_ATTEMPTS = 15;
const SCORE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

function isScoreMemoryRateLimited(ip) {
  const now = Date.now();
  const entry = scoreMemoryAttempts.get(ip);
  if (!entry || now - entry.windowStart > SCORE_WINDOW_MS) {
    scoreMemoryAttempts.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_SCORE_ATTEMPTS;
}

async function isScoreIpRateLimited(ip) {
  const sanitizedIp = String(ip).replace(/[^a-zA-Z0-9_.-]/g, '_');
  const rateLimitKey = `tiledly_score_ratelimit_${sanitizedIp}`;
  const attempts = await runRedisCommand(['INCR', rateLimitKey]);
  if (attempts === 1) {
    await runRedisCommand(['EXPIRE', rateLimitKey, '600']); // 10 minutes window
  }
  if (typeof attempts === 'number') {
    return attempts > MAX_SCORE_ATTEMPTS;
  }
  return isScoreMemoryRateLimited(ip);
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  if (req.method === 'POST') {
    try {
      // ── Rate limit: prevent IP flooding & DoS attacks ──
      const clientIp = req.headers?.['x-real-ip'] ||
                       req.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
                       req.socket?.remoteAddress ||
                       'unknown';
      if (await isScoreIpRateLimited(clientIp)) {
        return res.status(429).json({ error: 'Too many score submissions. Please try again later.' });
      }

      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const { deviceId, date = todayStr, time, mistakes = 0, score } = body;

      if (!deviceId || typeof deviceId !== 'string' || deviceId.length < 5 || deviceId.length > 64 || typeof time !== 'number' || typeof score !== 'number') {
        return res.status(400).json({ error: 'Missing or invalid deviceId, time, or score' });
      }

      // ── Validation: date format (must be 8-digit YYYYMMDD) ──
      if (!/^\d{8}$/.test(date)) {
        return res.status(400).json({ error: 'Invalid date format' });
      }
      const y = parseInt(date.slice(0, 4), 10);
      const m = parseInt(date.slice(4, 6), 10);
      const d = parseInt(date.slice(6, 8), 10);
      if (y < 2026 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) {
        return res.status(400).json({ error: 'Invalid date range' });
      }

      // ── Validation: reject spoofed bot deviceIds ──
      if (deviceId.startsWith('ghost_bot_')) {
        return res.status(400).json({ error: 'Invalid deviceId' });
      }

      // ── Validation: score sanity bounds ──
      // Max theoretical score is ~10000 (perfect run). Min is 0.
      // Time cannot be under 2s (inhuman) or over 10 minutes (game would have ended).
      const MIN_TIME_MS = 2000;
      const MAX_TIME_MS = 600000;
      const MIN_SCORE = 0;
      const MAX_SCORE = 10000;

      if (score < MIN_SCORE || score > MAX_SCORE || !Number.isFinite(score)) {
        return res.status(400).json({ error: 'Score out of valid range' });
      }

      if (time < MIN_TIME_MS || time > MAX_TIME_MS || !Number.isFinite(time)) {
        return res.status(400).json({ error: 'Time out of valid range' });
      }

      if (typeof mistakes !== 'number' || mistakes < 0 || mistakes > 100) {
        return res.status(400).json({ error: 'Invalid mistakes value' });
      }

      const leaderboardKey = `tiledly_lb_${date}`;
      const metaKey = `tiledly_meta_${date}`;

      // 1. Check if Redis is connected
      const isRedisAvailable = Boolean(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL);

      if (isRedisAvailable) {
        // ── Rate limit: one submission per deviceId per day ──
        // HSETNX returns 1 if field was set (new), 0 if it already existed.
        const isNew = await runRedisCommand(['HSETNX', metaKey, deviceId, '__pending__']);
        if (isNew === 0) {
          // Player already submitted today — return their existing rank without updating
          const existingRank = await runRedisCommand(['ZREVRANK', leaderboardKey, deviceId]);
          const totalCount = await runRedisCommand(['ZCARD', leaderboardKey]);
          const rank = typeof existingRank === 'number' ? existingRank + 1 : 1;
          const total = typeof totalCount === 'number' ? Math.max(1, totalCount) : 1;

          return res.status(200).json({
            source: 'redis',
            rank,
            totalPlayers: total,
            percentile: Math.max(1, Math.round((rank / total) * 100)),
            score,
            time,
            duplicate: true
          });
        }

        // Pre-seed 99 baseline ghosts if this is the very first player of the day
        await ensureDailyGhostsSeeded(date);

        // Add or update player in sorted set (higher score = better rank)
        await runRedisCommand(['ZADD', leaderboardKey, score, deviceId]);

        // Save detailed run metadata (overwrite the __pending__ placeholder)
        const metadata = {
          deviceId: deviceId.slice(0, 8),
          time,
          mistakes,
          score,
          timestamp: Date.now()
        };
        await runRedisCommand(['HSET', metaKey, deviceId, JSON.stringify(metadata)]);

        // Query real live rank (0-indexed descending rank)
        const zeroIndexRank = await runRedisCommand(['ZREVRANK', leaderboardKey, deviceId]);
        const realRank = typeof zeroIndexRank === 'number' ? zeroIndexRank + 1 : 1;

        // Query total players today
        const totalCount = await runRedisCommand(['ZCARD', leaderboardKey]);
        const realTotal = typeof totalCount === 'number' ? Math.max(1, totalCount) : 1;

        // Calculate percentile
        const percentile = Math.max(1, Math.round((realRank / realTotal) * 100));

        // Fetch top 5 and nearby rivals for battle replay
        const topMembers = await runRedisCommand(['ZREVRANGE', leaderboardKey, 0, 4, 'WITHSCORES']) || [];
        
        return res.status(200).json({
          source: 'redis',
          rank: realRank,
          totalPlayers: realTotal,
          percentile,
          score,
          time
        });
      }

      // Fallback: If Redis is not yet provisioned, use simulated realistic population
      const seedNum = parseInt(date, 10) || 20261005;
      const simTotal = 125000 + (seedNum % 50000);
      const simRank = Math.max(1, Math.floor(simTotal * (1 - score / 10000) * 0.8) + (Math.floor(Math.random() * 50) - 25));
      const simPercentile = Math.max(1, Math.round((simRank / simTotal) * 100));

      return res.status(200).json({
        source: 'simulated_fallback',
        rank: simRank,
        totalPlayers: simTotal,
        percentile: simPercentile,
        score,
        time
      });

    } catch (err) {
      console.error('Error handling score submit:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // GET request: Fetch today's summary
  if (req.method === 'GET') {
    const date = req.query?.date || todayStr;
    if (!/^\d{8}$/.test(date)) {
      return res.status(400).json({ error: 'Invalid date format' });
    }
    const y = parseInt(date.slice(0, 4), 10);
    const m = parseInt(date.slice(4, 6), 10);
    const d = parseInt(date.slice(6, 8), 10);
    if (y < 2026 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) {
      return res.status(400).json({ error: 'Invalid date range' });
    }
    const leaderboardKey = `tiledly_lb_${date}`;
    const totalCount = await runRedisCommand(['ZCARD', leaderboardKey]);

    return res.status(200).json({
      date,
      connected: Boolean(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL),
      totalPlayers: typeof totalCount === 'number' ? totalCount : 0
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// Vercel Serverless Function: Daily Leaderboard & Ranking API
// Uses Vercel KV / Upstash Redis Sorted Sets (ZADD, ZREVRANK, ZCARD, ZREVRANGE)
// Falls back gracefully if KV is not yet provisioned in Vercel dashboard.

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
  // - Top 5% (5 bots): 9000-9800 (pro speedrunners)
  // - Top 25% (25 bots): 8000-9000 (fast players)
  // - Solid 40% (40 bots): 6500-8000 (solid regular players)
  // - Casual 29% (29 bots): 3200-6500 (casual / learning players)
  const zaddArgs = ['ZADD', leaderboardKey];
  for (let i = 1; i <= 99; i++) {
    let botScore;
    const r = rng.next();
    if (r < 0.05) {
      botScore = 9000 + Math.floor(rng.next() * 800);
    } else if (r < 0.30) {
      botScore = 8000 + Math.floor(rng.next() * 1000);
    } else if (r < 0.70) {
      botScore = 6500 + Math.floor(rng.next() * 1500);
    } else {
      botScore = 3200 + Math.floor(rng.next() * 3300);
    }
    zaddArgs.push(botScore, `ghost_bot_${i}`);
  }
  await runRedisCommand(zaddArgs);
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const { deviceId, date = todayStr, time, mistakes = 0, score } = body;

      if (!deviceId || typeof time !== 'number' || typeof score !== 'number') {
        return res.status(400).json({ error: 'Missing deviceId, time, or score' });
      }

      const leaderboardKey = `tiledly_lb_${date}`;
      const metaKey = `tiledly_meta_${date}`;

      // 1. Check if Redis is connected
      const isRedisAvailable = Boolean(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL);

      if (isRedisAvailable) {
        // Pre-seed 99 baseline ghosts if this is the very first player of the day
        await ensureDailyGhostsSeeded(date);

        // Add or update player in sorted set (higher score = better rank)
        await runRedisCommand(['ZADD', leaderboardKey, score, deviceId]);

        // Save detailed run metadata
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

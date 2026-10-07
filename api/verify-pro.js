// Vercel Serverless Function: Verify PRO Status
// The client calls this endpoint on page load to check if the user has an active PRO membership.
// This is the secure counterpart to the Stripe webhook — the webhook writes, this endpoint reads.
//
// Usage: GET /api/verify-pro?deviceId=<uuid>
//
// Required env vars:
//   KV_REST_API_URL (or UPSTASH_REDIS_REST_URL) - Redis endpoint
//   KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_TOKEN) - Redis auth token

/**
 * Execute a Redis command via Upstash REST API.
 */
async function runRedisCommand(commandArray) {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commandArray),
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

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const deviceId = req.query?.deviceId;

  if (!deviceId) {
    return res.status(400).json({ error: 'Missing deviceId parameter' });
  }

  // Lookup PRO status in Redis
  const redisKey = `tiledly_pro_${deviceId}`;
  const rawRecord = await runRedisCommand(['GET', redisKey]);

  // Redis not configured or no record found
  if (rawRecord === null || rawRecord === undefined) {
    return res.status(200).json({ isPro: false });
  }

  try {
    const record = typeof rawRecord === 'string' ? JSON.parse(rawRecord) : rawRecord;

    // Check if the PRO membership is still active
    if (!record.active) {
      return res.status(200).json({ isPro: false });
    }

    // Check expiry for time-limited plans
    if (record.expiryTimestamp && Date.now() > record.expiryTimestamp) {
      return res.status(200).json({
        isPro: false,
        expired: true,
        plan: record.plan,
      });
    }

    // Active PRO member!
    return res.status(200).json({
      isPro: true,
      plan: record.plan || 'monthly',
      expiryTimestamp: record.expiryTimestamp || null,
      activatedAt: record.activatedAt || null,
    });
  } catch (err) {
    console.error('Error parsing PRO record:', err.message);
    return res.status(200).json({ isPro: false });
  }
}

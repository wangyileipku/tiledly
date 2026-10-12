// Vercel Serverless Function: Stripe Webhook Handler
// Securely processes Stripe payment events and stores PRO status in Redis.
//
// SECURITY FLOW:
// 1. Stripe sends a POST with a signed payload after a payment event
// 2. We verify the signature using STRIPE_WEBHOOK_SECRET (prevents spoofing)
// 3. On valid events we read/write PRO status keyed by deviceId in Redis
// 4. The client-side verifyProWithServer() reads from /api/verify-pro
//
// Handled events:
//   checkout.session.completed        - initial purchase / subscription start
//   customer.subscription.updated     - monthly renewal (extends expiry)
//   customer.subscription.deleted     - cancellation / non-renewal (deactivates)
//
// Required env vars:
//   STRIPE_WEBHOOK_SECRET - from Stripe Dashboard > Webhooks > Signing secret
//   KV_REST_API_URL (or UPSTASH_REDIS_REST_URL) - Redis endpoint
//   KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_TOKEN) - Redis auth token

import crypto from 'crypto';

// Disable Vercel's automatic body parsing so we can access the raw body
// for Stripe signature verification.
export const config = {
  api: {
    bodyParser: false,
  },
};

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

/**
 * Read raw request body as a Buffer (needed for Stripe signature verification).
 */
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/**
 * Verify Stripe webhook signature without requiring the stripe npm package.
 * Uses the same HMAC-SHA256 scheme that Stripe uses.
 *
 * Stripe-Signature header format:
 *   t=<timestamp>,v1=<signature>[,v0=<old_signature>]
 *
 * Signed payload = `${timestamp}.${rawBody}`
 */
function verifyStripeSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;

  try {
    // Parse the header
    const elements = signatureHeader.split(',');
    const sigMap = {};
    for (const element of elements) {
      const [key, value] = element.split('=');
      sigMap[key.trim()] = value.trim();
    }

    const timestamp = sigMap['t'];
    const signature = sigMap['v1'];

    if (!timestamp || !signature) return false;

    // Reject if timestamp is too old (5 minute tolerance)
    const ageSeconds = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
    if (Math.abs(ageSeconds) > 300) {
      console.warn('Stripe webhook timestamp too old/future:', ageSeconds, 'seconds');
      return false;
    }

    // Compute expected signature
    const signedPayload = `${timestamp}.${rawBody}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signedPayload, 'utf8')
      .digest('hex');

    // Constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (err) {
    console.error('Signature verification error:', err.message);
    return false;
  }
}

export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not configured');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  // Read raw body for signature verification
  let rawBody;
  try {
    rawBody = await getRawBody(req);
  } catch (err) {
    console.error('Failed to read request body:', err.message);
    return res.status(400).json({ error: 'Failed to read body' });
  }

  // Verify Stripe signature
  const signatureHeader = req.headers['stripe-signature'];
  if (!verifyStripeSignature(rawBody.toString('utf8'), signatureHeader, webhookSecret)) {
    console.warn('Stripe webhook signature verification failed');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  // Parse the verified event
  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch (err) {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  // Handle the checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data?.object;
    const deviceId = session?.client_reference_id;

    if (!deviceId) {
      console.warn('checkout.session.completed missing client_reference_id');
      return res.status(400).json({ error: 'Missing client_reference_id' });
    }

    // Determine plan type from session metadata or mode
    // You can pass metadata: { plan: 'lifetime' } when creating the checkout session
    const plan = session.metadata?.plan || (session.mode === 'subscription' ? 'monthly' : 'lifetime');

    // Calculate expiry: monthly = 30 days, lifetime = no expiry
    const now = Date.now();
    const expiryTimestamp = plan === 'monthly'
      ? now + (30 * 24 * 60 * 60 * 1000)
      : null;

    const customerEmail = (session.customer_details?.email || session.customer_email || '').trim().toLowerCase();

    const proRecord = JSON.stringify({
      active: true,
      plan,
      activatedAt: now,
      expiryTimestamp,
      email: customerEmail || null,
      stripeSessionId: session.id || null,
      stripeCustomerId: session.customer || null,
    });

    // Store in Redis keyed by deviceId
    const redisKey = `tiledly_pro_${deviceId}`;
    const result = await runRedisCommand(['SET', redisKey, proRecord]);

    if (result === null) {
      console.error('Failed to store PRO status in Redis for device:', deviceId);
      return res.status(500).json({ error: 'Failed to store PRO status' });
    }

    // Save customerId → deviceId in a Redis Set (SADD supports multiple devices per customer).
    // This is the key that lets renewal and cancellation events fan out to ALL linked devices.
    if (session.customer) {
      const devicesKey = `tiledly_stripe_devices_${session.customer}`;
      await runRedisCommand(['SADD', devicesKey, deviceId]);
    }

    // If email is present, maintain an email -> proRecord index for cross-device restoration
    if (customerEmail) {
      const emailKey = `tiledly_pro_email_${customerEmail}`;
      await runRedisCommand(['SET', emailKey, proRecord]);
    }

    console.log(`✅ PRO activated for device ${deviceId.slice(0, 8)}... (plan: ${plan}, email: ${customerEmail || 'none'})`);
    return res.status(200).json({ received: true, deviceId: deviceId.slice(0, 8) + '...' });
  }

  // Handle subscription renewal — Stripe sends this when a monthly billing cycle succeeds.
  // Updates ALL devices linked to this customer so no device ever needs a manual restore
  // after the monthly charge goes through.
  if (event.type === 'customer.subscription.updated') {
    const subscription = event.data?.object;
    const customerId = subscription?.customer;

    // Only act on active subscriptions (ignore cancellation-scheduled updates)
    if (subscription?.status !== 'active') {
      console.log(`ℹ️ subscription.updated ignored — status: ${subscription?.status}`);
      return res.status(200).json({ received: true, type: event.type });
    }

    // Fetch all devices linked to this customer
    const deviceIds = await runRedisCommand(['SMEMBERS', `tiledly_stripe_devices_${customerId}`]);
    if (!deviceIds || deviceIds.length === 0) {
      console.warn('subscription.updated: no devices found for customer', customerId);
      return res.status(200).json({ received: true, type: event.type });
    }

    // current_period_end is a Unix timestamp (seconds); convert to ms
    const newExpiry = subscription.current_period_end
      ? subscription.current_period_end * 1000
      : null;

    // Update every linked device in parallel
    await Promise.all(deviceIds.map(async (devId) => {
      const redisKey = `tiledly_pro_${devId}`;
      const raw = await runRedisCommand(['GET', redisKey]);
      if (!raw) return;

      const record = JSON.parse(raw);
      record.active = true;
      record.expiryTimestamp = newExpiry ?? record.expiryTimestamp;
      record.renewedAt = Date.now();
      await runRedisCommand(['SET', redisKey, JSON.stringify(record)]);
    }));

    console.log(`🔄 PRO renewed for ${deviceIds.length} device(s) of customer ${customerId} (expires: ${newExpiry ? new Date(newExpiry).toISOString() : 'n/a'})`);
    return res.status(200).json({ received: true, type: event.type });
  }

  // Handle subscription cancellation — Stripe sends this when a subscription ends
  // (either immediately cancelled or not renewed at the end of the billing period).
  // Cancels ALL linked devices so the user loses access everywhere simultaneously.
  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data?.object;
    const customerId = subscription?.customer;

    const deviceIds = await runRedisCommand(['SMEMBERS', `tiledly_stripe_devices_${customerId}`]);
    if (!deviceIds || deviceIds.length === 0) {
      console.warn('subscription.deleted: no devices found for customer', customerId);
      return res.status(200).json({ received: true, type: event.type });
    }

    await Promise.all(deviceIds.map(async (devId) => {
      const redisKey = `tiledly_pro_${devId}`;
      const raw = await runRedisCommand(['GET', redisKey]);
      if (!raw) return;

      const record = JSON.parse(raw);
      record.active = false;
      record.canceledAt = Date.now();
      await runRedisCommand(['SET', redisKey, JSON.stringify(record)]);
    }));

    console.log(`❌ PRO cancelled for ${deviceIds.length} device(s) of customer ${customerId}`);
    return res.status(200).json({ received: true, type: event.type });
  }

  // Acknowledge other event types without processing
  return res.status(200).json({ received: true, type: event.type });
}

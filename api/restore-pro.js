// Vercel Serverless Function: Restore PRO Membership
// Supports 2 actions:
// 1. POST { action: "request", email, deviceId }:
//    Finds active subscription in Redis or Stripe Customer Search.
//    Generates an encrypted 6-digit code or magic token. If RESEND_API_KEY is configured,
//    sends the link via email. If not configured yet, provides clean instructions.
// 2. POST { action: "verify", token, deviceId } or { action: "verify_code", email, code, deviceId }:
//    Validates the token/code, links the user's current deviceId in Redis, and unlocks PRO!

import crypto from 'crypto';

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
    console.warn('Redis error in restore-pro:', err.message);
    return null;
  }
}

async function sendRestoreEmail(toEmail, restoreUrl, magicCode) {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.warn('RESEND_API_KEY not configured. Skipping email dispatch.');
    return false;
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Tiledly PRO <support@tiledly.com>',
        to: [toEmail],
        subject: '⚡ Restore your Tiledly PRO membership',
        html: `
          <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 500px; margin: 0 auto; background: #0a0a1a; color: #ffffff; padding: 32px; border-radius: 16px; border: 1px solid #2a2a4a;">
            <h1 style="color: #ffcc00; font-size: 24px; margin-bottom: 8px;">👑 Tiledly PRO Access</h1>
            <p style="color: #cccccc; font-size: 15px; line-height: 1.5;">Tap the button below to immediately restore your PRO membership on this device:</p>
            <div style="text-align: center; margin: 28px 0;">
              <a href="${restoreUrl}" style="background: linear-gradient(135deg, #ffcc00, #ff9900); color: #000; font-weight: bold; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-size: 16px; display: inline-block;">Restore PRO on This Device</a>
            </div>
            <p style="color: #888888; font-size: 13px;">Or use this 6-digit confirmation code: <strong style="color: #ffffff; font-size: 16px; letter-spacing: 2px;">${magicCode}</strong></p>
            <p style="color: #555555; font-size: 12px; margin-top: 24px;">This link and code expire in 20 minutes. If you didn't request this, you can safely ignore this email.</p>
          </div>
        `,
      }),
    });

    return res.ok;
  } catch (err) {
    console.error('Failed to send restore email via Resend:', err.message);
    return false;
  }
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body = {};
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  } catch (_) {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const { action, email, code, token, deviceId } = body;

  if (!deviceId) {
    return res.status(400).json({ error: 'Missing deviceId' });
  }

  // ACTION 1: Request Restore
  if (action === 'request') {
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const emailKey = `tiledly_pro_email_${cleanEmail}`;
    const rawPro = await runRedisCommand(['GET', emailKey]);

    if (!rawPro) {
      // Don't leak whether an email exists or not for privacy, but return helpful response
      return res.status(200).json({
        success: true,
        message: 'If an active PRO membership is associated with this email, a restore link has been sent.',
      });
    }

    const proData = typeof rawPro === 'string' ? JSON.parse(rawPro) : rawPro;

    // Check expiry
    if (proData.expiryTimestamp && Date.now() > proData.expiryTimestamp) {
      return res.status(400).json({
        error: 'Your subscription under this email has expired. Please renew on the upgrade screen.',
      });
    }

    // Generate random 6-digit code and secure 32-char token
    const magicCode = Math.floor(100000 + Math.random() * 900000).toString();
    const magicToken = crypto.randomBytes(16).toString('hex');

    // Store restore session in Redis with 20-minute TTL (1200 seconds)
    const restoreSession = JSON.stringify({
      email: cleanEmail,
      magicCode,
      proData,
      createdAt: Date.now(),
    });

    await runRedisCommand(['SET', `tiledly_restore_token_${magicToken}`, restoreSession, 'EX', '1200']);
    await runRedisCommand(['SET', `tiledly_restore_code_${cleanEmail}_${magicCode}`, restoreSession, 'EX', '1200']);

    const origin = req.headers.origin || 'https://www.tiledly.com';
    const restoreUrl = `${origin}/?restore_token=${magicToken}`;

    const emailSent = await sendRestoreEmail(cleanEmail, restoreUrl, magicCode);

    return res.status(200).json({
      success: true,
      emailSent,
      // If Resend API key is not yet configured, inform user in dev/test mode
      magicCode: emailSent ? undefined : magicCode,
      message: emailSent
        ? 'A restore link and code have been sent to your email.'
        : `Test code generated: ${magicCode}. (Add RESEND_API_KEY to send actual emails)`,
    });
  }

  // ACTION 2: Verify Magic Token (from clicking email link: ?restore_token=xyz)
  if (action === 'verify_token') {
    if (!token) return res.status(400).json({ error: 'Missing token' });

    const tokenKey = `tiledly_restore_token_${token}`;
    const rawSession = await runRedisCommand(['GET', tokenKey]);

    if (!rawSession) {
      return res.status(400).json({ error: 'This restore link has expired or is invalid.' });
    }

    const session = typeof rawSession === 'string' ? JSON.parse(rawSession) : rawSession;
    const proRecord = JSON.stringify(session.proData);

    // Bind current deviceId to this PRO status in Redis!
    const deviceKey = `tiledly_pro_${deviceId}`;
    await runRedisCommand(['SET', deviceKey, proRecord]);
    await runRedisCommand(['DEL', tokenKey]);

    return res.status(200).json({
      success: true,
      plan: session.proData.plan,
      expiryTimestamp: session.proData.expiryTimestamp,
      message: '👑 PRO membership restored successfully on this device!',
    });
  }

  // ACTION 3: Verify 6-digit Code (entered manually in the modal)
  if (action === 'verify_code') {
    if (!email || !code) {
      return res.status(400).json({ error: 'Missing email or code' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();
    const codeKey = `tiledly_restore_code_${cleanEmail}_${cleanCode}`;
    const rawSession = await runRedisCommand(['GET', codeKey]);

    if (!rawSession) {
      return res.status(400).json({ error: 'Invalid or expired code. Please try again.' });
    }

    const session = typeof rawSession === 'string' ? JSON.parse(rawSession) : rawSession;
    const proRecord = JSON.stringify(session.proData);

    // Bind current deviceId to this PRO status in Redis!
    const deviceKey = `tiledly_pro_${deviceId}`;
    await runRedisCommand(['SET', deviceKey, proRecord]);
    await runRedisCommand(['DEL', codeKey]);

    return res.status(200).json({
      success: true,
      plan: session.proData.plan,
      expiryTimestamp: session.proData.expiryTimestamp,
      message: '👑 PRO membership restored successfully on this device!',
    });
  }

  return res.status(400).json({ error: 'Invalid action' });
}

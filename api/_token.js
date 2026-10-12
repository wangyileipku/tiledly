// Cryptographic PRO Token generation and verification
// Uses HMAC-SHA256 with a server-side secret to sign client PRO session tokens.
// This prevents client-side localStorage tampering or spoofing.

import crypto from 'crypto';

function getProSecret() {
  const secret = process.env.PRO_SIGNING_SECRET;
  if (!secret) {
    throw new Error('PRO_SIGNING_SECRET environment variable is required');
  }
  return secret;
}

/**
 * Generate a signed PRO authentication token for a verified device.
 * @param {string} deviceId
 * @param {string} plan 'monthly' | 'lifetime' | 'supporter'
 * @param {number|null} expiryTimestamp
 * @returns {string} HMAC-SHA256 hex string
 */
export function createProToken(deviceId, plan = 'monthly', expiryTimestamp = null) {
  const secret = getProSecret();
  const payload = `${deviceId}:${plan}:${expiryTimestamp || 'lifetime'}`;
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Verify a PRO authentication token against expected device credentials.
 * @param {string} token
 * @param {string} deviceId
 * @param {string} plan
 * @param {number|null} expiryTimestamp
 * @returns {boolean}
 */
export function verifyProToken(token, deviceId, plan = 'monthly', expiryTimestamp = null) {
  if (!token || typeof token !== 'string' || token.length !== 64) return false;
  const expected = createProToken(deviceId, plan, expiryTimestamp);
  try {
    return crypto.timingSafeEqual(Buffer.from(token, 'hex'), Buffer.from(expected, 'hex'));
  } catch (_) {
    return false;
  }
}

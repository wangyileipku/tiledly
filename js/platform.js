/**
 * Tiledly Platform Configuration
 *
 * This file is the single source of truth for which distribution target
 * the current build is running as.
 *
 * STANDALONE  — tiledly.com (AdSense + Stripe PRO, full API, PWA)
 * CRAZYGAMES  — CrazyGames.com (CrazyGames SDK ads, no Stripe/AdSense)
 * POKI        — Poki.com (Poki SDK ads, no external requests at all)
 *
 * When building a platform ZIP:
 *   sed -i "s/export const PLATFORM = 'standalone'/export const PLATFORM = 'crazygames'/" js/platform.js
 *   sed -i "s/export const PLATFORM = 'standalone'/export const PLATFORM = 'poki'/" js/platform.js
 *
 * DO NOT import this file in any server-side / Vercel API route — it is
 * browser-only. Vercel reads no value from this file.
 */

/** @type {'standalone' | 'crazygames' | 'poki'} */
export const PLATFORM = 'standalone';

export const IS_STANDALONE = PLATFORM === 'standalone';
export const IS_CRAZYGAMES = PLATFORM === 'crazygames';
export const IS_POKI       = PLATFORM === 'poki';

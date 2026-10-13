/**
 * AdAdapter — Unified Platform Ad Interface
 *
 * This is the ONLY file that app.js (and any other game code) should import
 * for ad/lifecycle calls. It routes to the correct platform implementation
 * based on the PLATFORM build constant.
 *
 * On the standalone website (tiledly.com):
 *   - showMidgame() and showRewarded() are no-ops (AdSense runs via static slots)
 *   - Lifecycle methods (gameplayStart, etc.) are no-ops
 *   - Vercel deployment is completely unaffected
 *
 * On platform builds:
 *   - All calls are forwarded to the appropriate SDK adapter
 *   - The SDK <script> tag must be present in the platform-specific index.html
 */

import { IS_CRAZYGAMES, IS_POKI } from '../platform.js';
import { CrazyGamesAdapter } from './crazygames-adapter.js';
import { PokiAdapter } from './poki-adapter.js';

export const AdAdapter = {
  /**
   * Initialize the platform ad SDK. Call once on app startup.
   */
  init() {
    if (IS_CRAZYGAMES) CrazyGamesAdapter.init();
    if (IS_POKI)       PokiAdapter.init();
    // Standalone: nothing to do — AdSense loads via <script> in index.html
  },

  /**
   * Signal that all game assets have loaded and the game is ready.
   * Required by Poki; no-op on all other platforms.
   */
  loadingFinished() {
    if (IS_POKI) PokiAdapter.loadingFinished();
  },

  /**
   * Signal that active gameplay has begun (round start, unpause).
   * Forwarded to Poki and CrazyGames.
   */
  gameplayStart() {
    if (IS_CRAZYGAMES) CrazyGamesAdapter.gameplayStart();
    if (IS_POKI)       PokiAdapter.gameplayStart();
  },

  /**
   * Signal that active gameplay has stopped (round end, pause, back to menu).
   * Forwarded to Poki and CrazyGames.
   */
  gameplayStop() {
    if (IS_CRAZYGAMES) CrazyGamesAdapter.gameplayStop();
    if (IS_POKI)       PokiAdapter.gameplayStop();
  },

  /**
   * Show a midgame / interstitial ad at a natural break point (e.g. between rounds).
   * Must NOT be called during active gameplay.
   * Always resolves — game flow is never blocked if no ad fills.
   * No-op on standalone (AdSense display ads are always-visible static slots).
   * @returns {Promise<void>}
   */
  async showMidgame() {
    if (IS_CRAZYGAMES) return CrazyGamesAdapter.showMidgame();
    if (IS_POKI)       return PokiAdapter.showMidgame();
    return Promise.resolve();
  },

  /**
   * Show a rewarded ad when the player explicitly opts in (e.g. "Watch ad → Save streak").
   * Returns true if the player completed watching and should receive the reward.
   * Returns false on standalone (rewarded ad not available — player must use PRO).
   * @returns {Promise<boolean>}
   */
  async showRewarded() {
    if (IS_CRAZYGAMES) return CrazyGamesAdapter.showRewarded();
    if (IS_POKI)       return PokiAdapter.showRewarded();
    return Promise.resolve(false);
  },
};

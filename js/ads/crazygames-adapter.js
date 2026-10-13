/**
 * CrazyGames Ad Adapter
 *
 * Wraps the CrazyGames SDK v3 ad API into the shared AdAdapter interface.
 * The SDK script must be loaded in index.crazygames.html before this runs:
 *   <script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>
 *
 * Reference: https://docs.crazygames.com/sdk/html5/
 */
export const CrazyGamesAdapter = {
  get _sdk() {
    return window.CrazyGames?.SDK ?? null;
  },

  async init() {
    if (!this._sdk) {
      console.warn('[CrazyGames] SDK script not loaded — running in offline/standalone mode.');
      return;
    }
    try {
      await this._sdk.init();
      console.log('[CrazyGames] SDK v3 initialized successfully!');
    } catch (err) {
      console.warn('[CrazyGames] SDK init warning:', err);
    }
  },

  /**
   * Show a midgame (interstitial) ad between rounds.
   * Always resolves so the game continues even if no ad is filled.
   * @returns {Promise<void>}
   */
  showMidgame() {
    return new Promise((resolve) => {
      if (!this._sdk?.ad) return resolve();

      this._sdk.ad.requestAd('midgame', {
        adStarted: () => {
          // Pause/mute hook if audio exists
        },
        adFinished: () => resolve(),
        adError: (_err) => resolve(), // always continue — ad may simply not fill
      });
    });
  },

  /**
   * Show a rewarded ad. Returns true only if the user watched it to completion.
   * @returns {Promise<boolean>}
   */
  showRewarded() {
    return new Promise((resolve) => {
      if (!this._sdk?.ad) return resolve(false);

      this._sdk.ad.requestAd('rewarded', {
        adStarted: () => {},
        adFinished: () => resolve(true),
        adError: (_err) => resolve(false),
      });
    });
  },

  // Game lifecycle methods (tracked by CrazyGames for gameplay session analytics and load size)
  loadingFinished() {},
  
  gameplayStart() {
    try {
      this._sdk?.game?.gameplayStart();
    } catch (_) {}
  },
  
  gameplayStop() {
    try {
      this._sdk?.game?.gameplayStop();
    } catch (_) {}
  },
};

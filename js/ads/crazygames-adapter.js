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

  init() {
    if (!this._sdk) {
      console.warn('[CrazyGames] SDK not loaded — ads will be skipped.');
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
          // Caller is responsible for pause/mute via AdAdapter.onAdStart hook
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

  // Poki-style lifecycle methods are no-ops on CrazyGames
  loadingFinished() {},
  gameplayStart()   {},
  gameplayStop()    {},
};

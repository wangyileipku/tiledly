/**
 * Poki Ad Adapter
 *
 * Wraps the Poki SDK v2 into the shared AdAdapter interface.
 * The SDK script must be loaded in index.poki.html before this runs:
 *   <script src="https://game-cdn.poki.com/scripts/v2/poki-sdk.js"></script>
 *
 * Poki requires ALL five lifecycle events to be called correctly.
 * Missing or misordered calls will cause QA failures during submission review.
 *
 * Required event flow:
 *   init() → loadingFinished() → [gameplayStart() ↔ gameplayStop()] → commercialBreak/rewardedBreak
 *
 * Reference: https://developers.poki.com/en/p4d/sdk/
 */
export const PokiAdapter = {
  get _sdk() {
    return window.PokiSDK ?? null;
  },

  /**
   * Called once on app init. Kicks off SDK handshake and signals loading started.
   */
  init() {
    if (!this._sdk) {
      console.warn('[Poki] SDK not loaded — ads will be skipped.');
      return;
    }

    this._sdk.init()
      .then(() => {
        // SDK ready — gameLoadingStart is implicit, nothing more to do here.
      })
      .catch(() => {
        // Poki SDK failed to init (e.g. running outside Poki iframe) — safe to ignore.
      });
  },

  /**
   * Call once all assets are loaded and the game is ready to play.
   * This ends Poki's loading screen.
   */
  loadingFinished() {
    this._sdk?.gameLoadingFinished();
  },

  /**
   * Call when the player actively starts gameplay (tap to start round, unpausing).
   */
  gameplayStart() {
    this._sdk?.gameplayStart();
  },

  /**
   * Call when gameplay is interrupted (round over, paused, back to menu).
   */
  gameplayStop() {
    this._sdk?.gameplayStop();
  },

  /**
   * Show a commercial break (interstitial) at a natural transition point.
   * Internally handles gameplayStop/Start around the ad break.
   * Always resolves so the game continues even if no ad is filled.
   * @returns {Promise<void>}
   */
  showMidgame() {
    return new Promise((resolve) => {
      if (!this._sdk) return resolve();

      this._sdk.gameplayStop();
      this._sdk.commercialBreak()
        .then(() => {
          this._sdk.gameplayStart();
          resolve();
        })
        .catch(() => resolve());
    });
  },

  /**
   * Show a rewarded ad. Returns true only if the player earned the reward.
   * @returns {Promise<boolean>}
   */
  showRewarded() {
    return new Promise((resolve) => {
      if (!this._sdk) return resolve(false);

      this._sdk.rewardedBreak()
        .then((rewarded) => resolve(!!rewarded))
        .catch(() => resolve(false));
    });
  },
};

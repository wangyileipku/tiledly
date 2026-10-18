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

  _isInitialized: false,
  _isAudioMuted: false,
  _settingsListener: null,

  async init() {
    if (!this._sdk) {
      console.warn('[CrazyGames] SDK script not loaded — running in offline/standalone mode.');
      return;
    }
    try {
      await this._sdk.init();
      this._isInitialized = true;
      console.log('[CrazyGames] SDK v3 initialized successfully!');

      // Start tracking game loading
      this.loadingStart();

      // Read initial platform settings (muteAudio)
      if (this._sdk.game?.settings) {
        this._isAudioMuted = !!this._sdk.game.settings.muteAudio;
      }

      // Register listener for platform settings changes
      if (this._sdk.game?.addSettingsChangeListener) {
        this._settingsListener = (newSettings) => {
          if (newSettings && typeof newSettings.muteAudio !== 'undefined') {
            this._isAudioMuted = !!newSettings.muteAudio;
            window.dispatchEvent(new CustomEvent('platform-audio-settings', {
              detail: { muteAudio: this._isAudioMuted }
            }));
          }
        };
        this._sdk.game.addSettingsChangeListener(this._settingsListener);
      }
    } catch (err) {
      console.warn('[CrazyGames] SDK init warning:', err);
    }
  },

  /**
   * Signal that the game started loading assets/resources.
   */
  loadingStart() {
    try {
      this._sdk?.game?.loadingStart();
    } catch (_) {}
  },

  /**
   * Signal that initial game loading has completed and the game is ready.
   */
  loadingStop() {
    try {
      this._sdk?.game?.loadingStop();
    } catch (_) {}
  },

  /**
   * Signal that active gameplay has started.
   */
  gameplayStart() {
    try {
      this._sdk?.game?.gameplayStart();
    } catch (_) {}
  },

  /**
   * Signal that active gameplay has stopped (menu, results, pause).
   */
  gameplayStop() {
    try {
      this._sdk?.game?.gameplayStop();
    } catch (_) {}
  },

  /**
   * Trigger the CrazyGames celebration confetti on high achievements.
   */
  happytime() {
    try {
      this._sdk?.game?.happytime();
    } catch (_) {}
  },

  /**
   * Returns whether audio should be muted per CrazyGames platform settings.
   */
  isAudioMuted() {
    return this._isAudioMuted;
  },

  /**
   * Show a midgame (interstitial) ad between rounds.
   * Dispatches ad audio events to prevent overlapping sound.
   * @returns {Promise<void>}
   */
  showMidgame() {
    return new Promise((resolve) => {
      if (!this._sdk?.ad) return resolve();

      window.dispatchEvent(new CustomEvent('ad:started'));

      this._sdk.ad.requestAd('midgame', {
        adStarted: () => {
          window.dispatchEvent(new CustomEvent('ad:playing'));
        },
        adFinished: () => {
          window.dispatchEvent(new CustomEvent('ad:finished'));
          resolve();
        },
        adError: (_err) => {
          window.dispatchEvent(new CustomEvent('ad:finished'));
          resolve();
        },
      });
    });
  },

  /**
   * Show a rewarded ad. Returns true only if the user watched it to completion.
   * Dispatches ad audio events.
   * @returns {Promise<boolean>}
   */
  showRewarded() {
    return new Promise((resolve) => {
      if (!this._sdk?.ad) return resolve(false);

      window.dispatchEvent(new CustomEvent('ad:started'));

      this._sdk.ad.requestAd('rewarded', {
        adStarted: () => {
          window.dispatchEvent(new CustomEvent('ad:playing'));
        },
        adFinished: () => {
          window.dispatchEvent(new CustomEvent('ad:finished'));
          resolve(true);
        },
        adError: (_err) => {
          window.dispatchEvent(new CustomEvent('ad:finished'));
          resolve(false);
        },
      });
    });
  },
};

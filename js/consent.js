// Cookie Consent & GDPR / ePrivacy Compliance Manager
// Implements Google Consent Mode v2 and user preference management.

import { Storage } from './storage.js';
import { Analytics } from './analytics.js';

export const Consent = {
  CONSENT_KEY: 'cookie_consent', // 'all' | 'essential' | null

  getConsent() {
    return Storage.getSetting(this.CONSENT_KEY, null);
  },

  hasUserDecided() {
    return this.getConsent() !== null;
  },

  isEuResident() {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      return tz.startsWith('Europe/') || tz.startsWith('Atlantic/Reykjavik');
    } catch (_) {
      return false;
    }
  },

  init() {
    const consent = this.getConsent();

    if (consent === 'all') {
      this.applyConsent(true);
    } else if (consent === 'essential') {
      this.applyConsent(false);
    } else {
      // First visit:
      if (this.isEuResident()) {
        // EU / UK visitor: keep default denied and present the consent banner
        this.applyConsent(false);
        this.showBanner();
      } else {
        // US & Non-EU visitor: auto-grant consent, never show banner
        this.acceptAll();
      }
    }

    this.bindEvents();
  },

  /**
   * Update Google Consent Mode v2 and third-party trackers.
   * @param {boolean} granted
   */
  applyConsent(granted) {
    if (typeof window.gtag === 'function') {
      window.gtag('consent', 'update', {
        'ad_storage': granted ? 'granted' : 'denied',
        'ad_user_data': granted ? 'granted' : 'denied',
        'ad_personalization': granted ? 'granted' : 'denied',
        'analytics_storage': granted ? 'granted' : 'denied',
      });
    }

    if (granted && Analytics && typeof Analytics.init === 'function') {
      Analytics.init();
    }
  },

  /**
   * User accepts all cookies (analytics + ads).
   */
  acceptAll() {
    Storage.setSetting(this.CONSENT_KEY, 'all');
    this.applyConsent(true);
    this.hideBanner();
  },

  /**
   * User selects essential cookies only (game saves + streak state).
   */
  acceptEssentialOnly() {
    Storage.setSetting(this.CONSENT_KEY, 'essential');
    this.applyConsent(false);
    this.hideBanner();
  },

  showBanner() {
    if (typeof document === 'undefined') return;
    const banner = document.getElementById('cookie-consent-banner');
    if (banner) {
      banner.classList.remove('hidden');
    }
  },

  hideBanner() {
    if (typeof document === 'undefined') return;
    const banner = document.getElementById('cookie-consent-banner');
    if (banner) {
      banner.classList.add('hidden');
    }
  },

  openPreferences() {
    this.showBanner();
  },

  bindEvents() {
    if (typeof document === 'undefined') return;
    const acceptBtn = document.getElementById('cookie-accept-btn');
    const essentialBtn = document.getElementById('cookie-essential-btn');
    const settingsBtn = document.getElementById('home-cookie-settings-btn');

    if (acceptBtn) {
      acceptBtn.addEventListener('click', () => this.acceptAll());
    }
    if (essentialBtn) {
      essentialBtn.addEventListener('click', () => this.acceptEssentialOnly());
    }
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => this.openPreferences());
    }
  }
};

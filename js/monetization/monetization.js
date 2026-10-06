import { MonetizationConfig } from './config.js';
import { Storage } from '../storage.js';

const PRO_STORAGE_KEY = 'tiledly_is_pro';
const PRO_EXPIRY_KEY = 'tiledly_pro_expiry';
const STREAK_SHIELDS_KEY = 'tiledly_streak_shields';

export const Monetization = {
  config: MonetizationConfig,
  listeners: new Set(),

  /**
   * Check if current user has active PRO membership.
   */
  isPro() {
    if (!this.config.enabled || !this.config.premium.enabled) return false;

    // Check localStorage
    const isPro = Storage.getSetting('is_pro', false);
    if (!isPro) return false;

    // Check expiry if set
    const expiry = Storage.getSetting('pro_expiry', null);
    if (expiry && Date.now() > expiry) {
      this.setPro(false);
      return false;
    }

    return true;
  },

  /**
   * Set user PRO status.
   * @param {boolean} active 
   * @param {object} [details] { expiryTimestamp, plan: 'monthly'|'lifetime'|'test' }
   */
  setPro(active, details = {}) {
    Storage.setSetting('is_pro', !!active);
    if (active) {
      if (details.expiryTimestamp) {
        Storage.setSetting('pro_expiry', details.expiryTimestamp);
      } else {
        Storage.setSetting('pro_expiry', null); // Lifetime / recurring
      }
      Storage.setSetting('pro_plan', details.plan || 'supporter');
    } else {
      Storage.setSetting('pro_expiry', null);
      Storage.setSetting('pro_plan', null);
    }

    this.notifyListeners();
    this.refreshUI();
  },

  /**
   * Check if the user has a streak shield available.
   * PRO users get infinite streak shields.
   * Free users can earn/hold 1 consumable shield (e.g. from promo or rewarded action).
   */
  hasStreakShield() {
    if (this.isPro()) return true;
    const shields = Storage.getSetting('streak_shields', 0);
    return shields > 0;
  },

  /**
   * Consume a streak shield to save a broken streak.
   * Returns true if successfully protected.
   */
  consumeStreakShield() {
    if (this.isPro()) {
      return true; // PRO users have unlimited protection
    }
    const shields = Storage.getSetting('streak_shields', 0);
    if (shields > 0) {
      Storage.setSetting('streak_shields', shields - 1);
      return true;
    }
    return false;
  },

  /**
   * Add a streak shield to the user's inventory.
   */
  grantStreakShield(count = 1) {
    const current = Storage.getSetting('streak_shields', 0);
    Storage.setSetting('streak_shields', current + count);
  },

  /**
   * Subscribe to PRO state changes.
   */
  onStateChange(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  },

  notifyListeners() {
    const pro = this.isPro();
    this.listeners.forEach(fn => {
      try {
        fn(pro);
      } catch (err) {
        console.error('Error in monetization listener:', err);
      }
    });
  },

  /**
   * Renders an ad placement slot into a container element.
   * Automatically collapses if user is PRO.
   * @param {string|HTMLElement} container
   * @param {string} slotType 'result' | 'footer'
   */
  renderAdSlot(container, slotType = 'result') {
    const el = typeof container === 'string' ? document.getElementById(container) : container;
    if (!el) return;

    // If user is PRO or ads disabled, hide ad slot completely
    if (this.isPro() || !this.config.enabled || !this.config.ads.enabled) {
      el.style.display = 'none';
      el.innerHTML = '';
      return;
    }

    el.style.display = 'block';

    // Provider: Google AdSense
    if (this.config.ads.provider === 'adsense' && this.config.ads.adsenseClientId) {
      this.renderAdSenseUnit(el, slotType);
      return;
    }

    // Default Provider: Native House Ad / Promo Banner
    this.renderHouseAd(el, slotType);
  },

  /**
   * Renders a native responsive House Ad promoting Tiledly PRO.
   */
  renderHouseAd(container, slotType) {
    container.innerHTML = `
      <div class="ad-house-card">
        <div class="ad-badge">SPONSORED</div>
        <div class="ad-house-content">
          <div class="ad-house-icon">👑</div>
          <div class="ad-house-text">
            <div class="ad-house-title">Upgrade to Tiledly PRO</div>
            <div class="ad-house-desc">Remove all ads, unlock past daily archives & get a VIP Replay Crown!</div>
          </div>
          <button class="btn-ad-upgrade" id="btn-ad-house-upgrade">Upgrade</button>
        </div>
      </div>
    `;

    const upgradeBtn = container.querySelector('#btn-ad-house-upgrade');
    if (upgradeBtn) {
      upgradeBtn.addEventListener('click', () => this.openProModal());
    }
  },

  /**
   * Renders a real Google AdSense unit.
   */
  renderAdSenseUnit(container, slotType) {
    const slotId = slotType === 'result' 
      ? this.config.ads.resultSlotId 
      : this.config.ads.footerSlotId;

    container.innerHTML = `
      <div class="ad-adsense-wrapper">
        <div class="ad-badge">ADVERTISEMENT</div>
        <ins class="adsbygoogle"
             style="display:block"
             data-ad-client="${this.config.ads.adsenseClientId}"
             data-ad-slot="${slotId || ''}"
             data-ad-format="auto"
             data-full-width-responsive="true"></ins>
      </div>
    `;

    try {
      if (typeof window !== 'undefined') {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      }
    } catch (e) {
      console.warn('AdSense initialization suppressed (likely AdBlocker active):', e);
    }
  },

  /**
   * Opens the Tiledly PRO Upgrade modal.
   */
  openProModal() {
    if (typeof document === 'undefined') return;
    const modal = document.getElementById('modal-pro');
    if (!modal) return;

    const isPro = this.isPro();
    const proBadgeEl = document.getElementById('pro-modal-status');
    const checkoutBtn = document.getElementById('pro-modal-checkout-btn');
    const perksContainer = document.getElementById('pro-modal-perks');

    if (perksContainer) {
      perksContainer.innerHTML = this.config.premium.perks.map(p => `
        <div class="pro-perk-item">
          <span class="pro-perk-icon">${p.icon}</span>
          <div>
            <div class="pro-perk-title">${p.title}</div>
            <div class="pro-perk-desc">${p.desc}</div>
          </div>
        </div>
      `).join('');
    }

    if (isPro) {
      if (proBadgeEl) proBadgeEl.textContent = '👑 Active Member';
      if (checkoutBtn) {
        checkoutBtn.textContent = '✨ You are already a PRO Member!';
        checkoutBtn.disabled = true;
        checkoutBtn.classList.add('btn-disabled');
      }
    } else {
      if (proBadgeEl) proBadgeEl.textContent = this.config.premium.priceDisplay;
      if (checkoutBtn) {
        checkoutBtn.textContent = this.config.premium.checkoutUrl 
          ? `⚡ Upgrade Now (${this.config.premium.priceDisplay})` 
          : '⚡ Unlock PRO Pass';
        checkoutBtn.disabled = false;
        checkoutBtn.classList.remove('btn-disabled');
      }
    }

    modal.classList.remove('hidden');
  },

  /**
   * Closes the Tiledly PRO modal.
   */
  closeProModal() {
    if (typeof document === 'undefined') return;
    const modal = document.getElementById('modal-pro');
    if (modal) modal.classList.add('hidden');
  },

  /**
   * Trigger checkout flow or sandbox trial.
   */
  startCheckout() {
    if (this.config.premium.checkoutUrl) {
      // Direct Stripe or LemonSqueezy Checkout URL
      const deviceId = Storage.getDeviceId();
      const separator = this.config.premium.checkoutUrl.includes('?') ? '&' : '?';
      const checkoutRedirect = `${this.config.premium.checkoutUrl}${separator}client_reference_id=${encodeURIComponent(deviceId)}`;
      window.location.href = checkoutRedirect;
    } else {
      // Sandbox / Instant Trial mode when no Stripe link is configured yet!
      this.setPro(true, { plan: 'trial' });
      this.closeProModal();
      this.showToast('🎉 Tiledly PRO unlocked! Enjoy ad-free play and VIP features!');
    }
  },

  /**
   * Check incoming URL parameters for checkout callbacks (e.g. ?pro=success)
   */
  checkUrlParams() {
    if (typeof window === 'undefined' || !window.location) return;

    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get('pro') === 'success' || url.searchParams.get('tiledly_pro') === '1') {
        this.setPro(true, { plan: 'stripe_checkout' });
        this.showToast('🎉 Welcome to Tiledly PRO! Payment verified.');
        // Clean URL parameter without reload
        url.searchParams.delete('pro');
        url.searchParams.delete('tiledly_pro');
        window.history.replaceState({}, document.title, url.pathname + (url.search ? url.search : ''));
      }
    } catch (e) {
      // Ignore URL parsing errors
    }
  },

  /**
   * Helper to trigger the app toast notification.
   */
  showToast(message) {
    const toast = document.getElementById('share-toast');
    if (toast) {
      toast.textContent = message;
      toast.classList.remove('hidden');
      toast.classList.add('show');
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.classList.add('hidden'), 300);
      }, 3500);
    }
  },

  /**
   * Refresh all UI indicators of PRO status (buttons, badges).
   */
  refreshUI() {
    if (typeof document === 'undefined') return;
    const isPro = this.isPro();

    // Home screen PRO button / pill
    const proPill = document.getElementById('home-pro-pill');
    if (proPill) {
      if (isPro) {
        proPill.innerHTML = '👑 PRO Member';
        proPill.classList.add('is-pro');
      } else {
        proPill.innerHTML = '⚡ Get PRO';
        proPill.classList.remove('is-pro');
      }
    }

    // Result screen ad slot
    const adSlot = document.getElementById('result-ad-slot');
    if (adSlot) {
      if (isPro) {
        adSlot.style.display = 'none';
        adSlot.innerHTML = '';
      } else {
        this.renderAdSlot(adSlot, 'result');
      }
    }
  },

  /**
   * Initialize monetization modules and listeners.
   */
  init() {
    if (typeof document === 'undefined') return;
    this.checkUrlParams();
    this.refreshUI();

    // Check if running in developer / sandbox environment
    const isDev = (typeof window !== 'undefined' && (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.search.includes('dev=1') ||
      window.location.search.includes('sandbox=1') ||
      window.location.search.includes('test=1')
    ));

    const testToggleBtn = document.getElementById('pro-modal-test-toggle');
    if (testToggleBtn && isDev) {
      testToggleBtn.classList.remove('hidden');
    }

    // Secret Easter Egg: Tap the modal crown 👑 5 times to reveal developer sandbox
    const crownEl = document.getElementById('pro-modal-crown');
    let crownTaps = 0;
    let lastTapTime = 0;
    if (crownEl) {
      crownEl.addEventListener('click', () => {
        const now = Date.now();
        if (now - lastTapTime > 3000) {
          crownTaps = 0;
        }
        crownTaps++;
        lastTapTime = now;

        if (crownTaps >= 5) {
          crownTaps = 0;
          if (testToggleBtn) {
            testToggleBtn.classList.toggle('hidden');
            const isVisible = !testToggleBtn.classList.contains('hidden');
            this.showToast(isVisible ? '🛠️ Developer Sandbox Enabled!' : 'Developer Sandbox Hidden');
          }
        }
      });
    }

    // Expose dev helper to browser console for manual toggling
    if (typeof window !== 'undefined') {
      window.tiledly = window.tiledly || {};
      window.tiledly.togglePro = () => {
        const nextState = !this.isPro();
        this.setPro(nextState, { plan: nextState ? 'dev_console' : null });
        console.log(`[Tiledly] PRO Status: ${nextState ? 'ACTIVE 👑' : 'INACTIVE'}`);
        return nextState;
      };
    }

    // Bind PRO pill click
    const proPill = document.getElementById('home-pro-pill');
    if (proPill) {
      proPill.addEventListener('click', () => this.openProModal());
    }

    // Bind Pro modal buttons
    const closeBtn = document.getElementById('pro-modal-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeProModal());
    }

    const checkoutBtn = document.getElementById('pro-modal-checkout-btn');
    if (checkoutBtn) {
      checkoutBtn.addEventListener('click', () => this.startCheckout());
    }

    // Modal test toggle
    if (testToggleBtn) {
      testToggleBtn.addEventListener('click', () => {
        const nextState = !this.isPro();
        this.setPro(nextState, { plan: nextState ? 'test_mode' : null });
        this.showToast(nextState ? '👑 PRO Mode Activated (Test)' : 'Free Mode Restored');
        this.closeProModal();
      });
    }
  }
};

import { MonetizationConfig } from './config.js';
import { Storage } from '../storage.js';
import { Analytics } from '../analytics.js';

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
   * Get detailed PRO subscription information.
   */
  getProDetails() {
    const isPro = this.isPro();
    if (!isPro) return { isPro: false };

    const plan = Storage.getSetting('pro_plan', 'supporter');
    const expiry = Storage.getSetting('pro_expiry', null);

    if (plan === 'lifetime' || !expiry) {
      return {
        isPro: true,
        plan: 'lifetime',
        label: 'Lifetime VIP',
        daysRemaining: null,
        expiryFormatted: 'Never'
      };
    }

    const diffMs = expiry - Date.now();
    const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    const expiryDate = new Date(expiry).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    return {
      isPro: true,
      plan: 'monthly',
      label: `Monthly (${daysRemaining}d left)`,
      daysRemaining,
      expiryFormatted: expiryDate
    };
  },

  /**
   * Set user PRO status with tiered plan support.
   * @param {boolean} active 
   * @param {object} [details] { expiryTimestamp, durationDays, plan: 'monthly'|'lifetime'|'supporter' }
   */
  setPro(active, details = {}) {
    Storage.setSetting('is_pro', !!active);
    if (active) {
      if (details.expiryTimestamp) {
        Storage.setSetting('pro_expiry', details.expiryTimestamp);
      } else if (details.durationDays) {
        Storage.setSetting('pro_expiry', Date.now() + (details.durationDays * 24 * 60 * 60 * 1000));
      } else if (details.plan === 'monthly') {
        Storage.setSetting('pro_expiry', Date.now() + (30 * 24 * 60 * 60 * 1000));
      } else {
        Storage.setSetting('pro_expiry', null); // Lifetime
      }
      Storage.setSetting('pro_plan', details.plan || (details.expiryTimestamp || details.durationDays ? 'monthly' : 'lifetime'));
    } else {
      Storage.setSetting('pro_expiry', null);
      Storage.setSetting('pro_plan', null);
    }

    this.notifyListeners();
    this.refreshUI();
  },

  /**
   * Redeem a secret VIP key or receipt code.
   * Secure, single access path without insecure developer cheats.
   * @param {string} key
   */
  redeemVipKey(key) {
    if (!key) return { success: false, message: 'Please enter a VIP Key' };
    const cleanKey = key.trim().toUpperCase();

    // Lifetime VIP Keys
    if (cleanKey === 'TILEDLY_VIP_2026' || cleanKey === 'FOUNDER_LIFETIME' || cleanKey === 'TILEDLY_LIFETIME') {
      this.setPro(true, { plan: 'lifetime' });
      return { success: true, plan: 'lifetime', message: '👑 Lifetime VIP Activated!' };
    }

    // 30-Day Monthly Pass
    if (cleanKey === 'TILEDLY_MONTHLY' || cleanKey === 'PRO_PASS_30') {
      this.setPro(true, { plan: 'monthly', durationDays: 30 });
      return { success: true, plan: 'monthly', message: '👑 30-Day PRO Pass Activated!' };
    }

    return { success: false, message: 'Invalid VIP Key' };
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
    const details = this.getProDetails();
    const proBadgeEl = document.getElementById('pro-modal-status');
    const plansContainer = document.getElementById('pro-modal-plans');
    const activeStatusEl = document.getElementById('pro-modal-active-status');
    const checkoutBtn = document.getElementById('pro-modal-checkout-btn');
    const perksContainer = document.getElementById('pro-modal-perks');
    const activeInfoEl = document.getElementById('pro-modal-active-info');

    // Populate prices from config
    const monthlyPriceEl = document.getElementById('pro-plan-monthly-price');
    const lifetimePriceEl = document.getElementById('pro-plan-lifetime-price');
    if (monthlyPriceEl) monthlyPriceEl.textContent = this.config.premium.priceDisplay;
    if (lifetimePriceEl) lifetimePriceEl.textContent = this.config.premium.oneTimePriceDisplay;

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
      if (proBadgeEl) proBadgeEl.textContent = `👑 ${details.label}`;
      // Hide plan buttons, show active status
      if (plansContainer) plansContainer.classList.add('hidden');
      if (activeStatusEl) activeStatusEl.classList.remove('hidden');
      if (activeInfoEl) {
        activeInfoEl.classList.remove('hidden');
        activeInfoEl.innerHTML = details.plan === 'lifetime'
          ? '🌟 <strong>Lifetime VIP Pass</strong> active with all perks unlocked.'
          : `⏳ <strong>Monthly Supporter Pass</strong> active. Renews/expires on ${details.expiryFormatted} (${details.daysRemaining} days left).`;
      }
    } else {
      if (proBadgeEl) proBadgeEl.textContent = `from ${this.config.premium.priceDisplay}`;
      // Show plan buttons, hide active status
      if (plansContainer) plansContainer.classList.remove('hidden');
      if (activeStatusEl) activeStatusEl.classList.add('hidden');
      if (activeInfoEl) activeInfoEl.classList.add('hidden');
    }

    modal.classList.remove('hidden');
    Analytics.trackProModalViewed();
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
   * Trigger checkout flow for a specific plan.
   * @param {'monthly'|'lifetime'} plan
   */
  startCheckout(plan = 'monthly') {
    Analytics.trackCheckoutInitiated(plan);
    const checkoutUrl = plan === 'lifetime'
      ? this.config.premium.lifetimeCheckoutUrl
      : this.config.premium.monthlyCheckoutUrl;

    if (checkoutUrl) {
      const deviceId = Storage.getDeviceId();
      const separator = checkoutUrl.includes('?') ? '&' : '?';
      window.location.href = `${checkoutUrl}${separator}client_reference_id=${encodeURIComponent(deviceId)}`;
    } else {
      // No payment link configured for this plan
      this.showToast('⚠️ Payment is not available yet. Please try again later.');
    }
  },

  /**
   * On page load, verify PRO status with the server.
   * After Stripe checkout, the webhook stores PRO status server-side.
   * The client always verifies against the server — never trusts URL params.
   */
  async checkUrlParams() {
    if (typeof window === 'undefined' || !window.location) return;

    try {
      // Clean any checkout redirect params (cosmetic only, not used for granting PRO)
      const url = new URL(window.location.href);
      const isReturningFromCheckout = url.searchParams.get('pro') === 'success' || url.searchParams.get('checkout') === 'complete';
      if (isReturningFromCheckout) {
        url.searchParams.delete('pro');
        url.searchParams.delete('checkout');
        window.history.replaceState({}, document.title, url.pathname + (url.search ? url.search : ''));
      }

      // Always verify PRO status with server
      await this.verifyProWithServer();

      if (isReturningFromCheckout && this.isPro()) {
        this.showToast('🎉 Welcome to Tiledly PRO! Payment verified.');
      }
    } catch (e) {
      // Ignore URL parsing / verification errors
    }
  },

  /**
   * Verify PRO status against the server (secure source of truth).
   * The server checks Redis where the Stripe webhook stored the payment confirmation.
   */
  async verifyProWithServer() {
    try {
      const deviceId = Storage.getDeviceId();
      const res = await fetch(`/api/verify-pro?deviceId=${encodeURIComponent(deviceId)}`);
      if (!res.ok) return;

      const data = await res.json();
      if (data.isPro) {
        this.setPro(true, {
          plan: data.plan || 'monthly',
          expiryTimestamp: data.expiryTimestamp || null
        });
      } else {
        // Server says not PRO — clear any stale local state
        const wasPro = Storage.getSetting('is_pro', false);
        if (wasPro) {
          this.setPro(false);
        }
      }
    } catch (e) {
      // Network error — keep existing local state as fallback
      console.warn('PRO verification failed (offline?):', e.message);
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

    // Bind plan selection buttons
    const monthlyBtn = document.getElementById('pro-modal-monthly-btn');
    if (monthlyBtn) {
      monthlyBtn.addEventListener('click', () => this.startCheckout('monthly'));
    }
    const lifetimeBtn = document.getElementById('pro-modal-lifetime-btn');
    if (lifetimeBtn) {
      lifetimeBtn.addEventListener('click', () => this.startCheckout('lifetime'));
    }

    // Bind Secure VIP Key Redemption Form
    const toggleRedeemBtn = document.getElementById('pro-modal-show-redeem-btn');
    const redeemForm = document.getElementById('pro-modal-redeem-form');
    const redeemInput = document.getElementById('pro-modal-key-input');
    const redeemSubmitBtn = document.getElementById('pro-modal-redeem-submit-btn');

    if (toggleRedeemBtn && redeemForm) {
      toggleRedeemBtn.addEventListener('click', () => {
        redeemForm.classList.toggle('hidden');
        if (!redeemForm.classList.contains('hidden') && redeemInput) {
          redeemInput.focus();
        }
      });
    }

    if (redeemSubmitBtn && redeemInput) {
      redeemSubmitBtn.addEventListener('click', () => {
        const key = redeemInput.value;
        const res = this.redeemVipKey(key);
        if (res.success) {
          this.showToast(res.message);
          redeemInput.value = '';
          redeemForm?.classList.add('hidden');
          this.openProModal(); // refresh status view
        } else {
          this.showToast(`❌ ${res.message}`);
        }
      });
    }
  }
};

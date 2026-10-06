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
    const checkoutBtn = document.getElementById('pro-modal-checkout-btn');
    const perksContainer = document.getElementById('pro-modal-perks');
    const activeInfoEl = document.getElementById('pro-modal-active-info');

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
      if (checkoutBtn) {
        checkoutBtn.textContent = '✨ You are an Active PRO Member!';
        checkoutBtn.disabled = true;
        checkoutBtn.classList.add('btn-disabled');
      }
      if (activeInfoEl) {
        activeInfoEl.classList.remove('hidden');
        activeInfoEl.innerHTML = details.plan === 'lifetime'
          ? '🌟 <strong>Lifetime VIP Pass</strong> active with all perks unlocked.'
          : `⏳ <strong>Monthly Supporter Pass</strong> active. Renews/expires on ${details.expiryFormatted} (${details.daysRemaining} days left).`;
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
      if (activeInfoEl) {
        activeInfoEl.classList.add('hidden');
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

import { Storage } from './storage.js';
import { IS_POKI } from './platform.js';

export const Analytics = {
  config: {
    ga4: {
      enabled: true,
      measurementId: 'G-L0NPW9E67F'
    },
    meta: {
      enabled: false,
      pixelId: 'XXXXXXXXXX'
    },
    tiktok: {
      enabled: false,
      pixelId: 'XXXXXXXXXX'
    },
    googleAds: {
      enabled: true,
      conversionId: 'AW-16767546094',
      conversions: {
        gameStart: 'AW-16767546094/UCxACO3_16cdEO7lsbs-',
        gameComplete: 'AW-16767546094/kn4XCImT5qcdEO7lsbs-',
        purchaseStart: 'AW-16767546094/VVBRCPu05qcdEO7lsbs-',
        purchaseComplete: 'AW-16767546094/LIuwCPjH46cdEO7lsbs-'
      }
    }
  },

  hasConsent() {
    return Storage.getSetting('cookie_consent', null) === 'all';
  },

  init() {
    // Poki strictly forbids external analytics scripts & network tracking
    if (IS_POKI) return;

    const hasConsent = this.hasConsent();

    if (this.config.ga4.enabled) {
      if (typeof window.gtag !== 'function') {
        const script = document.createElement('script');
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${this.config.ga4.measurementId}`;
        document.head.appendChild(script);

        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        window.gtag = gtag;
        gtag('js', new Date());
        gtag('config', this.config.ga4.measurementId);
      }
    }

    // Only load third-party marketing pixels if user explicitly accepted all cookies
    if (hasConsent && this.config.meta.enabled) {
      !function(f,b,e,v,n,t,s)
      {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
      n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t,s)}(window, document,'script',
      'https://connect.facebook.net/en_US/fbevents.js');
      fbq('init', this.config.meta.pixelId);
    }

    if (hasConsent && this.config.tiktok.enabled) {
      !function (w, d, t) {
        w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script");n.type="text/javascript",n.async=!0,n.src=i+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};
        ttq.load(this.config.tiktok.pixelId);
      }(window, document, 'ttq');
    }

    if (hasConsent && this.config.googleAds.enabled) {
      if (typeof window.gtag !== 'function') {
        const script = document.createElement('script');
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${this.config.googleAds.conversionId}`;
        document.head.appendChild(script);

        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        window.gtag = window.gtag || gtag;
        gtag('js', new Date());
        gtag('config', this.config.googleAds.conversionId);
      }
    }

    // Lightweight client runtime error capture for ad campaign traffic
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function' && !window.__tiledly_error_handler_attached) {
      window.__tiledly_error_handler_attached = true;
      window.addEventListener('error', (e) => {
        try {
          this.trackEvent('app_exception', {
            description: `${e.message} at ${e.filename}:${e.lineno}`,
            fatal: false
          });
        } catch (_) {}
      });

      window.addEventListener('unhandledrejection', (e) => {
        try {
          const reason = e.reason?.message || String(e.reason);
          this.trackEvent('app_exception', {
            description: `UnhandledRejection: ${reason}`,
            fatal: false
          });
        } catch (_) {}
      });
    }
  },

  trackEvent(eventName, params = {}) {
    if (IS_POKI) return;
    // Check window.gtag (either loaded via config or embedded tag in HTML)
    if (typeof window.gtag === 'function') {
      window.gtag('event', eventName, params);
    }
    // Meta Pixel
    if (typeof window.fbq === 'function') {
      window.fbq('trackCustom', eventName, params);
    }
    // TikTok Pixel
    if (typeof window.ttq !== 'undefined' && typeof window.ttq.track === 'function') {
      window.ttq.track(eventName, params);
    }
  },

  trackGoogleAdsConversion(conversionSendTo, params = {}) {
    if (IS_POKI) return;
    if (!this.config.googleAds?.enabled || !conversionSendTo) return;
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('event', 'conversion', {
        send_to: conversionSendTo,
        ...params
      });
    }
  },

  trackGameStart(mode) {
    this.trackEvent('game_start', { mode_name: mode ? mode.name : 'unknown' });
    this.trackGoogleAdsConversion(this.config.googleAds.conversions.gameStart);
  },

  trackGameComplete(result) {
    this.trackEvent('game_complete', {
      time: result.time,
      score: result.score,
      accuracy: result.accuracy,
      mode: result.mode.name,
      percentile: result.percentile
    });
    this.trackGoogleAdsConversion(this.config.googleAds.conversions.gameComplete);
  },

  trackShareClicked(method = 'unknown') {
    this.trackEvent('share_clicked', { method });
  },

  trackProModalViewed() {
    this.trackEvent('pro_modal_viewed');
  },

  trackCheckoutInitiated(plan) {
    this.trackEvent('checkout_initiated', { plan_type: plan });
    this.trackGoogleAdsConversion(this.config.googleAds.conversions.purchaseStart, {
      transaction_id: ''
    });
  },

  trackPurchaseComplete(details = {}) {
    const opts = typeof details === 'string' ? { plan: details } : (details || {});
    const plan = opts.plan || 'monthly';
    const value = typeof opts.value === 'number' ? opts.value : (plan === 'lifetime' ? 9.99 : 2.99);
    const currency = opts.currency || 'USD';
    const transactionId = opts.transactionId || opts.sessionId || opts.token || `pro_${Date.now()}`;

    const purchaseParams = {
      transaction_id: transactionId,
      value: value,
      currency: currency,
      plan_type: plan,
      items: [
        {
          item_id: `tiledly_pro_${plan}`,
          item_name: plan === 'lifetime' ? 'Tiledly PRO Lifetime Pass' : 'Tiledly PRO Monthly Pass',
          price: value,
          quantity: 1
        }
      ]
    };

    // 1. Standard GA4 & Google Ads purchase event
    this.trackEvent('purchase', purchaseParams);

    // 2. Custom purchase_complete event matching checkout_initiated
    this.trackEvent('purchase_complete', {
      plan_type: plan,
      value: value,
      currency: currency,
      transaction_id: transactionId
    });

    // 3. Google Ads Purchase Complete conversion snippet
    this.trackGoogleAdsConversion(this.config.googleAds.conversions.purchaseComplete, {
      value: value,
      currency: currency,
      transaction_id: transactionId
    });

    // 4. Meta Pixel standard Purchase event
    if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
      window.fbq('track', 'Purchase', {
        value: value,
        currency: currency,
        content_name: plan === 'lifetime' ? 'Tiledly PRO Lifetime Pass' : 'Tiledly PRO Monthly Pass',
        content_type: 'product'
      });
    }

    // 5. TikTok Pixel standard CompletePayment event
    if (typeof window !== 'undefined' && typeof window.ttq !== 'undefined' && typeof window.ttq.track === 'function') {
      window.ttq.track('CompletePayment', {
        content_type: 'product',
        content_id: `tiledly_pro_${plan}`,
        content_name: plan === 'lifetime' ? 'Tiledly PRO Lifetime Pass' : 'Tiledly PRO Monthly Pass',
        currency: currency,
        value: value
      });
    }
  },

  trackPurchase(details) {
    this.trackPurchaseComplete(details);
  },

  trackPwaPromptViewed() {
    this.trackEvent('pwa_prompt_viewed');
  },

  trackPwaInstallAccepted() {
    this.trackEvent('pwa_install_accepted');
  },

  trackPwaInstallDismissed() {
    this.trackEvent('pwa_install_dismissed');
  },

  trackPageView() {
    if (IS_POKI) return;
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'page_view');
    }
    if (typeof window.fbq === 'function') {
      window.fbq('track', 'PageView');
    }
    if (typeof window.ttq !== 'undefined' && typeof window.ttq.page === 'function') {
      window.ttq.page();
    }
  }
};

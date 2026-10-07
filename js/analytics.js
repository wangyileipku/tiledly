export const Analytics = {
  config: {
    ga4: {
      enabled: true,
      measurementId: 'G-3MZ9FZXH63'
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
      enabled: false,
      conversionId: 'AW-XXXXXXXXXX'
    }
  },

  init() {
    if (this.config.ga4.enabled) {
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

    if (this.config.meta.enabled) {
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

    if (this.config.tiktok.enabled) {
      !function (w, d, t) {
        w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script");n.type="text/javascript",n.async=!0,n.src=i+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};
        ttq.load(this.config.tiktok.pixelId);
      }(window, document, 'ttq');
    }

    if (this.config.googleAds.enabled) {
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
  },

  trackEvent(eventName, params = {}) {
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

  trackGameStart(mode) {
    this.trackEvent('game_start', { mode_name: mode ? mode.name : 'unknown' });
  },

  trackGameComplete(result) {
    this.trackEvent('game_complete', {
      time: result.time,
      score: result.score,
      accuracy: result.accuracy,
      mode: result.mode.name,
      percentile: result.percentile
    });
  },

  trackShareClicked(method = 'unknown') {
    this.trackEvent('share_clicked', { method });
  },

  trackProModalViewed() {
    this.trackEvent('pro_modal_viewed');
  },

  trackCheckoutInitiated(plan) {
    this.trackEvent('checkout_initiated', { plan_type: plan });
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

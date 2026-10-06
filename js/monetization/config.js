/**
 * Tiledly Monetization Configuration
 * 
 * Edit this configuration file to connect your real Stripe Payment Link
 * and Google AdSense Publisher ID.
 */
export const MonetizationConfig = {
  // Master switch for all monetization features
  enabled: true,

  // Advertising Configuration
  ads: {
    enabled: true,
    // 'mock' (shows native Tiledly PRO promo card / partner banner)
    // 'adsense' (loads Google AdSense auto/responsive units)
    provider: 'mock',
    
    // Your Google AdSense Publisher ID (e.g. 'ca-pub-1234567890123456')
    adsenseClientId: 'ca-pub-5198922883444706',
    
    // Ad unit slot IDs from your AdSense console (optional)
    resultSlotId: '',
    footerSlotId: ''
  },

  // Premium / Tiledly PRO Configuration
  premium: {
    enabled: true,
    // Payment processor: 'stripe' | 'lemonsqueezy' | 'custom'
    provider: 'stripe',
    
    // Paste your Stripe Payment Link URL here (e.g. 'https://buy.stripe.com/...')
    // Leave empty to enable instant Sandbox / Test Mode for review
    checkoutUrl: '',
    
    // Display pricing
    priceDisplay: '$2.99 / mo',
    oneTimePriceDisplay: '$9.99 lifetime pass',
    
    // Feature perks shown on the upgrade modal
    perks: [
      { icon: '🚫', title: '100% Ad-Free', desc: 'No banner ads or interruptions ever.' },
      { icon: '👑', title: 'VIP Gold Crown', desc: 'Distinguished golden badge on leaderboards & Battle Replay racer.' },
      { icon: '🛡️', title: 'Daily Streak Shield', desc: 'Missed a day? Your streak is automatically protected.' },
      { icon: '📅', title: 'Full Daily Archive', desc: 'Unlimited access to replay every past challenge since launch.' },
      { icon: '⚡', title: 'Support Indie Dev', desc: 'Keeps Tiledly fast, free, and evolving with new weekly modes.' }
    ]
  }
};

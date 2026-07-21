// ============================================================
// PLEXI DIGITAL MALL — Configuration
// ============================================================

const CONFIG = {
  API_URL: 'https://plexi-digital-mall-backend.vercel.app/api',
  APP_NAME: 'Plexi Digital Mall',
  TOKEN_KEY: 'authToken',
  USER_KEY: 'plexiUser',
  TIMEOUT: 15000,
  REPO_NAME: 'Plexi-Web',

  PLANS: {
    free:       { label: 'Free',       storeLimit: 1,   price: 0 },
    business:   { label: 'Business',   storeLimit: 5,   price: 29 },
    enterprise: { label: 'Enterprise', storeLimit: 20,  price: 99 },
    custom:     { label: 'Custom',     storeLimit: 999, price: null }
  },

  ORDER_STATUSES: {
    pending:    { label: 'Pending',    color: 'warning' },
    processing: { label: 'Processing', color: 'info' },
    shipped:    { label: 'Shipped',    color: 'info' },
    delivered:  { label: 'Delivered',  color: 'success' },
    cancelled:  { label: 'Cancelled',  color: 'error' }
  },

  STORE_STATUSES: {
    draft:     { label: 'Draft',     color: 'gray' },
    published: { label: 'Published', color: 'success' },
    suspended: { label: 'Suspended', color: 'error' },
    rejected:  { label: 'Rejected',  color: 'error' }
  },

  TICKET_PRIORITIES: {
    low:    { label: 'Low',    color: 'info' },
    medium: { label: 'Medium', color: 'warning' },
    high:   { label: 'High',   color: 'error' },
    urgent: { label: 'Urgent', color: 'error' }
  },

  TICKET_STATUSES: {
    open:        { label: 'Open',        color: 'warning' },
    in_progress: { label: 'In Progress', color: 'info' },
    resolved:    { label: 'Resolved',    color: 'success' },
    closed:      { label: 'Closed',      color: 'gray' }
  },

  ROLE_DASHBOARDS: {
    admin:   'dashboard/admin.html',
    seller:  'dashboard/seller.html',
    shopper: 'dashboard/shopper.html'
  },

  ROUTES: {
    login:    'login.html',
    signup:   'signup.html',
    home:     'index.html',
    admin:    'dashboard/admin.html',
    seller:   'dashboard/seller.html',
    shopper:  'dashboard/shopper.html',
    store:    'store/store.html',
    product:  'store/product.html'
  },

  TRADING_DAYS: ['mon','tue','wed','thu','fri','sat','sun'],
  TRADING_DAY_LABELS: { mon:'Monday', tue:'Tuesday', wed:'Wednesday', thu:'Thursday', fri:'Friday', sat:'Saturday', sun:'Sunday' },

  CATEGORIES: ['Fashion','Electronics','Food','Beauty','Sports','Home','Books','Toys','Others'],

  SOUNDS: {
    enabled: true,
    freesoundApiKey: '',
    cacheKey: 'plexi_sounds_cache',
    queries: {
      notification: 'notification ping short',
      success:      'success chime short',
      error:        'error buzz short',
      warning:      'alert beep short',
      click:        'click pop short',
      message:      'message receive short',
      follow:       'follow whoosh short',
      order:        'cash register cha-ching'
    },
    fallbackTones: {
      notification: [880, 0.08],
      success:      [523, 0.1, 659, 0.1, 784, 0.15],
      error:        [200, 0.15, 150, 0.2],
      warning:      [660, 0.08, 660, 0.08, 660, 0.12],
      click:        [1200, 0.03],
      message:      [660, 0.06, 880, 0.1],
      follow:       [440, 0.06, 550, 0.06, 660, 0.1],
      order:        [880, 0.08, 1100, 0.08, 1320, 0.12]
    },
    volume: 0.5
  },

  // VAPID public key for push notifications
  // Generate keys: cd plexi-digital-mall-backend && node scripts/generate-vapid.js
  // Then paste the VAPID_PUBLIC_KEY here
  VAPID_PUBLIC_KEY: 'BNT9PagTLb1F2GoxlX54q6gPfYgmvEpsr2nw6CWq4QLamMenf8AABkZM6EC8Rj9ps38q8fH6AEjT7RPuc4GK3L8',

  isOpen(tradingHours) {
    if (!tradingHours || typeof tradingHours !== 'object') return null;
    const now = new Date();
    const dayMap = ['sun','mon','tue','wed','thu','fri','sat'];
    const today = dayMap[now.getDay()];
    const day = tradingHours[today];
    if (!day || !day.enabled || !day.open || !day.close) return false;
    const [oh, om] = day.open.split(':').map(Number);
    const [ch, cm] = day.close.split(':').map(Number);
    const mins = now.getHours() * 60 + now.getMinutes();
    return mins >= oh * 60 + om && mins < ch * 60 + cm;
  }
};

// Make globally accessible
window.CONFIG = CONFIG;

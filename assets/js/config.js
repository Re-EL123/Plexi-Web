// ============================================================
// PLEXI DIGITAL MALL — Configuration
// ============================================================

const CONFIG = {
  API_URL: 'https://plexi-digital-mall-backend.vercel.app/api',
  APP_NAME: 'Plexi Digital Mall',
  TOKEN_KEY: 'authToken',
  USER_KEY: 'plexiUser',
  TIMEOUT: 15000,

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
    admin:   '../dashboard/admin.html',
    seller:  '../dashboard/seller.html',
    shopper: '../dashboard/shopper.html'
  },

  ROUTES: {
    login:    '../login.html',
    signup:   '../signup.html',
    home:     '../index.html',
    admin:    '../dashboard/admin.html',
    seller:   '../dashboard/seller.html',
    shopper:  '../dashboard/shopper.html',
    store:    '../store/store.html',
    product:  '../store/product.html'
  }
};

// Make globally accessible
window.CONFIG = CONFIG;
// ============================================================
// PLEXI DIGITAL MALL — API Client
// ============================================================

const api = (() => {
  const BASE = CONFIG.API_URL;

  function getToken() {
    return localStorage.getItem(CONFIG.TOKEN_KEY);
  }

  function buildHeaders(extra = {}) {
    const h = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...extra
    };
    const token = getToken();
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
  }

  function parseBody(data) {
    if (data && data.body) {
      try {
        return typeof data.body === 'string' ? JSON.parse(data.body) : data.body;
      } catch (_) {}
    }
    return data;
  }

  async function request(method, path, body = null, opts = {}) {
    const url = `${BASE}${path}`;
    const options = {
      method,
      headers: buildHeaders(opts.headers || {}),
      signal: AbortSignal.timeout(CONFIG.TIMEOUT)
    };
    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    try {
      const res = await fetch(url, options);

      // Handle 401 - session expired
      if (res.status === 401) {
        localStorage.removeItem(CONFIG.TOKEN_KEY);
        localStorage.removeItem(CONFIG.USER_KEY);
        UI.toast('Session expired. Please login again.', 'warning');
        setTimeout(() => { window.location.href = '../login.html'; }, 1200);
        throw new Error('Unauthorized');
      }

      let data;
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        data = await res.json();
      } else {
        data = await res.text();
      }

      data = parseBody(data);

      if (!res.ok) {
        const msg = data?.error || data?.message || `Request failed (${res.status})`;
        throw Object.assign(new Error(msg), { status: res.status, data });
      }

      return data;
    } catch (err) {
      if (err.name === 'TimeoutError') {
        throw new Error('Request timed out. Please try again.');
      }
      throw err;
    }
  }

  // ---- HTTP Methods ---- //
  const get    = (path, opts)       => request('GET',    path, null, opts);
  const post   = (path, body, opts) => request('POST',   path, body, opts);
  const put    = (path, body, opts) => request('PUT',    path, body, opts);
  const patch  = (path, body, opts) => request('PATCH',  path, body, opts);
  const del    = (path, opts)       => request('DELETE', path, null, opts);

  // ======== AUTH ======== //
  const auth = {
  login:  (email, password)        => post('/auth?action=login', { email, password }),
  signup: (email, password, role)  => post('/auth?action=signup', { email, password, role }),
  logout: ()                       => post('/auth?action=logout'),
  me:     ()                       => get('/auth?action=me'), // Changed from /users/me to match your handler
};

  // ======== USERS ======== //
  const users = {
    list:   (params = {})   => get(`/users?${new URLSearchParams(params)}`),
    get:    (id)            => get(`/users/${id}`),
    update: (id, data)      => put(`/users/${id}`, data),
    delete: (id)            => del(`/users/${id}`),
    ban:    (id, reason)    => post(`/users/${id}/ban`, { reason }),
    unban:  (id)            => post(`/users/${id}/unban`),
  };

  // ======== STORES ======== //
  const stores = {
    list:    (params = {})  => get(`/stores?${new URLSearchParams(params)}`),
    get:     (id)           => get(`/stores/${id}`),
    create:  (data)         => post('/stores', data),
    update:  (id, data)     => put(`/stores/${id}`, data),
    delete:  (id)           => del(`/stores/${id}`),
    approve: (id)           => post(`/stores/${id}/approve`),
    suspend: (id, reason)   => post(`/stores/${id}/suspend`, { reason }),
    myStores:()             => get('/stores/mine'),
    members: (storeId)      => get(`/stores/${storeId}/members`),
    addMember:(storeId, d)  => post(`/stores/${storeId}/members`, d),
  };

  // ======== PRODUCTS ======== //
  const products = {
    list:   (storeId, p={})  => get(`/products?store_id=${storeId}&${new URLSearchParams(p)}`),
    all:    (params = {})    => get(`/products?${new URLSearchParams(params)}`),
    get:    (id)             => get(`/products/${id}`),
    create: (data)           => post('/products', data),
    update: (id, data)       => put(`/products/${id}`, data),
    delete: (id)             => del(`/products/${id}`),
  };

  // ======== ORDERS ======== //
  const orders = {
    list:   (params = {})  => get(`/orders?${new URLSearchParams(params)}`),
    get:    (id)           => get(`/orders/${id}`),
    create: (data)         => post('/orders', data),
    update: (id, data)     => patch(`/orders/${id}`, data),
    cancel: (id)           => post(`/orders/${id}/cancel`),
  };

  // ======== CART ======== //
  const cart = {
    get:    ()           => get('/cart'),
    add:    (data)       => post('/cart', data),
    update: (id, qty)    => put(`/cart/${id}`, { quantity: qty }),
    remove: (id)         => del(`/cart/${id}`),
    clear:  ()           => del('/cart'),
  };

  // ======== REVIEWS ======== //
  const reviews = {
    list:   (params={})  => get(`/reviews?${new URLSearchParams(params)}`),
    create: (data)       => post('/reviews', data),
    delete: (id)         => del(`/reviews/${id}`),
    like:   (id)         => post(`/reviews/${id}/like`),
  };

  // ======== NOTIFICATIONS ======== //
  const notifications = {
    list:    ()   => get('/notifications'),
    markRead:(id) => patch(`/notifications/${id}`, { read: true }),
    markAll: ()   => post('/notifications/mark-all-read'),
  };

  // ======== SUPPORT ======== //
  const support = {
    list:     ()             => get('/support'),
    get:      (id)           => get(`/support/${id}`),
    create:   (data)         => post('/support', data),
    update:   (id, data)     => patch(`/support/${id}`, data),
    message:  (id, message)  => post(`/support/${id}/messages`, { message }),
    messages: (id)           => get(`/support/${id}/messages`),
  };

  // ======== SUBSCRIPTIONS ======== //
  const subscriptions = {
    get:    ()     => get('/subscriptions/me'),
    plans:  ()     => get('/subscriptions/plans'),
    upgrade:(plan) => post('/subscriptions/upgrade', { plan }),
  };

  // ======== ADMIN ======== //
  const admin = {
    stats:         ()         => get('/admin/stats'),
    users:         (params={})=> get(`/admin/users?${new URLSearchParams(params)}`),
    stores:        (params={})=> get(`/admin/stores?${new URLSearchParams(params)}`),
    banUser:       (id, r)    => post(`/admin/users/${id}/ban`, { reason: r }),
    unbanUser:     (id)       => post(`/admin/users/${id}/unban`),
    approveStore:  (id)       => post(`/admin/stores/${id}/approve`),
    suspendStore:  (id, r)    => post(`/admin/stores/${id}/suspend`, { reason: r }),
    rejectStore:   (id, r)    => post(`/admin/stores/${id}/reject`, { reason: r }),
    featureStore:  (id)       => post(`/admin/stores/${id}/feature`),
    tickets:       (params={})=> get(`/support?${new URLSearchParams(params)}`),
  };

  // ======== MAP ======== //
  const map = {
    stores:  ()                       => get('/map'),
    update:  (storeId, coords)        => put(`/map/${storeId}`, { coordinates: coords }),
  };

  // ======== WISHLIST ======== //
  const wishlist = {
    list:   ()    => get('/wishlist'),
    add:    (pid) => post('/wishlist', { product_id: pid }),
    remove: (pid) => del(`/wishlist/${pid}`),
  };

  return { auth, users, stores, products, orders, cart, reviews,
           notifications, support, subscriptions, admin, map, wishlist };
})();

window.api = api;
// ============================================================
// PLEXI DIGITAL MALL — API Client
// Backend uses: ?id= for resource targeting, ?action= for action routing,
// PUT for updates, DELETE with query params.
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

  const get    = (path, opts)       => request('GET',    path, null, opts);
  const post   = (path, body, opts) => request('POST',   path, body, opts);
  const put    = (path, body, opts) => request('PUT',    path, body, opts);
  const del    = (path, opts)       => request('DELETE', path, null, opts);

  // ======== AUTH ======== //
  const auth = {
    login:  (email, password)        => post('/auth?action=login', { email, password }),
    signup: (email, password, role)  => post('/auth?action=signup', { email, password, role }),
    logout: ()                       => post('/auth?action=logout'),
    me:     ()                       => get('/auth?action=me'),
  };

  // ======== USERS ======== //
  const users = {
    list:   (params = {})   => get(`/users?${new URLSearchParams(params)}`),
    get:    (id)            => get(`/users?id=${id}`),
    update: (id, data)      => put(`/users?id=${id}`, data),
    delete: (id)            => del(`/users?id=${id}`),
  };

  // ======== STORES ======== //
  const stores = {
    list:    (params = {})           => get(`/stores?${new URLSearchParams(params)}`),
    get:     (id)                    => get(`/stores?id=${id}`),
    create:  (data)                  => post('/stores', data),
    update:  (id, data)              => put(`/stores?id=${id}`, data),
    delete:  (id)                    => del(`/stores?id=${id}`),
    myStores:(ownerId)               => get(`/stores?owner_id=${ownerId}`),
    approve: (id)                    => post(`/admin?action=approve-store`, { store_id: id, approved: true }),
    members: (storeId)               => get(`/stores?id=${storeId}&action=members`),
    addMember:(storeId, d)           => post(`/stores?id=${storeId}&action=members`, d),
    follow:   (storeId)              => post(`/stores?action=follow&id=${storeId}`),
    unfollow: (storeId)              => del(`/stores?action=unfollow&id=${storeId}`),
    followersCount: (storeId)        => get(`/stores?action=followers-count&id=${storeId}`),
    isFollowing: (storeId)           => get(`/stores?action=is-following&id=${storeId}`),
  };

  // ======== PRODUCTS ======== //
  const products = {
    list:   (storeId, p={})  => get(`/products?store_id=${storeId}&${new URLSearchParams(p)}`),
    all:    (params = {})    => get(`/products?${new URLSearchParams(params)}`),
    get:    (id)             => get(`/products?id=${id}`),
    create: (data)           => post('/products', data),
    update: (id, data)       => put(`/products?id=${id}`, data),
    delete: (id)             => del(`/products?id=${id}`),
  };

  // ======== ORDERS ======== //
  const orders = {
    list:   (params = {})  => get(`/orders?${new URLSearchParams(params)}`),
    get:    (id)           => get(`/orders?id=${id}`),
    create: (data)         => post('/orders', data),
    update: (id, data)     => put(`/orders?id=${id}`, data),
    cancel: (id)           => put(`/orders?id=${id}`, { status: 'cancelled' }),
  };

  // ======== CART ======== //
  const cart = {
    get:    ()           => get('/cart'),
    add:    (data)       => post('/cart', data),
    update: (id, qty)    => put('/cart', { id, quantity: qty }),
    remove: (id)         => del(`/cart?id=${id}`),
    clear:  ()           => del('/cart'),
  };

  // ======== REVIEWS ======== //
  const reviews = {
    list:   (params={})  => get(`/reviews?${new URLSearchParams(params)}`),
    create: (data)       => post('/reviews', data),
    delete: (id)         => del(`/reviews?id=${id}`),
    like:   (id)         => post(`/reviews?id=${id}&action=like`),
  };

  // ======== NOTIFICATIONS ======== //
  const notifications = {
    list:    (params = {})  => get(`/notifications?action=list&${new URLSearchParams(params)}`),
    markRead:(id)           => post(`/notifications?action=read&id=${id}`),
    markAll: ()             => post('/notifications?action=read-all'),
  };

  // ======== SUPPORT ======== //
  const support = {
    list:     (params = {})  => get(`/support?${new URLSearchParams(params)}`),
    get:      (id)           => get(`/support?id=${id}`),
    create:   (data)         => post('/support', data),
    update:   (id, data)     => put(`/support?id=${id}`, data),
    message:  (id, message)  => post(`/support?id=${id}&action=messages`, { message }),
    messages: (id)           => get(`/support?id=${id}&action=messages`),
  };

  // ======== SUBSCRIPTIONS ======== //
  const subscriptions = {
    get:    ()     => get('/subscriptions?action=current'),
    plans:  ()     => get('/subscriptions?action=plans'),
    upgrade:(plan) => post('/subscriptions?action=upgrade', { plan }),
  };

  // ======== ADMIN ======== //
  const admin = {
    stats:         ()         => get('/admin?action=stats'),
    users:         (params={})=> get(`/admin?action=users&${new URLSearchParams(params)}`),
    stores:        (params={})=> get(`/stores?${new URLSearchParams(params)}`),
    banUser:       (id, r)    => post('/admin?action=ban-user', { user_id: id, banned: true, reason: r }),
    unbanUser:     (id)       => post('/admin?action=ban-user', { user_id: id, banned: false }),
    approveStore:  (id)       => post('/admin?action=approve-store', { store_id: id, approved: true }),
    suspendStore:  (id, reason, duration) => post('/admin?action=suspend-store', { store_id: id, reason, duration_days: duration }),
    unsuspendStore:(id)       => post('/admin?action=unsuspend-store', { store_id: id }),
    rejectStore:   (id, r)    => post('/admin?action=approve-store', { store_id: id, approved: false, reason: r }),
    featureStore:  (id)       => post(`/admin?action=feature-store`, { store_id: id }),
    broadcast:     (title, message, role, userId) => post('/admin?action=broadcast', { title, message, user_role: role, user_id: userId }),
    getSubscriptions: (params = {}) => get(`/admin?action=manage-subscriptions&${new URLSearchParams(params)}`),
    updateSubscription: (userId, plan) => put('/admin?action=manage-subscriptions', { user_id: userId, plan }),
    tickets:       (params={})=> get(`/support?${new URLSearchParams(params)}`),
    getStoreLocations: ()    => get('/admin?action=store-locations'),
  };

  // ======== MAP ======== //
  const map = {
    stores:  (params = {})  => get(`/map?action=stores&${new URLSearchParams(params)}`),
    update:  (storeId, coords) => put(`/map?action=update&store_id=${storeId}`, { coordinates: coords }),
    heartbeat: (storeId)    => post('/map?action=heartbeat', { store_id: storeId }),
    onlineStatus: (ids)     => get(`/map?action=online-status&store_ids=${ids.join(',')}`),
    storeLocations: ()      => get('/map?action=store-locations'),
  };

  // ======== GEOCODE ======== //
  const geocode = {
    address: (address) => get(`/stores?action=geocode&address=${encodeURIComponent(address)}`),

    // Photon (Komoot) — free, OSM-based, no API key
    photon: async (query, limit = 6) => {
      const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=${limit}&lang=en`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error('Photon geocoding failed');
      const data = await res.json();
      return (data.features || []).map(f => ({
        label: f.properties.label || f.properties.name || '',
        name: f.properties.name || '',
        city: f.properties.city || '',
        state: f.properties.state || '',
        country: f.properties.country || '',
        postcode: f.properties.postcode || '',
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
        source: 'photon'
      }));
    },

    // Nominatim — free, OSM-based, 1 req/s rate limit
    nominatim: async (query, limit = 6) => {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=${limit}&addressdetails=1`;
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(8000)
      });
      if (!res.ok) throw new Error('Nominatim geocoding failed');
      const data = await res.json();
      return data.map(r => ({
        label: r.display_name || '',
        name: r.name || '',
        city: r.address?.city || r.address?.town || r.address?.village || '',
        state: r.address?.state || '',
        country: r.address?.country || '',
        postcode: r.address?.postcode || '',
        lat: parseFloat(r.lat),
        lng: parseFloat(r.lon),
        source: 'nominatim'
      }));
    },

    // Combined search: try Photon first, fall back to Nominatim
    search: async (query, limit = 6) => {
      try {
        const results = await geocode.photon(query, limit);
        if (results.length) return results;
      } catch (_) {}
      return geocode.nominatim(query, limit);
    },
  };

  // ======== DELIVERY ======== //
  const delivery = {
    preview: (lat, lng) => get(`/orders?action=delivery-preview&shipping_lat=${lat}&shipping_lng=${lng}`),
  };

  // ======== WISHLIST ======== //
  const wishlist = {
    list:   ()    => get('/products?action=wishlist'),
    add:    (pid) => post('/products?action=wishlist', { product_id: pid }),
    remove: (pid) => del(`/products?action=wishlist&id=${pid}`),
  };

  // ======== UPLOAD ======== //
  const upload = {
    file: async (file, folder = 'general') => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const base64 = reader.result.split(',')[1];
            const result = await post('/products?action=upload', {
              file: base64,
              filename: file.name,
              contentType: file.type,
              folder
            });
            resolve(result);
          } catch (err) { reject(err); }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });
    }
  };

  return { auth, users, stores, products, orders, cart, reviews,
           notifications, support, subscriptions, admin, map, geocode, delivery, wishlist, upload };
})();

window.api = api;

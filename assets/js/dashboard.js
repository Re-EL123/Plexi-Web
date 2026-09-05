// ============================================================
// PLEXI DIGITAL MALL — Dashboard Logic
// ============================================================

const Dashboard = (() => {

  // ======== NOTIFICATIONS BELL ======== //
  let prevUnreadCount = 0;

  async function loadNotifications() {
    try {
      const data = await api.notifications.list();
      const notifs = Array.isArray(data) ? data : (data.notifications || []);
      const unread = notifs.filter(n => !n.read).length;

      if (unread > prevUnreadCount && prevUnreadCount > 0) {
        if (window.SoundManager) SoundManager.play('notification');
      }
      prevUnreadCount = unread;

      const badge = document.getElementById('notif-badge');
      if (badge) {
        badge.textContent = unread;
        badge.style.display = unread > 0 ? 'flex' : 'none';
      }

      const panel = document.getElementById('notif-panel');
      if (panel) renderNotifPanel(panel, notifs);
      const full = document.getElementById('notif-full-panel');
      if (full) renderNotifFullPanel(full, notifs);
      State.set('notifications', notifs);
    } catch (_) {}
  }

  function neededKeyFromType(type) {
    const map = {
      needed_payment: 'payment',
      needed_banking: 'banking',
      needed_store: 'store',
      needed_kyc: 'verification',
      needed_admin_store: 'admin-review',
      needed_admin_kyc: 'admin-review',
      needed_admin_driver: 'admin-review',
      needed_admin_banking: 'admin-review',
      needed_catalog: 'catalog',
      needed_store_look: 'store-look',
      needed_map_pin: 'map-pin',
      needed_deal: 'deal'
    };
    return map[type] || null;
  }

  function renderNotifPanel(panel, notifs) {
    if (notifs.length === 0) {
      panel.innerHTML = UI.empty('No Notifications', 'You\'re all caught up!');
      return;
    }
    panel.innerHTML = notifs.slice(0, 8).map(n => {
      const type = String(n.type || '').replace(/[^a-z0-9_-]/gi, '');
      return `
      <div class="notif-item ${n.read ? '' : 'unread'}" data-id="${n.id}" role="button" tabindex="0"
        onclick="Dashboard.markRead('${n.id}', '${type}')">
        ${UI.notifHeader(
          `<span style="width:8px;height:8px;border-radius:50%;background:${n.read ? 'var(--gray-300)' : 'var(--primary)'};"></span>`,
          n.title,
          UI.timeAgo(n.created_at)
        )}
        <div class="notif-msg">${n.message}</div>
      </div>`;
    }).join('');
  }

  function renderNotifFullPanel(panel, notifs) {
    if (!notifs.length) {
      panel.innerHTML = UI.empty('No Notifications', 'You\'re all caught up!');
      return;
    }
    panel.innerHTML = notifs.map(n => {
      const type = String(n.type || '').replace(/[^a-z0-9_-]/gi, '');
      return `
        <div class="notif-item ${n.read ? '' : 'unread'}" data-id="${n.id}" role="button" tabindex="0"
          onclick="Dashboard.markRead('${n.id}', '${type}')"
          style="display:flex;gap:var(--space-sm);padding:var(--space-md);border-bottom:1px solid var(--border-light);background:${n.read ? '' : 'var(--primary-alpha)'};cursor:pointer;">
          <div style="width:8px;height:8px;border-radius:50%;flex-shrink:0;margin-top:6px;background:${n.read ? 'var(--gray-300)' : 'var(--primary)'}"></div>
          <div>
            <div style="font-weight:600;font-size:14px;">${n.title}</div>
            <div style="font-size:13px;color:var(--text-secondary);">${n.message}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${UI.timeAgo(n.created_at)}</div>
          </div>
        </div>`;
    }).join('');
  }

  async function markRead(id, type) {
    try {
      await api.notifications.markRead(id);
      const el = document.querySelector(`.notif-item[data-id="${id}"]`);
      if (el) el.classList.remove('unread');
      await loadNotifications();
      const key = neededKeyFromType(type);
      if (key && neededActions) {
        neededActions.snooze(key, 0);
        neededActions.tick();
      }
      if (type === 'needed_wishlist' || type === 'needed_wishlist_sale' || type === 'needed_wishlist_stock') {
        activateSection('section-wishlist');
      }
    } catch (_) {}
  }

  async function syncNeededNotifications() {
    try {
      if (window.Auth && typeof Auth.isLoggedIn === 'function' && !Auth.isLoggedIn()) return;
      await api.notifications.syncNeeded();
      await loadNotifications();
    } catch (_) {}
  }

  async function markAllRead() {
    try {
      await api.notifications.markAll();
      await loadNotifications();
      UI.toast('All notifications marked as read', 'success');
    } catch (_) {}
  }

  // ======== CART COUNT ======== //
  function pingCartEcho() {
    try { localStorage.setItem('plexi_cart_echo', Date.now().toString()); } catch (_) {}
  }

  async function loadCartCount() {
    if (!(window.Auth && typeof Auth.isLoggedIn === 'function' && Auth.isLoggedIn())) {
      const badge = document.getElementById('cart-badge');
      if (badge) badge.style.display = 'none';
      return;
    }
    try {
      const data = await api.cart.get();
      const items = Array.isArray(data) ? data : (data.items || []);
      const count = items.reduce((s, i) => s + (i.quantity || 1), 0);
      const badge = document.getElementById('cart-badge');
      if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
      }
      State.set('cartCount', count);
    } catch (_) {}
  }

  // ======== PAGE SECTIONS ======== //
  let currentSectionId = null;
  const baseTitle = document.title;

  function sectionLabel(id) {
    const nav = document.querySelector(`[data-section="${id}"]`);
    if (nav) {
      // Clone and strip count badges (e.g. cart/notification counters)
      const clone = nav.cloneNode(true);
      clone.querySelectorAll('.nav-badge, .badge, span[id]').forEach(el => el.remove());
      return clone.textContent.trim().replace(/\s+/g, ' ');
    }
    return id.replace(/^s(ec|ection)-/, '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  function isSectionId(id) {
    return !!id && !!document.getElementById(id)?.classList.contains('dash-section');
  }

  function ensureBreadcrumb() {
    let bc = document.getElementById('dash-breadcrumb');
    if (bc) return bc;
    const content = document.querySelector('.page-content') || document.querySelector('main');
    if (!content) return null;
    content.insertAdjacentHTML('afterbegin', '<nav class="breadcrumb" id="dash-breadcrumb" aria-label="Breadcrumb"><ol></ol></nav>');
    return document.getElementById('dash-breadcrumb');
  }

  function renderBreadcrumb(id) {
    const host = ensureBreadcrumb();
    if (!host) return;
    const ol = host.querySelector('ol');
    const role = Auth.getRole();
    const rootLabel = role ? role.charAt(0).toUpperCase() + role.slice(1) + ' Dashboard' : 'Dashboard';
    if (isDefaultSection(id)) {
      // Overview: Home / <Role> Dashboard (current)
      ol.innerHTML = `
        <li><a href="../index.html">Home</a></li>
        <li aria-current="page">${rootLabel}</li>`;
    } else {
      ol.innerHTML = `
        <li><a href="../index.html">Home</a></li>
        <li><a href="${location.pathname}" data-breadcrumb-root>${rootLabel}</a></li>
        <li aria-current="page">${sectionLabel(id)}</li>`;
    }
  }

  let defaultSectionId = null;
  function getDefaultSectionId() {
    if (!defaultSectionId) {
      // Captured from the server-rendered markup before any navigation.
      defaultSectionId = document.querySelector('[data-section].active')?.dataset.section
        || document.querySelector('.dash-section')?.id;
    }
    return defaultSectionId;
  }

  function isDefaultSection(id) {
    return !!id && id === getDefaultSectionId();
  }

  function applySectionChrome(id) {
    currentSectionId = id;
    const label = sectionLabel(id);
    const tt = document.getElementById('topbar-title');
    if (tt && label) tt.textContent = label;
    document.title = `${label} · ${baseTitle.split('—').pop().trim()}`;
    try { history.replaceState(null, '', '#' + id); } catch (_) {}
    renderBreadcrumb(id);
  }

  function showSection(id) {
    closeDashboardSearch();
    document.querySelectorAll('.dash-section').forEach(el => {
      el.classList.remove('active');
      el.style.display = 'none';
    });
    const target = document.getElementById(id);
    if (target) {
      target.style.display = 'block';
      target.classList.add('active');
      target.classList.remove('animate-fadeIn');
      void target.offsetWidth; // force reflow
      target.classList.add('animate-fadeIn');
      target.focus({ preventScroll: true });
    }
    document.querySelectorAll('[data-section]').forEach(btn => {
      const isActive = btn.dataset.section === id;
      btn.classList.toggle('active', isActive);
      if (isActive) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
    });
    applySectionChrome(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function activateSection(id) {
    if (!isSectionId(id)) return false;
    const nav = document.querySelector(`[data-section="${id}"]`);
    if (nav && !isDefaultSection(id)) { nav.click(); return true; }
    if (nav) { showSection(id); return true; }   // overview: skip redundant loader click
    showSection(id);
    return true;
  }

  // ======== DATA TABLES ======== //
  function renderTable(tbodyEl, rows, emptyMsg = 'No data found') {
    if (!tbodyEl) return;
    if (!rows || rows.length === 0) {
      const cols = tbodyEl.closest('table')?.querySelectorAll('th').length || 1;
      tbodyEl.innerHTML = `
        <tr><td colspan="${cols}" style="text-align:center;padding:var(--space-xl);color:var(--text-muted);">
          ${emptyMsg}
        </td></tr>
      `;
      return;
    }
    tbodyEl.innerHTML = rows.join('');
  }

  // ======== PAGINATION ======== //
  function renderPagination(containerId, current, total, onPage) {
    const el = document.getElementById(containerId);
    if (!el || total <= 1) { if (el) el.innerHTML = ''; return; }
    let html = `<div class="pagination">`;
    html += `<button class="page-btn" ${current===1?'disabled':''} onclick="(${onPage})(${current-1})">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
    </button>`;
    for (let i = 1; i <= total; i++) {
      if (total > 7 && Math.abs(i - current) > 2 && i !== 1 && i !== total) {
        if (i === current - 3 || i === current + 3) html += `<span style="padding:0 4px;color:var(--text-muted)">…</span>`;
        continue;
      }
      html += `<button class="page-btn ${i===current?'active':''}" onclick="(${onPage})(${i})">${i}</button>`;
    }
    html += `<button class="page-btn" ${current===total?'disabled':''} onclick="(${onPage})(${current+1})">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
    </button>`;
    html += `</div>`;
    el.innerHTML = html;
  }

  // ======== SEARCH / FILTER ======== //
  function initSearch(inputId, handler, delay = 400) {
    const input = document.getElementById(inputId);
    if (!input) return;
    let timer;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => handler(input.value.trim()), delay);
    });
  }

  // ======== CART PANEL ======== //
  function mallRoot() {
    return /\/(store|dashboard)\//.test(location.pathname) ? '../' : '';
  }

  function shopperCartHref() {
    return mallRoot() + 'dashboard/shopper.html#section-cart';
  }

  function openCartPanel() {
    if (!Auth.isLoggedIn()) {
      UI.toast('Sign in to view your cart', 'info');
      setTimeout(() => { location.href = mallRoot() + 'login.html'; }, 800);
      return;
    }
    let panel = document.getElementById('cart-slide-panel');
    if (panel && !document.getElementById('cart-panel-coupon')) {
      panel.remove();
      panel = null;
    }
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'cart-slide-panel';
      panel.innerHTML = `
        <div id="cart-overlay" style="position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:9998;opacity:0;transition:opacity 0.3s;" onclick="Dashboard.closeCartPanel()"></div>
        <div id="cart-drawer" style="position:fixed;top:0;right:-420px;width:400px;max-width:90vw;height:100vh;background:var(--surface);z-index:9999;box-shadow:-4px 0 24px rgba(0,0,0,0.15);display:flex;flex-direction:column;transition:right 0.3s ease;">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:var(--space-md) var(--space-lg);border-bottom:1px solid var(--border-light);">
            <h3 style="margin:0;font-size:18px;">Your Cart</h3>
            <button onclick="Dashboard.closeCartPanel()" style="background:none;border:none;cursor:pointer;padding:4px;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </div>
          <div id="cart-panel-items" style="flex:1;overflow-y:auto;padding:var(--space-md) var(--space-lg);"></div>
          <div style="padding:var(--space-md) var(--space-lg);border-top:1px solid var(--border-light);">
            <div id="cart-panel-free" style="display:none;font-size:12px;font-weight:600;margin-bottom:var(--space-sm);padding:8px 10px;border-radius:var(--radius-md);background:var(--primary-alpha);color:var(--primary);"></div>
            <div style="display:flex;gap:var(--space-xs);margin-bottom:6px;">
              <input type="text" id="cart-panel-coupon" class="form-control" placeholder="Coupon code" style="font-size:13px;text-transform:uppercase;">
              <button type="button" class="btn btn-primary btn-sm" onclick="Dashboard.applyCartPanelCoupon()">Apply</button>
            </div>
            <div id="cart-panel-coupon-hint" style="font-size:11px;color:var(--text-muted);margin-bottom:var(--space-sm);"></div>
            <div class="flex-between" style="margin-bottom:var(--space-md);"><span style="color:var(--text-secondary);">Total</span><strong id="cart-panel-total" style="font-size:20px;color:var(--primary);">R0.00</strong></div>
            <button class="btn btn-primary btn-block" onclick="Dashboard.goToFullCart()">Checkout</button>
            <button class="btn btn-ghost btn-block" style="margin-top:6px;" onclick="Dashboard.goToFullCart()">View Full Cart</button>
          </div>
        </div>`;
      document.body.appendChild(panel);
    }
    const overlay = document.getElementById('cart-overlay');
    const drawer = document.getElementById('cart-drawer');
    overlay.style.display = 'block';
    drawer.style.right = '0';
    requestAnimationFrame(() => { overlay.style.opacity = '1'; });
    initCartPanelKeys();
    loadCartPanelItems();
  }

  function goToFullCart() {
    closeCartPanel();
    location.href = shopperCartHref();
  }

  function closeCartPanel() {
    const overlay = document.getElementById('cart-overlay');
    const drawer = document.getElementById('cart-drawer');
    if (overlay) overlay.style.opacity = '0';
    if (drawer) drawer.style.right = '-420px';
    setTimeout(() => { if (overlay) overlay.style.display = 'none'; }, 300);
  }

  function initCartPanelKeys() {
    if (initCartPanelKeys.done) return;
    initCartPanelKeys.done = true;
    document.addEventListener('keydown', e => {
      const drawer = document.getElementById('cart-drawer');
      if (e.key === 'Escape' && drawer && drawer.style.right === '0px') {
        closeCartPanel();
      }
    });
  }

  async function loadCartPanelItems() {
    const el = document.getElementById('cart-panel-items');
    const totalEl = document.getElementById('cart-panel-total');
    if (!el) return;
    el.innerHTML = UI.skeletonList(3);
    try {
      const data = await api.cart.get();
      const items = Array.isArray(data) ? data : (data.items || []);
      const total = data.total || items.reduce((s, i) => s + (i.product?.price || 0) * (i.quantity || 1), 0);
      if (!items.length) {
        el.innerHTML = '<div style="text-align:center;padding:var(--space-2xl);color:var(--text-muted);"><div style="font-size:48px;margin-bottom:var(--space-md);">🛒</div><p>Your cart is empty</p></div>';
        if (totalEl) totalEl.textContent = UI.formatCurrency(0);
        const freeEl = document.getElementById('cart-panel-free');
        if (freeEl) freeEl.style.display = 'none';
        const hintEl = document.getElementById('cart-panel-coupon-hint');
        if (hintEl) hintEl.textContent = '';
        return;
      }
      el.innerHTML = items.map(item => {
        const p = item.product || {};
        const optLine = item.options && Object.keys(item.options).length
          ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px;word-break:break-word;">${formatCartOptions(item.options)}</div>` : '';
        return `
          <div style="display:flex;gap:var(--space-md);padding:var(--space-md) 0;border-bottom:1px solid var(--border-light);">
            <div style="width:60px;height:60px;border-radius:var(--radius-md);background:var(--bg);overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;">
              ${p.images?.[0] ? `<img src="${p.images[0]}" style="width:100%;height:100%;object-fit:cover;">` : '<span style="font-size:24px;">📦</span>'}
            </div>
            <div style="flex:1;min-width:0;">
              <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.name || 'Product'}</div>
              ${item.variant ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${item.variant}</div>` : ''}
              ${optLine}
              <div style="font-size:13px;color:var(--primary);font-weight:700;margin-top:2px;">${UI.formatCurrency(p.price || 0)}</div>
              <div style="display:flex;align-items:center;gap:var(--space-sm);margin-top:6px;">
                <button onclick="Dashboard.updateCartQty('${item.id}',${item.quantity - 1})" style="width:24px;height:24px;border-radius:var(--radius-sm);border:1px solid var(--border);background:var(--bg);cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;">−</button>
                <span style="font-size:13px;font-weight:600;min-width:20px;text-align:center;">${item.quantity}</span>
                <button onclick="Dashboard.updateCartQty('${item.id}',${item.quantity + 1})" style="width:24px;height:24px;border-radius:var(--radius-sm);border:1px solid var(--border);background:var(--bg);cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;">+</button>
                <button onclick="Dashboard.removeCartItem('${item.id}')" style="background:none;border:none;cursor:pointer;color:var(--error);margin-left:auto;padding:2px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
              </div>
            </div>
          </div>`;
      }).join('');
      if (totalEl) totalEl.textContent = UI.formatCurrency(total);
      const savedCode = sessionStorage.getItem('plexi_coupon_code') || '';
      const couponInput = document.getElementById('cart-panel-coupon');
      if (couponInput && !couponInput.value && savedCode) couponInput.value = savedCode;
      refreshCartPanelConversion(total);
    } catch (err) {
      el.innerHTML = `<div style="text-align:center;padding:var(--space-xl);color:var(--error);">${err.message || 'Could not load cart'}</div>`;
    }
  }

  async function refreshCartPanelConversion(subtotal) {
    const freeEl = document.getElementById('cart-panel-free');
    const hintEl = document.getElementById('cart-panel-coupon-hint');
    const totalEl = document.getElementById('cart-panel-total');
    let net = Number(subtotal) || 0;
    const code = (document.getElementById('cart-panel-coupon')?.value || sessionStorage.getItem('plexi_coupon_code') || '').trim().toUpperCase();
    if (code && net > 0) {
      try {
        const res = await api.coupons.validate(code, net);
        const disc = parseFloat(res.discount) || 0;
        if (disc > 0) {
          net = Math.max(net - disc, 0);
          if (totalEl) totalEl.textContent = UI.formatCurrency(net);
          sessionStorage.setItem('plexi_coupon_code', code);
          if (hintEl) hintEl.textContent = `${code} applied (−${UI.formatCurrency(disc)})`;
        }
      } catch (err) {
        if (hintEl && document.getElementById('cart-panel-coupon')?.value) {
          hintEl.textContent = err.message || 'Invalid coupon';
        }
      }
    }
    if (!code && hintEl) {
      try {
        const avail = await api.coupons.list();
        const codes = Array.isArray(avail) ? avail : (avail.coupons || []);
        const first = codes[0];
        hintEl.textContent = first?.code
          ? `Try ${first.code}` + (first.discount_type === 'percent' ? ` (${first.discount_value}% off)` : first.discount_value ? ` (${UI.formatCurrency(first.discount_value)} off)` : '')
          : '';
      } catch (_) {
        hintEl.textContent = '';
      }
    }
    if (!freeEl) return;
    try {
      const preview = await api.delivery.preview(-33.9249, 18.4241, net);
      const threshold = Number(preview.free_threshold) || 0;
      if (threshold <= 0) { freeEl.style.display = 'none'; return; }
      freeEl.style.display = 'block';
      if (preview.free_delivery) freeEl.textContent = 'Free delivery unlocked';
      else freeEl.textContent = `Add ${UI.formatCurrency(preview.amount_to_free)} more for free delivery`;
    } catch (_) {
      freeEl.style.display = 'none';
    }
  }

  async function applyCartPanelCoupon() {
    const input = document.getElementById('cart-panel-coupon');
    const hintEl = document.getElementById('cart-panel-coupon-hint');
    const code = (input?.value || '').trim().toUpperCase();
    if (!code) {
      sessionStorage.removeItem('plexi_coupon_code');
      if (hintEl) hintEl.textContent = '';
      loadCartPanelItems();
      return;
    }
    try {
      const data = await api.cart.get();
      const items = Array.isArray(data) ? data : (data.items || []);
      const total = data.total || items.reduce((s, i) => s + (i.product?.price || 0) * (i.quantity || 1), 0);
      const res = await api.coupons.validate(code, total);
      sessionStorage.setItem('plexi_coupon_code', code);
      UI.toast(`${code} applied`, 'success');
      if (hintEl) hintEl.textContent = `${code} applied (−${UI.formatCurrency(res.discount || 0)})`;
      refreshCartPanelConversion(total);
    } catch (err) {
      UI.toast(err.message || 'Invalid coupon', 'error');
    }
  }

  function formatCartOptions(opts) {
    return Object.entries(opts || {}).map(([k, v]) =>
      Array.isArray(v) ? `${k}: ${v.join(', ')}` : `${k}: ${v}`
    ).join(' · ');
  }

  async function updateCartQty(id, qty) {
    if (qty < 1) { await removeCartItem(id); return; }
    try { await api.cart.update(id, qty); pingCartEcho(); loadCartPanelItems(); loadCartCount(); } catch (e) { UI.toast(e.message, 'error'); }
  }

  async function removeCartItem(id) {
    try { await api.cart.remove(id); UI.toast('Removed', 'info'); pingCartEcho(); loadCartPanelItems(); loadCartCount(); } catch (e) { UI.toast(e.message, 'error'); }
  }

  // ======== SKELETON ROWS ======== //
  function skeletonRows(tbodyEl, cols = 4, rows = 3) {
    if (!tbodyEl) return;
    tbodyEl.innerHTML = Array.from({ length: rows }, () =>
      `<tr>${Array.from({ length: cols }, () => `
        <td>${UI.skeleton('100%', '14px', '6px')}</td>`).join('')}</tr>`
    ).join('');
  }

  // ======== NEEDED ACTIONS (periodic input/action modals) ======== //
  // Dashboards call neededActions.start([{ key, modalId, run }]).
  // `run` should open a modal and return true, or return false to try the next check.
  const neededActions = (() => {
    const INTERVAL_MS = 15000;
    const FIRST_DELAY_MS = 600;
    const BUSY_RETRY_MS = 2000;
    const SNOOZE_MS = 10 * 60 * 1000;
    let timer = null;
    let retryTimer = null;
    let running = false;
    let visibilityBound = false;
    let checks = [];
    const snoozeUntil = Object.create(null);
    const hosted = Object.create(null);

    function isModalOpen(id) {
      const el = document.getElementById(id);
      return !!(el && el.classList.contains('show'));
    }

    function neededModalOpen() {
      return checks.some(c => c && c.modalId && isModalOpen(c.modalId));
    }

    function unrelatedModalOpen() {
      const el = document.querySelector('.modal-overlay.show');
      if (!el) return false;
      return !checks.some(c => c && (c.modalId === el.id || el.id === `needed-${c.key}-modal`));
    }

    function scheduleRetry(ms) {
      if (retryTimer) return;
      retryTimer = setTimeout(() => {
        retryTimer = null;
        tick();
      }, ms);
    }

    function patchClose() {
      if (patchClose.done) return;
      patchClose.done = true;
      document.addEventListener('plexi-modal-close', (e) => {
        onModalClose(e.detail && e.detail.id);
      });
    }

    function finderForModal(id) {
      return checks.find(c => c && (c.modalId === id || id === `needed-${c.key}-modal`));
    }

    function onModalClose(id) {
      restoreHosted(id);
      const check = finderForModal(id);
      if (check) snoozeUntil[check.key] = Date.now() + SNOOZE_MS;
    }

    function restoreHosted(id) {
      const h = hosted[id];
      if (!h) return;
      try {
        if (h.el && h.parent) {
          h.el.style.display = h.display || '';
          if (h.next && h.next.parentNode === h.parent) {
            h.parent.insertBefore(h.el, h.next);
          } else {
            h.parent.appendChild(h.el);
          }
        }
      } catch (_) {}
      delete hosted[id];
    }

    function snooze(key, ms) {
      snoozeUntil[key] = Date.now() + (ms == null ? SNOOZE_MS : ms);
    }

    function isSnoozed(key) {
      return Date.now() < (snoozeUntil[key] || 0);
    }

    function open({ id, title, content, footer, size, hostEl, intro }) {
      restoreHosted(id);
      let body = content || '';
      if (hostEl) {
        hosted[id] = {
          el: hostEl,
          parent: hostEl.parentNode,
          next: hostEl.nextSibling,
          display: hostEl.style.display
        };
        const introHtml = intro
          ? `<div style="color:var(--text-secondary);font-size:13px;margin-bottom:var(--space-md);">${intro}</div>`
          : '';
        body = `${introHtml}<div id="${id}-slot"></div>`;
      }
      UI.createModal({ id, title, content: body, footer: footer || '', size: size || 'modal-lg' });
      const overlay = document.getElementById(id);
      if (overlay) {
        overlay.classList.add('needed-action-modal');
        overlay.style.zIndex = '10050';
      }
      if (hostEl) {
        const slot = document.getElementById(id + '-slot');
        if (slot) {
          hostEl.style.display = '';
          slot.appendChild(hostEl);
        }
      }
      return true;
    }

    function close(id) {
      if (window.UI) UI.closeModal(id);
    }

    async function tick() {
      if (running || document.hidden) return;
      if (neededModalOpen()) return;
      if (unrelatedModalOpen()) {
        scheduleRetry(BUSY_RETRY_MS);
        return;
      }
      running = true;
      try {
        for (const check of checks) {
          if (!check || !check.key || typeof check.run !== 'function') continue;
          if (isSnoozed(check.key)) continue;
          if (check.modalId && isModalOpen(check.modalId)) return;
          const opened = await check.run();
          if (opened) return;
        }
      } catch (_) {
      } finally {
        running = false;
      }
    }

    function start(list) {
      patchClose();
      checks = Array.isArray(list) ? list : [];
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      scheduleRetry(FIRST_DELAY_MS);
      if (!timer) timer = setInterval(() => tick(), INTERVAL_MS);
      if (!visibilityBound) {
        visibilityBound = true;
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden) scheduleRetry(300);
        });
      }
    }

    return { start, open, close, snooze, isSnoozed, isModalOpen, tick };
  })();

  // ======== PUBLIC MALL CHROME (no needed-action popups) ======== //
  function injectMallChrome() {
    const cartSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>';
    const bellSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>';

    const cartBtn = document.getElementById('cart-btn');
    if (cartBtn) {
      cartBtn.style.display = 'flex';
      cartBtn.setAttribute('onclick', 'Dashboard.openCartPanel()');
    }
    const navCart = document.getElementById('nav-cart-btn');
    if (navCart) navCart.style.display = 'block';

    if (!document.getElementById('cart-badge')) {
      const host = document.getElementById('nav-auth') || document.querySelector('.navbar-nav');
      if (host) {
        const wrap = document.createElement('div');
        wrap.id = 'mall-chrome-cart';
        wrap.style.cssText = 'position:relative;display:flex;align-items:center;';
        wrap.innerHTML = `<button type="button" class="btn btn-ghost btn-icon" onclick="Dashboard.openCartPanel()" aria-label="Cart">${cartSvg}<span id="cart-badge" class="badge badge-error" style="position:absolute;top:-6px;right:-6px;display:none;width:18px;height:18px;padding:0;align-items:center;justify-content:center;font-size:10px;">0</span></button>`;
        host.insertBefore(wrap, host.firstChild);
      }
    }

    if (Auth.isLoggedIn() && !document.getElementById('notif-badge')) {
      const after = document.getElementById('mall-chrome-cart')
        || document.getElementById('nav-cart-btn')
        || document.getElementById('cart-btn')?.parentElement;
      const parent = after?.parentNode;
      if (parent) {
        const wrap = document.createElement('div');
        wrap.className = 'dropdown';
        wrap.id = 'mall-chrome-bell';
        wrap.innerHTML = `
          <button type="button" class="btn btn-ghost btn-icon" data-dropdown="mall-notif-drop" style="position:relative;" aria-label="Notifications">
            ${bellSvg}
            <span id="notif-badge" style="display:none;position:absolute;top:2px;right:2px;width:16px;height:16px;border-radius:50%;background:var(--primary);color:white;font-size:9px;font-weight:700;align-items:center;justify-content:center;"></span>
          </button>
          <div class="dropdown-menu" id="mall-notif-drop" style="right:0;min-width:300px;max-height:360px;overflow-y:auto;">
            <div style="padding:var(--space-sm) var(--space-md);border-bottom:1px solid var(--border-light);display:flex;align-items:center;justify-content:space-between;">
              <span style="font-weight:700;font-size:14px;">Notifications</span>
              <button class="btn btn-ghost btn-sm" type="button" onclick="Dashboard.markAllRead()">Mark all read</button>
            </div>
            <div id="notif-panel"></div>
          </div>`;
        parent.insertBefore(wrap, after.nextSibling);
      }
    }
  }

  function initMallChrome() {
    if (window.Auth && typeof Auth.populateUserUI === 'function') Auth.populateUserUI();
    injectMallChrome();
    UI.initDropdowns();
    if (window.Auth && typeof Auth.isLoggedIn === 'function' && Auth.isLoggedIn()) {
      loadCartCount();
      loadNotifications();
      setInterval(loadNotifications, 60000);
      syncNeededNotifications();
    }
    window.addEventListener('storage', e => {
      if (e.key === 'plexi_cart_echo') loadCartCount();
    });
  }

  // ======== INIT ======== //
  function init() {
    Auth.populateUserUI();
    UI.initDropdowns();
    UI.initSidebarToggle();
    if (window.SoundManager) SoundManager.init();
    if (window.PushManager) PushManager.init().then(() => {
      if (!PushManager.shouldPrompt()) return;
      setTimeout(() => {
        if (document.querySelector('.needed-action-modal.show')) return;
        PushManager.showPermissionPrompt();
      }, 8000);
    });
    loadNotifications();
    setInterval(loadNotifications, 60000);
    syncNeededNotifications();
    setInterval(syncNeededNotifications, 30000);
    loadCartCount();

    window.addEventListener('storage', e => {
      if (e.key === 'plexi_cart_echo') loadCartCount();
    });

    // Section nav
    document.querySelectorAll('[data-section]').forEach(btn => {
      btn.addEventListener('click', () => showSection(btn.dataset.section));
    });

    // Keyboard focus target for section switches (a11y)
    document.querySelectorAll('.dash-section').forEach(el => {
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    });

    // Restore last section after refresh / deep-link (#section-id, #sec-id)
    const requested = location.hash.slice(1);
    if (isSectionId(requested)) {
      activateSection(requested);
    } else if (requested) {
      try { history.replaceState(null, '', location.pathname + location.search); } catch (_) {}
    }
    if (!currentSectionId) applySectionChrome(document.querySelector('[data-section].active')?.dataset.section
      || document.querySelector('.dash-section')?.id);

    // Browser back/forward and manual hash edits navigate sections too
    window.addEventListener('hashchange', () => {
      const id = location.hash.slice(1);
      if (id && id !== currentSectionId && isSectionId(id)) activateSection(id);
    });

    // Logout buttons
    document.querySelectorAll('[data-logout]').forEach(btn => {
      btn.addEventListener('click', () => {
        UI.confirmDialog({
          title: 'Log Out',
          message: 'Are you sure you want to log out?',
          confirmText: 'Log Out',
          onConfirm: () => Auth.logout()
        });
      });
    });
  }

  return {
    init, initMallChrome, loadNotifications, markRead, markAllRead, loadCartCount,
    showSection, renderTable, renderPagination, initSearch, skeletonRows,
    openCartPanel, closeCartPanel, loadCartPanelItems, updateCartQty, removeCartItem,
    applyCartPanelCoupon, goToFullCart,
    neededActions
  };
})();

window.Dashboard = Dashboard;
// ======== DASHBOARD SEARCH (icon toggle → fixed overlay) ======== //
function openDashboardSearch() {
  const wrap = document.getElementById('topbar-search-wrap');
  if (!wrap) return;
  wrap.classList.add('open');
  const input = document.getElementById('topbar-search-input');
  if (input) { input.focus(); input.value = ''; }
}

function closeDashboardSearch() {
  const wrap = document.getElementById('topbar-search-wrap');
  if (!wrap) return;
  wrap.classList.remove('open');
  const input = document.getElementById('topbar-search-input');
  if (input) { input.value = ''; }
}

function dashboardSearch(query) {
  const active = document.querySelector('.dash-section[style*="display: block"], .dash-section[style*="display:block"], .dash-section.active');
  if (!active) return;
  const searchInput = active.querySelector('.search-bar input[type="text"], input[placeholder*="Search"], input[placeholder*="search"]');
  if (searchInput) {
    searchInput.value = query;
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
  }
}
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
      State.set('notifications', notifs);
    } catch (_) {}
  }

  function renderNotifPanel(panel, notifs) {
    if (notifs.length === 0) {
      panel.innerHTML = UI.empty('No Notifications', 'You\'re all caught up!');
      return;
    }
    panel.innerHTML = notifs.slice(0, 8).map(n => `
      <div class="notif-item ${n.read ? '' : 'unread'}" data-id="${n.id}" style="
        display:flex;gap:var(--space-sm);padding:var(--space-sm) var(--space-md);
        border-bottom:1px solid var(--border-light);
        cursor:pointer;
        background:${n.read ? 'transparent' : 'var(--primary-alpha)'};
        transition:background 0.2s;
      " onclick="Dashboard.markRead('${n.id}')">
        <div style="
          width:8px;height:8px;border-radius:50%;
          background:${n.read ? 'var(--gray-300)' : 'var(--primary)'};
          flex-shrink:0;margin-top:6px;
        "></div>
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:600;color:var(--text-primary)">${n.title}</div>
          <div style="font-size:12px;color:var(--text-secondary)">${n.message}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${UI.timeAgo(n.created_at)}</div>
        </div>
      </div>
    `).join('');
  }

  async function markRead(id) {
    try {
      await api.notifications.markRead(id);
      const el = document.querySelector(`.notif-item[data-id="${id}"]`);
      if (el) {
        el.style.background = 'transparent';
        el.querySelector('div').style.background = 'var(--gray-300)';
      }
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
  async function loadCartCount() {
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
  function showSection(id) {
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
    }
    document.querySelectorAll('[data-section]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.section === id);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
  function openCartPanel() {
    let panel = document.getElementById('cart-slide-panel');
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
            <div class="flex-between" style="margin-bottom:var(--space-md);"><span style="color:var(--text-secondary);">Total</span><strong id="cart-panel-total" style="font-size:20px;color:var(--primary);">R0.00</strong></div>
            <button class="btn btn-primary btn-block" onclick="Dashboard.closeCartPanel();location.href='../dashboard/shopper.html';document.querySelector('[data-section=section-cart]')?.click();">View Full Cart</button>
          </div>
        </div>`;
      document.body.appendChild(panel);
    }
    const overlay = document.getElementById('cart-overlay');
    const drawer = document.getElementById('cart-drawer');
    overlay.style.display = 'block';
    drawer.style.right = '0';
    requestAnimationFrame(() => { overlay.style.opacity = '1'; });
    loadCartPanelItems();
  }

  function closeCartPanel() {
    const overlay = document.getElementById('cart-overlay');
    const drawer = document.getElementById('cart-drawer');
    if (overlay) overlay.style.opacity = '0';
    if (drawer) drawer.style.right = '-420px';
    setTimeout(() => { if (overlay) overlay.style.display = 'none'; }, 300);
  }

  async function loadCartPanelItems() {
    const el = document.getElementById('cart-panel-items');
    const totalEl = document.getElementById('cart-panel-total');
    if (!el) return;
    el.innerHTML = '<div style="text-align:center;padding:var(--space-xl);color:var(--text-muted);">Loading…</div>';
    try {
      const data = await api.cart.get();
      const items = Array.isArray(data) ? data : (data.items || []);
      const total = data.total || items.reduce((s, i) => s + (i.product?.price || 0) * (i.quantity || 1), 0);
      if (!items.length) {
        el.innerHTML = '<div style="text-align:center;padding:var(--space-2xl);color:var(--text-muted);"><div style="font-size:48px;margin-bottom:var(--space-md);">🛒</div><p>Your cart is empty</p></div>';
        if (totalEl) totalEl.textContent = UI.formatCurrency(0);
        return;
      }
      el.innerHTML = items.map(item => {
        const p = item.product || {};
        return `
          <div style="display:flex;gap:var(--space-md);padding:var(--space-md) 0;border-bottom:1px solid var(--border-light);">
            <div style="width:60px;height:60px;border-radius:var(--radius-md);background:var(--bg);overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;">
              ${p.images?.[0] ? `<img src="${p.images[0]}" style="width:100%;height:100%;object-fit:cover;">` : '<span style="font-size:24px;">📦</span>'}
            </div>
            <div style="flex:1;min-width:0;">
              <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.name || 'Product'}</div>
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
    } catch (err) {
      el.innerHTML = `<div style="text-align:center;padding:var(--space-xl);color:var(--error);">${err.message || 'Could not load cart'}</div>`;
    }
  }

  async function updateCartQty(id, qty) {
    if (qty < 1) { await removeCartItem(id); return; }
    try { await api.cart.update(id, qty); loadCartPanelItems(); loadCartCount(); } catch (e) { UI.toast(e.message, 'error'); }
  }

  async function removeCartItem(id) {
    try { await api.cart.remove(id); UI.toast('Removed', 'info'); loadCartPanelItems(); loadCartCount(); } catch (e) { UI.toast(e.message, 'error'); }
  }

  // ======== INIT ======== //
  function init() {
    Auth.populateUserUI();
    UI.initDropdowns();
    UI.initSidebarToggle();
    if (window.SoundManager) SoundManager.init();
    loadNotifications();
    setInterval(loadNotifications, 60000);

    // Section nav
    document.querySelectorAll('[data-section]').forEach(btn => {
      btn.addEventListener('click', () => showSection(btn.dataset.section));
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
    init, loadNotifications, markRead, markAllRead, loadCartCount,
    showSection, renderTable, renderPagination, initSearch,
    openCartPanel, closeCartPanel, loadCartPanelItems, updateCartQty, removeCartItem
  };
})();

window.Dashboard = Dashboard;
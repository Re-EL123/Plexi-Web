// ============================================================
// PLEXI DIGITAL MALL — Dashboard Logic
// ============================================================

const Dashboard = (() => {

  // ======== NOTIFICATIONS BELL ======== //
  async function loadNotifications() {
    try {
      const data = await api.notifications.list();
      const notifs = Array.isArray(data) ? data : (data.notifications || []);
      const unread = notifs.filter(n => !n.read).length;

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

  // ======== INIT ======== //
  function init() {
    Auth.populateUserUI();
    UI.initDropdowns();
    UI.initSidebarToggle();
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
    showSection, renderTable, renderPagination, initSearch
  };
})();

window.Dashboard = Dashboard;
// ============================================================
// PLEXI DIGITAL MALL — UI Utilities
// ============================================================

const UI = (() => {

  // ======== TOAST NOTIFICATIONS ======== //
  function ensureToastContainer() {
    let el = document.getElementById('toast-container');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast-container';
      document.body.appendChild(el);
    }
    return el;
  }

  const ICONS = {
    success: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    error:   `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    warning: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    info:    `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
  };

  function toast(message, type = 'info', duration = 3500) {
    const container = ensureToastContainer();
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `
      <span class="toast-icon">${ICONS[type] || ICONS.info}</span>
      <span class="toast-text">${message}</span>
      <button class="toast-close" onclick="this.closest('.toast').remove()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
      <div class="toast-progress" style="animation-duration:${duration}ms"></div>
    `;
    container.appendChild(el);
    if (window.SoundManager) SoundManager.play(type);
    const removeToast = (node) => {
      node.classList.add('removing');
      setTimeout(() => node.remove(), 300);
    };
    let timer = setTimeout(() => removeToast(el), duration);
    el.addEventListener('mouseenter', () => clearTimeout(timer));
    el.addEventListener('mouseleave', () => { timer = setTimeout(() => removeToast(el), duration); });
    el.querySelector('.toast-close').addEventListener('click', () => clearTimeout(timer));
  }

  // ======== MODAL ======== //
  const openModals = [];

  function focusableIn(root) {
    return root.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
  }

  function initModalKeyboard() {
    if (initModalKeyboard.done) return;
    initModalKeyboard.done = true;
    document.addEventListener('keydown', e => {
      const overlay = openModals[openModals.length - 1];
      if (!overlay) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        closeModal(overlay.id);
        return;
      }
      if (e.key !== 'Tab') return;
      const focusables = Array.from(focusableIn(overlay));
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !overlay.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !overlay.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    });
  }

  function openModal(id) {
    const overlay = document.getElementById(id);
    if (!overlay) return;
    overlay.classList.add('show');
    openModals.push(overlay);
    document.body.style.overflow = 'hidden';
    initModalKeyboard();
    const modalEl = overlay.querySelector('.modal') || overlay;
    modalEl.setAttribute('role', 'dialog');
    modalEl.setAttribute('aria-modal', 'true');
    if (!modalEl.getAttribute('aria-label')) {
      const title = overlay.querySelector('.modal-title');
      if (title && title.textContent.trim()) modalEl.setAttribute('aria-label', title.textContent.trim());
    }
    const focusables = Array.from(focusableIn(modalEl));
    if (focusables.length) {
      const preferred = focusables.find(el => /INPUT|SELECT|TEXTAREA/.test(el.tagName)) || focusables[0];
      setTimeout(() => preferred.focus(), 30);
    }
  }

  function closeModal(id) {
    try {
      document.dispatchEvent(new CustomEvent('plexi-modal-close', { detail: { id } }));
    } catch (_) {}
    const overlay = document.getElementById(id);
    if (!overlay) return;
    overlay.classList.remove('show');
    const idx = openModals.indexOf(overlay);
    if (idx > -1) openModals.splice(idx, 1);
    if (!openModals.length) document.body.style.overflow = '';
  }

  function createModal({ id, title, content, footer = '', size = '' }) {
    const existing = document.getElementById(id);
    if (existing) existing.remove();

    const el = document.createElement('div');
    el.className = 'modal-overlay';
    el.id = id;
    el.innerHTML = `
      <div class="modal ${size}">
        <div class="modal-header">
          <h3 class="modal-title">${title}</h3>
          <button class="modal-close" onclick="UI.closeModal('${id}')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="modal-body">${content}</div>
        ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
      </div>
    `;
    document.body.appendChild(el);
    el.style.zIndex = '10050';
    el.addEventListener('click', e => { if (e.target === el) closeModal(id); });
    setTimeout(() => openModal(id), 10);
    return el;
  }

  function confirmDialog({ title, message, confirmText = 'Confirm', onConfirm, danger = false }) {
    createModal({
      id: 'confirm-dialog',
      title,
      content: `<p style="color:var(--text-secondary)">${message}</p>`,
      footer: `
        <button class="btn btn-ghost" onclick="UI.closeModal('confirm-dialog')">Cancel</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="confirm-btn">${confirmText}</button>
      `
    });
    document.getElementById('confirm-btn').addEventListener('click', () => {
      if (window.SoundManager) SoundManager.play('click');
      closeModal('confirm-dialog');
      if (onConfirm) onConfirm();
    });
  }

  // ======== ADD TO CART — VARIANT/OPTION PICKER MODAL ======== //
  // Shared quick-add used by index, store, product and dashboards.
  // Opens a chooser whenever the product has variants or options.
  async function addToCartModal(productRef, { loginPath = 'login.html' } = {}) {
    if (!Auth.isLoggedIn()) {
      toast('Please login to add to cart', 'warning');
      setTimeout(() => location.href = loginPath, 800);
      return;
    }
    let p = productRef;
    if (typeof productRef === 'string') {
      try {
        const res = await api.products.get(productRef);
        p = res?.product || res?.body?.product || res;
      } catch (err) { toast(err.message || 'Could not load product', 'error'); return; }
    }
    if (!p || !p.id) { toast('Product not found', 'error'); return; }
    if (p.sold_out || Number(p.inventory) === 0) { toast('This item is sold out', 'warning'); return; }

    const groups = (Array.isArray(p.variants) ? p.variants : [])
      .filter(g => g && ((g.values || []).length || (g.options || []).length));
    const options = (Array.isArray(p.options) ? p.options : [])
      .filter(o => o.name && Array.isArray(o.values) && o.values.length);

    const finish = async () => {
      toast(`Added ${state.qty} × ${p.name} to cart! 🛒`, 'success');
      closeModal('add-to-cart-modal');
      if (window.Dashboard?.loadCartCount) Dashboard.loadCartCount();
    };

    // Fast path — nothing to choose, add straight away
    if (!groups.length && !options.length) {
      try {
        await api.cart.add({ product_id: p.id, quantity: 1 });
        await finish();
      } catch (err) { toast(err.message || 'Failed to add to cart', 'error'); }
      return;
    }

    const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    const groupVals = g => (g.values && g.values.length ? g.values : g.options) || [];
    const valText = v => (v && typeof v === 'object') ? v.value : v;
    const valPrice = v => (v && typeof v === 'object' && v.price != null) ? Number(v.price) : null;
    const groupName = (g, i) => (g.name && g.name.trim()) || `Option ${i + 1}`;

    const state = { qty: 1, variants: {}, opts: {} };
    // Preselect the first value of every variant group
    groups.forEach((g, gi) => { state.variants[gi] = valText(groupVals(g)[0]); });

    function currentPrice() {
      let price = null;
      Object.keys(state.variants).forEach(gi => {
        const match = groupVals(groups[gi]).find(v => valText(v) === state.variants[gi]);
        const vp = valPrice(match);
        if (vp != null && price == null) price = vp;
      });
      return price ?? Number(p.price);
    }

    function refresh() {
      const priceEl = document.getElementById('acm-price');
      if (priceEl) priceEl.textContent = formatCurrency(currentPrice());
      const qtyEl = document.getElementById('acm-qty');
      if (qtyEl) qtyEl.textContent = state.qty;
      const sum = document.getElementById('acm-summary');
      if (sum) {
        const parts = Object.keys(state.variants)
          .map(gi => `${groupName(groups[gi], +gi)}: ${state.variants[gi]}`);
        Object.keys(state.opts).forEach(n => {
          const v = state.opts[n];
          if (Array.isArray(v) ? v.length : v !== '' && v != null) parts.push(`${n}: ${Array.isArray(v) ? v.join(', ') : v}`);
        });
        sum.textContent = parts.join(' · ');
      }
    }

    const maxQty = Math.min(Number(p.inventory) || 99, 99);

    const content = `
      <div style="display:flex;gap:var(--space-md);margin-bottom:var(--space-md);">
        <div style="width:72px;height:72px;border-radius:var(--radius-md);background:var(--bg-alt);overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;">
          ${p.images?.[0] ? `<img src="${esc(p.images[0])}" style="width:100%;height:100%;object-fit:cover;">` : '<span style="font-size:30px;">🛍️</span>'}
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:700;">${esc(p.name)}</div>
          <div id="acm-summary" style="font-size:12px;color:var(--text-muted);margin-top:2px;"></div>
          <div style="font-size:18px;font-weight:800;color:var(--primary);margin-top:4px;" id="acm-price">${formatCurrency(p.price)}</div>
        </div>
      </div>

      ${groups.map((g, gi) => `
        <div style="margin-bottom:var(--space-sm);">
          <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted);margin-bottom:6px;">${esc(groupName(g, gi))}</div>
          <div style="display:flex;flex-wrap:wrap;gap:var(--space-xs);">
            ${groupVals(g).map(v => {
              const t = valText(v);
              const extra = valPrice(v);
              return `<button type="button" class="btn btn-ghost acm-var" data-g="${gi}" data-v="${esc(t)}" style="padding:6px 12px;font-size:13px;">
                ${esc(t)}${extra != null ? ` · ${formatCurrency(extra)}` : ''}
              </button>`;
            }).join('')}
          </div>
        </div>`).join('')}

      ${options.map(opt => {
        const vals = opt.values || [];
        const head = `<div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted);margin-bottom:6px;">
          ${esc(opt.name)}${opt.required ? ' <span style="color:var(--error);">*</span>' : ''}</div>`;
        const ctl = name => `data-opt-name="${esc(name)}"`;
        if (opt.type === 'radio') {
          return `<div style="margin-bottom:var(--space-sm);">${head}
            <div style="display:flex;flex-wrap:wrap;gap:var(--space-sm);">${vals.map(v => `
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:6px 10px;border:1px solid var(--border-light);border-radius:var(--radius-sm);background:var(--surface);font-size:13px;">
                <input type="radio" name="acm-opt-${esc(opt.name)}" ${ctl(opt.name)} value="${esc(v)}" style="accent-color:var(--primary);">${esc(v)}
              </label>`).join('')}</div></div>`;
        }
        if (opt.type === 'checkbox' || opt.type === 'multiselect') {
          return `<div style="margin-bottom:var(--space-sm);">${head}
            <div style="display:flex;flex-wrap:wrap;gap:var(--space-sm);">${vals.map(v => `
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:6px 10px;border:1px solid var(--border-light);border-radius:var(--radius-sm);background:var(--surface);font-size:13px;">
                <input type="checkbox" ${ctl(opt.name)} value="${esc(v)}" style="accent-color:var(--primary);">${esc(v)}
              </label>`).join('')}</div></div>`;
        }
        return `<div style="margin-bottom:var(--space-sm);">${head}
          <select class="form-control" style="max-width:280px;" ${ctl(opt.name)}>
            <option value="">${opt.required ? 'Select…' : 'None'}</option>
            ${vals.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('')}
          </select></div>`;
      }).join('')}

      <div style="display:flex;align-items:center;gap:var(--space-sm);margin-top:var(--space-md);">
        <span style="font-size:13px;font-weight:600;">Quantity</span>
        <button type="button" class="btn btn-ghost btn-icon-sm" id="acm-minus">−</button>
        <span id="acm-qty" style="font-weight:700;min-width:24px;text-align:center;">1</span>
        <button type="button" class="btn btn-ghost btn-icon-sm" id="acm-plus">+</button>
        <span style="font-size:11px;color:var(--text-muted);">(max ${maxQty})</span>
      </div>
    `;

    createModal({
      id: 'add-to-cart-modal',
      title: 'Choose options',
      content,
      footer: `
        <button class="btn btn-ghost" onclick="UI.closeModal('add-to-cart-modal')">Cancel</button>
        <button class="btn btn-primary" id="acm-add">Add to Cart</button>`
    });

    const root = document.getElementById('add-to-cart-modal');

    // Variant pills
    root.querySelectorAll('.acm-var').forEach(btn => {
      btn.addEventListener('click', () => {
        const gi = btn.dataset.g;
        state.variants[gi] = btn.dataset.v;
        btn.closest('div').querySelectorAll('.acm-var').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        refresh();
      });
    });

    // Options
    root.querySelectorAll('[data-opt-name]').forEach(input => {
      input.addEventListener('change', () => {
        const name = input.dataset.optName;
        const opt = options.find(o => o.name === name);
        if (opt && (opt.type === 'checkbox' || opt.type === 'multiselect')) {
          const checked = [...root.querySelectorAll(`[data-opt-name="${CSS.escape(name)}"]:checked`)].map(i => i.value);
          state.opts[name] = checked;
        } else {
          state.opts[name] = input.value;
        }
        refresh();
      });
    });

    // Quantity
    document.getElementById('acm-minus').addEventListener('click', () => { state.qty = Math.max(1, state.qty - 1); refresh(); });
    document.getElementById('acm-plus').addEventListener('click', () => { state.qty = Math.min(maxQty, state.qty + 1); refresh(); });

    // Confirm
    document.getElementById('acm-add').addEventListener('click', async () => {
      for (const opt of options) {
        if (!opt.required) continue;
        const v = state.opts[opt.name];
        if (v === undefined || v === '' || (Array.isArray(v) && !v.length)) {
          toast(`Please select "${opt.name}"`, 'warning');
          return;
        }
      }
      const btn = document.getElementById('acm-add');
      setLoading(btn, true, 'Adding…');
      try {
        const sel = {};
        Object.keys(state.variants).forEach(gi => { sel[groupName(groups[+gi], +gi)] = state.variants[gi]; });
        const summary = Object.keys(sel).map(n => `${n}: ${sel[n]}`).join(', ');
        const clean = {};
        Object.keys(state.opts).forEach(n => {
          const v = state.opts[n];
          if (Array.isArray(v) ? v.length : v !== '' && v != null) clean[n] = v;
        });
        if (Object.keys(sel).length) clean.__variants = sel;
        await api.cart.add({
          product_id: p.id,
          quantity: state.qty,
          variant: summary || undefined,
          options: Object.keys(clean).length ? clean : undefined
        });
        await finish();
      } catch (err) {
        toast(err.message || 'Failed to add to cart', 'error');
      } finally {
        setLoading(btn, false);
      }
    });

    // Highlight preselected pills once mounted
    setTimeout(() => {
      root.querySelectorAll('.acm-var').forEach(b => {
        if (state.variants[b.dataset.g] === b.dataset.v) b.classList.add('active');
      });
      refresh();
    }, 30);
  }

  // ======== LOADING ======== //
  function setLoading(btn, loading, text = '') {
    if (!btn) return;
    if (loading) {
      btn._originalHTML = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner"></span>${text}`;
    } else {
      btn.disabled = false;
      btn.innerHTML = btn._originalHTML || text;
    }
  }

  function showPageLoader() {
    const el = document.getElementById('page-loader');
    if (el) el.style.display = 'flex';
  }

  function hidePageLoader() {
    const el = document.getElementById('page-loader');
    if (!el) return;
    el.classList.add('fade-out');
    setTimeout(() => { el.style.display = 'none'; }, 400);
  }

  // ======== HELPERS ======== //
  function formatCurrency(amount) {
    return `R${parseFloat(amount || 0).toFixed(2)}`;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-ZA', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  }

  function formatDateTime(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('en-ZA', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  function timeAgo(dateStr) {
    const d = new Date(dateStr);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7)  return `${days}d ago`;
    return formatDate(dateStr);
  }

  function badge(text, color = 'gray') {
    return `<span class="badge badge-${color}">${text}</span>`;
  }

  function statusBadge(status, map) {
    const s = map?.[status] || { label: status, color: 'gray' };
    return badge(s.label, s.color);
  }

  function stars(rating = 0) {
    let html = '<div class="stars">';
    for (let i = 1; i <= 5; i++) {
      html += i <= rating
        ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`
        : `<svg class="empty" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
    }
    html += '</div>';
    return html;
  }

  function avatar(name, size = 'md') {
    const initials = (name || 'U').charAt(0).toUpperCase();
    return `<div class="avatar avatar-${size}">${initials}</div>`;
  }

  function skeleton(w = '100%', h = '20px', r = 'var(--radius-md)') {
    return `<div class="skeleton" style="width:${w};height:${h};border-radius:${r}"></div>`;
  }

  function skeletonTable(rows = 5, cols = 4) {
    let html = '<div class="skeleton-table" role="status" aria-label="Loading table">';
    for (let r = 0; r < rows; r++) {
      html += '<div class="skeleton-row">';
      for (let c = 0; c < cols; c++) html += skeleton('100%', '16px');
      html += '</div>';
    }
    return html + '</div>';
  }

  function skeletonGrid(count = 6, h = '200px') {
    let html = '<div class="skeleton-grid" role="status" aria-label="Loading cards">';
    for (let i = 0; i < count; i++) html += `<div class="skeleton-card">${skeleton('60%', '14px')}${skeleton('100%', h)}</div>`;
    return html + '</div>';
  }

  function skeletonList(count = 4) {
    let html = '<div class="skeleton-list" role="status" aria-label="Loading list">';
    for (let i = 0; i < count; i++) html += `<div class="skeleton-list-item">${skeleton('40px', '40px', '50%')}<div>${skeleton('60%', '14px')}${skeleton('40%', '12px')}</div></div>`;
    return html + '</div>';
  }

  function errorState(message = 'Something went wrong.') {
    return `
      <div class="empty-state animate-fadeIn">
        <div class="empty-state-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <h3>Something went wrong</h3>
        <p>${message}</p>
      </div>
    `;
  }

  function notifHeader(icon, title, time) {
    return `
      <div class="notif-header">
        <span class="notif-icon">${icon}</span>
        <div class="notif-header-text">
          <strong>${title}</strong>
          <span class="notif-time">${time}</span>
        </div>
      </div>
    `;
  }

  // ======== SEO ======== //
  function currentUrl() {
    return location.origin + location.pathname + location.search;
  }

  // Crawler-friendly share link: the backend renders real OG/Twitter
  // tags server-side (static Pages HTML can't), then redirects humans.
  function shareProxyUrl(type, id) {
    return `${CONFIG.API_URL}/products?action=share&type=${type}&id=${id}`;
  }

  function setMeta(attr, key, content) {
    if (content === undefined || content === null || content === '') return;
    let el = document.head.querySelector(`meta[${attr}="${key}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  }

  function updateMeta({ title, description, image, url, type = 'website' }) {
    if (title) document.title = title;
    setMeta('property', 'og:type', type);
    if (title) {
      setMeta('name', 'title', title);
      setMeta('property', 'og:title', title);
      setMeta('name', 'twitter:title', title);
    }
    if (description) {
      setMeta('name', 'description', description);
      setMeta('property', 'og:description', description);
      setMeta('name', 'twitter:description', description);
    }
    if (image) {
      setMeta('property', 'og:image', image);
      setMeta('name', 'twitter:image', image);
      setMeta('name', 'twitter:card', 'summary_large_image');
    }
    if (url) {
      setMeta('property', 'og:url', url);
      let canonical = document.head.querySelector('link[rel="canonical"]');
      if (!canonical) {
        canonical = document.createElement('link');
        canonical.setAttribute('rel', 'canonical');
        document.head.appendChild(canonical);
      }
      canonical.setAttribute('href', url);
    }
  }

  function updateJsonLd(obj) {
    let el = document.getElementById('seo-jsonld');
    if (!el) {
      el = document.createElement('script');
      el.type = 'application/ld+json';
      el.id = 'seo-jsonld';
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(obj);
  }

  // ======== SHARE ======== //
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    toast('Link copied to clipboard', 'success');
  }

  function shareDialog({ title, text, url, image }) {
    if (navigator.share) {
      navigator.share({ title, text, url }).catch(() => {});
      return;
    }
    const enc = encodeURIComponent;
    const u = enc(url);
    const t = enc(text || title);
    const links = [
      { label: 'WhatsApp', color: '#25D366', href: `https://wa.me/?text=${t}%20${u}`, svg: '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>' },
      { label: 'Facebook', color: '#1877F2', href: `https://www.facebook.com/sharer/sharer.php?u=${u}`, svg: '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>' },
      { label: 'X', color: '#000000', href: `https://twitter.com/intent/tweet?text=${t}&url=${u}`, svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>' },
      { label: 'Telegram', color: '#229ED9', href: `https://t.me/share/url?url=${u}&text=${t}`, svg: '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>' },
      { label: 'LinkedIn', color: '#0A66C2', href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`, svg: '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>' },
      { label: 'Email', color: '#EA4335', href: `mailto:?subject=${enc(title || '')}&body=${t}%20${u}`, svg: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="22,6 12,13 2,6"/></svg>' }
    ];
    createModal({
      id: 'share-modal',
      title: 'Share',
      content: `
        <p style="color:var(--text-secondary);font-size:13px;margin-bottom:var(--space-md);">Share this with friends:</p>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:var(--space-sm);">
          ${links.map(l => `
            <a href="${l.href}" target="_blank" rel="noopener" class="btn btn-outline" style="flex-direction:column;gap:6px;padding:var(--space-md) var(--space-sm);height:auto;font-size:12px;color:${l.color};">
              ${l.svg}${l.label}
            </a>`).join('')}
        </div>`,
      footer: `
        <button class="btn btn-ghost" onclick="UI.closeModal('share-modal')">Close</button>
        <button class="btn btn-primary" onclick="UI.copyText('${encodeURIComponent(url)}')">Copy Link</button>`
    });
  }

  function empty(title, message, icon = '📦', action = '') {
    return `
      <div class="empty-state animate-fadeIn">
        <div class="empty-state-icon">${typeof icon === 'string' && icon.startsWith('<') ? icon :
          `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>`}
        </div>
        <h3>${title}</h3>
        <p>${message}</p>
        ${action}
      </div>
    `;
  }

  // ======== STAGGER ANIMATIONS ======== //
  function staggerReveal(container) {
    const items = container.querySelectorAll('.stagger-child');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          setTimeout(() => entry.target.classList.add('visible'), i * 60);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    items.forEach(item => observer.observe(item));
  }

  // ======== DROPDOWN TOGGLE ======== //
  function setDropdown(menu, open) {
    const trigger = menu.closest('.dropdown')?.querySelector('[data-dropdown]');
    menu.classList.toggle('show', open);
    if (trigger) trigger.setAttribute('aria-expanded', String(open));
  }

  function dropdownItems(menu) {
    return Array.from(menu.querySelectorAll('a[href], button:not([disabled])'));
  }

  function initDropdowns() {
    document.addEventListener('click', e => {
      const trigger = e.target.closest('[data-dropdown]');
      document.querySelectorAll('.dropdown-menu.show').forEach(m => {
        if (!m.closest('.dropdown')?.contains(e.target)) setDropdown(m, false);
      });
      if (trigger) {
        const menu = document.getElementById(trigger.dataset.dropdown);
        if (menu) {
          trigger.setAttribute('aria-haspopup', 'true');
          setDropdown(menu, !menu.classList.contains('show'));
        }
      }
    });

    document.addEventListener('keydown', e => {
      const menu = document.querySelector('.dropdown-menu.show');
      if (!menu) return;
      const items = dropdownItems(menu);
      const idx = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (idx === -1) { items[0]?.focus(); return; }
        const next = (idx + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items[next].focus();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setDropdown(menu, false);
        menu.closest('.dropdown')?.querySelector('[data-dropdown]')?.focus();
      }
    });
  }

  // ======== TABS ======== //
  function initTabs(containerEl) {
    const tabs   = containerEl.querySelectorAll('.tab-btn');
    const panels = containerEl.querySelectorAll('.tab-content');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        const panel = containerEl.querySelector(`#${tab.dataset.tab}`);
        if (panel) panel.classList.add('active');
      });
    });
  }

  // ======== SIDEBAR TOGGLE ======== //
  function initSidebarToggle() {
    const toggle  = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (!toggle || !sidebar) return;
    toggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      if (overlay) overlay.classList.toggle('show');
    });
    if (overlay) {
      overlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('show');
      });
    }
  }

  // ======== RIPPLE ======== //
  function addRipple(el) {
    el.addEventListener('click', e => {
      const ripple = document.createElement('span');
      ripple.className = 'ripple-effect';
      const rect = el.getBoundingClientRect();
      ripple.style.left = (e.clientX - rect.left) + 'px';
      ripple.style.top  = (e.clientY - rect.top) + 'px';
      el.appendChild(ripple);
      setTimeout(() => ripple.remove(), 700);
    });
  }

  // ======== CATEGORIES ======== //
  let categoriesCache = null;

  async function fetchCategories() {
    if (categoriesCache) return categoriesCache;
    try {
      const data = await api.stores.categories();
      const list = Array.isArray(data) ? data : (data?.categories || []);
      const names = list.map(c => c.name);
      categoriesCache = names.length ? names : CONFIG.CATEGORIES;
    } catch (_) {
      categoriesCache = CONFIG.CATEGORIES;
    }
    return categoriesCache;
  }

  async function populateCategories(select, opts = {}) {
    const el = typeof select === 'string' ? document.getElementById(select) : select;
    if (!el) return;
    const keep = opts.keep ?? '';
    const includeOthers = opts.includeOthers !== false;
    const categories = await fetchCategories();
    let options = '';
    if (keep) options += `<option value="">${keep}</option>`;
    for (const name of categories) {
      const value = opts.lowercase ? name.toLowerCase() : name;
      options += `<option value="${value}">${name}</option>`;
    }
    if (includeOthers && !categories.includes('Others')) {
      options += `<option value="${opts.lowercase ? 'others' : 'Others'}">Others</option>`;
    }
    el.innerHTML = options;
    if (opts.selected) el.value = opts.selected;
    return categories;
  }

  return {
    toast, openModal, closeModal, createModal, confirmDialog, addToCartModal,
    setLoading, showPageLoader, hidePageLoader,
    formatCurrency, formatDate, formatDateTime, timeAgo,
    badge, statusBadge, stars, avatar, skeleton, skeletonTable, skeletonGrid, skeletonList,
    empty, errorState, notifHeader,
    currentUrl, shareProxyUrl, updateMeta, updateJsonLd, shareDialog, copyText,
    staggerReveal, initDropdowns, initTabs, initSidebarToggle, addRipple,
    fetchCategories, populateCategories
  };
})();

window.UI = UI;
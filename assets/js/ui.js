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
      <div class="toast-progress"></div>
    `;
    container.appendChild(el);
    if (window.SoundManager) SoundManager.play(type);
    const timer = setTimeout(() => {
      el.classList.add('removing');
      setTimeout(() => el.remove(), 300);
    }, duration);
    el.querySelector('.toast-close').addEventListener('click', () => clearTimeout(timer));
  }

  // ======== MODAL ======== //
  function openModal(id) {
    const overlay = document.getElementById(id);
    if (!overlay) return;
    overlay.classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(id) {
    const overlay = document.getElementById(id);
    if (!overlay) return;
    overlay.classList.remove('show');
    document.body.style.overflow = '';
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
  function initDropdowns() {
    document.addEventListener('click', e => {
      const trigger = e.target.closest('[data-dropdown]');
      document.querySelectorAll('.dropdown-menu.show').forEach(m => {
        if (!m.closest('.dropdown')?.contains(e.target)) m.classList.remove('show');
      });
      if (trigger) {
        const menu = document.getElementById(trigger.dataset.dropdown);
        if (menu) menu.classList.toggle('show');
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

  return {
    toast, openModal, closeModal, createModal, confirmDialog,
    setLoading, showPageLoader, hidePageLoader,
    formatCurrency, formatDate, formatDateTime, timeAgo,
    badge, statusBadge, stars, avatar, skeleton, empty,
    staggerReveal, initDropdowns, initTabs, initSidebarToggle, addRipple
  };
})();

window.UI = UI;
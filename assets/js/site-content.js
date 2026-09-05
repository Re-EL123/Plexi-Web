// ============================================================
// PLEXI DIGITAL MALL — Public CMS (FAQs, legal, guide)
// Admins edit copy via dashboard → Content.
// ============================================================

const SiteContent = (() => {
  const PAGES = {
    faq: { slug: 'faqs', label: 'FAQs' },
    faqs: { slug: 'faqs', label: 'FAQs' },
    guide: { slug: 'guide', label: 'How it works' },
    terms: { slug: 'terms', label: 'Terms' },
    privacy: { slug: 'privacy', label: 'Privacy' }
  };

  const FALLBACK = window.SITE_CONTENT_DEFAULTS || {
    faqs: { title: 'Frequently asked questions', items: [] },
    terms: { title: 'Terms and conditions', body: '' },
    privacy: { title: 'Privacy policy', body: '' },
    guide: { title: 'How Plexi Mall works', body: '' },
    tour: { title: 'In-app tour', items: [], version: 1 }
  };

  function pageUrl(page) {
    const nested = /\/(dashboard|store)\//.test(location.pathname);
    const key = String(page || 'faq').toLowerCase();
    const slug = PAGES[key] ? (key === 'faqs' ? 'faq' : key === 'faq' ? 'faq' : key) : 'faq';
    return `${nested ? '../' : ''}legal.html?page=${encodeURIComponent(slug)}`;
  }

  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function safeHref(href) {
    const s = String(href || '').trim();
    if (!s || /^javascript:/i.test(s) || /^data:/i.test(s)) return '';
    if (/^https?:\/\//i.test(s) || s.startsWith('/') || s.startsWith('#') || /^[\w./-]+\.html(?:[?#].*)?$/i.test(s)) {
      return s;
    }
    return '';
  }

  function inline(s) {
    let out = escapeHtml(s);
    out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
      const url = safeHref(href);
      if (!url) return escapeHtml(label);
      return `<a href="${escapeHtml(url)}">${escapeHtml(label)}</a>`;
    });
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    return out;
  }

  function renderMarkdown(src) {
    const text = String(src || '').replace(/\r\n/g, '\n').trim();
    if (!text) return '<p class="legal-empty">Nothing published yet.</p>';
    const blocks = text.split(/\n{2,}/);
    return blocks.map((block) => {
      const t = block.trim();
      if (!t) return '';
      if (/^###\s/.test(t)) return `<h3>${inline(t.replace(/^###\s/, ''))}</h3>`;
      if (/^##\s/.test(t)) return `<h2>${inline(t.replace(/^##\s/, ''))}</h2>`;
      if (/^#\s/.test(t)) return `<h1>${inline(t.replace(/^#\s/, ''))}</h1>`;
      const lines = t.split('\n');
      const list = lines.filter((l) => /^[-*]\s/.test(l.trim()));
      if (list.length && list.length === lines.filter((l) => l.trim()).length) {
        return `<ul>${list.map((l) => `<li>${inline(l.trim().replace(/^[-*]\s/, ''))}</li>`).join('')}</ul>`;
      }
      return `<p>${inline(t).replace(/\n/g, '<br>')}</p>`;
    }).join('');
  }

  function looksLikeContent(data, key) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
    if (data.stores || data.products) return false;
    if (key) return 'title' in data || 'items' in data || 'body' in data || data.slug === key;
    return !!(data.faqs || data.terms || data.privacy || data.guide || data.tour);
  }

  async function load(slug) {
    const key = slug || '';
    try {
      const data = await api.stores.content(key || undefined);
      if (!looksLikeContent(data, key)) return key ? (FALLBACK[key] || FALLBACK.guide) : FALLBACK;
      if (key) return data || FALLBACK[key] || FALLBACK.guide;
      return data;
    } catch (_) {
      if (key) return FALLBACK[key] || FALLBACK.guide;
      return FALLBACK;
    }
  }

  function formatUpdated(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (_) {
      return '';
    }
  }

  function renderFaqs(items, host) {
    const list = (items || []).filter((x) => x && x.active !== false && x.question).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    if (!host) return;
    if (!list.length) {
      host.innerHTML = '<p class="legal-empty">No FAQs published yet.</p>';
      return;
    }
    const cats = [...new Set(list.map((x) => x.category || 'General'))];
    host.innerHTML = cats.map((cat) => {
      const group = list.filter((x) => (x.category || 'General') === cat);
      return `<div class="faq-group">
        <h3 class="faq-group-title">${escapeHtml(cat)}</h3>
        ${group.map((item, i) => `
          <details class="faq-item"${i === 0 && cats[0] === cat ? ' open' : ''}>
            <summary>${escapeHtml(item.question)}</summary>
            <div class="faq-answer markdown-body">${renderMarkdown(item.answer)}</div>
          </details>`).join('')}
      </div>`;
    }).join('');
  }

  function helpMenuHtml() {
    return `
      <a href="${pageUrl('faq')}" class="dropdown-item">FAQs</a>
      <a href="${pageUrl('guide')}" class="dropdown-item">How it works</a>
      <button type="button" class="dropdown-item" data-tour-start>Take the tour</button>
      <div class="dropdown-divider"></div>
      <a href="${pageUrl('terms')}" class="dropdown-item">Terms</a>
      <a href="${pageUrl('privacy')}" class="dropdown-item">Privacy</a>`;
  }

  function mountHelpMenu(host) {
    const el = typeof host === 'string' ? document.querySelector(host) : host;
    if (!el || document.getElementById('nav-help')) return;
    const wrap = document.createElement('div');
    wrap.className = 'dropdown';
    wrap.id = 'nav-help';
    wrap.setAttribute('data-tour', 'help');
    wrap.innerHTML = `
      <button type="button" class="btn btn-ghost btn-icon" data-dropdown="nav-help-dd" aria-label="Help" title="Help">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      </button>
      <div class="dropdown-menu" id="nav-help-dd" style="right:0;min-width:200px;">${helpMenuHtml()}</div>`;
    el.insertBefore(wrap, el.firstChild);
    wrap.querySelector('[data-tour-start]')?.addEventListener('click', () => {
      if (window.PlexiTour) PlexiTour.start({ force: true });
    });
    if (window.UI && typeof UI.initDropdowns === 'function') UI.initDropdowns();
  }

  return { PAGES, pageUrl, escapeHtml, renderMarkdown, load, formatUpdated, renderFaqs, mountHelpMenu, helpMenuHtml };
})();

window.SiteContent = SiteContent;
